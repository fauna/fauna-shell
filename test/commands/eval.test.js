const {expect, test} = require('@oclif/test')
const {withOpts} = require('../helpers/utils.js')

describe('eval', () => {
  test
  .stdout()
  .command(withOpts(['eval', 'Paginate(Collections())']))
  .it('runs eval', ctx => {
    expect(Array.isArray(JSON.parse(ctx.stdout).data)).to.be.true
  })
})
