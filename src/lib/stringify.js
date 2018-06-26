const { renderSpecialType } = require("./special_types.js")

const stringify = obj => {
  const replacements = []

  let string = JSON.stringify(obj, (key, value) => {
    const parsed = renderSpecialType(value)

    if (parsed) {
      const placeHolder = "$$shell_replacement_$" + replacements.length + "$$"
      replacements.push(parsed)
      return placeHolder
    }

    return value
  }, 2)

  replacements.forEach((replace, index) => {
    string = string.replace('"$$shell_replacement_$' + index + '$$"', replace)
  })

  return string
}

module.exports = {
	stringify: stringify
}