# Configuration

Everything the lab does is driven by a single **manifest** — a JSONC file that
declares which plugins to test and how to run them. The default is
[`lab.config.json`](../lab.config.json); optional profiles live under
`profiles/`. The machine-readable schema is
[`schema/lab.config.schema.json`](../schema/lab.config.schema.json).

Validate any manifest with:

```sh
node scripts/lab-manifest.mjs validate --manifest path/to/lab.config.json
```

`validate` prints actionable errors (unknown plugin referenced by a config,
missing `source.type`, a path that references an unset variable, a `tests` module
that does not exist, contradictions between `expectTools` and
`capabilities.tools`, …).

---

## Top-level shape

```jsonc
{
  "$schema": "./schema/lab.config.schema.json",
  "version": 1,
  "name": "my lab",
  "opencode": { "version": "2.0.21", "sdkVersion": "2.0.21" },
  "defaultConfig": "baseline",
  "plugins": [ /* see below */ ],
  "configs": [ /* see below */ ],
  "globalSuites": [ /* optional, see Test extensions */ ]
}
```

- `version` must be `1`.
- `opencode.version` pins `@opencode/cli`; `sdkVersion` pins `@opencode/plugin`
  and defaults to `version`. `make build OPENCODE_VERSION=…` overrides for a
  one-off evaluation; the exact installed version is recorded in every report.
- `defaultConfig` is what `make start` and a bare `make test` run.

## A plugin

```jsonc
{
  "name": "my-plugin",                     // required, stable lab id
  "package": "@me/my-plugin",              // optional, informational
  "id": "me.my-plugin",                    // optional runtime plugin id
  "source": { "type": "directory", "path": "../my-plugin" },
  "build": { "command": "npm run build", "dist": "dist", "entry": "index.js" },
  "options": { "greeting": "hi" },         // passed to the plugin at load
  "capabilities": { "tools": true },
  "expectTools": ["my_tool"],
  "setupMarker": "[my-plugin] setup",      // optional: asserted in the log
  "cleanupMarker": "[my-plugin] cleanup",  // optional: asserted after shutdown
  "expectedWrites": [".my-plugin-state"],  // optional: allowed project writes
  "tests": ["tests/my-plugin.mjs"],        // optional: plugin-specific suite
  "notes": "free text recorded in reports"
}
```

### Source types

| `type` | Meaning | Notes |
| --- | --- | --- |
| `directory` | a local source tree | dependencies installed and the build command run |
| `package` | an already-built package directory | used as-is (set `build.rootEntry: true`) |
| `tarball` | a local `.tgz` | extracted; built unless `rootEntry` |
| `npm` | an npm reference (`name@1.2.3`) | **never fetched** unless `source.allowRemote: true` |

Paths are resolved relative to the manifest file and support `~`, `$HOME`,
`${VAR}` and `${VAR:-default}`. Public manifests should not contain absolute
home paths — use a variable with a default:

```jsonc
"source": { "type": "directory", "path": "${MY_PLUGIN_DIR:-$HOME/Projects/my-plugin}" }
```

If a source is not a git worktree (an exported tree, a tarball), record the commit
it corresponds to so provenance is complete:

```jsonc
"source": { "type": "directory", "path": "/tmp/pin/my-plugin", "commit": "65bf6981eee5…" }
```

### Build shapes

- **Compiled** (default): `build.command` runs (or the package's own `build`
  script), and `dist/<entry>` is packaged behind an `index.ts` shim.
- **Prebuilt**: set `build.rootEntry: true` and point `entry` at the file at the
  package root (e.g. `index.js`). No build runs.

`install.scripts` (default `false`) controls whether npm lifecycle scripts run
during dependency installation. Enable it only for plugins that need it; it is a
supply-chain risk.

### Capabilities

The harness only asserts what a plugin declares, and reports the rest as skipped:

```jsonc
"capabilities": { "tools": false, "hooks": false, "storage": false, "redaction": false, "network": false }
```

- `tools` — registers tools; `expectTools` lists their ids.
- `redaction` — transforms model requests; the offline model-path suite then
  asserts a synthetic secret is absent from the transmitted request.
