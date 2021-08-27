const stream = require('stream')
const q = require('faunadb').query

class FaunaWriteStream extends stream.Writable {
  CHUNK_SIZE = 10000

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

    this.import().then(next)
  }

  end(next) {
    this.import().then(() => {
      if (typeof next === 'function') next()
      this.emit('end')
      this.log(`Import from ${this.source} to ${this.collectionRef} completed`)
    })
  }

  import() {
    return this.client
      .query(
        q.Map(this.chunk, (data) => q.Create(this.collectionRef, { data }))
      )
      .then(() => {
        this.totalImported += this.chunk.length

        this.log(
          `${this.totalImported} documents imported from ${this.source} to ${this.collectionRef}`
        )
        this.chunk = []
      })
      .catch((error) => this.emit('error', error))
  }
}

module.exports = FaunaWriteStream
