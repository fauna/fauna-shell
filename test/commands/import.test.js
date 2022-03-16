const { expect, test } = require('@oclif/test')
const { withOpts } = require('../helpers/utils.js')
const { Client, query } = require('faunadb')
const ImportLimits = require('../../src/lib/import-limits')

const client = new Client({
  secret: 'secret',
  domain: 'localhost',
  port: 8443,
  scheme: 'http',
  checkNewVersion: false,
  keepAlive: true,
})

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

async function assertCollectionDoesNotExist(collectionName) {
  const response = await client.query(
    query.Exists(query.Collection(collectionName))
  )
  expect(response).to.equal(false)
}

describe('import', () => {
  describe('help and bad inputs', () => {
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

    test
      .stdout()
      .stub(ImportLimits, 'maximumImportSize', () => -1)
      .do(async () => {
        await deleteCollection('bar', true)
      })
      .finally(async () => {
        await deleteCollection('bar', false)
      })
      .command(
        withOpts([
          'import',
          '--path=import_test_data/type_tests/number_type.csv',
          '--collection=bar',
          '--type=age::number',
        ])
      )
      .catch((e) => {
        expect(e.message).to.contain(
          "File (import_test_data/type_tests/number_type.csv) size is greater than 10GB, can't proceed with the import"
        )
      })
      .it('rejects big files', async () => {
        await assertCollectionDoesNotExist('bar')
      })

    test
      .stdout()
      .stub(ImportLimits, 'maximumImportSize', () => -1)
      .do(async () => {
        await deleteCollection('bar', true)
      })
      .finally(async () => {
        await deleteCollection('bar', false)
      })
      .command(
        withOpts([
          'import',
          '--path=import_test_data/type_tests/',
          '--collection=bar',
          '--type=age::number',
        ])
      )
      .catch((e) => {
        expect(e.message).to.contain(
          "Folder (import_test_data/type_tests/) size is greater than 10GB, can't proceed with the import"
        )
      })
      .it('rejects big folders', async () => {
        await assertCollectionDoesNotExist('bar')
      })
  })

  describe('successful imports of files', () => {
    async function getAllItemsInCollection(collectionName) {
      const results = []
      var nextToken
      do {
        const response = await client.query(
          query.Map(
            query.Paginate(query.Documents(query.Collection(collectionName))),
            query.Lambda('x', query.Get(query.Var('x')))
          )
        )
        nextToken = response.after
        results.push(...response.data.map((x) => x.data))
      } while (nextToken)
      return results
    }

    async function doCollectionAssertions(collection, expected) {
      const results = await getAllItemsInCollection(collection)
      expect(results).to.have.deep.members(expected)
    }

    test
      .stdout()
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
      .it('creates a collection from a CSV', async (ctx) => {
        expect(ctx.stdout).to.match(/Import from .* completed/)
        const expected = [
          { id: '1', name: 'mia', age: '14' },
          { id: '3', name: 'pixie', age: '4.5' },
          { id: '5', name: 'unborn', age: '-2' },
          { id: '6', name: 'cliff' },
        ]
        await doCollectionAssertions('number_type', expected)
      })

    test
      .stdout()
      .timeout(61000)
      .do(async () => {
        await deleteCollection('foo', true)
      })
      .finally(async () => {
        await deleteCollection('foo', false)
      })
      .command(
        withOpts([
          'import',
          '--path=import_test_data/type_tests/number_type.csv',
          '--collection=foo',
          '--type=age::number',
        ])
      )
      .it(
        'creates a collection with type translations from a CSV',
        async (ctx) => {
          expect(ctx.stdout).to.match(/Import from .* completed/)
          const expected = [
            { id: '1', name: 'mia', age: 14 },
            { id: '3', name: 'pixie', age: 4.5 },
            { id: '5', name: 'unborn', age: -2 },
            { id: '6', name: 'cliff' },
          ]
          await doCollectionAssertions('foo', expected)
        }
      )

    test
      .stdout()
      .stderr()
      .timeout(61000)
      .do(async () => {
        await deleteCollection('zed', true)
      })
      .finally(async () => {
        await deleteCollection('zed', false)
      })
      .command(
        withOpts([
          'import',
          '--path=import_test_data/type_tests/bad_number_type.csv',
          '--collection=zed',
          '--type=age::number',
        ])
      )
      .it(
        'creates a collection with type translations from a CSV; ignoring bad data',
        async (ctx) => {
          expect(ctx.stdout).to.match(/Import from .* completed/)
          expect(ctx.stderr).to.match(/item number 1 \(zero-indexed\)/)
          const expected = [{ id: '1', name: 'mia', age: 14, sign: 'cancer' }]
          await doCollectionAssertions('zed', expected)
        }
      )

    test
      .stdout()
      .stderr()
      .timeout(61000)
      .do(async () => {
        await deleteCollection('nada', true)
      })
      .finally(async () => {
        await deleteCollection('nada', false)
      })
      .command(
        withOpts([
          'import',
          '--path=import_test_data/type_tests/bad_number_type.csv',
          '--collection=nada',
          '--type=age::number',
          '--dry-run',
        ])
      )
      .it('dry-run creates no collection but prints errors', async (ctx) => {
        expect(ctx.stdout).to.match(/Import from .* completed/)
        expect(ctx.stderr).to.match(/item number 1 \(zero-indexed\)/)
        await assertCollectionDoesNotExist('nada')
      })
  })
})
