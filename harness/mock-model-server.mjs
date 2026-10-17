// Offline OpenAI-compatible mock provider.
//
// Used to exercise OpenCode's *real* supported model-request path without any
// outbound network: the server records the exact request body OpenCode sends
// (after plugin hooks have run) and replies with a canned completion. This lets
// the lab verify that Stranger Danger redacts secrets on the way to a model,
// using the same code path a real provider would use.
import { createServer } from "node:http";
import { appendFileSync, writeFileSync } from "node:fs";

export function startMockModelServer({ port, capturePath }) {
  writeFileSync(capturePath, "");
  let requestCount = 0;

  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      if (req.url.includes("/chat/completions")) {
        requestCount++;
        appendFileSync(capturePath, JSON.stringify({ url: req.url, headers: req.headers, body: safeParse(body) }) + "\n");
        const wantsStream = (() => {
          try {
            return JSON.parse(body).stream === true;
          } catch {
            return false;
          }
        })();
        if (wantsStream) {
          res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
          res.write(sse({ content: "OK" }));
          res.write(sse({}, "stop"));
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            id: "chatcmpl-lab",
            object: "chat.completion",
            created: 1,
            model: "mock-1",
            choices: [{ index: 0, message: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
        );
        return;
      }
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({
        port,
        capturePath,
        get requestCount() {
          return requestCount;
        },
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

function sse(delta, finish = null) {
  return `data: ${JSON.stringify({ id: "chatcmpl-lab", object: "chat.completion.chunk", created: 1, model: "mock-1", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
