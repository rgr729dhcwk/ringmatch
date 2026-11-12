import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkImage } from "@/sources/imageCheck";
import { mockFetch, pngHeader } from "./helpers";

const ok = "https://img.example.com/ring.png";

describe("checkImage (mocked HTTP)", () => {
  it("accepts a 200 image/* response with longest side >= 600", async () => {
    const { impl } = mockFetch({ [ok]: { contentType: "image/png", body: pngHeader(1200, 800) } });
    const r = await checkImage(ok, { minLongestSide: 600, fetchImpl: impl });
    expect(r).toMatchObject({ ok: true, width: 1200, height: 800, contentType: "image/png" });
  });

  it("accepts when only the height is >= 600", async () => {
    const { impl } = mockFetch({ [ok]: { contentType: "image/png; charset=binary", body: pngHeader(400, 600) } });
    expect((await checkImage(ok, { minLongestSide: 600, fetchImpl: impl })).ok).toBe(true);
  });

  it("rejects non-200 responses", async () => {
    const { impl } = mockFetch({ [ok]: { status: 403, contentType: "image/png", body: pngHeader(1200, 1200) } });
    expect(await checkImage(ok, { minLongestSide: 600, fetchImpl: impl })).toMatchObject({ ok: false, reason: "HTTP 403" });
  });

  it("rejects 404", async () => {
    const { impl } = mockFetch({});
    expect(await checkImage(ok, { minLongestSide: 600, fetchImpl: impl })).toMatchObject({ ok: false, reason: "HTTP 404" });
  });

  it("rejects a non-image content-type", async () => {
    const { impl } = mockFetch({ [ok]: { contentType: "text/html", body: "<html>" } });
    const r = await checkImage(ok, { minLongestSide: 600, fetchImpl: impl });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not image/);
  });

  it("rejects a missing content-type", async () => {
    const { impl } = mockFetch({ [ok]: { body: pngHeader(1000, 1000) } });
    const r = await checkImage(ok, { minLongestSide: 600, fetchImpl: impl });
    expect(r.ok).toBe(false);
  });

  it("rejects images that are too small", async () => {
    const { impl } = mockFetch({ [ok]: { contentType: "image/png", body: pngHeader(599, 400) } });
    const r = await checkImage(ok, { minLongestSide: 600, fetchImpl: impl });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/too small: 599x400/);
  });

  it("rejects bytes that are not an image even if labeled image/*", async () => {
    const { impl } = mockFetch({ [ok]: { contentType: "image/jpeg", body: "definitely not a jpeg" } });
    const r = await checkImage(ok, { minLongestSide: 600, fetchImpl: impl });
    expect(r).toMatchObject({ ok: false, reason: "could not read image dimensions" });
  });

  it("reports network errors", async () => {
    const { impl } = mockFetch({ [ok]: { throws: "ECONNRESET" } });
    const r = await checkImage(ok, { minLongestSide: 600, fetchImpl: impl });
    expect(r).toMatchObject({ ok: false, reason: "network error: ECONNRESET" });
  });

  it("rejects invalid URLs and non-http protocols without fetching", async () => {
    const { impl, calls } = mockFetch({});
    expect((await checkImage("not a url", { minLongestSide: 600, fetchImpl: impl })).ok).toBe(false);
    expect((await checkImage("ftp://x/y.png", { minLongestSide: 600, fetchImpl: impl })).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("offline mode never touches the network", async () => {
    const { impl, calls } = mockFetch({ [ok]: { contentType: "image/png", body: pngHeader(1200, 1200) } });
    const r = await checkImage(ok, { minLongestSide: 600, fetchImpl: impl, offline: true });
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("checks site-relative images from the public dir and blocks path escapes", async () => {
    const publicDir = path.join(process.cwd(), "public");
    expect((await checkImage("/does-not-exist.png", { minLongestSide: 600, publicDir })).ok).toBe(false);
    const esc = await checkImage("/../package.json", { minLongestSide: 600, publicDir });
    expect(esc.ok).toBe(false);
  });
});
