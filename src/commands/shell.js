const FaunaCommand = require("../lib/fauna-command.js");
const { runQueries, stringifyEndpoint } = require("../lib/misc.js");
const faunadb = require("faunadb");
const { Flags, Args } = require("@oclif/core");
const q = faunadb.query;
const repl = require("repl");
const util = require("util");
const esprima = require("esprima");
const EvalCommand = require("./eval.js");

class ShellCommand extends EvalCommand {
  commands = [
    {
      cmd: "clear",
      help: "Clear the repl",
      action: this.clear,
    },
    {
      cmd: "last_error",
      help: "Display the last error",
      action: this.lastError,
    },
  ];

  async run() {
    const { dbname } = this.args;

    this.connection = dbname
      ? await this.ensureDbScopeClient(dbname)
      : await this.getClient({ version: this.flags.version });
    this.startShell();
  }

  startShell() {
    const { dbname } = this.args;

    if (dbname) {
      this.log(`Starting shell for database ${dbname}`);
    }

    this.log(
      `Connected to ${stringifyEndpoint(this.connection.connectionOptions)}`
    );
    this.log("Type Ctrl+D or .exit to exit the shell");

    this.repl = repl.start({
      prompt: `${dbname || ""}> `,
      ignoreUndefined: true,
      preview: this.flags.version !== "10",
      // TODO: Integrate with fql-analyzer for completions
      completer: this.flags.version === "10" ? () => [] : undefined,
    });
    // The repl normally waits for the HTTP2 stream to close, so it just hangs
    // on v10. This causes it to actually die.
    //
    // Also, tests don't like `process.exit()`, so don't do this in tests.
    if (typeof global.it !== "function") {
      this.repl.on("exit", (code) => {
        // eslint-disable-next-line no-process-exit, unicorn/no-process-exit
        process.exit(code);
      });
    }
    this.repl.eval = this.eval(this.repl.eval);
    this.repl.context.lastError = undefined;
    Object.assign(this.repl.context, q);

    // we don't want to allow people to call some of the default commands
    // from the node repl
    this.repl.commands = this.filterCommands(this.repl.commands, [
      "load",
      "editor",
      "clear",
    ]);

    this.commands.forEach(({ cmd, ...cmdOptions }) =>
      this.repl.defineCommand(cmd, cmdOptions)
    );
  }

  filterCommands(commands, unwanted) {
    const keys = Object.keys(commands);
    var filteredCommands = {};
    keys
      .filter(function (k) {
        return !unwanted.includes(k);
      })
      .forEach(function (k) {
        filteredCommands[k] = commands[k];
      });
    return filteredCommands;
  }

  eval(originalEval) {
    return async (cmd, ctx, filename, cb) => {
      if (cmd.trim() === "") return cb();

      if (this.flags.version === "10") {
        const res = await this.performV10Query(
          this.connection.client,
          cmd,
          null,
          {
            format: "shell",
            version: "10",
            typecheck: this.flags.typecheck,
          }
        );

        console.log(res);

        return cb(null);
      } else {
        originalEval(cmd, ctx, filename, async (_err, result) => {
          try {
            if (_err) throw _err;
            const res = esprima.parseScript(`(${cmd})`);
            await this.executeFql({ ctx, fql: res.body }).then(cb);
          } catch (error) {
            if (error.name === "SyntaxError") {
              cb(new repl.Recoverable(error));
            } else {
              cb(error, result);
            }
          }
        });
      }
    };
  }

  async executeFql({ ctx, fql }) {
    return runQueries(fql, this.connection.client)
      .then((res) => {
        // we could provide the response result as a second
        // argument to cb(), but the repl util.inspect has a
        // default depth of 2, but we want to display the full
        // objects or arrays, not things like [object Object]
        console.log(util.inspect(res, { depth: null }));
      })
      .catch((error) => {
        ctx.lastError = error;
        this.log("Error:", error.faunaError.message);
        if (error.faunaError instanceof faunadb.errors.FaunaHTTPError) {
          console.log(
            util.inspect(
              JSON.parse(error.faunaError.requestResult.responseRaw),
              {
                depth: null,
                compact: false,
              }
            )
          );
        }
      });
  }

  clear() {
    console.clear();
    this.repl.displayPrompt();
  }

  lastError() {
    console.log(this.repl.context.lastError);
    this.repl.displayPrompt();
  }
}

ShellCommand.description = `
Starts an interactive shell.
`;

ShellCommand.examples = ["$ fauna shell dbname"];

ShellCommand.flags = {
  ...FaunaCommand.flags,
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

ShellCommand.args = {
  dbname: Args.string({
    required: false,
    description: "database name",
  }),
};

module.exports = ShellCommand;
