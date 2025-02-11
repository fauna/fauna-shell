---
"fauna-shell": patch
---

Improve the export user experience.

- `fauna export create` allows you to provide a target S3 URI with the `--destination` flag. Previously, you had to provide both the `--bucket` and `--path` separately.
- `fauna export create` now supports custom idempotency tokens with the `--idempotency` flag. You can use the flag to retry requests without triggering duplicate exports.
