/**
 * Lab inspector plugin.
 *
 * Loaded LAST in every test configuration. It reads the live OpenCode plugin
 * context during `setup` (the real runtime, not a mock) and records:
 *   - the OpenCode runtime version and location
 *   - every active plugin (id / source / state / features)
 *   - every tool id registered so far
 *
 * The JSON is written to `ctx.options.out` (a /lab/reports path) and mirrored
 * to stdout so it also lands in the server log.
 */
import { Plugin } from "@opencode/plugin"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

function normalizeList(value: unknown): any[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === "object" && Array.isArray((value as any).data)) return (value as any).data
  return []
}

export default Plugin.define({
  id: "lab.inspector",
  async setup(ctx) {
    const options = (ctx.options ?? {}) as { out?: string }

    let plugins: any[] = []
    let tools: any[] = []
    const errors: string[] = []

    try {
      plugins = normalizeList(await ctx.plugin.list())
    } catch (error) {
      errors.push(`plugin.list: ${(error as Error).message}`)
    }
    try {
      tools = normalizeList(await ctx.tool.list())
    } catch (error) {
      errors.push(`tool.list: ${(error as Error).message}`)
    }

    const record = {
      inspectedAt: new Date().toISOString(),
      app: { version: ctx.app?.version ?? null },
      location: {
        directory: ctx.location?.directory ?? null,
        projectID: (ctx.location as any)?.project?.id ?? null,
      },
      options,
      plugins: plugins.map((p) => ({
        id: p?.id ?? null,
        source: p?.source ?? null,
        state: p?.state ?? null,
        features: p?.features ?? null,
      })),
      tools: tools.map((t) => (typeof t === "string" ? t : t?.id)).filter(Boolean),
      errors,
    }

    const json = JSON.stringify(record, null, 2)
    const out = options.out || "/lab/reports/runtime-inspector.json"
    try {
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, json, "utf8")
    } catch (error) {
      console.error(`[lab.inspector] failed to write ${out}: ${(error as Error).message}`)
    }

    const external = record.plugins
      .filter((p) => p.id && !String(p.id).startsWith("opencode."))
      .map((p) => `${p.id}=${p.state?.status ?? "unknown"}`)
    console.log(`[lab.inspector] version=${record.app.version} plugins=[${external.join(", ")}] tools=${record.tools.length}`)

    return () => {
      console.log("[lab.inspector] UNLOADED")
    }
  },
})
