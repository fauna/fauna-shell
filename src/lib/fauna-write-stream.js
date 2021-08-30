const stream = require('stream')
const semaphore = require('semaphore')
const q = require('faunadb').query

class FaunaWriteStream extends stream.Writable {
  CHUNK_SIZE = 1000

  parallel = semaphore(20)

  totalImported = 0

  chunk = []

  constructor({ source, log, client, collectionRef }) {
    super({
      objectMode: true,
    })

    this.client = client
    this.collectionRef = collectionRef
    this.log = log
    this.source = source
  }

  _write(chunk, enc, next) {
    this.chunk.push(chunk)
    if (this.chunk.length < this.CHUNK_SIZE) return next()

    this.queue(this.chunk, next)
    this.chunk = []
    console.info('active ', this.parallel.current)
    this.awaitAvailable().then(next)
  }

  awaitAvailable() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.parallel.available()) {
          clearInterval(interval)
          resolve()
        }
      }, 500)
    })
  }

  end(next) {
    if (this.chunk.length !== 0) {
      this.queue(this.chunk)
    }

    if (typeof next === 'function') next()
    this.emit('end')
    this.log(`Import from ${this.source} to ${this.collectionRef} completed`)
  }

  queue(chunk, next) {
    this.parallel.take(() => {
      this.import(chunk, next).then(() => this.parallel.leave())
    })
  }

  import(chunk, next) {
    return this.client
      .query(q.Foreach(chunk, (data) => q.Create(this.collectionRef, { data })))
      .then(() => {
        this.totalImported += chunk.length

        this.log(
          `${this.totalImported} documents imported from ${this.source} to ${this.collectionRef}`
        )
      })
      .catch(next)
  }
}

module.exports = FaunaWriteStream
