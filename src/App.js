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
  signInWithCustomToken,
  onAuthStateChanged,
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
} from "lucide-react";
const JSQR_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAGd-_Gg6yMwcKv6lvjC3r8_4LL0-tJn10",
  authDomain: "chat-app-c17bf.firebaseapp.com",
  projectId: "chat-app-c17bf",
  storageBucket: "chat-app-c17bf.firebasestorage.app",
  messagingSenderId: "1063497801308",
  appId: "1:1063497801308:web:8040959804832a690a1099",
};
// --- ここに下の1行を追加します ---
const appId = firebaseConfig.appId;
// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // ← これが「auth」の正体です！
const db = getFirestore(app);
// Initialize Firebase
// Firestoreの1MB制限を回避しつつ、Base64の境界(3byte)に合わせるため3の倍数に設定
// 700KBに近い3の倍数: 716799 bytes
const CHUNK_SIZE = 716799;

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

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

// 画像の送信前圧縮処理
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
              if (blob.size > file.size) {
                resolve(file);
              } else {
                const newFile = new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(newFile);
              }
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

  // ファイル選択後にinputの値をクリアして、選択状態（マーク）をリセットする
  e.target.value = "";

  let file = originalFile;
  // 画像の場合のみ圧縮を試みる
  if (
    originalFile.type.startsWith("image") &&
    originalFile.type !== "image/gif"
  ) {
    file = await processFileBeforeUpload(originalFile);
  }

  // タイプ判定を拡張
  let type = "file";
  if (file.type.startsWith("image")) type = "image";
  else if (file.type.startsWith("video")) type = "video";
  else if (file.type.startsWith("audio")) type = "audio";

  // ファイルサイズが大きい、または特定のタイプはBlob URLを使用
  if (file.size > 1024 * 1024 || type === "video" || type === "file") {
    const objectUrl = URL.createObjectURL(file);
    callback(objectUrl, type, file);
  } else {
    const reader = new FileReader();
    reader.onload = (event) => {
      callback(event.target.result, type, file);
    };
    reader.readAsDataURL(file);
  }
};

const handleCompressedUpload = (e, callback) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image")) return;

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

