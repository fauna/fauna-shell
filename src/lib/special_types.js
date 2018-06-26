const v = require('faunadb').values;

const ctors = {
  classes: "Class",
  indexes: "Index",
  databases: "Database",
  keys: "Key"
}

const parseRef = (obj) => {
  if (obj === undefined) {
    return obj
  } else if (obj instanceof v.Ref) {
    return obj
  } else {
    const ref = ('@ref' in obj) ? obj['@ref'] : obj
    return new v.Ref(ref.id, parseRef(ref.class), parseRef(ref.database))
  }
}

const renderRef = (obj) => {
  var args = [`"${obj.id}"`]

  if (obj.class !== undefined) {
    const ctor = ctors[obj.class.id]
    if (ctor !== undefined) {
      if (obj.database !== undefined) args.push(renderRef(obj.database))
      args = args.join(', ')
      return `${ctor}(${args})`
    }
  }

  if (obj.class !== undefined) args = [renderRef(obj.class)].concat(args)
  args = args.join(', ')
  return `Ref(${args})`
}

const renderSpecialType = (type) => {
  if (!type) return null

  if (type instanceof v.Value) {
    if (type instanceof v.Ref) return renderRef(type)
    if (type instanceof v.FaunaTime) return `Time("${type.value}")`
    if (type instanceof v.FaunaDate) return `Date("${type.value}")`
    return null
  }

  if (typeof type === "object" && !Array.isArray(type)) {
    const keys = Object.keys(type)

    switch (keys[0]) {
      case "@ref":  return renderRef(parseRef(type))
      case "@ts":   return renderSpecialType(new v.FaunaTime(type["@ts"]))
      case "@date": return renderSpecialType(new v.FaunaDate(type["@date"]))
      default:      return null
    }
  }

  return null
}


module.exports = {
	renderSpecialType: renderSpecialType,
}