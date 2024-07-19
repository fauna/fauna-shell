const { ImportLimits, RateEstimator } = require("../../src/lib/import-limits");
const { expect } = require("expect");

describe("ImportLimits", () => {
  describe("maximumImportSize", () => {
    it("returns 10000 for max size", () => {
      expect(ImportLimits.maximumImportSize()).toBe(10000);
    });
  });
});

describe("RateEstimator", () => {
  describe("estimateWriteOpsAsBytes", () => {
    it("rejects numberOfIndexes < 0", () => {
      expect(() => RateEstimator.estimateWriteOpsAsBytes(-1, 100)).toThrow(
        new Error("Invalid argument totalBytes must be >= 0")
      );
    });

    it("rejects totalBytes < 0", () => {
      expect(() => RateEstimator.estimateWriteOpsAsBytes(10, -1)).toThrow(
        new Error("Invalid argument numberOfIndexes must be >= 0")
      );
    });

    it("estimtes the write ops to be (1  + numIndexes) * (1 per KB of write)", () => {
      expect(RateEstimator.estimateWriteOpsAsBytes(1000, 0)).toBe(1000);
      expect(RateEstimator.estimateWriteOpsAsBytes(1100, 0)).toBe(1100);
      expect(RateEstimator.estimateWriteOpsAsBytes(100, 0)).toBe(100);
      expect(RateEstimator.estimateWriteOpsAsBytes(1000, 3)).toBe(4000);
      expect(RateEstimator.estimateWriteOpsAsBytes(1100, 3)).toBe(4400);
      expect(RateEstimator.estimateWriteOpsAsBytes(100, 3)).toBe(400);
      expect(RateEstimator.estimateWriteOpsAsBytes(2000, 3)).toBe(8000);
    });
  });

  describe("estimateWriteOps", () => {
    it("rejects numberOfIndexes < 0", () => {
      expect(() => RateEstimator.estimateWriteOps(-1, 100)).toThrow(
        new Error("Invalid argument totalBytes must be >= 0")
      );
    });

    it("rejects totalBytes < 0", () => {
      expect(() => RateEstimator.estimateWriteOps(10, -1)).toThrow(
        new Error("Invalid argument numberOfIndexes must be >= 0")
      );
    });

    it("estimtes the write ops to be (1  + numIndexes) * (1 per KB of write)", () => {
      expect(RateEstimator.estimateWriteOps(1000, 0)).toBe(1);
      expect(RateEstimator.estimateWriteOps(1100, 0)).toBe(2);
      expect(RateEstimator.estimateWriteOps(100, 0)).toBe(1);
      expect(RateEstimator.estimateWriteOps(1000, 3)).toBe(4);
      expect(RateEstimator.estimateWriteOps(1100, 3)).toBe(5);
      expect(RateEstimator.estimateWriteOps(100, 3)).toBe(1);
      expect(RateEstimator.estimateWriteOps(2000, 3)).toBe(8);
    });
  });

  describe("estimateNumberOfIndexes", () => {
    it("rejects actualWriteOps <= 0", () => {
      expect(() => RateEstimator.estimateNumberOfIndexes(-1, 100)).toThrow(
        new Error("Invalid argument actualWriteOps must be > 0")
      );
      expect(() => RateEstimator.estimateNumberOfIndexes(0, 100)).toThrow(
        new Error("Invalid argument actualWriteOps must be > 0")
      );
    });

    it("rejects totalBytes <= 0", () => {
      expect(() => RateEstimator.estimateNumberOfIndexes(10, -1)).toThrow(
        new Error("Invalid argument estimatedWriteOpsNoIndex must be > 0")
      );
      expect(() => RateEstimator.estimateNumberOfIndexes(10, 0)).toThrow(
        new Error("Invalid argument estimatedWriteOpsNoIndex must be > 0")
      );
    });

    it("estimtes the write ops to be (1  + numIndexes) * (1 per KB of write)", () => {
      expect(RateEstimator.estimateNumberOfIndexes(1, 1)).toBe(0);
      expect(RateEstimator.estimateNumberOfIndexes(2, 1)).toBe(1);
      expect(RateEstimator.estimateNumberOfIndexes(10, 1)).toBe(9);
      expect(RateEstimator.estimateNumberOfIndexes(1, 5)).toBe(0);
      expect(RateEstimator.estimateNumberOfIndexes(1, 2)).toBe(0);
      expect(RateEstimator.estimateNumberOfIndexes(1, 1000)).toBe(0);
    });
  });
});
