# example-plugin

A minimal, fully functional OpenCode V2 plugin that ships with the lab so a fresh
clone has something real to build, load and test.

- Registers exactly one tool: `example_echo`
- Logs on `setup` and on unload (lifecycle)
- Makes no network calls, needs no API keys, writes nothing to disk
- Built with `tsc`; the lab packages `dist/` for OpenCode to load

It exists only to exercise the generic lab. Put your own plugin alongside it and
point a manifest at it — see the top-level `README.md` and `docs/CONFIGURATION.md`.
