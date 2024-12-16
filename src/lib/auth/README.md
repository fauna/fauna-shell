# Authentication in Fauna CLI

## Terms and Definitions

- Account API: https://account.fauna.com
  - A collection of public endpoints to enable account actions. Documented [here](https://docs.fauna.com/fauna/current/reference/http/reference/account-api/)
- Fauna API: https://db.fauna.com
  - The Fauna core API as documented [here](https://docs.fauna.com/fauna/current/reference/http/reference/core-api/)
- Account Key
  - Secret used to authenticate with the account API
  - Created via
    - Fauna OAuth flow
    - Fauna Dashboard Account Key page
    - Fauna Account API `/session` endpoint.
- Database Key
  - Secret used to authenticate with the Fauna core API
  - Created via
    - Fauna Query
    - Fauna Account API `/databases/keys` endpoint

## Credential Resolution

For the CLI commands to function properly you must have a valid account key **and** database key.

If no account key is provided, the CLI will prompt a login via the dashboard where an account key will be created.

### The CLI will look for account keys in this order:

- `--account-key` flag
- `FAUNA_ACCOUNT_KEY` environment variable
- `--config` file `accountKey` value
- `~/.fauna/credentials/access_keys`

### The CLI will look for database keys in this order:

- `--secret` flag
- `FAUNA_SECRET` environment variable
- `--config` file `secret` value
- `~/.fauna/credentials/secret_keys`

**NOTE: any key that is sourced from a place other than `~/.fauna/credentials` is considered to be "user provided". The CLI will therefore not make any attempts to refresh that key if it is invalid**

_NOTE: because a database `secret` implicitly represents a database path and role, no command can accept a `secret` argument in conjunction with a `database` or `role` argument_

## Using the credentials in code

Before any command handler is reached, a middleware will have run (`buildCredentials`)

This middleware creates a singleton `Credentials` class that is accessible via

```javascript
const credentials = container.resolve("credentials");
```

The `Credentials` class builds an `AccountKeys` and `DatabaseKeys` class. By the time the middleware completes, these two classes have determined which database key and which account key to use in the various api calls. These classes also know what the current profile

Every command is scoped 1:1 with a `profile`, `database`, and `role`. These classes will be scoped to those variables and use them when getting, or refreshing credentials.

As such, no command should need to pull out `argv.secret` and send it around. We only need the `Fauna Client` and `Account Client` to leverage the correct key:

```javascript
const credentials = container.resolve("credentials");
const secret = credentials.databaseKeys.getOrRefreshKey();
const faunaClient = new FaunaClient({ ...options, secret });

const accountKey = credentials.accountKeys.getOrRefreshKey();
const accountClient = new FaunaAccountClient({ ...options, secret });
```

But instead of getting the key and passing it into the every client instance, we can build the key resolution and refresh logic into the client classes directly:

```javascript
let client = new FaunaClient(options);
const originalQuery = client.query.bind(client);

const queryArgs = async (originalArgs) => {
  const queryValue = originalArgs[0];
  const queryOptions = {
    ...originalArgs[1],
    secret: await credentials.databaseKeys.getOrRefreshKey(),
  };
  return [queryValue, queryOptions];
};
// When we get to query execution time, we want to use the latest, most accurate
//   secret being tracked by credentials.databaseKeys
client.query = async function (...args) {
  const updatedArgs = await queryArgs(args);
  return originalQuery(...updatedArgs).then(async (result) => {
    if (result.status === 401) {
      // Either refresh the db key or tell the user their provided key was bad
      await credentials.databaseKeys.onInvalidCreds();
      const updatedArgs = await queryArgs(args);
      return await originalQuery(...updatedArgs);
    }
    return result;
  });
};
```
