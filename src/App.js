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

const processFileBeforeUpload = (file) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith("image") || file.type === "image/gif") {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(
                blob.size > file.size
                  ? file
                  : new File([blob], file.name, {
                      type: "image/jpeg",
                      lastModified: Date.now(),
                    })
              );
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.8
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

const handleFileUpload = async (e, callback) => {
  const originalFile = e.target.files[0];
  if (!originalFile) return;
  e.target.value = "";
  let file = originalFile;
  if (
    originalFile.type.startsWith("image") &&
    originalFile.type !== "image/gif"
  ) {
    file = await processFileBeforeUpload(originalFile);
  }
  let type = "file";
  if (file.type.startsWith("image")) type = "image";
  else if (file.type.startsWith("video")) type = "video";
  else if (file.type.startsWith("audio")) type = "audio";

  if (file.size > 1024 * 1024 || type === "video" || type === "file") {
    const objectUrl = URL.createObjectURL(file);
    callback(objectUrl, type, file);
  } else {
    const reader = new FileReader();
    reader.onload = (event) => callback(event.target.result, type, file);
    reader.readAsDataURL(file);
  }
};

const handleCompressedUpload = (e, callback) => {
  const file = e.target.files[0];
  if (!file || !file.type.startsWith("image")) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

const generateThumbnail = (file) => {
  return new Promise((resolve) => {
    if (!file) {
      resolve(null);
      return;
    }
    const MAX_SIZE = 320;
    if (file.type.startsWith("image")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.5));
        };
        img.onerror = () => resolve(null);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("video")) {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      video.preload = "metadata";
      const capture = () => {
        try {
          const canvas = document.createElement("canvas");
          let width = video.videoWidth;
          let height = video.videoHeight;
          if (!width || !height) {
            resolve(null);
            return;
          }
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
          video.src = "";
          video.load();
          resolve(dataUrl);
        } catch (e) {
          resolve(null);
        }
      };
      video.onloadeddata = () => {
        video.currentTime = 0.5;
      };
      video.onseeked = () => {
        capture();
      };
      video.onerror = () => resolve(null);
      setTimeout(() => resolve(null), 2000);
      try {
        video.src = URL.createObjectURL(file);
      } catch (e) {
        resolve(null);
      }
    } else {
      resolve(null);
    }
  });
};

// --- Auth Components ---

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
      await signInWithRedirect(auth, provider);
    } catch (e) {
      console.error(e);
      showNotification("Googleログインに失敗しました");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !password) {
      showNotification("IDとパスワードを入力してください");
      return;
    }
    const email = `${userId}@voom-persistent.app`;
    setLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification("ログインしました");
      } else {
        if (!displayName) {
          showNotification("ニックネームを入力してください");
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await setDoc(
          doc(db, "artifacts", appId, "public", "data", "users", user.uid),
          {
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
          }
        );
        showNotification("アカウントを作成しました");
      }
    } catch (error) {
      console.error(error);
      if (error.code === "auth/email-already-in-use") {
        showNotification("このIDは既に使用されています");
      } else if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        showNotification("IDまたはパスワードが間違っています");
      } else if (error.code === "auth/weak-password") {
        showNotification("パスワードは6文字以上で設定してください");
      } else {
        showNotification("認証エラーが発生しました: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8 border border-white/50 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-indigo-500 rounded-3xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
            <MessageCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">チャットアプリ</h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">
            {isLoginMode
              ? "データはIDに紐づいて保存されます"
              : "アカウントを作成してデータを保存"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLoginMode && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-2">
                ユーザー名
              </label>
              <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border border-transparent focus-within:border-indigo-500 focus-within:bg-white transition-all">
                <User className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  className="bg-transparent w-full outline-none text-sm font-bold text-gray-700"
                  placeholder="山田 太郎"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 ml-2">
              ユーザーID (半角英数)
            </label>
            <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border border-transparent focus-within:border-indigo-500 focus-within:bg-white transition-all">
              <AtSign className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                className="bg-transparent w-full outline-none text-sm font-bold text-gray-700"
                placeholder="user_id"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoCapitalize="none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 ml-2">
              パスワード
            </label>
            <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border border-transparent focus-within:border-indigo-500 focus-within:bg-white transition-all">
              <KeyRound className="w-5 h-5 text-gray-400" />
              <input
                type="password"
                className="bg-transparent w-full outline-none text-sm font-bold text-gray-700"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none mt-6 flex items-center justify-center"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : isLoginMode ? (
              "ログイン"
            ) : (
              "アカウントを作成"
            )}
          </button>
        </form>
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-4 rounded-2xl shadow-md flex items-center justify-center gap-2 hover:bg-gray-50 transition-all mt-4"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" className="w-5 h-5" />
          Googleでログイン
        </button>
        <div className="mt-6 text-center space-y-4">
          <button
            onClick={() => setIsLoginMode(!isLoginMode)}
            className="text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors"
          >
            {isLoginMode
              ? "アカウントをお持ちでない方はこちら"
              : "すでにアカウントをお持ちの方はこちら"}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200"></span>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-gray-400">または</span>
            </div>
          </div>

          <button
            onClick={handleGuestLogin}
            className="text-xs font-bold text-gray-400 hover:text-gray-600 underline"
          >
            お試しゲストログイン（データは一時的です）
          </button>
        </div>
      </div>
      <div className="mt-8 text-[10px] text-gray-400 font-mono text-center">
        Persistent App ID: {appId}
      </div>
    </div>
  );
};

// --- Modal Components ---

const ContactSelectModal = ({ onClose, onSend, friends }) => (
  <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col max-h-[70vh]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">連絡先を選択</h3>
        <button onClick={onClose}><X className="w-6 h-6" /></button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {friends.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">友だちがいません</div>
        ) : (
          friends.map((f) => (
            <div key={f.uid} onClick={() => onSend(f)} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer hover:border-gray-100 border border-transparent transition-all">
              <img src={f.avatar} className="w-10 h-10 rounded-xl object-cover border" />
              <span className="font-bold text-sm flex-1">{f.name}</span>
              <Plus className="w-4 h-4 text-green-500" />
            </div>
          ))
        )}
      </div>
    </div>
  </div>
);

const BirthdayCardModal = ({ onClose, onSend, toName }) => {
  const [color, setColor] = useState("pink"), [message, setMessage] = useState("");
  const colors = [
    { id: "pink", class: "bg-pink-100 border-pink-300" },
    { id: "blue", class: "bg-blue-100 border-blue-300" },
    { id: "yellow", class: "bg-yellow-100 border-yellow-300" },
    { id: "green", class: "bg-green-100 border-green-300" },
  ];
  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">カードを送る</h3>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        <div className="mb-4 flex gap-3">
          {colors.map((c) => (
            <button key={c.id} onClick={() => setColor(c.id)} className={`w-10 h-10 rounded-full border-2 ${c.class} ${color === c.id ? "scale-125 ring-2 ring-gray-300" : ""}`} />
          ))}
        </div>
        <div className={`p-4 rounded-2xl border-2 mb-4 ${colors.find((c) => c.id === color).class}`}>
          <div className="font-bold text-gray-700 mb-2">To: {toName}</div>
          <textarea className="w-full bg-white/50 rounded-xl p-3 text-sm focus:outline-none min-h-[100px]" placeholder="メッセージ..." value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <button onClick={() => onSend({ color, message })} disabled={!message.trim()} className="w-full bg-pink-500 text-white font-bold py-3 rounded-2xl shadow-lg">送信する</button>
      </div>
    </div>
  );
};

const StickerBuyModal = ({ onClose, onGoToStore, packId }) => {
  return (
    <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShoppingCart className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="font-bold text-lg mb-2">このスタンプを購入しますか？</h3>
        <p className="text-gray-500 text-sm mb-6">
          ショップで詳細を確認できます。
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-2xl text-gray-600 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={() => {
              onGoToStore(packId);
              onClose();
            }}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 font-bold rounded-2xl text-white transition-colors shadow-lg shadow-blue-200"
          >
            ショップへ
          </button>
        </div>
      </div>
    </div>
  );
};

