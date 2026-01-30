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
  setPersistence,
  browserLocalPersistence,
  updateProfile,
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
  User, KeyRound, MicOff, VideoOff, ArrowRightLeft, MoreVertical, Wand2, ImagePlus, Aperture,
  Monitor, QrCode, Scan, LogIn, Sparkles, ArrowRight
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

// アプリID (データを維持するためのID)
const appId = "voom-app-final-v6";

const JSQR_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
const CHUNK_SIZE = 700000;
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// WebRTC Configuration
const rtcConfig = {
  iceServers: [
    { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
  ],
};

// --- Utility Functions ---
const loadScript = (src) => {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
};

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

const isTodayBirthday = (birthdayString) => {
  if (!birthdayString) return false;
  const today = new Date();
  const [y, m, d] = birthdayString.split('-').map(Number);
  return (today.getMonth() + 1) === m && today.getDate() === d;
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

const handleFileUpload = async (e, callback) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    let type = 'file';
    if (file.type.startsWith('image')) type = 'image';
    else if (file.type.startsWith('video')) type = 'video';
    else if (file.type.startsWith('audio')) type = 'audio';

    if (file.size > 1024 * 1024 || type === 'video' || type === 'file') {
        callback(null, type, file);
    } else {
        const reader = new FileReader();
        reader.onload = (ev) => callback(ev.target.result, type, file);
        reader.readAsDataURL(file);
    }
};

// --- Auth View with Modern UI ---
const AuthView = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(cred.user, { displayName: name });
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', cred.user.uid), {
                    uid: cred.user.uid, name: name, email: email, wallet: 1000, friends: [],
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cred.user.uid}`
                });
            }
        } catch (err) {
            alert("エラー: " + err.message);
            setLoading(false);
        }
    };

    return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6 overflow-hidden font-sans">
            <div className="bg-white/90 backdrop-blur-xl w-full max-w-sm rounded-[40px] shadow-2xl border border-white/50 p-8 animate-in fade-in zoom-in duration-500">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg mb-4 transform rotate-3 hover:rotate-6 transition-transform">
                        <MessageCircle className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-1">VOOM APP</h1>
                    <p className="text-sm text-gray-500 font-medium">次世代のコミュニケーション</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-500 transition-colors w-5 h-5" />
                            <input className="w-full bg-gray-100 border-2 border-transparent focus:bg-white focus:border-purple-500 rounded-2xl py-4 pl-12 pr-4 outline-none transition-all font-bold text-gray-700" placeholder="ユーザー名" value={name} onChange={e=>setName(e.target.value)} required />
                        </div>
                    )}
                    <div className="relative group">
                        <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-500 transition-colors w-5 h-5" />
                        <input className="w-full bg-gray-100 border-2 border-transparent focus:bg-white focus:border-purple-500 rounded-2xl py-4 pl-12 pr-4 outline-none transition-all font-bold text-gray-700" type="email" placeholder="メールアドレス" value={email} onChange={e=>setEmail(e.target.value)} required />
                    </div>
                    <div className="relative group">
                        <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-500 transition-colors w-5 h-5" />
                        <input className="w-full bg-gray-100 border-2 border-transparent focus:bg-white focus:border-purple-500 rounded-2xl py-4 pl-12 pr-4 outline-none transition-all font-bold text-gray-700" type="password" placeholder="パスワード" value={password} onChange={e=>setPassword(e.target.value)} required />
                    </div>
                    
                    <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin"/> : (isLogin ? "ログイン" : "アカウント作成")} <ArrowRight className="w-5 h-5"/>
                    </button>
                </form>

                <div className="mt-6 text-center space-y-3">
                    <p className="text-sm text-gray-400 font-bold cursor-pointer hover:text-purple-600 transition-colors" onClick={() => setIsLogin(!isLogin)}>
                        {isLogin ? "アカウントを作成する" : "ログイン画面に戻る"}
                    </p>
                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                        <div className="relative flex justify-center text-xs"><span className="px-2 bg-white/0 text-gray-400 font-bold backdrop-blur-sm bg-white">または</span></div>
                    </div>
                    <button onClick={() => signInAnonymously(auth)} className="w-full bg-white border-2 border-gray-100 text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                        <User className="w-4 h-4"/> ゲストとして試す
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Video Call with Background Effects ---
const VideoCallView = ({ user, chatId, isGroup, callData, onEndCall, isVideoEnabled = true, allUsers }) => {
  const [localStream, setLocalStream] = useState(null);
  const [processedStream, setProcessedStream] = useState(null);
  const [peers, setPeers] = useState({}); 
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideoEnabled);
  
  const [bgMode, setBgMode] = useState('none'); 
  const [filterMode, setFilterMode] = useState('none'); 
  const [bgImage, setBgImage] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  const localVideoRef = useRef(null); 
  const canvasRef = useRef(null); 
  const peersRef = useRef({});
  const selfieSegmentationRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
      if (isVideoEnabled) {
          loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js")
              .then(() => {
                  if (window.SelfieSegmentation) {
                      const selfieSegmentation = new window.SelfieSegmentation({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`});
                      selfieSegmentation.setOptions({ modelSelection: 1 });
                      selfieSegmentation.onResults(onResults);
                      selfieSegmentationRef.current = selfieSegmentation;
                  }
              })
              .catch(e => console.error("Failed to load MediaPipe", e));
      }
  }, [isVideoEnabled]);

  const onResults = (results) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (filterMode === 'sepia') ctx.filter = 'sepia(0.8)';
      else if (filterMode === 'grayscale') ctx.filter = 'grayscale(1)';
      else ctx.filter = 'none';

      if (bgMode === 'none') {
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
          ctx.restore();
          return;
      }

      ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-out';
      
      if (bgMode === 'blur') {
          ctx.filter = 'blur(10px)';
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
          ctx.filter = 'none';
      } else if (bgMode === 'image' && bgImage) {
          ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
      } else {
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      }
      
      ctx.globalCompositeOperation = 'destination-over';
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      ctx.restore();
  };

  const processVideoFrame = async () => {
      if (!localVideoRef.current || !selfieSegmentationRef.current) {
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          if (localVideoRef.current && canvasRef.current && bgMode === 'none' && filterMode === 'none') {
              const ctx = canvasRef.current.getContext('2d');
              ctx.drawImage(localVideoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
              animationFrameRef.current = requestAnimationFrame(processVideoFrame);
          } else if (localVideoRef.current && selfieSegmentationRef.current) {
               await selfieSegmentationRef.current.send({ image: localVideoRef.current });
               animationFrameRef.current = requestAnimationFrame(processVideoFrame);
          }
          return;
      }
      try {
          await selfieSegmentationRef.current.send({ image: localVideoRef.current });
      } catch (e) {}
      animationFrameRef.current = requestAnimationFrame(processVideoFrame);
  };

  useEffect(() => {
      if (localStream && !isVideoOff) {
          processVideoFrame();
      }
      return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [localStream, bgMode, filterMode, isVideoOff]);

  useEffect(() => {
      if (canvasRef.current && localStream) {
          const canvasStream = canvasRef.current.captureStream(30);
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) canvasStream.addTrack(audioTrack);
          setProcessedStream(canvasStream);
      } else {
          setProcessedStream(localStream);
      }
  }, [localStream, bgMode, filterMode]);

  useEffect(() => {
      if (processedStream) {
          const videoTrack = processedStream.getVideoTracks()[0];
          Object.values(peersRef.current).forEach(({ connection }) => {
              const sender = connection.getSenders().find(s => s.track && s.track.kind === 'video');
              if (sender && videoTrack) sender.replaceTrack(videoTrack);
          });
      }
  }, [processedStream]);

  useEffect(() => {
    const initCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.muted = true;
            localVideoRef.current.play();
             localVideoRef.current.onloadedmetadata = () => {
                if(canvasRef.current) {
                    canvasRef.current.width = localVideoRef.current.videoWidth;
                    canvasRef.current.height = localVideoRef.current.videoHeight;
                }
            };
        }
        setProcessedStream(stream);
        if (isGroup) setupGroupMesh(stream);
        else setupP2P(stream);
      } catch (err) {
        console.error("Media access error:", err);
        onEndCall();
      }
    };
    initCall();
    return () => {
      Object.values(peersRef.current).forEach(p => p.connection.close());
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (processedStream) processedStream.getTracks().forEach(t => t.stop());
      if (isGroup) deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'call_mesh', 'participants', user.uid));
    };
  }, []);

  const setupP2P = async (stream) => {
    const pc = new RTCPeerConnection(rtcConfig);
    const peerId = callData.callerId === user.uid ? 'remote' : callData.callerId; 
    peersRef.current = { [peerId]: { connection: pc } };
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.ontrack = (event) => setPeers(prev => ({ ...prev, [peerId]: { ...prev[peerId], stream: event.streams[0], id: peerId } }));
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await addDoc(collection(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "candidates", "list"), {
            candidate: event.candidate.toJSON(), senderId: user.uid, createdAt: serverTimestamp(),
        });
      }
    };
    const isCaller = callData.callerId === user.uid;
    const signalingRef = doc(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "session");
    const sessionSnap = await getDoc(signalingRef);

    if (isCaller && !sessionSnap.exists()) {
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      await setDoc(signalingRef, { type: "offer", sdp: offer.sdp, callerId: user.uid });
    } else if (sessionSnap.exists() && sessionSnap.data().type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(sessionSnap.data()));
      const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
      await updateDoc(signalingRef, { type: "answer", sdp: answer.sdp });
    }
    onSnapshot(signalingRef, async (snap) => {
        const data = snap.data();
        if (!data) return;
        if (!pc.currentRemoteDescription && data.type === "answer" && isCaller) await pc.setRemoteDescription(new RTCSessionDescription(data));
    });
    onSnapshot(collection(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "candidates", "list"), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                if (data.senderId !== user.uid && pc.remoteDescription) try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch(e){}
            }
        });
    });
  };

  const setupGroupMesh = async (stream) => {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'call_mesh', 'participants', user.uid), { joinedAt: serverTimestamp(), name: user.displayName || 'User' });
      onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'call_mesh', 'participants'), (snap) => {
          snap.docChanges().forEach(async (change) => {
              const uid = change.doc.id;
              if (uid === user.uid) return;
              if (change.type === 'added') {
                  if (user.uid < uid) createMeshPeer(uid, stream, true);
                  else createMeshPeer(uid, stream, false);
              } else if (change.type === 'removed') {
                  if (peersRef.current[uid]) { peersRef.current[uid].connection.close(); delete peersRef.current[uid]; setPeers(prev => { const n = {...prev}; delete n[uid]; return n; }); }
              }
          });
      });
  };

  const createMeshPeer = async (targetUid, stream, isInitiator) => {
      if (peersRef.current[targetUid]) return; 
      const pc = new RTCPeerConnection(rtcConfig);
      peersRef.current[targetUid] = { connection: pc };
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      pc.ontrack = (event) => setPeers(prev => ({ ...prev, [targetUid]: { stream: event.streams[0], id: targetUid } }));
      const pairId = [user.uid, targetUid].sort().join('_');
      const signalRef = doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'call_mesh', 'signaling', pairId);
      pc.onicecandidate = async (event) => {
          if (event.candidate) await addDoc(collection(signalRef, 'candidates'), { candidate: event.candidate.toJSON(), senderId: user.uid, targetId: targetUid });
      };
      if (isInitiator) {
          const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
          await setDoc(signalRef, { offer: { type: 'offer', sdp: offer.sdp, senderId: user.uid } }, { merge: true });
      }
      onSnapshot(signalRef, async (snap) => {
          const data = snap.data(); if (!data) return;
          if (isInitiator) {
              if (data.answer && !pc.currentRemoteDescription && data.answer.senderId !== user.uid) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          } else {
              if (data.offer && !pc.currentRemoteDescription && data.offer.senderId !== user.uid) {
                  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                  const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
                  await updateDoc(signalRef, { answer: { type: 'answer', sdp: answer.sdp, senderId: user.uid } });
              }
          }
      });
      onSnapshot(collection(signalRef, 'candidates'), (snap) => {
          snap.docChanges().forEach(async (change) => {
              if (change.type === 'added') { const data = change.doc.data(); if (data.targetId === user.uid && pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); }
          });
      });
  };

  const toggleMute = () => { if (localStream) { localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled); setIsMuted(!isMuted); } };
  const toggleVideo = () => { if (localStream) { setIsVideoOff(!isVideoOff); localStream.getVideoTracks().forEach(t => t.enabled = !isVideoOff); } };
  const handleBgImage = (e) => { const file = e.target.files[0]; if(file) { const img = new Image(); img.src = URL.createObjectURL(file); img.onload = () => setBgImage(img); setBgMode('image'); } };
  const activePeers = Object.values(peers);

  return (
    <div className="fixed inset-0 z-[1000] bg-gray-900 flex flex-col animate-in fade-in h-[100dvh] overflow-hidden">
      <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
      <div className={`relative flex-1 flex flex-wrap content-center justify-center p-2 gap-2 overflow-y-auto`}>
         {activePeers.length === 0 ? (
             <div className="text-white flex flex-col items-center gap-4 w-full"><div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center animate-pulse"><User className="w-12 h-12"/></div><p className="font-bold text-lg">{isGroup ? "参加者を待っています..." : "接続中..."}</p></div>
         ) : (
             activePeers.map((p) => {
                 const u = allUsers?.find(user => user.uid === p.id);
                 return (<div key={p.id} className={`relative rounded-2xl overflow-hidden bg-black shadow-lg border border-gray-700 ${activePeers.length === 1 ? 'w-full max-w-2xl aspect-video' : 'w-[45%] aspect-square'}`}><video ref={ref => { if(ref) ref.srcObject = p.stream }} autoPlay playsInline className="w-full h-full object-cover" /><div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">{u?.name || "Unknown"}</div></div>);
             })
         )}
         <div className={`absolute top-4 right-4 ${isGroup && activePeers.length > 0 ? 'w-24 h-32' : 'w-32 h-48'} bg-black rounded-xl overflow-hidden border-2 border-white shadow-2xl transition-all z-20`}>{!isVideoOff ? (<canvas ref={canvasRef} className="w-full h-full object-cover transform scale-x-[-1]" />) : (<div className="w-full h-full flex items-center justify-center bg-gray-800 text-white"><User className="w-8 h-8"/></div>)}</div>
         {showMenu && (
             <div className="absolute bottom-28 left-0 right-0 flex justify-center z-30">
                 <div className="bg-black/80 backdrop-blur-md rounded-2xl p-4 flex gap-4 overflow-x-auto max-w-[90%] scrollbar-hide border border-white/20">
                     <button onClick={()=>setBgMode('none')} className={`flex flex-col items-center min-w-[60px] gap-1 ${bgMode==='none'?'text-green-400':'text-white'}`}><div className="w-10 h-10 bg-gray-600 rounded-full border-2 border-current"></div><span className="text-[10px]">なし</span></button>
                     <button onClick={()=>setBgMode('blur')} className={`flex flex-col items-center min-w-[60px] gap-1 ${bgMode==='blur'?'text-green-400':'text-white'}`}><div className="w-10 h-10 bg-gray-600 rounded-full border-2 border-current flex items-center justify-center"><Wand2 className="w-4 h-4"/></div><span className="text-[10px]">ぼかし</span></button>
                     <label className={`flex flex-col items-center min-w-[60px] gap-1 cursor-pointer ${bgMode==='image'?'text-green-400':'text-white'}`}><div className="w-10 h-10 bg-gray-600 rounded-full border-2 border-current flex items-center justify-center"><ImagePlus className="w-4 h-4"/></div><span className="text-[10px]">画像</span><input type="file" className="hidden" accept="image/*" onChange={handleBgImage}/></label>
                     <div className="w-px bg-gray-500 mx-2"></div>
                     <button onClick={()=>setFilterMode('sepia')} className={`flex flex-col items-center min-w-[60px] gap-1 ${filterMode==='sepia'?'text-green-400':'text-white'}`}><div className="w-10 h-10 bg-[#704214] rounded-full border-2 border-current"></div><span className="text-[10px]">セピア</span></button>
                     <button onClick={()=>setFilterMode('grayscale')} className={`flex flex-col items-center min-w-[60px] gap-1 ${filterMode==='grayscale'?'text-green-400':'text-white'}`}><div className="w-10 h-10 bg-gray-500 rounded-full border-2 border-current"></div><span className="text-[10px]">白黒</span></button>
                     <button onClick={()=>setFilterMode('none')} className={`flex flex-col items-center min-w-[60px] gap-1 ${filterMode==='none'?'text-green-400':'text-white'}`}><div className="w-10 h-10 bg-gray-700 rounded-full border-2 border-current flex items-center justify-center"><Ban className="w-4 h-4"/></div><span className="text-[10px]">OFF</span></button>
                 </div>
             </div>
         )}
      </div>
      <div className="h-28 bg-gray-900/90 backdrop-blur-md flex items-center justify-center gap-6 pb-6 border-t border-white/10 shrink-0 z-40">
        <button onClick={toggleMute} className={`p-4 rounded-full transition-all ${isMuted ? "bg-white text-black" : "bg-gray-700 text-white"}`}>{isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}</button>
        <button onClick={onEndCall} className="p-5 rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 transform hover:scale-110 transition-all border-4 border-gray-900"><PhoneOff className="w-8 h-8" /></button>
        <button onClick={toggleVideo} className={`p-4 rounded-full transition-all ${isVideoOff ? "bg-white text-black" : "bg-gray-700 text-white"}`}>{isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}</button>
        <button onClick={() => setShowMenu(!showMenu)} className={`p-4 rounded-full transition-all ${showMenu ? "bg-blue-500 text-white" : "bg-gray-700 text-white"}`}><Wand2 className="w-6 h-6"/></button>
      </div>
    </div>
  );
};

