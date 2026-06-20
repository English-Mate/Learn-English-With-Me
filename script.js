let conversationHistory = [];
let vocabularyLearned = {}; 
let timerInterval;
let timeLeft = 2 * 60 * 60; 
let selectedTopicContext = "";

// 🤫 Secret Easter Egg Configuration: Ctrl + 0 + P
let keysPressed = {};

window.addEventListener('keydown', (e) => {
    const keyLower = e.key.toLowerCase();
    keysPressed[keyLower] = true;

    if (e.ctrlKey && (keysPressed['0'] || keysPressed['num0']) && keysPressed['p']) {
        e.preventDefault(); 
        document.getElementById('admin-vault').classList.toggle('hidden');
        keysPressed['0'] = false;
        keysPressed['num0'] = false;
        keysPressed['p'] = false;
    }
});

window.addEventListener('keyup', (e) => {
    keysPressed[e.key.toLowerCase()] = false;
});

// Admin Vault Save Action
document.getElementById('save-master-btn').addEventListener('click', () => {
    const key = document.getElementById('master-key-input').value.trim();
    if(key) {
        localStorage.setItem('shared_gemini_key', btoa(key)); 
        alert("Master key securely updated for this application!");
        document.getElementById('admin-vault').classList.add('hidden');
    }
});

// Handle Topic Selection
function selectTopic(topicName) {
    selectedTopicContext = topicName;
    document.getElementById('topic-container').classList.add('hidden');
    document.getElementById('podcast-container').classList.remove('hidden');
    document.getElementById('active-topic').textContent = `Topic: ${topicName}`;
    
    const chatWindow = document.getElementById('chat-window');
    chatWindow.innerHTML = `<p class="ai-bubble"><strong>Gemini:</strong> Welcome! Let's chat about <strong>${topicName}</strong>. Tell me something about your day regarding this!</p>`;
    
    // Initial welcome greeting voice
    speakText(`Welcome! Let's chat about ${topicName}. Tell me something about your day regarding this!`);
    startTimer();
}

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

    // Stop any speech that is currently playing before sending a new message
    window.speechSynthesis.cancel();

    appendMessage("You", text, "user-bubble");
    userInput.value = "";
    conversationHistory.push({ role: "user", parts: [{ text: text }] });

    const typingBubble = appendMessage("Gemini", "Thinking...", "ai-bubble");

    const targetKey = atob(localStorage.getItem('shared_gemini_key') || "");
    if (!targetKey) {
        typingBubble.textContent = "System configuration missing. (Admin: Press Ctrl + 0 + P to unlock system console)";
        return;
    }

    const dynamicInstruction = `
    You are a friendly English coach. Current topic: ${selectedTopicContext}.
    Tone: Casual and standard English. Do not use random internet slang in your regular sentences.

    MANDATORY OUTPUT FORMAT RULES:
    RULE 1 (GRAMMAR): If the user's last message has ANY grammar or spelling mistake, you MUST start your response with: [grammar: Explanation of error | Corrected sentence structure]
    
    RULE 2 (SLANG): Every single response MUST include exactly one idiom or slang term wrapped in this exact format: [slang: WORD OR IDIOM | DEFINITION]. Never skip the definition.

    Example Output Sequence:
    [grammar: Change 'watch' to 'watching' | I was watching my phone.] I get it! I was completely [slang: glued to my phone | intensely focused on looking at the screen] last night too.

    No markdown or backticks. Always include the slang brackets.
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
        
        // Convert brackets to layout styles
        const cleanedReply = parseAndStoreContent(rawReply);
        typingBubble.innerHTML = `<strong>Gemini:</strong> ${cleanedReply}`;
        conversationHistory.push({ role: "model", parts: [{ text: rawReply }] });
        chatWindow.scrollTop = chatWindow.scrollHeight;

        // 🔊 Read the cleaned response out loud natively
        prepareAndSpeak(rawReply);

    } catch (error) {
        typingBubble.textContent = "Oops! Gemini ran into a tiny glitch. Try again.";
    }
}

sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });

// Cleans up the text strings specifically for the voice synthesis reader
function prepareAndSpeak(rawText) {
    // Remove the grammar bracket completely from being read aloud
    let voiceText = rawText.replace(/\[grammar:[^\]]+\]/g, "");
    
    // Convert [slang: running on fumes | broken definition] to just "running on fumes"
    voiceText = voiceText.replace(/\[slang:\s*([^|]+)\s*\|\s*[^\]]+\]/g, "$1");
    
    speakText(voiceText.trim());
}

// Native Text-to-Speech Core Engine Function
function speakText(textToSay) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(textToSay);
        
        // Find a natural English sounding voice option available in the browser
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(voice => voice.lang.includes('en-US') || voice.lang.includes('en-GB'));
        
        if (englishVoice) utterance.voice = englishVoice;
        
        utterance.rate = 1.0;  // Normal human narration pacing
        utterance.pitch = 1.0; // Balanced pitch accent
        
        window.speechSynthesis.speak(utterance);
    }
}

// Re-trigger voice lists loading if browser initialization is delayed
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };
}

function parseAndStoreContent(text) {
    let newText = text;

    // 1. Parse Grammar
    const grammarRegex = /\[grammar:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
    let grammarMatch;
    while ((grammarMatch = grammarRegex.exec(text)) !== null) {
        const explanation = grammarMatch[1].trim();
        const correction = grammarMatch[2].trim();
        const tipHtml = `<span class="grammar-tip">💡 <strong>Grammar Tip:</strong> ${explanation} <br>✨ <em>Say: "${correction}"</em></span>`;
        newText = newText.replace(grammarMatch[0], tipHtml);
    }

    // 2. Parse Slang
    const slangRegex = /\[slang:\s*([^|]+)\s*\|\s*([^\]]+)\]/g;
    let slangMatch;
    while ((slangMatch = slangRegex.exec(text)) !== null) {
        const word = slangMatch[1].trim();
        const definition = slangMatch[2].trim();
        vocabularyLearned[word] = definition;
        newText = newText.replace(slangMatch[0], `<span class="slang-word" title="${definition}" onclick="alert('${word}: ${definition}')">${word}</span>`);
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
    window.speechSynthesis.cancel(); // Stop talking if the summary screen opens
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

function appendMessage(sender, text, className) {
    const div = document.createElement('p');
    div.className = className;
    div.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}
