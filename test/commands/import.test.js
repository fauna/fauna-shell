const stream = require('stream')
const { expect, test } = require('@oclif/test')
const { withOpts, getEndpoint, matchFqlReq } = require('../helpers/utils.js')
const q = require('faunadb').query
const fs = require('fs')

describe('import', () => {
  mockTest(test, { isCollectionEmpty: true, isDirectory: false })
    .stdout()
    .command(withOpts(['import', '--path', './files/test.json']))
    .it('runs import file', (ctx) => {
      expect(ctx.stdout).to.contain('Success: Import from ./files/test.json')
    })

  mockTest(test, {
    isCollectionEmpty: true,
    isDirectory: false,
    isBigFile: true,
  })
    .stdout()
    .command(withOpts(['import', '--path', './files/test.json']))
    .it('should throw an error if file size more then 10gb', (ctx) => {
      expect(ctx.stdout).to.contain('Success: Import from ./files/test.json')
    })

  mockTest(test, { isCollectionEmpty: false, isDirectory: false })
    .stdout()
    .command(withOpts(['import', '--path', './files/test.json']))
    .catch((err) => {
      expect(err.message).to.contain(
        `Add '--append' to allow append data for non empty collection`
      )
    })
    .it('runs import to non empty collection')

  mockTest(test, {
    isCollectionEmpty: false,
    isDirectory: false,
    withAppend: true,
  })
    .stdout()
    .command(withOpts(['import', '--path', './files/test.json', '--append']))
    .it('runs import for non empty collection with append', (ctx) => {
      expect(ctx.stdout).to.contain('Success: Import from ./files/test.json')
    })

  mockTest(test, {
    isCollectionEmpty: true,
    isDirectory: false,
    invalidFields: true,
  })
    .stdout()
    .command(withOpts(['import', '--path', './files/test.json']))
    .it('runs import invalid fields', (ctx) => {
      expect(ctx.stdout).to.contain('Success: Import from ./files/test.json')
    })
})

function mockTest(
  test,
  { isCollectionEmpty, isDirectory, withAppend, invalidFields, isBigFile }
) {
  const originalLstatSync = fs.lstatSync
  const originalStatSync = fs.lstatSync

  const data = new Array(10)
    .fill('')
    .map((_, index) => ({ [invalidFields ? '!invalid!' : 'valud']: index }))
  const collection = 'test'

  return test
    .nock(getEndpoint(), { allowUnmocked: true }, (api) => {
      api
        .post('/', matchFqlReq(q.Now()))
        .reply(200, new Date())
        .post('/', matchFqlReq(EnsureCollectionQuery(collection)))
        .reply(200, {
          resource: {
            ref: collection,
            isEmpty: isCollectionEmpty,
          },
        })
      if (isCollectionEmpty || withAppend) {
        api
          .post('/', matchFqlReq(ImportQuery([...data], collection)))
          .reply(200, {
            resource: {},
          })
      }
    })
    .stub(fs, 'lstatSync', (...args) => {
      if (args[0].includes('./files/test.json'))
        return { isDirectory: () => isDirectory }
      return originalLstatSync(...args)
    })
    .stub(fs, 'statSync', (...args) => {
      if (args[0].includes('./files/test.json'))
        return isBigFile ? 11 * 1024 * 1024 : 1
      return originalStatSync(...args)
    })
    .stub(
      fs,
      'createReadStream',
      () =>
        new stream.Readable({
          read() {
            const item = data.shift()
            this.push(item ? Buffer.from(JSON.stringify(item)) : null)
          },
        })
    )
}

function ImportQuery(chunk, collection) {
  return q.Let(
    {
      import: q.Do(
        chunk.map((data) => q.Create(q.Collection(collection), { data }))
      ),
    },
    1
  )
}

function EnsureCollectionQuery(collection) {
  return q.Let(
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
}