// --- Modals & Components ---
const CoinTransferModal = ({ onClose, myWallet, myUid, targetUid, targetName, showNotification }) => {
  const [amount, setAmount] = useState("");
  const handleSend = async () => {
    const val = parseInt(amount, 10); if (isNaN(val) || val <= 0) return showNotification("金額不正"); if (val > myWallet) return showNotification("残高不足");
    try { await runTransaction(db, async (t) => { const s = doc(db, "artifacts", appId, "public", "data", "users", myUid); const r = doc(db, "artifacts", appId, "public", "data", "users", targetUid); const sd = await t.get(s); if (!sd.exists() || sd.data().wallet < val) throw "Err"; t.update(s, { wallet: increment(-val) }); t.update(r, { wallet: increment(val) }); }); showNotification(`${val}コイン送りました`); onClose(); } catch (e) { showNotification("エラー"); }
  };
  return (<div className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in"><div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl text-center"><h3 className="font-bold mb-4">コインを送る</h3><div className="bg-yellow-50 p-4 rounded-xl mb-4"><div className="text-xs text-yellow-700 font-bold uppercase">所持コイン</div><div className="text-2xl font-black text-yellow-500">{myWallet}</div></div><input type="number" className="w-full bg-gray-100 rounded-2xl p-4 text-center text-xl mb-4 outline-none font-bold" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} /><button onClick={handleSend} className="w-full bg-yellow-500 text-white font-bold py-4 rounded-2xl mb-3 shadow-lg hover:bg-yellow-600 transition-all">送金する</button><button onClick={onClose} className="text-gray-400 font-bold text-sm hover:text-gray-600">キャンセル</button></div></div>);
};
const ContactSelectModal = ({ onClose, onSend, friends }) => (<div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in"><div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col max-h-[70vh]"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">連絡先を選択</h3><button onClick={onClose}><X className="w-6 h-6"/></button></div><div className="flex-1 overflow-y-auto space-y-2 pr-2">{friends.map(f=><div key={f.uid} onClick={()=>onSend(f)} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer border border-transparent hover:border-gray-100 transition-all"><img src={f.avatar} className="w-10 h-10 rounded-xl object-cover border"/><span className="font-bold text-sm">{f.name}</span></div>)}</div></div></div>);
const BirthdayCardModal = ({ onClose, onSend, toName }) => { const [color, setColor] = useState('pink'), [message, setMessage] = useState(''); const colors = [{ id: 'pink', class: 'bg-pink-100 border-pink-300' }, { id: 'blue', class: 'bg-blue-100 border-blue-300' }, { id: 'yellow', class: 'bg-yellow-100 border-yellow-300' }, { id: 'green', class: 'bg-green-100 border-green-300' }]; return (<div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in"><div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">カードを送る</h3><button onClick={onClose}><X className="w-6 h-6"/></button></div><div className="mb-4 flex gap-3">{colors.map(c=><button key={c.id} onClick={()=>setColor(c.id)} className={`w-10 h-10 rounded-full border-2 ${c.class} ${color===c.id?'scale-125 ring-2 ring-gray-300':''}`}/>)}</div><div className={`p-4 rounded-2xl border-2 mb-4 bg-${color}-100 ${colors.find(x=>x.id===color).class}`}><div className="font-bold text-gray-700 mb-2">To: {toName}</div><textarea className="w-full bg-white/50 rounded-xl p-3 text-sm focus:outline-none" placeholder="メッセージ..." value={message} onChange={e=>setMessage(e.target.value)}/></div><button onClick={()=>onSend({color,message})} className="w-full bg-pink-500 text-white font-bold py-3 rounded-2xl shadow-lg hover:bg-pink-600 transition-all">送信する</button></div></div>); };
const StickerBuyModal = ({ onClose, onGoToStore, packId }) => ( <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in"><div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center"><div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><ShoppingCart className="w-8 h-8 text-blue-600"/></div><h3 className="font-bold text-lg mb-2">このスタンプを購入しますか？</h3><div className="flex gap-3"><button onClick={onClose} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-2xl transition-colors">キャンセル</button><button onClick={() => { onGoToStore(packId); onClose(); }} className="flex-1 py-3 bg-blue-500 text-white font-bold rounded-2xl shadow-lg hover:bg-blue-600 transition-colors">ショップへ</button></div></div></div> );
const GroupAddMemberModal = ({ onClose, currentMembers, chatId, allUsers, profile, user, showNotification }) => { const [selected, setSelected] = useState([]); const toggle = (uid) => setSelected(prev => prev.includes(uid) ? prev.filter(i => i !== uid) : [...prev, uid]); const handleInvite = async () => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId), { participants: arrayUnion(...selected) }); onClose(); }; return (<div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in"><div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col max-h-[70vh]"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">メンバー追加</h3><button onClick={onClose}><X className="w-6 h-6"/></button></div><div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-4">{allUsers.filter(u => !currentMembers.includes(u.uid)).map(f => <div key={f.uid} onClick={()=>toggle(f.uid)} className={`p-3 flex items-center gap-3 rounded-2xl cursor-pointer border border-transparent transition-all ${selected.includes(f.uid)?'bg-green-50 border-green-200':'hover:bg-gray-50'}`}><img src={f.avatar} className="w-10 h-10 rounded-xl border"/><span className="flex-1 font-bold text-sm">{f.name}</span>{selected.includes(f.uid)&&<Check className="text-green-500 w-5 h-5"/>}</div>)}</div><button onClick={handleInvite} className="w-full bg-green-500 text-white py-3 rounded-2xl font-bold shadow-lg hover:bg-green-600 transition-all">招待する ({selected.length})</button></div></div>); };
const GroupEditModal = ({ onClose, chatId, currentName, currentIcon, currentMembers, allUsers, showNotification }) => { const [name, setName] = useState(currentName); const update = async () => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId), { name }); onClose(); }; return (<div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in"><div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl"><h3 className="font-bold mb-4 text-lg">グループ設定</h3><input className="border-b p-2 w-full mb-6 text-center text-lg font-bold outline-none focus:border-green-500" value={name} onChange={e=>setName(e.target.value)} /><button onClick={update} className="w-full bg-green-500 text-white py-3 rounded-2xl font-bold shadow-lg hover:bg-green-600 transition-all">保存</button></div></div>); };
const LeaveGroupConfirmModal = ({ onClose, onLeave }) => ( <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in"><div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl text-center"><div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3"><LogOut className="w-6 h-6 text-red-500"/></div><h3 className="font-bold text-lg mb-2">退会しますか？</h3><p className="text-gray-500 text-sm mb-6">この操作は取り消せません。</p><div className="flex gap-3"><button onClick={onClose} className="flex-1 bg-gray-100 py-3 rounded-2xl font-bold text-gray-600 hover:bg-gray-200 transition-colors">キャンセル</button><button onClick={onLeave} className="flex-1 bg-red-500 text-white py-3 rounded-2xl font-bold shadow-lg hover:bg-red-600 transition-colors">退会する</button></div></div></div> );
const StickerEditor = ({ user, profile, onClose, showNotification }) => { const canvasRef = useRef(null), [createdStickers, setCreatedStickers] = useState([]), [packName, setPackName] = useState(''); const saveSticker = () => { setCreatedStickers([...createdStickers, {image:canvasRef.current.toDataURL()}]); }; const submit = async () => { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sticker_packs'), { authorId: user.uid, name: packName, stickers: createdStickers, price: 100, status: 'pending', purchasedBy: [], createdAt: serverTimestamp() }); onClose(); }; return (<div className="flex flex-col h-full bg-white"><div className="p-4 border-b flex items-center gap-4 sticky top-0 bg-white z-10"><ChevronLeft onClick={onClose} className="cursor-pointer"/><span className="font-bold">スタンプ作成</span></div><div className="flex-1 p-4 overflow-y-auto"><input className="border p-3 rounded-xl w-full mb-4 bg-gray-50 outline-none focus:ring-2 focus:ring-green-100" placeholder="パック名" value={packName} onChange={e=>setPackName(e.target.value)}/><div className="border-2 border-dashed border-gray-300 rounded-xl p-2 bg-gray-50"><canvas ref={canvasRef} width={250} height={250} className="bg-white mx-auto rounded-lg shadow-sm touch-none" onMouseDown={e=>{const ctx=canvasRef.current.getContext('2d'); ctx.fillRect(e.nativeEvent.offsetX,e.nativeEvent.offsetY,5,5);}}/></div><p className="text-center text-xs text-gray-400 mt-2">キャンバスに描画してください</p><button onClick={saveSticker} className="w-full bg-blue-50 text-blue-500 py-3 mt-4 rounded-2xl font-bold hover:bg-blue-100 transition-colors">追加 ({createdStickers.length})</button><button onClick={submit} className="w-full bg-green-500 text-white py-4 mt-4 rounded-2xl font-bold shadow-lg hover:bg-green-600 transition-colors">申請する</button></div></div>); };
const StickerStoreView = ({ user, setView, profile, allUsers }) => { const [packs, setPacks] = useState([]); useEffect(() => onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'sticker_packs')), s => setPacks(s.docs.map(d=>({id:d.id,...d.data()})))), []); const buy = async (p) => { await updateDoc(doc(db,'artifacts',appId,'public','data','sticker_packs',p.id),{purchasedBy:arrayUnion(user.uid)}); }; return (<div className="flex flex-col h-full bg-white"><div className="p-4 border-b flex gap-4 sticky top-0 bg-white z-10"><ChevronLeft onClick={()=>setView('home')} className="cursor-pointer"/><span className="font-bold">ショップ</span></div><div className="flex-1 p-4 space-y-4 overflow-y-auto">{packs.map(p=><div key={p.id} className="border p-4 rounded-2xl flex justify-between items-center shadow-sm bg-white"><div><div className="font-bold text-lg">{p.name}</div><div className="text-xs text-gray-500 font-bold">By {allUsers.find(u=>u.uid===p.authorId)?.name}</div></div>{p.purchasedBy.includes(user.uid)?<span className="text-gray-400 text-xs font-bold bg-gray-100 px-3 py-1 rounded-full">購入済</span>:<button onClick={()=>buy(p)} className="bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow hover:bg-green-600 transition-colors">¥{p.price}</button>}</div>)}</div></div>); };
const GroupCreateView = ({ user, profile, allUsers, setView }) => { const [name, setName] = useState(''), [selected, setSelected] = useState([]); const create = async () => { const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats'), { name, icon: "https://api.dicebear.com/7.x/shapes/svg?seed="+name, participants: [user.uid, ...selected], isGroup: true, updatedAt: serverTimestamp() }); setView('home'); }; return (<div className="flex flex-col h-full bg-white"><div className="p-4 border-b flex gap-4 sticky top-0 bg-white z-10"><ChevronLeft onClick={()=>setView('home')} className="cursor-pointer"/><span className="font-bold">グループ作成</span></div><div className="p-4 flex-1 overflow-y-auto"><input className="w-full border-b-2 border-gray-100 p-3 mb-6 text-lg font-bold outline-none focus:border-green-500 transition-colors" placeholder="グループ名を入力" value={name} onChange={e=>setName(e.target.value)}/><div className="space-y-2 mb-20">{allUsers.filter(u=>profile.friends.includes(u.uid)).map(f=><div key={f.uid} onClick={()=>setSelected(p=>p.includes(f.uid)?p.filter(x=>x!==f.uid):[...p,f.uid])} className={`p-3 border rounded-2xl flex items-center justify-between cursor-pointer transition-all ${selected.includes(f.uid)?'bg-green-50 border-green-200 shadow-sm':'hover:bg-gray-50 border-gray-100'}`}><span className="font-bold text-sm">{f.name}</span>{selected.includes(f.uid)&&<Check className="w-5 h-5 text-green-500"/>}</div>)}</div></div><div className="p-4 border-t bg-white sticky bottom-0"><button onClick={create} className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-green-600 transition-colors">作成する</button></div></div>); };
const BirthdayCardBox = ({ user, setView }) => { const [cards, setCards] = useState([]); useEffect(() => onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'birthday_cards'), where('toUserId', '==', user.uid)), s => setCards(s.docs.map(d=>d.data()))), []); return (<div className="flex flex-col h-full bg-white"><div className="p-4 border-b flex gap-4 sticky top-0 bg-white z-10"><ChevronLeft onClick={()=>setView('home')} className="cursor-pointer"/><span className="font-bold flex items-center gap-2"><Gift className="text-pink-500"/> カードBOX</span></div><div className="flex-1 p-4 space-y-4 overflow-y-auto">{cards.length===0?<div className="text-center text-gray-400 mt-10">カードはまだありません</div>:cards.map((c,i)=><div key={i} className={`p-6 border-2 rounded-3xl shadow-sm bg-${c.color}-50 border-${c.color}-200 relative`}><div className="absolute top-4 right-4 text-2xl">🎂</div><div className="font-bold mb-2 text-gray-700">From: {c.fromName}</div><div className="whitespace-pre-wrap text-sm">{c.message}</div></div>)}</div></div>); };

