import { table } from "table";

import { colorize, Format } from "./colorize.mjs";

/** Returns an array of objects as a ascii table
 * @param {object|Array<object>} objectOrArray - The array of objects to format.
 * @param {object} params The parameters for the table.
 * @param {import("table").TableUserConfig} params.config - The configuration object.
 * @param {Array<string>} params.columns - The columns to display.
 * @param {string} [params.header] - The header to display.
 * @returns {string} - The formatted table.
 */
const toTable = (objectOrArray, { config, columns, header }) => {
  const data = Array.isArray(objectOrArray) ? objectOrArray : [objectOrArray];
  let rows = [columns];

  if (Array.isArray(data)) {
    data.forEach((row) => {
      rows.push(columns.map((column) => row[column]));
    });
  } else {
    rows.push(columns.map((column) => [column, data[column]]));
  }

  const spanningCells = [];
  if (header) {
    rows.unshift([header, ...Array(columns.length - 1).fill("")]);
    spanningCells.push({
      col: 0,
      row: 0,
      colSpan: columns.length,
      alignment: "center",
    });
  }

  return table(rows, {
    ...config,
    ...(spanningCells.length ? { spanningCells } : {}),
  });
};

/**
 * Returns an array of objects as a TSV string
 * @param {object|Array<object>} objectOrArray - The array of objects to format.
 * @param {object} params The parameters for the table.
 * @param {string} [params.color] - The color to use.
 * @param {Array<string>} params.columns - The columns to display.
 * @returns {string} - The formatted table.
 */
const toTSV = (objectOrArray, { color, columns }) => {
  const data = Array.isArray(objectOrArray) ? objectOrArray : [objectOrArray];
  if (!data.length) {
    return "";
  }

  const rows = data.map((row) =>
    columns.map((column) => row[column]).join("\t"),
  );

  return colorize(rows.join("\n"), { color, format: Format.TSV });
};

/**
 * Returns an array of objects as a short string
 * @param {object|Array<object>} objectOrArray - The array of objects to format.
 * @param {object} params The parameters for the short formatter.
 * @param {(Array<object>) => string} params.formatter - The formatter function.
 * @returns {string} - The formatted short string.
 */
const toShort = (objectOrArray, { formatter }) => {
  const data = Array.isArray(objectOrArray) ? objectOrArray : [objectOrArray];
  return formatter(data);
};

/**
 * Returns an array of objects as a string in the requested format
 * @param {object} params The parameters for the formatter.
 * @param {object|Array<object>} params.data - The array of objects to format.
 * @param {import("./colorize.mjs").Format} params.format - The format to use.
 * @param {boolean} [params.color] - Whether to colorize the output.
 * @param {object} [params.config] - The configuration object.
 * @returns {string} - The formatted string.
 */
const toFormat = ({ data, format, color, config }) => {
  switch (format) {
    case Format.TABLE:
      return toTable(data, { ...config.table });
    case Format.YAML:
      return colorize(data, { color, format: Format.YAML });
    case Format.FQL:
      return colorize(data, { color, format: Format.FQL });
    case Format.TSV:
      return toTSV(data, { color, ...config.tsv });
    case "short":
      return toShort(data, { color, ...config.short });
    case Format.JSON:
      return colorize(data, { color, format: Format.JSON });
    default:
      throw new Error(`Unknown output format requested: ${format}`);
  }
};

/**
 * Creates a formatter function that curries the config object for toFormat
 * @param {object} config The configuration object.
 * @param {string} [config.header] - The header to display.
 * @param {Array<string>} config.columns - The columns to display.
 * @param {(Array<object>) => string} config.short.formatter - The formatter function.
 * @returns {(Array<object>) => string} - The formatter function.
 */
export const createFormatter = (config) => {
  const { header, columns, short } = config;

  if (typeof short.formatter !== "function") {
    throw new Error("short formatter must be a function");
  }

  if (!Array.isArray(columns) || !columns.length) {
    throw new Error("columns must be an array with at least one column");
  }

  if (typeof header !== "string") {
    throw new Error("header must be a string");
  }

  if (!config.table) {
    config.table = { header, columns };
  } else {
    config.table.columns = config.table.columns ?? columns;
    config.table.header = config.table.header ?? header;
  }

  if (!config.tsv) {
    config.tsv = { columns };
  }

  return ({ data, format, color }) => {
    return toFormat({ data, format, color, config });
  };
};
