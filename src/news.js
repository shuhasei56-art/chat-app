import React from "react";

/**
 * News.js
 * - Yahoo RSS (topics/top-picks) を取得して一覧表示
 * - 記事をクリックすると本文をアプリ内で表示
 * - 取得は原則「同一オリジンの /api/news?url=... 」経由（Cloudflare Pages Functions）
 *   ※ /api/news が 404 の場合は「Functionsが未デプロイ」の可能性が高いです
 */

const RSS_URL = "https://news.yahoo.co.jp/rss/topics/top-picks.xml";

function withTimeout(fetchPromise, ms = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  const p = fetchPromise(ac.signal).finally(() => clearTimeout(t));
  return { promise: p, abortController: ac };
}

function stripJinaPreamble(text) {
  // 先頭に余計な文字が入るケース対策：最初の "<" から返す
  const i = text.indexOf("<");
  return i >= 0 ? text.slice(i) : text;
}

function decodeHtml(str = "") {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function parseRss(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "text/xml");
  const items = Array.from(xml.querySelectorAll("item")).map((it) => {
    const title = it.querySelector("title")?.textContent?.trim() ?? "";
    const link = it.querySelector("link")?.textContent?.trim() ?? "";
    const pubDate = it.querySelector("pubDate")?.textContent?.trim() ?? "";
    return { title, link, pubDate };
  });
  return items;
}

function extractArticleText(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");

  // 1) JSON-LD articleBody があれば優先
  const ld = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    .map((s) => s.textContent || "")
    .join("\n");

  const m = ld.match(/"articleBody"\s*:\s*"([\s\S]*?)"\s*(,|\})/);
  if (m?.[1]) {
    const body = decodeHtml(m[1])
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, "\"")
      .replace(/\\u003c/g, "<")
      .replace(/\\u003e/g, ">")
      .replace(/\\u0026/g, "&");
    return body.replace(/<[^>]+>/g, "").trim();
  }

  // 2) fallback: pタグを集める
  const ps = Array.from(doc.querySelectorAll("p"))
    .map((p) => (p.textContent || "").trim())
    .filter(Boolean);

  const text = ps.slice(0, 80).join("\n\n").trim();
  return (
    text ||
    "本文を抽出できませんでした。右上の「ブラウザで開く」で確認してください。"
  );
}

async function fetchViaApiNews(url) {
  // 同一オリジン /api/news を使う（Pages Functions）
  const target = `/api/news?url=${encodeURIComponent(url)}`;
  const { promise } = withTimeout((signal) => fetch(target, { signal }), 8000);
  const res = await promise;
  return res;
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
        // 404 の場合は Functions未配置が濃厚
        if (res.status === 404) {
          throw new Error(
            "ニュースAPI (/api/news) が見つかりません (404)。Cloudflare Pages Functions を追加してください。"
          );
        }
        throw new Error(`Yahoo RSSの取得に失敗しました (${res.status})`);
      }
      const text = await res.text();
      const xmlText = stripJinaPreamble(text);
      const parsed = parseRss(xmlText);
      setItems(parsed);
      if (!parsed.length) setErr("記事が見つかりませんでした");
    } catch (e) {
      setErr(e?.message || "Yahoo RSSの取得に失敗しました");
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
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(
            "ニュースAPI (/api/news) が見つかりません (404)。Cloudflare Pages Functions を追加してください。"
          );
        }
        throw new Error(`記事の取得に失敗しました (${res.status})`);
      }
      const html = stripJinaPreamble(await res.text());
      setArticleText(extractArticleText(html));
    } catch (e) {
      setArticleText(e?.message || "記事の取得に失敗しました。");
    } finally {
      setArticleLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadRss();
  }, [loadRss]);

  return (
    <div className="h-full flex flex-col">
      {/* header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="text-2xl font-extrabold">ニュース</div>
        <button
          onClick={loadRss}
          disabled={loading}
          className="text-green-600 font-bold"
        >
          更新
        </button>
      </div>

      {err ? (
        <div className="mx-4 mb-3 p-3 rounded-2xl bg-red-50 text-red-700 font-semibold">
          {err}
        </div>
      ) : null}

      {/* content (scrollable) */}
      <div className="flex-1 overflow-y-auto px-4 pb-28">
        {!selected ? (
          <>
            {loading ? (
              <div className="text-slate-500 font-semibold">読み込み中...</div>
            ) : null}

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
              <button
                onClick={() => openUrl(selected.link)}
                className="px-3 py-2 rounded-xl bg-slate-100 font-bold"
              >
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
