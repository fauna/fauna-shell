import { container } from '../cli.mjs'

// this wrapper exists for only one reason: logging
// in the future, it could also be extended for error-handling
export default async function fetchWrapper(url, options) {
  const logger = container.resolve("logger")
  const method = options?.method || "GET"

  logger.debug(`Starting ${method} "${url}"`, "fetch")

  return fetch(url, options)
    .then(async (response) => {
      const isJSON = response.headers.get("content-type").includes("application/json");
      let logMessage = `Received ${response.status} of type ${response.type} from ${method} ${url}`

      let body
      if (isJSON) {
        body = await response.json()
        logMessage += ` with body:\n${JSON.stringify(body, null, 2)}`
      }

      logger.debug(logMessage, "fetch")
      return isJSON ? { ...response, json: async () => body } : response
    })
}
