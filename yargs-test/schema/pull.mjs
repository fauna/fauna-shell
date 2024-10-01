import { expect } from 'chai'
import { run } from '../../src/cli.mjs'
import { setupTestContainer as setupContainer } from '../../src/config/setup-test-container.mjs'

describe('schema pull', function() {
  let container

  beforeEach(() => {
    container = setupContainer()
  })

  it('can pull schema', async function() {
    const fetch = container.resolve("fetch")
    fetch.resolves({ json: async () => ({}) })

    const gatherFSL = container.resolve("gatherFSL")
    gatherFSL.resolves("[{\"name\":\"coll.fsl\",\"content\":\"collection MyColl {\\n  name: String\\n  index byName {\\n    terms [.name]\\n  }\\n}\\n\"}]")

    const logger = container.resolve("logger")

    const confirm = container.resolve("confirm")
    confirm.resolves(true)

    const getSchemaFiles = container.resolve("getSchemaFiles")
      .resolves({ json: async () => ({ version: "194838274939473" }) })
    const getStagedSchemaStatus = container.resolve("getStagedSchemaStatus")
      .resolves({ json: async () => ({ status: "none" }) })
    console.log(getStagedSchemaStatus)

    await run(`schema pull --secret "secret"`, container)

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
