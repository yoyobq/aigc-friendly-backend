# Capability Boundary Examples

## Reference Report Negative Example

The v1.4 reference pilot intentionally remains a compact negative example for future human and AIGC review.

### Incorrect Boundary

```text
reference.profile (business capability)
        ^
        | dependsOn
reference.report (business capability)
```

`reference.report` only queried profiles, grouped them, and returned a view. It owned no fact, state, policy, write semantics, or independent
lifecycle. Its capability identity was inferred from a dependency and a typed-client call.

### Correct Boundary

```text
reference.profile (test owner capability)
        ^
        | runtime-dispatched query
BuildReferenceReportUsecase (composition usecase, no capability id)
```

The profile side demonstrates an owner runtime operation. The report side demonstrates ordinary composition. A typed client is a runtime
access mechanism and does not make its consumer a capability.

### Review Rule

Before adding a capability id, remove its dependencies from the diagram. If the candidate no longer owns a recognizable fact, runtime
resource, product result, policy, or lifecycle, keep it as a usecase/read model/facade instead.

