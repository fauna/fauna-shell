//@ts-check

import { inspect } from "node:util";

import { container } from "../config/container.mjs";
import { redactedStringify } from "./formatting/redact.mjs";

// this wrapper exists for only one reason: logging
// in the future, it could also be extended for error-handling,
// analytics, or metrics collection.
export default async function fetchWrapper(url, options) {
  const logger = container.resolve("logger");
  const method = options?.method || "GET";

  let debugInfo = `Starting ${method} "${url}"`;
  if (options.body) debugInfo += ` with body ${inspect(options.body)}`;
  logger.debug(debugInfo, "fetch");

  return fetch(url, options).then(async (response) => {
    const isJSON = response.headers
      .get("content-type")
      ?.includes("application/json");
    let logMessage = `Received ${response.status} of type ${response.type} from ${method} ${url}`;

    let body;
    if (isJSON) {
      body = await response.json();
      logMessage += ` with body:\n${redactedStringify(body, null, 2)}`;
    }

    logger.debug(logMessage, "fetch");

    return new Response(JSON.stringify(body), {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });
  });
}
