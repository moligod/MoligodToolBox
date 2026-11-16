import { test } from "node:test";
import assert from "node:assert/strict";
import { regexCondition, readRegexCondition } from "../src/automation-condition.ts";
test("regex condition explicitly names its input and preserves regex escapes", () => {
  const pattern = String.raw`^a\d+"b$`;
  const expression = regexCondition("result_A", pattern);
  assert.deepEqual(readRegexCondition(expression), {source:"result_A",pattern});
  assert.equal(regexCondition("", pattern), "");
  assert.equal(regexCondition("x || true", pattern), "");
  assert.equal(readRegexCondition("result_A > 0"), undefined);
  assert.equal(readRegexCondition('result_A =~ "["').pattern, "[");
});
