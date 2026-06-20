// --- INITIALIZE SUPABASE ---
const SUPABASE_URL = "https://aaqhhcduyjdwhttopbty.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhcWhoY2R1eWpkd2h0dG9wYnR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NDA0MTUsImV4cCI6MjA5NzUxNjQxNX0.37LMqYv-O58IWLz8sIivJ5PzdCd-jQHv0BsD0pF7sT4"; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let conversationHistory = [];
let vocabularyLearned = {}; 
let timerInterval;
let timeLeft = 2 * 60 * 60; 
let selectedTopicContext = "";
let currentUserName = "Student";
let currentUserEmail = "";
let currentUserCredits = 6;

const ADMIN_EMAIL = "yuvansood1234@gmail.com";

// DOM Element Hook Declarations
const loginContainer = document.getElementById('login-container');
const topicContainer = document.getElementById('topic-container');
const emailInput = document.getElementById('email-input');
const otpInput = document.getElementById('otp-input');
const otpBox = document.getElementById('otp-verification-box');
const creditBadge = document.getElementById('credit-badge');
const superAdminPanel = document.getElementById('super-admin-panel');

// Keep user logged in on page refreshes
window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
        await syncUserProfile(session.user);
    }
});

// 1. Send Passwordless 6-Digit OTP to User's Email
document.getElementById('send-otp-btn').addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email) return alert("Please enter your email address first.");

    const { error } = await supabaseClient.auth.signInWithOtp({ email: email });
    if (error) return alert("Error sending OTP code: " + error.message);

    alert("A 6-digit verification code has been dispatched to your email inbox!");
    otpBox.classList.remove('hidden');
});

// 2. Validate OTP Token and Fetch/Create Profile Row
document.getElementById('verify-otp-btn').addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const token = otpInput.value.trim();
    if (!email || !token) return alert("Please fill in both fields.");

    const { data, error } = await supabaseClient.auth.verifyOtp({
        email: email,
        token: token,
        type: 'email'
    });

    if (error) return alert("Verification failed: " + error.message);
    
    if (data.user) {
        await syncUserProfile(data.user);
    }
});

