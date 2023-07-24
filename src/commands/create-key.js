const FaunaCommand = require("../lib/fauna-command.js");
const { Args } = require("@oclif/core");
const faunadb = require("faunadb");
const q = faunadb.query;

function successMessage(database, role, secret) {
  return `
  created key for database '${database}' with role '${role}'.
  secret: ${secret}

  To access '${database}' with this key, create a client using
  the driver library for your language of choice using
  the above secret.
  `;
}

class CreateKeyCommand extends FaunaCommand {
  async run() {
    const dbname = this.args.dbname;
    const role = this.args.role || "admin";

    const { client } = await (dbname
      ? this.ensureDbScopeClient(dbname)
      : this.getClient());

    this.log(`creating key for database '${dbname}' with role '${role}'`);
    return client
      .query(q.CreateKey({ role }))
      .then((success) => {
        this.log(successMessage(dbname, success.role, success.secret));
      })
      .catch((error) => {
        this.error(error.message, 1);
      });
  }
}

CreateKeyCommand.description = `
Creates a key for the specified database
`;

CreateKeyCommand.examples = ["$ fauna create-key dbname admin"];

CreateKeyCommand.flags = {
  ...FaunaCommand.flags,
};

CreateKeyCommand.args = {
  dbname: Args.string({
    required: true,
    description: "database name",
  }),
  role: Args.string({
    description: "key user role",
    options: ["admin", "server", "server-readonly", "client"],
  }),
};

module.exports = CreateKeyCommand;
