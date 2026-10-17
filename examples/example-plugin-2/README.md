# example-plugin-2

A second, even smaller example plugin. It registers **no tools** — only lifecycle
logging. It ships prebuilt (no build step), so it also exercises the lab's
`source.type: package` + `build.rootEntry` input path and the capability-aware
behaviour where tool assertions are *skipped* rather than failed.

Loaded together with `example-plugin` by the default `multi-plugin` configuration.
