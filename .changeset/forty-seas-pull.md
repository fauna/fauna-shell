---
"fauna-shell": patch
---

Redact secrets in verbose logging.

Logging the resolved CLI config could log out credentials if you had stored credentials in your config file. The CLI already redacts secrets that are logged by the verbose logger while parsing arguments/flags/environment variables, but this change additionally redacts secrets that would otherwise be logged by the verbose logger while parsing config files.
