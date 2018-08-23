const {expect, test} = require('@oclif/test')

describe('create-database', () => {
  test
  .stdout({print: true})
  .command(['create-database', 'testdb'])
  .it('runs create-database testdb', ctx => {
		// console.log("ctx: ", ctx.stdout)
		expect(ctx.stdout).to.contain("created database 'testdb'")
  })

  test
  .stderr({print: true})
  .command(['create-database', 'testdb'])
  .it('runs create-database testdb', ctx => {
  	// console.log(ctx)
    expect(ctx.stderr).to.contain("Database 'testdb' already exists.")
  })

	test
	.stdout({print: true})
	.command(['delete-database', 'testdb'])
	.it('runs delete-database testdb', ctx => {
		// console.log(ctx.stdout);
		expect(ctx.stderr).to.contain("database 'testdb' deleted")
	})
})
