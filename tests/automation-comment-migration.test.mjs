import { test } from "node:test";
import assert from "node:assert/strict";
import { standaloneComments } from "../src/automation-comment-migration.ts";

const step = (type, fields = {}, annotation) => ({
  delayMs: 0,
  action: { type, ...fields },
  ...(annotation === undefined ? {} : { annotation }),
});
const comment = (text) => step("comment", { text });

test("legacy annotations become independent comments at their original container positions", () => {
  const source = [
    {
      ...step("wait", { ms: 1 }, "普通\n注解"),
      delayMs: 23,
      randomDelayMs: 9,
      extra: "保留",
    },
    step(
      "group",
      {
        name: "组",
        steps: [
          step("if", { expression: "true" }, "条件"),
          step("wait", { ms: 2 }),
          step("elseIf", { expression: "false" }, "另一条件"),
          step("else", {}, "否则"),
          step("endIf", {}, "结束条件"),
        ],
      },
      "分组",
    ),
    step("loop", { count: 2 }, "循环"),
    comment("原有独立注解"),
    step("endLoop", {}, "结束循环"),
  ];
  const original = structuredClone(source);
  const migrated = standaloneComments(source);
  assert.deepEqual(migrated, [
    {
      delayMs: 23,
      randomDelayMs: 9,
      extra: "保留",
      action: { type: "wait", ms: 1 },
    },
    comment("普通\n注解"),
    step("group", {
      name: "组",
      steps: [
        comment("分组"),
        step("if", { expression: "true" }),
        comment("条件"),
        step("wait", { ms: 2 }),
        step("elseIf", { expression: "false" }),
        comment("另一条件"),
        step("else"),
        comment("否则"),
        comment("结束条件"),
        step("endIf"),
      ],
    }),
    step("loop", { count: 2 }),
    comment("循环"),
    comment("原有独立注解"),
    comment("结束循环"),
    step("endLoop"),
  ]);
  assert.deepEqual(source, original);
  assert.deepEqual(standaloneComments(migrated), migrated);
});

test("long Unicode notes split without loss within the native comment byte limit", () => {
  const text = "  汉字🧩\n".repeat(900);
  const result = standaloneComments([step("wait", { ms: 1 }, text)]);
  const parts = result.slice(1).map((item) => item.action.text);
  assert.equal(parts.join(""), text);
  assert.ok(parts.every((part) => Buffer.byteLength(part) <= 4096));
  assert.ok(parts.every((part) => !part.includes("\uFFFD")));
});

test("conversion refuses malformed or oversized scripts without altering source data", () => {
  const source = Array.from({ length: 1000 }, () => step("wait", { ms: 1 }));
  source[0].annotation = "保留";
  const original = structuredClone(source);
  assert.throws(() => standaloneComments(source), /超过1000/);
  assert.deepEqual(source, original);
  assert.throws(
    () => standaloneComments([step("if", { expression: "true" }, "保留")]),
    /结束步骤/,
  );
});
