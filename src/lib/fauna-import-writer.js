const q = require('faunadb').query
const { FaunaObjectTranslator } = require('./fauna-object-translator')
const sizeof = require('object-sizeof')
const { backOff } = require('exponential-backoff')
const FaunaHTTPError = require('faunadb').errors.FaunaHTTPError
const { RateLimiterMemory, RateLimiterQueue } = require('rate-limiter-flexible')

/**
 * Creates a function that consumes a stream of objects and writes creates each object
 * as a document in the given collection.
 * @param {Array<string>} typeTranslations - any custom type translations to perform on fields.
 * @param {faunadb.Client} client - a {faunadb.Client} configured for the account to store the data in.
 * @param {string} collection - the name of the {fauna.query.Collection} to write data to.
 * @param {boolean} isDryRun - if true dry run the import - committing no documents. to Fauna. Otherwise, write documents to Fauna. Defaults to false.
 * @param {number} bytesPerSecondLimit - the rate at which data can be written to Fauna, defaults to 400000 bytes per second
 * @param {number} maxParallelRequests - the maximum number of parallel requests to issue to Fauna
 * @return {(inputStream: ReadableStream) => void} a function that asynchronously writes
 * all the data in the inputSteam to Fauna. All data will be written to the collection specified
 * in input, and will use the provided client. This function is capable of consuming a stream
 * in a [stream pipeline](https://nodejs.org/api/stream.html).
 */
function getFaunaImportWriter(
  typeTranslations,
  client,
  collection,
  inputFile,
  {
    isDryRun = false,
    logger = console.log,
    bytesPerSecondLimit = 400000,
    writeOpsPerSecondLimit = 400000,
    maxParallelRequests = 10,
  }
) {
  class BatchError extends Error {
    statusCode

    constructor(message, statusCode) {
      super(message)
      this.statusCode = statusCode
    }
  }

  const faunaObjectTranslator = new FaunaObjectTranslator(typeTranslations)

  const rateLimiterBytes = new RateLimiterQueue(
    new RateLimiterMemory({
      duration: 1, // seconds
      points: bytesPerSecondLimit,
    })
  )

  const rateLimiterWriteOps = new RateLimiterQueue(
    new RateLimiterMemory({
      duration: 1, // seconds
      points: writeOpsPerSecondLimit,
    })
  )

  /**
  Status codes of interest:
  * [409] Contention - attempt to retry
  * [410] Account disabled - do not retry
  * [413] Request too large - should not happen
  * [429] Too many requests - attempt to retry
  * [503] Timeout - do not retry
  */
  const retryHandler = (e) => {
    switch (e.requestResult?.statusCode) {
      case 409:
        return true
      case 429:
        return true
      default:
        return false
    }
  }

  const requestBatch = (batch) => {
    // TODO have the call (or client) return the write-ops
    const write = (batch) =>
      client.query(
        q.Do(
          batch.map((data) =>
            q.Create(q.Collection(collection), {
              data: Object.keys(data).reduce(
                (memo, next) => ({ ...memo, [next.trim()]: data[next] }),
                {}
              ),
            })
          )
        ),
        { metrics: true }
      )
    // retry appropriate failed requests using exponential backoff with jitter
    return backOff(() => write(batch), {
      jitter: 'full',
      retry: retryHandler,
      numOfAttempts: 3,
      startingDelay: 500,
      timeMultiple: 2,
    })
  }

  const writeData = (itemsToBatch, itemNumbers) => {
    const batchSize = Math.ceil(itemsToBatch.length / maxParallelRequests)
    const promiseBatches = []
    while (itemsToBatch.length > 0) {
      const currentItemNumbers = itemNumbers.splice(0, batchSize)
      promiseBatches.push(
        requestBatch(itemsToBatch.splice(0, batchSize)).catch((e) => {
          const getMessage = (
            subMessage
          ) => `item numbers: ${currentItemNumbers} (zero-indexed) in your \
input file '${inputFile}' failed to persist in Fauna due to: '${subMessage}' - Continuing ...`
          if (e instanceof FaunaHTTPError) {
            throw new BatchError(
              getMessage(e.description),
              e.requestResult.statusCode
            )
          }
          throw new Error(getMessage(e.message))
        })
      )
    }
    return Promise.allSettled(promiseBatches)
  }

  const waitForRateLimiter = async (rateLimiter, tokens, limit) => {
    let remainingTokens = tokens
    while (remainingTokens > 0) {
      const removedTokens = Math.min(limit, remainingTokens)
      await rateLimiter.removeTokens(removedTokens)
      remainingTokens = Math.max(0, remainingTokens - removedTokens)
    }
  }

  const logSettlements = async (settlements) => {
    let totalWriteOps = 0
    for (let settlement of settlements) {
      if (settlement.status === 'rejected') {
        logger(settlement.reason.message)
      }
      if (settlement.value?.metrics) {
        totalWriteOps += settlement.value.metrics['x-byte-write-ops']
      }
    }
    await waitForRateLimiter(
      rateLimiterWriteOps,
      totalWriteOps,
      writeOpsPerSecondLimit
    )
  }

  const streamConsumer = async (inputStream) => {
    let dataSize = 0
    let items = []
    let itemNumbers = []
    let itemNumber = -1

    const processItems = async () => {
      // writeData has side effect of clearing out items and itemNumbers
      await logSettlements(await writeData(items, itemNumbers))
      await waitForRateLimiter(rateLimiterBytes, dataSize, bytesPerSecondLimit)
      dataSize = 0
    }

    for await (const chunk of inputStream) {
      itemNumber++
      let thisItem
      try {
        thisItem = faunaObjectTranslator.getRecord(chunk)
      } catch (e) {
        logger(
          `item number ${itemNumber} (zero-indexed) in your input file '${inputFile}' could \
not be translated into the requested format due to: ${e.message} Skipping \
this item and continuing.`
        )
      }
      if (thisItem !== undefined) {
        const thisItemSize = sizeof(thisItem)
        if (dataSize + thisItemSize > bytesPerSecondLimit && !isDryRun) {
          await processItems()
        }
        items.push(thisItem)
        itemNumbers.push(itemNumber)
        dataSize += thisItemSize
      }
    }

    if (items.length >= 1 && !isDryRun) {
      await processItems()
    }
  }

  return streamConsumer
}

module.exports = getFaunaImportWriter
