import { test } from "node:test";
import assert from "node:assert/strict";
import { pesos } from "../lib/input";
test("peso input preserves cents and rejects rounding and invalid values", () => {
  assert.equal(pesos("4500.05"), 450005);
  assert.equal(pesos("0.1"), 10);
  for (const bad of ["-1", "1.005", "1e3", "", "0", "9007199254740991"])
    assert.throws(() => pesos(bad));
});
