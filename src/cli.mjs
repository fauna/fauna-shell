// @ts-check

import yargs from "yargs";
import chalk from "chalk";

import evalCommand from "./yargs-commands/eval.mjs";
import loginCommand from "./yargs-commands/login.mjs";
import schemaCommand from "./yargs-commands/schema/schema.mjs";
import { logArgv } from "./lib/middleware.mjs";

/** @typedef {import('awilix').AwilixContainer<import('./config/setup-container.mjs').modifiedInjectables>} cliContainer */

/** @type {cliContainer} */
export let container;
/** @type {yargs.Argv} */
export let builtYargs;

/**
 * @function run
 * @param {string} argvInput - The command string provided by the user or test. Parsed by yargs into an argv object.
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
      e.message
    )}`;
    logger.stderr(message);
    logger.fatal(e.stack, "error");
    container.resolve("errorHandler")(e, 1);
  }
}

// we split this out so it can be injected/mocked
// this lets us record calls against it and, e.g.,
// ensure it's only run once per command invocation
export async function parseYargs(builtYargs) {
  return builtYargs.parseAsync();
}

/**
 * @function buildYargs
 * @param {string} argvInput
 * @returns {yargs.Argv<any>}
 */
function buildYargs(argvInput) {
  return (
    yargs(argvInput)
      .scriptName("fauna")
      .middleware([logArgv], true)
      .command("eval", "evaluate a query", evalCommand)
      .command("login", "login via website", loginCommand)
      .command(schemaCommand)
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
      .wrap(yargs.terminalWidth())
      .help("help", "show help")
      .fail(false)
      .exitProcess(false)
      .version(false)
      .completion()
  );
}
