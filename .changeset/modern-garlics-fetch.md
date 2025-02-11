---
"fauna-shell": patch
---

Remove the `--json` flag from commands that don't support it.

The `--json` flag was implemented as a top-level option, implying it could be used with all commands. However, it only has an effect for a subset of commands. After this change, only the following commands support the `--json` flag:

- database create
- database list
- export get
- export create
- export list
- query
- shell
