const { expect, test } = require('@oclif/test')

describe('import', () => {
  test
    .stdout()
    .command('import')
    .catch((err) => {
      expect(err.message).to.contain(
        'Error: Missing required flag:\n--path PATH'
      )
      expect(err.oclif.exit).to.equal(1)
    })
})
