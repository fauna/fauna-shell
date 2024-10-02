import { expect } from 'chai'
import { run } from '../src/cli.mjs'
import { setupTestContainer as setupContainer } from '../src/config/setup-test-container.mjs'

describe('eval command', function() {
  let container

  beforeEach(() => {
    container = setupContainer()
  })

  describe('happy path', function() {
    it('works great', async function() {
      container.resolve("performQuery").resolves({
        data: [
          {
            name: "v4-test",
            coll: "Database",
            ts: 'Time("2024-07-16T19:16:15.980Z")',
            global_id: "asd7zi8pharfn"
          }
        ]
      })
      await run(`eval --secret "secret" --query "Database.all()"`, container)
      expect(container.resolve("logger").stdout.calledWith({
        data: [
          {
            name: "v4-test",
            coll: "Database",
            ts: 'Time("2024-07-16T19:16:15.980Z")',
            global_id: "asd7zi8pharfn"
          }
        ]
      }))
      expect(container.resolve("logger").stderr.notCalled)
    })
  })
})
