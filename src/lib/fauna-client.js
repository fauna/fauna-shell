const http2 = require("http2");

// Copied from the fauna-js driver:
// https://github.com/fauna/fauna-js/blob/main/src/http-client/node-http2-client.ts

module.exports = class FaunaClient {
  constructor(endpoint, secret, timeout) {
    this.session = http2
      .connect(endpoint, {
        peerMaxConcurrentStreams: 50,
      })
      .once("error", () => this.close())
      .once("goaway", () => this.close());
    this.secret = secret;
    this.timeout = timeout;
  }

  async query(query, format = "simple", typecheck = undefined) {
    return new Promise((resolvePromise, rejectPromise) => {
      let req;
      const onResponse = (http2ResponseHeaders) => {
        const status =
          http2ResponseHeaders[http2.constants.HTTP2_HEADER_STATUS];
        let responseData = "";

        req.on("data", (chunk) => {
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
          Authorization: `Bearer ${this.secret}`,
          "x-format": format,
          "X-Fauna-Source": "Fauna Shell",
          [http2.constants.HTTP2_HEADER_PATH]: "/query/1",
          [http2.constants.HTTP2_HEADER_METHOD]: "POST",
          ...(typecheck && { "x-typecheck": typecheck }),
          ...(this.timeout && { "x-query-timeout-ms": this.timeout }),
        };

        req = this.session
          .request(httpRequestHeaders)
          .setEncoding("utf8")
          .on("error", (error) => rejectPromise(error))
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
};
