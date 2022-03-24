const expect = require('expect')
const getFaunaImportWriter = require('../../src/lib/fauna-import-writer')
const jestMock = require('jest-mock')
const sizeof = require('object-sizeof')
const { UnavailableError, FaunaHTTPError } = require('faunadb').errors

const createFaunaErrorForStatusCode = (statusCode) => {
  return new FaunaHTTPError('MockError', {
    statusCode: statusCode,
    responseContent: {
      errors: [{ description: 'Foo Bar' }],
    },
  })
}

describe('FaunaImportWriter', () => {
  describe('Error handling', () => {
    let myAsyncIterable
    let myMock
    let mockClient
    let myImportWriter
    let myDryRunWriter
    let logHistory
    let originalConsoleLog

    beforeEach(() => {
      const tinySize = sizeof([
        { goodField: '1', numberField: '0' },
        { goodField: '1', numberField: '0' },
        { goodField: '1', numberField: '0' },
        { goodField: '1', numberField: '0' },
        { goodField: '1', numberField: '0' },
      ])
      myAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield { goodField: '1', numberField: '0' }
          yield { goodField: '1', numberField: '1' }
          yield { goodField: '1', numberField: 'foo' }
          yield { goodField: '1', numberField: '3' }
          yield { goodField: '1', numberField: '4' }
          yield { goodField: '1', numberField: '5' }
          yield { goodField: '1', numberField: '6' }
          yield { goodField: '1', numberField: 'bar' }
          yield { goodField: '1', numberField: '8' }
          yield { goodField: '1', numberField: '9' }
        },
      }
      myMock = jestMock.fn()
      mockClient = {
        query: myMock,
      }
      logHistory = []
      originalConsoleLog = console.log
      console.log = function (message) {
        logHistory.push(message)
        originalConsoleLog(message)
      }
      myImportWriter = getFaunaImportWriter(
        ['numberField::number'],
        mockClient,
        'the-collection',
        'my-file',
        false,
        console.log,
        true,
        tinySize,
        2
      )
      myDryRunWriter = getFaunaImportWriter(
        ['numberField::number'],
        mockClient,
        'the-collection',
        'my-file',
        true,
        console.log,
        false,
        tinySize,
        2
      )
    })

    afterEach(() => {
      console.log = originalConsoleLog
    })

    it('Logs the line numbers of items that fail to translate or persist to the DB', async () => {
      myMock
        .mockReturnValue(Promise.resolve())
        .mockReturnValueOnce(Promise.resolve())
        .mockReturnValueOnce(
          Promise.reject(new Error('Transaction failure one'))
        )
        .mockReturnValueOnce(Promise.resolve())
        .mockReturnValueOnce(
          Promise.reject(
            new UnavailableError({
              statusCode: 503,
              responseContent: {
                errors: [{ description: 'Service unavailable.' }],
              },
            })
          )
        )
      await myImportWriter(myAsyncIterable)
      expect(logHistory.length).toBe(4)
      expect(logHistory[0]).toContain(
        "item number 2 (zero-indexed) in your input file 'my-file' could not be translated \
into the requested format due to: Invalid number 'foo' cannot be translated to a \
number. Skipping this item and continuing."
      )
      expect(logHistory[1]).toContain(
        "item numbers: 3,4 (zero-indexed) in your input file 'my-file' failed to persist in Fauna due to: \
'Transaction failure one' - Continuing ..."
      )
      expect(logHistory[2]).toContain(
        "item number 7 (zero-indexed) in your input file 'my-file' could not be translated \
into the requested format due to: Invalid number 'bar' cannot be translated \
to a number. Skipping this item and continuing."
      )
      expect(logHistory[3]).toContain(
        "item numbers: 8,9 (zero-indexed) in your input file 'my-file' failed to persist in Fauna due to: \
'Service unavailable.' - Continuing ..."
      )
      expect(myMock).toHaveBeenCalledTimes(4)
    })

    it('Supports dry-run mode which skips persistence but logs errors', async () => {
      await myDryRunWriter(myAsyncIterable)
      expect(logHistory.length).toBe(2)
      expect(logHistory[0]).toContain(
        "item number 2 (zero-indexed) in your input file 'my-file' could not be translated \
into the requested format due to: Invalid number 'foo' cannot be translated to a \
number. Skipping this item and continuing."
      )
      expect(logHistory[1]).toContain(
        "item number 7 (zero-indexed) in your input file 'my-file' could not be translated \
into the requested format due to: Invalid number 'bar' cannot be translated \
to a number. Skipping this item and continuing."
      )
      expect(myMock).not.toHaveBeenCalled()
    })

    it('Retries appropriate status codes', async () => {
      const statusCodes = [409, 429]
      for (let i = 0; i < statusCodes.length; i++) {
        myMock
          .mockResolvedValue()
          .mockRejectedValueOnce(createFaunaErrorForStatusCode(statusCodes[i]))
          .mockRejectedValueOnce(createFaunaErrorForStatusCode(statusCodes[i]))
          .mockRejectedValueOnce(createFaunaErrorForStatusCode(statusCodes[i]))
          .mockRejectedValueOnce(createFaunaErrorForStatusCode(statusCodes[i]))
        await myImportWriter(myAsyncIterable)
        expect(myMock).toHaveBeenCalledTimes(8)
        myMock.mockClear()
      }
    })

    it('Does not retry non-retriable status codes', async () => {
      const statusCodes = [410, 413, 503]
      for (let i = 0; i < statusCodes.length; i++) {
        myMock
          .mockResolvedValue()
          .mockRejectedValueOnce(createFaunaErrorForStatusCode(statusCodes[i]))
          .mockRejectedValueOnce(createFaunaErrorForStatusCode(statusCodes[i]))
          .mockRejectedValueOnce(createFaunaErrorForStatusCode(statusCodes[i]))
        await myImportWriter(myAsyncIterable)
        expect(myMock).toHaveBeenCalledTimes(4)
        myMock.mockClear()
      }
    })
  })
})
