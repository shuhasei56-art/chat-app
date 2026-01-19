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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = `${userId}@voom-persistent.app`;
    setLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification("ログインしました");
      } else {
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
    <div className="w-full h-full overflow-y-auto bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="min-h-full flex flex-col items-center justify-center p-6">
        <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8 animate-in fade-in zoom-in duration-300">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-indigo-500 rounded-3xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
              <MessageCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">チャットアプリ</h1>
            <p className="text-sm text-gray-500 mt-2">
              {isLoginMode
                ? "データはIDに紐づいて保存されます"
                : "アカウントを作成してデータを保存"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLoginMode && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 ml-2">
                  ニックネーム (表示名)
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
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none mt-6"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
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
            <div key={f.uid} onClick={() => onSend(f)} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer">
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
        <button onClick={() => onSend({ color, message })} disabled={!message.trim()} className="w-full bg-pink-500 text-white font-bold py-3 rounded-2xl">送信する</button>
      </div>
    </div>
  );
};

// --- Message Components ---

const MessageItem = React.memo(({ m, user, sender, isGroup, db, appId, chatId, addFriendById, onEdit, onDelete, onPreview, onReply, onReaction, allUsers, onStickerClick }) => {
  const isMe = m.senderId === user.uid;
  const [mediaSrc, setMediaSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (m.type === "image" || m.type === "video") {
      setMediaSrc(m.content || m.preview);
    }
  }, [m.content, m.preview, m.type]);

  const handleBubbleClick = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const renderContent = (text) => {
    if (!text) return "";
    const regex = /(https?:\/\/[^\s]+)/g;
    return text.split(regex).map((part, i) => (
      part.match(regex) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{part}</a> : part
    ));
  };

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
          <div onClick={handleBubbleClick} className={`p-2 px-3 rounded-2xl text-[13px] shadow-sm relative cursor-pointer ${m.type === "sticker" ? "bg-transparent p-0" : isMe ? "bg-[#7cfc00] rounded-tr-none" : "bg-white rounded-tl-none"} ${["image", "video"].includes(m.type) ? "p-0 bg-transparent" : ""}`}>
            {m.type === "text" && <div className="whitespace-pre-wrap">{renderContent(m.content)}</div>}
            {m.type === "sticker" && <img src={m.content} className="w-32 h-32 object-contain" onClick={(e) => { e.stopPropagation(); onStickerClick(m.packId); }} />}
            {m.type === "image" && <img src={mediaSrc} className="max-w-full rounded-xl border border-white/50 shadow-md" loading="lazy" />}
            {m.type === "video" && <video src={mediaSrc} className="max-w-full rounded-xl border border-white/50 shadow-md bg-black" controls playsInline />}
            {m.type === "audio" && <audio src={m.content} controls className="h-8 max-w-[200px]" />}
            {m.type === "contact" && (
              <div className="flex flex-col gap-2 min-w-[150px] p-1">
                <div className="text-[10px] font-bold text-gray-400 mb-1 border-b pb-1">連絡先</div>
                <div className="flex items-center gap-3">
                  <img src={m.contactAvatar} className="w-10 h-10 rounded-full border" />
                  <span className="font-bold text-sm truncate">{m.contactName}</span>
                </div>
                {!isMe && <button onClick={(e) => { e.stopPropagation(); addFriendById(m.contactId); }} className="bg-black/5 hover:bg-black/10 text-xs font-bold py-2 rounded-xl mt-1 w-full">友だち追加</button>}
              </div>
            )}
            <div className="text-[8px] opacity-50 mt-1 text-right">{formatDateTime(m.createdAt)}</div>
            {showMenu && (
              <div className={`absolute top-full ${isMe ? "right-0" : "left-0"} mt-1 z-[100] flex flex-col bg-white rounded-xl shadow-2xl border overflow-hidden min-w-[180px]`}>
                <button onClick={(e) => { e.stopPropagation(); onReply(m); setShowMenu(false); }} className="px-4 py-3 hover:bg-gray-100 text-xs font-bold text-left flex items-center gap-2"><Reply className="w-4 h-4" />リプライ</button>
                {isMe && <button onClick={(e) => { e.stopPropagation(); onDelete(m.id); setShowMenu(false); }} className="px-4 py-3 hover:bg-red-50 text-xs font-bold text-red-500 text-left flex items-center gap-2 border-t"><Trash2 className="w-4 h-4" />送信取消</button>}
              </div>
            )}
          </div>
        </div>
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

  const chatData = chats.find((c) => c.id === activeChatId);
  if (!chatData) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  const isGroup = chatData.isGroup;
  let title = chatData.name, icon = chatData.icon, partnerId = isGroup ? null : chatData.participants.find(p => p !== user.uid) || user.uid;
  if (!isGroup) { const p = allUsers.find(u => u.uid === partnerId); if (p) { title = p.name; icon = p.avatar; } }

  useEffect(() => {
    const q = query(collection(db, "artifacts", appId, "public", "data", "chats", activeChatId, "messages"), orderBy("createdAt", "asc"), limitToLast(50));
    return onSnapshot(q, (snap) => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [activeChatId]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const q = query(collection(db, "artifacts", appId, "public", "data", "sticker_packs"), where("purchasedBy", "array-contains", user.uid));
    onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyStickerPacks(fetched);
      if (fetched.length > 0 && !selectedPackId) setSelectedPackId(fetched[0].id);
    });
  }, [user.uid]);

  const sendMessage = async (content, type = "text", additionalData = {}, file = null) => {
    if (!content && !file && type === "text") return;
    setIsUploading(true);
    try {
      const msgCol = collection(db, "artifacts", appId, "public", "data", "chats", activeChatId, "messages");
      const msgData = { senderId: user.uid, content, type, createdAt: serverTimestamp(), readBy: [user.uid], ...additionalData };
      if (replyTo) { msgData.replyTo = { id: replyTo.id, content: replyTo.content, senderName: allUsers.find(u => u.uid === replyTo.senderId)?.name || "Unknown" }; setReplyTo(null); }
      
      if (file) {
        const reader = new FileReader(); reader.readAsDataURL(file);
        await new Promise(r => reader.onload = async (e) => { msgData.content = e.target.result; await addDoc(msgCol, msgData); r(); });
      } else {
        await addDoc(msgCol, msgData);
      }
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeChatId), { lastMessage: { content: type === "text" ? content : `[${type}]`, senderId: user.uid }, updatedAt: serverTimestamp() });
      setText(""); setPlusMenuOpen(false); setStickerMenuOpen(false);
    } catch (e) { showNotification("送信失敗"); } finally { setIsUploading(false); }
  };

  return (
    <div className="flex flex-col h-full bg-[#8fb2c9]">
      <div className="p-3 bg-white/95 backdrop-blur border-b flex items-center gap-3 sticky top-0 z-10">
        <ChevronLeft className="cursor-pointer" onClick={() => setView("home")} />
        <img src={icon} className="w-10 h-10 rounded-xl object-cover border" />
        <div className="font-bold text-sm flex-1 truncate">{title}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((m) => (
          <MessageItem key={m.id} m={m} user={user} sender={allUsers.find(u => u.uid === m.senderId)} isGroup={isGroup} db={db} appId={appId} chatId={activeChatId} addFriendById={addFriendById} onDelete={(id) => deleteDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeChatId, "messages", id))} onReply={setReplyTo} allUsers={allUsers} onStickerClick={() => setView("sticker-store")} />
        ))}
        <div ref={scrollRef} />
      </div>
      <div className="p-3 bg-white border-t flex flex-col gap-2 relative z-10">
        {stickerMenuOpen && (
          <div className="absolute bottom-full left-0 right-0 bg-gray-50 border-t h-72 flex flex-col shadow-2xl z-20">
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-4 gap-4">
              {myStickerPacks.find(p => p.id === selectedPackId)?.stickers.map((s, i) => (
                <img key={i} src={s.image || s} className="w-full aspect-square object-contain cursor-pointer" onClick={() => sendMessage(s.image || s, "sticker", { packId: selectedPackId })} />
              ))}
            </div>
            <div className="bg-white border-t flex overflow-x-auto p-2 gap-2">
              {myStickerPacks.map(p => <img key={p.id} src={p.stickers[0].image || p.stickers[0]} className={`w-8 h-8 object-contain cursor-pointer ${selectedPackId === p.id ? "bg-gray-200" : ""}`} onClick={() => setSelectedPackId(p.id)} />)}
            </div>
          </div>
        )}
        {replyTo && <div className="flex items-center justify-between bg-gray-100 p-2 rounded-xl text-xs mb-1"><span>{allUsers.find(u => u.uid === replyTo.senderId)?.name} への返信</span><X className="w-3 h-3 cursor-pointer" onClick={() => setReplyTo(null)} /></div>}
        <div className="flex items-center gap-2">
          <button onClick={() => setPlusMenuOpen(!plusMenuOpen)} className={plusMenuOpen ? "rotate-45" : ""}><Plus className="text-gray-400" /></button>
          <input className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 text-sm focus:outline-none" placeholder="メッセージ..." value={text} onChange={(e) => setText(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage(text)} />
          <button onClick={() => setStickerMenuOpen(!stickerMenuOpen)}><Smile className="text-gray-400" /></button>
          <button onClick={() => sendMessage(text)} disabled={!text && !isUploading} className="text-green-500">{isUploading ? <Loader2 className="animate-spin" /> : <Send />}</button>
        </div>
      </div>
      {plusMenuOpen && (
        <div className="absolute bottom-16 left-4 right-4 bg-white rounded-3xl p-4 shadow-2xl grid grid-cols-4 gap-4 animate-in slide-in-from-bottom-4 z-20">
          <label className="flex flex-col items-center gap-1 cursor-pointer"><div className="p-3 bg-green-50 rounded-2xl"><ImageIcon className="text-green-500" /></div><span className="text-[10px]">画像</span><input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, (d, t, f) => sendMessage(d, t, {}, f))} /></label>
          <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setContactModalOpen(true)}><div className="p-3 bg-yellow-50 rounded-2xl"><Contact className="text-yellow-500" /></div><span className="text-[10px]">連絡先</span></div>
          <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setCardModalOpen(true)}><div className="p-3 bg-pink-50 rounded-2xl"><Gift className="text-pink-500" /></div><span className="text-[10px]">カード</span></div>
        </div>
      )}
      {contactModalOpen && <ContactSelectModal onClose={() => setContactModalOpen(false)} onSend={(c) => sendMessage("", "contact", { contactId: c.uid, contactName: c.name, contactAvatar: c.avatar })} friends={allUsers.filter(u => profile?.friends?.includes(u.uid))} />}
      {cardModalOpen && <BirthdayCardModal onClose={() => setCardModalOpen(false)} onSend={({ color, message }) => sendMessage(`🎂 バースデーカード:\n${message}`, "text")} toName={title} />}
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
      <div className="flex-1 overflow-y-auto pb-20">
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
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setStream(s); if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); requestAnimationFrame(tick); }
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
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b flex justify-between items-center bg-white shrink-0">
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
    onSnapshot(collection(db, "artifacts", appId, "public", "data", "users"), (s) => setAllUsers(s.docs.map(d => d.data())));
    onSnapshot(query(collection(db, "artifacts", appId, "public", "data", "chats"), where("participants", "array-contains", user.uid)), (s) => setChats(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    onSnapshot(query(collection(db, "artifacts", appId, "public", "data", "posts"), orderBy("createdAt", "desc"), limit(50)), (s) => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
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
    <div className="max-w-md mx-auto h-[100dvh] border-x bg-white flex flex-col relative overflow-hidden shadow-2xl font-sans">
      {notification && <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[300] bg-black/85 text-white px-6 py-2 rounded-full text-xs font-bold">{notification}</div>}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {!user ? <AuthView onLogin={setUser} showNotification={showNotification} /> : (
          <>
            {view === "home" && <HomeView user={user} profile={profile} allUsers={allUsers} chats={chats} setView={setView} setActiveChatId={setActiveChatId} setSearchModalOpen={setSearchModalOpen} startChatWithUser={async (tid) => { const ex = chats.find(c => !c.isGroup && c.participants.includes(tid)); if (ex) { setActiveChatId(ex.id); setView("chatroom"); } else { const r = await addDoc(collection(db, "artifacts", appId, "public", "data", "chats"), { participants: [user.uid, tid], isGroup: false, createdAt: serverTimestamp(), lastMessage: { content: "トークを開始しました" } }); setActiveChatId(r.id); setView("chatroom"); } }} />}
            {view === "chatroom" && <ChatRoomView user={user} profile={profile} allUsers={allUsers} chats={chats} activeChatId={activeChatId} setActiveChatId={setActiveChatId} setView={setView} db={db} appId={appId} mutedChats={mutedChats} toggleMuteChat={(id) => setMutedChats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} showNotification={showNotification} addFriendById={addFriendById} />}
            {view === "voom" && <VoomView user={user} allUsers={allUsers} profile={profile} posts={posts} showNotification={showNotification} db={db} appId={appId} />}
            {view === "profile" && <ProfileEditView user={user} profile={profile} setView={setView} showNotification={showNotification} copyToClipboard={(t) => { navigator.clipboard.writeText(t); showNotification("コピーしました"); }} />}
            {view === "qr" && <QRScannerView user={user} setView={setView} addFriendById={addFriendById} />}
          </>
        )}
      </div>
      {user && ["home", "voom"].includes(view) && (
        <div className="h-20 bg-white border-t flex items-center justify-around z-50 pb-4 shrink-0">
          <div className={`flex flex-col items-center gap-1 cursor-pointer ${view === "home" ? "text-green-500" : "text-gray-400"}`} onClick={() => setView("home")}><Home className="w-6 h-6" /><span className="text-[10px] font-bold">ホーム</span></div>
          <div className={`flex flex-col items-center gap-1 cursor-pointer ${view === "voom" ? "text-green-500" : "text-gray-400"}`} onClick={() => setView("voom")}><LayoutGrid className="w-6 h-6" /><span className="text-[10px] font-bold">VOOM</span></div>
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
