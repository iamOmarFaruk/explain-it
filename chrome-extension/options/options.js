// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const modelSelector = document.getElementById('modelSelector');
    const systemInstructions = document.getElementById('systemInstructions');
    const themeToggle = document.getElementById('themeToggle');
    const testConnectionBtn = document.getElementById('testConnection');
    const saveSettingsBtn = document.getElementById('saveSettings');

    // Default settings
    const defaultSettings = {
        apiKey: '',
        model: 'qwen/qwen2.5-vl-72b-instruct:free',
        systemInstructions: 'Please explain the selected text in a clear and concise manner.',
        darkMode: false
    };

    // Load saved settings
    loadSettings();

    async function loadSettings() {
        try {
            const settings = await chrome.storage.sync.get(defaultSettings);
            
            // Populate form fields
            apiKeyInput.value = settings.apiKey || '';
            modelSelector.value = settings.model || 'qwen/qwen2.5-vl-72b-instruct:free';
            systemInstructions.value = settings.systemInstructions || 'Please explain the selected text in a clear and concise manner.';
            themeToggle.checked = settings.darkMode || false;
            
            // Apply theme
            updateTheme(settings.darkMode);
        } catch (error) {
            console.error('Error loading settings:', error);
            showNotification('Error loading settings: ' + error.message, 'error');
        }
    }

    // Save settings
    saveSettingsBtn.addEventListener('click', async () => {
        try {
            const settings = {
                apiKey: apiKeyInput.value.trim(),
                model: modelSelector.value,
                systemInstructions: systemInstructions.value.trim(),
                darkMode: themeToggle.checked
            };

            if (!settings.apiKey) {
                throw new Error('API Key is required');
            }

            await chrome.storage.sync.set(settings);
            
            // Notify content scripts that settings have been updated
            try {
                // Query all tabs that might have content scripts
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated', settings });
                    });
                });
            } catch (e) {
                console.warn('Failed to notify content scripts:', e);
            }
            
            showNotification('Settings saved successfully!', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });

    // Test API connection
    testConnectionBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showNotification('Please enter an API key', 'error');
            return;
        }

        testConnectionBtn.disabled = true;
        testConnectionBtn.textContent = 'Testing...';

        try {
            console.log('Testing API connection with key:', apiKey.substring(0, 5) + '...');
            
            // Test with a simple chat completion request
            console.log('Testing chat completion API...');
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": "https://github.com/iamOmarFaruk/explain-it", 
                    "X-Title": "Explain It Extension",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": "qwen/qwen2.5-vl-72b-instruct:free", // Using a free model for testing
                    "messages": [
                        {
                            "role": "user",
                            "content": "Say hello in 5 words or less"
                        }
                    ]
                })
            });

            console.log('API response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('API error:', errorData);
                throw new Error(`API error (${response.status}): ${errorData.error?.message || 'Invalid API key'}`);
            }

            const data = await response.json();
            console.log('API response:', data);
            
            showNotification('API connection successful!', 'success');
        } catch (error) {
            console.error('Connection test error:', error);
            
            // Provide more helpful error messages
            let errorMessage = error.message;
            if (errorMessage.includes('Failed to fetch')) {
                errorMessage = 'Network error: Check your internet connection and make sure your API key is correct';
            } else if (errorMessage.includes('401')) {
                errorMessage = 'Authentication error: Your API key is invalid';
            } else if (errorMessage.includes('403')) {
                errorMessage = 'Access denied: Your API key does not have permission to use this service';
            } else if (errorMessage.includes('429')) {
                errorMessage = 'Rate limit exceeded: Too many requests, please try again later';
            }
            
            showNotification(errorMessage, 'error');
        } finally {
            testConnectionBtn.disabled = false;
            testConnectionBtn.textContent = 'Test Connection';
        }
    });

    // Theme toggle
    themeToggle.addEventListener('change', (e) => {
        updateTheme(e.target.checked);
    });

    // Update theme
    function updateTheme(isDark) {
        document.body.classList.toggle('dark-theme', isDark);
    }

    // Notification system
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
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

    // Add notification styles
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(100%);
            padding: 12px 24px;
            border-radius: 8px;
            background: var(--background);
            color: var(--text);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transition: transform 0.3s ease;
            z-index: 1000;
        }

        .notification.show {
            transform: translateX(-50%) translateY(0);
        }

        .notification.success {
            background: #34c759;
            color: white;
        }

        .notification.error {
            background: #ff3b30;
            color: white;
        }
    `;

    document.head.appendChild(style);
}); 