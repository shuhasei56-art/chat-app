import React from "react";

const RSS_FEEDS = [
  "https://news.yahoo.co.jp/rss/topics/top-picks.xml",
  "https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja",
];

const REMOTE_PROXY = process.env.REACT_APP_NEWS_PROXY || "";

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
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[|\]\]>/g, "");
}

function cleanText(str = "") {
  return decodeHtml(str)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPubDate(pubDate = "") {
  if (!pubDate) return "";
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return pubDate;
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseRss(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "text/xml");
  const parserError = xml.querySelector("parsererror");
  if (parserError) {
    throw new Error("RSSの解析に失敗しました");
  }

  const channelTitle = xml.querySelector("channel > title")?.textContent?.trim() ?? "";

  return Array.from(xml.querySelectorAll("item"))
    .map((it) => ({
      title: cleanText(it.querySelector("title")?.textContent ?? ""),
      link: (it.querySelector("link")?.textContent ?? "").trim(),
      pubDate: formatPubDate(it.querySelector("pubDate")?.textContent?.trim() ?? ""),
      rawPubDate: (it.querySelector("pubDate")?.textContent ?? "").trim(),
      description: cleanText(
        it.querySelector("description")?.textContent ??
          it.querySelector("content\\:encoded")?.textContent ??
          ""
      ),
      source:
        cleanText(it.querySelector("source")?.textContent ?? "") ||
        cleanText(it.querySelector("dc\\:creator")?.textContent ?? "") ||
        channelTitle,
    }))
    .filter((it) => it.title && it.link);
}

function extractArticleText(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");

  const jsonLdBlocks = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))
    .map((s) => s.textContent || "")
    .join("\n");

  const bodyMatch = jsonLdBlocks.match(/"articleBody"\s*:\s*"([\s\S]*?)"\s*(,|\})/);
  if (bodyMatch?.[1]) {
    const body = decodeHtml(bodyMatch[1])
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\u003c/g, "<")
      .replace(/\\u003e/g, ">")
      .replace(/\\u0026/g, "&")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (body.length > 80) return body;
  }

  const metaDescription =
    doc.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
    doc.querySelector('meta[name="description"]')?.getAttribute("content") ||
    "";

  const paragraphs = Array.from(doc.querySelectorAll("article p, main p, p"))
    .map((p) => (p.textContent || "").trim())
    .filter(Boolean)
    .filter((t) => t.length > 20)
    .slice(0, 40);

  const combined = [cleanText(metaDescription), ...paragraphs].filter(Boolean).join("\n\n").trim();
  if (combined) return combined;

  return "本文を抽出できませんでした。『ブラウザで開く』で記事を確認してください。";
}

async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

function proxyCandidates(targetUrl) {
  const encoded = encodeURIComponent(targetUrl);
  const origin = window.location.origin;
  const candidates = [
    {
      key: "local-api",
      url: `${origin}/api/news?url=${encoded}`,
      parse: async (res) => await res.text(),
    },
  ];

  if (REMOTE_PROXY) {
    const base = REMOTE_PROXY.replace(/\/$/, "");
    candidates.push({
      key: "custom-proxy",
      url: `${base}?url=${encoded}`,
      parse: async (res) => await res.text(),
    });
  }

  candidates.push({
    key: "whateverorigin",
    url: `https://whateverorigin.org/get?url=${encoded}`,
    parse: async (res) => {
      const json = await res.json();
      return json?.contents || "";
    },
  });

  return candidates;
}

async function fetchViaAvailableProxy(targetUrl) {
  const errors = [];

  for (const candidate of proxyCandidates(targetUrl)) {
    try {
      const res = await fetchWithTimeout(candidate.url, {}, 10000);
      if (!res.ok) throw new Error(`${candidate.key}: ${res.status}`);
      const text = await candidate.parse(res);
      if (!text || typeof text !== "string") throw new Error(`${candidate.key}: empty response`);
      return text;
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }

  throw new Error(`ニュース取得に失敗しました: ${errors.join(" / ")}`);
}

export default function News({ onOpenUrl }) {
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [items, setItems] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [articleLoading, setArticleLoading] = React.useState(false);
  const [articleText, setArticleText] = React.useState("");
  const [feedName, setFeedName] = React.useState("");

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

    const attemptErrors = [];

    for (const feedUrl of RSS_FEEDS) {
      try {
        const xmlText = stripPreamble(await fetchViaAvailableProxy(feedUrl));
        const parsed = parseRss(xmlText);
        if (!parsed.length) throw new Error("記事が見つかりませんでした");
        setItems(parsed);
        setFeedName(parsed[0]?.source || "ニュース");
        setLoading(false);
        return;
      } catch (e) {
        attemptErrors.push(`${feedUrl} -> ${e?.message || "取得失敗"}`);
      }
    }

    setErr(attemptErrors.join("\n"));
    setLoading(false);
  }, []);

  const openArticle = React.useCallback(async (item) => {
    setSelected(item);
    setArticleLoading(true);
    setArticleText(item.description || "");

    try {
      const html = stripPreamble(await fetchViaAvailableProxy(item.link));
      const text = extractArticleText(html);
      setArticleText(text || item.description || "本文を取得できませんでした。");
    } catch (e) {
      setArticleText(item.description || e?.message || "取得に失敗しました");
    } finally {
      setArticleLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadRss();
  }, [loadRss]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-slate-200 bg-white sticky top-0 z-10">
        <div>
          <div className="text-2xl font-extrabold">ニュース</div>
          {feedName ? <div className="text-xs text-slate-500 mt-1">{feedName}</div> : null}
        </div>
        <button onClick={loadRss} disabled={loading} className="text-green-600 font-bold disabled:opacity-50">
          更新
        </button>
      </div>

      {err ? (
        <div className="mx-4 mt-4 p-3 rounded-2xl bg-red-50 text-red-700 font-semibold whitespace-pre-wrap text-sm">
          {err}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {!selected ? (
          <>
            {loading ? <div className="text-slate-500 font-semibold">読み込み中...</div> : null}
            <div className="space-y-3">
              {items.map((it, idx) => (
                <button
                  key={`${it.link}-${idx}`}
                  onClick={() => openArticle(it)}
                  className="w-full text-left p-4 rounded-2xl bg-white shadow-sm border border-slate-100"
                >
                  <div className="font-extrabold leading-6">{it.title}</div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    {it.pubDate ? <span>{it.pubDate}</span> : null}
                    {it.source ? <span>• {it.source}</span> : null}
                  </div>
                  {it.description ? (
                    <div className="mt-3 text-sm text-slate-700 line-clamp-3">{it.description}</div>
                  ) : null}
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
              <div className="text-lg font-extrabold leading-7">{selected.title}</div>
              <div className="mt-2 text-xs text-slate-500">
                {selected.pubDate}
                {selected.source ? ` • ${selected.source}` : ""}
              </div>
              {selected.description ? (
                <div className="mt-4 text-sm text-slate-600 leading-6">要約: {selected.description}</div>
              ) : null}
              <div className="mt-4 whitespace-pre-wrap leading-7 text-slate-800">
                {articleLoading ? "本文を読み込み中..." : articleText}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
