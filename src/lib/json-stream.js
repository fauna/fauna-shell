'use strict'
const StreamBase = require('stream-json/streamers/StreamBase')
const withParser = require('stream-json/utils/withParser')

class StreamJson extends StreamBase {
  static make(options) {
    return new StreamJson(options)
  }

  static withParser(options) {
    return withParser(
      StreamJson.make,
      Object.assign({}, options, { jsonStreaming: true })
    )
  }

  constructor(options) {
    super(options)
    this._counter = 0
    this._level = 0
  }

  _wait(chunk, _, callback) {
    if (chunk.name === 'startArray') {
      this._transform = this._filter
      this.isArrayStream = true
      return this._transform(chunk, _, callback)
    }

    return this._filter(chunk, _, callback)
  }

  _push(discard) {
    if (this.isArrayStream) {
      this.pushArray(discard)
    } else {
      this.pushValue(discard)
    }
  }

  pushArray(discard) {
    if (this._assembler.current.length) {
      if (discard) {
        ++this._counter
        this._assembler.current.pop()
      } else {
        this.push(this._assembler.current.pop())
      }
    }
  }

  pushValue(discard) {
    if (discard) {
      ++this._counter
    } else {
      this.push(this._assembler.current)
    }
    this._assembler.current = this._assembler.key = null
  }
}
StreamJson.StreamJson = StreamJson.make
StreamJson.make.Constructor = StreamJson

module.exports = StreamJson