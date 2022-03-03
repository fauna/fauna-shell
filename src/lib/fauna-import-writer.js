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
   * @params rawData:object the uncleaned record
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
 * @param
 */
function getFaunaImportWriter(type, client, collection) {
  const faunaObjectTranslator = new FaunaObjectTranslator(type)

  const writeData = (items) => {
    return client.query(
      q.Do(
        items.map((data) =>
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

  let items = []

  const streamConsumer = async (inputStream) => {
    try {
      for await (const chunk of inputStream) {
        console.log(chunk)
        const data = faunaObjectTranslator.getRecord(chunk)
        console.log(data)
        items.push(data)
        if (items.length >= 20) {
          await writeData(items)
          items = []
        }
      }
    } catch (e) {
      console.log(e)
    }
    if (items.length >= 1) {
      await writeData(items)
      items = []
    }
  }
  return streamConsumer
}

module.exports = getFaunaImportWriter
