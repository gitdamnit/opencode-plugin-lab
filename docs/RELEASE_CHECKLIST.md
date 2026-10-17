# Release checklist — v1.0.0

This checklist is for the **maintainer**. Nothing here is executed
automatically, and nothing is published without explicit authorization.

## Before publishing (all local)

- [ ] `node scripts/lab-manifest.mjs validate` passes for `lab.config.json`
      and every manifest under `profiles/`.
- [ ] `make build` succeeds from a clean clone (default manifest, example plugins
      only) with no access to any external plugin repository.
- [ ] `make suite` → every generic configuration and global suite green (or
      skipped with an honest reason). Record the counts.
- [ ] `make test-plugin PLUGIN=<some-other-plugin>` works for an unrelated plugin.
- [ ] `make build PROFILE=gitdamnit` (optional profile) builds and
      `make suite PROFILE=gitdamnit` reproduces the regression matrix; record the
      exact commits it built from.
- [ ] `make rc-evidence` shows source = staged = packed = installed for every
      plugin.
- [ ] Historical evidence under `reports/historical/` is untouched.
- [ ] No secrets in the tree: `git grep -nE '(sk-|ghp_|AKIA[0-9A-Z]{16})'` returns
      only synthetic fixtures.
- [ ] `python3 ~/.agents/skills/prodoc-guard/scripts/prodoc validate` and
      `… check` pass.
- [ ] `CHANGELOG.md` entry dated and complete; `LICENSE` and
      `THIRD_PARTY_NOTICES.md` present.

## Repository setup (requires authorization)

- [ ] Create `gitdamnit/opencode-plugin-lab` (public). Suggested **description**:
      > A disposable, isolated Docker test lab for OpenCode V2 plugins: build and
      > load any plugin in the real runtime and verify loading, tools, collisions,
      > failure isolation, cleanup and provenance.

      Suggested **topics**: `opencode`, `opencode-plugin`, `plugin-testing`,
      `test-harness`, `docker`, `nodejs`, `developer-tools`, `open-source`.
- [ ] Push `main` (or the release branch). Do **not** force-push.
- [ ] Confirm the remote default branch and that no CI secrets are required.

## Tagging & release (requires authorization)

- [ ] Tag `v1.0.0` on the release commit and push the tag.
- [ ] Create a GitHub release using `CHANGELOG.md`’s `[1.0.0]` section.
- [ ] Attach nothing that contains credentials or the historical private
      worktree paths. (Reports contain source paths — scrub or note them.)

## Not part of this release

- No npm package is published — this lab is **not** a loadable OpenCode plugin
  and does not belong in a plugin registry.
- No Docker image is pushed to a registry.
- No ecosystem listing is submitted.

## Known pre-publication considerations

- Reports embed absolute source paths (e.g. `/home/…`). The committed *historical*
  evidence keeps the original paths for integrity; freshly generated reports under
  `reports/runs/` are gitignored and never published.
- The `gitdamnit` profile references `$HOME/Projects/...` by default. That is a
  *profile*, not the default lab, and is fully overridable via environment
  variables; it is documented as maintainer-specific.
