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
    console.log(str);
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
    console.log(str);
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
    await writeFormattedJson(file, data);
  } else if (format === "shell") {
    await writeFormattedShell(file, util.inspect(data, { depth: null }));
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

      // In v10, we check if its a TTY for shell/json format. In v4, default to json (to avoid breaking compatability).
      const format =
        this.flags.format ??
        (this.flags.version == "10"
          ? process.stdout.isTTY
            ? "shell"
            : "json"
          : "json");

      const result = await this.performQuery(
        client,
        queryFromFile || query,
        this.flags.output,
        format,
        this.flags.version
      );

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
        await writeFormattedJson(file, res.body.data);
      } else {
        await writeFormattedJson(file, {
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
        output = `${res.body.error?.code ?? ""}: ${res.body.error?.message ?? ""
          }`;
        if (res.body.summary) {
          output += "\n\n";
          output += res.body.summary ?? "";
        }
      }
      await writeFormattedShell(file, output);
    } else {
      return this.error("Unsupported output format");
    }
  }

  async performQuery(
    client,
    fqlQuery,
    outputFile,
    outputFormat,
    version
  ) {
    if (version == "4") {
      await this.performV4Query(client, fqlQuery, outputFile, outputFormat);
    } else {
      await this.performV10Query(client, fqlQuery, outputFile, outputFormat);
    }
  };

  async performV10Query(client, fqlQuery, outputFile, outputFormat) {
    try {
      let format;
      if (outputFormat == "shell") {
        format = "decorated";
      } else if (outputFormat == "json-tagged") {
        format = "tagged";
      } else {
        format = "simple";
      }

      const res = await client.query(fqlQuery, format);

      await this.writeFormattedOutputV10(outputFile, res, outputFormat);
    } catch (error) {
      this.error(`${error.code}\n\n${error.queryInfo.summary}`);
    }
  };

  async performV4Query(client, fqlQuery, outputFile, outputFormat) {
    if (outputFormat == "json-tagged") {
      outputFormat = "json";
    }

    let res = esprima.parseScript(fqlQuery);
    if (res.body[0].type === "BlockStatement") {
      res = esprima.parseScript(`(${fqlQuery})`);
    }

    try {
      const response = await runQueries(res.body, client);
      await writeFormattedOutput(outputFile, response, outputFormat);
    } catch (error) {
      this.error(
        error.faunaError instanceof faunadb.errors.FaunaHTTPError
          ? util.inspect(JSON.parse(error.faunaError.requestResult.responseRaw), {
            depth: null,
            compact: false,
          })
          : error.faunaError.message
      );
    }
  };

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
    default: undefined,
    options: EVAL_OUTPUT_FORMATS,
  }),
  version: Flags.string({
    description: "FQL Version",
    default: "4",
    options: ["4", "10"],
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
