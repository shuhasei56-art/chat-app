// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
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
  signInWithRedirect
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  collectionGroup,
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
} from 'firebase/firestore';
import {
  Search, UserPlus, Image as ImageIcon, Send, X, ChevronLeft, Settings, Home, LayoutGrid, Trash2,
  Plus, Video, Heart, MessageCircle, Camera as CameraIcon, Maximize, Upload, Copy, Contact, Play,
  Gift, Cake, Users, Check, Loader2, Bell, BellOff, Mic, Square, Ban, Edit2, Palette, PhoneOff,
  LogOut, RefreshCcw, ArrowUpCircle, Reply, Smile, StopCircle, PhoneCall, Phone, FileText,
  Paperclip, Download, UserMinus, AtSign, Store, PenTool, Eraser, Type, CheckCircle, XCircle,
  Lock, ShoppingBag, Coins, Scissors, Star, Disc, ShieldAlert, Music, Volume2, ShoppingCart,
  User, KeyRound, MicOff, VideoOff, Wand2, Sparkles, Zap, MoreVertical, EyeOff, Eye, AlertCircle
} from 'lucide-react';

// --- 1. Firebase Configuration ---
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
const JSQR_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
const CHUNK_SIZE = 716799;
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const rtcConfig = {
  iceServers: [
    { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
  ],
};

// --- 2. Utility Functions & Globals ---
const formatTime = (timestamp: any) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (timestamp: any) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString();
};

const formatDateTime = (timestamp: any) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const isTodayBirthday = (birthdayString: string | undefined) => {
  if (!birthdayString) return false;
  const today = new Date();
  const [y, m, d] = birthdayString.split('-').map(Number);
  return (today.getMonth() + 1) === m && today.getDate() === d;
};

// Audio Notification Logic
let audioCtx: AudioContext | null = null;

const initAudioContext = () => {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if(AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(e => console.error("Audio resume failed:", e));
    }
};

const playNotificationSound = () => {
  try {
    initAudioContext();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

// Media Processing Utilities
const processFileBeforeUpload = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image') || file.type === 'image/gif') {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event: any) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1600; 
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob.size > file.size ? file : new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            } else { resolve(file); }
            }, 'image/jpeg', 0.8);
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

const handleFileUpload = async (e: any, callback: any) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  const originalFile = files[0];
  
  e.target.value = '';
  let file = originalFile;
  if (originalFile.type.startsWith('image') && originalFile.type !== 'image/gif') {
    file = await processFileBeforeUpload(originalFile);
  }
  let type = 'file';
  if (file.type.startsWith('image')) type = 'image';
  else if (file.type.startsWith('video')) type = 'video';
  else if (file.type.startsWith('audio')) type = 'audio';

  if (file.size > 1024 * 1024 || type === 'video' || type === 'file') {
    const objectUrl = URL.createObjectURL(file);
    callback(objectUrl, type, file);
  } else {
    const reader = new FileReader();
    reader.onload = (event: any) => callback(event.target.result, type, file);
    reader.readAsDataURL(file);
  }
};

const handleCompressedUpload = (e: any, callback: any) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  const file = files[0];

  if (!file.type.startsWith('image')) return;
  const reader = new FileReader();
  reader.onload = (event: any) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;
      if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
      else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.7));
      }
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

const generateThumbnail = (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!file) { resolve(null); return; }
    const MAX_SIZE = 320; 
    if (file.type.startsWith('image')) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.5));
                } else resolve(null);
            };
            img.onerror = () => resolve(null);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    } else if (file.type.startsWith('video')) {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = "anonymous";
        video.preload = "metadata";
        const capture = () => {
            try {
                const canvas = document.createElement('canvas');
                let width = video.videoWidth;
                let height = video.videoHeight;
                if (!width || !height) { resolve(null); return; }
                if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                    video.src = "";
                    video.load();
                    resolve(dataUrl);
                } else resolve(null);
            } catch(e) { resolve(null); }
        };
        video.onloadeddata = () => { video.currentTime = 0.5; };
        video.onseeked = () => { capture(); };
        video.onerror = () => resolve(null);
        setTimeout(() => resolve(null), 2000);
        try { video.src = URL.createObjectURL(file); } catch(e) { resolve(null); }
    } else { resolve(null); }
  });
};

// --- 3. Component Definitions (Helper & Views) ---

const AuthView = ({ onLogin, showNotification }: any) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      const googleProvider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
        uid: user.uid,
        name: user.displayName || "No Name",
        avatar: user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + user.uid,
        id: user.uid,
        friends: [], hiddenFriends: [], hiddenChats: [], wallet: 1000, isBanned: false,
        status: "よろしくお願いします！",
        cover: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80"
      }, { merge: true });
      
    } catch (error: any) {
      console.error("Login Error:", error);
      showNotification("エラーが発生しました: " + error.message);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try { await signInAnonymously(auth); showNotification("ゲストログインしました"); }
    catch (e) { showNotification("ゲストログイン失敗"); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!userId || !password) return showNotification("IDとパスワードを入力してください");
    const email = `${userId}@voom-persistent.app`;
    setLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification("ログインしました");
      } else {
        if (!displayName) { showNotification("ニックネームを入力してください"); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "artifacts", appId, "public", "data", "users", cred.user.uid), {
          uid: cred.user.uid, name: displayName || userId, id: userId, status: "よろしくお願いします！",
          birthday: "", avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cred.user.uid}`,
          cover: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80",
          friends: [], hiddenFriends: [], hiddenChats: [], wallet: 1000, isBanned: false,
        });
        showNotification("アカウント作成完了");
      }
    } catch (e: any) { showNotification("エラー: " + e.message); } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-indigo-50 to-purple-50 p-4 overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center w-full">
        <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-8 border border-white/50 backdrop-blur-sm my-auto">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-indigo-500 rounded-3xl mx-auto flex items-center justify-center mb-4 shadow-lg"><MessageCircle className="w-10 h-10 text-white" /></div>
            <h1 className="text-2xl font-black text-gray-800">チャットアプリ</h1>
            <p className="text-sm text-gray-500 mt-2">{isLoginMode ? "ログインして始めましょう" : "アカウントを作成してデータを保存"}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLoginMode && (
              <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 ml-2">表示名</label><div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border"><User className="w-4 h-4 text-gray-400" /><input className="bg-transparent w-full outline-none text-sm font-bold" placeholder="山田 太郎" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div></div>
            )}
            <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 ml-2">ユーザーID</label><div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border"><AtSign className="w-4 h-4 text-gray-400" /><input className="bg-transparent w-full outline-none text-sm font-bold" placeholder="user_id" value={userId} onChange={(e) => setUserId(e.target.value)} /></div></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400 ml-2">パスワード</label><div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border"><KeyRound className="w-4 h-4 text-gray-400" /><input className="bg-transparent w-full outline-none text-sm font-bold" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} /></div></div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center">{loading ? <Loader2 className="animate-spin" /> : (isLoginMode ? "ログイン" : "登録")}</button>
          </form>
          <div className="mt-6 flex flex-col gap-3">
            <button onClick={handleGoogleLogin} className="w-full bg-white border text-gray-700 font-bold py-3 rounded-2xl shadow-sm flex items-center justify-center gap-2"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" className="w-4 h-4" />Googleでログイン</button>
            <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-xs font-bold text-gray-400 hover:text-indigo-500">{isLoginMode ? "アカウントをお持ちでない方はこちら" : "すでにアカウントをお持ちの方はこちら"}</button>
            <button onClick={handleGuestLogin} className="text-xs font-bold text-gray-400 underline hover:text-gray-600">お試しゲストログイン</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const VideoCallView = ({ user, chatId, callData, onEndCall, isVideoEnabled = true, activeEffect, backgroundUrl, effects = [] }: any) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideoEnabled);
  const [callError, setCallError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const unsubscribersRef = useRef<(() => void)[]>([]);
  const pendingCandidatesRef = useRef<any[]>([]);
  const startedRef = useRef(false);

  const stopAll = useCallback(() => {
    // Firestore listeners
    unsubscribersRef.current.forEach((u) => {
      try { u(); } catch {}
    });
    unsubscribersRef.current = [];

    // Peer connection
    try {
      if (pcRef.current) {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      }
    } catch {}
    pcRef.current = null;

    // Media tracks
    try {
      const s = localStreamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
    } catch {}
    localStreamRef.current = null;
  }, []);

    const getFilterStyle = (effectName: string) => {
      if (!effectName || effectName === 'Normal') return 'none';

      // Prefer user-defined / purchased effect filter if available
      const match = (effects || []).find(
        (e: any) => e?.name === effectName && typeof e?.filter === 'string' && e.filter.trim() !== ''
      );
      if (match?.filter) return match.filter;

      switch (effectName) {
        case 'Sepia': return 'sepia(100%)';
        case 'Grayscale': return 'grayscale(100%)';
        case 'Invert': return 'invert(100%)';
        case 'Hue': return 'hue-rotate(90deg)';
        case 'Contrast': return 'contrast(200%)';
        case 'Blur': return 'blur(4px)';
        case 'Bright': return 'brightness(150%)';
        case 'Fire': return 'sepia(100%) hue-rotate(-50deg) saturate(300%)';
        case 'Ice': return 'sepia(100%) hue-rotate(180deg) saturate(200%)';
        case 'Rainbow': return 'hue-rotate(90deg) saturate(200%)';
        default: return 'none';
      }
    };

  const getMediaErrorMessage = (err: any) => {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return "カメラ/マイクの利用が許可されていません。ブラウザ設定で許可してください。";
    if (name === 'NotFoundError') return "カメラまたはマイクが見つかりません。（端末にデバイスが無い/無効/接続されていない可能性）";
    if (name === 'NotReadableError') return "カメラ/マイクを使用できません。他のアプリが使用中の可能性があります。";
    if (name === 'OverconstrainedError') return "カメラ/マイクの条件が厳しすぎて取得できませんでした。";
    return "カメラ/マイクの取得に失敗しました。";
  };

  const flushPendingCandidates = async (pc: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const c of pending) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
  };

  useEffect(() => {
    let cancelled = false;

    const startCall = async () => {
      if (startedRef.current) return;
      startedRef.current = true;

      if (!navigator.mediaDevices?.getUserMedia) {
        setCallError("このブラウザは通話（getUserMedia）に対応していません。");
        return;
      }

      const isCaller = callData?.callerId === user.uid;

      const signalingRef = doc(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "session");
      const candidatesCol = collection(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "candidates", "list");

      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'failed' || st === 'disconnected') {
          setCallError("接続が不安定です。通話を終了します。");
          setTimeout(() => onEndCall?.(), 1200);
        }
      };

      pc.onicecandidate = async (event) => {
        if (!event.candidate) return;
        try {
          await addDoc(candidatesCol, {
            candidate: event.candidate.toJSON(),
            senderId: user.uid,
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          console.warn("Failed to send ICE candidate:", e);
        }
      };

      pc.ontrack = async (event) => {
        const s = event.streams?.[0];
        if (!s) return;
        setRemoteStream(s);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = s;
          try { await remoteVideoRef.current.play(); } catch {}
        }
      };

      // --- getUserMedia with fallbacks ---
      try {
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        const hasAudioInput = devices.some((d) => d.kind === 'audioinput');
        const hasVideoInput = devices.some((d) => d.kind === 'videoinput');

        const wantVideo = !!isVideoEnabled && hasVideoInput;

        const baseConstraints: MediaStreamConstraints = {
          audio: hasAudioInput
            ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            : true,
          video: wantVideo ? { facingMode: "user" } : false,
        };

        let stream: MediaStream | null = null;

        try {
          stream = await navigator.mediaDevices.getUserMedia(baseConstraints);
        } catch (err: any) {
          // If video was requested, retry with audio only.
          if (wantVideo) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
              });
              setIsVideoOff(true);
            } catch (err2: any) {
              throw err2;
            }
          } else {
            throw err;
          }
        }

        if (!stream) throw new Error("No stream");

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        // Attach local preview (video only)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          try { await localVideoRef.current.play(); } catch {}
        }

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      } catch (err: any) {
        console.error("Error accessing media devices.", err);
        setCallError(getMediaErrorMessage(err));
        setTimeout(() => onEndCall?.(), 2500);
        return;
      }

      // --- Signaling ---
      const unsubSignaling = onSnapshot(signalingRef, async (snap) => {
        const data: any = snap.data();
        if (!data || !pcRef.current) return;

        try {
          if (!pc.currentRemoteDescription && data.type === "answer" && isCaller && data.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }));
            await flushPendingCandidates(pc);
          } else if (!pc.currentRemoteDescription && data.type === "offer" && !isCaller && data.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: data.sdp }));
            await flushPendingCandidates(pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await setDoc(signalingRef, { type: "answer", sdp: answer.sdp, callerId: data.callerId || callData?.callerId }, { merge: true });
          }
        } catch (e) {
          console.warn("Signaling error:", e);
        }
      });
      unsubscribersRef.current.push(unsubSignaling);

      const unsubCandidates = onSnapshot(candidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type !== "added") return;
          const data: any = change.doc.data();
          if (!data || data.senderId === user.uid) return;

          try {
            const c = data.candidate;
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            } else {
              pendingCandidatesRef.current.push(c);
            }
          } catch (e) {
            console.warn("Failed to add ICE candidate:", e);
          }
        });
      });
      unsubscribersRef.current.push(unsubCandidates);

      // Caller creates offer
      if (isCaller) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await setDoc(signalingRef, { type: "offer", sdp: offer.sdp, callerId: user.uid }, { merge: true });
        } catch (e) {
          console.warn("Failed to create offer:", e);
          setCallError("通話の開始に失敗しました。");
          setTimeout(() => onEndCall?.(), 1500);
        }
      }
    };

    startCall();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [chatId, user.uid, callData?.callerId, isVideoEnabled, onEndCall, stopAll]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const toggleMute = () => {
    const s = localStreamRef.current;
    if (s) {
      s.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsMuted((v) => !v);
    }
  };

  const toggleVideo = () => {
    const s = localStreamRef.current;
    if (s) {
      s.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsVideoOff((v) => !v);
    }
  };

  if (callError) {
    return (
      <div className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center text-white flex-col gap-4">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <p className="font-bold text-lg text-center px-8">{callError}</p>
        <p className="text-sm text-gray-400">通話を終了します...</p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black flex flex-col animate-in fade-in"
      style={{ backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none', backgroundSize: 'cover' }}
    >
      <div className="relative flex-1 flex items-center justify-center backdrop-blur-md bg-black/30">
        {remoteStream ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <div className="text-white flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center animate-pulse">
              <User className="w-10 h-10" />
            </div>
            <p className="font-bold text-lg drop-shadow-md">接続中...</p>
          </div>
        )}

        {isVideoEnabled && (
          <div className="absolute top-4 right-4 w-32 h-48 bg-black rounded-xl overflow-hidden border-2 border-white shadow-lg transition-all">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
              style={{ filter: getFilterStyle(activeEffect) }}
            />
            {activeEffect && activeEffect !== 'Normal' && (
              <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[8px] px-1 rounded">
                {activeEffect}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="h-24 bg-black/80 flex items-center justify-center gap-8 pb-6 backdrop-blur-lg">
        <button onClick={toggleMute} className={`p-4 rounded-full transition-all ${isMuted ? "bg-white text-black" : "bg-gray-700 text-white hover:bg-gray-600"}`}>
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button onClick={onEndCall} className="p-4 rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 transform hover:scale-110 transition-all flex flex-col items-center justify-center gap-1">
          <PhoneOff className="w-8 h-8" />
          <span className="text-[10px] font-bold">終了</span>
        </button>

        {isVideoEnabled && (
          <button onClick={toggleVideo} className={`p-4 rounded-full transition-all ${isVideoOff ? "bg-white text-black" : "bg-gray-700 text-white hover:bg-gray-600"}`}>
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}
      </div>
    </div>
  );
};

const AIEffectGenerator = ({ user, onClose, showNotification, onSelectEffect }: any) => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [generatedEffects, setGeneratedEffects] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageUpload = (e: any) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event: any) => {
      setSourceImage(event.target.result);
      generateEffects(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const generateEffects = async (imgSrc: string) => {
    setIsProcessing(true);
    setGeneratedEffects([]);
    
    await new Promise(r => setTimeout(r, 1500));

    const img = new Image();
    img.onload = () => {
      const effects = [
        { name: 'Normal', filter: 'none' },
        { name: 'Sepia', filter: 'sepia(100%)' },
        { name: 'Grayscale', filter: 'grayscale(100%)' },
        { name: 'Invert', filter: 'invert(100%)' },
        { name: 'Hue', filter: 'hue-rotate(90deg)' },
        { name: 'Contrast', filter: 'contrast(200%)' },
        { name: 'Blur', filter: 'blur(4px)' },
        { name: 'Bright', filter: 'brightness(150%)' }
      ];

      const results: any[] = [];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const MAX_SIZE = 200;
      let w = img.width;
      let h = img.height;
      if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } }
      else { if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; } }
      canvas.width = w;
      canvas.height = h;

      effects.forEach((effect) => {
        ctx.filter = effect.filter;
        ctx.drawImage(img, 0, 0, w, h);
        results.push({ name: effect.name, filter: effect.filter, image: canvas.toDataURL('image/jpeg', 0.8) });
      });

      setGeneratedEffects(results);
      setIsProcessing(false);
      showNotification("AIが8パターンのエフェクトを生成しました！✨");
    };
    img.src = imgSrc;
  };

  const saveEffect = async (effect: any) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'users', user.uid, 'effects'), {
        name: effect.name,
        image: effect.image,
        filter: effect.filter || null,
        type: 'created',
        ownerId: user.uid,
        creatorId: user.uid,
        forSale: false,
        price: 0,
        soldCount: 0,
        createdAt: serverTimestamp()
      });
      showNotification(`${effect.name} エフェクトを保存しました`);
      if (onSelectEffect) onSelectEffect(effect.name);
      onClose();
    } catch(e) {
      console.error(e);
      showNotification("保存に失敗しました");
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full hover:bg-gray-200 z-10"><X className="w-5 h-5"/></button>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 flex-shrink-0"><Sparkles className="w-6 h-6 text-purple-500" /> AIエフェクト生成</h2>
        
        {!sourceImage ? (
          <div className="flex flex-col items-center justify-center flex-1 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
            <label className="cursor-pointer flex flex-col items-center p-10 w-full h-full justify-center">
              <Upload className="w-12 h-12 text-gray-400 mb-2"/>
              <span className="text-sm font-bold text-gray-500">画像をアップロードして生成</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-2">
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <Loader2 className="w-12 h-12 animate-spin text-purple-500 mb-4"/>
                  <p className="text-sm font-bold text-gray-500 animate-pulse">AIが思考中...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {generatedEffects.map((ef, i) => (
                    <div key={i} onClick={() => saveEffect(ef)} className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center cursor-pointer hover:ring-2 ring-purple-500 transition-all group">
                      <div className="w-full aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2 relative">
                         <img src={ef.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      </div>
                      <span className="text-xs font-bold text-gray-700">{ef.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => { setSourceImage(null); setGeneratedEffects([]); }} className="mt-4 w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl flex-shrink-0">やり直す</button>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

const CoinTransferModal = ({ onClose, myWallet, myUid, targetUid, targetName, showNotification }: any) => {
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const handleSend = async () => {
    const val = parseInt(amount, 10);
    if (isNaN(val) || val <= 0) return showNotification("正の整数を入力してください");
    if (val > myWallet) return showNotification("残高が足りません");
    setSending(true);
    try {
      await runTransaction(db, async (t) => {
        const senderRef = doc(db, "artifacts", appId, "public", "data", "users", myUid);
        const receiverRef = doc(db, "artifacts", appId, "public", "data", "users", targetUid);
        const senderDoc = await t.get(senderRef);
        if (!senderDoc.exists() || senderDoc.data().wallet < val) throw "残高不足またはエラー";
        t.update(senderRef, { wallet: increment(-val) });
        t.update(receiverRef, { wallet: increment(val) });
      });
      showNotification(`${targetName}さんに ${val}コイン送りました`);
      onClose();
    } catch (e) { showNotification("送金エラー: " + e); } finally { setSending(false); }
  };
  return (
    <div className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in">
      <div className="bg-white w-full max-w-sm rounded-[32px] p-6 text-center shadow-2xl">
        <h3 className="font-bold text-lg mb-4 text-gray-800">コインを送る</h3>
        <div className="bg-yellow-50 p-4 rounded-2xl mb-4 border border-yellow-100">
          <div className="text-xs text-yellow-700 font-bold uppercase tracking-widest">あなたの残高</div>
          <div className="text-3xl font-black text-yellow-500 mt-1">{myWallet?.toLocaleString()}</div>
        </div>
        <p className="text-sm font-bold text-gray-500 mb-2">To: {targetName}</p>
        <div className="relative mb-6">
          <input type="number" className="w-full bg-gray-100 rounded-2xl p-4 text-center font-bold text-xl outline-none focus:ring-2 focus:ring-yellow-400" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">COIN</span>
        </div>
        <button onClick={handleSend} disabled={sending} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-2xl shadow-lg transition-transform active:scale-95 mb-3">{sending ? <Loader2 className="animate-spin mx-auto"/> : "送金する"}</button>
        <button onClick={onClose} className="text-gray-400 text-xs font-bold hover:text-gray-600">キャンセル</button>
      </div>
    </div>
  );
};

const ContactSelectModal = ({ onClose, onSend, friends }: any) => (
  <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col max-h-[70vh]">
      <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">連絡先を選択</h3><button onClick={onClose}><X className="w-6 h-6"/></button></div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">{friends.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">友だちがいません</div> : friends.map((f: any) => <div key={f.uid} onClick={() => onSend(f)} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer border border-transparent hover:border-gray-100 transition-all"><img src={f.avatar} className="w-10 h-10 rounded-xl object-cover border" /><span className="font-bold text-sm flex-1">{f.name}</span><Plus className="w-4 h-4 text-green-500" /></div>)}</div>
    </div>
  </div>
);

const BirthdayCardModal = ({ onClose, onSend, toName }: any) => {
  const [color, setColor] = useState('pink'), [message, setMessage] = useState('');
  const colors = [{ id: 'pink', class: 'bg-pink-100 border-pink-300' }, { id: 'blue', class: 'bg-blue-100 border-blue-300' }, { id: 'yellow', class: 'bg-yellow-100 border-yellow-300' }, { id: 'green', class: 'bg-green-100 border-green-300' }];
  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">カードを送る</h3><button onClick={onClose}><X className="w-6 h-6"/></button></div>
        <div className="mb-4 flex gap-3">{colors.map(c => <button key={c.id} onClick={() => setColor(c.id)} className={`w-10 h-10 rounded-full border-2 ${c.class} ${color === c.id ? 'scale-125 ring-2 ring-gray-300' : ''}`}/>)}</div>
        <div className={`p-4 rounded-2xl border-2 mb-4 ${colors.find(c=>c.id===color)?.class}`}><div className="font-bold text-gray-700 mb-2">To: {toName}</div><textarea className="w-full bg-white/50 rounded-xl p-3 text-sm focus:outline-none min-h-[100px]" placeholder="メッセージ..." value={message} onChange={e => setMessage(e.target.value)}/></div>
        <button onClick={() => onSend({ color, message })} disabled={!message.trim()} className="w-full bg-pink-500 text-white font-bold py-3 rounded-2xl shadow-lg">送信する</button>
      </div>
    </div>
  );
};

const StickerBuyModal = ({ onClose, onGoToStore, packId }: any) => {
    return (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="w-8 h-8 text-blue-600"/>
                </div>
                <h3 className="font-bold text-lg mb-2">このスタンプを購入しますか？</h3>
                <p className="text-gray-500 text-sm mb-6">ショップで詳細を確認できます。</p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-2xl text-gray-600 transition-colors">キャンセル</button>
                    <button onClick={() => { onGoToStore(packId); onClose(); }} className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 font-bold rounded-2xl text-white transition-colors shadow-lg shadow-blue-200">ショップへ</button>
                </div>
            </div>
        </div>
    );
};

const GroupAddMemberModal = ({ onClose, currentMembers, chatId, allUsers, profile, user, showNotification }: any) => {
    const [selected, setSelected] = useState<string[]>([]);
    const inviteableFriends = allUsers.filter((u: any) => (profile?.friends || []).includes(u.uid) && !currentMembers.includes(u.uid));
    const toggle = (uid: string) => setSelected(prev => prev.includes(uid) ? prev.filter(i => i !== uid) : [...prev, uid]);
    const handleInvite = async () => {
      if (selected.length === 0) return;
      try {
        const addedNames: string[] = [];
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId), { participants: arrayUnion(...selected) });
        selected.forEach(uid => { const u = allUsers.find((user: any) => user.uid === uid); if (u) addedNames.push(u.name); });
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages'), {
          senderId: user.uid, content: `${profile.name}が${addedNames.join('、')}を招待しました。`, type: 'text', createdAt: serverTimestamp(), readBy: [user.uid]
        });
        showNotification("メンバーを追加しました"); onClose();
      } catch (e) { showNotification("エラーが発生しました"); }
    };
    return (
      <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-3xl flex flex-col max-h-[70vh]">
          <div className="flex justify-between items-center p-4 border-b"><h3 className="font-bold text-lg">メンバーを追加</h3><button onClick={onClose}><X className="w-6 h-6"/></button></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">{inviteableFriends.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">招待できる友だちがいません</div> : inviteableFriends.map((f: any) => <div key={f.uid} onClick={() => toggle(f.uid)} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer border border-transparent transition-all"><img src={f.avatar} className="w-10 h-10 rounded-xl object-cover border" /><span className="font-bold text-sm flex-1">{f.name}</span><div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selected.includes(f.uid) ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}>{selected.includes(f.uid) && <Check className="w-4 h-4 text-white" />}</div></div>)}</div>
          <div className="p-4 border-t"><button onClick={handleInvite} disabled={selected.length === 0} className={`w-full py-3 rounded-2xl font-bold shadow-lg text-white transition-all ${selected.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}>招待する ({selected.length})</button></div>
        </div>
      </div>
    );
};

