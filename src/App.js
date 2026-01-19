import React, { useState, useEffect } from 'react';
import { db } from './firebase'; // 作成したfirebase.jsを読み込み
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';

function App() {
  const [messages, setMessages] = useState([]);
  const [formValue, setFormValue] = useState('');

  // データベースからメッセージをリアルタイムで受け取る設定
  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, []);

  // 送信ボタンを押した時の処理
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!formValue.trim()) return;

    await addDoc(collection(db, 'messages'), {
      text: formValue,
      createdAt: serverTimestamp(),
    });

    setFormValue(''); // 入力欄を空にする
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#1a73e8', padding: '10px', color: 'white', borderRadius: '8px 8px 0 0' }}>
        <h1 style={{ fontSize: '20px', margin: 0 }}>Chat-app</h1>
      </header>

      <div style={{ height: '400px', overflowY: 'auto', border: '1px solid #ddd', padding: '15px', backgroundColor: '#f9f9f9' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ marginBottom: '10px', padding: '8px', backgroundColor: 'white', borderRadius: '5px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
            {msg.text}
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex', marginTop: '10px' }}>
        <input 
          value={formValue} 
          onChange={(e) => setFormValue(e.target.value)} 
          placeholder="メッセージを入力..."
          style={{ flexGrow: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginRight: '5px' }}
        />
        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          送信
        </button>
      </form>
    </div>
  );
}

export default App;