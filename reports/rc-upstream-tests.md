# Upstream suite cross-check (Checkpoint Orchestrator 2.0.0-dev.1)

Independent evidence: the plugin's **own** test suites were executed inside the
lab container against the **built artifact** from the image
(`/opt/lab/plugins/checkpoint-orchestrator/dist`, produced from commit
`bedc14b`), not against a workspace checkout. The suites and `package.json` were
copied from the staged allowlisted sources; the development repository was not
modified.

Command (inside `opencode-plugin-lab:local`):

```sh
node --test tests/isolation.test.js tests/legacy.test.js
node --test tests/store.test.js tests/service.test.js tests/unit.test.js
```

| Suite file | Tests | Pass | Fail | Skipped |
| --- | --- | --- | --- | --- |
| `tests/isolation.test.js` | (included below) | | | |
| `tests/legacy.test.js` | (included below) | | | |
| **isolation + legacy subtotal** | **29** | **29** | 0 | 0 |
| `tests/store.test.js` + `tests/service.test.js` + `tests/unit.test.js` | **54** | **54** | 0 | 0 |
| **Total** | **83** | **83** | 0 | 0 |

Highlights relevant to this release:

- Session isolation: two/five/many simultaneous sessions keep separate
  checkpoints, histories and handoff files; a child session inherits nothing; a
  model/provider switch preserves the session checkpoint.
- Concurrency: concurrent writes to one session from two connections do not
  corrupt or lose history.
- Restart durability: all committed state survives a plugin restart.
- Legacy migration safeguards: imported into a named `legacy::<projectID>`
  namespace (never a live session); originals copied, never deleted or
  rewritten; idempotent across restarts; disabled import leaves files in place;
  a failed import rolls back; a foreign payload at the legacy path is reported,
  never imported; backup copies land inside the plugin's own namespace.

`tests/plugin.test.js` and `tests/interop.test.js` were not run here because they
import the package by name (`@gitdamnit/checkpoint-orchestrator`) and require
`@opencode/plugin` resolution in a full workspace; their subject matter
(runtime tool registration, the live handoff namespace, and the trigger hooks)
is covered by the lab's runtime, matrix, and `checkpoint-triggers` suites.
