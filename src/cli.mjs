// @ts-check

import yargs from "yargs";
import chalk from "chalk";

import evalCommand from "./commands/eval.mjs";
import loginCommand from "./commands/login.mjs";
import schemaCommand from "./commands/schema/schema.mjs";
import databaseCommand from "./commands/database.mjs";
import keyCommand from "./commands/key.mjs";
import { logArgv, fixPaths } from "./lib/middleware.mjs";

/** @typedef {import('awilix').AwilixContainer<import('./config/setup-container.mjs').modifiedInjectables>} cliContainer */

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

  try {
    builtYargs = buildYargs(argvInput);
    await parseYargs(builtYargs);
  } catch (e) {
    const message = `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red(
      e.message,
    )}`;
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

  return (
    yargsInstance
      .scriptName("fauna")
      .middleware([logArgv], true)
      .middleware([fixPaths], false)
      .command("eval", "evaluate a query", evalCommand)
      .command("login", "login via website", loginCommand)
      .command(keyCommand)
      .command(schemaCommand)
      .command(databaseCommand)
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
      .demandCommand()
      // TODO .strictCommands(true) blows up... why?
      .strictOptions(true)
      .options({
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
      })
      .wrap(yargsInstance.terminalWidth())
      .help("help", "show help")
      .fail(false)
      .exitProcess(false)
      .version(false)
      .completion()
  );
}
