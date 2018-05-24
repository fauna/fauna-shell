fauna
=====
<!-- [![Version](https://img.shields.io/npm/v/fauna.svg)](https://npmjs.org/package/fauna)
[![CircleCI](https://circleci.com/gh/fauna/fauna/tree/master.svg?style=shield)](https://circleci.com/gh/fauna/fauna/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/fauna/fauna?branch=master&svg=true)](https://ci.appveyor.com/project/fauna/fauna/branch/master)
[![Codecov](https://codecov.io/gh/fauna/fauna/branch/master/graph/badge.svg)](https://codecov.io/gh/fauna/fauna)
[![Downloads/week](https://img.shields.io/npm/dw/fauna.svg)](https://npmjs.org/package/fauna)
[![License](https://img.shields.io/npm/l/fauna.svg)](https://github.com/fauna/fauna/blob/master/package.json) -->

This tools gives you access to [FaunaDB](http://fauna.com/) directly from your CLI. 

It also includes a REPL so you can issue queries to FaunaDB from your CLI without the need of instally additional libraries.

It allows you to do things like creating databases directly from the command line:

```sh-session
$ fauna create-database my_app
creating database my_app
{ ref: Ref(id=my_app, class=Ref(id=databases)),
  ts: 1527202906492280,
  name: 'my_app' }
```

And then listing your databases:

```sh-session
$ fauna list-databases        
listing databases
[ Ref(id=my_app, class=Ref(id=databases)),
  Ref(id=my_second_app, class=Ref(id=databases)),
  Ref(id=my_other_app, class=Ref(id=databases)) ]
```

You can also delete a particular database:

```sh-session
$ fauna delete-database my_other_app
deleting database my_other_app
{ ref: Ref(id=my_other_app, class=Ref(id=databases)),
  ts: 1527202988832864,
  name: 'my_other_app' }
```

You can also `create`, `list`, and `delete` _keys_.

This is how you create a key for the database `my_app`:

```sh-session
$ fauna create-key my_app
creating key for database my_app with role admin
{ ref: Ref(id=200219648752353792, class=Ref(id=keys)),
  ts: 1527203186632830,
  database: Ref(id=my_app, class=Ref(id=databases)),
  role: 'admin',
  secret: 'fnACx1K1sPACABUvNQMZjWNZgsKUVo83btQy0i1x',
  hashed_secret: '************************************************************' }
```

This is how to list keys (the results may differ from what you see in your instance of FaunaDB)

```sh-session
$ fauna list-keys
listing keys
[ Ref(id=200219648752353792, class=Ref(id=keys)),
  Ref(id=200219702370238976, class=Ref(id=keys)) ]
```

And then delete the key with id: `200219702370238976`:

```sh-session
./bin/run delete-key 200219702370238976
deleting key 200219702370238976
{ ref: Ref(id=200219702370238976, class=Ref(id=keys)),
  ts: 1527203237774958,
  database: Ref(id=my_second_app, class=Ref(id=databases)),
  role: 'admin',
  hashed_secret: '************************************************************' }
```

<!-- toc -->
* [Installation](#Usage)
* [Usage](#Usage)
* [Commands](#commands)
<!-- tocstop -->
# Installation
<!-- installation -->
```sh-session
$ npm install -g fauna-cli
$ fauna COMMAND
running command...
$ fauna (-v|--version|version)
fauna/0.0.1 darwin-x64 node-v8.11.1
$ fauna --help [COMMAND]
USAGE
  $ fauna COMMAND
...
```
<!-- installationstop -->
# Commands
<!-- commands -->
* [`fauna shell DBNAME`](#fauna-shell-dbname)
* [`fauna create-database`](#fauna-create-database-dbname)
* [`fauna delete-database`](#fauna-delete-database-dbname)
* [`fauna list-databases`](#fauna-list-databases)
* [`fauna create-key`](#fauna-create-key-dbname-role)
* [`fauna delete-key`](#fauna-delete-key-dbname)
* [`fauna list-keys`](#fauna-list-keys)
* [`fauna help [COMMAND]`](#fauna-help-command)

## `fauna shell DBNAME`

Starts a *shell* that lets you talk to [FaunaDB](http://fauna.com/) by using a preloaded and scoped [faunadb-js](https://github.com/fauna/faunadb-js) client.

```
USAGE
  $ fauna shell DBNAME

ARGUMENTS
  DBNAME  database name

DESCRIPTION
  Starts a FaunaDB shell


EXAMPLE
  $ fauna dbname
```

## `fauna create-database DBNAME`

```
USAGE
  $ fauna create-database DBNAME

ARGUMENTS
  DBNAME  database name

DESCRIPTION
  Creates a database

EXAMPLE
  $ fauna create-database dbname
```

## `fauna delete-database DBNAME`

```
USAGE
  $ fauna delete-database DBNAME

ARGUMENTS
  DBNAME  database name

DESCRIPTION
  Deletes a database


EXAMPLE
  $ fauna delete-database dbname
```

## `fauna list-databases`

```
USAGE
  $ fauna list-databases

DESCRIPTION
  Lists top level databases


EXAMPLE
  $ fauna list-databases
```

## `fauna create-key DBNAME [ROLE]`

```
USAGE
  $ fauna create-key DBNAME [ROLE]

ARGUMENTS
  DBNAME  database name
  ROLE    [default: admin] key user role

DESCRIPTION
  Creates a key for the specified database


EXAMPLE
  $ fauna create-key dbname admin
```

## `fauna delete-key KEYNAME`

```
USAGE
  $ fauna delete-key KEYNAME

ARGUMENTS
  KEYNAME  key name

DESCRIPTION
  Deletes a key


EXAMPLE
  $ fauna delete-key 123456789012345678
```

## `fauna list-keys`

```
USAGE
  $ fauna list-keys

DESCRIPTION
  Lists top level keys


EXAMPLE
  $ fauna list-keys
```

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v1.2.10/src/commands/help.ts)_
<!-- commandsstop -->