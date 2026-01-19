import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  addDoc,
  deleteDoc,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  orderBy,
  limit,
  limitToLast,
  writeBatch,
  getDocs,
  deleteField,
  increment,
  runTransaction,
} from "firebase/firestore";
import {
  Search,
  UserPlus,
  Image as ImageIcon,
  Send,
  X,
  ChevronLeft,
  Settings,
  Home,
  LayoutGrid,
  Trash2,
  Plus,
  Video,
  Heart,
  MessageCircle,
  Camera as CameraIcon,
  Maximize,
  Upload,
  Copy,
  Contact,
  Play,
  Gift,
  Cake,
  Users,
  Check,
  Loader2,
  Bell,
  BellOff,
  Mic,
  Square,
  Ban,
  Edit2,
  Palette,
  PhoneOff,
  LogOut,
  RefreshCcw,
  ArrowUpCircle,
  Reply,
  Smile,
  StopCircle,
  PhoneCall,
  Phone,
  FileText,
  Paperclip,
  Download,
  UserMinus,
  AtSign,
  Store,
  PenTool,
  Eraser,
  Type,
  CheckCircle,
  XCircle,
  Lock,
  ShoppingBag,
  Coins,
  Scissors,
  Star,
  Disc,
  ShieldAlert,
  Music,
  Volume2,
  ShoppingCart,
  User,
  KeyRound,
} from "lucide-react";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAGd-_Gg6yMwcKv6lvjC3r8_4LL0-tJn10",
  authDomain: "chat-app-c17bf.firebaseapp.com",
  databaseURL: "https://chat-app-c17bf-default-rtdb.firebaseio.com",
  projectId: "chat-app-c17bf",
  storageBucket: "chat-app-c17bf.firebasestorage.app",
  messagingSenderId: "1063497801308",
  appId: "1:1063497801308:web:8040959804832a690a1099"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = "voom-app-persistent-v1";
const JSQR_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

