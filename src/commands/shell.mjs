//@ts-check

import console from "node:console";
import repl from "node:repl";

import * as esprima from "esprima";

import { container } from "../cli.mjs";
import {
  resolveFormat,
  validateDatabaseOrSecret,
  yargsWithCommonConfigurableQueryOptions,
} from "../lib/command-helpers.mjs";
import { formatQueryResponse, getSecret } from "../lib/fauna-client.mjs";
import { clearHistoryStorage, initHistoryStorage } from "../lib/file-util.mjs";

async function shellCommand(argv) {
  const { query: v4Query } = container.resolve("faunadb");

  validateDatabaseOrSecret(argv);

  const logger = container.resolve("logger");
  let completionPromise;

  if (argv.dbPath) logger.stdout(`Starting shell for database ${argv.dbPath}`);
  logger.stdout("Type Ctrl+D or .exit to exit the shell");

  /** @type {import('node:repl').ReplOptions} */
  const replArgs = {
    prompt: `${argv.database || ""}> `,
    ignoreUndefined: true,
    preview: undefined,
    completer: undefined,
    output: container.resolve("stdoutStream"),
    input: container.resolve("stdinStream"),
    eval: await buildCustomEval(argv),
    terminal: true,
  };

  const shell = repl.start(replArgs);

  // Setup history
  const historyFile = initHistoryStorage();
  shell.setupHistory(historyFile, (err) => {
    if (err) {
      logger.stderr(`Error setting up history: ${err.message}`);
    }
  });

  shell.on("error", console.error);

  if (argv.apiVersion === "4") {
    Object.assign(shell.context, v4Query);
  }

  completionPromise = new Promise((resolve) => {
    shell.on("exit", resolve);
  });

  [
    {
      cmd: "clear",
      help: "Clear the REPL",
      action: () => {
        console.clear();
        shell.prompt();
      },
    },
    {
      cmd: "clearhistory",
      help: "Clear the REPL session history",
      action: () => {
        try {
          clearHistoryStorage();
          logger.stdout("History cleared");
          // Reinitialize history
          shell.setupHistory(historyFile, (err) => {
            if (err) {
              logger.stderr(`Error reinitializing history: ${err.message}`);
            }
          });
        } catch (err) {
          logger.stderr(`Error clearing history: ${err.message}`);
        }
        shell.prompt();
      },
    },
    {
      cmd: "lastError",
      help: "Display the most recent error encountered in the REPL",
      action: () => {
        logger.stdout(shell.context.lastError);
        shell.prompt();
      },
    },
    {
      cmd: "toggleRawResponses",
      help: "Enable or disable additional output. Disabled by default. If enabled, outputs the full API response, including summary and query stats.",
      action: () => {
        shell.context.raw = !shell.context.raw;
        logger.stderr(
          `Additional information in shell: ${shell.context.raw ? "on" : "off"}`,
        );
        shell.prompt();
      },
    },
  ].forEach(({ cmd, ...cmdOptions }) => shell.defineCommand(cmd, cmdOptions));

  return completionPromise;
}

// caches the logger, client, and performQuery for subsequent shell calls
async function buildCustomEval(argv) {
  const runQueryFromString = container.resolve("runQueryFromString");
  const formatError = container.resolve("formatError");

  return async (cmd, ctx, _filename, cb) => {
    try {
      const logger = container.resolve("logger");

      if (cmd.trim() === "") return cb();

      // These are options used for querying and formatting the response
      const { apiVersion, color, raw: argvRaw } = argv;
      const raw = ctx.raw === undefined ? argvRaw : ctx.raw;

      if (ctx.raw === undefined) {
        ctx.raw = argvRaw;
      }

      // Using --raw or --json output takes precedence over --format
      const outputFormat = resolveFormat(argv);

      if (apiVersion === "4") {
        try {
          esprima.parseScript(cmd);
        } catch (err) {
          return cb(new repl.Recoverable(err));
        }
      }

      let res;
      try {
        const secret = await getSecret();
        const { url, timeout, typecheck } = argv;

        res = await runQueryFromString(cmd, {
          apiVersion,
          secret,
          url,
          timeout,
          typecheck,
          format: outputFormat,
        });
      } catch (err) {
        logger.stderr(await formatError(err, { apiVersion, raw, color }));
        return cb(null);
      }

      const output = formatQueryResponse(res, {
        apiVersion,
        raw,
        color,
        format: outputFormat,
      });

      logger.stdout(output);

      return cb(null);
    } catch (e) {
      return cb(e);
    }
  };
}

function buildShellCommand(yargs) {
  return yargsWithCommonConfigurableQueryOptions(yargs)
    .example([
      [
        "$0 shell --database us/example",
        "Run queries in the 'us/example' database.",
      ],
      [
        "$0 shell --database us/example --role server",
        "Run queries in the 'us/example' database using the 'server' role.",
      ],
      [
        "$0 shell --secret my-secret",
        "Run queries in the database scoped to a secret.",
      ],
    ])
    .version(false);
}

export default {
  command: "shell",
  describe: "Run queries in an interactive REPL.",
  builder: buildShellCommand,
  handler: shellCommand,
};
