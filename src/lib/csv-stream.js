const csvStream = require('csv-stream')

function createStream(flags) {
  const csv = csvStream.createStream({ escapeChar: '"', enclosedChar: '"' })
  csv.on('header', ensureHeader).on('data', ensureRows)

  function ensureRows(row) {
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
    if (rowColumnCount < headerCount && !flags['allow-short-rows']) {
      this.emit(
        'error',
        new Error(
          `Row ${rowNumber} has less columns than headers. Add '--allow-short-rows' to allow rows which are shorter than the number of headers`
        )
      )
    }
  }

  function ensureHeader(headers) {
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
	 !/^[a-zA-Z0-9=:;_|!@#$%&~^(){}\t \-\+\.\?]+$/.test(fieldName.trim())
    )

    if (invalid.length > 0) {
      this.emit(
        'error',
        new Error(
          `${invalid} field(s) has invalid characters. Supported: [a-zA-Z0-9=:;_|!@#$%&~^,(){}[\\]\\t -?+.]+`
        )
      )
    }
  }

  return csv
}

module.exports = createStream
