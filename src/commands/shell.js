const FaunaCommand = require('../lib/fauna-command.js')
const { errorOut, runQueries } = require('../lib/misc.js')
const faunadb = require('faunadb')
const q = faunadb.query
const repl = require('repl')
const util = require('util')
const esprima = require('esprima')

/**
* We need this function to allow multi-line javascript objects
* to be entered. Without this check, the following object will
* produce an error:
*
* { a: 'a string',
*   b: 1,
*   c: Bytes("AQID"),
*   d: [ 1, 2 ],
*   e: { a: 'another string' } }
*
*/
function isRecoverableError(error) {
  if (error.name === 'SyntaxError') {
    return /^(Unexpected end of input|Unexpected token)/.test(error.message)
  }
  return false
}

// don't submit to the server empty queries.
function skipInput(cmd) {
  return cmd.trim() === ''
}

function stringifyEndpoint(endpoint) {
  var res = ''
  if (endpoint.scheme) {
    res += endpoint.scheme + '://'
  }
  res += endpoint.domain
  if (endpoint.port) {
    res += ':' + endpoint.port
  }
  return res
}

function filterCommands(commands, unwanted) {
  const keys = Object.keys(commands)
  var filteredCommands = {}
  keys.filter(function (k) {
    return !unwanted.includes(k)
  }).forEach(function (k) {
    filteredCommands[k] = commands[k]
  })
  return filteredCommands
}

function startShell(client, endpoint, dbscope, log) {
  const dbname = dbscope ? dbscope : ''

  if (dbname !== '') {
    log(`Starting shell for database ${dbname}`)
  }

  log(`Connected to ${stringifyEndpoint(endpoint)}`)
  log('Type Ctrl+D or .exit to exit the shell')
  var defaultEval

  function replEvalPromise(cmd, ctx, filename, cb) {
    if (skipInput(cmd)) {
      return cb()
    }
    defaultEval(cmd, ctx, filename, function (error, result) {
      let res
      try {
        res = esprima.parseScript(cmd)
      } catch (err) {
        res = cmd
      }

      if (error) {
        if (isRecoverableError(error)) {
          return cb(new repl.Recoverable(error))
        } else {
          return cb(error, result)
        }
      } else {
        return runQueries(res.body, client)
        .then(res => {
          // we could provide the response result as a second
          // argument to cb(), but the repl util.inspect has a
          // default depth of 2, but we want to display the full
          // objects or arrays, not things like [object Object]
          console.log(util.inspect(res, {depth: null}))
          return cb(error)
        })
        .catch(error => {
          ctx.lastError = error
          log('Error:', error.faunaError.message)
          console.log(util.inspect(JSON.parse(error.faunaError.requestResult.responseRaw), {
            depth: null,
            compact: false
          }))

          if (error instanceof faunadb.errors.FaunaHTTPError) {
            console.log(util.inspect(error.errors(), {depth: null}))
          }

          return cb()
        })
      }
    })
  }

  const r	= repl.start({
    prompt: `${dbname}> `,
    ignoreUndefined: true,
  })

  // we don't want to allow people to call some of the default commmands
  // from the node repl
  r.commands = filterCommands(r.commands, ['load', 'editor', 'clear'])

  r.defineCommand('clear', {
    help: 'Clear the repl',
    action: function () {
      console.clear()
      this.displayPrompt()
    },
  })

  r.defineCommand('last_error', {
    help: 'Display the last error',
    action: function () {
      console.log(this.context.lastError)
      this.displayPrompt()
    },
  })

  // we define our own eval, because we want to wrap QueryExpressions
  // inside a FaunaDB's Query().
  defaultEval = r.eval
  r.eval = replEvalPromise

  r.context.lastError = undefined
  Object.assign(r.context, q)
}

class ShellCommand extends FaunaCommand {
  async run() {
    const dbscope = this.args.dbname
    const role = 'admin'
    const log = this.log
    const withClient = this.withClient.bind(this)

    if (dbscope) {
      // first we test if the database specified by the user exists.
      // if that's the case, we create a connection scoped to that database.
      this.withClient(function (testDbClient, _) {
        testDbClient.query(q.Exists(q.Database(dbscope)))
        .then(function (exists) {
          if (exists) {
            withClient(function (client, endpoint) {
              startShell(client, endpoint, dbscope, log)
            }, dbscope, role)
          } else {
            errorOut(`Database '${dbscope}' doesn't exist`, 1)
          }
        })
        .catch(function (err) {
          errorOut(err.message, 1)
        })
      })
    } else {
      withClient(function (client, endpoint) {
        startShell(client, endpoint, dbscope, log)
      })
    }
  }
}

ShellCommand.description = `
Starts a FaunaDB shell
`

ShellCommand.examples = [
  '$ fauna shell dbname',
]

ShellCommand.flags = {
  ...FaunaCommand.flags,
}

ShellCommand.args = [
  {
    name: 'dbname',
    required: false,
    description: 'database name',
  },
]

module.exports = ShellCommand
