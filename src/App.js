import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase'; // firebase.jsから読み込み
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';

function App() {
  const [messages, setMessages] = useState([]);
  const [formValue, setFormValue] = useState('');

  // メッセージをリアルタイムで取得
  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, []);

  // メッセージ送信
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!formValue.trim()) return;

    await addDoc(collection(db, 'messages'), {
      text: formValue,
      createdAt: serverTimestamp(),
    });

    setFormValue('');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Chat-app</h1>
      <div style={{ height: '400px', overflowY: 'scroll', border: '1px solid #ccc', padding: '10px' }}>
        {messages.map(msg => (
          <p key={msg.id}><strong>匿名:</strong> {msg.text}</p>
        ))}
      </div>
      <form onSubmit={sendMessage} style={{ marginTop: '10px' }}>
        <input 
          value={formValue} 
          onChange={(e) => setFormValue(e.target.value)} 
          placeholder="メッセージを入力"
          style={{ width: '80%', padding: '10px' }}
        />
        <button type="submit" style={{ width: '18%', padding: '10px' }}>送信</button>
      </form>
    </div>
  );
}

export default App;