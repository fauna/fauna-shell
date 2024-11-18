// this is being used as an eslint plugin to map from CJS' __filename/__dirname
// to ESM's meta.import.url. this lets us write statements using meta.import.url
// in our source code that actually use CJS primitives after build.
export let importMetaUrl = require("url").pathToFileURL(__filename);
