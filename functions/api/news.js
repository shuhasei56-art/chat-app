export async function onRequest(context) {
  const u = new URL(context.request.url);
  const target = u.searchParams.get("url");
  if (!target) return new Response("missing url", { status: 400 });

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response("bad url", { status: 400 });
  }

  const allow = new Set(["news.yahoo.co.jp", "headlines.yahoo.co.jp"]);
  if (!allow.has(targetUrl.hostname)) return new Response("blocked host", { status: 403 });

  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";

  const res = await fetch(target, {
    headers: {
      "User-Agent": ua,
      Accept: "text/html,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });

  const contentType = res.headers.get("content-type") || "text/plain";
  const body = await res.arrayBuffer();

  return new Response(body, {
    status: res.status,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=60",
    },
  });
}
