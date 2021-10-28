const fs = require('fs')
const csvStream = require('csv-stream')
const { flags } = require('@oclif/command')
const FaunaCommand = require('../lib/fauna-command.js')
const StreamJson = require('../lib/json-stream')
const FaunaWriteStream = require('../lib/fauna-write-stream')
const faunadb = require('faunadb')
const p = require('path')
const q = faunadb.query

class ImportCommand extends FaunaCommand {
  supportedExt = ['.csv', '.json']

  streamStrategy = {
    '.csv': (stream) => stream.pipe(csvStream.createStream()),
    '.json': (stream) => stream.pipe(StreamJson.withParser()),
  }

  async run() {
    const { db, path } = this.flags
    const { client } = await (db
      ? this.ensureDbScopeClient(db)
      : this.getClient())
    this.client = client

    this.log(`Database${db ? `'${db}'` : ''} connection established`)

    const isDir = fs.lstatSync(path).isDirectory()

    let importFn
    if (isDir) {
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

    for (const file of files) {
      try {
        await this.importFile(p.join(path, file))
      } catch (e) {
        this.warn(e.message ? e.message : e)
      }
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

    const faunaWriteStream = new FaunaWriteStream({
      source,
      log: this.log,
      warn: this.warn,
      error: this.error,
      collection,
      client: this.client,
      type: this.flags.type,
    })
    await new Promise((resolve, reject) => {
      this.streamStrategy[source.ext](
        fs.createReadStream(source.path, { highWaterMark: 500000 })
      )
        .pipe(faunaWriteStream)
        .on('error', reject)
        .on('end', resolve)
    })
  }

  handleError(error) {
    console.info(error)
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
  '$ fauna import --path ./samplefile.csv',
  '$ fauna import --append --path ./samplefile.csv',
  '$ fauna import --db=sampleDB --collection=Samplecollection --path ./samplefile.csv',
  '$ fauna import --db=sampleDB --path ./dump',
  '$ fauna import --type=header_name::date --type=hdr2::number --type=hdrX::bool --path ./samplefile.csv',
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
  type: flags.string({
    description: 'Column type casting. Might be `number`, `bool` or `date`',
    multiple: true,
  }),
  append: flags.boolean({
    description: 'Allow append data to non empty collection',
  }),
  ...commonFlags,
}

module.exports = ImportCommand