const GroupAddMemberModal = ({
  onClose,
  currentMembers,
  chatId,
  allUsers,
  profile,
  user,
  showNotification,
}) => {
  const [selected, setSelected] = useState([]);
  const inviteableFriends = allUsers.filter(
    (u) =>
      (profile?.friends || []).includes(u.uid) &&
      !currentMembers.includes(u.uid)
  );
  const toggle = (uid) =>
    setSelected((prev) =>
      prev.includes(uid) ? prev.filter((i) => i !== uid) : [...prev, uid]
    );
  const handleInvite = async () => {
    if (selected.length === 0) return;
    try {
      const addedNames = [];
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "chats", chatId),
        { participants: arrayUnion(...selected) }
      );
      selected.forEach((uid) => {
        const u = allUsers.find((user) => user.uid === uid);
        if (u) addedNames.push(u.name);
      });
      await addDoc(
        collection(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "chats",
          chatId,
          "messages"
        ),
        {
          senderId: user.uid,
          content: `${profile.name}が${addedNames.join("、")}を招待しました。`,
          type: "text",
          createdAt: serverTimestamp(),
          readBy: [user.uid],
        }
      );
      showNotification("メンバーを追加しました");
      onClose();
    } catch (e) {
      showNotification("エラーが発生しました");
    }
  };
  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-3xl flex flex-col max-h-[70vh]">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-lg">メンバーを追加</h3>
          <button onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {inviteableFriends.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              招待できる友だちがいません
            </div>
          ) : (
            inviteableFriends.map((f) => (
              <div
                key={f.uid}
                onClick={() => toggle(f.uid)}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer border border-transparent transition-all"
              >
                <img
                  src={f.avatar}
                  className="w-10 h-10 rounded-xl object-cover border"
                />
                <span className="font-bold text-sm flex-1">{f.name}</span>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selected.includes(f.uid)
                      ? "bg-green-500 border-green-500"
                      : "border-gray-200"
                  }`}
                >
                  {selected.includes(f.uid) && (
                    <Check className="w-4 h-4 text-white" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-4 border-t">
          <button
            onClick={handleInvite}
            disabled={selected.length === 0}
            className={`w-full py-3 rounded-2xl font-bold shadow-lg text-white transition-all ${
              selected.length > 0 ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            招待する ({selected.length})
          </button>
        </div>
      </div>
    </div>
  );
};

const GroupEditModal = ({
  onClose,
  chatId,
  currentName,
  currentIcon,
  currentMembers,
  allUsers,
  showNotification,
  user,
  profile,
}) => {
  const [name, setName] = useState(currentName);
  const [icon, setIcon] = useState(currentIcon);
  const [kickTarget, setKickTarget] = useState(null);

  const handleUpdate = async () => {
    if (!name.trim()) return showNotification("グループ名を入力してください");
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "chats", chatId),
        { name, icon, updatedAt: serverTimestamp() }
      );
      if (name !== currentName || icon !== currentIcon) {
        await addDoc(
          collection(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "chats",
            chatId,
            "messages"
          ),
          {
            senderId: user.uid,
            content: `${profile.name}がグループ情報を変更しました。`,
            type: "text",
            createdAt: serverTimestamp(),
            readBy: [user.uid],
          }
        );
      }
      showNotification("グループ情報を更新しました");
      onClose();
    } catch (e) {
      showNotification("更新に失敗しました");
    }
  };
  const executeKick = async () => {
    if (!kickTarget) return;
    const { uid, name: memberName } = kickTarget;
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "chats", chatId),
        { participants: arrayRemove(uid) }
      );
      await addDoc(
        collection(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "chats",
          chatId,
          "messages"
        ),
        {
          senderId: user.uid,
          content: `${profile.name}が${memberName}を退会させました。`,
          type: "text",
          createdAt: serverTimestamp(),
          readBy: [user.uid],
        }
      );
      showNotification(`${memberName}を削除しました`);
    } catch (e) {
      showNotification("削除に失敗しました");
    } finally {
      setKickTarget(null);
    }
  };
  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0">
          <h3 className="font-bold text-lg">グループ設定</h3>
          <button onClick={onClose}>
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="flex flex-col items-center gap-6 mb-8">
            <div className="relative group">
              <img
                src={icon}
                className="w-24 h-24 rounded-3xl object-cover bg-gray-100 border shadow-sm"
              />
              <label className="absolute bottom-0 right-0 bg-green-500 p-2 rounded-full text-white cursor-pointer shadow-lg border-2 border-white hover:bg-green-600 transition-colors">
                <CameraIcon className="w-4 h-4" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleCompressedUpload(e, (d) => setIcon(d))}
                />
              </label>
            </div>
            <div className="w-full">
              <label className="text-xs font-bold text-gray-400 mb-1 block">
                グループ名
              </label>
              <input
                className="w-full text-center text-lg font-bold border-b py-2 focus:outline-none focus:border-green-500 bg-transparent"
                placeholder="グループ名を入力"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <div className="mb-6">
            <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase flex justify-between">
              <span>メンバー ({currentMembers.length})</span>
            </h4>
            <div className="space-y-2">
              {currentMembers.map((uid) => {
                const m = allUsers.find((u) => u.uid === uid);
                if (!m) return null;
                const isMe = uid === user.uid;
                return (
                  <div
                    key={uid}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100"
                  >
                    <img
                      src={m.avatar}
                      className="w-10 h-10 rounded-full object-cover border"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">
                        {m.name}{" "}
                        {isMe && (
                          <span className="text-gray-400 text-xs">(自分)</span>
                        )}
                      </div>
                    </div>
                    {!isMe && (
                      <button
                        onClick={() => setKickTarget({ uid, name: m.name })}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors flex items-center gap-1 group"
                        title="強制退会"
                      >
                        <UserMinus className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <button
          onClick={handleUpdate}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-2xl shadow-lg transition-all shrink-0 mt-4"
        >
          保存する
        </button>
      </div>
      {kickTarget && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="font-bold text-lg mb-2 text-center text-gray-800">
              強制退会の確認
            </h3>
            <p className="text-center text-gray-600 mb-6 text-sm">
              {kickTarget.name} をグループから退会させますか？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setKickTarget(null)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-2xl text-gray-600 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={executeKick}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 font-bold rounded-2xl text-white transition-colors shadow-lg shadow-red-200"
              >
                退会させる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LeaveGroupConfirmModal = ({ onClose, onLeave }) => (
  <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
      <div className="text-center mb-6">
        <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
          <LogOut className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="font-bold text-lg text-gray-800">
          グループを退会しますか？
        </h3>
        <p className="text-sm text-gray-500 mt-2">
          この操作は取り消せません。
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors"
        >
          キャンセル
        </button>
        <button
          onClick={onLeave}
          className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-red-200"
        >
          退会する
        </button>
      </div>
    </div>
  </div>
);

const IncomingCallOverlay = ({ callData, onAccept, onDecline, allUsers }) => {
  const caller = allUsers.find((u) => u.uid === callData.callerId);
  return (
    <div className="fixed inset-0 z-[500] bg-gray-900 flex flex-col items-center justify-between py-16 px-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src={caller?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=caller"}
          className="w-full h-full object-cover blur-3xl opacity-50 scale-125"
          alt="background"
        />
        <div className="absolute inset-0 bg-black/40"></div>
      </div>
      <div className="relative z-10 flex flex-col items-center gap-6 mt-12">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-white/80 mb-2">
            <PhoneCall className="w-5 h-5 animate-pulse" />
            <span className="text-sm font-bold tracking-widest">着信中...</span>
          </div>
          <h2 className="text-4xl font-bold text-white drop-shadow-xl text-center leading-tight">
            {caller?.name || "Unknown"}
          </h2>
        </div>
        <div className="relative mt-8">
          <div className="absolute inset-0 rounded-full bg-white/20 animate-[ping_2s_ease-in-out_infinite]"></div>
          <img
            src={caller?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=caller"}
            className="w-40 h-40 rounded-full border-[6px] border-white/20 shadow-2xl object-cover relative z-10 bg-gray-800"
          />
        </div>
      </div>
      <div className="relative z-10 w-full flex justify-between items-end px-4 mb-8 max-w-sm">
        <button
          onClick={onDecline}
          className="flex flex-col items-center gap-4 group"
        >
          <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-red-600 border border-red-400">
            <PhoneOff className="w-10 h-10 text-white fill-current" />
          </div>
          <span className="text-white text-sm font-bold">拒否</span>
        </button>
        <button
          onClick={onAccept}
          className="flex flex-col items-center gap-4 group"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-50"></div>
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-green-600 border border-green-400 relative z-10">
              <Video className="w-10 h-10 text-white fill-current" />
            </div>
          </div>
          <span className="text-white text-sm font-bold">応答</span>
        </button>
      </div>
    </div>
  );
};

const OutgoingCallOverlay = ({ callData, onCancel, allUsers }) => (
  <div className="fixed inset-0 z-[500] bg-gray-900 flex flex-col items-center justify-between py-24 px-6 animate-in fade-in duration-300">
    <div className="flex flex-col items-center gap-6 mt-10">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-white/10 animate-pulse"></div>
        <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center border-4 border-white/50 shadow-2xl relative z-10">
          <Video className="w-14 h-14 text-white opacity-80" />
        </div>
      </div>
      <div className="text-center text-white">
        <h2 className="text-2xl font-bold mb-2">発信中...</h2>
        <p className="text-sm opacity-60">相手の応答を待っています</p>
      </div>
    </div>
    <div className="w-full flex justify-center items-center mb-10">
      <button
        onClick={onCancel}
        className="flex flex-col items-center gap-3 group"
      >
        <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-red-600">
          <X className="w-10 h-10 text-white" />
        </div>
        <span className="text-white text-xs font-bold">キャンセル</span>
      </button>
    </div>
  </div>
);

const CallAcceptedOverlay = ({ callData, onJoin }) => (
  <div className="fixed inset-0 z-[500] bg-gray-900/90 flex flex-col items-center justify-center px-6 animate-in fade-in duration-300 backdrop-blur-sm">
    <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-white/20">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
        <Video className="w-10 h-10 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">相手が応答しました</h2>
      <p className="text-gray-500 mb-8 text-sm">下のボタンを押して通話を開始してください</p>
      <button
        onClick={onJoin}
        className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-green-200 transform hover:scale-[1.02] flex items-center justify-center gap-2"
      >
        <Video className="w-5 h-5" />
        通話に参加する
      </button>
    </div>
  </div>
);

// --- Message Components ---

const MessageItem = React.memo(({ m, user, sender, isGroup, db, appId, chatId, addFriendById, onEdit, onDelete, onPreview, onReply, onReaction, allUsers, onStickerClick }) => {
  const isMe = m.senderId === user.uid;
  const [mediaSrc, setMediaSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const isInvalidBlob = !isMe && m.content?.startsWith("blob:");

  const setBlobSrcFromBase64 = (base64Data, mimeType) => {
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++)
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      setMediaSrc(URL.createObjectURL(blob));
    } catch (e) {
      console.error("Blob creation failed", e);
    }
  };

  useEffect(() => {
    if (isMe && m.content?.startsWith("blob:")) {
      setMediaSrc(m.content);
      return;
    }
    return () => {
      if (mediaSrc && mediaSrc.startsWith("blob:") && !isMe)
        URL.revokeObjectURL(mediaSrc);
    };
  }, [isMe, m.content]);

  useEffect(() => {
    if (isMe && m.content?.startsWith("blob:")) return;
    if (m.hasChunks) {
      if (mediaSrc && !mediaSrc.startsWith("blob:") && mediaSrc !== m.preview)
        return;
      setLoading(true);
      (async () => {
        try {
          let base64Data = "";
          if (m.chunkCount) {
            const chunkPromises = [];
            for (let i = 0; i < m.chunkCount; i++)
              chunkPromises.push(
                getDoc(
                  doc(
                    db,
                    "artifacts",
                    appId,
                    "public",
                    "data",
                    "chats",
                    chatId,
                    "messages",
                    m.id,
                    "chunks",
                    `${i}`
                  )
                )
              );
            const chunkDocs = await Promise.all(chunkPromises);
            chunkDocs.forEach((d) => {
              if (d.exists()) base64Data += d.data().data;
            });
          } else {
            const snap = await getDocs(
              query(
                collection(
                  db,
                  "artifacts",
                  appId,
                  "public",
                  "data",
                  "chats",
                  chatId,
                  "messages",
                  m.id,
                  "chunks"
                ),
                orderBy("index", "asc")
              )
            );
            snap.forEach((d) => (base64Data += d.data().data));
          }
          if (base64Data) {
            let mimeType = m.mimeType;
            if (!mimeType) {
              if (m.type === "video") mimeType = "video/mp4";
              else if (m.type === "image") mimeType = "image/jpeg";
              else if (m.type === "audio") mimeType = "audio/webm";
              else mimeType = "application/octet-stream";
            }
            if (m.type !== "text" && m.type !== "contact")
              setBlobSrcFromBase64(base64Data, mimeType);
          } else if (m.preview) {
            setMediaSrc(m.preview);
          }
        } catch (e) {
          console.error("Failed to load chunks", e);
          if (m.preview) setMediaSrc(m.preview);
        } finally {
          setLoading(false);
        }
      })();
    } else {
      if (isInvalidBlob) {
        setMediaSrc(m.preview);
      } else {
        setMediaSrc(m.content || m.preview);
      }
    }
  }, [
    m.id,
    chatId,
    m.content,
    m.hasChunks,
    isMe,
    isInvalidBlob,
    m.preview,
    m.type,
    m.mimeType,
    m.chunkCount,
  ]);

  const handleDownload = async () => {
    if (m.content && m.content.startsWith("blob:")) {
      const a = document.createElement("a");
      a.href = m.content;
      a.download = m.fileName || "download_file";
      a.click();
      return;
    }
    setLoading(true);
    try {
      let dataUrl = mediaSrc;
      if (!dataUrl && m.hasChunks) {
        let base64Data = "";
        const snap = await getDocs(
          query(
            collection(
              db,
              "artifacts",
              appId,
              "public",
              "data",
              "chats",
              chatId,
              "messages",
              m.id,
              "chunks"
            ),
            orderBy("index", "asc")
          )
        );
        snap.forEach((d) => (base64Data += d.data().data));
        if (base64Data) {
          const mimeType = m.mimeType || "application/octet-stream";
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++)
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          const blob = new Blob([new Uint8Array(byteNumbers)], {
            type: mimeType,
          });
          dataUrl = URL.createObjectURL(blob);
        }
      } else if (!dataUrl) {
        dataUrl = m.content;
      }
      if (dataUrl) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = m.fileName || "download_file";
        a.click();
      }
    } catch (e) {
      console.error("Download failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleStickerClick = (e) => {
    e.stopPropagation();
    if (m.audio) {
      new Audio(m.audio).play().catch((e) => console.error("Audio playback error:", e));
    }
    if (onStickerClick && m.packId) {
      onStickerClick(m.packId);
    }
  };

  const handleBubbleClick = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const renderContent = (text) => {
    if (!text) return "";
    const regex = /(https?:\/\/[^\s]+)|(@[^\s]+)/g;
    const parts = text.split(regex);
    return parts.map((part, i) => {
      if (!part) return null;
      if (part.match(/^https?:\/\//))
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      if (part.startsWith("@")) {
        const name = part.substring(1);
        const mentionedUser = allUsers.find((u) => u.name === name);
        if (mentionedUser)
          return (
            <span
              key={i}
              className="text-blue-500 font-bold cursor-pointer hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </span>
          );
      }
      return part;
    });
  };

  const getUserNames = (uids) => {
    if (!uids || !allUsers) return "";
    return uids
      .map((uid) => {
        const u = allUsers.find((user) => user.uid === uid);
        return u ? u.name : "不明なユーザー";
      })
      .join(", ");
  };

  const readCount = (m.readBy?.length || 1) - 1;
  const finalSrc = mediaSrc || m.preview;
  const isShowingPreview = loading || isInvalidBlob || finalSrc === m.preview;

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"} gap-2 relative group mb-4`}>
      {!isMe && (
        <div className="relative mt-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
          <img src={sender?.avatar} className="w-8 h-8 rounded-lg object-cover border" loading="lazy" />
          {isTodayBirthday(sender?.birthday) && <span className="absolute -top-1 -right-1 text-[8px]">🎂</span>}
        </div>
      )}
      <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[75%]`}>
        {!isMe && isGroup && <div className="text-[10px] text-gray-600 font-bold mb-1 ml-1">{sender?.name}</div>}
        <div className="relative">
          <div
            onClick={handleBubbleClick}
            className={`p-2 px-3 rounded-2xl text-[13px] shadow-sm relative cursor-pointer ${
              m.type === "sticker" ? "bg-transparent shadow-none p-0" : isMe ? "bg-[#7cfc00] rounded-tr-none" : "bg-white rounded-tl-none"
            } ${["image", "video"].includes(m.type) ? "p-0 bg-transparent shadow-none" : ""}`}
          >
            {m.replyTo && m.type !== "sticker" && (
              <div className={`mb-2 p-2 rounded-lg border-l-4 text-xs opacity-70 ${isMe ? "bg-black/5 border-white/50" : "bg-gray-100 border-gray-300"}`}>
                <div className="font-bold text-[10px] mb-0.5">{m.replyTo.senderName}</div>
                <div className="truncate flex items-center gap-1">
                  {m.replyTo.type === "image" && <ImageIcon className="w-3 h-3" />}
                  {m.replyTo.type === "video" && <Video className="w-3 h-3" />}
                  {["image", "video"].includes(m.replyTo.type) ? (m.replyTo.type === "image" ? "[画像]" : "[動画]") : m.replyTo.content || "[メッセージ]"}
                </div>
              </div>
            )}
            {m.type === "text" && (
              <div className="whitespace-pre-wrap">
                {renderContent(m.content)}
                {m.isEdited && <div className="text-[9px] text-black/40 text-right mt-1 font-bold">(編集済)</div>}
              </div>
            )}
            {m.type === "sticker" && (
              <div className="relative group/sticker" onClick={handleStickerClick}>
                <img src={m.content || ""} className="w-32 h-32 object-contain drop-shadow-sm hover:scale-105 transition-transform" />
                {m.audio && <div className="absolute bottom-0 right-0 bg-black/20 text-white rounded-full p-1"><Volume2 className="w-3 h-3" /></div>}
              </div>
            )}
            {(m.type === "image" || m.type === "video") && (
              <div className="relative">
                {isShowingPreview && !finalSrc ? (
                  <div className="p-4 bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 min-w-[150px] min-h-[100px] border border-gray-200">
                    <Loader2 className="animate-spin w-8 h-8 text-green-500" />
                    <span className="text-[10px] text-gray-500 font-bold">{m.type === "video" ? "動画を受信中..." : "画像を受信中..."}</span>
                  </div>
                ) : (
                  <div className="relative">
                    {m.type === "video" ? (
                      <video src={finalSrc} className={`max-w-full rounded-xl border border-white/50 shadow-md bg-black ${showMenu ? "brightness-50" : ""}`} controls playsInline preload="metadata" />
                    ) : (
                      <img src={finalSrc} className={`max-w-full rounded-xl border border-white/50 shadow-md ${showMenu ? "brightness-50" : ""} ${isShowingPreview ? "opacity-80 blur-[1px]" : ""}`} loading="lazy" />
                    )}
                    {isShowingPreview && (
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> {isInvalidBlob ? "送信中..." : "受信中..."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {m.type === "audio" && (
              <div className="flex items-center gap-2 py-1 px-1">
                {loading ? <Loader2 className="animate-spin w-4 h-4 text-gray-400" /> : <audio src={mediaSrc} controls className="h-8 max-w-[200px]" />}
              </div>
            )}
            {m.type === "file" && (
              <div className="flex items-center gap-3 p-2 min-w-[200px]">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 border"><FileText className="w-6 h-6 text-gray-500" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{m.fileName || "不明なファイル"}</div>
                  <div className="text-[10px] text-gray-400">{m.fileSize ? `${(m.fileSize / 1024).toFixed(1)} KB` : "サイズ不明"}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDownload(); }} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin text-gray-500" /> : <Download className="w-4 h-4 text-gray-600" />}
                </button>
              </div>
            )}
            {m.type === "contact" && (
              <div className="flex flex-col gap-2 min-w-[150px] p-1">
                <div className="text-[10px] font-bold text-gray-400 mb-1 border-b border-gray-100 pb-1">連絡先</div>
                <div className="flex items-center gap-3">
                  <img src={m.contactAvatar} className="w-10 h-10 rounded-full border shadow-sm" loading="lazy" />
                  <span className="font-bold text-sm truncate">{m.contactName}</span>
                </div>
                {!isMe && (
                  <button onClick={(e) => { e.stopPropagation(); addFriendById(m.contactId); }} className="bg-black/5 hover:bg-black/10 text-xs font-bold py-2 rounded-xl mt-1 w-full flex items-center justify-center gap-2">
                    <UserPlus className="w-3 h-3" /> 友だち追加
                  </button>
                )}
              </div>
            )}
            <div className={`text-[8px] opacity-50 mt-1 text-right ${m.type === "sticker" ? "text-gray-500 font-bold bg-white/50 px-1 rounded" : ""}`}>
              {formatDateTime(m.createdAt)}
            </div>
            {showMenu && (
              <div className={`absolute top-full ${isMe ? "right-0" : "left-0"} mt-1 z-[100] flex flex-col bg-white rounded-xl shadow-2xl border overflow-hidden min-w-[180px] animate-in slide-in-from-top-2 duration-200`}>
                <div className="flex justify-between items-center p-2 bg-gray-50 border-b gap-1 overflow-x-auto scrollbar-hide">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button key={emoji} onClick={(e) => { e.stopPropagation(); onReaction(m.id, emoji); setShowMenu(false); }} className="hover:scale-125 transition-transform text-lg p-1">{emoji}</button>
                  ))}
                </div>
                <button onClick={(e) => { e.stopPropagation(); onReply(m); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left"><Reply className="w-4 h-4" />リプライ</button>
                {(m.type === "image" || m.type === "video") && <button onClick={(e) => { e.stopPropagation(); onPreview(finalSrc, m.type); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"><Maximize className="w-4 h-4" />拡大表示</button>}
                {m.type === "file" && <button onClick={(e) => { e.stopPropagation(); handleDownload(); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"><Download className="w-4 h-4" />保存</button>}
                {m.type === "text" && isMe && <button onClick={(e) => { e.stopPropagation(); onEdit(m.id, m.content); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"><Edit2 className="w-4 h-4" />編集</button>}
                {isMe && <button onClick={(e) => { e.stopPropagation(); onDelete(m.id); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 text-xs font-bold text-red-500 text-left border-t border-gray-100"><Trash2 className="w-4 h-4" />送信取消</button>}
              </div>
            )}
          </div>
        </div>
        {m.reactions && Object.keys(m.reactions).some(k => m.reactions[k]?.length > 0) && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
            {Object.entries(m.reactions).map(([emoji, uids]) => uids?.length > 0 && (
              <button key={emoji} onClick={() => onReaction(m.id, emoji)} title={getUserNames(uids)} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs shadow-sm border transition-all hover:scale-105 ${uids.includes(user.uid) ? "bg-white border-green-500 text-green-600 ring-1 ring-green-100" : "bg-white border-gray-100 text-gray-600"}`}>
                <span className="text-sm">{emoji}</span>
                <span className="font-bold text-[10px]">{uids.length}</span>
              </button>
            ))}
          </div>
        )}
        {isMe && readCount > 0 && <div className="text-[10px] font-bold text-green-600 mt-0.5">既読 {isGroup ? readCount : ""}</div>}
      </div>
    </div>
  );
});

// --- Main Views ---

const ChatRoomView = ({ user, profile, allUsers, chats, activeChatId, setActiveChatId, setView, db, appId, mutedChats, toggleMuteChat, showNotification, addFriendById }) => {
  const [messages, setMessages] = useState([]), [text, setText] = useState(""), [plusMenuOpen, setPlusMenuOpen] = useState(false), [isUploading, setIsUploading] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false), [cardModalOpen, setCardModalOpen] = useState(false), [stickerMenuOpen, setStickerMenuOpen] = useState(false);
  const [myStickerPacks, setMyStickerPacks] = useState([]), [selectedPackId, setSelectedPackId] = useState(null), [replyTo, setReplyTo] = useState(null);
  const scrollRef = useRef();
  const [buyStickerModalPackId, setBuyStickerModalPackId] = useState(null);
  const [backgroundMenuOpen, setBackgroundMenuOpen] = useState(false);
  const [groupEditModalOpen, setGroupEditModalOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [messageLimit, setMessageLimit] = useState(50);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const chatData = chats.find((c) => c.id === activeChatId);
  if (!chatData) return <div className="h-full flex items-center justify-center bg-white"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

  const isGroup = chatData.isGroup;
  let title = chatData.name, icon = chatData.icon, partnerId = isGroup ? null : chatData.participants.find(p => p !== user.uid) || user.uid;
  if (!isGroup) { const p = allUsers.find(u => u.uid === partnerId); if (p) { title = p.name; icon = p.avatar; } }

  useEffect(() => {
    const q = query(collection(db, "artifacts", appId, "public", "data", "chats", activeChatId, "messages"), orderBy("createdAt", "asc"), limitToLast(messageLimit));
    return onSnapshot(q, (snapshot) => setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [activeChatId, messageLimit]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const q = query(collection(db, "artifacts", appId, "public", "data", "sticker_packs"), where("purchasedBy", "array-contains", user.uid));
    onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyStickerPacks(fetched);
      if (fetched.length > 0 && !selectedPackId) setSelectedPackId(fetched[0].id);
    });
  }, [user.uid]);

  const sendMessage = async (content, type = "text", additionalData = {}, file = null) => {
    if (profile?.isBanned) return showNotification("利用停止中です");
    if (!content && !file && type === "text") return;
    setIsUploading(true);
    const msgCol = collection(db, "artifacts", appId, "public", "data", "chats", activeChatId, "messages");
    const newMsgRef = doc(msgCol);
    
    try {
      if (file) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        await new Promise(r => reader.onload = async (e) => {
          await setDoc(newMsgRef, { senderId: user.uid, content: e.target.result, type, createdAt: serverTimestamp(), readBy: [user.uid], ...additionalData });
          r();
        });
      } else {
        const msgData = { senderId: user.uid, content, type, createdAt: serverTimestamp(), readBy: [user.uid], ...additionalData };
        if (replyTo) { msgData.replyTo = { id: replyTo.id, content: replyTo.content, senderName: allUsers.find(u => u.uid === replyTo.senderId)?.name || "Unknown", type: replyTo.type }; setReplyTo(null); }
        await setDoc(newMsgRef, msgData);
      }
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeChatId), { lastMessage: { content: type === "text" ? content : `[${type}]`, senderId: user.uid }, updatedAt: serverTimestamp() });
      setText(""); setPlusMenuOpen(false); setStickerMenuOpen(false);
    } catch (e) { console.error(e); showNotification("送信失敗"); } finally { setIsUploading(false); }
  };

  const handleEditMessage = async () => {
    if (!editingText.trim() || !editingMsgId) return;
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeChatId, "messages", editingMsgId), { content: editingText, isEdited: true });
    setEditingMsgId(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#8fb2c9] relative">
      <div className="p-3 bg-white/95 backdrop-blur border-b flex items-center gap-3 sticky top-0 z-10">
        <ChevronLeft className="cursor-pointer w-6 h-6" onClick={() => setView("home")} />
        <img src={icon} className="w-10 h-10 rounded-xl object-cover border" />
        <div className="font-bold text-sm flex-1 truncate">{title}</div>
        <div className="flex gap-4 items-center">
          <button onClick={() => setBackgroundMenuOpen(!backgroundMenuOpen)}><Palette className="w-6 h-6 text-gray-600" /></button>
          {isGroup && <button onClick={() => setGroupEditModalOpen(true)}><Settings className="w-6 h-6 text-gray-600" /></button>}
          {isGroup && <button onClick={() => setAddMemberModalOpen(true)}><UserPlus className="w-6 h-6 text-gray-600" /></button>}
          {isGroup && <button onClick={() => setLeaveModalOpen(true)}><LogOut className="w-6 h-6 text-red-500" /></button>}
          <button onClick={() => updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeChatId), { "callStatus.status": "ringing", "callStatus.callerId": user.uid, "callStatus.roomName": `room_${activeChatId}`, "callStatus.timestamp": Date.now() })}><Video className="w-6 h-6 text-gray-600" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((m) => (
          <MessageItem key={m.id} m={m} user={user} sender={allUsers.find(u => u.uid === m.senderId)} isGroup={isGroup} db={db} appId={appId} chatId={activeChatId} addFriendById={addFriendById} onEdit={(id, t) => { setEditingMsgId(id); setEditingText(t); }} onDelete={(id) => deleteDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeChatId, "messages", id))} onReply={setReplyTo} onReaction={(mid, emoji) => { const ref = doc(db, "artifacts", appId, "public", "data", "chats", activeChatId, "messages", mid); getDoc(ref).then(snapshot => { const current = snapshot.data().reactions?.[emoji] || []; updateDoc(ref, { [`reactions.${emoji}`]: current.includes(user.uid) ? arrayRemove(user.uid) : arrayUnion(user.uid) }); }); }} allUsers={allUsers} onStickerClick={setBuyStickerModalPackId} onPreview={(src, type) => setPreviewMedia({src, type})} />
        ))}
        <div ref={scrollRef} />
      </div>
      <div className="p-3 bg-white border-t flex flex-col gap-2 relative z-10">
        {stickerMenuOpen && (
          <div className="absolute bottom-full left-0 right-0 bg-gray-50 border-t h-72 flex flex-col shadow-2xl z-20">
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-4 gap-4 content-start">
              {myStickerPacks.find(p => p.id === selectedPackId)?.stickers.map((s, i) => (
                <img key={i} src={s.image || s} className="w-full aspect-square object-contain cursor-pointer hover:scale-110 transition-transform" onClick={() => sendMessage(s, "sticker", { packId: selectedPackId })} />
              ))}
            </div>
            <div className="bg-white border-t flex overflow-x-auto p-2 gap-2 shrink-0">
              {myStickerPacks.map(p => <img key={p.id} src={p.stickers[0].image || p.stickers[0]} className={`w-8 h-8 object-contain cursor-pointer rounded ${selectedPackId === p.id ? "bg-gray-200" : ""}`} onClick={() => setSelectedPackId(p.id)} />)}
            </div>
          </div>
        )}
        {replyTo && <div className="flex items-center justify-between bg-gray-100 p-2 rounded-xl text-xs mb-1 border-l-4 border-green-500"><span><span className="font-bold text-green-600">{allUsers.find(u => u.uid === replyTo.senderId)?.name}</span> への返信</span><X className="w-3 h-3 cursor-pointer" onClick={() => setReplyTo(null)} /></div>}
        <div className="flex items-center gap-2">
          <button onClick={() => setPlusMenuOpen(!plusMenuOpen)} className={`p-2 rounded-full ${plusMenuOpen ? "bg-gray-100 rotate-45" : ""}`}><Plus className="w-5 h-5 text-gray-400" /></button>
          <input className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 text-sm focus:outline-none" placeholder="メッセージ..." value={text} onChange={(e) => setText(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage(text)} />
          <button onClick={() => setStickerMenuOpen(!stickerMenuOpen)} className={`p-2 rounded-full ${stickerMenuOpen ? "text-green-500 bg-green-50" : "text-gray-400"}`}><Smile className="w-5 h-5" /></button>
          <button onClick={() => sendMessage(text)} disabled={!text && !isUploading} className="text-green-500 p-2"><Send className="w-5 h-5" /></button>
        </div>
      </div>
      {plusMenuOpen && (
        <div className="absolute bottom-16 left-4 right-4 bg-white rounded-3xl p-4 shadow-2xl grid grid-cols-4 gap-4 animate-in slide-in-from-bottom-4 z-20">
          <label className="flex flex-col items-center gap-1 cursor-pointer"><div className="p-3 bg-green-50 rounded-2xl"><ImageIcon className="text-green-500 w-6 h-6" /></div><span className="text-[10px] font-bold">画像</span><input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, (d, t, f) => sendMessage(d, t, {}, f))} /></label>
          <label className="flex flex-col items-center gap-1 cursor-pointer"><div className="p-3 bg-blue-50 rounded-2xl"><Play className="text-blue-500 w-6 h-6" /></div><span className="text-[10px] font-bold">動画</span><input type="file" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, (d, t, f) => sendMessage(d, t, {}, f))} /></label>
          <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setContactModalOpen(true)}><div className="p-3 bg-yellow-50 rounded-2xl"><Contact className="text-yellow-500 w-6 h-6" /></div><span className="text-[10px] font-bold">連絡先</span></div>
          <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setCardModalOpen(true)}><div className="p-3 bg-pink-50 rounded-2xl"><Gift className="text-pink-500 w-6 h-6" /></div><span className="text-[10px] font-bold">カード</span></div>
        </div>
      )}
      {contactModalOpen && <ContactSelectModal onClose={() => setContactModalOpen(false)} onSend={(c) => sendMessage("", "contact", { contactId: c.uid, contactName: c.name, contactAvatar: c.avatar })} friends={allUsers.filter(u => profile?.friends?.includes(u.uid))} />}
      {cardModalOpen && <BirthdayCardModal onClose={() => setCardModalOpen(false)} onSend={({ color, message }) => sendMessage(`🎂 バースデーカード:\n${message}`, "text")} toName={title} />}
      {buyStickerModalPackId && <StickerBuyModal onClose={() => setBuyStickerModalPackId(null)} packId={buyStickerModalPackId} onGoToStore={() => { setView("sticker-store"); setBuyStickerModalPackId(null); }} />}
      {previewMedia && <div className="fixed inset-0 z-[600] bg-black flex items-center justify-center p-4" onClick={() => setPreviewMedia(null)}>{previewMedia.type === "video" ? <video src={previewMedia.src} controls autoPlay className="max-w-full max-h-[80vh]" /> : <img src={previewMedia.src} className="max-w-full max-h-[80vh] object-contain" />}</div>}
      {editingMsgId && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-4">
            <h3 className="font-bold mb-2">メッセージを編集</h3>
            <textarea className="w-full bg-gray-50 p-2 rounded-xl mb-4 border focus:outline-none" value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={3} />
            <div className="flex gap-2"><button onClick={() => setEditingMsgId(null)} className="flex-1 py-2 bg-gray-100 rounded-xl font-bold text-gray-600">キャンセル</button><button onClick={handleEditMessage} className="flex-1 py-2 bg-green-500 rounded-xl font-bold text-white">更新</button></div>
          </div>
        </div>
      )}
      {groupEditModalOpen && <GroupEditModal onClose={() => setGroupEditModalOpen(false)} chatId={activeChatId} currentName={chatData.name} currentIcon={chatData.icon} currentMembers={chatData.participants} allUsers={allUsers} showNotification={showNotification} user={user} profile={profile} />}
      {addMemberModalOpen && <GroupAddMemberModal onClose={() => setAddMemberModalOpen(false)} currentMembers={chatData.participants} chatId={activeChatId} allUsers={allUsers} profile={profile} user={user} showNotification={showNotification} />}
      {leaveModalOpen && <LeaveGroupConfirmModal onClose={() => setLeaveModalOpen(false)} onLeave={async () => { await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeChatId), { participants: arrayRemove(user.uid) }); setView("home"); setActiveChatId(null); }} />}
    </div>
  );
};

