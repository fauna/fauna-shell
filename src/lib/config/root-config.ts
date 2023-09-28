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
      this.secret + (scope ? `:${scope}` : "") + (role ? `:${role}` : "");

    return {
      secret,
      url: this.url,
      graphqlHost: this.graphqlHost,
      graphqlPort: this.graphqlPort,
    };
  }

  static getURLFromConfig = (config: Config): string | undefined => {
    return this.getURLInner({
      url: config.strOpt("url"),
      scheme: config.strOpt("scheme"),
      domain: config.strOpt("domain"),
      port: config.numberOpt("port"),
    });
  };

  static getURLFromFlags = (flags: Config): string | undefined => {
    return this.getURLInner({
      url: flags.strOpt("endpointURL"),
      scheme: flags.strOpt("scheme"),
      domain: flags.strOpt("domain"),
      port: flags.numberOpt("port"),
    });
  };

  static getURLInner = (opts: {
    url?: string;
    scheme?: string;
    domain?: string;
    port?: number;
  }): string | undefined => {
    if (
      opts.url === undefined &&
      (opts.domain !== undefined ||
        opts.port !== undefined ||
        opts.scheme !== undefined)
    ) {
      const scheme = opts.scheme ?? "https";
      const domain = opts.domain ?? "db.fauna.com";
      const port = opts.port ? `:${opts.port}` : "";
      return `${scheme}://${domain}${port}`;
    } else {
      return opts.url;
    }
  };
}
