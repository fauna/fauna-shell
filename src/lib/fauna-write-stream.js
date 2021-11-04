const stream = require('stream')
const sizeof = require('object-sizeof')
const fauna = require('faunadb')
const DynamicParallelRequestsCount = require('./dynamic-parallel-requests-count')
const q = fauna.query

const StringBool = (val) => {
  const trully = ['true', 'yes', '1', 1, true]
  return trully.includes(val)
}

const StringDate = (val) => {
  const date =
    Number.isNaN(Number(val)) || val.length === 13
      ? new Date(val)
      : new Date(Number(val) * 1000)
  return q.Time(date.toISOString())
}

const SAMPLE_DESIRED_COUNT = 1000
const CHUNK_SIZE = 25000 // 25kb
const MAX_PARALLEL_REQUESTS = 10

class SampleData {
  data = []

  sampleTotalSize = 0

  isSampleCollected() {
    return this.data.length === SAMPLE_DESIRED_COUNT
  }

  collectSample(record) {
    if (this.isSampleCollected()) return true
    const bytes = sizeof(record)
    this.data.push(record)
    this.sampleTotalSize += bytes
    return this.isSampleCollected()
  }

  getAverageRecordSize() {
    return Math.round(this.sampleTotalSize / this.data.length)
  }

  async releaseData(cb) {
    while (this.data.length) {
      await cb(this.data.shift())
    }
  }
}

class FaunaWriteStream extends stream.Writable {
  totalImported = 0

  // how many bytes left to fullfil current chunk
  currentChunkAvailableSize = CHUNK_SIZE

  chunk = []

  colTypeCast = {
    number: Number,
    date: StringDate,
    bool: StringBool,
  }

  constructor({ source, log, type, warn, client, collection }) {
    super({ objectMode: true, maxWrites: 10000 })

    this.client = client
    this.collection = collection
    this.log = log
    this.warn = warn
    this.source = source
    this.typeCasting = this.ensureTypeCasting(type)
    this.sampleData = new SampleData()
    this.dynamicParallelRequest = new DynamicParallelRequestsCount({
      chunkSize: CHUNK_SIZE,
      maxParallelRequests: MAX_PARALLEL_REQUESTS,
    })

    this.log(`Start importing from ${this.source.path}`)
  }

  _write(chunk, enc, next) {
    const record = this.castType(this.trimKeys(chunk))

    if (this.dynamicParallelRequest.capacity) {
      this.processRecord(record).then(next)
    } else {
      this.collectSampleForDynamicRequestsCount(record).then(next)
    }
  }

  trimKeys(obj) {
    return Object.keys(obj).reduce((memo, next) => {
      memo[next.trim()] = obj[next]
      return memo
    }, {})
  }

  async collectSampleForDynamicRequestsCount(record) {
    const isSampleCollected = this.sampleData.collectSample(record)
    if (!isSampleCollected) return

    const avgRecordSize = this.sampleData.getAverageRecordSize()
    this.dynamicParallelRequest.calculateCapacity({
      avgRecordSize,
    })

    this.log(
      `Average record size is ${avgRecordSize} bytes. Imports running in ${this.dynamicParallelRequest.capacity} parallel requests`
    )

    await this.sampleData.releaseData((record) => this.processRecord(record))
  }

  async processRecord(record) {
    const bytes = sizeof(record)
    this.currentChunkAvailableSize -= bytes
    if (this.currentChunkAvailableSize >= 0) {
      this.chunk.push(record)
      return
    }
    // buffer might be empty if recieved read chunk size is greater than max buffer size
    // therefore, if empty, import current read chunk, otherwise buffer
    const isBufferEmpty = this.chunk.length === 0
    if (isBufferEmpty) {
      this.import([record])
    } else {
      this.import([...this.chunk])
      this.chunk = [record]
      this.currentChunkAvailableSize = CHUNK_SIZE - bytes
    }

    return this.dynamicParallelRequest.awaitFreeRequest()
  }

  ensureTypeCasting(type) {
    if (!type) return {}
    const types = type.reduce(
      (memo, next) => {
        const [name, type] = next.split('::')
        return {
          casting: {
            ...memo.casting,
            [name]: { type, castFn: this.colTypeCast[type] },
          },
          invalidType: this.colTypeCast[type]
            ? memo.invalidType
            : [...memo.invalidType, name],
        }
      },
      { casting: {}, invalidType: [] }
    )

    if (types.invalidType.length !== 0) {
      this.emit(
        'error',
        new Error(`Following columns has invalid type: ${types.invalidType}`)
      )
    }

    return types.casting
  }

  castType(obj) {
    return Object.keys(this.typeCasting).reduce((memo, col) => {
      if (memo[col] === undefined) return memo
      const castedValue = this.typeCasting[col].castFn(memo[col])
      if (castedValue !== undefined) {
        memo[col] = castedValue
      } else {
        this.warn(
          `Value '${memo[col]}' at column '${col}' can not be casted to type '${this.typeCasting[col].type}'`
        )
      }
      return memo
    }, obj)
  }

  async end(next) {
    // in case file has less record than required for dynamic requests count
    if (!this.dynamicParallelRequest.capacity) {
      this.dynamicParallelRequest.calculateCapacity({
        avgRecordSize: this.sampleData.getAverageRecordSize(),
      })
    }

    await this.sampleData.releaseData((record) => this.processRecord(record))

    if (this.chunk.length !== 0) {
      await this.import(this.chunk)
      this.chunk = []
    }
    super.end(next)
  }

  awaitAllRequestCompleted() {
    return this.dynamicParallelRequest.awaitAllRequestCompleted()
  }

  import(chunk) {
    this.dynamicParallelRequest.occupy()
    return this.client
      .query(
        q.Let(
          {
            import: q.Do(
              chunk.map((data) =>
                q.Create(q.Collection(this.collection), {
                  data: Object.keys(data).reduce(
                    (memo, next) => ({ ...memo, [next.trim()]: data[next] }),
                    {}
                  ),
                })
              )
            ),
          },
          1
        )
      )
      .then(() => {
        this.totalImported += chunk.length

        this.log(
          `${this.totalImported} documents imported from ${this.source.path} to ${this.collection}`
        )
      })
      .catch((error) => {
        this.emit('error', error)
      })
      .finally(() => this.dynamicParallelRequest.release())
  }
}

module.exports = FaunaWriteStream