const PostItem = ({ post, user, allUsers, db, appId, profile }) => {
  const [commentText, setCommentText] = useState(""), [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const u = allUsers.find((x) => x.uid === post.userId), isLiked = post.likes?.includes(user?.uid);
  const toggleLike = async () => await updateDoc(doc(db, "artifacts", appId, "public", "data", "posts", post.id), { likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) });
  const submitComment = async () => { if (!commentText.trim()) return; await updateDoc(doc(db, "artifacts", appId, "public", "data", "posts", post.id), { comments: arrayUnion({ userId: user.uid, userName: profile.name, text: commentText, createdAt: new Date().toISOString() }) }); setCommentText(""); };
  return (
    <div className="bg-white p-4 mb-2 border-b">
      <div className="flex items-center gap-3 mb-3"><img src={u?.avatar} className="w-10 h-10 rounded-xl border" /><div className="font-bold text-sm">{u?.name}</div></div>
      <div className="text-sm mb-3 whitespace-pre-wrap">{post.content}</div>
      {post.media && <img src={post.media} className="w-full rounded-2xl max-h-96 object-cover mb-3" />}
      <div className="flex items-center gap-6 py-2 border-y mb-3">
        <button onClick={toggleLike} className="flex items-center gap-1.5"><Heart className={`w-5 h-5 ${isLiked ? "fill-red-500 text-red-500" : "text-gray-400"}`} /><span className="text-xs">{post.likes?.length || 0}</span></button>
        <div className="flex items-center gap-1.5 text-gray-400"><MessageCircle className="w-5 h-5" /><span className="text-xs">{post.comments?.length || 0}</span></div>
      </div>
      <div className="space-y-3 mb-4">{post.comments?.map((c, i) => (<div key={i} className="bg-gray-50 rounded-2xl px-3 py-2"><div className="text-[10px] font-bold text-gray-500">{c.userName}</div><div className="text-xs">{c.text}</div></div>))}</div>
      <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1"><input className="flex-1 bg-transparent text-xs py-2 focus:outline-none" placeholder="コメント..." value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyPress={(e) => e.key === "Enter" && submitComment()} /><button onClick={submitComment} className="text-green-500"><Send className="w-4 h-4" /></button></div>
    </div>
  );
};

