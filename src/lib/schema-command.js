const FaunaCommand = require("./fauna-command.js");

class SchemaCommand extends FaunaCommand {
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
