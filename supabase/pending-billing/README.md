# Pending billing activation

The billing schema, verifier, reconciliation worker and scheduler are already deployed. See [current database state](../README.md) and [release status](../../RELEASE_STATUS.md).

The production guard was applied by migration `202609300002` after compatible Android build 23 passed acceptance. `activate-production-guard.sql` is retained only as a historical rollout artifact and must not be reapplied.

The migration and scheduler files in this directory are historical pointers. Canonical applied SQL is under ../migrations. Do not reapply the old scripts or reset existing customer entitlements.
