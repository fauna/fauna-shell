---
"fauna-shell": patch
---

Redact secrets in verbose logging.

With verbose logging enabled, the CLI previously logged the full resolved CLI config, which could inadvertently expose account keys and secrets stored in a config file. The CLI masks sensitive information, such as account keys and secrets, when logging details from arguments, flags, or environment variables. This change updates verbose logging to redact account keys and secrets logged from config files.
