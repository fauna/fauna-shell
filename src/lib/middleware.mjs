import { container } from '../cli.mjs'

let argvLogged = false

export function logArgv(argv) {
  const logger = container.resolve("logger")
  if (!argvLogged) {
    logger.debug(JSON.stringify(argv, null, 4), "argv", argv)
    argvLogged = true
  }
  return argv
}
