// --- NO AUTH INITIALIZATION ---
let conversationHistory = [];
let vocabularyLearned = {}; 
let timerInterval;
let timeLeft = 2 * 60 * 60; 
let selectedTopicContext = "";

// Locally set profile values since login is removed
let currentUserName = "Student";
let currentUserEmail = "yuvansood1234@gmail.com"; // Set as admin to grant infinite credits automatically
let currentUserCredits = 999999;

// SPEECH AUDIO CONNECTIONS
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
}

// DOM ELEMENTS
const topicContainer = document.getElementById('topic-container');
const creditBadge = document.getElementById('credit-badge');
const talkBtn = document.getElementById('talk-btn');
const voiceStatusLabel = document.getElementById('voice-status-label');
const chatWindow = document.getElementById('chat-window');

// INITIALIZE DIRECTLY ON PAGE LOAD
window.addEventListener('DOMContentLoaded', () => {
    // Automatically load app values on startup
    document.getElementById('display-username').textContent = currentUserName;
    document.getElementById('user-email-label').textContent = currentUserEmail;
    
    // Set to Infinite representation since email matches admin logic
    creditBadge.textContent = "🪙 Credits: Infinite ∞";
    
    // Instantly reveal the studio topics panel
    topicContainer.classList.remove('hidden');
});

async function selectTopic(topicName) {
    selectedTopicContext = topicName;
    topicContainer.classList.add('hidden');
    document.getElementById('podcast-container').classList.remove('hidden');
    document.getElementById('active-topic').textContent = `Voice Context: ${topicName}`;
    
    const welcomeMessage = `Hello ${currentUserName}! Let's practice conversational skills on "${topicName}". Tap the mic button whenever you are ready to talk!`;
    chatWindow.innerHTML = `<p class="ai-bubble"><strong>Adam:</strong> ${welcomeMessage}</p>`;
    speakText(welcomeMessage);
    startTimer();
}

// CAPTURING MICROPHONE STREAMS
if (recognition) {
    recognition.onstart = () => {
        isRecording = true;
        talkBtn.textContent = "🛑 Listening...";
        talkBtn.className = "talk-btn-active";
        voiceStatusLabel.textContent = "Capturing microphone input stream...";
    };

    recognition.onerror = () => { resetVoiceInterface(); };
    recognition.onend = () => { resetVoiceInterface(); };

    recognition.onresult = async (event) => {
        const spokenText = event.results[0][0].transcript;
        if (!spokenText.trim()) return;
        await processingConversationFlow(spokenText);
    };
}

talkBtn.addEventListener('click', () => {
    if (!recognition) return alert("Web Speech Engine not supported on this browser. Use Chrome or Safari.");
    window.speechSynthesis.cancel();
    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
});

function resetVoiceInterface() {
    isRecording = false;
    talkBtn.textContent = "🎤 Tap to Speak";
    talkBtn.className = "talk-btn-inactive";
    voiceStatusLabel.textContent = "Microphone Idle";
}

// PROCESSING CORE SYSTEM FLOW
async function processingConversationFlow(text) {
    appendMessage(currentUserName, text, "user-bubble");
    conversationHistory.push({ role: "user", parts: [{ text: text }] });

    const typingBubble = appendMessage("Adam", "Analyzing vocal feedback...", "ai-bubble");
    const targetKey = atob(localStorage.getItem('shared_gemini_key') || "");
    if (!targetKey) {
        typingBubble.textContent = "Configuration Key Offline. (Ctrl + 0 + P)";
        return;
    }

    const explicitInstruction = `You are a conversational language voice partner chatting with ${currentUserName}. Current topic context: ${selectedTopicContext}. Speak in conversational English prose. If the user makes a structural mistake, inject exactly one bracket tip: [grammar: explain error briefly | provide correct short sentence]. If answering naturally, include exactly one native slang idiom inside brackets: [slang: expression | short meaning]. Do not use raw markdown blocks like "Tip:" or bold text for idioms outside these exact bracket parameters. Everything outside the brackets must be short prose spoken aloud.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${targetKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: conversationHistory,
                systemInstruction: { parts: [{ text: explicitInstruction }] }
            })
        });
        const data = await response.json();
        const rawReply = data.candidates[0].content.parts[0].text;
        
        typingBubble.innerHTML = `<strong>Adam:</strong> ${parseAndStoreContent(rawReply)}`;
        conversationHistory.push({ role: "model", parts: [{ text: rawReply }] });
        
        let voiceCleanText = rawReply.replace(/\[grammar:[^\]]+\]/g, "").replace(/\[slang:\s*([^|]+)\s*\|\s*[^\]]+\]/g, "$1");
        speakText(voiceCleanText.trim());
    } catch (e) {
        typingBubble.textContent = "Voice synchronization timeout. Please retry.";
    }
}

function parseAndStoreContent(text) {
    let cleanOutput = text;
    
    const grammarRegex = /\[grammar:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
    let match;
    while ((match = grammarRegex.exec(text)) !== null) {
        cleanOutput = cleanOutput.replace(match[0], `<span class="grammar-tip">💡 <strong>Correction:</strong> ${match[1]} <br>✨ <em>Say: "${match[2]}"</em></span>`);
    }
    
    const slangRegex = /\[slang:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
    while ((match = slangRegex.exec(text)) !== null) {
        const expression = match[1].trim();
        const definition = match[2].trim();
        vocabularyLearned[expression] = definition;
        cleanOutput = cleanOutput.replace(match[0], `<span class="slang-word" title="${definition}">${expression}</span> <i style="color: var(--text-muted); font-size: 0.9rem;">(${definition})</i>`);
    }
    return cleanOutput;
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) { clearInterval(timerInterval); endPodcast(); }
        let hrs = Math.floor(timeLeft / 3600).toString().padStart(2, '0');
        let mins = Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0');
        let secs = (timeLeft % 60).toString().padStart(2, '0');
        document.getElementById('timer').textContent = `${hrs}:${mins}:${secs}`;
    }, 1000);
}

function endPodcast() {
    window.speechSynthesis.cancel(); 
    clearInterval(timerInterval);
    document.getElementById('podcast-container').classList.add('hidden');
    document.getElementById('summary-container').classList.remove('hidden');
    const listElement = document.getElementById('slang-summary-list');
    listElement.innerHTML = "";
    Object.keys(vocabularyLearned).forEach(w => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${w}</strong>: ${vocabularyLearned[w]}`;
        listElement.appendChild(li);
    });
}
document.getElementById('end-btn').addEventListener('click', endPodcast);

// CRASH-IMMUNE KEYBOARD VAULT DETECTORS (Ctrl + 0 + P)
let keysPressed = {};
window.addEventListener('keydown', (e) => {
    if (!e || !e.key) return; 
    const keyName = e.key.toLowerCase();
    keysPressed[keyName] = true;
    if (e.ctrlKey && keysPressed['0'] && keysPressed['p']) {
        e.preventDefault(); 
        document.getElementById('admin-vault').classList.toggle('hidden');
    }
});

window.addEventListener('keyup', (e) => {
    if (!e || !e.key) return; 
    keysPressed[e.key.toLowerCase()] = false;
});

document.getElementById('save-master-btn').addEventListener('click', () => {
    const key = document.getElementById('master-key-input').value.trim();
    if(key) { localStorage.setItem('shared_gemini_key', btoa(key)); alert("Key loaded successfully."); }
});

function appendMessage(sender, text, className) {
    const div = document.createElement('p');
    div.className = className;
    div.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}
