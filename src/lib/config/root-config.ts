import fs from "fs";
import { Config, EndpointConfig, InvalidConfigError } from ".";
import { Secret } from "../secret";
const ini = require("ini");

// Represents `~/.fauna-shell`
export class RootConfig {
  defaultEndpoint?: string;
  endpoints: { [key: string]: Endpoint };
  invalidEndpoints: string[];

  constructor(config: Config) {
    this.defaultEndpoint = config.strOpt("default");

    /**
     * Our updated config uses endpoint.<name> to reserve the endpoint namespace.
     * It is possible prior users still have legacy config that has the endpoints at the top level.
     * When config is updated, we will write the entire file, so it will either
     * all be nested under endpoint or all legacy. The only time this wouldn't be
     * the case is if a user manually modifies their file to have a top level
     * endpoint after we have nested them all under endpoint.  In that scenario,
     * the added endpoint will not be recognized.
     */
    if (RootConfig.configContainsNestedEndpointStructure(config)) {
      this.endpoints = Object.fromEntries<Endpoint>(
        config
          .objectsIn("endpoint")
          .filter(([k, v]) => Endpoint.fromConfig(k, v) !== undefined)
          .map(([k, v]) => [k, Endpoint.fromConfig(k, v)!])
      );
      this.invalidEndpoints = config
        .objectsIn("endpoint")
        .filter(([k, v]) => Endpoint.fromConfig(k, v) === undefined)
        .map(([k, _]) => k);
    } else {
      this.endpoints = Object.fromEntries<Endpoint>(
        config
          .allObjectsWhere((k) => k !== "default")
          .filter(([k, v]) => Endpoint.fromConfig(k, v) !== undefined)
          .map(([k, v]) => [k, Endpoint.fromConfig(k, v)!])
      );
      this.invalidEndpoints = config
        .allObjectsWhere((k) => k !== "default")
        .filter(([k, v]) => Endpoint.fromConfig(k, v) === undefined)
        .map(([k, _]) => k);
    }

    if (this.defaultEndpoint === "default") {
      throw new InvalidConfigError(
        "Default endpoint cannot be named 'default'"
      );
    }
  }

  isEmpty(): boolean {
    return Object.keys(this.endpoints).length === 0;
  }

  /**
   * If there is an endpoint object in the config, and it has a
   * object underneath it, we are saying that it uses the
   *
   * [endpoint.myacct]
   * secret=***
   *
   * structure. This allows us to support a legacy config that has
   * a top level endpoint named endpoint.  Once we rewrite the config
   * to be endpoint object based adding one manually like that
   * will not be recognized.
   */
  private static configContainsNestedEndpointStructure(
    config: Config
  ): boolean {
    if (config.objectExists("endpoint")) {
      const endpointObj = config.object("endpoint");
      return endpointObj.keys().some((key) => {
        return endpointObj.objectExists(key);
      });
    } else {
      return false;
    }
  }

  save(path: string) {
    const config = this.toIni();

    const encoded = ini.encode(config);
    fs.writeFileSync(path, encoded, {
      mode: 0o600,
    });
  }

  toIni() {
    return {
      ...(this.defaultEndpoint !== undefined
        ? { default: this.defaultEndpoint }
        : {}),
      endpoint: Object.fromEntries(
        Object.entries(this.endpoints).map(([k, v]) => [k, v.toIni()])
      ),
    };
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
  name?: string;
  secret: Secret;
  url: string;

  graphqlHost: string;
  graphqlPort: number;

  static fromConfig(name: string, config: Config): Endpoint | undefined {
    const secOpt = config.strOpt("secret");
    if (secOpt === undefined) {
      return undefined;
    } else {
      return new Endpoint({
        name: name,
        secret: Secret.parse(secOpt),
        url: Endpoint.getURLFromConfig(config),

        graphqlHost: config.strOpt("graphqlHost"),
        graphqlPort: config.numberOpt("graphqlPort"),
      });
    }
  }

  constructor(opts: {
    name?: string;
    secret: Secret;
    url?: string;
    graphqlHost?: string;
    graphqlPort?: number;
  }) {
    this.name = opts.name;
    this.secret = opts.secret;
    this.url = opts.url ?? "https://db.fauna.com";

    this.graphqlHost = opts.graphqlHost ?? "graphql.fauna.com";
    this.graphqlPort = opts.graphqlPort ?? 443;
  }

  makeScopedEndpoint(databaseScope?: string[]): EndpointConfig {
    const secret = this.secret.clone();
    if (databaseScope !== undefined) {
      secret.databaseScope.push(...databaseScope);
    }

    return {
      secret,
      name: this.name,
      url: this.url,
      graphqlHost: this.graphqlHost,
      graphqlPort: this.graphqlPort,
    };
  }

  /**
   * Gets a database URL from config.
   */
  static getURLFromConfig = (config: Config): string | undefined => {
    return this.getURL({
      url: config.strOpt("url"),
      scheme: config.strOpt("scheme"),
      domain: config.strOpt("domain"),
      port: config.numberOpt("port"),
    });
  };

  /**
   * Gets a database URL from command line flags.
   *
   * Note: this is the same as `getURLFromConfig`. Its left different so that
   * we can change flags later, without breaking config parsing.
   */
  static getURLFromFlags = (flags: Config): string | undefined => {
    return this.getURL({
      url: flags.strOpt("url"),
      scheme: flags.strOpt("scheme"),
      domain: flags.strOpt("domain"),
      port: flags.numberOpt("port"),
    });
  };

  static getURL = (opts: {
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

  toIni() {
    return {
      secret: this.secret.key,
      ...(this.url !== "https://db.fauna.com" ? { url: this.url } : {}),

      ...(this.graphqlHost !== "graphql.fauna.com"
        ? { graphqlHost: this.graphqlHost }
        : {}),
      ...(this.graphqlPort !== 443 ? { graphqlPort: this.graphqlPort } : {}),
    };
  }
}
