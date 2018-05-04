fauna-shell
=========

tool to access fauna-db

[![Version](https://img.shields.io/npm/v/fauna-shell.svg)](https://npmjs.org/package/fauna-shell)
[![CircleCI](https://circleci.com/gh/fauna/fauna-shell/tree/master.svg?style=shield)](https://circleci.com/gh/fauna/fauna-shell/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/fauna/fauna-shell?branch=master&svg=true)](https://ci.appveyor.com/project/fauna/fauna-shell/branch/master)
[![Codecov](https://codecov.io/gh/fauna/fauna-shell/branch/master/graph/badge.svg)](https://codecov.io/gh/fauna/fauna-shell)
[![Downloads/week](https://img.shields.io/npm/dw/fauna-shell.svg)](https://npmjs.org/package/fauna-shell)
[![License](https://img.shields.io/npm/l/fauna-shell.svg)](https://github.com/fauna/fauna-shell/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g fauna-shell
$ fauna-shell COMMAND
running command...
$ fauna-shell (-v|--version|version)
fauna-shell/0.0.1 darwin-x64 node-v8.11.1
$ fauna-shell --help [COMMAND]
USAGE
  $ fauna-shell COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`fauna-shell hello`](#fauna-shell-hello)
* [`fauna-shell help [COMMAND]`](#fauna-shell-help-command)

## `fauna-shell hello`

Describe the command here

```
USAGE
  $ fauna-shell hello

OPTIONS
  -n, --name=name  name to print

DESCRIPTION
  Describe the command here
  ...
  Extra documentation goes here
```

_See code: [src/commands/hello.js](https://github.com/fauna/fauna-shell/blob/v0.0.1/src/commands/hello.js)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v1.2.10/src/commands/help.ts)_
<!-- commandsstop -->
