---
"fauna-shell": patch
---

Add retry options for queries.

The `fauna query` and `fauna shell` commands now support retry flags for throttling and contended transactions. For FQL v10 queries, the following flags are supported: `--max-attempts`, `--max-backoff`, and `--max-contention-retries`. For FQL v4 queries, only `--max-contention-retries` is supported.
