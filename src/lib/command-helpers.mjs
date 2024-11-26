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
    const scheme = protocol?.replace(/:$/, "");
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

// used for queries customers can't configure that are made on their behalf
export const commonQueryOptions = {
  url: {
    alias: "u",
    type: "string",
    description: "the Fauna URL to query",
    default: "https://db.fauna.com:443",
  },
  secret: {
    alias: "s",
    type: "string",
    description: "the database secret to use when calling Fauna",
  },
  database: {
    alias: "d",
    type: "string",
    description: "a database path, including region",
  },
  role: {
    alias: "r",
    type: "string",
    description: "the role to use when calling Fauna",
    default: "admin",
  },
};

// used for queries customers can configure
export const commonConfigurableQueryOptions = {
  ...commonQueryOptions,
  // TODO: is this unused? i think it might be
  version: {
    description: "which FQL version to use",
    type: "string",
    alias: "v",
    default: "10",
    choices: ["4", "10"],
  },
  // v10 specific options
  typecheck: {
    type: "boolean",
    description: "enable typechecking",
    default: undefined,
  },
  timeout: {
    type: "number",
    description: "connection timeout in milliseconds",
    default: 5000,
  },
};
