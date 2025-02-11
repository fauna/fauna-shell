---
"fauna-shell": patch
---

Support user-provided query retry and back-off settings for query and shell commands. For queries using FQLv10, `--max-attempts`, `--max-backoff`, `--timeout`, and `--max-contention-retries` are supported. For queries using FQLv4, `--timeout` and `--max-contention-retries` are supported.
