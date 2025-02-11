---
"fauna-shell": patch
---

Improve export user experience.

- Export create now allows users to provide S3 URIs as a target to export to (with the flag `--desination`) in addition to providing each part independently (`--bucket`, `--path`)
- Export create now supports user-provided idempotency tokens. Customers can use this to retry failed requests without triggering additional export workflows.
