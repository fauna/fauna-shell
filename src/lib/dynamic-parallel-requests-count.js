class DynamicParallelRequestsCount {
  onGoingRequests = 0

  constructor({ maxParallelRequests, chunkSize }) {
    this.maxParallelRequests = maxParallelRequests
    this.chunkSize = chunkSize
  }

  calculateCapacity({ avgRecordSize }) {
    const expectedRequestCounts = Math.ceil(
      this.maxParallelRequests / (avgRecordSize / this.chunkSize)
    )
    this.capacity = Math.max(
      1,
      Math.min(expectedRequestCounts, this.maxParallelRequests)
    )
  }

  awaitFreeRequest() {
    if (this.onGoingRequests <= this.capacity) return Promise.resolve()

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.onGoingRequests <= this.capacity) {
          clearInterval(interval)
          resolve()
        }
      }, 500)
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

  occupy(promise) {
    this.onGoingRequests++
    return promise.finally(() => this.release())
  }

  release() {
    this.onGoingRequests--
  }
}

module.exports = DynamicParallelRequestsCount
