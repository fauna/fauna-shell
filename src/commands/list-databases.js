const FaunaCommand = require("../lib/fauna-command.js");
const faunadb = require("faunadb");
const q = faunadb.query;

/**
 * Despite its name, returns the first 1000 databases defined.
 * "1000 databases ought to be enough for anybody".
 */
function allDatabasesQuery(q) {
  return q.Map(
    q.Paginate(q.Databases(null), { size: 1000 }),
    q.Lambda("x", q.Get(q.Var("x")))
  );
}

class ListDatabasesCommand extends FaunaCommand {
  async run() {
    return this.withClient((client, _) => {
      this.log("listing databases");
      return client
        .query(allDatabasesQuery(q))
        .then((res) => {
          if (res.data.length > 0) {
            res.data.forEach((el) => {
              this.log(el.ref.id);
            });
          } else {
            this.log("No databases created");
          }
        })
        .catch(function (err) {
          this.error(err.message);
        });
    });
  }
}

ListDatabasesCommand.description = `
Lists child databases in the current database
`;

ListDatabasesCommand.examples = ["$ fauna list-databases"];

ListDatabasesCommand.flags = {
  ...FaunaCommand.flags,
};

module.exports = ListDatabasesCommand;
