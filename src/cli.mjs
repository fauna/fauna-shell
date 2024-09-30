import yargs from 'yargs'

import evalCommand from './yargs-commands/eval.mjs'
// import { prefix } from './lib/completion.js'

export let container

import { connect } from 'node:tls'
const socket = connect({ port: 443, host: 'db.fauna.com', checkServerIdentity: () => {} })
// fetch().catch(() => {})

export function run(argvInput, _container) {
  container = _container
  return yargs(argvInput)
    .scriptName("fauna")
    .command("eval", "Evaluate the given query.", evalCommand)
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
    .wrap(yargs.terminalWidth)
    .help()
    .version(false)
    .exitProcess(false)
    .completion()
    .parse()
    .then(() => new Promise((resolve) => { socket.end(resolve) }))
}

