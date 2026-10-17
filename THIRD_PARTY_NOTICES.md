# Third-party notices

OpenCode Plugin Lab itself is licensed under the MIT License (see `LICENSE`).

The lab does **not** bundle, redistribute or depend on any third-party OpenCode
plugin. Plugins are staged from sources *you* point a manifest at, built inside a
disposable container, and never committed. The lab ships two tiny example plugins
of its own design, both MIT-licensed.

Where third-party code is installed *inside the image at build time*, it is under
its own license:

| Component | Used for | License |
| --- | --- | --- |
| `@opencode/cli` (OpenCode V2) | the real runtime the lab drives | see the OpenCode project |
| `@opencode/plugin` (OpenCode V2 plugin SDK) | resolving `import { Plugin }` | MIT |
| `node:22-bookworm-slim` (Docker base image) | build/runtime base | see the Node.js distribution |
| Debian packages (`git`, `sqlite3`, `jq`, `python3`, `procps`, `tini`, …) | tooling | their respective licenses |

## Optional regression profile

`profiles/gitdamnit/` is an optional profile for three independently released
plugins. The lab does **not** include their code — it stages it from the
maintainer's local checkouts at build time. Their licenses, recorded here for
attribution when that profile is used, are:

| Plugin | License |
| --- | --- |
| Checkpoint Orchestrator (`@gitdamnit/checkpoint-orchestrator`) | MIT |
| Git That Shit (`@gitdamnit/opencode-git-that-shit`) | Apache-2.0 |
| Stranger Danger (`@gitdamnit/stranger-danger`) | MIT |

Those plugins are independent products; this lab is not a dependency of them, and
they are not a dependency of the lab's default configuration.

## Trademarks

"OpenCode" is the name of the upstream project this lab tests. This lab is an
independent developer tool and is not affiliated with or endorsed by the OpenCode
project.
