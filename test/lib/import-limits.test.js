const { ImportLimits, RateEstimator } = require('../../src/lib/import-limits')
const expect = require('expect')

describe('ImportLimits', () => {
  describe('maximumImportSize', () => {
    it('returns 10000 for max size', () => {
      expect(ImportLimits.maximumImportSize()).toBe(10000)
    })
  })
})

describe('RateEstimator', () => {
  describe('estimateWriteOpsAsBytes', () => {
    it('rejects numberOfIndexes < 0', () => {
      expect(() => RateEstimator.estimateWriteOpsAsBytes(-1, 100)).toThrow(
        new Error('Invalid argument totalBytes must be >= 0')
      )
    })

    it('rejects totalBytes < 0', () => {
      expect(() => RateEstimator.estimateWriteOpsAsBytes(10, -1)).toThrow(
        new Error('Invalid argument numberOfIndexes must be >= 0')
      )
    })

    it('estimtes the write ops to be (1  + numIndexes) * (1 per KB of write)', () => {
      expect(RateEstimator.estimateWriteOpsAsBytes(1000, 0)).toBe(1000)
      expect(RateEstimator.estimateWriteOpsAsBytes(1100, 0)).toBe(1100)
      expect(RateEstimator.estimateWriteOpsAsBytes(100, 0)).toBe(100)
      expect(RateEstimator.estimateWriteOpsAsBytes(1000, 3)).toBe(4000)
      expect(RateEstimator.estimateWriteOpsAsBytes(1100, 3)).toBe(4400)
      expect(RateEstimator.estimateWriteOpsAsBytes(100, 3)).toBe(400)
      expect(RateEstimator.estimateWriteOpsAsBytes(2000, 3)).toBe(8000)
    })
  })
})
