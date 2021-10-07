const stream = require('stream')
const sizeof = require('object-sizeof')
const fauna = require('faunadb')
const q = fauna.query

class FaunaWriteStream extends stream.Writable {
  CHUNK_SIZE = 500000 // 0.5mb

  MAX_PARALLEL_REQUESTS = 100

  totalImported = 0

  currentChunkAvailableSize = this.CHUNK_SIZE

  onGoingRequests = 0

  chunk = []

  constructor({ source, log, client, collection, typeCasting }) {
    super({ objectMode: true, maxWrites: 10000 })

    this.client = client
    this.collection = collection
    this.log = log
    this.source = source
    this.typeCasting = typeCasting

    this.log(`Start importing from ${this.source.path}`)
  }

  _write(chunk, enc, next) {
    this.ensureFieldsNames(chunk)
    const bytes = sizeof(chunk)
    this.currentChunkAvailableSize -= bytes
    if (this.currentChunkAvailableSize >= 0) {
      this.chunk.push(this.castType(chunk))
      return next()
    }

    const isBufferEmpty = this.chunk.length === 0

    this.import(isBufferEmpty ? [chunk] : this.chunk)
    if (!isBufferEmpty) {
      this.chunk = [chunk]
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

  castType(obj) {
    return Object.keys(this.typeCasting).reduce((memo, col) => {
      if (memo[col]) {
        memo[col] = this.typeCasting[col](memo[col])
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
