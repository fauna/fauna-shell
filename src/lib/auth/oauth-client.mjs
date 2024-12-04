import { createHash, randomBytes } from "crypto";
import http from "http";
import url from "url";

import { container } from "../../cli.mjs";

// Default to prod client id and secret
const clientId = process.env.FAUNA_CLIENT_ID ?? "-_vEB3FKRoWbJdFpMg72Mx0UVAA";
// Native public clients are not confidential. The client secret is not used beyond
//   client identification. https://datatracker.ietf.org/doc/html/rfc8252#section-8.5
const clientSecret =
  process.env.FAUNA_CLIENT_SECRET ??
  "CGNriRe8uZakmOL6yfhuSZJ_-15Tio4ueM3whw0O38fXLb2829PHCA";
const REDIRECT_URI = `http://127.0.0.1`;

class OAuthClient {
  constructor() {
    this.server = http.createServer(this._handleRequest.bind(this));
    this.codeVerifier = Buffer.from(randomBytes(20)).toString("base64url");
    this.codeChallenge = createHash("sha256")
      .update(this.codeVerifier)
      .digest("base64url");
    this.port = 0;
    this.authCode = "";
    this.state = OAuthClient._generateCSRFToken();
  }

  getOAuthParams() {
    return {
      client_id: clientId, // eslint-disable-line camelcase
      redirect_uri: `${REDIRECT_URI}:${this.port}`, // eslint-disable-line camelcase
      code_challenge: this.codeChallenge, // eslint-disable-line camelcase
      code_challenge_method: "S256", // eslint-disable-line camelcase
      response_type: "code", // eslint-disable-line camelcase
      scope: "create_session",
      state: this.state,
    };
  }

  getTokenParams() {
    return {
      clientId,
      clientSecret,
      authCode: this.authCode,
      redirectURI: `${REDIRECT_URI}:${this.port}`,
      codeVerifier: this.codeVerifier,
    };
  }

  static _generateCSRFToken() {
    return Buffer.from(randomBytes(20)).toString("base64url");
  }

  // req: IncomingMessage, res: ServerResponse
  // eslint-disable-next-line complexity
  _handleRequest(req, res) {
    const logger = container.resolve("logger");
    const allowedOrigins = [
      "http://localhost:3005",
      "http://127.0.0.1:3005",
      "http://dashboard.fauna.com",
      "http://dashboard.fauna-dev.com",
      "http://dashboard.fauna-preview.com",
    ];
    const origin = req.headers.origin || "";

    if (allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    let errorMessage = "";

    if (req.method === "GET") {
      const parsedUrl = url.parse(req.url || "", true);
      if (parsedUrl.pathname === "/success") {
        res.write(`
          <body>
            <h1>Success</h1>
            <p>Authentication successful. You can close this window and return to the terminal.</p>
          </body>
        `);
        res.end();
        this.closeServer();
      } else if (parsedUrl.pathname !== "/") {
        errorMessage = "Invalid redirect uri";
        this.closeServer();
      }
      const query = parsedUrl.query;
      if (query.error) {
        errorMessage = `${query.error.toString()} - ${query.error_description}`;
        this.closeServer();
      }
      if (query.code) {
        const authCode = query.code;
        if (!authCode || typeof authCode !== "string") {
          errorMessage = "Invalid authorization code received";
          this.server.close();
        } else {
          this.authCode = authCode;
          if (query.state !== this.state) {
            errorMessage = "Invalid state received";
            this.closeServer();
          }
          res.writeHead(302, { Location: "/success" });
          res.end();
          this.server.emit("auth_code_received");
        }
      }
    } else {
      errorMessage = "Invalid request method";
      this.closeServer();
    }
    if (errorMessage) {
      logger.stderr(`Error during authentication: ${errorMessage}`);
    }
  }

  async start() {
    const logger = container.resolve("logger");
    try {
      if (!this.server.listening) {
        this.server.on("listening", () => {
          this.port = this.server.address().port;
          this.server.emit("ready");
        });
        this.server.listen(0);
      }
    } catch (e) {
      logger.stderr(`Error starting loopback server: ${e.message}`);
    }
  }

  closeServer() {
    this.server.closeAllConnections();
    this.server.close();
  }
}

export default OAuthClient;
