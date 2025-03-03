// Initialize variables to store settings
let extensionSettings = {
    apiKey: '',
    model: 'anthropic/claude-3-sonnet',
    systemInstructions: 'Please explain the selected text in a clear and concise manner.'
};

// Safely send a message to the background script
function safelySendMessage(message, callback) {
    try {
        chrome.runtime.sendMessage(message, callback);
    } catch (error) {
        console.error('Error sending message to background script:', error);
        if (callback) {
            callback(null);
        }
    }
}

// Request settings from background script when content script loads
try {
    safelySendMessage({ action: 'getSettings' }, (response) => {
        if (response && response.settings) {
            extensionSettings = response.settings;
            console.log('Settings loaded from background script');
        } else {
            console.warn('Failed to load settings, using defaults');
        }
    });
} catch (error) {
    console.error('Error loading settings:', error);
}

// Listen for settings updates
try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
            if (message.action === 'settingsUpdated' && message.settings) {
                extensionSettings = message.settings;
                console.log('Settings updated:', extensionSettings);
            }
            // Always return something to avoid "The message port closed before a response was received" errors
            sendResponse({ received: true });
        } catch (error) {
            console.error('Error processing message:', error);
            sendResponse({ error: error.message });
        }
    });
} catch (error) {
    console.error('Error setting up message listener:', error);
}

// Create floating button element
const floatingButton = document.createElement('div');
floatingButton.className = 'explain-it-button';
floatingButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0ZM8.8 12H7.2V7.2H8.8V12ZM8.8 5.6H7.2V4H8.8V5.6Z" fill="currentColor"/>
    </svg>
    <span>Explain</span>
`;

// Create popup container
const popupContainer = document.createElement('div');
popupContainer.className = 'explain-it-popup-container';
popupContainer.innerHTML = `
    <div class="explain-it-popup">
        <div class="explain-it-popup-header">
            <div class="explain-it-popup-title">Explain It</div>
            <div class="explain-it-popup-close">×</div>
        </div>
        <div class="explain-it-popup-content">
            <div class="explain-it-messages"></div>
            <div class="explain-it-input-container">
                <textarea class="explain-it-input" placeholder="Ask a follow-up question..."></textarea>
                <button class="explain-it-send">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        </div>
    </div>
