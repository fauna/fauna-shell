import yargs from 'yargs'
import chalk from 'chalk'

import evalCommand from './yargs-commands/eval.mjs'
import loginCommand from './yargs-commands/login.mjs'
import schemaCommand from './yargs-commands/schema/schema.mjs'
export let container

// import { connect } from 'node:tls'
// const socket = connect({ port: 443, host: 'db.fauna.com', checkServerIdentity: () => {} })
// fetch().catch(() => {})
// socket.end(() => { })

export async function run(argvInput, _container) {
  container = _container
  const logger = container.resolve("logger")

  try {
    await yargs(argvInput)
    .scriptName("fauna")
    .command("eval", "evaluate a query", evalCommand)
    .command("login", "login via website", loginCommand)
    .command("schema <subcommand>", "manipulate Fauna schema state", schemaCommand)
    .demandCommand()
    .strict()
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
      "color": {
        description: "whether or not to emit escape codes for multi-color terminal output.",
        type: 'boolean',
        // https://github.com/chalk/chalk?tab=readme-ov-file#chalklevel
        default: chalk.level > 0,
      },
      "verbosity": {
        description: "the lowest level diagnostic logs to emit",
        type: 'number',
        default: 0,
      },
      "verbose-component": {
        description: "components to emit diagnostic logs for; this takes precedence over the 'verbosity' flag",
        type: 'array',
        default: [],
        choices: ['fetch'],
      },
    })
    .wrap(yargs.terminalWidth)
    .help('help', 'show help')
    .fail((msg, err, yargs) => {
      logger.stdout(yargs.help() + '\n')
      logger.stderr(chalk.red(msg))
      if (err && err.stack) {
        throw err
      } else {
        throw new Error(msg)
      }
    })
    .version(false)
    .completion()
    .parseAsync()
  } catch (e) {
    logger.fatal(e.stack, "error")
    const exit = container.resolve("exit")
    exit(1)
  }
}
