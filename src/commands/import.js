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

    return (isDir ? this.importDir() : this.importFile(source)).catch((error) =>
      this.handleError(error)
    )
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
    const { ref, isCollectionExists } = await this.upsertCollection({
      collection,
    })

    if (isCollectionExists) {
      await this.clearCollectionDocuments(ref)
    }

    const faunaWriteStream = new FaunaWriteStream({
      source,
      log: this.log,
      collectionRef: ref,
      client: this.client,
    })

    await new Promise((resolve, reject) => {
      fs.createReadStream(source)
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
              q.Let(
                {
                  collection: q.CreateCollection({ name: collection }),
                },
                q.CreateIndex({
                  source: q.Select(['ref'], q.Var('collection')),
                  name: `all_${collection}`,
                })
              )
            ),
          },
          { isCollectionExists: q.Var('isCollectionExists'), ref: q.Var('ref') }
        )
      )
      .catch((err) => Promise.reject(err.requestResult.responseRaw))
  }

  async clearCollectionDocuments(ref) {
    let keepRemoving = true
    const size = 10000
    let totalDeleted = 0

    this.log(`Deleting documents from ${ref}`)

    while (keepRemoving) {
      const resp = await this.client
        .query(
          q.Map(q.Paginate(q.Documents(ref), { size }), (docRef) =>
            q.Delete(docRef)
          )
        )
        .catch((err) => Promise.reject(err.requestResult.responseRaw))

      totalDeleted += resp.data.length
      this.log(`${totalDeleted} documents deleted from ${ref}`)

      if (resp.data.length < size) {
        keepRemoving = false
      }
    }
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