`;

document.body.appendChild(floatingButton);
document.body.appendChild(popupContainer);

// Get popup elements
const popup = popupContainer.querySelector('.explain-it-popup');
const popupClose = popupContainer.querySelector('.explain-it-popup-close');
const messagesContainer = popupContainer.querySelector('.explain-it-messages');
const inputContainer = popupContainer.querySelector('.explain-it-input-container');
const input = popupContainer.querySelector('.explain-it-input');
const sendButton = popupContainer.querySelector('.explain-it-send');

// Track button visibility state
let isButtonVisible = false;
let currentExplanation = '';
let currentSelectedText = '';

// Handle text selection
document.addEventListener('mouseup', (e) => {
    // Don't show button if the selection is within the button itself or popup
    if (floatingButton.contains(e.target) || popupContainer.contains(e.target)) {
        return;
    }
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText && selectedText.length > 10) { // Require at least 10 characters
        showButton(e);
    } else {
        hideButton();
    }
});

// Show floating button
function showButton(e) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Calculate button position
    const buttonWidth = 100; // Approximate width of the button
    const buttonHeight = 36; // Approximate height of the button
    const spacing = 10; // Spacing from the selection

    let left = rect.left + (rect.width - buttonWidth) / 2;
    let top = rect.bottom + spacing + window.scrollY;

    // Ensure button stays within viewport
    left = Math.max(spacing, Math.min(left, window.innerWidth - buttonWidth - spacing));
    
    floatingButton.style.left = `${left}px`;
    floatingButton.style.top = `${top}px`;
    floatingButton.classList.add('visible');
    isButtonVisible = true;
    
    console.log('Explain button shown');
}

// Hide floating button
function hideButton() {
    if (isButtonVisible) {
        floatingButton.classList.remove('visible');
        isButtonVisible = false;
    }
}

// Show popup
function showPopup(text, explanation) {
    currentSelectedText = text;
    currentExplanation = explanation;
    
    // Clear messages container
    messagesContainer.innerHTML = '';
    
    // Add user message
    addMessage(text, 'user');
    
    // Add bot message if available
    if (explanation) {
        addMessage(explanation, 'bot');
    }
    
    // Position popup in the center of the viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popupWidth = 400;
    const popupHeight = 500;
    
    popup.style.width = `${popupWidth}px`;
    popup.style.height = `${popupHeight}px`;
    popup.style.left = `${(viewportWidth - popupWidth) / 2}px`;
    popup.style.top = `${(viewportHeight - popupHeight) / 2}px`;
    
    // Show popup
    popupContainer.classList.add('visible');
    
    // Focus input
    input.focus();
}

// Hide popup
function hidePopup() {
    popupContainer.classList.remove('visible');
}

// Add message to chat
function addMessage(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.className = `explain-it-message ${sender}`;
    
    if (sender === 'bot') {
        // Convert markdown to HTML
        const formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
        
        messageElement.innerHTML = formattedText;
    } else {
        messageElement.textContent = text;
    }
    
    messagesContainer.appendChild(messageElement);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show loading message
function showLoading() {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'explain-it-message bot loading';
    loadingElement.innerHTML = '<div class="explain-it-loading-dots"><div></div><div></div><div></div></div>';
    messagesContainer.appendChild(loadingElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return loadingElement;
}

// Handle button click
floatingButton.addEventListener('click', async () => {
    const selectedText = window.getSelection().toString().trim();
    
    if (selectedText) {
        try {
            console.log('Getting settings');
            
            // First show the popup with loading state
            showPopup(selectedText, '');
            const loadingElement = showLoading();
            
            // Update button state
            floatingButton.classList.add('loading');
            
            console.log('Sending explanation request to background script');
            
            // Before making the request, ensure we have an API key
            if (!extensionSettings.apiKey) {
                // Request latest settings from background script
                safelySendMessage({ action: 'getSettings' }, (response) => {
                    if (response && response.settings && response.settings.apiKey) {
                        extensionSettings = response.settings;
                        // Now make the request with updated settings
                        sendExplanationRequest(selectedText, loadingElement);
                    } else {
                        // No API key set, show error
                        loadingElement.remove();
                        addMessage('Error: API key is not set. Please configure it in the extension options.', 'error');
                        floatingButton.classList.remove('loading');
                        
                        // Try to open options page
                        try {
                            safelySendMessage({ action: 'openOptions' });
                        } catch (e) {
                            console.error('Failed to open options page:', e);
                        }
                    }
                });
            } else {
                // We have an API key, make the request
                sendExplanationRequest(selectedText, loadingElement);
            }
            
            hideButton();

        } catch (error) {
            console.error('Content script error:', error);
            showNotification('Error: ' + error.message, 'error');
            floatingButton.classList.remove('loading');
        }
    }
});

// Send explanation request to background script
function sendExplanationRequest(text, loadingElement) {
    safelySendMessage({
        action: 'explain',
        text: text,
        settings: extensionSettings
    }, (response) => {
        floatingButton.classList.remove('loading');
        
        if (!response) {
            loadingElement.remove();
            addMessage('Error: Failed to communicate with the extension. Please try again.', 'error');
            return;
        }
        
        if (chrome.runtime.lastError) {
            console.error('Runtime error:', chrome.runtime.lastError);
            loadingElement.remove();
            addMessage('Error: ' + chrome.runtime.lastError.message, 'error');
            return;
        }
        
        if (response && response.error) {
            console.error('Response error:', response.error);
            loadingElement.remove();
            addMessage('Error: ' + response.error, 'error');
            return;
        }
        
        // Remove loading indicator and show explanation
        loadingElement.remove();
        if (response && response.explanation) {
            addMessage(response.explanation, 'bot');
            currentExplanation = response.explanation;
        } else {
            addMessage('Error: No explanation received from the API.', 'error');
        }
    });
}

// Handle send button click
sendButton.addEventListener('click', () => {
    sendFollowUpQuestion();
});

// Handle enter key in input
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendFollowUpQuestion();
    }
});

// Send follow-up question
function sendFollowUpQuestion() {
    const question = input.value.trim();
    
    if (!question) return;
    
    // Add user message
    addMessage(question, 'user');
    
    // Clear input
    input.value = '';
    
    // Show loading indicator
    const loadingElement = showLoading();
    
    // Send message to background script
    safelySendMessage({
        action: 'followUp',
        originalText: currentSelectedText,
        originalExplanation: currentExplanation,
        followUpQuestion: question,
        settings: extensionSettings
    }, (response) => {
        // Remove loading indicator
        loadingElement.remove();
        
        if (!response) {
            addMessage('Error: Failed to communicate with the extension. Please try again.', 'error');
            return;
        }
        
        if (chrome.runtime.lastError) {
            console.error('Runtime error:', chrome.runtime.lastError);
            addMessage('Error: ' + chrome.runtime.lastError.message, 'error');
            return;
        }
        
        if (response && response.error) {
            console.error('Response error:', response.error);
            addMessage('Error: ' + response.error, 'error');
            return;
        }
        
        // Show response
        if (response && response.response) {
            addMessage(response.response, 'bot');
            currentExplanation = response.response;
        } else {
            addMessage('Error: No response received from the API.', 'error');
        }
    });
}

// Close popup when clicking the close button
popupClose.addEventListener('click', () => {
    hidePopup();
});

// Close popup when clicking outside
document.addEventListener('mousedown', (e) => {
    if (isButtonVisible && !floatingButton.contains(e.target)) {
        hideButton();
    }
    
    if (popupContainer.classList.contains('visible') && 
        !popup.contains(e.target) && 
        !floatingButton.contains(e.target)) {
        hidePopup();
    }
});

// Notification system
function showNotification(message, type = 'info') {
    console.log('Showing notification:', message, type);
    
    const notification = document.createElement('div');
    notification.className = `explain-it-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
} 