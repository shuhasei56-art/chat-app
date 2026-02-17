// functions/api/news.js (Cloudflare Pages Functions)
// YahooニュースのRSSをJSONに変換して返すAPI

export async function onRequest(context) {
  const rssUrl = "https://news.yahoo.co.jp/rss/topics/top-picks.xml";
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";

  try {
    const res = await fetch(rssUrl, {
      headers: { "User-Agent": ua },
      redirect: "follow",
    });

    if (!res.ok) throw new Error(`Yahoo RSS error: ${res.status}`);

    const xmlText = await res.text();

    // シンプルな正規表現によるXML -> JSON変換（ライブラリ不要）
    const items = [];
    const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);

    for (const match of itemMatches) {
      const content = match[1];
      const title = content.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1") || "";
      const link = content.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
      const pubDate = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";
      const description = content.match(/<description>([\s\S]*?)<\/description>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1") || "";

      if (title && link) {
        items.push({ title, link, pubDate, desc: description });
      }
    }

    return new Response(JSON.stringify(items), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
