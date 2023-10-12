export class Secret {
  // A fauna key, like `fn1234`.
  key: string;
  // A database scope, like `["foo", "bar"]`
  databaseScope: string[];

  constructor(opts: { key: string; databaseScope?: string[] }) {
    this.key = opts.key;
    this.databaseScope = opts.databaseScope ?? [];
  }

  static parse(key: string) {
    if (key.length === 0) {
      throw new Error("Secret cannot be empty");
    }
    if (key.includes(":")) {
      throw new Error("Secret cannot be scoped");
    }
    return new Secret({ key });
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
    this.databaseScope.push(...scope.split("/"));
    return this;
  }

  clone(): Secret {
    return new Secret({
      key: this.key,
      databaseScope: [...this.databaseScope],
    });
  }
}
