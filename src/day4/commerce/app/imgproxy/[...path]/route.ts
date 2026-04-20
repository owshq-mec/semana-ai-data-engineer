import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const MAX_CONCURRENT = 2;
let inflight = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (inflight < MAX_CONCURRENT) {
    inflight += 1;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  inflight += 1;
}

function release(): void {
  inflight = Math.max(0, inflight - 1);
  const next = waiters.shift();
  if (next) next();
}

async function fetchWithRetry(target: string, attempts: number = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch(target, {
        cache: "force-cache",
        signal: controller.signal,
        headers: {
          accept: "image/jpeg,image/*;q=0.9,*/*;q=0.8",
          "user-agent": "shopagent-commerce/0.1",
        },
      });
      clearTimeout(timeout);
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 2_000 * (i + 1)));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1_500 * (i + 1)));
      }
    }
  }
  throw lastErr ?? new Error("fetch failed");
}

export async function GET(request: NextRequest) {
  const rest = request.nextUrl.pathname.replace(/^\/imgproxy/, "");
  const target = `https://image.pollinations.ai${rest}${request.nextUrl.search}`;

  await acquire();
  try {
    const upstream = await fetchWithRetry(target);
    if (!upstream.ok || !upstream.body) {
      return new Response(`upstream ${upstream.status}`, { status: upstream.status });
    }
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") || "image/jpeg",
        "cache-control": "public, max-age=86400, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "proxy error";
    return new Response(message, { status: 504 });
  } finally {
    release();
  }
}
