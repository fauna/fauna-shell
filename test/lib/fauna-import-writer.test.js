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
    let myFailingImportWriter
    let mySlowImportWriterBytes
    let mySlowImportWriterWriteOps
    let mySlowImportWriterRequests
    let myDryRunWriter
    let logHistory = []
    let originalConsoleLog = console.log
    console.log = function (message) {
      logHistory.push(message)
      originalConsoleLog(message)
    }
    const tiniestSize = sizeof([
      { goodField: '1', numberField: '0' },
      { goodField: '1', numberField: '0' },
    ])
    const tinySize = sizeof([
      { goodField: '1', numberField: '0' },
      { goodField: '1', numberField: '0' },
      { goodField: '1', numberField: '0' },
      { goodField: '1', numberField: '0' },
      { goodField: '1', numberField: '0' },
    ])
    const defaultOptions = {
      isDryRun: false,
      logger: console.log,
      bytesPerSecondLimit: tinySize,
      writeOpsPerSecondLimit: 100,
      requestsPerSecondLimit: 10,
      maxParallelRequests: 2,
    }
    const responseWithMetrics = () => {
      return {
        value: true,
        metrics: {
          'x-compute-ops': 1,
          'x-byte-read-ops': 1,
          'x-byte-write-ops': 1,
          'x-query-time': 1,
          'x-txn-retries': 0,
        },
      }
    }

    beforeEach(() => {
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
      logHistory = []
      myMock = jestMock.fn()
      mockClient = {
        queryWithMetrics: myMock,
      }
      myImportWriter = getFaunaImportWriter(
        ['numberField::number'],
        mockClient,
        'the-collection',
        'my-file',
        { numberFailedRows: 0 },
        defaultOptions
      )
      mySlowImportWriterBytes = getFaunaImportWriter(
        ['numberField::number'],
        mockClient,
        'the-collection',
        'my-file',
        { numberFailedRows: 0 },
        { ...defaultOptions, bytesPerSecondLimit: tiniestSize }
      )
      mySlowImportWriterWriteOps = getFaunaImportWriter(
        ['numberField::number'],
        mockClient,
        'the-collection',
        'my-file',
        { numberFailedRows: 0 },
        { ...defaultOptions, writeOpsPerSecondLimit: 1 }
      )
      mySlowImportWriterRequests = getFaunaImportWriter(
        ['numberField::number'],
        mockClient,
        'the-collection',
        'my-file',
        { numberFailedRows: 0 },
        { ...defaultOptions, requestsPerSecondLimit: 1 }
      )
      myDryRunWriter = getFaunaImportWriter(
        ['numberField::number'],
        mockClient,
        'the-collection',
        'my-file',
        { numberFailedRows: 0 },
        { ...defaultOptions, isDryRun: true }
      )
    })

    afterEach(() => {
      console.log = originalConsoleLog
    })

    it('Correctly tracks number of failing rows', async () => {
      myMock
        .mockRejectedValueOnce(new Error('Transaction failure one'))
        .mockRejectedValueOnce(new Error('Transaction failure two'))
        .mockRejectedValueOnce(new Error('Transaction failure three'))
        .mockRejectedValueOnce(new Error('Transaction failure four'))

      const failingRows = { numberFailedRows: 0 }
      myFailingImportWriter = getFaunaImportWriter(
        ['numberField::number'],
        mockClient,
        'the-collection',
        'my-file',
        failingRows,
        defaultOptions
      )
      await myFailingImportWriter(myAsyncIterable)
      expect(failingRows.numberFailedRows).toEqual(4)
    })

    it('Logs the line numbers of items that fail to translate or persist to the DB', async () => {
      myMock
        .mockResolvedValue()
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(new Error('Transaction failure one'))
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(
          new UnavailableError({
            statusCode: 503,
            responseContent: {
              errors: [{ description: 'Service unavailable.' }],
            },
          })
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

    it('Retries and cuts rate limits for 409 status codes', async () => {
      // retry limit is 3
      // initial max parallel requests is 2, with payload limit for a batch of 5 items
      // after the first failure:
      // 1. the first batch will have 2 requests of 2-3 items each. these will both
      //    retry twice - leading to 6 requests.
      // 2. Due to the status code, a penalty will be applied. This penalty will cut
      //    the size down to 2.5 items based on payload,  the max parallel requests to 1,
      //    and the requests per second to 5. This will cause the next batch to be 2
      //    items in one request tried a total of 3 times.
      // 3. Now we'll get cut down to 1 item at a time for the remaining 3 items. Leading
      //    9 total requests
      await testBackoffAndCutLimit(409, 18)
    }).timeout(30000)

    it('Retries and cuts rate limits for 429 status codes', async () => {
      // retry limit is 3
      // initial max parallel requests is 2, with payload limit for a batch of 5 items
      // after the first failure:
      // 1. the first batch will have 2 requests of 2-3 items each. these will both
      //    retry twice - leading to 6 requests.
      // 2. Due to the status code, a penalty will be applied. This penalty will cut
      //    the size down to 2.5 items based on payload,  the max parallel requests to 1,
      //    and the requests per second to 5. This will cause the next batch to be 2
      //    items in one request tried a total of 3 times.
      // 3. Now we'll get cut down to 1 item at a time for the remaining 3 items. Leading
      //    9 total requests
      await testBackoffAndCutLimit(429, 18)
    }).timeout(30000)

    it('Cuts rate limits for 503 status codes; does not retry', async () => {
      // no retries
      // initial max parallel requests is 2, with payload limit for a batch of 5 items
      // after the first failure:
      // 1. the first batch will have 2 requests of 2-3 items each. these will fail and return.
      // 2. Due to the status code, a penalty will be applied. This penalty will cut
      //    the size down to 2.5 items based on payload,  the max parallel requests to 1,
      //    and the requests per second to 5. This will cause the next batch to be 2
      //    items in 1 request tried exactly once.
      // 3. Now we'll get cut down to 1 item at a time for the remaining 3 items. Leading
      //    3 more requests
      await testBackoffAndCutLimit(503, 6)
    }).timeout(30000)

    async function testBackoffAndCutLimit(statusCode, expectedCallCount) {
      myMock.mockRejectedValue(createFaunaErrorForStatusCode(statusCode))
      await myImportWriter(myAsyncIterable)
      expect(myMock).toHaveBeenCalledTimes(expectedCallCount)
      myMock.mockClear()
    }

    it('Does not retry non-retriable status codes', async () => {
      const statusCodes = [410, 413]
      for (let i = 0; i < statusCodes.length; i++) {
        myMock.mockRejectedValue(createFaunaErrorForStatusCode(statusCodes[i]))
        await myImportWriter(myAsyncIterable)
        expect(myMock).toHaveBeenCalledTimes(4)
        myMock.mockClear()
      }
    }).timeout(10000)

    it('Rate limits requests by byte throughput', async () => {
      myMock.mockResolvedValue(responseWithMetrics())
      let start = new Date()
      await mySlowImportWriterBytes(myAsyncIterable)
      let end = new Date()
      let differenceSeconds = (end.getTime() - start.getTime()) / 1000
      expect(differenceSeconds).toBeGreaterThanOrEqual(5)
    }).timeout(10000)

    it('Rate limits requests by write ops', async () => {
      myMock.mockResolvedValue(responseWithMetrics())
      let start = new Date()
      await mySlowImportWriterWriteOps(myAsyncIterable)
      let end = new Date()
      let differenceSeconds = (end.getTime() - start.getTime()) / 1000
      expect(differenceSeconds).toBeGreaterThanOrEqual(3)
    }).timeout(5000)

    it('Rate limits by the number of requests', async () => {
      myMock.mockResolvedValue(responseWithMetrics())
      let start = new Date()
      await mySlowImportWriterRequests(myAsyncIterable)
      let end = new Date()
      let differenceSeconds = (end.getTime() - start.getTime()) / 1000
      expect(differenceSeconds).toBeGreaterThanOrEqual(1)
    }).timeout(5000)
  })
})
