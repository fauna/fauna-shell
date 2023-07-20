const FaunaCommand = require("../lib/fauna-command.js");
const faunadb = require("faunadb");
const q = faunadb.query;
const Table = require("cli-table");

/**
 * See the cli-table docs: https://github.com/Automattic/cli-table
 */
function getTable() {
  return new Table({
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "",
      "right-mid": "",
      middle: " ",
    },
    head: ["Key ID", "Database", "Role"],
    colWidths: [20, 20, 20],
    style: { "padding-left": 0, "padding-right": 0 },
  });
}

/**
 * Sorts keys by database name.
 *
 * @param {Key} a - Key reference.
 * @param {Key} b - Key reference.
 */
function compareByDBName(a, b) {
  if (a.name < b.name) {
    return -1;
  } else if (a.name > b.name) {
    return 1;
  }
  return 0;
}

function buildTable(res) {
  const table = getTable();
  res.data.sort(compareByDBName);
  res.data.forEach(function (el) {
    const dbName = el.name;
    if (el.keys.data.length > 0) {
      el.keys.data.forEach(function (key) {
        table.push([key.id, dbName, key.role]);
      });
    } else {
      table.push(["No keys created", dbName, "-"]);
    }
  });
  return table;
}

/**
 * Returns the first 100 keys defined on the current Database.
 * "100 keys ought to be enough for anybody".
 */
function currentDbKeysQuery(q) {
  return q.Let(
    {},
    {
      name: "[current]",
      keys: q.Map(
        q.Paginate(q.Keys(), { size: 100 }),
        q.Lambda(
          "key",
          q.Let(
            {
              keyDoc: q.Get(q.Var("key")),
            },
            {
              id: q.Select(["ref", "id"], q.Var("keyDoc")),
              role: q.Select(["role"], q.Var("keyDoc")),
            }
          )
        )
      ),
    }
  );
}

/**
 * Returns the first 100 keys defined per child Database within the current one.
 * "100 keys ought to be enough for anybody".
 * In a similar fashion a limit is set up for the first 100 children of the current Database.
 */
function childrenDbKeysQuery(q) {
  return q.Map(
    q.Paginate(q.Databases(), { size: 100 }),
    q.Lambda(
      "db",
      q.Let(
        {
          dbDoc: q.Get(q.Var("db")),
        },
        {
          name: q.Select(["name"], q.Var("dbDoc")),
          keys: q.Map(
            q.Paginate(q.Keys(q.Database(q.Select(["name"], q.Var("dbDoc")))), {
              size: 100,
            }),
            q.Lambda(
              "key",
              q.Let(
                {
                  keyDoc: q.Get(q.Var("key")),
                },
                {
                  id: q.Select(["ref", "id"], q.Var("keyDoc")),
                  role: q.Select(["role"], q.Var("keyDoc")),
                }
              )
            )
          ),
        }
      )
    )
  );
}

class ListKeysCommand extends FaunaCommand {
  async run() {
    return this.withClient(async (client, _) => {
      try {
        // retrieving current and children db keys
        const [currentDb, childrenDbs] = await Promise.all([
          client.query(currentDbKeysQuery(q)),
          client.query(childrenDbKeysQuery(q)),
        ]);
        // appending current db's keys to children,
        // i.e. union all the keys together
        childrenDbs.data.push(currentDb);
        if (childrenDbs.data.length > 0) {
          this.log(buildTable(childrenDbs).toString());
        } else {
          this.log("No databases found");
        }
      } catch (err) {
        this.error(err.message);
      }
    });
  }
}

ListKeysCommand.description = `
List keys in the current database or in its child databases
`;

ListKeysCommand.examples = ["$ fauna list-keys"];

ListKeysCommand.flags = {
  ...FaunaCommand.flags,
};

module.exports = ListKeysCommand;
