const FaunaCommand = require("../lib/fauna-command.js");
const { Args } = require("@oclif/core");
const faunadb = require("faunadb");
const q = faunadb.query;

class DeleteDatabaseCommand extends FaunaCommand {
  async run() {
    const dbname = this.args.dbname;
    return this.query(
      q.Delete(q.Database(dbname)),
      `deleting database '${dbname}'`,
      () => {
        this.log(`database '${dbname}' deleted`);
      },
      (error) => {
        if (error.message === "invalid ref") {
          this.error(`Database '${dbname}' not found`, 1);
        } else {
          this.error(`Error: ${error.message}`, 1);
        }
      }
    );
  }
}

DeleteDatabaseCommand.description = `
Deletes a database
`;

DeleteDatabaseCommand.examples = ["$ fauna delete-database dbname"];

DeleteDatabaseCommand.flags = {
  ...FaunaCommand.flags,
};

DeleteDatabaseCommand.args = {
  dbname: Args.string({
    required: true,
    description: "database name",
  }),
};

module.exports = DeleteDatabaseCommand;
