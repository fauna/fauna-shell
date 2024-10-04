import yargs from "yargs";
import chalk from "chalk";

import evalCommand from "./yargs-commands/eval.mjs";
import loginCommand from "./yargs-commands/login.mjs";
import schemaCommand from "./yargs-commands/schema/schema.mjs";
import { logArgv } from "./lib/middleware.mjs";
// import { testCreds } from './lib/file-util.mjs'
export let container;
export let builtYargs;

// import { connect } from 'node:tls'
// const socket = connect({ port: 443, host: 'db.fauna.com', checkServerIdentity: () => {} })
// fetch().catch(() => {})
// socket.end(() => { })

export async function run(argvInput, _container) {
  container = _container;
  const logger = container.resolve("logger");

  try {
    buildYargs(argvInput);
    await builtYargs.parseAsync();
  } catch (e) {
    const message = `${chalk.reset(await builtYargs.getHelp())}\n\n${chalk.red(
      e.message
    )}`;
    logger.stderr(message);
    logger.fatal("\n" + e.stack, "error");
    const exit = container.resolve("exit");
    exit(1);
  }
}

// this snapshots the yargs object after building it but before parsing
// this lets us use `builtYargs.argv` anywhere where we need argv but where
// it might be difficult to pipe them in.
function buildYargs(argvInput) {
  const logger = container.resolve("logger");

  builtYargs = yargs(argvInput)
    .scriptName("fauna")
    .middleware([logArgv], true)
    .command("eval", "evaluate a query", evalCommand)
    .command("login", "login via website", loginCommand)
    // .command("creds", "test creds", testCreds).options({
    //   user: {
    //     type: "string",
    //     description: "some user",
    //     default: "default"
    //   }
    // })
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
    //.strictCommands(true) blows up... why?
    .strictOptions(true)

    // .completion('completion', function(currentWord, argv, defaultCompletions, done) {
    // const logger = container.resolve("logger")
    // logger.debug(`Attempting auto-complete for current word ${currentWord} with argv ${JSON.stringify(argv, null, 4)}.`, 'completion')
    // const completions = {
    //   'saved': () => Object.keys(argv.savedRolls) || []
    // }

    // for (const [key, completionGetter] of Object.entries(completions)) {
    //   if (currentWord === argv[key])
    //     done(prefix(currentWord, completionGetter()))
    // }
    // defaultCompletions()
    // })
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
      "verbose-component": {
        description:
          "components to emit diagnostic logs for; this takes precedence over the 'verbosity' flag",
        type: "array",
        default: [],
        choices: ["fetch", "error", "argv"],
      },
    })
    .wrap(yargs.terminalWidth)
    .help("help", "show help")
    .fail((msg, err, yargs) => {
      const exit = container.resolve("exit");
      const message = `${chalk.reset(yargs.help())}\n\n${chalk.red(
        msg || err?.message
      )}`;
      logger.stderr(message);
      if (err && err.stack) {
        logger.fatal(err.stack);
      }
      exit(1);
    })
    .exitProcess(false)
    .version(false)
    .completion();

  return builtYargs;
}