// --- Chat & Main Views ---

const ChatRoomView = ({ user, profile, allUsers, chats, activeChatId, setActiveChatId, setView, db, appId, mutedChats, toggleMuteChat, showNotification, addFriendById, startVideoCall }) => {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [plusMenuOpen, setPlusMenuOpen] = useState(false);
    const [callMenuOpen, setCallMenuOpen] = useState(false);
    const [coinModalOpen, setCoinModalOpen] = useState(false);
    const [contactModalOpen, setContactModalOpen] = useState(false);
    const [cardModalOpen, setCardModalOpen] = useState(false);
    const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
    const [leaveModalOpen, setLeaveModalOpen] = useState(false);
    const [groupEditModalOpen, setGroupEditModalOpen] = useState(false);
    const [backgroundMenuOpen, setBackgroundMenuOpen] = useState(false);
    const [stickerMenuOpen, setStickerMenuOpen] = useState(false);
    const [backgroundSrc, setBackgroundSrc] = useState(null);
    const [myStickerPacks, setMyStickerPacks] = useState([]);
    const [selectedPackId, setSelectedPackId] = useState(null);
    const [buyStickerModalPackId, setBuyStickerModalPackId] = useState(null);
    const scrollRef = useRef();

    const chatData = chats.find(c => c.id === activeChatId);
    if (!chatData) return <Loader2 className="animate-spin m-auto"/>;
    const isGroup = chatData.isGroup;
    const partnerId = !isGroup ? chatData.participants.find(p => p !== user.uid) || user.uid : null;
    const partnerData = allUsers.find(u => u.uid === partnerId);
    const title = isGroup ? chatData.name : partnerData?.name;
    const icon = isGroup ? chatData.icon : partnerData?.avatar;

    useEffect(() => {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages'), orderBy('createdAt', 'asc'), limitToLast(50));
        return onSnapshot(q, s => { setMessages(s.docs.map(d => ({ id: d.id, ...d.data() }))); setTimeout(()=>scrollRef.current?.scrollIntoView({behavior:'smooth'}), 100); });
    }, [activeChatId]);
    useEffect(() => { if (chatData.background) setBackgroundSrc(chatData.background); }, [chatData]);
    useEffect(() => { 
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'sticker_packs'), where('purchasedBy', 'array-contains', user.uid));
        onSnapshot(q, s => { 
            const packs = s.docs.map(d => ({id:d.id, ...d.data()})); 
            setMyStickerPacks(packs); if(packs.length) setSelectedPackId(packs[0].id); 
        });
    }, []);

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
            batch.set(doc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages', msgId, 'chunks'), `${i}`), { index: i, data: chunkData });
        }
        await batch.commit();
        return totalChunks;
    };

    const sendMessage = async (content, type = 'text', additionalData = {}, file = null) => {
        if (!content && !file && type === 'text') return;
        const msgRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages'), { senderId: user.uid, content: content||'', type, createdAt: serverTimestamp(), ...additionalData });
        if (file) {
            if (file.size > 1024 * 1024) {
                const chunkCount = await saveFileInChunks(file, activeChatId, msgRef.id);
                await updateDoc(msgRef, { hasChunks: true, chunkCount, content: '' });
            } else {
                const reader = new FileReader();
                reader.onload = async (e) => { await updateDoc(msgRef, { content: e.target.result }); };
                reader.readAsDataURL(file);
            }
        }
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId), { lastMessage: { content: type==='text'?content:'メディア', senderId: user.uid }, updatedAt: serverTimestamp() });
        setText(''); setPlusMenuOpen(false); setStickerMenuOpen(false);
    };

    const handleStartCall = async (isVideo) => {
        setCallMenuOpen(false);
        if (isGroup) {
            await sendMessage(`📞 ${isVideo ? 'ビデオ' : '音声'}通話を開始しました`, 'call_invite', { isVideo });
            startVideoCall(activeChatId, isVideo, true);
        } else {
            startVideoCall(activeChatId, isVideo, false);
        }
    };

    const handleBackgroundUpload = (e) => {
        const file = e.target.files[0]; if (!file) return;
        handleCompressedUpload(e, async (d) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId), { background: d }); });
    };

    return (
        <div className="flex flex-col h-full bg-[#8fb2c9] relative" style={backgroundSrc ? { backgroundImage: `url(${backgroundSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
            <div className="p-3 bg-white/95 backdrop-blur border-b flex items-center gap-3 sticky top-0 z-10 shadow-sm shrink-0">
                <ChevronLeft className="cursor-pointer w-6 h-6 text-gray-600 hover:scale-110 transition-transform" onClick={() => setView('home')} />
                <img src={icon} className="w-10 h-10 rounded-2xl object-cover border shadow-sm" />
                <div className="flex-1 min-w-0"><div className="font-bold text-sm truncate">{title}</div></div>
                <div className="flex gap-3 items-center relative">
                    <div className="relative">
                        <button onClick={() => setCallMenuOpen(!callMenuOpen)} className="hover:bg-gray-100 p-2 rounded-full transition-colors"><PhoneCall className="w-6 h-6 text-gray-600" /></button>
                        {callMenuOpen && (
                            <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border z-50 overflow-hidden animate-in fade-in zoom-in">
                                <button onClick={() => handleStartCall(true)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-sm font-bold"><Video className="w-4 h-4 text-green-500" /> ビデオ通話</button>
                                <button onClick={() => handleStartCall(false)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-sm font-bold border-t"><Phone className="w-4 h-4 text-blue-500" /> 音声通話</button>
                            </div>
                        )}
                    </div>
                    {!isGroup && <button onClick={() => setCoinModalOpen(true)} className="hover:bg-gray-100 p-2 rounded-full transition-colors"><Coins className="w-6 h-6 text-yellow-500" /></button>}
                    {isGroup ? <button onClick={() => setAddMemberModalOpen(true)} className="hover:bg-gray-100 p-2 rounded-full transition-colors"><UserPlus className="w-6 h-6 text-gray-600" /></button> : <button onClick={() => setCardModalOpen(true)} className="hover:bg-gray-100 p-2 rounded-full transition-colors"><Gift className="w-6 h-6 text-pink-500" /></button>}
                    <button onClick={() => setBackgroundMenuOpen(!backgroundMenuOpen)} className="hover:bg-gray-100 p-2 rounded-full transition-colors"><Settings className="w-6 h-6 text-gray-600" /></button>
                </div>
            </div>
            
            {backgroundMenuOpen && (
                <div className="absolute top-16 right-4 z-20 bg-white rounded-2xl shadow-2xl p-2 w-48 border animate-in fade-in zoom-in">
                    <label className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer"><ImageIcon className="w-4 h-4"/> <span className="text-sm font-bold">背景変更</span><input type="file" className="hidden" accept="image/*" onChange={handleBackgroundUpload} /></label>
                    {isGroup && (<><button onClick={() => setGroupEditModalOpen(true)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl text-left border-t font-bold"><Edit2 className="w-4 h-4"/> <span className="text-sm">編集</span></button><button onClick={() => setLeaveModalOpen(true)} className="w-full flex items-center gap-3 p-3 hover:bg-red-50 rounded-xl text-left text-red-500 font-bold"><LogOut className="w-4 h-4"/> <span className="text-sm">退会</span></button></>)}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-black/5">
                {messages.map(m => {
                    const isMe = m.senderId === user.uid;
                    if (m.type === 'call_invite') return (
                        <div key={m.id} className="flex justify-center mb-4"><div className="bg-white rounded-3xl p-5 text-center shadow-md border"><div className="font-bold mb-3 text-gray-700">{m.content}</div><button onClick={() => startVideoCall(activeChatId, m.isVideo, true)} className="bg-green-500 text-white px-8 py-2.5 rounded-full font-bold text-sm shadow-lg hover:bg-green-600 transition-colors">参加する</button></div></div>
                    );
                    if (m.type === 'sticker') return (<div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}><img src={m.content} className="w-32 cursor-pointer hover:scale-105 transition-transform drop-shadow-sm" onClick={()=>setBuyStickerModalPackId(m.packId)}/></div>);
                    return (
                        <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                            {!isMe && <img src={allUsers.find(u=>u.uid===m.senderId)?.avatar} className="w-8 h-8 rounded-full border mt-1"/>}
                            <div className={`p-2.5 px-4 rounded-2xl text-sm max-w-[70%] shadow-sm ${isMe ? 'bg-[#7cfc00] text-black rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'}`}>{m.content}</div>
                        </div>
                    );
                })}
                <div ref={scrollRef} />
            </div>

            <div className="p-3 bg-white border-t flex gap-2 items-center relative z-10 pb-6 shrink-0 shadow-lg">
                <button onClick={() => setPlusMenuOpen(!plusMenuOpen)} className={`p-2 rounded-full transition-colors ${plusMenuOpen ? 'bg-gray-100 rotate-45' : 'hover:bg-gray-50'}`}><Plus className="w-6 h-6 text-gray-500" /></button>
                <div className="flex-1 relative">
                    <input className="w-full bg-gray-100 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-100 transition-all" placeholder="メッセージを入力" value={text} onChange={e=>setText(e.target.value)} onKeyPress={e=>e.key==='Enter'&&sendMessage(text)}/>
                    <button onClick={() => setStickerMenuOpen(!stickerMenuOpen)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-yellow-500"><Smile className="w-5 h-5"/></button>
                </div>
                <button onClick={()=>sendMessage(text)} className={`p-3 rounded-full transition-all shadow-md ${text ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-400'}`}><Send className="w-5 h-5"/></button>
            </div>
            {plusMenuOpen && <div className="absolute bottom-20 left-4 bg-white p-4 rounded-3xl shadow-2xl grid grid-cols-4 gap-4 z-20 w-72 animate-in slide-in-from-bottom-2"><div onClick={()=>setContactModalOpen(true)} className="flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-xl"><div className="p-3 bg-yellow-100 rounded-2xl text-yellow-600"><Contact/></div><span className="text-xs font-bold text-gray-500">連絡先</span></div><label className="flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-xl"><div className="p-3 bg-green-100 rounded-2xl text-green-600"><ImageIcon/></div><span className="text-xs font-bold text-gray-500">画像</span><input type="file" className="hidden" accept="image/*" onChange={e=>handleFileUpload(e, (d,t,f)=>sendMessage(d,t,{},f))}/></label></div>}
            {stickerMenuOpen && <div className="absolute bottom-20 right-4 bg-white w-80 h-72 rounded-3xl shadow-2xl z-20 flex flex-col border animate-in slide-in-from-bottom-2"><div className="flex overflow-x-auto p-2 border-b gap-1 scrollbar-hide bg-gray-50 rounded-t-3xl">{myStickerPacks.map(p=><button key={p.id} onClick={()=>setSelectedPackId(p.id)} className={`p-2 rounded-xl ${selectedPackId===p.id?'bg-white shadow':''}`}><img src={p.stickers[0].image} className="w-6 h-6 object-contain"/></button>)}<button onClick={()=>setView('sticker-store')} className="p-2"><Store className="w-6 h-6 text-blue-500"/></button></div><div className="flex-1 overflow-y-auto p-3 grid grid-cols-4 gap-2">{myStickerPacks.find(p=>p.id===selectedPackId)?.stickers.map((s,i)=><img key={i} src={s.image} onClick={()=>sendMessage(s.image,'sticker',{packId:selectedPackId})} className="hover:scale-110 transition-transform cursor-pointer"/>)}</div></div>}
            {coinModalOpen && <CoinTransferModal onClose={()=>setCoinModalOpen(false)} myWallet={profile.wallet} myUid={user.uid} targetUid={partnerId} targetName={partnerData?.name} showNotification={showNotification}/>}
            {contactModalOpen && <ContactSelectModal onClose={()=>setContactModalOpen(false)} onSend={f=>{sendMessage('', 'contact', {contactId:f.uid,contactName:f.name,contactAvatar:f.avatar});setContactModalOpen(false)}} friends={allUsers.filter(u=>(profile.friends||[]).includes(u.uid))}/>}
            {cardModalOpen && <BirthdayCardModal onClose={()=>setCardModalOpen(false)} toName={title} onSend={async(d)=>{await addDoc(collection(db,'artifacts',appId,'public','data','birthday_cards'),{...d,fromName:profile.name,toUserId:partnerId,createdAt:serverTimestamp()});sendMessage('[カード]','text');setCardModalOpen(false)}}/>}
            {addMemberModalOpen && <GroupAddMemberModal onClose={()=>setAddMemberModalOpen(false)} currentMembers={chatData.participants} chatId={activeChatId} allUsers={allUsers} profile={profile} user={user} showNotification={showNotification}/>}
            {leaveModalOpen && <LeaveGroupConfirmModal onClose={()=>setLeaveModalOpen(false)} onLeave={async()=>{await updateDoc(doc(db,'artifacts',appId,'public','data','chats',activeChatId),{participants:arrayRemove(user.uid)});setView('home')}}/>}
            {groupEditModalOpen && <GroupEditModal onClose={()=>setGroupEditModalOpen(false)} chatId={activeChatId} currentName={chatData.name} showNotification={showNotification}/>}
            {buyStickerModalPackId && <StickerBuyModal packId={buyStickerModalPackId} onClose={()=>setBuyStickerModalPackId(null)} onGoToStore={()=>setView('sticker-store')}/>}
        </div>
    );
};

const HomeView = ({ user, profile, allUsers, chats, setView, setActiveChatId, setSearchModalOpen }) => {
    const [tab, setTab] = useState("chats");
    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-5 border-b flex justify-between items-center bg-white shrink-0 sticky top-0 z-10">
                <h1 className="text-2xl font-bold text-gray-800">ホーム</h1>
                <div className="flex gap-4 items-center">
                    <div className="bg-yellow-100 px-3 py-1 rounded-full flex items-center gap-1"><Coins className="w-4 h-4 text-yellow-600"/><span className="text-sm font-bold text-yellow-700">{profile?.wallet}</span></div>
                    <QrCode onClick={()=>setView('qr')} className="w-6 h-6 text-gray-600 cursor-pointer hover:text-black transition-colors"/>
                    <Search onClick={()=>setSearchModalOpen(true)} className="w-6 h-6 text-gray-600 cursor-pointer hover:text-black transition-colors"/>
                    <Settings onClick={()=>setView('profile')} className="w-6 h-6 text-gray-600 cursor-pointer hover:text-black transition-colors"/>
                </div>
            </div>
            <div className="px-4 py-3 flex gap-4 overflow-x-auto scrollbar-hide border-b border-gray-50">
                 <div className="flex flex-col items-center gap-1 min-w-[60px] cursor-pointer" onClick={()=>setView('group-create')}>
                    <div className="w-14 h-14 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center hover:bg-gray-100"><Plus className="w-6 h-6 text-gray-400"/></div>
                    <span className="text-[10px] text-gray-400 font-bold">新規作成</span>
                </div>
                {allUsers.filter(u=>profile.friends?.includes(u.uid)).map(f=>(
                    <div key={f.uid} className="flex flex-col items-center gap-1 min-w-[60px]">
                        <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-green-400 to-blue-500">
                            <img src={f.avatar} className="w-full h-full rounded-full border-2 border-white object-cover" />
                        </div>
                        <span className="text-[10px] truncate w-14 text-center font-bold text-gray-700">{f.name}</span>
                    </div>
                ))}
            </div>
            <div className="flex border-b sticky top-[73px] bg-white z-10 shadow-sm">
                <button onClick={()=>setTab('chats')} className={`flex-1 py-4 font-bold text-sm relative transition-colors ${tab==='chats'?'text-green-500':'text-gray-400 hover:text-gray-600'}`}>トーク{tab==='chats'&&<div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-500"/>}</button>
                <button onClick={()=>setTab('friends')} className={`flex-1 py-4 font-bold text-sm relative transition-colors ${tab==='friends'?'text-green-500':'text-gray-400 hover:text-gray-600'}`}>友だち{tab==='friends'&&<div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-500"/>}</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide bg-gray-50">
                {tab==='chats' && chats.map(c=>{
                     const partner = !c.isGroup ? allUsers.find(u => u.uid === (c.participants.find(p => p !== user.uid) || user.uid)) : null;
                     const title = c.isGroup ? c.name : partner?.name;
                     const icon = c.isGroup ? c.icon : partner?.avatar;
                     return (
                        <div key={c.id} onClick={()=>{setActiveChatId(c.id);setView('chat')}} className="flex items-center gap-4 p-4 bg-white rounded-3xl shadow-sm cursor-pointer hover:shadow-md transition-all border border-transparent hover:border-gray-100">
                            <img src={icon} className="w-14 h-14 rounded-2xl object-cover border"/>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-1"><h3 className="font-bold text-gray-800 text-lg truncate">{title}</h3><span className="text-[10px] text-gray-400">{formatTime(c.updatedAt)}</span></div>
                                <p className="text-sm text-gray-500 truncate">{c.lastMessage?.content}</p>
                            </div>
                        </div>
                     )
                })}
                {tab==='friends' && allUsers.filter(u=>profile.friends?.includes(u.uid)).map(f=><div key={f.uid} className="flex items-center gap-4 p-4 bg-white rounded-3xl shadow-sm border border-transparent hover:border-gray-100"><img src={f.avatar} className="w-12 h-12 rounded-2xl object-cover"/><div className="flex-1"><div className="font-bold text-lg">{f.name}</div><div className="text-xs text-gray-400">{f.status}</div></div></div>)}
            </div>
        </div>
    );
};

const VoomView = ({ user, allUsers, profile, db, appId }) => { 
    const [posts, setPosts] = useState([]);
    useEffect(() => { const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), orderBy('createdAt', 'desc'), limit(20)); return onSnapshot(q, (snap) => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })))); }, []);
    return (<div className="flex flex-col h-full bg-gray-50"><div className="bg-white p-5 border-b shrink-0 sticky top-0 z-10"><h1 className="text-2xl font-bold">VOOM</h1></div><div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4">{posts.map(p => <div key={p.id} className="bg-white p-5 rounded-3xl shadow-sm"><div className="flex items-center gap-3 mb-3"><img src={allUsers.find(u=>u.uid===p.userId)?.avatar} className="w-10 h-10 rounded-full"/><div className="font-bold">{allUsers.find(u=>u.uid===p.userId)?.name}</div></div><div className="text-sm whitespace-pre-wrap">{p.content}</div></div>)}</div></div>);
};

