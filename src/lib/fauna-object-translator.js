const q = require("faunadb").query;
const moment = require("moment");

/**
 * An error translating an object with a {FaunaObjectTranslater}.
 */
class TranslationError extends Error {}

/**
 * Helper class for cleaning objects prior to persistence in Fauna.
 * It has two main objectives:
 *   - trim input strings to remove unneeded whitespace
 *   - cast types as specified by input
 **/
class FaunaObjectTranslator {
  static #NUMBER_REGEX = /(^\s*[+|-]?\d+\s*$)|(^\s*[+|-]?\d*\.\d+\s*$)/;

  static #TRULY = ["true", "t", "yes", "1", 1, true];

  static #getErrorValue(val) {
    return typeof val === "string" ? val : JSON.stringify(val);
  }

  #typeCasting;

  #logger;

  /**
   * Constructs a new FaunaObjectTranslator
   * @param {Array<string>} typeTranslations - custom typeTranslations to perform on object
   *   keys. Must be provided as an array of strings in the form:
   *      [keyName::typeTranslationFunction, ...]
   *   Supported typeTranslationFunctions are: number, dateString, dateEpochMills, dateEpochSeconds, bool
   *   e.g. [myKey::bool, myOtherKey::number, myFinalKey::date_string]
   */
  constructor(typeTranslations, logger = console.log) {
    this.#logger = logger;
    this.#typeCasting = (() => {
      if (!typeTranslations) return {};
      const colTypeCast = {
        number: this.#getNumber,
        dateString: this.#stringDate,
        dateEpochMillis: this.#epochMillisDate,
        dateEpochSeconds: this.#epochSecondsDate,
        bool: this.#stringBool,
      };
      const types = typeTranslations.reduce(
        (memo, next) => {
          const indexOfTranslationTag = next.lastIndexOf("::");
          const [name, typeTranslator] = [
            next.substring(0, indexOfTranslationTag),
            next.substring(indexOfTranslationTag + 2, next.length),
          ];
          return {
            casting: {
              ...memo.casting,
              [name]: { typeTranslator, castFn: colTypeCast[typeTranslator] },
            },
            invalidType: colTypeCast[typeTranslator]
              ? memo.invalidType
              : [...memo.invalidType, name],
          };
        },
        { casting: {}, invalidType: [] }
      );

      if (types.invalidType.length !== 0) {
        throw new Error(
          `The following columns have an invalid type translation specified: ${types.invalidType}`
        );
      }
      return types.casting;
    })();
  }

  /**
   * Translates the rawData to a cleaned Fauna object - applying
   * any type transformations and trimming field names.
   * @param {object} rawData - the uncleaned record
   * @return {object} An object holding the cleaned data.
   * @throws {Error} if translation fails
   */
  getRecord(rawData) {
    return this.#castType(this.#prepareRecord(rawData));
  }

  #getNumber(val) {
    if (typeof val === "number") {
      return val;
    }
    if (
      typeof val === "string" &&
      FaunaObjectTranslator.#NUMBER_REGEX.test(val)
    ) {
      return Number(val);
    }
    throw new TranslationError(
      `Invalid number '${FaunaObjectTranslator.#getErrorValue(
        val
      )}' cannot be translated to a number.`
    );
  }

  #stringBool(val) {
    return (
      FaunaObjectTranslator.#TRULY.includes(val) ||
      (typeof val === "string" &&
        FaunaObjectTranslator.#TRULY.includes(val.toLowerCase()))
    );
  }

  #stringDate(val) {
    if (typeof val !== "string") {
      throw new TranslationError(
        `Cannot convert '${FaunaObjectTranslator.#getErrorValue(
          val
        )}' to a date.`
      );
    }
    let theDate = moment.utc(val, moment.ISO_8601);
    if (!theDate.isValid()) {
      // fallback to other date formats
      theDate = moment.utc(val, moment.RFC_2822);
      if (!theDate.isValid()) {
        theDate = new Date(val);
        if (Number.isNaN(theDate.getTime())) {
          throw new TranslationError(
            `The string '${val}' cannot be translated to a date.`
          );
        }
        this
          .#logger(`Warning: the string '${val}' is not valid ISO-8601 nor RFC_2822 date. \
Making a best-effort translation to '${theDate}'`);
      }
    }
    return q.Time(theDate.toISOString());
  }

  #epochMillisDate(val) {
    try {
      return q.Time(
        moment
          .unix(this.#getNumber(val) / 1000)
          .utc()
          .toISOString()
      );
    } catch (e) {
      throw new TranslationError(
        `Cannot convert '${FaunaObjectTranslator.#getErrorValue(
          val
        )}' to a date.`
      );
    }
  }

  #epochSecondsDate(val) {
    try {
      return q.Time(moment.unix(this.#getNumber(val)).utc().toISOString());
    } catch (e) {
      throw new TranslationError(
        `Cannot convert '${FaunaObjectTranslator.#getErrorValue(
          val
        )}' to a date.`
      );
    }
  }

  #prepareRecord(obj) {
    return Object.keys(obj).reduce((memo, next) => {
      memo[next.trim()] = obj[next];
      return memo;
    }, {});
  }

  #castType(obj) {
    return Object.keys(this.#typeCasting).reduce((memo, col) => {
      if (memo[col] === undefined || memo[col] === null) return memo;
      const castedValue = this.#typeCasting[col].castFn.call(this, memo[col]);
      if (castedValue !== undefined) {
        memo[col] = castedValue;
      } else {
        this.#logger(
          `Value '${memo[col]}' at column '${col}' can not be casted to type '${
            this.#typeCasting[col].type
          }'`
        );
      }
      return memo;
    }, obj);
  }
}

exports.FaunaObjectTranslator = FaunaObjectTranslator;
exports.TranslationError = TranslationError;
