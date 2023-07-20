const util = require("util");
const fs = require("fs");
const esprima = require("esprima");
const { Flags, Args } = require("@oclif/core");
const faunadb = require("faunadb");
const FaunaCommand = require("../lib/fauna-command.js");
const { readFile, runQueries, writeFile } = require("../lib/misc.js");

const EVAL_OUTPUT_FORMATS = ["json", "shell"];

/**
 * Write json encoded output
 *
 * @param {String} file Target filename
 * @param {Any}    data Data to encode
 */
function writeFormattedJson(file, data) {
  let str = JSON.stringify(data);
  if (file === null) {
    return Promise.resolve(console.log(str));
  }
  return writeFile(file, str);
}

/**
 * Write fauna shell encoded output
 *
 * @param {String} file Target filename
 * @param {Any}    data Data to encode
 */
function writeFormattedShell(file, data) {
  let str = util.inspect(data, { depth: null });
  if (file === null) {
    return Promise.resolve(console.log(str));
  }
  return writeFile(file, str);
}

/**
 * Writes out the formatted output to file
 *
 * @param {*} file Target filename
 * @param {*} data Data to write
 * @param {*} format Format to write as
 */
function writeFormattedOutput(file, data, format) {
  if (format === "json") {
    return writeFormattedJson(file, data);
  } else if (format === "shell") {
    return writeFormattedShell(file, data);
  }
}

async function performQuery(command, client, fqlQuery, outputFile, outputFormat) {
  let res = esprima.parseScript(fqlQuery);
  if (res.body[0].type === "BlockStatement") {
    res = esprima.parseScript(`(${fqlQuery})`);
  }

  try {
    const response = await runQueries(res.body, client);
    return writeFormattedOutput(outputFile, response, outputFormat);
  } catch (error) {
    command.error(
      error.faunaError instanceof faunadb.errors.FaunaHTTPError
        ? util.inspect(
          JSON.parse(error.faunaError.requestResult.responseRaw),
          {
            depth: null,
            compact: false,
          }
        )
        : error.faunaError.message
    );
  }
}

class EvalCommand extends FaunaCommand {
  async run() {
    const queryFromStdin = this.flags.stdin;
    let queriesFile = this.flags.file;
    const outputFile = this.flags.output;
    const outputFormat = this.flags.format;

    const { dbname, query } = this.getArgs();

    const noSourceSet =
      !queryFromStdin && query === undefined && queriesFile === undefined;
    if (noSourceSet) {
      return this.error(
        "No source set. Pass --stdin to  read from stdin or --file."
      );
    }

    try {
      const { client } = await (dbname
        ? this.ensureDbScopeClient(dbname)
        : this.getClient());

      const readQuery = queryFromStdin || queriesFile !== undefined;
      let queryFromFile;
      if (readQuery) {
        if (queryFromStdin && !fs.existsSync(queriesFile)) {
          this.warn("Reading from stdin");
          queriesFile = process.stdin.fd;
        }
        queryFromFile = await readFile(queriesFile);
      }

      const result = await performQuery(
        this,
        client,
        queryFromFile || query,
        outputFile,
        outputFormat
      );
      return result;
    } catch (err) {
      throw err;
      return this.error(err.message, 1);
    }
  }

  // Remap arguments if a user provide only one
  getArgs() {
    const { stdin, file } = this.flags;
    const { dbname, query } = this.args;
    if (dbname && !query && !stdin && !file) return { query: dbname };

    return { dbname, query };
  }
}

EvalCommand.examples = [
  '$ fauna eval "Paginate(Collections())"',
  '$ fauna eval nestedDbName "Paginate(Collections())"',
  "$ fauna eval --file=/path/to/queries.fql",
  '$ echo "Add(1,1)" | fauna eval --stdin',
  '$ fauna eval "Add(2,3)" --output=/tmp/result"',
  '$ fauna eval "Add(2,3)" --format=json --output=/tmp/result"',
];

EvalCommand.flags = {
  ...FaunaCommand.flags,
  file: Flags.string({
    description: "File where to read queries from",
  }),
  stdin: Flags.boolean({
    description: "Read file input from stdin. Writes to stdout by default",
    default: false,
  }),
  output: Flags.string({
    description: "File to write output to",
    default: null,
  }),
  format: Flags.string({
    description: "Output format",
    default: "json",
    options: EVAL_OUTPUT_FORMATS,
  }),
};

EvalCommand.args = {
  dbname: Args.string({
    required: false,
    description: "Database name",
  }),
  query: Args.string({
    required: false,
    description: "FQL query to execute",
  }),
};

module.exports = EvalCommand;
