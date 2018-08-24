const {expect, test} = require('@oclif/test')

describe('create-database', () => {
  test
  .stdout()
  .command(['create-database', 'testdb'])
  .it('runs create-database testdb', ctx => {
    expect(ctx.stdout).to.contain("created database 'testdb'")
  })

  test
  .stderr()
  .command(['create-database', 'testdb'])
  .catch(err => {
    expect(err.message).to.contain("Database 'testdb' already exists.")
  })
  .it('runs create-database testdb')

  test
  .stdout()
  .command(['delete-database', 'testdb'])
  .it('runs delete-database testdb', ctx => {
    expect(ctx.stdout).to.contain("database 'testdb' deleted")
  })
})
