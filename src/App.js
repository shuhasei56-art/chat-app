// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import jsQR from 'jsqr';
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, collectionGroup, doc, setDoc, getDoc, updateDoc, onSnapshot, query, addDoc, deleteDoc, where, arrayUnion, arrayRemove, serverTimestamp, orderBy, limit, limitToLast, writeBatch, getDocs, deleteField, increment, runTransaction } from 'firebase/firestore';
import { Search, UserPlus, Image as ImageIcon, Send, X, ChevronLeft, Settings, Home, LayoutGrid, Trash2, Plus, Video, Heart, MessageCircle, Camera as CameraIcon, Maximize, Upload, Copy, Contact, Play, Gift, Cake, Users, Check, Loader2, Bell, BellOff, Mic, Edit2, Palette, PhoneOff, LogOut, RefreshCcw, ArrowUpCircle, Reply, Smile, StopCircle, PhoneCall, Phone, FileText, Paperclip, Download, UserMinus, AtSign, Store, PenTool, Eraser, Coins, Scissors, Star, Disc, ShieldAlert, Music, Volume2, ShoppingCart, User, KeyRound, MicOff, VideoOff, Wand2, Sparkles, MoreVertical, EyeOff, Eye, AlertCircle } from 'lucide-react';
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
const CHUNK_SIZE = 716799;
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const rtcConfig = {
    iceServers: [
        { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
    ],
};
// --- 2. Utility Functions & Globals ---
const formatTime = (timestamp) => {
    if (!timestamp)
        return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const formatDate = (timestamp) => {
    if (!timestamp)
        return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
};
const formatDateTime = (timestamp) => {
    if (!timestamp)
        return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const isTodayBirthday = (birthdayString) => {
    if (!birthdayString)
        return false;
    const today = new Date();
    const [y, m, d] = birthdayString.split('-').map(Number);
    return (today.getMonth() + 1) === m && today.getDate() === d;
};
// Audio Notification Logic
let audioCtx = null;
const initAudioContext = () => {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass)
            audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(e => console.error("Audio resume failed:", e));
    }
};
const playNotificationSound = () => {
    try {
        initAudioContext();
        if (!audioCtx)
            return;
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
    }
    catch (e) {
        console.error("Audio play failed", e);
    }
};
// Media Processing Utilities
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
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                }
                else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(blob.size > file.size ? file : new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                        }
                        else {
                            resolve(file);
                        }
                    }, 'image/jpeg', 0.8);
                }
                else {
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
    if (!files || files.length === 0)
        return;
    const originalFile = files[0];
    e.target.value = '';
    let file = originalFile;
    if (originalFile.type.startsWith('image') && originalFile.type !== 'image/gif') {
        file = await processFileBeforeUpload(originalFile);
    }
    let type = 'file';
    if (file.type.startsWith('image'))
        type = 'image';
    else if (file.type.startsWith('video'))
        type = 'video';
    else if (file.type.startsWith('audio'))
        type = 'audio';
    if (file.size > 1024 * 1024 || type === 'video' || type === 'file') {
        const objectUrl = URL.createObjectURL(file);
        callback(objectUrl, type, file);
    }
    else {
        const reader = new FileReader();
        reader.onload = (event) => callback(event.target.result, type, file);
        reader.readAsDataURL(file);
    }
};
const handleCompressedUpload = (e, callback) => {
    const files = e.target.files;
    if (!files || files.length === 0)
        return;
    const file = files[0];
    if (!file.type.startsWith('image'))
        return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            }
            else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
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
const generateThumbnail = (file) => {
    return new Promise((resolve) => {
        if (!file) {
            resolve(null);
            return;
        }
        const MAX_SIZE = 320;
        if (file.type.startsWith('image')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    }
                    else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', 0.5));
                    }
                    else
                        resolve(null);
                };
                img.onerror = () => resolve(null);
                img.src = e.target.result;
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        }
        else if (file.type.startsWith('video')) {
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
                    if (!width || !height) {
                        resolve(null);
                        return;
                    }
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    }
                    else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, width, height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                        video.src = "";
                        video.load();
                        resolve(dataUrl);
                    }
                    else
                        resolve(null);
                }
                catch (e) {
                    resolve(null);
                }
            };
            video.onloadeddata = () => { video.currentTime = 0.5; };
            video.onseeked = () => { capture(); };
            video.onerror = () => resolve(null);
            setTimeout(() => resolve(null), 2000);
            try {
                video.src = URL.createObjectURL(file);
            }
            catch (e) {
                resolve(null);
            }
        }
        else {
            resolve(null);
        }
    });
};
// --- 3. Component Definitions (Helper & Views) ---
const AuthView = ({ onLogin, showNotification }) => {
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
        } catch (error) {
            console.error("Login Error:", error);
            showNotification("エラーが発生しました: " + error.message);
        }
    };

    const handleGuestLogin = async () => {
        setLoading(true);
        try {
            await signInAnonymously(auth);
            showNotification("ゲストログインしました");
        } catch (e) {
            showNotification("ゲストログイン失敗");
        } finally {
            setLoading(false);
        }
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
                if (!displayName) {
                    showNotification("ニックネームを入力してください");
                    setLoading(false);
                    return;
                }
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, "artifacts", appId, "public", "data", "users", cred.user.uid), {
                    uid: cred.user.uid,
                    name: displayName || userId,
                    id: userId,
                    status: "よろしくお願いします！",
                    birthday: "",
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cred.user.uid}`,
                    cover: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80",
                    friends: [], hiddenFriends: [], hiddenChats: [], wallet: 1000, isBanned: false,
                });
                showNotification("アカウント作成完了");
            }
        } catch (e) {
            showNotification("エラー: " + e.message);
        } finally {
            setLoading(false);
        }
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
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 ml-2">表示名</label>
                                <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border">
                                    <User className="w-4 h-4 text-gray-400" />
                                    <input className="bg-transparent w-full outline-none text-sm font-bold" placeholder="山田 太郎" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
                                </div>
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 ml-2">ユーザーID</label>
                            <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border">
                                <AtSign className="w-4 h-4 text-gray-400" />
                                <input className="bg-transparent w-full outline-none text-sm font-bold" placeholder="user_id" value={userId} onChange={(e) => setUserId(e.target.value)} autoComplete="username" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 ml-2">パスワード</label>
                            <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2 border">
                                <KeyRound className="w-4 h-4 text-gray-400" />
                                <input className="bg-transparent w-full outline-none text-sm font-bold" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isLoginMode ? "current-password" : "new-password"} />
                            </div>
                        </div>
                        <button type="submit" disabled={loading} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center">{loading ? <Loader2 className="animate-spin" /> : (isLoginMode ? "ログイン" : "登録")}</button>
                    </form>
                    <div className="mt-6 flex flex-col gap-3">
                        <button onClick={handleGoogleLogin} className="w-full bg-white border text-gray-700 font-bold py-3 rounded-2xl shadow-sm flex items-center justify-center gap-2"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" className="w-4 h-4" alt="Google" />Googleでログイン</button>
                        <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-xs font-bold text-gray-400 hover:text-indigo-500">{isLoginMode ? "アカウントをお持ちでない方はこちら" : "すでにアカウントをお持ちの方はこちら"}</button>
                        <button onClick={handleGuestLogin} className="text-xs font-bold text-gray-400 underline hover:text-gray-600">お試しゲストログイン</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
const VideoCallView = ({ user, chatId, callData, onEndCall, isVideoEnabled = true, activeEffect, backgroundUrl, effects = [] }) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(!isVideoEnabled);
    const [callError, setCallError] = useState(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const pcRef = useRef(null);
    const localStreamRef = useRef(null);
    const unsubscribersRef = useRef([]);
    const pendingCandidatesRef = useRef([]);
    const startedRef = useRef(false);
    const stopAll = useCallback(() => {
        // Firestore listeners
        unsubscribersRef.current.forEach((u) => {
            try {
                u();
            }
            catch { }
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
        }
        catch { }
        pcRef.current = null;
        // Media tracks
        try {
            const s = localStreamRef.current;
            if (s)
                s.getTracks().forEach((t) => t.stop());
        }
        catch { }
        localStreamRef.current = null;
    }, []);
    const getFilterStyle = (effectName) => {
        if (!effectName || effectName === 'Normal')
            return 'none';
        // Prefer user-defined / purchased effect filter if available
        const match = (effects || []).find((e) => e?.name === effectName && typeof e?.filter === 'string' && e.filter.trim() !== '');
        if (match?.filter)
            return match.filter;
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
    const getMediaErrorMessage = (err) => {
        const name = err?.name || '';
        if (name === 'NotAllowedError' || name === 'SecurityError')
            return "カメラ/マイクの利用が許可されていません。ブラウザ設定で許可してください。";
        if (name === 'NotFoundError')
            return "カメラまたはマイクが見つかりません。（端末にデバイスが無い/無効/接続されていない可能性）";
        if (name === 'NotReadableError')
            return "カメラ/マイクを使用できません。他のアプリが使用中の可能性があります。";
        if (name === 'OverconstrainedError')
            return "カメラ/マイクの条件が厳しすぎて取得できませんでした。";
        return "カメラ/マイクの取得に失敗しました。";
    };
    const flushPendingCandidates = async (pc) => {
        const pending = pendingCandidatesRef.current;
        pendingCandidatesRef.current = [];
        for (const c of pending) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(c));
            }
            catch { }
        }
    };
    useEffect(() => {
        let cancelled = false;
        const startCall = async () => {
            if (startedRef.current)
                return;
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
                if (!event.candidate)
                    return;
                try {
                    await addDoc(candidatesCol, {
                        candidate: event.candidate.toJSON(),
                        senderId: user.uid,
                        createdAt: serverTimestamp(),
                    });
                }
                catch (e) {
                    console.warn("Failed to send ICE candidate:", e);
                }
            };
            pc.ontrack = async (event) => {
                const s = event.streams?.[0];
                if (!s)
                    return;
                setRemoteStream(s);
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = s;
                    try {
                        await remoteVideoRef.current.play();
                    }
                    catch { }
                }
            };
            // --- getUserMedia with fallbacks ---
            try {
                const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
                const hasAudioInput = devices.some((d) => d.kind === 'audioinput');
                const hasVideoInput = devices.some((d) => d.kind === 'videoinput');
                const wantVideo = !!isVideoEnabled && hasVideoInput;
                const baseConstraints = {
                    audio: hasAudioInput
                        ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
                        : true,
                    video: wantVideo ? { facingMode: "user" } : false,
                };
                let stream = null;
                try {
                    stream = await navigator.mediaDevices.getUserMedia(baseConstraints);
                }
                catch (err) {
                    // If video was requested, retry with audio only.
                    if (wantVideo) {
                        try {
                            stream = await navigator.mediaDevices.getUserMedia({
                                audio: true,
                                video: false,
                            });
                            setIsVideoOff(true);
                        }
                        catch (err2) {
                            throw err2;
                        }
                    }
                    else {
                        throw err;
                    }
                }
                if (!stream)
                    throw new Error("No stream");
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
                    try {
                        await localVideoRef.current.play();
                    }
                    catch { }
                }
                stream.getTracks().forEach((track) => pc.addTrack(track, stream));
            }
            catch (err) {
                console.error("Error accessing media devices.", err);
                setCallError(getMediaErrorMessage(err));
                setTimeout(() => onEndCall?.(), 2500);
                return;
            }
            // --- Signaling ---
            const unsubSignaling = onSnapshot(signalingRef, async (snap) => {
                const data = snap.data();
                if (!data || !pcRef.current)
                    return;
                try {
                    if (!pc.currentRemoteDescription && data.type === "answer" && isCaller && data.sdp) {
                        await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }));
                        await flushPendingCandidates(pc);
                    }
                    else if (!pc.currentRemoteDescription && data.type === "offer" && !isCaller && data.sdp) {
                        await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: data.sdp }));
                        await flushPendingCandidates(pc);
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        await setDoc(signalingRef, { type: "answer", sdp: answer.sdp, callerId: data.callerId || callData?.callerId }, { merge: true });
                    }
                }
                catch (e) {
                    console.warn("Signaling error:", e);
                }
            });
            unsubscribersRef.current.push(unsubSignaling);
            const unsubCandidates = onSnapshot(candidatesCol, (snapshot) => {
                snapshot.docChanges().forEach(async (change) => {
                    if (change.type !== "added")
                        return;
                    const data = change.doc.data();
                    if (!data || data.senderId === user.uid)
                        return;
                    try {
                        const c = data.candidate;
                        if (pc.remoteDescription) {
                            await pc.addIceCandidate(new RTCIceCandidate(c));
                        }
                        else {
                            pendingCandidatesRef.current.push(c);
                        }
                    }
                    catch (e) {
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
                }
                catch (e) {
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
            remoteVideoRef.current.play().catch(() => { });
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
        return (<div className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center text-white flex-col gap-4">
        <AlertCircle className="w-16 h-16 text-red-500"/>
        <p className="font-bold text-lg text-center px-8">{callError}</p>
        <p className="text-sm text-gray-400">騾夊ｩｱ繧堤ｵゆｺ・＠縺ｾ縺・..</p>
      </div>);
    }
    return (<div className="fixed inset-0 z-[1000] bg-black flex flex-col animate-in fade-in" style={{ backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none', backgroundSize: 'cover' }}>
      <div className="relative flex-1 flex items-center justify-center backdrop-blur-md bg-black/30">
        {remoteStream ? (<video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover"/>) : (<div className="text-white flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center animate-pulse">
              <User className="w-10 h-10"/>
            </div>
            <p className="font-bold text-lg drop-shadow-md">謗･邯壻ｸｭ...</p>
          </div>)}

        {isVideoEnabled && (<div className="absolute top-4 right-4 w-32 h-48 bg-black rounded-xl overflow-hidden border-2 border-white shadow-lg transition-all">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" style={{ filter: getFilterStyle(activeEffect) }}/>
            {activeEffect && activeEffect !== 'Normal' && (<div className="absolute bottom-1 left-1 bg-black/50 text-white text-[8px] px-1 rounded">
                {activeEffect}
              </div>)}
          </div>)}
      </div>

      <div className="h-24 bg-black/80 flex items-center justify-center gap-8 pb-6 backdrop-blur-lg">
        <button onClick={toggleMute} className={`p-4 rounded-full transition-all ${isMuted ? "bg-white text-black" : "bg-gray-700 text-white hover:bg-gray-600"}`}>
          {isMuted ? <MicOff className="w-6 h-6"/> : <Mic className="w-6 h-6"/>}
        </button>

        <button onClick={onEndCall} className="p-4 rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 transform hover:scale-110 transition-all flex flex-col items-center justify-center gap-1">
          <PhoneOff className="w-8 h-8"/>
          <span className="text-[10px] font-bold">終了</span>
        </button>

        {isVideoEnabled && (<button onClick={toggleVideo} className={`p-4 rounded-full transition-all ${isVideoOff ? "bg-white text-black" : "bg-gray-700 text-white hover:bg-gray-600"}`}>
            {isVideoOff ? <VideoOff className="w-6 h-6"/> : <Video className="w-6 h-6"/>}
          </button>)}
      </div>
    </div>);
};
const AIEffectGenerator = ({ user, onClose, showNotification, onSelectEffect }) => {
    const [sourceImage, setSourceImage] = useState(null);
    const [generatedEffects, setGeneratedEffects] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const canvasRef = useRef(null);
    const handleImageUpload = (e) => {
        const files = e.target.files;
        if (!files || files.length === 0)
            return;
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
            const results = [];
            const canvas = canvasRef.current;
            if (!canvas)
                return;
            const ctx = canvas.getContext('2d');
            if (!ctx)
                return;
            const MAX_SIZE = 200;
            let w = img.width;
            let h = img.height;
            if (w > h) {
                if (w > MAX_SIZE) {
                    h *= MAX_SIZE / w;
                    w = MAX_SIZE;
                }
            }
            else {
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
                results.push({ name: effect.name, filter: effect.filter, image: canvas.toDataURL('image/jpeg', 0.8) });
            });
            setGeneratedEffects(results);
            setIsProcessing(false);
            showNotification("AI縺・繝代ち繝ｼ繝ｳ縺ｮ繧ｨ繝輔ぉ繧ｯ繝医ｒ逕滓・縺励∪縺励◆・≫惠");
        };
        img.src = imgSrc;
    };
    const saveEffect = async (effect) => {
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
            showNotification(`${effect.name} 繧ｨ繝輔ぉ繧ｯ繝医ｒ菫晏ｭ倥＠縺ｾ縺励◆`);
            if (onSelectEffect)
                onSelectEffect(effect.name);
            onClose();
        }
        catch (e) {
            console.error(e);
            showNotification("菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆");
        }
    };
    return (<div className="fixed inset-0 z-[2000] bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full hover:bg-gray-200 z-10"><X className="w-5 h-5"/></button>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 flex-shrink-0"><Sparkles className="w-6 h-6 text-purple-500"/> AIエフェクト生成</h2>
        
        {!sourceImage ? (<div className="flex flex-col items-center justify-center flex-1 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
            <label className="cursor-pointer flex flex-col items-center p-10 w-full h-full justify-center">
              <Upload className="w-12 h-12 text-gray-400 mb-2"/>
              <span className="text-sm font-bold text-gray-500">逕ｻ蜒上ｒ繧｢繝・・繝ｭ繝ｼ繝峨＠縺ｦ逕滓・</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload}/>
            </label>
          </div>) : (<div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-2">
              {isProcessing ? (<div className="flex flex-col items-center justify-center h-64">
                  <Loader2 className="w-12 h-12 animate-spin text-purple-500 mb-4"/>
                  <p className="text-sm font-bold text-gray-500 animate-pulse">AI縺梧晁・ｸｭ...</p>
                </div>) : (<div className="grid grid-cols-2 gap-4">
                  {generatedEffects.map((ef, i) => (<div key={i} onClick={() => saveEffect(ef)} className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center cursor-pointer hover:ring-2 ring-purple-500 transition-all group">
                      <div className="w-full aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2 relative">
                         <img src={ef.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                      </div>
                      <span className="text-xs font-bold text-gray-700">{ef.name}</span>
                    </div>))}
                </div>)}
            </div>
            <button onClick={() => { setSourceImage(null); setGeneratedEffects([]); }} className="mt-4 w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl flex-shrink-0">やり直す</button>
          </div>)}
        <canvas ref={canvasRef} className="hidden"/>
      </div>
    </div>);
};
const CoinTransferModal = ({ onClose, myWallet, myUid, targetUid, targetName, showNotification }) => {
    const [amount, setAmount] = useState("");
    const [sending, setSending] = useState(false);
    const handleSend = async () => {
        const val = parseInt(amount, 10);
        if (isNaN(val) || val <= 0)
            return showNotification("豁｣縺ｮ謨ｴ謨ｰ繧貞・蜉帙＠縺ｦ縺上□縺輔＞");
        if (val > myWallet)
            return showNotification("谿矩ｫ倥′雜ｳ繧翫∪縺帙ｓ");
        setSending(true);
        try {
            await runTransaction(db, async (t) => {
                const senderRef = doc(db, "artifacts", appId, "public", "data", "users", myUid);
                const receiverRef = doc(db, "artifacts", appId, "public", "data", "users", targetUid);
                const senderDoc = await t.get(senderRef);
                if (!senderDoc.exists() || senderDoc.data().wallet < val)
                    throw "谿矩ｫ倅ｸ崎ｶｳ縺ｾ縺溘・繧ｨ繝ｩ繝ｼ";
                t.update(senderRef, { wallet: increment(-val) });
                t.update(receiverRef, { wallet: increment(val) });
            });
            showNotification(`${targetName}縺輔ｓ縺ｫ ${val}繧ｳ繧､繝ｳ騾√ｊ縺ｾ縺励◆`);
            onClose();
        }
        catch (e) {
            showNotification("騾・≡繧ｨ繝ｩ繝ｼ: " + e);
        }
        finally {
            setSending(false);
        }
    };
    return (<div className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in">
      <div className="bg-white w-full max-w-sm rounded-[32px] p-6 text-center shadow-2xl">
        <h3 className="font-bold text-lg mb-4 text-gray-800">繧ｳ繧､繝ｳ繧帝√ｋ</h3>
        <div className="bg-yellow-50 p-4 rounded-2xl mb-4 border border-yellow-100">
          <div className="text-xs text-yellow-700 font-bold uppercase tracking-widest">あなたの残高</div>
          <div className="text-3xl font-black text-yellow-500 mt-1">{myWallet?.toLocaleString()}</div>
        </div>
        <p className="text-sm font-bold text-gray-500 mb-2">To: {targetName}</p>
        <div className="relative mb-6">
          <input type="number" className="w-full bg-gray-100 rounded-2xl p-4 text-center font-bold text-xl outline-none focus:ring-2 focus:ring-yellow-400" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)}/>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">COIN</span>
        </div>
        <button onClick={handleSend} disabled={sending} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-2xl shadow-lg transition-transform active:scale-95 mb-3">{sending ? <Loader2 className="animate-spin mx-auto"/> : "騾・≡縺吶ｋ"}</button>
        <button onClick={onClose} className="text-gray-400 text-xs font-bold hover:text-gray-600">繧ｭ繝｣繝ｳ繧ｻ繝ｫ</button>
      </div>
    </div>);
};
const ContactSelectModal = ({ onClose, onSend, friends }) => (<div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col max-h-[70vh]">
      <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">連絡先を選択</h3><button onClick={onClose}><X className="w-6 h-6"/></button></div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">{friends.length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">蜿九□縺｡縺後＞縺ｾ縺帙ｓ</div> : friends.map((f) => <div key={f.uid} onClick={() => onSend(f)} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer border border-transparent hover:border-gray-100 transition-all"><img src={f.avatar} className="w-10 h-10 rounded-xl object-cover border"/><span className="font-bold text-sm flex-1">{f.name}</span><Plus className="w-4 h-4 text-green-500"/></div>)}</div>
    </div>
  </div>);
const BirthdayCardModal = ({ onClose, onSend, toName }) => {
    const [color, setColor] = useState('pink'), [message, setMessage] = useState('');
    const colors = [{ id: 'pink', class: 'bg-pink-100 border-pink-300' }, { id: 'blue', class: 'bg-blue-100 border-blue-300' }, { id: 'yellow', class: 'bg-yellow-100 border-yellow-300' }, { id: 'green', class: 'bg-green-100 border-green-300' }];
    return (<div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">繧ｫ繝ｼ繝峨ｒ騾√ｋ</h3><button onClick={onClose}><X className="w-6 h-6"/></button></div>
        <div className="mb-4 flex gap-3">{colors.map(c => <button key={c.id} onClick={() => setColor(c.id)} className={`w-10 h-10 rounded-full border-2 ${c.class} ${color === c.id ? 'scale-125 ring-2 ring-gray-300' : ''}`}/>)}</div>
        <div className={`p-4 rounded-2xl border-2 mb-4 ${colors.find(c => c.id === color)?.class}`}><div className="font-bold text-gray-700 mb-2">To: {toName}</div><textarea className="w-full bg-white/50 rounded-xl p-3 text-sm focus:outline-none min-h-[100px]" placeholder="繝｡繝・そ繝ｼ繧ｸ..." value={message} onChange={e => setMessage(e.target.value)}/></div>
        <button onClick={() => onSend({ color, message })} disabled={!message.trim()} className="w-full bg-pink-500 text-white font-bold py-3 rounded-2xl shadow-lg">騾∽ｿ｡縺吶ｋ</button>
      </div>
    </div>);
};
const StickerBuyModal = ({ onClose, onGoToStore, packId }) => {
    return (<div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="w-8 h-8 text-blue-600"/>
                </div>
                <h3 className="font-bold text-lg mb-2">このスタンプを購入しますか？</h3>
                <p className="text-gray-500 text-sm mb-6">ショップで詳細を確認できます。</p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-2xl text-gray-600 transition-colors">繧ｭ繝｣繝ｳ繧ｻ繝ｫ</button>
                    <button onClick={() => { onGoToStore(packId); onClose(); }} className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 font-bold rounded-2xl text-white transition-colors shadow-lg shadow-blue-200">繧ｷ繝ｧ繝・・縺ｸ</button>
                </div>
            </div>
        </div>);
};
const GroupAddMemberModal = ({ onClose, currentMembers, chatId, allUsers, profile, user, chats, showNotification }) => {
    const [selected, setSelected] = useState([]);
    const inviteableUids = useMemo(() => {
        const s = new Set(profile?.friends || []);
        (chats || []).forEach((c) => {
            if (!c || c.isGroup) return;
            const parts = c.participants || [];
            if (!parts.includes(user?.uid)) return;
            const other = parts.find((p) => p && p !== user.uid);
            if (other) s.add(other);
        });
        return s;
    }, [profile?.friends, chats, user?.uid]);

    const inviteableFriends = allUsers.filter((u) => inviteableUids.has(u.uid) && u.uid !== user.uid && !currentMembers.includes(u.uid));
    const toggle = (uid) => setSelected((prev) => (prev.includes(uid) ? prev.filter((i) => i !== uid) : [...prev, uid]));

    const handleInvite = async () => {
        if (selected.length === 0) return;
        try {
            const addedNames = [];
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId), { participants: arrayUnion(...selected) });
            selected.forEach((uid) => {
                const u = allUsers.find((x) => x.uid === uid);
                if (u) addedNames.push(u.name);
            });
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages'), {
                senderId: user.uid,
                content: `${profile.name}が${addedNames.join('、')}を招待しました。`,
                type: 'text',
                createdAt: serverTimestamp(),
                readBy: [user.uid]
            });
            showNotification('メンバーを追加しました');
            onClose();
        } catch {
            showNotification('エラーが発生しました');
        }
    };

    return (
      <div className='fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm'>
        <div className='bg-white w-full max-w-sm rounded-3xl flex flex-col max-h-[70vh]'>
          <div className='flex justify-between items-center p-4 border-b'><h3 className='font-bold text-lg'>メンバーを追加</h3><button onClick={onClose}><X className='w-6 h-6'/></button></div>
          <div className='flex-1 overflow-y-auto p-4 space-y-2'>
            {inviteableFriends.length === 0 ? <div className='text-center py-10 text-gray-400 text-sm'>招待できる友だちがいません</div> : inviteableFriends.map((f) => (
              <div key={f.uid} onClick={() => toggle(f.uid)} className='flex items-center gap-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer border border-transparent transition-all'>
                <img src={f.avatar} className='w-10 h-10 rounded-xl object-cover border'/>
                <span className='font-bold text-sm flex-1'>{f.name}</span>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selected.includes(f.uid) ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}>{selected.includes(f.uid) && <Check className='w-4 h-4 text-white'/>}</div>
              </div>
            ))}
          </div>
          <div className='p-4 border-t'><button onClick={handleInvite} disabled={selected.length === 0} className={`w-full py-3 rounded-2xl font-bold shadow-lg text-white transition-all ${selected.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}>招待する ({selected.length})</button></div>
        </div>
      </div>
    );
};const GroupEditModal = ({ onClose, chatId, currentName, currentIcon, currentMembers, allUsers, showNotification, user, profile }) => {
    const [name, setName] = useState(currentName);
    const [icon, setIcon] = useState(currentIcon);
    const [kickTarget, setKickTarget] = useState(null);

    const handleUpdate = async () => {
        if (!name.trim()) return showNotification("グループ名を入力してください");
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId), { name, icon, updatedAt: serverTimestamp() });
            if (name !== currentName || icon !== currentIcon) {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages'), {
                    senderId: user.uid,
                    content: `${profile.name}がグループ情報を変更しました。`,
                    type: 'text',
                    createdAt: serverTimestamp(),
                    readBy: [user.uid]
                });
            }
            showNotification("グループ情報を更新しました");
            onClose();
        } catch {
            showNotification("更新に失敗しました");
        }
    };

    const executeKick = async () => {
        if (!kickTarget) return;
        const { uid, name: memberName } = kickTarget;
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId), { participants: arrayRemove(uid) });
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages'), {
                senderId: user.uid,
                content: `${profile.name}が${memberName}を退会させました。`,
                type: 'text',
                createdAt: serverTimestamp(),
                readBy: [user.uid]
            });
            showNotification(`${memberName}を削除しました`);
        } catch {
            showNotification("削除に失敗しました");
        } finally {
            setKickTarget(null);
        }
    };

    return (
      <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
          <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0"><h3 className="font-bold text-lg">グループ設定</h3><button onClick={onClose}><X className="w-6 h-6 text-gray-500"/></button></div>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="flex flex-col items-center gap-6 mb-8">
                <div className="relative group"><img src={icon} className="w-24 h-24 rounded-3xl object-cover bg-gray-100 border shadow-sm"/><label className="absolute bottom-0 right-0 bg-green-500 p-2 rounded-full text-white cursor-pointer shadow-lg border-2 border-white hover:bg-green-600 transition-colors"><CameraIcon className="w-4 h-4"/><input type="file" className="hidden" accept="image/*" onChange={e => handleCompressedUpload(e, (d) => setIcon(d))}/></label></div>
                <div className="w-full"><label className="text-xs font-bold text-gray-400 mb-1 block">グループ名</label><input className="w-full text-center text-lg font-bold border-b py-2 focus:outline-none focus:border-green-500 bg-transparent" placeholder="グループ名を入力" value={name} onChange={e => setName(e.target.value)}/></div>
            </div>
            <div className="mb-6"><h4 className="text-xs font-bold text-gray-400 mb-2 uppercase flex justify-between"><span>メンバー ({currentMembers.length})</span><span className="text-[10px] text-gray-400 font-normal">管理者権限: 削除可能</span></h4>
                <div className="space-y-2">{currentMembers.map((uid) => { const m = allUsers.find((u) => u.uid === uid); if (!m) return null; const isMe = uid === user.uid; return (<div key={uid} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100"><img src={m.avatar} className="w-10 h-10 rounded-full object-cover border"/><div className="flex-1 min-w-0"><div className="font-bold text-sm truncate">{m.name} {isMe && <span className="text-gray-400 text-xs">(自分)</span>}</div></div>{!isMe && (<button onClick={() => setKickTarget({ uid, name: m.name })} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors flex items-center gap-1 group" title="強制退会"><span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">強制退会</span><UserMinus className="w-5 h-5"/></button>)}</div>); })}</div>
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
      <div className="text-center mb-6">
        <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3"><LogOut className="w-6 h-6 text-red-500" /></div>
        <h3 className="font-bold text-lg text-gray-800">グループを退会しますか？</h3>
        <p className="text-sm text-gray-500 mt-2">この操作は取り消せません。<br />本当に退会してもよろしいですか？</p>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors">キャンセル</button>
        <button onClick={onLeave} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-red-200">退会する</button>
      </div>
    </div>
  </div>
);
const IncomingCallOverlay = ({ callData, onAccept, onDecline, allUsers }) => {
    const caller = allUsers.find((u) => u.uid === callData.callerId);
    const isVideo = callData?.callType !== 'audio';
    return (<div className="fixed inset-0 z-[500] bg-gray-900 flex flex-col items-center justify-between py-16 px-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img src={caller?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=caller"} className="w-full h-full object-cover blur-3xl opacity-50 scale-125" alt="background"/>
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 mt-12">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-white/80 mb-2">
            <PhoneCall className="w-5 h-5 animate-pulse"/>
            <span className="text-sm font-bold tracking-widest">逹菫｡荳ｭ...</span>
          </div>
          <h2 className="text-4xl font-bold text-white drop-shadow-xl text-center leading-tight">{caller?.name || "Unknown"}</h2>
          <div className="text-white/70 text-sm font-bold mt-1">
            {isVideo ? "繝薙ョ繧ｪ騾夊ｩｱ" : "髻ｳ螢ｰ騾夊ｩｱ"}
          </div>
        </div>

        <div className="relative mt-8">
          <div className="absolute inset-0 rounded-full bg-white/20 animate-[ping_2s_ease-in-out_infinite]"></div>
          <div className="absolute inset-0 rounded-full bg-white/10 animate-[ping_3s_ease-in-out_infinite_delay-500ms]"></div>
          <img src={caller?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=caller"} className="w-40 h-40 rounded-full border-[6px] border-white/20 shadow-2xl object-cover relative z-10 bg-gray-800"/>
        </div>
      </div>

      <div className="relative z-10 w-full flex justify-between items-end px-4 mb-8 max-w-sm">
        <button onClick={onDecline} className="flex flex-col items-center gap-4 group">
          <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-red-600 border border-red-400">
            <PhoneOff className="w-10 h-10 text-white fill-current"/>
          </div>
          <span className="text-white text-sm font-bold shadow-black drop-shadow-md">諡貞凄</span>
        </button>

        <button onClick={onAccept} className="flex flex-col items-center gap-4 group">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-50"></div>
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-green-600 border border-green-400 relative z-10">
              {isVideo ? <Video className="w-10 h-10 text-white fill-current"/> : <Phone className="w-10 h-10 text-white fill-current"/>}
            </div>
          </div>
          <span className="text-white text-sm font-bold shadow-black drop-shadow-md">応答</span>
        </button>
      </div>
    </div>);
};
const OutgoingCallOverlay = ({ callData, onCancel, allUsers }) => (<div className="fixed inset-0 z-[500] bg-gray-900 flex flex-col items-center justify-between py-24 px-6 animate-in fade-in duration-300">
     <div className="flex flex-col items-center gap-6 mt-10"><div className="relative"><div className="absolute inset-0 rounded-full bg-white/10 animate-pulse"></div><div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center border-4 border-white/50 shadow-2xl relative z-10"><Video className="w-14 h-14 text-white opacity-80"/></div></div><div className="text-center text-white"><h2 className="text-2xl font-bold mb-2">発信中...</h2><p className="text-sm opacity-60">相手の応答を待っています</p></div></div>
    <div className="w-full flex justify-center items-center mb-10"><button onClick={onCancel} className="flex flex-col items-center gap-3 group"><div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-all hover:bg-red-600"><X className="w-10 h-10 text-white"/></div><span className="text-white text-xs font-bold">繧ｭ繝｣繝ｳ繧ｻ繝ｫ</span></button></div>
  </div>);
const CallAcceptedOverlay = ({ callData, onJoin }) => (<div className="fixed inset-0 z-[500] bg-gray-900/90 flex flex-col items-center justify-center px-6 animate-in fade-in duration-300 backdrop-blur-sm">
    <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-white/20"><div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce"><Video className="w-10 h-10 text-green-600"/></div><h2 className="text-2xl font-bold text-gray-800 mb-2">逶ｸ謇九′蠢懃ｭ斐＠縺ｾ縺励◆</h2><p className="text-gray-500 mb-8 text-sm">荳九・繝懊ち繝ｳ繧呈款縺励※騾夊ｩｱ繧帝幕蟋九＠縺ｦ縺上□縺輔＞</p><button onClick={onJoin} className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-green-200 transform hover:scale-[1.02] flex items-center justify-center gap-2"><Video className="w-5 h-5"/>騾夊ｩｱ縺ｫ蜿ょ刈縺吶ｋ</button></div>
  </div>);
const FriendProfileModal = ({ friend, onClose, onStartChat, onTransfer, myUid, myProfile, allUsers, showNotification }) => {
    const myFriends = myProfile?.friends || [];
    const myFriendsSet = useMemo(() => new Set(myFriends), [myFriends]);
    const friendFriends = friend?.friends || [];
    const isFriend = myFriendsSet.has(friend?.uid);
    const isHidden = (myProfile?.hiddenFriends || []).includes(friend?.uid);
    const mutualCount = useMemo(() => {
        let n = 0;
        for (const uid of friendFriends) {
            if (!uid || uid === myUid)
                continue;
            if (myFriendsSet.has(uid))
                n++;
        }
        return n;
    }, [friendFriends, myFriendsSet, myUid]);
    const fofCandidateCount = useMemo(() => {
        // Friend's friends excluding me and excluding my direct friends = "蜿九□縺｡縺ｮ蜿九□縺｡蛟呵｣・
        let n = 0;
        for (const uid of friendFriends) {
            if (!uid || uid === myUid)
                continue;
            if (!myFriendsSet.has(uid))
                n++;
        }
        return n;
    }, [friendFriends, myFriendsSet, myUid]);
    const toggleHideFriend = async () => {
        if (!myUid || !friend?.uid)
            return;
        if (!isFriend)
            return;
        try {
            const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', myUid);
            if (isHidden) {
                await updateDoc(userRef, { hiddenFriends: arrayRemove(friend.uid) });
                showNotification?.("髱櫁｡ｨ遉ｺ繧定ｧ｣髯､縺励∪縺励◆");
            }
            else {
                const ok = window.confirm("この友だちを非表示にしますか？\n（友だち関係は解除されません）");
                if (!ok)
                    return;
                await updateDoc(userRef, { hiddenFriends: arrayUnion(friend.uid) });
                showNotification?.("髱櫁｡ｨ遉ｺ縺ｫ縺励∪縺励◆");
            }
            onClose?.();
        }
        catch (e) {
            console.error(e);
            showNotification?.("繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆");
        }
    };
    return (<div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in zoom-in">
      <div className="bg-white w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl relative flex flex-col items-center pb-8">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 bg-black/20 text-white p-2 rounded-full backdrop-blur-md hover:bg-black/30">
          <X className="w-6 h-6"/>
        </button>

        <div className="w-full h-48 bg-gray-200">
          <img src={friend.cover || "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80"} className="w-full h-full object-cover"/>
        </div>

        <div className="-mt-16 mb-4 relative">
          <img src={friend.avatar} className="w-32 h-32 rounded-[40px] border-[6px] border-white object-cover shadow-lg"/>
        </div>

        <h2 className="text-2xl font-bold mb-1">{friend.name}</h2>
        <p className="text-xs text-gray-400 font-mono mb-4">ID: {friend.id}</p>

        <div className="w-full px-8 mb-4 grid grid-cols-3 gap-2">
          <div className="bg-gray-50 rounded-2xl p-3 text-center border">
            <div className="text-[10px] font-bold text-gray-400">蜿九□縺｡</div>
            <div className="text-lg font-black text-gray-800">{friendFriends.length}</div>
          </div>
          <div className="bg-gray-50 rounded-2xl p-3 text-center border">
            <div className="text-[10px] font-bold text-gray-400">共通</div>
            <div className="text-lg font-black text-gray-800">{mutualCount}</div>
          </div>
          <div className="bg-gray-50 rounded-2xl p-3 text-center border">
            <div className="text-[10px] font-bold text-gray-400">蜿九□縺｡縺ｮ蜿九□縺｡</div>
            <div className="text-lg font-black text-gray-800">{fofCandidateCount}</div>
          </div>
        </div>

        <div className="w-full px-8 mb-6">
          <p className="text-center text-sm text-gray-600 bg-gray-50 py-3 px-4 rounded-2xl border">
            {friend.status || "ステータスなし"}
          </p>
        </div>

        <div className="flex gap-3 w-full px-8">
          <button onClick={() => { onStartChat?.(friend.uid); onClose?.(); }} className="flex-1 py-3 bg-green-500 text-white rounded-2xl font-bold shadow-lg shadow-green-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
            <MessageCircle className="w-5 h-5"/> 繝医・繧ｯ
          </button>

          <button onClick={onTransfer} className="flex-1 py-3 bg-yellow-500 text-white rounded-2xl font-bold shadow-lg shadow-yellow-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
            <Coins className="w-5 h-5"/> 騾・≡
          </button>
        </div>

        {isFriend && (<div className="w-full px-8 mt-3">
            <button onClick={toggleHideFriend} className={`w-full py-3 rounded-2xl font-bold border transition-colors flex items-center justify-center gap-2 ${isHidden ? 'bg-white text-gray-700 hover:bg-gray-50' : 'bg-gray-900 text-white hover:bg-black'}`}>
              {isHidden ? <Eye className="w-5 h-5"/> : <EyeOff className="w-5 h-5"/>}
              {isHidden ? "髱櫁｡ｨ遉ｺ繧定ｧ｣髯､" : "髱櫁｡ｨ遉ｺ縺ｫ縺吶ｋ"}
            </button>
          </div>)}
      </div>
    </div>);
};
const MessageItem = React.memo(({ m, user, sender, isGroup, db, appId, chatId, addFriendById, onEdit, onDelete, onPreview, onReply, onReaction, allUsers, onStickerClick, onShowProfile, onJoinCall }) => {
    const isMe = m.senderId === user.uid;
    const [mediaSrc, setMediaSrc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const isInvalidBlob = !isMe && m.content?.startsWith('blob:');
    const setBlobSrcFromBase64 = (base64Data, mimeType) => {
        try {
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++)
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            setMediaSrc(URL.createObjectURL(blob));
        }
        catch (e) {
            console.error("Blob creation failed", e);
        }
    };
    useEffect(() => {
        if (isMe && m.content?.startsWith('blob:')) {
            setMediaSrc(m.content);
            return;
        }
        return () => { if (mediaSrc && mediaSrc.startsWith('blob:') && !isMe)
            URL.revokeObjectURL(mediaSrc); };
    }, [isMe, m.content]);
    useEffect(() => {
        if (isMe && m.content?.startsWith('blob:'))
            return;
        if (m.hasChunks) {
            if (mediaSrc && !mediaSrc.startsWith('blob:') && mediaSrc !== m.preview)
                return;
            setLoading(true);
            (async () => {
                try {
                    let base64Data = "";
                    if (m.chunkCount) {
                        const chunkPromises = [];
                        for (let i = 0; i < m.chunkCount; i++)
                            chunkPromises.push(getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages', m.id, 'chunks', `${i}`)));
                        const chunkDocs = await Promise.all(chunkPromises);
                        chunkDocs.forEach(d => { if (d.exists())
                            base64Data += d.data().data; });
                    }
                    else {
                        const snap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages', m.id, 'chunks'), orderBy('index', 'asc')));
                        snap.forEach(d => base64Data += d.data().data);
                    }
                    if (base64Data) {
                        let mimeType = m.mimeType;
                        if (!mimeType) {
                            if (m.type === 'video')
                                mimeType = 'video/mp4';
                            else if (m.type === 'image')
                                mimeType = 'image/jpeg';
                            else if (m.type === 'audio')
                                mimeType = 'audio/webm';
                            else
                                mimeType = 'application/octet-stream';
                        }
                        if (m.type !== 'text' && m.type !== 'contact')
                            setBlobSrcFromBase64(base64Data, mimeType);
                    }
                    else if (m.preview) {
                        setMediaSrc(m.preview);
                    }
                }
                catch (e) {
                    console.error("Failed to load chunks", e);
                    if (m.preview)
                        setMediaSrc(m.preview);
                }
                finally {
                    setLoading(false);
                }
            })();
        }
        else {
            if (isInvalidBlob) {
                setMediaSrc(m.preview);
            }
            else {
                setMediaSrc(m.content || m.preview);
            }
        }
    }, [m.id, chatId, m.content, m.hasChunks, isMe, isInvalidBlob, m.preview, m.type, m.mimeType, m.chunkCount]);
    const handleDownload = async () => {
        if (m.content && m.content.startsWith('blob:')) {
            const a = document.createElement('a');
            a.href = m.content;
            a.download = m.fileName || 'download_file';
            a.click();
            return;
        }
        setLoading(true);
        try {
            let dataUrl = mediaSrc;
            if (!dataUrl && m.hasChunks) {
                let base64Data = "";
                if (m.chunkCount) {
                    const chunkPromises = [];
                    for (let i = 0; i < m.chunkCount; i++)
                        chunkPromises.push(getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages', m.id, 'chunks', `${i}`)));
                    const chunkDocs = await Promise.all(chunkPromises);
                    chunkDocs.forEach(d => { if (d.exists())
                        base64Data += d.data().data; });
                }
                else {
                    const snap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatId, 'messages', m.id, 'chunks'), orderBy('index', 'asc')));
                    snap.forEach(d => base64Data += d.data().data);
                }
                if (base64Data) {
                    const mimeType = m.mimeType || 'application/octet-stream';
                    const byteCharacters = atob(base64Data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++)
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
                    dataUrl = URL.createObjectURL(blob);
                }
            }
            else if (!dataUrl) {
                dataUrl = m.content;
            }
            if (dataUrl) {
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = m.fileName || 'download_file';
                a.click();
            }
        }
        catch (e) {
            console.error("Download failed", e);
        }
        finally {
            setLoading(false);
        }
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
        if (!text)
            return "";
        const regex = /(https?:\/\/[^\s]+)|(@[^\s]+)/g;
        const parts = text.split(regex);
        return parts.map((part, i) => {
            if (!part)
                return null;
            if (part.match(/^https?:\/\//))
                return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all" onClick={(e) => e.stopPropagation()}>{part}</a>;
            if (part.startsWith('@')) {
                const name = part.substring(1);
                const mentionedUser = allUsers.find((u) => u.name === name);
                if (mentionedUser)
                    return <span key={i} className="text-blue-500 font-bold cursor-pointer hover:underline bg-blue-50 px-1 rounded" onClick={(e) => { e.stopPropagation(); onShowProfile && onShowProfile(mentionedUser); }}>{part}</span>;
            }
            return part;
        });
    };
    const getUserNames = (uids) => { if (!uids || !allUsers)
        return ""; return uids.map(uid => { const u = allUsers.find((user) => user.uid === uid); return u ? u.name : "荳肴・縺ｪ繝ｦ繝ｼ繧ｶ繝ｼ"; }).join(", "); };
    return (<div className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2 relative group mb-4`}>
        {!isMe && (<div className="relative mt-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); onShowProfile && onShowProfile(sender); }}><img key={sender?.avatar} src={sender?.avatar} className="w-8 h-8 rounded-lg object-cover border" loading="lazy"/>{isTodayBirthday(sender?.birthday) && <span className="absolute -top-1 -right-1 text-[8px]">獅</span>}</div>)}
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
          {!isMe && isGroup && <div className="text-[10px] text-gray-600 font-bold mb-1 ml-1 cursor-pointer hover:underline" onClick={() => onShowProfile && onShowProfile(sender)}>{sender?.name}</div>}
          <div className="relative">
             <div onClick={handleBubbleClick} className={`p-2 px-3 rounded-2xl text-[13px] shadow-sm relative cursor-pointer ${m.type === 'sticker' ? 'bg-transparent shadow-none p-0' : (isMe ? 'bg-[#7cfc00] rounded-tr-none' : 'bg-white rounded-tl-none')} ${['image', 'video', 'call_invite'].includes(m.type) ? 'p-0 bg-transparent shadow-none' : ''}`}>
              {m.replyTo && m.type !== 'sticker' && (<div className={`mb-2 p-2 rounded-lg border-l-4 text-xs opacity-70 ${isMe ? 'bg-black/5 border-white/50' : 'bg-gray-100 border-gray-300'}`}><div className="font-bold text-[10px] mb-0.5">{m.replyTo.senderName}</div><div className="truncate flex items-center gap-1">{m.replyTo.type === 'image' && <ImageIcon className="w-3 h-3"/>}{m.replyTo.type === 'video' && <Video className="w-3 h-3"/>}{['image', 'video'].includes(m.replyTo.type) ? (m.replyTo.type === 'image' ? '[逕ｻ蜒従' : '[蜍慕判]') : (m.replyTo.content || '[繝｡繝・そ繝ｼ繧ｸ]')}</div></div>)}
              {m.type === 'text' && <div className="whitespace-pre-wrap">{renderContent(m.content)}{m.isEdited && <div className="text-[9px] text-black/40 text-right mt-1 font-bold">(邱ｨ髮・ｸ・</div>}</div>}
              {m.type === 'call_invite' && (<div className="bg-white border rounded-2xl p-4 w-64 shadow-sm flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center animate-pulse">
                          {m.callType === 'video' ? <Video className="w-6 h-6 text-green-600"/> : <Phone className="w-6 h-6 text-green-600"/>}
                      </div>
                      <div className="font-bold text-center">
                          {m.callType === 'video' ? '繝薙ョ繧ｪ騾夊ｩｱ' : '髻ｳ螢ｰ騾夊ｩｱ'}繧帝幕蟋九＠縺ｾ縺励◆
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); onJoinCall(m.callType === 'video', m.senderId); }} className="w-full bg-green-500 text-white font-bold py-2 rounded-xl shadow mt-2 hover:bg-green-600 transition-colors">
                          蜿ょ刈縺吶ｋ
                      </button>
                  </div>)}
              {m.type === 'sticker' && (<div className="relative group/sticker" onClick={handleStickerClick}>
                    <img src={m.content || ""} className="w-32 h-32 object-contain drop-shadow-sm hover:scale-105 transition-transform"/>
                    {m.audio && <div className="absolute bottom-0 right-0 bg-black/20 text-white rounded-full p-1"><Volume2 className="w-3 h-3"/></div>}
                  </div>)}
              {(m.type === 'image' || m.type === 'video') && (<div className="relative">{isShowingPreview && !finalSrc ? (<div className="p-4 bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 min-w-[150px] min-h-[100px] border border-gray-200"><Loader2 className="animate-spin w-8 h-8 text-green-500"/><span className="text-[10px] text-gray-500 font-bold">{m.type === 'video' ? '蜍慕判繧貞女菫｡荳ｭ...' : '逕ｻ蜒上ｒ蜿嶺ｿ｡荳ｭ...'}</span></div>) : (<div className="relative">{m.type === 'video' ? (<video src={finalSrc || ""} className={`max-w-full rounded-xl border border-white/50 shadow-md bg-black ${showMenu ? 'brightness-50 transition-all' : ''}`} controls playsInline preload="metadata"/>) : (<img src={finalSrc || ""} className={`max-w-full rounded-xl border border-white/50 shadow-md ${showMenu ? 'brightness-50 transition-all' : ''} ${isShowingPreview ? 'opacity-80 blur-[1px]' : ''}`} loading="lazy"/>)}{m.type === 'video' && !isShowingPreview && !finalSrc && (<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"><div className="bg-black/30 rounded-full p-2 backdrop-blur-sm"><Play className="w-8 h-8 text-white fill-white opacity-90"/></div></div>)}{isShowingPreview && (<div className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> {isInvalidBlob ? "騾∽ｿ｡荳ｭ..." : "蜿嶺ｿ｡荳ｭ..."}</div>)}</div>)}{isMe && m.isUploading && <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm">騾∽ｿ｡荳ｭ...</div>}</div>)}
              {m.type === 'audio' && (<div className="flex items-center gap-2 py-1 px-1">{loading ? (<Loader2 className="animate-spin w-4 h-4 text-gray-400"/>) : (<audio src={mediaSrc || ""} controls className="h-8 max-w-[200px]"/>)}</div>)}
              {m.type === 'file' && (<div className="flex items-center gap-3 p-2 min-w-[200px]"><div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 border"><FileText className="w-6 h-6 text-gray-500"/></div><div className="flex-1 min-w-0"><div className="text-sm font-bold truncate">{m.fileName || '荳肴・縺ｪ繝輔ぃ繧､繝ｫ'}</div><div className="text-[10px] text-gray-400">{m.fileSize ? `${(m.fileSize / 1024).toFixed(1)} KB` : '繧ｵ繧､繧ｺ荳肴・'}</div></div><button onClick={(e) => { e.stopPropagation(); handleDownload(); }} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin text-gray-500"/> : <Download className="w-4 h-4 text-gray-600"/>}</button></div>)}
              {m.type === 'contact' && (<div className="flex flex-col gap-2 min-w-[150px] p-1"><div className="text-[10px] font-bold text-gray-400 mb-1 border-b border-gray-100 pb-1">連絡先</div><div className="flex items-center gap-3"><img src={m.contactAvatar} className="w-10 h-10 rounded-full border shadow-sm" loading="lazy"/><span className="font-bold text-sm truncate">{m.contactName}</span></div>{!isMe && <button onClick={(e) => { e.stopPropagation(); addFriendById(m.contactId); }} className="bg-black/5 hover:bg-black/10 text-xs font-bold py-2 rounded-xl mt-1 w-full flex items-center justify-center gap-2"><UserPlus className="w-3 h-3"/> 友だち追加</button>}</div>)}
              <div className={`text-[8px] opacity-50 mt-1 text-right ${m.type === 'sticker' ? 'text-gray-500 font-bold bg-white/50 px-1 rounded' : ''}`}>{formatDateTime(m.createdAt)}</div>
              {showMenu && (<div className={`absolute top-full ${isMe ? 'right-0' : 'left-0'} mt-1 z-[100] flex flex-col bg-white rounded-xl shadow-2xl border overflow-hidden min-w-[180px] animate-in slide-in-from-top-2 duration-200`}><div className="flex justify-between items-center p-2 bg-gray-50 border-b gap-1 overflow-x-auto scrollbar-hide">{REACTION_EMOJIS.map(emoji => (<button key={emoji} onClick={(e) => { e.stopPropagation(); onReaction(m.id, emoji); setShowMenu(false); }} className="hover:scale-125 transition-transform text-lg p-1">{emoji}</button>))}</div><button onClick={(e) => { e.stopPropagation(); onReply(m); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left"><Reply className="w-4 h-4"/>リプライ</button>{(m.type === 'image' || m.type === 'video') && (<button onClick={(e) => { e.stopPropagation(); onPreview(finalSrc, m.type); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"><Maximize className="w-4 h-4"/>拡大表示</button>)}{m.type === 'file' && (<button onClick={(e) => { e.stopPropagation(); handleDownload(); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"><Download className="w-4 h-4"/>保存</button>)}{m.type === 'text' && isMe && (<button onClick={(e) => { e.stopPropagation(); onEdit(m.id, m.content); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-xs font-bold text-gray-700 text-left border-t border-gray-100"><Edit2 className="w-4 h-4"/>編集</button>)}{isMe && (<button onClick={(e) => { e.stopPropagation(); onDelete(m.id); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 text-xs font-bold text-red-500 text-left border-t border-gray-100"><Trash2 className="w-4 h-4"/>送信取消</button>)}</div>)}
            </div>
          </div>
          {m.reactions && Object.keys(m.reactions).some(k => m.reactions[k]?.length > 0) && (<div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>{Object.entries(m.reactions).map(([emoji, uids]) => uids?.length > 0 && (<button key={emoji} onClick={() => onReaction(m.id, emoji)} title={getUserNames(uids)} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs shadow-sm border transition-all hover:scale-105 active:scale-95 ${uids.includes(user.uid) ? 'bg-white border-green-500 text-green-600 ring-1 ring-green-100' : 'bg-white border-gray-100 text-gray-600'}`}><span className="text-sm">{emoji}</span><span className="font-bold text-[10px]">{uids.length}</span></button>))}</div>)}
          {isMe && readCount > 0 && (<div className="text-[10px] font-bold text-green-600 mt-0.5">譌｢隱ｭ {isGroup ? readCount : ''}</div>)}
        </div>
      </div>);
});
const PostItem = ({ post, user, allUsers, db, appId, profile }) => {
    const [commentText, setCommentText] = useState(''), [mediaSrc, setMediaSrc] = useState(post.media), [isLoadingMedia, setIsLoadingMedia] = useState(false);
    const u = allUsers.find((x) => x.uid === post.userId), isLiked = post.likes?.includes(user?.uid);
    // Fixed: Defined isMe
    const isMe = post.userId === user.uid;
    useEffect(() => {
        if (post.hasChunks && !mediaSrc) {
            setIsLoadingMedia(true);
            (async () => {
                let base64Data = "";
                if (post.chunkCount) {
                    const chunkPromises = [];
                    for (let i = 0; i < post.chunkCount; i++)
                        chunkPromises.push(getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id, 'chunks', `${i}`)));
                    const chunkDocs = await Promise.all(chunkPromises);
                    chunkDocs.forEach(d => { if (d.exists())
                        base64Data += d.data().data; });
                }
                else {
                    const snap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'posts', post.id, 'chunks'), orderBy('index', 'asc')));
                    snap.forEach(d => base64Data += d.data().data);
                }
                if (base64Data) {
                    try {
                        const mimeType = post.mimeType || (post.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
                        const byteCharacters = atob(base64Data);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++)
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
                        setMediaSrc(URL.createObjectURL(blob));
                    }
                    catch (e) {
                        console.error("Post media load error", e);
                    }
                }
                setIsLoadingMedia(false);
            })();
        }
    }, [post.id, post.chunkCount]);
    // Updated Cleanup Effect
    useEffect(() => { return () => { if (mediaSrc && mediaSrc.startsWith('blob:') && !isMe)
        URL.revokeObjectURL(mediaSrc); }; }, [mediaSrc, isMe]);
    const toggleLike = async () => await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id), { likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) });
    const submitComment = async () => { if (!commentText.trim())
        return; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', post.id), { comments: arrayUnion({ userId: user.uid, userName: profile.name, text: commentText, createdAt: new Date().toISOString() }) }); setCommentText(''); };
    return (<div className="bg-white p-4 mb-2 border-b">
        <div className="flex items-center gap-3 mb-3"><div className="relative"><img key={u?.avatar} src={u?.avatar} className="w-10 h-10 rounded-xl border" loading="lazy"/>{isTodayBirthday(u?.birthday) && <span className="absolute -top-1 -right-1 text-xs">獅</span>}</div><div className="font-bold text-sm">{u?.name}</div></div>
        <div className="text-sm mb-3 whitespace-pre-wrap">{post.content}</div>
        {(mediaSrc || isLoadingMedia) && <div className="mb-3 bg-gray-50 rounded-2xl flex items-center justify-center min-h-[100px]">{isLoadingMedia ? <Loader2 className="animate-spin w-5 h-5"/> : post.mediaType === 'video' ? <video src={mediaSrc || ""} className="w-full rounded-2xl max-h-96 bg-black" controls playsInline/> : <img src={mediaSrc || ""} className="w-full rounded-2xl max-h-96 object-cover" loading="lazy"/>}</div>}
        <div className="flex items-center gap-6 py-2 border-y mb-3"><button onClick={toggleLike} className="flex items-center gap-1.5"><Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}/><span className="text-xs">{post.likes?.length || 0}</span></button><div className="flex items-center gap-1.5 text-gray-400"><MessageCircle className="w-5 h-5"/><span className="text-xs">{post.comments?.length || 0}</span></div></div>
        <div className="space-y-3 mb-4">{post.comments?.map((c, i) => <div key={i} className="bg-gray-50 rounded-2xl px-3 py-2"><div className="text-[10px] font-bold text-gray-500">{c.userName}</div><div className="text-xs">{c.text}</div></div>)}</div>
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1"><input className="flex-1 bg-transparent text-xs py-2 outline-none" placeholder="繧ｳ繝｡繝ｳ繝・.." value={commentText} onChange={e => setCommentText(e.target.value)} onKeyPress={e => e.key === 'Enter' && submitComment()}/><button onClick={submitComment} className="text-green-500"><Send className="w-4 h-4"/></button></div>
      </div>);
};
const GroupCreateView = ({ user, profile, allUsers, setView, showNotification }) => {
    const [groupName, setGroupName] = useState('');
    const [groupIcon, setGroupIcon] = useState("https://api.dicebear.com/7.x/shapes/svg?seed=group");
    const [selectedMembers, setSelectedMembers] = useState([]);
    const friendsList = allUsers.filter((u) => profile?.friends?.includes(u.uid));
    const toggleMember = (uid) => { setSelectedMembers(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]); };
    const handleCreate = async () => {
        if (profile?.isBanned)
            return showNotification("繧｢繧ｫ繧ｦ繝ｳ繝医′蛻ｩ逕ｨ蛛懈ｭ｢縺輔ｌ縺ｦ縺・∪縺・圻");
        if (!groupName.trim())
            return showNotification("繧ｰ繝ｫ繝ｼ繝怜錐繧貞・蜉帙＠縺ｦ縺上□縺輔＞");
        if (selectedMembers.length === 0)
            return showNotification("繝｡繝ｳ繝舌・繧帝∈謚槭＠縺ｦ縺上□縺輔＞");
        const participants = [user.uid, ...selectedMembers];
        const newGroupChat = { name: groupName, icon: groupIcon, participants, isGroup: true, createdBy: user.uid, updatedAt: serverTimestamp(), lastMessage: { content: "繧ｰ繝ｫ繝ｼ繝励ｒ菴懈・縺励∪縺励◆", senderId: user.uid } };
        try {
            const chatRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats'), newGroupChat);
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', chatRef.id, 'messages'), { senderId: user.uid, content: `${profile.name}がグループを作成しました。`, type: 'text', createdAt: serverTimestamp(), readBy: [user.uid] });
            showNotification("繧ｰ繝ｫ繝ｼ繝励ｒ菴懈・縺励∪縺励◆");
            setView('home');
        }
        catch (err) {
            showNotification("菴懈・縺ｫ螟ｱ謨励＠縺ｾ縺励◆");
        }
    };
    return (<div className="flex flex-col h-full bg-white">
        <div className="p-4 flex items-center gap-4 bg-white border-b sticky top-0 z-10"><ChevronLeft className="w-6 h-6 cursor-pointer" onClick={() => setView('home')}/><span className="font-bold flex-1">繧ｰ繝ｫ繝ｼ繝嶺ｽ懈・</span><button onClick={handleCreate} className="text-green-500 font-bold text-sm">菴懈・</button></div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          <div className="flex flex-col items-center gap-4"><div className="relative"><img src={groupIcon} className="w-24 h-24 rounded-3xl object-cover bg-gray-100 border shadow-sm"/><label className="absolute bottom-0 right-0 bg-green-500 p-2 rounded-full text-white cursor-pointer shadow-lg border-2 border-white"><CameraIcon className="w-4 h-4"/><input type="file" className="hidden" accept="image/*" onChange={e => handleCompressedUpload(e, (d) => setGroupIcon(d))}/></label></div><input className="w-full text-center text-lg font-bold border-b py-2 focus:outline-none focus:border-green-500" placeholder="グループ名を入力" value={groupName} onChange={e => setGroupName(e.target.value)}/></div>
          <div className="space-y-3"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">友だちを選択</h3><div className="divide-y border-y">{friendsList.map((f) => (<div key={f.uid} className="flex items-center gap-4 py-3 cursor-pointer" onClick={() => toggleMember(f.uid)}><div className="relative"><img src={f.avatar} className="w-10 h-10 rounded-xl object-cover border"/></div><span className="flex-1 font-bold text-sm">{f.name}</span><div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedMembers.includes(f.uid) ? 'bg-green-500 border-green-500' : 'border-gray-200'}`}>{selectedMembers.includes(f.uid) && <Check className="w-4 h-4 text-white"/>}</div></div>))}</div></div>
        </div>
      </div>);
};
const BirthdayCardBox = ({ user, setView }) => {
    const [myCards, setMyCards] = useState([]);
    useEffect(() => {
        if (!user)
            return;
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'birthday_cards'), where('toUserId', '==', user.uid));
        const unsub = onSnapshot(q, (snap) => {
            const cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            cards.sort((a, b) => (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0) - (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0));
            setMyCards(cards);
        });
        return () => unsub();
    }, [user]);
    const getColorClass = (color) => { switch (color) {
        case 'pink': return 'bg-pink-100 border-pink-200 text-pink-800';
        case 'blue': return 'bg-blue-100 border-blue-200 text-blue-800';
        case 'yellow': return 'bg-yellow-100 border-yellow-200 text-yellow-800';
        case 'green': return 'bg-green-100 border-green-200 text-green-800';
        default: return 'bg-white border-gray-200';
    } };
    return (<div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b flex items-center gap-4 sticky top-0 bg-white z-10 shrink-0"><ChevronLeft className="w-6 h-6 cursor-pointer" onClick={() => setView('home')}/><h1 className="text-xl font-bold flex items-center gap-2"><Gift className="w-6 h-6 text-pink-500"/> 繧ｫ繝ｼ繝隠OX</h1></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-gray-50">{myCards.length === 0 ? <div className="text-center py-20 text-gray-400 font-bold">繧ｫ繝ｼ繝峨・縺ｾ縺縺ゅｊ縺ｾ縺帙ｓ</div> : myCards.map(card => (<div key={card.id} className={`p-6 rounded-3xl border-2 shadow-sm relative ${getColorClass(card.color)}`}><div className="absolute top-4 right-4 text-4xl opacity-50">獅</div><div className="font-bold text-lg mb-2">Happy Birthday!</div><div className="whitespace-pre-wrap text-sm font-medium mb-4">{card.message}</div><div className="flex items-center justify-between mt-4 pt-4 border-t border-black/10"><div className="text-xs font-bold opacity-70">From: {card.fromName}</div><div className="text-[10px] opacity-60">{formatDate(card.createdAt)}</div></div></div>))}</div>
      </div>);
};
const StickerEditor = ({ user, profile, onClose, showNotification }) => {
    const [packName, setPackName] = useState('');
    const [packDescription, setPackDescription] = useState('');
    const [createdStickers, setCreatedStickers] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setCreatedStickers((prev) => {
                if (prev.length >= 8) {
                    showNotification("1パック最大8個までです");
                    return prev;
                }
                return [...prev, { image: ev.target.result, audio: null }];
            });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const removeSticker = (idx) => {
        setCreatedStickers((prev) => prev.filter((_, i) => i !== idx));
    };

    const submitPack = async () => {
        if (profile?.isBanned) return showNotification("アカウントが利用停止されています 🚫");
        if (!packName.trim()) return showNotification("パック名を入力してください");
        if (createdStickers.length === 0) return showNotification("スタンプがありません");
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sticker_packs'), {
                authorId: user.uid,
                authorName: profile?.name || user.displayName || 'Creator',
                name: packName,
                description: packDescription,
                stickers: createdStickers,
                price: 100,
                status: 'pending',
                purchasedBy: [],
                createdAt: serverTimestamp()
            });
            showNotification("申請しました！承認されると報酬がもらえます");
            onClose();
        } catch (e) {
            console.error(e);
            showNotification("エラーが発生しました");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b flex items-center justify-between"><button onClick={onClose}><ChevronLeft className="w-6 h-6"/></button><h2 className="font-bold">スタンプ作成スタジオ</h2><div className="w-6"></div></div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center gap-4">
                <div className="w-full max-w-xs space-y-2">
                    <div><label className="text-xs font-bold text-gray-500 mb-1">パック名</label><input className="w-full border p-2 rounded-xl" placeholder="例: 面白うさぎセット" value={packName} onChange={e => setPackName(e.target.value)} /></div>
                    <div><label className="text-xs font-bold text-gray-500 mb-1">説明文</label><input className="w-full border p-2 rounded-xl" placeholder="どんなスタンプですか？" value={packDescription} onChange={e => setPackDescription(e.target.value)} /></div>
                </div>
                <label className="w-full max-w-xs border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer hover:bg-gray-50">
                    <Upload className="w-6 h-6 mx-auto mb-2 text-gray-500"/>
                    <div className="text-sm font-bold text-gray-600">画像を追加</div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
                {createdStickers.length > 0 && (
                    <div className="w-full max-w-xs">
                        <div className="text-xs font-bold text-gray-400 mb-2">作成済みリスト ({createdStickers.length}/8)</div>
                        <div className="grid grid-cols-4 gap-2">
                            {createdStickers.map((s, i) => (
                                <button key={i} onClick={() => removeSticker(i)} className="relative border rounded bg-gray-50">
                                    <img src={s.image} className="w-full aspect-square object-contain" />
                                    <span className="absolute top-0 right-0 text-[10px] bg-black/60 text-white px-1 rounded-bl">×</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="w-full h-10"></div>
            </div>
            <div className="p-4 border-t bg-white"><button onClick={submitPack} disabled={createdStickers.length === 0 || isSubmitting} className="w-full py-4 bg-green-500 text-white font-bold rounded-2xl shadow-xl disabled:bg-gray-300">{isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mx-auto"/> : '販売申請する (報酬は承認後)'}</button></div>
        </div>
    );
};
const StickerStoreView = ({ user, setView, showNotification, profile }) => {
    const [packs, setPacks] = useState([]);
    const [purchasing, setPurchasing] = useState(null);

    useEffect(() => {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'sticker_packs'), where('status', '==', 'approved'));
        const unsub = onSnapshot(q, (snap) => {
            const fetchedPacks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            fetchedPacks.sort((a, b) => {
                const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds * 1000 || 0);
                const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds * 1000 || 0);
                return tB - tA;
            });
            setPacks(fetchedPacks);
        });
        return () => unsub();
    }, []);

    const handleBuy = async (pack) => {
        if (profile?.isBanned) return showNotification("アカウントが利用停止されています 🚫");
        if ((profile.wallet || 0) < pack.price) return showNotification("コインが足りません");
        if (pack.purchasedBy?.includes(user.uid) || pack.authorId === user.uid) return showNotification("既に入手済みです");
        setPurchasing(pack.id);
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { wallet: increment(-pack.price) });
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', pack.authorId), { wallet: increment(pack.price) });
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sticker_packs', pack.id), { purchasedBy: arrayUnion(user.uid) });
            showNotification("購入しました！");
        } catch (e) {
            console.error(e);
            showNotification("購入に失敗しました");
        } finally {
            setPurchasing(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2"><ChevronLeft className="w-6 h-6 cursor-pointer" onClick={() => setView('home')} /><h1 className="font-bold text-lg">スタンプショップ</h1></div>
                <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full"><Coins className="w-4 h-4 text-yellow-600"/><span className="font-bold text-yellow-700">{profile?.wallet || 0}</span></div>
            </div>
            <div className="flex border-b">
                <button onClick={() => setView('sticker-create')} className="flex-1 py-3 text-sm font-bold text-blue-500 bg-blue-50">つくる (+100)</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {packs.length === 0 && <div className="text-center py-10 text-gray-400">スタンプがありません</div>}
                {packs.map((pack) => {
                    const isOwned = pack.purchasedBy?.includes(user.uid) || pack.authorId === user.uid;
                    return (
                        <div key={pack.id} className="border rounded-2xl p-4 shadow-sm bg-white">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg">{pack.name}</h3>
                                    <p className="text-xs text-gray-500 font-bold mb-1">作: {pack.authorName || '不明'}</p>
                                    {pack.description && <p className="text-xs text-gray-400 bg-gray-50 p-2 rounded-lg mb-2">{pack.description}</p>}
                                </div>
                                {!isOwned && <button onClick={() => handleBuy(pack)} disabled={purchasing === pack.id} className="bg-green-500 text-white px-4 py-2 rounded-full font-bold text-xs shadow-md hover:bg-green-600 disabled:bg-gray-300 shrink-0 ml-2">{purchasing === pack.id ? <Loader2 className="w-4 h-4 animate-spin"/> : `¥${pack.price}`}</button>}
                                {isOwned && <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold shrink-0 ml-2">入手済み</span>}
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {(pack.stickers || []).map((s, i) => (<img key={i} src={typeof s === 'string' ? s : s.image} className="w-20 h-20 object-contain bg-gray-50 rounded-lg border"/>))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
const ChatRoomView = ({ user, profile, allUsers, chats, activeChatId, setActiveChatId, setView, mutedChats, toggleMuteChat, showNotification }) => {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const scrollRef = useRef(null);

    const chatData = chats.find((c) => c.id === activeChatId);
    const isGroup = chatData?.isGroup || false;
    const partnerId = !isGroup ? chatData?.participants?.find((p) => p !== user.uid) : null;
    const partnerData = partnerId ? allUsers.find((u) => u.uid === partnerId) : null;
    const title = !isGroup && partnerData ? partnerData.name : (chatData?.name || 'トーク');
    const icon = !isGroup && partnerData ? partnerData.avatar : (chatData?.icon || profile?.avatar);

    useEffect(() => {
        if (!activeChatId) return;
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages'), orderBy('createdAt', 'asc'), limitToLast(80));
        const unsub = onSnapshot(q, (snap) => {
            setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'auto' }), 0);
        });
        return () => unsub();
    }, [activeChatId]);

    const sendText = async () => {
        if (!text.trim() || !activeChatId) return;
        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId, 'messages'), {
                senderId: user.uid,
                content: text,
                type: 'text',
                createdAt: serverTimestamp(),
                readBy: [user.uid]
            });
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChatId), {
                lastMessage: { content: text, senderId: user.uid, readBy: [user.uid] },
                updatedAt: serverTimestamp()
            });
            setText('');
        } catch (e) {
            console.error(e);
            showNotification("送信に失敗しました");
        }
    };

    if (!chatData) {
        return <div className="h-full flex items-center justify-center bg-white"><Loader2 className="w-8 h-8 animate-spin text-gray-400"/></div>;
    }

    return (
      <div className="flex flex-col h-full bg-[#8fb2c9]">
        <div className="p-3 bg-white/95 backdrop-blur border-b flex items-center gap-3 sticky top-0 z-10 shadow-sm">
          <ChevronLeft className="w-6 h-6 cursor-pointer" onClick={() => setView('home')} />
          <img src={icon} className="w-10 h-10 rounded-xl object-cover border" />
          <div className="font-bold text-sm flex-1 truncate">{title}</div>
          <button onClick={() => toggleMuteChat(activeChatId)}>{mutedChats.includes(activeChatId) ? <BellOff className="w-6 h-6 text-gray-400" /> : <Bell className="w-6 h-6 text-gray-600" />}</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((m) => {
            const isMe = m.senderId === user.uid;
            const sender = allUsers.find((u) => u.uid === m.senderId);
            return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow ${isMe ? 'bg-[#7cfc00]' : 'bg-white'}`}>
                        {!isMe && isGroup && <div className="text-[10px] text-gray-500 font-bold mb-1">{sender?.name || 'User'}</div>}
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    </div>
                </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        <div className="p-3 bg-white border-t flex items-center gap-2">
          <input className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 text-sm focus:outline-none" placeholder="メッセージを入力" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendText()} />
          <button onClick={sendText} className={`p-2 rounded-full ${text.trim() ? 'text-green-500' : 'text-gray-300'}`}><Send className="w-6 h-6"/></button>
        </div>
      </div>
    );
};
const VoomView = ({ user, allUsers, profile, posts, showNotification }) => {
    const [content, setContent] = useState('');

    const postMessage = async () => {
        if (profile?.isBanned) return showNotification("アカウントが利用停止されています 🚫");
        if (!content.trim()) return;
        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), {
                userId: user.uid,
                content,
                media: null,
                mediaType: 'image',
                likes: [],
                comments: [],
                createdAt: serverTimestamp()
            });
            setContent('');
            showNotification("投稿しました");
        } catch (e) {
            console.error(e);
            showNotification("投稿に失敗しました");
        }
    };

    return (
      <div className="flex flex-col h-full bg-gray-50">
        <div className="bg-white p-4 border-b shrink-0"><h1 className="text-xl font-bold">VOOM</h1></div>
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
          <div className="bg-white p-4 mb-2">
            <textarea className="w-full text-sm outline-none resize-none min-h-[60px]" placeholder="何をしていますか？" value={content} onChange={e => setContent(e.target.value)} />
            <div className="flex justify-end items-center pt-2 border-t mt-2"><button onClick={postMessage} disabled={!content.trim()} className={`text-xs font-bold px-4 py-2 rounded-full ${content.trim() ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>投稿</button></div>
          </div>
          {(posts || []).map((p) => <PostItem key={p.id} post={p} user={user} allUsers={allUsers} db={db} appId={appId} profile={profile} />)}
        </div>
      </div>
    );
};
const ProfileEditView = ({ user, profile, setView, showNotification, copyToClipboard }) => {
    const [edit, setEdit] = useState(profile || {});
    useEffect(() => { if (profile)
        setEdit(prev => (!prev || Object.keys(prev).length === 0) ? { ...profile } : { ...profile, name: prev.name, id: prev.id, status: prev.status, birthday: prev.birthday, avatar: prev.avatar, cover: prev.cover }); }, [profile]);
    const handleSave = () => { updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), edit); showNotification("保存しました ✅"); };
    return (<div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b flex items-center gap-4 sticky top-0 bg-white shrink-0"><ChevronLeft className="w-6 h-6 cursor-pointer" onClick={() => setView('home')}/><span className="font-bold">設定</span></div>
        <div className="flex-1 overflow-y-auto pb-8">
          <div className="w-full h-48 relative bg-gray-200"><img src={edit.cover} className="w-full h-full object-cover"/><label className="absolute inset-0 flex items-center justify-center bg-black/20 text-white font-bold cursor-pointer opacity-0 hover:opacity-100 transition-opacity">閭梧勹螟画峩<input type="file" className="hidden" accept="image/*" onChange={e => handleCompressedUpload(e, (d) => setEdit({ ...edit, cover: d }))}/></label></div>
          <div className="px-8 -mt-12 flex flex-col items-center gap-6">
            <div className="relative"><img src={edit.avatar} className="w-24 h-24 rounded-3xl border-4 border-white object-cover"/><label className="absolute bottom-0 right-0 bg-green-500 p-2 rounded-full text-white cursor-pointer"><CameraIcon className="w-4 h-4"/><input type="file" className="hidden" accept="image/*" onChange={e => handleCompressedUpload(e, (d) => setEdit({ ...edit, avatar: d }))}/></label></div>
            <div className="w-full space-y-4">
              <div><label className="text-xs font-bold text-gray-400">蜷榊燕</label><input className="w-full border-b py-2 outline-none" value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })}/></div>
              <div><label className="text-xs font-bold text-gray-400">ID</label><div className="flex items-center gap-2 border-b py-2"><span className="flex-1 font-mono text-gray-600">{edit.id}</span><button onClick={() => copyToClipboard(edit.id)} className="p-1 hover:bg-gray-100 rounded-full"><Copy className="w-4 h-4 text-gray-500"/></button></div></div>
              <div><label className="text-xs font-bold text-gray-400">隱慕函譌･</label><input type="date" className="w-full border-b py-2 outline-none bg-transparent" value={edit.birthday || ''} onChange={e => setEdit({ ...edit, birthday: e.target.value })}/></div>
              <div><label className="text-xs font-bold text-gray-400">縺ｲ縺ｨ縺薙→</label><input className="w-full border-b py-2 outline-none" value={edit.status || ''} onChange={e => setEdit({ ...edit, status: e.target.value })}/></div>
              <button onClick={handleSave} className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold shadow-lg">保存</button>
              <button onClick={() => signOut(auth)} className="w-full bg-gray-100 text-red-500 py-4 rounded-2xl font-bold mt-4">ログアウト</button>
            </div>
          </div>
        </div>
      </div>);
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
        }
        catch (err) {
            setScanning(false);
        }
    };
    useEffect(() => {
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject;
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
                const code = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
                if (code) {
                    if (videoRef.current.srcObject) {
                        const stream = videoRef.current.srcObject;
                        stream.getTracks().forEach(t => t.stop());
                    }
                    setScanning(false);
                    addFriendById(code.data);
                    return;
                }
            }
        }
        if (scanning)
            requestAnimationFrame(tick);
    };
    return (<div className="flex flex-col h-full bg-white"><div className="p-4 border-b flex items-center gap-4"><ChevronLeft className="w-6 h-6 cursor-pointer" onClick={() => setView('home')}/><span className="font-bold">QR</span></div><div className="flex-1 overflow-y-auto p-8"><div className="flex flex-col items-center justify-center gap-8 min-h-full">{scanning ? <div className="relative w-64 h-64 border-4 border-green-500 rounded-3xl overflow-hidden"><video ref={videoRef} className="w-full h-full object-cover"/><canvas ref={canvasRef} className="hidden"/></div> : <div className="bg-white p-6 rounded-[40px] shadow-xl border"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${user?.uid}`} className="w-48 h-48"/></div>}<div className="grid grid-cols-2 gap-4 w-full"><button onClick={startScanner} className="flex flex-col items-center gap-2 bg-gray-50 p-4 rounded-3xl border"><Maximize className="w-6 h-6 text-green-500"/><span>繧ｹ繧ｭ繝｣繝ｳ</span></button><label className="flex flex-col items-center gap-2 bg-gray-50 p-4 rounded-3xl border cursor-pointer"><Upload className="w-6 h-6 text-blue-500"/><span>隱ｭ霎ｼ</span><input type="file" className="hidden" accept="image/*" onChange={e => { const r = new FileReader(); r.onload = (ev) => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'), ctx = c.getContext('2d'); if (ctx) {
        c.width = img.width;
        c.height = img.height;
        ctx.drawImage(img, 0, 0);
        const code = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
        if (code)
            addFriendById(code.data);
    } }; img.src = ev.target.result; }; r.readAsDataURL(e.target.files[0]); }}/></label></div></div></div></div>);
};
const HomeView = ({ user, profile, allUsers, chats, setView, setActiveChatId, setSearchModalOpen, showNotification }) => {
  const [tab, setTab] = useState('chats');

  const myFriendUids = useMemo(() => new Set(profile?.friends || []), [profile?.friends]);
  const hiddenFriendUids = useMemo(() => new Set(profile?.hiddenFriends || []), [profile?.hiddenFriends]);

  const talkFriendUids = useMemo(() => {
    const s = new Set();
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

  const friendsListAll = useMemo(() => allUsers.filter((u) => directFriendUids.has(u.uid)), [allUsers, directFriendUids]);
  const visibleFriendsList = useMemo(() => friendsListAll.filter((u) => !hiddenFriendUids.has(u.uid)), [friendsListAll, hiddenFriendUids]);
  const hiddenFriendsList = useMemo(
    () => allUsers.filter((u) => hiddenFriendUids.has(u.uid)),
    [allUsers, hiddenFriendUids]
  );

  const visibleChats = useMemo(() => {
    const hiddenChats = new Set(profile?.hiddenChats || []);
    return (chats || []).filter((c) => !hiddenChats.has(c.id));
  }, [chats, profile?.hiddenChats]);

  const getChatDisplay = (chat) => {
    if (chat.isGroup) return { title: chat.name || 'グループ', icon: chat.icon || profile?.avatar };
    const other = (chat.participants || []).find((p) => p !== user.uid);
    const u = allUsers.find((x) => x.uid === other);
    return { title: u?.name || 'Unknown', icon: u?.avatar || profile?.avatar };
  };

  const hideFriend = async (uid) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { hiddenFriends: arrayUnion(uid) });
      showNotification('非表示にしました');
    } catch {
      showNotification('エラーが発生しました');
    }
  };

  const unhideFriend = async (uid) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { hiddenFriends: arrayRemove(uid) });
      showNotification('非表示を解除しました');
    } catch {
      showNotification('エラーが発生しました');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
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
        <button className={`flex-1 py-3 text-sm font-bold ${tab === 'friends' ? 'border-b-2 border-black' : 'text-gray-400'}`} onClick={() => setTab('friends')}>友だち</button>
        <button className={`flex-1 py-3 text-sm font-bold ${tab === 'hidden' ? 'border-b-2 border-black' : 'text-gray-400'}`} onClick={() => setTab('hidden')}>非表示</button>
        <button className={`flex-1 py-3 text-sm font-bold ${tab === 'chats' ? 'border-b-2 border-black' : 'text-gray-400'}`} onClick={() => setTab('chats')}>トーク</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer border-b" onClick={() => setView('profile')}>
          <img src={profile?.avatar} className="w-16 h-16 rounded-2xl object-cover border" />
          <div className="flex-1">
            <div className="font-bold text-lg">{profile?.name}</div>
            <div className="text-xs text-gray-400 font-mono">ID: {profile?.id}</div>
          </div>
        </div>

        {tab === 'friends' && (
          <div>
            {visibleFriendsList.length === 0 ? <div className="text-center py-10 text-gray-400">友だちがいません</div> : visibleFriendsList.map((f) => (
              <div key={f.uid} className="flex items-center gap-3 p-4 border-b">
                <img src={f.avatar} className="w-12 h-12 rounded-xl object-cover border" />
                <div className="flex-1">
                  <div className="font-bold">{f.name}</div>
                  <div className="text-xs text-gray-400">ID: {f.id}</div>
                </div>
                <button onClick={() => hideFriend(f.uid)} className="text-xs bg-gray-100 px-3 py-1 rounded-full">非表示</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'hidden' && (
          <div>
            {hiddenFriendsList.length === 0 ? <div className="text-center py-10 text-gray-400">非表示の友だちはありません</div> : hiddenFriendsList.map((f) => (
              <div key={f.uid} className="flex items-center gap-3 p-4 border-b">
                <img src={f.avatar} className="w-12 h-12 rounded-xl object-cover border" />
                <div className="flex-1">
                  <div className="font-bold">{f.name}</div>
                  <div className="text-xs text-gray-400">ID: {f.id}</div>
                </div>
                <button onClick={() => unhideFriend(f.uid)} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">解除</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'chats' && (
          <div>
            {visibleChats.length === 0 ? <div className="text-center py-10 text-gray-400">トークがありません</div> : visibleChats.map((chat) => {
              const d = getChatDisplay(chat);
              return (
                <div key={chat.id} className="flex items-center gap-3 p-4 border-b cursor-pointer hover:bg-gray-50" onClick={() => { setActiveChatId(chat.id); setView('chat'); }}>
                  <img src={d.icon} className="w-12 h-12 rounded-xl object-cover border" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{d.title}</div>
                    <div className="text-xs text-gray-400 truncate">{chat.lastMessage?.content || ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App Component ---
function App() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [view, setView] = useState('auth');
    const [activeChatId, setActiveChatId] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [chats, setChats] = useState([]);
    const [posts, setPosts] = useState([]);
    const [notification, setNotification] = useState(null);
    const [searchModalOpen, setSearchModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [mutedChats, setMutedChats] = useState(() => {
        const saved = localStorage.getItem('mutedChats');
        return saved ? JSON.parse(saved) : [];
    });
    const [activeCall, setActiveCall] = useState(null);
    const [userEffects, setUserEffects] = useState([]);
    const [activeEffect, setActiveEffect] = useState('Normal');
    const [currentChatBackground, setCurrentChatBackground] = useState(null);
    const processedMsgIds = useRef(new Set());
    const toggleMuteChat = (chatId) => {
        setMutedChats(prev => {
            const next = prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId];
            localStorage.setItem('mutedChats', JSON.stringify(next));
            return next;
        });
    };
    useEffect(() => {
        // 繝ｦ繝ｼ繧ｶ繝ｼ繧､繝ｳ繧ｿ繝ｩ繧ｯ繧ｷ繝ｧ繝ｳ譎ゅ↓AudioContext繧偵い繝ｳ繝ｭ繝・け縺吶ｋ
        const unlockAudio = () => {
            initAudioContext();
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };
        window.addEventListener('click', unlockAudio);
        window.addEventListener('touchstart', unlockAudio);
        setPersistence(auth, browserLocalPersistence);
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            if (u) {
                setUser(u);
                const docSnap = await getDoc(doc(db, "artifacts", appId, "public", "data", "users", u.uid));
                if (docSnap.exists()) {
                    setProfile(docSnap.data());
                }
                else {
                    const initialProfile = {
                        uid: u.uid, name: u.displayName || `User_${u.uid.slice(0, 4)}`, id: `user_${u.uid.slice(0, 6)}`,
                        status: "よろしくお願いします！", birthday: "", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=" + u.uid,
                        cover: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80", friends: [], hiddenFriends: [], hiddenChats: [], wallet: 1000, isBanned: false
                    };
                    await setDoc(doc(db, "artifacts", appId, "public", "data", "users", u.uid), initialProfile);
                    setProfile(initialProfile);
                }
                setView('home');
            }
            else {
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
    const showNotification = (msg) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 3000);
    };
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        showNotification("ID繧偵さ繝斐・縺励∪縺励◆");
    };
    useEffect(() => {
        if (!user) return;
        const unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), (docSnap) => {
            if (docSnap.exists()) setProfile(docSnap.data());
        });
        const unsubUsers = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'users')), (snap) => {
            setAllUsers(snap.docs.map((d) => d.data()));
        });
        const unsubEffects = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'users', user.uid, 'effects'), orderBy('createdAt', 'desc')), (snap) => {
            setUserEffects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        const unsubChats = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'chats'), where('participants', 'array-contains', user.uid)), (snap) => {
            setChats(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        const unsubPosts = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
            setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        return () => {
            unsubProfile();
            unsubUsers();
            unsubEffects();
            unsubChats();
            unsubPosts();
        };
    }, [user]);
    const addFriendById = async (targetId) => {
        if (!targetId)
            return;
        const targetUser = allUsers.find((u) => u.id === targetId || u.uid === targetId);
        if (targetUser && targetUser.uid !== user.uid) {
            if ((profile.friends || []).includes(targetUser.uid)) {
                showNotification("既に友だちです");
                return;
            }
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { friends: arrayUnion(targetUser.uid) });
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', targetUser.uid), { friends: arrayUnion(user.uid) });
            showNotification(`${targetUser.name}を追加しました`);
            setSearchModalOpen(false);
        }
        else {
            showNotification("繝ｦ繝ｼ繧ｶ繝ｼ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ");
        }
    };
    const startChatWithUser = async (targetUid) => {
        const existingChat = chats.find((c) => !c.isGroup && c.participants.includes(targetUid) && c.participants.includes(user.uid));
        if (existingChat) {
            setActiveChatId(existingChat.id);
            setView('chatroom');
        }
        else {
            const targetUser = allUsers.find((u) => u.uid === targetUid);
            const newChat = {
                name: targetUser ? targetUser.name : "Chat", icon: targetUser ? targetUser.avatar : "",
                participants: [user.uid, targetUid], isGroup: false, createdBy: user.uid, updatedAt: serverTimestamp(),
                lastMessage: { content: "繝√Ε繝・ヨ繧帝幕蟋九＠縺ｾ縺励◆", senderId: user.uid, readBy: [user.uid] }
            };
            try {
                const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'chats'), newChat);
                setActiveChatId(ref.id);
                setView('chatroom');
            }
            catch (e) {
                showNotification("繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆");
            }
        }
    };
    const cleanupCallSignaling = async (chatId) => {
        try {
            const signalingRef = doc(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "session");
            const candidatesCol = collection(db, "artifacts", appId, "public", "data", "chats", chatId, "call_signaling", "candidates", "list");
            // Delete session (ignore if missing)
            try {
                await deleteDoc(signalingRef);
            }
            catch { }
            // Delete candidates in batches (to avoid 500 limit)
            const snap = await getDocs(candidatesCol).catch(() => null);
            if (!snap)
                return;
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
        }
        catch (e) {
            console.warn("cleanupCallSignaling failed (non-fatal):", e);
        }
    };
    const startVideoCall = async (chatId, isVideo = true, isJoin = false, joinCallerId) => {
        // Check if group
        const chat = chats.find((c) => c.id === chatId);
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
                    content: '騾夊ｩｱ繧帝幕蟋九＠縺ｾ縺励◆',
                    type: 'call_invite',
                    callType: isVideo ? 'video' : 'audio',
                    createdAt: serverTimestamp(),
                    readBy: [user.uid],
                });
                // Auto join for the starter
                setActiveCall({ chatId, callData: { callerId: user.uid }, isVideo, isGroupCall: true, phase: 'inCall' });
            }
            catch (e) {
                showNotification("髢句ｧ九↓螟ｱ謨励＠縺ｾ縺励◆");
            }
        }
        else {
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
            }
            catch (e) {
                console.error(e);
                showNotification("逋ｺ菫｡縺ｫ螟ｱ謨励＠縺ｾ縺励◆");
            }
        }
    };
    useEffect(() => {
        if (!activeCall || !chats.length)
            return;
        const callChat = chats.find((c) => c.id === activeCall.chatId);
        if (callChat && callChat.backgroundImage) {
            setCurrentChatBackground(callChat.backgroundImage);
        }
        else {
            setCurrentChatBackground(null);
        }
    }, [activeCall, chats]);
    return (<div className="max-w-md mx-auto h-[100dvh] border-x bg-white flex flex-col relative overflow-hidden shadow-2xl">
      {notification && <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[300] bg-black/85 text-white px-6 py-2 rounded-full text-xs font-bold shadow-2xl animate-bounce">{notification}</div>}
      
      {!user ? (<AuthView onLogin={setUser} showNotification={showNotification}/>) : (<>
            {activeCall ? (activeCall.phase === 'incoming' ? (<IncomingCallOverlay callData={activeCall.callData} allUsers={allUsers} onDecline={async () => {
                    try {
                        await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeCall.chatId), { callStatus: deleteField() });
                        await cleanupCallSignaling(activeCall.chatId);
                    }
                    catch (e) {
                        console.error(e);
                    }
                    finally {
                        setActiveCall(null);
                    }
                }} onAccept={async () => {
                    try {
                        const nextCallData = {
                            ...(activeCall.callData || {}),
                            status: 'accepted',
                            acceptedBy: user.uid,
                            acceptedAt: Date.now(),
                        };
                        await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeCall.chatId), { callStatus: nextCallData });
                        setActiveCall({ ...activeCall, phase: 'inCall', callData: nextCallData });
                    }
                    catch (e) {
                        console.error(e);
                        showNotification("蠢懃ｭ斐↓螟ｱ謨励＠縺ｾ縺励◆");
                    }
                }}/>) : activeCall.phase === 'dialing' ? (<OutgoingCallOverlay calleeData={(() => {
                    const callChat = chats.find((c) => c.id === activeCall.chatId);
                    if (!callChat || callChat.isGroup)
                        return null;
                    const partnerId = (callChat.participants || []).find((p) => p && p !== user.uid);
                    return allUsers.find((u) => u.uid === partnerId) || null;
                })()} isVideo={activeCall.isVideo} onCancel={async () => {
                    try {
                        await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeCall.chatId), { callStatus: deleteField() });
                        await cleanupCallSignaling(activeCall.chatId);
                    }
                    catch (e) {
                        console.error(e);
                    }
                    finally {
                        setActiveCall(null);
                    }
                }}/>) : (<div className="relative w-full h-full">
                        <VideoCallView user={user} chatId={activeCall.chatId} callData={activeCall.callData} effects={userEffects} isVideoEnabled={activeCall.isVideo} activeEffect={activeEffect} backgroundUrl={currentChatBackground} onEndCall={async () => {
                    try {
                        // 1-on-1 縺ｯ縲√←縺｡繧峨′邨ゆｺ・＠縺ｦ繧・callStatus 繧呈ｶ医＠縺ｦ荳｡閠・ｵゆｺ・＆縺帙ｋ
                        if (!activeCall.isGroupCall) {
                            await updateDoc(doc(db, "artifacts", appId, "public", "data", "chats", activeCall.chatId), { callStatus: deleteField() });
                        }
                        await cleanupCallSignaling(activeCall.chatId);
                    }
                    catch (e) {
                        console.error("Failed to end call:", e);
                    }
                    finally {
                        setActiveCall(null);
                    }
                }}/>
                        {/* Effect Selector in Call */}
                        <div className="absolute bottom-24 left-0 right-0 px-4 flex gap-2 overflow-x-auto scrollbar-hide z-[1001]">
                            <button onClick={() => setActiveEffect('Normal')} className={`p-2 rounded-xl text-xs font-bold whitespace-nowrap ${activeEffect === 'Normal' ? 'bg-white text-black' : 'bg-black/50 text-white'}`}>Normal</button>
                            {/* Render User Effects (Both AI and Purchased) */}
                            {userEffects.map((ef) => (<button key={ef.id} onClick={() => setActiveEffect(ef.name)} className={`p-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1 ${activeEffect === ef.name ? 'bg-white text-black' : 'bg-black/50 text-white'}`}>
                                    <Sparkles className="w-3 h-3"/> {ef.name}
                                </button>))}
                        </div>
                    </div>)) : (<div className="flex-1 overflow-hidden relative">
                    {view === 'home' && <HomeView user={user} profile={profile} allUsers={allUsers} chats={chats} setView={setView} setActiveChatId={setActiveChatId} setSearchModalOpen={setSearchModalOpen} startChatWithUser={startChatWithUser} showNotification={showNotification}/>}
                    {view === 'voom' && <VoomView user={user} allUsers={allUsers} profile={profile} posts={posts} showNotification={showNotification} db={db} appId={appId}/>}
                    {view === 'chatroom' && <ChatRoomView user={user} profile={profile} allUsers={allUsers} chats={chats} activeChatId={activeChatId} setActiveChatId={setActiveChatId} setView={setView} db={db} appId={appId} mutedChats={mutedChats} toggleMuteChat={toggleMuteChat} showNotification={showNotification} addFriendById={addFriendById} startVideoCall={startVideoCall}/>}
                    {view === 'profile' && <ProfileEditView user={user} profile={profile} setView={setView} showNotification={showNotification} copyToClipboard={copyToClipboard}/>}
                    {view === 'qr' && <QRScannerView user={user} setView={setView} addFriendById={addFriendById}/>}
                    {view === 'group-create' && <GroupCreateView user={user} profile={profile} allUsers={allUsers} setView={setView} showNotification={showNotification}/>}
                    {view === 'birthday-cards' && <BirthdayCardBox user={user} setView={setView}/>}
                    {view === 'sticker-create' && <StickerEditor user={user} profile={profile} onClose={() => setView('sticker-store')} showNotification={showNotification}/>}
                    {view === 'sticker-store' && <StickerStoreView user={user} setView={setView} showNotification={showNotification} profile={profile} allUsers={allUsers}/>}
                </div>)}
            
            {searchModalOpen && <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/60"><div className="bg-white w-full max-w-sm rounded-[32px] p-8"><h2 className="text-xl font-bold mb-6">検索</h2><input className="w-full bg-gray-50 rounded-2xl py-4 px-6 mb-6 outline-none" placeholder="IDを入力" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/><div className="flex gap-4"><button className="flex-1 py-4 text-gray-600 font-bold" onClick={() => setSearchModalOpen(false)}>閉じる</button><button className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-bold" onClick={() => addFriendById(searchQuery)}>追加</button></div></div></div>}
            
            {user && !activeCall && ['home', 'voom'].includes(view) && (<div className="h-20 bg-white border-t flex items-center justify-around z-50 pb-4 shrink-0">
                    <div className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${view === 'home' ? 'text-green-500' : 'text-gray-400'}`} onClick={() => setView('home')}><Home className="w-6 h-6"/><span className="text-[10px] font-bold">繝帙・繝</span></div>
                    <div className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${view === 'voom' ? 'text-green-500' : 'text-gray-400'}`} onClick={() => setView('voom')}><LayoutGrid className="w-6 h-6"/><span className="text-[10px] font-bold">VOOM</span></div>
                </div>)}
          </>)}
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>);
}
export default App;








