//@ts-check

import path from "node:path";
import repl from "node:repl";

import { container } from "../cli.mjs";
import {
  // ensureDbScopeClient,
  commonConfigurableQueryOptions,
} from "../lib/command-helpers.mjs";
import { dirExists, fileExists } from "../lib/file-util.mjs";
import { performQuery } from "./eval.mjs";

async function doShell(argv) {
  const fs = container.resolve("fs");
  const logger = container.resolve("logger");
  let completionPromise;

  if (argv.dbPath) logger.stdout(`Starting shell for database ${argv.dbPath}`);
  logger.stdout("Type Ctrl+D or .exit to exit the shell");

  // Setup history file
  const homedir = container.resolve("homedir");
  const historyDir = path.join(homedir.toString(), ".fauna");
  if (!dirExists(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }
  const historyFile = path.join(historyDir, "history");
  if (!fileExists(historyFile)) {
    fs.writeFileSync(historyFile, "");
  }

  /** @type {import('node:repl').ReplOptions} */
  const replArgs = {
    prompt: `${argv.db_path || ""}> `,
    ignoreUndefined: true,
    preview: argv.version !== "10",
    // TODO: integrate with fql-analyzer for completions
    completer: argv.version === "10" ? () => [] : undefined,
    output: container.resolve("stdoutStream"),
    input: container.resolve("stdinStream"),
    eval: await buildCustomEval(argv),
    terminal: true,
    historySize: 1000
  };

  const shell = repl.start(replArgs);

  // Setup history
  shell.setupHistory(historyFile, (err) => {
    if (err) {
      logger.stderr(`Error setting up history: ${err.message}`);
    }
  });

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
      cmd: "last_error",
      help: "Display the last error",
      action: () => {
        logger.stdout(shell.context.lastError);
        shell.prompt();
      },
    },
    {
      cmd: "clearhistory",
      help: "Clear command history",
      action: () => {
        try {
          fs.writeFileSync(historyFile, '');
          logger.stdout('History cleared');
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
    }
  ].forEach(({ cmd, ...cmdOptions }) => shell.defineCommand(cmd, cmdOptions));

  return completionPromise;
}

// caches the logger, client, and performQuery for subsequent shell calls
async function buildCustomEval(argv) {
  const client = await container.resolve("getSimpleClient")(argv);

  return async (cmd, ctx, filename, cb) => {
    try {
      const logger = container.resolve("logger");

      if (cmd.trim() === "") return cb();

      let res;
      try {
        res = await performQuery(client, cmd, undefined, {
          ...argv,
          format: "shell",
        });
      } catch (err) {
        let errString = "";
        if (err.code) {
          errString = errString.concat(`${err.code}\n`);
        }
        errString = errString.concat(err.message);
        logger.stderr(errString);
        return cb(null);
      }

      logger.stdout(res);

      return cb(null);
    } catch (e) {
      return cb(e);
    }
  };
}

function buildShellCommand(yargs) {
  return yargs
    .options({
      ...commonConfigurableQueryOptions,
    })
    .example([["$0 shell"], ["$0 shell root_db/child_db"]])
    .version(false)
    .help("help", "show help");
}

export default {
  builder: buildShellCommand,
  handler: doShell,
};
