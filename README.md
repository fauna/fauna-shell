# Fauna CLI

<!-- [![Version](https://img.shields.io/npm/v/fauna.svg)](https://npmjs.org/package/fauna)
[![CircleCI](https://circleci.com/gh/fauna/fauna/tree/master.svg?style=shield)](https://circleci.com/gh/fauna/fauna/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/fauna/fauna?branch=master&svg=true)](https://ci.appveyor.com/project/fauna/fauna/branch/master)
[![Codecov](https://codecov.io/gh/fauna/fauna/branch/master/graph/badge.svg)](https://codecov.io/gh/fauna/fauna)
[![Downloads/week](https://img.shields.io/npm/dw/fauna.svg)](https://npmjs.org/package/fauna)
[![License](https://img.shields.io/npm/l/fauna.svg)](https://github.com/fauna/fauna/blob/master/package.json) -->

This tools gives you access to [Fauna](http://fauna.com/) directly from your CLI.

It also includes a [Shell](#shell) so you can issue queries to Fauna without
needing to install additional libraries.

You can install it via npm like this:

```sh
$ npm install -g fauna-shell
```

<!-- toc -->

- [Usage](#usage)
- [Technical Requirements](#technical-requirements)
- [Shell](#shell)
- [Connecting to different endpoints](#connecting-to-different-endpoints)
- [Overriding Connection Parameters](#overriding-connection-parameters)
- [Executing queries from a file](#executing-queries-from-a-file)
- [List of Commands](#list-of-commands)

<!-- tocstop -->

# Usage

The **Fauna CLI** allows you to do issue queries, modify database schema, and
create keys and databases.

First lets configure our connection to a Fauna account. If you don't have an
account, you can create a free one [here](https://dashboard.fauna.com).

To log in, run the following command:

```sh
$ fauna cloud-login
```

You will be prompted for your `email` and `password` from your
[Fauna](https://dashboard.fauna.com) account.

Now that we have an endpoint to connect to we can try to create a database to
start interacting with Fauna.

This is how you can create a database called `my_app`:

```sh
$ fauna create-database my_app
creating database my_app

created database my_app

To start a shell with your new database, run:

	fauna shell my_app

Or, to create an application key for your database, run:

	fauna create-key my_app
```

Now, you can start a shell within that database.

```sh
$ fauna shell my_app
my_app> Collection.create({ name: "Users" })
{
  name: "Users",
  coll: Collection,
  ts: Time("2023-10-03T02:40:37.060Z"),
  indexes: {},
  constraints: []
}
my_app>
```

You can also list your databases:

```sh-session
$ fauna list-databases
listing databases
my_app
my_second_app
my_other_app
```

You can delete a particular database:

```sh-session
$ fauna delete-database my_other_app
deleting database 'my_other_app'
database 'my_other_app' deleted
```

And you can create, list, and delete keys.

This is how you create a key for the database `my_app`:

```sh
$ fauna create-key my_app
creating key for database 'my_app' with role 'admin'

created key for database 'my_app' with role 'admin'.
secret: fnAFPULk2WAAQY9t4x0tduzuz85gC-suDbTnl7um # this will be different

To access 'my_app' with this key, create a client using
the driver library for your language of choice using
the above secret.
```

This is how to list keys:

```sh
$ fauna list-keys
listing keys
Key ID               Database             Role
203269476002562560   my_app               admin
203269731203940864   my_app               admin
203269732275585536   my_app               admin
203269735610057216   test                 admin
```

And then delete the key with id: `200219702370238976`:

```sh
$ fauna delete-key 200219702370238976
deleting key 200219702370238976
key 200219702370238976 deleted
```

See [Commands](#commands) for a list of commands and help on their usage.

# Technical Requirements

In order to use Fauna Shell, you must have Node.js version >= 16 installed.

# Shell

The Fauna Shell lets you issue queries directly to your Fauna database without
the need for installing additional libraries.

Let's create a database and then we'll jump straight into the Shell to start
playing with Fauna's data model.

```sh
$ fauna create-database my_app
```

Our next step is to start the shell for a specific database, in this case `my_app`:

```sh
$ fauna shell my_app
Starting shell for database my_app
Connected to http://127.0.0.1:8443
Type Ctrl+D or .exit to exit the shell
my_app>
```

Once you have the prompt ready, you can start issues queries against your Fauna
database. Note that the results shown here might vary from the ones you see
while running the examples.

```ts
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

```ts
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

```ts
my_app> Post.create({ title: "What I had for breakfast .." })
{
  id: "373143369066480128",
  coll: Post,
  ts: Time("2023-08-15T16:14:57.440Z"),
  title: "What I had for breakfast .."
}
```

We can also insert items in bulk by using iterator functions on arrays.

```ts
my_app> [
  "My cat and other marvels",
  "Pondering during a commute",
  "Deep meanings in a latte"
].map(title => Post.create({ title: title }))
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

```ts
my_app> Post.byId("373143473420763648")
{
  id: "373143473420763648",
  coll: Post,
  ts: Time("2023-08-15T16:16:36.960Z"),
  title: "Deep meanings in a latte"
}
```

Now let's update our post about our cat, by adding some tags:

```ts
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

```ts
my_app> Post.byId("373143473418666496")!.replace({ title: "My dog and other marvels" })
{
  id: "373143473418666496",
  coll: Post,
  ts: Time("2023-08-15T16:18:32.680Z"),
  title: "My dog and other marvels"
}
```

Now let's try to delete our post about _latte_:

```ts
my_app> Post.byId("373143473420763648")!.delete()
Post.byId("373143473420763648") /* not found */
```

If we try to fetch it, we will receive a null document:

```ts
my_app> Post.byId("373143473420763648")
Post.byId("373143473420763648") /* not found */
```

Finally you can exit the _shell_ by pressing `ctrl+d`.

# Connecting to different endpoints

We can add endpoints by calling the following command `endpoint add`. This is
meant to be used when connecting to a docker container.

```sh
$ fauna endpoint add
? Endpoint name localhost
? Database URL http://localhost:8443
? Database Secret secret
Checking secret... done
? Make this endpoint default [no]
Saved endpoint localhost to ~/.fauna-shell
```

The endpoint name is an arbitrary name that can be used in the `--endpoint` flag
of other commands. The database URL should typically be `http://localhost:8443`
or `https://db.fauna.com`, although it can be set to any URL to a fauna
instance. The database secret is the secret used to authenticate with that
database.

An endpoint can be set as the default, in which case `fauna shell` and
`fauna eval` will choose that endpoint by default.

Endpoints can be listed with the `endpoint list` command like this:

```sh
$ fauna endpoint list
  localhost
* cloud
```

There we see that the `cloud` endpoint has a `*` next to its name, meaning that
it's the current default one.

Finally, endpoints will be saved to a `~/.fauna-shell` file like this:

```ini
default=cloud

[endpoint.localhost]
url=http://localhost:8443
secret=secret

[endpoint.cloud]
secret=FAUNA_SECRET_KEY
```

# Connecting to local endpoints

If you are running Fauna locally using our Docker image, you will need to
configure the CLI to work with local endpoints so you can interact with the
database running in the Docker container.

The docker container is explained in depth here:
https://docs.fauna.com/fauna/current/tools/dev.

Once you've installed the Shell and logged in, you can configure it by doing the
following:

By default, the Fauna Docker image serves data via port 8443. To add a
connection to this port, run `fauna endpoint add`. The Database URL should be
`http://localhost:8443` (the default), and the database secret should be
`secret` by default.

```sh
$ fauna endpoint add
? Endpoint name localhost
? Database URL http://localhost:8443
? Database Secret secret
Checking secret... done
? Make this endpoint default [no]
Saved endpoint localhost to ~/.fauna-shell
```

Now, you can interact with your local database through the Fauna Shell by
running the command below:

```sh
fauna shell --endpoint localhost
```

# Overriding Connection Parameters

Most commands support the following options. You can specify them if you want to
connect to a local instance of Fauna.

```sh
OPTIONS
  --endpoint=name      Selects an endpoint from ~/.fauna-shell
  --endpointURL=domain Overrides the `url` setting in the selected endpoint.
  --secret=secret      Overrides the `secret` setting in the selected endpoint.
  --timeout=timeout    [default: 5000] Connection timeout in milliseconds
```

`--endpoint` doesn't need to be set if `--endpointURL` and `--secret` are provided.

They can be used like this:

```sh
$ fauna create-database testdb --endpointURL=http://127.0.0.1:8443 --secret=YOUR_FAUNA_SECRET_KEY --timeout=42
```

You could select another endpoint from `~/.fauna-shell` using `--endpoint`:

```sh-session
$ fauna shell --endpoint=localhost
```

Any options that are not specified either via the `.fauna-shell` config file or
the CLI will be set to the defaults offered by the
[JS driver](https://github.com/fauna/fauna-js).

# Executing queries from a file

You can also tell the shell to execute a list of queries that you have stored in
a file. For example, you can have a file that creates a collection called
`setup.fql`:

```ts
Collection.create({
  name: "Post",
  indexes: {
    byTitle: {
      terms: [{ field: ".title" }]
    }
  }
})
```

Once the collection is created, you can execute queries against it in another
`.fql` file:

```ts
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

You can tell Fauna Shell to execute all those queries for you by running the
following command:

```bash
$ fauna eval my_app --file=./setup.fql
$ fauna eval my_app --file=./queries.fql
```

Where `my_app` is the name of your database, and `./queries.fql` is the path to
the file where you saved the queries. If `my_app` is left out it will execute
the queries file on the default fauna shell endpoint.

<!-- detailsstop -->

# List of Commands

<!-- commands -->

- [`fauna cloud-login`](#fauna-cloud-login)
- [`fauna create-database`](#fauna-create-database)
- [`fauna create-key`](#fauna-create-key)
- [`fauna delete-database`](#fauna-delete-database)
- [`fauna delete-key`](#fauna-delete-key)
- [`fauna endpoint`](#fauna-endpoint)
- [`fauna eval`](#fauna-eval)
- [`fauna help`](#fauna-help)
- [`fauna import`](#fauna-import)
- [`fauna list-databases`](#fauna-list-databases)
- [`fauna list-keys`](#fauna-list-keys)
- [`fauna project`](#fauna-project)
- [`fauna schema`](#fauna-schema)
- [`fauna shell`](#fauna-shell)
- [`fauna stack`](#fauna-stack)
- [`fauna upload-graphql-schema`](#fauna-upload-graphql-schema)

## `fauna cloud-login`

Prompts the user to log into a Fauna account, and saves the secret to a new
endpoint.

```sh
Log in to a Fauna account.

USAGE
  $ fauna cloud-login

DESCRIPTION
  Log in to a Fauna account.

EXAMPLES
  $ fauna cloud-login
```

## `fauna create-database`

Create a database with the given name.

This is the same as the following query:
```ts
Database.create({ name: DBNAME })
```

```sh
Create a database.

USAGE
  $ fauna create-database DBNAME [--url <value>] [--timeout <value>]
    [--secret <value>] [--endpoint <value>] [--stack <value>]

ARGUMENTS
  DBNAME  database name

FLAGS
  --endpoint=<value>  Connection endpoint, from ~/.fauna-shell
  --secret=<value>    Secret key. Overrides the `secret` in ~/.fauna-shell
  --stack=<value>     Stack to use, from a Fauna project
  --timeout=<value>   Connection timeout in milliseconds
  --url=<value>       Database URL. Overrides the `url` in ~/.fauna-shell

DESCRIPTION
  Create a database.

EXAMPLES
  $ fauna create-database dbname
```

## `fauna create-key`

Create a key for the specified database.

This is the same as the following query:
```ts
Key.create({
  database: DBNAME,
  role: ROLE
})
```

```sh
Create a key for the specified database.

USAGE
  $ fauna create-key DBNAME [ROLE] [--url <value>] [--timeout <value>]
    [--secret <value>] [--endpoint <value>] [--stack <value>]

ARGUMENTS
  DBNAME  database name
  ROLE    (admin|server|server-readonly|client) key user role

FLAGS
  --endpoint=<value>  Connection endpoint, from ~/.fauna-shell
  --secret=<value>    Secret key. Overrides the `secret` in ~/.fauna-shell
  --stack=<value>     Stack to use, from a Fauna project
  --timeout=<value>   Connection timeout in milliseconds
  --url=<value>       Database URL. Overrides the `url` in ~/.fauna-shell

DESCRIPTION
  Create a key for the specified database.

EXAMPLES
  $ fauna create-key dbname admin
```

## `fauna delete-database`

Delete the given database. Warning: this action cannot be undone.

This is the same as the following query:
```ts
Database.byName(DBNAME)!.delete()
```

```sh
Delete a database.

USAGE
  $ fauna delete-database DBNAME [--url <value>] [--timeout <value>]
    [--secret <value>] [--endpoint <value>] [--stack <value>]

ARGUMENTS
  DBNAME  database name

FLAGS
  --endpoint=<value>  Connection endpoint, from ~/.fauna-shell
  --secret=<value>    Secret key. Overrides the `secret` in ~/.fauna-shell
  --stack=<value>     Stack to use, from a Fauna project
  --timeout=<value>   Connection timeout in milliseconds
  --url=<value>       Database URL. Overrides the `url` in ~/.fauna-shell

DESCRIPTION
  Delete a database.

EXAMPLES
  $ fauna delete-database dbname
```

## `fauna delete-key`

Delete a key with the given ID.

This is the same as the following query:
```ts
Key.byId(ID)!.delete()
```

```sh
Delete a key.

USAGE
  $ fauna delete-key KEYNAME [--url <value>] [--timeout <value>]
    [--secret <value>] [--endpoint <value>] [--stack <value>]

ARGUMENTS
  KEYNAME  key name

FLAGS
  --endpoint=<value>  Connection endpoint, from ~/.fauna-shell
  --secret=<value>    Secret key. Overrides the `secret` in ~/.fauna-shell
  --stack=<value>     Stack to use, from a Fauna project
  --timeout=<value>   Connection timeout in milliseconds
  --url=<value>       Database URL. Overrides the `url` in ~/.fauna-shell

DESCRIPTION
  Delete a key.

EXAMPLES
  $ fauna delete-key 123456789012345678
```

## `fauna endpoint`

Commands to manage endpoints in ~/.fauna-shell.

### `fauna endpoint add`

Add a new endpoint to ~/.fauna-shell. All flags are optional, and the user will
be prompted to fill in any missing values that are needed.

This command is intended for custom Fauna endpoints. If you are connecting to
a database in the dashboard, prefer `fauna cloud-login` instead.

If `--non-interactive` is set, no prompts will be shown, and the `--url` and
`--secret` flags will be required.

```sh
Add an endpoint to ~/.fauna-shell.

USAGE
  $ fauna endpoint add [NAME] [--non-interactive --url <value> --secret
    <value>] [--set-default]

ARGUMENTS
  NAME  Endpoint name

FLAGS
  --non-interactive  Disables interaction
  --secret=<value>   Database secret
  --set-default      Sets this stack as the default
  --url=<value>      Database URL

DESCRIPTION
  Add an endpoint to ~/.fauna-shell.

ALIASES
  $ fauna add-endpoint

EXAMPLES
  $ fauna endpoint add

  $ fauna endpoint add localhost --url http://localhost:8443/ --key secret

  $ fauna endpoint add localhost --set-default
```

### `fauna endpoint list`

List endpoints from ~/.fauna-shell.

```sh
List endpoints in ~/.fauna-shell.

USAGE
  $ fauna endpoint list

DESCRIPTION
  List endpoints in ~/.fauna-shell.

ALIASES
  $ fauna list-endpoints

EXAMPLES
  $ fauna endpoint list
```

### `fauna endpoint remove`

Remove an endpoint from ~/.fauna-shell.

```sh
Remove an endpoint from ~/.fauna-shell.

USAGE
  $ fauna endpoint remove NAME

ARGUMENTS
  NAME  Endpoint name

DESCRIPTION
  Remove an endpoint from ~/.fauna-shell.

ALIASES
  $ fauna delete-endpoint

EXAMPLES
  $ fauna endpoint remove my_endpoint
```

### `fauna endpoint select`

Set an endpoint as the default one.

```sh
Set an endpoint as the default one.

USAGE
  $ fauna endpoint select [NAME]

ARGUMENTS
  NAME  New default endpoint

DESCRIPTION
  Set an endpoint as the default one.

ALIASES
  $ fauna default-endpoint

EXAMPLES
  $ fauna endpoint select

  $ fauna endpoint select endpoint
```

## `fauna eval`

Evaluate the given query.

The `--file` option can be used to read a file instead of using the command
argument as the query.

The `--output` option can be used to write the query output to a file instead
of stdout.

The `--stdin` option can be used to read a query from stdin instead of command
line arguments.

```sh
Evaluate the given query.

USAGE
  $ fauna eval [DBNAME] [QUERY] [--url <value>] [--timeout
    <value>] [--secret <value>] [--endpoint <value>] [--stack <value>] [--file
    <value>] [--stdin] [--output <value>] [--format json|json-tagged|shell]
    [--version 4|10] [--typecheck]

ARGUMENTS
  DBNAME  Database name
  QUERY   FQL query to execute

FLAGS
  --endpoint=<value>  Connection endpoint, from ~/.fauna-shell
  --file=<value>      File where to read queries from
  --format=<option>   Output format
                      <options: json|json-tagged|shell>
  --output=<value>    File to write output to
  --secret=<value>    Secret key. Overrides the `secret` in ~/.fauna-shell
  --stack=<value>     Stack to use, from a Fauna project
  --stdin             Read file input from stdin. Writes to stdout by default
  --timeout=<value>   Connection timeout in milliseconds
  --typecheck         Enable typechecking
  --url=<value>       Database URL. Overrides the `url` in ~/.fauna-shell
  --version=<option>  [default: 10] FQL Version
                      <options: 4|10>

DESCRIPTION
  Evaluate the given query.

EXAMPLES
  $ fauna eval "Collection.all()"

  $ fauna eval nestedDbName "Collection.all()"

  $ fauna eval --file=/path/to/queries.fql

  $ echo "1 + 1" | fauna eval

  $ fauna eval "2 + 3" --output=/tmp/result"

  $ fauna eval "2 + 3" --format=json --output=/tmp/result"
```

## `fauna help`

Shows help for the Fauna CLI.

```sh
faunadb shell

VERSION
  fauna-shell/1.1.0 darwin-x64 node-v20.6.0

USAGE
  $ fauna [COMMAND]

TOPICS
  endpoint  Manage endpoints in ~/.fauna-shell.
  plugins   List installed plugins.
  project   Manage project settings in .fauna-project.
  schema    Print the diff between local and remote schema.
  stack     Manage stacks in the current project.

COMMANDS
  add-endpoint           Add an endpoint to ~/.fauna-shell.
  cloud-login            Log in to a Fauna account.
  create-database        Create a database.
  create-key             Create a key for the specified database.
  default-endpoint       Set an endpoint as the default one.
  delete-database        Delete a database.
  delete-endpoint        Remove an endpoint from ~/.fauna-shell.
  delete-key             Delete a key.
  eval                   Evaluate the given query.
  help                   Display help for fauna.
  import                 Import data to Fauna.
  list-databases         List child databases in the current database.
  list-endpoints         List endpoints in ~/.fauna-shell.
  list-keys              List keys in the current database.
  plugins                List installed plugins.
  run-queries            Run the queries found on the file passed to the
                         command.
  shell                  Start an interactive shell.
  upload-graphql-schema  Upload GraphQL schema.
```

## `fauna import`

Import data to Fauna.

```sh
Import data to Fauna.

USAGE
  $ fauna import --path <value> [--url <value>] [--timeout <value>]
    [--secret <value>] [--endpoint <value>] [--stack <value>] [--db <value>]
    [--collection <value>] [--type <value>] [--append] [--allow-short-rows]
    [--dry-run] [--treat-empty-csv-cells-as empty|null]

FLAGS
  --allow-short-rows
      Allows rows which are shorter than the number of headers

  --append
      Allows appending documents to a non-empty collection

  --collection=<value>
      Collection name. When not specified, the collection name is the filename.

  --db=<value>
      Child database name; imported documents are stored in this database

  --dry-run
      Dry run the import - committing no documents to Fauna but converting all
      items to Fauna's format and applying all requested --type conversions.
      Enables you to detect issues with your file(s) before writing to your
      collection(s).

  --endpoint=<value>
      Connection endpoint, from ~/.fauna-shell

  --path=<value>
      (required) Path to .csv/.json file, or path to folder containing .csv/.json
      files. if the path is to a folder, sub-folders will be skipped.

  --secret=<value>
      Secret key. Overrides the `secret` in ~/.fauna-shell

  --stack=<value>
      Stack to use, from a Fauna project

  --timeout=<value>
      Connection timeout in milliseconds

  --treat-empty-csv-cells-as=<option>
      [default: null] Treat empty csv cells as empty strings or null, default is
      null.
      <options: empty|null>

  --type=<value>...
      Column type casting - converts the column value to a Fauna type. Available
      only in CSVs; will be ignored in json/jsonl inputs. Null values will be
      treated as null and no conversion will be performed.
      Format: <column>::<type>
      <column>: the name of the column to cast values
      <type>: one of
      'number' - convert string to number
      'bool' - convert 'true', 't', 'yes', or '1' to true and all other values to
      false (saving null which will be treated as null)
      'dateString' - convert a ISO-8601 or RFC-2822 date string to a Fauna Time;
      will make a best effort on other formats,
      'dateEpochMillis' - converts milliseconds since the epoch to a Fauna Time
      'dateEpochSeconds' - converts seconds since the epoch to a Fauna Time

  --url=<value>
      Database URL. Overrides the `url` in ~/.fauna-shell

DESCRIPTION
  Import data to Fauna.

EXAMPLES
  You can combine the options in any manner of you're choosing (although type translations cannot be applied to JSON or JSONL files). Below are examples.

   ... File import examples



  Import a file into a new collection - given the same name as the file:

  $ fauna import --path ./collection_name.csv

  Append a file into a pre-existing collection - having the same name as the file:

  $ fauna import --append --path ./collection.csv

  Import a file into a new collection named "SampleCollection" in the child database "sampleDB":

  $ fauna import --db=sampleDB --collection=SampleCollection --path ./datafile.csv

  Import a file into a new collection named "SampleCollection" in the child database "sampleDB":

  $ fauna import --type=iso8601_date::dateString --type=hdr2::number --type=hdrX::bool --path ./collection.csv



   ... Directory import examples



  Import a directory - creating a new collection "SampleCollection" with data from every file in the directory:

  $ fauna import --path ./my_directory --collection=SampleCollection

  Import a directory - creating appending to the pre-existing collection "SampleCollection" with data from every file in the directory:

  $ fauna import --path ./my_directory --collection=SampleCollection --append

  Import a directory - creating creating a new collection named after the file name of each file:

  $ fauna import --path ./my_directory

  Import a directory - creating appending to pre-existing collections named after the file name of each file:

  $ fauna import --path ./my_directory --append
```

## `fauna list-databases`

Lists child databases in the current database.

This is the same as the following query:
```ts
Database.all().take(1000).toArray()
```

```sh
List child databases in the current database.

USAGE
  $ fauna list-databases [--url <value>] [--timeout <value>] [--secret
    <value>] [--endpoint <value>] [--stack <value>]

FLAGS
  --endpoint=<value>  Connection endpoint, from ~/.fauna-shell
  --secret=<value>    Secret key. Overrides the `secret` in ~/.fauna-shell
  --stack=<value>     Stack to use, from a Fauna project
  --timeout=<value>   Connection timeout in milliseconds
  --url=<value>       Database URL. Overrides the `url` in ~/.fauna-shell

DESCRIPTION
  List child databases in the current database.

EXAMPLES
  $ fauna list-databases
```

## `fauna list-keys`

List keys in the current database.

This is the same as the following query:
```ts
Key.all().take(100).toArray()
```

```sh
List keys in the current database.

USAGE
  $ fauna list-keys [--url <value>] [--timeout <value>] [--secret
    <value>] [--endpoint <value>] [--stack <value>]

FLAGS
  --endpoint=<value>  Connection endpoint, from ~/.fauna-shell
  --secret=<value>    Secret key. Overrides the `secret` in ~/.fauna-shell
  --stack=<value>     Stack to use, from a Fauna project
  --timeout=<value>   Connection timeout in milliseconds
  --url=<value>       Database URL. Overrides the `url` in ~/.fauna-shell

DESCRIPTION
  List keys in the current database.

EXAMPLES
  $ fauna list-keys
```

## `fauna project`

Commands to manage endpoints in ~/.fauna-shell.

### `fauna project init`

Creates a new `.fauna-project` file in the current directory. All flags are
optional, and the user will be prompted to fill in any missing values that are
needed.

Projects represent a selected database, and store the schema files for that
database. The project config, `.fauna-project`, will be read by commands such as
`fauna schema pull`, and schema will be pulled into the project directory.

```sh
Initialize a project directory by generating a .fauna-project file.

USAGE
  $ fauna project init [PROJECTDIR]

ARGUMENTS
  PROJECTDIR  The directory to initialize as a fauna project.  If not provided
              will default to the current directory.

DESCRIPTION
  Initialize a project directory by generating a .fauna-project file.

EXAMPLES
  $ fauna project init

  $ fauna project init path/to/some/other/dir
```

## `fauna schema`

Commands for interacting with schema (.fsl) files in a database.

### `fauna schema diff`

Print a diff between local schema files and Fauna schema.

This will search the given `DIR` recursively, and consider any files with the
`.fsl` extension a schema file. It will then fetch all schema files in the
database, and display a complete diff between all the files.

```sh
Print the diff between local and remote schema.

USAGE
  $ fauna schema diff [--url <value>] [--timeout <value>] [--secret
    <value>] [--endpoint <value>] [--stack <value>] [--dir <value>]

FLAGS
  --dir=<value>       The directory of .fsl files to push. Defaults to the
                      directory of `.fauna-project`
  --endpoint=<value>  Connection endpoint, from ~/.fauna-shell
  --secret=<value>    Secret key. Overrides the `secret` in ~/.fauna-shell
  --stack=<value>     Stack to use, from a Fauna project
  --timeout=<value>   Connection timeout in milliseconds
  --url=<value>       Database URL. Overrides the `url` in ~/.fauna-shell

DESCRIPTION
  Print the diff between local and remote schema.

EXAMPLES
  $ fauna schema diff

  $ fauna schema diff --dir schemas/myschema
```

### `fauna schema push`

Push local schema files to Fauna. Without `--force` set, the user must confirm a
diff.

Uploads a directory of schema files to a database. This will search the given
`DIR` recursively, and consider any files with the `.fsl` extension a schema
file. It will consider any files in the database that are not present locally to
be deleted. So, pushing an empty directory will delete all schema from the given
database.

After the set of schema files are found, it will then compare them to the
database's schema, and display a diff. It will then ask the user for
confirmation to apply the given update. `--force` can be passed to skip this
confirmation step.

```sh
Push the current project's .fsl files to Fauna.

USAGE
  $ fauna schema push [--url <value>] [--timeout <value>] [--secret
    <value>] [--endpoint <value>] [--stack <value>] [--dir <value>] [--force]

FLAGS
  --dir=<value>       The directory of .fsl files to push. Defaults to the
                      directory of `.fauna-project`
  --endpoint=<value>  Connection endpoint, from ~/.fauna-shell
  --force             Push the change without a diff or schema version check
  --secret=<value>    Secret key. Overrides the `secret` in ~/.fauna-shell
  --stack=<value>     Stack to use, from a Fauna project
  --timeout=<value>   Connection timeout in milliseconds
  --url=<value>       Database URL. Overrides the `url` in ~/.fauna-shell

DESCRIPTION
  Push the current project's .fsl files to Fauna.

EXAMPLES
  $ fauna schema push

  $ fauna schema push --dir schemas/myschema
```

### `fauna schema pull`

Pull schema from Fauna and save as local schema files.

This will download all schema files in the selected database. It will then place
them in the given `DIR`. It will confirm before overwriting any existing files
in `DIR`. It will also create directories for any schema files that have a `/`
in their name.

Any schema files not present in the database will be ignored. If the `--delete`
flag is passed, then all files present locally but not in the database will be
removed.

```sh
Pull a database schema's .fsl files into the current project.

USAGE
  $ fauna schema pull [--url <value>] [--timeout <value>] [--secret
    <value>] [--endpoint <value>] [--stack <value>] [--dir <value>] [--delete]

FLAGS
  --delete            Delete .fsl files in the target directory that are not
                      part of the database schema
  --dir=<value>       The directory of .fsl files to push. Defaults to the
                      directory of `.fauna-project`
  --endpoint=<value>  Connection endpoint, from ~/.fauna-shell
  --secret=<value>    Secret key. Overrides the `secret` in ~/.fauna-shell
  --stack=<value>     Stack to use, from a Fauna project
  --timeout=<value>   Connection timeout in milliseconds
  --url=<value>       Database URL. Overrides the `url` in ~/.fauna-shell

DESCRIPTION
  Pull a database schema's .fsl files into the current project.

EXAMPLES
  $ fauna schema pull
```

## `fauna shell`

Start an interactive shell.

```sh
Start an interactive shell.

USAGE
  $ fauna shell [DB_PATH] [--url <value>] [--timeout <value>]
    [--secret <value>] [--endpoint <value>] [--stack <value>] [--file <value>]
    [--stdin] [--output <value>] [--format json|json-tagged|shell] [--version
    4|10] [--typecheck]

ARGUMENTS
  DB_PATH  Database path

FLAGS
  --endpoint=<value>  Connection endpoint, from ~/.fauna-shell
  --file=<value>      File where to read queries from
  --format=<option>   Output format
                      <options: json|json-tagged|shell>
  --output=<value>    File to write output to
  --secret=<value>    Secret key. Overrides the `secret` in ~/.fauna-shell
  --stack=<value>     Stack to use, from a Fauna project
  --stdin             Read file input from stdin. Writes to stdout by default
  --timeout=<value>   Connection timeout in milliseconds
  --typecheck         Enable typechecking
  --url=<value>       Database URL. Overrides the `url` in ~/.fauna-shell
  --version=<option>  [default: 10] FQL Version
                      <options: 4|10>

DESCRIPTION
  Start an interactive shell.

EXAMPLES
  $ fauna shell

  $ fauna shell my_db/nested_db
```

## `fauna stack`

Commands to manage stacks in .fauna-project.

### `fauna stack add`

Add a new stack to .fauna-project. All flags are optional, and the user will
be prompted to fill in any missing values that are needed.

If `--non-interactive` is set, no prompts will be shown, and the `--url` and
`--secret` flags will be required.

```sh
Add a new stack to `.fauna-project`.

USAGE
  $ fauna stack add [--non-interactive --name <value> --endpoint
    <value> --database <value>] [--set-default]

FLAGS
  --database=<value>  Database path to use in this stack
  --endpoint=<value>  Endpoint to use in this stack
  --name=<value>      New stack name
  --non-interactive   Disable interaction
  --set-default       Set this stack as the default

DESCRIPTION
  Add a new stack to `.fauna-project`.

EXAMPLES
  $ fauna stack add

  $ fauna stack add --name my-app --endpoint dev --database my-database

  $ fauna stack add --name my-app --endpoint dev --database my-database --set-default
```

### `fauna stack list`

List stacks in .fauna-project.

```sh
List stacks available in `.fauna-project`.

USAGE
  $ fauna stack list

DESCRIPTION
  List stacks available in `.fauna-project`.

EXAMPLES
  $ fauna stack list
```

### `fauna stack select`

Update the default stack in .fauna-project.

```sh
Update the default stack in `.fauna-project`.

USAGE
  $ fauna stack select STACK

ARGUMENTS
  STACK  The new default stack to use

DESCRIPTION
  Update the default stack in `.fauna-project`.

EXAMPLES
  $ fauna stack select my-stack
```

## `fauna upload-graphql-schema`

Upload a GraphQL schema.

```sh
Upload GraphQL schema.

USAGE
  $ fauna upload-graphql-schema GRAPHQLFILEPATH [--url <value>] [--timeout <value>]
    [--secret <value>] [--endpoint <value>] [--stack <value>] [--graphqlHost
    <value>] [--graphqlPort <value>] [--mode merge|override|replace]

ARGUMENTS
  GRAPHQLFILEPATH  Path to GraphQL schema

FLAGS
  --endpoint=<value>     Connection endpoint, from ~/.fauna-shell
  --graphqlHost=<value>  The Fauna GraphQL API host
  --graphqlPort=<value>  GraphQL port
  --mode=<option>        [default: merge] Upload mode
                         <options: merge|override|replace>
  --secret=<value>       Secret key. Overrides the `secret` in ~/.fauna-shell
  --stack=<value>        Stack to use, from a Fauna project
  --timeout=<value>      Connection timeout in milliseconds
  --url=<value>          Database URL. Overrides the `url` in ~/.fauna-shell

DESCRIPTION
  Upload GraphQL schema.

EXAMPLES
  $ fauna upload-graphql-schema ./schema.gql

  $ fauna upload-graphql-schema ./schema.gql --mode override
```

<!-- commandsstop -->

# Development

All above commands starts with `fauna`, but you are able to run them this way
after installation of the fauna-shell package. During development, you might
want to test your changes without installing the package every single time. To
do so, you can run commands like this:

```
yarn install

./bin/dev cloud-login
./bin/dev eval
```
