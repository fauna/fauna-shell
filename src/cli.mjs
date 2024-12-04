// @ts-check

import chalk from "chalk";
import yargs from "yargs";

import databaseCommand from "./commands/database/database.mjs";
import keyCommand from "./commands/key.mjs";
import loginCommand from "./commands/login.mjs";
import queryCommand from "./commands/query.mjs";
import schemaCommand from "./commands/schema/schema.mjs";
import shellCommand from "./commands/shell.mjs";
import { buildCredentials } from "./lib/auth/credentials.mjs";
import { configParser } from "./lib/config/config.mjs";
import { applyLocalArg, checkForUpdates, fixPaths, logArgv } from "./lib/middleware.mjs";

/** @typedef {import('awilix').AwilixContainer<import('./config/setup-container.mjs').modifiedInjectables> } cliContainer */

/** @type {cliContainer} */
export let container;
/** @type {import('yargs').Argv} */
export let builtYargs;

export let argvInput;

/**
 * @param {string|string[]} _argvInput - The command string provided by the user or test. Parsed by yargs into an argv object.
 * @param {cliContainer} _container - A built and ready for use awilix container with registered injectables.
 */
export async function run(_argvInput, _container) {
  container = _container;
  argvInput = _argvInput;
  const logger = container.resolve("logger");
  const parseYargs = container.resolve("parseYargs");
  if (process.env.NODE_ENV === "production") {
    process.removeAllListeners("warning");
  }

  try {
    builtYargs = buildYargs(argvInput);
    await parseYargs(builtYargs);
  } catch (e) {
    let subMessage = chalk.reset(
      "Use 'fauna <command> --help' for more information about a command.",
    );

    if (argvInput.length > 0) {
      subMessage = chalk.red(e.message);
    }
    const message = `${chalk.reset(await builtYargs.getHelp())}\n\n${subMessage}`;
    logger.stderr(message);
    logger.fatal(e.stack, "error");
    const exitCode = e.exitCode !== undefined ? e.exitCode : 1;
    container.resolve("errorHandler")(e, exitCode);
  }
}

/**
 * This is split out so it can be injected & spied on. This allows ensuring that,
 * e.g., it's only run once per command invocation.
 * @param {import('yargs').Argv<any>} builtYargs
 * @returns {Promise<any>} builtYargs
 */
export async function parseYargs(builtYargs) {
  return builtYargs.parseAsync();
}

/**
 * @param {string|string[]} argvInput
 * @returns {import('yargs').Argv<any>}
 */
function buildYargs(argvInput) {
  // have to build a yargsInstance _before_ chaining off it
  // https://github.com/yargs/yargs/blob/main/docs/typescript.md?plain=1#L124
  const yargsInstance = yargs(argvInput);

  // these debug commands are used by the tests in environments where they can't mock out the command handler
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.DEBUG_COMMANDS === "true"
  ) {
    yargsInstance
      .command("throw", false, {
        handler: () => {
          throw new Error("this is a test error");
        },
        builder: {},
      })
      .command("reject", false, {
        handler: async () => {
          throw new Error("this is a rejected promise");
        },
        builder: {},
      })
      .command("warn", false, {
        handler: async () => {
          process.emitWarning("this is a warning emited on the node process");
        },
        builder: {},
      });
  }

  return yargsInstance
    .scriptName("fauna")
    .env("FAUNA")
    .config("config", configParser)
    .middleware([checkForUpdates, logArgv], true)
    .middleware([applyLocalArg, fixPaths, buildCredentials], false)
    .command(queryCommand)
    .command("shell", "Run queries in an interactive REPL.", shellCommand)
    .command("login", "Authenticate with Fauna.", loginCommand)
    .command(keyCommand)
    .command(schemaCommand)
    .command(databaseCommand)
    .demandCommand()
    .strict(true)
    .options({
      color: {
        description:
          "Enable color formatting for the output. Uses ANSI escape codes. Enabled by default if supported by the terminal. Use `--no-color` or `--color=false` to disable.",
        type: "boolean",
        // https://github.com/chalk/chalk?tab=readme-ov-file#chalklevel
        default: chalk.level > 0,
      },
      config: {
        type: "string",
        description: "Path to a CLI config file to use. Use `--profile` to select a profile from the file.",
        default: ".",
      },
      profile: {
        alias: "p",
        type: "string",
        description:
          "Profile from the CLI config file to use. Each profile specifies a set of CLI settings.",
        default: "default",
      },
      user: {
        alias: "u",
        type: "string",
        description: "User account used to run the command. Register a user account in the CLI using `fauna login`.",
        default: "default",
      },
      json: {
        type: "boolean",
        description: "Output the results as JSON.",
        default: false,
      },
      quiet: {
        type: "boolean",
        description: "Only output the results of the command. Useful for scripts, CI/CD, and automation workflows.",
        default: false,
      },
      verboseComponent: {
        description:
          "Components to emit diagnostic logs for. Takes precedence over the `--verbosity` flag. Pass components as a comma-separate list, such as `--verboseComponent fetch, error`, or as separate flags, such as `--verboseComponent fetch --verboseComponent error`.",
        type: "array",
        default: [],
        choices: ["fetch", "error", "config", "argv", "creds"],
      },
      verbosity: {
        description: "Maximum verbosity level for log messages. Accepts 1 (fatal) to 5 (debug). Lower values represent more critical logs.",
        type: "number",
        default: 0,
      },
    })
    .wrap(yargsInstance.terminalWidth())
    .help("help", "Show help.")
    .fail(false)
    .exitProcess(false)
    .version(false)
    .completion();
}