const ContactSelectModal = ({ onClose, onSend, friends }) => (
  <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col max-h-[70vh]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">連絡先を選択</h3>
        <button onClick={onClose}>
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {friends.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            友だちがいません
          </div>
        ) : (
          friends.map((f) => (
            <div
              key={f.uid}
              onClick={() => onSend(f)}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer border border-transparent hover:border-gray-100 transition-all"
            >
              <img
                src={f.avatar}
                className="w-10 h-10 rounded-xl object-cover border"
              />
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
  const [color, setColor] = useState("pink"),
    [message, setMessage] = useState("");
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
          <button onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="mb-4 flex gap-3">
          {colors.map((c) => (
            <button
              key={c.id}
              onClick={() => setColor(c.id)}
              className={`w-10 h-10 rounded-full border-2 ${c.class} ${
                color === c.id ? "scale-125 ring-2 ring-gray-300" : ""
              }`}
            />
          ))}
        </div>
        <div
          className={`p-4 rounded-2xl border-2 mb-4 ${
            colors.find((c) => c.id === color).class
          }`}
        >
          <div className="font-bold text-gray-700 mb-2">To: {toName}</div>
          <textarea
            className="w-full bg-white/50 rounded-xl p-3 text-sm focus:outline-none min-h-[100px]"
            placeholder="メッセージ..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <button
          onClick={() => onSend({ color, message })}
          disabled={!message.trim()}
          className="w-full bg-pink-500 text-white font-bold py-3 rounded-2xl shadow-lg"
        >
          送信する
        </button>
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

  const toggle = (uid) => {
    setSelected((prev) =>
      prev.includes(uid) ? prev.filter((i) => i !== uid) : [...prev, uid]
    );
  };

  const handleInvite = async () => {
    if (selected.length === 0) return;
    try {
      const addedNames = [];
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "chats", chatId),
        {
          participants: arrayUnion(...selected),
        }
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
  showNotification,
  user,
  profile,
}) => {
  const [name, setName] = useState(currentName);
  const [icon, setIcon] = useState(currentIcon);

  const handleUpdate = async () => {
    if (!name.trim()) return showNotification("グループ名を入力してください");
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "chats", chatId),
        {
          name: name,
          icon: icon,
          updatedAt: serverTimestamp(),
        }
      );
      // 変更があればシステムメッセージを送信
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
      console.error(e);
      showNotification("更新に失敗しました");
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h3 className="font-bold text-lg">グループ設定</h3>
          <button onClick={onClose}>
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-6 mb-6">
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

        <button
          onClick={handleUpdate}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-2xl shadow-lg transition-all"
        >
          保存する
        </button>
      </div>
    </div>
  );
};

const LeaveGroupConfirmModal = ({ onClose, onLeave }) => {
  return (
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
            <br />
            本当に退会してもよろしいですか？
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
};

const IncomingCallOverlay = ({ callData, onAccept, onDecline, allUsers }) => {
  const caller = allUsers.find((u) => u.uid === callData.callerId);
  return (
    <div className="fixed inset-0 z-[500] bg-gray-900 flex flex-col items-center justify-between py-16 px-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src={
            caller?.avatar ||
            "https://api.dicebear.com/7.x/avataaars/svg?seed=caller"
          }
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
          <div className="absolute inset-0 rounded-full bg-white/10 animate-[ping_3s_ease-in-out_infinite_delay-500ms]"></div>
          <img
            src={
              caller?.avatar ||
              "https://api.dicebear.com/7.x/avataaars/svg?seed=caller"
            }
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
          <span className="text-white text-sm font-bold shadow-black drop-shadow-md">
            拒否
          </span>
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
          <span className="text-white text-sm font-bold shadow-black drop-shadow-md">
            応答
          </span>
        </button>
      </div>
    </div>
  );
};

const OutgoingCallOverlay = ({ callData, onCancel, allUsers }) => {
  return (
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
};

// 相手が応答したときに表示するオーバーレイ（ポップアップブロック回避のため）
const CallAcceptedOverlay = ({ callData, onJoin }) => {
  return (
    <div className="fixed inset-0 z-[500] bg-gray-900/90 flex flex-col items-center justify-center px-6 animate-in fade-in duration-300 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-white/20">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <Video className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          相手が応答しました
        </h2>
        <p className="text-gray-500 mb-8 text-sm">
          下のボタンを押して通話を開始してください
        </p>
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
};

const MessageItem = React.memo(
  ({
    m,
    user,
    sender,
    isGroup,
    db,
    appId,
    chatId,
    addFriendById,
    onEdit,
    onDelete,
    onPreview,
    onReply,
    onReaction,
    allUsers,
  }) => {
    const isMe = m.senderId === user.uid;
    const [mediaSrc, setMediaSrc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const isInvalidBlob = !isMe && m.content?.startsWith("blob:");

    // Blob URLを生成してセットする処理
    const setBlobSrcFromBase64 = (base64Data, mimeType) => {
      try {
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const url = URL.createObjectURL(blob);
        setMediaSrc(url);
      } catch (e) {
        console.error("Blob creation failed", e);
      }
    };

    useEffect(() => {
      // 自分が送信した直後のblobURLはそのまま使う
      if (isMe && m.content?.startsWith("blob:")) {
        setMediaSrc(m.content);
        return;
      }

      // クリーンアップ関数
      return () => {
        if (mediaSrc && mediaSrc.startsWith("blob:") && !isMe) {
          URL.revokeObjectURL(mediaSrc);
        }
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
            // 高速化: chunkCountがある場合は並列ダウンロードを行う
            if (m.chunkCount) {
              const chunkPromises = [];
              for (let i = 0; i < m.chunkCount; i++) {
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
              }
              const chunkDocs = await Promise.all(chunkPromises);
              chunkDocs.forEach((d) => {
                if (d.exists()) base64Data += d.data().data;
              });
            } else {
              // 旧データ互換
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
              // MIMEタイプの決定
              let mimeType = m.mimeType;
              if (!mimeType) {
                if (m.type === "video") mimeType = "video/mp4";
                else if (m.type === "image") mimeType = "image/jpeg";
                else if (m.type === "audio") mimeType = "audio/webm";
                else mimeType = "application/octet-stream";
              }

              if (m.type === "text" || m.type === "contact") {
                // テキスト系は何もしない
              } else {
                setBlobSrcFromBase64(base64Data, mimeType);
              }
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
        // チャンクがない場合（小さいファイルなど）
        // m.contentがData URLならそのまま、そうでないなら（古いデータ等）対応が必要だが
        // 基本的にData URLかBlob URLが入っている想定
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
        let dataUrl = mediaSrc; // すでに生成済みのBlob URLがあればそれを使う

        if (!dataUrl && m.hasChunks) {
          // まだロードされていない場合はロードしてBlobを作る
          let base64Data = "";
          if (m.chunkCount) {
            const chunkPromises = [];
            for (let i = 0; i < m.chunkCount; i++) {
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
            }
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
            const mimeType = m.mimeType || "application/octet-stream";
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
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
          // 一時的に生成したURLならrevokeが必要だが、複雑になるためここではブラウザのGCに任せるか、mediaSrcを使う
        }
      } catch (e) {
        console.error("Download failed", e);
      } finally {
        setLoading(false);
      }
    };

    const readCount = (m.readBy?.length || 1) - 1;
    const finalSrc = mediaSrc || m.preview;
    const isShowingPreview = loading || isInvalidBlob || finalSrc === m.preview;
    const shouldRenderAsVideo =
      m.type === "video" &&
      !isShowingPreview &&
      finalSrc &&
      !finalSrc.startsWith("blob:") &&
      !m.content?.startsWith("blob:"); // blob:の場合は即座に表示

    const handleBubbleClick = (e) => {
      e.stopPropagation();
      setShowMenu(!showMenu);
    };

    const renderWithLinks = (text) => {
      if (!text) return "";
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = text.split(urlRegex);
      return parts.map((part, i) => {
        if (part.match(urlRegex)) {
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

    return (
      <div
        className={`flex ${
          isMe ? "justify-end" : "justify-start"
        } gap-2 relative group mb-4`}
      >
        {!isMe && (
          <div className="relative mt-1">
            <img
              key={sender?.avatar}
              src={sender?.avatar}
              className="w-8 h-8 rounded-lg object-cover border"
              loading="lazy"
            />
            {isTodayBirthday(sender?.birthday) && (
              <span className="absolute -top-1 -right-1 text-[8px]">🎂</span>
            )}
          </div>
        )}
        <div
          className={`flex flex-col ${
            isMe ? "items-end" : "items-start"
          } max-w-[75%]`}
        >
          {!isMe && isGroup && (
            <div className="text-[10px] text-gray-600 font-bold mb-1 ml-1">
              {sender?.name}
            </div>
          )}

          <div className="relative">
            <div
              onClick={handleBubbleClick}
              className={`p-2 px-3 rounded-2xl text-[13px] shadow-sm relative cursor-pointer ${
                isMe
                  ? "bg-[#7cfc00] rounded-tr-none"
                  : "bg-white rounded-tl-none"
              } ${
                ["image", "video"].includes(m.type)
                  ? "p-0 bg-transparent shadow-none"
                  : ""
              }`}
            >
              {m.replyTo && (
                <div
                  className={`mb-2 p-2 rounded-lg border-l-4 text-xs opacity-70 ${
                    isMe
                      ? "bg-black/5 border-white/50"
                      : "bg-gray-100 border-gray-300"
                  }`}
                >
                  <div className="font-bold text-[10px] mb-0.5">
                    {m.replyTo.senderName}
                  </div>
                  <div className="truncate flex items-center gap-1">
                    {m.replyTo.type === "image" && (
                      <ImageIcon className="w-3 h-3" />
                    )}
                    {m.replyTo.type === "video" && (
                      <Video className="w-3 h-3" />
                    )}
                    {["image", "video"].includes(m.replyTo.type)
                      ? m.replyTo.type === "image"
                        ? "[画像]"
                        : "[動画]"
                      : m.replyTo.content || "[メッセージ]"}
                  </div>
                </div>
              )}

              {m.type === "text" && (
                <div className="whitespace-pre-wrap">
                  {renderWithLinks(m.content)}
                  {m.isEdited && (
                    <div className="text-[9px] text-black/40 text-right mt-1 font-bold">
                      (編集済)
                    </div>
                  )}
                </div>
              )}

              {(m.type === "image" || m.type === "video") && (
                <div className="relative">
                  {isShowingPreview && !finalSrc ? (
                    <div className="p-4 bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 min-w-[150px] min-h-[100px] border border-gray-200">
                      <Loader2 className="animate-spin w-8 h-8 text-green-500" />
                      <span className="text-[10px] text-gray-500 font-bold">
                        {m.type === "video"
                          ? "動画を受信中..."
                          : "画像を受信中..."}
                      </span>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* videoタグで再生するためには、finalSrcが有効なBlob URLである必要がある */}
                      {m.type === "video" ? (
                        <video
                          src={finalSrc}
                          className={`max-w-full rounded-xl border border-white/50 shadow-md bg-black ${
                            showMenu ? "brightness-50 transition-all" : ""
                          }`}
                          controls
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={finalSrc}
                          className={`max-w-full rounded-xl border border-white/50 shadow-md ${
                            showMenu ? "brightness-50 transition-all" : ""
                          } ${isShowingPreview ? "opacity-80 blur-[1px]" : ""}`}
                          loading="lazy"
                        />
                      )}
                      {m.type === "video" && !isShowingPreview && !finalSrc && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                          <div className="bg-black/30 rounded-full p-2 backdrop-blur-sm">
                            <Play className="w-8 h-8 text-white fill-white opacity-90" />
                          </div>
                        </div>
                      )}
                      {isShowingPreview && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />{" "}
                          {isInvalidBlob ? "送信中..." : "受信中..."}
                        </div>
                      )}
                    </div>
                  )}
                  {isMe && m.isUploading && (
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                      送信中...
                    </div>
                  )}
                </div>
              )}

              {m.type === "audio" && (
                <div className="flex items-center gap-2 py-1 px-1">
                  {loading ? (
                    <Loader2 className="animate-spin w-4 h-4 text-gray-400" />
                  ) : (
                    <audio
                      src={mediaSrc}
                      controls
                      className="h-8 max-w-[200px]"
                    />
                  )}
                </div>
              )}

              {m.type === "file" && (
                <div className="flex items-center gap-3 p-2 min-w-[200px]">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 border">
                    <FileText className="w-6 h-6 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">
                      {m.fileName || "不明なファイル"}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {m.fileSize
                        ? `${(m.fileSize / 1024).toFixed(1)} KB`
                        : "サイズ不明"}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload();
                    }}
                    className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                    ) : (
                      <Download className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>
              )}

              {m.type === "contact" && (
                <div className="flex flex-col gap-2 min-w-[150px] p-1">
                  <div className="text-[10px] font-bold text-gray-400 mb-1 border-b border-gray-100 pb-1">
                    連絡先
                  </div>
                  <div className="flex items-center gap-3">
                    <img
                      src={m.contactAvatar}
                      className="w-10 h-10 rounded-full border shadow-sm"
                      loading="lazy"
                    />
                    <span className="font-bold text-sm truncate">
                      {m.contactName}
                    </span>
                  </div>
                  {!isMe && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addFriendById(m.contactId);
                      }}
                      className="bg-black/5 hover:bg-black/10 text-xs font-bold py-2 rounded-xl mt-1 w-full flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-3 h-3" /> 友だち追加
                    </button>
                  )}
                </div>
              )}

              <div className="text-[8px] opacity-50 mt-1 text-right">
                {formatDateTime(m.createdAt)}
              </div>

              {showMenu && (
                <div
                  className={`absolute top-full ${
                    isMe ? "right-0" : "left-0"
                  } mt-1 z-[100] flex flex-col bg-white rounded-xl shadow-2xl border overflow-hidden min-w-[180px] animate-in slide-in-from-top-2 duration-200`}
                >
                  <div className="flex justify-between items-center p-2 bg-gray-50 border-b gap-1 overflow-x-auto scrollbar-hide">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={(e) => {
                          e.stopPropagation();
                          onReaction(m.id, emoji);
                          setShowMenu(false);
                        }}
                        className="hover:scale-125 transition-transform text-lg p-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReply(m);
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left"
                  >
                    <Reply className="w-4 h-4" />
                    リプライ
                  </button>

                  {(m.type === "image" || m.type === "video") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreview(finalSrc, m.type);
                        setShowMenu(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"
                    >
                      <Maximize className="w-4 h-4" />
                      拡大表示
                    </button>
                  )}
                  {m.type === "file" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload();
                        setShowMenu(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"
                    >
                      <Download className="w-4 h-4" />
                      保存
                    </button>
                  )}

                  {m.type === "text" && isMe && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(m.id, m.content);
                        setShowMenu(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"
                    >
                      <Edit2 className="w-4 h-4" />
                      編集
                    </button>
                  )}
                  {isMe && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(m.id);
                        setShowMenu(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 text-xs font-bold text-red-500 text-left border-t border-gray-100"
                    >
                      <Trash2 className="w-4 h-4" />
                      送信取消
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {m.reactions &&
            Object.keys(m.reactions).some(
              (k) => m.reactions[k]?.length > 0
            ) && (
              <div
                className={`flex flex-wrap gap-1 mt-1 ${
                  isMe ? "justify-end" : "justify-start"
                }`}
              >
                {Object.entries(m.reactions).map(
                  ([emoji, uids]) =>
                    uids?.length > 0 && (
                      <button
                        key={emoji}
                        onClick={() => onReaction(m.id, emoji)}
                        title={getUserNames(uids)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs shadow-sm border transition-all hover:scale-105 active:scale-95 ${
                          uids.includes(user.uid)
                            ? "bg-white border-green-500 text-green-600 ring-1 ring-green-100"
                            : "bg-white border-gray-100 text-gray-600"
                        }`}
                      >
                        <span className="text-sm">{emoji}</span>
                        <span className="font-bold text-[10px]">
                          {uids.length}
                        </span>
                      </button>
                    )
                )}
              </div>
            )}

          {isMe && readCount > 0 && (
            <div className="text-[10px] font-bold text-green-600 mt-0.5">
              既読 {isGroup ? readCount : ""}
            </div>
          )}
        </div>
      </div>
    );
  }
);

const PostItem = ({ post, user, allUsers, db, appId, profile }) => {
  const [commentText, setCommentText] = useState(""),
    [mediaSrc, setMediaSrc] = useState(post.media),
    [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const u = allUsers.find((x) => x.uid === post.userId),
    isLiked = post.likes?.includes(user?.uid);

  useEffect(() => {
    if (post.hasChunks && !mediaSrc) {
      setIsLoadingMedia(true);
      (async () => {
        let base64Data = "";
        if (post.chunkCount) {
          const chunkPromises = [];
          for (let i = 0; i < post.chunkCount; i++) {
            chunkPromises.push(
              getDoc(
                doc(
                  db,
                  "artifacts",
                  appId,
                  "public",
                  "data",
                  "posts",
                  post.id,
                  "chunks",
                  `${i}`
                )
              )
            );
          }
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
                "posts",
                post.id,
                "chunks"
              ),
              orderBy("index", "asc")
            )
          );
          snap.forEach((d) => (base64Data += d.data().data));
        }

        if (base64Data) {
          try {
            const mimeType =
              post.mimeType ||
              (post.mediaType === "video" ? "video/mp4" : "image/jpeg");
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            const url = URL.createObjectURL(blob);
            setMediaSrc(url);
          } catch (e) {
            console.error("Post media load error", e);
          }
        }
        setIsLoadingMedia(false);
      })();
    }
  }, [post.id, post.chunkCount]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (mediaSrc && mediaSrc.startsWith("blob:")) {
        URL.revokeObjectURL(mediaSrc);
      }
    };
  }, [mediaSrc]);

  const toggleLike = async () =>
    await updateDoc(
      doc(db, "artifacts", appId, "public", "data", "posts", post.id),
      { likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) }
    );
  const submitComment = async () => {
    if (!commentText.trim()) return;
    await updateDoc(
      doc(db, "artifacts", appId, "public", "data", "posts", post.id),
      {
        comments: arrayUnion({
          userId: user.uid,
          userName: profile.name,
          text: commentText,
          createdAt: new Date().toISOString(),
        }),
      }
    );
    setCommentText("");
  };
  return (
    <div className="bg-white p-4 mb-2 border-b">
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <img
            key={u?.avatar}
            src={u?.avatar}
            className="w-10 h-10 rounded-xl border"
            loading="lazy"
          />
          {isTodayBirthday(u?.birthday) && (
            <span className="absolute -top-1 -right-1 text-xs">🎂</span>
          )}
        </div>
        <div className="font-bold text-sm">{u?.name}</div>
      </div>
      <div className="text-sm mb-3 whitespace-pre-wrap">{post.content}</div>
      {(mediaSrc || isLoadingMedia) && (
        <div className="mb-3 bg-gray-50 rounded-2xl flex items-center justify-center min-h-[100px]">
          {isLoadingMedia ? (
            <Loader2 className="animate-spin w-5 h-5" />
          ) : post.mediaType === "video" ? (
            <video
              src={mediaSrc}
              className="w-full rounded-2xl max-h-96 bg-black"
              controls
              playsInline
            />
          ) : (
            <img
              src={mediaSrc}
              className="w-full rounded-2xl max-h-96 object-cover"
              loading="lazy"
            />
          )}
        </div>
      )}
      <div className="flex items-center gap-6 py-2 border-y mb-3">
        <button onClick={toggleLike} className="flex items-center gap-1.5">
          <Heart
            className={`w-5 h-5 ${
              isLiked ? "fill-red-500 text-red-500" : "text-gray-400"
            }`}
          />
          <span className="text-xs">{post.likes?.length || 0}</span>
        </button>
        <div className="flex items-center gap-1.5 text-gray-400">
          <MessageCircle className="w-5 h-5" />
          <span className="text-xs">{post.comments?.length || 0}</span>
        </div>
      </div>
      <div className="space-y-3 mb-4">
        {post.comments?.map((c, i) => (
          <div key={i} className="bg-gray-50 rounded-2xl px-3 py-2">
            <div className="text-[10px] font-bold text-gray-500">
              {c.userName}
            </div>
            <div className="text-xs">{c.text}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1">
        <input
          className="flex-1 bg-transparent text-xs py-2 outline-none"
          placeholder="コメント..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && submitComment()}
        />
        <button onClick={submitComment} className="text-green-500">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const GroupCreateView = ({
  user,
  profile,
  allUsers,
  setView,
  showNotification,
}) => {
  const [groupName, setGroupName] = useState("");
  const [groupIcon, setGroupIcon] = useState(
    "https://api.dicebear.com/7.x/shapes/svg?seed=group"
  );
  const [selectedMembers, setSelectedMembers] = useState([]);
  const friendsList = allUsers.filter((u) => profile?.friends?.includes(u.uid));
  const toggleMember = (uid) => {
    setSelectedMembers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };
  const handleCreate = async () => {
    if (!groupName.trim())
      return showNotification("グループ名を入力してください");
    if (selectedMembers.length === 0)
      return showNotification("メンバーを選択してください");
    const participants = [user.uid, ...selectedMembers];
    const newGroupChat = {
      name: groupName,
      icon: groupIcon,
      participants,
      isGroup: true,
      createdBy: user.uid,
      updatedAt: serverTimestamp(),
      lastMessage: { content: "グループを作成しました", senderId: user.uid },
    };
    try {
      const chatRef = await addDoc(
        collection(db, "artifacts", appId, "public", "data", "chats"),
        newGroupChat
      );
      await addDoc(
        collection(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "chats",
          chatRef.id,
          "messages"
        ),
        {
          senderId: user.uid,
          content: `${profile.name}がグループを作成しました。`,
          type: "text",
          createdAt: serverTimestamp(),
          readBy: [user.uid],
        }
      );
      showNotification("グループを作成しました");
      setView("home");
    } catch (err) {
      showNotification("作成に失敗しました");
    }
  };
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 flex items-center gap-4 bg-white border-b sticky top-0 z-10">
        <ChevronLeft
          className="w-6 h-6 cursor-pointer"
          onClick={() => setView("home")}
        />
        <span className="font-bold flex-1">グループ作成</span>
        <button
          onClick={handleCreate}
          className="text-green-500 font-bold text-sm"
        >
          作成
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <img
              src={groupIcon}
              className="w-24 h-24 rounded-3xl object-cover bg-gray-100 border shadow-sm"
            />
            <label className="absolute bottom-0 right-0 bg-green-500 p-2 rounded-full text-white cursor-pointer shadow-lg border-2 border-white">
              <CameraIcon className="w-4 h-4" />
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) =>
                  handleCompressedUpload(e, (d) => setGroupIcon(d))
                }
              />
            </label>
          </div>
          <input
            className="w-full text-center text-lg font-bold border-b py-2 focus:outline-none focus:border-green-500"
            placeholder="グループ名を入力"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
            友だちを選択
          </h3>
          <div className="divide-y border-y">
            {friendsList.map((f) => (
              <div
                key={f.uid}
                className="flex items-center gap-4 py-3 cursor-pointer"
                onClick={() => toggleMember(f.uid)}
              >
                <div className="relative">
                  <img
                    src={f.avatar}
                    className="w-10 h-10 rounded-xl object-cover border"
                  />
                </div>
                <span className="flex-1 font-bold text-sm">{f.name}</span>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedMembers.includes(f.uid)
                      ? "bg-green-500 border-green-500"
                      : "border-gray-200"
                  }`}
                >
                  {selectedMembers.includes(f.uid) && (
                    <Check className="w-4 h-4 text-white" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const BirthdayCardBox = ({ user, setView }) => {
  /* ... existing code ... */
  const [myCards, setMyCards] = useState([]);
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "artifacts", appId, "public", "data", "birthday_cards"),
      where("toUserId", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const cards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cards.sort(
        (a, b) =>
          (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0) -
          (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0)
      );
      setMyCards(cards);
    });
    return () => unsub();
  }, [user]);
  const getColorClass = (color) => {
    switch (color) {
      case "pink":
        return "bg-pink-100 border-pink-200 text-pink-800";
      case "blue":
        return "bg-blue-100 border-blue-200 text-blue-800";
      case "yellow":
        return "bg-yellow-100 border-yellow-200 text-yellow-800";
      case "green":
        return "bg-green-100 border-green-200 text-green-800";
      default:
        return "bg-white border-gray-200";
    }
  };
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b flex items-center gap-4 sticky top-0 bg-white z-10 shrink-0">
        <ChevronLeft
          className="w-6 h-6 cursor-pointer"
          onClick={() => setView("home")}
        />
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Gift className="w-6 h-6 text-pink-500" /> カードBOX
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-gray-50">
        {myCards.length === 0 ? (
          <div className="text-center py-20 text-gray-400 font-bold">
            カードはまだありません
          </div>
        ) : (
          myCards.map((card) => (
            <div
              key={card.id}
              className={`p-6 rounded-3xl border-2 shadow-sm relative ${getColorClass(
                card.color
              )}`}
            >
              <div className="absolute top-4 right-4 text-4xl opacity-50">
                🎂
              </div>
              <div className="font-bold text-lg mb-2">Happy Birthday!</div>
              <div className="whitespace-pre-wrap text-sm font-medium mb-4">
                {card.message}
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-black/10">
                <div className="text-xs font-bold opacity-70">
                  From: {card.fromName}
                </div>
                <div className="text-[10px] opacity-60">
                  {formatDate(card.createdAt)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ChatRoomView = ({
  user,
  profile,
  allUsers,
  chats,
  activeChatId,
  setActiveChatId,
  setView,
  db,
  appId,
  mutedChats,
  toggleMuteChat,
  showNotification,
  addFriendById,
}) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [groupEditModalOpen, setGroupEditModalOpen] = useState(false);
  const [backgroundMenuOpen, setBackgroundMenuOpen] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [replyTo, setReplyTo] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const scrollRef = useRef();
  const isFirstLoad = useRef(true);
  const [messageLimit, setMessageLimit] = useState(50);
  const lastMessageIdRef = useRef(null);
  const [backgroundSrc, setBackgroundSrc] = useState(null);

  const chatData = chats.find((c) => c.id === activeChatId);
  if (!chatData)
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );

  const isGroup = chatData.isGroup;
  let title = chatData.name;
  let icon = chatData.icon;
  let partnerId = null;
  let partnerData = null;

  if (!isGroup) {
    partnerId = chatData.participants.find((p) => p !== user.uid);
    if (!partnerId) partnerId = user.uid;
    partnerData = allUsers.find((u) => u.uid === partnerId);
    if (partnerData) {
      title = partnerData.name;
      icon = partnerData.avatar;
    }
  }

  useEffect(() => {
    isFirstLoad.current = true;
  }, [activeChatId]);
  useEffect(() => {
    if (!activeChatId) return;
    const q = query(
      collection(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "chats",
        activeChatId,
        "messages"
      ),
      orderBy("createdAt", "asc"),
      limitToLast(messageLimit)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [activeChatId, messageLimit]);
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (
        lastMsg.senderId !== user.uid &&
        !lastMsg.readBy?.includes(user.uid) &&
        !mutedChats.includes(activeChatId)
      )
        playNotificationSound();
    }
  }, [messages.length]);
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain1.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.1);
    } catch (e) {}
  };
  useEffect(() => {
    if (!activeChatId || !messages.length) return;
    messages
      .filter((m) => m.senderId !== user.uid && !m.readBy?.includes(user.uid))
      .forEach(async (m) => {
        await updateDoc(
          doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "chats",
            activeChatId,
            "messages",
            m.id
          ),
          { readBy: arrayUnion(user.uid) }
        );
      });
  }, [messages.length]);
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (isFirstLoad.current || lastMsg?.id !== lastMessageIdRef.current) {
        scrollRef.current?.scrollIntoView({ behavior: "auto" });
        lastMessageIdRef.current = lastMsg?.id;
      }
      isFirstLoad.current = false;
    }
  }, [messages]);
  useEffect(() => {
    if (!chatData) return;
    const loadBackground = async () => {
      if (chatData.hasBackgroundChunks) {
        try {
          const chunksSnap = await getDocs(
            query(
              collection(
                db,
                "artifacts",
                appId,
                "public",
                "data",
                "chats",
                activeChatId,
                "background_chunks"
              ),
              orderBy("index", "asc")
            )
          );
          let data = "";
          chunksSnap.forEach((d) => (data += d.data().data));
          setBackgroundSrc(data);
        } catch (e) {
          console.error("Failed to load background chunks", e);
        }
      } else if (chatData.backgroundImage) {
        setBackgroundSrc(chatData.backgroundImage);
      } else {
        setBackgroundSrc(null);
      }
    };
    loadBackground();
  }, [
    chatData?.id,
    chatData?.updatedAt,
    chatData?.hasBackgroundChunks,
    chatData?.backgroundImage,
    activeChatId,
  ]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        if (audioChunksRef.current.length === 0) return;
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const audioFile = new File([audioBlob], "voice.webm", {
          type: "audio/webm",
          lastModified: Date.now(),
        });
        sendMessage("", "audio", {}, audioFile);
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      showNotification("マイクの利用を許可してください");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
      audioChunksRef.current = [];
      showNotification("録音をキャンセルしました");
    }
  };

  const sendMessage = async (
    content,
    type = "text",
    additionalData = {},
    file = null
  ) => {
    if ((!content && !file && type === "text") || isUploading) return;
    setIsUploading(true);
    setUploadProgress(0);
    const currentReply = replyTo;
    setReplyTo(null);

    // 同時並列数1000に設定
    const CONCURRENCY = 1000;

    try {
      const msgCol = collection(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "chats",
        activeChatId,
        "messages"
      );
      const newMsgRef = doc(msgCol);
      let localBlobUrl = null;
      let storedContent = content;
      let previewData = null;
      const replyData = currentReply
        ? {
            replyTo: {
              id: currentReply.id,
              content: currentReply.content,
              senderName:
                allUsers.find((u) => u.uid === currentReply.senderId)?.name ||
                "Unknown",
              type: currentReply.type,
            },
          }
        : {};

      // ファイル情報
      const fileData = file
        ? { fileName: file.name, fileSize: file.size, mimeType: file.type }
        : {};

      if (file && ["image", "video", "audio", "file"].includes(type)) {
        localBlobUrl = URL.createObjectURL(file);
        storedContent = localBlobUrl;
        if (["image", "video"].includes(type)) {
          previewData = await generateThumbnail(file);
        }

        // blobURLで即時送信 (楽観的UI更新)
        await setDoc(newMsgRef, {
          senderId: user.uid,
          content: storedContent,
          type,
          preview: previewData,
          ...additionalData,
          ...replyData,
          ...fileData,
          hasChunks: false,
          chunkCount: 0,
          isUploading: true,
          createdAt: serverTimestamp(),
          readBy: [user.uid],
        });
        await updateDoc(
          doc(db, "artifacts", appId, "public", "data", "chats", activeChatId),
          {
            lastMessage: {
              content: type === "text" ? content : `[${type}]`,
              senderId: user.uid,
            },
            updatedAt: serverTimestamp(),
          }
        );
        setText("");
        setPlusMenuOpen(false);
        setContactModalOpen(false);
        setTimeout(() => {
          scrollRef.current?.scrollIntoView({ behavior: "auto" });
        }, 100);
      }

      let hasChunks = false,
        chunkCount = 0;
      if (file && file.size > CHUNK_SIZE) {
        hasChunks = true;
        chunkCount = Math.ceil(file.size / CHUNK_SIZE);
        let completedChunks = 0;
        const executing = new Set();

        for (let i = 0; i < chunkCount; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const blobSlice = file.slice(start, end);
          const p = new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
              try {
                // Base64のヘッダー除去 (data:video/mp4;base64,.... のカンマ以降を取得)
                const base64Data = e.target.result.split(",")[1];
                await setDoc(doc(msgCol, newMsgRef.id, "chunks", `${i}`), {
                  data: base64Data,
                  index: i,
                });
                resolve();
              } catch (err) {
                reject(err);
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blobSlice);
          }).then(() => {
            completedChunks++;
            setUploadProgress(Math.round((completedChunks / chunkCount) * 100));
          });

          const pWrapper = p.then(() => executing.delete(pWrapper));
          executing.add(pWrapper);

          // 並列数制御
          if (executing.size >= CONCURRENCY) await Promise.race(executing);
        }
        await Promise.all(executing);
        await updateDoc(newMsgRef, {
          hasChunks: true,
          chunkCount: chunkCount,
          isUploading: false,
        });
      } else if (!hasChunks) {
        if (localBlobUrl) {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          await new Promise((resolve) => {
            reader.onload = async (e) => {
              await updateDoc(newMsgRef, {
                content: e.target.result,
                isUploading: false,
              });
              resolve();
            };
          });
        } else {
          await setDoc(newMsgRef, {
            senderId: user.uid,
            content: storedContent,
            type,
            ...additionalData,
            ...replyData,
            ...fileData,
            hasChunks,
            chunkCount,
            createdAt: serverTimestamp(),
            readBy: [user.uid],
          });
          await updateDoc(
            doc(
              db,
              "artifacts",
              appId,
              "public",
              "data",
              "chats",
              activeChatId
            ),
            {
              lastMessage: {
                content: type === "text" ? content : `[${type}]`,
                senderId: user.uid,
              },
              updatedAt: serverTimestamp(),
            }
          );
          setText("");
          setPlusMenuOpen(false);
          setContactModalOpen(false);
          setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: "auto" });
          }, 100);
        }
      }
    } catch (e) {
      console.error(e);
      showNotification("送信に失敗しました");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteMessage = useCallback(
    async (msgId) => {
      try {
        await deleteDoc(
          doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "chats",
            activeChatId,
            "messages",
            msgId
          )
        );
        const c = await getDocs(
          collection(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "chats",
            activeChatId,
            "messages",
            msgId,
            "chunks"
          )
        );
        for (const d of c.docs) await deleteDoc(d.ref);
        showNotification("メッセージの送信を取り消しました");
      } catch (e) {
        showNotification("送信取消に失敗しました");
      }
    },
    [db, appId, activeChatId, showNotification]
  );
  const handleEditMessage = useCallback((id, content) => {
    setEditingMsgId(id);
    setEditingText(content);
  }, []);
  const handlePreviewMedia = useCallback((src, type) => {
    setPreviewMedia({ src, type });
  }, []);
  const handleReaction = async (messageId, emoji) => {
    try {
      const msgRef = doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "chats",
        activeChatId,
        "messages",
        messageId
      );
      const msg = messages.find((m) => m.id === messageId);
      const currentReactions = msg.reactions?.[emoji] || [];
      if (currentReactions.includes(user.uid)) {
        await updateDoc(msgRef, {
          [`reactions.${emoji}`]: arrayRemove(user.uid),
        });
      } else {
        await updateDoc(msgRef, {
          [`reactions.${emoji}`]: arrayUnion(user.uid),
        });
      }
    } catch (e) {
      console.error("Reaction error", e);
    }
  };
  const submitEditMessage = async () => {
    if (!editingText.trim() || !editingMsgId) return;
    try {
      await updateDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "chats",
          activeChatId,
          "messages",
          editingMsgId
        ),
        { content: editingText, isEdited: true, updatedAt: serverTimestamp() }
      );
      setEditingMsgId(null);
    } catch (e) {
      showNotification("編集に失敗しました");
    }
  };
  const handleLeaveGroup = async () => {
    /* ... existing ... */ if (!activeChatId) return;
    try {
      await addDoc(
        collection(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "chats",
          activeChatId,
          "messages"
        ),
        {
          senderId: user.uid,
          content: `${profile.name}が退会しました。`,
          type: "text",
          createdAt: serverTimestamp(),
          readBy: [user.uid],
        }
      );
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "chats", activeChatId),
        { participants: arrayRemove(user.uid) }
      );
      showNotification("グループから退会しました");
      setLeaveModalOpen(false);
      setView("home");
      setActiveChatId(null);
    } catch (e) {
      showNotification("退会に失敗しました");
    }
  };
  const handleBackgroundUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target.result;
      try {
        const batch = writeBatch(db);
        const chatRef = doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "chats",
          activeChatId
        );
        const oldChunksSnap = await getDocs(
          collection(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "chats",
            activeChatId,
            "background_chunks"
          )
        );
        oldChunksSnap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        const newBatch = writeBatch(db);
        let hasChunks = false;
        let chunkCount = 0;
        if (result.length > CHUNK_SIZE) {
          hasChunks = true;
          chunkCount = Math.ceil(result.length / CHUNK_SIZE);
          for (let i = 0; i < chunkCount; i++) {
            const chunkRef = doc(
              db,
              "artifacts",
              appId,
              "public",
              "data",
              "chats",
              activeChatId,
              "background_chunks",
              `${i}`
            );
            newBatch.set(chunkRef, {
              data: result.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
              index: i,
            });
          }
          newBatch.update(chatRef, {
            backgroundImage: deleteField(),
            hasBackgroundChunks: true,
            backgroundChunkCount: chunkCount,
            updatedAt: serverTimestamp(),
          });
        } else {
          newBatch.update(chatRef, {
            backgroundImage: result,
            hasBackgroundChunks: false,
            backgroundChunkCount: 0,
            updatedAt: serverTimestamp(),
          });
        }
        await newBatch.commit();
        showNotification("背景を変更しました");
        setBackgroundMenuOpen(false);
      } catch (e) {
        console.error(e);
        showNotification("背景の変更に失敗しました");
      }
    };
    reader.readAsDataURL(file);
  };
  const resetBackground = async () => {
    try {
      const batch = writeBatch(db);
      const chatRef = doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "chats",
        activeChatId
      );
      const chunksSnap = await getDocs(
        collection(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "chats",
          activeChatId,
          "background_chunks"
        )
      );
      chunksSnap.forEach((d) => batch.delete(d.ref));
      batch.update(chatRef, {
        backgroundImage: deleteField(),
        hasBackgroundChunks: deleteField(),
        backgroundChunkCount: deleteField(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      showNotification("背景をリセットしました");
      setBackgroundMenuOpen(false);
    } catch (e) {
      showNotification("リセットに失敗しました");
    }
  };

  // --- Video Call Logic ---
  const handleVideoCall = async () => {
    try {
      const roomName = `ChatApp_V9_${appId}_${activeChatId}_${Date.now()}`;
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "chats", activeChatId),
        {
          callStatus: {
            status: "ringing",
            callerId: user.uid,
            roomName: roomName,
            timestamp: Date.now(),
          },
        }
      );
    } catch (e) {
      showNotification("発信に失敗しました");
    }
  };

  const sendBirthdayCard = async ({ color, message }) => {
    try {
      if (!isGroup && partnerId) {
        await addDoc(
          collection(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "birthday_cards"
          ),
          {
            fromUserId: user.uid,
            fromName: profile.name,
            toUserId: partnerId,
            message: message,
            color: color,
            createdAt: serverTimestamp(),
          }
        );
      }
      await sendMessage(`[バースデーカード] 🎂\n\n${message}`, "text");
      showNotification("カードを送信しました");
      setCardModalOpen(false);
    } catch (e) {
      console.error(e);
      showNotification("送信に失敗しました");
    }
  };

  return (
    <div
      className="flex flex-col h-full relative"
      style={{
        backgroundColor: backgroundSrc ? "transparent" : "#8fb2c9",
        backgroundImage: backgroundSrc ? `url(${backgroundSrc})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="p-3 bg-white/95 backdrop-blur border-b flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <ChevronLeft
          className="w-6 h-6 cursor-pointer"
          onClick={() => setView("home")}
        />
        <div className="relative">
          <img
            key={icon}
            src={icon}
            className="w-10 h-10 rounded-xl object-cover border"
          />
          {!isGroup && partnerData && isTodayBirthday(partnerData.birthday) && (
            <span className="absolute -top-1 -right-1 text-xs">🎂</span>
          )}
        </div>
        <div className="font-bold text-sm flex-1 truncate">
          {title} {isGroup ? `(${chatData.participants.length})` : ""}
        </div>
        <div className="flex gap-4 mr-2 items-center">
          <div className="relative">
            <button
              onClick={() => setBackgroundMenuOpen(!backgroundMenuOpen)}
              className="hover:bg-gray-100 p-1 rounded-full transition-colors"
              title="背景を変更"
            >
              <Palette className="w-6 h-6 text-gray-600" />
            </button>
            {backgroundMenuOpen && (
              <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border overflow-hidden w-40 z-20">
                <label className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm font-bold text-gray-700">
                  <ImageIcon className="w-4 h-4" />
                  <span>画像を選択</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleBackgroundUpload}
                  />
                </label>
                <button
                  onClick={resetBackground}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-red-50 text-sm font-bold text-red-500 border-t"
                >
                  <RefreshCcw className="w-4 h-4" />
                  <span>リセット</span>
                </button>
              </div>
            )}
          </div>
          {isGroup && (
            <>
              <button
                onClick={() => setGroupEditModalOpen(true)}
                className="hover:bg-gray-100 p-1 rounded-full transition-colors"
                title="グループ設定"
              >
                <Settings className="w-6 h-6 text-gray-600" />
              </button>
              <button
                onClick={() => setAddMemberModalOpen(true)}
                className="hover:bg-gray-100 p-1 rounded-full transition-colors"
                title="メンバーを追加"
              >
                <UserPlus className="w-6 h-6 text-gray-600" />
              </button>
              <button
                onClick={() => setLeaveModalOpen(true)}
                className="hover:bg-red-50 p-1 rounded-full transition-colors"
                title="グループを退会"
              >
                <LogOut className="w-6 h-6 text-red-500" />
              </button>
            </>
          )}
          <button
            onClick={handleVideoCall}
            className="hover:bg-gray-100 p-1 rounded-full transition-colors"
            title="ビデオ通話"
          >
            <Video className="w-6 h-6 text-gray-600" />
          </button>
          <button onClick={() => toggleMuteChat(activeChatId)}>
            {mutedChats.includes(activeChatId) ? (
              <BellOff className="w-6 h-6 text-gray-400" />
            ) : (
              <Bell className="w-6 h-6 text-gray-600" />
            )}
          </button>
        </div>
      </div>
      {!isGroup &&
        partnerId &&
        isTodayBirthday(
          allUsers.find((u) => u.uid === partnerId)?.birthday
        ) && (
          <div className="bg-pink-100 p-2 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Cake className="w-5 h-5 text-pink-500 animate-bounce" />
              <span className="text-xs font-bold text-pink-700">
                今日は{title}さんの誕生日です！
              </span>
            </div>
            <button
              onClick={() => setCardModalOpen(true)}
              className="bg-pink-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm"
            >
              カードを書く
            </button>
          </div>
        )}
      <div
        className={`flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide ${
          backgroundSrc ? "bg-white/40 backdrop-blur-sm" : ""
        }`}
      >
        {messages.length >= messageLimit && (
          <div className="flex justify-center py-2">
            <button
              onClick={() => setMessageLimit((prev) => prev + 50)}
              className="bg-white/50 backdrop-blur-md px-4 py-1 rounded-full text-xs font-bold text-gray-700 shadow-sm flex items-center gap-1 hover:bg-white/70"
            >
              <ArrowUpCircle className="w-4 h-4" /> 以前のメッセージを読み込む
            </button>
          </div>
        )}
        {messages.map((m) => {
          const sender = allUsers.find((u) => u.uid === m.senderId);
          return (
            <MessageItem
              key={m.id}
              m={m}
              user={user}
              sender={sender}
              isGroup={isGroup}
              db={db}
              appId={appId}
              chatId={activeChatId}
              addFriendById={addFriendById}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
              onPreview={handlePreviewMedia}
              onReply={setReplyTo}
              onReaction={handleReaction}
              allUsers={allUsers}
            />
          );
        })}
        <div ref={scrollRef} className="h-2 w-full" />
      </div>
      {previewMedia && (
        <div
          className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4"
          onClick={() => setPreviewMedia(null)}
        >
          <button className="absolute top-6 right-6 text-white p-2 rounded-full bg-white/20">
            <X className="w-6 h-6" />
          </button>
          {previewMedia.type === "video" ? (
            <video
              src={previewMedia.src}
              controls
              autoPlay
              className="max-w-full max-h-[85vh] rounded shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={previewMedia.src}
              className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
      {editingMsgId && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-4">
            <h3 className="font-bold mb-2">メッセージを編集</h3>
            <textarea
              className="w-full bg-gray-50 p-2 rounded-xl mb-4 border focus:outline-none"
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setEditingMsgId(null)}
                className="flex-1 py-2 bg-gray-100 rounded-xl font-bold text-gray-600"
              >
                キャンセル
              </button>
              <button
                onClick={submitEditMessage}
                className="flex-1 py-2 bg-green-500 rounded-xl font-bold text-white"
              >
                更新
              </button>
            </div>
          </div>
        </div>
      )}
      {addMemberModalOpen && (
        <GroupAddMemberModal
          onClose={() => setAddMemberModalOpen(false)}
          currentMembers={chatData?.participants || []}
          chatId={activeChatId}
          allUsers={allUsers}
          profile={profile}
          user={user}
          showNotification={showNotification}
        />
      )}
      {groupEditModalOpen && (
        <GroupEditModal
          onClose={() => setGroupEditModalOpen(false)}
          chatId={activeChatId}
          currentName={chatData.name}
          currentIcon={chatData.icon}
          showNotification={showNotification}
          user={user}
          profile={profile}
        />
      )}
      {leaveModalOpen && (
        <LeaveGroupConfirmModal
          onClose={() => setLeaveModalOpen(false)}
          onLeave={handleLeaveGroup}
        />
      )}
      {cardModalOpen && (
        <BirthdayCardModal
          onClose={() => setCardModalOpen(false)}
          onSend={sendBirthdayCard}
          toName={title}
        />
      )}
      {contactModalOpen && (
        <ContactSelectModal
          onClose={() => setContactModalOpen(false)}
          onSend={(c) =>
            sendMessage("", "contact", {
              contactId: c.uid,
              contactName: c.name,
              contactAvatar: c.avatar,
            })
          }
          friends={allUsers.filter((u) =>
            (profile?.friends || []).includes(u.uid)
          )}
        />
      )}
      {plusMenuOpen && (
        <div className="absolute bottom-16 left-4 right-4 bg-white rounded-3xl p-4 shadow-2xl grid grid-cols-4 gap-4 animate-in slide-in-from-bottom-4 z-20">
          <label className="flex flex-col items-center gap-2 cursor-pointer">
            <div className="p-3 bg-green-50 rounded-2xl">
              <ImageIcon className="w-6 h-6 text-green-500" />
            </div>
            <span className="text-[10px] font-bold">画像</span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) =>
                handleFileUpload(e, (d, t, f) => sendMessage(d, t, {}, f))
              }
            />
          </label>
          <label className="flex flex-col items-center gap-2 cursor-pointer">
            <div className="p-3 bg-blue-50 rounded-2xl">
              <Play className="w-6 h-6 text-blue-500" />
            </div>
            <span className="text-[10px] font-bold">動画</span>
            <input
              type="file"
              className="hidden"
              accept="video/*"
              onChange={(e) =>
                handleFileUpload(e, (d, t, f) => sendMessage(d, t, {}, f))
              }
            />
          </label>
          <label className="flex flex-col items-center gap-2 cursor-pointer">
            <div className="p-3 bg-gray-100 rounded-2xl">
              <Paperclip className="w-6 h-6 text-gray-600" />
            </div>
            <span className="text-[10px] font-bold">ファイル</span>
            <input
              type="file"
              className="hidden"
              onChange={(e) =>
                handleFileUpload(e, (d, t, f) => sendMessage(d, t, {}, f))
              }
            />
          </label>
          <div
            className="flex flex-col items-center gap-2 cursor-pointer"
            onClick={() => setContactModalOpen(true)}
          >
            <div className="p-3 bg-yellow-50 rounded-2xl">
              <Contact className="w-6 h-6 text-yellow-500" />
            </div>
            <span className="text-[10px] font-bold">連絡先</span>
          </div>
          <div
            className="flex flex-col items-center gap-2 cursor-pointer"
            onClick={() => setCardModalOpen(true)}
          >
            <div className="p-3 bg-pink-50 rounded-2xl">
              <Gift className="w-6 h-6 text-pink-500" />
            </div>
            <span className="text-[10px] font-bold">カード</span>
          </div>
        </div>
      )}
      <div className="p-3 bg-white border-t flex flex-col gap-2 relative z-10">
        {replyTo && (
          <div className="flex items-center justify-between bg-gray-100 p-2 rounded-xl text-xs mb-1 border-l-4 border-green-500">
            <div className="flex flex-col max-w-[90%]">
              <span className="font-bold text-green-600 mb-0.5">
                {allUsers.find((u) => u.uid === replyTo.senderId)?.name ||
                  "Unknown"}{" "}
                への返信
              </span>
              <div className="truncate text-gray-600 flex items-center gap-1">
                {replyTo.type === "image" && <ImageIcon className="w-3 h-3" />}
                {replyTo.type === "video" && <Video className="w-3 h-3" />}
                {["image", "video"].includes(replyTo.type)
                  ? replyTo.type === "image"
                    ? "[画像]"
                    : "[動画]"
                  : replyTo.content || "[メッセージ]"}
              </div>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="p-1 hover:bg-gray-200 rounded-full"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlusMenuOpen(!plusMenuOpen)}
            className={`p-2 rounded-full ${
              plusMenuOpen ? "bg-gray-100 rotate-45" : ""
            }`}
          >
            <Plus className="w-5 h-5 text-gray-400" />
          </button>
          <div className="flex-1 flex gap-2 relative">
            {!isRecording ? (
              <input
                className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 text-sm focus:outline-none"
                placeholder="メッセージを入力"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage(text)}
              />
            ) : (
              <div className="flex-1 bg-red-50 rounded-2xl px-4 py-2 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2 text-red-500 font-bold text-xs">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                  録音中... {Math.floor(recordingTime / 60)}:
                  {(recordingTime % 60).toString().padStart(2, "0")}
                </div>
              </div>
            )}
            {!text && !isUploading && (
              <>
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={cancelRecording}
                      className="p-2 rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300"
                      title="キャンセル"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={stopRecording}
                      className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600 animate-bounce"
                      title="停止して送信"
                    >
                      <StopCircle className="w-5 h-5 fill-current" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          {(text || isUploading) && (
            <button
              onClick={() => sendMessage(text)}
              disabled={!text && !isUploading}
              className={`p-2 rounded-full ${
                text ? "text-green-500" : "text-gray-300"
              }`}
            >
              {isUploading ? (
                <div className="relative">
                  <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                  {uploadProgress > 0 && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 text-[8px] font-bold mt-1">
                      {uploadProgress}%
                    </div>
                  )}
                </div>
              ) : (
                <Send className="w-6 h-6" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const FriendProfileModal = ({ friend, onClose, onStartChat }) => {
  if (!friend) return null;
  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl relative flex flex-col items-center pb-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black/20 text-white p-2 rounded-full backdrop-blur-md"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="w-full h-48 bg-gray-200">
          <img
            src={
              friend.cover ||
              "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80"
            }
            className="w-full h-full object-cover"
          />
        </div>
        <div className="-mt-16 mb-4 relative">
          <img
            src={friend.avatar}
            className="w-32 h-32 rounded-[40px] border-[6px] border-white object-cover shadow-lg"
          />
        </div>
        <h2 className="text-2xl font-bold mb-1">{friend.name}</h2>
        <p className="text-gray-400 text-xs font-mono mb-4">ID: {friend.id}</p>
        <div className="w-full px-8 mb-8">
          <p className="text-center text-sm text-gray-600 bg-gray-50 py-3 px-4 rounded-2xl">
            {friend.status || "ステータスメッセージはありません"}
          </p>
        </div>
        <div className="flex gap-4 w-full px-8">
          <button
            onClick={() => {
              onStartChat(friend.uid);
              onClose();
            }}
            className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-bold shadow-lg shadow-green-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" /> トーク
          </button>
        </div>
      </div>
    </div>
  );
};

const HomeView = ({
  user,
  profile,
  allUsers,
  chats,
  setView,
  setActiveChatId,
  setSearchModalOpen,
  startChatWithUser,
}) => {
  const [tab, setTab] = useState("chats");
  const [selectedFriend, setSelectedFriend] = useState(null);
  const friendsList = useMemo(
    () => allUsers.filter((u) => (profile?.friends || []).includes(u.uid)),
    [allUsers, profile]
  );
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b flex justify-between items-center bg-white shrink-0">
        <h1 className="text-xl font-bold">ホーム</h1>
        <div className="flex gap-4 items-center">
          <Gift
            className="w-6 h-6 cursor-pointer text-pink-500"
            onClick={() => setView("birthday-cards")}
          />
          <Users
            className="w-6 h-6 cursor-pointer"
            onClick={() => setView("group-create")}
          />
          <Search
            className="w-6 h-6 cursor-pointer"
            onClick={() => setSearchModalOpen(true)}
          />
          <UserPlus
            className="w-6 h-6 cursor-pointer"
            onClick={() => setView("qr")}
          />
          <Settings
            className="w-6 h-6 cursor-pointer"
            onClick={() => setView("profile")}
          />
        </div>
      </div>
      <div className="flex border-b">
        <button
          className={`flex-1 py-3 text-sm font-bold ${
            tab === "friends" ? "border-b-2 border-black" : "text-gray-400"
          }`}
          onClick={() => setTab("friends")}
        >
          友だち
        </button>
        <button
          className={`flex-1 py-3 text-sm font-bold ${
            tab === "chats" ? "border-b-2 border-black" : "text-gray-400"
          }`}
          onClick={() => setTab("chats")}
        >
          トーク
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div
          className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer border-b"
          onClick={() => setView("profile")}
        >
          <div className="relative">
            <img
              key={profile?.avatar}
              src={profile?.avatar}
              className="w-16 h-16 rounded-2xl object-cover border"
            />
            {isTodayBirthday(profile?.birthday) && (
              <span className="absolute -top-1 -right-1 text-base">🎂</span>
            )}
          </div>
          <div className="flex-1">
            <div className="font-bold text-lg">{profile?.name}</div>
            <div className="text-xs text-gray-400 font-mono">
              ID: {profile?.id}
            </div>
          </div>
        </div>
        {tab === "friends" &&
          friendsList.map((friend) => (
            <div
              key={friend.uid}
              className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer"
              onClick={() => setSelectedFriend(friend)}
            >
              <div className="relative">
                <img
                  key={friend.avatar}
                  src={friend.avatar}
                  className="w-12 h-12 rounded-xl object-cover border"
                />
                {isTodayBirthday(friend.birthday) && (
                  <span className="absolute -top-1 -right-1 text-xs">🎂</span>
                )}
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">{friend.name}</div>
                <div className="text-xs text-gray-400 truncate">
                  {friend.status}
                </div>
              </div>
            </div>
          ))}
        {tab === "chats" &&
          chats
            .sort(
              (a, b) =>
                (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)
            )
            .map((chat) => {
              let name = chat.name,
                icon = chat.icon,
                partnerData = null;
              if (!chat.isGroup) {
                partnerData = allUsers.find(
                  (u) => u.uid === chat.participants.find((p) => p !== user.uid)
                );
                if (partnerData) {
                  name = partnerData.name;
                  icon = partnerData.avatar;
                }
              }
              return (
                <div
                  key={chat.id}
                  className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setView("chatroom");
                  }}
                >
                  <div className="relative">
                    <img
                      key={icon}
                      src={icon}
                      className="w-12 h-12 rounded-xl object-cover border"
                    />
                    {!chat.isGroup &&
                      partnerData &&
                      isTodayBirthday(partnerData.birthday) && (
                        <span className="absolute -top-1 -right-1 text-xs">
                          🎂
                        </span>
                      )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">
                      {name}{" "}
                      {chat.isGroup ? `(${chat.participants.length})` : ""}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {chat.lastMessage?.content}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-300 self-start mt-1">
                    {formatTime(chat.updatedAt)}
                  </div>
                </div>
              );
            })}
      </div>
      {selectedFriend && (
        <FriendProfileModal
          friend={selectedFriend}
          onClose={() => setSelectedFriend(null)}
          onStartChat={startChatWithUser}
        />
      )}
    </div>
  );
};

const VoomView = ({
  user,
  allUsers,
  profile,
  posts,
  showNotification,
  db,
  appId,
}) => {
  /* ... existing ... */
  const [content, setContent] = useState(""),
    [media, setMedia] = useState(null),
    [mediaType, setMediaType] = useState("image"),
    [isUploading, setIsUploading] = useState(false);
  const postMessage = async () => {
    if ((!content && !media) || isUploading) return;
    setIsUploading(true);
    try {
      let hasChunks = false,
        chunkCount = 0,
        storedMedia = media;
      if (media && media.length > CHUNK_SIZE) {
        hasChunks = true;
        chunkCount = Math.ceil(media.length / CHUNK_SIZE);
        storedMedia = null;
      }
      const newPostRef = doc(
        collection(db, "artifacts", appId, "public", "data", "posts")
      );

      // VOOMの並列アップロードロジック (1000並列)
      const CONCURRENCY = 1000;
      if (hasChunks) {
        const executing = new Set();
        for (let i = 0; i < chunkCount; i++) {
          // チャンク処理: 文字列として分割して保存
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, media.length);
          const chunkData = media.slice(start, end);

          const p = setDoc(
            doc(
              db,
              "artifacts",
              appId,
              "public",
              "data",
              "posts",
              newPostRef.id,
              "chunks",
              `${i}`
            ),
            { data: chunkData, index: i }
          );
          const pWrapper = p.then(() => executing.delete(pWrapper));
          executing.add(pWrapper);
          if (executing.size >= CONCURRENCY) await Promise.race(executing);
        }
        await Promise.all(executing);
      }
      // Data URLからMIMEタイプ抽出 (data:image/jpeg;base64,....)
      let mimeType = null;
      if (media && media.startsWith("data:")) {
        mimeType = media.split(";")[0].split(":")[1];
      }

      // 保存時は hasChunks が true なら media フィールドは null にして容量節約
      // ただし、小さいファイルの場合は media にそのままデータを入れる
      await setDoc(newPostRef, {
        userId: user.uid,
        content,
        media: storedMedia,
        mediaType,
        mimeType,
        hasChunks,
        chunkCount,
        likes: [],
        comments: [],
        createdAt: serverTimestamp(),
      });
      setContent("");
      setMedia(null);
      showNotification("投稿しました");
    } finally {
      setIsUploading(false);
    }
  };

  // VOOM投稿時のファイル選択も、メッセージ送信と同じようにDataURL化
  const handleVoomFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      // ここでは Data URL 全体をセットしておく (プレビュー用 & 小さいファイルならそのまま送信)
      // チャンク分割時は、この文字列を分割する
      setMedia(ev.target.result);
      setMediaType(file.type.startsWith("video") ? "video" : "image");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white p-4 border-b shrink-0">
        <h1 className="text-xl font-bold">VOOM</h1>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
        <div className="bg-white p-4 mb-2">
          <textarea
            className="w-full text-sm outline-none resize-none min-h-[60px]"
            placeholder="何をしていますか？"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          {media && (
            <div className="relative mt-2">
              {mediaType === "video" ? (
                <video
                  src={media}
                  className="w-full rounded-xl bg-black"
                  controls
                />
              ) : (
                <img src={media} className="max-h-60 rounded-xl" />
              )}
              <button
                onClick={() => setMedia(null)}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t mt-2">
            <label className="cursor-pointer p-2 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-gray-400" />
              <input
                type="file"
                className="hidden"
                accept="image/*,video/*"
                onChange={handleVoomFileUpload}
              />
            </label>
            <button
              onClick={postMessage}
              disabled={isUploading}
              className={`text-xs font-bold px-4 py-2 rounded-full ${
                content || media
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              投稿
            </button>
          </div>
        </div>
        {posts.map((p) => (
          <PostItem
            key={p.id}
            post={p}
            user={user}
            allUsers={allUsers}
            db={db}
            appId={appId}
            profile={profile}
          />
        ))}
      </div>
    </div>
  );
};

const ProfileEditView = ({
  user,
  profile,
  setView,
  showNotification,
  copyToClipboard,
}) => {
  const [edit, setEdit] = useState(profile || {});
  useEffect(() => {
    if (profile)
      setEdit((prev) =>
        !prev || Object.keys(prev).length === 0
          ? { ...profile }
          : {
              ...profile,
              name: prev.name,
              id: prev.id,
              status: prev.status,
              birthday: prev.birthday,
              avatar: prev.avatar,
              cover: prev.cover,
            }
      );
  }, [profile]);
  const handleSave = () => {
    updateDoc(
      doc(db, "artifacts", appId, "public", "data", "users", user.uid),
      edit
    );
    showNotification("保存しました ✅");
  };
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b flex items-center gap-4 sticky top-0 bg-white shrink-0">
        <ChevronLeft
          className="w-6 h-6 cursor-pointer"
          onClick={() => setView("home")}
        />
        <span className="font-bold">設定</span>
      </div>
      <div className="flex-1 overflow-y-auto pb-8">
        <div className="w-full h-48 relative bg-gray-200">
          <img src={edit.cover} className="w-full h-full object-cover" />
          <label className="absolute inset-0 flex items-center justify-center bg-black/20 text-white font-bold cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
            背景変更
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) =>
                handleCompressedUpload(e, (d) => setEdit({ ...edit, cover: d }))
              }
            />
          </label>
        </div>
        <div className="px-8 -mt-12 flex flex-col items-center gap-6">
          <div className="relative">
            <img
              src={edit.avatar}
              className="w-24 h-24 rounded-3xl border-4 border-white object-cover"
            />
            <label className="absolute bottom-0 right-0 bg-green-500 p-2 rounded-full text-white cursor-pointer">
              <CameraIcon className="w-4 h-4" />
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) =>
                  handleCompressedUpload(e, (d) =>
                    setEdit({ ...edit, avatar: d })
                  )
                }
              />
            </label>
          </div>
          <div className="w-full space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400">名前</label>
              <input
                className="w-full border-b py-2 outline-none"
                value={edit.name || ""}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400">ID</label>
              <div className="flex items-center gap-2 border-b py-2">
                <span className="flex-1 font-mono text-gray-600">
                  {edit.id}
                </span>
                <button
                  onClick={() => copyToClipboard(edit.id)}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <Copy className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400">誕生日</label>
              <input
                type="date"
                className="w-full border-b py-2 outline-none bg-transparent"
                value={edit.birthday || ""}
                onChange={(e) => setEdit({ ...edit, birthday: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400">
                ひとこと
              </label>
              <input
                className="w-full border-b py-2 outline-none"
                value={edit.status || ""}
                onChange={(e) => setEdit({ ...edit, status: e.target.value })}
              />
            </div>
            <button
              onClick={handleSave}
              className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold shadow-lg"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const QRScannerView = ({ user, setView, addFriendById }) => {
  /* ... existing ... */
  const videoRef = useRef(null),
    canvasRef = useRef(null),
    [scanning, setScanning] = useState(false),
    [stream, setStream] = useState(null);
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);
  const startScanner = async () => {
    setScanning(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
        requestAnimationFrame(tick);
      }
    } catch (err) {
      setScanning(false);
    }
  };
  const tick = () => {
    if (videoRef.current?.readyState === videoRef.current?.HAVE_ENOUGH_DATA) {
      const c = canvasRef.current,
        ctx = c.getContext("2d");
      c.height = videoRef.current.videoHeight;
      c.width = videoRef.current.videoWidth;
      ctx.drawImage(videoRef.current, 0, 0, c.width, c.height);
      const code = window.jsQR?.(
        ctx.getImageData(0, 0, c.width, c.height).data,
        c.width,
        c.height
      );
      if (code) {
        stream?.getTracks().forEach((t) => t.stop());
        setScanning(false);
        addFriendById(code.data);
        return;
      }
    }
    requestAnimationFrame(tick);
  };
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b flex items-center gap-4">
        <ChevronLeft
          className="w-6 h-6 cursor-pointer"
          onClick={() => setView("home")}
        />
        <span className="font-bold">QR</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        {scanning ? (
          <div className="relative w-64 h-64 border-4 border-green-500 rounded-3xl overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
          </div>
        ) : (
          <div className="bg-white p-6 rounded-[40px] shadow-xl border">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${user?.uid}`}
              className="w-48 h-48"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 w-full">
          <button
            onClick={startScanner}
            className="flex flex-col items-center gap-2 bg-gray-50 p-4 rounded-3xl border"
          >
            <Maximize className="w-6 h-6 text-green-500" />
            <span>スキャン</span>
          </button>
          <label className="flex flex-col items-center gap-2 bg-gray-50 p-4 rounded-3xl border cursor-pointer">
            <Upload className="w-6 h-6 text-blue-500" />
            <span>読込</span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const r = new FileReader();
                r.onload = (ev) => {
                  const img = new Image();
                  img.onload = () => {
                    const c = document.createElement("canvas"),
                      ctx = c.getContext("2d");
                    c.width = img.width;
                    c.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    const code = window.jsQR(
                      ctx.getImageData(0, 0, c.width, c.height).data,
                      c.width,
                      c.height
                    );
                    if (code) addFriendById(code.data);
                  };
                  img.src = ev.target.result;
                };
                r.readAsDataURL(e.target.files[0]);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("home");
  const [activeChatId, setActiveChatId] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [posts, setPosts] = useState([]);
  const [notification, setNotification] = useState(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mutedChats, setMutedChats] = useState(() => {
    const saved = localStorage.getItem("mutedChats");
    return saved ? JSON.parse(saved) : [];
  });
  // Call State
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [callAcceptedData, setCallAcceptedData] = useState(null); // 応答受け入れ後のデータ（ポップアップブロック回避用）
  const ringtoneRef = useRef(null);
  const processedCallIdsRef = useRef(new Set()); // 追加: 重複処理防止用

  const toggleMuteChat = (chatId) => {
    setMutedChats((prev) => {
      const next = prev.includes(chatId)
        ? prev.filter((id) => id !== chatId)
        : [...prev, chatId];
      localStorage.setItem("mutedChats", JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = JSQR_URL;
    document.head.appendChild(script);
    const initAuth = async () => {
      if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        ensureUserProfile(u.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const copyToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    showNotification("IDをコピーしました");
  };

  const ensureUserProfile = async (uid) => {
    const userDocRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "users",
      uid
    );
    try {
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) {
        const initialProfile = {
          uid,
          name: `ユーザー_${uid.slice(0, 4)}`,
          id: `user_${uid.slice(0, 6)}`,
          status: "よろしくお願いします！",
          birthday: "",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=" + uid,
          cover:
            "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80",
          friends: [],
        };
        await setDoc(userDocRef, initialProfile);
        setProfile(initialProfile);
      } else {
        setProfile(snap.data());
      }
    } catch (error) {}
  };

  useEffect(() => {
    if (!user) return;
    const unsubProfile = onSnapshot(
      doc(db, "artifacts", appId, "public", "data", "users", user.uid),
      (doc) => {
        if (doc.exists()) setProfile(doc.data());
      }
    );
    const unsubUsers = onSnapshot(
      query(collection(db, "artifacts", appId, "public", "data", "users")),
      (snap) => {
        setAllUsers(snap.docs.map((d) => d.data()));
      }
    );
    const unsubChats = onSnapshot(
      query(
        collection(db, "artifacts", appId, "public", "data", "chats"),
        where("participants", "array-contains", user.uid)
      ),
      (snap) => {
        setChats(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );
    const unsubPosts = onSnapshot(
      query(
        collection(db, "artifacts", appId, "public", "data", "posts"),
        orderBy("createdAt", "desc"),
        limit(50)
      ),
      (snap) => {
        setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );
    return () => {
      unsubProfile();
      unsubUsers();
      unsubChats();
      unsubPosts();
    };
  }, [user]);

  // --- Call Handling ---
  useEffect(() => {
    if (!user || chats.length === 0) return;

    // Check for calls
    const incoming = chats.find(
      (c) =>
        c.callStatus?.status === "ringing" && c.callStatus.callerId !== user.uid
    );
    const outgoing = chats.find(
      (c) =>
        c.callStatus?.status === "ringing" && c.callStatus.callerId === user.uid
    );

    // 自分の発信に対して相手が応答したかチェック (status === 'accepted')
    const accepted = chats.find(
      (c) =>
        c.callStatus?.status === "accepted" &&
        c.callStatus.callerId === user.uid
    );

    if (incoming) {
      if (!incomingCall || incomingCall.id !== incoming.id) {
        setIncomingCall(incoming);
        startRingtone();
      }
    } else {
      setIncomingCall(null);
      if (!outgoing) stopRingtone();
    }

    if (outgoing) {
      setOutgoingCall(outgoing);
    } else {
      setOutgoingCall(null);
    }

    // 相手が応答した場合の処理 (発信者側)
    // 自動でwindow.openするのではなく、ユーザーアクションを促すオーバーレイを表示してポップアップブロックを回避
    if (accepted && !processedCallIdsRef.current.has(accepted.id)) {
      processedCallIdsRef.current.add(accepted.id);
      setCallAcceptedData(accepted); // 専用のオーバーレイを表示
      setOutgoingCall(null); // 発信中画面は消す
    }
  }, [chats, user, incomingCall]);

  const startRingtone = () => {
    if (ringtoneRef.current) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();

      // オシレーター1 (明るい高音)
      const osc = audioCtx.createOscillator();
      osc.type = "triangle"; // サイン波より少しはっきりした音色
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz (A5)

      // オシレーター2 (長三度上で明るい和音を作る)
      const osc2 = audioCtx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(1108.73, audioCtx.currentTime); // 1108Hz (C#6)

      // 音量制御用ノード
      const gainNode = audioCtx.createGain();

      // 軽快なリズム (ピポッ... ピポッ...)
      const cycleDuration = 1.2; // 1.2秒周期
      const ringDuration = 0.2; // 0.2秒だけ鳴る（短く軽快に）

      // 初期設定
      const now = audioCtx.currentTime;
      gainNode.gain.setValueAtTime(0, now);

      // 初回鳴動
      gainNode.gain.setTargetAtTime(0.1, now, 0.01);
      gainNode.gain.setTargetAtTime(0, now + ringDuration, 0.15); // 余韻を少し残す

      const intervalId = setInterval(() => {
        const currentTime = audioCtx.currentTime;
        // ON
        gainNode.gain.setTargetAtTime(0.1, currentTime, 0.01);
        // OFF
        gainNode.gain.setTargetAtTime(0, currentTime + ringDuration, 0.15);
      }, cycleDuration * 1000);

      osc.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start();
      osc2.start();

      // ブラウザの自動再生ポリシー対策として、resumeを試みる
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      ringtoneRef.current = {
        audioCtx,
        oscillators: [osc, osc2],
        intervalId,
        gainNode,
      };
    } catch (e) {
      console.error(e);
    }
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      try {
        const { audioCtx, oscillators, intervalId } = ringtoneRef.current;
        oscillators.forEach((o) => o.stop());
        clearInterval(intervalId);
        audioCtx.close();
      } catch (e) {}
      ringtoneRef.current = null;
    }
  };

  // 受信者が応答したときの処理
  const answerCall = async () => {
    if (!incomingCall) return;
    stopRingtone();
    const roomName = incomingCall.callStatus.roomName;
    const url = `https://meet.jit.si/${encodeURIComponent(roomName)}`;

    // ポップアップブロックを避けるため、ユーザーアクション(クリック)の直後にウィンドウを開く
    window.open(url, "_blank");

    // その後ステータスを更新して、発信者側に通知
    await updateDoc(
      doc(db, "artifacts", appId, "public", "data", "chats", incomingCall.id),
      {
        "callStatus.status": "accepted",
      }
    );
  };

  // 発信者が「通話に参加」ボタンを押したときの処理
  const joinAcceptedCall = async () => {
    if (!callAcceptedData) return;
    const roomName = callAcceptedData.callStatus.roomName;
    const url = `https://meet.jit.si/${encodeURIComponent(roomName)}`;

    // ユーザーアクション(クリック)内なのでブロックされない
    window.open(url, "_blank");

    // 通話に参加したのでステータスをクリア
    await updateDoc(
      doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "chats",
        callAcceptedData.id
      ),
      {
        callStatus: deleteField(),
      }
    );
    setCallAcceptedData(null);

    // 少し遅れてIDセットから削除（再レンダリング時の重複防止）
    setTimeout(() => {
      processedCallIdsRef.current.delete(callAcceptedData.id);
    }, 5000);
  };

  const declineCall = async () => {
    if (!incomingCall) return;
    stopRingtone();
    await updateDoc(
      doc(db, "artifacts", appId, "public", "data", "chats", incomingCall.id),
      {
        callStatus: deleteField(),
      }
    );
  };

  const cancelCall = async () => {
    if (!outgoingCall) return;
    await updateDoc(
      doc(db, "artifacts", appId, "public", "data", "chats", outgoingCall.id),
      {
        callStatus: deleteField(),
      }
    );
  };

  const addFriendById = async (targetId) => {
    if (!targetId) return;
    const targetUser = allUsers.find(
      (u) => u.id === targetId || u.uid === targetId
    );
    if (targetUser && targetUser.uid !== user.uid) {
      if ((profile.friends || []).includes(targetUser.uid)) {
        showNotification("既に友だちです。");
        return;
      }
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "users", user.uid),
        { friends: arrayUnion(targetUser.uid) }
      );
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "users", targetUser.uid),
        { friends: arrayUnion(user.uid) }
      );
      showNotification(`${targetUser.name}を追加しました`);
      setSearchModalOpen(false);
    } else {
      showNotification("ユーザーが見つかりません");
    }
  };

  const startChatWithUser = async (targetUid) => {
    const existingChat = chats.find(
      (c) =>
        !c.isGroup &&
        c.participants.includes(targetUid) &&
        c.participants.includes(user.uid)
    );
    if (existingChat) {
      setActiveChatId(existingChat.id);
      setView("chatroom");
    } else {
      const targetUser = allUsers.find((u) => u.uid === targetUid);
      const newChat = {
        name: targetUser ? targetUser.name : "Chat",
        icon: targetUser ? targetUser.avatar : "",
        participants: [user.uid, targetUid],
        isGroup: false,
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        lastMessage: { content: "チャットを開始しました", senderId: user.uid },
      };
      try {
        const ref = await addDoc(
          collection(db, "artifacts", appId, "public", "data", "chats"),
          newChat
        );
        setActiveChatId(ref.id);
        setView("chatroom");
      } catch (e) {
        showNotification("エラーが発生しました");
      }
    }
  };

  return (
    <div className="max-w-md mx-auto h-screen border-x bg-white flex flex-col relative overflow-hidden shadow-2xl">
      {notification && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[300] bg-black/85 text-white px-6 py-2 rounded-full text-xs font-bold shadow-2xl animate-bounce">
          {notification}
        </div>
      )}
      {searchModalOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/60">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-8">
            <h2 className="text-xl font-bold mb-6">検索</h2>
            <input
              className="w-full bg-gray-50 rounded-2xl py-4 px-6 mb-6 outline-none"
              placeholder="IDを入力"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="flex gap-4">
              <button
                className="flex-1 py-4 text-gray-600 font-bold"
                onClick={() => setSearchModalOpen(false)}
              >
                閉じる
              </button>
              <button
                className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-bold"
                onClick={() => addFriendById(searchQuery)}
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Overlays */}
      {incomingCall && (
        <IncomingCallOverlay
          callData={incomingCall.callStatus}
          onAccept={answerCall}
          onDecline={declineCall}
          allUsers={allUsers}
        />
      )}
      {outgoingCall && (
        <OutgoingCallOverlay
          callData={outgoingCall.callStatus}
          onCancel={cancelCall}
          allUsers={allUsers}
        />
      )}
      {callAcceptedData && (
        <CallAcceptedOverlay
          callData={callAcceptedData}
          onJoin={joinAcceptedCall}
        />
      )}

      <div className="flex-1 overflow-hidden relative">
        {view === "home" && (
          <HomeView
            user={user}
            profile={profile}
            allUsers={allUsers}
            chats={chats}
            setView={setView}
            setActiveChatId={setActiveChatId}
            setSearchModalOpen={setSearchModalOpen}
            startChatWithUser={startChatWithUser}
          />
        )}
        {view === "voom" && (
          <VoomView
            user={user}
            allUsers={allUsers}
            profile={profile}
            posts={posts}
            showNotification={showNotification}
            db={db}
            appId={appId}
          />
        )}
        {view === "chatroom" && (
          <ChatRoomView
            user={user}
            profile={profile}
            allUsers={allUsers}
            chats={chats}
            activeChatId={activeChatId}
            setActiveChatId={setActiveChatId}
            setView={setView}
            db={db}
            appId={appId}
            mutedChats={mutedChats}
            toggleMuteChat={toggleMuteChat}
            showNotification={showNotification}
            addFriendById={addFriendById}
          />
        )}
        {view === "profile" && (
          <ProfileEditView
            user={user}
            profile={profile}
            setView={setView}
            showNotification={showNotification}
            copyToClipboard={copyToClipboard}
          />
        )}
        {view === "qr" && (
          <QRScannerView
            user={user}
            setView={setView}
            addFriendById={addFriendById}
          />
        )}
        {view === "group-create" && (
          <GroupCreateView
            user={user}
            profile={profile}
            allUsers={allUsers}
            setView={setView}
            showNotification={showNotification}
          />
        )}
        {view === "birthday-cards" && (
          <BirthdayCardBox user={user} setView={setView} />
        )}
      </div>

      {["home", "voom"].includes(view) && (
        <div className="h-20 bg-white border-t flex items-center justify-around z-50 pb-4 shrink-0">
          <div
            className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
              view === "home" ? "text-green-500" : "text-gray-400"
            }`}
            onClick={() => setView("home")}
          >
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-bold">ホーム</span>
          </div>
          <div
            className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
              view === "voom" ? "text-green-500" : "text-gray-400"
            }`}
            onClick={() => setView("voom")}
          >
            <LayoutGrid className="w-6 h-6" />
            <span className="text-[10px] font-bold">VOOM</span>
          </div>
        </div>
      )}
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
}
