# Disposable fixtures

The lab never runs destructive tests against a real project. Two kinds of
fixtures are used:

1. **Generated at runtime (primary).** The harness creates throwaway Git
   repositories and project directories under `/tmp` (a tmpfs inside the
   container) for every run. They are removed when the test finishes. This is
   what the Git That Shit restore/lock tests and the Checkpoint handoff test
   operate on.

2. **Templates in this directory (optional).** Static, non-secret templates that
   can be copied into a fixture project. `sample-project/` shows the minimal
   layout a disposable project needs. `synthetic-secrets.txt` contains clearly
   fake, well-known example values used by the Stranger Danger tests.

## Rules

- **Never** place real credentials here. The examples in
  `synthetic-secrets.txt` are public documentation placeholders.
- **Never** copy a live SQLite database as a "backup". The Checkpoint tests
  create fresh databases and the handoff test exports JSON, not a database file.
- Fixtures are excluded from the Docker build by allowlist; only this repo
  directory is copied to `/opt/lab/fixtures`.
