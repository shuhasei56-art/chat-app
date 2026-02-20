import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, onSnapshot, query, orderBy, setLogLevel, Firestore, deleteDoc, updateDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, Auth, User 
} from 'firebase/auth';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  MessageSquare, 
  List, 
  Clock, 
  Trash2, 
  X,
  Send,
  Loader2,
  Mic,
  MicOff,
  Volume2,
  CalendarDays,
  Clock4,
  Sparkles,
  CheckSquare,
  Coffee,
  TrendingUp,
  UserCircle2,
  Search,
  Check,
  ChevronDown,
  LayoutGrid,
  Zap
} from 'lucide-react';

// --- Firebase Configuration ---
declare global {
  const __firebase_config: string | undefined;
  const __app_id: string | undefined;
  const __initial_auth_token: string | undefined;
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
  apiKey: "AIzaSyDE5unWW2OVIbMPSVmRi4m6Zvog-MaCqCo",
  authDomain: "task-build-7e2fc.firebaseapp.com",
  projectId: "task-build-7e2fc",
  storageBucket: "task-build-7e2fc.firebasestorage.app",
  messagingSenderId: "57392741303",
  appId: "1:57392741303:web:4afd91bb943fc76cf48632"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'ai-scheduler-v3';
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- LocalStorage helpers ---
const lsGet = (key: string, fallback = ''): string => {
  try { const v = window.localStorage.getItem(key); return v ?? fallback; } catch { return fallback; }
};
const lsSet = (key: string, value: string) => {
  try { window.localStorage.setItem(key, value); } catch {}
};

// --- Helpers ---
const getLocalDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const pcmToWav = (pcmData: Int16Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 32 + pcmData.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcmData.length * 2, true);
  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    view.setInt16(offset, pcmData[i], true);
  }
  return new Blob([view], { type: 'audio/wav' });
};

const PERSONAS = {
  military: { name: "軍師", prompt: "論理的で効率重視", icon: <TrendingUp size={14}/> },
  healer: { name: "癒やし", prompt: "優しく共感的", icon: <Coffee size={14}/> },
  coach: { name: "鬼コーチ", prompt: "厳しく熱血", icon: <Zap size={14}/> }
};

