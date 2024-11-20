//@ts-check

import { join } from "node:path";
import { Writable } from "node:stream";

// small helper for sinon to wrap your return value
// in the shape fetch would return it from the network
export function f(returnValue, status) {
  return { json: async () => returnValue, status: status || 200 };
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
