// App.js 修正版（ビデオ点滅防止）
// ポイント：
// 1. getUserMedia は一度だけ取得
// 2. video.srcObject を再代入しない
// 3. key を video 要素に付けない
// 4. state 変化で MediaStream を作り直さない

import React, { useEffect, useRef, useState } from "react";

export default function App() {
  const localVideoRef = useRef(null);
  const streamRef = useRef(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (started && !streamRef.current) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          streamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        });
    }

    return () => {};
  }, [started]);

  return (
    <div style={{ background: "#0b1220", minHeight: "100vh", padding: 20 }}>
      <button
        onClick={() => setStarted(true)}
        style={{ marginBottom: 12 }}
      >
        通話開始
      </button>

      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          maxWidth: 600,
          borderRadius: 16,
          background: "black",
        }}
      />
    </div>
  );
}
