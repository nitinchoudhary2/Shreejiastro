// 1. Firebase Libraries Import
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } 
       from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } 
       from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 2. आपकी Config
const firebaseConfig = {
    apiKey: "AIzaSyBg22VnPqDC2AiWzgu22fs5bS0KLI0PQCQ",
    authDomain: "shreejiastro-57f1a.firebaseapp.com",
    projectId: "shreejiastro-57f1a",
    storageBucket: "shreejiastro-57f1a.firebasestorage.app",
    messagingSenderId: "979268934814",
    appId: "1:979268934814:web:006040c31781d831f76f8f",
    measurementId: "G-HK8VYFXZEM"
};

// 3. Initialize
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Global Variables
let currentUserType = 'guest'; 
const adminPassword = "Choudhary9462&";

// --- UI Functions ---
window.enterAsCustomer = () => {
    currentUserType = 'customer';
    document.getElementById('chatTitle').innerText = "श्रीजी महाराज";
    switchScreen('chat-screen');
    loadMessages();
};

window.openAdminLogin = () => document.getElementById('login-modal').style.display = 'flex';
window.closeModal = () => document.getElementById('login-modal').style.display = 'none';

window.checkLogin = () => {
    const pass = document.getElementById('adminPass').value;
    if(pass === adminPassword) {
        currentUserType = 'admin';
        document.getElementById('chatTitle').innerText = "Admin Panel";
        closeModal();
        switchScreen('chat-screen');
        loadMessages();
    } else {
        alert("गलत पासवर्ड!");
    }
};

window.logout = () => {
    currentUserType = 'guest';
    switchScreen('home-screen');
    window.location.reload(); 
};

function switchScreen(screenId) {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'none';
    document.getElementById(screenId).style.display = 'flex';
}

// --- FIREBASE LOGIC ---

// 1. लोड मैसेज
function loadMessages() {
    const q = query(collection(db, "chats"), orderBy("createdAt", "asc"));
    
    onSnapshot(q, (snapshot) => {
        const chatArea = document.getElementById("chatArea");
        chatArea.innerHTML = ""; 

        snapshot.forEach((doc) => {
            const msg = doc.data();
            renderMessage(msg, chatArea);
        });

        chatArea.scrollTop = chatArea.scrollHeight;
    });
}

function renderMessage(msg, container) {
    const div = document.createElement("div");
    let align = 'flex-start';
    let bg = 'var(--chat-received)';
    let senderName = msg.sender === 'customer' ? 'भक्त' : 'गुरुजी';

    if (currentUserType === 'customer') {
        if (msg.sender === 'customer') { align = 'flex-end'; bg = 'var(--chat-sent)'; senderName = 'आप'; }
    } else { // Admin View
        if (msg.sender === 'admin') { align = 'flex-end'; bg = 'var(--admin-sent)'; senderName = 'आप'; }
        else { bg = 'var(--chat-sent)'; }
    }

    div.className = 'message';
    div.style.alignSelf = align;
    div.style.background = bg;

    let imgHtml = msg.imageUrl ? `<img src="${msg.imageUrl}" class="msg-img" onclick="window.open(this.src)">` : '';
    let textHtml = msg.text ? `<p style="margin:0">${msg.text}</p>` : '';
    
    let timeStr = "";
    if(msg.createdAt) {
        const date = msg.createdAt.toDate();
        timeStr = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    div.innerHTML = `
        <div class="msg-header"><span>${senderName}</span> <span>${timeStr}</span></div>
        ${textHtml}
        ${imgHtml}
    `;
    container.appendChild(div);
}

// 2. मैसेज भेजना
window.sendMessage = async () => {
    const input = document.getElementById("msgInput");
    const fileInput = document.getElementById("fileInput");
    const loader = document.getElementById("loader");
    const sendBtn = document.getElementById("sendBtn");

    const text = input.value.trim();
    const file = fileInput.files[0];

    if (!text && !file) return;

    loader.style.display = 'block';
    sendBtn.style.display = 'none';

    try {
        let imageUrl = null;
        if (file) {
            const storageRef = ref(storage, `chat_images/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(storageRef);
        }

        await addDoc(collection(db, "chats"), {
            text: text,
            imageUrl: imageUrl,
            sender: currentUserType,
            createdAt: serverTimestamp()
        });

        input.value = "";
        fileInput.value = "";
        
    } catch (error) {
        console.error("Error:", error);
        alert("Error: " + error.message);
    } finally {
        loader.style.display = 'none';
        sendBtn.style.display = 'block';
    }
};

document.getElementById("msgInput").addEventListener("keypress", function(event) {
    if (event.key === "Enter") window.sendMessage();
});
