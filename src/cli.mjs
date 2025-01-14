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
import { container, setContainer } from "./config/container.mjs";
import { buildCredentials } from "./lib/auth/credentials.mjs";
import { getDbCompletions, getProfileCompletions } from "./lib/completions.mjs";
import { configParser } from "./lib/config/config.mjs";
import { handleParseYargsError } from "./lib/errors.mjs";
import {
  applyAccountUrl,
  applyLocalArg,
  checkForUpdates,
  fixPaths,
  logArgv,
  scopeSecret,
} from "./lib/middleware.mjs";

/** @type {import('yargs').Argv} */
export let builtYargs;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @param {string|string[]} _argvInput - The command string provided by the user or test. Parsed by yargs into an argv object.
 * @param {import('./config/container.mjs').container} container - A built and ready for use awilix container with registered injectables.
 */
export async function run(_argvInput, container) {
  setContainer(container);

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
    .middleware(
      [applyLocalArg, fixPaths, applyAccountUrl, buildCredentials, scopeSecret],
      false,
    )
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
      "Output a bash/zsh script for CLI auto-completions. See command output for installation instructions.",
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

        // This doesn't handle aliasing, and it needs to
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
        description: "Enable color formatting. Use --no-color to disable.",
        type: "boolean",
        // https://github.com/chalk/chalk?tab=readme-ov-file#chalklevel
        default: chalk.level > 0,
        group: "Output:",
      },
      config: {
        type: "string",
        description:
          "Path to a CLI config file to use. If provided, you must specify a profile.",
        default: ".",
        group: "Config:",
      },
      profile: {
        alias: "p",
        type: "string",
        description: "Profile from the CLI config file to use.",
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
          "Suppress all log messages except fatal errors. Overrides --verbosity and --verbose-component.",
        default: false,
        group: "Output:",
      },
      "verbose-component": {
        description:
          "Components to emit logs for. Overrides the --verbosity flag. Pass values as a space-separated list. Ex: --verbose-component fetch error.",
        type: "array",
        default: [],
        choices: ["argv", "completion", "config", "creds", "error", "fetch"],
        group: "Debug:",
      },
      verbosity: {
        description:
          "Least critical log level to emit. Accepts 1 (fatal) to 5 (debug). Lower values represent more critical logs.",
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
      "Show the Fauna CLI version.",
      JSON.parse(
        fs.readFileSync(path.join(__dirname, "../package.json"), {
          encoding: "utf8",
        }),
      ).version,
    );
}
