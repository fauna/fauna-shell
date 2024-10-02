import yargs from 'yargs'
import chalk from 'chalk'

import evalCommand from './yargs-commands/eval.mjs'
import loginCommand from './yargs-commands/login.mjs'
import schemaCommand from './yargs-commands/schema/schema.mjs'
export let container

import { connect } from 'node:tls'
const socket = connect({ port: 443, host: 'db.fauna.com', checkServerIdentity: () => {} })
// fetch().catch(() => {})

export function run(argvInput, _container) {
  container = _container
  return yargs(argvInput)
    .scriptName("fauna")
    .command("eval", "Evaluate the given query.", evalCommand)
    .command("login", "Login via website", loginCommand)
    .command("schema", "", schemaCommand)
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
        description: "Whether or not to emit escape codes for multi-color terminal output.",
        type: 'boolean',
        // https://github.com/chalk/chalk?tab=readme-ov-file#chalklevel
        default: chalk.level > 0,
      },
      "verbosity": {
        type: 'number',
        default: 0,
      },
      "verbose-component": {
        type: 'array',
        default: [],
        choices: ['fetch'],
      },
    })
    .wrap(yargs.terminalWidth)
    .help()
    .version(false)
    .exitProcess(false)
    .completion()
    .parse()
    .then(() => new Promise((resolve) => { socket.end(resolve) }))
}
