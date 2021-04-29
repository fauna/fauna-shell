const {expect, test} = require('@oclif/test')
const {withOpts} = require('../helpers/utils.js')

describe('database test', () => {
  test
  .stdout()
  .command(withOpts(['list-databases']))
  .it('runs list-databases', (ctx, ...rest) => {
    expect(ctx.stdout).to.contain('No databases created')
  })

  test
  .stdout()
  .command(withOpts(['delete-database', 'testdb']))
  .catch(err => {
    expect(err.message).to.contain("Database 'testdb' not found")
    expect(err.oclif.exit).to.equal(1)
  })
  .it('runs delete-database testdb')

  test
  .stdout()
  .command(withOpts(['create-database', 'testdb']))
  .it('runs create-database testdb', ctx => {
    expect(ctx.stdout).to.contain("created database 'testdb'")
  })

  test
  .stdout()
  .command(withOpts(['list-databases']))
  .it('runs list-databases', ctx => {
    expect(ctx.stdout).to.contain('testdb')
  })

  test
  .stdout()
  .command(withOpts(['create-database', 'testdb']))
  .catch(err => {
    expect(err.message).to.contain("Database 'testdb' already exists.")
    expect(err.oclif.exit).to.equal(1)
  })
  .it('runs create-database testdb')

  test
  .stdout()
  .command(withOpts(['delete-database', 'testdb']))
  .it('runs delete-database testdb', ctx => {
    expect(ctx.stdout).to.contain("database 'testdb' deleted")
  })

  test
  .stdout()
  .command(withOpts(['list-databases']))
  .it('runs list-databases', ctx => {
    expect(ctx.stdout).to.contain('No databases created')
  })
})
