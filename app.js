// js/app.js
// Client-side chat logic (advanced, production-ready)
// Uses Firebase v10 modular SDK

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged, getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ---------------------------
   Firebase config (आपका)
   --------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyBg22VnPqDC2AiWzgu22fs5bS0KLI0PQCQ",
  authDomain: "shreejiastro-57f1a.firebaseapp.com",
  projectId: "shreejiastro-57f1a",
  storageBucket: "shreejiastro-57f1a.appspot.com",
  messagingSenderId: "979268934814",
  appId: "1:979268934814:web:006040c31781d831f76f8f",
  measurementId: "G-HK8VYFXZEM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// enable offline persistence (best-effort)
enableIndexedDbPersistence(db).catch(err => {
  console.warn('Persistence not enabled:', err && err.message);
});

/* ---------------------------
   UI Elements
   --------------------------- */
const homeScreen = document.getElementById('home-screen');
const chatScreen = document.getElementById('chat-screen');
const enterChatBtn = document.getElementById('enterChatBtn');
const backBtn = document.getElementById('backBtn');
const chatArea = document.getElementById('chatArea');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const toastEl = document.getElementById('toast');
const loader = document.getElementById('loader');

let unsubscribe = null;
let currentUser = null;
let currentUserType = 'customer'; // 'customer' or 'admin'
let lastSentAt = 0;
const RATE_LIMIT_MS = 1200; // client-side cooldown

/* ---------------------------
   Helpers
   --------------------------- */
function showToast(msg, type = 'info', timeout = 3000) {
  toastEl.textContent = msg;
  toastEl.className = 'toast show ' + (type === 'error' ? 'error' : (type === 'success' ? 'success' : ''));
  setTimeout(() => toastEl.className = 'toast', timeout);
}
function sanitize(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"'`=\/]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'
  })[c]);
}
function uid() { return 'c_' + Math.random().toString(36).slice(2, 9); }

/* ---------------------------
   Auth: anonymous fallback + claim check
   --------------------------- */
async function ensureAuth() {
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err) {
    console.error('Anonymous sign-in failed', err);
    throw err;
  }
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    try { await signInAnonymously(auth); } catch(e){ console.warn('anon sign-in failed', e); }
  } else {
    try {
      const tokenRes = await getIdTokenResult(user, true);
      if (tokenRes && tokenRes.claims && tokenRes.claims.admin === true) {
        currentUserType = 'admin';
        document.getElementById('chatTitle').innerText = 'Admin Panel';
      } else {
        currentUserType = 'customer';
        document.getElementById('chatTitle').innerText = 'श्रीजी महाराज';
      }
    } catch (e) {
      console.warn('Token/claims check failed', e);
      currentUserType = 'customer';
    }
  }
});

/* ---------------------------
   Screen switching & listeners
   --------------------------- */
enterChatBtn.addEventListener('click', async () => {
  try {
    await ensureAuth();
    homeScreen.classList.remove('active');
    chatScreen.classList.add('active');
    startListening();
    msgInput.focus();
  } catch (e) {
    showToast('Authentication failed', 'error');
  }
});
backBtn.addEventListener('click', () => {
  chatScreen.classList.remove('active');
  homeScreen.classList.add('active');
  stopListening();
});

/* ---------------------------
   Firestore realtime listener
   --------------------------- */
