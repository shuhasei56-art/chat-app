import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';

function App() {
  const [messages, setMessages] = useState([]);
  const [formValue, setFormValue] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, []);

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
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <header style={{ backgroundColor: '#1a73e8', padding: '15px', color: 'white', borderRadius: '8px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Chat-app</h1>
      </header>
      <div style={{ height: '400px', overflowY: 'auto', border: '1px solid #ddd', margin: '10px 0', padding: '10px', backgroundColor: '#f9f9f9' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ background: 'white', padding: '8px', marginBottom: '5px', borderRadius: '5px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
            {msg.text}
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} style={{ display: 'flex' }}>
        <input value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder="メッセージ..." style={{ flex: 1, padding: '10px' }} />
        <button type="submit" style={{ padding: '10px', background: '#1a73e8', color: 'white', border: 'none' }}>送信</button>
      </form>
    </div>
  );
}

export default App;