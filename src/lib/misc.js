// TODO: Remove all this stuff.

import { createContext, runInContext } from "vm";
import { readFile as _readFile, writeFile as _writeFile } from "fs";
import { query } from "faunadb";
import { generate } from "escodegen";

/**
 * Wraps `fs.readFile` into a Promise.
 */
export function readFile(fileName) {
  return new Promise((resolve, reject) => {
    _readFile(fileName, "utf8", (err, data) => {
      // this lint is dumb
      // eslint-disable-next-line no-unused-expressions
      err ? reject(err) : resolve(data);
    });
  });
}

/**
 * Wraps `fs.writeFile` into a Promise.
 */
export function writeFile(fileName, data, mode) {
  return new Promise((resolve, reject) => {
    _writeFile(fileName, data, { mode: mode }, (err) => {
      // this lint is dumb
      // eslint-disable-next-line no-unused-expressions
      err ? reject(err) : resolve(data);
    });
  });
}

// adapted from https://hackernoon.com/functional-javascript-resolving-promises-sequentially-7aac18c4431e
function promiseSerial(fs) {
  return fs.reduce(
    (promise, f) =>
      promise.then((result) => f().then(Array.prototype.concat.bind(result))),
    Promise.resolve([])
  );
}

class QueryError extends Error {
  constructor(exp, faunaError, queryNumber, ...params) {
    super(params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, QueryError);
    }

    this.exp = exp;
    this.faunaError = faunaError;
    this.queryNumber = queryNumber;
  }
}

function wrapQueries(expressions, client) {
  const q = query;
  createContext(q);
  return expressions.map((exp, queryNumber) => () => {
    let query;
    try {
      query = runInContext(generate(exp), q);
    } catch (e) {
      return Promise.reject(e);
    }

    return client.query(query).catch((err) => {
      throw new QueryError(generate(exp), err, queryNumber + 1);
    });
  });
}

export async function runQueries(expressions, client) {
  if (expressions.length === 1) {
    var f = wrapQueries(expressions, client)[0];
    return f();
  } else {
    return promiseSerial(wrapQueries(expressions, client));
  }
}
