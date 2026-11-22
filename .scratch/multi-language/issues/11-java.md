# 11 · Java: Fundamentals

Status: ready-for-agent
Blocked by: 10

## What

09 and 10 again, in Java (JDK 21, with Gradle or Maven per 02).

- Versioning uses `Workflow.getVersion`, which changes F12 and FC3's choices.
- F11 teaches compensations written by hand, as the other languages do, and mentions the SDK's `Saga` class in a sentence.
- Workflow type names and activity names are set explicitly to match the contract (`@WorkflowMethod(name = …)`, `@ActivityMethod(name = "lookup_airport")`).
- No language server: the editor only highlights Java.

## Done when

`verify_modules.py` and the e2e pass in Java for all of Fundamentals, in a sandbox within 02's limits.
