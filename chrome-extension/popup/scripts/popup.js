// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    const chatContainer = document.getElementById('chat-container');
    const settingsButton = document.getElementById('settings-button');
    const setupButton = document.getElementById('setup-button');
    const regenerateButton = document.getElementById('regenerate-button');
    const copyButton = document.getElementById('copy-button');
    const messagesContainer = document.getElementById('messages');
    const apiKeyStatus = document.getElementById('api-key-status');

    // State
    let lastExplanation = '';
    let lastSelectedText = '';

    // Initialize
    checkApiKey();

    // Check if API key is set
    async function checkApiKey() {
        try {
            const settings = await chrome.storage.sync.get({
                apiKey: '',
                model: 'anthropic/claude-3-sonnet',
                systemInstructions: 'Please explain the selected text in a clear and concise manner.'
            });

            if (settings.apiKey) {
                apiKeyStatus.classList.add('configured');
                apiKeyStatus.querySelector('.status-icon').textContent = '✓';
                apiKeyStatus.querySelector('.status-text').textContent = 'API Key Configured';
            } else {
                apiKeyStatus.classList.add('not-configured');
                apiKeyStatus.querySelector('.status-icon').textContent = '!';
                apiKeyStatus.querySelector('.status-text').textContent = 'API Key Not Set';
            }
        } catch (error) {
            console.error('Error checking API key:', error);
        }
    }

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'showExplanation') {
            welcomeScreen.classList.add('hidden');
            chatContainer.classList.remove('hidden');
            showExplanation(request.text, request.explanation);
        }
    });

    // Settings button click
    settingsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Setup button click
    setupButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Regenerate button click
    regenerateButton.addEventListener('click', async () => {
        if (lastSelectedText) {
            showLoading();
            
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
                    hideLoading();
                    if (response.error) {
                        showError(response.error);
                    } else {
                        showExplanation(lastSelectedText, response.explanation);
                    }
                });
            } catch (error) {
                hideLoading();
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

    // Show explanation in chat
    function showExplanation(text, explanation) {
        lastSelectedText = text;
        lastExplanation = explanation;

        // Clear messages container
        messagesContainer.innerHTML = '';

        // Add user message
        const userMessage = document.createElement('div');
        userMessage.className = 'message user';
        userMessage.textContent = text;
        messagesContainer.appendChild(userMessage);

        // Add bot message
        const botMessage = document.createElement('div');
        botMessage.className = 'message bot';
        
        // Convert markdown to HTML (using a simple approach)
        const formattedExplanation = explanation
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
            
        botMessage.innerHTML = formattedExplanation;
        messagesContainer.appendChild(botMessage);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Show error message
    function showError(message) {
        const errorMessage = document.createElement('div');
        errorMessage.className = 'message error';
        errorMessage.textContent = `Error: ${message}`;
        messagesContainer.appendChild(errorMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Show notification
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 2000);
        }, 10);
    }

    // Show/hide loading state
    function showLoading() {
        regenerateButton.classList.add('loading');
        regenerateButton.disabled = true;
    }

    function hideLoading() {
        regenerateButton.classList.remove('loading');
        regenerateButton.disabled = false;
    }
}); 