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
  signInWithRedirect
} from 'firebase/auth';
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
} from 'firebase/firestore';
import {
  Search, UserPlus, Image as ImageIcon, Send, X, ChevronLeft, Settings, Home, LayoutGrid, Trash2,
  Plus, Video, Heart, MessageCircle, Camera as CameraIcon, Maximize, Upload, Copy, Contact, Play,
  Gift, Cake, Users, Check, Loader2, Bell, BellOff, Mic, Square, Ban, Edit2, Palette, PhoneOff,
  LogOut, RefreshCcw, ArrowUpCircle, Reply, Smile, StopCircle, PhoneCall, Phone, FileText,
  Paperclip, Download, UserMinus, AtSign, Store, PenTool, Eraser, Type, CheckCircle, XCircle,
  Lock, ShoppingBag, Coins, Scissors, Star, Disc, ShieldAlert, Music, Volume2, ShoppingCart,
  User, KeyRound, MicOff, VideoOff, ArrowRightLeft
} from 'lucide-react';

// --- Firebase Configuration ---
// 重要: ご自身のFirebase設定に書き換えてください
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
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// WebRTC STUN Servers (Googleのパブリックサーバーを使用)
const rtcConfig = {
  iceServers: [
    { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
  ],
};

// --- Utility Functions ---
const formatTime = (ts) => ts ? (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
const formatDate = (ts) => ts ? (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleDateString() : "";
const formatDateTime = (ts) => ts ? (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : "";
const isTodayBirthday = (b) => {
  if (!b) return false;
  const t = new Date();
  const [y, m, d] = b.split("-").map(Number);
  return t.getMonth() + 1 === m && t.getDate() === d;
};

// --- Components ---

// 1. WebRTC Video/Audio Call Component
const VideoCallView = ({ user, chatId, callData, onEndCall, isVideoEnabled = true }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideoEnabled);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);

  useEffect(() => {
    const startCall = async () => {
      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      // 相手からの映像・音声を受け取った時の処理
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      // 経路候補(ICE Candidate)が見つかったらFirestoreに保存
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await addDoc(collection(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "candidates", "list"), {
            candidate: event.candidate.toJSON(),
            senderId: user.uid,
            createdAt: serverTimestamp(),
          });
        }
      };

      try {
        // 自分のカメラ・マイクを取得
        const stream = await navigator.mediaDevices.getUserMedia({ video: isVideoEnabled, audio: true });
        setLocalStream(stream);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const isCaller = callData.callerId === user.uid;
        const signalingRef = doc(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "session");

        // 発信者の場合：Offerを作成
        if (isCaller) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await setDoc(signalingRef, { type: "offer", sdp: offer.sdp, callerId: user.uid });
        }

        // Firestoreのシグナリング情報を監視
        onSnapshot(signalingRef, async (snap) => {
          const data = snap.data();
          if (!pc.currentRemoteDescription && data?.type === "answer" && isCaller) {
            const answer = new RTCSessionDescription(data);
            await pc.setRemoteDescription(answer);
          } else if (!pc.currentRemoteDescription && data?.type === "offer" && !isCaller) {
            const offer = new RTCSessionDescription(data);
            await pc.setRemoteDescription(offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await updateDoc(signalingRef, { type: "answer", sdp: answer.sdp });
          }
        });

        // ICE Candidateの監視
        onSnapshot(collection(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "candidates", "list"), (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
              const data = change.doc.data();
              if (data.senderId !== user.uid && pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              }
            }
          });
        });

      } catch (err) {
        console.error("Media Error:", err);
        onEndCall(); // エラー時は通話を終了
      }
    };
    startCall();

    return () => {
      // クリーンアップ
      if (pcRef.current) pcRef.current.close();
      if (localStream) localStream.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col animate-in fade-in">
      <div className="relative flex-1 bg-gray-900 flex items-center justify-center">
        {/* 相手の映像 */}
        {remoteStream ? (
           <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
           <div className="text-white flex flex-col items-center gap-4">
             <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center animate-pulse"><User className="w-12 h-12"/></div>
             <p className="font-bold">接続中...</p>
           </div>
        )}
        
        {/* 自分の映像 (ピクチャーインピクチャー) */}
        {isVideoEnabled && (
          <div className="absolute top-4 right-4 w-32 h-48 bg-black rounded-xl overflow-hidden border-2 border-white shadow-lg">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
          </div>
        )}
      </div>
      
      {/* 操作ボタン */}
      <div className="h-32 bg-gradient-to-t from-black to-transparent flex items-center justify-center gap-8 pb-8 absolute bottom-0 w-full">
        <button onClick={toggleMute} className={`p-4 rounded-full shadow-lg ${isMuted ? "bg-white text-black" : "bg-gray-600/80 text-white backdrop-blur-md"}`}>
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <button onClick={onEndCall} className="p-5 rounded-full bg-red-600 text-white shadow-xl hover:bg-red-700 transform hover:scale-110 transition-all">
          <PhoneOff className="w-8 h-8" />
        </button>
        {isVideoEnabled && (
          <button onClick={toggleVideo} className={`p-4 rounded-full shadow-lg ${isVideoOff ? "bg-white text-black" : "bg-gray-600/80 text-white backdrop-blur-md"}`}>
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}
      </div>
    </div>
  );
};

