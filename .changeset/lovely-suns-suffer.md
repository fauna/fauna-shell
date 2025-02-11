---
"fauna-shell": patch
---

Fix incorrect nodeJS minimum version

The documentation and package.json's "engine" field asserted that the CLI could be run with versions of nodeJS >= 20.x.x, but it makes use of APIs (specifically, the single-executable application API) that aren't available until nodeJS >= 20.18.x. This change updates the docs, "engines" field in the package.json file, and changes our test runner to test at 20.18 instead of the latest 20.x to prevent additions of further backwards-incompatible changes.
