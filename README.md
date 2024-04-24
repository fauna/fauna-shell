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

You can upgrade like this:

```
$ npm update -g fauna-shell
```

<!-- toc -->
* [Fauna CLI](#fauna-cli)
* [Usage](#usage)
* [Technical Requirements](#technical-requirements)
* [Shell](#shell)
* [Connecting to different endpoints](#connecting-to-different-endpoints)
* [Connecting to local endpoints](#connecting-to-local-endpoints)
* [Overriding Connection Parameters](#overriding-connection-parameters)
* [Executing queries from a file](#executing-queries-from-a-file)
* [List of Commands](#list-of-commands)
* [Development](#development)
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
