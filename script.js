const audio = document.getElementById('podcast-audio');
const slangWord = document.querySelector('.slang-word');
const defBox = document.getElementById('definition-box');
const defText = document.getElementById('definition-text');
const closeBtn = document.getElementById('close-btn');

// When the user clicks the slang phrase
slangWord.addEventListener('click', () => {
    // 1. Pause the audio automatically
    audio.pause();
    
    // 2. Extract definition from HTML data attribute
    const definition = slangWord.getAttribute('data-definition');
    
    // 3. Populate and reveal the box
    defText.textContent = definition;
    defBox.classList.remove('hidden');
});

// Hide the box when clicking "Got it!"
closeBtn.addEventListener('click', () => {
    defBox.classList.add('hidden');
});
