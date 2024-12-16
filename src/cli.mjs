// @ts-check

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import yargs from "yargs";

import databaseCommand from "./commands/database/database.mjs";
import localCommand from "./commands/local.mjs";
import loginCommand from "./commands/login.mjs";
import queryCommand from "./commands/query.mjs";
import schemaCommand from "./commands/schema/schema.mjs";
import shellCommand from "./commands/shell.mjs";
import { buildCredentials } from "./lib/auth/credentials.mjs";
import { getDbCompletions, getProfileCompletions } from "./lib/completions.mjs";
import { configParser } from "./lib/config/config.mjs";
import { handleParseYargsError } from "./lib/errors.mjs";
import {
  applyLocalArg,
  checkForUpdates,
  fixPaths,
  logArgv,
} from "./lib/middleware.mjs";

/** @typedef {import('awilix').AwilixContainer<import('./config/setup-container.mjs').modifiedInjectables> } cliContainer */

/** @type {cliContainer} */
export let container;
/** @type {import('yargs').Argv} */
export let builtYargs;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @param {string|string[]} _argvInput - The command string provided by the user or test. Parsed by yargs into an argv object.
 * @param {cliContainer} _container - A built and ready for use awilix container with registered injectables.
 */
export async function run(_argvInput, _container) {
  container = _container;
  const argvInput = _argvInput;
  const logger = container.resolve("logger");
  const parseYargs = container.resolve("parseYargs");
  if (process.env.NODE_ENV === "production") {
    process.removeAllListeners("warning");
  }

  try {
    builtYargs = buildYargs(argvInput);
    await parseYargs(builtYargs);
  } catch (e) {
    await handleParseYargsError(e, { argvInput, builtYargs, logger });
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
          process.emitWarning("this is a warning emitted on the node process");
        },
        builder: {},
      })
      .command("argv", false, {
        handler: async (argv) => {
          container.resolve("logger").stdout(argv);
        },
        builder: {},
      });
  }

  return yargsInstance
    .scriptName("fauna")
    .env("FAUNA")
    .config("config", configParser.bind(null, argvInput))
    .middleware([checkForUpdates, logArgv], true)
    .middleware([applyLocalArg, fixPaths, buildCredentials], false)
    .command(queryCommand)
    .command(shellCommand)
    .command(loginCommand)
    .command(schemaCommand)
    .command(databaseCommand)
    .command(localCommand)
    .demandCommand()
    .strictCommands(true)
    .completion(
      "completion",
      "Output bash/zsh script to enable shell completions. See command output for installation instructions.",
    )
    .completion(
      "completion",
      async function (currentWord, argv, defaultCompletions, done) {
        // this is pretty hard to debug - if you need to, run
        // `fauna --get-yargs-completions <command> <flag> <string to match>`
        // for example: `fauna --get-yargs-completions --profile he`
        // note that you need to have empty quotes to get all matches:
        // `fauna --get-yargs-completions --profile ""`

        // then, call the done callback with an array of strings for debugging, like:
        // done(
        //   [
        //     `currentWord: ${currentWord}, currentWordFlag: ${currentWordFlag}, argv: ${JSON.stringify(argv)}`,
        //   ],
        // );
        const previousWord = process.argv.slice(-2, -1)[0].replace(/-/g, "");
        const currentWordFlag = Object.keys(argv)
          .filter((key) => previousWord === key)
          .pop();

        // TODO: this doesn't handle aliasing, and it needs to
        if (
          currentWord === "--profile" ||
          currentWordFlag === "profile" ||
          currentWord === "-p" ||
          currentWordFlag === "p"
        ) {
          done(getProfileCompletions(currentWord, argv));
        } else if (
          currentWord === "--database" ||
          currentWordFlag === "database" ||
          currentWord === "-d" ||
          currentWordFlag === "d"
        ) {
          done(await getDbCompletions(currentWord, argv));
        } else {
          defaultCompletions();
        }
      },
    )
    .options({
      color: {
        description:
          "Enable color formatting for the output. Uses ANSI escape codes. Enabled by default if supported by the terminal. Use `--no-color` or `--color=false` to disable.",
        type: "boolean",
        // https://github.com/chalk/chalk?tab=readme-ov-file#chalklevel
        default: chalk.level > 0,
        group: "Output:",
      },
      config: {
        type: "string",
        description:
          "Path to a CLI config file to use. Use `--profile` to select a profile from the file.",
        default: ".",
        group: "Config:",
      },
      profile: {
        alias: "p",
        type: "string",
        description:
          "Profile from the CLI config file to use. Each profile specifies a set of CLI settings. Defaults to the 'default' profile when a config file is provided.",
        group: "Config:",
      },
      json: {
        type: "boolean",
        description: "Output the results as JSON.",
        default: false,
        group: "Output:",
      },
      quiet: {
        type: "boolean",
        description:
          "Only output the results of the command. Useful for scripts, CI/CD, and automation workflows.",
        default: false,
        group: "Output:",
      },
      verboseComponent: {
        description:
          "Components to emit diagnostic logs for. Takes precedence over the `--verbosity` flag. Pass components as a space-separated list, such as `--verboseComponent fetch error`, or as separate flags, such as `--verboseComponent fetch --verboseComponent error`.",
        type: "array",
        default: [],
        choices: ["fetch", "error", "config", "argv", "creds", "completion"],
        group: "Debug:",
      },
      verbosity: {
        description:
          "Maximum verbosity level for log messages. Accepts 1 (fatal) to 5 (debug). Lower values represent more critical logs.",
        type: "number",
        default: 0,
        group: "Debug:",
      },
    })
    .wrap(yargsInstance.terminalWidth())
    .help("help", "Show help.")
    .alias("help", "h")
    .fail(false)
    .exitProcess(false)
    .version(
      "version",
      "Show the fauna CLI version.",
      JSON.parse(
        fs.readFileSync(path.join(__dirname, "../package.json"), {
          encoding: "utf8",
        }),
      ).version,
    )
    .completion(
      "completion",
      "Output bash/zsh script to enable shell completions. See command output for installation instructions.",
    );