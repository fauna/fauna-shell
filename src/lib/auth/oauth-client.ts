import http, { IncomingMessage, ServerResponse } from "http";
const { randomBytes, createHash } = require("node:crypto");
import url from "url";
import net from "net";

// env var
const dashboardURL = "http://localhost:3005/authorize/complete";
// env var
const frontdoorURL = "http://localhost:8000/api/v1/oauth";
// env var
const clientId = "Gj6wAqni5MS0U72qfcGjh9pS8+U=";
const clientSecret = "5kXhq2MrHLPF4iV5aPC5PRnGrCNhnRUsV6C8gtlj8PtkIJINR5Je2A==";
const redirectUri = `http://127.0.0.1`;

class OAuthClient {
  public server: http.Server;
  public port: number;
  private code_verifier: string;
  private code_challenge: string;
  private auth_code: string;
  public state: string;

  constructor() {
    this.server = http.createServer(this.handleRequest.bind(this));
    this.code_verifier = Buffer.from(randomBytes(20)).toString("base64url");
    this.code_challenge = createHash("sha256")
      .update(this.code_verifier)
      .digest("base64url");
    this.port = 0;
    this.auth_code = "";
    this.state = this.generateCSRFToken();
  }

  private generateCSRFToken(): string {
    return Buffer.from(randomBytes(20)).toString("base64url");
  }

  public getRequestUrl() {
    const params = {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${redirectUri}:${this.port}`,
      code_challenge: this.code_challenge,
      code_challenge_method: "S256",
      response_type: "code",
      scope: "create_session",
      state: this.state,
    };
    return `${frontdoorURL}/authorize?${new URLSearchParams(params)}`;
  }

  public getToken() {
    const params = {
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: this.auth_code,
      redirect_uri: `${redirectUri}:${this.port}`,
      code_verifier: this.code_verifier,
      ttl: "2024-09-17T00:00:00.00Z",
    };
    return fetch(`${frontdoorURL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse) {
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

    if (req.method === "GET") {
      const parsedUrl = url.parse(req.url || "", true);
      if (parsedUrl.pathname !== "/") {
        console.error("Error while retrieving authorization code! Try again.");
        this.closeServer();
      }
      const query = parsedUrl.query;
      if (query.error) {
        console.error("Error returned from server:", query.error);
        this.closeServer();
      }
      if (query.code) {
        const authCode = query.code;
        if (!authCode || typeof authCode !== "string") {
          console.error("Invalid authorization code returned from server");
          this.server.close();
        } else {
          this.auth_code = authCode;
          if (query.state !== this.state) {
            console.error("Invalid state returned from server");
            this.closeServer();
          }
          // Send them to a nice page that shows auth is complete and they can close the window.
          res.writeHead(301, { Location: dashboardURL });
          res.end();
          this.server.emit("auth_code_received");
          this.closeServer();
        }
      }
    } else {
      console.error("Error while retrieving authorization code! Try again.");
      this.closeServer();
    }
  }

  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const tester = net
        .createServer()
        .once("error", (err: any) =>
          err.code === "EADDRINUSE" ? resolve(false) : reject(err)
        )
        .once("listening", () =>
          tester.once("close", () => resolve(true)).close()
        )
        .listen(port);
    });
  }

  public async start() {
    let port: number;
    let isAvailable: boolean = false;

    // Loop until an available port is found
    do {
      port = Math.floor(Math.random() * (63000 - 62500 + 1)) + 62500;
      isAvailable = await this.isPortAvailable(port);
    } while (!isAvailable);

    this.port = port;

    this.server.listen(port, () => {
      // console.log(`Server is listening on port ${port}`);
    });

    return { server: this.server, port };
  }

  public closeServer() {
    this.server.closeAllConnections();
    this.server.close();
  }
}

export default OAuthClient;
