const fs = require('fs')
const csvStream = require('csv-stream')
const StreamJsonArray = require('stream-json/streamers/StreamArray')
const util = require('util')
const { flags } = require('@oclif/command')
const FaunaCommand = require('../lib/fauna-command.js')
const FaunaWriteStream = require('../lib/fauna-write-stream')
const faunadb = require('faunadb')
const p = require('path')
const withParser = require('stream-json/utils/withParser')
const q = faunadb.query

class JsonArrayValuesStream extends StreamJsonArray {
  push(obj) {
    super.push(obj ? obj.value : obj)
  }
}

const StringBool = (val) => {
  const trully = ['true', 'yes', '1', 1, true]
  return trully.includes(val)
}

class ImportCommand extends FaunaCommand {
  supportedExt = ['.csv', '.json']

  colTypeCast = {
    number: Number,
    date: (val) =>
      Number.isNaN(Number(val))
        ? new Date(val)
        : new Date(Number(val.length === 13 ? val : val + '000')),
    bool: StringBool,
  }

  streamStrategy = {
    '.csv': csvStream.createStream,
    '.json': () => withParser(() => new JsonArrayValuesStream()),
  }

  async run() {
    const { db, col, path } = this.flags
    const { client } = await (db
      ? this.ensureDbScopeClient(db)
      : this.getClient())
    this.client = client

    this.log(`Database${db ? `'${db}'` : ''} connection established`)

    this.typeCasting = this.ensureTypeCasting(col)

    const isDir = fs.lstatSync(path).isDirectory()
    return (isDir ? this.importDir(path) : this.importFile(path)).catch(
      (error) => this.handleError(error)
    )
  }

  ensureTypeCasting(col) {
    if (!col) return {}
    const types = col.reduce(
      (memo, next) => {
        const [name, type] = next.split('::')
        return {
          casting: {
            ...memo.casting,
            [name]: this.colTypeCast[type],
          },
          invalidType: this.colTypeCast[type]
            ? memo.invalidType
            : [...memo.invalidType, name],
        }
      },
      { casting: {}, invalidType: [] }
    )

    if (types.invalidType.length !== 0) {
      this.error(`Following columns has invalid type: ${types.invalidType}`)
    }

    return types.casting
  }

  async importDir(path) {
    const files = fs.readdirSync(path)

    for (const file of files) {
      try {
        await this.importFile(p.join(path, file))
      } catch (e) {
        this.warn(e.message)
      }
    }
  }

  async importFile(path) {
    let { collection } = this.flags
    const source = this.parseFileName(path)
    if (!collection) {
      collection = source.name
    }
    await this.dataImport({ source, collection })
    this.success(`Import from ${path} to ${collection} completed`)
  }

  parseFileName(path) {
    const { name, ext } = p.parse(p.basename(path))

    if (!this.supportedExt.includes(ext)) {
      throw new Error(`File (${path}) extension doesn't supported`)
    }
    return { name, ext, path }
  }

  async dataImport({ source, collection }) {
    await this.upsertCollection({
      collection,
    })

    const faunaWriteStream = new FaunaWriteStream({
      source,
      log: this.log,
      collection,
      client: this.client,
      flags: this.flags,
      typeCasting: this.typeCasting,
    })

    await new Promise((resolve, reject) => {
      fs.createReadStream(source.path, { highWaterMark: 500000 })
        .pipe(this.streamStrategy[source.ext]())
        .pipe(faunaWriteStream)
        .on('error', reject)
        .on('end', resolve)
    })
  }

  handleError(error) {
    if (error instanceof faunadb.errors.FaunaHTTPError) {
      this.error('Error:', error.faunaError.message)
      return this.error(
        util.inspect(error, {
          depth: null,
          compact: false,
        })
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

  upsertCollection({ collection }) {
    return this.client
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
          },
          { ref: q.Var('ref') }
        )
      )
      .catch((err) => {
        console.info(err)
        return Promise.reject(
          err.requestResult ? err.requestResult.responseRaw : err.message
        )
      })
  }
}

ImportCommand.description = 'Import data to Fauna'

ImportCommand.examples = [
  '$ fauna import --path ./samplefile.csv',
  '$ fauna import --db=sampleDB --collection=Samplecollection --path ./samplefile.csv',
  '$ fauna import --db=sampleDB --path ./dump',
  '$ fauna import --col=c1::date --col=c2::number --col=c3::bool --path=./files/',
]

const { graphqlHost, graphqlPort, ...commonFlags } = FaunaCommand.flags

ImportCommand.flags = {
  path: flags.string({
    required: true,
    description: 'Path to .csv/.json file either to dir with .csv/.json files',
  }),
  db: flags.string({
    description: 'Child database name',
  }),
  collection: flags.string({
    description:
      'Collection name. By default filename if --source is file, otherwise omitted',
    required: false,
  }),
  col: flags.string({
    multiple: true,
  }),
  ...commonFlags,
}

module.exports = ImportCommand
