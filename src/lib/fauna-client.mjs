//@ts-check

// export type QueryResponse<T> = QuerySuccess<T> | QueryFailure;
import https from "node:https";

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
    const { format, typecheck, secret } = {
      format: opts?.format ?? "simple",
      typecheck: opts?.typecheck ?? undefined,
      secret: opts?.secret ?? this.secret,
    };
    const url = new URL(this.endpoint);
    url.pathname = "/query/1";
    // const res = await fetch(url, {
    //   method: "POST",
    //   headers: {
    //     authorization: `Bearer ${secret ?? this.secret}`,
    //     "x-fauna-source": "Fauna Shell",
    //     ...(typecheck !== undefined && { "x-typecheck": typecheck.toString() }),
    //     ...(format !== undefined && { "x-format": format }),
    //     ...((this.timeout && {
    //       "x-query-timeout-ms": this.timeout.toString(10),
    //     }) ??
    //       {}),
    //   },
    //   body: JSON.stringify({ query }),
    // });

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: "/query/1",
      method: "POST",
      headers: {
        authorization: `Bearer ${secret ?? this.secret}`,
        "x-fauna-source": "Fauna Shell",
        ...(typecheck !== undefined && { "x-typecheck": typecheck.toString() }),
        ...(format !== undefined && { "x-format": format }),
        ...((this.timeout && {
          "x-query-timeout-ms": this.timeout.toString(10),
        }) ??
          {}),
      },
    };

    let response = await new Promise((resolve, reject) => {
      let responseString = "";

      const req = https.request(options, (res) => {
        res.on("data", (d) => {
          responseString += d;
        });
        res.on("end", () =>
          resolve({ status: res.statusCode, body: responseString })
        );
      });

      req.on("error", (e) => reject(e));
      req.write(JSON.stringify({ query }));
      req.end();
    });

    // const json = await res.json();
    console.log(response.body);
    const json = JSON.parse(response.body);

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
  async close() {
    return undefined;
  }
}
