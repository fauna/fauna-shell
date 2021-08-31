const stream = require('stream')
const fauna = require('faunadb')
const q = fauna.query

class FaunaWriteStream extends stream.Writable {
  CHUNK_SIZE = 100

  MAX_PARALLEL_REQUESTS = 50

  totalImported = 0

  onGoingRequests = 0

  chunk = []

  constructor({ source, log, client, collection }) {
    super({ objectMode: true })

    this.client = client
    this.collection = collection
    this.log = log
    this.source = source
  }

  _write(chunk, enc, next) {
    this.chunk.push(chunk)
    if (this.chunk.length < this.CHUNK_SIZE) {
      return next()
    }
    this.import(this.chunk)
    this.chunk = []
    this.awaitFreeOnGoingRequest().then(next)
    // this.awaitAvailableThread().then(next)
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
          `${this.totalImported} documents imported from ${this.source} to ${this.collectionRef}`
        )
      })
      .catch(() => this.import(chunk))
      .finally(() => this.onGoingRequests--)
  }
}

module.exports = FaunaWriteStream