const GroupEditModal = ({ onClose, chatId, currentName, currentIcon, currentMembers, allUsers, showNotification, user, profile }: any) => {
    const [name, setName] = useState(currentName);
    const [icon, setIcon] = useState(currentIcon);
    const [kickTarget, setKickTarget] = useState<any>(null);

    const handleUpdate = async () => {
        if (!name.trim()) return showNotification("グループ名を入力してください");
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId), { name, icon, updatedAt: serverTimestamp() });
            if (name !== currentName || icon !== currentIcon) {
                 await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages'), {
                    senderId: user.uid, content: `${profile.name}がグループ情報を変更しました。`, type: 'text', createdAt: serverTimestamp(), readBy: [user.uid]
                });
            }
            showNotification("グループ情報を更新しました"); onClose();
        } catch (e) { showNotification("更新に失敗しました"); }
    };
    const executeKick = async () => {
        if (!kickTarget) return;
        const { uid, name: memberName } = kickTarget;
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId), { participants: arrayRemove(uid) });
             await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages'), {
                senderId: user.uid, content: `${profile.name}が${memberName}を退会させました。`, type: 'text', createdAt: serverTimestamp(), readBy: [user.uid]
            });
            showNotification(`${memberName}を削除しました`);
        } catch(e) { showNotification("削除に失敗しました"); } finally { setKickTarget(null); }
    };
    return (
      <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
          <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0"><h3 className="font-bold text-lg">グループ設定</h3><button onClick={onClose}><X className="w-6 h-6 text-gray-500"/></button></div>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="flex flex-col items-center gap-6 mb-8">
                <div className="relative group"><img src={icon} className="w-24 h-24 rounded-3xl object-cover bg-gray-100 border shadow-sm" /><label className="absolute bottom-0 right-0 bg-green-500 p-2 rounded-full text-white cursor-pointer shadow-lg border-2 border-white hover:bg-green-600 transition-colors"><CameraIcon className="w-4 h-4" /><input type="file" className="hidden" accept="image/*" onChange={e => handleCompressedUpload(e, (d: string) => setIcon(d))} /></label></div>
                <div className="w-full"><label className="text-xs font-bold text-gray-400 mb-1 block">グループ名</label><input className="w-full text-center text-lg font-bold border-b py-2 focus:outline-none focus:border-green-500 bg-transparent" placeholder="グループ名を入力" value={name} onChange={e => setName(e.target.value)} /></div>
            </div>
            <div className="mb-6"><h4 className="text-xs font-bold text-gray-400 mb-2 uppercase flex justify-between"><span>メンバー ({currentMembers.length})</span><span className="text-[10px] text-gray-400 font-normal">管理者権限: 削除可能</span></h4>
                <div className="space-y-2">{currentMembers.map((uid: any) => { const m = allUsers.find((u: any) => u.uid === uid); if (!m) return null; const isMe = uid === user.uid; return ( <div key={uid} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100"><img src={m.avatar} className="w-10 h-10 rounded-full object-cover border" /><div className="flex-1 min-w-0"><div className="font-bold text-sm truncate">{m.name} {isMe && <span className="text-gray-400 text-xs">(自分)</span>}</div></div>{!isMe && (<button onClick={() => setKickTarget({ uid, name: m.name })} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors flex items-center gap-1 group" title="強制退会"><span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">強制退会</span><UserMinus className="w-5 h-5" /></button>)}</div> ); })}</div>
            </div>
          </div>
          <button onClick={handleUpdate} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-2xl shadow-lg transition-all shrink-0 mt-4">保存する</button>
        </div>
        {kickTarget && (<div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl"><h3 className="font-bold text-lg mb-2 text-center text-gray-800">強制退会の確認</h3><p className="text-center text-gray-600 mb-6 text-sm">{kickTarget.name} をグループから退会させますか？<br/><span className="text-xs text-red-500">この操作は元に戻せません。</span></p><div className="flex gap-3"><button onClick={() => setKickTarget(null)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-2xl text-gray-600 transition-colors">キャンセル</button><button onClick={executeKick} className="flex-1 py-3 bg-red-500 hover:bg-red-600 font-bold rounded-2xl text-white transition-colors shadow-lg shadow-red-200">退会させる</button></div></div></div>)}
      </div>
    );
};

const LeaveGroupConfirmModal = ({ onClose, onLeave }: any) => (
  <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
      <div className="text-center mb-6"><div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3"><LogOut className="w-6 h-6 text-red-500" /></div><h3 className="font-bold text-lg text-gray-800">グループを退会しますか？</h3><p className="text-sm text-gray-500 mt-2">この操作は取り消せません。<br/>本当に退会してもよろしいですか？</p></div>
      <div className="flex gap-3"><button onClick={onClose} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors">キャンセル</button><button onClick={onLeave} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-red-200">退会する</button></div>
    </div>
  </div>
);

const IncomingCallOverlay = ({ callData, onAccept, onDecline, allUsers }: any) => {
  const caller = allUsers.find((u: any) => u.uid === callData.callerId);
  const isVideo = callData?.callType !== 'audio';

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
          <h2 className="text-4xl font-bold text-white drop-shadow-xl text-center leading-tight">{caller?.name || "Unknown"}</h2>
          <div className="text-white/70 text-sm font-bold mt-1">
            {isVideo ? "ビデオ通話" : "音声通話"}
          </div>
        </div>

        <div className="relative mt-8">
          <div className="absolute inset-0 rounded-full bg-white/20 animate-[ping_2s_ease-in-out_infinite]"></div>
          <div className="absolute inset-0 rounded-full bg-white/10 animate-[ping_3s_ease-in-out_infinite_delay-500ms]"></div>
          <img
            src={caller?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=caller"}
            className="w-40 h-40 rounded-full border-[6px] border-white/20 shadow-2xl object-cover relative z-10 bg-gray-800"
          />
        </div>
      </div>

      <div className="relative z-10 w-full flex justify-between items-end px-4 mb-8 max-w-sm">
        <button onClick={onDecline} className="flex flex-col items-center gap-4 group">
          <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-red-600 border border-red-400">
            <PhoneOff className="w-10 h-10 text-white fill-current" />
          </div>
          <span className="text-white text-sm font-bold shadow-black drop-shadow-md">拒否</span>
        </button>

        <button onClick={onAccept} className="flex flex-col items-center gap-4 group">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-50"></div>
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-green-600 border border-green-400 relative z-10">
              {isVideo ? <Video className="w-10 h-10 text-white fill-current" /> : <Phone className="w-10 h-10 text-white fill-current" />}
            </div>
          </div>
          <span className="text-white text-sm font-bold shadow-black drop-shadow-md">応答</span>
        </button>
      </div>
    </div>
  );
};

const OutgoingCallOverlay = ({ callData, onCancel, allUsers }: any) => (
  <div className="fixed inset-0 z-[500] bg-gray-900 flex flex-col items-center justify-between py-24 px-6 animate-in fade-in duration-300">
     <div className="flex flex-col items-center gap-6 mt-10"><div className="relative"><div className="absolute inset-0 rounded-full bg-white/10 animate-pulse"></div><div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center border-4 border-white/50 shadow-2xl relative z-10"><Video className="w-14 h-14 text-white opacity-80" /></div></div><div className="text-center text-white"><h2 className="text-2xl font-bold mb-2">発信中...</h2><p className="text-sm opacity-60">相手の応答を待っています</p></div></div>
    <div className="w-full flex justify-center items-center mb-10"><button onClick={onCancel} className="flex flex-col items-center gap-3 group"><div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-red-600"><X className="w-10 h-10 text-white" /></div><span className="text-white text-xs font-bold">キャンセル</span></button></div>
  </div>
);

const CallAcceptedOverlay = ({ callData, onJoin }: any) => (
  <div className="fixed inset-0 z-[500] bg-gray-900/90 flex flex-col items-center justify-center px-6 animate-in fade-in duration-300 backdrop-blur-sm">
    <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-white/20"><div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce"><Video className="w-10 h-10 text-green-600" /></div><h2 className="text-2xl font-bold text-gray-800 mb-2">相手が応答しました</h2><p className="text-gray-500 mb-8 text-sm">下のボタンを押して通話を開始してください</p><button onClick={onJoin} className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-green-200 transform hover:scale-[1.02] flex items-center justify-center gap-2"><Video className="w-5 h-5" />通話に参加する</button></div>
  </div>
);

const FriendProfileModal = ({ friend, onClose, onStartChat, onTransfer, myUid, myProfile, allUsers, showNotification }: any) => {
  const myFriends: string[] = myProfile?.friends || [];
  const myFriendsSet = useMemo(() => new Set(myFriends), [myFriends]);
  const friendFriends: string[] = friend?.friends || [];

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
    // Friend's friends excluding me and excluding my direct friends = "友だちの友だち候補"
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
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', myUid);
      if (isHidden) {
        await updateDoc(userRef, { hiddenFriends: arrayRemove(friend.uid) });
        showNotification?.("非表示を解除しました");
      } else {
        const ok = window.confirm("この友だちを非表示にしますか？\n（友だち関係は解除されません）");
        if (!ok) return;
        await updateDoc(userRef, { hiddenFriends: arrayUnion(friend.uid) });
        showNotification?.("非表示にしました");
      }
      onClose?.();
    } catch (e) {
      console.error(e);
      showNotification?.("エラーが発生しました");
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in">
      <div className="bg-white w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl relative flex flex-col items-center pb-8">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 bg-black/20 text-white p-2 rounded-full backdrop-blur-md hover:bg-black/30">
          <X className="w-6 h-6" />
        </button>

        <div className="w-full h-48 bg-gray-200">
          <img src={friend.cover || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80"} className="w-full h-full object-cover" />
        </div>

        <div className="-mt-16 mb-4 relative">
          <img src={friend.avatar} className="w-32 h-32 rounded-[40px] border-[6px] border-white object-cover shadow-lg" />
        </div>

        <h2 className="text-2xl font-bold mb-1">{friend.name}</h2>
        <p className="text-xs text-gray-400 font-mono mb-4">ID: {friend.id}</p>

        <div className="w-full px-8 mb-4 grid grid-cols-3 gap-2">
          <div className="bg-gray-50 rounded-2xl p-3 text-center border">
            <div className="text-[10px] font-bold text-gray-400">友だち</div>
            <div className="text-lg font-black text-gray-800">{friendFriends.length}</div>
          </div>
          <div className="bg-gray-50 rounded-2xl p-3 text-center border">
            <div className="text-[10px] font-bold text-gray-400">共通</div>
            <div className="text-lg font-black text-gray-800">{mutualCount}</div>
          </div>
          <div className="bg-gray-50 rounded-2xl p-3 text-center border">
            <div className="text-[10px] font-bold text-gray-400">友だちの友だち</div>
            <div className="text-lg font-black text-gray-800">{fofCandidateCount}</div>
          </div>
        </div>

        <div className="w-full px-8 mb-6">
          <p className="text-center text-sm text-gray-600 bg-gray-50 py-3 px-4 rounded-2xl border">
            {friend.status || "ステータスなし"}
          </p>
        </div>

        <div className="flex gap-3 w-full px-8">
          <button
            onClick={() => { onStartChat?.(friend.uid); onClose?.(); }}
            className="flex-1 py-3 bg-green-500 text-white rounded-2xl font-bold shadow-lg shadow-green-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" /> トーク
          </button>

          <button
            onClick={onTransfer}
            className="flex-1 py-3 bg-yellow-500 text-white rounded-2xl font-bold shadow-lg shadow-yellow-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
          >
            <Coins className="w-5 h-5" /> 送金
          </button>
        </div>

        {isFriend && (
          <div className="w-full px-8 mt-3">
            <button
              onClick={toggleHideFriend}
              className={`w-full py-3 rounded-2xl font-bold border transition-colors flex items-center justify-center gap-2 ${
                isHidden ? 'bg-white text-gray-700 hover:bg-gray-50' : 'bg-gray-900 text-white hover:bg-black'
              }`}
            >
              {isHidden ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              {isHidden ? "非表示を解除" : "非表示にする"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const MessageItem = React.memo(({ m, user, sender, isGroup, db, appId, chatId, addFriendById, onEdit, onDelete, onPreview, onReply, onReaction, allUsers, onStickerClick, onShowProfile, onJoinCall }: any) => {
    const isMe = m.senderId === user.uid;
    const [mediaSrc, setMediaSrc] = useState<string | null>(null); 
    const [loading, setLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const isInvalidBlob = !isMe && m.content?.startsWith('blob:');

    const setBlobSrcFromBase64 = (base64Data: string, mimeType: string) => {
        try {
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            setMediaSrc(URL.createObjectURL(blob));
        } catch (e) { console.error("Blob creation failed", e); }
    };

    useEffect(() => {
      if (isMe && m.content?.startsWith('blob:')) { setMediaSrc(m.content); return; }
      return () => { if (mediaSrc && mediaSrc.startsWith('blob:') && !isMe) URL.revokeObjectURL(mediaSrc); };
    }, [isMe, m.content]);

    useEffect(() => {
      if (isMe && m.content?.startsWith('blob:')) return;
      if (m.hasChunks) {
        if (mediaSrc && !mediaSrc.startsWith('blob:') && mediaSrc !== m.preview) return;
        setLoading(true);
        (async () => {
          try {
            let base64Data = ""; 
            if (m.chunkCount) {
                 const chunkPromises = [];
                 for (let i = 0; i < m.chunkCount; i++) chunkPromises.push(getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages', m.id, 'chunks', `${i}`)));
                 const chunkDocs = await Promise.all(chunkPromises);
                 chunkDocs.forEach(d => { if (d.exists()) base64Data += d.data().data; });
            } else {
                 const snap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages', m.id, 'chunks'), orderBy('index', 'asc')));
                 snap.forEach(d => base64Data += d.data().data);
            }
            if (base64Data) {
               let mimeType = m.mimeType;
               if (!mimeType) {
                   if (m.type === 'video') mimeType = 'video/mp4';
                   else if (m.type === 'image') mimeType = 'image/jpeg';
                   else if (m.type === 'audio') mimeType = 'audio/webm';
                   else mimeType = 'application/octet-stream';
               }
               if (m.type !== 'text' && m.type !== 'contact') setBlobSrcFromBase64(base64Data, mimeType);
            } else if (m.preview) { setMediaSrc(m.preview); }
          } catch (e) { console.error("Failed to load chunks", e); if (m.preview) setMediaSrc(m.preview); } finally { setLoading(false); }
        })();
      } else {
        if (isInvalidBlob) { setMediaSrc(m.preview); } else { setMediaSrc(m.content || m.preview); }
      }
    }, [m.id, chatId, m.content, m.hasChunks, isMe, isInvalidBlob, m.preview, m.type, m.mimeType, m.chunkCount]);

    const handleDownload = async () => {
      if (m.content && m.content.startsWith('blob:')) {
         const a = document.createElement('a'); a.href = m.content; a.download = m.fileName || 'download_file'; a.click(); return;
      }
      setLoading(true);
      try {
        let dataUrl = mediaSrc;
        if (!dataUrl && m.hasChunks) {
            let base64Data = "";
            if (m.chunkCount) {
                 const chunkPromises = [];
                 for (let i = 0; i < m.chunkCount; i++) chunkPromises.push(getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages', m.id, 'chunks', `${i}`)));
                 const chunkDocs = await Promise.all(chunkPromises);
                 chunkDocs.forEach(d => { if (d.exists()) base64Data += d.data().data; });
            } else {
                const snap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages', m.id, 'chunks'), orderBy('index', 'asc')));
                snap.forEach(d => base64Data += d.data().data);
            }
            if (base64Data) {
                 const mimeType = m.mimeType || 'application/octet-stream';
                 const byteCharacters = atob(base64Data);
                 const byteNumbers = new Array(byteCharacters.length);
                 for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                 const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
                 dataUrl = URL.createObjectURL(blob);
            }
        } else if (!dataUrl) { dataUrl = m.content; }
        if (dataUrl) { const a = document.createElement('a'); a.href = dataUrl; a.download = m.fileName || 'download_file'; a.click(); }
      } catch(e) { console.error("Download failed", e); } finally { setLoading(false); }
    };

    const handleStickerClick = (e: any) => {
        e.stopPropagation();
        if (m.audio) {
            new Audio(m.audio).play().catch(e => console.error("Audio playback error:", e));
        }
        if (onStickerClick && m.packId) {
            onStickerClick(m.packId);
        }
    };

    const readCount = (m.readBy?.length || 1) - 1;
    const finalSrc = mediaSrc || m.preview;
    const isShowingPreview = loading || isInvalidBlob || (finalSrc === m.preview);
    const handleBubbleClick = (e: any) => { e.stopPropagation(); setShowMenu(!showMenu); };
    
    const renderContent = (text: string) => {
      if (!text) return "";
      const regex = /(https?:\/\/[^\s]+)|(@[^\s]+)/g;
      const parts = text.split(regex);
      return parts.map((part, i) => {
        if (!part) return null;
        if (part.match(/^https?:\/\//)) return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all" onClick={(e) => e.stopPropagation()}>{part}</a>;
        if (part.startsWith('@')) {
           const name = part.substring(1);
           const mentionedUser = allUsers.find((u: any) => u.name === name);
           if (mentionedUser) return <span key={i} className="text-blue-500 font-bold cursor-pointer hover:underline bg-blue-50 px-1 rounded" onClick={(e) => { e.stopPropagation(); onShowProfile && onShowProfile(mentionedUser); }}>{part}</span>;
        }
        return part;
      });
    };
    
    const getUserNames = (uids: string[]) => { if (!uids || !allUsers) return ""; return uids.map(uid => { const u = allUsers.find((user: any) => user.uid === uid); return u ? u.name : "不明なユーザー"; }).join(", "); };

    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2 relative group mb-4`}>
        {!isMe && (<div className="relative mt-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); onShowProfile && onShowProfile(sender); }}><img key={sender?.avatar} src={sender?.avatar} className="w-8 h-8 rounded-lg object-cover border" loading="lazy" />{isTodayBirthday(sender?.birthday) && <span className="absolute -top-1 -right-1 text-[8px]">🎂</span>}</div>)}
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
          {!isMe && isGroup && <div className="text-[10px] text-gray-600 font-bold mb-1 ml-1 cursor-pointer hover:underline" onClick={() => onShowProfile && onShowProfile(sender)}>{sender?.name}</div>}
          <div className="relative">
             <div onClick={handleBubbleClick} className={`p-2 px-3 rounded-2xl text-[13px] shadow-sm relative cursor-pointer ${m.type === 'sticker' ? 'bg-transparent shadow-none p-0' : (isMe ? 'bg-[#7cfc00] rounded-tr-none' : 'bg-white rounded-tl-none')} ${['image', 'video', 'call_invite'].includes(m.type) ? 'p-0 bg-transparent shadow-none' : ''}`}>
              {m.replyTo && m.type !== 'sticker' && (<div className={`mb-2 p-2 rounded-lg border-l-4 text-xs opacity-70 ${isMe ? 'bg-black/5 border-white/50' : 'bg-gray-100 border-gray-300'}`}><div className="font-bold text-[10px] mb-0.5">{m.replyTo.senderName}</div><div className="truncate flex items-center gap-1">{m.replyTo.type === 'image' && <ImageIcon className="w-3 h-3" />}{m.replyTo.type === 'video' && <Video className="w-3 h-3" />}{['image', 'video'].includes(m.replyTo.type) ? (m.replyTo.type === 'image' ? '[画像]' : '[動画]') : (m.replyTo.content || '[メッセージ]')}</div></div>)}
              {m.type === 'text' && <div className="whitespace-pre-wrap">{renderContent(m.content)}{m.isEdited && <div className="text-[9px] text-black/40 text-right mt-1 font-bold">(編集済)</div>}</div>}
              {m.type === 'call_invite' && (
                  <div className="bg-white border rounded-2xl p-4 w-64 shadow-sm flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center animate-pulse">
                          {m.callType === 'video' ? <Video className="w-6 h-6 text-green-600"/> : <Phone className="w-6 h-6 text-green-600"/>}
                      </div>
                      <div className="font-bold text-center">
                          {m.callType === 'video' ? 'ビデオ通話' : '音声通話'}を開始しました
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); onJoinCall(m.callType === 'video', m.senderId); }} className="w-full bg-green-500 text-white font-bold py-2 rounded-xl shadow mt-2 hover:bg-green-600 transition-colors">
                          参加する
                      </button>
                  </div>
              )}
              {m.type === 'sticker' && (
                  <div className="relative group/sticker" onClick={handleStickerClick}>
                    <img src={m.content || ""} className="w-32 h-32 object-contain drop-shadow-sm hover:scale-105 transition-transform" />
                    {m.audio && <div className="absolute bottom-0 right-0 bg-black/20 text-white rounded-full p-1"><Volume2 className="w-3 h-3"/></div>}
                  </div>
              )}
              {(m.type === 'image' || m.type === 'video') && (<div className="relative">{isShowingPreview && !finalSrc ? (<div className="p-4 bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 min-w-[150px] min-h-[100px] border border-gray-200"><Loader2 className="animate-spin w-8 h-8 text-green-500"/><span className="text-[10px] text-gray-500 font-bold">{m.type === 'video' ? '動画を受信中...' : '画像を受信中...'}</span></div>) : (<div className="relative">{m.type === 'video' ? (<video src={finalSrc || ""} className={`max-w-full rounded-xl border border-white/50 shadow-md bg-black ${showMenu ? 'brightness-50 transition-all' : ''}`} controls playsInline preload="metadata"/>) : (<img src={finalSrc || ""} className={`max-w-full rounded-xl border border-white/50 shadow-md ${showMenu ? 'brightness-50 transition-all' : ''} ${isShowingPreview ? 'opacity-80 blur-[1px]' : ''}`} loading="lazy" />)}{m.type === 'video' && !isShowingPreview && !finalSrc && (<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"><div className="bg-black/30 rounded-full p-2 backdrop-blur-sm"><Play className="w-8 h-8 text-white fill-white opacity-90" /></div></div>)}{isShowingPreview && (<div className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> {isInvalidBlob ? "送信中..." : "受信中..."}</div>)}</div>)}{isMe && m.isUploading && <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm">送信中...</div>}</div>)}
              {m.type === 'audio' && (<div className="flex items-center gap-2 py-1 px-1">{loading ? (<Loader2 className="animate-spin w-4 h-4 text-gray-400"/>) : (<audio src={mediaSrc || ""} controls className="h-8 max-w-[200px]" />)}</div>)}
              {m.type === 'file' && (<div className="flex items-center gap-3 p-2 min-w-[200px]"><div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 border"><FileText className="w-6 h-6 text-gray-500" /></div><div className="flex-1 min-w-0"><div className="text-sm font-bold truncate">{m.fileName || '不明なファイル'}</div><div className="text-[10px] text-gray-400">{m.fileSize ? `${(m.fileSize / 1024).toFixed(1)} KB` : 'サイズ不明'}</div></div><button onClick={(e) => { e.stopPropagation(); handleDownload(); }} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin text-gray-500"/> : <Download className="w-4 h-4 text-gray-600"/>}</button></div>)}
              {m.type === 'contact' && (<div className="flex flex-col gap-2 min-w-[150px] p-1"><div className="text-[10px] font-bold text-gray-400 mb-1 border-b border-gray-100 pb-1">連絡先</div><div className="flex items-center gap-3"><img src={m.contactAvatar} className="w-10 h-10 rounded-full border shadow-sm" loading="lazy" /><span className="font-bold text-sm truncate">{m.contactName}</span></div>{!isMe && <button onClick={(e) => { e.stopPropagation(); addFriendById(m.contactId); }} className="bg-black/5 hover:bg-black/10 text-xs font-bold py-2 rounded-xl mt-1 w-full flex items-center justify-center gap-2"><UserPlus className="w-3 h-3" /> 友だち追加</button>}</div>)}
              <div className={`text-[8px] opacity-50 mt-1 text-right ${m.type === 'sticker' ? 'text-gray-500 font-bold bg-white/50 px-1 rounded' : ''}`}>{formatDateTime(m.createdAt)}</div>
              {showMenu && (<div className={`absolute top-full ${isMe ? 'right-0' : 'left-0'} mt-1 z-[100] flex flex-col bg-white rounded-xl shadow-2xl border overflow-hidden min-w-[180px] animate-in slide-in-from-top-2 duration-200`}><div className="flex justify-between items-center p-2 bg-gray-50 border-b gap-1 overflow-x-auto scrollbar-hide">{REACTION_EMOJIS.map(emoji => (<button key={emoji} onClick={(e) => { e.stopPropagation(); onReaction(m.id, emoji); setShowMenu(false); }} className="hover:scale-125 transition-transform text-lg p-1">{emoji}</button>))}</div><button onClick={(e) => { e.stopPropagation(); onReply(m); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left"><Reply className="w-4 h-4" />リプライ</button>{(m.type === 'image' || m.type === 'video') && (<button onClick={(e) => { e.stopPropagation(); onPreview(finalSrc, m.type); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"><Maximize className="w-4 h-4" />拡大表示</button>)}{m.type === 'file' && (<button onClick={(e) => { e.stopPropagation(); handleDownload(); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"><Download className="w-4 h-4" />保存</button>)}{m.type === 'text' && isMe && (<button onClick={(e) => { e.stopPropagation(); onEdit(m.id, m.content); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"><Edit2 className="w-4 h-4" />編集</button>)}{isMe && (<button onClick={(e) => { e.stopPropagation(); onDelete(m.id); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 text-xs font-bold text-red-500 text-left border-t border-gray-100"><Trash2 className="w-4 h-4" />送信取消</button>)}</div>)}
            </div>
          </div>
          {m.reactions && Object.keys(m.reactions).some(k => m.reactions[k]?.length > 0) && (<div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>{Object.entries(m.reactions).map(([emoji, uids]: any) => uids?.length > 0 && (<button key={emoji} onClick={() => onReaction(m.id, emoji)} title={getUserNames(uids)} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs shadow-sm border transition-all hover:scale-105 active:scale-95 ${uids.includes(user.uid) ? 'bg-white border-green-500 text-green-600 ring-1 ring-green-100' : 'bg-white border-gray-100 text-gray-600'}`}><span className="text-sm">{emoji}</span><span className="font-bold text-[10px]">{uids.length}</span></button>))}</div>)}
          {isMe && readCount > 0 && (<div className="text-[10px] font-bold text-green-600 mt-0.5">既読 {isGroup ? readCount : ''}</div>)}
        </div>
      </div>
    );
});

const PostItem = ({ post, user, allUsers, db, appId, profile }: any) => {
    const [commentText, setCommentText] = useState(''), [mediaSrc, setMediaSrc] = useState<string | null>(post.media), [isLoadingMedia, setIsLoadingMedia] = useState(false);
    const u = allUsers.find((x: any) => x.uid === post.userId), isLiked = post.likes?.includes(user?.uid);
    // Fixed: Defined isMe
    const isMe = post.userId === user.uid;

    useEffect(() => { 
        if (post.hasChunks && !mediaSrc) { 
            setIsLoadingMedia(true); 
            (async () => { 
                let base64Data = ""; 
                if (post.chunkCount) {
                     const chunkPromises = [];
                     for (let i = 0; i < post.chunkCount; i++) chunkPromises.push(getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id, 'chunks', `${i}`)));
                     const chunkDocs = await Promise.all(chunkPromises);
                     chunkDocs.forEach(d => { if (d.exists()) base64Data += d.data().data; });
                } else {
                     const snap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'posts', post.id, 'chunks'), orderBy('index', 'asc'))); 
                     snap.forEach(d => base64Data += d.data().data); 
                }
                if (base64Data) {
                    try {
                        const mimeType = post.mimeType || (post.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
                        const byteCharacters = atob(base64Data);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                        const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
                        setMediaSrc(URL.createObjectURL(blob));
                    } catch(e) { console.error("Post media load error", e); }
                }
                setIsLoadingMedia(false); 
            })(); 
        } 
    }, [post.id, post.chunkCount]);
    
    // Updated Cleanup Effect
    useEffect(() => { return () => { if (mediaSrc && mediaSrc.startsWith('blob:') && !isMe) URL.revokeObjectURL(mediaSrc); }; }, [mediaSrc, isMe]);
    
    const toggleLike = async () => await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id), { likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) });
    const submitComment = async () => { if (!commentText.trim()) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id), { comments: arrayUnion({ userId: user.uid, userName: profile.name, text: commentText, createdAt: new Date().toISOString() }) }); setCommentText(''); };
    return (
      <div className="bg-white p-4 mb-2 border-b">
        <div className="flex items-center gap-3 mb-3"><div className="relative"><img key={u?.avatar} src={u?.avatar} className="w-10 h-10 rounded-xl border" loading="lazy" />{isTodayBirthday(u?.birthday) && <span className="absolute -top-1 -right-1 text-xs">🎂</span>}</div><div className="font-bold text-sm">{u?.name}</div></div>
        <div className="text-sm mb-3 whitespace-pre-wrap">{post.content}</div>
        {(mediaSrc || isLoadingMedia) && <div className="mb-3 bg-gray-50 rounded-2xl flex items-center justify-center min-h-[100px]">{isLoadingMedia ? <Loader2 className="animate-spin w-5 h-5"/> : post.mediaType === 'video' ? <video src={mediaSrc || ""} className="w-full rounded-2xl max-h-96 bg-black" controls playsInline /> : <img src={mediaSrc || ""} className="w-full rounded-2xl max-h-96 object-cover" loading="lazy" />}</div>}
        <div className="flex items-center gap-6 py-2 border-y mb-3"><button onClick={toggleLike} className="flex items-center gap-1.5"><Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} /><span className="text-xs">{post.likes?.length || 0}</span></button><div className="flex items-center gap-1.5 text-gray-400"><MessageCircle className="w-5 h-5" /><span className="text-xs">{post.comments?.length || 0}</span></div></div>
        <div className="space-y-3 mb-4">{post.comments?.map((c: any, i: number) => <div key={i} className="bg-gray-50 rounded-2xl px-3 py-2"><div className="text-[10px] font-bold text-gray-500">{c.userName}</div><div className="text-xs">{c.text}</div></div>)}</div>
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1"><input className="flex-1 bg-transparent text-xs py-2 outline-none" placeholder="コメント..." value={commentText} onChange={e => setCommentText(e.target.value)} onKeyPress={e => e.key === 'Enter' && submitComment()} /><button onClick={submitComment} className="text-green-500"><Send className="w-4 h-4" /></button></div>
      </div>
    );
};

