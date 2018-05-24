fauna-shell
=========
<!-- [![Version](https://img.shields.io/npm/v/fauna.svg)](https://npmjs.org/package/fauna)
[![CircleCI](https://circleci.com/gh/fauna/fauna/tree/master.svg?style=shield)](https://circleci.com/gh/fauna/fauna/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/fauna/fauna?branch=master&svg=true)](https://ci.appveyor.com/project/fauna/fauna/branch/master)
[![Codecov](https://codecov.io/gh/fauna/fauna/branch/master/graph/badge.svg)](https://codecov.io/gh/fauna/fauna)
[![Downloads/week](https://img.shields.io/npm/dw/fauna.svg)](https://npmjs.org/package/fauna)
[![License](https://img.shields.io/npm/l/fauna.svg)](https://github.com/fauna/fauna/blob/master/package.json) -->

This tools gives you access to [FaunaDB](http://fauna.com/) directly from your CLI. 

It also includes a [Shell](#shell) so you can issue queries to FaunaDB without the need of install additional libraries.

<!-- toc -->
* [Usage](#usage)
* [Shell](#shell)
* [Installation](#installation)
* [Commands](#commands)
<!-- tocstop -->

# Usage

The tool allows you to do things like _creating_, _deleting_ and _listings_ databases.

This is how you can create a database called `my_app`:

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

See [Commands](#commands) for a list of commnads and help on their usage.

# Shell

The Fauna Shell lets you issue queries directly to your FaunaDB instance without the need for installing additinal libraries.

Let's create a database and then we'll jump straight into the Shell to start playing with FaunaDB's data model.

```sh-session
fauna create-database my_app
```

Our next step is to start the shell for a specific database, in this case `my_app`: 

```sh-session
fauna shell my_app
starting shell for database my_app
faunadb>
```

Once you have the prompt ready, you can start issues queries against your FaunaDB instance. (Note that the results shown here might vary from the ones ytou see while running the examples).

```javascript
faunadb> query(CreateClass({ name: "posts" }))
faunadb>
 { ref: Ref(id=posts, class=Ref(id=classes)),
  ts: 1527204921493935,
  history_days: 30,
  name: 'posts' }
```

Let's create an index for our _posts_.

```javascript
faunadb> query(
  CreateIndex(
    {
      name: "posts_by_title",
      source: Class("posts"),
      terms: [{ field: ["data", "title"] }]
    }))
faunadb>
 { ref: Ref(id=posts_by_title, class=Ref(id=indexes)),
 ts: 1527204953090934,
 active: false,
 partitions: 1,
 name: 'posts_by_title',
 source: Ref(id=posts, class=Ref(id=classes)),
 terms: [ { field: [Array] } ] }
```

Let's insert a _post_ item:

```javascript
faunadb> query(
  Create(
    Class("posts"),
    { data: { title: "What I had for breakfast .." } }))
faunadb>
 { ref: Ref(id=200221588659896832, class=Ref(id=posts, class=Ref(id=classes))),
  ts: 1527205036673645,
  data: { title: 'What I had for breakfast ..' } }
```

We can also insert items in bulk by using the `Map` function.

```javascript
faunadb> query(
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
faunadb>
 [ { ref: Ref(id=200221673472919040, class=Ref(id=posts, class=Ref(id=classes))),
    ts: 1527205117556412,
    data: { title: 'My cat and other marvels' } },
  { ref: Ref(id=200221673472918016, class=Ref(id=posts, class=Ref(id=classes))),
    ts: 1527205117556412,
    data: { title: 'Pondering during a commute' } },
  { ref: Ref(id=200221673471869440, class=Ref(id=posts, class=Ref(id=classes))),
    ts: 1527205117556412,
    data: { title: 'Deep meanings in a latte' } } ]
```



```javascript
faunadb> query(Get(Ref("classes/posts/200221673471869440")))
faunadb>
 { ref: Ref(id=200221673471869440, class=Ref(id=posts, class=Ref(id=classes))),
  ts: 1527205117556412,
  data: { title: 'Deep meanings in a latte' } }
```

```javascript
faunadb> query(
  Update(
    Ref("classes/posts/200221673472919040"),
    { data: { tags: ["pet", "cute"] } }))
faunadb>
{ ref: Ref(id=200221673472919040, class=Ref(id=posts, class=Ref(id=classes))),
  ts: 1527205328606603,
  data: { title: 'My cat and other marvels', tags: [ 'pet', 'cute' ] } }
```

```javascript
faunadb> query(
  Replace(
    Ref("classes/posts/200221673472919040"),
    { data: { title: "My dog and other marvels" } }))
 { ref: Ref(id=200221673472919040, class=Ref(id=posts, class=Ref(id=classes))),
  ts: 1527205345816901,
  data: { title: 'My dog and other marvels' } }
faunadb>

```

```javascript
faunadb> query(Delete(Ref("classes/posts/200221673471869440")))
faunadb>
 { ref: Ref(id=200221673471869440, class=Ref(id=posts, class=Ref(id=classes))),
  ts: 1527205117556412,
  data: { title: 'Deep meanings in a latte' } }
```

```javascript
faunadb> query(Get(Ref("classes/posts/200221673471869440")))
faunadb>
 Error: instance not found
```

Finally you can exit the _shell_ by pressing `ctrl+d`.

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
* [`fauna-shell create-database DBNAME`](#fauna-shell-create-database-dbname)
* [`fauna-shell create-key DBNAME [ROLE]`](#fauna-shell-create-key-dbname-role)
* [`fauna-shell create_class`](#fauna-shell-create-class)
* [`fauna-shell db [ACTION] [DBNAME]`](#fauna-shell-db-action-dbname)
* [`fauna-shell delete-database DBNAME`](#fauna-shell-delete-database-dbname)
* [`fauna-shell delete-key KEYNAME`](#fauna-shell-delete-key-keyname)
* [`fauna-shell help [COMMAND]`](#fauna-shell-help-command)
* [`fauna-shell list-databases`](#fauna-shell-list-databases)
* [`fauna-shell list-keys`](#fauna-shell-list-keys)
* [`fauna-shell shell DBNAME`](#fauna-shell-shell-dbname)

## `fauna-shell create-database DBNAME`

Creates a database

```
USAGE
  $ fauna-shell create-database DBNAME

ARGUMENTS
  DBNAME  database name

DESCRIPTION
  Creates a database


EXAMPLE
  $ fauna-shell create-database dbname
```

_See code: [src/commands/create-database.js](https://github.com/fauna/fauna-shell/blob/v0.0.1/src/commands/create-database.js)_

## `fauna-shell create-key DBNAME [ROLE]`

Creates a key for the specified database

```
USAGE
  $ fauna-shell create-key DBNAME [ROLE]

ARGUMENTS
  DBNAME  database name
  ROLE    [default: admin] key user role

DESCRIPTION
  Creates a key for the specified database


EXAMPLE
  $ fauna-shell create-key dbname admin
```

_See code: [src/commands/create-key.js](https://github.com/fauna/fauna-shell/blob/v0.0.1/src/commands/create-key.js)_

## `fauna-shell create_class`

Describe the command here

```
USAGE
  $ fauna-shell create_class

OPTIONS
  -d, --database=database  database name
  -n, --name=name          class name

DESCRIPTION
  Describe the command here
  ...
  Extra documentation goes here
```

_See code: [src/commands/create_class.js](https://github.com/fauna/fauna-shell/blob/v0.0.1/src/commands/create_class.js)_

## `fauna-shell db [ACTION] [DBNAME]`

Describe the command here

```
USAGE
  $ fauna-shell db [ACTION] [DBNAME]

DESCRIPTION
  Describe the command here
  ...
  Extra documentation goes here
```

_See code: [src/commands/db.js](https://github.com/fauna/fauna-shell/blob/v0.0.1/src/commands/db.js)_

## `fauna-shell delete-database DBNAME`

Deletes a database

```
USAGE
  $ fauna-shell delete-database DBNAME

ARGUMENTS
  DBNAME  database name

DESCRIPTION
  Deletes a database


EXAMPLE
  $ fauna-shell delete-database dbname
```

_See code: [src/commands/delete-database.js](https://github.com/fauna/fauna-shell/blob/v0.0.1/src/commands/delete-database.js)_

## `fauna-shell delete-key KEYNAME`

Deletes a key

```
USAGE
  $ fauna-shell delete-key KEYNAME

ARGUMENTS
  KEYNAME  key name

DESCRIPTION
  Deletes a key


EXAMPLE
  $ fauna-shell delete-key 123456789012345678
```

_See code: [src/commands/delete-key.js](https://github.com/fauna/fauna-shell/blob/v0.0.1/src/commands/delete-key.js)_

## `fauna-shell help [COMMAND]`

display help for fauna-shell

```
USAGE
  $ fauna-shell help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v1.2.11/src/commands/help.ts)_

## `fauna-shell list-databases`

Lists top level databases

```
USAGE
  $ fauna-shell list-databases

DESCRIPTION
  Lists top level databases


EXAMPLE
  $ fauna-shell list-databases
```

_See code: [src/commands/list-databases.js](https://github.com/fauna/fauna-shell/blob/v0.0.1/src/commands/list-databases.js)_

## `fauna-shell list-keys`

Lists top level keys

```
USAGE
  $ fauna-shell list-keys

DESCRIPTION
  Lists top level keys


EXAMPLE
  $ fauna-shell list-keys
```

_See code: [src/commands/list-keys.js](https://github.com/fauna/fauna-shell/blob/v0.0.1/src/commands/list-keys.js)_

## `fauna-shell shell DBNAME`

Starts a FaunaDB shell

```
USAGE
  $ fauna-shell shell DBNAME

ARGUMENTS
  DBNAME  database name

DESCRIPTION
  Starts a FaunaDB shell


EXAMPLE
  $ fauna-shell dbname
```

_See code: [src/commands/shell.js](https://github.com/fauna/fauna-shell/blob/v0.0.1/src/commands/shell.js)_
<!-- commandsstop -->
