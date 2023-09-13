import { Client, query as q } from "faunadb";
import FaunaCommand from "../lib/fauna-command";

/**
 * Despite its name, returns the first 1000 databases defined.
 * "1000 databases ought to be enough for anybody".
 */
function allDatabasesQuery() {
  return q.Map(
    q.Paginate(q.Databases(), { size: 1000 }),
    q.Lambda("x", q.Get(q.Var("x")))
  );
}

class ListDatabasesCommand extends FaunaCommand {
  async run() {
    return this.withClient(
      (client: Client) => {
        this.log("listing databases");
        return client
          .query<{ data: any[] }>(allDatabasesQuery())
          .then((res) => {
            if (res.data.length > 0) {
              res.data.forEach((el) => {
                this.log(el.ref.id);
              });
            } else {
              this.log("No databases created");
            }
          })
          .catch((err) => {
            this.error(err.message);
          });
      },
      undefined as any, // is dbScope, an optional param
      undefined as any // is role, an optional param
    );
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
