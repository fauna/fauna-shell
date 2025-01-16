// @ts-check

import { container } from "../../config/container.mjs";
import { EXPORT_TERMINAL_STATES } from "../../lib/account-api.mjs";
import { CommandError } from "../../lib/errors.mjs";
import { colorize, Format } from "../../lib/formatting/colorize.mjs";
import { isTTY } from "../../lib/utils.mjs";

const INITIAL_INTERVAL_MS = 1000; // 1 second
const MAX_INTERVAL_MS = 1000 * 60 * 5; // 5 minutes
const MAX_WAIT_MINS = 60 * 2; // 2 hours

const WAITING_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
export const WAIT_OPTIONS = {
  wait: {
    type: "boolean",
    required: false,
    description: "Wait for the export to complete before exiting.",
  },
  maxWait: {
    type: "number",
    required: false,
    description: "The maximum wait time in minutes. Maximum is 0 minutes.",
    default: MAX_WAIT_MINS,
  },
};

let currentInterval = null;

function defaultStatusHandler(message, isDone = false) {
  const stream = container.resolve("stderrStream");

  // If there's an interval, always just clear it.
  if (currentInterval) {
    clearInterval(currentInterval);
  }

  if (
    !isTTY() ||
    typeof stream.clearLine !== "function" ||
    typeof stream.cursorTo !== "function"
  ) {
    const logger = container.resolve("logger");
    logger.stderr(`[Export] ${message}`);

    return;
  }

  if (isDone) {
    const stream = container.resolve("stderrStream");

    // Clear the line and move the cursor to the beginning
    stream.clearLine(0);
    stream.cursorTo(0);

    // Write the message with the current frame
    stream.write(`Done. ${message}\n\n`);

    return;
  }

  const frames = [...WAITING_FRAMES];
  let currentFrame = frames[0];
  currentInterval = setInterval(() => {
    const stream = container.resolve("stderrStream");

    // Clear the line and move the cursor to the beginning
    stream.clearLine(0);
    stream.cursorTo(0);

    // Write the message with the current frame
    stream.write(`${currentFrame} ${message}`);

    // Rotate the frames
    frames.push(currentFrame);
    currentFrame = frames.shift() ?? frames[0];
  }, 80);
}

/**
 * Waits for an export to complete and returns the export data.
 *
 * @param {object} params
 * @param {string} params.id
 * @param {object} [params.opts]
 * @param {number} [params.opts.maxWait]
 * @param {boolean} [params.opts.color]
 * @param {string} [params.opts.quiet]
 * @param {function} [params.opts.statusHandler]
 * @returns {Promise<object>} The export data
 * @throws {CommandError} If the export did not complete within the allotted time
 */
export async function waitUntilExportIsReady({ id, opts = {} }) {
  const {
    maxWait = MAX_WAIT_MINS,
    color = true,
    statusHandler = defaultStatusHandler,
    quiet = false,
  } = opts;

  // eslint-disable-next-line no-empty-function
  const sendStatus = quiet ? () => {} : statusHandler;

  sendStatus(
    colorize(`${id} is Pending and not yet started.`, {
      format: Format.LOG,
      color,
    }),
  );

  const waitTimeMs = Math.min(maxWait, MAX_WAIT_MINS) * 60 * 1000;
  const exitAt = Date.now() + waitTimeMs;
  const terminalExport = await waitAndCheckExportState({
    id,
    exitAt,
    color,
    statusHandler: sendStatus,
  });

  return terminalExport;
}

/**
 * @param {object} params
 * @param {string} params.id
 * @param {number} params.exitAt
 * @param {number} [params.interval]
 * @param {boolean} [params.color]
 * @param {function} [params.statusHandler]
 * @returns {Promise<object>} The export data
 * @throws {CommandError} If the export did not complete within the allotted time
 */
export async function waitAndCheckExportState({
  id,
  exitAt,
  interval = INITIAL_INTERVAL_MS,
  color,
  statusHandler = defaultStatusHandler,
}) {
  const sleep = container.resolve("sleep");
  const { getExport } = container.resolve("accountAPI");

  // If the export did not complete within the allotted time, throw an error
  if (Date.now() >= exitAt) {
    statusHandler(
      colorize(`${id} did not complete within the allotted time...exiting`, {
        format: Format.LOG,
        color,
      }),
      true,
    );
    throw new CommandError(
      colorize(
        `${id} did not complete within the allotted time. To continue to check export status use: fauna export get ${id}`,
        {
          format: Format.LOG,
          color,
        },
      ),
    );
  }

  // Sleep and then check the export state. Never wait longer than MAX_INTERVAL.
  await sleep(Math.min(interval, MAX_INTERVAL_MS));

  // Fetch the export data
  const data = await getExport({ exportId: id });

  // If the export is ready, return the data
  if (EXPORT_TERMINAL_STATES.includes(data.state)) {
    statusHandler(
      colorize(`${id} has a terminal state of ${data.state}.`, {
        format: Format.LOG,
        color,
      }),
      true,
    );
    return data;
  }

  const nextInterval = Math.min(interval * 2, MAX_INTERVAL_MS);
  statusHandler(
    colorize(
      `${id} is ${data.state} and not ready. Waiting for ${nextInterval / 1000}s before checking again.`,
      {
        format: Format.LOG,
        color,
      },
    ),
  );

  // If the export is not ready, sleep and then check again
  return waitAndCheckExportState({
    id,
    exitAt,
    interval: Math.min(interval * 2, MAX_INTERVAL_MS),
    statusHandler,
  });
}