function startListening() {
  if (unsubscribe) return;
  const q = query(collection(db, 'chats'), orderBy('createdAt', 'asc'));
  unsubscribe = onSnapshot(q, snapshot => {
    chatArea.innerHTML = '';
    snapshot.forEach(doc => {
      const msg = doc.data();
      renderMessage(msg);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
  }, err => {
    console.error('Snapshot error', err);
    showToast('रियल‑टाइम कनेक्शन में समस्या', 'error');
  });
}
function stopListening() {
  if (typeof unsubscribe === 'function') {
    unsubscribe();
    unsubscribe = null;
  }
}

/* ---------------------------
   Render message (safe)
   --------------------------- */
function renderMessage(msg) {
  const div = document.createElement('div');
  const cls = msg.sender === 'customer' ? 'user' : (msg.sender === 'admin' ? 'admin' : 'astro');
  div.className = `message ${cls}`;
  let timeStr = '';
  if (msg.createdAt && typeof msg.createdAt.toDate === 'function') {
    try { timeStr = msg.createdAt.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); } catch(e){ timeStr=''; }
  }
  const textHtml = msg.text ? `<p>${sanitize(msg.text)}</p>` : '';
  const imgHtml = msg.imageUrl ? `<img src="${sanitize(msg.imageUrl)}" class="msg-img" alt="attachment">` : '';
  div.innerHTML = `<div class="msg-header"><strong>${cls==='user'?'आप':(cls==='admin'?'गुरुजी':'')}</strong> <span>${sanitize(timeStr)}</span></div>${textHtml}${imgHtml}`;
  chatArea.appendChild(div);
}

/* ---------------------------
   Image compression helper
   --------------------------- */
async function compressImage(file, maxWidth = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Not an image'));
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('Compression failed'));
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', { type: 'image/jpeg' });
          resolve(compressedFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => reject(new Error('Image load error'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

/* ---------------------------
   Send message with optimistic UI & upload progress
   --------------------------- */
sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

async function sendMessage() {
  const now = Date.now();
  if (now - lastSentAt < RATE_LIMIT_MS) {
    showToast('कृपया थोड़ी देर बाद पुनः भेजें', 'error');
    return;
  }
  lastSentAt = now;

  const text = msgInput.value.trim();
  const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  if (!text && !file) return;

  // optimistic UI
  const optimisticMsg = {
    text: text || null,
    imageUrl: null,
    sender: currentUserType === 'admin' ? 'admin' : 'customer',
    createdAt: { toDate: () => new Date() }
  };
  renderMessage(optimisticMsg);
  chatArea.scrollTop = chatArea.scrollHeight;

  loader.style.display = 'block';
  sendBtn.disabled = true;

  try {
    let uploadUrl = null;
    if (file) {
      let fileToUpload = file;
      if (file.size > 800 * 1024) {
        try { fileToUpload = await compressImage(file, 1200, 0.75); } catch(e) { console.warn('compress failed', e); }
      }
      if (!fileToUpload.type.startsWith('image/')) throw new Error('केवल इमेज फ़ाइल स्वीकार्य है');
      if (fileToUpload.size > 6 * 1024 * 1024) throw new Error('इमेज 6MB से छोटी होनी चाहिए');

      const path = `chat_images/${Date.now()}_${fileToUpload.name}`;
      const sRef = storageRef(storage, path);
      const uploadTask = uploadBytesResumable(sRef, fileToUpload);

      await new Promise((resolve, reject) => {
        uploadTask.on('state_changed', snapshot => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          showToast(`अपलोड ${pct}%`, 'info', 800);
        }, err => {
          reject(err);
        }, async () => {
          uploadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve();
        });
      });
    }

    await addDoc(collection(db, 'chats'), {
      text: text || null,
      imageUrl: uploadUrl || null,
      sender: currentUserType === 'admin' ? 'admin' : 'customer',
      createdAt: serverTimestamp()
    });

    msgInput.value = '';
    fileInput.value = '';
    showToast('संदेश भेज दिया गया', 'success', 1200);
  } catch (err) {
    console.error('Send error', err);
    showToast('संदेश भेजने में त्रुटि: ' + (err.message || ''), 'error', 4000);
  } finally {
    loader.style.display = 'none';
    sendBtn.disabled = false;
  }
}

/* ---------------------------
   File input validation
   --------------------------- */
fileInput.addEventListener('change', () => {
  const f = fileInput.files[0];
  if (!f) return;
  if (!f.type.startsWith('image/')) { showToast('केवल इमेज चुनें', 'error'); fileInput.value = ''; return; }
  if (f.size > 8 * 1024 * 1024) { showToast('इमेज 8MB से छोटी होनी चाहिए', 'error'); fileInput.value = ''; return; }
  showToast('इमेज तैयार है: ' + f.name, 'info', 1200);
});

/* ---------------------------
   Init: ensure auth
   --------------------------- */
ensureAuth().catch(e => console.warn('Initial auth failed', e));
