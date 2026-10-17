// Minimal, dependency-free test harness that produces machine-readable results.

export function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

export function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || "assertEquals"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message || "assertDeepEqual"}: expected ${b}, got ${a}`);
}

export function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(`${message || "assertIncludes"}: expected to include ${JSON.stringify(needle)}`);
  }
}

export function assertMatch(value, regex, message) {
  if (!regex.test(value)) {
    throw new Error(`${message || "assertMatch"}: ${JSON.stringify(value)} does not match ${regex}`);
  }
}

export function assertNotIncludes(haystack, needle, message) {
  if (haystack.includes(needle)) {
    throw new Error(`${message || "assertNotIncludes"}: did not expect ${JSON.stringify(needle)}`);
  }
}

export class Suite {
  constructor(name, meta = {}) {
    this.name = name;
    this.meta = meta;
    this.results = [];
    this.startedAt = new Date().toISOString();
  }

  async test(id, fn, options = {}) {
    const tier = options.tier || this.meta.tier || "functional";
    const t0 = Date.now();
    const record = { id, tier, status: "pass", durationMs: 0, error: null, detail: null, notes: options.notes || null };
    try {
      const detail = await fn();
      if (detail && typeof detail === "object" && typeof detail.__unverified === "string") {
        // The test could not observe the behavior in this environment; record it
        // as skipped (unverified) rather than passing it.
        record.status = "skipped";
        record.notes = detail.__unverified;
        record.detail = detail.detail ?? null;
      } else if (detail !== undefined) {
        record.detail = detail;
      }
    } catch (error) {
      record.status = "fail";
      record.error = error && error.stack ? error.stack : String(error);
    }
    record.durationMs = Date.now() - t0;
    this.results.push(record);
    const mark = record.status === "pass" ? "PASS" : record.status === "skipped" ? "SKIP" : "FAIL";
    console.log(
      `  [${mark}] ${id}` +
        (record.status === "fail" ? `\n        ${record.error.split("\n").slice(0, 3).join("\n        ")}` : "") +
        (record.status === "skipped" && record.notes ? ` — ${record.notes}` : ""),
    );
    return record.status === "pass";
  }

  skip(id, reason, options = {}) {
    this.results.push({
      id,
      tier: options.tier || this.meta.tier || "functional",
      status: "skipped",
      durationMs: 0,
      error: null,
      detail: null,
      notes: reason,
    });
    console.log(`  [SKIP] ${id} — ${reason}`);
  }

  summary() {
    const counts = { pass: 0, fail: 0, skipped: 0 };
    for (const r of this.results) counts[r.status] = (counts[r.status] || 0) + 1;
    return {
      suite: this.name,
      meta: this.meta,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      counts,
      results: this.results,
    };
  }
}