const QRScannerView = ({ setView, addFriendById }) => {
    const videoRef = useRef(null), canvasRef = useRef(null), [scanning, setScanning] = useState(false);
    useEffect(() => { const script = document.createElement('script'); script.src = JSQR_URL; document.body.appendChild(script); }, []);
    const startScanner = async () => { setScanning(true); try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); requestAnimationFrame(tick); } } catch (err) { setScanning(false); } };
    const tick = () => { if (videoRef.current?.readyState === 4) { const c = canvasRef.current, ctx = c.getContext("2d"); c.height = videoRef.current.videoHeight; c.width = videoRef.current.videoWidth; ctx.drawImage(videoRef.current, 0, 0, c.width, c.height); const code = window.jsQR?.(ctx.getImageData(0,0,c.width,c.height).data, c.width, c.height); if (code) { setScanning(false); addFriendById(code.data); return; } } requestAnimationFrame(tick); };
    return (<div className="flex flex-col h-full bg-white"><div className="p-4 border-b flex items-center gap-4"><ChevronLeft onClick={() => setView('home')} /><span className="font-bold">QRコード</span></div><div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">{scanning ? <div className="relative"><video ref={videoRef} className="w-64 h-64 object-cover rounded-3xl border-4 border-green-500 shadow-2xl" /><div className="absolute inset-0 border-2 border-white/50 rounded-3xl animate-pulse"></div></div> : <button onClick={startScanner} className="bg-black text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl hover:scale-105 transition-transform flex items-center gap-2"><Scan className="w-6 h-6"/> スキャン開始</button>}<canvas ref={canvasRef} className="hidden"/></div></div>);
};

