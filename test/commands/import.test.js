const { expect, test } = require('@oclif/test')
const { withOpts } = require('../helpers/utils.js')
const { Client, query } = require('faunadb')
const { ImportLimits } = require('../../src/lib/import-limits')

const client = new Client({
  secret: process.env.FAUNA_SECRET,
  domain: process.env.FAUNA_DOMAIN,
  port: process.env.FAUNA_PORT,
  scheme: process.env.FAUNA_SCHEME,
  checkNewVersion: false,
  keepAlive: true,
})

function getClient(database = undefined) {
  if (database) {
    return new Client({
      secret: `${process.env.FAUNA_SECRET}:${database}:admin`,
      domain: process.env.FAUNA_DOMAIN,
      port: process.env.FAUNA_PORT,
      scheme: process.env.FAUNA_SCHEME,
      checkNewVersion: false,
      keepAlive: true,
    })
  }
  return client
}

async function createDatabase(databaseName) {
  await client.query(
    query.If(
      query.Exists(query.Database(databaseName)),
      'Already exists',
      query.CreateDatabase({ name: databaseName })
    )
  )
}

async function deleteDatabase(databaseName) {
  await client.query(
    query.If(
      query.Exists(query.Database(databaseName)),
      query.Delete(query.Database(databaseName)),
      'Already deleted'
    )
  )
}

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

async function createOrClearCollection(collectionName, database = undefined) {
  await getClient(database).query(
    query.If(
      query.Exists(query.Collection(collectionName)),
      query.Map(
        query.Paginate(query.Documents(query.Collection(collectionName))),
        query.Lambda('X', query.Delete(query.Var('X')))
      ),
      query.CreateCollection({ name: collectionName })
    )
  )
}

async function assertCollectionExists(collectionName, database = undefined) {
  const response = await getClient(database).query(
    query.Exists(query.Collection(collectionName))
  )
  expect(response).to.equal(true)
}

async function assertCollectionDoesNotExist(collectionName) {
  const response = await client.query(
    query.Exists(query.Collection(collectionName))
  )
  expect(response).to.equal(false)
}

async function getAllItemsInCollection(collectionName, database = undefined) {
  const results = []
  var nextToken
  do {
    const response = await getClient(database).query(
      query.Map(
        query.Paginate(query.Documents(query.Collection(collectionName)), {
          after: nextToken,
        }),
        query.Lambda('x', query.Get(query.Var('x')))
      )
    )
    nextToken = response.after
    results.push(...response.data.map((x) => x.data))
  } while (nextToken)
  return results
}

