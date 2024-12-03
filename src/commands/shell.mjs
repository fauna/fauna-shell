//@ts-check

import repl from "node:repl";

import { container } from "../cli.mjs";
import {
  validateDatabaseOrSecret,
  yargsWithCommonConfigurableQueryOptions,
} from "../lib/command-helpers.mjs";
import { getSecret } from "../lib/fauna-client.mjs";

async function shellCommand(argv) {
  validateDatabaseOrSecret(argv);

  const logger = container.resolve("logger");
  let completionPromise;

  if (argv.dbPath) logger.stdout(`Starting shell for database ${argv.dbPath}`);
  logger.stdout("Type Ctrl+D or .exit to exit the shell");

  /** @type {import('node:repl').ReplOptions} */
  const replArgs = {
    prompt: `${argv.db_path || ""}> `,
    ignoreUndefined: true,
    preview: argv.apiVersion !== "10",
    // TODO: integrate with fql-analyzer for completions
    completer: argv.apiVersion === "10" ? () => [] : undefined,
    output: container.resolve("stdoutStream"),
    input: container.resolve("stdinStream"),
    eval: await buildCustomEval(argv),
    terminal: true,
  };

  const shell = repl.start(replArgs);
  // eslint-disable-next-line no-console
  shell.on("error", console.error);

  completionPromise = new Promise((resolve) => {
    shell.on("exit", resolve);
  });

  [
    {
      cmd: "clear",
      help: "Clear the repl",
      action: () => {
        // eslint-disable-next-line no-console
        console.clear();
        shell.prompt();
      },
    },
    {
      cmd: "lastError",
      help: "Display the last error",
      action: () => {
        logger.stdout(shell.context.lastError);
        shell.prompt();
      },
    },
    {
      cmd: "toggleExtra",
      help: "Toggle additional information in shell; off by default",
      action: () => {
        shell.context.extra = !shell.context.extra;
        logger.stderr(
          `Additional information in shell: ${shell.context.extra ? "on" : "off"}`,
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
  const formatQueryResponse = container.resolve("formatQueryResponse");

  return async (cmd, ctx, _filename, cb) => {
    try {
      const logger = container.resolve("logger");

      if (cmd.trim() === "") return cb();

      // These are options used for querying and formatting the response
      const { apiVersion } = argv;
      const { extra } = ctx;

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
        });
      } catch (err) {
        logger.stderr(formatError(err, { apiVersion, extra }));
        return cb(null);
      }

      // If extra is on, return the full response. Otherwise, return just the data.
      logger.stdout(formatQueryResponse(res, { apiVersion, extra, json: false }));

      return cb(null);
    } catch (e) {
      return cb(e);
    }
  };
}

function buildShellCommand(yargs) {
  return yargsWithCommonConfigurableQueryOptions(yargs)
    .example([["$0 shell"], ["$0 shell --database us-std/example --role admin"]])
    .version(false)
    .help("help", "Show help.");
}

export default {
  builder: buildShellCommand,
  handler: shellCommand,
};