// Sync user metadata with Supabase database profile
async function syncUserProfile(user) {
    currentUserEmail = user.email;
    currentUserName = user.email.split('@')[0];

    // Read current user profile records based on unique email
    let { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', currentUserEmail)
        .maybeSingle();

    // If no profile entry exists yet, register them with 6 starting credits
    if (!profile) {
        const initialCredits = (currentUserEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ? 999999 : 6;
        
        const { data: newProfile, error: createError } = await supabaseClient
            .from('profiles')
            .insert([{ username: currentUserName, email: currentUserEmail, credits: initialCredits }])
            .select()
            .single();
            
        profile = newProfile;
    }

    currentUserCredits = profile ? profile.credits : 6;

    // Render User Stats Layout
    document.getElementById('display-username').textContent = currentUserName;
    document.getElementById('user-email-label').textContent = currentUserEmail;
    
    updateCreditDisplay();

    // Toggle Admin Console view exclusively for your admin email
    if (currentUserEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        superAdminPanel.classList.remove('hidden');
    }

    loginContainer.classList.add('hidden');
    topicContainer.classList.remove('hidden');
}

function updateCreditDisplay() {
    if (currentUserEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        creditBadge.textContent = "🪙 Credits: Infinite ∞";
    } else {
        creditBadge.textContent = `🪙 Credits: ${currentUserCredits}`;
    }
}

// 3. Admin Credit Transfer System
document.getElementById('admin-grant-btn').addEventListener('click', async () => {
    const targetEmail = document.getElementById('admin-target-email').value.trim();
    const grantAmount = parseInt(document.getElementById('admin-credit-amount').value.trim());

    if (!targetEmail || isNaN(grantAmount)) return alert("Please fill out a valid recipient email and number amount.");

    // Locate target user's current profile row
    const { data: targetProfile, error: fetchError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('email', targetEmail)
        .maybeSingle();

    if (!targetProfile) return alert("Could not find any user profile registered under that email.");

    const updatedTotal = targetProfile.credits + grantAmount;

    const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({ credits: updatedTotal })
        .eq('email', targetEmail);

    if (updateError) return alert("Failed to modify target credits: " + updateError.message);

    alert(`Successfully transferred ${grantAmount} credits to ${targetEmail}!`);
    document.getElementById('admin-target-email').value = "";
    document.getElementById('admin-credit-amount').value = "";
});

// 4. Scenario Activation & Credit Deduction
async function selectTopic(topicName) {
    const isAdmin = (currentUserEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    if (!isAdmin && currentUserCredits < 2) {
        return alert("Access Denied! Each studio scenario requires 2 session credits.");
    }

    // Process payment if user is not the master admin account
    if (!isAdmin) {
        currentUserCredits -= 2;
        updateCreditDisplay();

        await supabaseClient
            .from('profiles')
            .update({ credits: currentUserCredits })
            .eq('email', currentUserEmail);
    }

    selectedTopicContext = topicName;
    document.getElementById('topic-container').classList.add('hidden');
    document.getElementById('podcast-container').classList.remove('hidden');
    document.getElementById('active-topic').textContent = `Scenario Context: ${topicName}`;
    
    const chatWindow = document.getElementById('chat-window');
    const welcomeMessage = `Welcome to the scenario studio, ${currentUserName}! Let's practice conversing about "${topicName}". To kick things off, tell me your thoughts on this subject.`;
    
    chatWindow.innerHTML = `<p class="ai-bubble"><strong>Gemini:</strong> ${welcomeMessage}</p>`;
    speakText(welcomeMessage);
    startTimer();
}

// Core Chat Interface Functionality
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const endBtn = document.getElementById('end-btn');
const timerDisplay = document.getElementById('timer');
const podcastContainer = document.getElementById('podcast-container');
const summaryContainer = document.getElementById('summary-container');

async function handleSend() {
    const text = userInput.value.trim();
    if (!text) return;

    window.speechSynthesis.cancel();
    appendMessage(currentUserName, text, "user-bubble");
    userInput.value = "";
    conversationHistory.push({ role: "user", parts: [{ text: text }] });

    const typingBubble = appendMessage("Gemini", "Thinking...", "ai-bubble");
    const targetKey = atob(localStorage.getItem('shared_gemini_key') || "");
    if (!targetKey) {
        typingBubble.textContent = "Configuration Key Offline. (Console Access: Ctrl + 0 + P)";
        return;
    }

    const dynamicInstruction = `
    You are a professional language coach. You are chatting with a student named ${currentUserName}.
    Current speech scenario context: ${selectedTopicContext}.
    Tone: Casual, natural standard English. Do not use random text-slang yourself.

    MANDATORY SYSTEM GENERATION MATCHES:
    RULE 1 (GRAMMAR): If errors exist, lead with: [grammar: Error analysis | Corrected response layout]
    RULE 2 (SLANG): Include exactly one expression formatted as: [slang: IDIOM | INTERPRETATION DEFINITION].
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${targetKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: conversationHistory,
                systemInstruction: { parts: [{ text: dynamicInstruction }] }
            })
        });

        const data = await response.json();
        const rawReply = data.candidates[0].content.parts[0].text;
        
        const cleanedReply = parseAndStoreContent(rawReply);
        typingBubble.innerHTML = `<strong>Gemini:</strong> ${cleanedReply}`;
        conversationHistory.push({ role: "model", parts: [{ text: rawReply }] });
        chatWindow.scrollTop = chatWindow.scrollHeight;

        prepareAndSpeak(rawReply);

    } catch (error) {
        typingBubble.textContent = "The server encountered a minor communication fault. Re-attempt sentence delivery.";
    }
}

sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });

function prepareAndSpeak(rawText) {
    let voiceText = rawText.replace(/\[grammar:[^\]]+\]/g, "");
    voiceText = voiceText.replace(/\[slang:\s*([^|]+)\s*\|\s*[^\]]+\]/g, "$1");
    speakText(voiceText.trim());
}

function speakText(textToSay) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(textToSay);
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(voice => voice.lang.includes('en-US') || voice.lang.includes('en-GB'));
        if (englishVoice) utterance.voice = englishVoice;
        window.speechSynthesis.speak(utterance);
    }
}

function parseAndStoreContent(text) {
    let newText = text;
    const grammarRegex = /\[grammar:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
    let grammarMatch;
    while ((grammarMatch = grammarRegex.exec(text)) !== null) {
        newText = newText.replace(grammarMatch[0], `<span class="grammar-tip">💡 <strong>Grammar Tip:</strong> ${grammarMatch[1].trim()} <br>✨ <em>Say: "${grammarMatch[2].trim()}"</em></span>`);
    }

    const slangRegex = /\[slang:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
    let slangMatch;
    while ((slangMatch = slangRegex.exec(text)) !== null) {
        vocabularyLearned[slangMatch[1].trim()] = slangMatch[2].trim();
        newText = newText.replace(slangMatch[0], `<span class="slang-word" onclick="alert('${slangMatch[1].trim()}: ${slangMatch[2].trim()}')">${slangMatch[1].trim()}</span>`);
    }
    return newText;
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) { clearInterval(timerInterval); endPodcast(); }
        let hrs = Math.floor(timeLeft / 3600).toString().padStart(2, '0');
        let mins = Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0');
        let secs = (timeLeft % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${hrs}:${mins}:${secs}`;
    }, 1000);
}

function endPodcast() {
    window.speechSynthesis.cancel(); 
    clearInterval(timerInterval);
    podcastContainer.classList.add('hidden');
    summaryContainer.classList.remove('hidden');
    const listElement = document.getElementById('slang-summary-list');
    listElement.innerHTML = "";
    Object.keys(vocabularyLearned).forEach(word => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${word}</strong>: ${vocabularyLearned[word]}`;
        listElement.appendChild(li);
    });
}
endBtn.addEventListener('click', endPodcast);

document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
});

// Secret Developer Key Console Setup Shortcuts (Ctrl + 0 + P)
let keysPressed = {};
window.addEventListener('keydown', (e) => {
    keysPressed[e.key.toLowerCase()] = true;
    if (e.ctrlKey && (keysPressed['0'] || keysPressed['num0']) && keysPressed['p']) {
        e.preventDefault(); 
        document.getElementById('admin-vault').classList.toggle('hidden');
    }
});
window.addEventListener('keyup', (e) => { keysPressed[e.key.toLowerCase()] = false; });
document.getElementById('save-master-btn').addEventListener('click', () => {
    const key = document.getElementById('master-key-input').value.trim();
    if(key) { localStorage.setItem('shared_gemini_key', btoa(key)); alert("Master configuration key active!"); }
});

function appendMessage(sender, text, className) {
    const div = document.createElement('p');
    div.className = className;
    div.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}