// 2. Coin Transfer Modal
const CoinTransferModal = ({ onClose, myWallet, myUid, targetUid, targetName, showNotification }) => {
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

// 3. Friend Profile Modal (Updated with Actions)
const FriendProfileModal = ({ friend, onClose, onStartChat, onTransfer }) => (
  <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in">
    <div className="bg-white w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl relative flex flex-col items-center pb-8">
      <button onClick={onClose} className="absolute top-4 right-4 z-10 bg-black/20 text-white p-2 rounded-full backdrop-blur-md hover:bg-black/30"><X className="w-6 h-6" /></button>
      <div className="w-full h-48 bg-gray-200"><img src={friend.cover || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80"} className="w-full h-full object-cover" /></div>
      <div className="-mt-16 mb-4 relative"><img src={friend.avatar} className="w-32 h-32 rounded-[40px] border-[6px] border-white object-cover shadow-lg" /></div>
      <h2 className="text-2xl font-bold mb-1">{friend.name}</h2>
      <p className="text-xs text-gray-400 font-mono mb-4">ID: {friend.id}</p>
      <div className="w-full px-8 mb-6"><p className="text-center text-sm text-gray-600 bg-gray-50 py-3 px-4 rounded-2xl">{friend.status || "ステータスなし"}</p></div>
      <div className="flex gap-4 w-full px-8">
        <button onClick={() => { onStartChat(friend.uid); onClose(); }} className="flex-1 py-3 bg-green-500 text-white rounded-2xl font-bold shadow-lg shadow-green-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"><MessageCircle className="w-5 h-5" /> トーク</button>
        <button onClick={onTransfer} className="flex-1 py-3 bg-yellow-500 text-white rounded-2xl font-bold shadow-lg shadow-yellow-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"><Coins className="w-5 h-5" /> 送金</button>
      </div>
    </div>
  </div>
);

// --- Auth Components ---

const AuthView = ({ onLogin, showNotification }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try { setLoading(true); await signInWithRedirect(auth, provider); }
    catch (e) { console.error(e); showNotification("Googleログイン失敗"); setLoading(false); }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try { await signInAnonymously(auth); showNotification("ゲストログインしました"); }
    catch (e) { showNotification("ゲストログイン失敗"); } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
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
          friends: [], wallet: 1000, isBanned: false,
        });
        showNotification("アカウント作成完了");
      }
    } catch (e) { showNotification("エラー: " + e.message); } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-8 border border-white/50 backdrop-blur-sm">
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
  );
};

