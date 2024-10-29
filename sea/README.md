### SEA (single executable application)

This directory contains the infrastructure for building `fauna-shell` as a single executable application. You can find the docs for SEA [here](https://nodejs.org/docs/latest-v22.x/api/single-executable-applications.html#single-executable-applications); since this feature is experimental, make sure you're looking at the same nodeJS version as the project uses; there will be breaking changes across nodeJS versions.

The process generally looks like this:

1. A developer (or CI) runs [npm run build](../package.json).
2. `build:app` runs `eslint` to build the ES module CLI into a single-file CJS module with its dependencies' inlined. There are a few wrinkles here with `import.meta.url` and `__dirname`, but it's otherwise fairly straight-forward. This is what `./sea/import-meta-url.js` is for.
3. `build:sea` runs `./sea/build.cjs`. This nodeJS script detects the OS and builds an SEA for that OS. One of the inputs to this process is `./sea/config.json`, which specifies some paths and settings for the resulting build. We could optimize our builds here by enabling `useSnapshot` and `useCodeCache`, but that's likely not worth the effort until we have a (basic) perf benchmark in place.

### Versions of the CLI

1. The raw (runnable!) ESM CLI can be invoked by `./src/user-entrypoint.mjs <command> [subcommand] [args]`.
2. The built CJS CLI can be invoked by `./dist/cli.cjs <command> [subcommand] [args]`.
3. The SEA CLI can be invoked by `./dist/fauna <command> [subcommand] [args]`.

### Differences between versions

_All 3 versions should be runnable and behave the same, with these exceptions:_

- SEA installations do not check for updates, present a nag, or have an upgrade path.
