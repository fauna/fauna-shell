fauna-shell
===========
<!-- [![Version](https://img.shields.io/npm/v/fauna.svg)](https://npmjs.org/package/fauna)
[![CircleCI](https://circleci.com/gh/fauna/fauna/tree/master.svg?style=shield)](https://circleci.com/gh/fauna/fauna/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/fauna/fauna?branch=master&svg=true)](https://ci.appveyor.com/project/fauna/fauna/branch/master)
[![Codecov](https://codecov.io/gh/fauna/fauna/branch/master/graph/badge.svg)](https://codecov.io/gh/fauna/fauna)
[![Downloads/week](https://img.shields.io/npm/dw/fauna.svg)](https://npmjs.org/package/fauna)
[![License](https://img.shields.io/npm/l/fauna.svg)](https://github.com/fauna/fauna/blob/master/package.json) -->

This tools gives you access to [FaunaDB](http://fauna.com/) directly from your CLI.

It also includes a [Shell](#shell) so you can issue queries to FaunaDB without needing to install additional libraries.

You can install it via npm like this:

```sh-session
$ npm install -g fauna-shell
```

<!-- toc -->
* [Usage](#usage)
* [Shell](#shell)
* [Command Details](#command-details)
* [Connecting to different endpoints](#connecting-to-different-endpoints)
* [Overriding Connection Parameters](#overriding-connection-parameters)
* [Executing queries from a file](#executing-queries-from-a-file)
* [List of Commands](#list-of-commands)
<!-- tocstop -->

# Usage

The **fauna-shell** allows you to do things like _creating_, _deleting_ and _listings_ databases.

First lets configure our connection to the FaunaDB cloud. (If you don't have an account, you can create a free account [here](https://fauna.com/sign-up)).

Let's run the following command:

```sh-session
$ fauna cloud-login
```

You will be prompted for your `email` and `password` from your [FaunaDB Cloud](https://dashboard.fauna.com/) account.

If you would like to use 3rd party identity providers like Github or Netlify, please refer to [this guide](https://docs.fauna.com/fauna/current/start/cloud-github.html).

Now that we have an endpoint to connect to we can try to create a database to start playing with FaunaDB. See [connecting to different endpoints](#connecting-to-different-endpoints).

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

This is how to list keys (the results may differ from what you see in your instance of FaunaDB)

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

# Shell

The Fauna Shell lets you issue queries directly to your FaunaDB instance without the need for installing additional libraries.

Let's create a database and then we'll jump straight into the Shell to start playing with FaunaDB's data model.

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

Once you have the prompt ready, you can start issues queries against your FaunaDB instance. (Note that the results shown here might vary from the ones you see while running the examples).

```javascript
my_app> CreateCollection({ name: "posts" })
{
  ref: Collection("posts"),
  ts: 1532624109799742,
  history_days: 30,
  name: 'posts'
}
```

Let's create an index for our _posts_.

```javascript
my_app> CreateIndex(
    {
      name: "posts_by_title",
      source: Collection("posts"),
      terms: [{ field: ["data", "title"] }]
    })
{
  ref: Index("posts_by_title"),
  ts: 1532624135128797,
  active: false,
  partitions: 1,
  name: 'posts_by_title',
  source: Collection("posts"),
  terms: [ { field: [ 'data', 'title' ] } ]
}
```

Let's insert a _post_ item:

```javascript
my_app> Create(
    Collection("posts"),
    { data: { title: "What I had for breakfast .." } })
{
  ref: Ref(Collection("posts"), "205904004461363712"),
  ts: 1532624210670859,
  data: { title: 'What I had for breakfast ..' }
}
```

We can also insert items in bulk by using the `Map` function.

```javascript
my_app> Map(
		[
			"My cat and other marvels",
			"Pondering during a commute",
			"Deep meanings in a latte"
		],
		Lambda("post_title",
		  Create(
				Collection("posts"), { data: { title: Var("post_title") } }
			))
		)
[
  {
    ref: Ref(Collection("posts"), "205904031076321792"),
    ts: 1532624236071215,
    data: { title: 'My cat and other marvels' } 
  },
  {
    ref: Ref(Collection("posts"), "205904031076320768"),
    ts: 1532624236071215,
    data: { title: 'Pondering during a commute' } 
  },
  {
    ref: Ref(Collection("posts"), "205904031076319744"),
    ts: 1532624236071215,
    data: { title: 'Deep meanings in a latte' } 
  }
]
```

Now let's try to fetch our post about _latte_. We need to access it by _id_ like this:

```javascript
my_app> Get(Ref(Collection("posts"),"205904031076319744"))
{
  ref: Ref(Collection("posts"), "205904031076319744"),
  ts: 1532624236071215,
  data: { title: 'Deep meanings in a latte' }
}
```

Now let's update our post about our cat, by adding some tags:

```javascript
my_app> Update(
    Ref(Collection("posts"), "205904031076321792"),
    { data: { tags: ["pet", "cute"] } })
{
  ref: Ref(Collection("posts"), "205904031076321792"),
  ts: 1532624327263554,
  data: { title: 'My cat and other marvels', tags: [ 'pet', 'cute' ] }
}
```

And now let's try to change the content of that post:

```javascript
my_app> Replace(
    Ref(Collection("posts"), "205904031076321792"),
    { data: { title: "My dog and other marvels" } })
{
  ref: Ref(Collection("posts"), "205904031076321792"),
  ts: 1532624352388889,
  data: { title: 'My dog and other marvels' } 
}
```

Now let's try to delete our post about _latte_:

```javascript
my_app> Delete(Ref(Collection("posts"), "205904031076319744"))
{
  ref: Ref(Collection("posts"), "205904031076319744"),
  ts: 1532624236071215,
  data: { title: 'Deep meanings in a latte' } 
}
```

If we try to fetch it, we will receive an error:

```javascript
my_app> Get(Ref(Collection("posts"), "205904031076319744"))
 Error: instance not found
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

The _default endpoint_ will be used by the shell to connect to FaunaDB.

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
secret=the_secret

[cloud]
domain=db.fauna.com
scheme=https
secret=FAUNA_SECRET_KEY

[cluster-us-east]
domain=cluster-us-east.example.com
port=443
scheme=https
secret=OTHER_FAUNA_SECRET
```

# Connecting to local endpoints

If you are running Fauna locally using our Docker images, you may need to configure the Shell to work with local endpoints so you can interact with the databases running in the Docker containers.

Once you've installed the Shell and logged in, you can configure this by doing the following:

1. Run `fauna list-endpoints` to see all your endpoints. If you haven't added any yet, you should just see the `cloud` endpoint that was added when you went through the login flow.

2. By default, the Fauna Docker image serves data via port 8443 (check your Docker logs to confirm the port number). To add this, run the follwing:

```bash
fauna add-endpoint http://localhost:8443 # Doesn't work with HTTPS
```

3. When prompted, provide the endpint key and then give it a name (ex. `localhost`)

4. Now, you can interact with your local database through the Fauna Shell by running the command below:

```bash
fauna shell --endpoint localhost
```

# Overriding Connection Parameters

Most commands support the following options. You can specify them if you want to connect to your local FaunaDB instance.

```
OPTIONS
	--domain=domain      [default: db.fauna.com] FaunaDB server domain
	--port=port          [default: 443] Connection port
	--scheme=https|http  [default: https] Connection scheme
	--secret=secret      FaunaDB secret key
	--timeout=timeout    [default: 80] Connection timeout in milliseconds
	--endpoint=alias     Overrides the default endpoint set in ~/.fauna-shell
```

They can be used like this:

```sh-session
$ fauna create-database testdb --domain=127.0.0.1 port=8443 --scheme=http --secret=YOUR_FAUNA_SECRET_KEY --timeout=42
```

Options provided via the CLI will override the values set in the `.fauna-shell` config file.

For example you can start a shell to a different endpoint from the one set in `.fauna-shell`:

```sh-session
$ fauna shell my_app --endpoint=endpoint_alias
```

Any options that are not specified either via the `.fauna-shell` config file or the CLI will be set to the defaults offered by the [faunadb-js client](https://github.com/fauna/faunadb-js).

# Executing queries from a file

You can also tell the shell to execute a list of queries that you have stored in a file. For example, you can have a filed called `queries.fql` with the following content:

```javascript
CreateCollection({ name: "posts" });
CreateIndex(
	{
		name: "posts_by_title",
		source: Collection("posts"),
		terms: [{ field: ["data", "title"] }]
	});
Create(
	Collection("posts"),
	{ data: { title: "What I had for breakfast .." } });
Map(
	[
		"My cat and other marvels",
		"Pondering during a commute",
		"Deep meanings in a latte"
	],
	Lambda("post_title",
	Create(
		Collection("posts"), { data: { title: Var("post_title") } }
	))
);
```

You can tell Fauna Shell to execute all those queries for you by running the following command:

```bash
$ fauna run-queries my_app --file=./queries.fql
```

Where `my_app` is the name of your database, and `./queries.fql` is the path to the file where you saved the queries.

Queries have to be written in the syntax supported by FaunaDB's Javascript [driver](https://github.com/fauna/faunadb-js).

<!-- detailsstop -->
# List of Commands
<!-- commands -->
* [`fauna add-endpoint ENDPOINT`](#fauna-add-endpoint-endpoint)
* [`fauna autocomplete [SHELL]`](#fauna-autocomplete-shell)
* [`fauna cloud-login`](#fauna-cloud-login)
* [`fauna create-database DBNAME`](#fauna-create-database-dbname)
* [`fauna create-key DBNAME [ROLE]`](#fauna-create-key-dbname-role)
* [`fauna default-endpoint ENDPOINT_ALIAS`](#fauna-default-endpoint-endpoint-alias)
* [`fauna delete-database DBNAME`](#fauna-delete-database-dbname)
* [`fauna delete-endpoint ENDPOINT_ALIAS`](#fauna-delete-endpoint-endpoint-alias)
* [`fauna delete-key KEYNAME`](#fauna-delete-key-keyname)
* [`fauna help [COMMAND]`](#fauna-help-command)
* [`fauna list-databases`](#fauna-list-databases)
* [`fauna list-endpoints`](#fauna-list-endpoints)
* [`fauna list-keys`](#fauna-list-keys)
* [`fauna run-queries DBNAME`](#fauna-run-queries-dbname)
* [`fauna shell [DBNAME]`](#fauna-shell-dbname)
* [`fauna eval [QUERY]`](#fauna-eval-query)

## `fauna add-endpoint ENDPOINT`

Adds a connection endpoint for FaunaDB

```
USAGE
  $ fauna add-endpoint ENDPOINT

ARGUMENTS
  ENDPOINT  FaunaDB server endpoint

DESCRIPTION
  Adds a connection endpoint for FaunaDB

EXAMPLE
  $ fauna add-endpoint https://db.fauna.com:443
  $ fauna add-endpoint http://localhost:8443/ --alias localhost --key secret
```

_See code: [src/commands/add-endpoint.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/add-endpoint.js)_

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

Adds the FaunaDB Cloud endpoint.

```
USAGE
  $ fauna cloud-login

DESCRIPTION
  Adds the FaunaDB Cloud endpoint

EXAMPLE
  $ fauna cloud-login
```

_See code: [src/commands/cloud-login.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/cloud-login.js)_

## `fauna create-database DBNAME`

Creates a database

```
USAGE
  $ fauna create-database DBNAME

ARGUMENTS
  DBNAME  database name

OPTIONS
  --domain=domain      FaunaDB server domain
  --endpoint=endpoint  FaunaDB server endpoint
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      FaunaDB secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Creates a database

EXAMPLE
  $ fauna create-database dbname
```

_See code: [src/commands/create-database.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/create-database.js)_

## `fauna create-key DBNAME [ROLE]`

Creates a key for the specified database

```
USAGE
  $ fauna create-key DBNAME [ROLE]

ARGUMENTS
  DBNAME  database name
  ROLE    (admin|server|server-readonly|client) key user role

OPTIONS
  --domain=domain      FaunaDB server domain
  --endpoint=endpoint  FaunaDB server endpoint
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      FaunaDB secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Creates a key for the specified database

EXAMPLE
  $ fauna create-key dbname admin
```

_See code: [src/commands/create-key.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/create-key.js)_

## `fauna default-endpoint ENDPOINT_ALIAS`

Sets an endpoint as the default one

```
USAGE
  $ fauna default-endpoint ENDPOINT_ALIAS

ARGUMENTS
  ENDPOINT_ALIAS  FaunaDB server endpoint alias

DESCRIPTION
  Sets an endpoint as the default one

EXAMPLE
  $ fauna default-endpoint endpoint
```

_See code: [src/commands/default-endpoint.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/default-endpoint.js)_

## `fauna delete-database DBNAME`

Deletes a database

```
USAGE
  $ fauna delete-database DBNAME

ARGUMENTS
  DBNAME  database name

OPTIONS
  --domain=domain      FaunaDB server domain
  --endpoint=endpoint  FaunaDB server endpoint
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      FaunaDB secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Deletes a database

EXAMPLE
  $ fauna delete-database dbname
```

_See code: [src/commands/delete-database.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/delete-database.js)_

## `fauna delete-endpoint ENDPOINT_ALIAS`

Deletes a connection endpoint for FaunaDB

```
USAGE
  $ fauna delete-endpoint ENDPOINT_ALIAS

ARGUMENTS
  ENDPOINT_ALIAS  FaunaDB server endpoint alias

DESCRIPTION
  Deletes a connection endpoint for FaunaDB

EXAMPLE
  $ fauna delete-endpoint endpoint_alias
```

_See code: [src/commands/delete-endpoint.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/delete-endpoint.js)_

## `fauna delete-key KEYNAME`

Deletes a key

```
USAGE
  $ fauna delete-key KEYNAME

ARGUMENTS
  KEYNAME  key name

OPTIONS
  --domain=domain      FaunaDB server domain
  --endpoint=endpoint  FaunaDB server endpoint
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      FaunaDB secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Deletes a key

EXAMPLE
  $ fauna delete-key 123456789012345678
```

_See code: [src/commands/delete-key.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/delete-key.js)_

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
  --domain=domain      FaunaDB server domain
  --endpoint=endpoint  FaunaDB server endpoint
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      FaunaDB secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Lists child databases in the current database

EXAMPLE
  $ fauna list-databases
```

_See code: [src/commands/list-databases.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/list-databases.js)_

## `fauna list-endpoints`

Lists FaunaDB connection endpoints

```
USAGE
  $ fauna list-endpoints

DESCRIPTION
  Lists FaunaDB connection endpoints

EXAMPLE
  $ fauna list-endpoints
```

_See code: [src/commands/list-endpoints.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/list-endpoints.js)_

## `fauna list-keys`

Lists top level keys

```
USAGE
  $ fauna list-keys

OPTIONS
  --domain=domain      FaunaDB server domain
  --endpoint=endpoint  FaunaDB server endpoint
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      FaunaDB secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Lists top level keys

EXAMPLE
  $ fauna list-keys
```

_See code: [src/commands/list-keys.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/list-keys.js)_

## `fauna run-queries DBNAME`

Runs the queries found on the file passed to the command.

```
USAGE
  $ fauna run-queries DBNAME

ARGUMENTS
  DBNAME  database name

OPTIONS
  --domain=domain      FaunaDB server domain
  --endpoint=endpoint  FaunaDB server endpoint
  --file=file          File where to read queries from
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      FaunaDB secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Runs the queries found on the file passed to the command.

EXAMPLE
  $ fauna run-queries dbname --file=/path/to/queries.fql
```

_See code: [src/commands/run-queries.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/run-queries.js)_

## `fauna shell [DBNAME]`

Starts a FaunaDB shell

```
USAGE
  $ fauna shell [DBNAME]

ARGUMENTS
  DBNAME  database name

OPTIONS
  --domain=domain      FaunaDB server domain
  --endpoint=endpoint  FaunaDB server endpoint
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      FaunaDB secret key
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Starts a FaunaDB shell

EXAMPLE
  $ fauna shell dbname
```

_See code: [src/commands/shell.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/shell.js)_

## `fauna eval [QUERY]`

Evaluates a fauna query

```
USAGE
  $ fauna eval [QUERY]

ARGUMENTS
  QUERY  FQL query to execute

OPTIONS
  --domain=domain      FaunaDB server domain
  --endpoint=endpoint  FaunaDB server endpoint
  --file=file          File where to read queries from
  --format=json|shell  [default: json] Output format
  --output=output      File to write output to
  --port=port          Connection port
  --scheme=https|http  Connection scheme
  --secret=secret      FaunaDB secret key
  --stdin              Read file input from stdin. Writes to stdout by default
  --timeout=timeout    Connection timeout in milliseconds

DESCRIPTION
  Runs the specified query. Can read from stdin, file or command line.
  Outputs to either stdout or file.
  Output format can be specified.

EXAMPLES
  $ fauna eval "Paginate(Collections())"
  $ fauna eval --file=/path/to/queries.fql
  $ echo "Add(1,1)" | fauna eval --stdin
  $ fauna eval "Add(2,3)" "--output=/tmp/result"
  $ fauna eval "Add(2,3)" "--format=json" "--output=/tmp/result"
```

_See code: [src/commands/shell.js](https://github.com/fauna/fauna-shell/blob/v0.9.9/src/commands/eval.js)_

<!-- commandsstop -->
