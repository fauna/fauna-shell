const q = require('faunadb').query
const { FaunaObjectTranslator } = require('./fauna-object-translator')
const sizeof = require('object-sizeof')
const RateLimiter = require('limiter').RateLimiter

/**
 * Creates a function that consumes a stream of objects and writes creates each object
 * as a document in the given collection.
 * @param {Array<string>} typeTranslations - any custom type translations to perform on fields.
 * @param {faunadb.Client} client - a {faunadb.Client} configured for the account to store the data in.
 * @param {string} collection - the name of the {fauna.query.Collection} to write data to.
 * @param {number} bytesPerSecondLimit - the rate at which data can be written to Fauna, defaults to 280000 bytes per second
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
  bytesPerSecondLimit = 280000,
  maxParallelRequests = 10
) {
  const faunaObjectTranslator = new FaunaObjectTranslator(typeTranslations)

  const waitForRateLimitTokens = (tokens, rateLimiter) => {
    while (!rateLimiter.tryRemoveTokens(tokens)) {
      // keep trying until we have enough tokens
    }
  }

  const requestBatch = (batch) => {
    return client.query(
      q.Do(
        batch.map((data) =>
          q.Create(q.Collection(collection), {
            data: Object.keys(data).reduce(
              (memo, next) => ({ ...memo, [next.trim()]: data[next] }),
              {}
            ),
          })
        )
      )
    )
  }

  const writeData = (itemsToBatch, itemNumbers) => {
    const batchSize = Math.ceil(itemsToBatch.length / maxParallelRequests)
    const promiseBatches = []
    while (itemsToBatch.length > 0) {
      const currentItemNumbers = itemNumbers.splice(0, batchSize)
      promiseBatches.push(
        requestBatch(itemsToBatch.splice(0, batchSize)).catch((e) => {
          throw new Error(`item numbers: ${currentItemNumbers} \
(zero-indexed) in your input file failed to persist in Fauna due to: \
${e.message}. Continuing ...`)
        })
      )
    }
    return Promise.allSettled(promiseBatches)
  }

  const logSettlements = (settlements) => {
    for (let settlement of settlements) {
      if (settlement.status === 'rejected') {
        console.log(settlement.reason)
      }
    }
  }

  const streamConsumer = async (inputStream) => {
    let dataSize = 0
    let items = []
    let itemNumbers = []
    let itemNumber = -1
    const requestLimiter = new RateLimiter({
      tokensPerInterval: bytesPerSecondLimit,
      interval: 'second',
    })
    for await (const chunk of inputStream) {
      itemNumber++
      let thisItem
      try {
        thisItem = faunaObjectTranslator.getRecord(chunk)
      } catch (e) {
        console.log(
          `item number ${itemNumber} (zero-indexed) in your input file could \
not be translated into the requested format due to: ${e.message}. Skipping \
this item and continuing.`
        )
      }
      if (thisItem !== undefined) {
        const thisItemSize = sizeof(thisItem)
        if (dataSize + thisItemSize > bytesPerSecondLimit) {
          waitForRateLimitTokens(
            Math.min(bytesPerSecondLimit, dataSize),
            requestLimiter
          )
          // writeData has side effect of clearing out items and itemNumbers
          logSettlements(await writeData(items, itemNumbers))
          dataSize = 0
        }
        items.push(thisItem)
        itemNumbers.push(itemNumber)
        dataSize += thisItemSize
      }
    }

    if (items.length >= 1) {
      logSettlements(await writeData(items, itemNumbers))
    }
  }

  return streamConsumer
}

module.exports = getFaunaImportWriter
