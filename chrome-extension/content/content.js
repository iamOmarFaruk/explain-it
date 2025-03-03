// Create floating button element
const floatingButton = document.createElement('div');
floatingButton.className = 'explain-it-button';
floatingButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0ZM8.8 12H7.2V7.2H8.8V12ZM8.8 5.6H7.2V4H8.8V5.6Z" fill="currentColor"/>
    </svg>
    <span>Explain</span>
`;

document.body.appendChild(floatingButton);

// Track button visibility state
let isButtonVisible = false;

// Handle text selection
document.addEventListener('mouseup', (e) => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText && selectedText.length > 0) {
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
}

// Hide floating button
function hideButton() {
    if (isButtonVisible) {
        floatingButton.classList.remove('visible');
        isButtonVisible = false;
    }
}

// Handle button click
floatingButton.addEventListener('click', async () => {
    const selectedText = window.getSelection().toString().trim();
    
    if (selectedText) {
        try {
            // Get settings from storage
            const settings = await chrome.storage.sync.get({
                apiKey: '',
                model: 'anthropic/claude-3-sonnet',
                systemInstructions: 'Please explain the selected text in a clear and concise manner.'
            });

            if (!settings.apiKey) {
                showNotification('Please set your API key in the extension options', 'error');
                return;
            }

            // Show loading state
            floatingButton.classList.add('loading');
            
            // Send message to background script
            chrome.runtime.sendMessage({
                action: 'explain',
                text: selectedText,
                settings: settings
            }, (response) => {
                if (chrome.runtime.lastError) {
                    showNotification('Error: ' + chrome.runtime.lastError.message, 'error');
                } else if (response.error) {
                    showNotification('Error: ' + response.error, 'error');
                }
                floatingButton.classList.remove('loading');
            });

        } catch (error) {
            showNotification('Error: ' + error.message, 'error');
            floatingButton.classList.remove('loading');
        }
    }
});

// Handle click outside selection
document.addEventListener('mousedown', (e) => {
    if (isButtonVisible && !floatingButton.contains(e.target)) {
        hideButton();
    }
});

// Notification system
function showNotification(message, type = 'info') {
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