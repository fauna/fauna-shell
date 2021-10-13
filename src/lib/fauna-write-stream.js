const stream = require('stream')
const sizeof = require('object-sizeof')
const fauna = require('faunadb')
const q = fauna.query

const StringBool = (val) => {
  const trully = ['true', 'yes', '1', 1, true]
  return trully.includes(val)
}

const StringDate = (val) => {
  const date =
    Number.isNaN(Number(val)) || val.length === 13
      ? new Date(val)
      : new Date(Number(val) * 1000)
  return q.Time(date.toISOString())
}

class FaunaWriteStream extends stream.Writable {
  CHUNK_SIZE = 500000 // 0.5mb

  MAX_PARALLEL_REQUESTS = 100

  totalImported = 0

  currentChunkAvailableSize = this.CHUNK_SIZE

  onGoingRequests = 0

  chunk = []

  colTypeCast = {
    number: Number,
    date: StringDate,
    bool: StringBool,
  }

  constructor({ source, log, type, warn, client, collection }) {
    super({ objectMode: true, maxWrites: 10000 })

    this.client = client
    this.collection = collection
    this.log = log
    this.warn = warn
    this.source = source
    this.typeCasting = this.ensureTypeCasting(type)

    this.log(`Start importing from ${this.source.path}`)
  }

  _write(chunk, enc, next) {
    this.ensureFieldsNames(chunk)
    const bytes = sizeof(chunk)

    const chunkWithCastedTypes = this.castType(chunk)

    this.currentChunkAvailableSize -= bytes
    if (this.currentChunkAvailableSize >= 0) {
      this.chunk.push(chunkWithCastedTypes)
      return next()
    }

    const isBufferEmpty = this.chunk.length === 0

    this.import(isBufferEmpty ? [chunkWithCastedTypes] : this.chunk)
    if (!isBufferEmpty) {
      this.chunk = [chunkWithCastedTypes]
    }
    this.currentChunkAvailableSize = this.CHUNK_SIZE - bytes
    this.awaitFreeOnGoingRequest().then(next)
    return false
  }

  ensureFieldsNames(chunk) {
    if (this.source.ext !== '.csv' || this.fieldsValidated) return
    const invalid = Object.keys(chunk).filter(
      (fieldName) => !/^[a-zA-Z]\w*$/.test(fieldName)
    )

    if (invalid.length > 0) {
      this.emit(
        'error',
        new Error(
          `${invalid} field(s) has invalid characters. Only alphanumeric characters are allowed and name must start with a letter`
        )
      )
    }

    this.fieldsValidated = true
  }

  ensureTypeCasting(type) {
    if (!type) return {}
    const types = type.reduce(
      (memo, next) => {
        const [name, type] = next.split('::')
        return {
          casting: {
            ...memo.casting,
            [name]: { type, castFn: this.colTypeCast[type] },
          },
          invalidType: this.colTypeCast[type]
            ? memo.invalidType
            : [...memo.invalidType, name],
        }
      },
      { casting: {}, invalidType: [] }
    )

    if (types.invalidType.length !== 0) {
      this.error(`Following columns has invalid type: ${types.invalidType}`)
    }

    return types.casting
  }

  castType(obj) {
    return Object.keys(this.typeCasting).reduce((memo, col) => {
      if (!memo[col]) return memo
      const castedValue = this.typeCasting[col].castFn(memo[col])
      if (castedValue) {
        memo[col] = castedValue
      } else {
        this.warn(
          `Value '${memo[col]}' at column '${col}' can not be casted to type '${this.typeCasting[col].type}'`
        )
      }
      return memo
    }, obj)
  }

  awaitFreeOnGoingRequest() {
    if (this.onGoingRequests <= this.MAX_PARALLEL_REQUESTS)
      return Promise.resolve()

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.onGoingRequests <= this.MAX_PARALLEL_REQUESTS) {
          clearInterval(interval)
          resolve()
        }
      }, 500)
    })
  }

  awaitAllOnGoingRequestCompleted() {
    if (this.onGoingRequests === 0) return Promise.resolve()

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.onGoingRequests === 0) {
          clearInterval(interval)
          resolve()
        }
      }, 500)
    })
  }

  async end(next) {
    if (this.chunk.length !== 0) {
      this.import(this.chunk)
    }
    if (typeof next === 'function') next()

    await this.awaitAllOnGoingRequestCompleted()
    this.emit('end')
  }

  import(chunk) {
    this.onGoingRequests++
    return this.client
      .query(
        q.Let(
          {
            import: q.Do(
              chunk.map((data) =>
                q.Create(q.Collection(this.collection), { data })
              )
            ),
          },
          1
        )
      )
      .then(() => {
        this.totalImported += chunk.length

        this.log(
          `${this.totalImported} documents imported from ${this.source.path} to ${this.collection}`
        )
      })
      .catch((error) => this.emit('error', error))
      .finally(() => this.onGoingRequests--)
  }
}

module.exports = FaunaWriteStream
