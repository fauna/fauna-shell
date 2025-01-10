import { createHash, randomBytes } from "crypto";
import http from "http";
import url from "url";
import util from "util";

import { container } from "../../config/container.mjs";
import { getDashboardUrl } from "../account-api.mjs";
import SuccessPage from "./successPage.mjs";

const ALLOWED_ORIGINS = [
  "http://localhost:3005",
  "http://127.0.0.1:3005",
  "http://dashboard.fauna.com",
  "http://dashboard.fauna-dev.com",
  "http://dashboard.fauna-preview.com",
];

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

  /**
   * Gets the OAuth parameters for the OAuth request.
   * @param {Object} [overrides] - The parameters for the OAuth request
   * @param {string} [overrides.clientId] - The client ID
   * @param {boolean} [overrides.noRedirect] - Whether to disable the redirect
   * @returns {Object} The OAuth parameters
   */
  getOAuthParams({ clientId, noRedirect }) {
    const redirectURI = noRedirect
      ? `${getDashboardUrl()}/auth/oauth/callback/cli`
      : `${REDIRECT_URI}:${this.port}`;

    return {
      /* eslint-disable camelcase */
      client_id: clientId ?? CLIENT_ID,
      redirect_uri: redirectURI,
      code_challenge: this.codeChallenge,
      code_challenge_method: "S256",
      response_type: "code",
      scope: "create_session",
      state: this.state,
      /* eslint-enable camelcase */
    };
  }

  /**
   * Gets the token parameters for the OAuth request.
   * @param {Object} [overrides] - The parameters for the OAuth request
   * @param {string} [overrides.clientId] - The client ID
   * @param {string} [overrides.clientSecret] - The client secret
   * @returns {Object} The token parameters
   */
  getTokenParams({ clientId, clientSecret }) {
    return {
      clientId: clientId ?? CLIENT_ID,
      clientSecret: clientSecret ?? CLIENT_SECRET,
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

  _handleRedirect({ pathname, res }) {
    if (pathname === "/success") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.write(SuccessPage);
      res.end();
      this.closeServer();
    } else if (pathname !== "/") {
      throw new Error("Invalid redirect uri");
    }
  }

  _handleCode({ authCode, state, res }) {
    this.validateAuthorizationCode(authCode, state);
    res.writeHead(302, { Location: "/success" });
    res.end();
    this.server.emit("auth_code_received");
  }

  // req: IncomingMessage, res: ServerResponse
  _handleRequest(req, res) {
    const logger = container.resolve("logger");
    const origin = req.headers.origin || "";

    if (ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    try {
      // We only expect GET requests
      if (req.method === "GET") {
        const { pathname, query } = url.parse(req.url || "", true);

        // If the pathname is not "/", we're handling a redirect
        if (pathname !== "/") {
          this._handleRedirect({ pathname, res });
        }

        // If the query contains an error, we're handling an error
        if (query.error) {
          throw new Error(
            `${query.error.toString()} - ${query.error_description}`,
          );
        }

        // If the query contains an auth code, we're handling a successful auth
        if (query.code) {
          this._handleCode({ authCode: query.code, state: query.state, res });
        }
      } else {
        throw new Error("Invalid request method");
      }
    } catch (e) {
      this.closeServer();
      logger.debug(
        `Authentication error: ${util.inspect(e, true, 2, false)}`,
        "creds",
      );
      logger.stderr(`Error during authentication: ${e.message}`);
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
