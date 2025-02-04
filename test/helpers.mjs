//@ts-check

import { join } from "node:path";
import { Writable } from "node:stream";

import sinon from "sinon";

// small helper for sinon to wrap your return value
// in the shape fetch would return it from the network
export function f(returnValue, status, headers) {
  return new Response(JSON.stringify(returnValue), {
    status: status || 200,
    headers: {
      "Content-type": "application/json",
      ...headers,
    },
  });
}

export const commonFetchParams = {
  method: "GET",
  headers: {
    AUTHORIZATION: "Bearer secret",
  },
};

/**
 * this method sorts the query parameters - since makeFaunaRequest does as well,
 * this allows comparing the resulting string URLs without false negatives
 * from different sorting strategies.
 *
 * @param {string} path - the path to build a URL for
 * @param {Record<string, string>} [paramObject] - the params to include in the querystring
 */
export function buildUrl(path, paramObject) {
  const params = new URLSearchParams(paramObject);
  params.sort();
  let result = "db.fauna.com";
  if (path) result = join(result, path);
  if (params.size) result = `${result}?${params}`;
  return `https://${result}`;
}

export function logStringBytes(str1, str2) {
  let max = Math.max(str1.length, str2.length);
  for (let i = 0; i < max; i++) {
    const charCode1 = str1.charCodeAt(i);
    const charCode2 = str2.charCodeAt(i);
    // eslint-disable-next-line no-console
    console.log(`Byte ${i}: ${charCode1}, ${charCode2}`);
  }
}

/**
 * for use when non-printing characters cause test comparisons to fail. use like:
 *
 * logDifferentStringBytes(
 * container.resolve("stdoutStream").getWritten(),
 * `Type Ctrl+D or .exit to exit the shell${prompt}Database.all()\r${EOL}${stringifiedObj}${prompt}`,
 * );
 */
export function logDifferentStringBytes(str1, str2, stringRepr = false) {
  let max = Math.max(str1.length, str2.length);
  for (let i = 0; i < max; i++) {
    const charCode1 = str1.charCodeAt(i);
    const charCode2 = str2.charCodeAt(i);
    if (charCode1 !== charCode2) {
      if (stringRepr) {
        // eslint-disable-next-line no-console
        console.log(`Byte ${i}: ${str1[i]}, ${str2[i]}`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`Byte ${i}: ${charCode1}, ${charCode2}`);
      }
    }
  }
}

/**
 * Class representing a no-frills writable stream that, instead of writing data
 * to a destination, holds it in memory. Can be queried for this data later;
 * use it for testing interfaces that use streams.
 */
export class InMemoryWritableStream extends Writable {
  /**
   * Create an in-memory writable stream.
   */
  constructor() {
    super();
    this.written = "";
  }

  _write(chunk, encoding, callback) {
    try {
      this.written += chunk.toString("utf8");
      callback();
    } catch (e) {
      callback(e);
    }
  }

  async waitForWritten() {
    function recurse(cb) {
      if (this.written.length > 0 && this.writableLength === 0) {
        cb();
      } else {
        setTimeout(recurse.bind(this, cb), 100);
      }
    }

    return new Promise((resolve) => {
      recurse.bind(this, resolve)();
    });
  }

  getWritten(clear = false) {
    let written = this.written;
    if (clear) this.clear();
    return written;
  }

  clear() {
    this.written = "";
  }
}

export const createV10QuerySuccess = (data) => {
  return {
    data: data,
    static_type: "Test",
    summary: "",
    txn_ts: 1732664445755210,
    stats: {
      compute_ops: 1,
      read_ops: 9,
      write_ops: 0,
      query_time_ms: 15,
      contention_retries: 0,
      storage_bytes_read: 510,
      storage_bytes_write: 0,
      rate_limits_hit: [],
      attempts: 1,
    },
    schema_version: 0,
  };
};

export const createV10QueryFailure = (summary) => {
  return {
    error: {
      code: "test_error",
      message: "test error",
    },
    httpStatus: 400,
    summary,
    txn_ts: 1732664445755210,
    stats: {
      compute_ops: 1,
      read_ops: 9,
      write_ops: 0,
      query_time_ms: 15,
      contention_retries: 0,
      storage_bytes_read: 510,
      storage_bytes_write: 0,
      rate_limits_hit: [],
      attempts: 1,
    },
  };
};

export const createV4QuerySuccess = (data) => ({
  value: data,
  metrics: {
    "x-byte-read-ops": 0,
    "x-byte-write-ops": 0,
    "x-compute-ops": 0,
    "x-query-time": 0,
    "x-txn-retries": 0,
  },
});

export const createV4QueryFailure = (error) => ({
  requestResult: {
    responseRaw: JSON.stringify({
      errors: [error],
    }),
    responseContent: { errors: [error] },
    statusCode: 400,
    responseHeaders: {
      "x-byte-read-ops": 0,
      "x-byte-write-ops": 0,
      "x-compute-ops": 0,
      "x-query-time": 0,
      "x-txn-retries": 0,
    },
    method: "POST",
    path: "/",
    query: "",
    requestRaw: "",
  },
});

export const mockAccessKeysFile = ({
  fs,
  accountKey = "account-key",
  refreshToken = "refresh-token",
}) => {
  fs.readFileSync
    .withArgs(sinon.match(/access_keys/))
    .returns(
      `{"default": { "accountKey": "${accountKey}", "refreshToken": "${refreshToken}"}}`,
    );
};

export const mockSecretKeysFile = ({
  fs,
  accountKey = "account-key",
  path = "us-std",
  role = "admin",
  secret = "secret",
  expiresAt = Date.now() + 1000 * 60 * 60 * 24,
}) => {
  fs.readFileSync
    .withArgs(sinon.match(/secret_keys/))
    .returns(
      `{${accountKey}: { "${path}:${role}": {"secret": "${secret}", "expiresAt": ${expiresAt}}}}`,
    );
};

/**
 * retry an assertion repeatedly until it succeeds
 * @param {function} evaluator - any function that throws if a condition isn't met.
 * @param {number} [ms=50] - the number of milliseconds to wait for the condition. set it lower than mocha's timeout to re-throw the underlying error and have usable test failure logs.
 */
export async function eventually(evaluator, ms = 50) {
  try {
    return evaluator();
  } catch (e) {
    if (ms <= 0) throw e;
    await new Promise((resolve) => setTimeout(resolve, 1)); // eslint-disable-line no-promise-executor-return
    return eventually(evaluator, ms - 1);
  }
}