const GroupCreateView = ({ user, profile, allUsers, setView, showNotification }: any) => {
    const [groupName, setGroupName] = useState('');
    const [groupIcon, setGroupIcon] = useState("https://api.dicebear.com/7.x/shapes/svg?seed=group");
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const friendsList = allUsers.filter((u: any) => profile?.friends?.includes(u.uid));
    const toggleMember = (uid: string) => { setSelectedMembers(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]); };
    const handleCreate = async () => {
      if (profile?.isBanned) return showNotification("アカウントが利用停止されています 🚫");
      if (!groupName.trim()) return showNotification("グループ名を入力してください");
      if (selectedMembers.length === 0) return showNotification("メンバーを選択してください");
      const participants = [user.uid, ...selectedMembers];
      const newGroupChat = { name: groupName, icon: groupIcon, participants, isGroup: true, createdBy: user.uid, updatedAt: serverTimestamp(), lastMessage: { content: "グループを作成しました", senderId: user.uid } };
      try { const chatRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats'), newGroupChat); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatRef.id, 'messages'), { senderId: user.uid, content: `${profile.name}がグループを作成しました。`, type: 'text', createdAt: serverTimestamp(), readBy: [user.uid] }); showNotification("グループを作成しました"); setView('home'); } catch (err) { showNotification("作成に失敗しました"); }
    };
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 flex items-center gap-4 bg-white border-b sticky top-0 z-10"><ChevronLeft className="w-6 h-6 cursor-pointer" onClick={() => setView('home')} /><span className="font-bold flex-1">グループ作成</span><button onClick={handleCreate} className="text-green-500 font-bold text-sm">作成</button></div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          <div className="flex flex-col items-center gap-4"><div className="relative"><img src={groupIcon} className="w-24 h-24 rounded-3xl object-cover bg-gray-100 border shadow-sm" /><label className="absolute bottom-0 right-0 bg-green-500 p-2 rounded-full text-white cursor-pointer shadow-lg border-2 border-white"><CameraIcon className="w-4 h-4" /><input type="file" className="hidden" accept="image/*" onChange={e => handleCompressedUpload(e, (d: string) => setGroupIcon(d))} /></label></div><input className="w-full text-center text-lg font-bold border-b py-2 focus:outline-none focus:border-green-500" placeholder="グループ名を入力" value={groupName} onChange={e => setGroupName(e.target.value)} /></div>
          <div className="space-y-3"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">友だちを選択</h3><div className="divide-y border-y">{friendsList.map((f: any) => (<div key={f.uid} className="flex items-center gap-4 py-3 cursor-pointer" onClick={() => toggleMember(f.uid)}><div className="relative"><img src={f.avatar} className="w-10 h-10 rounded-xl object-cover border" /></div><span className="flex-1 font-bold text-sm">{f.name}</span><div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedMembers.includes(f.uid) ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}>{selectedMembers.includes(f.uid) && <Check className="w-4 h-4 text-white" />}</div></div>))}</div></div>
        </div>
      </div>
    );
};

const BirthdayCardBox = ({ user, setView }: any) => {
    const [myCards, setMyCards] = useState<any[]>([]);
    useEffect(() => {
      if (!user) return;
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'birthday_cards'), where('toUserId', '==', user.uid));
      const unsub = onSnapshot(q, (snap) => {
        const cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cards.sort((a: any, b: any) => (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0) - (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0));
        setMyCards(cards);
      });
      return () => unsub();
    }, [user]);
    const getColorClass = (color: string) => { switch(color) { case 'pink': return 'bg-pink-100 border-pink-200 text-pink-800'; case 'blue': return 'bg-blue-100 border-blue-200 text-blue-800'; case 'yellow': return 'bg-yellow-100 border-yellow-200 text-yellow-800'; case 'green': return 'bg-green-100 border-green-200 text-green-800'; default: return 'bg-white border-gray-200'; } };
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b flex items-center gap-4 sticky top-0 bg-white z-10 shrink-0"><ChevronLeft className="w-6 h-6 cursor-pointer" onClick={() => setView('home')} /><h1 className="text-xl font-bold flex items-center gap-2"><Gift className="w-6 h-6 text-pink-500"/> カードBOX</h1></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-gray-50">{myCards.length === 0 ? <div className="text-center py-20 text-gray-400 font-bold">カードはまだありません</div> : myCards.map(card => (<div key={card.id} className={`p-6 rounded-3xl border-2 shadow-sm relative ${getColorClass(card.color)}`}><div className="absolute top-4 right-4 text-4xl opacity-50">🎂</div><div className="font-bold text-lg mb-2">Happy Birthday!</div><div className="whitespace-pre-wrap text-sm font-medium mb-4">{card.message}</div><div className="flex items-center justify-between mt-4 pt-4 border-t border-black/10"><div className="text-xs font-bold opacity-70">From: {card.fromName}</div><div className="text-[10px] opacity-60">{formatDate(card.createdAt)}</div></div></div>))}</div>
      </div>
    );
};

const StickerEditor = ({ user, profile, onClose, showNotification }: any) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const cuttingSnapshotRef = useRef<ImageData | null>(null);
    const [color, setColor] = useState('#000000');
    const [lineWidth, setLineWidth] = useState(5);
    const [fontSize, setFontSize] = useState(24);
    const [createdStickers, setCreatedStickers] = useState<any[]>([]);
    const [packName, setPackName] = useState('');
    const [packDescription, setPackDescription] = useState('');
    const [isDrawing, setIsDrawing] = useState(false);
    const [mode, setMode] = useState('pen');
    const [textInput, setTextInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cutPoints, setCutPoints] = useState<{x: number, y: number}[]>([]);
    const [audioData, setAudioData] = useState<string | null>(null);
    const [isRecordingSticker, setIsRecordingSticker] = useState(false);
    const stickerMediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [textObjects, setTextObjects] = useState<any[]>([]);
    const [draggingTextId, setDraggingTextId] = useState<number | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = 250; canvas.height = 250;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 250, 250); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            }
        }
    }, []);

    const startDraw = (e: any) => {
        if (draggingTextId) return;
        const canvas = canvasRef.current; 
        if (!canvas) return;
        const ctx = canvas.getContext('2d'); 
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect(); 
        const x = (e.clientX || e.touches[0].clientX) - rect.left; 
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        if (mode === 'scissors') {
            setIsDrawing(true); setCutPoints([{x, y}]); cuttingSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height); ctx.beginPath(); ctx.moveTo(x, y); return;
        }
        ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current; 
        if (!canvas) return;
        const ctx = canvas.getContext('2d'); 
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect(); 
        const x = (e.clientX || e.touches[0].clientX) - rect.left; 
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        if (mode === 'scissors') {
            setCutPoints(prev => [...prev, {x, y}]); ctx.lineWidth = 2; ctx.strokeStyle = '#ff0000'; ctx.setLineDash([5, 5]); ctx.lineTo(x, y); ctx.stroke(); return;
        }
        ctx.strokeStyle = mode === 'eraser' ? '#ffffff' : color; ctx.lineWidth = mode === 'eraser' ? 20 : lineWidth; ctx.setLineDash([]); ctx.lineTo(x, y); ctx.stroke();
    };

    const endDraw = () => { if (mode === 'scissors' && isDrawing) { setIsDrawing(false); applyFreehandCut(); setCutPoints([]); cuttingSnapshotRef.current = null; return; } setIsDrawing(false); };
    const clearCanvas = () => { const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if(ctx && canvas) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); setTextObjects([]); setAudioData(null); }};
    
    const addText = () => { 
        if (!textInput) return; 
        const newText = { id: Date.now(), text: textInput, x: 125, y: 125, color: color, fontSize: fontSize };
        setTextObjects([...textObjects, newText]);
        setTextInput(''); 
        showNotification("テキストを追加しました。ドラッグして移動できます"); 
    };

    const handleTextMouseDown = (e: any, id: number) => {
        e.stopPropagation();
        setDraggingTextId(id);
    };

    const handleContainerMouseMove = (e: any) => {
        if (draggingTextId && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = (e.clientX || e.touches[0].clientX) - rect.left;
            const y = (e.clientY || e.touches[0].clientY) - rect.top;
            setTextObjects(prev => prev.map(t => t.id === draggingTextId ? { ...t, x, y } : t));
        }
    };

    const handleContainerMouseUp = () => {
        setDraggingTextId(null);
    };

    const handleImageUpload = (e: any) => {
        const file = e.target.files[0]; if (!file) return;
        handleCompressedUpload(e, (dataUrl: string) => {
             const img = new Image();
             img.onload = () => {
                 const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
                 if (ctx && canvas) {
                    let width = img.width; let height = img.height; const maxSize = 250;
                    if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
                    const x = (maxSize - width) / 2; const y = (maxSize - height) / 2;
                    ctx.drawImage(img, x, y, width, height);
                 }
             };
             img.src = dataUrl;
        });
        e.target.value = '';
    };

    const handleAudioUpload = (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev: any) => {
            setAudioData(ev.target.result);
            showNotification("音声を追加しました 🎵");
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const startStickerRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            stickerMediaRecorderRef.current = mediaRecorder;
            const chunks: Blob[] = [];
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    setAudioData(reader.result as string);
                    showNotification("録音しました 🎤");
                };
                reader.readAsDataURL(blob);
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            setIsRecordingSticker(true);
        } catch(e) {
            showNotification("マイクを使用できません");
        }
    };

    const stopStickerRecording = () => {
        if (stickerMediaRecorderRef.current && isRecordingSticker) {
            stickerMediaRecorderRef.current.stop();
            setIsRecordingSticker(false);
        }
    };

    const cutShape = (shape: string) => {
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); 
        if (!canvas || !ctx) return;
        const width = canvas.width; const height = canvas.height;
        const tempCanvas = document.createElement('canvas'); tempCanvas.width = width; tempCanvas.height = height; const tempCtx = tempCanvas.getContext('2d'); 
        if(!tempCtx) return;
        tempCtx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, width, height); ctx.save(); ctx.beginPath();
        if (shape === 'circle') { ctx.arc(width / 2, height / 2, width / 2, 0, Math.PI * 2); } 
        else if (shape === 'heart') { const topCurveHeight = height * 0.3; ctx.moveTo(width / 2, height * 0.2); ctx.bezierCurveTo(width / 2, 0, 0, 0, 0, topCurveHeight); ctx.bezierCurveTo(0, (height + topCurveHeight) / 2, width / 2, height * 0.9, width / 2, height); ctx.bezierCurveTo(width / 2, height * 0.9, width, (height + topCurveHeight) / 2, width, topCurveHeight); ctx.bezierCurveTo(width, 0, width / 2, 0, width / 2, height * 0.2); } 
        else if (shape === 'star') { const cx = width / 2; const cy = height / 2; const outerRadius = width / 2; const innerRadius = width / 4; const spikes = 5; let rot = Math.PI / 2 * 3; let x = cx; let y = cy; const step = Math.PI / spikes; ctx.moveTo(cx, cy - outerRadius); for (let i = 0; i < spikes; i++) { x = cx + Math.cos(rot) * outerRadius; y = cy + Math.sin(rot) * outerRadius; ctx.lineTo(x, y); rot += step; x = cx + Math.cos(rot) * innerRadius; y = cy + Math.sin(rot) * innerRadius; ctx.lineTo(x, y); rot += step; } ctx.lineTo(cx, cy - outerRadius); ctx.closePath(); }
        ctx.clip(); ctx.drawImage(tempCanvas, 0, 0); ctx.restore(); showNotification(`${shape === 'circle' ? '丸' : shape === 'heart' ? 'ハート' : '星'}型に切り抜きました`);
    };

    const applyFreehandCut = () => {
        if (cutPoints.length < 3 || !cuttingSnapshotRef.current) return;
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); 
        if (!canvas || !ctx) return;
        const width = canvas.width; const height = canvas.height;
        ctx.clearRect(0, 0, width, height); ctx.save(); ctx.beginPath(); ctx.moveTo(cutPoints[0].x, cutPoints[0].y); for (let i = 1; i < cutPoints.length; i++) ctx.lineTo(cutPoints[i].x, cutPoints[i].y); ctx.closePath(); ctx.clip();
        const tempCanvas = document.createElement('canvas'); tempCanvas.width = width; tempCanvas.height = height; const tempCtx = tempCanvas.getContext('2d'); 
        if(!tempCtx) return;
        tempCtx.putImageData(cuttingSnapshotRef.current, 0, 0); ctx.drawImage(tempCanvas, 0, 0); ctx.restore(); showNotification("自由に切り抜きました");
    };

    const saveStickerToPack = () => { 
        if (createdStickers.length >= 8) { showNotification("1パック最大8個までです"); return; } 
        const canvas = canvasRef.current; 
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        textObjects.forEach(t => {
            ctx.font = `bold ${t.fontSize}px sans-serif`;
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, t.x, t.y);
        });
        ctx.restore();

        const dataUrl = canvas.toDataURL('image/png', 0.8); 
        setCreatedStickers([...createdStickers, { image: dataUrl, audio: audioData }]); 
        clearCanvas(); 
        showNotification("パックに追加しました"); 
    };

    const submitPack = async () => {
        if (profile?.isBanned) return showNotification("アカウントが利用停止されています 🚫");
        if (!packName.trim()) return showNotification("パック名を入力してください"); if (createdStickers.length === 0) return showNotification("スタンプがありません");
        setIsSubmitting(true);
        try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sticker_packs'), { authorId: user.uid, authorName: profile?.name || user.displayName || 'Creator', name: packName, description: packDescription, stickers: createdStickers, price: 100, status: 'pending', purchasedBy: [], createdAt: serverTimestamp() }); showNotification("申請しました！承認されると報酬がもらえます"); onClose(); } catch (e) { console.error(e); showNotification("エラーが発生しました"); } finally { setIsSubmitting(false); }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b flex items-center justify-between"><button onClick={onClose}><ChevronLeft className="w-6 h-6"/></button><h2 className="font-bold">スタンプ作成スタジオ</h2><div className="w-6"></div></div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center gap-4">
                <div className="w-full max-w-xs space-y-2"><div><label className="text-xs font-bold text-gray-500 mb-1">パック名</label><input className="w-full border p-2 rounded-xl" placeholder="例: 面白うさぎセット" value={packName} onChange={e=>setPackName(e.target.value)} /></div><div><label className="text-xs font-bold text-gray-500 mb-1">説明文</label><input className="w-full border p-2 rounded-xl" placeholder="どんなスタンプですか？" value={packDescription} onChange={e=>setPackDescription(e.target.value)} /></div></div>
                <div 
                    ref={containerRef}
                    className="relative" 
                    style={{ width: '250px', height: '250px' }}
                    onMouseMove={handleContainerMouseMove}
                    onMouseUp={handleContainerMouseUp}
                    onTouchMove={handleContainerMouseMove}
                    onTouchEnd={handleContainerMouseUp}
                >
                    <canvas ref={canvasRef} className={`border-2 border-dashed ${mode === 'scissors' ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'} rounded-xl shadow-inner touch-none`} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} style={{ width: '100%', height: '100%' }}/>
                    {textObjects.map(t => (
                        <div 
                            key={t.id}
                            style={{ 
                                position: 'absolute', 
                                left: t.x, 
                                top: t.y, 
                                transform: 'translate(-50%, -50%)', 
                                color: t.color, 
                                fontSize: `${t.fontSize}px`, 
                                fontWeight: 'bold', 
                                cursor: 'move',
                                userSelect: 'none',
                                pointerEvents: 'auto'
                            }}
                            onMouseDown={(e) => handleTextMouseDown(e, t.id)}
                            onTouchStart={(e) => handleTextMouseDown(e, t.id)}
                        >
                            {t.text}
                        </div>
                    ))}
                    <label className="absolute top-2 right-2 bg-gray-100 p-2 rounded-full cursor-pointer hover:bg-gray-200" title="画像を読み込む"><Upload className="w-4 h-4 text-gray-600"/><input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} /></label>{mode === 'scissors' && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500 font-bold opacity-30 pointer-events-none text-xl">切り抜きモード</div>}
                    {audioData && <div className="absolute bottom-2 left-2 bg-green-100 text-green-600 p-1 rounded-full"><Music className="w-4 h-4"/></div>}
                </div>
                <div className="flex gap-2 items-center w-full max-w-xs justify-center flex-wrap"><button onClick={() => setMode('pen')} className={`p-3 rounded-full ${mode === 'pen' ? 'bg-black text-white' : 'bg-gray-100'}`}><PenTool className="w-5 h-5"/></button><button onClick={() => setMode('eraser')} className={`p-3 rounded-full ${mode === 'eraser' ? 'bg-black text-white' : 'bg-gray-100'}`}><Eraser className="w-5 h-5"/></button><button onClick={() => setMode('scissors')} className={`p-3 rounded-full ${mode === 'scissors' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100'}`} title="フリーハンド切り抜き"><Scissors className="w-5 h-5"/></button><div className="w-px h-8 bg-gray-300 mx-2"></div><button onClick={() => cutShape('circle')} className="p-3 rounded-full bg-blue-100 text-blue-600" title="丸く切り抜く"><Disc className="w-5 h-5"/></button><button onClick={() => cutShape('heart')} className="p-3 rounded-full bg-pink-100 text-pink-600" title="ハート型に切り抜く"><Heart className="w-5 h-5"/></button><button onClick={() => cutShape('star')} className="p-3 rounded-full bg-yellow-100 text-yellow-600" title="星型に切り抜く"><Star className="w-5 h-5"/></button></div>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                    <div className="flex gap-4 items-center justify-center">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-400">太さ</span>
                            <input type="range" min="1" max="20" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} className="w-20" />
                        </div>
                        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded-full overflow-hidden border-2" />
                        <div className="flex flex-col items-center">
                             <span className="text-[10px] text-gray-400">文字サイズ</span>
                             <input type="range" min="12" max="60" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-20" />
                        </div>
                    </div>
                    <div className="flex gap-2 items-center justify-center bg-gray-50 p-2 rounded-xl">
                        <label className="p-2 bg-white rounded-lg shadow-sm cursor-pointer flex items-center gap-1 text-xs font-bold"><Upload className="w-3 h-3"/> 音声読込<input type="file" className="hidden" accept="audio/*" onChange={handleAudioUpload} /></label>
                        {!isRecordingSticker ? (
                             <button onClick={startStickerRecording} className="p-2 bg-red-100 text-red-500 rounded-lg shadow-sm flex items-center gap-1 text-xs font-bold"><Mic className="w-3 h-3"/> 録音</button>
                        ) : (
                             <button onClick={stopStickerRecording} className="p-2 bg-red-500 text-white rounded-lg shadow-sm flex items-center gap-1 text-xs font-bold animate-pulse"><StopCircle className="w-3 h-3"/> 停止</button>
                        )}
                        {audioData && <button onClick={() => setAudioData(null)} className="p-2 bg-gray-200 rounded-lg text-xs font-bold">音声削除</button>}
                    </div>
                </div>
                <div className="flex gap-2 w-full max-w-xs"><input className="flex-1 border p-2 rounded-lg text-sm" placeholder="文字入れ..." value={textInput} onChange={e=>setTextInput(e.target.value)} /><button onClick={addText} className="bg-gray-200 p-2 rounded-lg text-xs font-bold">追加</button><button onClick={clearCanvas} className="bg-red-100 text-red-500 p-2 rounded-lg text-xs font-bold">全クリア</button></div>
                <button onClick={saveStickerToPack} className="w-full max-w-xs py-3 bg-blue-500 text-white font-bold rounded-2xl shadow-lg">このスタンプをパックに追加 ({createdStickers.length}/8)</button>
                {createdStickers.length > 0 && (<div className="w-full max-w-xs"><div className="text-xs font-bold text-gray-400 mb-2">作成済みリスト</div><div className="flex gap-2 overflow-x-auto pb-2">{createdStickers.map((s, i) => (<div key={i} className="relative"><img src={typeof s === 'string' ? s : s.image} className="w-16 h-16 border rounded bg-gray-50 object-contain" />{(typeof s !== 'string' && s.audio) && <div className="absolute bottom-0 right-0 bg-green-500 w-3 h-3 rounded-full border border-white"></div>}</div>))}</div></div>)}
                <div className="w-full h-10"></div>
            </div>
            <div className="p-4 border-t bg-white"><button onClick={submitPack} disabled={createdStickers.length === 0 || isSubmitting} className="w-full py-4 bg-green-500 text-white font-bold rounded-2xl shadow-xl disabled:bg-gray-300">{isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mx-auto"/> : '販売申請する (報酬は承認後)'}</button></div>
        </div>
    );
};

const StickerStoreView = ({ user, setView, showNotification, profile, allUsers }: any) => {
    const [packs, setPacks] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState('shop');
    const [activeShopTab, setActiveShopTab] = useState('stickers'); // stickers or effects
    const [adminSubTab, setAdminSubTab] = useState('stickers');
    const [adminMode, setAdminMode] = useState(false);
    const [adminPass, setAdminPass] = useState('');
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [banTarget, setBanTarget] = useState<any>(null);
    const [grantAmount, setGrantAmount] = useState('');
    // Effect marketplace (ユーザー出品)
    const [effectsMode, setEffectsMode] = useState<'market' | 'manage'>('market');
    const [marketEffects, setMarketEffects] = useState<any[]>([]);
    const [myEffects, setMyEffects] = useState<any[]>([]);
    const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
    const [updatingEffectId, setUpdatingEffectId] = useState<string | null>(null);


    // Predefined effects for sale (Hardcoded for demo)
    const effectsForSale = [
        { id: 'effect_fire', name: 'Fire', price: 500, description: '燃えるような情熱エフェクト', image: 'https://images.unsplash.com/photo-1486162928267-e6274cb3106f?w=200&q=80', filter: 'sepia(100%) hue-rotate(-50deg) saturate(300%)', creatorId: 'system' },
        { id: 'effect_ice', name: 'Ice', price: 500, description: 'クールな氷エフェクト', image: 'https://images.unsplash.com/photo-1549488497-69502a5c3289?w=200&q=80', filter: 'sepia(100%) hue-rotate(180deg) saturate(200%)', creatorId: 'system' },
        { id: 'effect_rainbow', name: 'Rainbow', price: 800, description: '虹色に輝くエフェクト', image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=200&q=80', filter: 'hue-rotate(90deg) saturate(200%)', creatorId: 'system' }
    ];

    useEffect(() => {
        if (activeTab === 'shop' && activeShopTab === 'stickers') {
             const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'sticker_packs'), where('status', '==', 'approved'));
             const unsub = onSnapshot(q, (snap) => { const fetchedPacks = snap.docs.map(d => ({ id: d.id, ...d.data() })); fetchedPacks.sort((a: any, b: any) => { const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds * 1000 || 0); const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds * 1000 || 0); return tB - tA; }); setPacks(fetchedPacks); }); return () => unsub();
        } else if (activeTab === 'admin' && adminSubTab === 'stickers') {
             const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'sticker_packs'), where('status', '==', 'pending'));
             const unsub = onSnapshot(q, (snap) => { const fetchedPacks = snap.docs.map(d => ({ id: d.id, ...d.data() })); setPacks(fetchedPacks); }); return () => unsub();
        }
    }, [activeTab, adminSubTab, activeShopTab]);

    // Effects: market listings + my effects (for sale management)
    useEffect(() => {
        if (!(activeTab === 'shop' && activeShopTab === 'effects')) return;

        // 1) Market: all effects where forSale == true (collectionGroup)
        const qMarket = query(collectionGroup(db, 'effects'), where('forSale', '==', true));
        const unsubMarket = onSnapshot(qMarket, (snap) => {
            const items = snap.docs.map((d: any) => ({ _key: d.ref.path, id: d.id, ref: d.ref, ...d.data() }));
            items.sort((a: any, b: any) => {
                const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds * 1000 || 0);
                const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds * 1000 || 0);
                return tB - tA;
            });
            setMarketEffects(items);
        });

        // 2) My effects (for managing sale/price)
        const qMine = query(collection(db, 'artifacts', appId, 'public', 'data', 'users', user.uid, 'effects'), orderBy('createdAt', 'desc'));
        const unsubMine = onSnapshot(qMine, (snap) => {
            const mine = snap.docs.map((d: any) => ({ id: d.id, ref: d.ref, ...d.data() }));
            setMyEffects(mine);

            // Initialize drafts (do not override when user is editing)
            setPriceDrafts((prev) => {
                const next = { ...prev };
                mine.forEach((ef: any) => {
                    if (next[ef.id] === undefined) next[ef.id] = ef.price !== undefined ? String(ef.price) : '';
                });
                return next;
            });
        });

        return () => {
            unsubMarket();
            unsubMine();
        };
    }, [activeTab, activeShopTab, user.uid]);


    const handleBuyEffect = async (effect: any) => {
        if (profile?.isBanned) return showNotification("アカウントが利用停止されています 🚫");
        if ((profile.wallet || 0) < effect.price) { showNotification("コインが足りません"); return; }
        
        // Check if already owned
        const userEffectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'users', user.uid, 'effects');
        const owned = await getDocs(query(userEffectsRef, where('name', '==', effect.name)));
        if (!owned.empty) { showNotification("既に持っています"); return; }

        setPurchasing(effect.id);
        try {
            await runTransaction(db, async (t) => {
                const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
                t.update(userRef, { wallet: increment(-effect.price) });
                const newEffectRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'users', user.uid, 'effects'));
                t.set(newEffectRef, { name: effect.name, image: effect.image, filter: effect.filter || null, type: 'premium', source: 'system', ownerId: user.uid, creatorId: effect.creatorId || 'system', forSale: false, price: 0, createdAt: serverTimestamp() });
            });
            showNotification(`${effect.name}を購入しました！`);
        } catch (e) { console.error(e); showNotification("購入に失敗しました"); } finally { setPurchasing(null); }
    };

    

    const handleBuyMarketEffect = async (effect: any) => {
        if (profile?.isBanned) return showNotification("アカウントが利用停止されています 🚫");
        const price = Number(effect?.price || 0);
        const sellerId = effect?.creatorId;
        if (!sellerId) { showNotification("販売者情報が見つかりません"); return; }
        if (sellerId === user.uid) { showNotification("自分の出品は購入できません"); return; }
        if (price <= 0 || !Number.isFinite(price)) { showNotification("価格が不正です"); return; }
        if ((profile.wallet || 0) < price) { showNotification("コインが足りません"); return; }

        // Check if already owned (name + creatorId)
        const userEffectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'users', user.uid, 'effects');
        let ownedQuery: any = query(userEffectsRef, where('name', '==', effect.name));
        if (sellerId) ownedQuery = query(userEffectsRef, where('name', '==', effect.name), where('creatorId', '==', sellerId));
        const owned = await getDocs(ownedQuery);
        if (!owned.empty) { showNotification("既に持っています"); return; }

        setPurchasing(effect._key || effect.id);
        try {
            await runTransaction(db, async (t) => {
                const buyerRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
                const sellerRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', sellerId);

                const buyerSnap = await t.get(buyerRef);
                const wallet = buyerSnap.data()?.wallet || 0;
                if (wallet < price) throw new Error("NOT_ENOUGH");

                t.update(buyerRef, { wallet: increment(-price) });
                if (sellerId !== 'system') t.update(sellerRef, { wallet: increment(price) });

                const newEffectRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'users', user.uid, 'effects'));
                t.set(newEffectRef, {
                    name: effect.name,
                    image: effect.image,
                    filter: effect.filter || null,
                    type: 'purchased',
                    source: 'market',
                    ownerId: user.uid,
                    creatorId: sellerId,
                    forSale: false,
                    price: 0,
                    purchasedPrice: price,
                    purchasedAt: serverTimestamp(),
                    createdAt: serverTimestamp()
                });

                if (effect?.ref) {
                    t.update(effect.ref, { soldCount: increment(1) });
                }
            });
            showNotification(`${effect.name}を購入しました！`);
        } catch (e: any) {
            console.error(e);
            showNotification(e?.message === "NOT_ENOUGH" ? "コインが足りません" : "購入に失敗しました");
        } finally {
            setPurchasing(null);
        }
    };

    const canSellMyEffect = (ef: any) => {
        // Only effects created by the user can be sold
        const creatorId = ef?.creatorId;
        if (creatorId) return creatorId === user.uid;
        // Backward compatibility: old created effects may not have creatorId
        if (ef?.type === 'premium' || ef?.source === 'system' || ef?.source === 'market') return false;
        return true;
    };

    const saveMyEffectPrice = async (ef: any) => {
        if (!ef?.ref) return;
        if (!canSellMyEffect(ef)) { showNotification("購入したエフェクトは販売できません"); return; }
        const raw = (priceDrafts[ef.id] || '').trim();
        const price = parseInt(raw, 10);
        if (isNaN(price) || price <= 0) { showNotification("価格は 1 以上の数字で入力してください"); return; }
        setUpdatingEffectId(ef.id);
        try {
            await updateDoc(ef.ref, { price, creatorId: ef.creatorId || user.uid, ownerId: ef.ownerId || user.uid });
            showNotification("価格を保存しました");
        } catch (e) {
            console.error(e);
            showNotification("保存に失敗しました");
        } finally {
            setUpdatingEffectId(null);
        }
    };

    const toggleMyEffectSale = async (ef: any, toForSale: boolean) => {
        if (!ef?.ref) return;
        if (!canSellMyEffect(ef)) { showNotification("購入したエフェクトは販売できません"); return; }

        if (toForSale) {
            const raw = (priceDrafts[ef.id] || '').trim();
            const price = parseInt(raw, 10);
            if (isNaN(price) || price <= 0) { showNotification("出品するには、価格を 1 以上で設定してください"); return; }

            setUpdatingEffectId(ef.id);
            try {
                await updateDoc(ef.ref, {
                    forSale: true,
                    price,
                    creatorId: ef.creatorId || user.uid,
                    ownerId: ef.ownerId || user.uid,
                    listedAt: serverTimestamp()
                });
                showNotification("ショップに出品しました");
            } catch (e) {
                console.error(e);
                showNotification("出品に失敗しました");
            } finally {
                setUpdatingEffectId(null);
            }
        } else {
            setUpdatingEffectId(ef.id);
            try {
                await updateDoc(ef.ref, { forSale: false });
                showNotification("出品を停止しました");
            } catch (e) {
                console.error(e);
                showNotification("更新に失敗しました");
            } finally {
                setUpdatingEffectId(null);
            }
        }
    };

    const handleBuy = async (pack: any) => {
        if (profile?.isBanned) return showNotification("アカウントが利用停止されています 🚫");
        if ((profile.wallet || 0) < pack.price) { showNotification("コインが足りません"); return; }
        if (pack.purchasedBy?.includes(user.uid) || pack.authorId === user.uid) { showNotification("既に入手済みです"); return; }
        setPurchasing(pack.id);
        try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { wallet: increment(-pack.price) }); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', pack.authorId), { wallet: increment(pack.price) }); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sticker_packs', pack.id), { purchasedBy: arrayUnion(user.uid) }); showNotification("購入しました！"); } catch (e) { console.error(e); showNotification("購入に失敗しました"); } finally { setPurchasing(null); }
    };
    const handleApprove = async (packId: string, authorId: string, approve: boolean) => {
        try {
            await runTransaction(db, async (transaction) => {
                const packRef = doc(db, 'artifacts', appId, 'public', 'data', 'sticker_packs', packId); const packDoc = await transaction.get(packRef);
                if (!packDoc.exists()) throw "Pack does not exist"; if (packDoc.data().status !== 'pending') throw "Already processed";
                transaction.update(packRef, { status: approve ? 'approved' : 'rejected' });
                if (approve) { const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', authorId); transaction.update(userRef, { wallet: increment(100) }); }
            });
            showNotification(approve ? "承認し、報酬を付与しました" : "却下しました");
        } catch(e) { console.error(e); showNotification(e === "Already processed" ? "既に処理済みの申請です" : "エラーが発生しました"); }
    };
    const executeBanToggle = async () => { if (!banTarget) return; try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', banTarget.uid), { isBanned: !banTarget.isBanned }); showNotification(banTarget.isBanned ? "制限を解除しました" : "ユーザーを利用停止にしました"); setBanTarget(null); } catch(e) { showNotification("エラーが発生しました"); } };
    const handleGrantCoins = async () => { if (!banTarget || !grantAmount) return; const amount = parseInt(grantAmount, 10); if (isNaN(amount) || amount === 0) { showNotification("有効な金額を入力してください"); return; } try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', banTarget.uid), { wallet: increment(amount) }); showNotification(`${banTarget.name}に ${amount} コインを付与しました`); setGrantAmount(''); setBanTarget(null); } catch (e) { console.error(e); showNotification("エラーが発生しました"); } };
    const attemptAdminLogin = () => { if (adminPass === 'admin123') { setAdminMode(true); showNotification("管理者モード"); } else { showNotification("パスワードが違います"); } };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10"><div className="flex items-center gap-2"><ChevronLeft className="w-6 h-6 cursor-pointer" onClick={() => setView('home')} /><h1 className="font-bold text-lg">スタンプショップ</h1></div><div className="flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full"><Coins className="w-4 h-4 text-yellow-600"/><span className="font-bold text-yellow-700">{profile?.wallet || 0}</span></div></div>
            <div className="flex border-b"><button onClick={() => setActiveTab('shop')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'shop' ? 'border-b-2 border-black' : 'text-gray-400'}`}>ショップ</button><button onClick={() => setView('sticker-create')} className="flex-1 py-3 text-sm font-bold text-blue-500 bg-blue-50">つくる (+100)</button><button onClick={() => setActiveTab('admin')} className={`flex-1 py-3 text-sm font-bold ${activeTab === 'admin' ? 'border-b-2 border-black' : 'text-gray-400'}`}>管理者</button></div>
            
            {activeTab === 'shop' && (
                <div className="flex gap-2 p-2 bg-gray-50">
                    <button onClick={() => setActiveShopTab('stickers')} className={`flex-1 py-1 text-xs font-bold rounded-lg ${activeShopTab === 'stickers' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>スタンプ</button>
                    <button onClick={() => setActiveShopTab('effects')} className={`flex-1 py-1 text-xs font-bold rounded-lg ${activeShopTab === 'effects' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>エフェクト</button>
                </div>
            )}

            {!adminMode && activeTab === 'admin' && (<div className="p-8 flex flex-col gap-4 items-center justify-center flex-1"><ShieldAlert className="w-16 h-16 text-gray-300" /><h3 className="font-bold text-center mb-2">管理者ログイン</h3><input type="password" value={adminPass} onChange={e=>setAdminPass(e.target.value)} className="border p-3 rounded-xl w-full max-w-xs text-center" placeholder="パスワードを入力" /><button onClick={attemptAdminLogin} className="bg-black text-white py-3 rounded-xl font-bold w-full max-w-xs shadow-lg">ログイン</button></div>)}
            {adminMode && activeTab === 'admin' && (<div className="flex bg-gray-50 p-2 gap-2"><button onClick={() => setAdminSubTab('stickers')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${adminSubTab === 'stickers' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>スタンプ承認</button><button onClick={() => setAdminSubTab('users')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${adminSubTab === 'users' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>ユーザー管理</button></div>)}
            
            {activeTab === 'shop' && activeShopTab === 'effects' && (
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 pb-2">
                        <div className="flex gap-2 p-2 bg-gray-50 rounded-2xl border">
                            <button onClick={() => setEffectsMode('market')} className={`flex-1 py-2 rounded-xl text-xs font-bold ${effectsMode === 'market' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>購入</button>
                            <button onClick={() => setEffectsMode('manage')} className={`flex-1 py-2 rounded-xl text-xs font-bold ${effectsMode === 'manage' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>出品管理</button>
                        </div>
                    </div>

                    {effectsMode === 'market' && (
                        <div className="p-4 pt-2 space-y-6">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-black text-gray-800">公式エフェクト</h3>
                                    <span className="text-[10px] font-bold text-gray-400">購入すると通話で使えます</span>
                                </div>
                                <div className="space-y-4">
                                    {effectsForSale.map((effect: any) => (
                                        <div key={effect.id} className="border rounded-2xl p-4 shadow-sm bg-white flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100"><img src={effect.image} className="w-full h-full object-cover"/></div>
                                            <div className="flex-1">
                                                <h4 className="font-bold">{effect.name}</h4>
                                                <p className="text-xs text-gray-500">{effect.description}</p>
                                            </div>
                                            <button onClick={() => handleBuyEffect(effect)} disabled={purchasing === effect.id} className="bg-purple-500 text-white px-4 py-2 rounded-full font-bold text-xs shadow-md hover:bg-purple-600 disabled:bg-gray-300 min-w-[60px]">
                                                {purchasing === effect.id ? <Loader2 className="w-4 h-4 animate-spin"/> : `¥${effect.price}`}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-black text-gray-800">ユーザー出品</h3>
                                    <span className="text-[10px] font-bold text-gray-400">あなたが作ったエフェクトも出品できます</span>
                                </div>

                                {marketEffects.filter((e: any) => e?.creatorId && e?.forSale).length === 0 ? (
                                    <div className="text-center py-10 text-gray-400 text-sm border rounded-2xl bg-white">出品中のエフェクトがありません</div>
                                ) : (
                                    <div className="space-y-4">
                                        {marketEffects.map((effect: any) => {
                                            const seller = allUsers.find((u: any) => u.uid === effect.creatorId);
                                            const isMine = effect.creatorId === user.uid;
                                            return (
                                                <div key={effect._key || effect.id} className="border rounded-2xl p-4 shadow-sm bg-white flex items-center gap-4">
                                                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100">
                                                        <img src={effect.image} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold truncate">{effect.name}</h4>
                                                            {isMine && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">自分の出品</span>}
                                                        </div>
                                                        <p className="text-xs text-gray-500 truncate">出品者: {seller?.name || effect.creatorId}</p>
                                                        <p className="text-[10px] text-gray-400">販売数: {effect.soldCount || 0}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleBuyMarketEffect(effect)}
                                                        disabled={isMine || purchasing === (effect._key || effect.id)}
                                                        className="bg-green-500 text-white px-4 py-2 rounded-full font-bold text-xs shadow-md hover:bg-green-600 disabled:bg-gray-300 min-w-[60px]"
                                                    >
                                                        {purchasing === (effect._key || effect.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : `¥${effect.price || 0}`}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {effectsMode === 'manage' && (
                        <div className="p-4 space-y-4">
                            <div className="bg-gray-50 border rounded-2xl p-4">
                                <div className="font-black text-gray-800 text-sm mb-1">自分のエフェクトを出品</div>
                                <p className="text-xs text-gray-600">自分で作ったエフェクトは、価格を設定してショップで販売できます。</p>
                                <p className="text-[10px] text-gray-400 mt-2">※購入したエフェクトは再販売できません</p>
                            </div>

                            {myEffects.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm border rounded-2xl bg-white">エフェクトがありません</div>
                            ) : (
                                <div className="space-y-3">
                                    {myEffects.map((ef: any) => {
                                        const isSelling = !!ef.forSale;
                                        const canSell = canSellMyEffect(ef);
                                        return (
                                            <div key={ef.id} className="border rounded-2xl p-4 bg-white shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100">
                                                        <img src={ef.image} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-bold truncate">{ef.name}</div>
                                                            {isSelling && <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">出品中</span>}
                                                            {!canSell && <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">購入品</span>}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400">販売数: {ef.soldCount || 0}</div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        step={1}
                                                        value={priceDrafts[ef.id] || ''}
                                                        disabled={!canSell || updatingEffectId === ef.id}
                                                        onChange={(e) => setPriceDrafts((prev) => ({ ...prev, [ef.id]: e.target.value }))}
                                                        className="flex-1 border p-3 rounded-xl text-center font-bold outline-none focus:border-purple-500 disabled:bg-gray-50"
                                                        placeholder="価格"
                                                    />
                                                    <button
                                                        onClick={() => saveMyEffectPrice(ef)}
                                                        disabled={!canSell || updatingEffectId === ef.id}
                                                        className="px-4 py-3 rounded-xl font-bold text-xs bg-gray-900 text-white disabled:bg-gray-300"
                                                    >
                                                        {updatingEffectId === ef.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
                                                    </button>
                                                </div>

                                                <div className="mt-2">
                                                    <button
                                                        onClick={() => toggleMyEffectSale(ef, !isSelling)}
                                                        disabled={!canSell || updatingEffectId === ef.id}
                                                        className={`w-full py-3 rounded-xl font-bold text-xs shadow-sm disabled:bg-gray-300 ${isSelling ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-green-500 text-white hover:bg-green-600'}`}
                                                    >
                                                        {isSelling ? "出品を停止する" : "ショップで販売する"}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}


            {(activeTab === 'shop' && activeShopTab === 'stickers') && (<div className="flex-1 overflow-y-auto p-4 space-y-4">{packs.length === 0 && <div className="text-center py-10 text-gray-400">スタンプがありません</div>}{packs.map(pack => { const isOwned = pack.purchasedBy?.includes(user.uid) || pack.authorId === user.uid; return (<div key={pack.id} className="border rounded-2xl p-4 shadow-sm bg-white"><div className="flex justify-between items-start mb-2"><div className="flex-1"><h3 className="font-bold text-lg">{pack.name}</h3><p className="text-xs text-gray-500 font-bold mb-1">作: {pack.authorName || '不明'}</p>{pack.description && <p className="text-xs text-gray-400 bg-gray-50 p-2 rounded-lg mb-2">{pack.description}</p>}</div>{!isOwned && activeTab === 'shop' && (<button onClick={() => handleBuy(pack)} disabled={purchasing === pack.id} className="bg-green-500 text-white px-4 py-2 rounded-full font-bold text-xs shadow-md hover:bg-green-600 disabled:bg-gray-300 shrink-0 ml-2">{purchasing === pack.id ? <Loader2 className="w-4 h-4 animate-spin"/> : `¥${pack.price}`}</button>)}{isOwned && activeTab === 'shop' && (<span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold shrink-0 ml-2">入手済み</span>)}</div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {pack.stickers.map((s: any, i: number) => (
                    <div key={i} className="relative flex-shrink-0">
                        <img 
                            src={typeof s === 'string' ? s : s.image} 
                            className="w-20 h-20 object-contain bg-gray-50 rounded-lg border" 
                        />
                        {(typeof s !== 'string' && s.audio) && <div className="absolute top-1 right-1 bg-green-500 w-2 h-2 rounded-full border border-white"></div>}
                    </div>
                ))}
            </div></div>); })}</div>)}

            {adminMode && activeTab === 'admin' && adminSubTab === 'stickers' && (<div className="flex-1 overflow-y-auto p-4 space-y-4">{packs.length === 0 && <div className="text-center py-10 text-gray-400">申請中のスタンプはありません</div>}{packs.map(pack => (<div key={pack.id} className="border rounded-2xl p-4 shadow-sm bg-white"><div className="flex justify-between items-start mb-2"><div className="flex-1"><h3 className="font-bold text-lg">{pack.name}</h3><p className="text-xs text-gray-500 font-bold mb-1">作: {pack.authorName || '不明'}</p></div></div><div className="grid grid-cols-4 gap-2 mt-2">{pack.stickers.map((s: any, i: number) => (<img key={i} src={typeof s === 'string' ? s : s.image} className="w-full aspect-square object-contain bg-gray-50 rounded-lg border"/>))}</div><div className="flex gap-2 mt-4 pt-2 border-t"><button onClick={() => handleApprove(pack.id, pack.authorId, true)} className="flex-1 py-2 bg-blue-500 text-white rounded-lg font-bold text-xs">承認 (+100コイン)</button><button onClick={() => handleApprove(pack.id, pack.authorId, false)} className="flex-1 py-2 bg-red-500 text-white rounded-lg font-bold text-xs">拒否</button></div></div>))}</div>)}
            {adminMode && activeTab === 'admin' && adminSubTab === 'users' && (<div className="flex-1 overflow-y-auto p-4 space-y-2">{allUsers.map((u: any) => (<div key={u.uid} className={`flex items-center gap-3 p-3 rounded-xl border ${u.isBanned ? 'bg-red-50 border-red-200' : 'bg-white'}`}><img src={u.avatar} className="w-10 h-10 rounded-full border" /><div className="flex-1 min-w-0"><div className="font-bold text-sm truncate">{u.name}</div><div className="text-xs text-gray-400 font-mono">{u.id}</div></div><button onClick={() => setBanTarget(u)} className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white ${u.isBanned ? 'bg-gray-500' : 'bg-red-500'}`}>管理</button></div>))}</div>)}
            {banTarget && (<div className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[80vh]"><h3 className="font-bold text-lg mb-1 text-center text-gray-900">ユーザー管理: {banTarget.name}</h3><p className="text-center text-gray-400 text-xs mb-6 font-mono">{banTarget.id}</p><div className="mb-6 pb-6 border-b"><h4 className="font-bold text-sm text-gray-700 mb-2">利用制限</h4><p className="text-sm text-gray-600 mb-3">{banTarget.isBanned ? "現在は停止中です。解除しますか？" : "現在利用可能です。停止しますか？"}</p><button onClick={executeBanToggle} className={`w-full py-3 font-bold rounded-2xl text-white transition-colors ${banTarget.isBanned ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'}`}>{banTarget.isBanned ? "制限を解除する" : "アカウントを停止する"}</button></div><div className="mb-6"><h4 className="font-bold text-sm text-gray-700 mb-2">コイン操作</h4><div className="flex items-center justify-between bg-yellow-50 p-3 rounded-xl mb-3"><span className="text-xs font-bold text-yellow-800">現在の所持コイン</span><span className="text-lg font-bold text-yellow-600">{banTarget.wallet || 0}</span></div><div className="flex gap-2"><input type="number" placeholder="金額 (-で没収)" className="flex-1 border p-3 rounded-xl text-center font-bold outline-none focus:border-yellow-500" value={grantAmount} onChange={e => setGrantAmount(e.target.value)} /><button onClick={handleGrantCoins} className="bg-yellow-500 text-white font-bold px-6 rounded-xl hover:bg-yellow-600 shadow-md">付与</button></div><p className="text-[10px] text-gray-400 mt-2 text-center">※マイナスの値を入力すると減算されます</p></div><button onClick={() => { setBanTarget(null); setGrantAmount(''); }} className="w-full py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-2xl text-gray-600 transition-colors">閉じる</button></div></div>)}
        </div>
    );
};

const ChatRoomView = ({ user, profile, allUsers, chats, activeChatId, setActiveChatId, setView, db, appId, mutedChats, toggleMuteChat, showNotification, addFriendById, startVideoCall }: any) => {
    const [messages, setMessages] = useState<any[]>([]);
    const [text, setText] = useState('');
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
    const [previewMedia, setPreviewMedia] = useState<any>(null); 
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [replyTo, setReplyTo] = useState<any>(null); 
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const recordingIntervalRef = useRef<any>(null);
    const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const isFirstLoad = useRef(true);
    const [messageLimit, setMessageLimit] = useState(50);
    const lastMessageIdRef = useRef<string | null>(null);
    const [backgroundSrc, setBackgroundSrc] = useState<string | null>(null);
    const [stickerMenuOpen, setStickerMenuOpen] = useState(false); 
    const [myStickerPacks, setMyStickerPacks] = useState<any[]>([]);
    const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
    const [buyStickerModalPackId, setBuyStickerModalPackId] = useState<string | null>(null);
    const [viewProfile, setViewProfile] = useState<any>(null);
    const [coinModalTarget, setCoinModalTarget] = useState<any>(null);
    
    // AI Effect States
    const [aiEffectModalOpen, setAiEffectModalOpen] = useState(false);

    // Derived values moved up (Safe access with optional chaining)
    const chatData = chats.find((c: any) => c.id === activeChatId);
    const isGroup = chatData?.isGroup || false;
    let partnerId: string | null = null;
    let partnerData = null;

    if (chatData && !isGroup) {
        partnerId = chatData.participants.find((p: string) => p !== user.uid);
        if (!partnerId) partnerId = user.uid; 
        partnerData = allUsers.find((u: any) => u.uid === partnerId);
    }

    const title = !isGroup && partnerData ? partnerData.name : (chatData?.name || '');
    const icon = !isGroup && partnerData ? partnerData.avatar : (chatData?.icon || '');

    // --- Added missing functions definitions ---
    const onStickerClick = (packId: string) => {
        setBuyStickerModalPackId(packId);
    };

    const sendBirthdayCard = async ({ color, message }: any) => {
        if (!partnerId) {
             showNotification("送信先が見つかりません");
             return;
        }
        try {
             await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'birthday_cards'), {
                 fromId: user.uid,
                 fromName: profile.name,
                 toUserId: partnerId,
                 message: message,
                 color: color,
                 createdAt: serverTimestamp()
             });
             showNotification("バースデーカードを送信しました！🎂");
             setCardModalOpen(false);
        } catch (e) {
             console.error(e);
             showNotification("送信に失敗しました");
        }
    };
    
    // Join call wrapper
    const handleJoinCall = (isVideo: boolean, callerId?: string) => {
         startVideoCall(activeChatId, isVideo, true, callerId); // true = join existing
    };
    // ------------------------------------------

    useEffect(() => {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'sticker_packs'), where('purchasedBy', 'array-contains', user.uid));
        const unsub = onSnapshot(q, (snap) => {
            const packs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const q2 = query(collection(db, 'artifacts', appId, 'public', 'data', 'sticker_packs'), where('authorId', '==', user.uid));
            getDocs(q2).then(snap2 => {
                const ownPacks = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
                const all = [...packs, ...ownPacks];
                const unique = Array.from(new Map(all.map((item: any) => [item.id, item])).values());
                setMyStickerPacks(unique);
                if (unique.length > 0 && !selectedPackId) setSelectedPackId(unique[0].id);
            });
        });
        return () => unsub();
    }, [user.uid]);

    useEffect(() => { isFirstLoad.current = true; }, [activeChatId]);
    useEffect(() => { if (!activeChatId) return; const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages'), orderBy('createdAt', 'asc'), limitToLast(messageLimit)); const unsub = onSnapshot(q, (snap) => { setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }); return () => unsub(); }, [activeChatId, messageLimit]);
    
    // Mark messages as read when opening chat & Reset Unread Counter
    useEffect(() => { 
        if (!activeChatId) return; 
        
        // 1. Reset unread count for this user
        const resetUnreadCount = async () => {
             try {
                 await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId), {
                    [`unreadCounts.${user.uid}`]: 0,
                    // また、チャット一覧の最後のメッセージも既読にする
                    "lastMessage.readBy": arrayUnion(user.uid)
                 });
             } catch (e) {
                 // 新規チャットなどでドキュメントがない場合のエラーは無視
                 console.error("Failed to reset unread count", e);
             }
        };
        resetUnreadCount();

        if (!messages.length) return;

        const unreadMsgs = messages.filter(m => m.senderId !== user.uid && !m.readBy?.includes(user.uid));
        if (unreadMsgs.length > 0) {
            // 2. Mark individual messages as read (for tick marks inside chat)
            unreadMsgs.forEach(async (m) => { 
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages', m.id), { readBy: arrayUnion(user.uid) }); 
            }); 
        }
    }, [messages, activeChatId, user.uid]);

    useEffect(() => { if (messages.length > 0) { const lastMsg = messages[messages.length - 1]; if (isFirstLoad.current || lastMsg?.id !== lastMessageIdRef.current) { scrollRef.current?.scrollIntoView({ behavior: 'auto' }); lastMessageIdRef.current = lastMsg?.id; } isFirstLoad.current = false; } }, [messages]);
    
    // Background loading effect
    useEffect(() => { 
        if (!chatData) return; 
        const loadBackground = async () => { if (chatData.hasBackgroundChunks) { try { const chunksSnap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'background_chunks'), orderBy('index', 'asc'))); let data = ""; chunksSnap.forEach(d => data += d.data().data); setBackgroundSrc(data); } catch (e) { console.error("Failed to load background chunks", e); } } else if (chatData.backgroundImage) { setBackgroundSrc(chatData.backgroundImage); } else { setBackgroundSrc(null); } }; loadBackground(); 
    }, [chatData?.id, chatData?.updatedAt, chatData?.hasBackgroundChunks, chatData?.backgroundImage, activeChatId]);

    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mediaRecorderRef.current.onstop = () => {
          if (audioChunksRef.current.length === 0) return;
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], "voice.webm", { type: 'audio/webm', lastModified: Date.now() });
          sendMessage("", 'audio', {}, audioFile);
          if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach(t => t.stop()); audioStreamRef.current = null; }
        };
        mediaRecorderRef.current.start();
        setIsRecording(true);
        setRecordingTime(0);
        recordingIntervalRef.current = setInterval(() => { setRecordingTime(prev => prev + 1); }, 1000);
      } catch (err) { console.error(err); showNotification("マイクの利用を許可してください"); }
    };

    const stopRecording = () => { 
      if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); clearInterval(recordingIntervalRef.current); } 
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = () => { if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach(t => t.stop()); audioStreamRef.current = null; } };
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingIntervalRef.current);
            audioChunksRef.current = []; 
            showNotification("録音をキャンセルしました");
        }
    };

    const sendMessage = async (content: string, type = 'text', additionalData = {}, file: File | null = null) => {
      if (profile?.isBanned) return showNotification("アカウントが利用停止されています 🚫");
      if ((!content && !file && type === 'text') || isUploading) return;
      setIsUploading(true); setUploadProgress(0);
      const currentReply = replyTo; setReplyTo(null);
      setStickerMenuOpen(false); 
      
      try {
        const msgCol = collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages');
        const newMsgRef = doc(msgCol);
        let localBlobUrl = null; let storedContent = content; let previewData = null;
        const replyData = currentReply ? { replyTo: { id: currentReply.id, content: currentReply.content, senderName: allUsers.find((u: any) => u.uid === currentReply.senderId)?.name || 'Unknown', type: currentReply.type } } : {};
        const fileData = file ? { fileName: file.name, fileSize: file.size, mimeType: file.type } : {};

        // Prepare updates for the chat document (unread counts, last message)
        const currentChat = chats.find((c: any) => c.id === activeChatId);
        const updateData: any = { 
            lastMessage: { content: type === 'text' ? content : `[${type}]`, senderId: user.uid, readBy: [user.uid] }, 
            updatedAt: serverTimestamp() 
        };
        
        // Increment unread count for other participants
        if (currentChat) {
            currentChat.participants.forEach((uid: string) => {
                if (uid !== user.uid) {
                    updateData[`unreadCounts.${uid}`] = increment(1);
                }
            });
        }

        if (file && ['image', 'video', 'audio', 'file'].includes(type)) {
            localBlobUrl = URL.createObjectURL(file); storedContent = localBlobUrl;
            if (['image', 'video'].includes(type)) { previewData = await generateThumbnail(file); }
            await setDoc(newMsgRef, { senderId: user.uid, content: storedContent, type, preview: previewData, ...additionalData, ...replyData, ...fileData, hasChunks: false, chunkCount: 0, isUploading: true, createdAt: serverTimestamp(), readBy: [user.uid] });
            
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId), updateData);
            
            setText(''); setPlusMenuOpen(false); setContactModalOpen(false);
            setTimeout(() => { scrollRef.current?.scrollIntoView({ behavior: 'auto' }); }, 100);
        }

        let hasChunks = false, chunkCount = 0;
        if (file && file.size > CHUNK_SIZE) {
          hasChunks = true; chunkCount = Math.ceil(file.size / CHUNK_SIZE);
          const CONCURRENCY = 100; // Increased concurrency
          const executing = new Set();
          let completed = 0;

          for (let i = 0; i < chunkCount; i++) {
            const start = i * CHUNK_SIZE; const end = Math.min(start + CHUNK_SIZE, file.size); const blobSlice = file.slice(start, end);
            const p = new Promise((resolve, reject) => {
                const reader = new FileReader(); 
                reader.onload = async (e: any) => { 
                    try {
                        const base64Data = e.target.result.split(',')[1]; 
                        await setDoc(doc(msgCol, newMsgRef.id, 'chunks', `${i}`), { data: base64Data, index: i }); 
                        completed++;
                        setUploadProgress(Math.round((completed / chunkCount) * 100));
                        resolve(null);
                    } catch(err) { reject(err); }
                };
                reader.onerror = reject;
                reader.readAsDataURL(blobSlice);
            });
            // FIX: Explicit type to break circular inference cycle
            const pWrapper: Promise<boolean> = p.then(() => executing.delete(pWrapper));
            executing.add(pWrapper);
            if (executing.size >= CONCURRENCY) { await Promise.race(executing); }
          }
          await Promise.all(executing);
          await updateDoc(newMsgRef, { hasChunks: true, chunkCount: chunkCount, isUploading: false });
        } else if (!hasChunks) {
             if (localBlobUrl && file) {
                 const reader = new FileReader(); reader.readAsDataURL(file);
                 await new Promise(resolve => { reader.onload = async (e: any) => { await updateDoc(newMsgRef, { content: e.target.result, isUploading: false }); resolve(null); } });
             } else {
                 if (typeof content === 'object' && content !== null && type === 'sticker') { // Handle sticker object with audio
                     const stickerContent = (content as any).image || content;
                     const stickerAudio = (content as any).audio || null;
                     await setDoc(newMsgRef, { senderId: user.uid, content: stickerContent, audio: stickerAudio, type, ...additionalData, ...replyData, ...fileData, hasChunks, chunkCount, createdAt: serverTimestamp(), readBy: [user.uid] });
                 } else {
                     await setDoc(newMsgRef, { senderId: user.uid, content: storedContent, type, ...additionalData, ...replyData, ...fileData, hasChunks, chunkCount, createdAt: serverTimestamp(), readBy: [user.uid] });
                 }
                 
                 await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId), updateData);
                 
                 setText(''); setPlusMenuOpen(false); setContactModalOpen(false);
                 setTimeout(() => { scrollRef.current?.scrollIntoView({ behavior: 'auto' }); }, 100);
             }
        }
      } catch (e) { console.error(e); showNotification("送信に失敗しました"); } finally { setIsUploading(false); setUploadProgress(0); }
    };

    const handleDeleteMessage = useCallback(async (msgId: string) => { try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages', msgId)); const c = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages', msgId, 'chunks')); for (const d of c.docs) await deleteDoc(d.ref); showNotification("メッセージの送信を取り消しました"); } catch (e) { showNotification("送信取消に失敗しました"); } }, [db, appId, activeChatId, showNotification]);
    const handleEditMessage = useCallback((id: string, content: string) => { setEditingMsgId(id); setEditingText(content); }, []);
    const handlePreviewMedia = useCallback((src: string, type: string) => { setPreviewMedia({ src, type }); }, []);
    const handleReaction = async (messageId: string, emoji: string) => { try { const msgRef = doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages', messageId); const msg = messages.find(m => m.id === messageId); const currentReactions = msg.reactions?.[emoji] || []; if (currentReactions.includes(user.uid)) { await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(user.uid) }); } else { await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(user.uid) }); } } catch (e) { console.error("Reaction error", e); } };
    const submitEditMessage = async () => { if (!editingText.trim() || !editingMsgId) return; try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages', editingMsgId), { content: editingText, isEdited: true, updatedAt: serverTimestamp() }); setEditingMsgId(null); } catch (e) { showNotification("編集に失敗しました"); } };
    const handleLeaveGroup = async () => { if (!activeChatId) return; try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages'), { senderId: user.uid, content: `${profile.name}が退会しました。`, type: 'text', createdAt: serverTimestamp(), readBy: [user.uid] }); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId), { participants: arrayRemove(user.uid) }); showNotification("グループから退会しました"); setLeaveModalOpen(false); setView('home'); setActiveChatId(null); } catch (e) { showNotification("退会に失敗しました"); } };
    const handleBackgroundUpload = async (e: any) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event: any) => {
        const result = event.target.result;
        try {
          const batch = writeBatch(db); const chatRef = doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId);
          const oldChunksSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'background_chunks')); oldChunksSnap.forEach(d => batch.delete(d.ref)); await batch.commit();
          const newBatch = writeBatch(db); let hasChunks = false; let chunkCount = 0;
          if (result.length > CHUNK_SIZE) {
             hasChunks = true; chunkCount = Math.ceil(result.length / CHUNK_SIZE);
             for (let i = 0; i < chunkCount; i++) { const chunkRef = doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'background_chunks', `${i}`); newBatch.set(chunkRef, { data: result.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), index: i }); }
             newBatch.update(chatRef, { backgroundImage: deleteField(), hasBackgroundChunks: true, backgroundChunkCount: chunkCount, updatedAt: serverTimestamp() });
          } else { newBatch.update(chatRef, { backgroundImage: result, hasBackgroundChunks: false, backgroundChunkCount: 0, updatedAt: serverTimestamp() }); }
          await newBatch.commit(); showNotification("背景を変更しました"); setBackgroundMenuOpen(false);
        } catch(e) { console.error(e); showNotification("背景の変更に失敗しました"); }
      }; reader.readAsDataURL(file);
    };
    const resetBackground = async () => { try { const batch = writeBatch(db); const chatRef = doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId); const chunksSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'background_chunks')); chunksSnap.forEach(d => batch.delete(d.ref)); batch.update(chatRef, { backgroundImage: deleteField(), hasBackgroundChunks: deleteField(), backgroundChunkCount: deleteField(), updatedAt: serverTimestamp() }); await batch.commit(); showNotification("背景をリセットしました"); setBackgroundMenuOpen(false); } catch(e) { showNotification("リセットに失敗しました"); } };
    
    const handleVideoCallButton = (isVideo: boolean) => {
       startVideoCall(activeChatId, isVideo);
    };

    // Render-time check (Safe return now)
    if (!chatData) return <div className="h-full flex items-center justify-center bg-white"><Loader2 className="w-8 h-8 animate-spin text-gray-400"/></div>;

    return (
      <div className="flex flex-col h-full relative" style={{ backgroundColor: backgroundSrc ? 'transparent' : '#8fb2c9', backgroundImage: backgroundSrc ? `url(${backgroundSrc})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="p-3 bg-white/95 backdrop-blur border-b flex items-center gap-3 sticky top-0 z-10 shadow-sm">
          <ChevronLeft className="w-6 h-6 cursor-pointer" onClick={() => setView('home')} />
          <div className="relative"><img key={icon} src={icon} className="w-10 h-10 rounded-xl object-cover border" />{!isGroup && partnerData && isTodayBirthday(partnerData.birthday) && <span className="absolute -top-1 -right-1 text-xs">🎂</span>}</div>
          {!isGroup ? (
  <div className="font-bold text-sm flex-1 truncate">{title}</div>
) : (
  <div className="flex-1" />
)}
          <div className="flex gap-4 mr-2 items-center">
            <div className="relative"><button onClick={() => setBackgroundMenuOpen(!backgroundMenuOpen)} className="hover:bg-gray-100 p-1 rounded-full transition-colors" title="背景を変更"><Palette className="w-6 h-6 text-gray-600" /></button>{backgroundMenuOpen && (<div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border overflow-hidden w-40 z-20"><label className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm font-bold text-gray-700"><ImageIcon className="w-4 h-4" /><span>画像を選択</span><input type="file" className="hidden" accept="image/*" onChange={handleBackgroundUpload} /></label><button onClick={resetBackground} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-red-50 text-sm font-bold text-red-500 border-t"><RefreshCcw className="w-4 h-4" /><span>リセット</span></button></div>)}</div>
            {isGroup && (
  <button
    onClick={() => setGroupSettingsOpen(true)}
    className="hover:bg-gray-100 p-1 rounded-full transition-colors"
    title="グループ設定"
  >
    <Settings className="w-6 h-6 text-gray-600" />
  </button>
)}
            {/* AI Effect Button */}
            <button onClick={() => setAiEffectModalOpen(true)} className="hover:bg-purple-100 p-1 rounded-full transition-colors" title="AIエフェクト生成"><Wand2 className="w-6 h-6 text-purple-600" /></button>
            
            <button onClick={() => handleVideoCallButton(true)} className="hover:bg-gray-100 p-1 rounded-full transition-colors" title="ビデオ通話"><Video className="w-6 h-6 text-gray-600" /></button>
            <button onClick={() => handleVideoCallButton(false)} className="hover:bg-gray-100 p-1 rounded-full transition-colors" title="音声通話"><Phone className="w-6 h-6 text-gray-600" /></button>
            <button onClick={() => toggleMuteChat(activeChatId)}>{mutedChats.includes(activeChatId) ? <BellOff className="w-6 h-6 text-gray-400" /> : <Bell className="w-6 h-6 text-gray-600" />}</button>
          </div>
        
