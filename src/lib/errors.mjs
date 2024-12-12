import chalk from "chalk";
import hasAnsi from "has-ansi";
import util from "util";

import { container } from "../cli.mjs";

const BUG_REPORT_MESSAGE = "If you believe this is a bug, please report this issue on GitHub: https://github.com/fauna/fauna-shell/issues";
export const SUPPORT_MESSAGE = "If this issue persists contact support: https://support.fauna.com/hc/en-us/requests/new";

/*
 * These are the error message prefixes that yargs throws during
 * validation. To detect these errors, you can either parse the stack
 * or the message. We've decided to parse the messages.
 *
 * Compiled from https://github.com/yargs/yargs/blob/main/lib/validation.ts
 */
const YARGS_STATIC_PREFIXES = [
  "Unknown argument:",
  "Unknown arguments:",
  "Missing required argument:",
  "Missing required arguments:",
  "Unknown command:",
  "Unknown commands:",
  "Invalid values:",
  "Not enough non-option arguments:",
  "Too many non-option arguments:",
  "Implications failed:",
];

/**
 * An error that is thrown by commands that is not a validation error, but
 * a known error state that should be communicated to the user.
 */
export class CommandError extends Error {
  /**
   * @param {string} message
   * @param {object} [opts]
   * @param {number} [opts.exitCode]
   * @param {boolean} [opts.hideHelp]
   * @param {Error} [opts.cause]
   */
  constructor(message, { exitCode = 1, hideHelp = true, cause } = {}) {
    super(message);
    this.exitCode = exitCode;
    this.hideHelp = hideHelp;
    this.cause = cause;
  }
}

/**
 * An error that is thrown when the user provides invalid input, but
 * isn't caught until command execution.
 */
export class ValidationError extends CommandError {
  /**
   * @param {string} message
   * @param {object} [opts]
   * @param {number} [opts.exitCode]
   * @param {boolean} [opts.hideHelp]
   * @param {Error} [opts.cause]
   */
  constructor(message, { exitCode = 1, hideHelp = false, cause } = {}) {
    super(message, { exitCode, hideHelp, cause });
  }
}

/**
 * Returns true if the error is an error potentially thrown by yargs
 * @param {Error} error
 * @returns {boolean}
 */
function isYargsError(error) {
  // Sometimes they are named YError. This seems to the case in middleware.
  if (error.name === "YError") {
    return true;
  }

  // Does the message look like a yargs error?
  if (
    error.message &&
    YARGS_STATIC_PREFIXES.some((prefix) => error.message.startsWith(prefix))
  ) {
    return true;
  }

  return false;
}

/**
 * Returns true if the error is not an error yargs or one we've thrown ourselves in a command
 * @param {Error} error
 * @returns {boolean}
 */
export function isUnknownError(error) {
  return !isYargsError(error) && !(error instanceof CommandError);
}

export const handleParseYargsError = async (
  e,
  { argvInput, builtYargs, logger },
) => {
  let subMessage = chalk.reset(
    "Use 'fauna <command> --help' for more information about a command.",
  );
  let epilogue = "";

  if (argvInput.length > 0) {
    // If the error isn't one of our known errors, wrap it in a generic error message.
    if (isUnknownError(e)) {
      subMessage = chalk.red(`An unexpected error occurred...\n\n${e.message}`);
      epilogue = `\n${BUG_REPORT_MESSAGE}`;

      logger.debug(`unknown error thrown: ${e.name}`, "error");
      logger.debug(util.inspect(e, true, 2, false), "error");
    } else {
      logger.debug(`known error thrown: ${e.name}`, "error");
      logger.debug(util.inspect(e, true, 2, false), "error");
      // Otherwise, just use the error message
      subMessage = hasAnsi(e.message) ? e.message : chalk.red(e.message);
    }
  }

  // If the error has a truthy hideHelp property, do not render the help text. Otherwise, just use the error message.
  logger.stderr(
    `${e.hideHelp ? "" : `${chalk.reset(await builtYargs.getHelp())}\n\n`}${subMessage}`,
  );

  if (epilogue) {
    logger.stderr(chalk.red(epilogue));
  }

  // Log the stack if it exists
  logger.fatal(e.stack, "error");
  if (e.cause) {
    logger.fatal(e.cause?.stack, "error");
  }

  // If the error has an exitCode property, use that. Otherwise, use 1.
  container.resolve("errorHandler")(
    e,
    e.exitCode !== undefined ? e.exitCode : 1,
  );
};
