# Pending billing activation

The billing schema, verifier, reconciliation worker and scheduler are already deployed. See [current database state](../README.md) and [release status](../../RELEASE_STATUS.md).

Only activate-production-guard.sql remains an operational rollout step. Apply it together with enabling public verified billing after the compatible Android release passes acceptance. Record the change in a new tracked migration at that time.

The migration and scheduler files in this directory are historical pointers. Canonical applied SQL is under ../migrations. Do not reapply the old scripts or reset existing customer entitlements.
