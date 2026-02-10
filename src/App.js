import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect
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
  runTransaction
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
  MicOff,
  VideoOff,
  Sparkles,
  MoreVertical,
  EyeOff,
  Eye,
  AlertCircle
} from "lucide-react";
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
const appId = "messenger-app-v9-integrated";
const CHUNK_SIZE = 740000;
const getUploadConcurrency = () => {
  const net = navigator.connection?.effectiveType || "";
  const hw = navigator.hardwareConcurrency || 8;
  let base = 12;
  if (net === "slow-2g" || net === "2g") base = 4;
  else if (net === "3g") base = 7;
  else if (net === "4g") base = 12;
  if (navigator.connection?.saveData) base = Math.min(base, 6);
  const hwBoost = Math.max(1, Math.min(10, Math.floor(hw / 2)));
  return Math.max(4, Math.min(28, base + hwBoost));
};
const bytesToBase64 = (bytes) => {
  let binary = "";
  const step = 32768;
  for (let i = 0; i < bytes.length; i += step) {
    const chunk = bytes.subarray(i, i + step);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};
const MAX_MEDIA_CACHE_SIZE = 180;
const messageMediaUrlCache = /* @__PURE__ */ new Map();
const messageMediaPromiseCache = /* @__PURE__ */ new Map();
const messageMediaUrlSet = /* @__PURE__ */ new Set();
const getDefaultMimeTypeByMessageType = (type) => {
  if (type === "video") return "video/mp4";
  if (type === "image") return "image/jpeg";
  if (type === "audio") return "audio/webm";
  return "application/octet-stream";
};
const buildMessageMediaCacheKey = (chatId, msgId, chunkCount, mimeType, type) => {
  const resolvedMimeType = mimeType || getDefaultMimeTypeByMessageType(type);
  return `${chatId}:${msgId}:${chunkCount || 0}:${resolvedMimeType}`;
};
const evictOldestMessageMediaCache = () => {
  if (messageMediaUrlCache.size < MAX_MEDIA_CACHE_SIZE) return;
  const oldestKey = messageMediaUrlCache.keys().next().value;
  if (!oldestKey) return;
  const oldestUrl = messageMediaUrlCache.get(oldestKey);
  messageMediaUrlCache.delete(oldestKey);
  if (oldestUrl) {
    messageMediaUrlSet.delete(oldestUrl);
    if (oldestUrl.startsWith("blob:")) URL.revokeObjectURL(oldestUrl);
  }
};
const isCachedMessageMediaUrl = (url) => !!url && messageMediaUrlSet.has(url);
const loadChunkedMessageMedia = async ({ db: db2, appId: appId2, chatId, message }) => {
  const cacheKey = buildMessageMediaCacheKey(chatId, message.id, message.chunkCount, message.mimeType, message.type);
  const cached = messageMediaUrlCache.get(cacheKey);
  if (cached) return cached;
  const inFlight = messageMediaPromiseCache.get(cacheKey);
  if (inFlight) return inFlight;
  const loadPromise = (async () => {
    let base64Data = "";
    if (message.chunkCount) {
      const chunkPromises = [];
      for (let i = 0; i < message.chunkCount; i++) {
        chunkPromises.push(
          getDoc(doc(db2, "artifacts", appId2, "public", "data", "chats", chatId, "messages", message.id, "chunks", `${i}`))
        );
      }
      const chunkDocs = await Promise.all(chunkPromises);
      chunkDocs.forEach((d) => {
        if (d.exists()) base64Data += d.data().data;
      });
    } else {
      const snap = await getDocs(
        query(
          collection(db2, "artifacts", appId2, "public", "data", "chats", chatId, "messages", message.id, "chunks"),
          orderBy("index", "asc")
        )
      );
      snap.forEach((d) => base64Data += d.data().data);
    }
    if (!base64Data) return null;
    const mimeType = message.mimeType || getDefaultMimeTypeByMessageType(message.type);
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    evictOldestMessageMediaCache();
    messageMediaUrlCache.set(cacheKey, objectUrl);
    messageMediaUrlSet.add(objectUrl);
    return objectUrl;
  })();
  messageMediaPromiseCache.set(cacheKey, loadPromise);
  try {
    return await loadPromise;
  } finally {
    messageMediaPromiseCache.delete(cacheKey);
  }
};
const REACTION_EMOJIS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F525}"];
const parseEnvCsv = (value) => (value || "").split(",").map((v) => v.trim()).filter(Boolean);
const turnUrls = parseEnvCsv(process.env.REACT_APP_TURN_URLS);
const turnUsername = process.env.REACT_APP_TURN_USERNAME || "";
const turnCredential = process.env.REACT_APP_TURN_CREDENTIAL || "";
const forceRelayOnly = process.env.REACT_APP_FORCE_RELAY === "1";
const hasTurnConfig = turnUrls.length > 0 && !!turnUsername && !!turnCredential;
const iceServers = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
      "stun:stun3.l.google.com:19302",
      "stun:stun4.l.google.com:19302",
      "stun:stun.cloudflare.com:3478",
      "stun:global.stun.twilio.com:3478"
    ]
  }
];
if (hasTurnConfig) {
  iceServers.push({
    urls: turnUrls,
    username: turnUsername,
    credential: turnCredential
  });
}
const rtcConfig = {
  iceServers,
  iceCandidatePoolSize: 4,
  bundlePolicy: "max-bundle",
  iceTransportPolicy: forceRelayOnly ? "relay" : "all"
};
const buildRtcConfig = (preferRelay = false) => ({
  ...rtcConfig,
  // Use TURN relay on reconnect for long-distance / strict NAT when TURN is configured.
  iceTransportPolicy: forceRelayOnly || (preferRelay && hasTurnConfig) ? "relay" : "all"
});
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
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
};
const getProfileCacheKey = (uid) => `profileCache:${uid}`;
const normalizeProfileForCache = (uid, profile) => {
  if (!uid || !profile) return null;
  return {
    uid,
    name: profile.name || "",
    id: profile.id || "",
    status: profile.status || "",
    birthday: profile.birthday || "",
    avatar: profile.avatar || "",
    cover: profile.cover || "",
    friends: Array.isArray(profile.friends) ? profile.friends : [],
    hiddenFriends: Array.isArray(profile.hiddenFriends) ? profile.hiddenFriends : [],
    hiddenChats: Array.isArray(profile.hiddenChats) ? profile.hiddenChats : [],
    wallet: Number.isFinite(profile.wallet) ? profile.wallet : 1000,
    isBanned: !!profile.isBanned
  };
};
const readCachedProfile = (uid) => {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(getProfileCacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizeProfileForCache(uid, parsed);
  } catch {
    return null;
  }
};
const writeCachedProfile = (uid, profile) => {
  const normalized = normalizeProfileForCache(uid, profile);
  if (!normalized) return;
  try {
    localStorage.setItem(getProfileCacheKey(uid), JSON.stringify(normalized));
  } catch {
  }
};
const getEffectOwnerUidFromRefPath = (refPath) => {
  if (!refPath || typeof refPath !== "string") return "";
  const parts = refPath.split("/");
  const usersIndex = parts.indexOf("users");
  if (usersIndex < 0) return "";
  return parts[usersIndex + 1] || "";
};
const isTodayBirthday = (birthdayString) => {
  if (!birthdayString) return false;
  const today = /* @__PURE__ */ new Date();
  const [y, m, d] = birthdayString.split("-").map(Number);
  return today.getMonth() + 1 === m && today.getDate() === d;
};
const toTitleCase = (value) => value.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
const shuffleText = (value) => value.split("").sort(() => Math.random() - 0.5).join("");
const rot13 = (value) => value.replace(/[a-zA-Z]/g, (ch) => {
  const base = ch <= "Z" ? 65 : 97;
  return String.fromCharCode((ch.charCodeAt(0) - base + 13) % 26 + base);
});
const calcExpression = (expr) => {
  const sanitized = (expr || "").trim();
  if (!sanitized) return null;
  if (!/^[0-9+\-*/().%\s]+$/.test(sanitized)) return null;
  try {
    const result = Function(`"use strict"; return (${sanitized});`)();
    if (typeof result !== "number" || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
};
const encodeBase64Utf8 = (value) => {
  try {
    return btoa(unescape(encodeURIComponent(value)));
  } catch {
    return "";
  }
};
const decodeBase64Utf8 = (value) => {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return "";
  }
};
const toBinaryText = (value) => {
  try {
    const bytes = new TextEncoder().encode(value);
    return Array.from(bytes).map((n) => n.toString(2).padStart(8, "0")).join(" ");
  } catch {
    return "";
  }
};
const toHexText = (value) => {
  try {
    const bytes = new TextEncoder().encode(value);
    return Array.from(bytes).map((n) => n.toString(16).padStart(2, "0")).join(" ");
  } catch {
    return "";
  }
};
const MORSE_MAP = {
  a: ".-",
  b: "-...",
  c: "-.-.",
  d: "-..",
  e: ".",
  f: "..-.",
  g: "--.",
  h: "....",
  i: "..",
  j: ".---",
  k: "-.-",
  l: ".-..",
  m: "--",
  n: "-.",
  o: "---",
  p: ".--.",
  q: "--.-",
  r: ".-.",
  s: "...",
  t: "-",
  u: "..-",
  v: "...-",
  w: ".--",
  x: "-..-",
  y: "-.--",
  z: "--..",
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "!": "-.-.--",
  "-": "-....-",
  "/": "-..-.",
  "@": ".--.-.",
  "(": "-.--.",
  ")": "-.--.-"
};
const MORSE_REVERSE_MAP = Object.fromEntries(Object.entries(MORSE_MAP).map(([k, v]) => [v, k]));
const toMorse = (value) => value.toLowerCase().split("").map((ch) => {
  if (ch === " ") return "/";
  return MORSE_MAP[ch] || ch;
}).join(" ");
const fromMorse = (value) => value.split(/\s+/).map((token) => {
  if (!token) return "";
  if (token === "/") return " ";
  return MORSE_REVERSE_MAP[token] || token;
}).join("");
const RAINBOW_CHARS = ["R", "A", "I", "N", "B", "O", "W"];
const rainbowText = (value) => value.split("").map((ch, idx) => ch === " " ? " " : `${RAINBOW_CHARS[idx % RAINBOW_CHARS.length]}:${ch}`).join(" ");
const SLASH_COMMAND_HELP_LINES = [
  "/help, /time, /date, /datetime",
  "/shrug, /tableflip, /unflip, /lenny, /me",
  "/echo, /upper, /lower, /title, /reverse, /shuffle",
  "/repeat n text, /len text, /trim text, /calc expr",
  "/urlencode text, /urldecode text",
  "/base64 text, /unbase64 text",
  "/binary text, /hex text, /rot13 text",
  "/morse text, /unmorse code, /rainbow text",
  "/random [min] [max], /uuid, /copy text",
  "/plus, /stickers, /record [start|stop|cancel]",
  "/bgreset, /joincall, /voice, /video"
];
let audioCtx = null;
const initAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch((e) => console.error("Audio resume failed:", e));
  }
};
const playNotificationSound = () => {
  try {
    initAudioContext();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(1e-5, audioCtx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio play failed", e);
  }
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
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob.size > file.size ? file : new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
            } else {
              resolve(file);
            }
          }, "image/jpeg", 0.8);
        } else {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = event.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};
const handleFileUpload = async (e, callback) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  const originalFile = files[0];
  e.target.value = "";
  let file = originalFile;
  if (originalFile.type.startsWith("image") && originalFile.type !== "image/gif") {
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
  const files = e.target.files;
  if (!files || files.length === 0) return;
  const file = files[0];
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
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL("image/jpeg", 0.7));
      }
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
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.5));
          } else resolve(null);
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
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
            video.src = "";
            video.load();
            resolve(dataUrl);
          } else resolve(null);
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
      setTimeout(() => resolve(null), 2e3);
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
const AuthView = ({ onLogin, showNotification }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const buildLoginEmail = (rawId) => {
    const input = (rawId || "").trim().normalize("NFKC");
    if (!input) return "";
    if (input.includes("@")) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) ? input.toLowerCase() : "";
    }
    if (!/^[A-Za-z0-9._-]+$/.test(input)) return "";
    return `${input.toLowerCase()}@voom-persistent.app`;
  };
  const getAuthErrorMessage = (error, mode = "login") => {
    const code = error?.code || "";
    if (code === "auth/invalid-email") return "ID形式が不正です。英数字と . _ - のみ使用できます。";
    if (code === "auth/user-not-found") return "このIDは登録されていません。";
    if (code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") return "IDまたはパスワードが違います。";
    if (code === "auth/account-exists-with-different-credential") return "このIDはパスワードログインではなく、別のログイン方法（Google等）で作成されています。";
    if (code === "auth/email-already-in-use") return "このIDは既に使われています。";
    if (code === "auth/weak-password") return "パスワードは6文字以上で入力してください。";
    if (code === "auth/too-many-requests") return "試行回数が多すぎます。しばらく待ってから再試行してください。";
    if (code === "auth/network-request-failed") return "ネットワークエラーです。接続を確認して再試行してください。";
    if (code === "auth/operation-not-allowed") return "Firebase Authenticationでこのログイン方法が無効です。Sign-in method を有効化してください。";
    return `${mode === "signup" ? "登録" : "ログイン"}に失敗しました: ${error?.message || "不明なエラー"}`;
  };
  const getGoogleLoginErrorMessage = (error) => {
    const code = error?.code || "";
    if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
      return "ポップアップがブロックされたため、リダイレクトでログインします。";
    }
    if (code === "auth/popup-closed-by-user") {
      return "Googleログインがキャンセルされました。";
    }
    if (code === "auth/unauthorized-domain") {
      return "このドメインはFirebase Authenticationで許可されていません。Firebaseコンソールで承認済みドメインを追加してください。";
    }
    if (code === "auth/operation-not-allowed") {
      return "FirebaseでGoogleログインが有効化されていません。Authentication > Sign-in method で有効にしてください。";
    }
    return `Googleログインに失敗しました: ${error?.message || "不明なエラー"}`;
  };
  const handleGoogleLogin = async () => {
    const googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, googleProvider);
      return;
    } catch (error) {
      console.error("Popup Login Error:", error);
      const code = error?.code || "";
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request" || code === "auth/operation-not-supported-in-this-environment") {
        try {
          showNotification("ポップアップが使えないため、リダイレクトでログインします。");
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError) {
          console.error("Redirect Login Error:", redirectError);
          showNotification(getGoogleLoginErrorMessage(redirectError));
          return;
        }
      }
      if (code === "auth/operation-not-supported-in-this-environment") {
        showNotification("\u3053\u306E\u74B0\u5883\u3067\u306FGoogle\u30ED\u30B0\u30A4\u30F3\u304C\u4F7F\u3048\u307E\u305B\u3093\u3002");
        return;
      }
      showNotification(getGoogleLoginErrorMessage(error));
    }
  };
  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await signInAnonymously(auth);
      showNotification("\u30B2\u30B9\u30C8\u30ED\u30B0\u30A4\u30F3\u3057\u307E\u3057\u305F");
    } catch (e) {
      showNotification(getAuthErrorMessage(e, "login"));
    } finally {
      setLoading(false);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !password) return showNotification("ID\u3068\u30D1\u30B9\u30EF\u30FC\u30C9\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
    if (!isLoginMode && password.length < 6) {
      showNotification("\u30D1\u30B9\u30EF\u30FC\u30C9\u306F6\u6587\u5B57\u4EE5\u4E0A\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      return;
    }
    const normalizedUserId = userId.trim().normalize("NFKC");
    const email = buildLoginEmail(normalizedUserId);
    if (!email) {
      showNotification("ID\u306F\u82F1\u6570\u5B57\u3068 . _ - \u306E\u307F\u4F7F\u7528\u3067\u304D\u307E\u3059\u3002\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u5165\u529B\u3082\u53EF\u80FD\u3067\u3059\u3002");
      return;
    }
    setLoading(true);
    try {
      if (isLoginMode) {
        try {
          await signInWithEmailAndPassword(auth, email, password);
          showNotification("\u30ED\u30B0\u30A4\u30F3\u3057\u307E\u3057\u305F");
        } catch (loginError) {
          const loginCode = loginError?.code || "";
          if (["auth/user-not-found", "auth/wrong-password", "auth/invalid-credential", "auth/invalid-login-credentials"].includes(loginCode)) {
            try {
              const methods = await fetchSignInMethodsForEmail(auth, email);
              if (Array.isArray(methods) && methods.length > 0 && !methods.includes("password")) {
                showNotification(getAuthErrorMessage({ code: "auth/account-exists-with-different-credential" }, "login"));
                return;
              }
            } catch {
            }
          }
          throw loginError;
        }
      } else {
        if (!displayName.trim()) {
          showNotification("\u30CB\u30C3\u30AF\u30CD\u30FC\u30E0\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
          setLoading(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "artifacts", appId, "public", "data", "users", cred.user.uid), {
          uid: cred.user.uid,
          name: displayName.trim() || normalizedUserId,
          id: normalizedUserId,
          status: "\u3088\u308D\u3057\u304F\u304A\u9858\u3044\u3057\u307E\u3059\uFF01",
          birthday: "",
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cred.user.uid}`,
          cover: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80",
          loginEmail: email,
          friends: [],
          hiddenFriends: [],
          hiddenChats: [],
          wallet: 1e3,
          isBanned: false
        });
        showNotification("\u30A2\u30AB\u30A6\u30F3\u30C8\u4F5C\u6210\u5B8C\u4E86");
      }
    } catch (e2) {
      showNotification(getAuthErrorMessage(e2, isLoginMode ? "login" : "signup"));
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-indigo-50 to-purple-50 p-4 overflow-y-auto", children: /* @__PURE__ */ jsx("div", { className: "min-h-full flex flex-col items-center justify-center w-full", children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-8 border border-white/50 backdrop-blur-sm my-auto", children: [
    /* @__PURE__ */ jsxs("div", { className: "text-center mb-8", children: [
      /* @__PURE__ */ jsx("div", { className: "w-20 h-20 bg-indigo-500 rounded-3xl mx-auto flex items-center justify-center mb-4 shadow-lg", children: /* @__PURE__ */ jsx(MessageCircle, { className: "w-10 h-10 text-white" }) }),
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-black text-gray-800", children: "\u30C1\u30E3\u30C3\u30C8\u30A2\u30D7\u30EA" }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-500 mt-2", children: isLoginMode ? "\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u59CB\u3081\u307E\u3057\u3087\u3046" : "\u30A2\u30AB\u30A6\u30F3\u30C8\u3092\u4F5C\u6210\u3057\u3066\u30C7\u30FC\u30BF\u3092\u4FDD\u5B58" })
    ] }),
    /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [
      !isLoginMode && /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
        /* @__PURE__ */ jsx("label", { className: "text-[10px] font-bold text-gray-400 ml-2", children: "\u8868\u793A\u540D" }),
        /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border", children: [
          /* @__PURE__ */ jsx(User, { className: "w-4 h-4 text-gray-400" }),
          /* @__PURE__ */ jsx("input", { className: "bg-transparent w-full outline-none text-sm font-bold", placeholder: "\u5C71\u7530 \u592A\u90CE", value: displayName, onChange: (e) => setDisplayName(e.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
        /* @__PURE__ */ jsx("label", { className: "text-[10px] font-bold text-gray-400 ml-2", children: "\u30E6\u30FC\u30B6\u30FCID" }),
        /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border", children: [
          /* @__PURE__ */ jsx(AtSign, { className: "w-4 h-4 text-gray-400" }),
          /* @__PURE__ */ jsx("input", { className: "bg-transparent w-full outline-none text-sm font-bold", placeholder: "user_id", autoComplete: "username", value: userId, onChange: (e) => setUserId(e.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
        /* @__PURE__ */ jsx("label", { className: "text-[10px] font-bold text-gray-400 ml-2", children: "\u30D1\u30B9\u30EF\u30FC\u30C9" }),
        /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border", children: [
          /* @__PURE__ */ jsx(KeyRound, { className: "w-4 h-4 text-gray-400" }),
          /* @__PURE__ */ jsx("input", { className: "bg-transparent w-full outline-none text-sm font-bold", type: "password", autoComplete: isLoginMode ? "current-password" : "new-password", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", value: password, onChange: (e) => setPassword(e.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ jsx("button", { type: "submit", disabled: loading, className: "w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center", children: loading ? /* @__PURE__ */ jsx(Loader2, { className: "animate-spin" }) : isLoginMode ? "\u30ED\u30B0\u30A4\u30F3" : "\u767B\u9332" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 flex flex-col gap-3", children: [
      /* @__PURE__ */ jsxs("button", { onClick: handleGoogleLogin, className: "w-full bg-white border text-gray-700 font-bold py-3 rounded-2xl shadow-sm flex items-center justify-center gap-2", children: [
        /* @__PURE__ */ jsx("img", { src: "https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg", className: "w-4 h-4" }),
        "Google\u3067\u30ED\u30B0\u30A4\u30F3"
      ] }),
      /* @__PURE__ */ jsx("button", { onClick: () => setIsLoginMode(!isLoginMode), className: "text-xs font-bold text-gray-400 hover:text-indigo-500", children: isLoginMode ? "\u30A2\u30AB\u30A6\u30F3\u30C8\u3092\u304A\u6301\u3061\u3067\u306A\u3044\u65B9\u306F\u3053\u3061\u3089" : "\u3059\u3067\u306B\u30A2\u30AB\u30A6\u30F3\u30C8\u3092\u304A\u6301\u3061\u306E\u65B9\u306F\u3053\u3061\u3089" }),
      /* @__PURE__ */ jsx("button", { onClick: handleGuestLogin, className: "text-xs font-bold text-gray-400 underline hover:text-gray-600", children: "\u304A\u8A66\u3057\u30B2\u30B9\u30C8\u30ED\u30B0\u30A4\u30F3" })
    ] })
  ] }) }) });
};
const VideoCallView = ({ user, chatId, callData, onEndCall, isCaller: isCallerProp, isVideoEnabled = true, activeEffect, backgroundUrl, effects = [] }) => {
  const [remoteStream, setRemoteStream] = useState(null);
  const [hasRemoteVideoTrack, setHasRemoteVideoTrack] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideoEnabled);
  const [isConnected, setIsConnected] = useState(false);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [networkQuality, setNetworkQuality] = useState("checking");
  const [remoteVolume, setRemoteVolume] = useState(1);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRemotePip, setIsRemotePip] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [currentFacingMode, setCurrentFacingMode] = useState("user");
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [selectedAudioOutput, setSelectedAudioOutput] = useState("default");
  const [isRecordingCall, setIsRecordingCall] = useState(false);
  const [recordingDurationSec, setRecordingDurationSec] = useState(0);
  const [isLocalMirror, setIsLocalMirror] = useState(true);
  const [callError, setCallError] = useState(null);
  const [needsRemotePlay, setNeedsRemotePlay] = useState(false);
  const [disableLocalFilter, setDisableLocalFilter] = useState(false);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [confirmBeforeHangup, setConfirmBeforeHangup] = useState(false);
  const [autoHideControls, setAutoHideControls] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [keepAwake, setKeepAwake] = useState(false);
  const [qualityMode, setQualityMode] = useState("auto");
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = useState(true);
  const [echoCancellationEnabled, setEchoCancellationEnabled] = useState(true);
  const [autoGainControlEnabled, setAutoGainControlEnabled] = useState(true);
  const [micGain, setMicGain] = useState(1);
  const [remoteBoost, setRemoteBoost] = useState(1);
  const [remoteBrightness, setRemoteBrightness] = useState(100);
  const [remoteContrast, setRemoteContrast] = useState(100);
  const [remoteSaturation, setRemoteSaturation] = useState(100);
  const [isRemoteMirror, setIsRemoteMirror] = useState(false);
  const [remoteZoom, setRemoteZoom] = useState(1);
  const [localZoom, setLocalZoom] = useState(1);
  const [showClock, setShowClock] = useState(false);
  const [snapshotCountdownSec, setSnapshotCountdownSec] = useState(0);
  const [snapshotTimestampEnabled, setSnapshotTimestampEnabled] = useState(false);
  const [autoSnapshotSec, setAutoSnapshotSec] = useState(0);
  const [callNotes, setCallNotes] = useState("");
  const [bookmarks, setBookmarks] = useState([]);
  const [isHold, setIsHold] = useState(false);
  const [playConnectSound, setPlayConnectSound] = useState(true);
  const [vibrateOnConnect, setVibrateOnConnect] = useState(false);
  const callStageRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
  const unsubscribersRef = useRef([]);
  const pendingCandidatesRef = useRef([]);
  const disconnectTimerRef = useRef(null);
  const statsTimerRef = useRef(null);
  const localVideoFreezeWatchdogRef = useRef(null);
  const localVideoTimeProbeRef = useRef(null);
  const localVideoFrameCallbackIdRef = useRef(null);
  const lastLocalFrameAtRef = useRef(0);
  const prevOutboundStatsRef = useRef({ packetsSent: 0, packetsLost: 0 });
  const callRecorderRef = useRef(null);
  const callRecordingChunksRef = useRef([]);
  const callRecordingTimerRef = useRef(null);
  const appliedProfileRef = useRef("");
  const applyingRemoteOfferRef = useRef(false);
  const applyingRemoteAnswerRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const isRecoveringRef = useRef(false);
  const lastRemoteOfferSdpRef = useRef("");
  const lastRemoteAnswerSdpRef = useRef("");
  const isMountedRef = useRef(true);
  const startedRef = useRef(false);
  const hasRemoteVideoTrackRef = useRef(false);
  const remoteVolumeRef = useRef(1);
  const remoteMutedRef = useRef(false);
  const callStartedAtRef = useRef(null);
  const screenTrackRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const autoSnapshotTimerRef = useRef(null);
  const wakeLockRef = useRef(null);
  const preHoldStateRef = useRef({ isMuted: false, isVideoOff: false });
  const qualityModeRef = useRef("auto");
  const audioPrefsRef = useRef({ noiseSuppression: true, echoCancellation: true, autoGainControl: true });
  const prevConnectedRef = useRef(false);
  const sessionId = callData?.sessionId || "";
  const isCaller = typeof isCallerProp === "boolean" ? isCallerProp : callData?.callerId === user.uid;
  const canSelectAudioOutput = typeof HTMLMediaElement !== "undefined" && typeof HTMLMediaElement.prototype?.setSinkId === "function";
  const isIOSWebKit = (() => {
    const ua = navigator.userAgent || "";
    const iOS = /iP(hone|ad|od)/.test(ua) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    const webkit = /AppleWebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    return iOS && webkit;
  })();
  const isAndroidDevice = /Android/i.test(navigator.userAgent || "");
  const isLowSpecDevice = (() => {
    const cores = navigator.hardwareConcurrency || 8;
    const memory = navigator.deviceMemory || 8;
    return cores <= 4 || memory <= 4;
  })();
  const forceStablePreviewMode = isIOSWebKit || isAndroidDevice || isLowSpecDevice;
  const getFilterStyle = (effectName) => {
    if (!effectName || effectName === "Normal") return "none";
    const sanitizeFilter = (filterValue) => {
      if (typeof filterValue !== "string") return "none";
      const v = filterValue.trim().toLowerCase();
      // Allow only a single lightweight filter function during live calls.
      const m = v.match(/^(sepia|grayscale|brightness|contrast)\s*\(\s*(-?\d+(?:\.\d+)?)\s*(%)?\s*\)$/i);
      if (!m) return "none";
      const name = m[1].toLowerCase();
      const num = Number(m[2]);
      if (!Number.isFinite(num)) return "none";
      const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
      if (name === "brightness") return `brightness(${clamp(num, 60, 170)}%)`;
      if (name === "contrast") return `contrast(${clamp(num, 80, 200)}%)`;
      if (name === "sepia") return `sepia(${clamp(num, 0, 100)}%)`;
      if (name === "grayscale") return `grayscale(${clamp(num, 0, 100)}%)`;
      return "none";
    };
    const match = (effects || []).find(
      (e) => e?.name === effectName && typeof e?.filter === "string" && e.filter.trim() !== ""
    );
    if (match?.filter) return sanitizeFilter(match.filter);
    switch (effectName) {
      case "Sepia":
        return "sepia(100%)";
      case "Grayscale":
        return "grayscale(100%)";
      case "Invert":
        return "none";
      case "Hue":
        return "none";
      case "Contrast":
        return "contrast(200%)";
      case "Blur":
        return "none";
      case "Bright":
        return "brightness(150%)";
      case "Fire":
        return "none";
      case "Ice":
        return "none";
      case "Rainbow":
        return "none";
      default:
        return "none";
    }
  };
  const onEndCallRef = useRef(onEndCall);
  useEffect(() => {
    onEndCallRef.current = onEndCall;
  }, [onEndCall]);
  const safeEndCall = useCallback((delay = 0) => {
    const endCall = () => onEndCallRef.current?.();
    if (delay <= 0) {
      endCall();
      return;
    }
    setTimeout(() => {
      if (isMountedRef.current) endCall();
    }, delay);
  }, []);
  useEffect(() => {
    setDisableLocalFilter(forceStablePreviewMode);
  }, [activeEffect, forceStablePreviewMode]);
  useEffect(() => {
    remoteVolumeRef.current = remoteVolume;
    remoteMutedRef.current = isRemoteMuted;
    const volume = isRemoteMuted ? 0 : remoteVolume;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = volume;
      remoteAudioRef.current.muted = false;
    }
  }, [remoteVolume, isRemoteMuted]);
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl) return;
    const onEnterPip = () => setIsRemotePip(true);
    const onLeavePip = () => setIsRemotePip(false);
    videoEl.addEventListener("enterpictureinpicture", onEnterPip);
    videoEl.addEventListener("leavepictureinpicture", onLeavePip);
    return () => {
      videoEl.removeEventListener("enterpictureinpicture", onEnterPip);
      videoEl.removeEventListener("leavepictureinpicture", onLeavePip);
    };
  }, [remoteStream]);
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.enumerateDevices) return;
    let cancelled = false;
    const loadOutputs = async () => {
      try {
        const devices = await md.enumerateDevices();
        if (cancelled) return;
        const outputs = devices.filter((d) => d.kind === "audiooutput");
        setAudioOutputs(outputs);
        if (outputs.length > 0 && !outputs.some((d) => d.deviceId === selectedAudioOutput)) {
          setSelectedAudioOutput(outputs[0].deviceId || "default");
        }
      } catch (e) {
        console.warn("Failed to enumerate audio outputs:", e);
      }
    };
    loadOutputs();
    md.addEventListener?.("devicechange", loadOutputs);
    return () => {
      cancelled = true;
      md.removeEventListener?.("devicechange", loadOutputs);
    };
  }, [selectedAudioOutput]);
  useEffect(() => {
    if (!canSelectAudioOutput) return;
    const applySink = async (el) => {
      if (!el || typeof el.setSinkId !== "function") return;
      try {
        await el.setSinkId(selectedAudioOutput || "default");
      } catch (e) {
        console.warn("setSinkId failed:", e);
      }
    };
    applySink(remoteAudioRef.current);
    applySink(remoteVideoRef.current);
  }, [selectedAudioOutput, canSelectAudioOutput, remoteStream]);
  useEffect(() => {
  // Start counting as soon as the call UI is shown (even while "接続確認中"),
  // and reset is handled by resetCallState() when the call ends.
  if (!callStartedAtRef.current) callStartedAtRef.current = Date.now();
  const timer = setInterval(() => {
    if (!callStartedAtRef.current) return;
    const elapsed = Math.floor((Date.now() - callStartedAtRef.current) / 1e3);
    setCallDurationSec(elapsed);
  }, 1e3);
  return () => clearInterval(timer);
}, []);
  useEffect(() => {
    qualityModeRef.current = qualityMode;
  }, [qualityMode]);
  useEffect(() => {
    audioPrefsRef.current = {
      noiseSuppression: noiseSuppressionEnabled,
      echoCancellation: echoCancellationEnabled,
      autoGainControl: autoGainControlEnabled
    };
    const stream = localStreamRef.current;
    const track = stream?.getAudioTracks?.()[0];
    if (!track?.applyConstraints) return;
    track.applyConstraints({
      advanced: [
        {
          noiseSuppression: noiseSuppressionEnabled,
          echoCancellation: echoCancellationEnabled,
          autoGainControl: autoGainControlEnabled,
          volume: micGain
        }
      ]
    }).catch(() => null);
  }, [noiseSuppressionEnabled, echoCancellationEnabled, autoGainControlEnabled, micGain]);
  useEffect(() => {
    const effectiveVolume = isRemoteMuted ? 0 : Math.min(1, remoteVolume * remoteBoost);
    if (remoteAudioRef.current) remoteAudioRef.current.volume = effectiveVolume;
  }, [remoteVolume, remoteBoost, isRemoteMuted]);
  useEffect(() => {
    if (!autoHideControls || showAdvancedPanel) {
      setControlsVisible(true);
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
      return;
    }
    const showTemporarily = () => {
      setControlsVisible(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && !showAdvancedPanel) setControlsVisible(false);
      }, 2800);
    };
    showTemporarily();
    window.addEventListener("pointermove", showTemporarily);
    window.addEventListener("pointerdown", showTemporarily);
    window.addEventListener("keydown", showTemporarily);
    return () => {
      window.removeEventListener("pointermove", showTemporarily);
      window.removeEventListener("pointerdown", showTemporarily);
      window.removeEventListener("keydown", showTemporarily);
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
    };
  }, [autoHideControls, showAdvancedPanel]);
  useEffect(() => {
    if (showAdvancedPanel) setControlsVisible(true);
  }, [showAdvancedPanel]);
  useEffect(() => {
    let cancelled = false;
    const applyWakeLock = async () => {
      if (!("wakeLock" in navigator)) return;
      if (!keepAwake || !isConnected) {
        if (wakeLockRef.current) {
          try {
            await wakeLockRef.current.release();
          } catch {
          }
          wakeLockRef.current = null;
        }
        return;
      }
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release().catch(() => null);
          return;
        }
        wakeLockRef.current = sentinel;
      } catch {
      }
    };
    applyWakeLock();
    return () => {
      cancelled = true;
    };
  }, [keepAwake, isConnected]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.key === "m" || e.key === "M") toggleMute();
      if (e.key === "v" || e.key === "V") toggleVideo();
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === "p" || e.key === "P") togglePictureInPicture();
      if (e.key === "s" || e.key === "S") captureCallSnapshot();
      if (e.key === "h" || e.key === "H") toggleHold();
      if (e.key === "?") setShowShortcutHelp((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (autoSnapshotTimerRef.current) {
      clearInterval(autoSnapshotTimerRef.current);
      autoSnapshotTimerRef.current = null;
    }
    if (autoSnapshotSec <= 0) return;
    const hasRemoteVideoNow = hasRemoteVideoTrack || remoteStream?.getVideoTracks?.().some((track) => track.readyState === "live");
    if (!hasRemoteVideoNow) return;
    autoSnapshotTimerRef.current = setInterval(() => {
      captureCallSnapshot();
    }, autoSnapshotSec * 1e3);
    return () => {
      if (autoSnapshotTimerRef.current) {
        clearInterval(autoSnapshotTimerRef.current);
        autoSnapshotTimerRef.current = null;
      }
    };
  }, [autoSnapshotSec, hasRemoteVideoTrack, remoteStream]);
  const tryPlayRemoteMedia = useCallback(async () => {
    let audioFailed = false;
    let videoFailed = false;
    const audioEl = remoteAudioRef.current;
    const videoEl = remoteVideoRef.current;
    const mediaStream = videoEl?.srcObject || audioEl?.srcObject || remoteStreamRef.current || remoteStream;
    // Ensure elements reference the latest remote MediaStream (some webviews ignore early srcObject assignments).
    if (mediaStream) {
      if (audioEl && audioEl.srcObject !== mediaStream) audioEl.srcObject = mediaStream;
      if (videoEl && videoEl.srcObject !== mediaStream) videoEl.srcObject = mediaStream;
    }
    const hasVideoTrack = hasRemoteVideoTrackRef.current || !!mediaStream?.getVideoTracks?.().some((track) => track.readyState === "live");
    const hasAudioTrack = !!mediaStream?.getAudioTracks?.().some((track) => track.readyState === "live");
    if (audioEl) {
      audioEl.muted = false;
      audioEl.volume = remoteMutedRef.current ? 0 : remoteVolumeRef.current;
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      if (hasAudioTrack) {
        try {
          await audioEl.play();
        } catch {
          audioFailed = true;
        }
      } else {
        audioEl.pause();
      }
    }
    if (videoEl) {
      // Keep video muted so autoplay succeeds across browsers; audio is handled by remoteAudioRef.
      videoEl.muted = true;
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      if (hasVideoTrack) {
        try {
          await videoEl.play();
        } catch {
          videoFailed = true;
        }
      } else {
        videoEl.pause();
      }
    }
    // Fallback: if audio element playback fails, try routing audio through video element.
    if (audioFailed && hasAudioTrack && hasVideoTrack && videoEl) {
      try {
        videoEl.muted = false;
        await videoEl.play();
        audioFailed = false;
      } catch {
        videoFailed = true;
      }
    }
    setNeedsRemotePlay(audioFailed || videoFailed);
    return !(audioFailed || videoFailed);
  }, [remoteStream]);
  useEffect(() => {
    const becameConnected = isConnected && !prevConnectedRef.current;
    if (becameConnected) {
      if (playConnectSound) playNotificationSound();
      if (vibrateOnConnect && navigator.vibrate) navigator.vibrate([120, 60, 120]);
      tryPlayRemoteMedia();
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, playConnectSound, vibrateOnConnect, tryPlayRemoteMedia]);
  const recoverLocalPreviewPlayback = useCallback(() => {
    const videoEl = localVideoRef.current;
    const stream = localStreamRef.current;
    if (!videoEl || !stream) return;
    try {
      videoEl.pause();
    } catch {
    }
    try {
      videoEl.srcObject = null;
    } catch {
    }
    const reattach = () => {
      if (!isMountedRef.current) return;
      try {
        videoEl.srcObject = stream;
        videoEl.muted = true;
        const p = videoEl.play?.();
        if (p?.catch) p.catch(() => null);
      } catch {
      }
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(reattach);
    } else {
      setTimeout(reattach, 0);
    }
  }, []);
  const handleLocalVideoRenderIssue = useCallback(() => {
    if (activeEffect && activeEffect !== "Normal") {
      setDisableLocalFilter(true);
      recoverLocalPreviewPlayback();
    }
  }, [activeEffect, recoverLocalPreviewPlayback]);
  const localFilter = disableLocalFilter || forceStablePreviewMode ? "none" : getFilterStyle(activeEffect);
  const isEffectSuppressed = !!(activeEffect && activeEffect !== "Normal" && (disableLocalFilter || forceStablePreviewMode));
  const hasRemoteVideo = hasRemoteVideoTrack || remoteStream?.getVideoTracks?.().some((track) => track.readyState === "live");
  useEffect(() => {
    if (disableLocalFilter) {
      recoverLocalPreviewPlayback();
    }
  }, [disableLocalFilter, recoverLocalPreviewPlayback]);
  useEffect(() => {
    if (localVideoFreezeWatchdogRef.current) {
      clearInterval(localVideoFreezeWatchdogRef.current);
      localVideoFreezeWatchdogRef.current = null;
    }
    if (localVideoTimeProbeRef.current) {
      clearInterval(localVideoTimeProbeRef.current);
      localVideoTimeProbeRef.current = null;
    }
    const videoEl = localVideoRef.current;
    if (!videoEl || localFilter === "none") return;
    let stopped = false;
    lastLocalFrameAtRef.current = performance.now();
    const hasRVFC = typeof videoEl.requestVideoFrameCallback === "function";
    const onFrame = () => {
      if (stopped) return;
      lastLocalFrameAtRef.current = performance.now();
      if (hasRVFC) {
        localVideoFrameCallbackIdRef.current = videoEl.requestVideoFrameCallback(onFrame);
      }
    };
    if (hasRVFC) {
      localVideoFrameCallbackIdRef.current = videoEl.requestVideoFrameCallback(onFrame);
    } else {
      let lastCurrentTime = Number.isFinite(videoEl.currentTime) ? videoEl.currentTime : -1;
      const timeProbe = setInterval(() => {
        if (stopped) return;
        const t = videoEl.currentTime;
        if (!Number.isFinite(t)) return;
        if (t !== lastCurrentTime) {
          lastCurrentTime = t;
          lastLocalFrameAtRef.current = performance.now();
        }
      }, 250);
      localVideoTimeProbeRef.current = timeProbe;
    }
    const watchdog = setInterval(() => {
      if (stopped) return;
      const stream = localStreamRef.current;
      const hasLiveEnabledVideo = !!stream?.getVideoTracks?.().some((t) => t.readyState === "live" && t.enabled);
      if (!hasLiveEnabledVideo || videoEl.paused || videoEl.ended) return;
      if (videoEl.readyState < 2) return;
      if (performance.now() - lastLocalFrameAtRef.current > 1800) {
        setDisableLocalFilter(true);
        recoverLocalPreviewPlayback();
      }
    }, 700);
    if (localVideoFreezeWatchdogRef.current) {
      clearInterval(localVideoFreezeWatchdogRef.current);
    }
    localVideoFreezeWatchdogRef.current = watchdog;
    return () => {
      stopped = true;
      if (localVideoFreezeWatchdogRef.current) {
        clearInterval(localVideoFreezeWatchdogRef.current);
        localVideoFreezeWatchdogRef.current = null;
      }
      if (localVideoTimeProbeRef.current) {
        clearInterval(localVideoTimeProbeRef.current);
        localVideoTimeProbeRef.current = null;
      }
      if (hasRVFC && localVideoFrameCallbackIdRef.current != null && typeof videoEl.cancelVideoFrameCallback === "function") {
        videoEl.cancelVideoFrameCallback(localVideoFrameCallbackIdRef.current);
        localVideoFrameCallbackIdRef.current = null;
      }
    };
  }, [localFilter, recoverLocalPreviewPlayback]);
  const cleanup = useCallback(() => {
    unsubscribersRef.current.forEach((u) => {
      try {
        u();
      } catch {
      }
    });
    unsubscribersRef.current = [];
    try {
      if (pcRef.current) {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.close();
      }
    } catch {
    }
    pcRef.current = null;
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
    if (localVideoFreezeWatchdogRef.current) {
      clearInterval(localVideoFreezeWatchdogRef.current);
      localVideoFreezeWatchdogRef.current = null;
    }
    if (localVideoTimeProbeRef.current) {
      clearInterval(localVideoTimeProbeRef.current);
      localVideoTimeProbeRef.current = null;
    }
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (callRecordingTimerRef.current) {
      clearInterval(callRecordingTimerRef.current);
      callRecordingTimerRef.current = null;
    }
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
    if (autoSnapshotTimerRef.current) {
      clearInterval(autoSnapshotTimerRef.current);
      autoSnapshotTimerRef.current = null;
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release?.().catch(() => null);
      wakeLockRef.current = null;
    }
    try {
      if (callRecorderRef.current && callRecorderRef.current.state !== "inactive") {
        callRecorderRef.current.stop();
      }
    } catch {
    }
    callRecorderRef.current = null;
    callRecordingChunksRef.current = [];
    setIsRecordingCall(false);
    setRecordingDurationSec(0);
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    } catch {
    }
    localStreamRef.current = null;
    try {
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    } catch {
    }
    remoteStreamRef.current = new MediaStream();
    setRemoteStream(null);
    hasRemoteVideoTrackRef.current = false;
    setHasRemoteVideoTrack(false);
    setNeedsRemotePlay(false);
    pendingCandidatesRef.current = [];
    applyingRemoteOfferRef.current = false;
    applyingRemoteAnswerRef.current = false;
    reconnectAttemptsRef.current = 0;
    isRecoveringRef.current = false;
    lastRemoteOfferSdpRef.current = "";
    lastRemoteAnswerSdpRef.current = "";
    prevOutboundStatsRef.current = { packetsSent: 0, packetsLost: 0 };
    appliedProfileRef.current = "";
    callStartedAtRef.current = null;
    setIsConnected(false);
    setCallDurationSec(0);
    setNetworkQuality("checking");
    setIsScreenSharing(false);
    if (screenTrackRef.current) {
      try {
        screenTrackRef.current.onended = null;
        screenTrackRef.current.stop();
      } catch {
      }
      screenTrackRef.current = null;
    }
  }, []);
  const getMediaErrorMessage = (err) => {
    const name = err?.name || "";
    if (name === "NotAllowedError" || name === "SecurityError") return "\u30AB\u30E1\u30E9/\u30DE\u30A4\u30AF\u306E\u5229\u7528\u304C\u8A31\u53EF\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u30D6\u30E9\u30A6\u30B6\u8A2D\u5B9A\u3067\u8A31\u53EF\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
    if (name === "NotFoundError") return "\u30AB\u30E1\u30E9\u307E\u305F\u306F\u30DE\u30A4\u30AF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002";
    if (name === "NotReadableError") return "\u30AB\u30E1\u30E9/\u30DE\u30A4\u30AF\u3092\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u3002\u4ED6\u306E\u30A2\u30D7\u30EA\u304C\u4F7F\u7528\u4E2D\u306E\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002";
    return "\u30AB\u30E1\u30E9/\u30DE\u30A4\u30AF\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002";
  };
  const flushPendingCandidates = async (pc) => {
    const list = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of list) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("Failed to add queued candidate:", e);
      }
    }
  };
  useEffect(() => {
    isMountedRef.current = true;
    initAudioContext();
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!chatId || !user?.uid) return;
      if (startedRef.current) return;
      startedRef.current = true;
      const localIsCaller = typeof isCallerProp === "boolean" ? isCallerProp : callData?.callerId === user.uid;
      if (!sessionId) {
        setCallError("\u901A\u8A71\u30BB\u30C3\u30B7\u30E7\u30F3\u304C\u7121\u52B9\u3067\u3059\u3002");
        safeEndCall(1500);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCallError("\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306F\u901A\u8A71\u306B\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u305B\u3093\u3002");
        safeEndCall(1500);
        return;
      }
      const signalingRef = doc(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "session");
      const candidatesCol = collection(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "candidates", "list");
      const pc = new RTCPeerConnection(buildRtcConfig(false));
      pcRef.current = pc;
      const applyAdaptiveProfile = async (profile) => {
        if (!pcRef.current) return;
        const key = `${profile.videoBitrate}-${profile.videoScale}-${profile.videoFps}-${profile.audioBitrate}`;
        if (appliedProfileRef.current === key) return;
        const senders = pcRef.current.getSenders();
        await Promise.all(
          senders.map(async (sender) => {
            if (!sender?.track) return;
            const kind = sender.track.kind;
            const params = sender.getParameters?.() || {};
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            try {
              if (kind === "video") {
                sender.track.contentHint = "motion";
                params.degradationPreference = "balanced";
                params.encodings[0].maxBitrate = profile.videoBitrate;
                params.encodings[0].scaleResolutionDownBy = profile.videoScale;
                params.encodings[0].maxFramerate = profile.videoFps;
                await sender.setParameters(params);
              } else if (kind === "audio") {
                sender.track.contentHint = "speech";
                params.encodings[0].maxBitrate = profile.audioBitrate;
                await sender.setParameters(params);
              }
            } catch (e) {
              console.warn("Failed to set sender params:", e);
            }
          })
        );
        appliedProfileRef.current = key;
      };
      const getProfileByNetwork = (level) => {
        if (level === "low") {
          return { videoBitrate: 220000, videoScale: 2.4, videoFps: 10, audioBitrate: 16000 };
        }
        if (level === "poor") {
          return { videoBitrate: 320000, videoScale: 2.1, videoFps: 12, audioBitrate: 22000 };
        }
        if (level === "medium") {
          return { videoBitrate: 700000, videoScale: 1.5, videoFps: 18, audioBitrate: 36000 };
        }
        if (level === "high") {
          return { videoBitrate: 1300000, videoScale: 1.1, videoFps: 24, audioBitrate: 64000 };
        }
        return { videoBitrate: 1000000, videoScale: 1.2, videoFps: 20, audioBitrate: 48000 };
      };
      const startAdaptiveBitrateController = () => {
        if (statsTimerRef.current) clearInterval(statsTimerRef.current);
        const manualMode = qualityModeRef.current;
        if (manualMode !== "auto") {
          const level = manualMode === "low" ? "low" : manualMode === "medium" ? "medium" : "high";
          setNetworkQuality(level === "low" ? "poor" : level === "medium" ? "medium" : "good");
          applyAdaptiveProfile(getProfileByNetwork(level));
        } else {
        const connType = navigator.connection?.effectiveType || "";
        if (connType === "slow-2g" || connType === "2g") {
          setNetworkQuality("poor");
          applyAdaptiveProfile(getProfileByNetwork("poor"));
        } else if (connType === "3g") {
          setNetworkQuality("medium");
          applyAdaptiveProfile(getProfileByNetwork("medium"));
        } else {
          setNetworkQuality("good");
          applyAdaptiveProfile(getProfileByNetwork("good"));
        }
        }
        statsTimerRef.current = setInterval(async () => {
          if (!pcRef.current || pcRef.current.connectionState === "closed") return;
          try {
            const manual = qualityModeRef.current;
            if (manual !== "auto") {
              const manualLevel = manual === "low" ? "low" : manual === "medium" ? "medium" : "high";
              setNetworkQuality(manualLevel === "low" ? "poor" : manualLevel === "medium" ? "medium" : "good");
              await applyAdaptiveProfile(getProfileByNetwork(manualLevel));
              return;
            }
            const report = await pcRef.current.getStats();
            let outboundPacketsSent = 0;
            let outboundPacketsLost = 0;
            let rtt = 0;
            report.forEach((stat) => {
              if (stat.type === "outbound-rtp" && !stat.isRemote) {
                outboundPacketsSent += stat.packetsSent || 0;
              }
              if (stat.type === "remote-inbound-rtp") {
                outboundPacketsLost += stat.packetsLost || 0;
                if (!rtt && stat.roundTripTime) rtt = stat.roundTripTime;
              }
              if (stat.type === "candidate-pair" && stat.state === "succeeded" && stat.currentRoundTripTime && !rtt) {
                rtt = stat.currentRoundTripTime;
              }
            });
            const prev = prevOutboundStatsRef.current;
            const sentDelta = Math.max(0, outboundPacketsSent - prev.packetsSent);
            const lostDelta = Math.max(0, outboundPacketsLost - prev.packetsLost);
            const lossRate = sentDelta > 0 ? lostDelta / sentDelta : 0;
            prevOutboundStatsRef.current = { packetsSent: outboundPacketsSent, packetsLost: outboundPacketsLost };
            let level = "good";
            if (rtt > 0.8 || lossRate > 0.08) level = "poor";
            else if (rtt > 0.35 || lossRate > 0.03) level = "medium";
            setNetworkQuality(level);
            await applyAdaptiveProfile(getProfileByNetwork(level));
          } catch (e) {
            console.warn("Adaptive bitrate stats failed:", e);
          }
        }, 3e3);
      };
      const attemptIceRecovery = async () => {
        if (!localIsCaller || !pcRef.current) return;
        if (isRecoveringRef.current) return;
        if (reconnectAttemptsRef.current >= 3) return;
        if (pc.signalingState !== "stable") return;
        isRecoveringRef.current = true;
        reconnectAttemptsRef.current += 1;
        try {
          if (hasTurnConfig && reconnectAttemptsRef.current >= 2) {
            try {
              pc.setConfiguration(buildRtcConfig(true));
            } catch {
            }
          }
          const restartOffer = await pc.createOffer({
            iceRestart: true,
            offerToReceiveAudio: true,
            offerToReceiveVideo: !!isVideoEnabled
          });
          await pc.setLocalDescription(restartOffer);
          await setDoc(
            signalingRef,
            {
              sessionId,
              callerId: callData?.callerId || user.uid,
              offerSdp: restartOffer.sdp,
              offererId: user.uid,
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
        } catch (e) {
          isRecoveringRef.current = false;
          console.warn("ICE restart failed:", e);
        }
      };
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected" || state === "connecting") {
          if (state === "connected") {
            setIsConnected(true);
            if (!callStartedAtRef.current) callStartedAtRef.current = Date.now();
          }
          reconnectAttemptsRef.current = 0;
          isRecoveringRef.current = false;
          if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
          }
          return;
        }
        if (state === "disconnected" || state === "failed") {
          setIsConnected(false);
          attemptIceRecovery();
          if (disconnectTimerRef.current) return;
          disconnectTimerRef.current = setTimeout(() => {
            disconnectTimerRef.current = null;
            if (!pcRef.current) return;
            const currentState = pcRef.current.connectionState;
            const iceState = pcRef.current.iceConnectionState;
            if (currentState === "connected" || currentState === "connecting") return;
            if (iceState === "connected" || iceState === "completed") return;
            setCallError("\u63A5\u7D9A\u304C\u5207\u65AD\u3055\u308C\u307E\u3057\u305F\u3002");
            safeEndCall(1200);
          }, 45e3);
          return;
        }
        if (state === "closed") {
          setIsConnected(false);
          setCallError("\u63A5\u7D9A\u304C\u5207\u65AD\u3055\u308C\u307E\u3057\u305F\u3002");
          safeEndCall(1200);
        }
      };
      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        if (iceState === "connected" || iceState === "completed") {
          reconnectAttemptsRef.current = 0;
          isRecoveringRef.current = false;
        } else if (iceState === "disconnected" || iceState === "failed") {
          attemptIceRecovery();
        }
      };
      pc.ontrack = async (event) => {
        const directStream = event.streams?.[0];
        const stream = directStream || remoteStreamRef.current;
        if (!directStream && event.track) {
          const exists = stream.getTracks().some((track) => track.id === event.track.id);
          if (!exists) stream.addTrack(event.track);
        }
        remoteStreamRef.current = stream;
        if (event.track) {
          event.track.onunmute = () => {
            if (!isMountedRef.current) return;
            tryPlayRemoteMedia();
          };
          event.track.onmute = () => {
            const hasLiveVideo2 = stream.getVideoTracks().some((track) => track.readyState === "live");
            hasRemoteVideoTrackRef.current = hasLiveVideo2;
            setHasRemoteVideoTrack(hasLiveVideo2);
          };
          event.track.onended = () => {
            const hasLiveVideo2 = stream.getVideoTracks().some((track) => track.readyState === "live");
            hasRemoteVideoTrackRef.current = hasLiveVideo2;
            setHasRemoteVideoTrack(hasLiveVideo2);
          };
        }
        const hasLiveVideo = stream.getVideoTracks().some((track) => track.readyState === "live");
        hasRemoteVideoTrackRef.current = hasLiveVideo;
        setHasRemoteVideoTrack(hasLiveVideo);
        setRemoteStream(stream);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
        const played = await tryPlayRemoteMedia();
        if (!played) {
          setTimeout(() => {
            if (isMountedRef.current) tryPlayRemoteMedia();
          }, 800);
        }
      };
      pc.onicecandidate = async (event) => {
        if (!event.candidate) return;
        try {
          await addDoc(candidatesCol, {
            sessionId,
            senderId: user.uid,
            candidate: event.candidate.toJSON(),
            createdAt: serverTimestamp()
          });
        } catch (e) {
          console.warn("Failed to publish ICE candidate:", e);
        }
      };
      try {
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        const hasVideoInput = devices.some((d) => d.kind === "videoinput");
        // NOTE: Some browsers/webviews (especially on mobile) hide devices until permission is granted.
        // Do not block requesting video solely based on enumerateDevices() results.
        const wantVideo = !!isVideoEnabled;
        let stream = null;
        try {
          const ap = audioPrefsRef.current || {};
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: ap.echoCancellation !== false,
              noiseSuppression: ap.noiseSuppression !== false,
              autoGainControl: ap.autoGainControl !== false,
              channelCount: 1
            },
            video: wantVideo ? {
              facingMode: "user",
              width: { ideal: 480, max: 960 },
              height: { ideal: 270, max: 540 },
              frameRate: { ideal: 20, max: 24 }
            } : false
          });
        } catch (err) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: wantVideo ? { facingMode: "user" } : false
            });
            if (wantVideo && stream.getVideoTracks().length === 0) {
              setIsVideoOff(true);
            }
          } catch (fallbackErr) {
            if (wantVideo) {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              setIsVideoOff(true);
            } else {
              throw fallbackErr;
            }
          }
        }
        if (!stream) throw new Error("No local stream");
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          try {
            await localVideoRef.current.play();
          } catch {
          }
        }
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        startAdaptiveBitrateController();
      } catch (err) {
        console.error("Failed to start local media:", err);
        setCallError(getMediaErrorMessage(err));
        safeEndCall(2500);
        return;
      }
      const unsubSignal = onSnapshot(signalingRef, async (snap) => {
        if (!pcRef.current) return;
        const data = snap.data();
        if (!data || data.sessionId !== sessionId) return;
        try {
          if (localIsCaller) {
            const canApplyAnswer = pc.signalingState === "have-local-offer";
            const hasNewAnswer = data.answerSdp && data.answerSdp !== lastRemoteAnswerSdpRef.current;
            if (hasNewAnswer && canApplyAnswer && !applyingRemoteAnswerRef.current) {
              applyingRemoteAnswerRef.current = true;
              try {
                await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.answerSdp }));
                lastRemoteAnswerSdpRef.current = data.answerSdp;
                isRecoveringRef.current = false;
                await flushPendingCandidates(pc);
              } finally {
                applyingRemoteAnswerRef.current = false;
              }
            }
          } else {
            const canApplyOffer = pc.signalingState === "stable";
            const hasNewOffer = data.offerSdp && data.offerSdp !== lastRemoteOfferSdpRef.current;
            if (hasNewOffer && canApplyOffer && !applyingRemoteOfferRef.current) {
              applyingRemoteOfferRef.current = true;
              try {
                await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: data.offerSdp }));
                lastRemoteOfferSdpRef.current = data.offerSdp;
                await flushPendingCandidates(pc);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await setDoc(
                  signalingRef,
                  {
                    sessionId,
                    answerSdp: answer.sdp,
                    answererId: user.uid,
                    updatedAt: serverTimestamp()
                  },
                  { merge: true }
                );
              } finally {
                applyingRemoteOfferRef.current = false;
              }
            }
          }
        } catch (e) {
          const msg = e?.message || "";
          if (e?.name === "InvalidStateError" && /wrong state:\s*stable/i.test(msg)) return;
          console.warn("Signaling sync failed:", e);
        }
      });
      unsubscribersRef.current.push(unsubSignal);
      const candidateQuery = query(candidatesCol, where("sessionId", "==", sessionId));
      const unsubCandidates = onSnapshot(candidateQuery, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type !== "added") return;
          const data = change.doc.data();
          if (!data || data.senderId === user.uid || !data.candidate) return;
          try {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } else {
              pendingCandidatesRef.current.push(data.candidate);
            }
          } catch (e) {
            console.warn("Failed to add ICE candidate:", e);
          }
        });
      });
      unsubscribersRef.current.push(unsubCandidates);
      if (localIsCaller) {
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: !!isVideoEnabled
          });
          await pc.setLocalDescription(offer);
          await setDoc(
            signalingRef,
            {
              sessionId,
              callerId: callData?.callerId || user.uid,
              offerSdp: offer.sdp,
              offererId: user.uid,
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
        } catch (e) {
          console.error("Failed to create offer:", e);
          setCallError("\u901A\u8A71\u306E\u958B\u59CB\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002");
          safeEndCall(1500);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
      cleanup();
      startedRef.current = false;
    };
  }, [chatId, user?.uid, isVideoEnabled, sessionId, isCallerProp, callData?.callerId, cleanup, safeEndCall, tryPlayRemoteMedia]);
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    const hasLiveVideo = remoteStream?.getVideoTracks?.().some((track) => track.readyState === "live") || false;
    hasRemoteVideoTrackRef.current = hasLiveVideo;
    setHasRemoteVideoTrack(hasLiveVideo);
    if (remoteStream) {
      tryPlayRemoteMedia();
    }
  }, [remoteStream, tryPlayRemoteMedia]);
  useEffect(() => {
    const audioEl = remoteAudioRef.current;
    const videoEl = remoteVideoRef.current;
    if (!audioEl && !videoEl) return;
    const resume = () => {
      tryPlayRemoteMedia();
    };
    audioEl?.addEventListener("loadedmetadata", resume);
    audioEl?.addEventListener("canplay", resume);
    videoEl?.addEventListener("loadedmetadata", resume);
    videoEl?.addEventListener("canplay", resume);
    return () => {
      audioEl?.removeEventListener("loadedmetadata", resume);
      audioEl?.removeEventListener("canplay", resume);
      videoEl?.removeEventListener("loadedmetadata", resume);
      videoEl?.removeEventListener("canplay", resume);
    };
  }, [remoteStream, tryPlayRemoteMedia]);
  useEffect(() => {
    const tryResume = () => {
      if (!needsRemotePlay) return;
      tryPlayRemoteMedia();
    };
    window.addEventListener("pointerdown", tryResume);
    window.addEventListener("keydown", tryResume);
    return () => {
      window.removeEventListener("pointerdown", tryResume);
      window.removeEventListener("keydown", tryResume);
    };
  }, [needsRemotePlay, tryPlayRemoteMedia]);
  const networkQualityLabel = networkQuality === "good" ? "\u56DE\u7DDA: \u826F\u597D" : networkQuality === "medium" ? "\u56DE\u7DDA: \u666E\u901A" : networkQuality === "poor" ? "\u56DE\u7DDA: \u4E0D\u5B89\u5B9A" : "\u56DE\u7DDA: \u78BA\u8A8D\u4E2D";
  const networkQualityClass = networkQuality === "good" ? "bg-emerald-500/80 text-white" : networkQuality === "medium" ? "bg-yellow-500/80 text-black" : networkQuality === "poor" ? "bg-red-500/80 text-white" : "bg-gray-500/80 text-white";
  const qualityModeLabel = qualityMode === "auto" ? "画質: 自動" : qualityMode === "low" ? "画質: 低" : qualityMode === "medium" ? "画質: 中" : "画質: 高";
  const remoteVideoTransform = `${isRemoteMirror ? "scaleX(-1) " : ""}scale(${remoteZoom})`.trim();
  const remoteVideoFilter = `brightness(${remoteBrightness}%) contrast(${remoteContrast}%) saturate(${remoteSaturation}%)`;
  const localVideoTransform = `${isLocalMirror ? "scaleX(-1) " : ""}scale(${localZoom})`.trim();
  const formatCallDuration = (sec) => {
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };
  const startCallRecording = () => {
    if (isRecordingCall || typeof MediaRecorder === "undefined") return;
    try {
      let recordStream = null;
      if (callStageRef.current?.captureStream) {
        recordStream = callStageRef.current.captureStream(24);
      } else if (remoteStreamRef.current?.getTracks?.().length) {
        recordStream = remoteStreamRef.current;
      }
      if (!recordStream || !recordStream.getTracks || recordStream.getTracks().length === 0) return;
      let recorder = null;
      const supportedMime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported?.(m));
      try {
        recorder = supportedMime ? new MediaRecorder(recordStream, { mimeType: supportedMime }) : new MediaRecorder(recordStream);
      } catch {
        recorder = new MediaRecorder(recordStream);
      }
      callRecorderRef.current = recorder;
      callRecordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          callRecordingChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const chunks = callRecordingChunksRef.current;
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `call_${sessionId || Date.now()}.webm`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1e3);
        }
        callRecordingChunksRef.current = [];
      };
      recorder.start(1e3);
      setIsRecordingCall(true);
      setRecordingDurationSec(0);
      if (callRecordingTimerRef.current) clearInterval(callRecordingTimerRef.current);
      callRecordingTimerRef.current = setInterval(() => {
        setRecordingDurationSec((prev) => prev + 1);
      }, 1e3);
    } catch (e) {
      console.warn("Call recording failed:", e);
    }
  };
  const stopCallRecording = () => {
    if (callRecordingTimerRef.current) {
      clearInterval(callRecordingTimerRef.current);
      callRecordingTimerRef.current = null;
    }
    setIsRecordingCall(false);
    setRecordingDurationSec(0);
    try {
      if (callRecorderRef.current && callRecorderRef.current.state !== "inactive") {
        callRecorderRef.current.stop();
      }
    } catch (e) {
      console.warn("Stop recording failed:", e);
    }
  };
  const toggleCallRecording = () => {
    if (isRecordingCall) {
      stopCallRecording();
    } else {
      startCallRecording();
    }
  };
  const captureCallSnapshotNow = () => {
    const source = hasRemoteVideo ? remoteVideoRef.current : localVideoRef.current;
    if (!source) return;
    const w = source.videoWidth || 0;
    const h = source.videoHeight || 0;
    if (!w || !h) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(source, 0, 0, w, h);
      if (snapshotTimestampEnabled) {
        const stamp = new Date().toLocaleString();
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(8, h - 34, 220, 24);
        ctx.fillStyle = "white";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(stamp, 14, h - 17);
      }
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `call_snapshot_${Date.now()}.png`;
      a.click();
    } catch (e) {
      console.warn("Snapshot failed:", e);
    }
  };
  const captureCallSnapshot = () => {
    if (snapshotCountdownSec <= 0) {
      captureCallSnapshotNow();
      return;
    }
    setTimeout(() => {
      if (isMountedRef.current) captureCallSnapshotNow();
    }, snapshotCountdownSec * 1e3);
  };
  const addBookmark = () => {
    const mark = { id: Date.now(), sec: callDurationSec };
    setBookmarks((prev) => [...prev, mark].slice(-20));
  };
  const removeBookmark = (id) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };
  const copyCallDebugInfo = async () => {
    const info = [
      `chatId=${chatId}`,
      `sessionId=${sessionId}`,
      `isCaller=${isCaller ? "1" : "0"}`,
      `connected=${isConnected ? "1" : "0"}`,
      `durationSec=${callDurationSec}`,
      `network=${networkQuality}`,
      `audioMuted=${isMuted ? "1" : "0"}`,
      `videoEnabled=${isVideoOff ? "0" : "1"}`,
      `screenShare=${isScreenSharing ? "1" : "0"}`,
      `timestamp=${new Date().toISOString()}`
    ].join("\n");
    try {
      await navigator.clipboard.writeText(info);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = info;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (callStageRef.current?.requestFullscreen) {
        await callStageRef.current.requestFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen toggle failed:", e);
    }
  };
  const retryRemotePlayback = async () => {
    initAudioContext();
    await tryPlayRemoteMedia();
  };
  const resumeRemotePlayback = async () => {
    initAudioContext();
    await tryPlayRemoteMedia();
  };
  const openAdvancedSettingsPanel = async () => {
    try {
      if (!document.fullscreenElement) {
        const el = callStageRef.current || document.documentElement;
        if (el?.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el?.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        }
      }
    } catch (e) {
      console.warn("Fullscreen request from settings failed:", e);
    }
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
    setAutoHideControls(false);
    setControlsVisible(true);
    setShowAdvancedPanel(true);
  };
  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const shouldMute = !isMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !shouldMute;
    });
    setIsMuted(shouldMute);
  };
  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const shouldDisableVideo = !isVideoOff;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !shouldDisableVideo;
    });
    setIsVideoOff(shouldDisableVideo);
  };
  const toggleHold = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isHold;
    if (next) {
      preHoldStateRef.current = { isMuted, isVideoOff };
    }
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !(next ? true : preHoldStateRef.current.isMuted);
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !(next ? true : preHoldStateRef.current.isVideoOff);
    });
    setIsMuted(next ? true : preHoldStateRef.current.isMuted);
    setIsVideoOff(next ? true : preHoldStateRef.current.isVideoOff);
    setIsHold(next);
  };
  const handleEndCallRequest = () => {
    if (confirmBeforeHangup) {
      const ok = window.confirm("通話を終了しますか？");
      if (!ok) return;
    }
    onEndCall?.();
  };
  const resetAdvancedSettings = () => {
    setConfirmBeforeHangup(false);
    setAutoHideControls(false);
    setKeepAwake(false);
    setQualityMode("auto");
    setNoiseSuppressionEnabled(true);
    setEchoCancellationEnabled(true);
    setAutoGainControlEnabled(true);
    setMicGain(1);
    setRemoteBoost(1);
    setRemoteBrightness(100);
    setRemoteContrast(100);
    setRemoteSaturation(100);
    setIsRemoteMirror(false);
    setRemoteZoom(1);
    setLocalZoom(1);
    setShowClock(false);
    setSnapshotCountdownSec(0);
    setSnapshotTimestampEnabled(false);
    setAutoSnapshotSec(0);
    setCallNotes("");
    setBookmarks([]);
    setPlayConnectSound(true);
    setVibrateOnConnect(false);
  };
  const replaceOutgoingVideoTrack = async (newTrack) => {
    const pc = pcRef.current;
    if (!pc || !newTrack) return;
    const sender = pc.getSenders().find((s) => s?.track?.kind === "video");
    if (sender) {
      await sender.replaceTrack(newTrack);
    }
  };
  const attachLocalVideoTrack = async (newTrack) => {
    const stream = localStreamRef.current;
    if (!stream || !newTrack) return;
    stream.getVideoTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
      }
      stream.removeTrack(track);
    });
    stream.addTrack(newTrack);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      try {
        await localVideoRef.current.play();
      } catch {
      }
    }
  };
  const switchCameraFacing = async () => {
    if (!isVideoEnabled || isScreenSharing) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    setIsSwitchingCamera(true);
    const nextFacingMode = currentFacingMode === "user" ? "environment" : "user";
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: nextFacingMode },
          width: { ideal: 480, max: 960 },
          height: { ideal: 270, max: 540 },
          frameRate: { ideal: 20, max: 24 }
        }
      });
      const newTrack = cameraStream.getVideoTracks()[0];
      if (!newTrack) throw new Error("No camera track");
      await replaceOutgoingVideoTrack(newTrack);
      await attachLocalVideoTrack(newTrack);
      setCurrentFacingMode(nextFacingMode);
      setIsVideoOff(false);
    } catch (e) {
      console.warn("Camera switch failed:", e);
    } finally {
      setIsSwitchingCamera(false);
    }
  };
  const restoreCameraAfterShare = async () => {
    const cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: currentFacingMode },
        width: { ideal: 480, max: 960 },
        height: { ideal: 270, max: 540 },
        frameRate: { ideal: 20, max: 24 }
      }
    });
    const cameraTrack = cameraStream.getVideoTracks()[0];
    if (!cameraTrack) throw new Error("No camera track");
    await replaceOutgoingVideoTrack(cameraTrack);
    await attachLocalVideoTrack(cameraTrack);
    setIsVideoOff(false);
  };
  const stopScreenShare = async () => {
    if (screenTrackRef.current) {
      try {
        screenTrackRef.current.onended = null;
        screenTrackRef.current.stop();
      } catch {
      }
      screenTrackRef.current = null;
    }
    try {
      await restoreCameraAfterShare();
    } catch (e) {
      console.warn("Restore camera after share failed:", e);
      setIsVideoOff(true);
    } finally {
      setIsScreenSharing(false);
    }
  };
  const toggleScreenShare = async () => {
    if (!isVideoEnabled) return;
    if (!navigator.mediaDevices?.getDisplayMedia) return;
    if (isScreenSharing) {
      await stopScreenShare();
      return;
    }
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const displayTrack = displayStream.getVideoTracks()[0];
      if (!displayTrack) throw new Error("No display track");
      await replaceOutgoingVideoTrack(displayTrack);
      await attachLocalVideoTrack(displayTrack);
      displayTrack.onended = () => {
        if (isMountedRef.current) stopScreenShare();
      };
      screenTrackRef.current = displayTrack;
      setIsScreenSharing(true);
      setIsVideoOff(false);
    } catch (e) {
      console.warn("Screen share start failed:", e);
    }
  };
  const togglePictureInPicture = async () => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl || !hasRemoteVideo) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && !videoEl.disablePictureInPicture) {
        await videoEl.requestPictureInPicture();
      }
    } catch (e) {
      console.warn("PiP toggle failed:", e);
    }
  };
  const resolveCallParticipantCount = (data) => {
    if (!data) return 2;
    const candidates = [
      data.participantCount,
      data.membersCount,
      data.groupSize,
      data.attendeeCount,
      Array.isArray(data.participants) ? data.participants.length : 0
    ];
    const best = Math.max(...candidates.map((v) => Number(v) || 0), 0);
    return best > 0 ? best : data.isGroupCall ? 4 : 2;
  };
  const participantCount = Math.max(2, Math.min(12, resolveCallParticipantCount(callData)));
  const tileColumns = participantCount <= 2 ? 2 : participantCount <= 4 ? 2 : participantCount <= 9 ? 3 : 4;
  const tileMinHeightClass = participantCount <= 2 ? "min-h-[220px] md:min-h-[420px]" : participantCount <= 4 ? "min-h-[150px] md:min-h-[220px]" : "min-h-[110px] md:min-h-[160px]";
  const callTiles = [
    { key: "remote", type: "remote", label: "相手" },
    { key: "local", type: "local", label: "あなた" },
    ...Array.from({ length: Math.max(0, participantCount - 2) }, (_, idx) => ({
      key: `member-${idx + 3}`,
      type: "placeholder",
      label: `参加者${idx + 3}`
    }))
  ];
  const showModernGroupLayout = true;
  if (callError) {
    return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center text-white flex-col gap-4", children: [
      /* @__PURE__ */ jsx(AlertCircle, { className: "w-16 h-16 text-red-500" }),
      /* @__PURE__ */ jsx("p", { className: "font-bold text-lg text-center px-8", children: callError }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-400", children: "\u901A\u8A71\u3092\u7D42\u4E86\u3057\u307E\u3059..." })
    ] });
  }
  if (showModernGroupLayout) {
    return /* @__PURE__ */ jsxs("div", { ref: callStageRef, className: "fixed inset-0 z-[1000] bg-slate-950 text-white flex flex-col", children: [
      /* @__PURE__ */ jsx("audio", { ref: remoteAudioRef, autoPlay: true, playsInline: true, className: "absolute w-0 h-0 opacity-0 pointer-events-none" }),
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,#1e3a8a_0%,#111827_45%,#020617_100%)]" }),
      /* @__PURE__ */ jsxs("div", { className: "relative z-10 px-4 pt-4 pb-3 md:px-6 md:pt-5 md:pb-4 flex flex-wrap items-center gap-2 bg-black/30 backdrop-blur-md border-b border-white/10", children: [
        /* @__PURE__ */ jsx("div", { className: "bg-white/10 border border-white/15 rounded-full px-3 py-1.5 text-sm font-extrabold tracking-wide", children: formatCallDuration(callDurationSec) }),
        /* @__PURE__ */ jsx("div", { className: `rounded-full px-3 py-1.5 text-xs font-extrabold tracking-wide ${isConnected ? "bg-emerald-500 text-white" : "bg-amber-400 text-black"}`, children: isConnected ? "接続中" : "接続確認中" }),
        /* @__PURE__ */ jsx("div", { className: `rounded-full px-3 py-1.5 text-xs font-extrabold tracking-wide ${networkQualityClass}`, children: networkQualityLabel }),
        /* @__PURE__ */ jsxs("div", { className: "bg-indigo-500 text-white rounded-full px-3 py-1.5 text-xs font-extrabold tracking-wide", children: ["参加: ", participantCount] }),
        /* @__PURE__ */ jsx("button", { onClick: openAdvancedSettingsPanel, className: "ml-auto bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-4 py-2 text-xs font-black", children: "設定" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "relative z-10 flex-1 p-4 md:p-6 pb-32", children: /* @__PURE__ */ jsx("div", { className: "grid gap-2.5 md:gap-3 h-full", style: { gridTemplateColumns: `repeat(${tileColumns}, minmax(0, 1fr))` }, children: callTiles.map((tile) => {
            if (tile.type === "remote") {
              return /* @__PURE__ */ jsxs("div", { className: `relative overflow-hidden rounded-3xl border border-cyan-300/30 bg-black ${tileMinHeightClass}`, children: [
                /* @__PURE__ */ jsx("video", { ref: remoteVideoRef, autoPlay: true, playsInline: true, className: "absolute inset-0 w-full h-full object-cover", style: { transform: remoteVideoTransform || "none", filter: remoteVideoFilter } }),
                (!remoteStream || !hasRemoteVideo) && /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55", children: [
                  /* @__PURE__ */ jsx(User, { className: "w-8 h-8 opacity-80" }),
                  /* @__PURE__ */ jsx("p", { className: "text-xs font-bold", children: remoteStream ? "接続中..." : "待機中..." })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "absolute left-2.5 bottom-2.5 text-[10px] font-black bg-black/45 px-2 py-1 rounded-full", children: "相手" })
              ] }, tile.key);
            }
            if (tile.type === "local") {
              return /* @__PURE__ */ jsxs("div", { className: `relative overflow-hidden rounded-3xl border border-emerald-300/35 bg-black ${tileMinHeightClass}`, children: [
                /* @__PURE__ */ jsx("video", { ref: localVideoRef, autoPlay: true, playsInline: true, muted: true, className: "absolute inset-0 w-full h-full object-cover", style: { filter: localFilter, transform: localVideoTransform || "none" }, onError: handleLocalVideoRenderIssue, onStalled: handleLocalVideoRenderIssue, onEmptied: handleLocalVideoRenderIssue, onAbort: handleLocalVideoRenderIssue }),
                (!isVideoEnabled || isVideoOff) && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-black/65", children: /* @__PURE__ */ jsx(VideoOff, { className: "w-8 h-8 opacity-80" }) }),
                /* @__PURE__ */ jsx("div", { className: "absolute left-2.5 bottom-2.5 text-[10px] font-black bg-black/45 px-2 py-1 rounded-full", children: "あなた" })
              ] }, tile.key);
            }
            return /* @__PURE__ */ jsxs("div", { className: `relative overflow-hidden rounded-3xl border border-white/20 bg-slate-900/70 ${tileMinHeightClass} flex flex-col items-center justify-center gap-2`, children: [
              /* @__PURE__ */ jsx(Users, { className: "w-8 h-8 opacity-70" }),
              /* @__PURE__ */ jsx("p", { className: "text-xs font-black opacity-90", children: tile.label }),
              /* @__PURE__ */ jsx("p", { className: "text-[10px] opacity-70", children: "待機中" })
            ] }, tile.key);
          }) }) }),
      needsRemotePlay && /* @__PURE__ */ jsx("button", { onClick: resumeRemotePlayback, className: "absolute top-16 left-1/2 -translate-x-1/2 z-[1012] bg-white text-black font-black text-xs px-4 py-2 rounded-full shadow-lg", children: "音声を再生" }),
      /* @__PURE__ */ jsxs("div", { className: `relative z-[1011] pb-5 px-3 md:px-5 transition-all ${controlsVisible || showAdvancedPanel ? "opacity-100" : "opacity-0 pointer-events-none"}`, children: [
        showShortcutHelp && /* @__PURE__ */ jsx("div", { className: "mb-2 text-[10px] text-white/80 font-bold", children: "Shortcut: M / V / H / S / F / P / ?" }),
        /* @__PURE__ */ jsxs("div", { className: "mx-auto w-full max-w-lg bg-black/40 border border-white/15 rounded-2xl px-5 py-4 backdrop-blur-xl flex items-center justify-center gap-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]", children: [
          /* @__PURE__ */ jsx("button", { onClick: toggleMute, className: `w-12 h-12 rounded-xl flex items-center justify-center ${isMuted ? "bg-white text-black" : "bg-white/15 text-white"}`, children: isMuted ? /* @__PURE__ */ jsx(MicOff, { className: "w-5 h-5" }) : /* @__PURE__ */ jsx(Mic, { className: "w-5 h-5" }) }),
          isVideoEnabled && /* @__PURE__ */ jsx("button", { onClick: toggleVideo, className: `w-12 h-12 rounded-xl flex items-center justify-center ${isVideoOff ? "bg-white text-black" : "bg-white/15 text-white"}`, children: isVideoOff ? /* @__PURE__ */ jsx(VideoOff, { className: "w-5 h-5" }) : /* @__PURE__ */ jsx(Video, { className: "w-5 h-5" }) }),

/* @__PURE__ */ jsx("button", { onClick: toggleScreenShare, disabled: !navigator.mediaDevices?.getDisplayMedia, className: `w-12 h-12 rounded-xl flex items-center justify-center ${isScreenSharing ? "bg-blue-600 text-white" : "bg-white/15 text-white"} ${!navigator.mediaDevices?.getDisplayMedia ? "opacity-40 cursor-not-allowed" : ""}`, children: isScreenSharing ? /* @__PURE__ */ jsx(StopCircle, { className: "w-5 h-5" }) : /* @__PURE__ */ jsx(Upload, { className: "w-5 h-5" }) }),
          /* @__PURE__ */ jsx("button", { onClick: handleEndCallRequest, className: "w-16 h-16 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-2xl ring-1 ring-white/10", children: /* @__PURE__ */ jsx(PhoneOff, { className: "w-6 h-6" }) }),
          /* @__PURE__ */ jsx("button", { onClick: () => setShowAdvancedPanel((v) => !v), className: `w-12 h-12 rounded-xl flex items-center justify-center ${showAdvancedPanel ? "bg-white text-black" : "bg-white/15 text-white"}`, children: /* @__PURE__ */ jsx(MoreVertical, { className: "w-5 h-5" }) })
        ] })
      ] }),
      showAdvancedPanel && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-[1020] bg-black/90 backdrop-blur-md p-4 md:p-6 overflow-y-auto", children: [
        /* @__PURE__ */ jsxs("div", { className: "max-w-2xl mx-auto bg-slate-900/90 border border-white/15 rounded-3xl p-4 md:p-5 text-white space-y-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-black", children: "通話設定" }),
            /* @__PURE__ */ jsx("button", { onClick: () => setShowAdvancedPanel(false), className: "px-3 py-1.5 bg-white/10 rounded-full text-xs font-bold", children: "閉じる" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
            /* @__PURE__ */ jsx("button", { onClick: retryRemotePlayback, className: "px-3 py-2 bg-white/10 rounded-full text-xs font-bold", children: "再生" }),
            /* @__PURE__ */ jsx("button", { onClick: captureCallSnapshot, className: "px-3 py-2 bg-white/10 rounded-full text-xs font-bold", children: "スクショ" }),
            /* @__PURE__ */ jsx("button", { onClick: toggleFullscreen, className: "px-3 py-2 bg-white/10 rounded-full text-xs font-bold", children: "全画面" }),
            /* @__PURE__ */ jsx("button", { onClick: togglePictureInPicture, className: "px-3 py-2 bg-white/10 rounded-full text-xs font-bold", children: "PiP" }),
            /* @__PURE__ */ jsx("button", { onClick: toggleCallRecording, className: "px-3 py-2 bg-white/10 rounded-full text-xs font-bold", children: isRecordingCall ? "録画停止" : "録画" }),
            /* @__PURE__ */ jsx("button", { onClick: toggleHold, className: "px-3 py-2 bg-white/10 rounded-full text-xs font-bold", children: isHold ? "保留中" : "保留" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3 text-xs", children: [
            /* @__PURE__ */ jsx("label", { className: "font-bold", children: ["画質", /* @__PURE__ */ jsx("select", { value: qualityMode, onChange: (e) => setQualityMode(e.target.value), className: "w-full mt-1 bg-black/40 border border-white/20 rounded-lg p-2", children: [
              /* @__PURE__ */ jsx("option", { value: "auto", children: "自動" }),
              /* @__PURE__ */ jsx("option", { value: "low", children: "低" }),
              /* @__PURE__ */ jsx("option", { value: "medium", children: "中" }),
              /* @__PURE__ */ jsx("option", { value: "high", children: "高" })
            ] })] }),
            /* @__PURE__ */ jsx("label", { className: "font-bold", children: ["相手音量", /* @__PURE__ */ jsx("input", { type: "range", min: 0, max: 1, step: 0.05, value: isRemoteMuted ? 0 : remoteVolume, onChange: (e) => {
              const v = Number(e.target.value);
              setRemoteVolume(v);
              if (v > 0 && isRemoteMuted) setIsRemoteMuted(false);
            }, className: "w-full mt-2" })] })
          ] }),
          /* @__PURE__ */ jsx("button", { onClick: resetAdvancedSettings, className: "w-full bg-red-600/80 hover:bg-red-500 text-white py-2 rounded-xl text-xs font-bold", children: "設定リセット" })
        ] })
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { ref: callStageRef, className: "fixed inset-0 z-[1000] bg-[#1f2329] flex flex-col animate-in fade-in", style: { backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : "linear-gradient(180deg, #262b33 0%, #1b1f25 100%)", backgroundSize: "cover" }, children: [
    /* @__PURE__ */ jsxs("div", { className: "relative flex-1 overflow-hidden", children: [
      /* @__PURE__ */ jsx("audio", { ref: remoteAudioRef, autoPlay: true, playsInline: true, className: "absolute w-0 h-0 opacity-0 pointer-events-none" }),
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#164e63]" }),
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 p-2 md:p-4", children: /* @__PURE__ */ jsxs("div", { className: "relative w-full h-full rounded-[26px] overflow-hidden border border-white/15 bg-black shadow-2xl", children: [
        /* @__PURE__ */ jsx("video", { ref: remoteVideoRef, autoPlay: true, playsInline: true, className: "absolute inset-0 w-full h-full object-cover", style: { transform: remoteVideoTransform || "none", filter: remoteVideoFilter } }),
        (!remoteStream || !hasRemoteVideo) && /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-black/60 backdrop-blur-sm", children: [
          /* @__PURE__ */ jsx(User, { className: "w-12 h-12 opacity-80" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm font-bold", children: remoteStream ? isVideoEnabled ? "ビデオ受信中..." : "音声通話中..." : "接続中..." })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "absolute left-4 bottom-4 text-white text-xs font-bold px-3 py-1 rounded-full bg-black/45 border border-white/15 backdrop-blur-md", children: "相手" }),
        isEffectSuppressed && /* @__PURE__ */ jsx("div", { className: "absolute right-4 bottom-4 bg-yellow-400/90 text-black text-[10px] font-black px-3 py-1 rounded-full", children: "\u5B89\u5B9A\u30E2\u30FC\u30C9" })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: localPreviewClass, children: [
        /* @__PURE__ */ jsx(
          "video",
          {
            ref: localVideoRef,
            autoPlay: true,
            playsInline: true,
            muted: true,
            className: "absolute inset-0 w-full h-full object-cover",
            style: { filter: localFilter, transform: localVideoTransform || "none" },
            onError: handleLocalVideoRenderIssue,
            onStalled: handleLocalVideoRenderIssue,
            onEmptied: handleLocalVideoRenderIssue,
            onAbort: handleLocalVideoRenderIssue
          }
        ),
        (!isVideoEnabled || isVideoOff) && /* @__PURE__ */ jsx("div", { className: "absolute inset-0 w-full h-full text-white flex items-center justify-center bg-black/60 backdrop-blur-sm", children: /* @__PURE__ */ jsx(VideoOff, { className: "w-7 h-7 opacity-80" }) }),
        /* @__PURE__ */ jsx("div", { className: "absolute left-2 bottom-2 text-[10px] font-bold px-2 py-1 rounded-full bg-black/50 text-white", children: "あなた" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 max-w-[80vw]", children: [
        /* @__PURE__ */ jsx("div", { className: "bg-black/55 text-white text-xs font-black px-3 py-1.5 rounded-full backdrop-blur-md", children: formatCallDuration(callDurationSec) }),
        isRecordingCall && /* @__PURE__ */ jsxs("div", { className: "bg-red-600/90 text-white text-xs font-black px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-1", children: [
          /* @__PURE__ */ jsx(Disc, { className: "w-3 h-3 animate-pulse" }),
          "REC ",
          formatCallDuration(recordingDurationSec)
        ] }),
        /* @__PURE__ */ jsx("div", { className: `text-[10px] font-black px-2.5 py-1 rounded-full backdrop-blur ${isConnected ? "bg-emerald-500/85 text-white" : "bg-amber-400/90 text-black"}`, children: isConnected ? "\u63A5\u7D9A\u4E2D" : "\u63A5\u7D9A\u78BA\u8A8D\u4E2D" }),
        /* @__PURE__ */ jsx("div", { className: `text-[10px] font-black px-2.5 py-1 rounded-full backdrop-blur ${networkQualityClass}`, children: networkQualityLabel }),
        /* @__PURE__ */ jsx("div", { className: "text-[10px] font-black px-2.5 py-1 rounded-full backdrop-blur bg-indigo-500/85 text-white", children: qualityModeLabel }),
        showClock && /* @__PURE__ */ jsx("div", { className: "text-[10px] font-black px-2.5 py-1 rounded-full backdrop-blur bg-black/60 text-white", children: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })
      ] }),
      needsRemotePlay && /* @__PURE__ */ jsxs("button", { onClick: resumeRemotePlayback, className: "absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-white text-gray-900 text-xs font-black px-4 py-2 rounded-full shadow-lg", children: [
        /* @__PURE__ */ jsx(Volume2, { className: "w-4 h-4 inline mr-1" }),
        "\u97F3\u58F0\u3092\u518D\u751F"
      ] }),
      /* @__PURE__ */ jsxs("button", { onClick: openAdvancedSettingsPanel, className: "fixed top-4 right-4 md:top-5 md:right-6 z-[1016] flex items-center gap-2 bg-black/55 text-white border border-white/25 hover:bg-black/70 text-sm font-black px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md", children: [
        /* @__PURE__ */ jsx(Settings, { className: "w-4 h-4" }),
        "\u8A2D\u5B9A"
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: `relative z-[1003] bg-gradient-to-t from-black/85 to-transparent px-4 pb-4 pt-2 transition-all duration-200 ${controlsVisible || showAdvancedPanel ? "opacity-100" : "opacity-0 pointer-events-none"}`, children: [
      showAdvancedPanel && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-[1020] bg-black/95 backdrop-blur-xl p-4 md:p-6 text-white space-y-3 overflow-y-auto", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsx("div", { className: "text-sm md:text-base font-black tracking-wide", children: "\u8A2D\u5B9A\u30D1\u30CD\u30EB" }),
          /* @__PURE__ */ jsx("button", { onClick: () => setShowAdvancedPanel(false), className: "px-3 py-2 rounded-full bg-white/15 hover:bg-white/25 text-xs font-bold", children: "\u9589\u3058\u308B" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
          /* @__PURE__ */ jsx("button", { onClick: retryRemotePlayback, className: "px-3 py-2 rounded-full bg-gray-700 text-white text-xs font-bold hover:bg-gray-600", children: "\u518D\u751F" }),
          /* @__PURE__ */ jsx("button", { onClick: captureCallSnapshot, className: "px-3 py-2 rounded-full bg-gray-700 text-white text-xs font-bold hover:bg-gray-600", children: "\u30B9\u30AF\u30B7\u30E7" }),
          /* @__PURE__ */ jsx("button", { onClick: toggleFullscreen, className: `p-2 rounded-full text-white ${isFullscreen ? "bg-green-600 hover:bg-green-500" : "bg-gray-700 hover:bg-gray-600"}`, title: isFullscreen ? "\u5168\u753B\u9762\u89E3\u9664" : "\u5168\u753B\u9762", children: /* @__PURE__ */ jsx(Maximize, { className: "w-4 h-4" }) }),
          isVideoEnabled && /* @__PURE__ */ jsx("button", { onClick: switchCameraFacing, disabled: isSwitchingCamera || isScreenSharing, className: "px-3 py-2 rounded-full bg-gray-700 text-white text-xs font-bold hover:bg-gray-600 disabled:bg-gray-500", children: isSwitchingCamera ? "\u5207\u66FF\u4E2D..." : "\u30AB\u30E1\u30E9\u5207\u66FF" }),
          isVideoEnabled && /* @__PURE__ */ jsx("button", { onClick: () => setIsLocalMirror((v) => !v), className: `px-3 py-2 rounded-full text-xs font-bold ${isLocalMirror ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-white text-black hover:bg-gray-200"}`, children: isLocalMirror ? "\u30DF\u30E9\u30FCON" : "\u30DF\u30E9\u30FCOFF" }),
          isVideoEnabled && /* @__PURE__ */ jsx("button", { onClick: toggleScreenShare, className: `px-3 py-2 rounded-full text-xs font-bold ${isScreenSharing ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-gray-700 text-white hover:bg-gray-600"}`, children: isScreenSharing ? "\u5171\u6709\u505C\u6B62" : "\u753B\u9762\u5171\u6709" }),
          /* @__PURE__ */ jsx("button", { onClick: toggleCallRecording, className: `px-3 py-2 rounded-full text-xs font-bold ${isRecordingCall ? "bg-red-600 text-white hover:bg-red-500" : "bg-gray-700 text-white hover:bg-gray-600"}`, children: isRecordingCall ? "\u9332\u753B\u505C\u6B62" : "\u9332\u753B" }),
          /* @__PURE__ */ jsx("button", { onClick: togglePictureInPicture, disabled: !hasRemoteVideo, className: "px-3 py-2 rounded-full bg-gray-700 text-white text-xs font-bold hover:bg-gray-600 disabled:bg-gray-500", children: isRemotePip ? "PiP\u7D42\u4E86" : "PiP" }),
          /* @__PURE__ */ jsx("button", { onClick: copyCallDebugInfo, className: "px-3 py-2 rounded-full bg-gray-700 text-white text-xs font-bold hover:bg-gray-600", children: "\u60C5\u5831\u30B3\u30D4\u30FC" }),
          /* @__PURE__ */ jsx("button", { onClick: toggleHold, className: `px-3 py-2 rounded-full text-xs font-bold ${isHold ? "bg-yellow-500 text-black hover:bg-yellow-400" : "bg-gray-700 text-white hover:bg-gray-600"}`, children: isHold ? "\u4FDD\u7559\u4E2D" : "\u4FDD\u7559" }),
          /* @__PURE__ */ jsx("button", { onClick: addBookmark, className: "px-3 py-2 rounded-full bg-gray-700 text-white text-xs font-bold hover:bg-gray-600", children: "\u3057\u304A\u308A" }),
          /* @__PURE__ */ jsx("button", { onClick: () => setShowShortcutHelp((v) => !v), className: "px-3 py-2 rounded-full bg-gray-700 text-white text-xs font-bold hover:bg-gray-600", children: "?" }),
          canSelectAudioOutput && audioOutputs.length > 0 && /* @__PURE__ */ jsx("select", { value: selectedAudioOutput, onChange: (e) => setSelectedAudioOutput(e.target.value), className: "bg-gray-700 text-white text-xs font-bold px-3 py-2 rounded-full outline-none max-w-[150px]", children: audioOutputs.map((d, i) => /* @__PURE__ */ jsx("option", { value: d.deviceId, children: d.label || `\u51FA\u529B${i + 1}` }, `${d.deviceId || "default"}-${i}`)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
          /* @__PURE__ */ jsx("label", { className: "text-[11px] font-bold opacity-80", children: "\u753B\u8CEA" }),
          /* @__PURE__ */ jsx("select", { value: qualityMode, onChange: (e) => setQualityMode(e.target.value), className: "bg-gray-700 text-white text-xs font-bold px-2 py-1 rounded-lg outline-none", children: [
            /* @__PURE__ */ jsx("option", { value: "auto", children: "\u81EA\u52D5" }),
            /* @__PURE__ */ jsx("option", { value: "low", children: "\u4F4E" }),
            /* @__PURE__ */ jsx("option", { value: "medium", children: "\u4E2D" }),
            /* @__PURE__ */ jsx("option", { value: "high", children: "\u9AD8" })
          ] }),
          /* @__PURE__ */ jsx("button", { onClick: () => setAutoHideControls((v) => !v), className: `px-2 py-1 rounded-lg text-[11px] font-bold ${autoHideControls ? "bg-blue-600" : "bg-gray-700"}`, children: autoHideControls ? "\u64CD\u4F5C\u81EA\u52D5\u975E\u8868\u793AON" : "\u64CD\u4F5C\u81EA\u52D5\u975E\u8868\u793AOFF" }),
          /* @__PURE__ */ jsx("button", { onClick: () => setKeepAwake((v) => !v), className: `px-2 py-1 rounded-lg text-[11px] font-bold ${keepAwake ? "bg-blue-600" : "bg-gray-700"}`, children: keepAwake ? "\u30B9\u30EA\u30FC\u30D7\u6291\u5236ON" : "\u30B9\u30EA\u30FC\u30D7\u6291\u5236OFF" }),
          /* @__PURE__ */ jsx("button", { onClick: () => setShowClock((v) => !v), className: `px-2 py-1 rounded-lg text-[11px] font-bold ${showClock ? "bg-blue-600" : "bg-gray-700"}`, children: showClock ? "\u6642\u8A08ON" : "\u6642\u8A08OFF" }),
          /* @__PURE__ */ jsx("button", { onClick: () => setConfirmBeforeHangup((v) => !v), className: `px-2 py-1 rounded-lg text-[11px] font-bold ${confirmBeforeHangup ? "bg-blue-600" : "bg-gray-700"}`, children: confirmBeforeHangup ? "\u7D42\u4E86\u78BA\u8A8DON" : "\u7D42\u4E86\u78BA\u8A8DOFF" }),
          /* @__PURE__ */ jsx("button", { onClick: () => setPlayConnectSound((v) => !v), className: `px-2 py-1 rounded-lg text-[11px] font-bold ${playConnectSound ? "bg-blue-600" : "bg-gray-700"}`, children: playConnectSound ? "\u63A5\u7D9A\u97F3ON" : "\u63A5\u7D9A\u97F3OFF" }),
          /* @__PURE__ */ jsx("button", { onClick: () => setVibrateOnConnect((v) => !v), className: `px-2 py-1 rounded-lg text-[11px] font-bold ${vibrateOnConnect ? "bg-blue-600" : "bg-gray-700"}`, children: vibrateOnConnect ? "\u30D0\u30A4\u30D6ON" : "\u30D0\u30A4\u30D6OFF" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
          /* @__PURE__ */ jsxs("label", { className: "text-[10px] font-bold", children: ["\u30CE\u30A4\u30BA\u6291\u5236 ", /* @__PURE__ */ jsx("input", { type: "checkbox", checked: noiseSuppressionEnabled, onChange: (e) => setNoiseSuppressionEnabled(e.target.checked), className: "ml-2" })] }),
          /* @__PURE__ */ jsxs("label", { className: "text-[10px] font-bold", children: ["\u30A8\u30B3\u30FC\u30AD\u30E3\u30F3\u30BB\u30EB ", /* @__PURE__ */ jsx("input", { type: "checkbox", checked: echoCancellationEnabled, onChange: (e) => setEchoCancellationEnabled(e.target.checked), className: "ml-2" })] }),
          /* @__PURE__ */ jsxs("label", { className: "text-[10px] font-bold", children: ["\u81EA\u52D5\u30B2\u30A4\u30F3 ", /* @__PURE__ */ jsx("input", { type: "checkbox", checked: autoGainControlEnabled, onChange: (e) => setAutoGainControlEnabled(e.target.checked), className: "ml-2" })] }),
          /* @__PURE__ */ jsxs("label", { className: "text-[10px] font-bold", children: ["\u30EA\u30E2\u30FC\u30C8\u955C\u50CF ", /* @__PURE__ */ jsx("input", { type: "checkbox", checked: isRemoteMirror, onChange: (e) => setIsRemoteMirror(e.target.checked), className: "ml-2" })] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
          /* @__PURE__ */ jsxs("label", { className: "text-[10px] font-bold", children: ["\u30DE\u30A4\u30AF\u611F\u5EA6 ", micGain.toFixed(1), /* @__PURE__ */ jsx("input", { type: "range", min: 0, max: 2, step: 0.1, value: micGain, onChange: (e) => setMicGain(Number(e.target.value)), className: "w-full" })] }),
          /* @__PURE__ */ jsxs("label", { className: "text-[10px] font-bold", children: ["\u97F3\u91CF\u30D6\u30FC\u30B9\u30C8 ", remoteBoost.toFixed(1), /* @__PURE__ */ jsx("input", { type: "range", min: 1, max: 2, step: 0.1, value: remoteBoost, onChange: (e) => setRemoteBoost(Number(e.target.value)), className: "w-full" })] }),
          /* @__PURE__ */ jsxs("label", { className: "text-[10px] font-bold", children: ["\u660E\u308B\u3055 ", remoteBrightness, "%", /* @__PURE__ */ jsx("input", { type: "range", min: 70, max: 150, step: 5, value: remoteBrightness, onChange: (e) => setRemoteBrightness(Number(e.target.value)), className: "w-full" })] }),
          /* @__PURE__ */ jsxs("label", { className: "text-[10px] font-bold", children: ["\u30B3\u30F3\u30C8\u30E9\u30B9\u30C8 ", remoteContrast, "%", /* @__PURE__ */ jsx("input", { type: "range", min: 70, max: 170, step: 5, value: remoteContrast, onChange: (e) => setRemoteContrast(Number(e.target.value)), className: "w-full" })] }),
          /* @__PURE__ */ jsxs("label", { className: "text-[10px] font-bold", children: ["\u5F69\u5EA6 ", remoteSaturation, "%", /* @__PURE__ */ jsx("input", { type: "range", min: 0, max: 200, step: 5, value: remoteSaturation, onChange: (e) => setRemoteSaturation(Number(e.target.value)), className: "w-full" })] }),
          /* @__PURE__ */ jsxs("label", { className: "text-[10px] font-bold", children: ["\u30ED\u30FC\u30AB\u30EB\u30BA\u30FC\u30E0 ", localZoom.toFixed(2), /* @__PURE__ */ jsx("input", { type: "range", min: 1, max: 1.6, step: 0.05, value: localZoom, onChange: (e) => setLocalZoom(Number(e.target.value)), className: "w-full" })] }),
          /* @__PURE__ */ jsxs("label", { className: "text-[10px] font-bold", children: ["\u30EA\u30E2\u30FC\u30C8\u30BA\u30FC\u30E0 ", remoteZoom.toFixed(2), /* @__PURE__ */ jsx("input", { type: "range", min: 1, max: 1.6, step: 0.05, value: remoteZoom, onChange: (e) => setRemoteZoom(Number(e.target.value)), className: "w-full" })] }),
          /* @__PURE__ */ jsxs("label", { className: "text-[10px] font-bold", children: ["\u30B9\u30AF\u30B7\u30E7\u30AB\u30A6\u30F3\u30C8 ", snapshotCountdownSec, "s", /* @__PURE__ */ jsx("input", { type: "range", min: 0, max: 10, step: 1, value: snapshotCountdownSec, onChange: (e) => setSnapshotCountdownSec(Number(e.target.value)), className: "w-full" })] }),
          /* @__PURE__ */ jsxs("label", { className: "text-[10px] font-bold", children: ["\u81EA\u52D5\u30B9\u30AF\u30B7\u30E7 ", autoSnapshotSec, "s", /* @__PURE__ */ jsx("input", { type: "range", min: 0, max: 60, step: 5, value: autoSnapshotSec, onChange: (e) => setAutoSnapshotSec(Number(e.target.value)), className: "w-full" })] }),
          /* @__PURE__ */ jsxs("label", { className: "text-[10px] font-bold", children: ["\u30B9\u30AF\u30B7\u30E7\u6642\u523B ", /* @__PURE__ */ jsx("input", { type: "checkbox", checked: snapshotTimestampEnabled, onChange: (e) => setSnapshotTimestampEnabled(e.target.checked), className: "ml-2" })] })
        ] }),
        /* @__PURE__ */ jsx("textarea", { value: callNotes, onChange: (e) => setCallNotes(e.target.value), className: "w-full bg-black/50 border border-white/10 rounded-xl p-2 text-xs text-white outline-none", placeholder: "\u901A\u8A71\u30E1\u30E2..." }),
        bookmarks.length > 0 && /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: bookmarks.map((b) => /* @__PURE__ */ jsxs("button", { onClick: () => removeBookmark(b.id), className: "px-2 py-1 rounded-full bg-white/10 text-[10px] font-bold", children: [formatCallDuration(b.sec), " x"] }, b.id)) }),
        /* @__PURE__ */ jsx("button", { onClick: resetAdvancedSettings, className: "w-full bg-red-600/80 hover:bg-red-500 text-white py-2 rounded-xl text-xs font-bold", children: "\u8A2D\u5B9A\u30EA\u30BB\u30C3\u30C8" })
      ] }),
      showShortcutHelp && /* @__PURE__ */ jsx("div", { className: "mb-2 border border-white/10 bg-black/40 p-2 text-white text-xs font-bold", children: "Shortcut: M / V / H / S / F / P / ?" }),
      /* @__PURE__ */ jsxs("div", { className: "mx-auto w-full max-w-[340px] flex items-center justify-center gap-6", children: [
        /* @__PURE__ */ jsx("button", { onClick: toggleMute, className: `w-11 h-11 rounded-full border border-white/25 transition-all flex items-center justify-center ${isMuted ? "bg-white text-black" : "bg-white/15 text-white hover:bg-white/25"}`, children: isMuted ? /* @__PURE__ */ jsx(MicOff, { className: "w-5 h-5" }) : /* @__PURE__ */ jsx(Mic, { className: "w-5 h-5" }) }),
        isVideoEnabled && /* @__PURE__ */ jsx("button", { onClick: toggleVideo, className: `w-11 h-11 rounded-full border border-white/25 transition-all flex items-center justify-center ${isVideoOff ? "bg-white text-black" : "bg-white/15 text-white hover:bg-white/25"}`, children: isVideoOff ? /* @__PURE__ */ jsx(VideoOff, { className: "w-5 h-5" }) : /* @__PURE__ */ jsx(Video, { className: "w-5 h-5" }) }),
        /* @__PURE__ */ jsx("button", { onClick: handleEndCallRequest, className: "w-14 h-14 rounded-full bg-red-500 text-white shadow-2xl hover:bg-red-600 transition-all flex items-center justify-center", children: /* @__PURE__ */ jsx(PhoneOff, { className: "w-6 h-6" }) }),
        /* @__PURE__ */ jsx("button", { onClick: openAdvancedSettingsPanel, className: `w-11 h-11 rounded-full border border-white/25 transition-all flex items-center justify-center ${showAdvancedPanel ? "bg-white text-black" : "bg-white/15 text-white hover:bg-white/25"}`, children: /* @__PURE__ */ jsx(MoreVertical, { className: "w-5 h-5" }) })
      ] })
    ] })
  ] });
};
const AIEffectGenerator = ({ user, onClose, showNotification, onSelectEffect }) => {
  const [sourceImage, setSourceImage] = useState(null);
  const [generatedEffects, setGeneratedEffects] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef(null);
  const handleImageUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      setSourceImage(event.target.result);
      generateEffects(event.target.result);
    };
    reader.readAsDataURL(file);
  };
  const generateEffects = async (imgSrc) => {
    setIsProcessing(true);
    setGeneratedEffects([]);
    await new Promise((r) => setTimeout(r, 1500));
    const img = new Image();
    img.onload = () => {
      const effects = [
        { name: "Normal", filter: "none" },
        { name: "Sepia", filter: "sepia(100%)" },
        { name: "Grayscale", filter: "grayscale(100%)" },
        { name: "Invert", filter: "invert(100%)" },
        { name: "Hue", filter: "hue-rotate(90deg)" },
        { name: "Contrast", filter: "contrast(200%)" },
        { name: "Blur", filter: "blur(4px)" },
        { name: "Bright", filter: "brightness(150%)" }
      ];
      const results = [];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const MAX_SIZE = 200;
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > MAX_SIZE) {
          h *= MAX_SIZE / w;
          w = MAX_SIZE;
        }
      } else {
        if (h > MAX_SIZE) {
          w *= MAX_SIZE / h;
          h = MAX_SIZE;
        }
      }
      canvas.width = w;
      canvas.height = h;
      effects.forEach((effect) => {
        ctx.filter = effect.filter;
        ctx.drawImage(img, 0, 0, w, h);
        results.push({ name: effect.name, filter: effect.filter, image: canvas.toDataURL("image/jpeg", 0.8) });
      });
      setGeneratedEffects(results);
      setIsProcessing(false);
      showNotification("AI\u304C8\u30D1\u30BF\u30FC\u30F3\u306E\u30A8\u30D5\u30A7\u30AF\u30C8\u3092\u751F\u6210\u3057\u307E\u3057\u305F\uFF01\u2728");
    };
    img.src = imgSrc;
  };
  const saveEffect = async (effect) => {
    try {
      await addDoc(collection(db, "artifacts", appId, "public", "data", "users", user.uid, "effects"), {
        name: effect.name,
        image: effect.image,
        filter: effect.filter || null,
        type: "created",
        ownerId: user.uid,
        creatorId: user.uid,
        forSale: false,
        price: 0,
        soldCount: 0,
        createdAt: serverTimestamp()
      });
      showNotification(`${effect.name} \u30A8\u30D5\u30A7\u30AF\u30C8\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F`);
      if (onSelectEffect) onSelectEffect(effect.name);
      onClose();
    } catch (e) {
      console.error(e);
      showNotification("\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[2000] bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-md animate-in fade-in", children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]", children: [
    /* @__PURE__ */ jsx("button", { onClick: onClose, className: "absolute top-4 right-4 bg-gray-100 p-2 rounded-full hover:bg-gray-200 z-10", children: /* @__PURE__ */ jsx(X, { className: "w-5 h-5" }) }),
    /* @__PURE__ */ jsxs("h2", { className: "text-xl font-bold mb-4 flex items-center gap-2 flex-shrink-0", children: [
      /* @__PURE__ */ jsx(Sparkles, { className: "w-6 h-6 text-purple-500" }),
      " AI\u30A8\u30D5\u30A7\u30AF\u30C8\u751F\u6210"
    ] }),
    !sourceImage ? /* @__PURE__ */ jsx("div", { className: "flex flex-col items-center justify-center flex-1 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors", children: /* @__PURE__ */ jsxs("label", { className: "cursor-pointer flex flex-col items-center p-10 w-full h-full justify-center", children: [
      /* @__PURE__ */ jsx(Upload, { className: "w-12 h-12 text-gray-400 mb-2" }),
      /* @__PURE__ */ jsx("span", { className: "text-sm font-bold text-gray-500", children: "\u753B\u50CF\u3092\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u3057\u3066\u751F\u6210" }),
      /* @__PURE__ */ jsx("input", { type: "file", className: "hidden", accept: "image/*", onChange: handleImageUpload })
    ] }) }) : /* @__PURE__ */ jsxs("div", { className: "flex flex-col flex-1 overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto p-2", children: isProcessing ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center h-64", children: [
        /* @__PURE__ */ jsx(Loader2, { className: "w-12 h-12 animate-spin text-purple-500 mb-4" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm font-bold text-gray-500 animate-pulse", children: "AI\u304C\u601D\u8003\u4E2D..." })
      ] }) : /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-4", children: generatedEffects.map((ef, i) => /* @__PURE__ */ jsxs("div", { onClick: () => saveEffect(ef), className: "bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center cursor-pointer hover:ring-2 ring-purple-500 transition-all group", children: [
        /* @__PURE__ */ jsx("div", { className: "w-full aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2 relative", children: /* @__PURE__ */ jsx("img", { src: ef.image, className: "w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" }) }),
        /* @__PURE__ */ jsx("span", { className: "text-xs font-bold text-gray-700", children: ef.name })
      ] }, i)) }) }),
      /* @__PURE__ */ jsx("button", { onClick: () => {
        setSourceImage(null);
        setGeneratedEffects([]);
      }, className: "mt-4 w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl flex-shrink-0", children: "\u3084\u308A\u76F4\u3059" })
    ] }),
    /* @__PURE__ */ jsx("canvas", { ref: canvasRef, className: "hidden" })
  ] }) });
};
const CoinTransferModal = ({ onClose, myWallet, myUid, targetUid, targetName, showNotification }) => {
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const handleSend = async () => {
    const val = parseInt(amount, 10);
    if (isNaN(val) || val <= 0) return showNotification("\u6B63\u306E\u6574\u6570\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
    if (val > myWallet) return showNotification("\u6B8B\u9AD8\u304C\u8DB3\u308A\u307E\u305B\u3093");
    setSending(true);
    try {
      await runTransaction(db, async (t) => {
        const senderRef = doc(db, "artifacts", appId, "public", "data", "users", myUid);
        const receiverRef = doc(db, "artifacts", appId, "public", "data", "users", targetUid);
        const senderDoc = await t.get(senderRef);
        if (!senderDoc.exists() || senderDoc.data().wallet < val) throw "\u6B8B\u9AD8\u4E0D\u8DB3\u307E\u305F\u306F\u30A8\u30E9\u30FC";
        t.update(senderRef, { wallet: increment(-val) });
        t.update(receiverRef, { wallet: increment(val) });
      });
      showNotification(`${targetName}\u3055\u3093\u306B ${val}\u30B3\u30A4\u30F3\u9001\u308A\u307E\u3057\u305F`);
      onClose();
    } catch (e) {
      showNotification("\u9001\u91D1\u30A8\u30E9\u30FC: " + e);
    } finally {
      setSending(false);
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in", children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-sm rounded-[32px] p-6 text-center shadow-2xl", children: [
    /* @__PURE__ */ jsx("h3", { className: "font-bold text-lg mb-4 text-gray-800", children: "\u30B3\u30A4\u30F3\u3092\u9001\u308B" }),
    /* @__PURE__ */ jsxs("div", { className: "bg-yellow-50 p-4 rounded-2xl mb-4 border border-yellow-100", children: [
      /* @__PURE__ */ jsx("div", { className: "text-xs text-yellow-700 font-bold uppercase tracking-widest", children: "\u3042\u306A\u305F\u306E\u6B8B\u9AD8" }),
      /* @__PURE__ */ jsx("div", { className: "text-3xl font-black text-yellow-500 mt-1", children: myWallet?.toLocaleString() })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "text-sm font-bold text-gray-500 mb-2", children: [
      "To: ",
      targetName
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "relative mb-6", children: [
      /* @__PURE__ */ jsx("input", { type: "number", className: "w-full bg-gray-100 rounded-2xl p-4 text-center font-bold text-xl outline-none focus:ring-2 focus:ring-yellow-400", placeholder: "0", value: amount, onChange: (e) => setAmount(e.target.value) }),
      /* @__PURE__ */ jsx("span", { className: "absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs", children: "COIN" })
    ] }),
    /* @__PURE__ */ jsx("button", { onClick: handleSend, disabled: sending, className: "w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-2xl shadow-lg transition-transform active:scale-95 mb-3", children: sending ? /* @__PURE__ */ jsx(Loader2, { className: "animate-spin mx-auto" }) : "\u9001\u91D1\u3059\u308B" }),
    /* @__PURE__ */ jsx("button", { onClick: onClose, className: "text-gray-400 text-xs font-bold hover:text-gray-600", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" })
  ] }) });
};
const ContactSelectModal = ({ onClose, onSend, friends }) => /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm", children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col max-h-[70vh]", children: [
  /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center mb-4", children: [
    /* @__PURE__ */ jsx("h3", { className: "font-bold text-lg", children: "\u9023\u7D61\u5148\u3092\u9078\u629E" }),
    /* @__PURE__ */ jsx("button", { onClick: onClose, children: /* @__PURE__ */ jsx(X, { className: "w-6 h-6" }) })
  ] }),
  /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto space-y-2 pr-2", children: friends.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-center py-10 text-gray-400 text-sm", children: "\u53CB\u3060\u3061\u304C\u3044\u307E\u305B\u3093" }) : friends.map((f) => /* @__PURE__ */ jsxs("div", { onClick: () => onSend(f), className: "flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer border border-transparent hover:border-gray-100 transition-all", children: [
    /* @__PURE__ */ jsx("img", { src: f.avatar, className: "w-10 h-10 rounded-xl object-cover border" }),
    /* @__PURE__ */ jsx("span", { className: "font-bold text-sm flex-1", children: f.name }),
    /* @__PURE__ */ jsx(Plus, { className: "w-4 h-4 text-green-500" })
  ] }, f.uid)) })
] }) });
const BirthdayCardModal = ({ onClose, onSend, toName }) => {
  const [color, setColor] = useState("pink"), [message, setMessage] = useState("");
  const colors = [{ id: "pink", class: "bg-pink-100 border-pink-300" }, { id: "blue", class: "bg-blue-100 border-blue-300" }, { id: "yellow", class: "bg-yellow-100 border-yellow-300" }, { id: "green", class: "bg-green-100 border-green-300" }];
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm", children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center mb-4", children: [
      /* @__PURE__ */ jsx("h3", { className: "font-bold text-lg", children: "\u30AB\u30FC\u30C9\u3092\u9001\u308B" }),
      /* @__PURE__ */ jsx("button", { onClick: onClose, children: /* @__PURE__ */ jsx(X, { className: "w-6 h-6" }) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mb-4 flex gap-3", children: colors.map((c) => /* @__PURE__ */ jsx("button", { onClick: () => setColor(c.id), className: `w-10 h-10 rounded-full border-2 ${c.class} ${color === c.id ? "scale-125 ring-2 ring-gray-300" : ""}` }, c.id)) }),
    /* @__PURE__ */ jsxs("div", { className: `p-4 rounded-2xl border-2 mb-4 ${colors.find((c) => c.id === color)?.class}`, children: [
      /* @__PURE__ */ jsxs("div", { className: "font-bold text-gray-700 mb-2", children: [
        "To: ",
        toName
      ] }),
      /* @__PURE__ */ jsx("textarea", { className: "w-full bg-white/50 rounded-xl p-3 text-sm focus:outline-none min-h-[100px]", placeholder: "\u30E1\u30C3\u30BB\u30FC\u30B8...", value: message, onChange: (e) => setMessage(e.target.value) })
    ] }),
    /* @__PURE__ */ jsx("button", { onClick: () => onSend({ color, message }), disabled: !message.trim(), className: "w-full bg-pink-500 text-white font-bold py-3 rounded-2xl shadow-lg", children: "\u9001\u4FE1\u3059\u308B" })
  ] }) });
};
const StickerBuyModal = ({ onClose, onGoToStore, packId }) => {
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm", children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center", children: [
    /* @__PURE__ */ jsx("div", { className: "w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4", children: /* @__PURE__ */ jsx(ShoppingCart, { className: "w-8 h-8 text-blue-600" }) }),
    /* @__PURE__ */ jsx("h3", { className: "font-bold text-lg mb-2", children: "\u3053\u306E\u30B9\u30BF\u30F3\u30D7\u3092\u8CFC\u5165\u3057\u307E\u3059\u304B\uFF1F" }),
    /* @__PURE__ */ jsx("p", { className: "text-gray-500 text-sm mb-6", children: "\u30B7\u30E7\u30C3\u30D7\u3067\u8A73\u7D30\u3092\u78BA\u8A8D\u3067\u304D\u307E\u3059\u3002" }),
    /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
      /* @__PURE__ */ jsx("button", { onClick: onClose, className: "flex-1 py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-2xl text-gray-600 transition-colors", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }),
      /* @__PURE__ */ jsx("button", { onClick: () => {
        onGoToStore(packId);
        onClose();
      }, className: "flex-1 py-3 bg-blue-500 hover:bg-blue-600 font-bold rounded-2xl text-white transition-colors shadow-lg shadow-blue-200", children: "\u30B7\u30E7\u30C3\u30D7\u3078" })
    ] })
  ] }) });
};
const GroupAddMemberModal = ({ onClose, currentMembers, chatId, allUsers, profile, user, chats, showNotification }) => {
  const [selected, setSelected] = useState([]);
  const inviteableFriends = useMemo(() => {
    const candidateUids = new Set(profile?.friends || []);
    (chats || []).forEach((chat) => {
      if (chat?.isGroup || !Array.isArray(chat?.participants) || !chat.participants.includes(user.uid)) return;
      const otherUid = chat.participants.find((p) => p && p !== user.uid);
      if (otherUid) candidateUids.add(otherUid);
    });
    return allUsers.filter((u) => u?.uid && candidateUids.has(u.uid) && !currentMembers.includes(u.uid));
  }, [allUsers, chats, currentMembers, profile?.friends, user.uid]);
  const toggle = (uid) => setSelected((prev) => prev.includes(uid) ? prev.filter((i) => i !== uid) : [...prev, uid]);
  const handleInvite = async () => {
    if (selected.length === 0) return;
    try {
      const addedNames = [];
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", chatId), { participants: arrayUnion(...selected) });
      selected.forEach((uid) => {
        const u = allUsers.find((user2) => user2.uid === uid);
        if (u) addedNames.push(u.name);
      });
      await addDoc(collection(db, "artifacts", appId, "public", "data", "chats", chatId, "messages"), {
        senderId: user.uid,
        content: `${profile.name}\u304C${addedNames.join("\u3001")}\u3092\u62DB\u5F85\u3057\u307E\u3057\u305F\u3002`,
        type: "text",
        createdAt: serverTimestamp(),
        readBy: [user.uid]
      });
      showNotification("\u30E1\u30F3\u30D0\u30FC\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F");
      onClose();
    } catch (e) {
      showNotification("\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm", children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-sm rounded-3xl flex flex-col max-h-[70vh]", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center p-4 border-b", children: [
      /* @__PURE__ */ jsx("h3", { className: "font-bold text-lg", children: "\u30E1\u30F3\u30D0\u30FC\u3092\u8FFD\u52A0" }),
      /* @__PURE__ */ jsx("button", { onClick: onClose, children: /* @__PURE__ */ jsx(X, { className: "w-6 h-6" }) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto p-4 space-y-2", children: inviteableFriends.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-center py-10 text-gray-400 text-sm", children: "\u62DB\u5F85\u3067\u304D\u308B\u53CB\u3060\u3061\u304C\u3044\u307E\u305B\u3093" }) : inviteableFriends.map((f) => /* @__PURE__ */ jsxs("div", { onClick: () => toggle(f.uid), className: "flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer border border-transparent transition-all", children: [
      /* @__PURE__ */ jsx("img", { src: f.avatar, className: "w-10 h-10 rounded-xl object-cover border" }),
      /* @__PURE__ */ jsx("span", { className: "font-bold text-sm flex-1", children: f.name }),
      /* @__PURE__ */ jsx("div", { className: `w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selected.includes(f.uid) ? "bg-green-500 border-green-500" : "border-gray-200"}`, children: selected.includes(f.uid) && /* @__PURE__ */ jsx(Check, { className: "w-4 h-4 text-white" }) })
    ] }, f.uid)) }),
    /* @__PURE__ */ jsx("div", { className: "p-4 border-t", children: /* @__PURE__ */ jsxs("button", { onClick: handleInvite, disabled: selected.length === 0, className: `w-full py-3 rounded-2xl font-bold shadow-lg text-white transition-all ${selected.length > 0 ? "bg-green-500" : "bg-gray-300"}`, children: [
      "\u62DB\u5F85\u3059\u308B (",
      selected.length,
      ")"
    ] }) })
  ] }) });
};
const GroupEditModal = ({ onClose, chatId, currentName, currentIcon, currentMembers, allUsers, showNotification, user, profile }) => {
  const [name, setName] = useState(currentName);
  const [icon, setIcon] = useState(currentIcon);
  const [kickTarget, setKickTarget] = useState(null);
  const handleUpdate = async () => {
    if (!name.trim()) return showNotification("\u30B0\u30EB\u30FC\u30D7\u540D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
    try {
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", chatId), { name, icon, updatedAt: serverTimestamp() });
      if (name !== currentName || icon !== currentIcon) {
        await addDoc(collection(db, "artifacts", appId, "public", "data", "chats", chatId, "messages"), {
          senderId: user.uid,
          content: `${profile.name}\u304C\u30B0\u30EB\u30FC\u30D7\u60C5\u5831\u3092\u5909\u66F4\u3057\u307E\u3057\u305F\u3002`,
          type: "text",
          createdAt: serverTimestamp(),
          readBy: [user.uid]
        });
      }
      showNotification("\u30B0\u30EB\u30FC\u30D7\u60C5\u5831\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F");
      onClose();
    } catch (e) {
      showNotification("\u66F4\u65B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    }
  };
  const executeKick = async () => {
    if (!kickTarget) return;
    const { uid, name: memberName } = kickTarget;
    try {
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", chatId), { participants: arrayRemove(uid) });
      await addDoc(collection(db, "artifacts", appId, "public", "data", "chats", chatId, "messages"), {
        senderId: user.uid,
        content: `${profile.name}\u304C${memberName}\u3092\u9000\u4F1A\u3055\u305B\u307E\u3057\u305F\u3002`,
        type: "text",
        createdAt: serverTimestamp(),
        readBy: [user.uid]
      });
      showNotification(`${memberName}\u3092\u524A\u9664\u3057\u307E\u3057\u305F`);
    } catch (e) {
      showNotification("\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    } finally {
      setKickTarget(null);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm", children: [
    /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center mb-6 border-b pb-4 shrink-0", children: [
        /* @__PURE__ */ jsx("h3", { className: "font-bold text-lg", children: "\u30B0\u30EB\u30FC\u30D7\u8A2D\u5B9A" }),
        /* @__PURE__ */ jsx("button", { onClick: onClose, children: /* @__PURE__ */ jsx(X, { className: "w-6 h-6 text-gray-500" }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto scrollbar-hide", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-6 mb-8", children: [
          /* @__PURE__ */ jsxs("div", { className: "relative group", children: [
            /* @__PURE__ */ jsx("img", { src: icon, className: "w-24 h-24 rounded-3xl object-cover bg-gray-100 border shadow-sm" }),
            /* @__PURE__ */ jsxs("label", { className: "absolute bottom-0 right-0 bg-green-500 p-2 rounded-full text-white cursor-pointer shadow-lg border-2 border-white hover:bg-green-600 transition-colors", children: [
              /* @__PURE__ */ jsx(CameraIcon, { className: "w-4 h-4" }),
              /* @__PURE__ */ jsx("input", { type: "file", className: "hidden", accept: "image/*", onChange: (e) => handleCompressedUpload(e, (d) => setIcon(d)) })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "w-full", children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-gray-400 mb-1 block", children: "\u30B0\u30EB\u30FC\u30D7\u540D" }),
            /* @__PURE__ */ jsx("input", { className: "w-full text-center text-lg font-bold border-b py-2 focus:outline-none focus:border-green-500 bg-transparent", placeholder: "\u30B0\u30EB\u30FC\u30D7\u540D\u3092\u5165\u529B", value: name, onChange: (e) => setName(e.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mb-6", children: [
          /* @__PURE__ */ jsxs("h4", { className: "text-xs font-bold text-gray-400 mb-2 uppercase flex justify-between", children: [
            /* @__PURE__ */ jsxs("span", { children: [
              "\u30E1\u30F3\u30D0\u30FC (",
              currentMembers.length,
              ")"
            ] }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] text-gray-400 font-normal", children: "\u7BA1\u7406\u8005\u6A29\u9650: \u524A\u9664\u53EF\u80FD" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "space-y-2", children: currentMembers.map((uid) => {
            const m = allUsers.find((u) => u.uid === uid);
            if (!m) return null;
            const isMe = uid === user.uid;
            return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100", children: [
              /* @__PURE__ */ jsx("img", { src: m.avatar, className: "w-10 h-10 rounded-full object-cover border" }),
              /* @__PURE__ */ jsx("div", { className: "flex-1 min-w-0", children: /* @__PURE__ */ jsxs("div", { className: "font-bold text-sm truncate", children: [
                m.name,
                " ",
                isMe && /* @__PURE__ */ jsx("span", { className: "text-gray-400 text-xs", children: "(\u81EA\u5206)" })
              ] }) }),
              !isMe && /* @__PURE__ */ jsxs("button", { onClick: () => setKickTarget({ uid, name: m.name }), className: "p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors flex items-center gap-1 group", title: "\u5F37\u5236\u9000\u4F1A", children: [
                /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap", children: "\u5F37\u5236\u9000\u4F1A" }),
                /* @__PURE__ */ jsx(UserMinus, { className: "w-5 h-5" })
              ] })
            ] }, uid);
          }) })
        ] })
      ] }),
      /* @__PURE__ */ jsx("button", { onClick: handleUpdate, className: "w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-2xl shadow-lg transition-all shrink-0 mt-4", children: "\u4FDD\u5B58\u3059\u308B" })
    ] }),
    kickTarget && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm", children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl", children: [
      /* @__PURE__ */ jsx("h3", { className: "font-bold text-lg mb-2 text-center text-gray-800", children: "\u5F37\u5236\u9000\u4F1A\u306E\u78BA\u8A8D" }),
      /* @__PURE__ */ jsxs("p", { className: "text-center text-gray-600 mb-6 text-sm", children: [
        kickTarget.name,
        " \u3092\u30B0\u30EB\u30FC\u30D7\u304B\u3089\u9000\u4F1A\u3055\u305B\u307E\u3059\u304B\uFF1F",
        /* @__PURE__ */ jsx("br", {}),
        /* @__PURE__ */ jsx("span", { className: "text-xs text-red-500", children: "\u3053\u306E\u64CD\u4F5C\u306F\u5143\u306B\u623B\u305B\u307E\u305B\u3093\u3002" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
        /* @__PURE__ */ jsx("button", { onClick: () => setKickTarget(null), className: "flex-1 py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-2xl text-gray-600 transition-colors", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }),
        /* @__PURE__ */ jsx("button", { onClick: executeKick, className: "flex-1 py-3 bg-red-500 hover:bg-red-600 font-bold rounded-2xl text-white transition-colors shadow-lg shadow-red-200", children: "\u9000\u4F1A\u3055\u305B\u308B" })
      ] })
    ] }) })
  ] });
};
const LeaveGroupConfirmModal = ({ onClose, onLeave }) => /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm", children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-red-100", children: [
  /* @__PURE__ */ jsxs("div", { className: "text-center mb-6", children: [
    /* @__PURE__ */ jsx("div", { className: "mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3", children: /* @__PURE__ */ jsx(LogOut, { className: "w-6 h-6 text-red-600" }) }),
    /* @__PURE__ */ jsx("h3", { className: "font-black text-lg text-red-700", children: "\u30B0\u30EB\u30FC\u30D7\u3092\u9000\u4F1A\u3057\u307E\u3059\u304B\uFF1F" }),
    /* @__PURE__ */ jsxs("p", { className: "text-sm text-gray-600 mt-2", children: [
      "\u3053\u306E\u64CD\u4F5C\u306F\u53D6\u308A\u6D88\u305B\u307E\u305B\u3093\u3002",
      /* @__PURE__ */ jsx("br", {}),
      "\u672C\u5F53\u306B\u9000\u4F1A\u3057\u3066\u3082\u3088\u308D\u3057\u3044\u3067\u3059\u304B\uFF1F"
    ] })
  ] }),
  /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
    /* @__PURE__ */ jsx("button", { onClick: onClose, className: "flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }),
    /* @__PURE__ */ jsx("button", { onClick: onLeave, className: "flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-red-200", children: "\u9000\u4F1A\u3059\u308B" })
  ] })
] }) });
const IncomingCallOverlay = ({ callData, onAccept, onDecline, allUsers }) => {
  const caller = allUsers.find((u) => u.uid === callData.callerId);
  const isVideo = callData?.callType !== "audio";
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-[500] bg-gray-900 flex flex-col items-center justify-between py-16 px-6 animate-in fade-in duration-300", children: [
    /* @__PURE__ */ jsxs("div", { className: "absolute inset-0 z-0 overflow-hidden", children: [
      /* @__PURE__ */ jsx(
        "img",
        {
          src: caller?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=caller",
          className: "w-full h-full object-cover blur-3xl opacity-50 scale-125",
          alt: "background"
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-black/40" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "relative z-10 flex flex-col items-center gap-6 mt-12", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-2", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-white/80 mb-2", children: [
          /* @__PURE__ */ jsx(PhoneCall, { className: "w-5 h-5 animate-pulse" }),
          /* @__PURE__ */ jsx("span", { className: "text-sm font-bold tracking-widest", children: "\u7740\u4FE1\u4E2D..." })
        ] }),
        /* @__PURE__ */ jsx("h2", { className: "text-4xl font-bold text-white drop-shadow-xl text-center leading-tight", children: caller?.name || "Unknown" }),
        /* @__PURE__ */ jsx("div", { className: "text-white/70 text-sm font-bold mt-1", children: isVideo ? "\u30D3\u30C7\u30AA\u901A\u8A71" : "\u97F3\u58F0\u901A\u8A71" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "relative mt-8", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 rounded-full bg-white/20 animate-[ping_2s_ease-in-out_infinite]" }),
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 rounded-full bg-white/10 animate-[ping_3s_ease-in-out_infinite_delay-500ms]" }),
        /* @__PURE__ */ jsx(
          "img",
          {
            src: caller?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=caller",
            className: "w-40 h-40 rounded-full border-[6px] border-white/20 shadow-2xl object-cover relative z-10 bg-gray-800"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "relative z-10 w-full flex justify-between items-end px-4 mb-8 max-w-sm", children: [
      /* @__PURE__ */ jsxs("button", { onClick: onDecline, className: "flex flex-col items-center gap-4 group", children: [
        /* @__PURE__ */ jsx("div", { className: "w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-red-600 border border-red-400", children: /* @__PURE__ */ jsx(PhoneOff, { className: "w-10 h-10 text-white fill-current" }) }),
        /* @__PURE__ */ jsx("span", { className: "text-white text-sm font-bold shadow-black drop-shadow-md", children: "\u62D2\u5426" })
      ] }),
      /* @__PURE__ */ jsxs("button", { onClick: onAccept, className: "flex flex-col items-center gap-4 group", children: [
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-green-500 rounded-full animate-ping opacity-50" }),
          /* @__PURE__ */ jsx("div", { className: "w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-green-600 border border-green-400 relative z-10", children: isVideo ? /* @__PURE__ */ jsx(Video, { className: "w-10 h-10 text-white fill-current" }) : /* @__PURE__ */ jsx(Phone, { className: "w-10 h-10 text-white fill-current" }) })
        ] }),
        /* @__PURE__ */ jsx("span", { className: "text-white text-sm font-bold shadow-black drop-shadow-md", children: "\u5FDC\u7B54" })
      ] })
    ] })
  ] });
};
const OutgoingCallOverlay = ({ callData, onCancel, allUsers }) => /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-[500] bg-gray-900 flex flex-col items-center justify-between py-24 px-6 animate-in fade-in duration-300", children: [
  /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-6 mt-10", children: [
    /* @__PURE__ */ jsxs("div", { className: "relative", children: [
      /* @__PURE__ */ jsx("div", { className: "absolute inset-0 rounded-full bg-white/10 animate-pulse" }),
      /* @__PURE__ */ jsx("div", { className: "w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center border-4 border-white/50 shadow-2xl relative z-10", children: /* @__PURE__ */ jsx(Video, { className: "w-14 h-14 text-white opacity-80" }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "text-center text-white", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-2xl font-bold mb-2", children: "\u767A\u4FE1\u4E2D..." }),
      /* @__PURE__ */ jsx("p", { className: "text-sm opacity-60", children: "\u76F8\u624B\u306E\u5FDC\u7B54\u3092\u5F85\u3063\u3066\u3044\u307E\u3059" })
    ] })
  ] }),
  /* @__PURE__ */ jsx("div", { className: "w-full flex justify-center items-center mb-10", children: /* @__PURE__ */ jsxs("button", { onClick: onCancel, className: "flex flex-col items-center gap-3 group", children: [
    /* @__PURE__ */ jsx("div", { className: "w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-red-600", children: /* @__PURE__ */ jsx(X, { className: "w-10 h-10 text-white" }) }),
    /* @__PURE__ */ jsx("span", { className: "text-white text-xs font-bold", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" })
  ] }) })
] });
const CallAcceptedOverlay = ({ callData, onJoin }) => /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[500] bg-gray-900/90 flex flex-col items-center justify-center px-6 animate-in fade-in duration-300 backdrop-blur-sm", children: /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-white/20", children: [
  /* @__PURE__ */ jsx("div", { className: "w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce", children: /* @__PURE__ */ jsx(Video, { className: "w-10 h-10 text-green-600" }) }),
  /* @__PURE__ */ jsx("h2", { className: "text-2xl font-bold text-gray-800 mb-2", children: "\u76F8\u624B\u304C\u5FDC\u7B54\u3057\u307E\u3057\u305F" }),
  /* @__PURE__ */ jsx("p", { className: "text-gray-500 mb-8 text-sm", children: "\u4E0B\u306E\u30DC\u30BF\u30F3\u3092\u62BC\u3057\u3066\u901A\u8A71\u3092\u958B\u59CB\u3057\u3066\u304F\u3060\u3055\u3044" }),
  /* @__PURE__ */ jsxs("button", { onClick: onJoin, className: "w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-green-200 transform hover:scale-[1.02] flex items-center justify-center gap-2", children: [
    /* @__PURE__ */ jsx(Video, { className: "w-5 h-5" }),
    "\u901A\u8A71\u306B\u53C2\u52A0\u3059\u308B"
  ] })
] }) });
const FriendProfileModal = ({ friend, onClose, onStartChat, onTransfer, myUid, myProfile, allUsers, showNotification }) => {
  const myFriends = myProfile?.friends || [];
  const myFriendsSet = useMemo(() => new Set(myFriends), [myFriends]);
  const friendFriends = friend?.friends || [];
  const isFriend = myFriendsSet.has(friend?.uid);
  const isHidden = (myProfile?.hiddenFriends || []).includes(friend?.uid);
  const mutualCount = useMemo(() => {
    let n = 0;
    for (const uid of friendFriends) {
      if (!uid || uid === myUid) continue;
      if (myFriendsSet.has(uid)) n++;
    }
    return n;
  }, [friendFriends, myFriendsSet, myUid]);
  const fofCandidateCount = useMemo(() => {
    let n = 0;
    for (const uid of friendFriends) {
      if (!uid || uid === myUid) continue;
      if (!myFriendsSet.has(uid)) n++;
    }
    return n;
  }, [friendFriends, myFriendsSet, myUid]);
  const toggleHideFriend = async () => {
    if (!myUid || !friend?.uid) return;
    if (!isFriend) return;
    try {
      const userRef = doc(db, "artifacts", appId, "public", "data", "users", myUid);
      if (isHidden) {
        await updateDoc(userRef, { hiddenFriends: arrayRemove(friend.uid) });
        showNotification?.("\u975E\u8868\u793A\u3092\u89E3\u9664\u3057\u307E\u3057\u305F");
      } else {
        const ok = window.confirm("\u3053\u306E\u53CB\u3060\u3061\u3092\u975E\u8868\u793A\u306B\u3057\u307E\u3059\u304B\uFF1F\n\uFF08\u53CB\u3060\u3061\u95A2\u4FC2\u306F\u89E3\u9664\u3055\u308C\u307E\u305B\u3093\uFF09");
        if (!ok) return;
        await updateDoc(userRef, { hiddenFriends: arrayUnion(friend.uid) });
        showNotification?.("\u975E\u8868\u793A\u306B\u3057\u307E\u3057\u305F");
      }
      onClose?.();
    } catch (e) {
      console.error(e);
      showNotification?.("\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in", children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl relative flex flex-col items-center pb-8", children: [
    /* @__PURE__ */ jsx("button", { onClick: onClose, className: "absolute top-4 right-4 z-10 bg-black/20 text-white p-2 rounded-full backdrop-blur-md hover:bg-black/30", children: /* @__PURE__ */ jsx(X, { className: "w-6 h-6" }) }),
    /* @__PURE__ */ jsx("div", { className: "w-full h-48 bg-gray-200", children: /* @__PURE__ */ jsx("img", { src: friend.cover || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80", className: "w-full h-full object-cover" }) }),
    /* @__PURE__ */ jsx("div", { className: "-mt-16 mb-4 relative", children: /* @__PURE__ */ jsx("img", { src: friend.avatar, className: "w-32 h-32 rounded-[40px] border-[6px] border-white object-cover shadow-lg" }) }),
    /* @__PURE__ */ jsx("h2", { className: "text-2xl font-bold mb-1", children: friend.name }),
    /* @__PURE__ */ jsxs("p", { className: "text-xs text-gray-400 font-mono mb-4", children: [
      "ID: ",
      friend.id
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "w-full px-8 mb-4 grid grid-cols-3 gap-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 rounded-2xl p-3 text-center border", children: [
        /* @__PURE__ */ jsx("div", { className: "text-[10px] font-bold text-gray-400", children: "\u53CB\u3060\u3061" }),
        /* @__PURE__ */ jsx("div", { className: "text-lg font-black text-gray-800", children: friendFriends.length })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 rounded-2xl p-3 text-center border", children: [
        /* @__PURE__ */ jsx("div", { className: "text-[10px] font-bold text-gray-400", children: "\u5171\u901A" }),
        /* @__PURE__ */ jsx("div", { className: "text-lg font-black text-gray-800", children: mutualCount })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 rounded-2xl p-3 text-center border", children: [
        /* @__PURE__ */ jsx("div", { className: "text-[10px] font-bold text-gray-400", children: "\u53CB\u3060\u3061\u306E\u53CB\u3060\u3061" }),
        /* @__PURE__ */ jsx("div", { className: "text-lg font-black text-gray-800", children: fofCandidateCount })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "w-full px-8 mb-6", children: /* @__PURE__ */ jsx("p", { className: "text-center text-sm text-gray-600 bg-gray-50 py-3 px-4 rounded-2xl border", children: friend.status || "\u30B9\u30C6\u30FC\u30BF\u30B9\u306A\u3057" }) }),
    /* @__PURE__ */ jsxs("div", { className: "flex gap-3 w-full px-8", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => {
            onStartChat?.(friend.uid);
            onClose?.();
          },
          className: "flex-1 py-3 bg-green-500 text-white rounded-2xl font-bold shadow-lg shadow-green-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2",
          children: [
            /* @__PURE__ */ jsx(MessageCircle, { className: "w-5 h-5" }),
            " \u30C8\u30FC\u30AF"
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: onTransfer,
          className: "flex-1 py-3 bg-yellow-500 text-white rounded-2xl font-bold shadow-lg shadow-yellow-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2",
          children: [
            /* @__PURE__ */ jsx(Coins, { className: "w-5 h-5" }),
            " \u9001\u91D1"
          ]
        }
      )
    ] }),
    isFriend && /* @__PURE__ */ jsx("div", { className: "w-full px-8 mt-3", children: /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: toggleHideFriend,
        className: `w-full py-3 rounded-2xl font-bold border transition-colors flex items-center justify-center gap-2 ${isHidden ? "bg-white text-gray-700 hover:bg-gray-50" : "bg-gray-900 text-white hover:bg-black"}`,
        children: [
          isHidden ? /* @__PURE__ */ jsx(Eye, { className: "w-5 h-5" }) : /* @__PURE__ */ jsx(EyeOff, { className: "w-5 h-5" }),
          isHidden ? "\u975E\u8868\u793A\u3092\u89E3\u9664" : "\u975E\u8868\u793A\u306B\u3059\u308B"
        ]
      }
    ) })
  ] }) });
};
const MessageItem = React.memo(({ m, user, sender, isGroup, db: db2, appId: appId2, chatId, addFriendById, onEdit, onDelete, onPreview, onReply, onReaction, usersByUid, usersByName, onStickerClick, onShowProfile, onJoinCall }) => {
  const isMe = m.senderId === user.uid;
  const [mediaSrc, setMediaSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [forceChunkLoad, setForceChunkLoad] = useState(false);
  const isInvalidBlob = !isMe && m.content?.startsWith("blob:");
  const hasLocalBlobContent = isMe && m.content?.startsWith("blob:");
  const shouldLoadFromChunks = m.hasChunks && (!hasLocalBlobContent || forceChunkLoad);
  useEffect(() => {
    if (hasLocalBlobContent && !forceChunkLoad) {
      setMediaSrc(m.content);
      return;
    }
    return () => {
      if (mediaSrc && mediaSrc.startsWith("blob:") && !isMe && !isCachedMessageMediaUrl(mediaSrc)) {
        URL.revokeObjectURL(mediaSrc);
      }
    };
  }, [isMe, m.content, hasLocalBlobContent, forceChunkLoad, mediaSrc]);
  useEffect(() => {
    setForceChunkLoad(false);
  }, [m.id, chatId]);
  useEffect(() => {
    if (shouldLoadFromChunks) {
      if (mediaSrc && (mediaSrc.startsWith("blob:") || (!mediaSrc.startsWith("blob:") && mediaSrc !== m.preview))) return;
      setLoading(true);
      (async () => {
        try {
          const loadedUrl = await loadChunkedMessageMedia({ db: db2, appId: appId2, chatId, message: m });
          if (loadedUrl) {
            if (m.type !== "text" && m.type !== "contact") setMediaSrc(loadedUrl);
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
        setMediaSrc(hasLocalBlobContent && forceChunkLoad ? m.preview : m.content || m.preview);
      }
    }
  }, [m.id, chatId, m.content, m.hasChunks, isMe, isInvalidBlob, m.preview, m.type, m.mimeType, m.chunkCount, shouldLoadFromChunks, hasLocalBlobContent, forceChunkLoad, mediaSrc]);
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
        dataUrl = await loadChunkedMessageMedia({ db: db2, appId: appId2, chatId, message: m });
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
      new Audio(m.audio).play().catch((e2) => console.error("Audio playback error:", e2));
    }
    if (onStickerClick && m.packId) {
      onStickerClick(m.packId);
    }
  };
  const readCount = (m.readBy?.length || 1) - 1;
  const finalSrc = mediaSrc || m.preview;
  const isShowingPreview = loading || isInvalidBlob || finalSrc === m.preview;
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
      if (part.match(/^https?:\/\//)) return /* @__PURE__ */ jsx("a", { href: part, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 underline break-all", onClick: (e) => e.stopPropagation(), children: part }, i);
      if (part.startsWith("@")) {
        const name = part.substring(1);
        const mentionedUser = usersByName?.get(name);
        if (mentionedUser) return /* @__PURE__ */ jsx("span", { className: "text-blue-500 font-bold cursor-pointer hover:underline bg-blue-50 px-1 rounded", onClick: (e) => {
          e.stopPropagation();
          onShowProfile && onShowProfile(mentionedUser);
        }, children: part }, i);
      }
      return part;
    });
  };
  const getUserNames = (uids) => {
    if (!uids || !usersByUid) return "";
    return uids.map((uid) => {
      const u = usersByUid.get(uid);
      return u ? u.name : "\u4E0D\u660E\u306A\u30E6\u30FC\u30B6\u30FC";
    }).join(", ");
  };
  return /* @__PURE__ */ jsxs("div", { className: `flex ${isMe ? "justify-end" : "justify-start"} gap-2 relative group mb-3`, children: [
    !isMe && /* @__PURE__ */ jsxs("div", { className: "relative mt-1 cursor-pointer", onClick: (e) => {
      e.stopPropagation();
      onShowProfile && onShowProfile(sender);
    }, children: [
      !avatarError && sender?.avatar ? /* @__PURE__ */ jsx("img", { src: sender?.avatar, className: "w-9 h-9 rounded-2xl object-cover border border-gray-200", loading: "lazy", onError: () => setAvatarError(true) }, sender?.avatar) : /* @__PURE__ */ jsx("div", { className: "w-9 h-9 rounded-2xl bg-[#7a54c5] text-white text-lg leading-none font-medium flex items-center justify-center", children: (sender?.name || sender?.id || "h").trim().charAt(0).toLowerCase() || "h" }),
      isTodayBirthday(sender?.birthday) && /* @__PURE__ */ jsx("span", { className: "absolute -top-1 -right-1 text-[8px]", children: "\u{1F382}" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: `flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[75%]`, children: [
      !isMe && isGroup && /* @__PURE__ */ jsx("div", { className: "text-[9px] text-gray-600 font-bold mb-1 ml-1 cursor-pointer hover:underline", onClick: () => onShowProfile && onShowProfile(sender), children: sender?.name }),
      /* @__PURE__ */ jsx("div", { className: "relative", children: /* @__PURE__ */ jsxs("div", { onClick: handleBubbleClick, className: `p-1.5 px-2.5 rounded-[18px] text-[11px] shadow-sm relative cursor-pointer ${m.type === "sticker" ? "bg-transparent shadow-none p-0" : isMe ? "bg-[#76ff03] text-black" : "bg-white text-black"} ${["image", "video", "call_invite"].includes(m.type) ? "p-0 bg-transparent shadow-none" : ""}`, children: [
        m.replyTo && m.type !== "sticker" && /* @__PURE__ */ jsxs("div", { className: `mb-2 p-2 rounded-lg border-l-4 text-xs opacity-70 ${isMe ? "bg-black/5 border-white/50" : "bg-gray-100 border-gray-300"}`, children: [
          /* @__PURE__ */ jsx("div", { className: "font-bold text-[10px] mb-0.5", children: m.replyTo.senderName }),
          /* @__PURE__ */ jsxs("div", { className: "truncate flex items-center gap-1", children: [
            m.replyTo.type === "image" && /* @__PURE__ */ jsx(ImageIcon, { className: "w-3 h-3" }),
            m.replyTo.type === "video" && /* @__PURE__ */ jsx(Video, { className: "w-3 h-3" }),
            ["image", "video"].includes(m.replyTo.type) ? m.replyTo.type === "image" ? "[\u753B\u50CF]" : "[\u52D5\u753B]" : m.replyTo.content || "[\u30E1\u30C3\u30BB\u30FC\u30B8]"
          ] })
        ] }),
        m.type === "text" && /* @__PURE__ */ jsxs("div", { className: "whitespace-pre-wrap", children: [
          renderContent(m.content),
          m.isEdited && /* @__PURE__ */ jsx("div", { className: "text-[9px] text-black/40 text-right mt-1 font-bold", children: "(\u7DE8\u96C6\u6E08)" })
        ] }),
        m.type === "call_invite" && /* @__PURE__ */ jsxs("div", { className: "bg-white border rounded-2xl p-4 w-64 shadow-sm flex flex-col items-center gap-2", children: [
          /* @__PURE__ */ jsx("div", { className: "w-12 h-12 bg-green-100 rounded-full flex items-center justify-center animate-pulse", children: m.callType === "video" ? /* @__PURE__ */ jsx(Video, { className: "w-6 h-6 text-green-600" }) : /* @__PURE__ */ jsx(Phone, { className: "w-6 h-6 text-green-600" }) }),
          /* @__PURE__ */ jsxs("div", { className: "font-bold text-center", children: [
            m.callType === "video" ? "\u30D3\u30C7\u30AA\u901A\u8A71" : "\u97F3\u58F0\u901A\u8A71",
            "\u3092\u958B\u59CB\u3057\u307E\u3057\u305F"
          ] }),
          /* @__PURE__ */ jsx("button", { onClick: (e) => {
            e.stopPropagation();
            onJoinCall(m.callType === "video", m.senderId, m.sessionId || "");
          }, className: "w-full bg-green-500 text-white font-bold py-2 rounded-xl shadow mt-2 hover:bg-green-600 transition-colors", children: "\u53C2\u52A0\u3059\u308B" })
        ] }),
        m.type === "sticker" && /* @__PURE__ */ jsxs("div", { className: "relative group/sticker", onClick: handleStickerClick, children: [
          /* @__PURE__ */ jsx("img", { src: m.content || "", className: "w-32 h-32 object-contain drop-shadow-sm hover:scale-105 transition-transform" }),
          m.audio && /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 right-0 bg-black/20 text-white rounded-full p-1", children: /* @__PURE__ */ jsx(Volume2, { className: "w-3 h-3" }) })
        ] }),
        (m.type === "image" || m.type === "video") && /* @__PURE__ */ jsxs("div", { className: "relative flex justify-center", children: [
          isShowingPreview && !finalSrc ? /* @__PURE__ */ jsxs("div", { className: "p-4 bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 min-w-[150px] min-h-[100px] border border-gray-200", children: [
            /* @__PURE__ */ jsx(Loader2, { className: "animate-spin w-8 h-8 text-green-500" }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] text-gray-500 font-bold", children: m.type === "video" ? "\u52D5\u753B\u3092\u53D7\u4FE1\u4E2D..." : "\u753B\u50CF\u3092\u53D7\u4FE1\u4E2D..." })
          ] }) : /* @__PURE__ */ jsxs("div", { className: "relative", children: [
            m.type === "video" ? /* @__PURE__ */ jsx("video", { src: finalSrc || "", className: `block mx-auto w-full max-w-[320px] rounded-xl border border-white/50 shadow-md bg-black ${showMenu ? "brightness-50 transition-all" : ""}`, controls: true, playsInline: true, preload: "metadata", onError: () => {
              if (hasLocalBlobContent && m.hasChunks) setForceChunkLoad(true);
            } }) : /* @__PURE__ */ jsx("img", { src: finalSrc || "", className: `block mx-auto w-full max-w-[320px] rounded-xl border border-white/50 shadow-md ${showMenu ? "brightness-50 transition-all" : ""} ${isShowingPreview ? "opacity-80 blur-[1px]" : ""}`, loading: "lazy", onError: () => {
              if (hasLocalBlobContent && m.hasChunks) setForceChunkLoad(true);
            } }),
            m.type === "video" && !isShowingPreview && !finalSrc && /* @__PURE__ */ jsx("div", { className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none", children: /* @__PURE__ */ jsx("div", { className: "bg-black/30 rounded-full p-2 backdrop-blur-sm", children: /* @__PURE__ */ jsx(Play, { className: "w-8 h-8 text-white fill-white opacity-90" }) }) }),
            isShowingPreview && /* @__PURE__ */ jsxs("div", { className: "absolute bottom-2 right-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1", children: [
              /* @__PURE__ */ jsx(Loader2, { className: "w-3 h-3 animate-spin" }),
              " ",
              isInvalidBlob ? "\u9001\u4FE1\u4E2D..." : "\u53D7\u4FE1\u4E2D..."
            ] })
          ] }),
          isMe && m.isUploading && /* @__PURE__ */ jsx("div", { className: "absolute bottom-2 right-2 bg-black/50 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm", children: "\u9001\u4FE1\u4E2D..." })
        ] }),
        m.type === "audio" && /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2 py-1 px-1", children: loading ? /* @__PURE__ */ jsx(Loader2, { className: "animate-spin w-4 h-4 text-gray-400" }) : /* @__PURE__ */ jsx("audio", { src: mediaSrc || "", controls: true, className: "h-8 max-w-[200px]" }) }),
        m.type === "file" && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 p-2 min-w-[200px]", children: [
          /* @__PURE__ */ jsx("div", { className: "w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 border", children: /* @__PURE__ */ jsx(FileText, { className: "w-6 h-6 text-gray-500" }) }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
            /* @__PURE__ */ jsx("div", { className: "text-sm font-bold truncate", children: m.fileName || "\u4E0D\u660E\u306A\u30D5\u30A1\u30A4\u30EB" }),
            /* @__PURE__ */ jsx("div", { className: "text-[10px] text-gray-400", children: m.fileSize ? `${(m.fileSize / 1024).toFixed(1)} KB` : "\u30B5\u30A4\u30BA\u4E0D\u660E" })
          ] }),
          /* @__PURE__ */ jsx("button", { onClick: (e) => {
            e.stopPropagation();
            handleDownload();
          }, className: "w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors", disabled: loading, children: loading ? /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 animate-spin text-gray-500" }) : /* @__PURE__ */ jsx(Download, { className: "w-4 h-4 text-gray-600" }) })
        ] }),
        m.type === "contact" && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2 min-w-[150px] p-1", children: [
          /* @__PURE__ */ jsx("div", { className: "text-[10px] font-bold text-gray-400 mb-1 border-b border-gray-100 pb-1", children: "\u9023\u7D61\u5148" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("img", { src: m.contactAvatar, className: "w-10 h-10 rounded-full border shadow-sm", loading: "lazy" }),
            /* @__PURE__ */ jsx("span", { className: "font-bold text-sm truncate", children: m.contactName })
          ] }),
          !isMe && /* @__PURE__ */ jsxs("button", { onClick: (e) => {
            e.stopPropagation();
            addFriendById(m.contactId);
          }, className: "bg-black/5 hover:bg-black/10 text-xs font-bold py-2 rounded-xl mt-1 w-full flex items-center justify-center gap-2", children: [
            /* @__PURE__ */ jsx(UserPlus, { className: "w-3 h-3" }),
            " \u53CB\u3060\u3061\u8FFD\u52A0"
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: `text-[6px] mt-1 ${m.type === "image" || m.type === "video" ? "mx-auto w-fit px-3 py-0.5 rounded-full bg-white/30 text-[#8ea0ad] font-bold" : "opacity-50 text-right"} ${m.type === "sticker" ? "text-gray-500 font-bold bg-white/50 px-1 rounded" : ""}`, children: formatDateTime(m.createdAt) }),
        showMenu && /* @__PURE__ */ jsxs("div", { className: `absolute top-full ${isMe ? "right-0" : "left-0"} mt-1 z-[100] flex flex-col bg-white rounded-xl shadow-2xl border overflow-hidden min-w-[180px] animate-in slide-in-from-top-2 duration-200`, children: [
          /* @__PURE__ */ jsx("div", { className: "flex justify-between items-center p-2 bg-gray-50 border-b gap-1 overflow-x-auto scrollbar-hide", children: REACTION_EMOJIS.map((emoji) => /* @__PURE__ */ jsx("button", { onClick: (e) => {
            e.stopPropagation();
            onReaction(m.id, emoji);
            setShowMenu(false);
          }, className: "hover:scale-125 transition-transform text-lg p-1", children: emoji }, emoji)) }),
          /* @__PURE__ */ jsxs("button", { onClick: (e) => {
            e.stopPropagation();
            onReply(m);
            setShowMenu(false);
          }, className: "flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left", children: [
            /* @__PURE__ */ jsx(Reply, { className: "w-4 h-4" }),
            "\u30EA\u30D7\u30E9\u30A4"
          ] }),
          (m.type === "image" || m.type === "video") && /* @__PURE__ */ jsxs("button", { onClick: (e) => {
            e.stopPropagation();
            onPreview(finalSrc, m.type);
            setShowMenu(false);
          }, className: "flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100", children: [
            /* @__PURE__ */ jsx(Maximize, { className: "w-4 h-4" }),
            "\u62E1\u5927\u8868\u793A"
          ] }),
          m.type === "file" && /* @__PURE__ */ jsxs("button", { onClick: (e) => {
            e.stopPropagation();
            handleDownload();
            setShowMenu(false);
          }, className: "flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100", children: [
            /* @__PURE__ */ jsx(Download, { className: "w-4 h-4" }),
            "\u4FDD\u5B58"
          ] }),
          m.type === "text" && isMe && /* @__PURE__ */ jsxs("button", { onClick: (e) => {
            e.stopPropagation();
            onEdit(m.id, m.content);
            setShowMenu(false);
          }, className: "flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100", children: [
            /* @__PURE__ */ jsx(Edit2, { className: "w-4 h-4" }),
            "\u7DE8\u96C6"
          ] }),
          isMe && /* @__PURE__ */ jsxs("button", { onClick: (e) => {
            e.stopPropagation();
            onDelete(m.id);
            setShowMenu(false);
          }, className: "flex items-center gap-3 px-4 py-3 hover:bg-red-50 text-xs font-bold text-red-500 text-left border-t border-gray-100", children: [
            /* @__PURE__ */ jsx(Trash2, { className: "w-4 h-4" }),
            "\u9001\u4FE1\u53D6\u6D88"
          ] })
        ] })
      ] }) }),
      m.reactions && Object.keys(m.reactions).some((k) => m.reactions[k]?.length > 0) && /* @__PURE__ */ jsx("div", { className: `flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`, children: Object.entries(m.reactions).map(([emoji, uids]) => uids?.length > 0 && /* @__PURE__ */ jsxs("button", { onClick: () => onReaction(m.id, emoji), title: getUserNames(uids), className: `flex items-center gap-1 px-2 py-1 rounded-full text-xs shadow-sm border transition-all hover:scale-105 active:scale-95 ${uids.includes(user.uid) ? "bg-white border-green-500 text-green-600 ring-1 ring-green-100" : "bg-white border-gray-100 text-gray-600"}`, children: [
        /* @__PURE__ */ jsx("span", { className: "text-sm", children: emoji }),
        /* @__PURE__ */ jsx("span", { className: "font-bold text-[10px]", children: uids.length })
      ] }, emoji)) }),
      isMe && readCount > 0 && /* @__PURE__ */ jsxs("div", { className: "text-[10px] font-bold text-green-600 mt-0.5", children: [
        "\u65E2\u8AAD ",
        isGroup ? readCount : ""
      ] })
    ] })
  ] });
});
const PostItem = ({ post, user, allUsers, db: db2, appId: appId2, profile }) => {
  const [commentText, setCommentText] = useState(""), [mediaSrc, setMediaSrc] = useState(post.media), [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [postPreview, setPostPreview] = useState(null);
  const u = allUsers.find((x) => x.uid === post.userId), isLiked = post.likes?.includes(user?.uid);
  const isMe = post.userId === user.uid;
  useEffect(() => {
    if (post.hasChunks && !mediaSrc) {
      setIsLoadingMedia(true);
      (async () => {
        let mergedData = "";
        if (post.chunkCount) {
          const chunkPromises = [];
          for (let i = 0; i < post.chunkCount; i++) chunkPromises.push(getDoc(doc(db2, "artifacts", appId2, "public", "data", "posts", post.id, "chunks", `${i}`)));
          const chunkDocs = await Promise.all(chunkPromises);
          chunkDocs.forEach((d) => {
            if (d.exists()) mergedData += d.data().data;
          });
        } else {
          const snap = await getDocs(query(collection(db2, "artifacts", appId2, "public", "data", "posts", post.id, "chunks"), orderBy("index", "asc")));
          snap.forEach((d) => mergedData += d.data().data);
        }
        if (mergedData) {
          try {
            if (mergedData.startsWith("data:")) {
              setMediaSrc(mergedData);
            } else {
              const mimeType = post.mimeType || (post.mediaType === "video" ? "video/webm" : "image/jpeg");
              const byteCharacters = atob(mergedData);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
              const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
              setMediaSrc(URL.createObjectURL(blob));
            }
          } catch (e) {
            console.error("Post media load error", e);
          }
        }
        setIsLoadingMedia(false);
      })();
    }
  }, [post.id, post.chunkCount, post.hasChunks, post.mediaType, post.mimeType, mediaSrc]);
  useEffect(() => {
    return () => {
      if (mediaSrc && mediaSrc.startsWith("blob:") && !isMe) URL.revokeObjectURL(mediaSrc);
    };
  }, [mediaSrc, isMe]);
  const toggleLike = async () => await updateDoc(doc(db2, "artifacts", appId2, "public", "data", "posts", post.id), { likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) });
  const submitComment = async () => {
    if (!commentText.trim()) return;
    await updateDoc(doc(db2, "artifacts", appId2, "public", "data", "posts", post.id), { comments: arrayUnion({ userId: user.uid, userName: profile.name, text: commentText, createdAt: (/* @__PURE__ */ new Date()).toISOString() }) });
    setCommentText("");
  };
const deletePost = async () => {
  if (!isMe) return;
  const ok = window.confirm("この投稿を削除しますか？");
  if (!ok) return;
  try {
    const batch = writeBatch(db2);
    // Delete chunk docs if the post was stored in chunks
    if (post.hasChunks && post.chunkCount) {
      for (let i = 0; i < post.chunkCount; i++) {
        batch.delete(doc(db2, "artifacts", appId2, "public", "data", "posts", post.id, "chunks", `${i}`));
      }
    }
    batch.delete(doc(db2, "artifacts", appId2, "public", "data", "posts", post.id));
    await batch.commit();
  } catch (e) {
    console.warn("Delete post failed:", e);
    alert("削除に失敗しました");
  }
};
  return /* @__PURE__ */ jsxs("div", { className: "bg-white p-4 mb-2 border-b", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative", children: [
        /* @__PURE__ */ jsx("img", { src: u?.avatar, className: "w-10 h-10 rounded-xl border", loading: "lazy" }, u?.avatar),
        isTodayBirthday(u?.birthday) && /* @__PURE__ */ jsx("span", { className: "absolute -top-1 -right-1 text-xs", children: "\u{1F382}" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "font-bold text-sm", children: u?.name }),
      isMe && /* @__PURE__ */ jsx("button", { onClick: deletePost, className: "ml-auto p-2 rounded-full hover:bg-gray-100 text-gray-500", title: "\u524a\u9664", children: /* @__PURE__ */ jsx(Trash2, { className: "w-4 h-4" }) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "text-sm mb-3 whitespace-pre-wrap", children: post.content }),
    (mediaSrc || isLoadingMedia) && /* @__PURE__ */ jsxs("div", { className: "mb-3 bg-gray-50 rounded-2xl flex items-center justify-center min-h-[100px] relative overflow-hidden", children: [
      isLoadingMedia ? /* @__PURE__ */ jsx(Loader2, { className: "animate-spin w-5 h-5" }) : post.mediaType === "video" ? /* @__PURE__ */ jsx("video", { src: mediaSrc || "", className: "w-full rounded-2xl max-h-96 bg-black cursor-zoom-in", controls: true, playsInline: true, onClick: () => mediaSrc && setPostPreview({ src: mediaSrc, type: "video" }) }) : /* @__PURE__ */ jsx("img", { src: mediaSrc || "", className: "w-full rounded-2xl max-h-96 object-cover cursor-zoom-in", loading: "lazy", onClick: () => mediaSrc && setPostPreview({ src: mediaSrc, type: "image" }) }),
      !isLoadingMedia && mediaSrc && /* @__PURE__ */ jsxs("button", { onClick: () => setPostPreview({ src: mediaSrc, type: post.mediaType === "video" ? "video" : "image" }), className: "absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full", children: [
        /* @__PURE__ */ jsx(Maximize, { className: "w-3 h-3 inline mr-1" }),
        "\u62E1\u5927"
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-6 py-2 border-y mb-3", children: [
      /* @__PURE__ */ jsxs("button", { onClick: toggleLike, className: "flex items-center gap-1.5", children: [
        /* @__PURE__ */ jsx(Heart, { className: `w-5 h-5 ${isLiked ? "fill-red-500 text-red-500" : "text-gray-400"}` }),
        /* @__PURE__ */ jsx("span", { className: "text-xs", children: post.likes?.length || 0 })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5 text-gray-400", children: [
        /* @__PURE__ */ jsx(MessageCircle, { className: "w-5 h-5" }),
        /* @__PURE__ */ jsx("span", { className: "text-xs", children: post.comments?.length || 0 })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "space-y-3 mb-4", children: post.comments?.map((c, i) => /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 rounded-2xl px-3 py-2", children: [
      /* @__PURE__ */ jsx("div", { className: "text-[10px] font-bold text-gray-500", children: c.userName }),
      /* @__PURE__ */ jsx("div", { className: "text-xs", children: c.text })
    ] }, i)) }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1", children: [
      /* @__PURE__ */ jsx("input", { className: "flex-1 bg-transparent text-xs py-2 outline-none", placeholder: "\u30B3\u30E1\u30F3\u30C8...", value: commentText, onChange: (e) => setCommentText(e.target.value), onKeyPress: (e) => e.key === "Enter" && submitComment() }),
      /* @__PURE__ */ jsx("button", { onClick: submitComment, className: "text-green-500", children: /* @__PURE__ */ jsx(Send, { className: "w-4 h-4" }) })
    ] }),
    postPreview && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-[1200] bg-black/95 flex items-center justify-center p-4", onClick: () => setPostPreview(null), children: [
      /* @__PURE__ */ jsx("button", { className: "absolute top-5 right-5 text-white p-2 rounded-full bg-white/20", onClick: () => setPostPreview(null), children: /* @__PURE__ */ jsx(X, { className: "w-6 h-6" }) }),
      postPreview.type === "video" ? /* @__PURE__ */ jsx("video", { src: postPreview.src, controls: true, autoPlay: true, className: "max-w-full max-h-[88vh] rounded-xl bg-black", onClick: (e) => e.stopPropagation() }) : /* @__PURE__ */ jsx("img", { src: postPreview.src, className: "max-w-full max-h-[88vh] object-contain rounded-xl", onClick: (e) => e.stopPropagation() })
    ] })
  ] });
};
const GroupCreateView = ({ user, profile, allUsers, chats, setView, showNotification }) => {
  const [groupName, setGroupName] = useState("");
  const [groupIcon, setGroupIcon] = useState("https://api.dicebear.com/7.x/shapes/svg?seed=group");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const friendsList = useMemo(() => {
    const rawFriends = profile?.friends || [];
    const hiddenSet = new Set(profile?.hiddenFriends || []);
    const friendKeySet = new Set(rawFriends);
    (chats || []).forEach((chat) => {
      if (chat?.isGroup || !Array.isArray(chat?.participants) || !chat.participants.includes(user.uid)) return;
      const otherUid = chat.participants.find((p) => p && p !== user.uid);
      if (otherUid) friendKeySet.add(otherUid);
    });
    const byUid = allUsers.filter((u) => friendKeySet.has(u.uid));
    const byId = allUsers.filter((u) => friendKeySet.has(u.id));
    const merged = [...byUid, ...byId].filter((u) => u.uid && u.uid !== user.uid && !hiddenSet.has(u.uid));
    return Array.from(new Map(merged.map((u) => [u.uid, u])).values());
  }, [allUsers, chats, profile?.friends, profile?.hiddenFriends, user.uid]);
  const toggleMember = (uid) => {
    setSelectedMembers((prev) => prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]);
  };
  const handleCreate = async () => {
    if (profile?.isBanned) return showNotification("\u30A2\u30AB\u30A6\u30F3\u30C8\u304C\u5229\u7528\u505C\u6B62\u3055\u308C\u3066\u3044\u307E\u3059 \u{1F6AB}");
    if (!groupName.trim()) return showNotification("\u30B0\u30EB\u30FC\u30D7\u540D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
    if (selectedMembers.length === 0) return showNotification("\u30E1\u30F3\u30D0\u30FC\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
    const participants = Array.from(new Set([user.uid, ...selectedMembers]));
    const newGroupChat = { name: groupName, icon: groupIcon, participants, isGroup: true, createdBy: user.uid, updatedAt: serverTimestamp(), lastMessage: { content: "\u30B0\u30EB\u30FC\u30D7\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F", senderId: user.uid } };
    try {
      const chatRef = await addDoc(collection(db, "artifacts", appId, "public", "data", "chats"), newGroupChat);
      await addDoc(collection(db, "artifacts", appId, "public", "data", "chats", chatRef.id, "messages"), { senderId: user.uid, content: `${profile.name}\u304C\u30B0\u30EB\u30FC\u30D7\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F\u3002`, type: "text", createdAt: serverTimestamp(), readBy: [user.uid] });
      showNotification("\u30B0\u30EB\u30FC\u30D7\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F");
      setView("home");
    } catch (err) {
      showNotification("\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col h-full bg-white", children: [
    /* @__PURE__ */ jsxs("div", { className: "p-4 flex items-center gap-4 bg-white border-b sticky top-0 z-10", children: [
      /* @__PURE__ */ jsx(ChevronLeft, { className: "w-6 h-6 cursor-pointer", onClick: () => setView("home") }),
      /* @__PURE__ */ jsx("span", { className: "font-bold flex-1", children: "\u30B0\u30EB\u30FC\u30D7\u4F5C\u6210" }),
      /* @__PURE__ */ jsx("button", { onClick: handleCreate, className: "text-green-500 font-bold text-sm", children: "\u4F5C\u6210" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx("img", { src: groupIcon, className: "w-24 h-24 rounded-3xl object-cover bg-gray-100 border shadow-sm" }),
          /* @__PURE__ */ jsxs("label", { className: "absolute bottom-0 right-0 bg-green-500 p-2 rounded-full text-white cursor-pointer shadow-lg border-2 border-white", children: [
            /* @__PURE__ */ jsx(CameraIcon, { className: "w-4 h-4" }),
            /* @__PURE__ */ jsx("input", { type: "file", className: "hidden", accept: "image/*", onChange: (e) => handleCompressedUpload(e, (d) => setGroupIcon(d)) })
          ] })
        ] }),
        /* @__PURE__ */ jsx("input", { className: "w-full text-center text-lg font-bold border-b py-2 focus:outline-none focus:border-green-500", placeholder: "\u30B0\u30EB\u30FC\u30D7\u540D\u3092\u5165\u529B", value: groupName, onChange: (e) => setGroupName(e.target.value) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-xs font-bold text-gray-400 uppercase tracking-widest px-1", children: "\u53CB\u3060\u3061\u3092\u9078\u629E" }),
        /* @__PURE__ */ jsx("div", { className: "divide-y border-y", children: friendsList.map((f) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 py-3 cursor-pointer", onClick: () => toggleMember(f.uid), children: [
          /* @__PURE__ */ jsx("div", { className: "relative", children: /* @__PURE__ */ jsx("img", { src: f.avatar, className: "w-10 h-10 rounded-xl object-cover border" }) }),
          /* @__PURE__ */ jsx("span", { className: "flex-1 font-bold text-sm", children: f.name }),
          /* @__PURE__ */ jsx("div", { className: `w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedMembers.includes(f.uid) ? "bg-green-500 border-green-500" : "border-gray-200"}`, children: selectedMembers.includes(f.uid) && /* @__PURE__ */ jsx(Check, { className: "w-4 h-4 text-white" }) })
        ] }, f.uid)) })
      ] })
    ] })
  ] });
};
const BirthdayCardBox = ({ user, setView }) => {
  const [myCards, setMyCards] = useState([]);
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "artifacts", appId, "public", "data", "birthday_cards"), where("toUserId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const cards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cards.sort((a, b) => (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0) - (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0));
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
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col h-full bg-white", children: [
    /* @__PURE__ */ jsxs("div", { className: "p-4 border-b flex items-center gap-4 sticky top-0 bg-white z-10 shrink-0", children: [
      /* @__PURE__ */ jsx(ChevronLeft, { className: "w-6 h-6 cursor-pointer", onClick: () => setView("home") }),
      /* @__PURE__ */ jsxs("h1", { className: "text-xl font-bold flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(Gift, { className: "w-6 h-6 text-pink-500" }),
        " \u30AB\u30FC\u30C9BOX"
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-gray-50", children: myCards.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-center py-20 text-gray-400 font-bold", children: "\u30AB\u30FC\u30C9\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093" }) : myCards.map((card) => /* @__PURE__ */ jsxs("div", { className: `p-6 rounded-3xl border-2 shadow-sm relative ${getColorClass(card.color)}`, children: [
      /* @__PURE__ */ jsx("div", { className: "absolute top-4 right-4 text-4xl opacity-50", children: "\u{1F382}" }),
      /* @__PURE__ */ jsx("div", { className: "font-bold text-lg mb-2", children: "Happy Birthday!" }),
      /* @__PURE__ */ jsx("div", { className: "whitespace-pre-wrap text-sm font-medium mb-4", children: card.message }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mt-4 pt-4 border-t border-black/10", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-xs font-bold opacity-70", children: [
          "From: ",
          card.fromName
        ] }),
        /* @__PURE__ */ jsx("div", { className: "text-[10px] opacity-60", children: formatDate(card.createdAt) })
      ] })
    ] }, card.id)) })
  ] });
};
const StickerEditor = ({ user, profile, onClose, showNotification }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const cuttingSnapshotRef = useRef(null);
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(5);
  const [fontSize, setFontSize] = useState(24);
  const [createdStickers, setCreatedStickers] = useState([]);
  const [packName, setPackName] = useState("");
  const [packDescription, setPackDescription] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState("pen");
  const [textInput, setTextInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cutPoints, setCutPoints] = useState([]);
  const [audioData, setAudioData] = useState(null);
  const [isRecordingSticker, setIsRecordingSticker] = useState(false);
  const stickerMediaRecorderRef = useRef(null);
  const [textObjects, setTextObjects] = useState([]);
  const [draggingTextId, setDraggingTextId] = useState(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 250;
      canvas.height = 250;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 250, 250);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, []);
  const startDraw = (e) => {
    if (draggingTextId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    if (mode === "scissors") {
      setIsDrawing(true);
      setCutPoints([{ x, y }]);
      cuttingSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.moveTo(x, y);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };
  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    if (mode === "scissors") {
      setCutPoints((prev) => [...prev, { x, y }]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ff0000";
      ctx.setLineDash([5, 5]);
      ctx.lineTo(x, y);
      ctx.stroke();
      return;
    }
    ctx.strokeStyle = mode === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = mode === "eraser" ? 20 : lineWidth;
    ctx.setLineDash([]);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const endDraw = () => {
    if (mode === "scissors" && isDrawing) {
      setIsDrawing(false);
      applyFreehandCut();
      setCutPoints([]);
      cuttingSnapshotRef.current = null;
      return;
    }
    setIsDrawing(false);
  };
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setTextObjects([]);
      setAudioData(null);
    }
  };
  const addText = () => {
    if (!textInput) return;
    const newText = { id: Date.now(), text: textInput, x: 125, y: 125, color, fontSize };
    setTextObjects([...textObjects, newText]);
    setTextInput("");
    showNotification("\u30C6\u30AD\u30B9\u30C8\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F\u3002\u30C9\u30E9\u30C3\u30B0\u3057\u3066\u79FB\u52D5\u3067\u304D\u307E\u3059");
  };
  const handleTextMouseDown = (e, id) => {
    e.stopPropagation();
    setDraggingTextId(id);
  };
  const handleContainerMouseMove = (e) => {
    if (draggingTextId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX || e.touches[0].clientX) - rect.left;
      const y = (e.clientY || e.touches[0].clientY) - rect.top;
      setTextObjects((prev) => prev.map((t) => t.id === draggingTextId ? { ...t, x, y } : t));
    }
  };
  const handleContainerMouseUp = () => {
    setDraggingTextId(null);
  };
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    handleCompressedUpload(e, (dataUrl) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx && canvas) {
          let width = img.width;
          let height = img.height;
          const maxSize = 250;
          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height;
              height = maxSize;
            }
          }
          const x = (maxSize - width) / 2;
          const y = (maxSize - height) / 2;
          ctx.drawImage(img, x, y, width, height);
        }
      };
      img.src = dataUrl;
    });
    e.target.value = "";
  };
  const handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAudioData(ev.target.result);
      showNotification("\u97F3\u58F0\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F \u{1F3B5}");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const startStickerRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      stickerMediaRecorderRef.current = mediaRecorder;
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioData(reader.result);
          showNotification("\u9332\u97F3\u3057\u307E\u3057\u305F \u{1F3A4}");
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecordingSticker(true);
    } catch (e) {
      showNotification("\u30DE\u30A4\u30AF\u3092\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093");
    }
  };
  const stopStickerRecording = () => {
    if (stickerMediaRecorderRef.current && isRecordingSticker) {
      stickerMediaRecorderRef.current.stop();
      setIsRecordingSticker(false);
    }
  };
  const cutShape = (shape) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;
    tempCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    if (shape === "circle") {
      ctx.arc(width / 2, height / 2, width / 2, 0, Math.PI * 2);
    } else if (shape === "heart") {
      const topCurveHeight = height * 0.3;
      ctx.moveTo(width / 2, height * 0.2);
      ctx.bezierCurveTo(width / 2, 0, 0, 0, 0, topCurveHeight);
      ctx.bezierCurveTo(0, (height + topCurveHeight) / 2, width / 2, height * 0.9, width / 2, height);
      ctx.bezierCurveTo(width / 2, height * 0.9, width, (height + topCurveHeight) / 2, width, topCurveHeight);
      ctx.bezierCurveTo(width, 0, width / 2, 0, width / 2, height * 0.2);
    } else if (shape === "star") {
      const cx = width / 2;
      const cy = height / 2;
      const outerRadius = width / 2;
      const innerRadius = width / 4;
      const spikes = 5;
      let rot = Math.PI / 2 * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;
        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
    }
    ctx.clip();
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();
    showNotification(`${shape === "circle" ? "\u4E38" : shape === "heart" ? "\u30CF\u30FC\u30C8" : "\u661F"}\u578B\u306B\u5207\u308A\u629C\u304D\u307E\u3057\u305F`);
  };
  const applyFreehandCut = () => {
    if (cutPoints.length < 3 || !cuttingSnapshotRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cutPoints[0].x, cutPoints[0].y);
    for (let i = 1; i < cutPoints.length; i++) ctx.lineTo(cutPoints[i].x, cutPoints[i].y);
    ctx.closePath();
    ctx.clip();
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;
    tempCtx.putImageData(cuttingSnapshotRef.current, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();
    showNotification("\u81EA\u7531\u306B\u5207\u308A\u629C\u304D\u307E\u3057\u305F");
  };
  const saveStickerToPack = () => {
    if (createdStickers.length >= 8) {
      showNotification("1\u30D1\u30C3\u30AF\u6700\u59278\u500B\u307E\u3067\u3067\u3059");
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    textObjects.forEach((t) => {
      ctx.font = `bold ${t.fontSize}px sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.restore();
    const dataUrl = canvas.toDataURL("image/png", 0.8);
    setCreatedStickers([...createdStickers, { image: dataUrl, audio: audioData }]);
    clearCanvas();
    showNotification("\u30D1\u30C3\u30AF\u306B\u8FFD\u52A0\u3057\u307E\u3057\u305F");
  };
  const submitPack = async () => {
    if (profile?.isBanned) return showNotification("\u30A2\u30AB\u30A6\u30F3\u30C8\u304C\u5229\u7528\u505C\u6B62\u3055\u308C\u3066\u3044\u307E\u3059 \u{1F6AB}");
    if (!packName.trim()) return showNotification("\u30D1\u30C3\u30AF\u540D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
    if (createdStickers.length === 0) return showNotification("\u30B9\u30BF\u30F3\u30D7\u304C\u3042\u308A\u307E\u305B\u3093");
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "artifacts", appId, "public", "data", "sticker_packs"), { authorId: user.uid, authorName: profile?.name || user.displayName || "Creator", name: packName, description: packDescription, stickers: createdStickers, price: 100, status: "pending", purchasedBy: [], createdAt: serverTimestamp() });
      showNotification("\u7533\u8ACB\u3057\u307E\u3057\u305F\uFF01\u627F\u8A8D\u3055\u308C\u308B\u3068\u5831\u916C\u304C\u3082\u3089\u3048\u307E\u3059");
      onClose();
    } catch (e) {
      console.error(e);
      showNotification("\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
    } finally {
      setIsSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col h-full bg-white", children: [
    /* @__PURE__ */ jsxs("div", { className: "p-4 border-b flex items-center justify-between", children: [
      /* @__PURE__ */ jsx("button", { onClick: onClose, children: /* @__PURE__ */ jsx(ChevronLeft, { className: "w-6 h-6" }) }),
      /* @__PURE__ */ jsx("h2", { className: "font-bold", children: "\u30B9\u30BF\u30F3\u30D7\u4F5C\u6210\u30B9\u30BF\u30B8\u30AA" }),
      /* @__PURE__ */ jsx("div", { className: "w-6" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-4 flex flex-col items-center gap-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "w-full max-w-xs space-y-2", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-gray-500 mb-1", children: "\u30D1\u30C3\u30AF\u540D" }),
          /* @__PURE__ */ jsx("input", { className: "w-full border p-2 rounded-xl", placeholder: "\u4F8B: \u9762\u767D\u3046\u3055\u304E\u30BB\u30C3\u30C8", value: packName, onChange: (e) => setPackName(e.target.value) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-gray-500 mb-1", children: "\u8AAC\u660E\u6587" }),
          /* @__PURE__ */ jsx("input", { className: "w-full border p-2 rounded-xl", placeholder: "\u3069\u3093\u306A\u30B9\u30BF\u30F3\u30D7\u3067\u3059\u304B\uFF1F", value: packDescription, onChange: (e) => setPackDescription(e.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs(
        "div",
        {
          ref: containerRef,
          className: "relative",
          style: { width: "250px", height: "250px" },
          onMouseMove: handleContainerMouseMove,
          onMouseUp: handleContainerMouseUp,
          onTouchMove: handleContainerMouseMove,
          onTouchEnd: handleContainerMouseUp,
          children: [
            /* @__PURE__ */ jsx("canvas", { ref: canvasRef, className: `border-2 border-dashed ${mode === "scissors" ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"} rounded-xl shadow-inner touch-none`, onMouseDown: startDraw, onMouseMove: draw, onMouseUp: endDraw, onMouseLeave: endDraw, onTouchStart: startDraw, onTouchMove: draw, onTouchEnd: endDraw, style: { width: "100%", height: "100%" } }),
            textObjects.map((t) => /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  position: "absolute",
                  left: t.x,
                  top: t.y,
                  transform: "translate(-50%, -50%)",
                  color: t.color,
                  fontSize: `${t.fontSize}px`,
                  fontWeight: "bold",
                  cursor: "move",
                  userSelect: "none",
                  pointerEvents: "auto"
                },
                onMouseDown: (e) => handleTextMouseDown(e, t.id),
                onTouchStart: (e) => handleTextMouseDown(e, t.id),
                children: t.text
              },
              t.id
            )),
            /* @__PURE__ */ jsxs("label", { className: "absolute top-2 right-2 bg-gray-100 p-2 rounded-full cursor-pointer hover:bg-gray-200", title: "\u753B\u50CF\u3092\u8AAD\u307F\u8FBC\u3080", children: [
              /* @__PURE__ */ jsx(Upload, { className: "w-4 h-4 text-gray-600" }),
              /* @__PURE__ */ jsx("input", { type: "file", className: "hidden", accept: "image/*", onChange: handleImageUpload })
            ] }),
            mode === "scissors" && /* @__PURE__ */ jsx("div", { className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500 font-bold opacity-30 pointer-events-none text-xl", children: "\u5207\u308A\u629C\u304D\u30E2\u30FC\u30C9" }),
            audioData && /* @__PURE__ */ jsx("div", { className: "absolute bottom-2 left-2 bg-green-100 text-green-600 p-1 rounded-full", children: /* @__PURE__ */ jsx(Music, { className: "w-4 h-4" }) })
          ]
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 items-center w-full max-w-xs justify-center flex-wrap", children: [
        /* @__PURE__ */ jsx("button", { onClick: () => setMode("pen"), className: `p-3 rounded-full ${mode === "pen" ? "bg-black text-white" : "bg-gray-100"}`, children: /* @__PURE__ */ jsx(PenTool, { className: "w-5 h-5" }) }),
        /* @__PURE__ */ jsx("button", { onClick: () => setMode("eraser"), className: `p-3 rounded-full ${mode === "eraser" ? "bg-black text-white" : "bg-gray-100"}`, children: /* @__PURE__ */ jsx(Eraser, { className: "w-5 h-5" }) }),
        /* @__PURE__ */ jsx("button", { onClick: () => setMode("scissors"), className: `p-3 rounded-full ${mode === "scissors" ? "bg-red-500 text-white animate-pulse" : "bg-gray-100"}`, title: "\u30D5\u30EA\u30FC\u30CF\u30F3\u30C9\u5207\u308A\u629C\u304D", children: /* @__PURE__ */ jsx(Scissors, { className: "w-5 h-5" }) }),
        /* @__PURE__ */ jsx("div", { className: "w-px h-8 bg-gray-300 mx-2" }),
        /* @__PURE__ */ jsx("button", { onClick: () => cutShape("circle"), className: "p-3 rounded-full bg-blue-100 text-blue-600", title: "\u4E38\u304F\u5207\u308A\u629C\u304F", children: /* @__PURE__ */ jsx(Disc, { className: "w-5 h-5" }) }),
        /* @__PURE__ */ jsx("button", { onClick: () => cutShape("heart"), className: "p-3 rounded-full bg-pink-100 text-pink-600", title: "\u30CF\u30FC\u30C8\u578B\u306B\u5207\u308A\u629C\u304F", children: /* @__PURE__ */ jsx(Heart, { className: "w-5 h-5" }) }),
        /* @__PURE__ */ jsx("button", { onClick: () => cutShape("star"), className: "p-3 rounded-full bg-yellow-100 text-yellow-600", title: "\u661F\u578B\u306B\u5207\u308A\u629C\u304F", children: /* @__PURE__ */ jsx(Star, { className: "w-5 h-5" }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2 w-full max-w-xs", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex gap-4 items-center justify-center", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] text-gray-400", children: "\u592A\u3055" }),
            /* @__PURE__ */ jsx("input", { type: "range", min: "1", max: "20", value: lineWidth, onChange: (e) => setLineWidth(Number(e.target.value)), className: "w-20" })
          ] }),
          /* @__PURE__ */ jsx("input", { type: "color", value: color, onChange: (e) => setColor(e.target.value), className: "w-10 h-10 rounded-full overflow-hidden border-2" }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] text-gray-400", children: "\u6587\u5B57\u30B5\u30A4\u30BA" }),
            /* @__PURE__ */ jsx("input", { type: "range", min: "12", max: "60", value: fontSize, onChange: (e) => setFontSize(Number(e.target.value)), className: "w-20" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2 items-center justify-center bg-gray-50 p-2 rounded-xl", children: [
          /* @__PURE__ */ jsxs("label", { className: "p-2 bg-white rounded-lg shadow-sm cursor-pointer flex items-center gap-1 text-xs font-bold", children: [
            /* @__PURE__ */ jsx(Upload, { className: "w-3 h-3" }),
            " \u97F3\u58F0\u8AAD\u8FBC",
            /* @__PURE__ */ jsx("input", { type: "file", className: "hidden", accept: "audio/*", onChange: handleAudioUpload })
          ] }),
          !isRecordingSticker ? /* @__PURE__ */ jsxs("button", { onClick: startStickerRecording, className: "p-2 bg-red-100 text-red-500 rounded-lg shadow-sm flex items-center gap-1 text-xs font-bold", children: [
            /* @__PURE__ */ jsx(Mic, { className: "w-3 h-3" }),
            " \u9332\u97F3"
          ] }) : /* @__PURE__ */ jsxs("button", { onClick: stopStickerRecording, className: "p-2 bg-red-500 text-white rounded-lg shadow-sm flex items-center gap-1 text-xs font-bold animate-pulse", children: [
            /* @__PURE__ */ jsx(StopCircle, { className: "w-3 h-3" }),
            " \u505C\u6B62"
          ] }),
          audioData && /* @__PURE__ */ jsx("button", { onClick: () => setAudioData(null), className: "p-2 bg-gray-200 rounded-lg text-xs font-bold", children: "\u97F3\u58F0\u524A\u9664" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 w-full max-w-xs", children: [
        /* @__PURE__ */ jsx("input", { className: "flex-1 border p-2 rounded-lg text-sm", placeholder: "\u6587\u5B57\u5165\u308C...", value: textInput, onChange: (e) => setTextInput(e.target.value) }),
        /* @__PURE__ */ jsx("button", { onClick: addText, className: "bg-gray-200 p-2 rounded-lg text-xs font-bold", children: "\u8FFD\u52A0" }),
        /* @__PURE__ */ jsx("button", { onClick: clearCanvas, className: "bg-red-100 text-red-500 p-2 rounded-lg text-xs font-bold", children: "\u5168\u30AF\u30EA\u30A2" })
      ] }),
      /* @__PURE__ */ jsxs("button", { onClick: saveStickerToPack, className: "w-full max-w-xs py-3 bg-blue-500 text-white font-bold rounded-2xl shadow-lg", children: [
        "\u3053\u306E\u30B9\u30BF\u30F3\u30D7\u3092\u30D1\u30C3\u30AF\u306B\u8FFD\u52A0 (",
        createdStickers.length,
        "/8)"
      ] }),
      createdStickers.length > 0 && /* @__PURE__ */ jsxs("div", { className: "w-full max-w-xs", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs font-bold text-gray-400 mb-2", children: "\u4F5C\u6210\u6E08\u307F\u30EA\u30B9\u30C8" }),
        /* @__PURE__ */ jsx("div", { className: "flex gap-2 overflow-x-auto pb-2", children: createdStickers.map((s, i) => /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx("img", { src: typeof s === "string" ? s : s.image, className: "w-16 h-16 border rounded bg-gray-50 object-contain" }),
          typeof s !== "string" && s.audio && /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 right-0 bg-green-500 w-3 h-3 rounded-full border border-white" })
        ] }, i)) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "w-full h-10" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "p-4 border-t bg-white", children: /* @__PURE__ */ jsx("button", { onClick: submitPack, disabled: createdStickers.length === 0 || isSubmitting, className: "w-full py-4 bg-green-500 text-white font-bold rounded-2xl shadow-xl disabled:bg-gray-300", children: isSubmitting ? /* @__PURE__ */ jsx(Loader2, { className: "w-6 h-6 animate-spin mx-auto" }) : "\u8CA9\u58F2\u7533\u8ACB\u3059\u308B (\u5831\u916C\u306F\u627F\u8A8D\u5F8C)" }) })
  ] });
};
const StickerStoreView = ({ user, setView, showNotification, profile, allUsers }) => {
  const [packs, setPacks] = useState([]);
  const [activeTab, setActiveTab] = useState("shop");
  const [activeShopTab, setActiveShopTab] = useState("stickers");
  const [adminSubTab, setAdminSubTab] = useState("stickers");
  const [adminMode, setAdminMode] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [purchasing, setPurchasing] = useState(null);
  const [banTarget, setBanTarget] = useState(null);
  const [grantAmount, setGrantAmount] = useState("");
  const [effectsMode, setEffectsMode] = useState("market");
  const [marketEffects, setMarketEffects] = useState([]);
  const [publicMarketEffects, setPublicMarketEffects] = useState([]);
  const [fallbackMarketEffects, setFallbackMarketEffects] = useState([]);
  const [myEffects, setMyEffects] = useState([]);
  const [priceDrafts, setPriceDrafts] = useState({});
  const [updatingEffectId, setUpdatingEffectId] = useState(null);
  const effectsForSale = [
    { id: "effect_fire", name: "Fire", price: 500, description: "\u71C3\u3048\u308B\u3088\u3046\u306A\u60C5\u71B1\u30A8\u30D5\u30A7\u30AF\u30C8", image: "https://images.unsplash.com/photo-1486162928267-e6274cb3106f?w=200&q=80", filter: "sepia(100%) hue-rotate(-50deg) saturate(300%)", creatorId: "system" },
    { id: "effect_ice", name: "Ice", price: 500, description: "\u30AF\u30FC\u30EB\u306A\u6C37\u30A8\u30D5\u30A7\u30AF\u30C8", image: "https://images.unsplash.com/photo-1549488497-69502a5c3289?w=200&q=80", filter: "sepia(100%) hue-rotate(180deg) saturate(200%)", creatorId: "system" },
    { id: "effect_rainbow", name: "Rainbow", price: 800, description: "\u8679\u8272\u306B\u8F1D\u304F\u30A8\u30D5\u30A7\u30AF\u30C8", image: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=200&q=80", filter: "hue-rotate(90deg) saturate(200%)", creatorId: "system" }
  ];
  useEffect(() => {
    if (activeTab === "shop" && activeShopTab === "stickers") {
      const q = query(collection(db, "artifacts", appId, "public", "data", "sticker_packs"), where("status", "==", "approved"));
      const unsub = onSnapshot(q, (snap) => {
        const fetchedPacks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        fetchedPacks.sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : a.createdAt?.seconds * 1e3 || 0;
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : b.createdAt?.seconds * 1e3 || 0;
          return tB - tA;
        });
        setPacks(fetchedPacks);
      });
      return () => unsub();
    } else if (activeTab === "admin" && adminSubTab === "stickers") {
      const q = query(collection(db, "artifacts", appId, "public", "data", "sticker_packs"), where("status", "==", "pending"));
      const unsub = onSnapshot(q, (snap) => {
        const fetchedPacks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPacks(fetchedPacks);
      });
      return () => unsub();
    }
  }, [activeTab, adminSubTab, activeShopTab]);
  useEffect(() => {
    if (!(activeTab === "shop" && activeShopTab === "effects")) return;
    setMarketEffects([]);
    const qPublicMarket = collection(db, "artifacts", appId, "public", "data", "effect_market");
    const unsubPublicMarket = onSnapshot(
      qPublicMarket,
      (snap) => {
        const items = snap.docs.map((d) => ({
          _key: d.ref.path,
          id: d.id,
          ref: d.ref,
          marketRefPath: d.ref.path,
          ...d.data()
        }));
        items.sort((a, b) => {
          const tA = a.listedAt?.toDate ? a.listedAt.toDate().getTime() : a.listedAt?.seconds * 1e3 || a.updatedAt?.seconds * 1e3 || 0;
          const tB = b.listedAt?.toDate ? b.listedAt.toDate().getTime() : b.listedAt?.seconds * 1e3 || b.updatedAt?.seconds * 1e3 || 0;
          return tB - tA;
        });
        setPublicMarketEffects(items);
      },
      (err) => {
        console.warn("public market subscribe failed:", err);
        setPublicMarketEffects([]);
      }
    );
    const qMine = collection(db, "artifacts", appId, "public", "data", "users", user.uid, "effects");
    const unsubMine = onSnapshot(qMine, (snap) => {
      const mine = snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
      mine.sort((a, b) => {
        const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : a.createdAt?.seconds * 1e3 || 0;
        const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : b.createdAt?.seconds * 1e3 || 0;
        return tB - tA;
      });
      setMyEffects(mine);
      setPriceDrafts((prev) => {
        const next = { ...prev };
        mine.forEach((ef) => {
          if (next[ef.id] === void 0) next[ef.id] = ef.price !== void 0 ? String(ef.price) : "";
        });
        return next;
      });
    });
    return () => {
      unsubPublicMarket();
      unsubMine();
    };
  }, [activeTab, activeShopTab, user.uid]);
  useEffect(() => {
    if (!(activeTab === "shop" && activeShopTab === "effects")) return;
    let cancelled = false;
    const loadFallbackMarket = async () => {
      try {
        const targets = (allUsers || []).map((u) => u?.uid).filter((uid) => !!uid);
        const results = await Promise.all(
          targets.map(async (uid) => {
            const q = query(collection(db, "artifacts", appId, "public", "data", "users", uid, "effects"), where("forSale", "==", true));
            const snap = await getDocs(q);
            return snap.docs.map((d) => ({
              _key: d.ref.path,
              id: d.id,
              ref: d.ref,
              sourceRefPath: d.ref.path,
              creatorId: uid,
              ownerId: uid,
              ...d.data()
            }));
          })
        );
        if (cancelled) return;
        const items = results.flat();
        items.sort((a, b) => {
          const tA = a.listedAt?.toDate ? a.listedAt.toDate().getTime() : a.listedAt?.seconds * 1e3 || a.updatedAt?.seconds * 1e3 || 0;
          const tB = b.listedAt?.toDate ? b.listedAt.toDate().getTime() : b.listedAt?.seconds * 1e3 || b.updatedAt?.seconds * 1e3 || 0;
          return tB - tA;
        });
        setFallbackMarketEffects(items);
      } catch (e) {
        console.warn("fallback market load failed:", e);
        if (!cancelled) setFallbackMarketEffects([]);
      }
    };
    loadFallbackMarket();
    const timer = setInterval(loadFallbackMarket, 15e3);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeTab, activeShopTab, allUsers]);
  const visibleMarketEffects = useMemo(() => {
    const getTime = (v) => {
      if (!v) return 0;
      if (v.toDate) return v.toDate().getTime();
      if (typeof v.seconds === "number") return v.seconds * 1e3;
      return 0;
    };
    const map = /* @__PURE__ */ new Map();
    const push = (effect) => {
      const shouldShow = effect?.forSale !== false && Number(effect?.price || 0) > 0;
      if (!shouldShow) return;
      const refPath = effect?.ref?.path;
      const key = effect?._key || refPath || effect?.id;
      if (!key) return;
      const inferredSellerId = effect?.creatorId || effect?.ownerId || getEffectOwnerUidFromRefPath(refPath);
      if (!inferredSellerId) return;
      const normalized = { ...effect, _key: key, creatorId: inferredSellerId, ownerId: effect?.ownerId || inferredSellerId };
      if (!map.has(key)) map.set(key, normalized);
    };
    publicMarketEffects.forEach(push);
    marketEffects.forEach(push);
    fallbackMarketEffects.forEach(push);
    myEffects.forEach((ef) => push({ ...ef, _key: ef?.ref?.path || ef.id }));
    const list = Array.from(map.values());
    list.sort((a, b) => {
      const tA = getTime(a.listedAt) || getTime(a.createdAt);
      const tB = getTime(b.listedAt) || getTime(b.createdAt);
      return tB - tA;
    });
    return list;
  }, [marketEffects, myEffects, publicMarketEffects, fallbackMarketEffects]);
  const handleBuyEffect = async (effect) => {
    if (profile?.isBanned) return showNotification("\u30A2\u30AB\u30A6\u30F3\u30C8\u304C\u5229\u7528\u505C\u6B62\u3055\u308C\u3066\u3044\u307E\u3059 \u{1F6AB}");
    if ((profile.wallet || 0) < effect.price) {
      showNotification("\u30B3\u30A4\u30F3\u304C\u8DB3\u308A\u307E\u305B\u3093");
      return;
    }
    const userEffectsRef = collection(db, "artifacts", appId, "public", "data", "users", user.uid, "effects");
    const owned = await getDocs(query(userEffectsRef, where("name", "==", effect.name)));
    if (!owned.empty) {
      showNotification("\u65E2\u306B\u6301\u3063\u3066\u3044\u307E\u3059");
      return;
    }
    setPurchasing(effect.id);
    try {
      await runTransaction(db, async (t) => {
        const userRef = doc(db, "artifacts", appId, "public", "data", "users", user.uid);
        t.update(userRef, { wallet: increment(-effect.price) });
        const newEffectRef = doc(collection(db, "artifacts", appId, "public", "data", "users", user.uid, "effects"));
        t.set(newEffectRef, { name: effect.name, image: effect.image, filter: effect.filter || null, type: "premium", source: "system", ownerId: user.uid, creatorId: effect.creatorId || "system", forSale: false, price: 0, createdAt: serverTimestamp() });
      });
      showNotification(`${effect.name}\u3092\u8CFC\u5165\u3057\u307E\u3057\u305F\uFF01`);
    } catch (e) {
      console.error(e);
      showNotification("\u8CFC\u5165\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    } finally {
      setPurchasing(null);
    }
  };
  const handleBuyMarketEffect = async (effect) => {
    if (profile?.isBanned) return showNotification("\u30A2\u30AB\u30A6\u30F3\u30C8\u304C\u5229\u7528\u505C\u6B62\u3055\u308C\u3066\u3044\u307E\u3059 \u{1F6AB}");
    const price = Number(effect?.price || 0);
    const sellerId = effect?.creatorId || effect?.ownerId || getEffectOwnerUidFromRefPath(effect?.ref?.path);
    if (!sellerId) {
      showNotification("\u8CA9\u58F2\u8005\u60C5\u5831\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
      return;
    }
    if (sellerId === user.uid) {
      showNotification("\u81EA\u5206\u306E\u51FA\u54C1\u306F\u8CFC\u5165\u3067\u304D\u307E\u305B\u3093");
      return;
    }
    if (price <= 0 || !Number.isFinite(price)) {
      showNotification("\u4FA1\u683C\u304C\u4E0D\u6B63\u3067\u3059");
      return;
    }
    if ((profile.wallet || 0) < price) {
      showNotification("\u30B3\u30A4\u30F3\u304C\u8DB3\u308A\u307E\u305B\u3093");
      return;
    }
    const userEffectsRef = collection(db, "artifacts", appId, "public", "data", "users", user.uid, "effects");
    let ownedQuery = query(userEffectsRef, where("name", "==", effect.name));
    if (sellerId) ownedQuery = query(userEffectsRef, where("name", "==", effect.name), where("creatorId", "==", sellerId));
    const owned = await getDocs(ownedQuery);
    if (!owned.empty) {
      showNotification("\u65E2\u306B\u6301\u3063\u3066\u3044\u307E\u3059");
      return;
    }
    setPurchasing(effect._key || effect.id);
    try {
      await runTransaction(db, async (t) => {
        const buyerRef = doc(db, "artifacts", appId, "public", "data", "users", user.uid);
        const sellerRef = doc(db, "artifacts", appId, "public", "data", "users", sellerId);
        const buyerSnap = await t.get(buyerRef);
        const wallet = buyerSnap.data()?.wallet || 0;
        if (wallet < price) throw new Error("NOT_ENOUGH");
        t.update(buyerRef, { wallet: increment(-price) });
        if (sellerId !== "system") t.update(sellerRef, { wallet: increment(price) });
        const newEffectRef = doc(collection(db, "artifacts", appId, "public", "data", "users", user.uid, "effects"));
        t.set(newEffectRef, {
          name: effect.name,
          image: effect.image,
          filter: effect.filter || null,
          type: "purchased",
          source: "market",
          ownerId: user.uid,
          creatorId: sellerId,
          forSale: false,
          price: 0,
          purchasedPrice: price,
          purchasedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        if (effect?.sourceRefPath) {
          t.update(doc(db, effect.sourceRefPath), { soldCount: increment(1) });
        }
        if (effect?.marketRefPath) {
          t.update(doc(db, effect.marketRefPath), { soldCount: increment(1) });
        } else if (effect?.ref) {
          t.update(effect.ref, { soldCount: increment(1) });
        }
      });
      showNotification(`${effect.name}\u3092\u8CFC\u5165\u3057\u307E\u3057\u305F\uFF01`);
    } catch (e) {
      console.error(e);
      showNotification(e?.message === "NOT_ENOUGH" ? "\u30B3\u30A4\u30F3\u304C\u8DB3\u308A\u307E\u305B\u3093" : "\u8CFC\u5165\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    } finally {
      setPurchasing(null);
    }
  };
  const canSellMyEffect = (ef) => {
    const creatorId = ef?.creatorId;
    if (creatorId) return creatorId === user.uid;
    if (ef?.type === "premium" || ef?.source === "system" || ef?.source === "market") return false;
    return true;
  };
  const saveMyEffectPrice = async (ef) => {
    if (!ef?.ref) return;
    if (!canSellMyEffect(ef)) {
      showNotification("\u8CFC\u5165\u3057\u305F\u30A8\u30D5\u30A7\u30AF\u30C8\u306F\u8CA9\u58F2\u3067\u304D\u307E\u305B\u3093");
      return;
    }
    const raw = (priceDrafts[ef.id] || "").trim();
    const price = parseInt(raw, 10);
    if (isNaN(price) || price <= 0) {
      showNotification("\u4FA1\u683C\u306F 1 \u4EE5\u4E0A\u306E\u6570\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      return;
    }
    setUpdatingEffectId(ef.id);
    try {
      await updateDoc(ef.ref, { price, creatorId: ef.creatorId || user.uid, ownerId: ef.ownerId || user.uid });
      if (ef.forSale) {
        const marketRef = doc(db, "artifacts", appId, "public", "data", "effect_market", `${user.uid}_${ef.id}`);
        await setDoc(marketRef, { price, updatedAt: serverTimestamp() }, { merge: true });
      }
      showNotification("\u4FA1\u683C\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F");
    } catch (e) {
      console.error(e);
      showNotification("\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    } finally {
      setUpdatingEffectId(null);
    }
  };
  const toggleMyEffectSale = async (ef, toForSale) => {
    if (!ef?.ref) return;
    if (!canSellMyEffect(ef)) {
      showNotification("\u8CFC\u5165\u3057\u305F\u30A8\u30D5\u30A7\u30AF\u30C8\u306F\u8CA9\u58F2\u3067\u304D\u307E\u305B\u3093");
      return;
    }
    if (toForSale) {
      const raw = (priceDrafts[ef.id] || "").trim();
      const price = parseInt(raw, 10);
      if (isNaN(price) || price <= 0) {
        showNotification("\u51FA\u54C1\u3059\u308B\u306B\u306F\u3001\u4FA1\u683C\u3092 1 \u4EE5\u4E0A\u3067\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        return;
      }
      setUpdatingEffectId(ef.id);
      try {
        await updateDoc(ef.ref, {
          forSale: true,
          price,
          creatorId: ef.creatorId || user.uid,
          ownerId: ef.ownerId || user.uid,
          listedAt: serverTimestamp()
        });
        const marketRef = doc(db, "artifacts", appId, "public", "data", "effect_market", `${user.uid}_${ef.id}`);
        await setDoc(
          marketRef,
          {
            effectId: ef.id,
            name: ef.name,
            image: ef.image,
            filter: ef.filter || null,
            forSale: true,
            price,
            creatorId: ef.creatorId || user.uid,
            ownerId: ef.ownerId || user.uid,
            soldCount: ef.soldCount || 0,
            listedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            marketRefPath: marketRef.path,
            sourceRefPath: ef?.ref?.path || ""
          },
          { merge: true }
        );
        showNotification("\u30B7\u30E7\u30C3\u30D7\u306B\u51FA\u54C1\u3057\u307E\u3057\u305F");
      } catch (e) {
        console.error(e);
        showNotification("\u51FA\u54C1\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      } finally {
        setUpdatingEffectId(null);
      }
    } else {
      setUpdatingEffectId(ef.id);
      try {
        await updateDoc(ef.ref, { forSale: false });
        await deleteDoc(doc(db, "artifacts", appId, "public", "data", "effect_market", `${user.uid}_${ef.id}`)).catch(() => null);
        showNotification("\u51FA\u54C1\u3092\u505C\u6B62\u3057\u307E\u3057\u305F");
      } catch (e) {
        console.error(e);
        showNotification("\u66F4\u65B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      } finally {
        setUpdatingEffectId(null);
      }
    }
  };
  const handleBuy = async (pack) => {
    if (profile?.isBanned) return showNotification("\u30A2\u30AB\u30A6\u30F3\u30C8\u304C\u5229\u7528\u505C\u6B62\u3055\u308C\u3066\u3044\u307E\u3059 \u{1F6AB}");
    if ((profile.wallet || 0) < pack.price) {
      showNotification("\u30B3\u30A4\u30F3\u304C\u8DB3\u308A\u307E\u305B\u3093");
      return;
    }
    if (pack.purchasedBy?.includes(user.uid) || pack.authorId === user.uid) {
      showNotification("\u65E2\u306B\u5165\u624B\u6E08\u307F\u3067\u3059");
      return;
    }
    setPurchasing(pack.id);
    try {
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "users", user.uid), { wallet: increment(-pack.price) });
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "users", pack.authorId), { wallet: increment(pack.price) });
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "sticker_packs", pack.id), { purchasedBy: arrayUnion(user.uid) });
      showNotification("\u8CFC\u5165\u3057\u307E\u3057\u305F\uFF01");
    } catch (e) {
      console.error(e);
      showNotification("\u8CFC\u5165\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    } finally {
      setPurchasing(null);
    }
  };
  const handleApprove = async (packId, authorId, approve) => {
    try {
      await runTransaction(db, async (transaction) => {
        const packRef = doc(db, "artifacts", appId, "public", "data", "sticker_packs", packId);
        const packDoc = await transaction.get(packRef);
        if (!packDoc.exists()) throw "Pack does not exist";
        if (packDoc.data().status !== "pending") throw "Already processed";
        transaction.update(packRef, { status: approve ? "approved" : "rejected" });
        if (approve) {
          const userRef = doc(db, "artifacts", appId, "public", "data", "users", authorId);
          transaction.update(userRef, { wallet: increment(100) });
        }
      });
      showNotification(approve ? "\u627F\u8A8D\u3057\u3001\u5831\u916C\u3092\u4ED8\u4E0E\u3057\u307E\u3057\u305F" : "\u5374\u4E0B\u3057\u307E\u3057\u305F");
    } catch (e) {
      console.error(e);
      showNotification(e === "Already processed" ? "\u65E2\u306B\u51E6\u7406\u6E08\u307F\u306E\u7533\u8ACB\u3067\u3059" : "\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
    }
  };
  const executeBanToggle = async () => {
    if (!banTarget) return;
    try {
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "users", banTarget.uid), { isBanned: !banTarget.isBanned });
      showNotification(banTarget.isBanned ? "\u5236\u9650\u3092\u89E3\u9664\u3057\u307E\u3057\u305F" : "\u30E6\u30FC\u30B6\u30FC\u3092\u5229\u7528\u505C\u6B62\u306B\u3057\u307E\u3057\u305F");
      setBanTarget(null);
    } catch (e) {
      showNotification("\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
    }
  };
  const handleGrantCoins = async () => {
    if (!banTarget || !grantAmount) return;
    const amount = parseInt(grantAmount, 10);
    if (isNaN(amount) || amount === 0) {
      showNotification("\u6709\u52B9\u306A\u91D1\u984D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      return;
    }
    try {
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "users", banTarget.uid), { wallet: increment(amount) });
      showNotification(`${banTarget.name}\u306B ${amount} \u30B3\u30A4\u30F3\u3092\u4ED8\u4E0E\u3057\u307E\u3057\u305F`);
      setGrantAmount("");
      setBanTarget(null);
    } catch (e) {
      console.error(e);
      showNotification("\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
    }
  };
  const attemptAdminLogin = () => {
    if (adminPass === "admin123") {
      setAdminMode(true);
      showNotification("\u7BA1\u7406\u8005\u30E2\u30FC\u30C9");
    } else {
      showNotification("\u30D1\u30B9\u30EF\u30FC\u30C9\u304C\u9055\u3044\u307E\u3059");
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col h-full bg-white", children: [
    /* @__PURE__ */ jsxs("div", { className: "p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(ChevronLeft, { className: "w-6 h-6 cursor-pointer", onClick: () => setView("home") }),
        /* @__PURE__ */ jsx("h1", { className: "font-bold text-lg", children: "\u30B9\u30BF\u30F3\u30D7\u30B7\u30E7\u30C3\u30D7" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full", children: [
        /* @__PURE__ */ jsx(Coins, { className: "w-4 h-4 text-yellow-600" }),
        /* @__PURE__ */ jsx("span", { className: "font-bold text-yellow-700", children: profile?.wallet || 0 })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex border-b", children: [
      /* @__PURE__ */ jsx("button", { onClick: () => setActiveTab("shop"), className: `flex-1 py-3 text-sm font-bold ${activeTab === "shop" ? "border-b-2 border-black" : "text-gray-400"}`, children: "\u30B7\u30E7\u30C3\u30D7" }),
      /* @__PURE__ */ jsx("button", { onClick: () => setView("sticker-create"), className: "flex-1 py-3 text-sm font-bold text-blue-500 bg-blue-50", children: "\u3064\u304F\u308B (+100)" }),
      /* @__PURE__ */ jsx("button", { onClick: () => setActiveTab("admin"), className: `flex-1 py-3 text-sm font-bold ${activeTab === "admin" ? "border-b-2 border-black" : "text-gray-400"}`, children: "\u7BA1\u7406\u8005" })
    ] }),
    activeTab === "shop" && /* @__PURE__ */ jsxs("div", { className: "flex gap-2 p-2 bg-gray-50", children: [
      /* @__PURE__ */ jsx("button", { onClick: () => setActiveShopTab("stickers"), className: `flex-1 py-1 text-xs font-bold rounded-lg ${activeShopTab === "stickers" ? "bg-white shadow text-black" : "text-gray-500"}`, children: "\u30B9\u30BF\u30F3\u30D7" }),
      /* @__PURE__ */ jsx("button", { onClick: () => setActiveShopTab("effects"), className: `flex-1 py-1 text-xs font-bold rounded-lg ${activeShopTab === "effects" ? "bg-white shadow text-black" : "text-gray-500"}`, children: "\u30A8\u30D5\u30A7\u30AF\u30C8" })
    ] }),
    !adminMode && activeTab === "admin" && /* @__PURE__ */ jsxs("div", { className: "p-8 flex flex-col gap-4 items-center justify-center flex-1", children: [
      /* @__PURE__ */ jsx(ShieldAlert, { className: "w-16 h-16 text-gray-300" }),
      /* @__PURE__ */ jsx("h3", { className: "font-bold text-center mb-2", children: "\u7BA1\u7406\u8005\u30ED\u30B0\u30A4\u30F3" }),
      /* @__PURE__ */ jsx("input", { type: "password", value: adminPass, onChange: (e) => setAdminPass(e.target.value), className: "border p-3 rounded-xl w-full max-w-xs text-center", placeholder: "\u30D1\u30B9\u30EF\u30FC\u30C9\u3092\u5165\u529B" }),
      /* @__PURE__ */ jsx("button", { onClick: attemptAdminLogin, className: "bg-black text-white py-3 rounded-xl font-bold w-full max-w-xs shadow-lg", children: "\u30ED\u30B0\u30A4\u30F3" })
    ] }),
    adminMode && activeTab === "admin" && /* @__PURE__ */ jsxs("div", { className: "flex bg-gray-50 p-2 gap-2", children: [
      /* @__PURE__ */ jsx("button", { onClick: () => setAdminSubTab("stickers"), className: `flex-1 py-2 rounded-lg text-xs font-bold ${adminSubTab === "stickers" ? "bg-white shadow text-black" : "text-gray-500"}`, children: "\u30B9\u30BF\u30F3\u30D7\u627F\u8A8D" }),
      /* @__PURE__ */ jsx("button", { onClick: () => setAdminSubTab("users"), className: `flex-1 py-2 rounded-lg text-xs font-bold ${adminSubTab === "users" ? "bg-white shadow text-black" : "text-gray-500"}`, children: "\u30E6\u30FC\u30B6\u30FC\u7BA1\u7406" })
    ] }),
    activeTab === "shop" && activeShopTab === "effects" && /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto", children: [
      /* @__PURE__ */ jsx("div", { className: "p-4 pb-2", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-2 p-2 bg-gray-50 rounded-2xl border", children: [
        /* @__PURE__ */ jsx("button", { onClick: () => setEffectsMode("market"), className: `flex-1 py-2 rounded-xl text-xs font-bold ${effectsMode === "market" ? "bg-white shadow text-black" : "text-gray-500"}`, children: "\u8CFC\u5165" }),
        /* @__PURE__ */ jsx("button", { onClick: () => setEffectsMode("manage"), className: `flex-1 py-2 rounded-xl text-xs font-bold ${effectsMode === "manage" ? "bg-white shadow text-black" : "text-gray-500"}`, children: "\u51FA\u54C1\u7BA1\u7406" })
      ] }) }),
      effectsMode === "market" && /* @__PURE__ */ jsxs("div", { className: "p-4 pt-2 space-y-6", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-2", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-black text-gray-800", children: "\u516C\u5F0F\u30A8\u30D5\u30A7\u30AF\u30C8" }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold text-gray-400", children: "\u8CFC\u5165\u3059\u308B\u3068\u901A\u8A71\u3067\u4F7F\u3048\u307E\u3059" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "space-y-4", children: effectsForSale.map((effect) => /* @__PURE__ */ jsxs("div", { className: "border rounded-2xl p-4 shadow-sm bg-white flex items-center gap-4", children: [
            /* @__PURE__ */ jsx("div", { className: "w-16 h-16 rounded-xl overflow-hidden bg-gray-100", children: /* @__PURE__ */ jsx("img", { src: effect.image, className: "w-full h-full object-cover" }) }),
            /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
              /* @__PURE__ */ jsx("h4", { className: "font-bold", children: effect.name }),
              /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-500", children: effect.description })
            ] }),
            /* @__PURE__ */ jsx("button", { onClick: () => handleBuyEffect(effect), disabled: purchasing === effect.id, className: "bg-purple-500 text-white px-4 py-2 rounded-full font-bold text-xs shadow-md hover:bg-purple-600 disabled:bg-gray-300 min-w-[60px]", children: purchasing === effect.id ? /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 animate-spin" }) : `\xA5${effect.price}` })
          ] }, effect.id)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-2", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-black text-gray-800", children: "\u30E6\u30FC\u30B6\u30FC\u51FA\u54C1" }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold text-gray-400", children: "\u3042\u306A\u305F\u304C\u4F5C\u3063\u305F\u30A8\u30D5\u30A7\u30AF\u30C8\u3082\u51FA\u54C1\u3067\u304D\u307E\u3059" })
          ] }),
          visibleMarketEffects.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-center py-10 text-gray-400 text-sm border rounded-2xl bg-white", children: "\u51FA\u54C1\u4E2D\u306E\u30A8\u30D5\u30A7\u30AF\u30C8\u304C\u3042\u308A\u307E\u305B\u3093" }) : /* @__PURE__ */ jsx("div", { className: "space-y-4", children: visibleMarketEffects.map((effect) => {
            const seller = allUsers.find((u) => u.uid === effect.creatorId);
            const isMine = effect.creatorId === user.uid;
            return /* @__PURE__ */ jsxs("div", { className: "border rounded-2xl p-4 shadow-sm bg-white flex items-center gap-4", children: [
              /* @__PURE__ */ jsx("div", { className: "w-16 h-16 rounded-xl overflow-hidden bg-gray-100", children: /* @__PURE__ */ jsx("img", { src: effect.image, className: "w-full h-full object-cover" }) }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx("h4", { className: "font-bold truncate", children: effect.name }),
                  isMine && /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full", children: "\u81EA\u5206\u306E\u51FA\u54C1" })
                ] }),
                /* @__PURE__ */ jsxs("p", { className: "text-xs text-gray-500 truncate", children: [
                  "\u51FA\u54C1\u8005: ",
                  seller?.name || effect.creatorId
                ] }),
                /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-gray-400", children: [
                  "\u8CA9\u58F2\u6570: ",
                  effect.soldCount || 0
                ] })
              ] }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => handleBuyMarketEffect(effect),
                  disabled: isMine || purchasing === (effect._key || effect.id),
                  className: "bg-green-500 text-white px-4 py-2 rounded-full font-bold text-xs shadow-md hover:bg-green-600 disabled:bg-gray-300 min-w-[60px]",
                  children: purchasing === (effect._key || effect.id) ? /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 animate-spin" }) : `\xA5${effect.price || 0}`
                }
              )
            ] }, effect._key || effect.id);
          }) })
        ] })
      ] }),
      effectsMode === "manage" && /* @__PURE__ */ jsxs("div", { className: "p-4 space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 border rounded-2xl p-4", children: [
          /* @__PURE__ */ jsx("div", { className: "font-black text-gray-800 text-sm mb-1", children: "\u81EA\u5206\u306E\u30A8\u30D5\u30A7\u30AF\u30C8\u3092\u51FA\u54C1" }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-600", children: "\u81EA\u5206\u3067\u4F5C\u3063\u305F\u30A8\u30D5\u30A7\u30AF\u30C8\u306F\u3001\u4FA1\u683C\u3092\u8A2D\u5B9A\u3057\u3066\u30B7\u30E7\u30C3\u30D7\u3067\u8CA9\u58F2\u3067\u304D\u307E\u3059\u3002" }),
          /* @__PURE__ */ jsx("p", { className: "text-[10px] text-gray-400 mt-2", children: "\u203B\u8CFC\u5165\u3057\u305F\u30A8\u30D5\u30A7\u30AF\u30C8\u306F\u518D\u8CA9\u58F2\u3067\u304D\u307E\u305B\u3093" })
        ] }),
        myEffects.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-center py-10 text-gray-400 text-sm border rounded-2xl bg-white", children: "\u30A8\u30D5\u30A7\u30AF\u30C8\u304C\u3042\u308A\u307E\u305B\u3093" }) : /* @__PURE__ */ jsx("div", { className: "space-y-3", children: myEffects.map((ef) => {
          const isSelling = !!ef.forSale;
          const canSell = canSellMyEffect(ef);
          return /* @__PURE__ */ jsxs("div", { className: "border rounded-2xl p-4 bg-white shadow-sm", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
              /* @__PURE__ */ jsx("div", { className: "w-16 h-16 rounded-xl overflow-hidden bg-gray-100", children: /* @__PURE__ */ jsx("img", { src: ef.image, className: "w-full h-full object-cover" }) }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx("div", { className: "font-bold truncate", children: ef.name }),
                  isSelling && /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full", children: "\u51FA\u54C1\u4E2D" }),
                  !canSell && /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full", children: "\u8CFC\u5165\u54C1" })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "text-[10px] text-gray-400", children: [
                  "\u8CA9\u58F2\u6570: ",
                  ef.soldCount || 0
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center gap-2", children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "number",
                  min: 1,
                  step: 1,
                  value: priceDrafts[ef.id] || "",
                  disabled: !canSell || updatingEffectId === ef.id,
                  onChange: (e) => setPriceDrafts((prev) => ({ ...prev, [ef.id]: e.target.value })),
                  className: "flex-1 border p-3 rounded-xl text-center font-bold outline-none focus:border-purple-500 disabled:bg-gray-50",
                  placeholder: "\u4FA1\u683C"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => saveMyEffectPrice(ef),
                  disabled: !canSell || updatingEffectId === ef.id,
                  className: "px-4 py-3 rounded-xl font-bold text-xs bg-gray-900 text-white disabled:bg-gray-300",
                  children: updatingEffectId === ef.id ? /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 animate-spin" }) : "\u4FDD\u5B58"
                }
              )
            ] }),
            /* @__PURE__ */ jsx("div", { className: "mt-2", children: /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => toggleMyEffectSale(ef, !isSelling),
                disabled: !canSell || updatingEffectId === ef.id,
                className: `w-full py-3 rounded-xl font-bold text-xs shadow-sm disabled:bg-gray-300 ${isSelling ? "bg-red-500 text-white hover:bg-red-600" : "bg-green-500 text-white hover:bg-green-600"}`,
                children: isSelling ? "\u51FA\u54C1\u3092\u505C\u6B62\u3059\u308B" : "\u30B7\u30E7\u30C3\u30D7\u3067\u8CA9\u58F2\u3059\u308B"
              }
            ) })
          ] }, ef.id);
        }) })
      ] })
    ] }),
    activeTab === "shop" && activeShopTab === "stickers" && /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-4 space-y-4", children: [
      packs.length === 0 && /* @__PURE__ */ jsx("div", { className: "text-center py-10 text-gray-400", children: "\u30B9\u30BF\u30F3\u30D7\u304C\u3042\u308A\u307E\u305B\u3093" }),
      packs.map((pack) => {
        const isOwned = pack.purchasedBy?.includes(user.uid) || pack.authorId === user.uid;
        return /* @__PURE__ */ jsxs("div", { className: "border rounded-2xl p-4 shadow-sm bg-white", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-start mb-2", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
              /* @__PURE__ */ jsx("h3", { className: "font-bold text-lg", children: pack.name }),
              /* @__PURE__ */ jsxs("p", { className: "text-xs text-gray-500 font-bold mb-1", children: [
                "\u4F5C: ",
                pack.authorName || "\u4E0D\u660E"
              ] }),
              pack.description && /* @__PURE__ */ jsx("p", { className: "text-xs text-gray-400 bg-gray-50 p-2 rounded-lg mb-2", children: pack.description })
            ] }),
            !isOwned && activeTab === "shop" && /* @__PURE__ */ jsx("button", { onClick: () => handleBuy(pack), disabled: purchasing === pack.id, className: "bg-green-500 text-white px-4 py-2 rounded-full font-bold text-xs shadow-md hover:bg-green-600 disabled:bg-gray-300 shrink-0 ml-2", children: purchasing === pack.id ? /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 animate-spin" }) : `\xA5${pack.price}` }),
            isOwned && activeTab === "shop" && /* @__PURE__ */ jsx("span", { className: "bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold shrink-0 ml-2", children: "\u5165\u624B\u6E08\u307F" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "flex gap-2 overflow-x-auto pb-2 scrollbar-hide", children: pack.stickers.map((s, i) => /* @__PURE__ */ jsxs("div", { className: "relative flex-shrink-0", children: [
            /* @__PURE__ */ jsx(
              "img",
              {
                src: typeof s === "string" ? s : s.image,
                className: "w-20 h-20 object-contain bg-gray-50 rounded-lg border"
              }
            ),
            typeof s !== "string" && s.audio && /* @__PURE__ */ jsx("div", { className: "absolute top-1 right-1 bg-green-500 w-2 h-2 rounded-full border border-white" })
          ] }, i)) })
        ] }, pack.id);
      })
    ] }),
    adminMode && activeTab === "admin" && adminSubTab === "stickers" && /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto p-4 space-y-4", children: [
      packs.length === 0 && /* @__PURE__ */ jsx("div", { className: "text-center py-10 text-gray-400", children: "\u7533\u8ACB\u4E2D\u306E\u30B9\u30BF\u30F3\u30D7\u306F\u3042\u308A\u307E\u305B\u3093" }),
      packs.map((pack) => /* @__PURE__ */ jsxs("div", { className: "border rounded-2xl p-4 shadow-sm bg-white", children: [
        /* @__PURE__ */ jsx("div", { className: "flex justify-between items-start mb-2", children: /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
          /* @__PURE__ */ jsx("h3", { className: "font-bold text-lg", children: pack.name }),
          /* @__PURE__ */ jsxs("p", { className: "text-xs text-gray-500 font-bold mb-1", children: [
            "\u4F5C: ",
            pack.authorName || "\u4E0D\u660E"
          ] })
        ] }) }),
        /* @__PURE__ */ jsx("div", { className: "grid grid-cols-4 gap-2 mt-2", children: pack.stickers.map((s, i) => /* @__PURE__ */ jsx("img", { src: typeof s === "string" ? s : s.image, className: "w-full aspect-square object-contain bg-gray-50 rounded-lg border" }, i)) }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2 mt-4 pt-2 border-t", children: [
          /* @__PURE__ */ jsx("button", { onClick: () => handleApprove(pack.id, pack.authorId, true), className: "flex-1 py-2 bg-blue-500 text-white rounded-lg font-bold text-xs", children: "\u627F\u8A8D (+100\u30B3\u30A4\u30F3)" }),
          /* @__PURE__ */ jsx("button", { onClick: () => handleApprove(pack.id, pack.authorId, false), className: "flex-1 py-2 bg-red-500 text-white rounded-lg font-bold text-xs", children: "\u62D2\u5426" })
        ] })
      ] }, pack.id))
    ] }),
    adminMode && activeTab === "admin" && adminSubTab === "users" && /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto p-4 space-y-2", children: allUsers.map((u) => /* @__PURE__ */ jsxs("div", { className: `flex items-center gap-3 p-3 rounded-xl border ${u.isBanned ? "bg-red-50 border-red-200" : "bg-white"}`, children: [
      /* @__PURE__ */ jsx("img", { src: u.avatar, className: "w-10 h-10 rounded-full border" }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
        /* @__PURE__ */ jsx("div", { className: "font-bold text-sm truncate", children: u.name }),
        /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-400 font-mono", children: u.id })
      ] }),
      /* @__PURE__ */ jsx("button", { onClick: () => setBanTarget(u), className: `px-3 py-1.5 rounded-lg text-xs font-bold text-white ${u.isBanned ? "bg-gray-500" : "bg-red-500"}`, children: "\u7BA1\u7406" })
    ] }, u.uid)) }),
    banTarget && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm", children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[80vh]", children: [
      /* @__PURE__ */ jsxs("h3", { className: "font-bold text-lg mb-1 text-center text-gray-900", children: [
        "\u30E6\u30FC\u30B6\u30FC\u7BA1\u7406: ",
        banTarget.name
      ] }),
      /* @__PURE__ */ jsx("p", { className: "text-center text-gray-400 text-xs mb-6 font-mono", children: banTarget.id }),
      /* @__PURE__ */ jsxs("div", { className: "mb-6 pb-6 border-b", children: [
        /* @__PURE__ */ jsx("h4", { className: "font-bold text-sm text-gray-700 mb-2", children: "\u5229\u7528\u5236\u9650" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-gray-600 mb-3", children: banTarget.isBanned ? "\u73FE\u5728\u306F\u505C\u6B62\u4E2D\u3067\u3059\u3002\u89E3\u9664\u3057\u307E\u3059\u304B\uFF1F" : "\u73FE\u5728\u5229\u7528\u53EF\u80FD\u3067\u3059\u3002\u505C\u6B62\u3057\u307E\u3059\u304B\uFF1F" }),
        /* @__PURE__ */ jsx("button", { onClick: executeBanToggle, className: `w-full py-3 font-bold rounded-2xl text-white transition-colors ${banTarget.isBanned ? "bg-blue-500 hover:bg-blue-600" : "bg-red-500 hover:bg-red-600"}`, children: banTarget.isBanned ? "\u5236\u9650\u3092\u89E3\u9664\u3059\u308B" : "\u30A2\u30AB\u30A6\u30F3\u30C8\u3092\u505C\u6B62\u3059\u308B" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mb-6", children: [
        /* @__PURE__ */ jsx("h4", { className: "font-bold text-sm text-gray-700 mb-2", children: "\u30B3\u30A4\u30F3\u64CD\u4F5C" }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between bg-yellow-50 p-3 rounded-xl mb-3", children: [
          /* @__PURE__ */ jsx("span", { className: "text-xs font-bold text-yellow-800", children: "\u73FE\u5728\u306E\u6240\u6301\u30B3\u30A4\u30F3" }),
          /* @__PURE__ */ jsx("span", { className: "text-lg font-bold text-yellow-600", children: banTarget.wallet || 0 })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx("input", { type: "number", placeholder: "\u91D1\u984D (-\u3067\u6CA1\u53CE)", className: "flex-1 border p-3 rounded-xl text-center font-bold outline-none focus:border-yellow-500", value: grantAmount, onChange: (e) => setGrantAmount(e.target.value) }),
          /* @__PURE__ */ jsx("button", { onClick: handleGrantCoins, className: "bg-yellow-500 text-white font-bold px-6 rounded-xl hover:bg-yellow-600 shadow-md", children: "\u4ED8\u4E0E" })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "text-[10px] text-gray-400 mt-2 text-center", children: "\u203B\u30DE\u30A4\u30CA\u30B9\u306E\u5024\u3092\u5165\u529B\u3059\u308B\u3068\u6E1B\u7B97\u3055\u308C\u307E\u3059" })
      ] }),
      /* @__PURE__ */ jsx("button", { onClick: () => {
        setBanTarget(null);
        setGrantAmount("");
      }, className: "w-full py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-2xl text-gray-600 transition-colors", children: "\u9589\u3058\u308B" })
    ] }) })
  ] });
};
const ChatRoomView = ({ user, profile, allUsers, chats, activeChatId, setActiveChatId, setView, db: db2, appId: appId2, mutedChats, toggleMuteChat, showNotification, addFriendById, startVideoCall }) => {
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
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
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
  const scrollRef = useRef(null);
  const isFirstLoad = useRef(true);
  const [messageLimit, setMessageLimit] = useState(50);
  const lastMessageIdRef = useRef(null);
  const [backgroundSrc, setBackgroundSrc] = useState(null);
  const [stickerMenuOpen, setStickerMenuOpen] = useState(false);
  const [myStickerPacks, setMyStickerPacks] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState(null);
  const [buyStickerModalPackId, setBuyStickerModalPackId] = useState(null);
  const [viewProfile, setViewProfile] = useState(null);
  const [coinModalTarget, setCoinModalTarget] = useState(null);
  const [aiEffectModalOpen, setAiEffectModalOpen] = useState(false);
  const [headerAvatarError, setHeaderAvatarError] = useState(false);
  const isMountedRef = useRef(true);
  const readSyncedIdsRef = useRef(/* @__PURE__ */ new Set());
  const usersByUid = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    (allUsers || []).forEach((u) => {
      if (u?.uid) map.set(u.uid, u);
    });
    return map;
  }, [allUsers]);
  const usersByName = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    (allUsers || []).forEach((u) => {
      if (u?.name) map.set(u.name, u);
    });
    return map;
  }, [allUsers]);
  const chatData = chats.find((c) => c.id === activeChatId);
  const contactCandidates = useMemo(() => {
    const hiddenSet = new Set(profile?.hiddenFriends || []);
    const friendKeySet = new Set(profile?.friends || []);
    (chats || []).forEach((chat) => {
      if (chat?.isGroup || !Array.isArray(chat?.participants) || !chat.participants.includes(user.uid)) return;
      const otherUid = chat.participants.find((p) => p && p !== user.uid);
      if (otherUid) friendKeySet.add(otherUid);
    });
    const byUid = allUsers.filter((u) => friendKeySet.has(u.uid));
    const byId = allUsers.filter((u) => friendKeySet.has(u.id));
    const merged = [...byUid, ...byId].filter((u) => u.uid && u.uid !== user.uid && !hiddenSet.has(u.uid));
    return Array.from(new Map(merged.map((u) => [u.uid, u])).values());
  }, [allUsers, chats, profile?.friends, profile?.hiddenFriends, user.uid]);
  const isGroup = chatData?.isGroup || false;
  const activeChatCallStatus = chatData?.callStatus || null;
  const hasJoinableCall = !!activeChatCallStatus?.sessionId && (activeChatCallStatus.status === "ringing" || activeChatCallStatus.status === "accepted");
  let partnerId = null;
  let partnerData = null;
  if (chatData && !isGroup) {
    partnerId = chatData.participants.find((p) => p !== user.uid);
    if (!partnerId) partnerId = user.uid;
    partnerData = usersByUid.get(partnerId);
  }
  const title = !isGroup && partnerData ? partnerData.name : chatData?.name || "";
  const icon = !isGroup && partnerData ? partnerData.avatar : chatData?.icon || "";
  const onStickerClick = (packId) => {
    setBuyStickerModalPackId(packId);
  };
  const sendBirthdayCard = async ({ color, message }) => {
    if (!partnerId) {
      showNotification("\u9001\u4FE1\u5148\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
      return;
    }
    try {
      await addDoc(collection(db2, "artifacts", appId2, "public", "data", "birthday_cards"), {
        fromId: user.uid,
        fromName: profile.name,
        toUserId: partnerId,
        message,
        color,
        createdAt: serverTimestamp()
      });
      showNotification("\u30D0\u30FC\u30B9\u30C7\u30FC\u30AB\u30FC\u30C9\u3092\u9001\u4FE1\u3057\u307E\u3057\u305F\uFF01\u{1F382}");
      setCardModalOpen(false);
    } catch (e) {
      console.error(e);
      showNotification("\u9001\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    }
  };
  const handleJoinCall = (isVideo, callerId, sessionId = "") => {
    startVideoCall(activeChatId, isVideo, true, callerId, sessionId);
  };
  const joinCurrentCall = () => {
    if (!activeChatCallStatus?.sessionId) {
      showNotification("\u53C2\u52A0\u3067\u304D\u308B\u901A\u8A71\u304C\u3042\u308A\u307E\u305B\u3093");
      return;
    }
    const isVideoCall = activeChatCallStatus.callType !== "audio";
    startVideoCall(activeChatId, isVideoCall, true, activeChatCallStatus.callerId, activeChatCallStatus.sessionId);
  };
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    const q = query(collection(db2, "artifacts", appId2, "public", "data", "sticker_packs"), where("purchasedBy", "array-contains", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const packs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const q2 = query(collection(db2, "artifacts", appId2, "public", "data", "sticker_packs"), where("authorId", "==", user.uid));
      getDocs(q2).then((snap2) => {
        const ownPacks = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
        const all = [...packs, ...ownPacks];
        const unique = Array.from(new Map(all.map((item) => [item.id, item])).values());
        setMyStickerPacks(unique);
        if (unique.length > 0 && !selectedPackId) setSelectedPackId(unique[0].id);
      });
    });
    return () => unsub();
  }, [user.uid]);
  useEffect(() => {
    isFirstLoad.current = true;
    readSyncedIdsRef.current.clear();
  }, [activeChatId]);
  useEffect(() => {
    if (!activeChatId) return;
    const q = query(collection(db2, "artifacts", appId2, "public", "data", "chats", activeChatId, "messages"), orderBy("createdAt", "asc"), limitToLast(messageLimit));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [activeChatId, messageLimit]);
  useEffect(() => {
    if (!activeChatId) return;
    (async () => {
      try {
        await updateDoc(doc(db2, "artifacts", appId2, "public", "data", "chats", activeChatId), {
          [`unreadCounts.${user.uid}`]: 0,
          "lastMessage.readBy": arrayUnion(user.uid)
        });
      } catch (e) {
        console.error("Failed to reset unread count", e);
      }
    })();
  }, [activeChatId, user.uid, db2, appId2]);
  useEffect(() => {
    if (!activeChatId || messages.length === 0) return;
    const targets = messages.filter((m) => m.senderId !== user.uid && !m.readBy?.includes(user.uid) && !readSyncedIdsRef.current.has(m.id));
    if (targets.length === 0) return;
    const toSync = targets.slice(0, 120);
    toSync.forEach((m) => readSyncedIdsRef.current.add(m.id));
    (async () => {
      try {
        const batch = writeBatch(db2);
        toSync.forEach((m) => {
          const msgRef = doc(db2, "artifacts", appId2, "public", "data", "chats", activeChatId, "messages", m.id);
          batch.update(msgRef, { readBy: arrayUnion(user.uid) });
        });
        await batch.commit();
      } catch (e) {
        toSync.forEach((m) => readSyncedIdsRef.current.delete(m.id));
        console.error("Failed to sync read flags", e);
      }
    })();
  }, [messages, activeChatId, user.uid, db2, appId2]);
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
          const chunksSnap = await getDocs(query(collection(db2, "artifacts", appId2, "public", "data", "chats", activeChatId, "background_chunks"), orderBy("index", "asc")));
          let data = "";
          chunksSnap.forEach((d) => data += d.data().data);
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
  }, [chatData?.id, chatData?.updatedAt, chatData?.hasBackgroundChunks, chatData?.backgroundImage, activeChatId]);
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
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], "voice.webm", { type: "audio/webm", lastModified: Date.now() });
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
      }, 1e3);
    } catch (err) {
      console.error(err);
      showNotification("\u30DE\u30A4\u30AF\u306E\u5229\u7528\u3092\u8A31\u53EF\u3057\u3066\u304F\u3060\u3055\u3044");
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
      showNotification("\u9332\u97F3\u3092\u30AD\u30E3\u30F3\u30BB\u30EB\u3057\u307E\u3057\u305F");
    }
  };
  const sendMessage = async (content, type = "text", additionalData = {}, file = null) => {
    if (profile?.isBanned) return showNotification("\u30A2\u30AB\u30A6\u30F3\u30C8\u304C\u5229\u7528\u505C\u6B62\u3055\u308C\u3066\u3044\u307E\u3059 \u{1F6AB}");
    if (!content && !file && type === "text" || isUploading) return;
    const setUploadingSafe = (next) => {
      if (isMountedRef.current) setIsUploading(next);
    };
    const setUploadProgressSafe = (next) => {
      if (isMountedRef.current) setUploadProgress(next);
    };
    setUploadingSafe(true);
    setUploadProgressSafe(0);
    const currentReply = replyTo;
    setReplyTo(null);
    setStickerMenuOpen(false);
    try {
      const msgCol = collection(db2, "artifacts", appId2, "public", "data", "chats", activeChatId, "messages");
      const newMsgRef = doc(msgCol);
      let localBlobUrl = null;
      let storedContent = content;
      let previewData = null;
      const replyData = currentReply ? { replyTo: { id: currentReply.id, content: currentReply.content, senderName: usersByUid.get(currentReply.senderId)?.name || "Unknown", type: currentReply.type } } : {};
      const fileData = file ? { fileName: file.name, fileSize: file.size, mimeType: file.type } : {};
      const currentChat = chats.find((c) => c.id === activeChatId);
      const updateData = {
        lastMessage: { content: type === "text" ? content : `[${type}]`, senderId: user.uid, readBy: [user.uid] },
        updatedAt: serverTimestamp()
      };
      if (currentChat) {
        currentChat.participants.forEach((uid) => {
          if (uid !== user.uid) {
            updateData[`unreadCounts.${uid}`] = increment(1);
          }
        });
      }
      if (file && ["image", "video", "audio", "file"].includes(type)) {
        localBlobUrl = URL.createObjectURL(file);
        storedContent = localBlobUrl;
        if (["image", "video"].includes(type)) {
          previewData = await generateThumbnail(file);
        }
        await setDoc(newMsgRef, { senderId: user.uid, content: storedContent, type, preview: previewData, ...additionalData, ...replyData, ...fileData, hasChunks: false, chunkCount: 0, isUploading: true, createdAt: serverTimestamp(), readBy: [user.uid] });
        await updateDoc(doc(db2, "artifacts", appId2, "public", "data", "chats", activeChatId), updateData);
        if (isMountedRef.current) {
          setText("");
          setPlusMenuOpen(false);
          setContactModalOpen(false);
          setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: "auto" });
          }, 100);
        }
      }
      let hasChunks = false, chunkCount = 0;
      if (file && file.size > CHUNK_SIZE) {
        hasChunks = true;
        chunkCount = Math.ceil(file.size / CHUNK_SIZE);
        const CONCURRENCY = getUploadConcurrency();
        const executing = /* @__PURE__ */ new Set();
        let completed = 0;
        let lastProgressAt = 0;
        for (let i = 0; i < chunkCount; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const blobSlice = file.slice(start, end);
          const p = new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
              try {
                const base64Data = e.target.result.split(",")[1];
                await setDoc(doc(msgCol, newMsgRef.id, "chunks", `${i}`), { data: base64Data, index: i });
                completed++;
                const now = Date.now();
                if (completed === chunkCount || now - lastProgressAt >= 120) {
                  lastProgressAt = now;
                  setUploadProgressSafe(Math.round(completed / chunkCount * 100));
                }
                resolve(null);
              } catch (err) {
                reject(err);
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blobSlice);
          });
          executing.add(p);
          p.finally(() => executing.delete(p));
          if (executing.size >= CONCURRENCY) {
            await Promise.race(executing);
          }
        }
        await Promise.all(executing);
        await updateDoc(newMsgRef, {
          hasChunks: true,
          chunkCount,
          // blob URL is session-local. Keep message reloadable from chunk docs.
          content: previewData || "",
          isUploading: false
        });
      } else if (!hasChunks) {
        if (localBlobUrl && file) {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          await new Promise((resolve) => {
            reader.onload = async (e) => {
              await updateDoc(newMsgRef, { content: e.target.result, isUploading: false });
              resolve(null);
            };
          });
        } else {
          if (typeof content === "object" && content !== null && type === "sticker") {
            const stickerContent = content.image || content;
            const stickerAudio = content.audio || null;
            await setDoc(newMsgRef, { senderId: user.uid, content: stickerContent, audio: stickerAudio, type, ...additionalData, ...replyData, ...fileData, hasChunks, chunkCount, createdAt: serverTimestamp(), readBy: [user.uid] });
          } else {
            await setDoc(newMsgRef, { senderId: user.uid, content: storedContent, type, ...additionalData, ...replyData, ...fileData, hasChunks, chunkCount, createdAt: serverTimestamp(), readBy: [user.uid] });
          }
          await updateDoc(doc(db2, "artifacts", appId2, "public", "data", "chats", activeChatId), updateData);
          if (isMountedRef.current) {
            setText("");
            setPlusMenuOpen(false);
            setContactModalOpen(false);
            setTimeout(() => {
              scrollRef.current?.scrollIntoView({ behavior: "auto" });
            }, 100);
          }
        }
      }
    } catch (e) {
      console.error(e);
      showNotification("\u9001\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    } finally {
      setUploadingSafe(false);
      setUploadProgressSafe(0);
    }
  };
  const handleDeleteMessage = useCallback(async (msgId) => {
    try {
      await deleteDoc(doc(db2, "artifacts", appId2, "public", "data", "chats", activeChatId, "messages", msgId));
      const c = await getDocs(collection(db2, "artifacts", appId2, "public", "data", "chats", activeChatId, "messages", msgId, "chunks"));
      for (const d of c.docs) await deleteDoc(d.ref);
      showNotification("\u30E1\u30C3\u30BB\u30FC\u30B8\u306E\u9001\u4FE1\u3092\u53D6\u308A\u6D88\u3057\u307E\u3057\u305F");
    } catch (e) {
      showNotification("\u9001\u4FE1\u53D6\u6D88\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    }
  }, [db2, appId2, activeChatId, showNotification]);
  const handleEditMessage = useCallback((id, content) => {
    setEditingMsgId(id);
    setEditingText(content);
  }, []);
  const handlePreviewMedia = useCallback((src, type) => {
    setPreviewMedia({ src, type });
  }, []);
  const handleReaction = async (messageId, emoji) => {
    try {
      const msgRef = doc(db2, "artifacts", appId2, "public", "data", "chats", activeChatId, "messages", messageId);
      const msg = messages.find((m) => m.id === messageId);
      const currentReactions = msg.reactions?.[emoji] || [];
      if (currentReactions.includes(user.uid)) {
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(user.uid) });
      } else {
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(user.uid) });
      }
    } catch (e) {
      console.error("Reaction error", e);
    }
  };
  const submitEditMessage = async () => {
    if (!editingText.trim() || !editingMsgId) return;
    try {
      await updateDoc(doc(db2, "artifacts", appId2, "public", "data", "chats", activeChatId, "messages", editingMsgId), { content: editingText, isEdited: true, updatedAt: serverTimestamp() });
      setEditingMsgId(null);
    } catch (e) {
      showNotification("\u7DE8\u96C6\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    }
  };
  const handleLeaveGroup = async () => {
    if (!activeChatId) return;
    try {
      await addDoc(collection(db2, "artifacts", appId2, "public", "data", "chats", activeChatId, "messages"), { senderId: user.uid, content: `${profile.name}\u304C\u9000\u4F1A\u3057\u307E\u3057\u305F\u3002`, type: "text", createdAt: serverTimestamp(), readBy: [user.uid] });
      await updateDoc(doc(db2, "artifacts", appId2, "public", "data", "chats", activeChatId), { participants: arrayRemove(user.uid) });
      showNotification("\u30B0\u30EB\u30FC\u30D7\u304B\u3089\u9000\u4F1A\u3057\u307E\u3057\u305F");
      setLeaveModalOpen(false);
      setView("home");
      setActiveChatId(null);
    } catch (e) {
      showNotification("\u9000\u4F1A\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    }
  };
  const handleBackgroundUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target.result;
      try {
        const batch = writeBatch(db2);
        const chatRef = doc(db2, "artifacts", appId2, "public", "data", "chats", activeChatId);
        const oldChunksSnap = await getDocs(collection(db2, "artifacts", appId2, "public", "data", "chats", activeChatId, "background_chunks"));
        oldChunksSnap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        const newBatch = writeBatch(db2);
        let hasChunks = false;
        let chunkCount = 0;
        if (result.length > CHUNK_SIZE) {
          hasChunks = true;
          chunkCount = Math.ceil(result.length / CHUNK_SIZE);
          for (let i = 0; i < chunkCount; i++) {
            const chunkRef = doc(db2, "artifacts", appId2, "public", "data", "chats", activeChatId, "background_chunks", `${i}`);
            newBatch.set(chunkRef, { data: result.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), index: i });
          }
          newBatch.update(chatRef, { backgroundImage: deleteField(), hasBackgroundChunks: true, backgroundChunkCount: chunkCount, updatedAt: serverTimestamp() });
        } else {
          newBatch.update(chatRef, { backgroundImage: result, hasBackgroundChunks: false, backgroundChunkCount: 0, updatedAt: serverTimestamp() });
        }
        await newBatch.commit();
        showNotification("\u80CC\u666F\u3092\u5909\u66F4\u3057\u307E\u3057\u305F");
        setBackgroundMenuOpen(false);
      } catch (e2) {
        console.error(e2);
        showNotification("\u80CC\u666F\u306E\u5909\u66F4\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      }
    };
    reader.readAsDataURL(file);
  };
  const resetBackground = async () => {
    try {
      const batch = writeBatch(db2);
      const chatRef = doc(db2, "artifacts", appId2, "public", "data", "chats", activeChatId);
      const chunksSnap = await getDocs(collection(db2, "artifacts", appId2, "public", "data", "chats", activeChatId, "background_chunks"));
      chunksSnap.forEach((d) => batch.delete(d.ref));
      batch.update(chatRef, { backgroundImage: deleteField(), hasBackgroundChunks: deleteField(), backgroundChunkCount: deleteField(), updatedAt: serverTimestamp() });
      await batch.commit();
      showNotification("\u80CC\u666F\u3092\u30EA\u30BB\u30C3\u30C8\u3057\u307E\u3057\u305F");
      setBackgroundMenuOpen(false);
    } catch (e) {
      showNotification("\u30EA\u30BB\u30C3\u30C8\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    }
  };
  const runSlashCommand = async (rawInput) => {
    const input = (rawInput || "").trim();
    if (!input.startsWith("/")) return false;
    const [commandRaw, ...rest] = input.slice(1).split(" ");
    const cmd = (commandRaw || "").toLowerCase();
    const args = rest.join(" ").trim();
    if (!cmd) return false;
    if (cmd === "help") {
      await sendMessage(`\u4F7F\u3048\u308B\u30B3\u30DE\u30F3\u30C9\n${SLASH_COMMAND_HELP_LINES.join("\n")}`);
      return true;
    }
    if (cmd === "time") {
      await sendMessage(new Date().toLocaleTimeString());
      return true;
    }
    if (cmd === "date") {
      await sendMessage(new Date().toLocaleDateString());
      return true;
    }
    if (cmd === "datetime") {
      await sendMessage(new Date().toLocaleString());
      return true;
    }
    if (cmd === "shrug") {
      await sendMessage("\xAF\\_(\u30C4)_/\xAF");
      return true;
    }
    if (cmd === "tableflip") {
      await sendMessage("(\u256F\xB0\u25A1\xB0)\u256F\uFE35 \u253B\u2501\u253B");
      return true;
    }
    if (cmd === "unflip") {
      await sendMessage("\u252C\u2500\u252C \u30CE(\u309C-\u309C\u30CE)");
      return true;
    }
    if (cmd === "lenny") {
      await sendMessage("(\u0361\xB0 \u0361\u035C\u0296 \u0361\xB0)");
      return true;
    }
    if (cmd === "me") {
      await sendMessage(`*${profile?.name || "Me"} ${args || "..."}*`);
      return true;
    }
    if (cmd === "echo") {
      if (!args) {
        showNotification("/echo \u306E\u5F8C\u306B\u6587\u5B57\u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044");
        return true;
      }
      await sendMessage(args);
      return true;
    }
    if (cmd === "upper") {
      await sendMessage(args.toUpperCase());
      return true;
    }
    if (cmd === "lower") {
      await sendMessage(args.toLowerCase());
      return true;
    }
    if (cmd === "title") {
      await sendMessage(toTitleCase(args));
      return true;
    }
    if (cmd === "reverse") {
      await sendMessage(args.split("").reverse().join(""));
      return true;
    }
    if (cmd === "shuffle") {
      await sendMessage(shuffleText(args));
      return true;
    }
    if (cmd === "repeat") {
      const count = Math.max(1, Math.min(20, parseInt(rest[0] || "2", 10) || 2));
      const body = rest.slice(1).join(" ").trim();
      if (!body) {
        showNotification("/repeat n text \u306E\u5F62\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        return true;
      }
      await sendMessage(Array.from({ length: count }, () => body).join(" "));
      return true;
    }
    if (cmd === "len") {
      const target = args || "";
      showNotification(`\u6587\u5B57\u6570: ${target.length}`);
      return true;
    }
    if (cmd === "trim") {
      await sendMessage(args.trim());
      return true;
    }
    if (cmd === "calc") {
      const n = calcExpression(args);
      if (n === null) {
        showNotification("\u8A08\u7B97\u5F0F\u304C\u4E0D\u6B63\u3067\u3059");
        return true;
      }
      await sendMessage(`= ${n}`);
      return true;
    }
    if (cmd === "urlencode") {
      await sendMessage(encodeURIComponent(args));
      return true;
    }
    if (cmd === "urldecode") {
      try {
        await sendMessage(decodeURIComponent(args));
      } catch {
        showNotification("URL\u30C7\u30B3\u30FC\u30C9\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      }
      return true;
    }
    if (cmd === "base64") {
      const encoded = encodeBase64Utf8(args);
      if (!encoded) {
        showNotification("Base64\u5909\u63DB\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        return true;
      }
      await sendMessage(encoded);
      return true;
    }
    if (cmd === "unbase64") {
      const decoded = decodeBase64Utf8(args);
      if (!decoded) {
        showNotification("Base64\u5FA9\u5143\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        return true;
      }
      await sendMessage(decoded);
      return true;
    }
    if (cmd === "binary") {
      const bin = toBinaryText(args);
      if (!bin) {
        showNotification("2\u9032\u6570\u5909\u63DB\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        return true;
      }
      await sendMessage(bin);
      return true;
    }
    if (cmd === "hex") {
      const hex = toHexText(args);
      if (!hex) {
        showNotification("16\u9032\u6570\u5909\u63DB\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        return true;
      }
      await sendMessage(hex);
      return true;
    }
    if (cmd === "rot13") {
      await sendMessage(rot13(args));
      return true;
    }
    if (cmd === "morse") {
      await sendMessage(toMorse(args));
      return true;
    }
    if (cmd === "unmorse") {
      await sendMessage(fromMorse(args));
      return true;
    }
    if (cmd === "rainbow") {
      await sendMessage(rainbowText(args));
      return true;
    }
    if (cmd === "random") {
      const min = Number(rest[0]);
      const max = Number(rest[1]);
      let rangeMin = 0;
      let rangeMax = 100;
      if (Number.isFinite(min) && Number.isFinite(max)) {
        rangeMin = Math.min(min, max);
        rangeMax = Math.max(min, max);
      } else if (Number.isFinite(min)) {
        rangeMin = 1;
        rangeMax = min;
      }
      const value = Math.floor(Math.random() * (rangeMax - rangeMin + 1)) + rangeMin;
      await sendMessage(String(value));
      return true;
    }
    if (cmd === "uuid") {
      const id = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      await sendMessage(id);
      return true;
    }
    if (cmd === "copy") {
      if (!args) {
        showNotification("/copy \u306E\u5F8C\u306B\u30B3\u30D4\u30FC\u5BFE\u8C61\u3092\u5165\u308C\u3066\u304F\u3060\u3055\u3044");
        return true;
      }
      try {
        await navigator.clipboard.writeText(args);
        showNotification("\u30AF\u30EA\u30C3\u30D7\u30DC\u30FC\u30C9\u306B\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F");
      } catch {
        showNotification("\u30B3\u30D4\u30FC\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      }
      return true;
    }
    if (cmd === "plus") {
      setPlusMenuOpen((prev) => !prev);
      return true;
    }
    if (cmd === "stickers") {
      setStickerMenuOpen((prev) => !prev);
      return true;
    }
    if (cmd === "record") {
      const mode = (rest[0] || "").toLowerCase();
      if (mode === "start" || !mode) {
        if (!isRecording) await startRecording();
      } else if (mode === "stop") {
        stopRecording();
      } else if (mode === "cancel") {
        cancelRecording();
      } else {
        showNotification("/record start|stop|cancel \u3092\u4F7F\u3063\u3066\u304F\u3060\u3055\u3044");
      }
      return true;
    }
    if (cmd === "bgreset") {
      await resetBackground();
      return true;
    }
    if (cmd === "joincall") {
      joinCurrentCall();
      return true;
    }
    if (cmd === "voice") {
      handleVideoCallButton(false);
      return true;
    }
    if (cmd === "video") {
      handleVideoCallButton(true);
      return true;
    }
    showNotification(`\u672A\u77E5\u306E\u30B3\u30DE\u30F3\u30C9: /${cmd}`);
    return true;
  };
  const handleSubmitText = async () => {
    const current = text.trim();
    if (!current || isUploading) return;
    const consumed = await runSlashCommand(current);
    if (consumed) {
      if (isMountedRef.current) setText("");
      return;
    }
    await sendMessage(text);
  };
  const handleVideoCallButton = (isVideo) => {
    if (hasJoinableCall) {
      joinCurrentCall();
      return;
    }
    startVideoCall(activeChatId, isVideo);
  };
  if (!chatData) return /* @__PURE__ */ jsx("div", { className: "h-full flex items-center justify-center bg-white", children: /* @__PURE__ */ jsx(Loader2, { className: "w-8 h-8 animate-spin text-gray-400" }) });
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col h-full relative", style: { backgroundColor: backgroundSrc ? "transparent" : "#8fb2c9", backgroundImage: backgroundSrc ? `url(${backgroundSrc})` : "none", backgroundSize: "cover", backgroundPosition: "center" }, children: [
    /* @__PURE__ */ jsxs("div", { className: "px-2.5 py-2 bg-[#f1f2f4] border-b border-gray-300 flex items-center gap-2 sticky top-0 z-10", children: [
      /* @__PURE__ */ jsx(ChevronLeft, { className: "w-5 h-5 cursor-pointer text-black", onClick: () => setView("home") }),
      /* @__PURE__ */ jsxs("div", { className: "relative", children: [
        !headerAvatarError && icon ? /* @__PURE__ */ jsx("img", { src: icon, className: "w-9 h-9 rounded-xl object-cover border border-gray-200", onError: () => setHeaderAvatarError(true) }, icon) : /* @__PURE__ */ jsx("div", { className: "w-9 h-9 rounded-xl bg-[#7a54c5] text-white text-base leading-none font-medium flex items-center justify-center", children: (title || "h").trim().charAt(0).toLowerCase() || "h" }),
        !isGroup && partnerData && isTodayBirthday(partnerData.birthday) && /* @__PURE__ */ jsx("span", { className: "absolute -top-1 -right-1 text-xs", children: "\u{1F382}" })
      ] }),
      !isGroup ? /* @__PURE__ */ jsx("div", { className: "font-bold text-[12px] flex-1 truncate text-gray-900 leading-none", children: title }) : /* @__PURE__ */ jsx("div", { className: "flex-1" }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2 mr-1 items-center", children: [
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx("button", { onClick: () => setBackgroundMenuOpen(!backgroundMenuOpen), className: "hover:bg-gray-200 p-1 rounded-full transition-colors", title: "\u80CC\u666F\u3092\u5909\u66F4", children: /* @__PURE__ */ jsx(Palette, { className: "w-5 h-5 text-gray-500" }) }),
          backgroundMenuOpen && /* @__PURE__ */ jsxs("div", { className: "absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border overflow-hidden w-40 z-20", children: [
            /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm font-bold text-gray-700", children: [
              /* @__PURE__ */ jsx(ImageIcon, { className: "w-4 h-4" }),
              /* @__PURE__ */ jsx("span", { children: "\u753B\u50CF\u3092\u9078\u629E" }),
              /* @__PURE__ */ jsx("input", { type: "file", className: "hidden", accept: "image/*", onChange: handleBackgroundUpload })
            ] }),
            /* @__PURE__ */ jsxs("button", { onClick: resetBackground, className: "w-full flex items-center gap-2 px-4 py-3 hover:bg-red-50 text-sm font-bold text-red-500 border-t", children: [
              /* @__PURE__ */ jsx(RefreshCcw, { className: "w-4 h-4" }),
              /* @__PURE__ */ jsx("span", { children: "\u30EA\u30BB\u30C3\u30C8" })
            ] })
          ] })
        ] }),
        isGroup && /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setGroupSettingsOpen(true),
            className: "hover:bg-gray-100 p-1 rounded-full transition-colors",
            title: "\u30B0\u30EB\u30FC\u30D7\u8A2D\u5B9A",
            children: /* @__PURE__ */ jsx(Settings, { className: "w-5 h-5 text-gray-600" })
          }
        ),
        hasJoinableCall && /* @__PURE__ */ jsx("button", { onClick: joinCurrentCall, className: "px-2 py-1 rounded-full bg-green-500 text-white text-[10px] font-bold hover:bg-green-600 transition-colors", title: "\u901A\u8A71\u306B\u53C2\u52A0", children: "\u53C2\u52A0" }),
        /* @__PURE__ */ jsx("button", { onClick: () => handleVideoCallButton(false), className: "hover:bg-gray-200 p-1 rounded-full transition-colors", title: "\u97F3\u58F0\u901A\u8A71", children: /* @__PURE__ */ jsx(Phone, { className: "w-5 h-5 text-gray-500" }) }),
        /* @__PURE__ */ jsx("button", { onClick: () => handleVideoCallButton(true), className: "hover:bg-gray-200 p-1 rounded-full transition-colors", title: "\u30D3\u30C7\u30AA\u901A\u8A71", children: /* @__PURE__ */ jsx(Video, { className: "w-5 h-5 text-gray-500" }) }),
        /* @__PURE__ */ jsx("button", { onClick: () => setAiEffectModalOpen(true), className: "hover:bg-gray-200 p-1 rounded-full transition-colors", title: "AI\u30A8\u30D5\u30A7\u30AF\u30C8", children: /* @__PURE__ */ jsx(Sparkles, { className: "w-5 h-5 text-gray-500" }) }),
        /* @__PURE__ */ jsx("button", { onClick: () => toggleMuteChat(activeChatId), className: "hover:bg-gray-200 p-1 rounded-full transition-colors", children: mutedChats.includes(activeChatId) ? /* @__PURE__ */ jsx(BellOff, { className: "w-5 h-5 text-gray-400" }) : /* @__PURE__ */ jsx(Bell, { className: "w-5 h-5 text-gray-500" }) })
      ] }),
      groupSettingsOpen && isGroup && /* @__PURE__ */ jsx(
        "div",
        {
          className: "fixed inset-0 z-[250] bg-black/40 flex items-end",
          onClick: () => setGroupSettingsOpen(false),
          children: /* @__PURE__ */ jsxs(
            "div",
            {
              className: "w-full bg-white rounded-t-[32px] p-5 shadow-2xl max-h-[80vh] overflow-y-auto",
              onClick: (e) => e.stopPropagation(),
              children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-4", children: [
                  /* @__PURE__ */ jsx("img", { src: chatData.icon, className: "w-14 h-14 rounded-2xl object-cover border" }),
                  /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                    /* @__PURE__ */ jsx("div", { className: "font-bold text-lg truncate", children: chatData.name }),
                    /* @__PURE__ */ jsxs("div", { className: "text-xs text-gray-400 font-bold", children: [
                      chatData.participants.length,
                      " \u4EBA"
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "text-[10px] text-gray-300 font-mono mt-0.5 truncate", children: [
                      "ChatID: ",
                      activeChatId
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => setGroupSettingsOpen(false),
                      className: "p-2 rounded-full bg-gray-100 hover:bg-gray-200",
                      "aria-label": "\u9589\u3058\u308B",
                      children: /* @__PURE__ */ jsx(X, { className: "w-5 h-5" })
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3 mb-5", children: [
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      onClick: () => {
                        setGroupSettingsOpen(false);
                        setGroupEditModalOpen(true);
                      },
                      className: "flex items-center justify-center gap-2 py-3 rounded-2xl bg-gray-900 text-white font-bold text-sm",
                      children: [
                        /* @__PURE__ */ jsx(Settings, { className: "w-5 h-5" }),
                        " \u30B0\u30EB\u30FC\u30D7\u7DE8\u96C6"
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      onClick: () => {
                        setGroupSettingsOpen(false);
                        setAddMemberModalOpen(true);
                      },
                      className: "flex items-center justify-center gap-2 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm",
                      children: [
                        /* @__PURE__ */ jsx(UserPlus, { className: "w-5 h-5" }),
                        " \u30E1\u30F3\u30D0\u30FC\u8FFD\u52A0"
                      ]
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "mb-4", children: [
                  /* @__PURE__ */ jsx("div", { className: "text-xs font-bold text-gray-500 mb-2", children: "\u30E1\u30F3\u30D0\u30FC" }),
                  /* @__PURE__ */ jsx("div", { className: "space-y-2", children: chatData.participants.map((uid) => {
                    const u = usersByUid.get(uid);
                    if (!u) return null;
                    const me = uid === user.uid;
                    return /* @__PURE__ */ jsxs(
                      "div",
                      {
                        className: "flex items-center gap-3 p-3 rounded-2xl border bg-white hover:bg-gray-50 cursor-pointer",
                        onClick: () => {
                          setGroupSettingsOpen(false);
                          setViewProfile(u);
                        },
                        children: [
                          /* @__PURE__ */ jsx("img", { src: u.avatar, className: "w-10 h-10 rounded-xl object-cover border" }),
                          /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                            /* @__PURE__ */ jsxs("div", { className: "font-bold text-sm truncate", children: [
                              u.name,
                              me ? "\uFF08\u3042\u306A\u305F\uFF09" : ""
                            ] }),
                            /* @__PURE__ */ jsx("div", { className: "text-[10px] text-gray-400 font-mono truncate", children: u.id })
                          ] })
                        ]
                      },
                      uid
                    );
                  }) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "mb-2 mt-1 rounded-2xl border border-red-200 bg-red-50 p-3", children: [
                  /* @__PURE__ */ jsx("div", { className: "text-[11px] font-bold text-red-700 mb-2", children: "\u5371\u967A\u306A\u64CD\u4F5C: \u9000\u4F1A\u3059\u308B\u3068\u5143\u306B\u623B\u305B\u307E\u305B\u3093" }),
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      onClick: () => {
                        setGroupSettingsOpen(false);
                        setLeaveModalOpen(true);
                      },
                      className: "w-full py-3.5 rounded-2xl bg-red-600 text-white font-black text-sm tracking-wide flex items-center justify-center gap-2 hover:bg-red-700 border border-red-700 shadow-lg shadow-red-200",
                      children: [
                        /* @__PURE__ */ jsx(LogOut, { className: "w-5 h-5" }),
                        " \u30B0\u30EB\u30FC\u30D7\u3092\u9000\u4F1A"
                      ]
                    }
                  )
                ] }),
                /* @__PURE__ */ jsx("div", { className: "h-3" })
              ]
            }
          )
        }
      )
    ] }),
    !isGroup && partnerId && isTodayBirthday(usersByUid.get(partnerId)?.birthday) && /* @__PURE__ */ jsxs("div", { className: "bg-pink-100 p-2 flex items-center justify-between px-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(Cake, { className: "w-5 h-5 text-pink-500 animate-bounce" }),
        /* @__PURE__ */ jsxs("span", { className: "text-xs font-bold text-pink-700", children: [
          "\u4ECA\u65E5\u306F",
          title,
          "\u3055\u3093\u306E\u8A95\u751F\u65E5\u3067\u3059\uFF01"
        ] })
      ] }),
      /* @__PURE__ */ jsx("button", { onClick: () => setCardModalOpen(true), className: "bg-pink-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm", children: "\u30AB\u30FC\u30C9\u3092\u66F8\u304F" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: `flex-1 overflow-y-auto px-3 py-2.5 space-y-3 scrollbar-hide ${backgroundSrc ? "bg-white/40 backdrop-blur-sm" : ""}`, children: [
      messages.length >= messageLimit && /* @__PURE__ */ jsx("div", { className: "flex justify-center py-2", children: /* @__PURE__ */ jsxs("button", { onClick: () => setMessageLimit((prev) => prev + 50), className: "bg-white/50 backdrop-blur-md px-4 py-1 rounded-full text-xs font-bold text-gray-700 shadow-sm flex items-center gap-1 hover:bg-white/70", children: [
        /* @__PURE__ */ jsx(ArrowUpCircle, { className: "w-4 h-4" }),
        " \u4EE5\u524D\u306E\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u8AAD\u307F\u8FBC\u3080"
      ] }) }),
      messages.map((m) => {
        const sender = usersByUid.get(m.senderId);
        return /* @__PURE__ */ jsx(MessageItem, { m, user, sender, isGroup, db: db2, appId: appId2, chatId: activeChatId, addFriendById, onEdit: handleEditMessage, onDelete: handleDeleteMessage, onPreview: handlePreviewMedia, onReply: setReplyTo, onReaction: handleReaction, usersByUid, usersByName, onStickerClick, onShowProfile: setViewProfile, onJoinCall: handleJoinCall }, m.id);
      }),
      /* @__PURE__ */ jsx("div", { ref: scrollRef, className: "h-2 w-full" })
    ] }),
    previewMedia && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4", onClick: () => setPreviewMedia(null), children: [
      /* @__PURE__ */ jsx("button", { className: "absolute top-6 right-6 text-white p-2 rounded-full bg-white/20", children: /* @__PURE__ */ jsx(X, { className: "w-6 h-6" }) }),
      previewMedia.type === "video" ? /* @__PURE__ */ jsx("video", { src: previewMedia.src, controls: true, autoPlay: true, className: "max-w-full max-h-[85vh] rounded shadow-2xl", onClick: (e) => e.stopPropagation() }) : /* @__PURE__ */ jsx("img", { src: previewMedia.src, className: "max-w-full max-h-[85vh] object-contain rounded shadow-2xl", onClick: (e) => e.stopPropagation() })
    ] }),
    editingMsgId && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-sm rounded-2xl p-4", children: [
      /* @__PURE__ */ jsx("h3", { className: "font-bold mb-2", children: "\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u7DE8\u96C6" }),
      /* @__PURE__ */ jsx("textarea", { className: "w-full bg-gray-50 p-2 rounded-xl mb-4 border focus:outline-none", value: editingText, onChange: (e) => setEditingText(e.target.value), rows: 3 }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx("button", { onClick: () => setEditingMsgId(null), className: "flex-1 py-2 bg-gray-100 rounded-xl font-bold text-gray-600", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }),
        /* @__PURE__ */ jsx("button", { onClick: submitEditMessage, className: "flex-1 py-2 bg-green-500 rounded-xl font-bold text-white", children: "\u66F4\u65B0" })
      ] })
    ] }) }),
    addMemberModalOpen && /* @__PURE__ */ jsx(GroupAddMemberModal, { onClose: () => setAddMemberModalOpen(false), currentMembers: chatData?.participants || [], chatId: activeChatId, allUsers, profile, user, chats, showNotification }),
    groupEditModalOpen && /* @__PURE__ */ jsx(GroupEditModal, { onClose: () => setGroupEditModalOpen(false), chatId: activeChatId, currentName: chatData.name, currentIcon: chatData.icon, currentMembers: chatData.participants, allUsers, showNotification, user, profile }),
    leaveModalOpen && /* @__PURE__ */ jsx(LeaveGroupConfirmModal, { onClose: () => setLeaveModalOpen(false), onLeave: handleLeaveGroup }),
    cardModalOpen && /* @__PURE__ */ jsx(BirthdayCardModal, { onClose: () => setCardModalOpen(false), onSend: sendBirthdayCard, toName: title }),
    contactModalOpen && /* @__PURE__ */ jsx(ContactSelectModal, { onClose: () => setContactModalOpen(false), onSend: (c) => sendMessage("", "contact", { contactId: c.uid, contactName: c.name, contactAvatar: c.avatar }), friends: contactCandidates }),
    buyStickerModalPackId && /* @__PURE__ */ jsx(StickerBuyModal, { onClose: () => setBuyStickerModalPackId(null), packId: buyStickerModalPackId, onGoToStore: (id) => {
      setView("sticker-store");
      setBuyStickerModalPackId(null);
    } }),
    aiEffectModalOpen && /* @__PURE__ */ jsx(AIEffectGenerator, { user, onClose: () => setAiEffectModalOpen(false), showNotification }),
    !groupSettingsOpen && plusMenuOpen && /* @__PURE__ */ jsxs("div", { className: "absolute bottom-16 left-4 right-4 bg-white rounded-3xl p-4 shadow-2xl grid grid-cols-4 gap-4 animate-in slide-in-from-bottom-4 z-20", children: [
      /* @__PURE__ */ jsxs("label", { className: "flex flex-col items-center gap-2 cursor-pointer", children: [
        /* @__PURE__ */ jsx("div", { className: "p-3 bg-green-50 rounded-2xl", children: /* @__PURE__ */ jsx(ImageIcon, { className: "w-6 h-6 text-green-500" }) }),
        /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold", children: "\u753B\u50CF" }),
        /* @__PURE__ */ jsx("input", { type: "file", className: "hidden", accept: "image/*", onChange: (e) => handleFileUpload(e, (d, t, f) => sendMessage(d, t, {}, f)) })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "flex flex-col items-center gap-2 cursor-pointer", children: [
        /* @__PURE__ */ jsx("div", { className: "p-3 bg-blue-50 rounded-2xl", children: /* @__PURE__ */ jsx(Play, { className: "w-6 h-6 text-blue-500" }) }),
        /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold", children: "\u52D5\u753B" }),
        /* @__PURE__ */ jsx("input", { type: "file", className: "hidden", accept: "video/*", onChange: (e) => handleFileUpload(e, (d, t, f) => sendMessage(d, t, {}, f)) })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "flex flex-col items-center gap-2 cursor-pointer", children: [
        /* @__PURE__ */ jsx("div", { className: "p-3 bg-gray-100 rounded-2xl", children: /* @__PURE__ */ jsx(Paperclip, { className: "w-6 h-6 text-gray-600" }) }),
        /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold", children: "\u30D5\u30A1\u30A4\u30EB" }),
        /* @__PURE__ */ jsx("input", { type: "file", className: "hidden", onChange: (e) => handleFileUpload(e, (d, t, f) => sendMessage(d, t, {}, f)) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-2 cursor-pointer", onClick: () => setContactModalOpen(true), children: [
        /* @__PURE__ */ jsx("div", { className: "p-3 bg-yellow-50 rounded-2xl", children: /* @__PURE__ */ jsx(Contact, { className: "w-6 h-6 text-yellow-500" }) }),
        /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold", children: "\u9023\u7D61\u5148" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-2 cursor-pointer", onClick: () => setCardModalOpen(true), children: [
        /* @__PURE__ */ jsx("div", { className: "p-3 bg-pink-50 rounded-2xl", children: /* @__PURE__ */ jsx(Gift, { className: "w-6 h-6 text-pink-500" }) }),
        /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold", children: "\u30AB\u30FC\u30C9" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-2 cursor-pointer", onClick: () => {
        if (!isGroup && partnerData) {
          setCoinModalTarget(partnerData);
          setPlusMenuOpen(false);
        } else {
          showNotification("\u30B0\u30EB\u30FC\u30D7\u3067\u306E\u9001\u91D1\u306F\u30D7\u30ED\u30D5\u30A3\u30FC\u30EB\u304B\u3089\u884C\u3063\u3066\u304F\u3060\u3055\u3044");
        }
      }, children: [
        /* @__PURE__ */ jsx("div", { className: "p-3 bg-orange-50 rounded-2xl", children: /* @__PURE__ */ jsx(Coins, { className: "w-6 h-6 text-orange-500" }) }),
        /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold", children: "\u9001\u91D1" })
      ] })
    ] }),
    !groupSettingsOpen && /* @__PURE__ */ jsxs("div", { className: "px-3 py-2 bg-[#f1f2f4] border-t border-gray-300 flex flex-col gap-1.5 relative z-10", children: [
      stickerMenuOpen && myStickerPacks.length > 0 && /* @__PURE__ */ jsxs("div", { className: "absolute bottom-full left-0 right-0 bg-gray-50 border-t h-72 flex flex-col shadow-2xl rounded-t-3xl overflow-hidden animate-in slide-in-from-bottom-2 z-20", children: [
        /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto p-4 grid grid-cols-4 gap-4 content-start", children: myStickerPacks.find((p) => p.id === selectedPackId)?.stickers.map((s, i) => /* @__PURE__ */ jsxs("div", { className: "relative cursor-pointer hover:scale-110 active:scale-95 transition-transform drop-shadow-sm", onClick: () => sendMessage(s, "sticker", { packId: selectedPackId }), children: [
          /* @__PURE__ */ jsx("img", { src: typeof s === "string" ? s : s.image, className: "w-full aspect-square object-contain" }),
          typeof s !== "string" && s.audio && /* @__PURE__ */ jsx("div", { className: "absolute bottom-0 right-0 bg-black/20 text-white rounded-full p-1", children: /* @__PURE__ */ jsx(Volume2, { className: "w-3 h-3" }) })
        ] }, i)) }),
        /* @__PURE__ */ jsx("div", { className: "bg-white border-t flex overflow-x-auto p-2 gap-2 scrollbar-hide shrink-0", children: myStickerPacks.map((pack) => /* @__PURE__ */ jsx("div", { onClick: () => setSelectedPackId(pack.id), className: `flex-shrink-0 cursor-pointer p-2 rounded-xl transition-colors ${selectedPackId === pack.id ? "bg-gray-200" : "hover:bg-gray-100"}`, children: /* @__PURE__ */ jsx("img", { src: typeof pack.stickers[0] === "string" ? pack.stickers[0] : pack.stickers[0].image, className: "w-8 h-8 object-contain" }) }, pack.id)) })
      ] }),
      replyTo && /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between bg-gray-100 p-2 rounded-xl text-xs mb-1 border-l-4 border-green-500", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col max-w-[90%]", children: [
          /* @__PURE__ */ jsxs("span", { className: "font-bold text-green-600 mb-0.5", children: [
            usersByUid.get(replyTo.senderId)?.name || "Unknown",
            " \u3078\u306E\u8FD4\u4FE1"
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "truncate text-gray-600 flex items-center gap-1", children: [
            replyTo.type === "image" && /* @__PURE__ */ jsx(ImageIcon, { className: "w-3 h-3" }),
            replyTo.type === "video" && /* @__PURE__ */ jsx(Video, { className: "w-3 h-3" }),
            ["image", "video"].includes(replyTo.type) ? replyTo.type === "image" ? "[\u753B\u50CF]" : "[\u52D5\u753B]" : replyTo.content || "[\u30E1\u30C3\u30BB\u30FC\u30B8]"
          ] })
        ] }),
        /* @__PURE__ */ jsx("button", { onClick: () => setReplyTo(null), className: "p-1 hover:bg-gray-200 rounded-full", children: /* @__PURE__ */ jsx(X, { className: "w-4 h-4 text-gray-500" }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsx("button", { onClick: () => setPlusMenuOpen(!plusMenuOpen), className: "p-1", children: /* @__PURE__ */ jsx(Plus, { className: "w-6 h-6 text-gray-400" }) }),
        !isRecording ? /* @__PURE__ */ jsx("input", { className: "flex-1 bg-[#e6e6ea] rounded-full px-4 py-2 text-sm leading-none focus:outline-none placeholder:text-[#9ca3af]", placeholder: "\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u5165\u529B (/help \u3067\u30B3\u30DE\u30F3\u30C9)", value: text, onChange: (e) => setText(e.target.value), onKeyDown: (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmitText();
          }
        } }) : /* @__PURE__ */ jsx("div", { className: "flex-1 bg-red-50 rounded-full px-4 py-2 flex items-center justify-between animate-pulse", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-red-500 font-bold text-[11px]", children: [
          /* @__PURE__ */ jsx("div", { className: "w-2 h-2 rounded-full bg-red-500 animate-ping" }),
          "\u9332\u97F3\u4E2D... ",
          Math.floor(recordingTime / 60),
          ":",
          (recordingTime % 60).toString().padStart(2, "0")
        ] }) }),
        /* @__PURE__ */ jsx("button", { onClick: () => setStickerMenuOpen(!stickerMenuOpen), className: `p-2 rounded-full bg-[#e6e6ea] hover:bg-gray-300 ${stickerMenuOpen ? "text-green-500" : "text-gray-500"}`, children: /* @__PURE__ */ jsx(Smile, { className: "w-4 h-4" }) }),
        !isRecording ? /* @__PURE__ */ jsx("button", { onClick: startRecording, className: "p-2 rounded-full bg-[#e6e6ea] text-gray-500 hover:bg-gray-300", children: /* @__PURE__ */ jsx(Mic, { className: "w-4 h-4" }) }) : /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx("button", { onClick: cancelRecording, className: "p-2 rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300", title: "\u30AD\u30E3\u30F3\u30BB\u30EB", children: /* @__PURE__ */ jsx(Trash2, { className: "w-4 h-4" }) }),
          /* @__PURE__ */ jsx("button", { onClick: stopRecording, className: "p-2 rounded-full bg-red-500 text-white hover:bg-red-600 animate-bounce", title: "\u505C\u6B62\u3057\u3066\u9001\u4FE1", children: /* @__PURE__ */ jsx(StopCircle, { className: "w-4 h-4 fill-current" }) })
        ] }),
        (text || isUploading) && /* @__PURE__ */ jsx("button", { onClick: handleSubmitText, disabled: !text && !isUploading, className: `p-2 rounded-full ${text ? "text-green-500" : "text-gray-300"}`, children: isUploading ? /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx(Loader2, { className: "w-5 h-5 animate-spin text-green-500" }),
          uploadProgress > 0 && /* @__PURE__ */ jsxs("div", { className: "absolute top-full left-1/2 -translate-x-1/2 text-[8px] font-bold mt-1", children: [
            uploadProgress,
            "%"
          ] })
        ] }) : /* @__PURE__ */ jsx(Send, { className: "w-5 h-5" }) })
      ] })
    ] }),
    viewProfile && /* @__PURE__ */ jsx(FriendProfileModal, { friend: viewProfile, onClose: () => setViewProfile(null), onStartChat: (uid) => {
      setViewProfile(null);
    }, onTransfer: () => {
      setCoinModalTarget(viewProfile);
      setViewProfile(null);
    }, myUid: user.uid, myProfile: profile, allUsers, showNotification }),
    coinModalTarget && /* @__PURE__ */ jsx(CoinTransferModal, { onClose: () => setCoinModalTarget(null), myWallet: profile.wallet, myUid: user.uid, targetUid: coinModalTarget.uid, targetName: coinModalTarget.name, showNotification })
  ] });
};
const VoomView = ({ user, allUsers, profile, posts, showNotification, db: db2, appId: appId2 }) => {
  const [content, setContent] = useState(""), [media, setMedia] = useState(null), [mediaFile, setMediaFile] = useState(null), [mediaType, setMediaType] = useState("image"), [isUploading, setIsUploading] = useState(false);
  useEffect(() => {
    return () => {
      if (media && media.startsWith("blob:")) {
        URL.revokeObjectURL(media);
      }
    };
  }, [media]);
  const postMessage = async () => {
    if (profile?.isBanned) return showNotification("\u30A2\u30AB\u30A6\u30F3\u30C8\u304C\u5229\u7528\u505C\u6B62\u3055\u308C\u3066\u3044\u307E\u3059 \u{1F6AB}");
    if (!content && !mediaFile || isUploading) return;
    setIsUploading(true);
    try {
      let hasChunks = false;
      let chunkCount = 0;
      let storedMedia = null;
      let mimeType = null;
      const newPostRef = doc(collection(db2, "artifacts", appId2, "public", "data", "posts"));
      if (mediaFile) {
        hasChunks = true;
        chunkCount = Math.ceil(mediaFile.size / CHUNK_SIZE);
        mimeType = mediaFile.type || null;
        const CONCURRENCY = getUploadConcurrency();
        const executing = /* @__PURE__ */ new Set();
        for (let i = 0; i < chunkCount; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, mediaFile.size);
          const blobSlice = mediaFile.slice(start, end);
          const p = blobSlice.arrayBuffer().then(async (buf) => {
            const base64Data = bytesToBase64(new Uint8Array(buf));
            await setDoc(doc(db2, "artifacts", appId2, "public", "data", "posts", newPostRef.id, "chunks", `${i}`), { data: base64Data, index: i });
          });
          executing.add(p);
          p.finally(() => executing.delete(p));
          if (executing.size >= CONCURRENCY) {
            await Promise.race(executing);
          }
        }
        await Promise.all(executing);
      }
      await setDoc(newPostRef, { userId: user.uid, content, media: storedMedia, mediaType, mimeType, hasChunks, chunkCount, likes: [], comments: [], createdAt: serverTimestamp() });
      setContent("");
      if (media && media.startsWith("blob:")) {
        URL.revokeObjectURL(media);
      }
      setMedia(null);
      setMediaFile(null);
      showNotification("\u6295\u7A3F\u3057\u307E\u3057\u305F");
    } finally {
      setIsUploading(false);
    }
  };
  const handleVoomFileUpload = async (e) => {
    const inputFile = e.target.files[0];
    if (!inputFile) return;
    e.target.value = "";
    const processed = await processFileBeforeUpload(inputFile);
    const file = processed instanceof File ? processed : new File([processed], inputFile.name, { type: processed?.type || inputFile.type || "application/octet-stream", lastModified: Date.now() });
    if (media && media.startsWith("blob:")) {
      URL.revokeObjectURL(media);
    }
    const objectUrl = URL.createObjectURL(file);
    setMedia(objectUrl);
    setMediaFile(file);
    setMediaType(file.type.startsWith("video") ? "video" : "image");
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col h-full bg-gray-50", children: [
    /* @__PURE__ */ jsx("div", { className: "bg-white p-4 border-b shrink-0", children: /* @__PURE__ */ jsx("h1", { className: "text-xl font-bold", children: "VOOM" }) }),
    /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto scrollbar-hide pb-20", children: [
      /* @__PURE__ */ jsxs("div", { className: "bg-white p-4 mb-2", children: [
        /* @__PURE__ */ jsx("textarea", { className: "w-full text-sm outline-none resize-none min-h-[60px]", placeholder: "\u4F55\u3092\u3057\u3066\u3044\u307E\u3059\u304B\uFF1F", value: content, onChange: (e) => setContent(e.target.value) }),
        media && /* @__PURE__ */ jsxs("div", { className: "relative mt-2", children: [
          mediaType === "video" ? /* @__PURE__ */ jsx("video", { src: media, className: "w-full rounded-xl bg-black", controls: true }) : /* @__PURE__ */ jsx("img", { src: media, className: "max-h-60 rounded-xl" }),
          /* @__PURE__ */ jsx("button", { onClick: () => {
            if (media && media.startsWith("blob:")) {
              URL.revokeObjectURL(media);
            }
            setMedia(null);
            setMediaFile(null);
          }, className: "absolute top-1 right-1 bg-black/50 text-white rounded-full p-1", children: /* @__PURE__ */ jsx(X, { className: "w-3 h-3" }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center pt-2 border-t mt-2", children: [
          /* @__PURE__ */ jsxs("label", { className: "cursor-pointer p-2 flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(ImageIcon, { className: "w-5 h-5 text-gray-400" }),
            /* @__PURE__ */ jsx("input", { type: "file", className: "hidden", accept: "image/*,video/*", onChange: handleVoomFileUpload })
          ] }),
          /* @__PURE__ */ jsx("button", { onClick: postMessage, disabled: isUploading, className: `text-xs font-bold px-4 py-2 rounded-full ${content || mediaFile ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"}`, children: "\u6295\u7A3F" })
        ] })
      ] }),
      posts.map((p) => /* @__PURE__ */ jsx(PostItem, { post: p, user, allUsers, db: db2, appId: appId2, profile }, p.id))
    ] })
  ] });
};
const ProfileEditView = ({ user, profile, setView, showNotification, copyToClipboard, onLogout }) => {
  const [edit, setEdit] = useState(profile || {});
  useEffect(() => {
    if (profile) setEdit((prev) => !prev || Object.keys(prev).length === 0 ? { ...profile } : { ...profile, name: prev.name, id: prev.id, status: prev.status, birthday: prev.birthday, avatar: prev.avatar, cover: prev.cover });
  }, [profile]);
  const handleSave = async () => {
    try {
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "users", user.uid), edit);
      showNotification("\u4FDD\u5B58\u3057\u307E\u3057\u305F \u2705");
    } catch (e) {
      console.error(e);
      showNotification("\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    }
  };
  const handleLogout = async () => {
    try {
      if (onLogout) {
        await onLogout(edit);
      }
    } catch (e) {
      console.error("Logout with save failed:", e);
      showNotification("\u30ED\u30B0\u30A2\u30A6\u30C8\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col h-full bg-white", children: [
    /* @__PURE__ */ jsxs("div", { className: "p-4 border-b flex items-center gap-4 sticky top-0 bg-white shrink-0", children: [
      /* @__PURE__ */ jsx(ChevronLeft, { className: "w-6 h-6 cursor-pointer", onClick: () => setView("home") }),
      /* @__PURE__ */ jsx("span", { className: "font-bold", children: "\u8A2D\u5B9A" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto pb-8", children: [
      /* @__PURE__ */ jsxs("div", { className: "w-full h-48 relative bg-gray-200", children: [
        /* @__PURE__ */ jsx("img", { src: edit.cover, className: "w-full h-full object-cover" }),
        /* @__PURE__ */ jsxs("label", { className: "absolute inset-0 flex items-center justify-center bg-black/20 text-white font-bold cursor-pointer opacity-0 hover:opacity-100 transition-opacity", children: [
          "\u80CC\u666F\u5909\u66F4",
          /* @__PURE__ */ jsx("input", { type: "file", className: "hidden", accept: "image/*", onChange: (e) => handleCompressedUpload(e, (d) => setEdit({ ...edit, cover: d })) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "px-8 -mt-12 flex flex-col items-center gap-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx("img", { src: edit.avatar, className: "w-24 h-24 rounded-3xl border-4 border-white object-cover" }),
          /* @__PURE__ */ jsxs("label", { className: "absolute bottom-0 right-0 bg-green-500 p-2 rounded-full text-white cursor-pointer", children: [
            /* @__PURE__ */ jsx(CameraIcon, { className: "w-4 h-4" }),
            /* @__PURE__ */ jsx("input", { type: "file", className: "hidden", accept: "image/*", onChange: (e) => handleCompressedUpload(e, (d) => setEdit({ ...edit, avatar: d })) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "w-full space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-gray-400", children: "\u540D\u524D" }),
            /* @__PURE__ */ jsx("input", { className: "w-full border-b py-2 outline-none", value: edit.name || "", onChange: (e) => setEdit({ ...edit, name: e.target.value }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-gray-400", children: "ID" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 border-b py-2", children: [
              /* @__PURE__ */ jsx("span", { className: "flex-1 font-mono text-gray-600", children: edit.id }),
              /* @__PURE__ */ jsx("button", { onClick: () => copyToClipboard(edit.id), className: "p-1 hover:bg-gray-100 rounded-full", children: /* @__PURE__ */ jsx(Copy, { className: "w-4 h-4 text-gray-500" }) })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-gray-400", children: "\u8A95\u751F\u65E5" }),
            /* @__PURE__ */ jsx("input", { type: "date", className: "w-full border-b py-2 outline-none bg-transparent", value: edit.birthday || "", onChange: (e) => setEdit({ ...edit, birthday: e.target.value }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "text-xs font-bold text-gray-400", children: "\u3072\u3068\u3053\u3068" }),
            /* @__PURE__ */ jsx("input", { className: "w-full border-b py-2 outline-none", value: edit.status || "", onChange: (e) => setEdit({ ...edit, status: e.target.value }) })
          ] }),
          /* @__PURE__ */ jsx("button", { onClick: handleSave, className: "w-full bg-green-500 text-white py-4 rounded-2xl font-bold shadow-lg", children: "\u4FDD\u5B58" }),
          /* @__PURE__ */ jsx("button", { onClick: handleLogout, className: "w-full bg-gray-100 text-red-500 py-4 rounded-2xl font-bold mt-4", children: "\u30ED\u30B0\u30A2\u30A6\u30C8" })
        ] })
      ] })
    ] })
  ] });
};
const QRScannerView = ({ user, setView, addFriendById }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const startScanner = async () => {
    setScanning(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.play();
        requestAnimationFrame(tick);
      }
    } catch (err) {
      setScanning(false);
    }
  };
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);
  const tick = () => {
    if (videoRef.current?.readyState === videoRef.current?.HAVE_ENOUGH_DATA) {
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (c && ctx) {
        c.height = videoRef.current.videoHeight;
        c.width = videoRef.current.videoWidth;
        ctx.drawImage(videoRef.current, 0, 0, c.width, c.height);
        const win = window;
        if (win.jsQR) {
          const code = win.jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
          if (code) {
            if (videoRef.current.srcObject) {
              const stream = videoRef.current.srcObject;
              stream.getTracks().forEach((t) => t.stop());
            }
            setScanning(false);
            addFriendById(code.data);
            return;
          }
        }
      }
    }
    if (scanning) requestAnimationFrame(tick);
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col h-full bg-white", children: [
    /* @__PURE__ */ jsxs("div", { className: "p-4 border-b flex items-center gap-4", children: [
      /* @__PURE__ */ jsx(ChevronLeft, { className: "w-6 h-6 cursor-pointer", onClick: () => setView("home") }),
      /* @__PURE__ */ jsx("span", { className: "font-bold", children: "QR" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto p-8", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center gap-8 min-h-full", children: [
      scanning ? /* @__PURE__ */ jsxs("div", { className: "relative w-64 h-64 border-4 border-green-500 rounded-3xl overflow-hidden", children: [
        /* @__PURE__ */ jsx("video", { ref: videoRef, className: "w-full h-full object-cover" }),
        /* @__PURE__ */ jsx("canvas", { ref: canvasRef, className: "hidden" })
      ] }) : /* @__PURE__ */ jsx("div", { className: "bg-white p-6 rounded-[40px] shadow-xl border", children: /* @__PURE__ */ jsx("img", { src: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${user?.uid}`, className: "w-48 h-48" }) }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-4 w-full", children: [
        /* @__PURE__ */ jsxs("button", { onClick: startScanner, className: "flex flex-col items-center gap-2 bg-gray-50 p-4 rounded-3xl border", children: [
          /* @__PURE__ */ jsx(Maximize, { className: "w-6 h-6 text-green-500" }),
          /* @__PURE__ */ jsx("span", { children: "\u30B9\u30AD\u30E3\u30F3" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "flex flex-col items-center gap-2 bg-gray-50 p-4 rounded-3xl border cursor-pointer", children: [
          /* @__PURE__ */ jsx(Upload, { className: "w-6 h-6 text-blue-500" }),
          /* @__PURE__ */ jsx("span", { children: "\u8AAD\u8FBC" }),
          /* @__PURE__ */ jsx("input", { type: "file", className: "hidden", accept: "image/*", onChange: (e) => {
            const r = new FileReader();
            r.onload = (ev) => {
              const img = new Image();
              img.onload = () => {
                const c = document.createElement("canvas"), ctx = c.getContext("2d");
                if (ctx) {
                  c.width = img.width;
                  c.height = img.height;
                  ctx.drawImage(img, 0, 0);
                  const win = window;
                  const code = win.jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
                  if (code) addFriendById(code.data);
                }
              };
              img.src = ev.target.result;
            };
            r.readAsDataURL(e.target.files[0]);
          } })
        ] })
      ] })
    ] }) })
  ] });
};
const AvatarWithFallback = ({ src, name, className, fallbackClassName }) => {
  const [hasError, setHasError] = useState(false);
  const initial = (name || "h").trim().charAt(0).toLowerCase() || "h";
  if (!src || hasError) {
    return /* @__PURE__ */ jsx("div", { className: `${className} ${fallbackClassName} flex items-center justify-center text-white text-2xl font-medium`, children: initial });
  }
  return /* @__PURE__ */ jsx("img", { src, className, loading: "lazy", onError: () => setHasError(true), alt: name || "avatar" });
};
const HomeView = ({ user, profile, allUsers, chats, setView, setActiveChatId, setSearchModalOpen, startChatWithUser, showNotification }) => {
  const [tab, setTab] = useState("chats");
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [coinModalTarget, setCoinModalTarget] = useState(null);
  const [openChatMenuId, setOpenChatMenuId] = useState(null);
  const [openFriendMenuId, setOpenFriendMenuId] = useState(null);
  const hiddenFriendUids = useMemo(() => new Set(profile?.hiddenFriends || []), [profile?.hiddenFriends]);
  const talkFriendUids = useMemo(() => {
    const s = /* @__PURE__ */ new Set();
    (chats || []).forEach((c) => {
      if (!c || c.isGroup) return;
      const parts = c.participants || [];
      if (!parts.includes(user.uid)) return;
      const other = parts.find((p) => p && p !== user.uid);
      if (other) s.add(other);
    });
    return s;
  }, [chats, user.uid]);
  const directFriendUids = useMemo(() => {
    const s = new Set(profile?.friends || []);
    talkFriendUids.forEach((uid) => s.add(uid));
    return s;
  }, [profile?.friends, talkFriendUids]);
  const talkFriendCount = talkFriendUids.size;
  const groupChatCount = useMemo(() => (chats || []).filter((c) => c?.isGroup).length, [chats]);
  const friendsListAll = useMemo(
    () => allUsers.filter((u) => u?.uid && u.uid !== user.uid && directFriendUids.has(u.uid)),
    [allUsers, directFriendUids, user.uid]
  );
  const directFriendsListAll = useMemo(
    () => allUsers.filter((u) => directFriendUids.has(u.uid)),
    [allUsers, directFriendUids]
  );
  const visibleFriendsList = useMemo(
    () => friendsListAll.filter((u) => !hiddenFriendUids.has(u.uid)),
    [friendsListAll, hiddenFriendUids]
  );
  const hiddenFriendsList = useMemo(
    () => friendsListAll.filter((u) => hiddenFriendUids.has(u.uid)),
    [friendsListAll, hiddenFriendUids]
  );
  const friendsOfFriendsCount = useMemo(() => {
    const fof = /* @__PURE__ */ new Set();
    directFriendsListAll.forEach((f) => {
      const ff = f?.friends || [];
      ff.forEach((uid) => {
        if (!uid) return;
        if (uid === user.uid) return;
        if (directFriendUids.has(uid)) return;
        fof.add(uid);
      });
    });
    return fof.size;
  }, [directFriendsListAll, user.uid, directFriendUids]);
  const getMutualCount = useCallback((friend) => {
    const ff = friend?.friends || [];
    let n = 0;
    for (const uid of ff) {
      if (!uid || uid === user.uid) continue;
      if (directFriendUids.has(uid)) n++;
    }
    return n;
  }, [directFriendUids, user.uid]);
  const getFofCandidateCount = useCallback((friend) => {
    const ff = friend?.friends || [];
    let n = 0;
    for (const uid of ff) {
      if (!uid || uid === user.uid) continue;
      if (!directFriendUids.has(uid)) n++;
    }
    return n;
  }, [directFriendUids, user.uid]);
  const handleHideChat = async (e, chatId) => {
    e.stopPropagation();
    setOpenChatMenuId(null);
    if (!window.confirm("\u3053\u306E\u30C8\u30FC\u30AF\u3092\u975E\u8868\u793A\u306B\u3057\u307E\u3059\u304B\uFF1F\n\uFF08\u30C8\u30FC\u30AF\u5C65\u6B74\u306F\u524A\u9664\u3055\u308C\u307E\u305B\u3093\uFF09")) return;
    try {
      const userRef = doc(db, "artifacts", appId, "public", "data", "users", user.uid);
      const updatePayload = {
        hiddenChats: arrayUnion(chatId)
      };
      const targetChat = (chats || []).find((c) => c?.id === chatId);
      if (targetChat && !targetChat.isGroup) {
        const partnerUid = (targetChat.participants || []).find((p) => p && p !== user.uid);
        if (partnerUid) {
          updatePayload.hiddenFriends = arrayUnion(partnerUid);
        }
      }
      await updateDoc(userRef, updatePayload);
      showNotification("\u975E\u8868\u793A\u306B\u3057\u307E\u3057\u305F");
    } catch (e2) {
      showNotification("\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
    }
  };
  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation();
    setOpenChatMenuId(null);
    if (!window.confirm("\u3053\u306E\u30C8\u30FC\u30AF\u3092\u524A\u9664\uFF08\u9000\u51FA\uFF09\u3057\u307E\u3059\u304B\uFF1F\n\u76F8\u624B\u3068\u306E\u30C8\u30FC\u30AF\u30EA\u30B9\u30C8\u304B\u3089\u3082\u524A\u9664\u3055\u308C\u308B\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002")) return;
    try {
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", chatId), {
        participants: arrayRemove(user.uid)
      });
      showNotification("\u524A\u9664\u3057\u307E\u3057\u305F");
    } catch (e2) {
      showNotification("\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
    }
  };
  const handleHideFriend = async (e, friendUid) => {
    e.stopPropagation();
    setOpenFriendMenuId(null);
    if (!window.confirm("\u3053\u306E\u53CB\u3060\u3061\u3092\u975E\u8868\u793A\u306B\u3057\u307E\u3059\u304B\uFF1F\n\uFF08\u53CB\u3060\u3061\u95A2\u4FC2\u306F\u89E3\u9664\u3055\u308C\u307E\u305B\u3093\uFF09")) return;
    try {
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "users", user.uid), {
        hiddenFriends: arrayUnion(friendUid)
      });
      showNotification("\u975E\u8868\u793A\u306B\u3057\u307E\u3057\u305F");
    } catch (e2) {
      showNotification("\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
    }
  };
  const handleUnhideFriend = async (e, friendUid) => {
    e.stopPropagation();
    setOpenFriendMenuId(null);
    try {
      const userRef = doc(db, "artifacts", appId, "public", "data", "users", user.uid);
      const relatedDirectChatIds = (chats || []).filter((c) => !c?.isGroup && (c.participants || []).includes(user.uid) && (c.participants || []).includes(friendUid)).map((c) => c.id);
      const updatePayload = {
        hiddenFriends: arrayRemove(friendUid)
      };
      if (relatedDirectChatIds.length > 0) {
        updatePayload.hiddenChats = arrayRemove(...relatedDirectChatIds);
      }
      await updateDoc(userRef, updatePayload);
      showNotification("\u975E\u8868\u793A\u3092\u89E3\u9664\u3057\u307E\u3057\u305F");
    } catch (e2) {
      showNotification("\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
    }
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "flex flex-col h-full bg-white",
      onClick: () => {
        setOpenChatMenuId(null);
        setOpenFriendMenuId(null);
      },
      children: [
        /* @__PURE__ */ jsxs("div", { className: "p-4 border-b flex justify-between items-center bg-white shrink-0", children: [
          /* @__PURE__ */ jsx("h1", { className: "text-xl font-bold", children: "\u30DB\u30FC\u30E0" }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-4 items-center", children: [
            /* @__PURE__ */ jsx(Store, { className: "w-6 h-6 cursor-pointer text-orange-500", onClick: () => setView("sticker-store") }),
            /* @__PURE__ */ jsx(Gift, { className: "w-6 h-6 cursor-pointer text-pink-500", onClick: () => setView("birthday-cards") }),
            /* @__PURE__ */ jsx(Users, { className: "w-6 h-6 cursor-pointer", onClick: () => setView("group-create") }),
            /* @__PURE__ */ jsx(Search, { className: "w-6 h-6 cursor-pointer", onClick: () => setSearchModalOpen(true) }),
            /* @__PURE__ */ jsx(UserPlus, { className: "w-6 h-6 cursor-pointer", onClick: () => setView("qr") }),
            /* @__PURE__ */ jsx(Settings, { className: "w-6 h-6 cursor-pointer", onClick: () => setView("profile") })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex border-b", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              className: `flex-1 py-3 text-sm font-bold ${tab === "friends" ? "border-b-2 border-black" : "text-gray-400"}`,
              onClick: () => setTab("friends"),
              children: "\u53CB\u3060\u3061"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              className: `flex-1 py-3 text-sm font-bold ${tab === "hidden" ? "border-b-2 border-black" : "text-gray-400"}`,
              onClick: () => setTab("hidden"),
              children: "\u975E\u8868\u793A"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              className: `flex-1 py-3 text-sm font-bold ${tab === "chats" ? "border-b-2 border-black" : "text-gray-400"}`,
              onClick: () => setTab("chats"),
              children: "\u30C8\u30FC\u30AF"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto scrollbar-hide", children: [
          /* @__PURE__ */ jsxs("div", { className: "p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer border-b", onClick: () => setView("profile"), children: [
            /* @__PURE__ */ jsxs("div", { className: "relative", children: [
              /* @__PURE__ */ jsx("img", { src: profile?.avatar, className: "w-16 h-16 rounded-2xl object-cover border" }, profile?.avatar),
              isTodayBirthday(profile?.birthday) && /* @__PURE__ */ jsx("span", { className: "absolute -top-1 -right-1 text-base", children: "\u{1F382}" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
              /* @__PURE__ */ jsx("div", { className: "font-bold text-lg", children: profile?.name }),
              /* @__PURE__ */ jsxs("div", { className: "text-xs text-gray-400 font-mono", children: [
                "ID: ",
                profile?.id
              ] })
            ] })
          ] }),
          (tab === "friends" || tab === "hidden") && /* @__PURE__ */ jsx("div", { className: "px-4 pt-4", children: /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 border rounded-3xl p-4 flex items-center justify-between", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { className: "text-[10px] font-bold text-gray-400 uppercase tracking-widest", children: "\u53CB\u3060\u3061\u306E\u53CB\u3060\u3061" }),
              /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-500 font-bold mt-1", children: "\u3042\u306A\u305F\u306E\u53CB\u3060\u3061\u7D4C\u7531\u3067\u3064\u306A\u304C\u308B\u4EBA\u6570\uFF08\u91CD\u8907\u306A\u3057\uFF09" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "text-2xl font-black text-gray-800", children: friendsOfFriendsCount })
          ] }) }),
          tab === "friends" && /* @__PURE__ */ jsx("div", { className: "pt-2", children: visibleFriendsList.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-center py-10 text-gray-400 text-sm", children: "\u53CB\u3060\u3061\u304C\u3044\u307E\u305B\u3093" }) : visibleFriendsList.map((friend) => /* @__PURE__ */ jsxs(
            "div",
            {
              className: "p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer relative",
              onClick: () => setSelectedFriend(friend),
              children: [
                /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                  /* @__PURE__ */ jsx("img", { src: friend.avatar, className: "w-12 h-12 rounded-xl object-cover border" }, friend.avatar),
                  isTodayBirthday(friend.birthday) && /* @__PURE__ */ jsx("span", { className: "absolute -top-1 -right-1 text-xs", children: "\u{1F382}" })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                  /* @__PURE__ */ jsx("div", { className: "font-bold text-sm truncate", children: friend.name }),
                  /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-400 truncate", children: friend.status }),
                  /* @__PURE__ */ jsxs("div", { className: "text-[10px] text-gray-400 font-bold mt-0.5", children: [
                    "\u5171\u901A ",
                    getMutualCount(friend),
                    " \u30FB \u53CB\u3060\u3061\u306E\u53CB\u3060\u3061 ",
                    getFofCandidateCount(friend)
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "relative ml-2", onClick: (e) => e.stopPropagation(), children: [
                  /* @__PURE__ */ jsx("button", { onClick: () => setOpenFriendMenuId(openFriendMenuId === friend.uid ? null : friend.uid), className: "p-2 hover:bg-gray-100 rounded-full text-gray-400", children: /* @__PURE__ */ jsx(MoreVertical, { className: "w-4 h-4" }) }),
                  openFriendMenuId === friend.uid && /* @__PURE__ */ jsx("div", { className: "absolute right-0 top-8 bg-white shadow-xl border rounded-xl overflow-hidden z-20 min-w-[140px] animate-in fade-in zoom-in-95 duration-100", children: /* @__PURE__ */ jsxs("button", { onClick: (e) => handleHideFriend(e, friend.uid), className: "w-full text-left px-4 py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx(EyeOff, { className: "w-3 h-3" }),
                    " \u975E\u8868\u793A"
                  ] }) })
                ] })
              ]
            },
            friend.uid
          )) }),
          tab === "hidden" && /* @__PURE__ */ jsx("div", { className: "pt-2", children: hiddenFriendsList.length === 0 ? /* @__PURE__ */ jsx("div", { className: "text-center py-10 text-gray-400 text-sm", children: "\u975E\u8868\u793A\u306E\u53CB\u3060\u3061\u306F\u3042\u308A\u307E\u305B\u3093" }) : hiddenFriendsList.map((friend) => /* @__PURE__ */ jsxs(
            "div",
            {
              className: "p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer relative",
              onClick: () => setSelectedFriend(friend),
              children: [
                /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                  /* @__PURE__ */ jsx("img", { src: friend.avatar, className: "w-12 h-12 rounded-xl object-cover border" }, friend.avatar),
                  isTodayBirthday(friend.birthday) && /* @__PURE__ */ jsx("span", { className: "absolute -top-1 -right-1 text-xs", children: "\u{1F382}" })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                  /* @__PURE__ */ jsx("div", { className: "font-bold text-sm truncate", children: friend.name }),
                  /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-400 truncate", children: friend.status })
                ] }),
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    onClick: (e) => handleUnhideFriend(e, friend.uid),
                    className: "px-3 py-2 bg-white border rounded-2xl text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 shadow-sm",
                    children: [
                      /* @__PURE__ */ jsx(Eye, { className: "w-4 h-4" }),
                      "\u8868\u793A"
                    ]
                  }
                )
              ]
            },
            friend.uid
          )) }),
          tab === "chats" && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("div", { className: "px-4 pt-4", children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 border rounded-3xl p-4 flex items-center justify-between", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("div", { className: "text-[10px] font-bold text-gray-400 uppercase tracking-widest", children: "\u30C8\u30FC\u30AF\u53CB\u3060\u3061" }),
                  /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-500 font-bold mt-1", children: "1\u5BFE1\u30C8\u30FC\u30AF\u306E\u4EBA\u6570" })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "text-2xl font-black text-gray-800", children: talkFriendCount })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "bg-gray-50 border rounded-3xl p-4 flex items-center justify-between", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("div", { className: "text-[10px] font-bold text-gray-400 uppercase tracking-widest", children: "\u30B0\u30EB\u30FC\u30D7" }),
                  /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-500 font-bold mt-1", children: "\u53C2\u52A0\u4E2D\u306E\u6570" })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "text-2xl font-black text-gray-800", children: groupChatCount })
              ] })
            ] }) }),
            chats.filter((chat) => !profile?.hiddenChats?.includes(chat.id)).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)).map((chat) => {
              let name = chat.name, icon = chat.icon, partnerData = null;
              if (!chat.isGroup) {
                partnerData = allUsers.find((u) => u.uid === chat.participants.find((p) => p !== user.uid));
                if (partnerData) {
                  name = partnerData.name;
                  icon = partnerData.avatar;
                }
              }
              const unreadCountRaw = Number(chat.unreadCounts?.[user.uid] || 0) || 0;
              const unreadCount = chat.lastMessage?.senderId && chat.lastMessage.senderId !== user.uid ? unreadCountRaw : 0;
              return /* @__PURE__ */ jsxs(
                "div",
                {
                  className: "p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer relative group",
                  onClick: () => {
                    setActiveChatId(chat.id);
                    setView("chatroom");
                  },
                  children: [
                    /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                      /* @__PURE__ */ jsx("img", { src: icon, className: "w-12 h-12 rounded-xl object-cover border" }, icon),
                      !chat.isGroup && partnerData && isTodayBirthday(partnerData.birthday) && /* @__PURE__ */ jsx("span", { className: "absolute -top-1 -right-1 text-xs", children: "\u{1F382}" })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                      /* @__PURE__ */ jsxs("div", { className: "font-bold text-sm truncate", children: [
                        name,
                        " ",
                        chat.isGroup ? `(${chat.participants.length})` : ""
                      ] }),
                      /* @__PURE__ */ jsx("div", { className: `text-xs truncate ${unreadCount > 0 ? "font-bold text-black" : "text-gray-400"}`, children: chat.lastMessage?.content })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-end gap-1", children: [
                      /* @__PURE__ */ jsx("div", { className: "text-[10px] text-gray-300", children: formatTime(chat.updatedAt) }),
                      unreadCount > 0 && /* @__PURE__ */ jsx("div", { className: "bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center flex items-center justify-center h-5 border-2 border-white shadow-sm mb-1", children: unreadCount > 99 ? "99+" : unreadCount })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "relative ml-2", onClick: (e) => e.stopPropagation(), children: [
                      /* @__PURE__ */ jsx("button", { onClick: () => setOpenChatMenuId(openChatMenuId === chat.id ? null : chat.id), className: "p-2 hover:bg-gray-100 rounded-full text-gray-400", children: /* @__PURE__ */ jsx(MoreVertical, { className: "w-4 h-4" }) }),
                      openChatMenuId === chat.id && /* @__PURE__ */ jsxs("div", { className: "absolute right-0 top-8 bg-white shadow-xl border rounded-xl overflow-hidden z-20 min-w-[120px] animate-in fade-in zoom-in-95 duration-100", children: [
                        /* @__PURE__ */ jsxs("button", { onClick: (e) => handleHideChat(e, chat.id), className: "w-full text-left px-4 py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-2", children: [
                          /* @__PURE__ */ jsx(EyeOff, { className: "w-3 h-3" }),
                          " \u975E\u8868\u793A"
                        ] }),
                        /* @__PURE__ */ jsxs("button", { onClick: (e) => handleDeleteChat(e, chat.id), className: "w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 border-t flex items-center gap-2", children: [
                          /* @__PURE__ */ jsx(Trash2, { className: "w-3 h-3" }),
                          " \u524A\u9664"
                        ] })
                      ] })
                    ] })
                  ]
                },
                chat.id
              );
            })
          ] })
        ] }),
        selectedFriend && /* @__PURE__ */ jsx(
          FriendProfileModal,
          {
            friend: selectedFriend,
            onClose: () => setSelectedFriend(null),
            onStartChat: startChatWithUser,
            onTransfer: () => {
              setCoinModalTarget(selectedFriend);
              setSelectedFriend(null);
            },
            myUid: user.uid,
            myProfile: profile,
            allUsers,
            showNotification
          }
        ),
        coinModalTarget && /* @__PURE__ */ jsx(
          CoinTransferModal,
          {
            onClose: () => setCoinModalTarget(null),
            myWallet: profile.wallet,
            myUid: user.uid,
            targetUid: coinModalTarget.uid,
            targetName: coinModalTarget.name,
            showNotification
          }
        )
      ]
    }
  );
};
function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("auth");
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
  const [activeCall, setActiveCall] = useState(null);
  const [userEffects, setUserEffects] = useState([]);
  const [activeEffect, setActiveEffect] = useState("Normal");
  const [currentChatBackground, setCurrentChatBackground] = useState(null);
  const processedMsgIds = useRef(/* @__PURE__ */ new Set());
  const toggleMuteChat = (chatId) => {
    setMutedChats((prev) => {
      const next = prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId];
      localStorage.setItem("mutedChats", JSON.stringify(next));
      return next;
    });
  };
  const handleLogout = useCallback(async (nextProfile = null) => {
    try {
      const uid = user?.uid;
      const profileToSave = nextProfile || profile;
      if (uid && profileToSave) {
        const persistFields = {
          avatar: profileToSave.avatar || "",
          cover: profileToSave.cover || "",
          birthday: profileToSave.birthday || "",
          status: profileToSave.status || ""
        };
        await setDoc(doc(db, "artifacts", appId, "public", "data", "users", uid), persistFields, { merge: true });
        writeCachedProfile(uid, { ...profileToSave, ...persistFields });
      }
    } catch (e) {
      console.warn("Profile save before logout failed:", e);
    } finally {
      await auth.signOut();
    }
  }, [user?.uid, profile]);
  useEffect(() => {
    const unlockAudio = () => {
      initAudioContext();
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
    window.addEventListener("click", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);
    setPersistence(auth, browserLocalPersistence).catch((e) => {
      console.warn("Failed to set auth persistence:", e);
    });
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const cachedProfile = readCachedProfile(u.uid);
        const fallbackProfile = {
          uid: u.uid,
          name: u.displayName || `User_${u.uid.slice(0, 4)}`,
          id: u.displayName ? u.displayName : `user_${u.uid.slice(0, 6)}`,
          status: "\u3088\u308D\u3057\u304F\u304A\u9858\u3044\u3057\u307E\u3059\uFF01",
          birthday: "",
          avatar: u.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + u.uid,
          cover: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80",
          friends: [],
          hiddenFriends: [],
          hiddenChats: [],
          wallet: 1e3,
          isBanned: false
        };
        setUser(u);
        if (cachedProfile) {
          setProfile({ ...fallbackProfile, ...cachedProfile });
        }
        // Keep user logged-in view even if Firestore profile fetch fails.
        setView("home");
        try {
          const userRef = doc(db, "artifacts", appId, "public", "data", "users", u.uid);
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            const merged = { ...fallbackProfile, ...docSnap.data() };
            setProfile(merged);
            writeCachedProfile(u.uid, merged);
          } else {
            const profileToCreate = cachedProfile ? { ...fallbackProfile, ...cachedProfile } : fallbackProfile;
            await setDoc(userRef, profileToCreate, { merge: true });
            setProfile(profileToCreate);
            writeCachedProfile(u.uid, profileToCreate);
          }
        } catch (e) {
          console.error("Profile bootstrap failed after login:", e);
          const backup = cachedProfile ? { ...fallbackProfile, ...cachedProfile } : fallbackProfile;
          setProfile(backup);
        }
      } else {
        setUser(null);
        setProfile(null);
        setView("auth");
      }
    });
    return () => {
      unsubscribe();
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);
  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3e3);
  };
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showNotification("ID\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F");
  };
  useEffect(() => {
    if (!user) return;
    const unsubProfile = onSnapshot(doc(db, "artifacts", appId, "public", "data", "users", user.uid), (doc2) => {
      if (doc2.exists()) {
        const next = doc2.data();
        setProfile(next);
        writeCachedProfile(user.uid, next);
      }
    });
    const unsubUsers = onSnapshot(query(collection(db, "artifacts", appId, "public", "data", "users")), (snap) => {
      setAllUsers(snap.docs.map((d) => d.data()));
    });
    const unsubEffects = onSnapshot(query(collection(db, "artifacts", appId, "public", "data", "users", user.uid, "effects"), orderBy("createdAt", "desc")), (snap) => {
      setUserEffects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubChats = onSnapshot(query(collection(db, "artifacts", appId, "public", "data", "chats"), where("participants", "array-contains", user.uid)), (snap) => {
      const chatList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      snap.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          const data = change.doc.data();
          const lastMsg = data.lastMessage;
          if (lastMsg && lastMsg.senderId !== user.uid && lastMsg.createdAt) {
            const now = Date.now();
            let msgTime = 0;
            if (lastMsg.createdAt?.seconds) {
              msgTime = lastMsg.createdAt.seconds * 1e3;
            } else if (lastMsg.createdAt?.toMillis) {
              msgTime = lastMsg.createdAt.toMillis();
            } else if (lastMsg.createdAt instanceof Date) {
              msgTime = lastMsg.createdAt.getTime();
            } else {
              msgTime = now;
            }
            const msgUniqueKey = `${change.doc.id}_${msgTime}`;
            if (now - msgTime < 1e4 && !processedMsgIds.current.has(msgUniqueKey)) {
              playNotificationSound();
              processedMsgIds.current.add(msgUniqueKey);
            }
          }
        }
      });
      setChats(chatList);
      setActiveCall((prev) => {
        const incoming = chatList.find((c) => c.callStatus?.status === "ringing" && c.callStatus.callerId !== user.uid);
        if (incoming && (!prev || prev.chatId !== incoming.id || prev?.callData?.sessionId !== incoming.callStatus?.sessionId)) {
          return {
            chatId: incoming.id,
            callData: incoming.callStatus,
            isVideo: incoming.callStatus?.callType !== "audio",
            isGroupCall: false,
            isCaller: false,
            phase: "incoming"
          };
        }
        if (!prev) return prev;
        if (prev.isGroupCall) return prev;
        const currentChat = chatList.find((c) => c.id === prev.chatId);
        const status = currentChat?.callStatus?.status;
        if (!currentChat || !currentChat.callStatus) return null;
        if (status === "accepted") {
          return { ...prev, phase: "inCall", callData: currentChat.callStatus, isVideo: currentChat.callStatus?.callType !== "audio", isCaller: currentChat.callStatus?.callerId === user.uid };
        }
        if (status === "ringing") {
          const incomingCall = currentChat.callStatus?.callerId !== user.uid;
          return { ...prev, phase: incomingCall ? "incoming" : "dialing", callData: currentChat.callStatus, isVideo: currentChat.callStatus?.callType !== "audio", isCaller: !incomingCall };
        }
        return null;
      });
    });
    const unsubPosts = onSnapshot(query(collection(db, "artifacts", appId, "public", "data", "posts"), orderBy("createdAt", "desc"), limit(50)), (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubProfile();
      unsubUsers();
      unsubChats();
      unsubPosts();
      unsubEffects();
    };
  }, [user]);
  const addFriendById = async (targetId) => {
    if (!targetId) return;
    const targetUser = allUsers.find((u) => u.id === targetId || u.uid === targetId);
    if (targetUser && targetUser.uid !== user.uid) {
      if ((profile.friends || []).includes(targetUser.uid)) {
        showNotification("\u65E2\u306B\u53CB\u3060\u3061\u3067\u3059\u3002");
        return;
      }
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "users", user.uid), { friends: arrayUnion(targetUser.uid) });
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "users", targetUser.uid), { friends: arrayUnion(user.uid) });
      showNotification(`${targetUser.name}\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F`);
      setSearchModalOpen(false);
    } else {
      showNotification("\u30E6\u30FC\u30B6\u30FC\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
    }
  };
  const startChatWithUser = async (targetUid) => {
    const existingChat = chats.find(
      (c) => !c.isGroup && c.participants.includes(targetUid) && c.participants.includes(user.uid)
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
        lastMessage: { content: "\u30C1\u30E3\u30C3\u30C8\u3092\u958B\u59CB\u3057\u307E\u3057\u305F", senderId: user.uid, readBy: [user.uid] }
      };
      try {
        const ref = await addDoc(collection(db, "artifacts", appId, "public", "data", "chats"), newChat);
        setActiveChatId(ref.id);
        setView("chatroom");
      } catch (e) {
        showNotification("\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F");
      }
    }
  };
  const cleanupCallSignaling = async (chatId, targetSessionId = null) => {
    try {
      const signalingRef = doc(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "session");
      const candidatesCol = collection(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "candidates", "list");
      try {
        if (!targetSessionId) {
          await deleteDoc(signalingRef);
        } else {
          const signalingSnap = await getDoc(signalingRef).catch(() => null);
          const signalingData = signalingSnap?.data?.();
          if (signalingData?.sessionId === targetSessionId) {
            await deleteDoc(signalingRef);
          }
        }
      } catch {
      }
      const candidatesQuery = targetSessionId ? query(candidatesCol, where("sessionId", "==", targetSessionId)) : candidatesCol;
      const snap = await getDocs(candidatesQuery).catch(() => null);
      if (!snap) return;
      const BATCH_LIMIT = 450;
      let batch = writeBatch(db);
      let i = 0;
      for (const d of snap.docs) {
        batch.delete(d.ref);
        i++;
        if (i % BATCH_LIMIT === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }
      await batch.commit();
    } catch (e) {
      console.warn("cleanupCallSignaling failed (non-fatal):", e);
    }
  };
  const startVideoCall = async (chatId, isVideo = true, isJoin = false, joinCallerId, joinSessionId = "") => {
    initAudioContext();
    const chat = chats.find((c) => c.id === chatId);
    const isGroup = chat?.isGroup;
    if (isJoin) {
      let latestCallStatus = chat?.callStatus || null;
      try {
        const latestChatSnap = await getDoc(doc(db, "artifacts", appId, "public", "data", "chats", chatId));
        if (latestChatSnap.exists()) {
          latestCallStatus = latestChatSnap.data()?.callStatus || latestCallStatus;
        }
      } catch (e) {
        console.warn("Failed to load latest callStatus before join:", e);
      }
      const latestSessionId = latestCallStatus?.sessionId || "";
      if (joinSessionId && latestSessionId && joinSessionId !== latestSessionId) {
        showNotification("\u53E4\u3044\u901A\u8A71\u62DB\u5F85\u306E\u305F\u3081\u3001\u6700\u65B0\u306E\u901A\u8A71\u30BB\u30C3\u30B7\u30E7\u30F3\u306B\u53C2\u52A0\u3057\u307E\u3059");
      }
      let sessionId = latestSessionId || joinSessionId || "";
      if (!sessionId) {
        try {
          const signalingRef = doc(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "session");
          const signalingSnap = await getDoc(signalingRef);
          sessionId = signalingSnap.data()?.sessionId || "";
        } catch {
        }
      }
      if (!sessionId) {
        showNotification("\u53C2\u52A0\u3067\u304D\u308B\u901A\u8A71\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002\u901A\u8A71\u4E2D\u306B\u3082\u3046\u4E00\u5EA6\u53C2\u52A0\u3057\u3066\u304F\u3060\u3055\u3044");
        return;
      }
      const callerId = latestCallStatus?.callerId || joinCallerId || "";
      const callType = latestCallStatus?.callType || (isVideo ? "video" : "audio");
      setActiveCall({
        chatId,
        callData: { callerId, sessionId, callType, status: "accepted", isGroupCall: !!isGroup },
        isVideo,
        isGroupCall: !!isGroup,
        isCaller: !!callerId && callerId === user.uid,
        phase: "inCall"
      });
      return;
    }
    if (isGroup) {
      await cleanupCallSignaling(chatId);
      try {
        const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const groupCallData = {
          status: "accepted",
          callerId: user.uid,
          callType: isVideo ? "video" : "audio",
          sessionId,
          timestamp: Date.now(),
          isGroupCall: true
        };
        await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", chatId), { callStatus: groupCallData });
        await addDoc(collection(db, "artifacts", appId, "public", "data", "chats", chatId, "messages"), {
          senderId: user.uid,
          content: "\u901A\u8A71\u3092\u958B\u59CB\u3057\u307E\u3057\u305F",
          type: "call_invite",
          callType: isVideo ? "video" : "audio",
          sessionId,
          createdAt: serverTimestamp(),
          readBy: [user.uid]
        });
        setActiveCall({ chatId, callData: groupCallData, isVideo, isGroupCall: true, isCaller: true, phase: "inCall" });
      } catch (e) {
        showNotification("\u958B\u59CB\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      }
    } else {
      try {
        const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await cleanupCallSignaling(chatId);
        await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", chatId), {
          callStatus: {
            status: "ringing",
            callerId: user.uid,
            callType: isVideo ? "video" : "audio",
            sessionId,
            timestamp: Date.now()
          }
        });
        setActiveCall({
          chatId,
          callData: { status: "ringing", callerId: user.uid, callType: isVideo ? "video" : "audio", sessionId },
          isVideo,
          isGroupCall: false,
          isCaller: true,
          phase: "dialing"
        });
      } catch (e) {
        console.error(e);
        showNotification("\u767A\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      }
    }
  };
  const endCall = async (chatId, callData, { clearStatus = true, cleanupSignaling = true } = {}) => {
    try {
      if (clearStatus) {
        await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", chatId), { callStatus: deleteField() });
      }
      if (cleanupSignaling) {
        await cleanupCallSignaling(chatId, callData?.sessionId || null);
      }
    } catch (e) {
      console.error("Failed to end call:", e);
    } finally {
      setActiveCall(null);
    }
  };
  const acceptIncomingCall = async () => {
    if (!activeCall) return;
    initAudioContext();
    try {
      const callData = activeCallChat?.callStatus || activeCall.callData || {};
      const nextCallData = {
        ...callData,
        status: "accepted",
        callerId: callData.callerId,
        callType: callData.callType || (activeCall?.isVideo ? "video" : "audio"),
        sessionId: callData.sessionId || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        acceptedBy: user.uid,
        acceptedAt: Date.now()
      };
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeCall.chatId), { callStatus: nextCallData });
      setActiveCall((prev) => prev ? { ...prev, phase: "inCall", callData: nextCallData, isCaller: false } : prev);
    } catch (e) {
      console.error(e);
      showNotification("\u5FDC\u7B54\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    }
  };
  useEffect(() => {
    if (!activeCall || !chats.length) return;
    const callChat = chats.find((c) => c.id === activeCall.chatId);
    if (callChat && callChat.backgroundImage) {
      setCurrentChatBackground(callChat.backgroundImage);
    } else {
      setCurrentChatBackground(null);
    }
  }, [activeCall, chats]);
  const activeCallChat = activeCall ? chats.find((c) => c.id === activeCall.chatId) : null;
  const syncedCallData = activeCallChat?.callStatus || activeCall?.callData || null;
  const effectiveCallPhase = useMemo(() => {
    if (!activeCall) return null;
    if (activeCall.isGroupCall) return activeCall.phase;
    const callStatus = syncedCallData?.status;
    if (!callStatus) return activeCall.phase || null;
    if (callStatus === "accepted") return "inCall";
    if (callStatus === "ringing") {
      return syncedCallData?.callerId === user.uid ? "dialing" : "incoming";
    }
    return activeCall.phase || null;
  }, [activeCall, syncedCallData, user?.uid]);
  useEffect(() => {
    if (!activeCall || effectiveCallPhase !== "dialing") return;
    const timeout = setTimeout(() => {
      const latestChat = chats.find((c) => c.id === activeCall.chatId);
      const latestCall = latestChat?.callStatus || syncedCallData;
      if (!latestCall || latestCall.status !== "ringing") return;
      showNotification("\u5FDC\u7B54\u304C\u306A\u304B\u3063\u305F\u305F\u3081\u901A\u8A71\u3092\u7D42\u4E86\u3057\u307E\u3057\u305F");
      endCall(activeCall.chatId, latestCall);
    }, 45e3);
    return () => clearTimeout(timeout);
  }, [activeCall, effectiveCallPhase, chats, syncedCallData]);
  const isVideoFullscreen = !!activeCall;
  return /* @__PURE__ */ jsx("div", { className: isVideoFullscreen ? "w-full h-[100dvh] bg-[#d7dbe1] overflow-hidden" : "w-full min-h-[100dvh] bg-[#d7dbe1] overflow-hidden flex justify-center", children: /* @__PURE__ */ jsxs("div", { className: isVideoFullscreen ? "w-full h-[100dvh] bg-[#f3f4f6] flex flex-col relative overflow-hidden" : "w-full max-w-[430px] h-[100dvh] bg-[#f3f4f6] flex flex-col relative overflow-hidden shadow-2xl", children: [
    notification && /* @__PURE__ */ jsx("div", { className: "fixed top-10 left-1/2 -translate-x-1/2 z-[300] bg-black/85 text-white px-6 py-2 rounded-full text-xs font-bold shadow-2xl animate-bounce", children: notification }),
    !user ? /* @__PURE__ */ jsx(AuthView, { onLogin: setUser, showNotification }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      activeCall ? effectiveCallPhase === "incoming" ? /* @__PURE__ */ jsx(
        IncomingCallOverlay,
        {
          callData: syncedCallData || activeCall.callData,
          allUsers,
          onDecline: () => endCall(activeCall.chatId, syncedCallData || activeCall.callData),
          onAccept: acceptIncomingCall
        }
      ) : effectiveCallPhase === "dialing" ? /* @__PURE__ */ jsx(
        OutgoingCallOverlay,
        {
          callData: syncedCallData || activeCall.callData,
          allUsers,
          onCancel: () => endCall(activeCall.chatId, syncedCallData || activeCall.callData)
        }
      ) : /* @__PURE__ */ jsxs("div", { className: "relative w-full h-full", children: [
        /* @__PURE__ */ jsx(
          VideoCallView,
          {
            user,
            chatId: activeCall.chatId,
            callData: syncedCallData || activeCall.callData,
            isCaller: activeCall.isCaller,
            effects: userEffects,
            isVideoEnabled: activeCall.isVideo,
            activeEffect,
            backgroundUrl: currentChatBackground,
            onEndCall: () => endCall(
              activeCall.chatId,
              syncedCallData || activeCall.callData,
              {
                clearStatus: !activeCall.isGroupCall || !!activeCall.isCaller,
                cleanupSignaling: !activeCall.isGroupCall || !!activeCall.isCaller
              }
            )
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "absolute top-16 left-0 right-0 px-4 flex flex-wrap items-center gap-2 z-[1001] bg-black/30 backdrop-blur-md rounded-2xl py-2", children: [
          /* @__PURE__ */ jsx("button", { onClick: () => setActiveEffect("Normal"), className: `p-2 rounded-xl text-xs font-bold whitespace-nowrap ${activeEffect === "Normal" ? "bg-white text-black" : "bg-black/50 text-white"}`, children: "Normal" }),
          userEffects.map((ef) => /* @__PURE__ */ jsxs("button", { onClick: () => setActiveEffect(ef.name), className: `p-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1 ${activeEffect === ef.name ? "bg-white text-black" : "bg-black/50 text-white"}`, children: [
            /* @__PURE__ */ jsx(Sparkles, { className: "w-3 h-3" }),
            " ",
            ef.name
          ] }, ef.id))
        ] })
      ] }) : /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-hidden relative", children: [
        view === "home" && /* @__PURE__ */ jsx(HomeView, { user, profile, allUsers, chats, setView, setActiveChatId, setSearchModalOpen, startChatWithUser, showNotification }),
        view === "voom" && /* @__PURE__ */ jsx(VoomView, { user, allUsers, profile, posts, showNotification, db, appId }),
        view === "chatroom" && /* @__PURE__ */ jsx(ChatRoomView, { user, profile, allUsers, chats, activeChatId, setActiveChatId, setView, db, appId, mutedChats, toggleMuteChat, showNotification, addFriendById, startVideoCall }),
        view === "profile" && /* @__PURE__ */ jsx(ProfileEditView, { user, profile, setView, showNotification, copyToClipboard, onLogout: handleLogout }),
        view === "qr" && /* @__PURE__ */ jsx(QRScannerView, { user, setView, addFriendById }),
        view === "group-create" && /* @__PURE__ */ jsx(GroupCreateView, { user, profile, allUsers, chats, setView, showNotification }),
        view === "birthday-cards" && /* @__PURE__ */ jsx(BirthdayCardBox, { user, setView }),
        view === "sticker-create" && /* @__PURE__ */ jsx(StickerEditor, { user, profile, onClose: () => setView("sticker-store"), showNotification }),
        view === "sticker-store" && /* @__PURE__ */ jsx(StickerStoreView, { user, setView, showNotification, profile, allUsers })
      ] }),
      searchModalOpen && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/60", children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-sm rounded-[32px] p-8", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-xl font-bold mb-6", children: "\u691C\u7D22" }),
        /* @__PURE__ */ jsx("input", { className: "w-full bg-gray-50 rounded-2xl py-4 px-6 mb-6 outline-none", placeholder: "ID\u3092\u5165\u529B", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value) }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-4", children: [
          /* @__PURE__ */ jsx("button", { className: "flex-1 py-4 text-gray-600 font-bold", onClick: () => setSearchModalOpen(false), children: "\u9589\u3058\u308B" }),
          /* @__PURE__ */ jsx("button", { className: "flex-1 py-4 bg-green-500 text-white rounded-2xl font-bold", onClick: () => addFriendById(searchQuery), children: "\u8FFD\u52A0" })
        ] })
      ] }) }),
      user && !activeCall && ["home", "voom"].includes(view) && /* @__PURE__ */ jsxs("div", { className: "h-20 bg-white border-t flex items-center justify-around z-50 pb-4 shrink-0", children: [
        /* @__PURE__ */ jsxs("div", { className: `flex flex-col items-center gap-1 cursor-pointer transition-all ${view === "home" ? "text-green-500" : "text-gray-400"}`, onClick: () => setView("home"), children: [
          /* @__PURE__ */ jsx(Home, { className: "w-6 h-6" }),
          /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold", children: "\u30DB\u30FC\u30E0" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: `flex flex-col items-center gap-1 cursor-pointer transition-all ${view === "voom" ? "text-green-500" : "text-gray-400"}`, onClick: () => setView("voom"), children: [
          /* @__PURE__ */ jsx(LayoutGrid, { className: "w-6 h-6" }),
          /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold", children: "VOOM" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("style", { children: `.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }` })
  ] }) });
}
var App_13_default = App;
export {
  App_13_default as default
};




