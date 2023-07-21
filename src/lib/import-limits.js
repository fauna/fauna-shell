// these functions are present to make testing the import function easy.

class ImportLimits {
  /**
   * @return the maximum import size limit in MB
   **/
  static maximumImportSize() {
    return 10000;
  }
}

class RateEstimator {
  static estimateWriteOpsAsBytes(totalBytes, numberOfIndexes) {
    if (totalBytes < 0) {
      throw new Error("Invalid argument totalBytes must be >= 0");
    }
    if (numberOfIndexes < 0) {
      throw new Error("Invalid argument numberOfIndexes must be >= 0");
    }
    return totalBytes * (1 + numberOfIndexes);
  }

  static estimateWriteOps(totalBytes, numberOfIndexes) {
    if (totalBytes < 0) {
      throw new Error("Invalid argument totalBytes must be >= 0");
    }
    if (numberOfIndexes < 0) {
      throw new Error("Invalid argument numberOfIndexes must be >= 0");
    }
    return Math.ceil((totalBytes * (1 + numberOfIndexes)) / 1000);
  }

  static estimateNumberOfIndexes(actualWriteOps, estimatedWriteOpsNoIndex) {
    if (actualWriteOps <= 0) {
      throw new Error("Invalid argument actualWriteOps must be > 0");
    }
    if (estimatedWriteOpsNoIndex <= 0) {
      throw new Error("Invalid argument estimatedWriteOpsNoIndex must be > 0");
    }
    return Math.ceil(actualWriteOps / estimatedWriteOpsNoIndex) - 1;
  }
}

module.exports.ImportLimits = ImportLimits;
module.exports.RateEstimator = RateEstimator;
