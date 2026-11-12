import { readFile } from "node:fs/promises";
import path from "node:path";
import probe from "probe-image-size";
import type { ImageKind } from "@/lib/taxonomy";

export type ImageCheckOk = { ok: true; url: string; width: number; height: number; contentType: string };
export type ImageCheckFail = { ok: false; url: string; reason: string };
export type ImageCheckResult = ImageCheckOk | ImageCheckFail;

export type ImageCheckOptions = {
  minLongestSide: number;
  fetchImpl?: typeof fetch;
  /** Directory that site-relative URLs ("/seed/x.png") resolve against. */
  publicDir?: string;
  timeoutMs?: number;
  /** Skip all remote checks (they fail with a clear reason). Used for deterministic tests. */
  offline?: boolean;
  /** Max bytes to download while looking for image dimensions. */
  maxProbeBytes?: number;
};

export type ImageChecker = (url: string, kind: ImageKind) => Promise<ImageCheckResult>;

const MIME_BY_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

function sizeVerdict(url: string, width: number, height: number, contentType: string, min: number): ImageCheckResult {
  const longest = Math.max(width, height);
  if (longest < min) return { ok: false, url, reason: `too small: ${width}x${height} (longest side < ${min}px)` };
  return { ok: true, url, width, height, contentType };
}

async function checkLocal(url: string, opts: ImageCheckOptions): Promise<ImageCheckResult> {
  const publicDir = path.resolve(opts.publicDir ?? path.join(process.cwd(), "public"));
  const file = path.resolve(publicDir, "." + decodeURIComponent(url.split("?")[0]!));
  if (!file.startsWith(publicDir + path.sep)) return { ok: false, url, reason: "path escapes public dir" };
  let buf: Buffer;
  try {
    buf = await readFile(file);
  } catch {
    return { ok: false, url, reason: "local file not found (would be HTTP 404)" };
  }
  const info = probe.sync(buf);
  if (!info) return { ok: false, url, reason: "not a recognizable image" };
  return sizeVerdict(url, info.width, info.height, MIME_BY_TYPE[info.type] ?? info.mime, opts.minLongestSide);
}

async function checkRemote(url: string, opts: ImageCheckOptions): Promise<ImageCheckResult> {
  if (opts.offline) return { ok: false, url, reason: "offline mode: remote image not checked" };
  const fetchImpl = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000);
  try {
    let res: Response;
    try {
      res = await fetchImpl(url, { redirect: "follow", signal: ctrl.signal, headers: { accept: "image/*" } });
    } catch (e) {
      return { ok: false, url, reason: `network error: ${(e as Error).name === "AbortError" ? "timeout" : (e as Error).message}` };
    }
    if (res.status !== 200) {
      await res.body?.cancel().catch(() => {});
      return { ok: false, url, reason: `HTTP ${res.status}` };
    }
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
      await res.body?.cancel().catch(() => {});
      return { ok: false, url, reason: `content-type is "${contentType || "missing"}", not image/*` };
    }
    if (!res.body) return { ok: false, url, reason: "empty body" };

    // Read just enough bytes to learn the dimensions.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    const max = opts.maxProbeBytes ?? 1024 * 1024;
    let info: ReturnType<typeof probe.sync> = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (value) {
        chunks.push(value);
        total += value.byteLength;
        info = probe.sync(Buffer.concat(chunks));
        if (info) break;
      }
      if (done || total >= max) break;
    }
    await reader.cancel().catch(() => {});
    if (!info) return { ok: false, url, reason: "could not read image dimensions" };
    return sizeVerdict(url, info.width, info.height, contentType, opts.minLongestSide);
  } finally {
    clearTimeout(timer);
  }
}

/** Validate one image URL: HTTP 200, image/* content-type, longest side >= minLongestSide. */
export async function checkImage(url: string, opts: ImageCheckOptions): Promise<ImageCheckResult> {
  if (url.startsWith("/") && !url.startsWith("//")) return checkLocal(url, opts);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, url, reason: "invalid URL" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, url, reason: `unsupported protocol ${parsed.protocol}` };
  }
  return checkRemote(url, opts);
}

export function createImageChecker(opts: ImageCheckOptions): ImageChecker {
  return (url) => checkImage(url, opts);
}
