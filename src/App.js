import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithRedirect,
  GoogleAuthProvider,
  signOut
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
  User, KeyRound, MicOff, VideoOff, ArrowRightLeft, MoreVertical
} from 'lucide-react';

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

// データを維持するためのID
const appId = "voom-app-persistent-v1";

const CHUNK_SIZE = 700000; // Firestore制限回避のための分割サイズ
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// WebRTC Configuration
const rtcConfig = {
  iceServers: [
    { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
  ],
};

// --- Utility Functions ---
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString();
};

const formatDateTime = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const isTodayBirthday = (birthdayString) => {
  if (!birthdayString) return false;
  const today = new Date();
  const [y, m, d] = birthdayString.split('-').map(Number);
  return (today.getMonth() + 1) === m && today.getDate() === d;
};

const processFileBeforeUpload = (file) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image') || file.type === 'image/gif') {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
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
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob.size > file.size ? file : new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
          } else { resolve(file); }
        }, 'image/jpeg', 0.8);
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
  e.target.value = '';
  let file = originalFile;
  if (originalFile.type.startsWith('image') && originalFile.type !== 'image/gif') {
    file = await processFileBeforeUpload(originalFile);
  }
  let type = 'file';
  if (file.type.startsWith('image')) type = 'image';
  else if (file.type.startsWith('video')) type = 'video';
  else if (file.type.startsWith('audio')) type = 'audio';

  // 動画や大きなファイルはURL変換せずにFileオブジェクトのまま渡す（チャンク処理用）
  if (file.size > 1024 * 1024 || type === 'video' || type === 'file') {
    callback(null, type, file); 
  } else {
    const reader = new FileReader();
    reader.onload = (event) => callback(event.target.result, type, file);
    reader.readAsDataURL(file);
  }
};

const handleCompressedUpload = (e, callback) => {
  const file = e.target.files[0];
  if (!file || !file.type.startsWith('image')) return;
  const reader = new FileReader();
  reader.onload = (event) => {
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
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

// --- Video Call Component ---
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

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await addDoc(collection(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "candidates", "list"), {
            candidate: event.candidate.toJSON(),
            senderId: user.uid,
            createdAt: serverTimestamp(),
          });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: isVideoEnabled, audio: true });
        setLocalStream(stream);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const isCaller = callData.callerId === user.uid;
        const signalingRef = doc(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "session");

        if (isCaller) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await setDoc(signalingRef, { type: "offer", sdp: offer.sdp, callerId: user.uid });
        }

        onSnapshot(signalingRef, async (snap) => {
          const data = snap.data();
          if (!pc.currentRemoteDescription && data && data.type === "answer" && isCaller) {
            const answer = new RTCSessionDescription(data);
            await pc.setRemoteDescription(answer);
          } else if (!pc.currentRemoteDescription && data && data.type === "offer" && !isCaller) {
            const offer = new RTCSessionDescription(data);
            await pc.setRemoteDescription(offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await updateDoc(signalingRef, { type: "answer", sdp: answer.sdp });
          }
        });

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
        console.error("Error accessing media devices.", err);
        onEndCall();
      }
    };
    startCall();

    return () => {
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
        {remoteStream ? (
           <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
           <div className="text-white flex flex-col items-center gap-4">
             <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center animate-pulse"><User className="w-10 h-10"/></div>
             <p>接続中...</p>
           </div>
        )}
        {isVideoEnabled && (
          <div className="absolute top-4 right-4 w-32 h-48 bg-black rounded-xl overflow-hidden border-2 border-white shadow-lg">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
          </div>
        )}
      </div>
      <div className="h-24 bg-black/80 flex items-center justify-center gap-8 pb-6">
        <button onClick={toggleMute} className={`p-4 rounded-full ${isMuted ? "bg-white text-black" : "bg-gray-700 text-white"}`}>
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        <button onClick={onEndCall} className="p-4 rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 transform hover:scale-110 transition-all">
          <PhoneOff className="w-8 h-8" />
        </button>
        {isVideoEnabled && (
          <button onClick={toggleVideo} className={`p-4 rounded-full ${isVideoOff ? "bg-white text-black" : "bg-gray-700 text-white"}`}>
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}
      </div>
    </div>
  );
};

// --- Modals ---

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

const ContactSelectModal = ({ onClose, onSend, friends }) => (
  <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col max-h-[70vh]">
      <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">連絡先を選択</h3><button onClick={onClose}><X className="w-6 h-6"/></button></div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">{friends.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">友だちがいません</div> : friends.map(f => <div key={f.uid} onClick={() => onSend(f)} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer border border-transparent hover:border-gray-100 transition-all"><img src={f.avatar} className="w-10 h-10 rounded-xl object-cover border" /><span className="font-bold text-sm flex-1">{f.name}</span><Plus className="w-4 h-4 text-green-500" /></div>)}</div>
    </div>
  </div>
);

