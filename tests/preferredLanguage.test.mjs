import test from "node:test";
import assert from "node:assert/strict";
import { getPreferredLanguage } from "../lib/aquaguard.mjs";

test("reads the stored preferred locale through the Supabase service endpoint", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-role";
  globalThis.fetch = async () => new Response(JSON.stringify([{ value: { code: "sw" } }]), { status: 200 });
  try { assert.equal(await getPreferredLanguage(), "sw"); }
  finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test("uses English when no supported preferred locale is stored", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-role";
  globalThis.fetch = async () => new Response("[]", { status: 200 });
  try { assert.equal(await getPreferredLanguage(), "en"); }
  finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});
