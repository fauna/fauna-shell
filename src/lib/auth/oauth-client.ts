import http, { IncomingMessage, ServerResponse } from "http";
const { randomBytes, createHash } = require("node:crypto");
import url from "url";
import net, { AddressInfo } from "net";

const accountURL = process.env.FAUNA_ACCOUNT_URL ?? "https://account.fauna.com";

// Default to prod client id and secret
const clientId = process.env.FAUNA_CLIENT_ID ?? "Aq4_G0mOtm_F1fK3PuzE0k-i9F0";
// Native public clients are not confidential. The client secret is not used beyond
//   client identification. https://datatracker.ietf.org/doc/html/rfc8252#section-8.5
const clientSecret =
  process.env.FAUNA_CLIENT_SECRET ??
  "2W9eZYlyN5XwnpvaP3AwOfclrtAjTXncH6k-bdFq1ZV0hZMFPzRIfg";
const REDIRECT_URI = `http://127.0.0.1`;

class OAuthClient {
  public server: http.Server;
  public port: number;
  private code_verifier: string;
  private code_challenge: string;
  private auth_code: string;
  public state: string;

  constructor() {
    this.server = http.createServer(this._handleRequest.bind(this));
    this.code_verifier = Buffer.from(randomBytes(20)).toString("base64url");
    this.code_challenge = createHash("sha256")
      .update(this.code_verifier)
      .digest("base64url");
    this.port = 0;
    this.auth_code = "";
    this.state = this._generateCSRFToken();
  }

  public getRequestUrl() {
    const params = {
      client_id: clientId,
      redirect_uri: `${REDIRECT_URI}:${this.port}`,
      code_challenge: this.code_challenge,
      code_challenge_method: "S256",
      response_type: "code",
      scope: "create_session",
      state: this.state,
    };
    return `${accountURL}/api/v1/oauth/authorize?${new URLSearchParams(
      params
    )}`;
  }

  public getToken() {
    const now = new Date();
    // Short expiry for access token as it's only used to create a session
    now.setUTCMinutes(now.getUTCMinutes() + 5);
    const params = {
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: this.auth_code,
      redirect_uri: `${REDIRECT_URI}:${this.port}`,
      code_verifier: this.code_verifier,
      ttl: now.toISOString(),
    };
    return fetch(`${accountURL}/api/v1/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });
  }

  private _generateCSRFToken(): string {
    return Buffer.from(randomBytes(20)).toString("base64url");
  }

  private _handleRequest(req: IncomingMessage, res: ServerResponse) {
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
      if (parsedUrl.pathname !== "/") {
        errorMessage = "Invalid redirect uri";
        this.closeServer();
      }
      const query = parsedUrl.query;
      if (query.error) {
        errorMessage = query.error.toString();
        this.closeServer();
      }
      if (query.code) {
        const authCode = query.code;
        if (!authCode || typeof authCode !== "string") {
          errorMessage = "Invalid authorization code received";
          this.server.close();
        } else {
          this.auth_code = authCode;
          if (query.state !== this.state) {
            errorMessage = "Invalid state received";
            this.closeServer();
          }
          // TODO: Send them to a nice page that shows auth is complete and they can close the window.
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end();
          this.server.emit("auth_code_received");
          this.closeServer();
        }
      }
    } else {
      errorMessage = "Invalid request method";
      this.closeServer();
    }
    if (errorMessage) {
      console.error("Error during authentication:", errorMessage);
    }
  }

  private _getFreePort(): Promise<number> {
    return new Promise((res, rej) => {
      const srv = net.createServer();
      srv.listen(0, () => {
        const port = srv.address() as AddressInfo;
        srv.close((err) => {
          if (err) rej(err);
          res(port.port);
        });
      });
    });
  }

  public async start() {
    try {
      this.port = await this._getFreePort();
      this.server.listen(this.port);
    } catch (e: any) {
      console.error("Error starting loopback server:", e.message);
    }
  }

  public closeServer() {
    this.server.closeAllConnections();
    this.server.close();
  }
}

export default OAuthClient;
