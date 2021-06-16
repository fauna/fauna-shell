const { expect, test } = require('@oclif/test')
const { withOpts, getEndpoint } = require('../helpers/utils.js')
const { query: q } = require('faunadb')

describe('eval', () => {
  test
    .nock(getEndpoint(), { allowUnmocked: true }, mockQuery)
    .stdout()
    .command(withOpts(['eval', 'Paginate(Collections())']))
    .it('runs eval on root db', (ctx) => {
      expect(JSON.parse(ctx.stdout).data[0].targetDb).to.equal('root')
    })

  test
    .nock(getEndpoint(), { allowUnmocked: true }, mockQuery)
    .stdout()
    .command(withOpts(['eval', 'nested', 'Paginate(Collections())']))
    .it('runs eval on root db', (ctx) => {
      expect(JSON.parse(ctx.stdout).data[0].targetDb).to.equal('nested')
    })
})

function mockQuery(api) {
  api
    .persist()
    .filteringRequestBody(() => q.Paginate(q.Collections()))
    .post('/')
    .reply(200, function () {
      const [_, nestedDb] = this.req.headers.authorization[0].split(':')
      return {
        resource: {
          data: [
            {
              targetDb: nestedDb || 'root',
            },
          ],
        },
      }
    })
}
