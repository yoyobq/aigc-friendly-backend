<!-- docs/capabilities/reference-fixtures.md -->

# Reference Capability Decisions

These boundaries exist only as executable test fixtures. They demonstrate the stable capability contracts without entering the default API or Worker module graphs.

## `reference.profile`

Owns reference profile facts and the query that returns them by group. `BuildReferenceReportUsecase` composes those facts into a report but does not own another fact or lifecycle, so it has no capability ID.

## `reference.session`

Owns the reference session principal and authority-claim contributions used to validate resolver, projection, and scope-authorizer topology. It is not a production identity model.
