import { container } from '../cli.mjs'

// this wrapper exists for only one reason: logging
// in the future, it could also be extended for error-handling
export default async function fetchWrapper(url, options) {
  const logger = container.resolve("logger")
  const method = options?.method || "GET"

  logger.debug(`Starting ${method} "${url}"`, "fetch")
  return fetch(url, options)
    .then(async (response) => {
      const body = await response.json()
      logger.debug(`Received ${response.status} from ${method} "${url} with body:\n${JSON.stringify(body, null, 2)}`, "fetch")
      return { ...response, json: async () => body }
    })
}
