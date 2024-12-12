# Fauna CLI v4 (beta)

<!-- [![Version](https://img.shields.io/npm/v/fauna.svg)](https://npmjs.org/package/fauna)
[![CircleCI](https://circleci.com/gh/fauna/fauna/tree/master.svg?style=shield)](https://circleci.com/gh/fauna/fauna/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/fauna/fauna?branch=master&svg=true)](https://ci.appveyor.com/project/fauna/fauna/branch/master)
[![Codecov](https://codecov.io/gh/fauna/fauna/branch/master/graph/badge.svg)](https://codecov.io/gh/fauna/fauna)
[![Downloads/week](https://img.shields.io/npm/dw/fauna.svg)](https://npmjs.org/package/fauna)
[![License](https://img.shields.io/npm/l/fauna.svg)](https://github.com/fauna/fauna/blob/master/package.json) -->

> [!IMPORTANT]
> v4 of the Fauna CLI is in beta. For the latest GA version, see the [Fauna CLI v3
> docs](https://docs.fauna.com/fauna/current/build/cli/).

The Fauna CLI lets you access [Fauna](http://fauna.com/) from your terminal.
You can use the CLI to:

- Create and manage Fauna
  [databases](https://docs.fauna.com/fauna/current/learn/data-model/databases/).
- Manage [database schema](https://docs.fauna.com/fauna/current/learn/schema/)
  as `.fsl` files on your local machine.
- Run [FQL queries](https://docs.fauna.com/fauna/current/learn/query/) from
  files or in an interactive REPL.
- Run a [local Fauna container](https://docs.fauna.com/fauna/current/build/tools/docker/).

![fauna-cli](https://github.com/user-attachments/assets/d3e88ad9-68ae-4011-945a-23654f9fbd0a)

## Requirements

- [Node.js](https://nodejs.org/en/download/package-manager) v20.x or later.
- A Fauna account. You can sign up for a free account at https://dashboard.fauna.com/register.

## Quick start

To get started:

1. Install the CLI:

   ```shell
   npm install -g fauna-shell@beta
   ```

2. If you're using bash or zsh, enable auto-complete by appending the output of
   `fauna completion` to your `.bashrc`, `.bash_profile`, `.zshrc,` or
   `.zprofile`. For example:

   ```shell
   fauna completion >> ~/.zshrc
   ```

3. Authenticate with Fauna:

   ```shell
   fauna login
   ```

4. Run CLI commands. Specify a `--database` path, including the [Region Group
   identifier](https://docs.fauna.com/fauna/current/manage/region-groups/#id) and
   hierarchy, to run the command in. [Shorthand Region Group
   identifiers](https://docs.fauna.com/fauna/current/manage/region-groups/#id)
   are supported. For example:

   ```shell
   # Runs a query in the top-level 'example' database
   # in the 'us' Region Group. Use the default admin role.
   fauna query "Collection.all()" \
     --database us/example
   ```

## Installation

During the beta, you can install v4 of the Fauna CLI globally using npm:

```sh
npm install -g fauna-shell@beta
```

To upgrade the CLI, run:

```
npm update -g fauna-shell@beta
```

## Documentation

For usage instructions and a full [list of
commands](https://docs.fauna.com/fauna/current/build/cli/v4/commands/), see the
[Fauna docs](https://docs.fauna.com/fauna/current/build/cli/v4/).

You can also access help directly in the CLI:

```sh
# For general help:
fauna --help

# For a specific command:
fauna <command> --help
# For example:
fauna query --help
```

## Contributions and development

See the [contribution guidelines](CONTRIBUTING.md).
