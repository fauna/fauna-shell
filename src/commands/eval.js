const util = require("util");
const fs = require("fs");
const esprima = require("esprima");
const { Flags, Args } = require("@oclif/core");
const faunadb = require("faunadb");
const FaunaCommand = require("../lib/fauna-command.js");
const { readFile, runQueries, writeFile } = require("../lib/misc.js");

const EVAL_OUTPUT_FORMATS = ["json", "json-tagged", "shell"];

/**
 * Write json encoded output
 *
 * @param {String} file Target filename
 * @param {Any}    data Data to encode
 */
async function writeFormattedJson(file, data) {
  let str = JSON.stringify(data);
  if (file === null) {
    return str;
  } else {
    await writeFile(file, str);
  }
}

/**
 * Write fauna shell encoded output
 *
 * @param {String} file Target filename
 * @param {Any}    data Data to encode
 */
async function writeFormattedShell(file, str) {
  if (file === null) {
    return str;
  } else {
    await writeFile(file, str);
  }
}

/**
 * Writes out the formatted output to file
 *
 * @param {*} file Target filename
 * @param {*} data Data to write
 * @param {*} format Format to write as
 */
async function writeFormattedOutput(file, data, format) {
  if (format === "json") {
    return writeFormattedJson(file, data);
  } else if (format === "shell") {
    return writeFormattedShell(file, util.inspect(data, { depth: null }));
  }
}

class EvalCommand extends FaunaCommand {
  async run() {
    const queryFromStdin = this.flags.stdin;
    let queriesFile = this.flags.file;

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
        : this.getClient({ version: this.flags.version }));

      const readQuery = queryFromStdin || queriesFile !== undefined;
      let queryFromFile;
      if (readQuery) {
        if (queryFromStdin && !fs.existsSync(queriesFile)) {
          this.warn("Reading from stdin");
          queriesFile = process.stdin.fd;
        }
        queryFromFile = await readFile(queriesFile);
      }

      const format =
        this.flags.format ?? (process.stdout.isTTY ? "shell" : "json");

      const result = await this.performQuery(
        client,
        queryFromFile || query,
        this.flags.output,
        {
          format: format,
          version: this.flags.version,
          typecheck: this.flags.typecheck,
        }
      );

      if (result) {
        console.log(result);
      }

      // required to make the process not hang
      client.close();

      return result;
    } catch (err) {
      return this.error(err.message, 1);
    }
  }

  async writeFormattedOutputV10(file, res, format) {
    const isOk = res.status >= 200 && res.status <= 299;

    if (format === "json" || format === "json-tagged") {
      if (isOk) {
        return writeFormattedJson(file, res.body.data);
      } else {
        return writeFormattedJson(file, {
          error: res.body.error,
          summary: res.body.summary,
        });
      }
    } else if (format === "shell") {
      let output = "";
      if (isOk) {
        output += res.body.summary ?? "";
        if (output) {
          output += "\n\n";
        }
        output += res.body.data ?? "";
      } else {
        output = `${res.body.error?.code ?? ""}: ${
          res.body.error?.message ?? ""
        }`;
        if (res.body.summary) {
          output += "\n\n";
          output += res.body.summary ?? "";
        }
      }
      return writeFormattedShell(file, output);
    } else {
      return this.error("Unsupported output format");
    }
  }

  /**
   * Perform a v4 or v10 query, depending on the FQL version
   *
   * @param {Object} client - An instance of the client used to execute the query.
   * @param {string} fqlQuery - The FQL v4 query to be executed.
   * @param {string} outputFile - Target filename
   * @param {Object} flags - Options for the query execution.
   * @param {("4" | "10")} flags.version - FQL version number
   * @param {("json" | "json-tagged" | "shell")} flags.format - Result format
   * @param {boolean} [flags.typecheck] - (Optional) Flag to enable typechecking
   */
  async performQuery(client, fqlQuery, outputFile, flags) {
    if (flags.version === "4") {
      return this.performV4Query(client, fqlQuery, outputFile, flags);
    } else {
      return this.performV10Query(client, fqlQuery, outputFile, flags);
    }
  }

  async performV10Query(client, fqlQuery, outputFile, flags) {
    try {
      let format;
      if (flags.format === "shell") {
        format = "decorated";
      } else if (flags.format === "json-tagged") {
        format = "tagged";
      } else {
        format = "simple";
      }

      const res = await client.query(fqlQuery, format, flags.typecheck);

      return await this.writeFormattedOutputV10(outputFile, res, flags.format);
    } catch (error) {
      this.error(`${error.code}\n\n${error.queryInfo.summary}`);
    }
  }

  async performV4Query(client, fqlQuery, outputFile, flags) {
    if (flags.format === "json-tagged") {
      flags.format = "json";
    }

    let res = esprima.parseScript(fqlQuery);
    if (res.body[0].type === "BlockStatement") {
      res = esprima.parseScript(`(${fqlQuery})`);
    }

    try {
      const response = await runQueries(res.body, client);
      return await writeFormattedOutput(outputFile, response, flags.format);
    } catch (error) {
      this.error(
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

  // Remap arguments if a user provide only one
  getArgs() {
    const { stdin, file } = this.flags;
    const { dbname, query } = this.args;
    if (dbname && !query && !stdin && !file) return { query: dbname };

    return { dbname, query };
  }
}

EvalCommand.examples = [
  '$ fauna eval "Collection.all()"',
  '$ fauna eval nestedDbName "Collection.all()"',
  "$ fauna eval --file=/path/to/queries.fql",
  '$ echo "1 + 1" | fauna eval',
  '$ fauna eval "2 + 3" --output=/tmp/result"',
  '$ fauna eval "2 + 3" --format=json --output=/tmp/result"',
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
    default: undefined,
    options: EVAL_OUTPUT_FORMATS,
  }),
  version: Flags.string({
    description: "FQL Version",
    default: "10",
    options: ["4", "10"],
  }),

  // v10 specific options
  typecheck: Flags.boolean({
    description: "Enable typechecking",
    default: undefined,
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
