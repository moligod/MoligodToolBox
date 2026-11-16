import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../vite.config.ts";

test("HTML build compaction preserves preformatted content and attributes", () => {
  const compact = config.plugins[0].transformIndexHtml.handler;
  const raw = `<pre>\n  kept indentation\n</pre><textarea>\n   draft\n</textarea><script>\n  const a = '  ';\n</script><style>\n  pre { white-space: pre; }\n</style>`;
  const html = `  <div\n    id="editor"\n    aria-label="动作序列">\n    ${raw}\n  </div>`;
  const result = compact(html);
  assert.ok(result.includes(raw));
  assert.ok(result.includes('id="editor"'));
  assert.ok(result.includes('aria-label="动作序列"'));
  assert.ok(result.length < html.length);
});
