/* eslint-disable */

export const fql = {
  name: "fql",
  scopeName: "source.fql",
  patterns: [
    {
      comment: "Single-line comment",
      name: "comment.line.double-slash.fql",
      begin: "//",
      end: "$",
    },
    {
      include: "#block_comment",
    },
    {
      comment: "Keyword",
      name: "keyword.control.fql",
      match: "\\b(let|at|if|else|isa)\\b",
    },
    {
      include: "#single_string_literal",
    },
    {
      include: "#double_string_literal",
    },
    {
      comment: "Floating point literal (fraction)",
      name: "constant.numeric.float.fql",
      match: "\\b[+-]?[0-9][0-9_]*\\.[0-9][0-9_]*([eE][+-]?[0-9][0-9_]*)?\\b",
    },
    {
      comment: "Floating point literal (exponent)",
      name: "constant.numeric.float.fql",
      match: "\\b[+-]?[0-9][0-9_]*(\\.[0-9][0-9_]*)?[eE][+-]?[0-9][0-9_]*\\b",
    },
    {
      comment: "Integer literal (decimal)",
      name: "constant.numeric.integer.decimal.fql",
      match: "\\b[+-]?[0-9][0-9_]*\\b",
    },
    {
      comment: "Integer literal (hexadecimal)",
      name: "constant.numeric.integer.hexadecimal.fql",
      match: "\\b[+-]?0[xX][0-9a-fA-F_]+\\b",
    },
    {
      comment: "Integer literal (octal)",
      name: "constant.numeric.integer.octal.fql",
      match: "\\b[+-]?0[oO][0-7_]+\\b",
    },
    {
      comment: "Integer literal (binary)",
      name: "constant.numeric.integer.binary.fql",
      match: "\\b[+-]?0[bB][01_]+\\b",
    },
    {
      comment: "Boolean constant",
      name: "constant.language.boolean.fql",
      match: "\\b(true|false)\\b",
    },
    {
      comment: "Null constant",
      name: "constant.language.null.fql",
      match: "\\bnull\\b",
    },
    {
      comment: "Function call",
      match: "\\b([A-Za-z][A-Za-z0-9_]*|_[A-Za-z0-9_]+)\\s*\\(",
      captures: {
        1: {
          name: "entity.name.function.fql",
        },
      },
    },
    {
      comment: "Standard library modules",
      name: "entity.name.type.class.std.fql",
      match:
        "\\b(Collection|Function|Role|AccessProvider|Database|Key|Credential|Token|Array|Boolean|Date|Math|Null|Number|Int|Long|Double|Float|Object|Set|SetCursor|Struct|Time|TransactionTime|Query)\\b",
    },
    {
      comment: "Miscellaneous operator",
      name: "keyword.operator.misc.fql",
      match: "=>",
    },
    {
      comment: "Comparison operator",
      name: "keyword.operator.comparison.fql",
      match: "(&&|\\|\\||==|!=)",
    },
    {
      comment: "Arithmetic operator",
      name: "keyword.operator.arithmetic.fql",
      match: "(!|\\+|-|/|\\*|%|\\^|&|\\||<<|>>)",
    },
    {
      comment: "Comparison operator (second group because of regex precedence)",
      name: "keyword.operator.comparison.fql",
      match: "(<=|>=|<|>)",
    },
  ],
  repository: {
    block_comment: {
      comment: "Block comment",
      name: "comment.block.fql",
      begin: "/\\*",
      end: "\\*/",
      patterns: [
        {
          include: "#block_comment",
        },
      ],
    },
    escaped_character: {
      name: "constant.character.escape.fql",
      match:
        "\\\\([\\\\0'\"`nrvtbf#]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{2}|u\\{[01]0[0-9a-fA-F]{0,4}\\}|u\\{[0-9a-fA-F]{1,4}\\})",
    },
    interpolated_value: {
      name: "constant.character.escape.fql",
      begin: "#{",
      end: "}",
    },
    single_string_literal: {
      comment: "String literal (single quotes)",
      name: "string.quoted.single.fql",
      begin: "'",
      end: "'",
      patterns: [
        {
          include: "#escaped_character",
        },
      ],
    },
    double_string_literal: {
      comment: "String literal (double quotes)",
      name: "string.quoted.double.fql",
      begin: '"',
      end: '"',
      patterns: [
        {
          include: "#escaped_character",
        },
        {
          include: "#interpolated_value",
        },
      ],
    },
  },
};
