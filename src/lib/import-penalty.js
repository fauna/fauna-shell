class ImportPenalty {
  constructor(floor, ceiling) {
    this.floor = floor;
    this.ceiling = ceiling;
  }

  getNextPenalty(current) {
    const next = current / 2;
    if (next < this.floor) return this.floor;
    return next;
  }

  getNextIncrement(current) {
    const inc = this.ceiling / 100;
    const next = current + inc;
    if (next > this.ceiling) return this.ceiling;
    return next;
  }
}

exports.ImportPenalty = ImportPenalty;
