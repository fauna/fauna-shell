/* eslint-disable max-depth */
/* eslint-disable complexity */
const EventEmitter = require('events').EventEmitter

class Parser extends EventEmitter {
  constructor(options) {
    super()
    this.delimiter = options ? options.delimiter || ',' : ','
    this.endLine = options ? options.endLine || '\n' : '\n'
    this.enclosedChar = options ? options.enclosedChar || '' : ''
    this.escapeChar = options ? options.escapeChar || '' : ''
    this.columnOffset = options ? options.columnOffset || 0 : 0

    this._defaultColumns = options ? Boolean(options.columns) : false
    this.columns = options ? options.columns || [] : []
    this._currentColumn = 0
    this._index = 0
    this._line = {}
    this._text = ''
    this._enclosing = null
    this._wasEnclosed = false
  }

  end(s) {
    if (s) this.parse(s)
    if (this._text || Object.getOwnPropertyNames(this._line).length > 0) {
      if (this._text[this._text.length - 1] === '\r')
        this._text = this._text.slice(0, this._text.length - 1)
      this.emit('column', this.columns[this._currentColumn], this._text)
      this._line[this.columns[this._currentColumn]] = this._text
      this.emit('data', this._line)
    }
    this.emit('end')
  }

  parse(s) {
    for (var i = 0; i < s.length; i++) {
      var c = s[i]
      if (
        this.escapeChar === c &&
        this._enclosing &&
        s[i + 1] === this.enclosedChar
      ) {
        i++
        this._text = this._text + s[i]
      } else if (this.enclosedChar === c) {
        this._enclosing = !this._enclosing
        this._wasEnclosed = true
      } else if (this.delimiter === c) {
        if (this._enclosing) {
          this._text = this._text + c
        } else {
          if (this._index < this.columnOffset) {
            //skip line
          } else if (
            this._index === this.columnOffset &&
            !this._defaultColumns
          ) {
            this.columns[this._currentColumn] = this._text
          } else {
            if (!this._wasEnclosed && this._text === '') {
              this._text = null
            }

            this.emit('column', this.columns[this._currentColumn], this._text)
            this._wasEnclosed = false
            this._line[this.columns[this._currentColumn]] = this._text
          }
          this._text = ''
          this._currentColumn++
        }
      } else if (this.endLine.includes(c)) {
        //LF
        if (this._enclosing) {
          this._text = this._text + c
        } else {
          if (this._text[this._text.length - 1] === '\r')
            this._text = this._text.slice(0, this._text.length - 1)
          if (this._index < this.columnOffset) {
            //skip line
          } else if (
            this._index === this.columnOffset &&
            !this._defaultColumns
          ) {
            this.columns[this._currentColumn] = this._text
            this.emit('header', this.columns)
          } else {
            if (!this._wasEnclosed && this._text === '') {
              this._text = null
            }
            this._wasEnclosed = false
            this.emit('column', this.columns[this._currentColumn], this._text)
            this._line[this.columns[this._currentColumn]] = this._text
            this.emit('data', this._line)
          }
          this._index++
          this._currentColumn = 0
          this._line = {}
          this._text = ''
        }
      } else {
        this._text = this._text + c
      }
    }
  }
}

module.exports = Parser
