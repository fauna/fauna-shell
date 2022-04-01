const q = require('faunadb').query
const { FaunaObjectTranslator } = require('./fauna-object-translator')
const sizeof = require('object-sizeof')
const { backOff } = require('exponential-backoff')
const FaunaHTTPError = require('faunadb').errors.FaunaHTTPError
const { RateLimiterMemory, RateLimiterQueue } = require('rate-limiter-flexible')
const { ImportPenalty } = require('./import-penalty')

/**
 * Creates a function that consumes a stream of objects and writes creates each object
 * as a document in the given collection.
 * @param {Array<string>} typeTranslations - any custom type translations to perform on fields.
 * @param {faunadb.Client} client - a {faunadb.Client} configured for the account to store the data in.
 * @param {string} collection - the name of the {fauna.query.Collection} to write data to.
 * @param {string} inputFile - the path to the input file.
 * @param {object} options - object containing optional arguments.
 * @param {boolean} options.isDryRun - if true dry run the import - committing no documents. to Fauna. Otherwise, write documents to Fauna. Defaults to false.
 * @param {function} options.logger - the logger to be used, defaults to console.log.
 * @param {number} options.bytesPerSecondLimit - the rate at which data can be written to Fauna, defaults to 400000 bytes per second.
 * @param {number} options.writeOpsPerSecondLimit - the rate at which data can be written to Fauna, defaults to 100 write ops per second.
 * @param {number} options.requestsPerSecondLimit - the rate at which data can be written to Fauna, defaults to 10 requests per second.
 * @param {number} options.maxParallelRequests - the maximum number of parallel requests to issue to Fauna, defaults to 10.
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
  failedRowsObj,
  {
    isDryRun = false,
    logger = console.log,
    bytesPerSecondLimit = 400000,
    writeOpsPerSecondLimit = 100,
    requestsPerSecondLimit = 1000,
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

  const penalties = {
    bytes: new ImportPenalty(0, bytesPerSecondLimit),
    writeOps: new ImportPenalty(0, writeOpsPerSecondLimit),
    requests: new ImportPenalty(0, requestsPerSecondLimit),
  }

  const rateLimiters = {
    bytes: new RateLimiterQueue(
      new RateLimiterMemory({
        duration: 1, // seconds
        points: bytesPerSecondLimit,
      })
    ),
    writeOps: new RateLimiterQueue(
      new RateLimiterMemory({
        duration: 1, // seconds
        points: writeOpsPerSecondLimit,
      })
    ),
    requests: new RateLimiterQueue(
      new RateLimiterMemory({
        duration: 1, // seconds
        points: requestsPerSecondLimit,
      })
    ),
  }

  const applyPenalties = () => {
    const nextBytesLimit = penalties.bytes.getNextPenalty(bytesPerSecondLimit)
    const nextWriteOpsLimit = penalties.writeOps.getNextPenalty(
      writeOpsPerSecondLimit
    )
    const nextRequestsLimit = penalties.requests.getNextPenalty(
      requestsPerSecondLimit
    )

    bytesPerSecondLimit = nextBytesLimit
    writeOpsPerSecondLimit = nextWriteOpsLimit
    requestsPerSecondLimit = nextRequestsLimit

    rateLimiters.bytes.points = nextBytesLimit
    rateLimiters.writeOps.points = nextWriteOpsLimit
    rateLimiters.requests.points = nextRequestsLimit
  }

  const reducePenalties = () => {
    const nextBytesLimit = penalties.bytes.getNextIncrement(bytesPerSecondLimit)
    const nextWriteOpsLimit = penalties.writeOps.getNextIncrement(
      writeOpsPerSecondLimit
    )
    const nextRequestsLimit = penalties.requests.getNextIncrement(
      requestsPerSecondLimit
    )

    bytesPerSecondLimit = nextBytesLimit
    writeOpsPerSecondLimit = nextWriteOpsLimit
    requestsPerSecondLimit = nextRequestsLimit

    rateLimiters.bytes.points = nextBytesLimit
    rateLimiters.writeOps.points = nextWriteOpsLimit
    rateLimiters.requests.points = nextRequestsLimit
  }

  const waitForRateLimiter = async (rateLimiter, tokens, limit) => {
    let remainingTokens = tokens
    while (remainingTokens > 0) {
      const removedTokens = Math.min(limit, remainingTokens)
      await rateLimiter.removeTokens(removedTokens)
      remainingTokens = Math.max(0, remainingTokens - removedTokens)
    }
  }

  /**
  Status codes of interest:
  * [409] Contention - attempt to retry
  * [410] Account disabled - do not retry
  * [413] Request too large - should not happen
  * [429] Too many requests - attempt to retry
  * [503] Timeout - do not retry
  */
  const retryHandler = (e) => {
    if (e.code === 'ECONNRESET') {
      return true
    }
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
    const write = (batch) =>
      client.queryWithMetrics(
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
        {
          timeout: 121, // read timeout should be > query timeout,
          queryTimeout: 120 * 1000, // witnessed some creates taking ~= 2 min for expensive indexes
        }
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

  const writeData = async (itemsToBatch, itemNumbers) => {
    const numRequests = Math.min(maxParallelRequests, requestsPerSecondLimit)
    const batchSize = Math.ceil(itemsToBatch.length / numRequests)
    await waitForRateLimiter(
      rateLimiters.requests,
      numRequests,
      requestsPerSecondLimit
    )
    const promiseBatches = []
    while (itemsToBatch.length > 0) {
      const currentItemNumbers = itemNumbers.splice(0, batchSize)
      promiseBatches.push(
        requestBatch(itemsToBatch.splice(0, batchSize)).catch((e) => {
          failedRowsObj.numberFailedRows += currentItemNumbers.length
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

  const settlementHandler = (s) => {
    switch (s.reason?.statusCode) {
      case 409:
        applyPenalties()
        break
      case 410:
        // exit
        break
      case 413:
        // exit
        break
      case 429:
        applyPenalties()
        break
      case 503:
        applyPenalties()
        break
      default:
        break
    }
  }

  const processSettlements = async (settlements) => {
    let totalWriteOps = 0
    for (let settlement of settlements) {
      if (settlement.status === 'rejected') {
        settlementHandler(settlement)
        logger(settlement.reason.message)
      } else {
        reducePenalties()
      }
      if (settlement.value?.metrics) {
        totalWriteOps += settlement.value.metrics['x-byte-write-ops']
      }
    }
    return totalWriteOps
  }

  const streamConsumer = async (inputStream) => {
    let dataSize = 0
    let items = []
    let itemNumbers = []
    let itemNumber = -1

    const processItems = async () => {
      // writeData has side effect of clearing out items and itemNumbers
      await waitForRateLimiter(
        rateLimiters.bytes,
        dataSize,
        bytesPerSecondLimit
      )
      const writeOps = await processSettlements(
        await writeData(items, itemNumbers)
      )
      await waitForRateLimiter(
        rateLimiters.writeOps,
        writeOps,
        writeOpsPerSecondLimit
      )
      dataSize = 0
    }

    for await (const chunk of inputStream) {
      itemNumber++
      let thisItem
      try {
        thisItem = faunaObjectTranslator.getRecord(chunk)
      } catch (e) {
        failedRowsObj.numberFailedRows++
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
