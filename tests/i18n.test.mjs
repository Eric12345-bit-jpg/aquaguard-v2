import test from "node:test";
import assert from "node:assert/strict";
import { LANGUAGES, localizeInsight, normalizeLanguage, translate } from "../lib/i18n.mjs";

test("exposes exactly the nine requested language options", () => {
  assert.deepEqual(LANGUAGES.map(language => language.code), ["en", "rw", "fr", "sw", "zh", "nl", "it", "es", "hi"]);
});

test("formats parameterized leak insights and preserves metadata", () => {
  const source = { code: "leak_pattern", level: "critical", title: "old", detail: "old", params: { loss: "4.0", baseline: "0.5" } };
  for (const { code } of LANGUAGES) {
    const translated = localizeInsight(source, code);
    assert.notEqual(translated.title, "old");
    assert.equal(translated.level, "critical");
    assert.ok(translated.detail.length > 10);
  }
  assert.match(localizeInsight(source, "fr").detail, /4\.0/);
});

test("unknown languages fall back to English", () => {
  assert.equal(normalizeLanguage("xx-YY"), "en");
  assert.equal(translate("insights", "xx"), "AI insights");
});

test("device-restored alerts have localized title and detail in every language", () => {
  for (const { code } of LANGUAGES) {
    const title = translate("device_restored", code, "title");
    const detail = translate("device_restored", code, "detail");
    assert.ok(title.length > 3, `${code} title missing`);
    assert.ok(detail.length > 8, `${code} detail missing`);
  }
});
