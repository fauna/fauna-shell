class DynamicParallelRequestsCount {
  onGoingRequests = 0

  constructor({ maxParallelRequests, chunkSize, log }) {
    this.maxParallelRequests = maxParallelRequests
    this.chunkSize = chunkSize
    this.log = log
  }

  calculateCapacity({ avgRecordSize }) {
    const expectedRequestCounts = Math.ceil(
      this.maxParallelRequests / (avgRecordSize / this.chunkSize)
    )
    this.capacity = Math.max(
      1,
      Math.min(expectedRequestCounts, this.maxParallelRequests)
    )

    this.log(
      `Average record size is ${avgRecordSize} bytes. Imports running in ${this.capacity} parallel requests`
    )
  }

  awaitFreeRequest() {
    if (this.onGoingRequests < this.capacity) {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.onGoingRequests < this.capacity) {
          clearInterval(interval)
          resolve()
        }
      }, 100)
    })
  }

  awaitAllRequestCompleted() {
    if (this.onGoingRequests === 0) return Promise.resolve()

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.onGoingRequests === 0) {
          clearInterval(interval)
          resolve()
        }
      }, 500)
    })
  }

  occupy() {
    this.onGoingRequests++
    // return promise.finally(() => this.release())
  }

  release() {
    this.onGoingRequests--
  }
}

module.exports = DynamicParallelRequestsCount
