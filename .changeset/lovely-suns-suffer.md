---
"fauna-shell": patch
---

Fix incorrect minimum Node.js version

The documentation and package.json's "engines" field previously stated that the CLI could be run with Node.js 20.x.x or later. However, the CLI uses APIs, such as the single-executable application (SEA) API, that aren't available until Node.js 20.18.x. This change updates the documentation, the "engines" field of package.json, and the test runner to test against Node.js 20.18.x to prevent further backward-incompatible changes.
