// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const settingsButton = document.getElementById('settingsButton');
const regenerateButton = document.getElementById('regenerateButton');
const copyButton = document.getElementById('copyButton');
const shareButton = document.getElementById('shareButton');
const typingIndicator = document.querySelector('.typing-indicator');
const footerActions = document.querySelector('.footer-actions');

// State
let lastExplanation = '';
let lastSelectedText = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'showExplanation') {
            showExplanation(request.text, request.explanation);
        }
    });
});

// Settings button click
settingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

// Regenerate button click
regenerateButton.addEventListener('click', async () => {
    if (lastSelectedText) {
        showTypingIndicator();
        hideFooterActions();
        
        try {
            const settings = await chrome.storage.sync.get({
                apiKey: '',
                model: 'anthropic/claude-3-sonnet',
                systemInstructions: 'Please explain the selected text in a clear and concise manner.'
            });

            chrome.runtime.sendMessage({
                action: 'explain',
                text: lastSelectedText,
                settings: settings
            }, (response) => {
                hideTypingIndicator();
                if (response.error) {
                    showError(response.error);
                } else {
                    showExplanation(lastSelectedText, response.explanation);
                }
            });
        } catch (error) {
            hideTypingIndicator();
            showError(error.message);
        }
    }
});

// Copy button click
copyButton.addEventListener('click', () => {
    if (lastExplanation) {
        navigator.clipboard.writeText(lastExplanation)
            .then(() => showNotification('Copied to clipboard!'))
            .catch(error => showError('Failed to copy: ' + error.message));
    }
});

// Share button click
shareButton.addEventListener('click', () => {
    if (lastExplanation) {
        const shareData = {
            title: 'AI Explanation',
            text: lastExplanation
        };

        if (navigator.share) {
            navigator.share(shareData)
                .catch(error => showError('Failed to share: ' + error.message));
        } else {
            showError('Share feature not supported in your browser');
        }
    }
});

// Show explanation in chat
function showExplanation(text, explanation) {
    lastSelectedText = text;
    lastExplanation = explanation;

    // Clear chat container
    chatContainer.innerHTML = '';

    // Add user message
    const userMessage = document.createElement('div');
    userMessage.className = 'message user';
    userMessage.textContent = text;
    chatContainer.appendChild(userMessage);

    // Add bot message
    const botMessage = document.createElement('div');
    botMessage.className = 'message bot';
    botMessage.innerHTML = marked.parse(explanation);

    // Apply syntax highlighting to code blocks
    botMessage.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });

    chatContainer.appendChild(botMessage);

    // Show footer actions
    showFooterActions();

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show error message
function showError(message) {
    const errorMessage = document.createElement('div');
    errorMessage.className = 'message bot error';
    errorMessage.textContent = `Error: ${message}`;
    chatContainer.appendChild(errorMessage);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Show/hide typing indicator
function showTypingIndicator() {
    typingIndicator.classList.remove('hidden');
}

function hideTypingIndicator() {
    typingIndicator.classList.add('hidden');
}

// Show/hide footer actions
function showFooterActions() {
    footerActions.classList.remove('hidden');
}

function hideFooterActions() {
    footerActions.classList.add('hidden');
} 