import { crc32 } from "node:zlib";

/** Minimal valid PNG header (signature + IHDR) — enough for probe-image-size to read dimensions. */
export function pngHeader(width: number, height: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8; // bit depth
  data[9] = 6; // RGBA
  const type = Buffer.from("IHDR");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(13);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])) >>> 0);
  return Buffer.concat([sig, len, type, data, crc, Buffer.alloc(64)]);
}

type Route = { status?: number; contentType?: string; body?: Buffer | string; throws?: string };

/** A fake fetch keyed by URL. Unknown URLs return 404. Records calls. */
export function mockFetch(routes: Record<string, Route>) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push(url);
    const r = routes[url];
    if (!r) return new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
    if (r.throws) throw new Error(r.throws);
    const body = typeof r.body === "string" || r.body === undefined ? (r.body ?? "") : new Uint8Array(r.body);
    return new Response(body, {
      status: r.status ?? 200,
      headers: r.contentType ? { "content-type": r.contentType } : {},
    });
  }) as typeof fetch;
  return { impl, calls };
}
