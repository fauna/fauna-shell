const FaunaObjectTranslator = require('../../src/lib/fauna-object-translator')
const expect = require('expect')

describe('FaunaObjectTranslator', () => {
  it('should integers', () => {
    const translator = new FaunaObjectTranslator(['my_number::number'])
    const actual = translator.getRecord({ a: '234', my_number: '12' })
    expect(actual).toEqual({ a: '234', my_number: 12 })
  })
})
