//@ts-check

function buildHeaders() {
  const headers = {
    "X-Fauna-Source": "Fauna Shell",
  };
  if (!["ShellCommand", "EvalCommand"].includes(constructor.name)) {
    headers["x-fauna-shell-builtin"] = "true";
  }
  return headers;
}

export async function getSimpleClient(argv) {
  let client;
  if (argv.version === "4") {
    const faunadb = (await import("faunadb")).default;
    const { Client, query: q } = faunadb;
    const { hostname, port, protocol } = new URL(argv.url);
    const scheme =  protocol?.replace(/:$/, "")
    client = new Client({
      domain: hostname,
      port: Number(port),
      scheme: /** @type {('http'|'https')} */ (scheme),
      secret: argv.secret,
      timeout: argv.timeout,

      fetch: fetch,

      headers: buildHeaders(),
    });

    // validate the client settings
    await client.query(q.Now());
  } else {
    const FaunaClient = (await import("./fauna-client.mjs")).default;
    client = new FaunaClient({
      endpoint: argv.url,
      secret: argv.secret,
      timeout: argv.timeout,
    });

    // validate the client settings
    await client.query("0");
  }

  return client;
}

// export async function ensureDbScopeClient({ scope, version, argv }) {
//   const path = scope.split("/");

//   const { connectionOptions } = await getClient({ version: "4", argv });
//   const { hostname, port, protocol } = new URL(connectionOptions.url);

//   if (!connectionOptions.secret.allowDatabase) {
//     throw new Error(
//       "Cannot specify database with a secret that contains a database"
//     );
//   }

//   for (let i = 0; i < path.length; i++) {
//     const client = new Client({
//       domain: hostname,
//       port,
//       scheme: protocol?.replace(/:$/, ""),
//       secret: connectionOptions.secret.buildSecret(),

//       // See getClient.
//       fetch: fetch,

//       headers: _getHeaders(),
//     });
//     const exists = await client.query(q.Exists(q.Database(path[i])));
//     await client.close();

//     if (!exists) {
//       const fullPath = [
//         ...connectionOptions.secret.databaseScope,
//         ...path.slice(0, i + 1),
//       ];
//       throw new Error(`Database '${fullPath.join("/")}' doesn't exist`);
//     }

//     connectionOptions.secret.appendScope(path[i]);
//   }

//   return getClient({
//     dbScope: scope,
//     version,
//   });
// }

export const commonQueryOptions = {
  url: {
    type: "string",
    description: "the Fauna URL to query",
    default: "https://db.fauna.com:443",
  },
  secret: {
    type: "string",
    description: "the secret to use when calling Fauna",
    required: true,
  },
};
