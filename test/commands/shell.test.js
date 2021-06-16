const mockRequire = require('mock-require')
const sinon = require('sinon')

const repl = {
  context: {},
  commands: {
    load: {},
    editor: {},
  },
  eval: (...args) => args[3](),
  defineCommand: function (cmd, cmdOptions) {
    this.commands[cmd] = cmdOptions
  },
}

mockRequire('repl', {
  start: () => repl,
})
const { expect } = require('@oclif/test')
const {
  matchFqlReq,
  getEndpoint,
  fqlToJsonString,
} = require('../helpers/utils.js')
const { query: q, Expr } = require('faunadb')
const Config = require('@oclif/config')
const ShellCommand = require('../../src/commands/shell')
const nock = require('nock')

describe('shell', () => {
  let shell
  let commandLogSpy
  const consoleLog = sinon.spy(console, 'log')
  // eslint-disable-next-line no-undef
  before(async () => {
    const config = await Config.load(
      (module.parent &&
        module.parent.parent &&
        module.parent.parent.filename) ||
        __dirname
    )
    shell = new ShellCommand([], config)
    shell.args = {}
    shell.flags = { secret: process.env.FAUNA_SECRET }
    commandLogSpy = sinon.spy(shell, 'log')
    await shell.run()

    nock(getEndpoint())
      .persist()
      .post('/', matchFqlReq(q.Divide(10, 0)))
      .reply(400, {
        errors: [
          {
            position: [],
            code: 'invalid argument',
            description: 'Illegal division by zero.',
          },
        ],
      })
      .post('/')
      .reply(200, (_, req) => ({ resource: req }))
  })

  // eslint-disable-next-line no-undef
  afterEach(() => {
    commandLogSpy.resetHistory()
  })

  it('initiated', () => {
    expect(commandLogSpy.lastCall.args[0]).to.equal(
      'Type Ctrl+D or .exit to exit the shell'
    )
    expect(Object.keys(shell.repl.commands)).to.eql(['clear', 'last_error'])
  })

  it('run fql', async () => {
    const fqls = [q.Paginate(q.Collections()), q.Now()]

    await fqls.map(
      (fql) =>
        new Promise((resolve, reject) => {
          shell.repl.eval(Expr.toString(fql), repl.context, '', (err) => {
            if (err) return reject(err)
            expect(consoleLog.lastCall.args[0]).to.string(fqlToJsonString(fql))
            resolve()
          })
        })
    )
  })

  it('run fql that return an error', async () => {
    const fql = q.Divide(10, 0)

    await new Promise((resolve) => {
      shell.repl.eval(Expr.toString(fql), repl.context, '', () => {
        expect(commandLogSpy.lastCall.args[1]).to.string('invalid argument')
        resolve()
      })
    })
  })
})