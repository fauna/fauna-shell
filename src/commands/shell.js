const FaunaCommand = require('../lib/fauna-command.js')
const {errorOut} = require('../lib/misc.js')
const faunadb = require('faunadb')
const q = faunadb.query
const repl = require('repl')
const util = require('util')

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

class ShellCommand extends FaunaCommand {
  async run() {
    const dbscope = this.args.dbname
    const role = 'admin'
    const log = this.log
    const withClient = this.withClient.bind(this)

    // first we test if the database specified by the user exists.
    // if that's the case, we create a connection scoped to that database.
    this.withClient(function (testDbClient, _) {
      testDbClient.query(q.Exists(q.Database(dbscope)))
      .then(function (exists) {
        if (exists) {
          withClient(function (client, endpoint) {
            log(`Starting shell for database ${dbscope}`)
            log(`Connected to ${stringifyEndpoint(endpoint)}`)
            log('Type Ctrl+D or .exit to exit the shell')
            var defaultEval

            function replEvalPromise(cmd, ctx, filename, cb) {
              if (skipInput(cmd)) {
                return cb()
              }
              defaultEval(cmd, ctx, filename, function (error, result) {
                if (error) {
                  if (isRecoverableError(error)) {
                    return cb(new repl.Recoverable(error))
                  } else {
                    return cb(error, result)
                  }
                } else {
                  return client.query(result)
                  .then(function (response) {
                    // we could provide the response result as a second
                    // argument to cb(), but the repl util.inspect has a
                    // default depth of 2, but we want to display the full
                    // objects or arrays, not things like [object Object]
                    console.log(util.inspect(response, {depth: null}))
                    return cb(error)
                  })
                  .catch(function (error) {
                    log('Error:', error.message)
                    return cb()
                  })
                }
              })
            }

            const r	= repl.start({
              prompt: `${dbscope}> `,
              ignoreUndefined: true,
            })

            // we don't want to allow the custom commands from the node.js repl.
            r.commands = []

            r.defineCommand('exit', {
              help: 'Exit the repl',
              action: function () {
                this.close()
              },
            })

            // we define our own eval, because we want to wrap QueryExpressions
            // inside a FaunaDB's Query().
            defaultEval = r.eval
            r.eval = replEvalPromise

            Object.assign(r.context, q)
          }, dbscope, role)
        } else {
          errorOut(`Database '${dbscope}' doesn't exist`, 1)
        }
      })
      .catch(function (err) {
        errorOut(err, 1)
      })
    })
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
    required: true,
    description: 'database name',
  },
]

module.exports = ShellCommand
