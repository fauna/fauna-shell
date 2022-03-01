const fs = require('fs')

const { flags } = require('@oclif/command')
const FaunaCommand = require('../lib/fauna-command.js')
const StreamJson = require('../lib/json-stream')
const FaunaWriteStream = require('../lib/fauna-write-stream')
const faunadb = require('faunadb')
const { pipeline } = require('stream')
const p = require('path')
const CSVStream = require('../lib/csv-stream')
const q = faunadb.query
class ImportCommand extends FaunaCommand {
  supportedExt = ['.csv', '.json', '.jsonl']

  streamStrategy = {
    '.csv': (flags) =>
      new CSVStream({
        flags,
        escapeChar: '"',
        enclosedChar: '"',
        endLine: ['\r', '\n', '\r\n'],
      }),
    '.json': () => StreamJson.withParser(),
    '.jsonl': () => StreamJson.withParser(),
  }

  isDir(path) {
    return fs.lstatSync(path).isDirectory()
  }

  async run() {
    const { db, path } = this.flags
    const { client } = await (db
      ? this.ensureDbScopeClient(db)
      : this.getClient())
    this.client = client

    this.log(`Database${db ? `'${db}'` : ''} connection established`)

    let importFn
    if (this.isDir(path)) {
      this.flags.collection = undefined // use file name instead
      importFn = this.importDir
    } else {
      importFn = this.importFile
    }

    return importFn.call(this, path).catch((error) => this.handleError(error))
  }

  async importDir(path) {
    const files = fs.readdirSync(path)

    // check if folder size is approximately greater than 10GB
    if (this.calculateFolderSize(path, files) > 10000) {
      throw new Error(
        `Folder (${path}) size is greater than 10GB, can't proceed with the import`
      )
    }

    const failedFiles = []

    for (const file of files) {
      const subPath = p.resolve(path, file)
      if (this.isDir(subPath)) {
        const warning = `"${file}" subdirectory is skipped from processing`
        failedFiles.push({ file, warning })
        this.warn(warning)
        continue
      }
      try {
        await this.importFile(subPath)
      } catch (e) {
        const warning = e.message ? e.message : e
        failedFiles.push({ file, warning })
        this.warn(warning)
      }
    }

    this.log('\n\nImport completed')
    if (failedFiles.length > 0) {
      this.warn(`${failedFiles.length} files failed to import`)
      failedFiles.forEach((failed) =>
        this.warn(`${failed.file} => ${failed.warning}`)
      )
    } else {
      this.success('All files imported')
    }
  }

  async importFile(path) {
    // check if file size is approximately greater than 10GB
    if (this.calculateFileSize(path) > 10000) {
      throw new Error(
        `File (${path}) size is greater than 10GB, can't proceed with the import`
      )
    }

    let { collection } = this.flags
    const source = this.parseFileName(path)
    if (!collection) {
      collection = source.name
    }
    await this.dataImport({ source, collection })
    this.success(`Import from ${path} to ${collection} completed`)
  }

  calculateFileSize(path) {
    const stats = fs.statSync(path)
    return stats.size / (1024 * 1024)
  }

  calculateFolderSize(path, files) {
    let folderSize = 0
    for (const file of files) {
      let filePath = p.join(path, file)
      folderSize += this.calculateFileSize(filePath)
    }
    return folderSize
  }

  parseFileName(path) {
    const { name, ext } = p.parse(p.basename(path))

    if (!this.supportedExt.includes(ext)) {
      throw new Error(`File (${path}) extension isn't supported`)
    }
    return { name, ext, path }
  }

