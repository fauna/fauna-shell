//@ts-check

import console from "node:console";
import repl from "node:repl";

import * as esprima from "esprima";

import { container } from "../cli.mjs";
import {
  QUERY_INFO_CHOICES,
  resolveFormat,
  validateDatabaseOrSecret,
  yargsWithCommonConfigurableQueryOptions,
} from "../lib/command-helpers.mjs";
import { formatQueryResponse, getSecret } from "../lib/fauna-client.mjs";
import { clearHistoryStorage, initHistoryStorage } from "../lib/file-util.mjs";

async function shellCommand(argv) {
  const { query: v4Query } = container.resolve("faunadb");

  validateDatabaseOrSecret(argv);

  // Fast fail if the database is not queryable
  const isQueryable = container.resolve("isQueryable");
  await isQueryable({ ...argv, secret: await getSecret() });

  const logger = container.resolve("logger");
  let completionPromise;

  if (argv.dbPath) logger.stdout(`Starting shell for database ${argv.dbPath}`);
  logger.stdout("Type Ctrl+D or .exit to exit the shell");

  /** @type {import('node:repl').ReplOptions} */
  const replArgs = {
    prompt: `${argv.database || ""}> `,
    ignoreUndefined: true,
    preview: argv.apiVersion !== "10",
    completer: argv.apiVersion === "10" ? () => [] : undefined,
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

  shell.context.include = argv.include;

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
      cmd: "togglePerformanceHints",
      help: "Enable or disable performance hints. Disabled by default. If enabled, outputs performance hints for the most recent query.",
      action: () => {
        shell.context.performanceHints = !shell.context.performanceHints;
        logger.stderr(
          `Performance hints in shell: ${shell.context.performanceHints ? "on" : "off"}`,
        );
        shell.prompt();
      },
    },
    {
      cmd: "toggleInfo",
      help: "Enable or disable output of --include info. Disabled by default.",
      action: () => {
        shell.context.include =
          shell.context.include.length === 0
            ? // if we are toggling on and no include was provided, turn everything on
              argv.include.length === 0
              ? QUERY_INFO_CHOICES
              : argv.include
            : [];

        logger.stderr(
          `Query info in shell: ${shell.context.include.length === 0 ? "off" : shell.context.include.join(", ")}`,
        );

        shell.prompt();
      },
    },
  ].forEach(({ cmd, ...cmdOptions }) => shell.defineCommand(cmd, cmdOptions));

  return completionPromise;
}

const getArgvOrCtx = (key, argv, ctx) => {
  const value = ctx[key] === undefined ? argv[key] : ctx[key];
  if (ctx[key] === undefined) {
    ctx[key] = value;
  }
  return value;
};

// caches the logger, client, and performQuery for subsequent shell calls
async function buildCustomEval(argv) {
  const formatError = container.resolve("formatError");
  const formatQueryInfo = container.resolve("formatQueryInfo");
  const runQueryFromString = container.resolve("runQueryFromString");

  return async (cmd, ctx, _filename, cb) => {
    try {
      const logger = container.resolve("logger");

      if (cmd.trim() === "") return cb();

      // These are options used for querying and formatting the response
      const { apiVersion, color } = argv;
      const include = getArgvOrCtx("include", argv, ctx);
      const performanceHints = getArgvOrCtx("performanceHints", argv, ctx);

      // Using --json output takes precedence over --format
      const outputFormat = resolveFormat({ ...argv });

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
        const { color, timeout, typecheck, url } = argv;

        res = await runQueryFromString(cmd, {
          apiVersion,
          secret,
          url,
          timeout,
          typecheck,
          performanceHints,
          format: outputFormat,
        });

        // If any query info should be displayed, print to stderr.
        // This is only supported in v10.
        if (include.length > 0 && apiVersion === "10") {
          const queryInfo = formatQueryInfo(res, {
            apiVersion,
            color,
            include,
          });
          if (queryInfo) {
            logger.stdout(queryInfo);
          }
        }
      } catch (err) {
        logger.stderr(formatError(err, { apiVersion, color }));
        return cb(null);
      }

      const output = formatQueryResponse(res, {
        apiVersion,
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
        "$0 shell --database us/my_db",
        "Run queries in the 'us/my_db' database.",
      ],
      [
        "$0 shell --database us/my_db --role server",
        "Run queries in the 'us/my_db' database using the 'server' role.",
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
