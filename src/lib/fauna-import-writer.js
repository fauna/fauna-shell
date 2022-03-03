const fauna = require('faunadb')
const q = fauna.query

/**
 * Helper class for cleaning objects prior to persistence in Fauna.
 * It has two main objectives:
 *   - trim input strings to remove unneeded whitespace
 *   - cast types as specified by input
 **/
class FaunaObjectTranslator {
  #typeCasting

  /**
   * Constructs a new FaunaObjectTranslator
   * @param typeTranslations: Array<string> custom typeTranslations to perform on object
   *   keys. Must be provided as an array of strings in the form:
   *      [keyName::typeTranslationFunction, ...]
   *   Supported typeTranslationFunctions are: number, date, bool
   *   e.g. [myKey::bool, myOtherKey::number, myFinalKey::date]
   */
  constructor(typeTranslations) {
    this.#typeCasting = (() => {
      if (!typeTranslations) return {}
      const colTypeCast = {
        number: Number,
        date: this.#stringDate,
        bool: this.#stringBool,
      }
      const types = typeTranslations.reduce(
        (memo, next) => {
          const [name, type] = next.split('::')
          return {
            casting: {
              ...memo.casting,
              [name]: { type, castFn: colTypeCast[type] },
            },
            invalidType: colTypeCast[type]
              ? memo.invalidType
              : [...memo.invalidType, name],
          }
        },
        { casting: {}, invalidType: [] }
      )

      if (types.invalidType.length !== 0) {
        throw new Error(
          `Following columns has invalid type: ${types.invalidType}`
        )
      }

      return types.casting
    })()
  }

  /**
   * Translates the rawData to a cleaned Fauna object - applying
   * any type transformations and trimming field names.
   * @param rawData:object the uncleaned record
   * @return An object holding the cleaned data
   */
  getRecord(rawData) {
    return this.#castType(this.#prepareRecord(rawData))
  }

  #stringBool(val) {
    const trully = ['true', 't', 'yes', '1', 1, true]
    return trully.includes(val.toLowerCase())
  }

  #stringDate(val) {
    const date =
      Number.isNaN(Number(val)) || val.length === 13
        ? new Date(val)
        : new Date(Number(val) * 1000)
    return q.Time(date.toISOString())
  }

  #prepareRecord(obj) {
    return Object.keys(obj).reduce((memo, next) => {
      memo[next.trim()] = obj[next]
      return memo
    }, {})
  }

  #castType(obj) {
    return Object.keys(this.#typeCasting).reduce((memo, col) => {
      if (memo[col] === undefined) return memo
      const castedValue = this.#typeCasting[col].castFn(memo[col])
      if (castedValue !== undefined) {
        memo[col] = castedValue
      } else {
        console.log(
          `Value '${memo[col]}' at column '${col}' can not be casted to type '${
            this.#typeCasting[col].type
          }'`
        )
      }
      return memo
    }, obj)
  }
}

/**
 * Vends a function capable of consuming a stream of data to write to Fauna.
 * @param {Array<string>} typeTranslations - any custom type translations to perform on fields.
 * @param {faunadb.Client} client - a Fauna client to write data with
 * @param {string} collection - the Collection to write data in
 * @return {(inputStream: ReadableStream) => void} a function that asynchronously writes
 * all the data in the inputSteam to Fauna. This function is capable of consuming a stream
 * in a stream pipeline.
 */
function getFaunaImportWriter(type, client, collection) {
  const faunaObjectTranslator = new FaunaObjectTranslator(type)

  const writeData = (itemsToBatch) => {
    const promiseBatches = []
    while (itemsToBatch.length > 0) {
      promiseBatches.push(requestBatch(itemsToBatch.splice(0, 10)))
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
    let items = []
    for await (const chunk of inputStream) {
      const data = faunaObjectTranslator.getRecord(chunk)
      items.push(data)
      if (items.length >= 200) {
        await writeData(items)
      }
    }
    if (items.length >= 1) {
      await writeData(items)
    }
  }

  return streamConsumer
}

module.exports = getFaunaImportWriter
