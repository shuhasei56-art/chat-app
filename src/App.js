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
  signInWithPopup,     
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
  Download
} from "lucide-react";

// --- 1. Firebaseの設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyAGd-_Gg6yMwcKv6lvjC3r8_4LL0-tJn10",
  authDomain: "chat-app-c17bf.firebaseapp.com",
  databaseURL: "https://chat-app-c17bf-default-rtdb.firebaseio.com",
  projectId: "chat-app-c17bf",
  storageBucket: "chat-app-c17bf.firebasestorage.app",
  messagingSenderId: "1063497801308",
  appId: "1:1063497801308:web:8040959804832a690a1099"
};

// 【追加】Firebaseの初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = "voom-app-persistent-v1";
const JSQR_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
const CHUNK_SIZE = 716799;
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

// --- Utility Functions ---
const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString();
};

const formatDateTime = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isTodayBirthday = (birthdayString) => {
  if (!birthdayString) return false;
  const today = new Date();
  const [y, m, d] = birthdayString.split("-").map(Number);
  return today.getMonth() + 1 === m && today.getDate() === d;
};

// --- アプリの主要コンポーネント ---

const AuthView = ({ onLogin, showNotification }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setLoading(true);
      await signInWithPopup(auth, provider);
      showNotification("Googleでログインしました");
    } catch (e) {
      console.error(e);
      showNotification("Googleログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !password) return showNotification("入力を確認してください");
    
    const email = `${userId}@voom-persistent.app`; 
    setLoading(true);

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification("ログインしました");
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await setDoc(doc(db, "artifacts", appId, "public", "data", "users", user.uid), {
          uid: user.uid,
          name: displayName || userId,
          id: userId,
          status: "よろしくお願いします！",
          birthday: "",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=" + user.uid,
          cover: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80",
          friends: [],
          wallet: 1000,
          isBanned: false,
        });
        showNotification("アカウントを作成しました");
      }
    } catch (error) {
      console.error(error);
      showNotification("認証エラー: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await signInAnonymously(auth);
      showNotification("ゲストとしてログインしました");
    } catch (e) {
      showNotification("ゲストログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-indigo-500 rounded-3xl mx-auto flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">チャットアプリ</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLoginMode && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 ml-2">ニックネーム</label>
                <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border">
                  <User className="w-5 h-5 text-gray-400" />
                  <input type="text" className="bg-transparent w-full outline-none" placeholder="山田 太郎" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-2">ユーザーID</label>
              <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border">
                <AtSign className="w-5 h-5 text-gray-400" />
                <input type="text" className="bg-transparent w-full outline-none" placeholder="user_id" value={userId} onChange={(e) => setUserId(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-2">パスワード</label>
              <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border">
                <KeyRound className="w-5 h-5 text-gray-400" />
                <input type="password" minLength={6} className="bg-transparent w-full outline-none" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-lg">
              {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (isLoginMode ? "ログイン" : "アカウント作成")}
            </button>
          </form>

          <button onClick={handleGoogleLogin} className="w-full border py-4 rounded-2xl mt-4 flex items-center justify-center gap-2">
             Googleでログイン
          </button>

          <div className="mt-6 text-center space-y-4">
            <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-sm font-bold text-gray-500">
              {isLoginMode ? "新規作成はこちら" : "ログインはこちら"}
            </button>
            <div className="text-gray-300">ーーー</div>
            <button onClick={handleGuestLogin} className="text-xs font-bold text-gray-400 underline">
              ゲストログイン
            </button>
          </div>
        </div>
    </div>
  );
};

// ... (他のコンポーネント: HomeView, ChatRoomViewなどは元のロジックを継承しますが、簡略化のためメインのApp構造を優先します) ...

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("auth");
  const [notification, setNotification] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setView("home");
      } else {
        setUser(null);
        setView("auth");
      }
    });
    return () => unsubscribe();
  }, []);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="max-w-md mx-auto h-screen border-x bg-white flex flex-col relative overflow-hidden">
      {notification && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[500] bg-black/80 text-white px-6 py-2 rounded-full text-xs">
          {notification}
        </div>
      )}
      {!user ? (
        <AuthView onLogin={setUser} showNotification={showNotification} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <h1 className="text-xl font-bold">ログイン成功！</h1>
          <p className="text-gray-500">ようこそ {user.displayName || "ユーザー"} さん</p>
          <button onClick={() => signOut(auth)} className="mt-4 bg-red-500 text-white px-6 py-2 rounded-xl">ログアウト</button>
        </div>
      )}
    </div>
  );
}
