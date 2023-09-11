# fauna-shell

<!-- [![Version](https://img.shields.io/npm/v/fauna.svg)](https://npmjs.org/package/fauna)
[![CircleCI](https://circleci.com/gh/fauna/fauna/tree/master.svg?style=shield)](https://circleci.com/gh/fauna/fauna/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/fauna/fauna?branch=master&svg=true)](https://ci.appveyor.com/project/fauna/fauna/branch/master)
[![Codecov](https://codecov.io/gh/fauna/fauna/branch/master/graph/badge.svg)](https://codecov.io/gh/fauna/fauna)
[![Downloads/week](https://img.shields.io/npm/dw/fauna.svg)](https://npmjs.org/package/fauna)
[![License](https://img.shields.io/npm/l/fauna.svg)](https://github.com/fauna/fauna/blob/master/package.json) -->

This tools gives you access to [Fauna](http://fauna.com/) directly from your CLI.

It also includes a [Shell](#shell) so you can issue queries to Fauna without needing to install additional libraries.

You can install it via npm like this:

```sh-session
$ npm install -g fauna-shell
```

<!-- toc -->

- [Usage](#usage)
- [Technical Requirements](#technical-requirements)
- [Configuration](#configuration)
- [Shell](#shell)
- [Command Details](#command-details)
- [Connecting to different endpoints](#connecting-to-different-endpoints)
- [Overriding Connection Parameters](#overriding-connection-parameters)
- [Executing queries from a file](#executing-queries-from-a-file)
- [List of Commands](#list-of-commands)
  <!-- tocstop -->

# Usage

The **fauna-shell** allows you to do things like _creating_, _deleting_ and _listings_ databases.

First lets configure our connection to a Fauna account. (If you don't have an account, you can create a free one [here](https://dashboard.fauna.com)).

Let's run the following command:

```sh-session
$ fauna cloud-login
```

You will be prompted for your `email` and `password` from your [Fauna](https://dashboard.fauna.com) account.

If you would like to use 3rd party identity providers like Github or Netlify, please refer to [this guide](https://docs.fauna.com/fauna/current/start/cloud-github.html).

Now that we have an endpoint to connect to we can try to create a database to start interacting with Fauna. See [connecting to different endpoints](#connecting-to-different-endpoints).

This is how you can create a database called `my_app`:

```sh-session
$ fauna create-database my_app
creating database my_app

created database my_app

To start a shell with your new database, run:

	fauna shell my_app

Or, to create an application key for your database, run:

	fauna create-key my_app
```

And then listing your databases:

```sh-session
$ fauna list-databases
listing databases
my_app
my_second_app
my_other_app
```

You can also delete a particular database:

```sh-session
$ fauna delete-database my_other_app
deleting database 'my_other_app'
database 'my_other_app' deleted
```

You can also `create`, `list`, and `delete` _keys_.

This is how you create a key for the database `my_app`:

```sh-session
$ fauna create-key my_app
creating key for database 'my_app' with role 'admin'

created key for database 'my_app' with role 'admin'.
secret: ****************************************

To access 'my_app' with this key, create a client using
the driver library for your language of choice using
the above secret.
```

This is how to list keys (the results may differ from what you see in your database)

```sh-session
$ fauna list-keys
listing keys
Key ID               Database             Role
203269476002562560   my_app               admin
203269731203940864   my_app               admin
203269732275585536   my_app               admin
203269735610057216   test                 admin
```

And then delete the key with id: `200219702370238976`:

```sh-session
$ fauna delete-key 200219702370238976
deleting key 200219702370238976
key 200219702370238976 deleted
```

See [Commands](#commands) for a list of commands and help on their usage.

# Technical Requirements

In order to use Fauna Shell, you will need to meet these system requirements:

**Node.js version**

- `>= v10.0.0`
- `< v12.17.0`

# Configuration

By default, requests made when using the `cloud-login` command will hit `https://auth-console.fauna-preview.com/login`. You can change this behavior by defining the `FAUNA_SHELL_LOGIN_URL` environment variable in your `.env`

For example:

```bash
FAUNA_SHELL_LOGIN_URL=https://www.mycustomdomain.com/login
```

# Shell

The Fauna Shell lets you issue queries directly to your Fauna database without the need for installing additional libraries.

Let's create a database and then we'll jump straight into the Shell to start playing with Fauna's data model.

```sh-session
$ fauna create-database my_app
```

Our next step is to start the shell for a specific database, in this case `my_app`:

```sh-session
$ fauna shell my_app
Starting shell for database my_app
Connected to http://127.0.0.1:8443
Type Ctrl+D or .exit to exit the shell
my_app>
```

Once you have the prompt ready, you can start issues queries against your Fauna database. (Note that the results shown here might vary from the ones you see while running the examples).

```javascript
my_app> Collection.create({ name: "Post" })
{
  name: "Post",
  coll: Collection,
  ts: Time("2023-08-15T16:06:01.120Z"),
  indexes: {},
  constraints: []
}
```

Let's create an index for our collection `Post`.

```javascript

my_app> Post.definition.update({ indexes: { byTitle: { terms: [{ field: ".title" }] } } })
{
  name: "Post",
  coll: Collection,
  ts: Time("2023-08-15T16:07:10.800Z"),
  indexes: {
    byTitle: {
      terms: [
        {
          field: ".title"
        }
      ],
      queryable: true,
      status: "complete"
    }
  },
  constraints: []
}
```

Let's insert a new `Post` document:

```javascript
my_app> Post.create({ title: "What I had for breakfast .." })
{
  id: "373143369066480128",
  coll: Post,
  ts: Time("2023-08-15T16:14:57.440Z"),
  title: "What I had for breakfast .."
}
```

We can also insert items in bulk by using iterator functions on arrays.

```javascript
my_app> ["My cat and other marvels", "Pondering during a commute", "Deep meanings in a latte"].map(title => Post.create({ title: title }))
[
  {
    id: "373143473418666496",
    coll: Post,
    ts: Time("2023-08-15T16:16:36.960Z"),
    title: "My cat and other marvels"
  },
  {
    id: "373143473419715072",
    coll: Post,
    ts: Time("2023-08-15T16:16:36.960Z"),
    title: "Pondering during a commute"
  },
  {
    id: "373143473420763648",
    coll: Post,
    ts: Time("2023-08-15T16:16:36.960Z"),
    title: "Deep meanings in a latte"
  }
]
```

Now let's try to fetch our post about _latte_. We need to access it by _id_ like this:

```javascript
my_app> Post.byId("373143473420763648")
{
  id: "373143473420763648",
  coll: Post,
  ts: Time("2023-08-15T16:16:36.960Z"),
  title: "Deep meanings in a latte"
}
```

Now let's update our post about our cat, by adding some tags:

```javascript
my_app> Post.byId("373143473420763648")!.update({ tags: ["cute", "pet"] })
{
  id: "373143473420763648",
  coll: Post,
  ts: Time("2023-08-15T16:17:41Z"),
  title: "Deep meanings in a latte",
  tags: [
    "cute",
    "pet"
  ]
}
```

And now let's try to change the content of that post:

```javascript
my_app> Post.byId("373143473418666496")!.replace({ title: "My dog and other marvels" })
{
  id: "373143473418666496",
  coll: Post,
  ts: Time("2023-08-15T16:18:32.680Z"),
  title: "My dog and other marvels"
}
```

Now let's try to delete our post about _latte_:

```javascript
my_app> Post.byId("373143473420763648")!.delete()
Post.byId("373143473420763648") /* not found */
```

If we try to fetch it, we will receive a null document:

```javascript
my_app> Post.byId("373143473420763648")
Post.byId("373143473420763648") /* not found */
```

Finally you can exit the _shell_ by pressing `ctrl+d`.

# Command Details

<!-- details -->

```sh-session
$ fauna COMMAND
running command...
$ fauna (-v|--version|version)
fauna/0.0.1 darwin-x64 node-v8.11.1
$ fauna --help [COMMAND]
USAGE
  $ fauna COMMAND
...
```

# Connecting to different endpoints

We can add endpoints by calling the following command `add-endpoint`. We will be prompted to enter the authentication key and an alias for the endpoint.

```sh-session
$ fauna add-endpoint "https://example.com"
Endpoint Key: ****************************************
Endpoint Alias [example.com]: example_alias
```

The _Endpoint Alias_ should be a name that helps you remember the purpose of this endpoint.

If we have defined many endpoints, we could set one of them as the default one with the `default-endpoint` command:

```sh-session
$ fauna default-endpoint cloud
```

The _default endpoint_ will be used by the shell to connect to Fauna if the `--endpoint` flag is not set.

Endpoints can be listed with the `list-endpoints` command like this:

```sh-session
$ fauna list-endpoints
localhost
cloud *
cluster-us-east
```

There we see that the `cloud` endpoint has a `*` next to its name, meaning that it's the current default one.

Finally, endpoints will be saved to a `~/.fauna-shell` file like this:

```ini
default=cloud

[localhost]
domain=127.0.0.1
port=8443
scheme=http
secret=secret
graphqlHost=127.0.0.1
graphqlPort=8084


[cloud]
domain=db.fauna.com
scheme=https
secret=FAUNA_SECRET_KEY
graphqlHost=graphql.fauna.com
graphqlPort=443

[cluster-us-east]
domain=cluster-us-east.example.com
port=443
scheme=https
secret=OTHER_FAUNA_SECRET
graphqlHost=cluster-us-east.example.com
graphqlPort=443
```

# Connecting to local endpoints

If you are running Fauna locally using our Docker images, you may need to configure the Shell to work with local endpoints so you can interact with the databases running in the Docker containers.

Once you've installed the Shell and logged in, you can configure this by doing the following:

1. Run `fauna list-endpoints` to see all your endpoints. If you haven't added any yet, you should just see the `cloud` endpoint that was added when you went through the login flow.

2. By default, the Fauna Docker image serves data via port 8443 (check your Docker logs to confirm the port number). To add this, run the following:

```bash
fauna add-endpoint http://localhost:8443 # Doesn't work with HTTPS
```

3. When prompted, provide the endpoint key and then give it a name (ex. `localhost`)

4. Now, you can interact with your local database through the Fauna Shell by running the command below:

```bash
fauna shell --endpoint localhost
```

# Overriding Connection Parameters

Most commands support the following options. You can specify them if you want to connect to a local instance of Fauna.

```
OPTIONS
  --domain=domain      [default: db.fauna.com] Fauna server domain
  --port=port          [default: 443] Connection port
  --scheme=https|http  [default: https] Connection scheme
  --secret=secret      Fauna secret key
  --timeout=timeout    [default: 80] Connection timeout in milliseconds
  --endpoint=alias     Overrides the default endpoint set in ~/.fauna-shell
  --graphqlHost=domain [default: graphql.fauna.com] The Fauna GraphQL API host
  --graphqlPort=port   [default: 443] The Fauna GraphQL API port to connect to
```

They can be used like this:

```sh-session
$ fauna create-database testdb --domain=127.0.0.1 port=8443 --scheme=http --secret=YOUR_FAUNA_SECRET_KEY --timeout=42 --graphqlHost=127.0.0.1 --graphqlPort=443
```

Options provided via the CLI will override the values set in the `.fauna-shell` config file.

For example you can start a shell to a different endpoint from the one set in `.fauna-shell`:

```sh-session
$ fauna shell my_app --endpoint=endpoint_alias
```

Any options that are not specified either via the `.fauna-shell` config file or the CLI will be set to the defaults offered by the [faunadb-js client](https://github.com/fauna/faunadb-js).

# Executing queries from a file

You can also tell the shell to execute a list of queries that you have stored in a file. For example, you can have a file that creates a collection called `setup.fql`:

```javascript
Collection.create({
  name: "Post",
  indexes: {
    byTitle: {
      terms: [{ field: ".title" }]
    }
  }
})
```

Once the collection is created, you can execute queries against it in another `.fql` file:

```
Post.create({
  title: "What I had for breakfast .."
})

[
  "My cat and other marvels",
  "Pondering during a commute",
  "Deep meanings in a latte",
].map(title => {
  Post.create({
    title: title
  })
})
```

You can tell Fauna Shell to execute all those queries for you by running the following command:

```bash
$ fauna eval my_app --file=./setup.fql
$ fauna eval my_app --file=./queries.fql
```

Where `my_app` is the name of your database, and `./queries.fql` is the path to the file where you saved the queries. If `my_app` is left out it will execute the queries file on the default fauna shell endpoint.

<!-- detailsstop -->

# List of Commands

<!-- commands -->

- [fauna-shell](#fauna-shell)
- [Usage](#usage)
- [Technical Requirements](#technical-requirements)
- [Configuration](#configuration)
- [Shell](#shell)
- [Command Details](#command-details)
- [Connecting to different endpoints](#connecting-to-different-endpoints)
- [Connecting to local endpoints](#connecting-to-local-endpoints)
- [Overriding Connection Parameters](#overriding-connection-parameters)
- [Executing queries from a file](#executing-queries-from-a-file)
- [List of Commands](#list-of-commands)
  - [`fauna add-endpoint ENDPOINT`](#fauna-add-endpoint-endpoint)
  - [`fauna autocomplete [SHELL]`](#fauna-autocomplete-shell)
  - [`fauna cloud-login`](#fauna-cloud-login)
  - [`fauna create-database DBNAME`](#fauna-create-database-dbname)
  - [`fauna create-key DBNAME [ROLE]`](#fauna-create-key-dbname-role)
  - [`fauna default-endpoint ENDPOINT_ALIAS`](#fauna-default-endpoint-endpoint_alias)
  - [`fauna delete-database DBNAME`](#fauna-delete-database-dbname)
  - [`fauna delete-endpoint ENDPOINT_ALIAS`](#fauna-delete-endpoint-endpoint_alias)
  - [`fauna delete-key KEYNAME`](#fauna-delete-key-keyname)
  - [`fauna help [COMMAND]`](#fauna-help-command)
  - [`fauna list-databases`](#fauna-list-databases)
  - [`fauna list-endpoints`](#fauna-list-endpoints)
  - [`fauna list-keys`](#fauna-list-keys)
  - [`fauna run-queries DBNAME`](#fauna-run-queries-dbname)
  - [`fauna shell [DBNAME]`](#fauna-shell-dbname)
  - [`fauna import`](#fauna-import)
  - [`fauna eval [DBNAME] [QUERY]`](#fauna-eval-dbname-query)
  - [`fauna upload-graphql-schema graphqlFilePath`](#fauna-upload-graphql-schema-graphqlfilepath)
  - [`fauna import --path FILE_PATH`](#fauna-import---path-file_path)
- [Development](#development)

## `fauna add-endpoint ENDPOINT`

Adds a connection endpoint for Fauna.

```
USAGE
  $ fauna add-endpoint ENDPOINT

ARGUMENTS
  ENDPOINT  Fauna server endpoint

DESCRIPTION
  Adds a connection endpoint for Fauna.

EXAMPLE
  $ fauna add-endpoint https://db.fauna.com:443
  $ fauna add-endpoint http://localhost:8443/ --alias localhost --key secret
```

_See code: [src/commands/add-endpoint.js](src/commands/add-endpoint.js)_

## `fauna autocomplete [SHELL]`

display autocomplete installation instructions

```
USAGE
  $ fauna autocomplete [SHELL]

ARGUMENTS
  SHELL  shell type

OPTIONS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

EXAMPLES
  $ fauna autocomplete
  $ fauna autocomplete bash
  $ fauna autocomplete zsh
  $ fauna autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v0.1.0/src/commands/autocomplete/index.ts)_

## `fauna cloud-login`

Adds a Fauna endpoint.

```
USAGE
  $ fauna cloud-login

DESCRIPTION
  Adds a Fauna endpoint.

EXAMPLE
  $ fauna cloud-login
```

_See code: [src/commands/cloud-login.js](commands/cloud-login.js)_

## `fauna create-database DBNAME`

Creates a database

```
USAGE
  $ fauna create-database DBNAME

ARGUMENTS
  DBNAME  database name

OPTIONS
  --domain=domain      Fauna server domain
  --endpoint=endpoint  Fauna server endpoint
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      Fauna secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Creates a database

EXAMPLE
  $ fauna create-database dbname
```

_See code: [src/commands/create-database.js](commands/create-database.js)_

## `fauna create-key DBNAME [ROLE]`

Creates a key for the specified database

```
USAGE
  $ fauna create-key DBNAME [ROLE]

ARGUMENTS
  DBNAME  database name
  ROLE    (admin|server|server-readonly|client) key user role

OPTIONS
  --domain=domain      Fauna server domain
  --endpoint=endpoint  Fauna server endpoint
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      Fauna secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Creates a key for the specified database

EXAMPLE
  $ fauna create-key dbname admin
```

_See code: [src/commands/create-key.js](src/commands/create-key.js)_

## `fauna default-endpoint ENDPOINT_ALIAS`

Sets an endpoint as the default one

```
USAGE
  $ fauna default-endpoint ENDPOINT_ALIAS

ARGUMENTS
  ENDPOINT_ALIAS  Fauna server endpoint alias

DESCRIPTION
  Sets an endpoint as the default one

EXAMPLE
  $ fauna default-endpoint endpoint
```

_See code: [src/commands/default-endpoint.js](src/commands/default-endpoint.js)_

## `fauna delete-database DBNAME`

Deletes a database

```
USAGE
  $ fauna delete-database DBNAME

ARGUMENTS
  DBNAME  database name

OPTIONS
  --domain=domain      Fauna server domain
  --endpoint=endpoint  Fauna server endpoint
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      Fauna secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Deletes a database

EXAMPLE
  $ fauna delete-database dbname
```

_See code: [src/commands/delete-database.js](src/commands/delete-database.js)_

## `fauna delete-endpoint ENDPOINT_ALIAS`

Deletes a connection endpoint.

```
USAGE
  $ fauna delete-endpoint ENDPOINT_ALIAS

ARGUMENTS
  ENDPOINT_ALIAS  Fauna server endpoint alias

DESCRIPTION
  Deletes a connection endpoint.

EXAMPLE
  $ fauna delete-endpoint endpoint_alias
```

_See code: [src/commands/delete-endpoint.js](src/commands/delete-endpoint.js)_

## `fauna delete-key KEYNAME`

Deletes a key

```
USAGE
  $ fauna delete-key KEYNAME

ARGUMENTS
  KEYNAME  key name

OPTIONS
  --domain=domain      Fauna server domain
  --endpoint=endpoint  Fauna server endpoint
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      Fauna secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Deletes a key

EXAMPLE
  $ fauna delete-key 123456789012345678
```

_See code: [src/commands/delete-key.js](src/commands/delete-key.js)_

## `fauna help [COMMAND]`

display help for fauna

```
USAGE
  $ fauna help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v1.2.11/src/commands/help.ts)_

## `fauna list-databases`

Lists child databases in the current database

```
USAGE
  $ fauna list-databases

OPTIONS
  --domain=domain      Fauna server domain
  --endpoint=endpoint  Fauna server endpoint
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      Fauna secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Lists child databases in the current database

EXAMPLE
  $ fauna list-databases
```

_See code: [src/commands/list-databases.js](src/commands/list-databases.js)_

## `fauna list-endpoints`

Lists connection endpoints.

```
USAGE
  $ fauna list-endpoints

DESCRIPTION
  Lists connection endpoints.

EXAMPLE
  $ fauna list-endpoints
```

_See code: [src/commands/list-endpoints.js](src/commands/list-endpoints.js)_

## `fauna list-keys`

List keys in the current database or in its child databases

```
USAGE
  $ fauna list-keys

OPTIONS
  --domain=domain      Fauna server domain
  --endpoint=endpoint  Fauna server endpoint
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      Fauna secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  List keys in the current database or in its child databases

EXAMPLE
  $ fauna list-keys
```

_See code: [src/commands/list-keys.js](src/commands/list-keys.js)_

## `fauna run-queries DBNAME`

Runs the queries found on the file passed to the command.

```
USAGE
  $ fauna run-queries DBNAME

ARGUMENTS
  DBNAME  database name

OPTIONS
  --domain=domain      Fauna server domain
  --endpoint=endpoint  Fauna server endpoint
  --file=file          File where to read queries from
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      Fauna secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Runs the queries found on the file passed to the command.

EXAMPLE
  $ fauna run-queries dbname --file=/path/to/queries.fql
```

_See code: [src/commands/run-queries.js](src/commands/run-queries.js)_

## `fauna shell [DBNAME]`

Starts an interactive shell.

```
USAGE
  $ fauna shell [DBNAME]

ARGUMENTS
  DBNAME  database name

OPTIONS
  --domain=domain      Fauna server domain
  --endpoint=endpoint  Fauna server endpoint
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      Fauna secret key
  --timeout=timeout    Connection timeout in milliseconds
  --version=4|10       [default: 10] FQL version to use

DESCRIPTION
  Starts an interactive shell.

EXAMPLE
  $ fauna shell dbname
```

_See code: [src/commands/shell.js](src/commands/shell.js)_

## `fauna eval [DBNAME] [QUERY]`

Evaluates a fauna query

```
USAGE
  $ fauna eval [DBNAME] [QUERY]

ARGUMENTS
  QUERY  FQL query to execute
  DBNAME Database name

OPTIONS
  --domain=domain                  Fauna server domain
  --endpoint=endpoint              Fauna server endpoint
  --file=file                      File where to read queries from
  --format=json|shell|json-tagged  [default: shell if tty, json if no tty] Output format
  --output=output                  File to write output to
  --port=port                      Connection port
  --scheme=https|http              Connection scheme
  --secret=secret                  Fauna secret key
  --stdin                          Read file input from stdin. Writes to stdout by default
  --timeout=timeout                Connection timeout in milliseconds
  --version=4|10                   [default: 10] FQL version to use

DESCRIPTION
  Runs the specified query. Can read from stdin, file or command line.
  Outputs to either stdout or file.
  Output format can be specified.

EXAMPLES
  $ fauna eval "Collection.all()"
  $ fauna eval nestedDbName "Collection.all()"
  $ fauna eval --file=/path/to/queries.fql
  $ echo "1 + 1" | fauna eval
  $ fauna eval "2 + 3" --output=/tmp/result"
  $ fauna eval "2 + 3" --format=json --output=/tmp/result"
```

_See code: [src/commands/eval.js](src/commands/eval.js)_

## `fauna import`

Import data to Fauna

```
USAGE
  $ fauna import --path [DATA]

OPTIONS
  --allow-short-rows       Allows rows which are shorter than the number of headers
  --append                 Allows appending documents to a non-empty collection
  --collection=collection  Collection name. When not specified, the collection name is the filename when --path is file
  --db=db                  Child database name; imported documents are stored in this database
  --domain=domain          Fauna server domain
  --endpoint=endpoint      Fauna server endpoint
  --path=path              (required) Path to .csv/.json file, or path to folder containing .csv/.json files
  --port=port              Connection port
  --scheme=https|http      Connection scheme
  --secret=secret          Fauna secret key
  --timeout=timeout        Connection timeout in milliseconds

  --type=type              Column type casting, converts the column value to a Fauna type.
                           Format: <column>::<type>
                           <column>: the name of the column to cast values
                           <type>: one of 'number', 'bool', or 'date'.

EXAMPLES
  $ fauna import --path ./collection_name.csv
  $ fauna import --append --path ./collection.csv
  $ fauna import --db=sampleDB --collection=SampleCollection --path ./datafile.csv
  $ fauna import --db=sampleDB --path ./dump
  $ fauna import --type=header_name::date --type=hdr2::number --type=hdrX::bool --path ./collection.csv
```

_See code: [src/commands/import.js](src/commands/import.js)_

## `fauna upload-graphql-schema graphqlFilePath`

Upload GraphQL schema

```
USAGE
  $ fauna upload-graphql-schema GRAPHQLFILEPATH

ARGUMENTS
  GRAPHQLFILEPATH  Path to GraphQL schema

OPTIONS
  --domain=domain            Fauna server domain
  --endpoint=endpoint        Fauna server endpoint
  --graphqlHost=graphqlHost  The Fauna GraphQL API host
  --graphqlPort=port         GraphQL port
  --mode=merge|override      [default: merge] Upload mode
  --port=port                Connection port
  --scheme=https|http        Connection scheme
  --secret=secret            Fauna secret key
  --timeout=timeout          Connection timeout in milliseconds

EXAMPLES
  $ fauna upload-graphql-schema ./schema.gql
  $ fauna upload-graphql-schema ./schema.gql --mode override
```

_See code: [src/commands/upload-graphql-schema.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/upload-graphql-schema.js)_

## `fauna import --path FILE_PATH`

Import data to dana

```
USAGE
  $ fauna import --path FILE_PATH


OPTIONS
  --allow-short-rows       Allows rows which are shorter than the number of headers
  --append                 Allows appending documents to a non-empty collection
  --collection=collection  Collection name. When not specified, the collection name is the filename when --path is file
  --db=db                  Child database name; imported documents are stored in this database
  --domain=domain          Fauna server domain
  --endpoint=endpoint      Fauna server endpoint
  --path=path              (required) Path to .csv/.json file, or path to folder containing .csv/.json files
  --port=port              Connection port
  --scheme=https|http      Connection scheme
  --secret=secret          Fauna secret key
  --timeout=timeout        Connection timeout in milliseconds

  --type=type              Column type casting, converts the column value to a Fauna type.
                           Format: <column>::<type>
                           <column>: the name of the column to cast values
                           <type>: one of 'number', 'bool', or 'date'.

EXAMPLES
  $ fauna import --path ./samplefile.csv
  $ fauna import --append --path ./samplefile.csv
  $ fauna import --db=sampleDB --collection=Samplecollection --path ./samplefile.csv
  $ fauna import --db=sampleDB --path ./dump
  $ fauna import --type=header_name::date --type=hdr2::number --type=hdrX::bool --path ./samplefile.csv
```

_See code: [src/commands/upload-graphql-schema.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/upload-graphql-schema.js)_

## `fauna schema` Subcommands

### `fauna schema diff --dir DIR`

Print a diff between local schema files and Fauna schema.

```
USAGE
  $ fauna schema diff --dir DIR


OPTIONS
  --dir=directory          (required) The root directory for the database's schema files
  --domain=domain          Fauna server domain
  --endpoint=endpoint      Fauna server endpoint
  --port=port              Connection port
  --scheme=https|http      Connection scheme
  --secret=secret          Fauna secret key
  --timeout=timeout        Connection timeout in milliseconds

EXAMPLES
  $ fauna schema diff --dir ./schemas/mydb
```

### `fauna schema push --dir DIR`

Push local schema files to Fauna. Without `--force` set, the user must confirm a diff.

```
USAGE
  $ fauna schema push --dir DIR


OPTIONS
  --dir=directory          (required) The root directory for the database's schema files
  --domain=domain          Fauna server domain
  --endpoint=endpoint      Fauna server endpoint
  --force                  Push local files without confirming the diff
  --port=port              Connection port
  --scheme=https|http      Connection scheme
  --secret=secret          Fauna secret key
  --timeout=timeout        Connection timeout in milliseconds

EXAMPLES
  $ fauna schema push --dir ./schemas/mydb
  $ fauna schema push --dir ./schemas/yourdb --force
```

### `fauna schema pull --dir DIR`

Pull schema from Fauna and save as local schema files.

```
USAGE
  $ fauna schema pull --dir DIR


OPTIONS
  --delete                 Delete local schema files not present in Fauna
  --dir=directory          (required) A root directory for the database's schema files
  --domain=domain          Fauna server domain
  --endpoint=endpoint      Fauna server endpoint
  --port=port              Connection port
  --scheme=https|http      Connection scheme
  --secret=secret          Fauna secret key
  --timeout=timeout        Connection timeout in milliseconds

EXAMPLES
  $ fauna schema pull --dir ./schemas/mydb
  $ fauna schema pull --dir ./schemas/yourdb --delete
```

<!-- commandsstop -->

# Development

All above commands starts with `fauna`, but you are able to run them this way after installation of the fauna-shell package.  
During development, you might want to test your changes without installing the package every single time.  
To do so, you can run commands like this:

```
# don't forget to install dependencies for your fauna-shell project
npm install

# run a command you need
./bin/run cloud-login
./bin/run import
```
