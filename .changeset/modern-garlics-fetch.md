---
"fauna-shell": patch
---

Remove `--json` flag on commands that don't support it.

The `--json` flag was presented as an option at the top level (modifying all commands), but only has an effect for a subset of commands. After this change, only the following commands have a `--json` field:

- database create
- database list
- export get
- export create
- export list
- query
- shell
