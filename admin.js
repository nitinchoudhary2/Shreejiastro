// js/admin.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

const emailEl = document.getElementById('adminEmail');
const passEl = document.getElementById('adminPass');
const signInBtn = document.getElementById('adminSignIn');
const signOutBtn = document.getElementById('adminSignOut');
const adminPanel = document.getElementById('adminPanel');
const messagesList = document.getElementById('messagesList');
const refreshBtn = document.getElementById('refreshMsgs');

signInBtn.addEventListener('click', async () => {
  const email = emailEl.value.trim(), pass = passEl.value;
  if (!email || !pass) return alert('Email और Password भरें');
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    console.error(err);
    alert('Login failed: ' + (err.message || err));
  }
});

signOutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const tokenRes = await getIdTokenResult(user, true);
      if (!tokenRes.claims || tokenRes.claims.admin !== true) {
        alert('आपके पास एडमिन एक्सेस नहीं है');
        await signOut(auth);
        return;
      }
    } catch (e) {
      console.error('claims check failed', e);
      alert('Authentication error');
      await signOut(auth);
      return;
    }
    signInBtn.style.display = 'none';
    signOutBtn.style.display = 'inline-block';
    adminPanel.style.display = 'block';
    loadMessages();
  } else {
    signInBtn.style.display = 'inline-block';
    signOutBtn.style.display = 'none';
    adminPanel.style.display = 'none';
  }
});

async function loadMessages() {
  messagesList.innerHTML = 'लोड हो रहा है...';
  try {
    const q = query(collection(db, 'chats'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    messagesList.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const row = document.createElement('div');
      row.className = 'msg-row';
      const time = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleString() : '';
      row.innerHTML = `<strong>${sanitize(d.sender)}</strong> <small>${sanitize(time)}</small><div>${sanitize(d.text || '')}</div>`;
      if (d.imageUrl) {
        const a = document.createElement('a');
        a.href = d.imageUrl;
        a.target = '_blank';
        a.textContent = 'View Image';
        row.appendChild(a);
      }
      messagesList.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    messagesList.innerHTML = 'लोडिंग में त्रुटि';
  }
}

refreshBtn.addEventListener('click', loadMessages);

function sanitize(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"'`=\/]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[c]));
}
