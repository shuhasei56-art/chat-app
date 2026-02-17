import React, { useState, useEffect, useCallback } from "react";

const NewsView = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(null);
  const [articleText, setArticleText] = useState("");
  const [articleLoading, setArticleLoading] = useState(false);

  // ニュース一覧取得
  const loadYahooRss = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error("ニュースを取得できませんでした");
      const data = await res.json();
      setItems(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 記事本文取得
  const openArticle = useCallback(async (item) => {
    setSelected(item);
    setArticleLoading(true);
    setArticleText("");
    try {
      const res = await fetch(`/api/news?url=${encodeURIComponent(item.link)}`);
      if (!res.ok) throw new Error("本文の読み込みに失敗しました");
      const data = await res.json();
      setArticleText(data.content || "本文の抽出に失敗しました。");
    } catch (e) {
      setArticleText("記事の取得に失敗しました。ブラウザで直接確認してください。");
    } finally {
      setArticleLoading(false);
    }
  }, []);

  useEffect(() => {
    loadYahooRss();
  }, [loadYahooRss]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-5 py-4 flex items-center justify-between bg-white border-b sticky top-0 z-10">
        <h1 className="text-xl font-black text-slate-900">ニュース</h1>
        <button onClick={loadYahooRss} disabled={loading} className="text-green-600 font-bold text-sm">
          {loading ? "更新中..." : "更新"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {err && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold">{err}</div>}

        {!selected ? (
          <div className="space-y-3">
            {items.map((it, idx) => (
              <button
                key={idx}
                onClick={() => openArticle(it)}
                className="w-full text-left p-4 rounded-2xl bg-white shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <div className="font-extrabold text-slate-800 leading-snug">{it.title}</div>
                <div className="mt-2 text-[10px] text-slate-400 font-bold">{it.pubDate}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setSelected(null)} className="px-4 py-2 rounded-xl bg-slate-200 font-bold text-sm">← 戻る</button>
              <a href={selected.link} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-blue-500 text-white font-bold text-sm">ブラウザ</a>
            </div>
            <div className="p-5 rounded-3xl bg-white shadow-sm border border-slate-100">
              <h2 className="text-lg font-black text-slate-900">{selected.title}</h2>
              <div className="mt-4 text-slate-700 leading-relaxed text-[15px] whitespace-pre-wrap">
                {articleLoading ? "本文を読み込み中..." : articleText}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsView;