async function doCollectionAssertions(
  collection,
  expected,
  database = undefined,
  expectedItemPresence = undefined
) {
  const results = await getAllItemsInCollection(collection, database)
  if (expectedItemPresence) {
    for (const expectedMember of expected) {
      expect(results).to.deep.include(expectedMember)
    }
  } else {
    expect(results).to.have.deep.members(expected)
  }
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
      .do(async () => {
        await createOrClearCollection('already_exists')
        await client.query(
          query.Create(query.Collection('already_exists'), {
            data: { cat: 'dog' },
          })
        )
      })
      .command(
        withOpts([
          'import',
          '--path=import_test_data/type_tests/number_type.csv',
          '--collection=already_exists',
        ])
      )
      .catch((e) => {
        expect(e.message).to.contain(
          'Collection("already_exists") is not empty. Add \'--append\' to allow append data for non empty collection'
        )
      })
      .it(
        'rejects importing to a non-empty collection if append is not provided',
        async () => {
          const expected = [{ cat: 'dog' }]
          await doCollectionAssertions('already_exists', expected)
        }
      )

    test
      .stdout()
      .stub(ImportLimits, 'maximumImportSize', () => -1)
      .do(async () => {
        await assertCollectionDoesNotExist('bar')
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
        await assertCollectionDoesNotExist('bar')
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
      .it(
        "creates a collection from a CSV; creating the collection if it doesn't exist",
        async (ctx) => {
          expect(ctx.stdout).to.match(/Import from .* completed/)
          const expected = [
            { id: '1', name: 'mia', age: '14' },
            { id: '3', name: 'pixie', age: '4.5' },
            { id: '5', name: 'unborn', age: '-2' },
            { id: '6', name: 'cliff' },
          ]
          await doCollectionAssertions('number_type', expected)
        }
      )

    test
      .stdout()
      .do(async () => {
        await createOrClearCollection('foo')
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
      .do(async () => {
        await createOrClearCollection('zed')
      })
      .command(
        withOpts([
          'import',
          '--path=import_test_data/type_tests/bad_number_type.csv',
          '--collection=zed',
          '--type=age::number',
        ])
      )
      .catch((err) => {
        expect(err.message).to.contain('rows/object failed to import')
        expect(err.oclif.exit).to.not.equal(0)
      })
      .it(
        'creates a collection with type translations from a CSV; ignoring bad data',
        async (ctx) => {
          expect(ctx.stdout).to.match(/Database connection established/)
          expect(ctx.stderr).to.match(/item number 1 \(zero-indexed\)/)
          const expected = [{ id: '1', name: 'mia', age: 14, sign: 'cancer' }]
          await doCollectionAssertions('zed', expected)
        }
      )

    test
      .stdout()
      .stderr()
      .do(async () => {
        await assertCollectionDoesNotExist('nada')
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
      .catch((err) => {
        expect(err.message).to.contain('failed to import')
        expect(err.oclif.exit).to.not.equal(0)
      })
      .it('dry-run creates no collection but prints errors', async (ctx) => {
        expect(ctx.stdout).to.match(/Database connection established/)
        expect(ctx.stderr).to.match(/item number 1 \(zero-indexed\)/)
        await assertCollectionDoesNotExist('nada')
      })

    test
      .stdout()
      .do(async () => {
        await createOrClearCollection('append-to-me')
        await client.query(
          query.Create(query.Collection('append-to-me'), {
            data: { cat: 'dog' },
          })
        )
      })
      .command(
        withOpts([
          'import',
          '--path=import_test_data/type_tests/number_type.csv',
          '--collection=append-to-me',
          '--type=age::number',
          '--append',
        ])
      )
      .it('appends to an existing, non-empty collection', async (ctx) => {
        expect(ctx.stdout).to.match(/Import from .* completed/)
        const expected = [
          { id: '1', name: 'mia', age: 14 },
          { id: '3', name: 'pixie', age: 4.5 },
          { id: '5', name: 'unborn', age: -2 },
          { id: '6', name: 'cliff' },
          { cat: 'dog' },
        ]
        await doCollectionAssertions('append-to-me', expected)
      })

    test
      .stdout()
      .do(async () => {
        await createOrClearCollection('empty_vals')
      })
      .command(
        withOpts([
          'import',
          '--path=import_test_data/type_tests/number_type.csv',
          '--treat-empty-csv-cells-as=empty',
          '--collection=empty_vals',
        ])
      )
      .it('creates a collection from a CSV', async (ctx) => {
        expect(ctx.stdout).to.match(/Import from .* completed/)
        const expected = [
          { id: '1', name: 'mia', age: '14' },
          { id: '3', name: 'pixie', age: '4.5' },
          { id: '5', name: 'unborn', age: '-2' },
          { id: '6', name: 'cliff', age: '' },
        ]
        await doCollectionAssertions('empty_vals', expected)
      })

    test
      .stdout()
      .do(async () => {
        await createOrClearCollection('already_exists')
      })
      .command(
        withOpts([
          'import',
          '--path=import_test_data/type_tests/number_type.csv',
          '--collection=already_exists',
        ])
      )
      .it(
        'can import to an empty collection without append argument',
        async (ctx) => {
          expect(ctx.stdout).to.match(/Import from .* completed/)
          const expected = [
            { id: '1', name: 'mia', age: '14' },
            { id: '3', name: 'pixie', age: '4.5' },
            { id: '5', name: 'unborn', age: '-2' },
            { id: '6', name: 'cliff' },
          ]
          await doCollectionAssertions('already_exists', expected)
        }
      )
  })

  describe('import folders', () => {
    test
      .stdout()
      .do(async () => {
        await deleteDatabase('folder_import')
        await createDatabase('folder_import')
      })
      .command(
        withOpts([
          'import',
          '--path=import_test_data/json',
          '--db=folder_import',
        ])
      )
      .it('creates a collection for each file', async (ctx) => {
        expect(ctx.stdout).to.match(/All files completed/)
        const expectedJsonArray = [
          {
            id: '1',
            name: 'mia',
            birthday: '2010-10-31',
            age: 10,
            considered_old: true,
            complex_object: {
              boolean: true,
              number: 1,
              date: '2010-10-31',
              array: [1, 2, 3, 4, 5],
            },
          },
          // there's an empty object in here
          undefined,
          {
            id: '2',
            name: 'doug',
            birthday: '2010-10-31T00:00:00Z',
            age: 11,
            considered_old: false,
          },
          {
            id: '3',
            name: 'fran',
          },
          {
            id: '4',
            name: 'zooey',
          },
        ]
        await doCollectionAssertions(
          'json_array',
          expectedJsonArray,
          'folder_import'
        )
        const expectedJsonL = [
          {
            id: '11',
            name: 'mia',
            birthday: '2010-10-31',
            age: 10,
            considered_old: true,
            complex_object: {
              boolean: true,
              number: 1,
              date: '2010-10-31',
              array: [1, 2, 3, 4, 5],
            },
          },
          {
            id: '12',
            name: 'doug',
            birthday: '2010-10-31T00:00:00Z',
            age: 11,
            considered_old: false,
          },
          { id: '13', name: 'fran' },
          // empty object in the file
          undefined,
          {
            id: '14',
            name: 'zooey',
          },
        ]
        await doCollectionAssertions('json_l', expectedJsonL, 'folder_import')
        const expectedJsonNestedTypeTrans = [
          {
            id: '21',
            name: 'mia',
            birthday: '2010-10-31',
            age: 10,
            considered_old: true,
            complex_object: {
              boolean: true,
              number: 1,
              date: '2010-10-31',
              array: [1, 2, 3, 4, 5],
            },
          },
          {
            id: '22',
            name: 'doug',
            birthday: '2010-10-31T00:00:00Z',
            age: 11,
            considered_old: false,
          },
          {
            id: '23',
            name: 'fran',
            demographics: {
              'd.o.b': '2009-10-31T00:00:00Z',
            },
          },
        ]
        await doCollectionAssertions(
          'json_nested_type_trans',
          expectedJsonNestedTypeTrans,
          'folder_import'
        )
        // remaining files are corrupted to some extent - giving undefined behavior.
        await assertCollectionExists('mixed_array_and_l', 'folder_import')
        await assertCollectionExists('mixed_l_and_array', 'folder_import')
        await assertCollectionExists('multi_array', 'folder_import')
      })

    test
      .stdout()
      .do(async () => {
        await deleteDatabase('folder_import')
        await createDatabase('folder_import')
      })
      .command(
        withOpts([
          'import',
          '--path=import_test_data/json',
          '--db=folder_import',
          '--collection=one_collection',
        ])
      )
      .it(
        'creates a single collection from all files when collection specified',
        async (ctx) => {
          expect(ctx.stdout).to.match(/All files completed/)
          const expectedJsonArray = [
            {
              id: '1',
              name: 'mia',
              birthday: '2010-10-31',
              age: 10,
              considered_old: true,
              complex_object: {
                boolean: true,
                number: 1,
                date: '2010-10-31',
                array: [1, 2, 3, 4, 5],
              },
            },
            // there's an empty object in here
            undefined,
            {
              id: '2',
              name: 'doug',
              birthday: '2010-10-31T00:00:00Z',
              age: 11,
              considered_old: false,
            },
            {
              id: '3',
              name: 'fran',
            },
            {
              id: '4',
              name: 'zooey',
            },
          ]
          const expectedJsonL = [
            {
              id: '11',
              name: 'mia',
              birthday: '2010-10-31',
              age: 10,
              considered_old: true,
              complex_object: {
                boolean: true,
                number: 1,
                date: '2010-10-31',
                array: [1, 2, 3, 4, 5],
              },
            },
            {
              id: '12',
              name: 'doug',
              birthday: '2010-10-31T00:00:00Z',
              age: 11,
              considered_old: false,
            },
            { id: '13', name: 'fran' },
            // empty object in the file
            undefined,
            {
              id: '14',
              name: 'zooey',
            },
          ]
          const expectedJsonNestedTypeTrans = [
            {
              id: '21',
              name: 'mia',
              birthday: '2010-10-31',
              age: 10,
              considered_old: true,
              complex_object: {
                boolean: true,
                number: 1,
                date: '2010-10-31',
                array: [1, 2, 3, 4, 5],
              },
            },
            {
              id: '22',
              name: 'doug',
              birthday: '2010-10-31T00:00:00Z',
              age: 11,
              considered_old: false,
            },
            {
              id: '23',
              name: 'fran',
              demographics: {
                'd.o.b': '2009-10-31T00:00:00Z',
              },
            },
          ]
          await doCollectionAssertions(
            'one_collection',
            [
              ...expectedJsonL,
              ...expectedJsonArray,
              ...expectedJsonNestedTypeTrans,
            ],
            'folder_import',
            'check_item_presence'
          )
        }
      )

    test
      .stdout()
      .do(async () => {
        await deleteDatabase('append_folder_import')
        await createDatabase('append_folder_import')
        await createOrClearCollection(
          'append_collection',
          'append_folder_import'
        )
        await getClient('append_folder_import').query(
          query.Create(query.Collection('append_collection'), {
            data: { dog: 'cat' },
          })
        )
      })
      .command(
        withOpts([
          'import',
          '--path=import_test_data/json',
          '--db=append_folder_import',
          '--collection=append_collection',
          '--append',
        ])
      )
      .it('appends to an existing, non-empty collection', async (ctx) => {
        expect(ctx.stdout).to.match(/All files completed/)
        const expectedJsonArray = [
          {
            id: '1',
            name: 'mia',
            birthday: '2010-10-31',
            age: 10,
            considered_old: true,
            complex_object: {
              boolean: true,
              number: 1,
              date: '2010-10-31',
              array: [1, 2, 3, 4, 5],
            },
          },
          // there's an empty object in here
          undefined,
          {
            id: '2',
            name: 'doug',
            birthday: '2010-10-31T00:00:00Z',
            age: 11,
            considered_old: false,
          },
          {
            id: '3',
            name: 'fran',
          },
          {
            id: '4',
            name: 'zooey',
          },
        ]
        const expectedJsonL = [
          {
            id: '11',
            name: 'mia',
            birthday: '2010-10-31',
            age: 10,
            considered_old: true,
            complex_object: {
              boolean: true,
              number: 1,
              date: '2010-10-31',
              array: [1, 2, 3, 4, 5],
            },
          },
          {
            id: '12',
            name: 'doug',
            birthday: '2010-10-31T00:00:00Z',
            age: 11,
            considered_old: false,
          },
          { id: '13', name: 'fran' },
          // empty object in the file
          undefined,
          {
            id: '14',
            name: 'zooey',
          },
        ]
        const expectedJsonNestedTypeTrans = [
          {
            id: '21',
            name: 'mia',
            birthday: '2010-10-31',
            age: 10,
            considered_old: true,
            complex_object: {
              boolean: true,
              number: 1,
              date: '2010-10-31',
              array: [1, 2, 3, 4, 5],
            },
          },
          {
            id: '22',
            name: 'doug',
            birthday: '2010-10-31T00:00:00Z',
            age: 11,
            considered_old: false,
          },
          {
            id: '23',
            name: 'fran',
            demographics: {
              'd.o.b': '2009-10-31T00:00:00Z',
            },
          },
        ]
        await doCollectionAssertions(
          'append_collection',
          [
            ...expectedJsonL,
            ...expectedJsonArray,
            ...expectedJsonNestedTypeTrans,
            //            { dog: 'cat' },
          ],
          'append_folder_import',
          'check_item_presence'
        )
      })
  })
})