const ProfileEditView = ({ user, profile, setView, showNotification }) => {
    const [edit, setEdit] = useState(profile || {});
    const handleSave = () => { updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), edit); showNotification("保存しました"); };
    return (<div className="flex flex-col h-full bg-white"><div className="p-4 border-b flex items-center gap-4"><ChevronLeft onClick={() => setView('home')} /><span className="font-bold">プロフィール編集</span></div><div className="p-8 space-y-6"><div className="flex justify-center mb-6"><img src={edit.avatar} className="w-32 h-32 rounded-[40px] object-cover shadow-lg border-4 border-white"/></div><div className="space-y-2"><label className="text-xs font-bold text-gray-500 ml-2">名前</label><input className="w-full bg-gray-50 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-green-100" value={edit.name} onChange={e => setEdit({...edit, name: e.target.value})} /></div><div className="space-y-2"><label className="text-xs font-bold text-gray-500 ml-2">ステータス</label><input className="w-full bg-gray-50 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-green-100" value={edit.status} onChange={e => setEdit({...edit, status: e.target.value})} /></div><button onClick={handleSave} className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold shadow-lg mt-4 hover:bg-green-600 transition-colors">保存する</button><button onClick={()=>signOut(auth)} className="w-full bg-red-50 text-red-500 py-4 rounded-2xl font-bold mt-2">ログアウト</button></div></div>);
};

