import assert from "node:assert/strict";
import test from "node:test";
import { defaultBadgeBorderColor, normalizeBadgeBorderColor } from "../src/badge-color.ts";

test("normalizes badge colors to the six-digit HEX format accepted by the API", () => {
  assert.equal(normalizeBadgeBorderColor("#0F17217A", "ptb-silver"), "#0F1721");
  assert.equal(normalizeBadgeBorderColor("#0F1721,47%", "ptb-silver"), "#0F1721");
  assert.equal(normalizeBadgeBorderColor("#ffbb00", "ptb-gold"), "#FFBB00");
});

test("falls back to the tier color when the color value is invalid", () => {
  assert.equal(normalizeBadgeBorderColor("transparent", "ptb-gold"), defaultBadgeBorderColor("ptb-gold"));
  assert.equal(normalizeBadgeBorderColor(undefined, "ptb-diamond"), "#25B9B3");
});
