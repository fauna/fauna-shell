const fs = require('fs')
const csv = require('csv-stream')
const util = require('util')
const { flags } = require('@oclif/command')
const FaunaCommand = require('../lib/fauna-command.js')
const FaunaWriteStream = require('../lib/fauna-write-stream')
const faunadb = require('faunadb')
const path = require('path')
const q = faunadb.query

class ImportCommand extends FaunaCommand {
  async run() {
    const { db } = this.flags
    const { source } = this.args
    const { client } = await (db
      ? this.ensureDbScopeClient(db)
      : this.getClient())
    this.client = client

    this.log(`Database${db ? `'${db}'` : ''} connection established`)

    const isDir = fs.lstatSync(source).isDirectory()

    console.time('import')
    return (isDir ? this.importDir() : this.importFile(source))
      .then(() => {
        console.timeEnd('import')
      })
      .catch((error) => this.handleError(error))
  }

  async importDir() {}

  async importFile(source) {
    let { collection } = this.flags
    const parsedFileName = this.parseFileName(source)
    if (!collection) {
      collection = parsedFileName.name
    }
    await this.dataImport({ source, collection })
  }

  parseFileName(source) {
    const { name, ext } = path.parse(path.basename(source))

    // TODO: support json
    if (ext !== '.csv') {
      throw new Error(`File (${source}) must include the '.csv' extension.`)
    }
    return { name, ext }
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
    })

    await new Promise((resolve, reject) => {
      fs.createReadStream(source, { highWaterMark: 500000 })
        .pipe(csv.createStream())
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
  '$ fauna import --db=sampleDB ./samplefile.csv',
  '$ fauna import --db=sampleDB --collection=Samplecollection ./samplefile.csv',
  '$ fauna import --db=sampleDB ./dump',
]

ImportCommand.args = [
  {
    name: 'source',
    required: true,
    description: 'Path to .csv/.json file either to dir with .csv/.json files',
  },
]

const { graphqlHost, graphqlPort, ...commonFlags } = FaunaCommand.flags

ImportCommand.flags = {
  db: flags.string({
    description: 'Child database name',
  }),
  collection: flags.string({
    description:
      'Collection name. By default filename if --source is file, otherwise omitted',
    required: false,
  }),
  ...commonFlags,
}

module.exports = ImportCommand
