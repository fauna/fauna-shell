const expect = require('expect')
const { ImportPenalty } = require('../../src/lib/import-penalty')

describe('ImportPenalty', () => {
  let MyImportPenalty

  beforeEach(() => {
    MyImportPenalty = new ImportPenalty(10, 100)
  })

  describe('Penalty Calculation', () => {
    it('Properly calcuates the next penalty', async () => {
      let next
      next = MyImportPenalty.getNextPenalty(100)
      expect(next).toEqual(50)
      next = MyImportPenalty.getNextPenalty(50)
      expect(next).toEqual(25)
    })
    it('Properly calcuates the next increment', async () => {
      let next
      next = MyImportPenalty.getNextIncrement(50)
      expect(next).toEqual(51)
      next = MyImportPenalty.getNextIncrement(51)
      expect(next).toEqual(52)
    })
    it('Respects the floor', async () => {
      let next
      next = MyImportPenalty.getNextPenalty(10)
      expect(next).toEqual(10)
      next = MyImportPenalty.getNextPenalty(5)
      expect(next).toEqual(10)
    })
    it('Respects the ceiling', async () => {
      let next
      next = MyImportPenalty.getNextIncrement(100)
      expect(next).toEqual(100)
      next = MyImportPenalty.getNextIncrement(110)
      expect(next).toEqual(100)
    })
  })
})
