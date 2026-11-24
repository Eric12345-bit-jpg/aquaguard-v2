import test from "node:test";
import assert from "node:assert/strict";
import { cloudHealth } from "../lib/aquaguard.mjs";

test("cloud health fails closed when Supabase is not configured", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try { assert.deepEqual(await cloudHealth(), { ok: false, supabaseConfigured: false }); }
  finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test("cloud health reports only status when a mocked Supabase REST probe succeeds", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = "https://unit-test.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-key";
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://unit-test.invalid/rest/v1/devices?select=id&limit=1");
    assert.equal(init.headers.apikey, "unit-test-key");
    return new Response("[]", { status: 200 });
  };
  try {
    assert.deepEqual(await cloudHealth(), { ok: true, supabaseConfigured: true });
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});
