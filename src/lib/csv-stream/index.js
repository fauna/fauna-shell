/*!
 * csv-stream
 * Copyright(c) 2012 HipSnip Limited
 * Author Rémy Loubradou <remyloubradou@gmail.com>
 * MIT Licensed
 *
 * Originally imported to Fauna Shell from this file:
 * https://github.com/lbdremy/node-csv-stream/blob/8aea01108b/index.js
 */

/* eslint-disable no-useless-escape */
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

    this.flags = options.flags

    // Buffer
    this._buffer = Buffer.alloc(0)
    this._encoding = undefined // Encoding needs to be undefined for Buffer.toString method

    // CSV parser
    this._parser = new Parser(options)
    this._parser.on('data', (data) => {
      if (this._ended)
        throw new Error('Must not emit data event after emittion of end event.')

      this.emit('data', this.ensureRows(data))
    })
    this._parser.on('column', (key, value) => {
      this.emit('column', key, value)
    })
    this._parser.on('header', (header) => {
      this.emit('header', this.ensureHeader(header))
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

  ensureHeader(headers) {
    const { duplicates } = headers.reduce(
      (memo, next) => {
        const header = next.trim()
        if (memo.counts[header]) {
          memo.counts[header]++
          memo.duplicates.add(header)
        }

        memo.counts[header] = 1
        return memo
      },
      {
        counts: {},
        duplicates: new Set(),
      }
    )

    if (duplicates.size) {
      this.emit(
        'error',
        new Error(
          `File should not have duplicates headers. Please check following header(s): ${[
            ...duplicates,
          ]}`
        )
      )
      return
    }

    const invalid = headers.filter(
      (fieldName) =>
        !/^[a-zA-Z0-9=:;_|!@#$%&~,^(){}\t \-\+\.\?]+$/.test(fieldName.trim())
    )

    if (invalid.length > 0) {
      this.emit(
        'error',
        new Error(
          `${invalid} field(s) has invalid characters. Supported: [a-zA-Z0-9=:;_|!@#$%&~,^(){}\\t \\-\\+\\.\\?]+`
        )
      )
    }

    return headers
  }

  ensureRows(row) {
    const headerCount = this._parser.columns.length
    const rowColumnCount = Object.keys(row).length
    const rowNumber = this._parser._index + 1
    if (rowColumnCount > headerCount) {
      this.emit(
        'error',
        new Error(
          `Row ${rowNumber} has more columns that described at the headers`
        )
      )
      return
    }
    if (rowColumnCount < headerCount && !this.flags['allow-short-rows']) {
      this.emit(
        'error',
        new Error(
          `Row ${rowNumber} has less columns than headers. Add '--allow-short-rows' to allow rows which are shorter than the number of headers`
        )
      )
    }

    return row
  }
}

module.exports = CSVStream
