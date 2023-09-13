import { Config, InvalidConfigError } from ".";

// Represents `~/.fauna-shell`
export class RootConfig {
  defaultEndpoint?: string;
  endpoints: { [key: string]: Endpoint };

  constructor(config: Config) {
    this.defaultEndpoint = config.strOpt("default");
    this.endpoints = Object.fromEntries(
      config
        .allObjectsWhere((k) => k !== "default")
        .map(([k, v]) => [k, Endpoint.fromConfig(v)])
    );

    if (this.defaultEndpoint === "default") {
      throw new InvalidConfigError(
        "Default endpoint cannot be named 'default'"
      );
    } else if (
      this.defaultEndpoint &&
      this.endpoints[this.defaultEndpoint] === undefined
    ) {
      throw new InvalidConfigError(
        `Default endpoint '${this.defaultEndpoint}' was not found`
      );
    }
  }
}

/**
 * Represents an endpoint, or a section of `~/.fauna-shell`.
 *
 * An endpoint contains:
 * - A secret. This is the accout secret for this database.
 * - An optional URL. This is the URL of the database. It defaults to `https://db.fauna.com`.
 * - An optional GraphQL host. This is the host to use for GraphQL requests. It defaults to `graphql.fauna.com`.
 * - An optional GraphQL port. This is the port to use for GraphQL requests. It defaults to `443`.
 */
export class Endpoint {
  secret: string;
  url: string;

  graphqlHost: string;
  graphqlPort: number;

  static fromConfig(config: Config) {
    return new Endpoint({
      secret: config.str("secret"),
      url: Endpoint.getURLFromConfig(config),

      graphqlHost: config.strOpt("graphqlHost"),
      graphqlPort: config.numberOpt("graphqlPort"),
    });
  }

  constructor(opts: {
    secret: string;
    url?: string;
    graphqlHost?: string;
    graphqlPort?: number;
  }) {
    this.secret = opts.secret;
    this.url = opts.url ?? "https://db.fauna.com";

    this.graphqlHost = opts.graphqlHost ?? "graphql.fauna.com";
    this.graphqlPort = opts.graphqlPort ?? 443;
  }

  makeScopedEndpoint(
    scope?: string,
    role?: string
  ): {
    secret: string;
    url: string;
    graphqlHost: string;
    graphqlPort: number;
  } {
    const secret =
      this.secret + (scope ? `:${scope}` : "") + ":" + (role ?? "admin");

    return {
      secret,
      url: this.url,
      graphqlHost: this.graphqlHost,
      graphqlPort: this.graphqlPort,
    };
  }

  static getURLFromConfig = (config: Config): string | undefined => {
    const url = config.strOpt("url");
    const scheme = config.strOpt("scheme");
    const domain = config.strOpt("domain");
    const port = config.numberOpt("port");

    if (
      url === undefined &&
      (domain !== undefined || port !== undefined || scheme !== undefined)
    ) {
      const scheme0 = scheme ?? "https";
      const domain0 = domain ?? "db.fauna.com";
      const port0 = port ? `:${port}` : "";
      return `${scheme0}://${domain0}${port0}`;
    } else {
      return url;
    }
  };
}
