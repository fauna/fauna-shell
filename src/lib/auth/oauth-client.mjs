import { createHash, randomBytes } from "crypto";
import http from "http";
import url from "url";

import { container } from "../../cli.mjs";
import { getDashboardUrl } from "../account.mjs";
import SuccessPage from "./successPage.mjs";

// Default to prod client id and secret
const CLIENT_ID = process.env.FAUNA_CLIENT_ID ?? "Aq4_G0mOtm_F1fK3PuzE0k-i9F0";
// Native public clients are not confidential. The client secret is not used beyond
//   client identification. https://datatracker.ietf.org/doc/html/rfc8252#section-8.5
const CLIENT_SECRET =
  process.env.FAUNA_CLIENT_SECRET ??
  "2W9eZYlyN5XwnpvaP3AwOfclrtAjTXncH6k-bdFq1ZV0hZMFPzRIfg";
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

  getOAuthParams(noRedirect) {
    const redirectURI = noRedirect
      ? `${getDashboardUrl()}/auth/oauth/callback/cli`
      : `${REDIRECT_URI}:${this.port}`;
    return {
      client_id: CLIENT_ID, // eslint-disable-line camelcase
      //`${REDIRECT_URI}:${this.port}`,
      redirect_uri: redirectURI, // eslint-disable-line camelcase
      code_challenge: this.codeChallenge, // eslint-disable-line camelcase
      code_challenge_method: "S256", // eslint-disable-line camelcase
      response_type: "code", // eslint-disable-line camelcase
      scope: "create_session",
      state: this.state,
    };
  }

  getTokenParams() {
    return {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      authCode: this.authCode,
      redirectURI: `${REDIRECT_URI}:${this.port}`,
      codeVerifier: this.codeVerifier,
    };
  }

  validateAuthorizationCode(authCode, state) {
    if (!authCode || typeof authCode !== "string") {
      throw new Error("Invalid authorization code received");
    } else {
      this.authCode = authCode;
      if (state !== this.state) {
        throw new Error("Invalid state received");
      }
    }
  }

  static _generateCSRFToken() {
    return Buffer.from(randomBytes(20)).toString("base64url");
  }

  // req: IncomingMessage, res: ServerResponse
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
        res.writeHead(200, { "Content-Type": "text/html" });
        res.write(SuccessPage);
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
        try {
          this.validateAuthorizationCode(authCode, query.state);
          res.writeHead(302, { Location: "/success" });
          res.end();
          this.server.emit("auth_code_received");
        } catch (e) {
          errorMessage = e.message;
          this.closeServer();
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
    if (this.server.listening) {
      this.server.closeAllConnections();
      this.server.close();
    }
  }
}

export default OAuthClient;
