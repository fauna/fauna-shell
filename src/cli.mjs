// @ts-check

import chalk from "chalk";
import yargs from "yargs";

import databaseCommand from "./commands/database/database.mjs";
import evalCommand from "./commands/eval.mjs";
import keyCommand from "./commands/key.mjs";
import loginCommand from "./commands/login.mjs";
import schemaCommand from "./commands/schema/schema.mjs";
import shellCommand from "./commands/shell.mjs";
import { authNZMiddleware } from "./lib/auth/authNZ.mjs";
import { checkForUpdates, fixPaths, logArgv } from "./lib/middleware.mjs";

/** @typedef {import('awilix').AwilixContainer<import('./config/setup-container.mjs').modifiedInjectables> } cliContainer */

/** @type {cliContainer} */
export let container;
/** @type {import('yargs').Argv} */
export let builtYargs;

/**
 * @param {string|string[]} argvInput - The command string provided by the user or test. Parsed by yargs into an argv object.
 * @param {cliContainer} _container - A built and ready for use awilix container with registered injectables.
 */
export async function run(argvInput, _container) {
  container = _container;
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
    .middleware([checkForUpdates, logArgv], true)
    .middleware([fixPaths, authNZMiddleware], false)
    .command("eval", "evaluate a query", evalCommand)
    .command("shell", "start an interactive shell", shellCommand)
    .command("login", "login via website", loginCommand)
    .command(keyCommand)
    .command(schemaCommand)
    .command(databaseCommand)
    .demandCommand()
    .strict(true)
    .options({
      profile: {
        alias: "p",
        type: "string",
        description: "a user profile",
        default: "default",
      },
      color: {
        description:
          "whether or not to emit escape codes for multi-color terminal output.",
        type: "boolean",
        // https://github.com/chalk/chalk?tab=readme-ov-file#chalklevel
        default: chalk.level > 0,
      },
      verbosity: {
        description: "the lowest level diagnostic logs to emit",
        type: "number",
        default: 0,
      },
      verboseComponent: {
        description:
          "components to emit diagnostic logs for; this takes precedence over the 'verbosity' flag",
        type: "array",
        default: [],
        choices: ["fetch", "error", "argv"],
      },
      // Whether authNZ middleware should run. Better way of doing this?
      authRequired: {
        hidden: true,
        default: false,
      },
    })
    .wrap(yargsInstance.terminalWidth())
    .help("help", "show help")
    .fail(false)
    .exitProcess(false)
    .version(false)
    .completion();
}
