import { createHash, randomBytes } from "crypto";
import http from "http";
import url from "url";

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
    this.state = this._generateCSRFToken();
  }

  getOAuthParams() {
    return {
      clientId: clientId,
      redirectUri: `${REDIRECT_URI}:${this.port}`,
      codeChallenge: this.codeChallenge,
      codeChallengeMethod: "S256",
      responseType: "code",
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
  _handleRequest(req, res) {
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
      // eslint-disable-next-line no-console
      console.error("Error during authentication:", errorMessage);
    }
  }

  async start() {
    try {
      if (!this.server.listening) {
        this.server.on("listening", () => {
          this.port = this.server.address().port;
          this.server.emit("ready");
        });
        this.server.listen(0);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Error starting loopback server:", e.message);
    }
  }

  closeServer() {
    this.server.closeAllConnections();
    this.server.close();
  }
}

export default OAuthClient;
