const {expect, test} = require('@oclif/test')

describe('delete-database', () => {
  test
  .command(['delete-database', 'testdb'])
  .catch(err => {
    expect(err.message).to.contain("Database 'testdb' not found")
    expect(err.oclif.exit).to.equal(1)
  })
  .it('runs delete-database testdb')

  test
  .stdout()
  .command(['create-database', 'testdb'])
  .it('runs create-database testdb', ctx => {
    expect(ctx.stdout).to.contain("created database 'testdb'")
  })

  test
  .stdout()
  .command(['delete-database', 'testdb'])
  .it('runs delete-database testdb', ctx => {
    expect(ctx.stdout).to.contain("database 'testdb' deleted")
  })
})
