import React, { useState, useEffect, useCallback } from "react";

const NewsView = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(null);
  const [articleText, setArticleText] = useState("");
  const [articleLoading, setArticleLoading] = useState(false);

  const loadYahooRss = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/news"); // 自作APIを叩く
      if (!res.ok) throw new Error("取得失敗");
      const data = await res.json();
      setItems(data);
    } catch (e) {
      setErr("ニュースを取得できませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  const openArticle = useCallback(async (item) => {
    setSelected(item);
    setArticleLoading(true);
    try {
      const res = await fetch(`/api/news?url=${encodeURIComponent(item.link)}`);
      const data = await res.json();
      setArticleText(data.content || "本文なし");
    } catch {
      setArticleText("読み込みエラー");
    } finally {
      setArticleLoading(false);
    }
  }, []);

  useEffect(() => { loadYahooRss(); }, [loadYahooRss]);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b flex justify-between items-center">
        <span className="font-bold text-lg">ニュース</span>
        <button onClick={loadYahooRss} className="text-blue-500 text-sm">更新</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!selected ? (
          items.map((it, i) => (
            <div key={i} onClick={() => openArticle(it)} className="p-3 border rounded-xl shadow-sm cursor-pointer">
              <div className="font-bold text-sm">{it.title}</div>
              <div className="text-[10px] text-gray-400 mt-1">{it.pubDate}</div>
            </div>
          ))
        ) : (
          <div>
            <button onClick={() => setSelected(null)} className="mb-4 text-sm text-gray-500">← 戻る</button>
            <div className="font-bold mb-4">{selected.title}</div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {articleLoading ? "読み込み中..." : articleText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsView;
