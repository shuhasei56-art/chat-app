// functions/api/news.js (Cloudflare Pages Functions)
export async function onRequest(context) {
  const u = new URL(context.request.url);
  const targetUrl = u.searchParams.get("url") || "https://news.yahoo.co.jp/rss/topics/top-picks.xml";
  
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";

  try {
    const res = await fetch(targetUrl, {
      headers: { "User-Agent": ua, "Accept": "application/xml,text/html" },
      redirect: "follow",
    });

    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const text = await res.text();

    // RSS (XML) の解析モード
    if (targetUrl.includes(".xml")) {
      const items = [];
      const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g);

      for (const match of itemMatches) {
        const content = match[1];
        const title = content.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1") || "";
        const link = content.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
        const pubDate = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";
        const desc = content.match(/<description>([\s\S]*?)<\/description>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1") || "";

        if (title && link) {
          items.push({ title: title.trim(), link: link.trim(), pubDate: pubDate.trim(), desc: desc.trim() });
        }
      }
      return new Response(JSON.stringify(items), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 記事本文 (HTML) の簡易抽出モード（Jina Reader風）
    const cleanText = text
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return new Response(JSON.stringify({ content: cleanText }), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
