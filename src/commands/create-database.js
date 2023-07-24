const FaunaCommand = require("../lib/fauna-command.js");
const { Args } = require("@oclif/core");
const faunadb = require("faunadb");
const q = faunadb.query;

function successMessage(database) {
  return `
  created database ${database}

  To start a shell with your new database, run:

  fauna shell ${database}

  Or, to create an application key for your database, run:

  fauna create-key ${database}
  `;
}

class CreateDatabaseCommand extends FaunaCommand {
  async run() {
    const dbname = this.args.dbname;
    return this.query(
      q.CreateDatabase({ name: dbname }),
      `creating database ${dbname}`,
      () => {
        this.log(successMessage(dbname));
      },
      (error) => {
        if (error.message === "instance already exists") {
          this.error(`Database '${dbname}' already exists.`);
        } else {
          this.error(`Error: ${error.message}`);
        }
      }
    );
  }
}

CreateDatabaseCommand.description = `
Creates a database
`;

CreateDatabaseCommand.examples = ["$ fauna create-database dbname"];

CreateDatabaseCommand.flags = {
  ...FaunaCommand.flags,
};

CreateDatabaseCommand.args = {
  dbname: Args.string({
    required: true,
    description: "database name",
  }),
};

module.exports = CreateDatabaseCommand;
