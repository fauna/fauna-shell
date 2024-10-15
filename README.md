# Fauna CLI

<!-- [![Version](https://img.shields.io/npm/v/fauna.svg)](https://npmjs.org/package/fauna)
[![CircleCI](https://circleci.com/gh/fauna/fauna/tree/master.svg?style=shield)](https://circleci.com/gh/fauna/fauna/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/fauna/fauna?branch=master&svg=true)](https://ci.appveyor.com/project/fauna/fauna/branch/master)
[![Codecov](https://codecov.io/gh/fauna/fauna/branch/master/graph/badge.svg)](https://codecov.io/gh/fauna/fauna)
[![Downloads/week](https://img.shields.io/npm/dw/fauna.svg)](https://npmjs.org/package/fauna)
[![License](https://img.shields.io/npm/l/fauna.svg)](https://github.com/fauna/fauna/blob/master/package.json) -->

The Fauna CLI lets you access [Fauna](http://fauna.com/) from your terminal. You
can use the CLI to:

* Log in to your Fauna account.
* Create and manage Fauna
  [databases](https://docs.fauna.com/fauna/current/learn/data-model/databases/)
  and [keys](https://docs.fauna.com/fauna/current/learn/security/keys/).
* Manage [database schema](https://docs.fauna.com/fauna/current/learn/schema/)
  as `.fsl` files on your local machine.
* Run [FQL queries](https://docs.fauna.com/fauna/current/learn/query/) from
  [files](https://docs.fauna.com/fauna/current/build/cli/commands/eval/) or in
  an [interactive
  shell](https://docs.fauna.com/fauna/current/build/cli/commands/shell/).

![fauna-cli](https://github.com/user-attachments/assets/2f7d53f5-f445-4cb1-b90c-455f3a0e51a8)

## Requirements

[Node.js](https://nodejs.org/en/download/package-manager) v18.x or later.

## Installation

Install the Fauna CLI globally using npm:

```sh
npm install -g fauna-shell
```

To upgrade the CLI, run:

```
npm update -g fauna-shell
```

## Documentation

For usage instructions and a full [list of
commands](https://docs.fauna.com/fauna/current/build/cli/commands/), see the
[Fauna docs](https://docs.fauna.com/fauna/current/build/cli/).

You can also access help directly in the CLI by running:

```sh
# For general help:
fauna --help

# For a specific command:
fauna <COMMAND> --help
# For example:
fauna eval --help
```

## Development

To test changes during development, follow these steps:

1. Install the required packages:

    ```sh
    yarn install
    ```

2. You can run commands in dev in one of two ways:

    * **Option 1:** Run against the just-in-time built project with development
      settings:

      ```sh
      # Run `fauna cloud-login` in dev:
      ./bin/dev cloud-login

      # Run `fauna eval` in dev:
      ./bin/dev eval
      ```

    * **Option 2:**  Run against built assets. Use `yarn link` to place them in
      your `$PATH` as if globally installed:

      ```sh
      # Build the package and place it in your $PATH:
      yarn build && yarn link
      # Run CLI commands using `fauna ...`:
      fauna eval
      ```