{groupSettingsOpen && isGroup && (
  <div
    className="fixed inset-0 z-[250] bg-black/40 flex items-end"
    onClick={() => setGroupSettingsOpen(false)}
  >
    <div
      className="w-full bg-white rounded-t-[32px] p-5 shadow-2xl max-h-[80vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 mb-4">
        <img src={chatData.icon} className="w-14 h-14 rounded-2xl object-cover border" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg truncate">{chatData.name}</div>
          <div className="text-xs text-gray-400 font-bold">{chatData.participants.length} 人</div>
          <div className="text-[10px] text-gray-300 font-mono mt-0.5 truncate">
            ChatID: {activeChatId}
          </div>
        </div>
        <button
          onClick={() => setGroupSettingsOpen(false)}
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
          aria-label="閉じる"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={() => { setGroupSettingsOpen(false); setGroupEditModalOpen(true); }}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-gray-900 text-white font-bold text-sm"
        >
          <Settings className="w-5 h-5" /> グループ編集
        </button>
        <button
          onClick={() => { setGroupSettingsOpen(false); setAddMemberModalOpen(true); }}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm"
        >
          <UserPlus className="w-5 h-5" /> メンバー追加
        </button>
      </div>

      <div className="mb-4">
        <div className="text-xs font-bold text-gray-500 mb-2">メンバー</div>
        <div className="space-y-2">
          {chatData.participants.map((uid: string) => {
            const u = allUsers.find((x: any) => x.uid === uid);
            if (!u) return null;
            const me = uid === user.uid;
            return (
              <div
                key={uid}
                className="flex items-center gap-3 p-3 rounded-2xl border bg-white hover:bg-gray-50 cursor-pointer"
                onClick={() => { setGroupSettingsOpen(false); setViewProfile(u); }}
              >
                <img src={u.avatar} className="w-10 h-10 rounded-xl object-cover border" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">
                    {u.name}{me ? '（あなた）' : ''}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono truncate">{u.id}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => { setGroupSettingsOpen(false); setLeaveModalOpen(true); }}
        className="w-full py-3 rounded-2xl bg-red-500 text-white font-bold flex items-center justify-center gap-2 hover:bg-red-600"
      >
        <LogOut className="w-5 h-5" /> グループを退会
      </button>

      <div className="h-3" />
    </div>
  </div>
)}
</div>
        {!isGroup && partnerId && isTodayBirthday(allUsers.find((u: any) => u.uid === partnerId)?.birthday) && (<div className="bg-pink-100 p-2 flex items-center justify-between px-4"><div className="flex items-center gap-2"><Cake className="w-5 h-5 text-pink-500 animate-bounce" /><span className="text-xs font-bold text-pink-700">今日は{title}さんの誕生日です！</span></div><button onClick={() => setCardModalOpen(true)} className="bg-pink-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">カードを書く</button></div>)}
        <div className={`flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide ${backgroundSrc ? 'bg-white/40 backdrop-blur-sm' : ''}`}>
          {messages.length >= messageLimit && (<div className="flex justify-center py-2"><button onClick={() => setMessageLimit(prev => prev + 50)} className="bg-white/50 backdrop-blur-md px-4 py-1 rounded-full text-xs font-bold text-gray-700 shadow-sm flex items-center gap-1 hover:bg-white/70"><ArrowUpCircle className="w-4 h-4" /> 以前のメッセージを読み込む</button></div>)}
          {messages.map(m => { const sender = allUsers.find((u: any) => u.uid === m.senderId); return (<MessageItem key={m.id} m={m} user={user} sender={sender} isGroup={isGroup} db={db} appId={appId} chatId={activeChatId} addFriendById={addFriendById} onEdit={handleEditMessage} onDelete={handleDeleteMessage} onPreview={handlePreviewMedia} onReply={setReplyTo} onReaction={handleReaction} allUsers={allUsers} onStickerClick={onStickerClick} onShowProfile={setViewProfile} onJoinCall={handleJoinCall} />); })}
          <div ref={scrollRef} className="h-2 w-full" />
        </div>
        {previewMedia && (<div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4" onClick={() => setPreviewMedia(null)}><button className="absolute top-6 right-6 text-white p-2 rounded-full bg-white/20"><X className="w-6 h-6"/></button>{previewMedia.type === 'video' ? <video src={previewMedia.src} controls autoPlay className="max-w-full max-h-[85vh] rounded shadow-2xl" onClick={e=>e.stopPropagation()}/> : <img src={previewMedia.src} className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl" onClick={e=>e.stopPropagation()}/>}</div>)}
        {editingMsgId && (<div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4"><div className="bg-white w-full max-w-sm rounded-2xl p-4"><h3 className="font-bold mb-2">メッセージを編集</h3><textarea className="w-full bg-gray-50 p-2 rounded-xl mb-4 border focus:outline-none" value={editingText} onChange={e => setEditingText(e.target.value)} rows={3}/><div className="flex gap-2"><button onClick={() => setEditingMsgId(null)} className="flex-1 py-2 bg-gray-100 rounded-xl font-bold text-gray-600">キャンセル</button><button onClick={submitEditMessage} className="flex-1 py-2 bg-green-500 rounded-xl font-bold text-white">更新</button></div></div></div>)}
        {addMemberModalOpen && <GroupAddMemberModal onClose={() => setAddMemberModalOpen(false)} currentMembers={chatData?.participants || []} chatId={activeChatId} allUsers={allUsers} profile={profile} user={user} showNotification={showNotification} />}
        {groupEditModalOpen && <GroupEditModal onClose={() => setGroupEditModalOpen(false)} chatId={activeChatId} currentName={chatData.name} currentIcon={chatData.icon} currentMembers={chatData.participants} allUsers={allUsers} showNotification={showNotification} user={user} profile={profile} />}
        {leaveModalOpen && <LeaveGroupConfirmModal onClose={() => setLeaveModalOpen(false)} onLeave={handleLeaveGroup} />}
        {cardModalOpen && <BirthdayCardModal onClose={() => setCardModalOpen(false)} onSend={sendBirthdayCard} toName={title} />}
        {contactModalOpen && <ContactSelectModal onClose={() => setContactModalOpen(false)} onSend={(c: any) => sendMessage("", "contact", { contactId: c.uid, contactName: c.name, contactAvatar: c.avatar })} friends={allUsers.filter((u: any) => (profile?.friends || []).includes(u.uid) && !(profile?.hiddenFriends || []).includes(u.uid))}/>}
        {buyStickerModalPackId && <StickerBuyModal onClose={() => setBuyStickerModalPackId(null)} packId={buyStickerModalPackId} onGoToStore={(id: string) => { setView('sticker-store'); setBuyStickerModalPackId(null); }} />}
        
        {/* AI Effect Modal */}
        {aiEffectModalOpen && <AIEffectGenerator user={user} onClose={() => setAiEffectModalOpen(false)} showNotification={showNotification} />}

        {plusMenuOpen && (
            <div className="absolute bottom-16 left-4 right-4 bg-white rounded-3xl p-4 shadow-2xl grid grid-cols-4 gap-4 animate-in slide-in-from-bottom-4 z-20">
                <label className="flex flex-col items-center gap-2 cursor-pointer"><div className="p-3 bg-green-50 rounded-2xl"><ImageIcon className="w-6 h-6 text-green-500" /></div><span className="text-[10px] font-bold">画像</span><input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, (d: string, t: string, f: File) => sendMessage(d, t, {}, f))} /></label>
                <label className="flex flex-col items-center gap-2 cursor-pointer"><div className="p-3 bg-blue-50 rounded-2xl"><Play className="w-6 h-6 text-blue-500" /></div><span className="text-[10px] font-bold">動画</span><input type="file" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, (d: string, t: string, f: File) => sendMessage(d, t, {}, f))} /></label>
                <label className="flex flex-col items-center gap-2 cursor-pointer"><div className="p-3 bg-gray-100 rounded-2xl"><Paperclip className="w-6 h-6 text-gray-600" /></div><span className="text-[10px] font-bold">ファイル</span><input type="file" className="hidden" onChange={(e) => handleFileUpload(e, (d: string, t: string, f: File) => sendMessage(d, t, {}, f))} /></label>
                <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => setContactModalOpen(true)}><div className="p-3 bg-yellow-50 rounded-2xl"><Contact className="w-6 h-6 text-yellow-500" /></div><span className="text-[10px] font-bold">連絡先</span></div>
                <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => setCardModalOpen(true)}><div className="p-3 bg-pink-50 rounded-2xl"><Gift className="w-6 h-6 text-pink-500" /></div><span className="text-[10px] font-bold">カード</span></div>
                {/* Remittance Button (Send Money) */}
                <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => { 
                    if (!isGroup && partnerData) {
                        setCoinModalTarget(partnerData);
                        setPlusMenuOpen(false);
                    } else {
                        showNotification("グループでの送金はプロフィールから行ってください");
                    }
                }}>
                    <div className="p-3 bg-orange-50 rounded-2xl"><Coins className="w-6 h-6 text-orange-500" /></div>
                    <span className="text-[10px] font-bold">送金</span>
                </div>
            </div>
        )}
        
        <div className="p-3 bg-white border-t flex flex-col gap-2 relative z-10">
          {stickerMenuOpen && myStickerPacks.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 bg-gray-50 border-t h-72 flex flex-col shadow-2xl rounded-t-3xl overflow-hidden animate-in slide-in-from-bottom-2 z-20">
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-4 gap-4 content-start">
                     {myStickerPacks.find((p: any) => p.id === selectedPackId)?.stickers.map((s: any, i: number) => (
                         <div key={i} className="relative cursor-pointer hover:scale-110 active:scale-95 transition-transform drop-shadow-sm" onClick={() => sendMessage(s, 'sticker', { packId: selectedPackId })}>
                            <img src={typeof s === 'string' ? s : s.image} className="w-full aspect-square object-contain" />
                            {(typeof s !== 'string' && s.audio) && <div className="absolute bottom-0 right-0 bg-black/20 text-white rounded-full p-1"><Volume2 className="w-3 h-3"/></div>}
                         </div>
                     ))}
                </div>
                <div className="bg-white border-t flex overflow-x-auto p-2 gap-2 scrollbar-hide shrink-0">
                    {myStickerPacks.map((pack: any) => (
                        <div key={pack.id} onClick={() => setSelectedPackId(pack.id)} className={`flex-shrink-0 cursor-pointer p-2 rounded-xl transition-colors ${selectedPackId === pack.id ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
                             <img src={typeof pack.stickers[0] === 'string' ? pack.stickers[0] : pack.stickers[0].image} className="w-8 h-8 object-contain" />
                        </div>
                    ))}
                </div>
            </div>
          )}

          {replyTo && (
            <div className="flex items-center justify-between bg-gray-100 p-2 rounded-xl text-xs mb-1 border-l-4 border-green-500">
              <div className="flex flex-col max-w-[90%]">
                <span className="font-bold text-green-600 mb-0.5">{allUsers.find((u: any) => u.uid === replyTo.senderId)?.name || 'Unknown'} への返信</span>
                <div className="truncate text-gray-600 flex items-center gap-1">
                  {replyTo.type === 'image' && <ImageIcon className="w-3 h-3" />}
                  {replyTo.type === 'video' && <Video className="w-3 h-3" />}
                  {['image', 'video'].includes(replyTo.type) 
                    ? (replyTo.type === 'image' ? '[画像]' : '[動画]') 
                    : (replyTo.content || '[メッセージ]')}
                </div>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-200 rounded-full"><X className="w-4 h-4 text-gray-500"/></button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => setPlusMenuOpen(!plusMenuOpen)} className={`p-2 rounded-full ${plusMenuOpen ? 'bg-gray-100 rotate-45' : ''}`}><Plus className="w-5 h-5 text-gray-400" /></button>
            <div className="flex-1 flex gap-2 relative">
               {!isRecording ? (<div className="flex-1 flex gap-2"><input className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 text-sm focus:outline-none" placeholder="メッセージを入力" value={text} onChange={e => setText(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage(text)} /><button onClick={() => setStickerMenuOpen(!stickerMenuOpen)} className={`p-2 rounded-full hover:bg-gray-100 ${stickerMenuOpen ? 'text-green-500 bg-green-50' : 'text-gray-400'}`}><Smile className="w-5 h-5"/></button></div>) : (<div className="flex-1 bg-red-50 rounded-2xl px-4 py-2 flex items-center justify-between animate-pulse"><div className="flex items-center gap-2 text-red-500 font-bold text-xs"><div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>録音中... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</div></div>)}
               {!text && !isUploading && (<>{!isRecording ? (<button onClick={startRecording} className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"><Mic className="w-5 h-5" /></button>) : (<div className="flex gap-2"><button onClick={cancelRecording} className="p-2 rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300" title="キャンセル"><Trash2 className="w-5 h-5" /></button><button onClick={stopRecording} className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600 animate-bounce" title="停止して送信"><StopCircle className="w-5 h-5 fill-current" /></button></div>)}</>)}
            </div>
            {(text || isUploading) && <button onClick={() => sendMessage(text)} disabled={!text && !isUploading} className={`p-2 rounded-full ${text ? 'text-green-500' : 'text-gray-300'}`}>{isUploading ? <div className="relative"><Loader2 className="w-6 h-6 animate-spin text-green-500" />{uploadProgress > 0 && <div className="absolute top-full left-1/2 -translate-x-1/2 text-[8px] font-bold mt-1">{uploadProgress}%</div>}</div> : <Send className="w-6 h-6" />}</button>}
          </div>
        </div>
        {viewProfile && <FriendProfileModal friend={viewProfile} onClose={() => setViewProfile(null)} onStartChat={(uid: string) => { setViewProfile(null); }} onTransfer={() => { setCoinModalTarget(viewProfile); setViewProfile(null); }} myUid={user.uid} myProfile={profile} allUsers={allUsers} showNotification={showNotification} />}
        {coinModalTarget && <CoinTransferModal onClose={() => setCoinModalTarget(null)} myWallet={profile.wallet} myUid={user.uid} targetUid={coinModalTarget.uid} targetName={coinModalTarget.name} showNotification={showNotification} />}
      </div>
    );
};

const VoomView = ({ user, allUsers, profile, posts, showNotification, db, appId }: any) => { 
    const [content, setContent] = useState(''), [media, setMedia] = useState<string | null>(null), [mediaType, setMediaType] = useState('image'), [isUploading, setIsUploading] = useState(false);
    const postMessage = async () => { 
        if (profile?.isBanned) return showNotification("アカウントが利用停止されています 🚫");
        if ((!content && !media) || isUploading) return; 
        setIsUploading(true); 
        try { 
            let hasChunks = false, chunkCount = 0, storedMedia = media; 
            if (media && media.length > CHUNK_SIZE) { hasChunks = true; chunkCount = Math.ceil(media.length / CHUNK_SIZE); storedMedia = null; } 
            const newPostRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'posts')); 
            
            if (hasChunks && media) { 
                const CONCURRENCY = 100;
                const executing = new Set();
                for (let i = 0; i < chunkCount; i++) { 
                    const start = i * CHUNK_SIZE; const end = Math.min(start + CHUNK_SIZE, media.length); const chunkData = media.slice(start, end); 
                    const p = setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', newPostRef.id, 'chunks', `${i}`), { data: chunkData, index: i }); 
                    
                    const pWrapper: Promise<boolean> = p.then(() => executing.delete(pWrapper));
                    executing.add(pWrapper);
                    if (executing.size >= CONCURRENCY) { await Promise.race(executing); }
                } 
                await Promise.all(executing);
            }
            
            let mimeType = null; if (media && media.startsWith('data:')) { mimeType = media.split(';')[0].split(':')[1]; }
            await setDoc(newPostRef, { userId: user.uid, content, media: storedMedia, mediaType, mimeType, hasChunks, chunkCount, likes: [], comments: [], createdAt: serverTimestamp() }); 
            setContent(''); setMedia(null); showNotification("投稿しました"); 
        } finally { setIsUploading(false); } 
    };
    const handleVoomFileUpload = (e: any) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev: any) => { setMedia(ev.target.result); setMediaType(file.type.startsWith('video') ? 'video' : 'image'); }; reader.readAsDataURL(file); };
    return (<div className="flex flex-col h-full bg-gray-50"><div className="bg-white p-4 border-b shrink-0"><h1 className="text-xl font-bold">VOOM</h1></div><div className="flex-1 overflow-y-auto scrollbar-hide pb-20"><div className="bg-white p-4 mb-2"><textarea className="w-full text-sm outline-none resize-none min-h-[60px]" placeholder="何をしていますか？" value={content} onChange={e => setContent(e.target.value)} />{media && <div className="relative mt-2">{mediaType === 'video' ? <video src={media} className="w-full rounded-xl bg-black" controls /> : <img src={media} className="max-h-60 rounded-xl" />}<button onClick={() => setMedia(null)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X className="w-3 h-3"/></button></div>}<div className="flex justify-between items-center pt-2 border-t mt-2"><label className="cursor-pointer p-2 flex items-center gap-2"><ImageIcon className="w-5 h-5 text-gray-400" /><input type="file" className="hidden" accept="image/*,video/*" onChange={handleVoomFileUpload} /></label><button onClick={postMessage} disabled={isUploading} className={`text-xs font-bold px-4 py-2 rounded-full ${content || media ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>投稿</button></div></div>{posts.map((p: any) => <PostItem key={p.id} post={p} user={user} allUsers={allUsers} db={db} appId={appId} profile={profile} />)}</div></div>);
};

const ProfileEditView = ({ user, profile, setView, showNotification, copyToClipboard }: any) => {
    const [edit, setEdit] = useState<any>(profile || {});
    useEffect(() => { if (profile) setEdit(prev => (!prev || Object.keys(prev).length === 0) ? { ...profile } : { ...profile, name: prev.name, id: prev.id, status: prev.status, birthday: prev.birthday, avatar: prev.avatar, cover: prev.cover }); }, [profile]);
    const handleSave = () => { updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), edit); showNotification("保存しました ✅"); };
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b flex items-center gap-4 sticky top-0 bg-white shrink-0"><ChevronLeft className="w-6 h-6 cursor-pointer" onClick={() => setView('home')} /><span className="font-bold">設定</span></div>
        <div className="flex-1 overflow-y-auto pb-8">
          <div className="w-full h-48 relative bg-gray-200"><img src={edit.cover} className="w-full h-full object-cover" /><label className="absolute inset-0 flex items-center justify-center bg-black/20 text-white font-bold cursor-pointer opacity-0 hover:opacity-100 transition-opacity">背景変更<input type="file" className="hidden" accept="image/*" onChange={e => handleCompressedUpload(e, (d: string) => setEdit({...edit, cover: d}))} /></label></div>
          <div className="px-8 -mt-12 flex flex-col items-center gap-6">
            <div className="relative"><img src={edit.avatar} className="w-24 h-24 rounded-3xl border-4 border-white object-cover" /><label className="absolute bottom-0 right-0 bg-green-500 p-2 rounded-full text-white cursor-pointer"><CameraIcon className="w-4 h-4" /><input type="file" className="hidden" accept="image/*" onChange={e => handleCompressedUpload(e, (d: string) => setEdit({...edit, avatar: d}))} /></label></div>
            <div className="w-full space-y-4">
              <div><label className="text-xs font-bold text-gray-400">名前</label><input className="w-full border-b py-2 outline-none" value={edit.name || ''} onChange={e => setEdit({...edit, name: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-gray-400">ID</label><div className="flex items-center gap-2 border-b py-2"><span className="flex-1 font-mono text-gray-600">{edit.id}</span><button onClick={() => copyToClipboard(edit.id)} className="p-1 hover:bg-gray-100 rounded-full"><Copy className="w-4 h-4 text-gray-500" /></button></div></div>
              <div><label className="text-xs font-bold text-gray-400">誕生日</label><input type="date" className="w-full border-b py-2 outline-none bg-transparent" value={edit.birthday || ''} onChange={e => setEdit({...edit, birthday: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-gray-400">ひとこと</label><input className="w-full border-b py-2 outline-none" value={edit.status || ''} onChange={e => setEdit({...edit, status: e.target.value})} /></div>
              <button onClick={handleSave} className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold shadow-lg">保存</button>
              <button onClick={() => signOut(auth)} className="w-full bg-gray-100 text-red-500 py-4 rounded-2xl font-bold mt-4">ログアウト</button>
            </div>
          </div>
        </div>
      </div>
    );
};

const QRScannerView = ({ user, setView, addFriendById }: any) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
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
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(t => t.stop());
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
                
                const win = window as any;
                if (win.jsQR) {
                    const code = win.jsQR(ctx.getImageData(0,0,c.width,c.height).data, c.width, c.height); 
                    if (code) { 
                        if (videoRef.current.srcObject) {
                            const stream = videoRef.current.srcObject as MediaStream;
                            stream.getTracks().forEach(t => t.stop());
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

    return (<div className="flex flex-col h-full bg-white"><div className="p-4 border-b flex items-center gap-4"><ChevronLeft className="w-6 h-6 cursor-pointer" onClick={() => setView('home')} /><span className="font-bold">QR</span></div><div className="flex-1 overflow-y-auto p-8"><div className="flex flex-col items-center justify-center gap-8 min-h-full">{scanning ? <div className="relative w-64 h-64 border-4 border-green-500 rounded-3xl overflow-hidden"><video ref={videoRef} className="w-full h-full object-cover" /><canvas ref={canvasRef} className="hidden" /></div> : <div className="bg-white p-6 rounded-[40px] shadow-xl border"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${user?.uid}`} className="w-48 h-48" /></div>}<div className="grid grid-cols-2 gap-4 w-full"><button onClick={startScanner} className="flex flex-col items-center gap-2 bg-gray-50 p-4 rounded-3xl border"><Maximize className="w-6 h-6 text-green-500" /><span>スキャン</span></button><label className="flex flex-col items-center gap-2 bg-gray-50 p-4 rounded-3xl border cursor-pointer"><Upload className="w-6 h-6 text-blue-500" /><span>読込</span><input type="file" className="hidden" accept="image/*" onChange={e => { const r = new FileReader(); r.onload = (ev: any) => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'), ctx = c.getContext('2d'); if(ctx) { c.width = img.width; c.height = img.height; ctx.drawImage(img,0,0); const win = window as any; const code = win.jsQR(ctx.getImageData(0,0,c.width,c.height).data, c.width, c.height); if (code) addFriendById(code.data); } }; img.src = ev.target.result; }; r.readAsDataURL(e.target.files[0]); }} /></label></div></div></div></div>);
};

const HomeView = ({ user, profile, allUsers, chats, setView, setActiveChatId, setSearchModalOpen, startChatWithUser, showNotification }: any) => {
  const [tab, setTab] = useState<'friends' | 'hidden' | 'chats'>('chats');
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [coinModalTarget, setCoinModalTarget] = useState<any>(null);

  const [openChatMenuId, setOpenChatMenuId] = useState<string | null>(null);
  const [openFriendMenuId, setOpenFriendMenuId] = useState<string | null>(null);

  const myFriendUids = useMemo(() => new Set<string>(profile?.friends || []), [profile?.friends]);
  const hiddenFriendUids = useMemo(() => new Set<string>(profile?.hiddenFriends || []), [profile?.hiddenFriends]);

  // トークを開始した友だち（1対1トークの相手）は、友だちとしてカウントする
  const talkFriendUids = useMemo(() => {
    const s = new Set<string>();
    (chats || []).forEach((c: any) => {
      if (!c || c.isGroup) return;
      const parts: string[] = c.participants || [];
      if (!parts.includes(user.uid)) return;
      const other = parts.find((p) => p && p !== user.uid);
      if (other) s.add(other);
    });
    return s;
  }, [chats, user.uid]);

  const directFriendUids = useMemo(() => {
    const s = new Set<string>(profile?.friends || []);
    talkFriendUids.forEach((uid) => s.add(uid));
    return s;
  }, [profile?.friends, talkFriendUids]);

  const talkFriendCount = talkFriendUids.size;
  const groupChatCount = useMemo(() => (chats || []).filter((c: any) => c?.isGroup).length, [chats]);


  const friendsListAll = useMemo(
    () => allUsers.filter((u: any) => myFriendUids.has(u.uid)),
    [allUsers, myFriendUids]
  );

  const directFriendsListAll = useMemo(
    () => allUsers.filter((u: any) => directFriendUids.has(u.uid)),
    [allUsers, directFriendUids]
  );


  const visibleFriendsList = useMemo(
    () => friendsListAll.filter((u: any) => !hiddenFriendUids.has(u.uid)),
    [friendsListAll, hiddenFriendUids]
  );

  const hiddenFriendsList = useMemo(
    () => friendsListAll.filter((u: any) => hiddenFriendUids.has(u.uid)),
    [friendsListAll, hiddenFriendUids]
  );

  const friendsOfFriendsCount = useMemo(() => {
    const fof = new Set<string>();
    directFriendsListAll.forEach((f: any) => {
      const ff: string[] = f?.friends || [];
      ff.forEach((uid) => {
        if (!uid) return;
        if (uid === user.uid) return;
        if (directFriendUids.has(uid)) return;
        fof.add(uid);
      });
    });
    return fof.size;
  }, [directFriendsListAll, user.uid, directFriendUids]);

  const getMutualCount = useCallback((friend: any) => {
    const ff: string[] = friend?.friends || [];
    let n = 0;
    for (const uid of ff) {
      if (!uid || uid === user.uid) continue;
      if (directFriendUids.has(uid)) n++;
    }
    return n;
  }, [directFriendUids, user.uid]);

  const getFofCandidateCount = useCallback((friend: any) => {
    const ff: string[] = friend?.friends || [];
    let n = 0;
    for (const uid of ff) {
      if (!uid || uid === user.uid) continue;
      if (!directFriendUids.has(uid)) n++;
    }
    return n;
  }, [directFriendUids, user.uid]);

  const handleHideChat = async (e: any, chatId: string) => {
    e.stopPropagation();
    setOpenChatMenuId(null);
    if (!window.confirm("このトークを非表示にしますか？\n（トーク履歴は削除されません）")) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
        hiddenChats: arrayUnion(chatId),
      });
      showNotification("非表示にしました");
    } catch (e) {
      showNotification("エラーが発生しました");
    }
  };

  const handleDeleteChat = async (e: any, chatId: string) => {
    e.stopPropagation();
    setOpenChatMenuId(null);
    if (!window.confirm("このトークを削除（退出）しますか？\n相手とのトークリストからも削除される可能性があります。")) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId), {
        participants: arrayRemove(user.uid),
      });
      showNotification("削除しました");
    } catch (e) {
      showNotification("エラーが発生しました");
    }
  };

  const handleHideFriend = async (e: any, friendUid: string) => {
    e.stopPropagation();
    setOpenFriendMenuId(null);
    if (!window.confirm("この友だちを非表示にしますか？\n（友だち関係は解除されません）")) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
        hiddenFriends: arrayUnion(friendUid),
      });
      showNotification("非表示にしました");
    } catch (e) {
      showNotification("エラーが発生しました");
    }
  };

  const handleUnhideFriend = async (e: any, friendUid: string) => {
    e.stopPropagation();
    setOpenFriendMenuId(null);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), {
        hiddenFriends: arrayRemove(friendUid),
      });
      showNotification("非表示を解除しました");
    } catch (e) {
      showNotification("エラーが発生しました");
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-white"
      onClick={() => { setOpenChatMenuId(null); setOpenFriendMenuId(null); }}
    >
      <div className="p-4 border-b flex justify-between items-center bg-white shrink-0">
        <h1 className="text-xl font-bold">ホーム</h1>
        <div className="flex gap-4 items-center">
          <Store className="w-6 h-6 cursor-pointer text-orange-500" onClick={() => setView('sticker-store')} />
          <Gift className="w-6 h-6 cursor-pointer text-pink-500" onClick={() => setView('birthday-cards')} />
          <Users className="w-6 h-6 cursor-pointer" onClick={() => setView('group-create')} />
          <Search className="w-6 h-6 cursor-pointer" onClick={() => setSearchModalOpen(true)} />
          <UserPlus className="w-6 h-6 cursor-pointer" onClick={() => setView('qr')} />
          <Settings className="w-6 h-6 cursor-pointer" onClick={() => setView('profile')} />
        </div>
      </div>

      <div className="flex border-b">
        <button
          className={`flex-1 py-3 text-sm font-bold ${tab === 'friends' ? 'border-b-2 border-black' : 'text-gray-400'}`}
          onClick={() => setTab('friends')}
        >
          友だち
        </button>

        <button
          className={`flex-1 py-3 text-sm font-bold ${tab === 'hidden' ? 'border-b-2 border-black' : 'text-gray-400'}`}
          onClick={() => setTab('hidden')}
        >
          非表示
        </button>

        <button
          className={`flex-1 py-3 text-sm font-bold ${tab === 'chats' ? 'border-b-2 border-black' : 'text-gray-400'}`}
          onClick={() => setTab('chats')}
        >
          トーク
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer border-b" onClick={() => setView('profile')}>
          <div className="relative">
            <img key={profile?.avatar} src={profile?.avatar} className="w-16 h-16 rounded-2xl object-cover border" />
            {isTodayBirthday(profile?.birthday) && <span className="absolute -top-1 -right-1 text-base">🎂</span>}
          </div>
          <div className="flex-1">
            <div className="font-bold text-lg">{profile?.name}</div>
            <div className="text-xs text-gray-400 font-mono">ID: {profile?.id}</div>
          </div>
        </div>

        {(tab === 'friends' || tab === 'hidden') && (
          <div className="px-4 pt-4">
            <div className="bg-gray-50 border rounded-3xl p-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">友だちの友だち</div>
                <div className="text-xs text-gray-500 font-bold mt-1">あなたの友だち経由でつながる人数（重複なし）</div>
              </div>
              <div className="text-2xl font-black text-gray-800">{friendsOfFriendsCount}</div>
            </div>
          </div>
        )}

        {tab === 'friends' && (
          <div className="pt-2">
            {visibleFriendsList.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">友だちがいません</div>
            ) : (
              visibleFriendsList.map((friend: any) => (
                <div
                  key={friend.uid}
                  className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer relative"
                  onClick={() => setSelectedFriend(friend)}
                >
                  <div className="relative">
                    <img key={friend.avatar} src={friend.avatar} className="w-12 h-12 rounded-xl object-cover border" />
                    {isTodayBirthday(friend.birthday) && <span className="absolute -top-1 -right-1 text-xs">🎂</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{friend.name}</div>
                    <div className="text-xs text-gray-400 truncate">{friend.status}</div>
                    <div className="text-[10px] text-gray-400 font-bold mt-0.5">
                      共通 {getMutualCount(friend)} ・ 友だちの友だち {getFofCandidateCount(friend)}
                    </div>
                  </div>

                  <div className="relative ml-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setOpenFriendMenuId(openFriendMenuId === friend.uid ? null : friend.uid)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openFriendMenuId === friend.uid && (
                      <div className="absolute right-0 top-8 bg-white shadow-xl border rounded-xl overflow-hidden z-20 min-w-[140px] animate-in fade-in zoom-in-95 duration-100">
                        <button onClick={(e) => handleHideFriend(e, friend.uid)} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                          <EyeOff className="w-3 h-3" /> 非表示
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'hidden' && (
          <div className="pt-2">
            {hiddenFriendsList.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">非表示の友だちはありません</div>
            ) : (
              hiddenFriendsList.map((friend: any) => (
                <div
                  key={friend.uid}
                  className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer relative"
                  onClick={() => setSelectedFriend(friend)}
                >
                  <div className="relative">
                    <img key={friend.avatar} src={friend.avatar} className="w-12 h-12 rounded-xl object-cover border" />
                    {isTodayBirthday(friend.birthday) && <span className="absolute -top-1 -right-1 text-xs">🎂</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{friend.name}</div>
                    <div className="text-xs text-gray-400 truncate">{friend.status}</div>
                  </div>

                  <button
                    onClick={(e) => handleUnhideFriend(e, friend.uid)}
                    className="px-3 py-2 bg-white border rounded-2xl text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                    表示
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'chats' && (
          <>
            <div className="px-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 border rounded-3xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">トーク友だち</div>
                    <div className="text-xs text-gray-500 font-bold mt-1">1対1トークの人数</div>
                  </div>
                  <div className="text-2xl font-black text-gray-800">{talkFriendCount}</div>
                </div>
                <div className="bg-gray-50 border rounded-3xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">グループ</div>
                    <div className="text-xs text-gray-500 font-bold mt-1">参加中の数</div>
                  </div>
                  <div className="text-2xl font-black text-gray-800">{groupChatCount}</div>
                </div>
              </div>
            </div>

            {chats
          .filter((chat: any) => !profile?.hiddenChats?.includes(chat.id))
          .sort((a: any, b: any) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
          .map((chat: any) => {
            let name = chat.name, icon = chat.icon, partnerData = null;
            if (!chat.isGroup) {
              partnerData = allUsers.find((u: any) => u.uid === chat.participants.find((p: string) => p !== user.uid));
              if (partnerData) { name = partnerData.name; icon = partnerData.avatar; }
            }
            const unreadCount = chat.unreadCounts?.[user.uid] || 0;

            return (
              <div
                key={chat.id}
                className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer relative group"
                onClick={() => { setActiveChatId(chat.id); setView('chatroom'); }}
              >
                <div className="relative">
                  <img key={icon} src={icon} className="w-12 h-12 rounded-xl object-cover border" />
                  {!chat.isGroup && partnerData && isTodayBirthday(partnerData.birthday) && <span className="absolute -top-1 -right-1 text-xs">🎂</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{name} {chat.isGroup ? `(${chat.participants.length})` : ''}</div>
                  <div className={`text-xs truncate ${unreadCount > 0 ? 'font-bold text-black' : 'text-gray-400'}`}>{chat.lastMessage?.content}</div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="text-[10px] text-gray-300">{formatTime(chat.updatedAt)}</div>
                  {unreadCount > 0 && (
                    <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center flex items-center justify-center h-5 border-2 border-white shadow-sm mb-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                  )}
                </div>

                <div className="relative ml-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setOpenChatMenuId(openChatMenuId === chat.id ? null : chat.id)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openChatMenuId === chat.id && (
                    <div className="absolute right-0 top-8 bg-white shadow-xl border rounded-xl overflow-hidden z-20 min-w-[120px] animate-in fade-in zoom-in-95 duration-100">
                      <button onClick={(e) => handleHideChat(e, chat.id)} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                        <EyeOff className="w-3 h-3" /> 非表示
                      </button>
                      <button onClick={(e) => handleDeleteChat(e, chat.id)} className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 border-t flex items-center gap-2">
                        <Trash2 className="w-3 h-3" /> 削除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </>
        )}
      </div>

      {selectedFriend && (
        <FriendProfileModal
          friend={selectedFriend}
          onClose={() => setSelectedFriend(null)}
          onStartChat={startChatWithUser}
          onTransfer={() => { setCoinModalTarget(selectedFriend); setSelectedFriend(null); }}
          myUid={user.uid}
          myProfile={profile}
          allUsers={allUsers}
          showNotification={showNotification}
        />
      )}

      {coinModalTarget && (
        <CoinTransferModal
          onClose={() => setCoinModalTarget(null)}
          myWallet={profile.wallet}
          myUid={user.uid}
          targetUid={coinModalTarget.uid}
          targetName={coinModalTarget.name}
          showNotification={showNotification}
        />
      )}
    </div>
  );
};

// --- 6. Main App Component ---
function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [view, setView] = useState('auth'); 
  const [activeChatId, setActiveChatId] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mutedChats, setMutedChats] = useState<string[]>(() => {
    const saved = localStorage.getItem('mutedChats');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeCall, setActiveCall] = useState<any>(null);
  const [userEffects, setUserEffects] = useState<any[]>([]);
  const [activeEffect, setActiveEffect] = useState<string>('Normal');
  const [currentChatBackground, setCurrentChatBackground] = useState<string | null>(null);
  const processedMsgIds = useRef(new Set<string>());

  const toggleMuteChat = (chatId: string) => {
    setMutedChats(prev => {
      const next = prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId];
      localStorage.setItem('mutedChats', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    // ユーザーインタラクション時にAudioContextをアンロックする
    const unlockAudio = () => {
        initAudioContext();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    const script = document.createElement('script');
    script.src = JSQR_URL;
    document.head.appendChild(script);
    
    // --- Missing manifest/favicon 対策（404回避）---
    try {
      // /manifest.json への参照が残っていると 404 になるため、App側で最低限の manifest を差し込む
      document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.parentNode?.removeChild(el));
      const manifest = {
        name: "Chat App",
        short_name: "Chat",
        start_url: ".",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#22c55e",
        icons: [],
      };
      const manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(manifest))}`;
      document.head.appendChild(manifestLink);
    } catch {}

    try {
      // favicon.ico の 404 を抑える（ブラウザによっては /favicon.ico を自動で取りに行く）
      document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((el) => el.parentNode?.removeChild(el));
      const iconLink = document.createElement('link');
      iconLink.rel = 'icon';
      iconLink.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text y="48" font-size="48">💬</text></svg>';
      document.head.appendChild(iconLink);
    } catch {}
    
    setPersistence(auth, browserLocalPersistence);
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const docSnap = await getDoc(doc(db, "artifacts", appId, "public", "data", "users", u.uid));
        if (docSnap.exists()) {
             setProfile(docSnap.data());
        } else {
            const initialProfile = {
              uid: u.uid, name: u.displayName || `User_${u.uid.slice(0,4)}`, id: `user_${u.uid.slice(0,6)}`,
              status: "よろしくお願いします！", birthday: "", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=" + u.uid,
              cover: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80", friends: [], hiddenFriends: [], hiddenChats: [], wallet: 1000, isBanned: false
            };
            await setDoc(doc(db, "artifacts", appId, "public", "data", "users", u.uid), initialProfile);
            setProfile(initialProfile);
        }
        setView('home');
      } else {
        setUser(null);
        setProfile(null);
        setView('auth');
      }
    });
    return () => {
        unsubscribe();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification("IDをコピーしました");
  };

  useEffect(() => {
    if (!user) return;
    const unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), (doc) => {
      if (doc.exists()) setProfile(doc.data());
    });
    const unsubUsers = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'users')), (snap) => {
      setAllUsers(snap.docs.map(d => d.data()));
    });
    
    // エフェクトの監視
    const unsubEffects = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'users', user.uid, 'effects'), orderBy('createdAt', 'desc')), (snap) => {
      setUserEffects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubChats = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'chats'), where('participants', 'array-contains', user.uid)), (snap) => {
      const chatList: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // 新着メッセージのチェック（音を鳴らす）
      snap.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
            const data: any = change.doc.data();
            const lastMsg = data.lastMessage;
            
            // メッセージが存在し、自分以外が送信した場合
            if (lastMsg && lastMsg.senderId !== user.uid && lastMsg.createdAt) {
                 const now = Date.now();
                 // TimestampかDateオブジェクトか数値かを判定してミリ秒を取得
                 let msgTime = 0;
                 if (lastMsg.createdAt?.seconds) {
                     msgTime = lastMsg.createdAt.seconds * 1000;
                 } else if (lastMsg.createdAt?.toMillis) {
                     msgTime = lastMsg.createdAt.toMillis();
                 } else if (lastMsg.createdAt instanceof Date) {
                     msgTime = lastMsg.createdAt.getTime();
                 } else {
                     msgTime = now; // fallback
                 }
                 
                 // メッセージID（またはタイムスタンプベースの一意キー）を生成
                 const msgUniqueKey = `${change.doc.id}_${msgTime}`;

                 // 1. 10秒以内の新しいメッセージである (ロード時の大量通知防止)
                 // 2. まだ通知していないメッセージである
                 if (now - msgTime < 10000 && !processedMsgIds.current.has(msgUniqueKey)) {
                     playNotificationSound();
                     processedMsgIds.current.add(msgUniqueKey);
                 }
            }
        }
      });

      setChats(chatList);
      
      const incoming: any = chatList.find((c: any) => c.callStatus?.status === 'ringing' && c.callStatus.callerId !== user.uid);

      // 着信（ringing）を検知
      if (incoming) {
          if (!activeCall || activeCall.chatId !== incoming.id) {
             setActiveCall({ chatId: incoming.id, callData: incoming.callStatus, isVideo: incoming.callStatus?.callType !== 'audio', isGroupCall: false, phase: 'incoming' });
          }
      }

      // 通話状態の遷移（発信中 -> 応答済み -> 通話中 / 終了）
      if (activeCall) {
          const currentChat = chatList.find((c: any) => c.id === activeCall.chatId);

          if (activeCall.phase === 'incoming') {
              // 着信画面は ringing の間だけ
              if (!currentChat || currentChat.callStatus?.status !== 'ringing') {
                  setActiveCall(null);
              }
          } else if (activeCall.phase === 'dialing') {
              // 発信中: ringing -> accepted で通話開始
              const status = currentChat?.callStatus?.status;
              if (!currentChat || !currentChat.callStatus) {
                  setActiveCall(null);
              } else if (status === 'accepted') {
                  setActiveCall({ ...activeCall, phase: 'inCall', callData: currentChat.callStatus, isVideo: currentChat.callStatus?.callType !== 'audio' });
              } else if (status !== 'ringing') {
                  setActiveCall(null);
              }
          } else if (activeCall.phase === 'inCall') {
              // 1対1通話は callStatus が消えたら終了
              if (!activeCall.isGroupCall) {
                  if (!currentChat || !currentChat.callStatus) setActiveCall(null);
              }
          }
      }
    });
    const unsubPosts = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubProfile(); unsubUsers(); unsubChats(); unsubPosts(); unsubEffects();
    };
  }, [user, activeCall]);

  const addFriendById = async (targetId: string) => {
    if (!targetId) return;
    const targetUser = allUsers.find((u: any) => u.id === targetId || u.uid === targetId);
    if (targetUser && targetUser.uid !== user.uid) {
      if ((profile.friends || []).includes(targetUser.uid)) {
        showNotification("既に友だちです。");
        return;
      }
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { friends: arrayUnion(targetUser.uid) });
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', targetUser.uid), { friends: arrayUnion(user.uid) });
      showNotification(`${targetUser.name}を追加しました`);
      setSearchModalOpen(false);
    } else {
      showNotification("ユーザーが見つかりません");
    }
  };

  const startChatWithUser = async (targetUid: string) => {
    const existingChat = chats.find((c: any) => 
      !c.isGroup && c.participants.includes(targetUid) && c.participants.includes(user.uid)
    );
    if (existingChat) {
      setActiveChatId(existingChat.id);
      setView('chatroom');
    } else {
      const targetUser = allUsers.find((u: any) => u.uid === targetUid);
      const newChat = {
        name: targetUser ? targetUser.name : "Chat", icon: targetUser ? targetUser.avatar : "",
        participants: [user.uid, targetUid], isGroup: false, createdBy: user.uid, updatedAt: serverTimestamp(),
        lastMessage: { content: "チャットを開始しました", senderId: user.uid, readBy: [user.uid] }
      };
      try {
        const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats'), newChat);
        setActiveChatId(ref.id);
        setView('chatroom');
      } catch (e) {
        showNotification("エラーが発生しました");
      }
    }
  };

    const cleanupCallSignaling = async (chatId: string) => {
    try {
      const signalingRef = doc(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "session");
      const candidatesCol = collection(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "candidates", "list");

      // Delete session (ignore if missing)
      try { await deleteDoc(signalingRef); } catch {}

      // Delete candidates in batches (to avoid 500 limit)
      const snap = await getDocs(candidatesCol).catch(() => null as any);
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

  const startVideoCall = async (chatId: string, isVideo = true, isJoin = false, joinCallerId?: string) => {
    // Check if group
    const chat = chats.find((c: any) => c.id === chatId);
    const isGroup = chat?.isGroup;

    if (isJoin) {
      // Join existing call invite (mainly for group call invites)
      const callerId = joinCallerId || chat?.callStatus?.callerId || user.uid;
      setActiveCall({ chatId, callData: { callerId }, isVideo, isGroupCall: !!isGroup, phase: 'inCall' });
      return;
    }

    if (isGroup) {
      // Send notification message instead of ringing everyone
      await cleanupCallSignaling(chatId);
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages'), {
          senderId: user.uid,
          content: '通話を開始しました',
          type: 'call_invite',
          callType: isVideo ? 'video' : 'audio',
          createdAt: serverTimestamp(),
          readBy: [user.uid],
        });
        // Auto join for the starter
        setActiveCall({ chatId, callData: { callerId: user.uid }, isVideo, isGroupCall: true, phase: 'inCall' });
      } catch (e) {
        showNotification("開始に失敗しました");
      }
    } else {
      // 1-on-1 ringing logic
      try {
        // Clear previous signaling leftovers before starting a new call
        await cleanupCallSignaling(chatId);

        await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", chatId), {
          callStatus: {
            status: "ringing",
            callerId: user.uid,
            callType: isVideo ? "video" : "audio",
            timestamp: Date.now(),
          },
        });

        setActiveCall({ chatId, callData: { status: 'ringing', callerId: user.uid, callType: isVideo ? "video" : "audio" }, isVideo, isGroupCall: false, phase: 'dialing' });
      } catch (e) {
        console.error(e);
        showNotification("発信に失敗しました");
      }
    }
  };

  useEffect(() => {
    if (!activeCall || !chats.length) return;
    const callChat = chats.find((c: any) => c.id === activeCall.chatId);
    if (callChat && callChat.backgroundImage) {
        setCurrentChatBackground(callChat.backgroundImage);
    } else {
        setCurrentChatBackground(null);
    }
  }, [activeCall, chats]);

  return (
    <div className="max-w-md mx-auto h-[100dvh] border-x bg-white flex flex-col relative overflow-hidden shadow-2xl">
      {notification && <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[300] bg-black/85 text-white px-6 py-2 rounded-full text-xs font-bold shadow-2xl animate-bounce">{notification}</div>}
      
      {!user ? (
          <AuthView onLogin={setUser} showNotification={showNotification} />
      ) : (
          <>
            {activeCall ? (
                activeCall.phase === 'incoming' ? (
                    <IncomingCallOverlay 
                        callData={activeCall.callData} 
                        allUsers={allUsers} 
                        onDecline={async () => { 
                            try { 
                                await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeCall.chatId), { callStatus: deleteField() }); 
                                await cleanupCallSignaling(activeCall.chatId); 
                            } catch(e) { 
                                console.error(e); 
                            } finally { 
                                setActiveCall(null); 
                            } 
                        }} 
                        onAccept={async () => {
                            try {
                                const nextCallData = { 
                                    ...(activeCall.callData || {}), 
                                    status: 'accepted', 
                                    acceptedBy: user.uid, 
                                    acceptedAt: Date.now(),
                                };
                                await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeCall.chatId), { callStatus: nextCallData });
                                setActiveCall({ ...activeCall, phase: 'inCall', callData: nextCallData });
                            } catch (e) {
                                console.error(e);
                                showNotification("応答に失敗しました");
                            }
                        }} 
                    />
                ) : activeCall.phase === 'dialing' ? (
                    <OutgoingCallOverlay
                        calleeData={(() => {
                            const callChat = chats.find((c: any) => c.id === activeCall.chatId);
                            if (!callChat || callChat.isGroup) return null;
                            const partnerId = (callChat.participants || []).find((p: string) => p && p !== user.uid);
                            return allUsers.find((u: any) => u.uid === partnerId) || null;
                        })()}
                        isVideo={activeCall.isVideo}
                        onCancel={async () => {
                            try {
                                await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeCall.chatId), { callStatus: deleteField() });
                                await cleanupCallSignaling(activeCall.chatId);
                            } catch (e) {
                                console.error(e);
                            } finally {
                                setActiveCall(null);
                            }
                        }}
                    />
                ) : (
                    <div className="relative w-full h-full">
                        <VideoCallView 
                            user={user} 
                            chatId={activeCall.chatId} 
                            callData={activeCall.callData} 
                            effects={userEffects}
                            isVideoEnabled={activeCall.isVideo} 
                            activeEffect={activeEffect}
                            backgroundUrl={currentChatBackground}
                            onEndCall={async () => { 
                                try {
                                    // 1-on-1 は、どちらが終了しても callStatus を消して両者終了させる
                                    if (!activeCall.isGroupCall) {
                                        await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeCall.chatId), { callStatus: deleteField() });
                                    }
                                    await cleanupCallSignaling(activeCall.chatId);
                                } catch (e) {
                                    console.error("Failed to end call:", e);
                                } finally {
                                    setActiveCall(null);
                                }
                            }} 
                        />
                        {/* Effect Selector in Call */}
                        <div className="absolute bottom-24 left-0 right-0 px-4 flex gap-2 overflow-x-auto scrollbar-hide z-[1001]">
                            <button onClick={() => setActiveEffect('Normal')} className={`p-2 rounded-xl text-xs font-bold whitespace-nowrap ${activeEffect === 'Normal' ? 'bg-white text-black' : 'bg-black/50 text-white'}`}>Normal</button>
                            {/* Render User Effects (Both AI and Purchased) */}
                            {userEffects.map((ef: any) => (
                                <button key={ef.id} onClick={() => setActiveEffect(ef.name)} className={`p-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1 ${activeEffect === ef.name ? 'bg-white text-black' : 'bg-black/50 text-white'}`}>
                                    <Sparkles className="w-3 h-3"/> {ef.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )
            ) : (
                <div className="flex-1 overflow-hidden relative">
                    {view === 'home' && <HomeView user={user} profile={profile} allUsers={allUsers} chats={chats} setView={setView} setActiveChatId={setActiveChatId} setSearchModalOpen={setSearchModalOpen} startChatWithUser={startChatWithUser} showNotification={showNotification} />}
                    {view === 'voom' && <VoomView user={user} allUsers={allUsers} profile={profile} posts={posts} showNotification={showNotification} db={db} appId={appId} />}
                    {view === 'chatroom' && <ChatRoomView user={user} profile={profile} allUsers={allUsers} chats={chats} activeChatId={activeChatId} setActiveChatId={setActiveChatId} setView={setView} db={db} appId={appId} mutedChats={mutedChats} toggleMuteChat={toggleMuteChat} showNotification={showNotification} addFriendById={addFriendById} startVideoCall={startVideoCall} />}
                    {view === 'profile' && <ProfileEditView user={user} profile={profile} setView={setView} showNotification={showNotification} copyToClipboard={copyToClipboard} />}
                    {view === 'qr' && <QRScannerView user={user} setView={setView} addFriendById={addFriendById} />}
                    {view === 'group-create' && <GroupCreateView user={user} profile={profile} allUsers={allUsers} setView={setView} showNotification={showNotification} />}
                    {view === 'birthday-cards' && <BirthdayCardBox user={user} setView={setView} />}
                    {view === 'sticker-create' && <StickerEditor user={user} profile={profile} onClose={() => setView('sticker-store')} showNotification={showNotification} />}
                    {view === 'sticker-store' && <StickerStoreView user={user} setView={setView} showNotification={showNotification} profile={profile} allUsers={allUsers} />}
                </div>
            )}
            
            {searchModalOpen && <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/60"><div className="bg-white w-full max-w-sm rounded-[32px] p-8"><h2 className="text-xl font-bold mb-6">検索</h2><input className="w-full bg-gray-50 rounded-2xl py-4 px-6 mb-6 outline-none" placeholder="IDを入力" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /><div className="flex gap-4"><button className="flex-1 py-4 text-gray-600 font-bold" onClick={() => setSearchModalOpen(false)}>閉じる</button><button className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-bold" onClick={() => addFriendById(searchQuery)}>追加</button></div></div></div>}
            
            {user && !activeCall && ['home', 'voom'].includes(view) && (
                <div className="h-20 bg-white border-t flex items-center justify-around z-50 pb-4 shrink-0">
                    <div className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${view === 'home' ? 'text-green-500' : 'text-gray-400'}`} onClick={() => setView('home')}><Home className="w-6 h-6" /><span className="text-[10px] font-bold">ホーム</span></div>
                    <div className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${view === 'voom' ? 'text-green-500' : 'text-gray-400'}`} onClick={() => setView('voom')}><LayoutGrid className="w-6 h-6" /><span className="text-[10px] font-bold">VOOM</span></div>
                </div>
            )}
          </>
      )}
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
}

export default App;
