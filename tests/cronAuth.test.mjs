import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/cron/mark-offline.js";

function responseMock() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = value; }
  };
}

test("Vercel offline cron requires its private bearer token", async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "unit-test-cron-secret";
  try {
    for (const authorization of [undefined, "Bearer wrong-token"]) {
      const res = responseMock();
      await handler({ method: "GET", headers: { authorization } }, res);
      assert.equal(res.statusCode, 401);
      assert.deepEqual(JSON.parse(res.body), { error: "Unauthorized." });
    }
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous;
  }
});
