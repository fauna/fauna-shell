const q = require('faunadb').query
const FaunaObjectTranslator = require('./fauna-object-translator')
const sizeof = require('object-sizeof')
const RateLimiter = require('limiter').RateLimiter

/**
 * Creates a function that consumes a stream of objects and writes creates each object
 * as a document in the given collection.
 * @param {Array<string>} typeTranslations - any custom type translations to perform on fields.
 * @param {faunadb.Client} client - a {faunadb.Client} configured for the account to store the data in.
 * @param {string} collection - the name of the {fauna.query.Collection} to write data to.
 * @return {(inputStream: ReadableStream) => void} a function that asynchronously writes
 * all the data in the inputSteam to Fauna. All data will be written to the collection specified
 * in input, and will use the provided client. This function is capable of consuming a stream
 * in a [stream pipeline](https://nodejs.org/api/stream.html).
 */
function getFaunaImportWriter(type, client, collection) {

  const faunaObjectTranslator = new FaunaObjectTranslator(type)

  const waitForRateLimitTokens = (tokens, rateLimiter) => {
      while (!rateLimiter.tryRemoveTokens(tokens)) {
          // keep trying until we have enough tokens
      }
  }

  const writeData = (itemsToBatch) => {
    const maxParallelRequests = 10
    const batchSize = Math.ceil(itemsToBatch.length / maxParallelRequests)
    const promiseBatches = []
    while (itemsToBatch.length > 0) {
      promiseBatches.push(requestBatch(itemsToBatch.splice(0, batchSize)))
    }
    return Promise.all(promiseBatches);
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

  const streamConsumer = async (inputStream) => {
    let dataSize = 0
    let items = []
    const bytesPerSecondLimit = 280000 // 1 GB / hour is our goal
    const requestLimiter = new RateLimiter({ tokensPerInterval: bytesPerSecondLimit, interval: "second" })
    for await (const chunk of inputStream) {
      const thisItem = faunaObjectTranslator.getRecord(chunk)
      const thisItemSize = sizeof(thisItem)
      if ((dataSize + thisItemSize) > bytesPerSecondLimit) {
        waitForRateLimitTokens(Math.min(bytesPerSecondLimit, dataSize), requestLimiter)
        // writeData has side effect of clearing out items
        await writeData(items)
        dataSize = 0
      }
      items.push(thisItem)
      dataSize += thisItemSize
    }
    if (items.length >= 1) {
      await writeData(items)
    }
  }

  return streamConsumer
}

module.exports = getFaunaImportWriter
