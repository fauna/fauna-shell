// these functions are present to make testing the import function easy.

class ImportLimits {
  /**
   * @return the maximum import size limit in MB
   **/
  static maximumImportSize() {
    return 10000
  }
}

module.exports = ImportLimits