// --- Main Application ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [viewMode, setViewMode] = useState<'Month' | 'Week'>('Month');
  const [events, setEvents] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => lsGet('gemini_api_key', ''));
  const [ttsApiKey, setTtsApiKey] = useState<string>(() => lsGet('tts_api_key', ''));
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<'Low'|'Normal'|'High'>('Normal');
  const [newTodoTags, setNewTodoTags] = useState('');
  const fileImportRef = useRef<HTMLInputElement | null>(null);

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<keyof typeof PERSONAS>('military');
  const [inputVal, setInputVal] = useState('');
  
  const [newEvent, setNewEvent] = useState({ 
    title: '', date: getLocalDateString(new Date()), 
    startTime: '09:00', endTime: '10:00', category: '仕事' 
  });

  // --- Auth & Data Realtime Sync ---
  useEffect(() => {
    const init = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    init();
    return onAuthStateChanged(auth, (u) => { setUser(u); setIsAuthReady(true); });
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) return;
    const eventsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'events');
    const todosRef = collection(db, 'artifacts', appId, 'users', user.uid, 'todos');
    const messagesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'messages');

    const unsubEvents = onSnapshot(query(eventsRef), (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubTodos = onSnapshot(query(todosRef), (snapshot) => {
      setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubMessages = onSnapshot(query(messagesRef, orderBy('timestamp', 'asc')), (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubEvents(); unsubTodos(); unsubMessages(); };
  }, [isAuthReady, user]);

  // --- AI Actions ---
  const playVoice = async (text: string) => {
    if (!text) return;
    try {
      setIsSpeaking(true);
      const payload = {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } }
        },
        model: "gemini-2.5-flash-preview-tts"
      };
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent((ttsApiKey || geminiApiKey) || '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      const audioData = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        const audio = new Audio(URL.createObjectURL(pcmToWav(new Int16Array(base64ToArrayBuffer(audioData)), 24000)));
        audio.onended = () => setIsSpeaking(false);
        await audio.play();
      } else { setIsSpeaking(false); }
    } catch (e) { setIsSpeaking(false); }
  };

  const askAI = async (userInput: string) => {
    if (!userInput.trim() || !user) return;
    setIsAILoading(true);
    setIsChatOpen(true);
    const messagesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'messages');
    await addDoc(messagesRef, { text: userInput, role: 'user', timestamp: new Date().toISOString() });

    try {
      const systemPrompt = `あなたは${PERSONAS[selectedPersona].name}の人格をもつAI秘書です。${PERSONAS[selectedPersona].prompt}。
予定の登録を指示されたら、末尾に必ず次のJSONを追加して下さい：{"events": [{"title": "...", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM"}]}
TODOの登録なら：{"todos": [{"text": "..."}]}
本日は ${new Date().toLocaleDateString('ja-JP')} です。`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${encodeURIComponent(geminiApiKey || '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `System: ${systemPrompt}\nUser: ${userInput}` }] }] })
      });

      const data = await response.json();
      const aiResponse = data.candidates[0].content.parts[0].text;
      const jsonMatch = aiResponse.match(/\{.*\}/s);
      
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.events) {
            const evRef = collection(db, 'artifacts', appId, 'users', user.uid, 'events');
            for (const ev of parsed.events) await addDoc(evRef, { ...ev, category: 'AI提案', createdAt: new Date().toISOString() });
          }
          if (parsed.todos) {
            const tdRef = collection(db, 'artifacts', appId, 'users', user.uid, 'todos');
            for (const td of parsed.todos) await addDoc(tdRef, { ...td, completed: false, createdAt: new Date().toISOString() });
          }
        } catch (e) { console.error(e); }
      }

      const cleanText = aiResponse.replace(/\{.*\}/s, '').trim();
      await addDoc(messagesRef, { text: cleanText, role: 'ai', timestamp: new Date().toISOString() });
      playVoice(cleanText);
    } catch (e) { console.error(e); } finally { setIsAILoading(false); }
  };

  const handleSaveEvent = async () => {
    if (!newEvent.title || !user) return;
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'events'), {
      ...newEvent, createdAt: new Date().toISOString()
    });
    setIsEventModalOpen(false);
    setNewEvent({ title: '', date: getLocalDateString(new Date()), startTime: '09:00', endTime: '10:00', category: '仕事' });
  };

  const deleteItem = async (col: string, id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, col, id));
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    if (!user) return;
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'todos', id), { completed: !completed });
  };

  const addTodo = async () => {
    if (!user || !newTodoText.trim()) return;
    const tags = newTodoTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .slice(0, 10);
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'todos'), {
      text: newTodoText.trim(),
      completed: false,
      priority: newTodoPriority,
      tags,
      createdAt: new Date().toISOString(),
    });
    setNewTodoText('');
    setNewTodoTags('');
    setNewTodoPriority('Normal');
  };

  const exportData = async () => {
    const payload = { exportedAt: new Date().toISOString(), events, todos, messages };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-scheduler-export-${getLocalDateString(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    if (!user) return;
    const text = await file.text();
    const parsed = JSON.parse(text);
    const evRef = collection(db, 'artifacts', appId, 'users', user.uid, 'events');
    const tdRef = collection(db, 'artifacts', appId, 'users', user.uid, 'todos');
    const msgRef = collection(db, 'artifacts', appId, 'users', user.uid, 'messages');

    if (Array.isArray(parsed?.events)) {
      for (const ev of parsed.events) {
        const { id, ...rest } = ev || {};
        if (rest?.title && rest?.date) await addDoc(evRef, { ...rest, createdAt: new Date().toISOString() });
      }
    }
    if (Array.isArray(parsed?.todos)) {
      for (const td of parsed.todos) {
        const { id, ...rest } = td || {};
        if (rest?.text) await addDoc(tdRef, { completed: false, ...rest, createdAt: new Date().toISOString() });
      }
    }
    if (Array.isArray(parsed?.messages)) {
      for (const m of parsed.messages) {
        const { id, ...rest } = m || {};
        if (rest?.text && rest?.role) await addDoc(msgRef, { ...rest, timestamp: new Date().toISOString() });
      }
    }
  };

  const saveSettings = () => {
    lsSet('gemini_api_key', geminiApiKey);
    lsSet('tts_api_key', ttsApiKey);
    setIsSettingsOpen(false);
  };


  // --- Calendar Layout Logic ---
  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDay = new Date(year, month, 1).getDay(); // 0=Sun
    const grid = [];
    const date = new Date(year, month, 1);
    date.setDate(date.getDate() - (startDay === 0 ? 6 : startDay - 1)); // Mon Start

    for (let i = 0; i < 42; i++) {
      grid.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return grid;
  }, [currentDate]);

  if (!isAuthReady) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

  return (
    <div className="flex h-screen bg-[#FDFDFD] text-[#333] font-sans overflow-hidden">
      
      {/* Sidebar - Matching image_e2535d.png */}
      <aside className="w-72 border-r border-gray-100 flex flex-col p-6 bg-white shrink-0 overflow-y-auto scrollbar-hide">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold">{currentDate.getFullYear()}年{currentDate.getMonth() + 1}月</h2>
          <div className="flex gap-2 text-gray-400">
            <ChevronLeft className="cursor-pointer hover:text-gray-600" size={18} onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} />
            <ChevronRight className="cursor-pointer hover:text-gray-600" size={18} onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} />
          </div>
        </div>

        {/* Mini Mini Calendar */}
        <div className="grid grid-cols-7 gap-y-3 text-center mb-10">
          {['月', '火', '水', '木', '金', '土', '日'].map(d => <span key={d} className="text-[10px] text-gray-400 font-bold">{d}</span>)}
          {calendarGrid.slice(0, 35).map((d, i) => (
            <div key={i} className={`text-xs h-7 flex items-center justify-center rounded-full transition-all ${
              d.toDateString() === new Date().toDateString() ? 'bg-rose-100 text-rose-600 font-bold' : 
              d.getMonth() === currentDate.getMonth() ? 'text-gray-700' : 'text-gray-300'
            }`}>
              {d.getDate()}
            </div>
          ))}
        </div>

        {/* Categories Section */}
        <div className="space-y-6 flex-1">
          <div>
            <div className="flex items-center justify-between mb-4 cursor-pointer group">
              <div className="flex items-center gap-2">
                <div className="bg-orange-500 w-5 h-5 rounded flex items-center justify-center text-white text-[10px]">🐱</div>
                <span className="text-sm font-bold text-gray-700">Toki</span>
              </div>
              <ChevronDown size={14} className="text-gray-300 group-hover:text-gray-500" />
            </div>
            <div className="flex items-center gap-3 pl-1">
              <div className="w-4 h-4 bg-orange-800 rounded flex items-center justify-center text-white"><Check size={10} /></div>
              <span className="text-sm text-gray-600">Toki</span>
            </div>
          </div>

          <div>
             <div className="flex items-center justify-between mb-4 cursor-pointer group">
              <div className="flex items-center gap-2">
                <div className="bg-blue-500 w-5 h-5 rounded flex items-center justify-center text-white"><CalendarIcon size={12}/></div>
                <span className="text-sm font-bold text-gray-700 truncate max-w-[160px]">{user?.uid.slice(0,8)}...</span>
              </div>
              <ChevronDown size={14} className="text-gray-300 group-hover:text-gray-500" />
            </div>
            <div className="space-y-3 pl-1">
               <div className="flex items-center gap-3">
                 <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center text-white"><Check size={10} /></div>
                 <span className="text-sm text-gray-600">予定</span>
               </div>
               <div className="flex items-center gap-3">
                 <div className="w-4 h-4 bg-rose-500 rounded flex items-center justify-center text-white"><Check size={10} /></div>
                 <span className="text-sm text-gray-600">誕生日</span>
               </div>
            </div>
          </div>

          {/* TODO Section */}
          <div className="pt-4 border-t border-gray-50">
             <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4">Todo List</h3>
             <div className="space-y-2 mb-4">
               <div className="flex gap-2">
                 <input
                   value={newTodoText}
                   onChange={(e) => setNewTodoText(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') addTodo(); }}
                   className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-100"
                   placeholder="タスクを追加（Enterで追加）"
                 />
                 <button
                   onClick={addTodo}
                   className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700"
                   title="追加"
                 >
                   <Plus size={14} />
                 </button>
               </div>
               <div className="flex gap-2">
                 <select
                   value={newTodoPriority}
                   onChange={(e) => setNewTodoPriority(e.target.value as any)}
                   className="w-28 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold text-gray-600 outline-none"
                 >
                   <option value="Low">Low</option>
                   <option value="Normal">Normal</option>
                   <option value="High">High</option>
                 </select>
                 <input
                   value={newTodoTags}
                   onChange={(e) => setNewTodoTags(e.target.value)}
                   className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-100"
                   placeholder="タグ（例: 研究,資料,連絡）"
                 />
               </div>
             </div>

             <div className="space-y-3 max-h-[200px] overflow-y-auto scrollbar-hide">
               {todos.map(t => (
                 <div key={t.id} className="flex items-start gap-3 group">
                   <button onClick={() => toggleTodo(t.id, t.completed)} className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all ${t.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200'}`}>
                     {t.completed && <Check size={10}/>}
                   </button>
                   <span className={`text-xs flex-1 ${t.completed ? 'text-gray-300 line-through' : 'text-gray-600 font-medium'}`}>{t.text}{t.priority ? ` · ${t.priority}` : ''}{Array.isArray(t.tags) && t.tags.length ? ` · #${t.tags.join(' #')}` : ''}</span>
                   <button onClick={() => deleteItem('todos', t.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-rose-500"><Trash2 size={12}/></button>
                 </div>
               ))}
               {todos.length === 0 && <p className="text-[10px] text-gray-300 italic">No tasks yet.</p>}
             </div>
          </div>
        </div>

        {/* Persona Switcher */}
        <div className="mt-6 pt-6 border-t border-gray-50">
          <div className="flex bg-gray-50 rounded-2xl p-1 gap-1">
            {(Object.keys(PERSONAS) as (keyof typeof PERSONAS)[]).map(p => (
              <button key={p} onClick={() => setSelectedPersona(p)} className={`flex-1 py-2 rounded-xl transition-all flex flex-col items-center justify-center gap-1 ${selectedPersona === p ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
                {PERSONAS[p].icon}
                <span className="text-[8px] font-bold">{PERSONAS[p].name}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-white">
        {/* Header - Matching image_e2535d.png */}
        <header className="px-8 py-5 flex items-center justify-between border-b border-gray-50 bg-white/80 backdrop-blur z-20">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-gray-800">
              {currentDate.toLocaleDateString('ja-JP', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
            </h1>
            <div className="flex bg-gray-100 rounded-xl p-1 text-[13px] font-bold">
              <button onClick={() => setViewMode('Week')} className={`px-5 py-1.5 rounded-lg transition-all ${viewMode === 'Week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Week</button>
              <button onClick={() => setViewMode('Month')} className={`px-5 py-1.5 rounded-lg transition-all ${viewMode === 'Month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Month</button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <input
              ref={fileImportRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await importData(f);
                if (e.currentTarget) e.currentTarget.value = '';
              }}
            />
            <button
              onClick={exportData}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black"
              title="Export JSON"
            >
              <TrendingUp size={14} />
              Export
            </button>
            <button
              onClick={() => fileImportRef.current?.click()}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black"
              title="Import JSON"
            >
              <LayoutGrid size={14} />
              Import
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black"
              title="設定"
            >
              <UserCircle2 size={14} />
              Settings
            </button>

            <div className="flex items-center gap-1 mr-4">
              <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><ChevronLeft size={20} /></button>
              <button onClick={() => setCurrentDate(new Date())} className="px-5 py-1.5 bg-white border border-gray-100 rounded-full text-sm font-bold shadow-sm hover:shadow-md transition-all active:scale-95">Today</button>
              <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><ChevronRight size={20} /></button>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100 cursor-pointer hover:bg-white transition-all shadow-inner">
               <UserCircle2 size={26} />
            </div>
          </div>
        </header>

        {/* Scroll Bar Decoration from image */}
        <div className="px-8 mt-4">
           <div className="h-2 w-full bg-gray-100 rounded-full relative">
              <div className="absolute top-0 left-0 h-full w-1/3 bg-gray-300 rounded-full" />
              <div className="absolute top-[-4px] left-0 h-4 w-4 bg-white border-2 border-gray-300 rounded-sm rotate-45 ml-[5%]" />
           </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 px-8 pb-32 overflow-auto scrollbar-hide mt-4">
          <div className="grid grid-cols-7 border-t border-l border-gray-50 min-h-[1000px]">
            {['月', '火', '水', '木', '金', '土', '日'].map(d => (
              <div key={d} className="border-r border-b border-gray-50 p-4 text-center text-[11px] font-black text-gray-300 uppercase tracking-widest bg-white sticky top-0 z-10">{d}</div>
            ))}
            {calendarGrid.map((date, idx) => {
              const dStr = getLocalDateString(date);
              const dayEvents = events.filter(e => e.date === dStr);
              const isToday = date.toDateString() === new Date().toDateString();
              const isCurrMonth = date.getMonth() === currentDate.getMonth();
              
              return (
                <div key={idx} onClick={() => { setNewEvent({...newEvent, date: dStr}); setIsEventModalOpen(true); }} className={`border-r border-b border-gray-50 p-3 min-h-[160px] transition-all hover:bg-gray-50/50 cursor-pointer group ${!isCurrMonth ? 'bg-gray-50/20' : 'bg-white'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm font-bold h-7 w-7 flex items-center justify-center rounded-lg transition-all ${
                      isToday ? 'bg-blue-600 text-white shadow-lg rotate-3' : isCurrMonth ? 'text-gray-700' : 'text-gray-300'
                    }`}>
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1.5 overflow-y-auto max-h-[120px] scrollbar-hide">
                    {dayEvents.map(ev => (
                      <div key={ev.id} className="text-[10px] p-2 rounded-xl bg-white border border-gray-100 shadow-sm truncate font-bold text-gray-700 hover:border-blue-400 transition-all flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${ev.category === '仕事' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                        <span className="truncate flex-1">{ev.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating AI Input Bar & Chat - Matching image_e25e5d.png */}
        <div className={`absolute left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-40 transition-all duration-500 ${isChatOpen ? 'bottom-1/2 translate-y-1/2' : 'bottom-8'}`}>
           <div className={`bg-white/95 border border-gray-100 rounded-[32px] shadow-[0_30px_70px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-all duration-500 ${isChatOpen ? 'h-[500px] rounded-[48px] flex flex-col' : 'h-16 overflow-hidden'}`}>
             
             {isChatOpen && (
               <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide bg-slate-50/30">
                 <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4 sticky top-0 bg-white/90 backdrop-blur z-10">
                   <h3 className="font-black text-blue-600 flex items-center gap-2 text-sm"><Sparkles size={16}/> AI Planner ({PERSONAS[selectedPersona].name})</h3>
                   <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:bg-gray-100 p-1 rounded-full"><X size={20}/></button>
                 </div>
                 {messages.length === 0 && <div className="text-center py-20 text-gray-300 font-bold text-sm">どのような予定を立てましょうか？</div>}
                 {messages.map((m, i) => (
                   <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] p-5 rounded-[28px] shadow-sm font-bold text-sm leading-relaxed ${
                       m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-700 rounded-tl-none border border-gray-100'
                     }`}>
                       {m.text}
                     </div>
                   </div>
                 ))}
                 {isAILoading && <div className="flex gap-1.5 p-4"><div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"/><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}/><div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{animationDelay:'0.4s'}}/></div>}
                 {isSpeaking && <div className="text-[10px] font-black text-blue-400 animate-pulse uppercase tracking-[0.3em] px-4">AI Speaking...</div>}
               </div>
             )}

             <form 
               onSubmit={(e) => { e.preventDefault(); if(inputVal.trim()) askAI(inputVal); setInputVal(''); }}
               className="h-16 flex items-center gap-4 px-6 group"
             >
               <Search size={22} className="text-gray-300 group-focus-within:text-blue-500 transition-colors" />
               <input 
                 type="text" 
                 value={inputVal}
                 onFocus={() => setIsChatOpen(true)}
                 onChange={(e) => setInputVal(e.target.value)}
                 placeholder="Schedule anything"
                 className="flex-1 outline-none text-lg placeholder:text-gray-300 bg-transparent font-bold"
               />
               <div className="flex items-center gap-4">
                  <button type="button" className="text-gray-300 hover:text-blue-500 transition-colors"><Mic size={22} /></button>
                  <button type="submit" disabled={!inputVal.trim() || isAILoading} className="bg-blue-600 text-white p-2.5 rounded-full shadow-lg hover:bg-blue-700 transition-all disabled:opacity-0 active:scale-90"><Send size={20} /></button>
               </div>
             </form>
           </div>
        </div>
      </main>
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-6 flex items-center justify-between border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                  <Sparkles size={18}/>
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-800">Settings</h3>
                  <p className="text-xs text-gray-400">Gemini APIキー等を保存できます（ブラウザのLocalStorage）</p>
                </div>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 rounded-xl hover:bg-gray-50 text-gray-500"><X size={18}/></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-black text-gray-500">Gemini API Key（チャット）</label>
                <input
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="mt-2 w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-[11px] text-gray-400">※未入力だとAIチャットは失敗します</p>
              </div>

              <div>
                <label className="text-xs font-black text-gray-500">Gemini API Key（音声TTS）</label>
                <input
                  value={ttsApiKey}
                  onChange={(e) => setTtsApiKey(e.target.value)}
                  placeholder="未入力ならチャット用キーを使用"
                  className="mt-2 w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <Volume2 size={16} className="text-gray-600"/>
                  <div>
                    <div className="text-sm font-black text-gray-800">通知/音声の許可</div>
                    <div className="text-[11px] text-gray-400">ブラウザの許可ダイアログを開きます</div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try { await Notification.requestPermission(); } catch {}
                  }}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-100 text-xs font-black text-gray-700 hover:bg-gray-100"
                >
                  Request
                </button>
              </div>
            </div>

            <div className="p-6 pt-0 flex items-center justify-end gap-2">
              <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black">Cancel</button>
              <button onClick={saveSettings} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black">Save</button>
            </div>
          </div>
        </div>
      )}


      {/* "新しい予定を追加" Modal - Matching image_e10c89.png */}
      {isEventModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-[480px] rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.25)] border border-white/20 overflow-hidden animate-in zoom-in duration-300">
            <div className="px-10 pt-10 pb-2 flex justify-between items-center">
              <h3 className="text-3xl font-black text-gray-800 tracking-tighter">新しい予定を追加</h3>
              <button onClick={() => setIsEventModalOpen(false)} className="text-gray-300 hover:text-gray-600 p-2 transition-all hover:bg-gray-50 rounded-full"><X size={28}/></button>
            </div>
            
            <div className="p-10 space-y-8">
              {/* Title Section */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">タイトル</label>
                <input 
                  type="text" 
                  autoFocus
                  className="w-full border border-gray-100 bg-[#F9FBFF] rounded-[24px] px-8 py-5 text-lg font-black outline-none focus:border-blue-500 focus:bg-white focus:ring-8 focus:ring-blue-50/50 transition-all placeholder:text-gray-200 shadow-inner"
                  placeholder="予定の名称"
                  value={newEvent.title}
                  onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-8">
                {/* Date Section - Fix overlapping icons */}
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">日付</label>
                  <div className="relative group">
                    <input 
                      type="date" 
                      className="w-full border border-gray-100 bg-[#F9FBFF] rounded-[22px] px-8 py-5 text-base font-black outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none shadow-inner cursor-pointer"
                      value={newEvent.date}
                      onChange={e => setNewEvent({...newEvent, date: e.target.value})}
                    />
                    <CalendarDays className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none group-focus-within:text-blue-500 transition-colors" size={20}/>
                  </div>
                </div>
                {/* Category Section */}
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">カテゴリ</label>
                  <div className="relative group">
                    <select 
                      className="w-full border border-gray-100 bg-[#F9FBFF] rounded-[22px] px-8 py-5 text-base font-black outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none pr-12 shadow-inner cursor-pointer"
                      value={newEvent.category}
                      onChange={e => setNewEvent({...newEvent, category: e.target.value})}
                    >
                      <option value="仕事">仕事</option>
                      <option value="プライベート">個人</option>
                      <option value="重要">重要</option>
                    </select>
                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none group-focus-within:text-blue-500" size={18}/>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                {/* Time Sections - Fix overlapping icons */}
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">開始</label>
                  <div className="relative group">
                    <input 
                      type="time" 
                      className="w-full border border-gray-100 bg-[#F9FBFF] rounded-[22px] px-8 py-5 text-base font-black outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner appearance-none cursor-pointer"
                      value={newEvent.startTime}
                      onChange={e => setNewEvent({...newEvent, startTime: e.target.value})}
                    />
                    <Clock4 className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none group-focus-within:text-blue-500 transition-colors" size={20}/>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">終了</label>
                  <div className="relative group">
                    <input 
                      type="time" 
                      className="w-full border border-gray-100 bg-[#F9FBFF] rounded-[22px] px-8 py-5 text-base font-black outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner appearance-none cursor-pointer"
                      value={newEvent.endTime}
                      onChange={e => setNewEvent({...newEvent, endTime: e.target.value})}
                    />
                    <Clock4 className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none group-focus-within:text-blue-500 transition-colors" size={20}/>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSaveEvent}
                className="w-full bg-[#2B66F1] hover:bg-blue-700 text-white py-6 rounded-[28px] text-2xl font-black shadow-[0_20px_40px_-10px_rgba(43,102,241,0.5)] transition-all active:scale-[0.98] mt-6 flex items-center justify-center gap-3"
              >
                予定を保存 <CheckSquare size={26}/>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub Component ---
function NavItem({ icon, label, active, onClick, expanded }: { icon: any, label: string, active: boolean, onClick: () => void, expanded: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group ${
      active ? 'bg-blue-50 text-blue-600 font-black' : 'text-gray-400 hover:bg-gray-50'
    }`}>
      <div className={`${active ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>{icon}</div>
      {expanded && <span className="text-[14px] tracking-tight">{label}</span>}
    </button>
  );
}
