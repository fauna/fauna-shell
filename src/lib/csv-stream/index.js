const Stream = require('stream')
const Parser = require('./parser')

class CSVStream extends Stream {
  constructor(options) {
    super()

    // States
    this.writable = true
    this.readable = true
    this._paused = false
    this._ended = false
    this._destroyed = false
    this._endCallWhenPause = false

    // Buffer
    this._buffer = Buffer.alloc(0)
    this._encoding = undefined // Encoding needs to be undefined for Buffer.toString method

    // CSV parser
    this._parser = new Parser(options)
    this._parser.on('data', (data) => {
      if (this._ended)
        throw new Error('Must not emit data event after emittion of end event.')
      this.emit('data', data)
    })
    this._parser.on('column', (key, value) => {
      this.emit('column', key, value)
    })
    this._parser.on('header', (header) => {
      this.emit('header', header)
    })
    this._parser.on('end', () => {
      this._ended = true
      this.readable = false
      this.emit('end')
    })
  }

  write(buffer, encoding) {
    this._encoding = encoding || this._encoding
    if (this._ended) throw new Error('Cannot write after end has been called.')
    if (buffer)
      this._buffer = Buffer.concat(
        [this._buffer, buffer],
        this._buffer.length + buffer.length
      )
    if (this._paused) return false
    this._parser.parse(this._buffer.toString(this._encoding))
    this._buffer = Buffer.alloc(0)
    return !this._paused
  }

  end(buffer, encoding) {
    if (this._buffer || buffer) {
      if (this.write(buffer, encoding)) {
        this.writable = false
        this._parser.end()
        if (!this._destroyed) this.destroy()
      } else {
        this._endCallWhenPause = true
      }
    }
  }

  destroy() {
    this._buffer = null
    this._destroyed = true
    this.emit('close')
  }

  pause() {
    this._paused = true
  }

  resume() {
    this._paused = false
    if (this._buffer && this._buffer.length > 0 && !this._endCallWhenPause)
      this.write()
    if (this._endCallWhenPause) this.end()
    this.emit('drain')
  }
}

module.exports = CSVStream
