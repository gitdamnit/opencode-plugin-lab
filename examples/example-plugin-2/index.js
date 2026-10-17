/**
 * Second example plugin — lifecycle only.
 *
 * It deliberately registers no tools, to prove two things about the lab:
 *   - a plugin that defines no tools is supported (tool assertions are skipped,
 *     not failed), and
 *   - a prebuilt, un-built package (no `dist/`, entry at the package root) loads
 *     just like a compiled one.
 */
import { Plugin } from "@opencode/plugin"

export default Plugin.define({
  id: "lab.example-two",
  async setup() {
    console.log("[example-plugin-2] setup (lifecycle-only; registers no tools)")
    return () => {
      console.log("[example-plugin-2] cleanup")
    }
  },
})