// --- Helper Functions ---
const formatTime = (ts) => ts ? (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
const isTodayBirthday = (b) => {
  if (!b) return false;
  const t = new Date();
  const [y, m, d] = b.split("-").map(Number);
  return t.getMonth() + 1 === m && t.getDate() === d;
};

// --- AuthView Component (Login Screen) ---
const AuthView = ({ showNotification }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !password) return showNotification("入力してください");
    const email = `${userId}@voom-persistent.app`;
    setLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "artifacts", appId, "public", "data", "users", cred.user.uid), {
          uid: cred.user.uid,
          name: displayName || userId,
          id: userId,
          status: "よろしくお願いします！",
          birthday: "",
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cred.user.uid}`,
          cover: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80",
          friends: [],
          wallet: 1000,
          isBanned: false,
        });
      }
    } catch (err) {
      showNotification("エラー: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await signInAnonymously(auth);
      showNotification("ゲストログインしました");
    } catch (e) {
      showNotification("ゲストログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-8 border border-white/50 backdrop-blur-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-indigo-500 rounded-3xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
            <MessageCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">チャットアプリ</h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">
            {isLoginMode ? "ログインして始めましょう" : "新しくアカウントを作成"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLoginMode && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 ml-2 uppercase">表示名</label>
              <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border focus-within:border-indigo-500 transition-all">
                <User className="w-4 h-4 text-gray-400" />
                <input className="bg-transparent w-full outline-none text-sm font-bold" placeholder="山田 太郎" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 ml-2 uppercase">ユーザーID</label>
            <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border focus-within:border-indigo-500 transition-all">
              <AtSign className="w-4 h-4 text-gray-400" />
              <input className="bg-transparent w-full outline-none text-sm font-bold" placeholder="user_id" value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 ml-2 uppercase">パスワード</label>
            <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border focus-within:border-indigo-500 transition-all">
              <KeyRound className="w-4 h-4 text-gray-400" />
              <input className="bg-transparent w-full outline-none text-sm font-bold" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center">
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (isLoginMode ? "ログイン" : "登録する")}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3">
          <button onClick={handleGoogleLogin} className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-2xl shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-all">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" className="w-4 h-4" alt="G" />
            Googleでログイン
          </button>
          <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-xs font-bold text-gray-400 hover:text-indigo-500 transition-colors text-center">
            {isLoginMode ? "アカウントをお持ちでない方はこちら" : "すでにアカウントをお持ちの方はこちら"}
          </button>
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
            <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white px-2 text-gray-400 font-bold">OR</span></div>
          </div>
          <button onClick={handleGuestLogin} className="text-xs font-bold text-gray-400 hover:text-gray-600 underline text-center">
            お試しゲストログイン
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Home Components ---
const HomeView = ({ user, profile, allUsers, chats, setView, setActiveChatId }) => {
  const [tab, setTab] = useState("chats");
  const friends = allUsers.filter(u => profile?.friends?.includes(u.uid));

  return (
    <div className="flex flex-col h-screen bg-white max-w-md mx-auto border-x">
      <div className="p-6 border-b flex justify-between items-center">
        <h1 className="text-2xl font-black tracking-tight">ホーム</h1>
        <div className="flex gap-4">
          <Store className="w-6 h-6 text-orange-400 cursor-pointer" onClick={() => setView("sticker-store")} />
          <UserPlus className="w-6 h-6 text-gray-600 cursor-pointer" onClick={() => setView("qr")} />
          <Settings className="w-6 h-6 text-gray-600 cursor-pointer" onClick={() => setView("profile")} />
        </div>
      </div>
      <div className="flex border-b">
        <button onClick={() => setTab("friends")} className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest ${tab === "friends" ? "border-b-2 border-black" : "text-gray-400"}`}>友だち</button>
        <button onClick={() => setTab("chats")} className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest ${tab === "chats" ? "border-b-2 border-black" : "text-gray-400"}`}>トーク</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 flex items-center gap-4 bg-gray-50 border-b cursor-pointer" onClick={() => setView("profile")}>
          <img src={profile?.avatar} className="w-16 h-16 rounded-[24px] border-2 border-white shadow-sm" alt="Me" />
          <div>
            <div className="font-bold text-lg">{profile?.name}</div>
            <div className="text-xs text-gray-400 font-mono">@{profile?.id}</div>
          </div>
        </div>
        {tab === "friends" ? (
          friends.map(f => (
            <div key={f.uid} className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => { setActiveChatId(f.uid); setView("chatroom"); }}>
              <img src={f.avatar} className="w-12 h-12 rounded-2xl object-cover border" alt="F" />
              <div className="font-bold">{f.name}</div>
            </div>
          ))
        ) : (
          chats.sort((a,b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)).map(c => (
            <div key={c.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => { setActiveChatId(c.id); setView("chatroom"); }}>
              <img src={c.icon || "https://api.dicebear.com/7.x/identicon/svg?seed=" + c.id} className="w-14 h-14 rounded-2xl object-cover border" alt="C" />
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{c.name || "グループ"}</div>
                <div className="text-xs text-gray-400 truncate">{c.lastMessage?.content || "チャットを始めましょう"}</div>
              </div>
              <div className="text-[10px] text-gray-300 font-bold">{formatTime(c.updatedAt)}</div>
            </div>
          ))
        )}
      </div>
      <div className="h-20 border-t flex items-center justify-around bg-white">
        <Home className="w-6 h-6 text-indigo-500" />
        <LayoutGrid className="w-6 h-6 text-gray-300 cursor-pointer" onClick={() => setView("voom")} />
      </div>
    </div>
  );
};

// --- Main Application Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("auth");
  const [activeChatId, setActiveChatId] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [posts, setPosts] = useState([]);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const snap = await getDoc(doc(db, "artifacts", appId, "public", "data", "users", u.uid));
        if (snap.exists()) setProfile(snap.data());
        setView("home");
      } else {
        setUser(null);
        setView("auth");
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const qUsers = query(collection(db, "artifacts", appId, "public", "data", "users"));
    const unsubUsers = onSnapshot(qUsers, (s) => setAllUsers(s.docs.map(d => d.data())));
    const qChats = query(collection(db, "artifacts", appId, "public", "data", "chats"), where("participants", "array-contains", user.uid));
    const unsubChats = onSnapshot(qChats, (s) => setChats(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubUsers(); unsubChats(); };
  }, [user]);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="w-screen h-screen overflow-hidden">
      {notification && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[999] bg-black/80 text-white px-6 py-2 rounded-full text-xs font-bold shadow-2xl animate-in fade-in slide-in-from-top-4">
          {notification}
        </div>
      )}
      {!user ? (
        <AuthView showNotification={showNotification} />
      ) : (
        <>
          {view === "home" && <HomeView user={user} profile={profile} allUsers={allUsers} chats={chats} setView={setView} setActiveChatId={setActiveChatId} />}
          {/* 他のビュー（chatroom, profile等）は以前のコードと同様のため、Homeに戻るボタンなどで適宜切り替えてください */}
          {view !== "home" && (
            <div className="flex flex-col h-screen items-center justify-center p-8 text-center bg-gray-50">
              <p className="text-gray-400 font-bold mb-4">ビュー "{view}" は現在準備中です</p>
              <button onClick={() => setView("home")} className="bg-black text-white px-6 py-2 rounded-xl font-bold">ホームへ戻る</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
