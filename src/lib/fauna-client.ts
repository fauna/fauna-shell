import { connect, constants } from "http2";

// Copied from the fauna-js driver:
// https://github.com/fauna/fauna-js/blob/main/src/http-client/node-http2-client.ts

export type QueryResponse<T> = QuerySuccess<T> | QueryFailure;

export type QueryInfo = {
  headers: any;
  body: {
    summary: string;
  };
};

export type QuerySuccess<T> = QueryInfo & {
  status: 200;
  body: {
    data: T;
  };
};

export type QueryFailure = QueryInfo & {
  status: 400;
  body: {
    error: {
      code: string;
      message?: string;
    };
  };
};

export default class FaunaClient {
  session: any;
  secret: string;
  timeout?: number;

  constructor(opts: { endpoint: string; secret: string; timeout?: number }) {
    this.session = connect(opts.endpoint, {
      peerMaxConcurrentStreams: 50,
    })
      .once("error", () => this.close())
      .once("goaway", () => this.close());
    this.secret = opts.secret;
    this.timeout = opts.timeout;
  }

  async query<T>(
    query: string,
    opts?: {
      format?: string;
      typecheck?: boolean;
      secret?: string;
    }
  ): Promise<QueryResponse<T>> {
    const { format, typecheck, secret } = {
      format: opts?.format ?? "simple",
      typecheck: opts?.typecheck ?? undefined,
      secret: opts?.secret ?? this.secret,
    };
    return new Promise((resolvePromise, rejectPromise) => {
      let req: any;
      const onResponse = (http2ResponseHeaders: any) => {
        const status = http2ResponseHeaders[constants.HTTP2_HEADER_STATUS];
        let responseData = "";

        req.on("data", (chunk: any) => {
          responseData += chunk;
        });

        req.on("end", () => {
          resolvePromise({
            status,
            body: JSON.parse(responseData),
            headers: http2ResponseHeaders,
          });
        });
      };

      try {
        const httpRequestHeaders = {
          Authorization: `Bearer ${secret}`,
          "x-format": format,
          "X-Fauna-Source": "Fauna Shell",
          [constants.HTTP2_HEADER_PATH]: "/query/1",
          [constants.HTTP2_HEADER_METHOD]: "POST",
          ...((typecheck && { "x-typecheck": typecheck }) ?? {}),
          ...((this.timeout && { "x-query-timeout-ms": this.timeout }) ?? {}),
        };

        req = this.session
          .request(httpRequestHeaders)
          .setEncoding("utf8")
          .on("error", (error: any) => rejectPromise(error))
          .on("response", onResponse);

        req.write(JSON.stringify({ query }), "utf8");

        // req.setTimeout must be called before req.end()
        req.setTimeout((this.timeout ?? 0) + 5000, () => {
          req.destroy(new Error(`Client timeout`));
        });

        req.end();
      } catch (error) {
        rejectPromise(error);
      }
    });
  }

  async close() {
    this.session.close();
  }
}
