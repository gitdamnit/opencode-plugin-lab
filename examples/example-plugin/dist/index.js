/**
 * Example OpenCode V2 plugin for the lab's default configuration.
 *
 * It demonstrates the three things a plugin can be validated for generically:
 *   1. correct registration  — `Plugin.define({ id, setup })`
 *   2. a safe sample capability — the `example_echo` tool, which has no side
 *      effects, needs no credentials and writes nothing
 *   3. lifecycle behaviour — `setup` logs on start and returns a cleanup that
 *      runs on unload
 *
 * It is deliberately tiny. It is not a product; it exists so a fresh clone has
 * something real to build, load and test.
 */
import { Plugin } from "@opencode/plugin";
/** Tool id this plugin registers; asserted by the lab's generic tool test. */
export const EXAMPLE_TOOL = "example_echo";
export default Plugin.define({
    id: "lab.example",
    async setup(ctx) {
        const options = ctx?.options ?? {};
        console.log(`[example-plugin] setup (options=${JSON.stringify(options)})`);
        // Registering a tool is optional for a plugin; this example does.
        if (ctx?.tool?.transform) {
            await ctx.tool.transform((editor) => {
                editor.add({
                    name: EXAMPLE_TOOL,
                    description: "Echo back the provided text. A safe sample capability with no side effects.",
                    input: {
                        type: "object",
                        properties: { text: { type: "string" } },
                        required: ["text"],
                        additionalProperties: false,
                    },
                    execute: async (input) => ({ content: String(input?.text ?? "") }),
                });
            });
        }
        // Lifecycle: the returned cleanup runs when the plugin is unloaded / the
        // server shuts down. The lab's process-cleanup test observes this.
        return () => {
            console.log("[example-plugin] cleanup");
        };
    },
});