const VoomView = ({ user, allUsers, profile, posts, showNotification, db, appId }) => {
  const [content, setContent] = useState(""), [media, setMedia] = useState(null), [isUploading, setIsUploading] = useState(false);
  const postMessage = async () => {
    if (!content && !media) return; setIsUploading(true);
    try { await addDoc(collection(db, "artifacts", appId, "public", "data", "posts"), { userId: user.uid, content, media, createdAt: serverTimestamp(), likes: [], comments: [] }); setContent(""); setMedia(null); showNotification("投稿しました"); }
    catch (e) { showNotification("失敗"); } finally { setIsUploading(false); }
  };
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white p-4 border-b font-bold">VOOM</div>
      <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
        <div className="bg-white p-4 mb-2">
          <textarea className="w-full text-sm outline-none resize-none min-h-[60px]" placeholder="何をしていますか？" value={content} onChange={(e) => setContent(e.target.value)} />
          {media && <div className="relative mt-2"><img src={media} className="max-h-60 rounded-xl" /><button onClick={() => setMedia(null)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X className="w-3 h-3" /></button></div>}
          <div className="flex justify-between items-center pt-2 border-t mt-2">
            <label className="cursor-pointer p-2"><ImageIcon className="text-gray-400" /><input type="file" className="hidden" accept="image/*" onChange={(e) => { const r = new FileReader(); r.onload = (ev) => setMedia(ev.target.result); r.readAsDataURL(e.target.files[0]); }} /></label>
            <button onClick={postMessage} disabled={isUploading} className={`text-xs font-bold px-4 py-2 rounded-full ${content || media ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"}`}>投稿</button>
          </div>
        </div>
        {posts.map(p => <PostItem key={p.id} post={p} user={user} allUsers={allUsers} db={db} appId={appId} profile={profile} />)}
      </div>
    </div>
  );
};