const BirthdayCardModal = ({ onClose, onSend, toName }) => {
  const [color, setColor] = useState('pink'), [message, setMessage] = useState('');
  const colors = [{ id: 'pink', class: 'bg-pink-100 border-pink-300' }, { id: 'blue', class: 'bg-blue-100 border-blue-300' }, { id: 'yellow', class: 'bg-yellow-100 border-yellow-300' }, { id: 'green', class: 'bg-green-100 border-green-300' }];
  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">カードを送る</h3><button onClick={onClose}><X className="w-6 h-6"/></button></div>
        <div className="mb-4 flex gap-3">{colors.map(c => <button key={c.id} onClick={() => setColor(c.id)} className={`w-10 h-10 rounded-full border-2 ${c.class} ${color === c.id ? 'scale-125 ring-2 ring-gray-300' : ''}`}/>)}</div>
        <div className={`p-4 rounded-2xl border-2 mb-4 ${colors.find(c=>c.id===color).class}`}><div className="font-bold text-gray-700 mb-2">To: {toName}</div><textarea className="w-full bg-white/50 rounded-xl p-3 text-sm focus:outline-none min-h-[100px]" placeholder="メッセージ..." value={message} onChange={e => setMessage(e.target.value)}/></div>
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

const GroupAddMemberModal = ({ onClose, currentMembers, chatId, allUsers, profile, user, showNotification }) => {
    const [selected, setSelected] = useState([]);
    const inviteableFriends = allUsers.filter(u => (profile?.friends || []).includes(u.uid) && !currentMembers.includes(u.uid));
    const toggle = (uid) => setSelected(prev => prev.includes(uid) ? prev.filter(i => i !== uid) : [...prev, uid]);
    const handleInvite = async () => {
      if (selected.length === 0) return;
      try {
        const addedNames = [];
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId), { participants: arrayUnion(...selected) });
        selected.forEach(uid => { const u = allUsers.find(user => user.uid === uid); if (u) addedNames.push(u.name); });
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
          <div className="flex-1 overflow-y-auto p-4 space-y-2">{inviteableFriends.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">招待できる友だちがいません</div> : inviteableFriends.map(f => <div key={f.uid} onClick={() => toggle(f.uid)} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer border border-transparent transition-all"><img src={f.avatar} className="w-10 h-10 rounded-xl object-cover border" /><span className="font-bold text-sm flex-1">{f.name}</span><div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selected.includes(f.uid) ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}>{selected.includes(f.uid) && <Check className="w-4 h-4 text-white" />}</div></div>)}</div>
          <div className="p-4 border-t"><button onClick={handleInvite} disabled={selected.length === 0} className={`w-full py-3 rounded-2xl font-bold shadow-lg text-white transition-all ${selected.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}>招待する ({selected.length})</button></div>
        </div>
      </div>
    );
};

const GroupEditModal = ({ onClose, chatId, currentName, currentIcon, currentMembers, allUsers, showNotification, user, profile }) => {
    const [name, setName] = useState(currentName);
    const [icon, setIcon] = useState(currentIcon);
    const [kickTarget, setKickTarget] = useState(null);

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
                <div className="relative group"><img src={icon} className="w-24 h-24 rounded-3xl object-cover bg-gray-100 border shadow-sm" /><label className="absolute bottom-0 right-0 bg-green-500 p-2 rounded-full text-white cursor-pointer shadow-lg border-2 border-white hover:bg-green-600 transition-colors"><CameraIcon className="w-4 h-4" /><input type="file" className="hidden" accept="image/*" onChange={e => handleCompressedUpload(e, d => setIcon(d))} /></label></div>
                <div className="w-full"><label className="text-xs font-bold text-gray-400 mb-1 block">グループ名</label><input className="w-full text-center text-lg font-bold border-b py-2 focus:outline-none focus:border-green-500 bg-transparent" placeholder="グループ名を入力" value={name} onChange={e => setName(e.target.value)} /></div>
            </div>
            <div className="mb-6"><h4 className="text-xs font-bold text-gray-400 mb-2 uppercase flex justify-between"><span>メンバー ({currentMembers.length})</span><span className="text-[10px] text-gray-400 font-normal">管理者権限: 削除可能</span></h4>
                <div className="space-y-2">{currentMembers.map(uid => { const m = allUsers.find(u => u.uid === uid); if (!m) return null; const isMe = uid === user.uid; return ( <div key={uid} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100"><img src={m.avatar} className="w-10 h-10 rounded-full object-cover border" /><div className="flex-1 min-w-0"><div className="font-bold text-sm truncate">{m.name} {isMe && <span className="text-gray-400 text-xs">(自分)</span>}</div></div>{!isMe && (<button onClick={() => setKickTarget({ uid, name: m.name })} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors flex items-center gap-1 group" title="強制退会"><span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">強制退会</span><UserMinus className="w-5 h-5" /></button>)}</div> ); })}</div>
            </div>
          </div>
          <button onClick={handleUpdate} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-2xl shadow-lg transition-all shrink-0 mt-4">保存する</button>
        </div>
        {kickTarget && (<div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl"><h3 className="font-bold text-lg mb-2 text-center text-gray-800">強制退会の確認</h3><p className="text-center text-gray-600 mb-6 text-sm">{kickTarget.name} をグループから退会させますか？<br/><span className="text-xs text-red-500">この操作は元に戻せません。</span></p><div className="flex gap-3"><button onClick={() => setKickTarget(null)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-2xl text-gray-600 transition-colors">キャンセル</button><button onClick={executeKick} className="flex-1 py-3 bg-red-500 hover:bg-red-600 font-bold rounded-2xl text-white transition-colors shadow-lg shadow-red-200">退会させる</button></div></div></div>)}
      </div>
    );
};

const LeaveGroupConfirmModal = ({ onClose, onLeave }) => (
  <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
      <div className="text-center mb-6"><div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3"><LogOut className="w-6 h-6 text-red-500" /></div><h3 className="font-bold text-lg text-gray-800">グループを退会しますか？</h3><p className="text-sm text-gray-500 mt-2">この操作は取り消せません。<br/>本当に退会してもよろしいですか？</p></div>
      <div className="flex gap-3"><button onClick={onClose} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors">キャンセル</button><button onClick={onLeave} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-red-200">退会する</button></div>
    </div>
  </div>
);

const IncomingCallOverlay = ({ callData, onAccept, onDecline, allUsers }) => {
    const caller = allUsers.find(u => u.uid === callData.callerId);
    return (
      <div className="fixed inset-0 z-[500] bg-gray-900 flex flex-col items-center justify-between py-16 px-6 animate-in fade-in duration-300">
        <div className="absolute inset-0 z-0 overflow-hidden"><img src={caller?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=caller"} className="w-full h-full object-cover blur-3xl opacity-50 scale-125" alt="background"/><div className="absolute inset-0 bg-black/40"></div></div>
        <div className="relative z-10 flex flex-col items-center gap-6 mt-12"><div className="flex flex-col items-center gap-2"><div className="flex items-center gap-2 text-white/80 mb-2"><PhoneCall className="w-5 h-5 animate-pulse" /><span className="text-sm font-bold tracking-widest">着信中...</span></div><h2 className="text-4xl font-bold text-white drop-shadow-xl text-center leading-tight">{caller?.name || "Unknown"}</h2></div><div className="relative mt-8"><div className="absolute inset-0 rounded-full bg-white/20 animate-[ping_2s_ease-in-out_infinite]"></div><div className="absolute inset-0 rounded-full bg-white/10 animate-[ping_3s_ease-in-out_infinite_delay-500ms]"></div><img src={caller?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=caller"} className="w-40 h-40 rounded-full border-[6px] border-white/20 shadow-2xl object-cover relative z-10 bg-gray-800" /></div></div>
        <div className="relative z-10 w-full flex justify-between items-end px-4 mb-8 max-w-sm"><button onClick={onDecline} className="flex flex-col items-center gap-4 group"><div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-red-600 border border-red-400"><PhoneOff className="w-10 h-10 text-white fill-current" /></div><span className="text-white text-sm font-bold shadow-black drop-shadow-md">拒否</span></button><button onClick={onAccept} className="flex flex-col items-center gap-4 group"><div className="relative"><div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-50"></div><div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-green-600 border border-green-400 relative z-10"><Video className="w-10 h-10 text-white fill-current" /></div></div><span className="text-white text-sm font-bold shadow-black drop-shadow-md">応答</span></button></div>
      </div>
    );
};

const OutgoingCallOverlay = ({ callData, onCancel, allUsers }) => (
  <div className="fixed inset-0 z-[500] bg-gray-900 flex flex-col items-center justify-between py-24 px-6 animate-in fade-in duration-300">
     <div className="flex flex-col items-center gap-6 mt-10"><div className="relative"><div className="absolute inset-0 rounded-full bg-white/10 animate-pulse"></div><div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center border-4 border-white/50 shadow-2xl relative z-10"><Video className="w-14 h-14 text-white opacity-80" /></div></div><div className="text-center text-white"><h2 className="text-2xl font-bold mb-2">発信中...</h2><p className="text-sm opacity-60">相手の応答を待っています</p></div></div>
    <div className="w-full flex justify-center items-center mb-10"><button onClick={onCancel} className="flex flex-col items-center gap-3 group"><div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-red-600"><X className="w-10 h-10 text-white" /></div><span className="text-white text-xs font-bold">キャンセル</span></button></div>
  </div>
);

const MessageItem = React.memo(({ m, user, sender, isGroup, db, appId, chatId, addFriendById, onEdit, onDelete, onPreview, onReply, onReaction, allUsers, onStickerClick, onShowProfile }) => {
    const isMe = m.senderId === user.uid;
    const [mediaSrc, setMediaSrc] = useState(null); 
    const [loading, setLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const isInvalidBlob = !isMe && m.content?.startsWith('blob:');

    const setBlobSrcFromBase64 = (base64Data, mimeType) => {
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

    const handleStickerClick = (e) => {
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
    const handleBubbleClick = (e) => { e.stopPropagation(); setShowMenu(!showMenu); };
    const renderContent = (text) => {
      if (!text) return "";
      const regex = /(https?:\/\/[^\s]+)|(@[^\s]+)/g;
      const parts = text.split(regex);
      return parts.map((part, i) => {
        if (!part) return null;
        if (part.match(/^https?:\/\//)) return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all" onClick={(e) => e.stopPropagation()}>{part}</a>;
        if (part.startsWith('@')) {
           const name = part.substring(1);
           const mentionedUser = allUsers.find(u => u.name === name);
           if (mentionedUser) return <span key={i} className="text-blue-500 font-bold cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onShowProfile(mentionedUser); }}>{part}</span>;
        }
        return part;
      });
    };
    const getUserNames = (uids) => { if (!uids || !allUsers) return ""; return uids.map(uid => { const u = allUsers.find(user => user.uid === uid); return u ? u.name : "不明なユーザー"; }).join(", "); };

    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2 relative group mb-4`}>
        {!isMe && (<div className="relative mt-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); onShowProfile(sender); }}><img key={sender?.avatar} src={sender?.avatar} className="w-8 h-8 rounded-lg object-cover border" loading="lazy" />{isTodayBirthday(sender?.birthday) && <span className="absolute -top-1 -right-1 text-[8px]">🎂</span>}</div>)}
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
          {!isMe && isGroup && <div className="text-[10px] text-gray-600 font-bold mb-1 ml-1">{sender?.name}</div>}
          <div className="relative">
             <div onClick={handleBubbleClick} className={`p-2 px-3 rounded-2xl text-[13px] shadow-sm relative cursor-pointer ${m.type === 'sticker' ? 'bg-transparent shadow-none p-0' : (isMe ? 'bg-[#7cfc00] rounded-tr-none' : 'bg-white rounded-tl-none')} ${['image', 'video'].includes(m.type) ? 'p-0 bg-transparent shadow-none' : ''}`}>
              {m.replyTo && m.type !== 'sticker' && (<div className={`mb-2 p-2 rounded-lg border-l-4 text-xs opacity-70 ${isMe ? 'bg-black/5 border-white/50' : 'bg-gray-100 border-gray-300'}`}><div className="font-bold text-[10px] mb-0.5">{m.replyTo.senderName}</div><div className="truncate flex items-center gap-1">{m.replyTo.type === 'image' && <ImageIcon className="w-3 h-3" />}{m.replyTo.type === 'video' && <Video className="w-3 h-3" />}{['image', 'video'].includes(m.replyTo.type) ? (m.replyTo.type === 'image' ? '[画像]' : '[動画]') : (m.replyTo.content || '[メッセージ]')}</div></div>)}
              {m.type === 'text' && <div className="whitespace-pre-wrap">{renderContent(m.content)}{m.isEdited && <div className="text-[9px] text-black/40 text-right mt-1 font-bold">(編集済)</div>}</div>}
              {m.type === 'sticker' && (
                  <div className="relative group/sticker" onClick={handleStickerClick}>
                    <img src={m.content || ""} className="w-32 h-32 object-contain drop-shadow-sm hover:scale-105 transition-transform" />
                    {m.audio && <div className="absolute bottom-0 right-0 bg-black/20 text-white rounded-full p-1"><Volume2 className="w-3 h-3"/></div>}
                  </div>
              )}
              {(m.type === 'image' || m.type === 'video') && (<div className="relative">{isShowingPreview && !finalSrc ? (<div className="p-4 bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 min-w-[150px] min-h-[100px] border border-gray-200"><Loader2 className="animate-spin w-8 h-8 text-green-500"/><span className="text-[10px] text-gray-500 font-bold">{m.type === 'video' ? '動画を受信中...' : '画像を受信中...'}</span></div>) : (<div className="relative">{m.type === 'video' ? (<video src={finalSrc} className={`max-w-full rounded-xl border border-white/50 shadow-md bg-black ${showMenu ? 'brightness-50 transition-all' : ''}`} controls playsInline preload="metadata"/>) : (<img src={finalSrc} className={`max-w-full rounded-xl border border-white/50 shadow-md ${showMenu ? 'brightness-50 transition-all' : ''} ${isShowingPreview ? 'opacity-80 blur-[1px]' : ''}`} loading="lazy" />)}{m.type === 'video' && !isShowingPreview && !finalSrc && (<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"><div className="bg-black/30 rounded-full p-2 backdrop-blur-sm"><Play className="w-8 h-8 text-white fill-white opacity-90" /></div></div>)}{isShowingPreview && (<div className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> {isInvalidBlob ? "送信中..." : "受信中..."}</div>)}</div>)}{isMe && m.isUploading && <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm">送信中...</div>}</div>)}
              {m.type === 'audio' && (<div className="flex items-center gap-2 py-1 px-1">{loading ? (<Loader2 className="animate-spin w-4 h-4 text-gray-400"/>) : (<audio src={mediaSrc} controls className="h-8 max-w-[200px]" />)}</div>)}
              {m.type === 'file' && (<div className="flex items-center gap-3 p-2 min-w-[200px]"><div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 border"><FileText className="w-6 h-6 text-gray-500" /></div><div className="flex-1 min-w-0"><div className="text-sm font-bold truncate">{m.fileName || '不明なファイル'}</div><div className="text-[10px] text-gray-400">{m.fileSize ? `${(m.fileSize / 1024).toFixed(1)} KB` : 'サイズ不明'}</div></div><button onClick={(e) => { e.stopPropagation(); handleDownload(); }} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin text-gray-500"/> : <Download className="w-4 h-4 text-gray-600"/>}</button></div>)}
              {m.type === 'contact' && (<div className="flex flex-col gap-2 min-w-[150px] p-1"><div className="text-[10px] font-bold text-gray-400 mb-1 border-b border-gray-100 pb-1">連絡先</div><div className="flex items-center gap-3"><img src={m.contactAvatar} className="w-10 h-10 rounded-full border shadow-sm" loading="lazy" /><span className="font-bold text-sm truncate">{m.contactName}</span></div>{!isMe && <button onClick={(e) => { e.stopPropagation(); addFriendById(m.contactId); }} className="bg-black/5 hover:bg-black/10 text-xs font-bold py-2 rounded-xl mt-1 w-full flex items-center justify-center gap-2"><UserPlus className="w-3 h-3" /> 友だち追加</button>}</div>)}
              <div className={`text-[8px] opacity-50 mt-1 text-right ${m.type === 'sticker' ? 'text-gray-500 font-bold bg-white/50 px-1 rounded' : ''}`}>{formatDateTime(m.createdAt)}</div>
              {showMenu && (<div className={`absolute top-full ${isMe ? 'right-0' : 'left-0'} mt-1 z-[100] flex flex-col bg-white rounded-xl shadow-2xl border overflow-hidden min-w-[180px] animate-in slide-in-from-top-2 duration-200`}><div className="flex justify-between items-center p-2 bg-gray-50 border-b gap-1 overflow-x-auto scrollbar-hide">{REACTION_EMOJIS.map(emoji => (<button key={emoji} onClick={(e) => { e.stopPropagation(); onReaction(m.id, emoji); setShowMenu(false); }} className="hover:scale-125 transition-transform text-lg p-1">{emoji}</button>))}</div><button onClick={(e) => { e.stopPropagation(); onReply(m); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left"><Reply className="w-4 h-4" />リプライ</button>{(m.type === 'image' || m.type === 'video') && (<button onClick={(e) => { e.stopPropagation(); onPreview(finalSrc, m.type); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"><Maximize className="w-4 h-4" />拡大表示</button>)}{m.type === 'file' && (<button onClick={(e) => { e.stopPropagation(); handleDownload(); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"><Download className="w-4 h-4" />保存</button>)}{m.type === 'text' && isMe && (<button onClick={(e) => { e.stopPropagation(); onEdit(m.id, m.content); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"><Edit2 className="w-4 h-4" />編集</button>)}{isMe && (<button onClick={(e) => { e.stopPropagation(); onDelete(m.id); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 text-xs font-bold text-red-500 text-left border-t border-gray-100"><Trash2 className="w-4 h-4" />送信取消</button>)}</div>)}
            </div>
          </div>
          {m.reactions && Object.keys(m.reactions).some(k => m.reactions[k]?.length > 0) && (<div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>{Object.entries(m.reactions).map(([emoji, uids]) => uids?.length > 0 && (<button key={emoji} onClick={() => onReaction(m.id, emoji)} title={getUserNames(uids)} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs shadow-sm border transition-all hover:scale-105 active:scale-95 ${uids.includes(user.uid) ? 'bg-white border-green-500 text-green-600 ring-1 ring-green-100' : 'bg-white border-gray-100 text-gray-600'}`}><span className="text-sm">{emoji}</span><span className="font-bold text-[10px]">{uids.length}</span></button>))}</div>)}
          {isMe && readCount > 0 && (<div className="text-[10px] font-bold text-green-600 mt-0.5">既読 {isGroup ? readCount : ''}</div>)}
        </div>
      </div>
    );
});

const PostItem = ({ post, user, allUsers, db, appId, profile }) => {
    const [commentText, setCommentText] = useState(''), [mediaSrc, setMediaSrc] = useState(post.media), [isLoadingMedia, setIsLoadingMedia] = useState(false);
    const u = allUsers.find(x => x.uid === post.userId), isLiked = post.likes?.includes(user?.uid);
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
    useEffect(() => { return () => { if (mediaSrc && mediaSrc.startsWith('blob:') && !isMe) URL.revokeObjectURL(mediaSrc); }; }, [mediaSrc]);
    const toggleLike = async () => await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id), { likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) });
    const submitComment = async () => { if (!commentText.trim()) return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id), { comments: arrayUnion({ userId: user.uid, userName: profile.name, text: commentText, createdAt: new Date().toISOString() }) }); setCommentText(''); };
    return (
      <div className="bg-white p-4 mb-2 border-b shadow-sm rounded-xl mx-2 mt-2">
        <div className="flex items-center gap-3 mb-3"><div className="relative"><img key={u?.avatar} src={u?.avatar} className="w-10 h-10 rounded-xl border" loading="lazy" />{isTodayBirthday(u?.birthday) && <span className="absolute -top-1 -right-1 text-xs">🎂</span>}</div><div className="font-bold text-sm">{u?.name}</div></div>
        <div className="text-sm mb-3 whitespace-pre-wrap">{post.content}</div>
        {(mediaSrc || isLoadingMedia) && <div className="mb-3 bg-gray-50 rounded-2xl flex items-center justify-center min-h-[100px]">{isLoadingMedia ? <Loader2 className="animate-spin w-5 h-5"/> : post.mediaType === 'video' ? <video src={mediaSrc} className="w-full rounded-2xl max-h-96 bg-black" controls playsInline /> : <img src={mediaSrc} className="w-full rounded-2xl max-h-96 object-cover" loading="lazy" />}</div>}
        <div className="flex items-center gap-6 py-2 border-y mb-3"><button onClick={toggleLike} className="flex items-center gap-1.5"><Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} /><span className="text-xs">{post.likes?.length || 0}</span></button><div className="flex items-center gap-1.5 text-gray-400"><MessageCircle className="w-5 h-5" /><span className="text-xs">{post.comments?.length || 0}</span></div></div>
        <div className="space-y-3 mb-4">{post.comments?.map((c, i) => <div key={i} className="bg-gray-50 rounded-2xl px-3 py-2"><div className="text-[10px] font-bold text-gray-500">{c.userName}</div><div className="text-xs">{c.text}</div></div>)}</div>
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1"><input className="flex-1 bg-transparent text-xs py-2 outline-none" placeholder="コメント..." value={commentText} onChange={e => setCommentText(e.target.value)} onKeyPress={e => e.key === 'Enter' && submitComment()} /><button onClick={submitComment} className="text-green-500"><Send className="w-4 h-4" /></button></div>
      </div>
    );
};

const StickerStoreView = ({ user, setView, showNotification, profile, allUsers }) => {
    const [packs, setPacks] = useState([]);
    const [activeTab, setActiveTab] = useState('shop');
    const [adminSubTab, setAdminSubTab] = useState('stickers');
    const [adminMode, setAdminMode] = useState(false);
    const [adminPass, setAdminPass] = useState('');
    const [purchasing, setPurchasing] = useState(null);
    const [banTarget, setBanTarget] = useState(null);
    const [grantAmount, setGrantAmount] = useState('');

    useEffect(() => {
        let q;
        if (activeTab === 'admin' && adminSubTab === 'stickers') q = query(collection(db, 'artifacts', appId, 'public', 'data', 'sticker_packs'), where('status', '==', 'pending'));
        else if (activeTab === 'shop') q = query(collection(db, 'artifacts', appId, 'public', 'data', 'sticker_packs'), where('status', '==', 'approved'));
        else return;
        if (q) { const unsub = onSnapshot(q, (snap) => { const fetchedPacks = snap.docs.map(d => ({ id: d.id, ...d.data() })); fetchedPacks.sort((a, b) => { const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds * 1000 || 0); const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds * 1000 || 0); return tB - tA; }); setPacks(fetchedPacks); }); return () => unsub(); }
    }, [activeTab, adminSubTab]);

    const handleBuy = async (pack) => {
        if (profile?.isBanned) return showNotification("アカウントが利用停止されています 🚫");
        if ((profile.wallet || 0) < pack.price) { showNotification("コインが足りません"); return; }
        if (pack.purchasedBy?.includes(user.uid) || pack.authorId === user.uid) { showNotification("既に入手済みです"); return; }
        setPurchasing(pack.id);
        try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { wallet: increment(-pack.price) }); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', pack.authorId), { wallet: increment(pack.price) }); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sticker_packs', pack.id), { purchasedBy: arrayUnion(user.uid) }); showNotification("購入しました！"); } catch (e) { console.error(e); showNotification("購入に失敗しました"); } finally { setPurchasing(null); }
    };
    const handleApprove = async (packId, authorId, approve) => {
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
            {!adminMode && activeTab === 'admin' && (<div className="p-8 flex flex-col gap-4 items-center justify-center flex-1"><ShieldAlert className="w-16 h-16 text-gray-300" /><h3 className="font-bold text-center mb-2">管理者ログイン</h3><input type="password" value={adminPass} onChange={e=>setAdminPass(e.target.value)} className="border p-3 rounded-xl w-full max-w-xs text-center" placeholder="パスワードを入力" /><button onClick={attemptAdminLogin} className="bg-black text-white py-3 rounded-xl font-bold w-full max-w-xs shadow-lg">ログイン</button></div>)}
            {adminMode && activeTab === 'admin' && (<div className="flex bg-gray-50 p-2 gap-2"><button onClick={() => setAdminSubTab('stickers')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${adminSubTab === 'stickers' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>スタンプ承認</button><button onClick={() => setAdminSubTab('users')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${adminSubTab === 'users' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>ユーザー管理</button></div>)}
            {(activeTab === 'shop' || (adminMode && activeTab === 'admin' && adminSubTab === 'stickers')) && (<div className="flex-1 overflow-y-auto p-4 space-y-4">{packs.length === 0 && <div className="text-center py-10 text-gray-400">スタンプがありません</div>}{packs.map(pack => { const isOwned = pack.purchasedBy?.includes(user.uid) || pack.authorId === user.uid; return (<div key={pack.id} className="border rounded-2xl p-4 shadow-sm bg-white"><div className="flex justify-between items-start mb-2"><div className="flex-1"><h3 className="font-bold text-lg">{pack.name}</h3><p className="text-xs text-gray-500 font-bold mb-1">作: {pack.authorName || '不明'}</p>{pack.description && <p className="text-xs text-gray-400 bg-gray-50 p-2 rounded-lg mb-2">{pack.description}</p>}</div>{!isOwned && activeTab === 'shop' && (<button onClick={() => handleBuy(pack)} disabled={purchasing === pack.id} className="bg-green-500 text-white px-4 py-2 rounded-full font-bold text-xs shadow-md hover:bg-green-600 disabled:bg-gray-300 shrink-0 ml-2">{purchasing === pack.id ? <Loader2 className="w-4 h-4 animate-spin"/> : `¥${pack.price}`}</button>)}{isOwned && activeTab === 'shop' && (<span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold shrink-0 ml-2">入手済み</span>)}</div>
            <div className={`${activeTab === 'admin' ? 'grid grid-cols-4 gap-2 mt-2' : 'flex gap-2 overflow-x-auto pb-2 scrollbar-hide'}`}>
                {pack.stickers.map((s, i) => (
                    <div key={i} className="relative flex-shrink-0">
                        <img 
                            src={typeof s === 'string' ? s : s.image} 
                            className={`${activeTab === 'admin' ? 'w-full aspect-square' : 'w-20 h-20'} object-contain bg-gray-50 rounded-lg border`} 
                        />
                        {(typeof s !== 'string' && s.audio) && <div className="absolute top-1 right-1 bg-green-500 w-2 h-2 rounded-full border border-white"></div>}
                    </div>
                ))}
            </div>
            {activeTab === 'admin' && (<div className="flex gap-2 mt-4 pt-2 border-t"><button onClick={() => handleApprove(pack.id, pack.authorId, true)} className="flex-1 py-2 bg-blue-500 text-white rounded-lg font-bold text-xs">承認 (+100コイン)</button><button onClick={() => handleApprove(pack.id, pack.authorId, false)} className="flex-1 py-2 bg-red-500 text-white rounded-lg font-bold text-xs">拒否</button></div>)}</div>); })}</div>)}
            {adminMode && activeTab === 'admin' && adminSubTab === 'users' && (<div className="flex-1 overflow-y-auto p-4 space-y-2">{allUsers.map(u => (<div key={u.uid} className={`flex items-center gap-3 p-3 rounded-xl border ${u.isBanned ? 'bg-red-50 border-red-200' : 'bg-white'}`}><img src={u.avatar} className="w-10 h-10 rounded-full border" /><div className="flex-1 min-w-0"><div className="font-bold text-sm truncate">{u.name}</div><div className="text-xs text-gray-400 font-mono">{u.id}</div></div><button onClick={() => setBanTarget(u)} className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white ${u.isBanned ? 'bg-gray-500' : 'bg-red-500'}`}>管理</button></div>))}</div>)}
            {banTarget && (<div className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[80vh]"><h3 className="font-bold text-lg mb-1 text-center text-gray-900">ユーザー管理: {banTarget.name}</h3><p className="text-center text-gray-400 text-xs mb-6 font-mono">{banTarget.id}</p><div className="mb-6 pb-6 border-b"><h4 className="font-bold text-sm text-gray-700 mb-2">利用制限</h4><p className="text-sm text-gray-600 mb-3">{banTarget.isBanned ? "現在は停止中です。解除しますか？" : "現在利用可能です。停止しますか？"}</p><button onClick={executeBanToggle} className={`w-full py-3 font-bold rounded-2xl text-white transition-colors ${banTarget.isBanned ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'}`}>{banTarget.isBanned ? "制限を解除する" : "アカウントを停止する"}</button></div><div className="mb-6"><h4 className="font-bold text-sm text-gray-700 mb-2">コイン操作</h4><div className="flex items-center justify-between bg-yellow-50 p-3 rounded-xl mb-3"><span className="text-xs font-bold text-yellow-800">現在の所持コイン</span><span className="text-lg font-bold text-yellow-600">{banTarget.wallet || 0}</span></div><div className="flex gap-2"><input type="number" placeholder="金額 (-で没収)" className="flex-1 border p-3 rounded-xl text-center font-bold outline-none focus:border-yellow-500" value={grantAmount} onChange={e => setGrantAmount(e.target.value)} /><button onClick={handleGrantCoins} className="bg-yellow-500 text-white font-bold px-6 rounded-xl hover:bg-yellow-600 shadow-md">付与</button></div><p className="text-[10px] text-gray-400 mt-2 text-center">※マイナスの値を入力すると減算されます</p></div><button onClick={() => { setBanTarget(null); setGrantAmount(''); }} className="w-full py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-2xl text-gray-600 transition-colors">閉じる</button></div></div>)}
        </div>
    );
};

const ChatRoomView = ({ user, profile, allUsers, chats, activeChatId, setActiveChatId, setView, db, appId, mutedChats, toggleMuteChat, showNotification, addFriendById, startVideoCall }) => {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [plusMenuOpen, setPlusMenuOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
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
    const recordingIntervalRef = useRef(null);
    const [editingMsgId, setEditingMsgId] = useState(null);
    const [editingText, setEditingText] = useState('');
    const scrollRef = useRef();
    const isFirstLoad = useRef(true);
    const [messageLimit, setMessageLimit] = useState(50);
    const lastMessageIdRef = useRef(null);
    const [backgroundSrc, setBackgroundSrc] = useState(null);
    const [stickerMenuOpen, setStickerMenuOpen] = useState(false); 
    const [myStickerPacks, setMyStickerPacks] = useState([]);
    const [selectedPackId, setSelectedPackId] = useState(null);
    const [buyStickerModalPackId, setBuyStickerModalPackId] = useState(null);
    const [coinModalOpen, setCoinModalOpen] = useState(false);

    const chatData = chats.find(c => c.id === activeChatId);
    if (!chatData) return <div className="h-full flex items-center justify-center bg-white"><Loader2 className="w-8 h-8 animate-spin text-gray-400"/></div>;

    const isGroup = chatData.isGroup;
    let title = chatData.name;
    let icon = chatData.icon;
    let partnerId = null;
    let partnerData = null;

    if (!isGroup) {
        partnerId = chatData.participants.find(p => p !== user.uid);
        if (!partnerId) partnerId = user.uid; 
        partnerData = allUsers.find(u => u.uid === partnerId);
        if (partnerData) { title = partnerData.name; icon = partnerData.avatar; }
    }

    useEffect(() => {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'sticker_packs'), where('purchasedBy', 'array-contains', user.uid));
        const unsub = onSnapshot(q, (snap) => {
            const packs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const q2 = query(collection(db, 'artifacts', appId, 'public', 'data', 'sticker_packs'), where('authorId', '==', user.uid));
            getDocs(q2).then(snap2 => {
                const ownPacks = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
                const all = [...packs, ...ownPacks];
                const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
                setMyStickerPacks(unique);
                if (unique.length > 0 && !selectedPackId) setSelectedPackId(unique[0].id);
            });
        });
        return () => unsub();
    }, [user.uid]);

    useEffect(() => { isFirstLoad.current = true; }, [activeChatId]);
    useEffect(() => { if (!activeChatId) return; const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages'), orderBy('createdAt', 'asc'), limitToLast(messageLimit)); const unsub = onSnapshot(q, (snap) => { setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }); return () => unsub(); }, [activeChatId, messageLimit]);
    useEffect(() => { if (messages.length > 0) { const lastMsg = messages[messages.length - 1]; if (lastMsg.senderId !== user.uid && !lastMsg.readBy?.includes(user.uid) && !mutedChats.includes(activeChatId)) playNotificationSound(); } }, [messages.length]);
    const playNotificationSound = () => { try { const audioCtx = new (window.AudioContext || window.webkitAudioContext)(); const osc1 = audioCtx.createOscillator(); const gain1 = audioCtx.createGain(); osc1.type = 'sine'; osc1.frequency.setValueAtTime(880, audioCtx.currentTime); gain1.gain.setValueAtTime(0.1, audioCtx.currentTime); gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1); osc1.connect(gain1); gain1.connect(audioCtx.destination); osc1.start(); osc1.stop(audioCtx.currentTime + 0.1); } catch (e) {} };
    useEffect(() => { if (!activeChatId || !messages.length) return; messages.filter(m => m.senderId !== user.uid && !m.readBy?.includes(user.uid)).forEach(async (m) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages', m.id), { readBy: arrayUnion(user.uid) }); }); }, [messages.length]);
    useEffect(() => { if (messages.length > 0) { const lastMsg = messages[messages.length - 1]; if (isFirstLoad.current || lastMsg?.id !== lastMessageIdRef.current) { scrollRef.current?.scrollIntoView({ behavior: 'auto' }); lastMessageIdRef.current = lastMsg?.id; } isFirstLoad.current = false; } }, [messages]);
    useEffect(() => { 
      if (!chatData) return; 
      if (chatData.background) { setBackgroundSrc(chatData.background); } else { setBackgroundSrc(null); }
    }, [chatData]);

    // チャンク分割アップロードロジック
    const saveFileInChunks = async (file, chatId, msgId) => {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const base64 = await new Promise(r => {
            const reader = new FileReader();
            reader.onload = e => r(e.target.result.split(',')[1]); 
            reader.readAsDataURL(file);
        });
        
        const batch = writeBatch(db);
        for (let i = 0; i < totalChunks; i++) {
            const chunkData = base64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            const chunkRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages', msgId, 'chunks'), `${i}`);
            batch.set(chunkRef, { index: i, data: chunkData });
        }
        await batch.commit();
        return totalChunks;
    };

    const sendMessage = async (content, type = 'text', additionalData = {}, file = null) => {
        if (profile?.isBanned) return showNotification("アカウントが利用停止されています 🚫");
        if (!content && !file && type === 'text') return;
        setIsUploading(true);
        try {
            const messageData = { senderId: user.uid, content: content || '', type, createdAt: serverTimestamp(), readBy: [user.uid], ...additionalData };
            if (replyTo) { messageData.replyTo = { id: replyTo.id, content: replyTo.content, senderName: allUsers.find(u => u.uid === replyTo.senderId)?.name, type: replyTo.type }; setReplyTo(null); }
            
            // メッセージドキュメントを先に作成
            const msgRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages'), messageData);

            if (file) {
                 // 大きなファイルの場合はチャンク分割
                 if (file.size > 1024 * 1024) {
                      const chunkCount = await saveFileInChunks(file, activeChatId, msgRef.id);
                      await updateDoc(msgRef, { hasChunks: true, chunkCount, content: '' }); // contentは空にしておく
                 } else {
                     // 小さいファイルはそのままcontentに入れる（念のため再度読み込み）
                     const reader = new FileReader();
                     reader.onload = async (e) => {
                         await updateDoc(msgRef, { content: e.target.result });
                     };
                     reader.readAsDataURL(file);
                 }
            }
            
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId), { lastMessage: { content: type === 'text' ? content : type === 'sticker' ? 'スタンプ' : type === 'image' ? '画像' : 'メッセージ', senderId: user.uid, type }, updatedAt: serverTimestamp() });
            setText(''); setPlusMenuOpen(false); setStickerMenuOpen(false);
        } catch (e) { console.error(e); showNotification("送信に失敗しました"); } finally { setIsUploading(false); }
    };

    const handleBackgroundUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        handleCompressedUpload(e, async (dataUrl) => {
            try {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId), { background: dataUrl, hasBackground: true });
                showNotification("背景を設定しました");
            } catch(e) { showNotification("設定に失敗しました"); }
        });
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            const chunks = [];
            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                // 音声ファイルは小さいので直接アップロード
                const reader = new FileReader();
                reader.onload = (e) => sendMessage(e.target.result, 'audio', {}, null);
                reader.readAsDataURL(blob);
            };
            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            recordingIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (e) { showNotification("マイクへのアクセスが拒否されました"); }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingIntervalRef.current);
        }
    };

    const formatDuration = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="flex flex-col h-full bg-[#8fb2c9] relative" style={backgroundSrc ? { backgroundImage: `url(${backgroundSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
             <div className="p-3 bg-white/95 backdrop-blur border-b flex items-center gap-3 sticky top-0 z-10 shadow-sm">
                <ChevronLeft className="cursor-pointer w-6 h-6 text-gray-600" onClick={() => setView('home')} />
                <img src={icon} className="w-10 h-10 rounded-2xl object-cover border" />
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate flex items-center gap-1">{title} {mutedChats.includes(activeChatId) && <BellOff className="w-3 h-3 text-gray-400"/>}</div>
                    {isGroup && <div className="text-[10px] text-gray-500">{chatData.participants.length}人のメンバー</div>}
                </div>
                <div className="flex gap-4 items-center">
                    <button onClick={() => startVideoCall(activeChatId, true)} title="ビデオ通話"><Video className="w-6 h-6 text-gray-600" /></button>
                    <button onClick={() => startVideoCall(activeChatId, false)} title="音声通話"><Phone className="w-6 h-6 text-gray-600" /></button>
                    {!isGroup && (
                        <button onClick={() => setCoinModalOpen(true)} title="コイン送金"><Coins className="w-6 h-6 text-yellow-500" /></button>
                    )}
                    {isGroup ? (
                        <button onClick={() => setAddMemberModalOpen(true)}><UserPlus className="w-6 h-6 text-gray-600" /></button>
                    ) : (
                        <button onClick={() => setCardModalOpen(true)}><Gift className="w-6 h-6 text-pink-500" /></button>
                    )}
                    <button onClick={() => setBackgroundMenuOpen(!backgroundMenuOpen)}><Settings className="w-6 h-6 text-gray-600" /></button>
                </div>
            </div>
            
            {backgroundMenuOpen && (
                <div className="absolute top-16 right-4 z-20 bg-white rounded-xl shadow-xl p-2 w-48 border">
                    <label className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <ImageIcon className="w-4 h-4"/> <span className="text-sm">背景画像を変更</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleBackgroundUpload} />
                    </label>
                    <button onClick={() => { toggleMuteChat(activeChatId); setBackgroundMenuOpen(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-left">
                        {mutedChats.includes(activeChatId) ? <Bell className="w-4 h-4"/> : <BellOff className="w-4 h-4"/>} 
                        <span className="text-sm">{mutedChats.includes(activeChatId) ? "通知をオン" : "通知をオフ"}</span>
                    </button>
                    {isGroup && (
                        <>
                            <button onClick={() => { setGroupEditModalOpen(true); setBackgroundMenuOpen(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-left border-t"><Edit2 className="w-4 h-4"/> <span className="text-sm">グループ編集</span></button>
                            <button onClick={() => { setLeaveModalOpen(true); setBackgroundMenuOpen(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-red-50 rounded-lg text-left text-red-500"><LogOut className="w-4 h-4"/> <span className="text-sm">退会する</span></button>
                        </>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-black/5">
                {messages.length === 0 && <div className="text-center py-10 text-gray-500 text-sm bg-white/50 rounded-xl mx-10 mt-10 backdrop-blur-sm">メッセージを送って会話を始めよう！</div>}
                {messages.length >= messageLimit && <div className="text-center py-2"><button onClick={() => setMessageLimit(prev => prev + 50)} className="bg-white/80 px-4 py-1 rounded-full text-xs font-bold shadow-sm">過去のメッセージを読み込む</button></div>}
                {messages.map(m => (
                    <MessageItem 
                        key={m.id} 
                        m={m} 
                        user={user} 
                        sender={allUsers.find(u => u.uid === m.senderId)} 
                        isGroup={isGroup} 
                        db={db} 
                        appId={appId} 
                        chatId={activeChatId} 
                        addFriendById={addFriendById} 
                        onEdit={(id, txt) => { setEditingMsgId(id); setEditingText(txt); }} 
                        onDelete={async (id) => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages', id)); }} 
                        onPreview={(src, type) => setPreviewMedia({src, type})} 
                        onReply={setReplyTo} 
                        onReaction={async (mid, emoji) => { const msgRef = doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages', mid); const msgSnap = await getDoc(msgRef); if(msgSnap.exists()) { const reactions = msgSnap.data().reactions || {}; const current = reactions[emoji] || []; if(current.includes(user.uid)) { reactions[emoji] = current.filter(id => id !== user.uid); } else { reactions[emoji] = [...current, user.uid]; } await updateDoc(msgRef, { reactions }); } }}
                        allUsers={allUsers}
                        onStickerClick={(packId) => setBuyStickerModalPackId(packId)}
                        onShowProfile={(u) => showNotification(`${u.name}のプロフィール`)}
                    />
                ))}
                <div ref={scrollRef} />
            </div>

            <div className="p-3 bg-white border-t flex flex-col gap-2 relative z-10 pb-6">
                {replyTo && (<div className="flex items-center justify-between bg-gray-100 p-2 rounded-xl text-xs mb-1 border-l-4 border-blue-500 pl-3"><div><div className="font-bold text-gray-500 mb-0.5">Replying to {replyTo.senderName}</div><div className="truncate opacity-70">{replyTo.content || 'メディア'}</div></div><X className="w-4 h-4 cursor-pointer text-gray-400" onClick={() => setReplyTo(null)} /></div>)}
                <div className="flex items-center gap-2">
                    <button onClick={() => setPlusMenuOpen(!plusMenuOpen)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><Plus className={`w-6 h-6 ${plusMenuOpen ? 'rotate-45 text-red-500' : 'text-gray-400'} transition-transform`} /></button>
                    {!isRecording ? (
                        <>
                            <div className="relative flex-1">
                                <input className="w-full bg-gray-100 rounded-2xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-100 transition-all" placeholder="メッセージを入力..." value={text} onChange={e => setText(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage(text)} />
                                <button onClick={() => setStickerMenuOpen(!stickerMenuOpen)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-yellow-500"><Smile className="w-5 h-5"/></button>
                            </div>
                            {text ? (<button onClick={() => sendMessage(text)} disabled={isUploading} className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-lg transition-transform active:scale-95 disabled:bg-gray-300"><Send className="w-5 h-5" /></button>) : (<button onClick={startRecording} className="p-3 bg-gray-100 text-gray-500 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><Mic className="w-5 h-5" /></button>)}
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-between bg-red-50 rounded-2xl px-4 py-2 border border-red-100 animate-pulse"><div className="flex items-center gap-2 text-red-500 font-bold"><div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div> 録音中 {formatDuration(recordingTime)}</div><button onClick={stopRecording} className="text-red-500 hover:scale-110 transition-transform"><StopCircle className="w-6 h-6 fill-current"/></button></div>
                    )}
                </div>
                {plusMenuOpen && (
                    <div className="absolute bottom-20 left-4 bg-white rounded-2xl p-4 shadow-2xl grid grid-cols-4 gap-4 z-20 w-72 animate-in slide-in-from-bottom-2">
                        <label className="flex flex-col items-center gap-2 cursor-pointer group"><div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center group-hover:bg-green-100 transition-colors"><ImageIcon className="w-6 h-6 text-green-600" /></div><span className="text-[10px] font-bold text-gray-500">画像</span><input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, (d, t, f) => sendMessage(d, t, {}, f))} /></label>
                        <button onClick={() => setContactModalOpen(true)} className="flex flex-col items-center gap-2 cursor-pointer group"><div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-100 transition-colors"><Contact className="w-6 h-6 text-blue-600" /></div><span className="text-[10px] font-bold text-gray-500">連絡先</span></button>
                        <label className="flex flex-col items-center gap-2 cursor-pointer group"><div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center group-hover:bg-purple-100 transition-colors"><Video className="w-6 h-6 text-purple-600" /></div><span className="text-[10px] font-bold text-gray-500">動画</span><input type="file" className="hidden" accept="video/*" onChange={e => handleFileUpload(e, (d, t, f) => sendMessage(d, t, {}, f))} /></label>
                        <label className="flex flex-col items-center gap-2 cursor-pointer group"><div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center group-hover:bg-orange-100 transition-colors"><FileText className="w-6 h-6 text-orange-600" /></div><span className="text-[10px] font-bold text-gray-500">ファイル</span><input type="file" className="hidden" onChange={e => handleFileUpload(e, (d, t, f) => sendMessage(d, t, { fileName: f.name, fileSize: f.size }, f))} /></label>
                    </div>
                )}
                {stickerMenuOpen && (
                    <div className="absolute bottom-20 right-4 w-72 h-64 bg-white rounded-2xl shadow-2xl z-20 flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 border">
                        <div className="flex overflow-x-auto bg-gray-50 p-1 border-b scrollbar-hide">
                            {myStickerPacks.map(pack => (
                                <button key={pack.id} onClick={() => setSelectedPackId(pack.id)} className={`p-2 rounded-lg shrink-0 ${selectedPackId === pack.id ? 'bg-white shadow' : 'opacity-50'}`}>
                                    <img src={typeof pack.stickers[0] === 'string' ? pack.stickers[0] : pack.stickers[0].image} className="w-6 h-6 object-contain" />
                                </button>
                            ))}
                            <button onClick={() => setView('sticker-store')} className="p-2 text-gray-400 hover:text-blue-500"><Store className="w-6 h-6"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 grid grid-cols-4 gap-2">
                             {myStickerPacks.find(p => p.id === selectedPackId)?.stickers.map((s, i) => (
                                 <div key={i} onClick={() => sendMessage(typeof s === 'string' ? s : s.image, 'sticker', { packId: selectedPackId, audio: typeof s !== 'string' ? s.audio : null })} className="cursor-pointer hover:bg-gray-50 rounded-lg p-1 relative">
                                     <img src={typeof s === 'string' ? s : s.image} className="w-full h-full object-contain" />
                                     {typeof s !== 'string' && s.audio && <Volume2 className="w-3 h-3 absolute bottom-0 right-0 text-gray-400"/>}
                                 </div>
                             ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Sub Modals */}
            {contactModalOpen && <ContactSelectModal friends={allUsers.filter(u => profile.friends?.includes(u.uid))} onClose={() => setContactModalOpen(false)} onSend={(f) => { sendMessage("", "contact", { contactId: f.uid, contactName: f.name, contactAvatar: f.avatar }); setContactModalOpen(false); }} />}
            {cardModalOpen && <BirthdayCardModal toName={partnerData?.name || "友だち"} onClose={() => setCardModalOpen(false)} onSend={async (data) => { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'birthday_cards'), { ...data, fromId: user.uid, fromName: profile.name, toUserId: partnerId, createdAt: serverTimestamp() }); sendMessage("バースデーカードを送りました 🎂", "text"); setCardModalOpen(false); }} />}
            {coinModalOpen && <CoinTransferModal onClose={() => setCoinModalOpen(false)} myWallet={profile.wallet} myUid={user.uid} targetUid={partnerId} targetName={partnerData?.name || "相手"} showNotification={showNotification} />}
            {addMemberModalOpen && <GroupAddMemberModal onClose={() => setAddMemberModalOpen(false)} currentMembers={chatData.participants} chatId={activeChatId} allUsers={allUsers} profile={profile} user={user} showNotification={showNotification} />}
            {leaveModalOpen && <LeaveGroupConfirmModal onClose={() => setLeaveModalOpen(false)} onLeave={async () => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId), { participants: arrayRemove(user.uid) }); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages'), { senderId: user.uid, content: `${profile.name}が退会しました。`, type: 'text', createdAt: serverTimestamp(), readBy: [user.uid] }); setView('home'); }} />}
            {groupEditModalOpen && <GroupEditModal onClose={() => setGroupEditModalOpen(false)} chatId={activeChatId} currentName={chatData.name} currentIcon={chatData.icon} currentMembers={chatData.participants} allUsers={allUsers} user={user} profile={profile} showNotification={showNotification} />}
            {buyStickerModalPackId && <StickerBuyModal packId={buyStickerModalPackId} onClose={() => setBuyStickerModalPackId(null)} onGoToStore={(pid) => { setView('sticker-store'); }} />}
        </div>
    );
};

const HomeView = ({ user, profile, allUsers, chats, setView, setActiveChatId, setSearchModalOpen, startChatWithUser, showNotification, setCoinModalTarget }) => {
  const [tab, setTab] = useState("chats"), [selectedFriend, setSelectedFriend] = useState(null), [coinModalTargetLocal, setCoinModalTargetLocal] = useState(null);
  const friends = useMemo(() => allUsers.filter(u => profile?.friends?.includes(u.uid)), [allUsers, profile]);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    if (tab === 'timeline') {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), orderBy('createdAt', 'desc'), limit(20));
        return onSnapshot(q, (snap) => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
  }, [tab]);

  return (
    <div className="flex flex-col h-full bg-white border-x border-gray-200 max-w-md mx-auto">
      <div className="p-4 border-b flex justify-between items-center bg-white shrink-0 sticky top-0 z-10">
        <h1 className="text-xl font-bold">ホーム</h1>
        <div className="flex gap-4 items-center">
          <div className="bg-yellow-100 px-3 py-1 rounded-full flex items-center gap-1"><Coins className="w-4 h-4 text-yellow-600" /><span className="text-sm font-bold">{profile?.wallet || 0}</span></div>
          <Search className="w-6 h-6 cursor-pointer" onClick={() => setSearchModalOpen(true)} />
          <div className="relative group cursor-pointer" onClick={() => setView('card-box')}>
             <Gift className="w-6 h-6 text-pink-500" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-around border-b bg-gray-50">
        {['chats', 'friends', 'timeline'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-sm font-bold relative ${tab === t ? 'text-green-600' : 'text-gray-400'}`}>
                {t === 'chats' && <MessageCircle className="w-5 h-5 mx-auto mb-1"/>}
                {t === 'friends' && <Users className="w-5 h-5 mx-auto mb-1"/>}
                {t === 'timeline' && <LayoutGrid className="w-5 h-5 mx-auto mb-1"/>}
                <span className="capitalize">{t === 'chats' ? 'トーク' : t === 'friends' ? '友だち' : 'タイムライン'}</span>
                {tab === t && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-500"></div>}
            </button>
        ))}
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-hide">
         {tab === 'chats' && (
            <div className="divide-y">
                {chats.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">チャットはまだありません</div>}
                {chats.map(chat => {
                    const isGroup = chat.isGroup;
                    let title = chat.name;
                    let icon = chat.icon;
                    if (!isGroup) {
                        const partnerId = chat.participants.find(p => p !== user.uid) || user.uid;
                        const partner = allUsers.find(u => u.uid === partnerId);
                        if (partner) { title = partner.name; icon = partner.avatar; }
                    }
                    const lastMsg = chat.lastMessage?.content || "メッセージなし";
                    const isUnread = chat.lastMessage && chat.lastMessage.senderId !== user.uid && !chat.lastMessage.readBy?.includes(user.uid);
                    return (
                        <div key={chat.id} onClick={() => { setActiveChatId(chat.id); setView('chat'); }} className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                            <img src={icon} className="w-14 h-14 rounded-2xl object-cover border" />
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-1">
                                    <h3 className="font-bold text-gray-800 truncate">{title}</h3>
                                    <span className="text-[10px] text-gray-400">{formatTime(chat.updatedAt)}</span>
                                </div>
                                <p className={`text-sm truncate ${isUnread ? 'font-bold text-black' : 'text-gray-500'}`}>{lastMsg}</p>
                            </div>
                            {isUnread && <div className="w-3 h-3 bg-green-500 rounded-full"></div>}
                        </div>
                    );
                })}
            </div>
         )}
         {tab === 'friends' && (
             <div className="p-4 space-y-4">
                 <button onClick={() => setView('group-create')} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center gap-2 text-gray-500 font-bold hover:bg-gray-50"><Users className="w-5 h-5"/> 新しいグループを作成</button>
                 {friends.map(f => (
                     <div key={f.uid} onClick={() => setSelectedFriend(f)} className="flex items-center gap-4 p-3 bg-white border rounded-2xl shadow-sm cursor-pointer hover:scale-[1.02] transition-transform">
                         <img src={f.avatar} className="w-12 h-12 rounded-xl object-cover" />
                         <div className="flex-1">
                             <div className="font-bold">{f.name}</div>
                             <div className="text-xs text-gray-400 truncate">{f.status || "ステータスなし"}</div>
                         </div>
                     </div>
                 ))}
             </div>
         )}
         {tab === 'timeline' && (
             <div className="bg-gray-100 min-h-full">
                 {posts.map(p => <PostItem key={p.id} post={p} user={user} allUsers={allUsers} db={db} appId={appId} profile={profile} />)}
             </div>
         )}
      </div>

      {/* Friends Profile Modal */}
      {selectedFriend && (
          <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in">
            <div className="bg-white w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl relative flex flex-col items-center pb-8">
              <button onClick={() => setSelectedFriend(null)} className="absolute top-4 right-4 z-10 bg-black/20 text-white p-2 rounded-full backdrop-blur-md hover:bg-black/30"><X className="w-6 h-6" /></button>
              <div className="w-full h-48 bg-gray-200"><img src={selectedFriend.cover || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80"} className="w-full h-full object-cover" /></div>
              <div className="-mt-16 mb-4 relative"><img src={selectedFriend.avatar} className="w-32 h-32 rounded-[40px] border-[6px] border-white object-cover shadow-lg" /></div>
              <h2 className="text-2xl font-bold mb-1">{selectedFriend.name}</h2>
              <p className="text-xs text-gray-400 font-mono mb-4">ID: {selectedFriend.id}</p>
              <div className="w-full px-8 mb-6"><p className="text-center text-sm text-gray-600 bg-gray-50 py-3 px-4 rounded-2xl">{selectedFriend.status || "ステータスなし"}</p></div>
              <div className="flex gap-4 w-full px-8">
                <button onClick={() => { startChatWithUser(selectedFriend.uid); setSelectedFriend(null); }} className="flex-1 py-3 bg-green-500 text-white rounded-2xl font-bold shadow-lg shadow-green-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"><MessageCircle className="w-5 h-5" /> トーク</button>
                <button onClick={() => { setCoinModalTarget(selectedFriend); setSelectedFriend(null); }} className="flex-1 py-3 bg-yellow-500 text-white rounded-2xl font-bold shadow-lg shadow-yellow-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"><Coins className="w-5 h-5" /> 送金</button>
              </div>
            </div>
          </div>
      )}
    </div>
  );
};

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

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState('home'); 
  const [activeChatId, setActiveChatId] = useState(null);
  const [chats, setChats] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [mutedChats, setMutedChats] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [activeCallId, setActiveCallId] = useState(null);
  const [isVideoCall, setIsVideoCall] = useState(true);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [coinModalTarget, setCoinModalTarget] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', u.uid);
        onSnapshot(userRef, (doc) => {
          if (doc.exists()) { setProfile(doc.data()); }
          else { 
            // Create default profile
            const newProfile = { uid: u.uid, name: u.displayName || 'ゲスト', id: u.uid.substring(0,8), status: 'よろしくお願いします！', birthday: '', avatar: u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`, cover: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80', friends: [], wallet: 1000, isBanned: false };
            setDoc(userRef, newProfile);
            setProfile(newProfile);
          }
        });

        const chatsQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'chats'), where('participants', 'array-contains', u.uid), orderBy('updatedAt', 'desc'));
        onSnapshot(chatsQuery, (snap) => setChats(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), (snap) => setAllUsers(snap.docs.map(d => d.data())));
      }
    });
  }, []);

  useEffect(() => {
     if(!chats.length || !user) return;
     const unsubs = chats.map(chat => {
         return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chat.id, 'call_signaling', 'session'), (snap) => {
             const data = snap.data();
             if (data && data.type === 'offer' && data.callerId !== user.uid && !activeCallId) {
                 setIncomingCall({ chatId: chat.id, ...data });
             } else if (!data && incomingCall && incomingCall.chatId === chat.id) {
                 setIncomingCall(null);
             } else if (data && data.type === 'answer' && outgoingCall && outgoingCall.chatId === chat.id) {
                 setActiveCallId(chat.id);
                 setOutgoingCall(null);
             }
         });
     });
     return () => unsubs.forEach(u => u());
  }, [chats, user, activeCallId, incomingCall, outgoingCall]);

  const showNotification = (msg) => {
    const id = Date.now();
    setNotifications(p => [...p, { id, msg }]);
    setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), 3000);
  };

  const addFriendById = async (targetId) => {
      const target = allUsers.find(u => u.id === targetId || u.uid === targetId);
      if (!target) return showNotification("ユーザーが見つかりません");
      if (target.uid === user.uid) return showNotification("自分自身は追加できません");
      if (profile.friends.includes(target.uid)) return showNotification("既に友だちです");
      
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { friends: arrayUnion(target.uid) });
      showNotification(`${target.name}を友だちに追加しました`);
      setSearchModalOpen(false);
  };

  const startChatWithUser = async (targetUid) => {
      const existing = chats.find(c => !c.isGroup && c.participants.includes(targetUid) && c.participants.includes(user.uid));
      if (existing) {
          setActiveChatId(existing.id);
          setView('chat');
      } else {
          const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats'), {
              participants: [user.uid, targetUid],
              isGroup: false,
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp()
          });
          setActiveChatId(docRef.id);
          setView('chat');
      }
  };

  const startVideoCall = async (chatId, video) => {
      setIsVideoCall(video);
      setOutgoingCall({ chatId });
      // VideoCallView logic triggers offer creation on mount for caller
      setActiveCallId(chatId); 
  };

  const endCall = async () => {
      if (activeCallId) {
         const ref = doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeCallId, 'call_signaling', 'session');
         await deleteDoc(ref);
         // Clean candidates
         const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeCallId, 'call_signaling', 'candidates', 'list');
         const sn = await getDocs(cRef);
         const b = writeBatch(db);
         sn.forEach(d => b.delete(d.ref));
         await b.commit();
      }
      setActiveCallId(null);
      setIncomingCall(null);
      setOutgoingCall(null);
  };

  if (!user) return <AuthView onLogin={setUser} showNotification={showNotification} />;

  return (
    <div className="h-screen w-full bg-gray-100 flex justify-center overflow-hidden font-sans text-gray-800">
      <div className="w-full max-w-md bg-white shadow-2xl overflow-hidden relative flex flex-col h-full sm:rounded-[30px] sm:my-4 sm:h-[95vh] border border-gray-200/50">
        
        {view === 'home' && <HomeView user={user} profile={profile} allUsers={allUsers} chats={chats} setView={setView} setActiveChatId={setActiveChatId} setSearchModalOpen={setSearchModalOpen} startChatWithUser={startChatWithUser} showNotification={showNotification} setCoinModalTarget={setCoinModalTarget} />}
        {view === 'chat' && activeChatId && <ChatRoomView user={user} profile={profile} allUsers={allUsers} chats={chats} activeChatId={activeChatId} setActiveChatId={setActiveChatId} setView={setView} db={db} appId={appId} mutedChats={mutedChats} toggleMuteChat={(id) => setMutedChats(p => p.includes(id) ? p.filter(x => x!==id) : [...p, id])} showNotification={showNotification} addFriendById={addFriendById} startVideoCall={startVideoCall} />}
        {view === 'sticker-create' && <StickerEditor user={user} profile={profile} onClose={() => setView('sticker-store')} showNotification={showNotification} />}
        {view === 'sticker-store' && <StickerStoreView user={user} setView={setView} showNotification={showNotification} profile={profile} allUsers={allUsers} />}
        {view === 'group-create' && <GroupCreateView user={user} profile={profile} allUsers={allUsers} setView={setView} showNotification={showNotification} />}
        {view === 'card-box' && <BirthdayCardBox user={user} setView={setView} />}

        {notifications.map(n => (
            <div key={n.id} className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full text-sm font-bold shadow-xl z-[9999] animate-in fade-in slide-in-from-top-4 backdrop-blur-sm">
                {n.msg}
            </div>
        ))}
        
        {searchModalOpen && (
            <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
                <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl">
                    <h3 className="font-bold text-lg mb-4">友だち検索</h3>
                    <input className="w-full bg-gray-100 p-3 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="ユーザーIDを入力" value={searchId} onChange={e => setSearchId(e.target.value)} />
                    <div className="flex gap-2">
                        <button onClick={() => setSearchModalOpen(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-colors">閉じる</button>
                        <button onClick={() => addFriendById(searchId)} className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold shadow-lg hover:bg-blue-600 transition-colors">検索して追加</button>
                    </div>
                </div>
            </div>
        )}

        {coinModalTarget && (
            <CoinTransferModal 
                onClose={() => setCoinModalTarget(null)} 
                myWallet={profile?.wallet || 0} 
                myUid={user.uid} 
                targetUid={coinModalTarget.uid} 
                targetName={coinModalTarget.name} 
                showNotification={showNotification} 
            />
        )}

        {incomingCall && !activeCallId && (
            <IncomingCallOverlay 
                callData={incomingCall} 
                allUsers={allUsers} 
                onDecline={async () => { 
                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', incomingCall.chatId, 'call_signaling', 'session')); 
                    setIncomingCall(null); 
                }} 
                onAccept={() => { setActiveCallId(incomingCall.chatId); setIncomingCall(null); }} 
            />
        )}
        
        {outgoingCall && !activeCallId && (
             <OutgoingCallOverlay 
                callData={outgoingCall} 
                allUsers={allUsers} 
                onCancel={async () => {
                     await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', outgoingCall.chatId, 'call_signaling', 'session'));
                     setOutgoingCall(null);
                     setActiveCallId(null);
                }}
             />
        )}

        {activeCallId && (
            <VideoCallView 
                user={user} 
                chatId={activeCallId} 
                callData={{ callerId: incomingCall ? incomingCall.callerId : user.uid }}
                onEndCall={endCall} 
                isVideoEnabled={isVideoCall} 
            />
        )}
      </div>
    </div>
  );
}
