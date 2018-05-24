fauna
=====

This tools gives you access to [FaunaDB](http://fauna.com/) directly from your CLI. 

It also includes a REPL so you can issue queries to FaunaDB from your CLI without the need of instally additional libraries.

<!-- [![Version](https://img.shields.io/npm/v/fauna.svg)](https://npmjs.org/package/fauna)
[![CircleCI](https://circleci.com/gh/fauna/fauna/tree/master.svg?style=shield)](https://circleci.com/gh/fauna/fauna/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/fauna/fauna?branch=master&svg=true)](https://ci.appveyor.com/project/fauna/fauna/branch/master)
[![Codecov](https://codecov.io/gh/fauna/fauna/branch/master/graph/badge.svg)](https://codecov.io/gh/fauna/fauna)
[![Downloads/week](https://img.shields.io/npm/dw/fauna.svg)](https://npmjs.org/package/fauna)
[![License](https://img.shields.io/npm/l/fauna.svg)](https://github.com/fauna/fauna/blob/master/package.json) -->

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g fauna
$ fauna COMMAND
running command...
$ fauna (-v|--version|version)
fauna/0.0.1 darwin-x64 node-v8.11.1
$ fauna --help [COMMAND]
USAGE
  $ fauna COMMAND
...
```
<!-- usagestop -->
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



./bin/run create-database my_app
query(CreateDatabase({ name: "my_app" }));

./bin/run create-key my_app server
query(
  CreateKey(
    { database: Database("my_app"), role: "server" }));

query(CreateClass({ name: "posts" }))

query(
  CreateIndex(
    {
      name: "posts_by_title",
      source: Class("posts"),
      terms: [{ field: ["data", "title"] }]
    }))
		
query(
  CreateIndex(
    {
      name: "posts_by_tags_with_title",
      source: Class("posts"),
      terms: [{ field: ["data", "tags"] }],
      values: [{ field: ["data", "title"] }]
    }))
		
query(
  Create(
    Class("posts"),
    { data: { title: "What I had for breakfast .." } }))
		
query(
	Map(
		[
			"My cat and other marvels",
			"Pondering during a commute",
			"Deep meanings in a latte"
		],
		Lambda("post_title", 
		  Create(
				Class("posts"), { data: { title: Var("post_title") } }
			))
		))
		
query(Get(Ref("classes/posts/200196258555494912")));

query(
  Update(
    Ref("classes/posts/200209136159293952"),
    { data: { tags: ["pet", "cute"] } }));
		
query(
  Replace(
    Ref("classes/posts/200209136159293952"),
    { data: { title: "My dog and other marvels" } }));
		
query(Delete(Ref("classes/posts/200209136159293952")));


query(Get(Ref("classes/posts/200209136159293952")));