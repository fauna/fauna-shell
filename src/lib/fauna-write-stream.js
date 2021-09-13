const stream = require('stream')
const sizeof = require('object-sizeof')
const fauna = require('faunadb')
const q = fauna.query

class FaunaWriteStream extends stream.Writable {
  CHUNK_SIZE = 500000 // 0.5mb

  MAX_PARALLEL_REQUESTS = 20
  // 1 - 260263.105ms
  // 10 - 97587.800ms 127564.772ms

  totalImported = 0

  currentChunkAvailableSize = this.CHUNK_SIZE

  onGoingRequests = 0

  chunk = []

  constructor({ source, log, client, collection }) {
    super({ objectMode: true, maxWrites: 10000 })

    this.client = client
    this.collection = collection
    this.log = log
    this.source = source
  }

  _write(chunk, enc, next) {
    const bytes = sizeof(chunk)
    this.currentChunkAvailableSize -= bytes
    if (this.currentChunkAvailableSize >= 0) {
      this.chunk.push(chunk)
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
    this.log(`Import from ${this.source} to ${this.collectionRef} completed`)
  }

  import(chunk) {
    this.onGoingRequests++

    return (
      this.client
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
            `${this.totalImported} documents imported from ${this.source} to ${this.collectionRef}`
          )
        })
        // .catch(() => this.import(chunk))
        .finally(() => this.onGoingRequests--)
    )
  }
}

module.exports = FaunaWriteStream
