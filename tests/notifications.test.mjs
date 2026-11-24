import test from "node:test";
import assert from "node:assert/strict";
import { formatDeviceNotificationText } from "../lib/aquaguard.mjs";

test("device digest carries cursor and preferred language ahead of messages", () => {
  const text = formatDeviceNotificationText({
    cursor: 1770000000,
    language: "fr",
    alerts: [{ id: "abc-123", type: "possible_leak", severity: "high", title: "Fuite", detail: "Perte 2,8 L/min" }],
    insights: [{ code: "leak_pattern", level: "critical", title: "Fuite probable", detail: "Perte 2,8 L/min" }]
  });
  assert.match(text, /^C\|1770000000\nL\|fr\n/);
  assert.match(text, /A\|abc-123\|possible_leak\|high\|Fuite\|Perte 2,8 L\/min/);
  assert.match(text, /I\|leak_pattern\|critical\|Fuite probable\|Perte 2,8 L\/min/);
});

test("device digest safely replaces line-protocol delimiters and remains newline terminated", () => {
  const text = formatDeviceNotificationText({ cursor: 0, language: "en", alerts: [{ id: "x|y", type: "test", title: "A|B", detail: "one\ntwo" }], insights: [] });
  assert.ok(text.endsWith("\n"));
  assert.ok(!text.split("\n").some(line => line.includes("one\ntwo")));
  assert.match(text, /A\|x y\|test\|medium\|A B\|one two/);
});
