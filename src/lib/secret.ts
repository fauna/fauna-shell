export class Secret {
  // A fauna key, like `fn1234`.
  key: string;
  // Do we allow database scope?
  allowDatabase: boolean;
  // A database scope, like `["foo", "bar"]`
  databaseScope: string[];

  constructor(opts: {
    key: string;
    allowDatabase: boolean;
    databaseScope?: string[];
  }) {
    this.key = opts.key;
    this.allowDatabase = opts.allowDatabase;
    this.databaseScope = opts.databaseScope ?? [];
  }

  static parseFlag(key: string) {
    if (key.length === 0) {
      throw new Error("Secret cannot be empty");
    }
    return new Secret({ key, allowDatabase: !key.includes(":") });
  }

  static parse(key: string) {
    if (key.length === 0) {
      throw new Error("Secret cannot be empty");
    }
    if (key.includes(":")) {
      throw new Error("Secret cannot be scoped");
    }
    return new Secret({ key, allowDatabase: true });
  }

  buildSecret(opts?: { role?: string }): string {
    let secret = this.key;
    if (this.databaseScope.length > 0) {
      secret += `:${this.databaseScope.join("/")}`;
    }
    if (opts?.role !== undefined || this.databaseScope.length > 0) {
      const role = opts?.role ?? "admin";
      secret += ["admin", "client", "server", "server-readonly"].includes(role)
        ? `:${role}`
        : `:@role/${role}`;
    }
    return secret;
  }

  /**
   * Parses the given scope, appends it to the `Secret`, and returns the new
   * secret. This mutates `this`.
   */
  appendScope(scope: string) {
    if (this.allowDatabase) {
      this.databaseScope.push(...scope.split("/"));
      return this;
    } else {
      throw new Error(
        "Cannot specify database with a secret that contains a database"
      );
    }
  }

  clone(): Secret {
    return new Secret({
      key: this.key,
      allowDatabase: this.allowDatabase,
      databaseScope: [...this.databaseScope],
    });
  }
}
