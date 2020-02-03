const util = require('util')
const fs = require('fs')
const esprima = require('esprima')
const {flags} = require('@oclif/command')
const FaunaCommand = require('../lib/fauna-command.js')
const {readFile, runQueries, errorOut, loadEndpoints, writeFile} = require('../lib/misc.js')
const faunadb = require('faunadb')
const q = faunadb.query

const EVAL_OUTPUT_FORMATS = ['json', 'shell']

function infoMessage(err) {
  const fe = util.inspect(err.faunaError, {depth: null})
  return `
  The following query failed:
    ${err.exp}

  With error message:
    ${fe}

  Query number:
    ${err.queryNumber}
  `
}

/**
 * Write json encoded output
 *
 * @param {String} file Target filename
 * @param {Any}    data Data to encode
 */
function writeFormattedJson(file, data) {
  let str = JSON.stringify(data)
  if (file ===  null) {
    return Promise.resolve(console.log(str))
  }
  return writeFile(file, str)
}

/**
 * Write fauna shell encoded output
 *
 * @param {String} file Target filename
 * @param {Any}    data Data to encode
 */
function writeFormattedShell(file, data) {
  let str = util.inspect(data, {depth: null})
  if (file ===  null) {
    return Promise.resolve(console.log(str))
  }
  return writeFile(file, str)
}

/**
 * Writes out the formatted output to file
 *
 * @param {*} file Target filename
 * @param {*} data Data to write
 * @param {*} format Format to write as
 */
function writeFormattedOutput(file, data, format) {
  if (format === 'json')
    return writeFormattedJson(file, data)
  else if (format === 'shell')
    return writeFormattedShell(file, data)
  else
    errorOut('Unsupported output format')
}

function performQuery(client, fqlQuery, outputFile, outputFormat) {
  let res = esprima.parseScript(fqlQuery)
  return runQueries(res.body, client)
  .then(function (response) {
    writeFormattedOutput(outputFile, response, outputFormat)
  })
  .catch(function (err) {
    errorOut(infoMessage(err), 1)
  })
}

class EvalCommand extends FaunaCommand {
  async run() {
    const dbscope = this.args.dbname
    const queryFromStdin = this.flags.stdin
    let queriesFile = this.flags.file
    const outputFile = this.flags.output
    const outputFormat = this.flags.format

    const fqlQuery = this.args.query

    const withClient = this.withClient.bind(this)

    // first we test if the database specified by the user exists.
    // if that's the case, we create a connection scoped to that database.
    return withClient(async function (client, _) {
      const readQuery = queryFromStdin || queriesFile !== undefined
      const noSourceSet = (!queryFromStdin && fqlQuery === undefined && queriesFile === undefined)
      if (readQuery) {
        if (queryFromStdin && !fs.existsSync(queriesFile)) {
          this.warn('Reading from stdin')
          queriesFile = process.stdin.fd
        }
        return readFile(queriesFile).then(query => {
          return performQuery(client, query, outputFile, outputFormat)
        }).catch(err => {
          errorOut(err)
        })
      }
      if (fqlQuery !== undefined)
        return performQuery(client, fqlQuery, outputFile, outputFormat).catch(err => {
          errorOut(err)
        })
      if (noSourceSet) {
        return errorOut('No source set. Pass --stdin to  read from stdin or --file.')
      }
    })
    .catch(function (err) {
      if (err.name == 'Unauthorized') {
        return loadEndpoints()
        .then(function (endpoints) {
          return errorOut(`You are not authorized to access the endpoint ${endpoints.default}.`, 1)
        })
      } else {
        return errorOut(err.message, 1)
      }
    })
  }
}

EvalCommand.description = `
Runs the specified query. Can read from stdin, file or command line. 
Outputs to either stdout or file. 
Output format can be specified.
`

EvalCommand.examples = [
  '$ fauna eval "Paginate(Classes())"',
  '$ fauna eval --file=/path/to/queries.fql',
  '$ echo "Add(1,1)" | fauna eval --stdin',
  '$ fauna eval "Add(2,3)" --output=/tmp/result"',
  '$ fauna eval "Add(2,3)" --format=json --output=/tmp/result"',
]

EvalCommand.flags = {
  ...FaunaCommand.flags,
  file: flags.string({
    description: 'File where to read queries from',
  }),
  stdin: flags.boolean({
    description: 'Read file input from stdin. Writes to stdout by default',
    default: false,
  }),
  output: flags.string({
    description: 'File to write output to',
    default: null,
  }),
  format: flags.string({
    description: 'Output format',
    default: 'json',
    options: EVAL_OUTPUT_FORMATS,
  }),
}

EvalCommand.args = [
  {
    name: 'query',
    required: false,
    description: 'FQL query to execute',
  },
]

module.exports = EvalCommand
