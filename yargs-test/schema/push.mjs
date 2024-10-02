import { expect } from 'chai'
import { run } from '../../src/cli.mjs'
import { setupTestContainer as setupContainer } from '../../src/config/setup-test-container.mjs'

describe('schema push', function() {
  let container

  beforeEach(() => {
    container = setupContainer()
  })

  it('can force push schema', async function() {
    const fetch = container.resolve("fetch")
    fetch.resolves({ json: async () => ({}) })

    const gatherFSL = container.resolve("gatherFSL")
    gatherFSL.resolves("[{\"name\":\"coll.fsl\",\"content\":\"collection MyColl {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n\"}]")

    const logger = container.resolve("logger")

    await run(`schema push --secret "secret" --force`, container)

    expect(gatherFSL.calledWith(".")).to.be.true

    expect(fetch.calledWith(
      "https://db.fauna.com/schema/1/update?force=true",
      {
        method: "POST",
        headers: { "AUTHORIZATION": "Bearer secret" },
        body: "[{\"name\":\"coll.fsl\",\"content\":\"collection MyColl {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n\"}]",
        duplex: "half"
      }
    )).to.be.true

    expect(logger.stdout.called).to.be.false
    expect(logger.stderr.called).to.be.false
  })
})