// --- Message Item (with Mention Support) ---
const MessageItem = React.memo(({ m, user, sender, isGroup, db, appId, chatId, addFriendById, onEdit, onDelete, onPreview, onReply, onReaction, allUsers, onStickerClick, onShowProfile }) => {
  const isMe = m.senderId === user.uid;
  const [mediaSrc, setMediaSrc] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (m.type === "image" || m.type === "video") setMediaSrc(m.content || m.preview);
  }, [m.content, m.preview, m.type]);

  // @メンションやリンクをパースして表示
  const renderContent = (text) => {
    if (!text) return "";
    const regex = /(https?:\/\/[^\s]+)|(@[^\s]+)/g;
    return text.split(regex).map((part, i) => {
      if (!part) return null;
      if (part.match(/^https?:\/\//)) return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{part}</a>;
      if (part.startsWith('@')) {
        const name = part.substring(1); // @を除去
        const u = allUsers.find(user => user.name === name);
        if (u) return <span key={i} className="text-blue-500 font-bold cursor-pointer hover:underline bg-blue-50 px-1 rounded mx-0.5" onClick={(e) => { e.stopPropagation(); onShowProfile(u); }}>{part}</span>;
      }
      return part;
    });
  };

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"} gap-2 relative group mb-4`}>
      {!isMe && (
        <div className="relative mt-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); onShowProfile(sender); }}>
          <img src={sender?.avatar} className="w-8 h-8 rounded-lg object-cover border" loading="lazy" />
          {isTodayBirthday(sender?.birthday) && <span className="absolute -top-1 -right-1 text-[8px]">🎂</span>}
        </div>
      )}
      <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[75%]`}>
        {!isMe && isGroup && <div className="text-[10px] text-gray-600 font-bold mb-1 ml-1 cursor-pointer hover:underline" onClick={() => onShowProfile(sender)}>{sender?.name}</div>}
        <div className="relative" onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}>
          <div className={`p-2 px-3 rounded-2xl text-[13px] shadow-sm relative ${m.type === "sticker" ? "bg-transparent p-0" : isMe ? "bg-[#7cfc00] rounded-tr-none" : "bg-white rounded-tl-none"}`}>
            {m.type === "text" && <div className="whitespace-pre-wrap">{renderContent(m.content)}</div>}
            {m.type === "sticker" && <img src={m.content} className="w-32 h-32 object-contain" onClick={(e) => { e.stopPropagation(); onStickerClick(m.packId); }} />}
            {m.type === "image" && <img src={mediaSrc} className="max-w-full rounded-xl border" />}
            {m.type === "video" && <video src={mediaSrc} className="max-w-full rounded-xl border bg-black" controls />}
            {m.type === "audio" && <audio src={m.content} controls className="h-8 max-w-[200px]" />}
            <div className="text-[8px] opacity-50 mt-1 text-right">{formatDateTime(m.createdAt)}</div>
            {showMenu && (
              <div className={`absolute top-full ${isMe ? "right-0" : "left-0"} mt-1 z-[100] bg-white rounded-xl shadow-2xl border overflow-hidden min-w-[120px]`}>
                <button onClick={(e) => { e.stopPropagation(); onReply(m); setShowMenu(false); }} className="w-full px-4 py-3 text-xs font-bold text-left hover:bg-gray-100 flex items-center gap-2"><Reply className="w-4 h-4" />リプライ</button>
                {isMe && <button onClick={(e) => { e.stopPropagation(); onDelete(m.id); }} className="w-full px-4 py-3 text-xs font-bold text-red-500 text-left hover:bg-red-50 flex items-center gap-2"><Trash2 className="w-4 h-4" />削除</button>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// --- Chat Room View ---
const ChatRoomView = ({ user, profile, allUsers, chats, activeChatId, setActiveChatId, setView, db, appId, showNotification, addFriendById, startVideoCall }) => {
  const [messages, setMessages] = useState([]), [text, setText] = useState(""), [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false), [replyTo, setReplyTo] = useState(null), [viewProfile, setViewProfile] = useState(null);
  const [coinModalTarget, setCoinModalTarget] = useState(null);
  const scrollRef = useRef();

  const chatData = chats.find((c) => c.id === activeChatId);
  if (!chatData) return <div className="h-full flex items-center justify-center bg-white"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

  const isGroup = chatData.isGroup;
  let title = chatData.name, icon = chatData.icon, partnerId = isGroup ? null : chatData.participants.find(p => p !== user.uid) || user.uid;
  if (!isGroup) { const p = allUsers.find(u => u.uid === partnerId); if (p) { title = p.name; icon = p.avatar; } }

  useEffect(() => {
    const q = query(collection(db, "artifacts", appId, "public", "data", "chats", activeChatId, "messages"), orderBy("createdAt", "asc"), limitToLast(50));
    return onSnapshot(q, (snap) => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [activeChatId]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (content, type = "text", additionalData = {}, file = null) => {
    if (!content && !file && type === "text") return; setIsUploading(true);
    const msgCol = collection(db, "artifacts", appId, "public", "data", "chats", activeChatId, "messages");
    try {
      const msgData = { senderId: user.uid, content, type, createdAt: serverTimestamp(), readBy: [user.uid], ...additionalData };
      if (replyTo) { msgData.replyTo = { id: replyTo.id, content: replyTo.content, senderName: allUsers.find(u => u.uid === replyTo.senderId)?.name }; setReplyTo(null); }
      if (file) {
        const reader = new FileReader(); reader.readAsDataURL(file);
        await new Promise(r => reader.onload = async (e) => { msgData.content = e.target.result; await addDoc(msgCol, msgData); r(); });
      } else await addDoc(msgCol, msgData);
      await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeChatId), { lastMessage: { content: type === "text" ? content : `[${type}]` }, updatedAt: serverTimestamp() });
      setText(""); setPlusMenuOpen(false);
    } catch (e) { showNotification("送信失敗"); } finally { setIsUploading(false); }
  };

  return (
    <div className="flex flex-col h-full bg-[#8fb2c9] relative">
      <div className="p-3 bg-white/95 backdrop-blur border-b flex items-center gap-3 sticky top-0 z-10">
        <ChevronLeft className="cursor-pointer w-6 h-6" onClick={() => setView("home")} />
        <img src={icon} className="w-10 h-10 rounded-xl object-cover border" />
        <div className="font-bold text-sm flex-1 truncate">{title}</div>
        <div className="flex gap-4 items-center">
          <button onClick={() => startVideoCall(activeChatId, true)} title="ビデオ通話"><Video className="w-6 h-6 text-gray-600 hover:text-green-500" /></button>
          <button onClick={() => startVideoCall(activeChatId, false)} title="音声通話"><Phone className="w-6 h-6 text-gray-600 hover:text-green-500" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((m) => (
          <MessageItem key={m.id} m={m} user={user} sender={allUsers.find(u => u.uid === m.senderId)} isGroup={isGroup} db={db} appId={appId} chatId={activeChatId} addFriendById={addFriendById} onDelete={(id) => deleteDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeChatId, "messages", id))} onReply={setReplyTo} allUsers={allUsers} onShowProfile={setViewProfile} />
        ))}
        <div ref={scrollRef} />
      </div>
      <div className="p-3 bg-white border-t flex flex-col gap-2 relative z-10">
        {replyTo && <div className="flex items-center justify-between bg-gray-100 p-2 rounded-xl text-xs mb-1"><span>返信: {allUsers.find(u => u.uid === replyTo.senderId)?.name}</span><X className="w-3 h-3 cursor-pointer" onClick={() => setReplyTo(null)} /></div>}
        <div className="flex items-center gap-2">
          <button onClick={() => setPlusMenuOpen(!plusMenuOpen)}><Plus className="text-gray-400" /></button>
          <input className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 text-sm focus:outline-none" placeholder="メッセージ..." value={text} onChange={(e) => setText(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage(text)} />
          <button onClick={() => sendMessage(text)} disabled={!text && !isUploading} className="text-green-500"><Send /></button>
        </div>
      </div>
      {plusMenuOpen && (
        <div className="absolute bottom-16 left-4 right-4 bg-white rounded-3xl p-4 shadow-2xl grid grid-cols-4 gap-4 z-20">
          <label className="flex flex-col items-center gap-1 cursor-pointer"><div className="p-3 bg-green-50 rounded-2xl"><ImageIcon className="text-green-500" /></div><span className="text-[10px]">画像</span><input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, (d, t, f) => sendMessage(d, t, {}, f))} /></label>
        </div>
      )}
      {viewProfile && <FriendProfileModal friend={viewProfile} onClose={() => setViewProfile(null)} onStartChat={(uid) => { setViewProfile(null); }} onTransfer={() => { setCoinModalTarget(viewProfile); setViewProfile(null); }} />}
      {coinModalTarget && <CoinTransferModal onClose={() => setCoinModalTarget(null)} myWallet={profile.wallet} myUid={user.uid} targetUid={coinModalTarget.uid} targetName={coinModalTarget.name} showNotification={showNotification} />}
    </div>
  );
};

// --- Home View ---
const HomeView = ({ user, profile, allUsers, chats, setView, setActiveChatId, setSearchModalOpen, startChatWithUser, showNotification }) => {
  const [tab, setTab] = useState("chats"), [selectedFriend, setSelectedFriend] = useState(null), [coinModalTarget, setCoinModalTarget] = useState(null);
  const friends = useMemo(() => allUsers.filter(u => profile?.friends?.includes(u.uid)), [allUsers, profile]);
  return (
    <div className="flex flex-col h-full bg-white border-x border-gray-200 max-w-md mx-auto">
      <div className="p-4 border-b flex justify-between items-center bg-white shrink-0 sticky top-0 z-10">
        <h1 className="text-xl font-bold">ホーム</h1>
        <div className="flex gap-4 items-center">
          <div className="bg-yellow-100 px-3 py-1 rounded-full flex items-center gap-1"><Coins className="w-4 h-4 text-yellow-600" /><span className="text-sm font-bold">{profile?.wallet || 0}</span></div>
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
        {tab === "friends" && friends.map(f => (<div key={f.uid} className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedFriend(f)}><img src={f.avatar} className="w-12 h-12 rounded-xl object-cover border" /><div className="flex-1 font-bold text-sm">{f.name}</div></div>))}
        {tab === "chats" && chats.sort((a,b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)).map(chat => {
          let name = chat.name, icon = chat.icon; if (!chat.isGroup) { const p = allUsers.find(u => u.uid === chat.participants.find(id => id !== user.uid)); if (p) { name = p.name; icon = p.avatar; } }
          return (<div key={chat.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer" onClick={() => { setActiveChatId(chat.id); setView("chatroom"); }}><img src={icon} className="w-12 h-12 rounded-xl object-cover border" /><div className="flex-1 min-w-0"><div className="font-bold text-sm truncate">{name}</div><div className="text-xs text-gray-400 truncate">{chat.lastMessage?.content}</div></div><div className="text-[10px] text-gray-300">{formatTime(chat.updatedAt)}</div></div>);
        })}
      </div>
      {selectedFriend && <FriendProfileModal friend={selectedFriend} onClose={() => setSelectedFriend(null)} onStartChat={startChatWithUser} onTransfer={() => { setCoinModalTarget(selectedFriend); setSelectedFriend(null); }} />}
      {coinModalTarget && <CoinTransferModal onClose={() => setCoinModalTarget(null)} myWallet={profile.wallet} myUid={user.uid} targetUid={coinModalTarget.uid} targetName={coinModalTarget.name} showNotification={showNotification} />}
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
        {posts.map(p => {
          const u = allUsers.find(au => au.uid === p.userId);
          return (
            <div key={p.id} className="bg-white p-4 mb-2 border-b">
              <div className="flex items-center gap-3 mb-3"><img src={u?.avatar} className="w-10 h-10 rounded-xl border" /><div className="font-bold text-sm">{u?.name}</div></div>
              <div className="text-sm mb-3 whitespace-pre-wrap">{p.content}</div>
              {p.media && <img src={p.media} className="w-full rounded-2xl max-h-96 object-cover mb-3" />}
              <div className="flex items-center gap-6 py-2 border-y mb-3"><Heart className="w-5 h-5 text-gray-400" /><MessageCircle className="w-5 h-5 text-gray-400" /></div>
            </div>
          );
        })}
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

// --- Main App ---
export default function App() {
  const [user, setUser] = useState(null), [profile, setProfile] = useState(null), [view, setView] = useState("auth"), [activeChatId, setActiveChatId] = useState(null);
  const [allUsers, setAllUsers] = useState([]), [chats, setChats] = useState([]), [posts, setPosts] = useState([]), [notification, setNotification] = useState(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false), [searchQuery, setSearchQuery] = useState("");
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

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
    onSnapshot(query(collection(db, "artifacts", appId, "public", "data", "chats"), where("participants", "array-contains", user.uid)), (snapshot) => {
      const chatList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setChats(chatList);
      const incoming = chatList.find(c => c.callStatus?.status === "ringing" && c.callStatus.callerId !== user.uid);
      if (incoming) setIncomingCall({ chatId: incoming.id, callData: incoming.callStatus });
      else setIncomingCall(null);
    });
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

  const startVideoCall = async (chatId, isVideo = true) => {
    await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", chatId), { "callStatus.status": "ringing", "callStatus.callerId": user.uid, "callStatus.timestamp": Date.now() });
    setActiveCall({ chatId, callData: { callerId: user.uid }, isVideo });
  };

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col items-center justify-center bg-gray-50">
      {notification && <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[999] bg-black/85 text-white px-6 py-2 rounded-full text-xs font-bold shadow-2xl animate-in fade-in slide-in-from-top-4">{notification}</div>}
      
      {!user ? (
        <AuthView onLogin={setUser} showNotification={showNotification} />
      ) : (
        <div className="w-full max-w-md h-full bg-white shadow-2xl overflow-hidden relative border-x border-gray-200">
          {activeCall ? (
            <VideoCallView user={user} chatId={activeCall.chatId} callData={activeCall.callData} isVideoEnabled={activeCall.isVideo} onEndCall={async () => { await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeCall.chatId), { callStatus: deleteField() }); setActiveCall(null); }} />
          ) : incomingCall ? (
            <div className="fixed inset-0 z-[1000] bg-gray-900 flex flex-col items-center justify-center p-6 animate-in fade-in">
              <div className="text-white text-2xl font-bold mb-8 flex flex-col items-center gap-4"><div className="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center animate-pulse"><Phone className="w-16 h-16"/></div>着信中...</div>
              <div className="flex gap-8">
                <button onClick={async () => { await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", incomingCall.chatId), { callStatus: deleteField() }); setIncomingCall(null); }} className="p-6 bg-red-500 rounded-full shadow-lg text-white"><PhoneOff className="w-8 h-8"/></button>
                <button onClick={() => { setActiveCall({ chatId: incomingCall.chatId, callData: incomingCall.callData, isVideo: true }); setIncomingCall(null); }} className="p-6 bg-green-500 rounded-full shadow-lg text-white animate-bounce"><Video className="w-8 h-8"/></button>
              </div>
            </div>
          ) : (
            <>
              {view === "home" && <HomeView user={user} profile={profile} allUsers={allUsers} chats={chats} setView={setView} setActiveChatId={setActiveChatId} setSearchModalOpen={setSearchModalOpen} startChatWithUser={async (tid) => { const ex = chats.find(c => !c.isGroup && c.participants.includes(tid)); if (ex) { setActiveChatId(ex.id); setView("chatroom"); } else { const r = await addDoc(collection(db, "artifacts", appId, "public", "data", "chats"), { participants: [user.uid, tid], isGroup: false, createdAt: serverTimestamp(), lastMessage: { content: "トークを開始しました" } }); setActiveChatId(r.id); setView("chatroom"); } }} showNotification={showNotification} />}
              {view === "chatroom" && <ChatRoomView user={user} profile={profile} allUsers={allUsers} chats={chats} activeChatId={activeChatId} setActiveChatId={setActiveChatId} setView={setView} db={db} appId={appId} showNotification={showNotification} addFriendById={addFriendById} startVideoCall={startVideoCall} />}
              {view === "voom" && <VoomView user={user} allUsers={allUsers} profile={profile} posts={posts} showNotification={showNotification} db={db} appId={appId} />}
              {view === "profile" && <ProfileEditView user={user} profile={profile} setView={setView} showNotification={showNotification} copyToClipboard={(t) => { navigator.clipboard.writeText(t); showNotification("コピーしました"); }} />}
              {view === "qr" && <QRScannerView user={user} setView={setView} addFriendById={addFriendById} />}
              
              {user && ["home", "voom"].includes(view) && (
                <div className="h-20 bg-white border-t flex items-center justify-around z-50 pb-4 shrink-0 absolute bottom-0 w-full">
                  <div className={`flex flex-col items-center gap-1 cursor-pointer ${view === "home" ? "text-green-500" : "text-gray-400"}`} onClick={() => setView("home")}><Home className="w-6 h-6" /><span className="text-[10px] font-bold">ホーム</span></div>
                  <div className={`flex flex-col items-center gap-1 cursor-pointer ${view === "voom" ? "text-green-500" : "text-gray-400"}`} onClick={() => setView("voom")}><LayoutGrid className="w-6 h-6" /><span className="text-[10px] font-bold">VOOM</span></div>
                </div>
              )}
            </>
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
