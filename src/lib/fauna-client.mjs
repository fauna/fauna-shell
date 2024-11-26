//@ts-check

// export type QueryResponse<T> = QuerySuccess<T> | QueryFailure;
import { container } from "../cli.mjs";
import { formatV10Error, formatV10QueryResponse, runV10QueryFromString } from "./fauna.mjs";
import { formatV4Error, formatV4QueryResponse, runV4QueryFromString } from "./faunadb.mjs";

// export type QuerySuccess<T> = {
//   status: 200;
//   body: {
//     summary?: string;
//     data: T;
//   };
// };

// export type QueryFailure = {
//   status: number;
//   body: {
//     summary?: string;
//     error: {
//       code: string;
//       message?: string;
//     };
//   };
// };

export default class FaunaClient {
  // : { endpoint: string; secret: string; timeout?: number }
  constructor(opts) {
    this.endpoint = opts.endpoint;
    this.secret = opts.secret;
    this.timeout = opts.timeout;
  }

  // query<T>(query: string, opts?: format?: string; typecheck?: boolean; secret?: string;
  // returns Promise<QueryResponse<T>>
  async query(query, opts) {
    const fetch = container.resolve("fetch");

    const { format, typecheck, secret } = {
      format: opts?.format ?? "simple",
      typecheck: opts?.typecheck ?? undefined,
      secret: opts?.secret ?? this.secret,
    };
    const url = new URL(this.endpoint);
    url.pathname = "/query/1";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret ?? this.secret}`,
        "x-fauna-source": "Fauna Shell",
        ...(typecheck !== undefined && {
          "x-typecheck": typecheck.toString(),
        }),
        ...(format !== undefined && { "x-format": format }),
        ...((this.timeout && {
          "x-query-timeout-ms": this.timeout.toString(10),
        }) ??
          {}),
      },
      body: JSON.stringify({ query }),
    });

    const json = await response.json();

    if (response.status === 200 || response.status === 201) {
      return {
        status: 200,
        body: json,
      };
    } else {
      return {
        status: response.status,
        body: {
          summary: json.summary,
          error: {
            code: json.error?.code,
            message: json.error?.message,
          },
        },
      };
    }
  }

  /**
   * We have two different clients, 1 for v10 and 1 for v4.  The v4 client requires closing
   * In order to allow commands to just close their client without having to worry about which
   * client they received, adding this noop method here.
   */
  // eslint-disable-next-line class-methods-use-this
  async close() {
    return undefined;
  }
}

export const runQueryFromString = (expression, argv) => {
  if (argv.apiVersion === "4") {
    const { secret, url, timeout } = argv;
    return runV4QueryFromString({ expression, secret, url, client: undefined, options: { timeout }});
  } else {
    const { secret, url, timeout,...rest } = argv;
    return runV10QueryFromString({ expression, secret, url, client: undefined, options: { query_timeout_ms: timeout, ...rest }});
  }
};  

export const formatError = (err, { apiVersion, extra }) => {
  if (apiVersion === "4") {
    return formatV4Error(err, { extra });
  } else {
    return formatV10Error(err, { extra }); 
  }
};

export const formatQueryResponse = (res, { apiVersion, extra, json }) => {
  if (apiVersion === "4") {
    return formatV4QueryResponse(res, { extra, json });
  } else {  
    return formatV10QueryResponse(res, { extra, json });
  }
};