const IncomingCallOverlay = ({ callData, onAccept, onDecline, allUsers }) => {
    const caller = allUsers.find(u => u.uid === callData.callerId);
    return (<div className="fixed inset-0 z-[500] bg-gray-900 flex flex-col items-center justify-center gap-12 text-white animate-in fade-in p-8"><div className="flex flex-col items-center gap-4"><img src={caller?.avatar} className="w-32 h-32 rounded-full border-4 border-white/20 animate-pulse"/><div className="text-4xl font-bold text-center">{caller?.name}</div><div className="text-sm opacity-70 tracking-widest">INCOMING CALL...</div></div><div className="flex gap-12 w-full justify-center"><button onClick={onDecline} className="p-6 bg-red-500 rounded-full shadow-2xl hover:scale-110 transition-transform"><PhoneOff className="w-10 h-10"/></button><button onClick={onAccept} className="p-6 bg-green-500 rounded-full shadow-2xl animate-bounce hover:scale-110 transition-transform"><Video className="w-10 h-10"/></button></div></div>);
};

const OutgoingCallOverlay = ({ onCancel }) => (<div className="fixed inset-0 z-[500] bg-gray-900 flex flex-col items-center justify-center gap-12 text-white animate-in fade-in"><div className="flex flex-col items-center gap-6"><div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center animate-ping"><PhoneCall className="w-16 h-16"/></div><div className="text-2xl font-bold">発信中...</div></div><button onClick={onCancel} className="p-6 bg-red-500 rounded-full hover:scale-110 transition-transform shadow-xl"><PhoneOff className="w-8 h-8"/></button></div>);

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
  const [isGroupCall, setIsGroupCall] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [coinModalTarget, setCoinModalTarget] = useState(null);

  useEffect(() => {
      const script = document.createElement('script'); script.src = JSQR_URL; document.head.appendChild(script);
      setPersistence(auth, browserLocalPersistence);
      return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', u.uid);
        onSnapshot(userRef, (doc) => { if (doc.exists()) setProfile(doc.data()); else setDoc(userRef, { uid: u.uid, name: 'Guest', wallet: 1000, friends: [], avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}` }); });
        onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'chats'), where('participants', 'array-contains', u.uid), orderBy('updatedAt', 'desc')), s => setChats(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), s => setAllUsers(s.docs.map(d => d.data())));
      }
    });
  }, []);

  useEffect(() => {
     if(!chats.length || !user) return;
     const unsubs = chats.map(chat => onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chat.id, 'call_signaling', 'session'), (snap) => {
         const data = snap.data();
         if (!chat.isGroup && data && data.type === 'offer' && data.callerId !== user.uid && !activeCallId) setIncomingCall({ chatId: chat.id, ...data });
         else if (!data && incomingCall && incomingCall.chatId === chat.id) setIncomingCall(null);
         else if (data && data.type === 'answer' && outgoingCall && outgoingCall.chatId === chat.id) { setActiveCallId(chat.id); setOutgoingCall(null); }
     }));
     return () => unsubs.forEach(u => u());
  }, [chats, user, activeCallId, incomingCall, outgoingCall]);

  const showNotification = (msg) => { const id = Date.now(); setNotifications(p => [...p, { id, msg }]); setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), 3000); };
  const addFriendById = async (targetId) => { const target = allUsers.find(u => u.id === targetId || u.uid === targetId); if (target) { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { friends: arrayUnion(target.uid) }); setSearchModalOpen(false); showNotification("追加しました"); } };
  const startVideoCall = (chatId, isVideo, isGroup) => { setIsVideoCall(isVideo); setIsGroupCall(isGroup); if (isGroup) setActiveCallId(chatId); else { setOutgoingCall({ chatId }); setActiveCallId(chatId); } };
  const endCall = async () => { if (activeCallId && !isGroupCall) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeCallId, 'call_signaling', 'session')); setActiveCallId(null); setIncomingCall(null); setOutgoingCall(null); };

  if (!user) return <AuthView />;

  return (
    <div className="h-[100dvh] w-full bg-gray-100 flex justify-center overflow-hidden font-sans text-gray-800">
      <div className="w-full max-w-md bg-white shadow-2xl overflow-hidden relative flex flex-col h-full sm:rounded-[40px] sm:my-4 sm:h-[95vh] border border-gray-200/50">
        
        <div className="flex-1 overflow-hidden relative flex flex-col">
             {view === 'home' && <HomeView user={user} profile={profile} allUsers={allUsers} chats={chats} setView={setView} setActiveChatId={setActiveChatId} setSearchModalOpen={setSearchModalOpen} />}
             {view === 'chat' && activeChatId && <ChatRoomView user={user} profile={profile} allUsers={allUsers} chats={chats} activeChatId={activeChatId} setActiveChatId={setActiveChatId} setView={setView} db={db} appId={appId} mutedChats={mutedChats} toggleMuteChat={()=>{}} showNotification={showNotification} addFriendById={addFriendById} startVideoCall={startVideoCall} />}
             {view === 'voom' && <VoomView user={user} allUsers={allUsers} profile={profile} db={db} appId={appId} />}
             {view === 'qr' && <QRScannerView setView={setView} addFriendById={addFriendById} />}
             {view === 'profile' && <ProfileEditView user={user} profile={profile} setView={setView} showNotification={showNotification} />}
             {view === 'sticker-store' && <StickerStoreView user={user} setView={setView} profile={profile} allUsers={allUsers} />}
             {view === 'sticker-create' && <StickerEditor user={user} profile={profile} onClose={() => setView('sticker-store')} showNotification={showNotification} />}
             {view === 'group-create' && <GroupCreateView user={user} profile={profile} allUsers={allUsers} setView={setView} />}
             {view === 'card-box' && <BirthdayCardBox user={user} setView={setView} />}
        </div>

        {['home', 'voom'].includes(view) && (
             <div className="h-20 bg-white border-t flex items-center justify-around z-50 pb-4 shrink-0">
                 <div className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${view === 'home' ? 'text-green-500' : 'text-gray-400'}`} onClick={() => setView('home')}><Home className="w-6 h-6" /><span className="text-[10px] font-bold">ホーム</span></div>
                 <div className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${view === 'voom' ? 'text-green-500' : 'text-gray-400'}`} onClick={() => setView('voom')}><LayoutGrid className="w-6 h-6" /><span className="text-[10px] font-bold">VOOM</span></div>
             </div>
        )}

        {notifications.map(n => (<div key={n.id} className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full text-sm font-bold shadow-xl z-[9999] animate-in fade-in slide-in-from-top-4 backdrop-blur-sm">{n.msg}</div>))}
        {searchModalOpen && (<div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl"><h3 className="font-bold text-lg mb-4">友だち検索</h3><input className="w-full bg-gray-100 p-3 rounded-xl mb-4 outline-none" placeholder="IDを入力" value={searchId} onChange={e => setSearchId(e.target.value)} /><button onClick={() => addFriendById(searchId)} className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl">検索</button><button onClick={() => setSearchModalOpen(false)} className="w-full mt-2 text-gray-500 py-2">閉じる</button></div></div>)}
        {incomingCall && !activeCallId && <IncomingCallOverlay callData={incomingCall} allUsers={allUsers} onDecline={async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', incomingCall.chatId, 'call_signaling', 'session')); setIncomingCall(null); }} onAccept={() => { setActiveCallId(incomingCall.chatId); setIncomingCall(null); }} />}
        {outgoingCall && !activeCallId && <OutgoingCallOverlay onCancel={async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', outgoingCall.chatId, 'call_signaling', 'session')); setOutgoingCall(null); setActiveCallId(null); }} />}
        {activeCallId && <VideoCallView user={user} chatId={activeCallId} callData={{ callerId: incomingCall ? incomingCall.callerId : user.uid }} onEndCall={endCall} isVideoEnabled={isVideoCall} isGroup={isGroupCall} allUsers={allUsers} />}
      </div>
    </div>
  );
}
