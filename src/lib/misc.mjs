import { createContext, runInContext } from "node:vm";
import util from "node:util";

export async function runQuery(expression, client) {
  const faunadb = (await import("faunadb")).default;
  const wireReadyQuery = runInContext(expression, createContext(faunadb.query));
  try {
    return client.query(wireReadyQuery);
  } catch (err) {
    err.message = util.inspect(JSON.parse(err.requestResult.responseRaw), {
      depth: null,
      compact: false,
    });

    throw err;
  }
}

export class InvalidCredsError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidCredsError";
    this.status = 401;
  }
}

export class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnauthorizedError";
    this.status = 403;
  }
}
