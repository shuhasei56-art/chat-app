import React from "react";

const RSS_URL = "https://news.yahoo.co.jp/rss/topics/top-picks.xml";

function stripPreamble(text) {
  const i = text.indexOf("<");
  return i >= 0 ? text.slice(i) : text;
}
function decodeHtml(str = "") {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
function parseRss(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "text/xml");
  return Array.from(xml.querySelectorAll("item")).map((it) => ({
    title: it.querySelector("title")?.textContent?.trim() ?? "",
    link: it.querySelector("link")?.textContent?.trim() ?? "",
    pubDate: it.querySelector("pubDate")?.textContent?.trim() ?? "",
  }));
}
function extractArticleText(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const ld = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    .map((s) => s.textContent || "")
    .join("\n");
  const m = ld.match(/"articleBody"\s*:\s*"([\s\S]*?)"\s*(,|\})/);
  if (m?.[1]) {
    const body = decodeHtml(m[1])
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\u003c/g, "<")
      .replace(/\\u003e/g, ">")
      .replace(/\\u0026/g, "&");
    return body.replace(/<[^>]+>/g, "").trim();
  }
  const ps = Array.from(doc.querySelectorAll("p"))
    .map((p) => (p.textContent || "").trim())
    .filter(Boolean);
  const text = ps.slice(0, 80).join("\n\n").trim();
  return text || "本文を抽出できませんでした。「ブラウザで開く」をお試しください。";
}
async function fetchWithTimeout(url, ms = 9000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}
async function fetchViaApiNews(targetUrl) {
  const origin = window.location.origin;
  const api = `${origin}/api/news?url=${encodeURIComponent(targetUrl)}`;
  return fetchWithTimeout(api, 9000);
}
export default function News({ onOpenUrl }) {
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [items, setItems] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [articleLoading, setArticleLoading] = React.useState(false);
  const [articleText, setArticleText] = React.useState("");

  const openUrl = React.useCallback(
    (url) => {
      if (onOpenUrl) return onOpenUrl(url);
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [onOpenUrl]
  );

  const loadRss = React.useCallback(async () => {
    setLoading(true);
    setErr("");
    setSelected(null);
    setArticleText("");
    try {
      const res = await fetchViaApiNews(RSS_URL);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(
            "ニュースAPI (/api/news) が見つかりません (404)。\nCloudflareに /api/news を実装してください。"
          );
        }
        throw new Error(`Yahoo RSSの取得に失敗しました (${res.status})`);
      }
      const text = stripPreamble(await res.text());
      const parsed = parseRss(text);
      setItems(parsed);
      if (!parsed.length) setErr("記事が見つかりませんでした");
    } catch (e) {
      setErr(e?.message || "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  const openArticle = React.useCallback(async (item) => {
    setSelected(item);
    setArticleLoading(true);
    setArticleText("");
    try {
      const res = await fetchViaApiNews(item.link);
      if (!res.ok) throw new Error(`記事の取得に失敗しました (${res.status})`);
      const html = stripPreamble(await res.text());
      setArticleText(extractArticleText(html));
    } catch (e) {
      setArticleText(e?.message || "取得に失敗しました");
    } finally {
      setArticleLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadRss();
  }, [loadRss]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="text-2xl font-extrabold">ニュース</div>
        <button onClick={loadRss} disabled={loading} className="text-green-600 font-bold">
          更新
        </button>
      </div>

      {err ? (
        <div className="mx-4 mb-3 p-3 rounded-2xl bg-red-50 text-red-700 font-semibold whitespace-pre-wrap">
          {err}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {!selected ? (
          <>
            {loading ? <div className="text-slate-500 font-semibold">読み込み中...</div> : null}
            <div className="space-y-3">
              {items.map((it, idx) => (
                <button
                  key={idx}
                  onClick={() => openArticle(it)}
                  className="w-full text-left p-4 rounded-2xl bg-white shadow-sm border border-slate-100"
                >
                  <div className="font-extrabold">{it.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{it.pubDate}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelected(null);
                  setArticleText("");
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 font-bold"
              >
                ← 戻る
              </button>
              <button onClick={() => openUrl(selected.link)} className="px-3 py-2 rounded-xl bg-slate-100 font-bold">
                ブラウザで開く
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100">
              <div className="text-lg font-extrabold">{selected.title}</div>
              <div className="mt-1 text-xs text-slate-500">{selected.pubDate}</div>
              <div className="mt-4 whitespace-pre-wrap leading-7">
                {articleLoading ? "本文を読み込み中..." : articleText}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
