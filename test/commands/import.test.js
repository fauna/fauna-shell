const { expect, test } = require('@oclif/test')
const { withOpts } = require('../helpers/utils.js')
const { Client, query } = require('faunadb')

const client = new Client({
  secret: 'secret',
  domain: 'localhost',
  port: 8443,
  scheme: 'http',
  checkNewVersion: false,
  keepAlive: true,
})

describe('import', () => {
  describe('help and bad input', () => {
    test
      .stdout()
      .command('import')
      .catch((err) => {
        expect(err.message).to.contain('Missing required flag:\n --path PATH')
        expect(err.oclif.exit).to.not.equal(0)
      })
      .it('raises an error if --path not provided')

    test
      .stdout()
      .command(withOpts(['import', '--help']))
      // oclif treats custom help as an error; so we have this goofy block
      .catch((e) => {
        e
      })
      .it('prints help', (ctx) => {
        expect(ctx.stdout).to.contain('Import data to Fauna')
      })
  })

  describe('successful imports', () => {

    async function deleteCollection(collectionName, sleep = false) {
      const response = await client.query(
        query.If(
          query.Exists(query.Collection(collectionName)),
          query.Delete(query.Collection(collectionName)),
          'Already deleted'
        )
      )
      if (sleep && response !== 'Already deleted') {
        // sucks but long timeout required
        return new Promise((resolve) => setTimeout(resolve, 60000))
      }
    }

    test
      .timeout(61000)
      .do(async () => {
        await deleteCollection('number_type', true)
      })
      .finally(async () => {
        await deleteCollection('number_type', false)
      })
      .command(
        withOpts([
          'import',
          '--path=import_test_data/type_tests/number_type.csv',
        ])
      )
      .it('creates a collection', (ctx) => {
        expect(ctx.stdout).to.contain(/Import from .* completed/)        
      })
  })
})