- `network` — makes outbound calls; only exercised in the gated online tier.
- `storage` — keeps its own state; the generic write-boundary check covers it.

## A configuration

```jsonc
{
  "name": "multi-plugin",
  "description": "two plugins together",
  "plugins": ["my-plugin", "another-plugin"],       // load order
  "options": { "my-plugin": { "greeting": "hi" } },  // per-plugin overrides
  "settings": { "compaction": { "auto": false } },   // extra opencode keys
  "template": "configs/base.opencode.jsonc"          // optional JSONC base
}
```

The plugin list is always generated from the manifest. `settings` and `template`
let you add non-plugin runtime keys (providers, compaction, …). A `template` may
use the `__REPORTS__` placeholder; the generated plugin list and the lab
inspector are applied on top of it.

---

## Examples

### Single plugin from a local directory

```sh
make test-plugin PLUGIN=/path/to/my-plugin
```

or, as a committed manifest:

```jsonc
{
  "version": 1,
  "plugins": [{
    "name": "my-plugin",
    "source": { "type": "directory", "path": "../my-plugin" },
    "build": { "command": "npm run build", "dist": "dist", "entry": "index.js" },
    "capabilities": { "tools": true },
    "expectTools": ["my_tool"]
  }],
  "configs": [{ "name": "my-plugin", "plugins": ["my-plugin"] }]
}
```

### Multiple plugins together

```jsonc
{
  "version": 1,
  "plugins": [
    { "name": "alpha", "source": { "type": "package", "path": "./prebuilt/alpha" }, "build": { "rootEntry": true, "entry": "index.js" }, "capabilities": { "tools": true }, "expectTools": ["alpha_run"] },
    { "name": "beta", "source": { "type": "directory", "path": "../beta" }, "build": { "command": "npm run build", "entry": "index.js" }, "capabilities": { "tools": false } }
  ],
  "configs": [
    { "name": "alpha", "plugins": ["alpha"] },
    { "name": "beta", "plugins": ["beta"] },
    { "name": "both", "plugins": ["alpha", "beta"] }
  ]
}
```

The `load-order` global suite permutes the plugins in the widest configuration
and detects tool-name collisions and duplicate entries automatically.

### A plugin from a packed tarball

```jsonc
"source": { "type": "tarball", "path": "./artifacts/my-plugin-1.2.3.tgz" },
"build": { "rootEntry": true, "entry": "dist/index.js" }
```

### An npm package (explicit opt-in)

```jsonc
"source": { "type": "npm", "ref": "@me/my-plugin@1.2.3", "allowRemote": true }
```

Without `allowRemote: true` the manifest validates but the build refuses to fetch
— remote packages are never pulled silently.

---

## Test extensions

Per-plugin suite (`"tests"`) — runs once, gated on the plugin being built:

```js
// tests/my-plugin.mjs
import { Suite, assert } from "../../../harness/lib/suite.mjs";
import { PLUGINS } from "../../../harness/lib/env.mjs";
import { join } from "node:path";

export async function run({ tier = "validate", plugin }) {
  const suite = new Suite(`plugin/${plugin}`, { tier });
  await suite.test("my-plugin.smoke", () => {
    assert(PLUGINS[plugin].tools.length > 0, "declares tools");
    return { packageDir: PLUGINS[plugin].packageDir };
  });
  return suite.summary();
}
```

Manifest-wide suite (`"globalSuites"`):

```jsonc
"globalSuites": [{ "name": "my-suite", "module": "tests/my-suite.mjs" }]
```

Both shapes export `run({ tier, plugin, name })` and return a `Suite#summary()`.
Extensions run **only when their manifest is active**, so a fresh clone never
runs them.

---

## Profiles

A profile is just a manifest under `profiles/<name>/`. Activate it with
`PROFILE=<name>`:

```sh
make build PROFILE=gitdamnit
make suite PROFILE=gitdamnit
```

or point at any manifest file with `LAB_MANIFEST_FILE=/abs/path make build`.
