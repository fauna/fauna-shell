import { expect } from 'chai'
import { run } from '../src/cli.mjs'
import { setupTestContainer as setupContainer } from '../src/config/setup-test-container.mjs'

describe('eval command', function() {
  // const err = console.error
  // console.error = fakeLogger.stderr
  let container

  beforeEach(() => {
    // console.error.reset()
    container = setupContainer()
    // container.resolve("logger").user.reset()
  })

  after(() => {
    // console.error = err
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

  describe('flag', function() {
    describe('--sides', function() {
      it.skip('should error if sides is not provided', async function() {
        // try {
        //   await run("roll", container)
        // } catch (e) {
        //   expect(e.message).to.equal("Missing required argument: sides")
        //   const output = container.resolve("logger").user.get()
        //   expect(output).to.equal('')
        // }
      })
    })

    describe('--remote-rng', function() {
      it.skip('should make a network request for random numbers', async function() {
        // container.resolve("fetch").next([1, 2, 3, 4])
        // await run("roll --count 4 --sides 8 --remote", container)
        // const output = container.resolve("logger").user.get()
        // expect(output).to.equal("Rolled 4d8: 1,2,3,4")
      })
    })
  })

  describe('awilix', function() {
    it.skip('can re-define an injectable', function() {
      // container.register({ number: awilix.asValue(3) })
      // expect(container.resolve("number")).to.equal(3)
      // container.register({ number: awilix.asValue(6) })
      // expect(container.resolve("number")).to.equal(6)
    })
  })
})
