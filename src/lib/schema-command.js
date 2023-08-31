const FaunaCommand = require("./fauna-command.js");

class SchemaCommand extends FaunaCommand {
  static flags = (() => {
    // Remove flags that don't make sense.
    const { graphqlHost, graphqlPort, ...rest } = FaunaCommand.flags
    return rest
  })()

  async fetchsetup() {
    const {
      connectionOptions: { domain, port, scheme, secret },
    } = await this.getClient();

    return {
      urlbase: `${scheme ?? "https"}://${domain}${port ? `:${port}` : ""}`,
      secret: secret,
    };
  }
}

module.exports = SchemaCommand;
