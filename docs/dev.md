# Fauna Shell #

This is an attempt to describe what are the project goals, and give an architectural overview of where things are implemented.

## Project Goals ##

1. Help people get started with FaunaDB.

The ideal path would be:

- Login to Fauna Cloud: `$ fauna cloud-login`
- Create a Database: `$ fauna create-database my_app`
- Start an interactive shell: `$ fauna shell my_app`
- Send queries to FaunaDB from the interactive Shell: `my_app> CreateCollection({ name: "posts" })`

For that we offer installs via npm: https://www.npmjs.com/package/fauna-shell and Mac users have the option to also install via homebrew, so we support this repo: https://github.com/fauna/homebrew-fauna-shell-tap

The project uses the [faunadb-js](https://github.com/fauna/faunadb-js) client. The idea is to bundle it with the shell so the user doesn't need to install any extra software or libraries to get started with FaunaDB.

2. Help people clear initial hurdles.

A required step before start experimenting with FaunaDB is to have a database with its respective key. The shell offers a set of commands that help the user with tasks like creating/deleting databases and keys.

3. Help people connect to FaunaDB (cloud or self hosted)

The user should have an easy way to handle the configuration to the various endpoints they might want to connect to.

For that the shell offers a file called `.fauna-shell`, stored at their home directory, where `fauna` will store the connection parameters for the endpoints.

Adding an endpoint should be as easy as typing: `$ fauna add-endpoint "https://example.org:443"`.

Connecting to the FaunaDB Cloud should be as easy as typing: `$ fauna cloud-login`. The user will be prompted for their email & passwords, and their key will be saved in the `.fauna-shell` file.

3. Provide an easy to use shell (REPL) for interacting with FaunaDB.

When the user starts the shell by typing `$ fauna shell my_app`, they get an interactive prompt where they can type FaunaDB queries right away.

Usually queries are wrapped around the `Query()` constructor. This is not required in the shell.

Also usually functions like `CreateCollection` or `CreateIndex` are scoped to the `q` module like this: `q.CreateIndex()`. This is not required for the shell, since the `q` module is already in scope.

The less key strokes the user has to type, the better.

4. Make the experience as smooth as possible.

Commands should provide clear error messages. A confusing error message could put a user away from FaunaDB. We want to prevent that as much as possible.

Commands should also provide guidance. For example `create-database` explains to the user how to go from there, like how to start a shell for that particular database.

## Adding New Commands ##

The project uses the [oclif](https://oclif.io/) framework for creating CLI tools (It was created by Heroku for their own tooling). Check their docs if you want to learn the details about how to create commands.

All commands extend our custom [FaunaCommand](https://github.com/fauna/fauna-shell/blob/master/src/lib/fauna_command.js).

If your command needs to connect to FaunaDB and accept parameters `like`, `domain`, `scheme`, `port`, `timeout` or `secret`, then extending FaunaCommand will handle that for you. The only requisite is that you define your command [flags](https://oclif.io/docs/flags.html) like this:

```javascript
MyNewCommandCommand.flags = {
	...FaunaCommand.flags
}

```

Besides that, `FaunaCommand` offers a set of helper methods that let you work with FaunaDB queries without worrying about having to create a connection:

```javascript
class MyNewCommandCommand extends FaunaCommand {
	async run() {
		this.query(...)
	}
```

See other commands for complete examples on how to do that, and check the FaunaCommand API to see a list of available methods.

## Helper Functions ##

Helper functions are defined in the [misc](https://github.com/fauna/fauna-shell/blob/master/src/lib/misc.js) module.

These functions let you do things from reading/writing the shell's config file, to building configuration options for creating a connection to FaunaDB.

## Running Tests ##

To run the tests you need to setup the following shell flags: `FAUNA_SECRET, FAUNA_DOMAIN, FAUNA_SCHEME, FAUNA_PORT`

For example:

```bash
export FAUNA_SECRET=your_fauna_secret
export FAUNA_DOMAIN=db.fauna.com
export FAUNA_SCHEME=https
export FAUNA_PORT=443
```