  async dataImport({ source, collection }) {
    await this.ensureCollection({
      collection,
    })

    const StringBool = (val) => {
      const trully = ['true', 't', 'yes', '1', 1, true]
      return trully.includes(val.toLowerCase())
    }

    const StringDate = (val) => {
      const date =
        Number.isNaN(Number(val)) || val.length === 13
        ? new Date(val)
        : new Date(Number(val) * 1000)
      return q.Time(date.toISOString())
    }

    const prepareRecord = (obj) => {
      return Object.keys(obj).reduce((memo, next) => {
        memo[next.trim()] = obj[next]
        return memo
      }, {})
    };

    const getRecord = (chunk) => {
      return castType(prepareRecord(chunk));
    }

    const colTypeCast = {
      number: Number,
      date: StringDate,
      bool: StringBool,
    };

    const typeCasting = (type = this.flags.type) => {
      if (!type) return {}
      const types = type.reduce(
        (memo, next) => {
          const [name, type] = next.split('::')
          return {
            casting: {
              ...memo.casting,
              [name]: { type, castFn: colTypeCast[type] },
            },
            invalidType: colTypeCast[type]
                       ? memo.invalidType
                       : [...memo.invalidType, name],
          }
        },
        { casting: {}, invalidType: [] }
      )
      
      if (types.invalidType.length !== 0) {
        this.emit(
          'error',
          new Error(`Following columns has invalid type: ${types.invalidType}`)
        )
      }
      
      return types.casting
    };

    const castType = (obj) => {
      return Object.keys(typeCasting).reduce((memo, col) => {
        if (memo[col] === undefined) return memo
        const castedValue = typeCasting[col].castFn(memo[col])
        if (castedValue !== undefined) {
          memo[col] = castedValue
        } else {
          this.warn(
            `Value '${memo[col]}' at column '${col}' can not be casted to type '${this.typeCasting[col].type}'`
          )
        }
        return memo
      }, obj)
    };

    let linesRead = 0;
    let items = [];
    const streamConsumer = async (inputStream) => {
      for await (const chunk of inputStream) {
        items.push(getRecord(chunk));
        if (items.length >= 10) {
          this.log(items);
          linesRead += items.length;
          items = [];
        }
      }
      if (items.length > 0) {
          this.log(items);
          linesRead += items.length;
          items = [];
      }
    }
    await new Promise((resolve, reject) => {
      pipeline(
        fs.createReadStream(source.path, { highWaterMark: 500000 }),
        this.streamStrategy[source.ext](this.flags),
        streamConsumer,
        (error) => {
            console.log(linesRead);
            if (error) return reject(error)
            resolve()
        }
      )
    })
  }

  handleError(error) {
    if (error instanceof faunadb.errors.FaunaHTTPError) {
      return this.error(
        `Error: ${
          error.faunaError
            ? error.faunaError.message
            : error.requestResult.responseRaw
        }`,
        { exit: false }
      )
    }
    if (error instanceof Error) {
      return this.error(error.message)
    }

    if (Array.isArray(error)) {
      this.error(`\r\n\t${error.join('\r\n\t')}`)
    }

    this.error(error)
  }

  async ensureCollection({ collection }) {
    const result = await this.client
      .query(
        q.Let(
          {
            ref: q.Collection(collection),
            isCollectionExists: q.Exists(q.Var('ref')),
            collection: q.If(
              q.Var('isCollectionExists'),
              '',
              q.CreateCollection({ name: collection })
            ),
            isEmpty: q.If(
              q.Var('isCollectionExists'),
              q.IsEmpty(q.Documents(q.Var('ref'))),
              true
            ),
          },
          { ref: q.Var('ref'), isEmpty: q.Var('isEmpty') }
        )
      )
      .catch((err) =>
        Promise.reject(
          err.requestResult ? err.requestResult.responseRaw : err.message
        )
      )

    if (!result.isEmpty && !this.flags.append) {
      return Promise.reject(
        new Error(
          `${result.ref} is not empty. Add '--append' to allow append data for non empty collection`
        )
      )
    }
  }
}

ImportCommand.description = 'Import data to Fauna'

ImportCommand.examples = [
  '$ fauna import --path ./collection_name.csv',
  '$ fauna import --append --path ./collection.csv',
  '$ fauna import --db=sampleDB --collection=SampleCollection --path ./datafile.csv',
  '$ fauna import --db=sampleDB --path ./dump',
  '$ fauna import --type=header_name::date --type=hdr2::number --type=hdrX::bool --path ./collection.csv',
]

const { graphqlHost, graphqlPort, ...commonFlags } = FaunaCommand.flags

ImportCommand.flags = {
  path: flags.string({
    required: true,
    description:
      'Path to .csv/.json file, or path to folder containing .csv/.json files',
  }),
  db: flags.string({
    description:
      'Child database name; imported documents are stored in this database',
  }),
  collection: flags.string({
    description:
      'Collection name. When not specified, the collection name is the filename when --path is file',
    required: false,
  }),
  type: flags.string({
    description: `Column type casting, converts the column value to a Fauna type.\nFormat: <column>::<type>\n<column>: the name of the column to cast values\n<type>: one of 'number', 'bool', or 'date'.`,
    multiple: true,
  }),
  append: flags.boolean({
    description: 'Allows appending documents to a non-empty collection',
  }),
  'allow-short-rows': flags.boolean({
    description: 'Allows rows which are shorter than the number of headers',
  }),
  ...commonFlags,
}

module.exports = ImportCommand
