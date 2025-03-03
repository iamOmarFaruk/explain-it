// DOM Elements
const apiKeyInput = document.getElementById('apiKey');
const modelSelector = document.getElementById('modelSelector');
const systemInstructions = document.getElementById('systemInstructions');
const themeToggle = document.getElementById('themeToggle');
const testConnectionBtn = document.getElementById('testConnection');
const saveSettingsBtn = document.getElementById('saveSettings');

// Default settings
const defaultSettings = {
    apiKey: '',
    model: 'anthropic/claude-3-sonnet',
    systemInstructions: 'Please explain the selected text in a clear and concise manner.',
    darkMode: false
};

// Load saved settings
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const settings = await chrome.storage.sync.get(defaultSettings);
        
        // Populate form fields
        apiKeyInput.value = settings.apiKey;
        modelSelector.value = settings.model;
        systemInstructions.value = settings.systemInstructions;
        themeToggle.checked = settings.darkMode;
        
        // Apply theme
        updateTheme(settings.darkMode);
    } catch (error) {
        showNotification('Error loading settings: ' + error.message, 'error');
    }
});

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
        const response = await fetch('https://api.openrouter.ai/api/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Invalid API key or connection failed');
        }

        showNotification('API connection successful!', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
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