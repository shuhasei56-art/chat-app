import React from "react";
import { Newspaper, RefreshCw, ExternalLink, ChevronLeft, Clock3 } from "lucide-react";

const RSS_FEEDS = [
  {
    key: "yahoo-top",
    label: "Yahoo!ニュース",
    url: "https://news.yahoo.co.jp/rss/topics/top-picks.xml",
  },
  {
    key: "google-ja",
    label: "Google ニュース",
    url: "https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja",
  },
];

const REMOTE_PROXY = process.env.REACT_APP_NEWS_PROXY || "";
const RSS2JSON_BASE = "https://api.rss2json.com/v1/api.json";
const ALLORIGINS_BASE = "https://api.allorigins.win/raw?url=";

function decodeHtml(str = "") {
  return str
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/");
}

function cleanText(str = "") {
  return decodeHtml(str)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPreamble(text) {
  const i = text.indexOf("<");
  return i >= 0 ? text.slice(i) : text;
}

function formatRelativeOrAbsolute(dateStr = "") {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;

  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "たった今";
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;

  return d.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseRss(xmlText, feedLabel = "") {
  const xml = new DOMParser().parseFromString(xmlText, "text/xml");
  const parserError = xml.querySelector("parsererror");
  if (parserError) throw new Error("RSSの解析に失敗しました");

  const channelTitle = xml.querySelector("channel > title")?.textContent?.trim() || feedLabel || "ニュース";

  return Array.from(xml.querySelectorAll("item"))
    .map((it, idx) => {
      const title = cleanText(it.querySelector("title")?.textContent || "");
      const link = (it.querySelector("link")?.textContent || "").trim();
      const description = cleanText(
        it.querySelector("description")?.textContent ||
          it.querySelector("content\\:encoded")?.textContent ||
          ""
      );
      const pubDateRaw = (it.querySelector("pubDate")?.textContent || "").trim();
      const source =
        cleanText(it.querySelector("source")?.textContent || "") ||
        cleanText(it.querySelector("dc\\:creator")?.textContent || "") ||
        channelTitle;

      let thumbnail = "";
      const enc = it.querySelector("enclosure");
      if (enc?.getAttribute("type")?.startsWith("image/")) {
        thumbnail = enc.getAttribute("url") || "";
      }
      const mediaThumb = it.querySelector("media\\:thumbnail");
      if (!thumbnail && mediaThumb) thumbnail = mediaThumb.getAttribute("url") || "";
      const mediaContent = it.querySelector("media\\:content");
      if (!thumbnail && mediaContent?.getAttribute("medium") === "image") {
        thumbnail = mediaContent.getAttribute("url") || "";
      }

      return {
        id: `${link || title}-${idx}`,
        title,
        link,
        description,
        source,
        pubDateRaw,
        pubDateLabel: formatRelativeOrAbsolute(pubDateRaw),
        thumbnail,
      };
    })
    .filter((it) => it.title && it.link);
}

async function fetchWithTimeout(url, options = {}, ms = 12000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function tryFetchText(url) {
  const res = await fetchWithTimeout(url, {}, 12000);
  if (!res.ok) throw new Error(`${res.status}`);
  return await res.text();
}

async function fetchFeedViaStrategies(feed) {
  const encoded = encodeURIComponent(feed.url);
  const origin = window.location.origin;
  const errors = [];

  const strategies = [
    {
      key: "local-api",
      run: async () => await tryFetchText(`${origin}/api/news?url=${encoded}`),
    },
    ...(REMOTE_PROXY
      ? [
          {
            key: "custom-proxy",
            run: async () => await tryFetchText(`${REMOTE_PROXY.replace(/\/$/, "")}?url=${encoded}`),
          },
        ]
      : []),
    {
      key: "rss2json",
      run: async () => {
        const res = await fetchWithTimeout(`${RSS2JSON_BASE}?rss_url=${encoded}`, {}, 12000);
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (json?.status !== "ok" || !Array.isArray(json?.items)) {
          throw new Error(json?.message || "invalid rss2json response");
        }
        const items = json.items.map((it, idx) => ({
          id: `${it.link || it.title}-${idx}`,
          title: cleanText(it.title || ""),
          link: (it.link || "").trim(),
          description: cleanText(it.description || it.content || ""),
          source: cleanText(it.author || json?.feed?.title || feed.label),
          pubDateRaw: (it.pubDate || "").trim(),
          pubDateLabel: formatRelativeOrAbsolute(it.pubDate || ""),
          thumbnail: it.thumbnail || "",
        })).filter((it) => it.title && it.link);
        return { items, feedName: json?.feed?.title || feed.label, provider: "rss2json" };
      },
    },
    {
      key: "allorigins",
      run: async () => {
        const xmlText = stripPreamble(await tryFetchText(`${ALLORIGINS_BASE}${encoded}`));
        return {
          items: parseRss(xmlText, feed.label),
          feedName: feed.label,
          provider: "allorigins",
        };
      },
    },
    {
      key: "whateverorigin",
      run: async () => {
        const res = await fetchWithTimeout(`https://whateverorigin.org/get?url=${encoded}`, {}, 12000);
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        const xmlText = stripPreamble(json?.contents || "");
        return {
          items: parseRss(xmlText, feed.label),
          feedName: feed.label,
          provider: "whateverorigin",
        };
      },
    },
  ];

  for (const strategy of strategies) {
    try {
      if (strategy.key === "local-api" || strategy.key === "custom-proxy") {
        const xmlText = stripPreamble(await strategy.run());
        return {
          items: parseRss(xmlText, feed.label),
          feedName: feed.label,
          provider: strategy.key,
        };
      }
      const out = await strategy.run();
      if (!out?.items?.length) throw new Error("empty");
      return out;
    } catch (e) {
      errors.push(`${strategy.key}: ${e?.message || String(e)}`);
    }
  }

  throw new Error(errors.join(" / "));
}

function buildMerged(itemsByFeed) {
  return itemsByFeed
    .flatMap((x) => x.items)
    .sort((a, b) => new Date(b.pubDateRaw || 0).getTime() - new Date(a.pubDateRaw || 0).getTime())
    .slice(0, 40);
}

function NewsListItem({ item, onClick }) {
  return (
    <button
      onClick={() => onClick(item)}
      className="w-full text-left bg-white hover:bg-slate-50 active:scale-[0.995] transition rounded-2xl border border-slate-200 px-3 py-3 shadow-sm"
    >
      <div className="flex gap-3 items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
            <span className="truncate">{item.source || "ニュース"}</span>
            {item.pubDateLabel ? <span>• {item.pubDateLabel}</span> : null}
          </div>
          <div className="mt-1 text-[15px] leading-6 font-bold text-slate-900 line-clamp-2">{item.title}</div>
          {item.description ? (
            <div className="mt-1 text-[12px] leading-5 text-slate-500 line-clamp-2">{item.description}</div>
          ) : null}
        </div>

        <div className="w-[92px] h-[92px] shrink-0 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
          {item.thumbnail ? (
            <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <Newspaper className="w-7 h-7 text-slate-400" />
          )}
        </div>
      </div>
    </button>
  );
}

export default function News({ onOpenUrl }) {
  const [loading, setLoading] = React.useState(false);
  const [errorLines, setErrorLines] = React.useState([]);
  const [items, setItems] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [feedStatus, setFeedStatus] = React.useState([]);

  const openUrl = React.useCallback(
    (url) => {
      if (onOpenUrl) return onOpenUrl(url);
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [onOpenUrl]
  );

  const loadNews = React.useCallback(async () => {
    setLoading(true);
    setErrorLines([]);
    setSelected(null);

    const success = [];
    const fails = [];

    for (const feed of RSS_FEEDS) {
      try {
        const result = await fetchFeedViaStrategies(feed);
        success.push({ ...result, feed });
      } catch (e) {
        fails.push(`${feed.label}: ${e?.message || "取得失敗"}`);
      }
    }

    const merged = buildMerged(success);
    setItems(merged);
    setFeedStatus(
      success.map((s) => ({
        label: s.feed.label,
        provider: s.provider,
        count: s.items.length,
      }))
    );
    setErrorLines(fails);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadNews();
  }, [loadNews]);

  return (
    <div className="h-full bg-[#f5f6f8] flex flex-col">
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 pt-4 pb-3">
        {!selected ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[26px] leading-none font-black text-slate-900">ニュース</div>
                <div className="mt-1 text-[12px] text-slate-500">LINE風の一覧で最新記事を表示</div>
              </div>
              <button
                onClick={loadNews}
                disabled={loading}
                className="h-11 px-4 rounded-full bg-[#06c755] text-white font-bold disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                更新
              </button>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
              {feedStatus.map((s) => (
                <div key={s.label} className="shrink-0 px-3 py-2 rounded-full bg-[#f2fff6] border border-[#c9f2d8] text-[12px] font-semibold text-[#169b4a]">
                  {s.label} {s.count}件
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setSelected(null)} className="h-11 w-11 rounded-full bg-slate-100 flex items-center justify-center">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[18px] font-black truncate">記事詳細</div>
              <div className="text-[12px] text-slate-500 truncate">{selected.source}</div>
            </div>
            <button onClick={() => openUrl(selected.link)} className="h-11 px-4 rounded-full bg-[#06c755] text-white font-bold flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              開く
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-28">
        {!selected ? (
          <>
            {errorLines.length ? (
              <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-800">
                <div className="font-bold">一部の取得経路で失敗しました</div>
                <div className="mt-1">別の経路で取得できた記事はそのまま表示しています。</div>
                <div className="mt-2 whitespace-pre-wrap">{errorLines.join("\n")}</div>
              </div>
            ) : null}

            {loading && items.length === 0 ? (
              <div className="px-4 py-10 text-center text-slate-500 font-semibold">ニュースを読み込み中...</div>
            ) : null}

            {!loading && items.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center shadow-sm">
                <div className="mx-auto w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                  <Newspaper className="w-7 h-7 text-slate-400" />
                </div>
                <div className="mt-3 text-[17px] font-black">ニュースを読み込めませんでした</div>
                <div className="mt-2 text-[13px] leading-6 text-slate-500">
                  公開RSS・プロキシの状態により失敗することがあります。更新ボタンでもう一度試してください。
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              {items.map((item) => (
                <NewsListItem key={item.id} item={item} onClick={setSelected} />
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {selected.thumbnail ? (
              <div className="overflow-hidden rounded-[28px] bg-white border border-slate-200 shadow-sm">
                <img src={selected.thumbnail} alt="" className="w-full h-56 object-cover" />
              </div>
            ) : null}

            <div className="bg-white border border-slate-200 shadow-sm rounded-[28px] p-5">
              <div className="flex items-center gap-2 text-[12px] text-slate-500 font-semibold">
                <Clock3 className="w-4 h-4" />
                <span>{selected.pubDateLabel || "時刻不明"}</span>
                <span>•</span>
                <span className="truncate">{selected.source || "ニュース"}</span>
              </div>
              <div className="mt-3 text-[22px] leading-9 font-black text-slate-900">{selected.title}</div>
              <div className="mt-4 text-[14px] leading-7 text-slate-700 whitespace-pre-wrap">
                {selected.description || "この記事の本文プレビューは取得できなかったため、元ページを開いて確認してください。"}
              </div>
              <button
                onClick={() => openUrl(selected.link)}
                className="mt-5 w-full h-12 rounded-2xl bg-[#06c755] text-white font-black flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                元記事を開く
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
