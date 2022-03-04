const q = require('faunadb').query
const convertStringToNumber = require('convert-string-to-number').convertStringToNumber

/**
 * Helper class for cleaning objects prior to persistence in Fauna.
 * It has two main objectives:
 *   - trim input strings to remove unneeded whitespace
 *   - cast types as specified by input
 **/
class FaunaObjectTranslator {
  
  /**
   * Constructs a new FaunaObjectTranslator
   * @param {Array<string>} typeTranslations - custom typeTranslations to perform on object
   *   keys. Must be provided as an array of strings in the form:
   *      [keyName::typeTranslationFunction, ...]
   *   Supported typeTranslationFunctions are: number, date, bool
   *   e.g. [myKey::bool, myOtherKey::number, myFinalKey::date]
   */
  constructor(typeTranslations) {
    this.#typeCasting = (() => {
      if (!typeTranslations) return {}
      const colTypeCast = {
        number: this.#getNumber,
        date: this.#stringDate,
        bool: this.#stringBool,
      }
      const types = typeTranslations.reduce(
        (memo, next) => {
          const [name, typeTranslator] = next.split('::')
          return {
            casting: {
              ...memo.casting,
              [name]: { typeTranslator, castFn: colTypeCast[typeTranslator] },
            },
            invalidType: colTypeCast[typeTranslator]
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
   * @param {object} rawData - the uncleaned record
   * @return {object} An object holding the cleaned data
   */
  getRecord(rawData) {
    return this.#castType(this.#prepareRecord(rawData))
  }

  #getNumber(val) {
    if (typeof val !== 'string' || val.trim() === "") {
      return null
    }
    const maybeNumber = convertStringToNumber(val)
    if (Number.isNaN(maybeNumber)) {
      throw new Error(`Invalid number '${val}' is not a number`)
    }
    return maybeNumber
  }

  #stringBool(val) {
    const trully = ['true', 't', 'yes', '1', 1, true]
    return trully.includes(val.toLowerCase())
  }

  #stringDate(val) {
    console.log(val)
    if (val.trim() === "") {
      return null
    }
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

module.exports = FaunaObjectTranslator