const ProfileEditView = ({ user, profile, setView, showNotification, copyToClipboard }) => {
  const [edit, setEdit] = useState(profile || {});
  const handleSave = async () => { await updateDoc(doc(db, "artifacts", appId, "public", "data", "users", user.uid), edit); showNotification("保存完了"); };
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b flex items-center gap-4"><ChevronLeft className="cursor-pointer" onClick={() => setView("home")} /><span className="font-bold">設定</span></div>
      <div className="flex-1 overflow-y-auto">
        <div className="w-full h-48 bg-gray-200 relative"><img src={edit.cover} className="w-full h-full object-cover" /><label className="absolute inset-0 flex items-center justify-center bg-black/20 text-white cursor-pointer opacity-0 hover:opacity-100">背景変更<input type="file" className="hidden" accept="image/*" onChange={(e) => handleCompressedUpload(e, (d) => setEdit({ ...edit, cover: d }))} /></label></div>
        <div className="px-8 -mt-12 flex flex-col items-center gap-6">
          <div className="relative"><img src={edit.avatar} className="w-24 h-24 rounded-3xl border-4 border-white object-cover" /><label className="absolute bottom-0 right-0 bg-green-500 p-2 rounded-full text-white cursor-pointer"><CameraIcon className="w-4 h-4" /><input type="file" className="hidden" accept="image/*" onChange={(e) => handleCompressedUpload(e, (d) => setEdit({ ...edit, avatar: d }))} /></label></div>
          <div className="w-full space-y-4">
            <div><label className="text-xs text-gray-400">名前</label><input className="w-full border-b py-2 focus:outline-none" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div><label className="text-xs text-gray-400">ID</label><div className="flex items-center border-b py-2"><span className="flex-1 font-mono text-gray-600">{edit.id}</span><button onClick={() => copyToClipboard(edit.id)}><Copy className="w-4 h-4 text-gray-500" /></button></div></div>
            <div><label className="text-xs text-gray-400">ひとこと</label><input className="w-full border-b py-2 focus:outline-none" value={edit.status || ""} onChange={(e) => setEdit({ ...edit, status: e.target.value })} /></div>
            <button onClick={handleSave} className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold shadow-lg">保存</button>
            <button onClick={() => signOut(auth)} className="w-full bg-gray-100 text-red-500 py-4 rounded-2xl font-bold mt-4">ログアウト</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const QRScannerView = ({ user, setView, addFriendById }) => {
  const videoRef = useRef(null), canvasRef = useRef(null), [scanning, setScanning] = useState(false), [stream, setStream] = useState(null);
  useEffect(() => () => stream?.getTracks().forEach(t => t.stop()), [stream]);
  const startScanner = async () => {
    setScanning(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setStream(mediaStream); if (videoRef.current) { videoRef.current.srcObject = mediaStream; videoRef.current.play(); requestAnimationFrame(tick); }
    } catch (e) { setScanning(false); }
  };
  const tick = () => {
    if (videoRef.current?.readyState === 4) {
      const c = canvasRef.current, ctx = c.getContext("2d"); c.height = videoRef.current.videoHeight; c.width = videoRef.current.videoWidth;
      ctx.drawImage(videoRef.current, 0, 0, c.width, c.height);
      const code = window.jsQR?.(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
      if (code) { stream?.getTracks().forEach(t => t.stop()); setScanning(false); addFriendById(code.data); return; }
    }
    requestAnimationFrame(tick);
  };
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b flex items-center gap-4"><ChevronLeft className="cursor-pointer" onClick={() => setView("home")} /><span className="font-bold">QR</span></div>
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        {scanning ? <div className="relative w-64 h-64 border-4 border-green-500 rounded-3xl overflow-hidden"><video ref={videoRef} className="w-full h-full object-cover" /><canvas ref={canvasRef} className="hidden" /></div> :
          <div className="bg-white p-6 rounded-[40px] shadow-xl border"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${user?.uid}`} className="w-48 h-48" /></div>}
        <div className="grid grid-cols-2 gap-4 w-full">
          <button onClick={startScanner} className="flex flex-col items-center gap-2 bg-gray-50 p-4 rounded-3xl border"><Maximize className="text-green-500" /><span>スキャン</span></button>
          <label className="flex flex-col items-center gap-2 bg-gray-50 p-4 rounded-3xl border cursor-pointer"><Upload className="text-blue-500" /><span>読込</span><input type="file" className="hidden" accept="image/*" onChange={(e) => { const r = new FileReader(); r.onload = (ev) => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"), ctx = c.getContext("2d"); c.width = img.width; c.height = img.height; ctx.drawImage(img, 0, 0); const code = window.jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height); if (code) addFriendById(code.data); }; img.src = ev.target.result; }; r.readAsDataURL(e.target.files[0]); }} /></label>
        </div>
      </div>
    </div>
  );
};

const FriendProfileModal = ({ friend, onClose, onStartChat }) => (
  <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
    <div className="bg-white w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl relative flex flex-col items-center pb-8">
      <button onClick={onClose} className="absolute top-4 right-4 z-10 bg-black/20 text-white p-2 rounded-full"><X className="w-6 h-6" /></button>
      <div className="w-full h-48 bg-gray-200"><img src={friend.cover} className="w-full h-full object-cover" /></div>
      <div className="-mt-16 mb-4"><img src={friend.avatar} className="w-32 h-32 rounded-[40px] border-[6px] border-white object-cover" /></div>
      <h2 className="text-2xl font-bold">{friend.name}</h2>
      <div className="w-full px-8 mb-8"><p className="text-center text-sm text-gray-600 bg-gray-50 py-3 rounded-2xl">{friend.status}</p></div>
      <button onClick={() => { onStartChat(friend.uid); onClose(); }} className="w-3/4 py-4 bg-green-500 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2"><MessageCircle />トーク</button>
    </div>
  </div>
);

const HomeView = ({ user, profile, allUsers, chats, setView, setActiveChatId, setSearchModalOpen, startChatWithUser }) => {
  const [tab, setTab] = useState("chats"), [selectedFriend, setSelectedFriend] = useState(null);
  const friendsList = useMemo(() => allUsers.filter(u => profile?.friends?.includes(u.uid)), [allUsers, profile]);
  return (
    <div className="flex flex-col h-full bg-white border-x border-gray-200 max-w-md mx-auto">
      <div className="p-4 border-b flex justify-between items-center bg-white shrink-0 sticky top-0 z-10">
        <h1 className="text-xl font-bold">ホーム</h1>
        <div className="flex gap-4 items-center">
          <Store className="w-6 h-6 cursor-pointer text-orange-500" onClick={() => setView("sticker-store")} />
          <Search className="w-6 h-6 cursor-pointer" onClick={() => setSearchModalOpen(true)} />
          <UserPlus className="w-6 h-6 cursor-pointer" onClick={() => setView("qr")} />
          <Settings className="w-6 h-6 cursor-pointer" onClick={() => setView("profile")} />
        </div>
      </div>
      <div className="flex border-b">
        <button className={`flex-1 py-3 text-sm font-bold ${tab === "friends" ? "border-b-2 border-black" : "text-gray-400"}`} onClick={() => setTab("friends")}>友だち</button>
        <button className={`flex-1 py-3 text-sm font-bold ${tab === "chats" ? "border-b-2 border-black" : "text-gray-400"}`} onClick={() => setTab("chats")}>トーク</button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer border-b" onClick={() => setView("profile")}>
          <img src={profile?.avatar} className="w-16 h-16 rounded-2xl object-cover border" /><div className="flex-1 font-bold text-lg">{profile?.name}</div>
        </div>
        {tab === "friends" && friendsList.map(f => (<div key={f.uid} className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedFriend(f)}><img src={f.avatar} className="w-12 h-12 rounded-xl object-cover border" /><div className="flex-1 font-bold text-sm">{f.name}</div></div>))}
        {tab === "chats" && chats.sort((a,b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)).map(chat => {
          let name = chat.name, icon = chat.icon; if (!chat.isGroup) { const p = allUsers.find(u => u.uid === chat.participants.find(id => id !== user.uid)); if (p) { name = p.name; icon = p.avatar; } }
          return (<div key={chat.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer" onClick={() => { setActiveChatId(chat.id); setView("chatroom"); }}><img src={icon} className="w-12 h-12 rounded-xl object-cover border" /><div className="flex-1 min-w-0"><div className="font-bold text-sm truncate">{name}</div><div className="text-xs text-gray-400 truncate">{chat.lastMessage?.content}</div></div><div className="text-[10px] text-gray-300">{formatTime(chat.updatedAt)}</div></div>);
        })}
      </div>
      {selectedFriend && <FriendProfileModal friend={selectedFriend} onClose={() => setSelectedFriend(null)} onStartChat={startChatWithUser} />}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState(null), [profile, setProfile] = useState(null), [view, setView] = useState("auth"), [activeChatId, setActiveChatId] = useState(null);
  const [allUsers, setAllUsers] = useState([]), [chats, setChats] = useState([]), [posts, setPosts] = useState([]), [notification, setNotification] = useState(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false), [searchQuery, setSearchQuery] = useState(""), [mutedChats, setMutedChats] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null), [outgoingCall, setOutgoingCall] = useState(null), [callAcceptedData, setCallAcceptedData] = useState(null);

  useEffect(() => {
    const script = document.createElement("script"); script.src = JSQR_URL; document.head.appendChild(script);
    setPersistence(auth, browserLocalPersistence);
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const docSnap = await getDoc(doc(db, "artifacts", appId, "public", "data", "users", u.uid));
        if (docSnap.exists()) setProfile(docSnap.data());
        setView("home");
      } else { setUser(null); setProfile(null); setView("auth"); }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    onSnapshot(doc(db, "artifacts", appId, "public", "data", "users", user.uid), (d) => d.exists() && setProfile(d.data()));
    onSnapshot(collection(db, "artifacts", appId, "public", "data", "users"), (snapshot) => setAllUsers(snapshot.docs.map(d => d.data())));
    onSnapshot(query(collection(db, "artifacts", appId, "public", "data", "chats"), where("participants", "array-contains", user.uid)), (snapshot) => setChats(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
    onSnapshot(query(collection(db, "artifacts", appId, "public", "data", "posts"), orderBy("createdAt", "desc"), limit(50)), (snapshot) => setPosts(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  const showNotification = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };
  const addFriendById = async (id) => {
    const target = allUsers.find(u => u.id === id || u.uid === id);
    if (!target || target.uid === user.uid) return showNotification("ユーザーが見つかりません");
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "users", user.uid), { friends: arrayUnion(target.uid) });
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "users", target.uid), { friends: arrayUnion(user.uid) });
    showNotification("友だち追加しました"); setSearchModalOpen(false);
  };

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col items-center justify-center bg-gray-50">
      {notification && <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[999] bg-black/85 text-white px-6 py-2 rounded-full text-xs font-bold shadow-2xl animate-in fade-in slide-in-from-top-4">{notification}</div>}
      
      {!user ? (
        <AuthView onLogin={setUser} showNotification={showNotification} />
      ) : (
        <div className="w-full max-w-md h-full bg-white shadow-2xl overflow-hidden relative border-x border-gray-200">
          {view === "home" && <HomeView user={user} profile={profile} allUsers={allUsers} chats={chats} setView={setView} setActiveChatId={setActiveChatId} setSearchModalOpen={setSearchModalOpen} startChatWithUser={async (tid) => { const ex = chats.find(c => !c.isGroup && c.participants.includes(tid)); if (ex) { setActiveChatId(ex.id); setView("chatroom"); } else { const r = await addDoc(collection(db, "artifacts", appId, "public", "data", "chats"), { participants: [user.uid, tid], isGroup: false, createdAt: serverTimestamp(), lastMessage: { content: "トークを開始しました" } }); setActiveChatId(r.id); setView("chatroom"); } }} />}
          {view === "chatroom" && <ChatRoomView user={user} profile={profile} allUsers={allUsers} chats={chats} activeChatId={activeChatId} setActiveChatId={setActiveChatId} setView={setView} db={db} appId={appId} mutedChats={mutedChats} toggleMuteChat={() => {}} showNotification={showNotification} addFriendById={addFriendById} />}
          {view === "voom" && <VoomView user={user} allUsers={allUsers} profile={profile} posts={posts} showNotification={showNotification} db={db} appId={appId} />}
          {view === "profile" && <ProfileEditView user={user} profile={profile} setView={setView} showNotification={showNotification} copyToClipboard={(t) => { navigator.clipboard.writeText(t); showNotification("コピーしました"); }} />}
          {view === "qr" && <QRScannerView user={user} setView={setView} addFriendById={addFriendById} />}
          {view === "sticker-store" && <StickerStoreView user={user} setView={setView} showNotification={showNotification} profile={profile} allUsers={allUsers} />}
          {view === "sticker-create" && <StickerEditor user={user} profile={profile} onClose={() => setView("sticker-store")} showNotification={showNotification} />}
          {view === "group-create" && <GroupCreateView user={user} profile={profile} allUsers={allUsers} setView={setView} showNotification={showNotification} />}
          {view === "birthday-cards" && <BirthdayCardBox user={user} setView={setView} />}
          
          {user && ["home", "voom"].includes(view) && (
            <div className="h-20 bg-white border-t flex items-center justify-around z-50 pb-4 shrink-0 absolute bottom-0 w-full">
              <div className={`flex flex-col items-center gap-1 cursor-pointer ${view === "home" ? "text-green-500" : "text-gray-400"}`} onClick={() => setView("home")}><Home className="w-6 h-6" /><span className="text-[10px] font-bold">ホーム</span></div>
              <div className={`flex flex-col items-center gap-1 cursor-pointer ${view === "voom" ? "text-green-500" : "text-gray-400"}`} onClick={() => setView("voom")}><LayoutGrid className="w-6 h-6" /><span className="text-[10px] font-bold">VOOM</span></div>
            </div>
          )}
        </div>
      )}

      {searchModalOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/60">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-8">
            <h2 className="text-xl font-bold mb-6">ユーザー検索</h2>
            <input className="w-full bg-gray-50 rounded-2xl py-4 px-6 mb-6 focus:outline-none" placeholder="IDを入力" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <div className="flex gap-4"><button className="flex-1 py-4 text-gray-600" onClick={() => setSearchModalOpen(false)}>閉じる</button><button className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-bold" onClick={() => addFriendById(searchQuery)}>追加</button></div>
          </div>
        </div>
      )}
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
}
