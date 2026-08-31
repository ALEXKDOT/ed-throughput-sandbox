# Security policy

## Scope

ED Throughput Sandbox is a static educational application. It has no backend, accounts, database, telemetry, API keys, or intended patient-data workflow.

Do not upload patient-level, hospital-confidential, employee, credential, or protected health information. Scenario imports are intended only for synthetic aggregate assumptions.

## Reporting a vulnerability

Please open a private GitHub security advisory for the repository owner. Do not include real sensitive data in a report; use a minimal synthetic reproduction.

The most relevant security boundaries are dependency integrity, imported JSON and URL-state validation, CSV formula injection, untrusted scenario names, static-hosting configuration, and denial of service through oversized inputs.

## Supported version

Only the latest release on the default branch is supported. Dependency alerts and CI results should be reviewed before each release.
