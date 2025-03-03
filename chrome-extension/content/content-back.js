// Initialize variables to store settings
let extensionSettings = {
    apiKey: '',
    model: 'openai/gpt-4o-mini',
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

// Add highlight.js link and script to document head
function addHighlightJs() {
    // Add CSS
    const highlightCss = document.createElement('link');
    highlightCss.rel = 'stylesheet';
    highlightCss.href = chrome.runtime.getURL('utils/default.min.css');
    document.head.appendChild(highlightCss);
    
    // Check if highlight.js is already loaded
    if (typeof window.hljs !== 'undefined') {
        console.log('highlight.js already loaded');
        return;
    }
    
    // Add JS
    const highlightJs = document.createElement('script');
    highlightJs.src = chrome.runtime.getURL('utils/highlight.min.js');
    
    // Initialize highlight.js after it loads
    highlightJs.onload = function() {
        console.log('highlight.js loaded successfully');
        
        // Configure highlight.js
        if (typeof window.hljs !== 'undefined') {
            // Ensure autodetection is enabled
            window.hljs.configure({
                languages: [], // Enable all languages
                ignoreUnescapedHTML: true
            });
            
            // If there are already code blocks in the page, highlight them
            const existingCodeBlocks = document.querySelectorAll('pre code.hljs');
            if (existingCodeBlocks.length > 0) {
                console.log(`Found ${existingCodeBlocks.length} existing code blocks to highlight`);
                existingCodeBlocks.forEach(block => {
                    window.hljs.highlightElement(block);
                });
            }
        }
    };
    
    // Handle errors
    highlightJs.onerror = function(error) {
        console.error('Failed to load highlight.js:', error);
    };
    
    document.head.appendChild(highlightJs);
}

// Call the function to add highlight.js
addHighlightJs();

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

// Parse markdown text to HTML
function parseMarkdown(text) {
    // First, temporarily protect code blocks from markdown processing
    const codeBlocks = [];
    let codeBlockCounter = 0;
    
    // Extract code blocks and replace with placeholders
    const textWithoutCodeBlocks = text.replace(/```(.*?)\n([\s\S]*?)```/g, (match) => {
        const placeholder = `__PROTECTED_CODE_BLOCK_${codeBlockCounter}__`;
        codeBlocks.push({ placeholder, content: match });
        codeBlockCounter++;
        return placeholder;
    });
    
    // Extract inline code and replace with placeholders
    const inlineCode = [];
    let inlineCodeCounter = 0;
    
    const textWithoutInlineCode = textWithoutCodeBlocks.replace(/`([^`]+)`/g, (match) => {
        const placeholder = `__PROTECTED_INLINE_CODE_${inlineCodeCounter}__`;
        inlineCode.push({ placeholder, content: match });
        inlineCodeCounter++;
        return placeholder;
    });
    
    // Process markdown on text without code
    let parsed = textWithoutInlineCode;
    
    // Headers (adjusted for chat context - using smaller font sizes)
    parsed = parsed.replace(/^### (.*?)$/gm, '<h3 class="chat-heading">$1</h3>');
    parsed = parsed.replace(/^## (.*?)$/gm, '<h2 class="chat-heading">$1</h2>');
    parsed = parsed.replace(/^# (.*?)$/gm, '<h1 class="chat-heading">$1</h1>');
    
    // Bold
    parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Strikethrough
    parsed = parsed.replace(/~~(.*?)~~/g, '<del>$1</del>');
    
    // Lists
    // Unordered lists
    parsed = parsed.replace(/^\s*[\-\*] (.*?)$/gm, '<ul><li>$1</li></ul>');
    parsed = parsed.replace(/<\/ul>\s*<ul>/g, '');
    
    // Ordered lists
    parsed = parsed.replace(/^\s*(\d+)\. (.*?)$/gm, '<ol><li>$2</li></ol>');
    parsed = parsed.replace(/<\/ol>\s*<ol>/g, '');
    
    // Blockquote
    parsed = parsed.replace(/^\> (.*?)$/gm, '<blockquote>$1</blockquote>');
    parsed = parsed.replace(/<\/blockquote>\s*<blockquote>/g, '<br>');
    
    // Links
    parsed = parsed.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Line breaks
    parsed = parsed.replace(/\n/g, '<br>');
    
    // Restore inline code
    inlineCode.forEach(item => {
        parsed = parsed.replace(item.placeholder, item.content);
    });
    
    // Restore code blocks
    codeBlocks.forEach(item => {
        parsed = parsed.replace(item.placeholder, item.content);
    });
    
    return parsed;
}

// Add message to chat with streaming effect
function addMessage(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.className = `explain-it-message ${sender}`;
    
    if (sender === 'bot') {
        // Create a container for the streaming content
        const contentContainer = document.createElement('div');
        contentContainer.className = 'message-content';
        messageElement.appendChild(contentContainer);
        
        // Add to DOM immediately but empty
        messagesContainer.appendChild(messageElement);
        
        // Parse and stream the content
        streamContent(text, contentContainer);
    } else {
        messageElement.textContent = text;
        messagesContainer.appendChild(messageElement);
    }
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Process and stream content to the container
function streamContent(text, container) {
    // First, process the markdown and prepare the content
    let formattedText = parseMarkdown(text);
    
    // Process thinking tags for thinker model
    const isThinkingModel = extensionSettings.model.toLowerCase().includes('thinker');
    formattedText = formattedText.replace(/<think>([\s\S]*?)<\/think>/gi, (match, content) => {
        if (isThinkingModel) {
            return `<div class="thinking-content">${content}</div>`;
        }
        return match;
    });
    
    // Process code blocks with syntax highlighting and copy button
    let codeBlocks = [];
    let codeBlockIndex = 0;
    
    formattedText = formattedText.replace(/```(.*?)\n([\s\S]*?)```/g, (match, language, code) => {
        // Clean up and normalize language identifier
        let normalizedLang = language.trim().toLowerCase();
        
        // Handle common language aliases
        const langMap = {
            // JavaScript and related
            'js': 'javascript',
            'ts': 'typescript',
            'jsx': 'javascript',
            'tsx': 'typescript',
            'node': 'javascript',
            
            // Web-related
            'html': 'xml',
            'htm': 'xml',
            'css': 'css',
            'scss': 'scss',
            'sass': 'scss',
            'less': 'less',
            'json': 'json',
            'xml': 'xml',
            'svg': 'xml',
            
            // C-family languages
            'c': 'c',
            'cpp': 'cpp',
            'c++': 'cpp',
            'csharp': 'csharp',
            'c#': 'csharp',
            'objc': 'objectivec',
            'objective-c': 'objectivec',
            
            // JVM languages
            'java': 'java',
            'kotlin': 'kotlin',
            'scala': 'scala',
            'groovy': 'groovy',
            
            // Mobile development
            'swift': 'swift',
            'dart': 'dart',
            'flutter': 'dart',
            
            // Scripting languages
            'py': 'python',
            'python': 'python',
            'rb': 'ruby',
            'ruby': 'ruby',
            'php': 'php',
            'perl': 'perl',
            'powershell': 'powershell',
            'ps': 'powershell',
            'ps1': 'powershell',
            
            // Shell/Bash
            'sh': 'bash',
            'shell': 'bash',
            'bash': 'bash',
            'zsh': 'bash',
            'cmd': 'dos',
            'batch': 'dos',
            
            // Systems programming
            'go': 'go',
            'golang': 'go',
            'rust': 'rust',
            'rs': 'rust',
            
            // Functional languages
            'haskell': 'haskell',
            'hs': 'haskell',
            'lisp': 'lisp',
            'clojure': 'clojure',
            'clj': 'clojure',
            'elixir': 'elixir',
            
            // Database
            'sql': 'sql',
            'mysql': 'sql',
            'postgresql': 'pgsql',
            'postgres': 'pgsql',
            'pgsql': 'pgsql',
            'mongodb': 'javascript',
            'mongo': 'javascript',
            
            // Markup and documentation
            'markdown': 'markdown',
            'md': 'markdown',
            'yaml': 'yaml',
            'yml': 'yaml',
            'toml': 'ini',
            
            // Configuration
            'ini': 'ini',
            'conf': 'apache',
            'config': 'ini',
            
            // No language specified
            '': ''
        };
        
        // Map language alias to proper name if needed
        if (langMap[normalizedLang]) {
            normalizedLang = langMap[normalizedLang];
        }
        
        // Escape HTML content for safe display - but only once
        // We don't want to double-escape as it causes the entity display issue
        const escapedCode = escapeHtml(code);
        
        // Add to code blocks array with placeholder
        const placeholder = `__CODE_BLOCK_${codeBlockIndex}__`;
        codeBlocks.push({
            placeholder,
            language: normalizedLang,
            code: escapedCode
        });
        
        codeBlockIndex++;
        return placeholder;
    });
    
    // Process inline code with proper escaping
    formattedText = formattedText.replace(/`(.*?)`/g, (match, code) => {
        // Escape inline code content - but only once
        const escapedCode = escapeHtml(code);
        return `<code>${escapedCode}</code>`;
    });
    
    // Start streaming the content
    let currentIndex = 0;
    const streamingSpeed = 15; // characters per frame
    
    // Start with an empty content
    container.innerHTML = '';
    
    // Create a typing indicator
    const typingIndicator = document.createElement('span');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = '<span>.</span><span>.</span><span>.</span>';
    container.appendChild(typingIndicator);
    
    // Streaming function
    const streamNextChunk = () => {
        if (currentIndex < formattedText.length) {
            // Check if we're at a code block placeholder
            const codeBlockMatch = codeBlocks.find(block => 
                formattedText.substring(currentIndex).startsWith(block.placeholder)
            );
            
            if (codeBlockMatch) {
                // Remove the typing indicator
                if (typingIndicator.parentNode) {
                    container.removeChild(typingIndicator);
                }
                
                // Replace placeholder with code block
                const languageClass = codeBlockMatch.language ? `language-${codeBlockMatch.language}` : '';
                const codeBlockHtml = `<div class="code-block">
                    <button class="copy-code-button">Copy</button>
                    <pre><code class="hljs ${languageClass}">${codeBlockMatch.code}</code></pre>
                </div>`;
                
                // Insert the code block using a temporary element to ensure proper parsing
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = codeBlockHtml;
                const codeBlockElement = tempDiv.firstChild;
                container.appendChild(codeBlockElement);
                
                // Add event listener to copy button
                const copyButton = codeBlockElement.querySelector('.copy-code-button');
                if (copyButton) {
                    copyButton.addEventListener('click', function() {
                        const codeBlock = this.nextElementSibling.querySelector('code');
                        const textToCopy = codeBlock.textContent;
                        
                        navigator.clipboard.writeText(textToCopy)
                            .then(() => {
                                // Show success feedback
                                const originalText = this.textContent;
                                this.textContent = 'Copied!';
                                this.style.backgroundColor = '#4a6cf7';
                                this.style.color = 'white';
                                
                                setTimeout(() => {
                                    this.textContent = originalText;
                                    this.style.backgroundColor = '';
                                    this.style.color = '';
                                }, 2000);
                            })
                            .catch(() => {
                                this.textContent = 'Failed!';
                                this.style.backgroundColor = '#f44336';
                                this.style.color = 'white';
                                
                                setTimeout(() => {
                                    this.textContent = 'Copy';
                                    this.style.backgroundColor = '';
                                    this.style.color = '';
                                }, 2000);
                            });
                    });
                }
                
                // Highlight the code
                const codeElement = codeBlockElement.querySelector('pre code');
                if (codeElement) {
                    try {
                        if (typeof window.hljs !== 'undefined') {
                            // Detect if the code might contain non-Latin scripts like Bengali
                            const containsNonLatin = /[\u0980-\u09FF]/.test(codeElement.textContent);
                            if (containsNonLatin) {
                                // If it contains Bengali script, add appropriate lang attribute
                                codeElement.setAttribute('lang', 'bn');
                            }
                            
                            // Apply highlighting
                            window.hljs.highlightElement(codeElement);
                        } else {
                            // Fallback to simple syntax highlighting
                            applyFallbackHighlighting(codeElement, codeBlockMatch.language);
                        }
                    } catch (error) {
                        console.error('Error applying syntax highlighting:', error);
                        
                        // Try to apply basic syntax highlighting as fallback
                        try {
                            applyFallbackHighlighting(codeElement, codeBlockMatch.language);
                        } catch (e) {
                            console.error('Even basic highlighting failed:', e);
                        }
                    }
                }
                
                // Add the typing indicator again
                container.appendChild(typingIndicator);
                
                // Skip past the placeholder
                currentIndex += codeBlockMatch.placeholder.length;
            } else {
                // Stream regular content
                const chunk = formattedText.substring(currentIndex, currentIndex + streamingSpeed);
                
                // Remove the typing indicator, add the chunk, then add the indicator back
                if (typingIndicator.parentNode) {
                    container.removeChild(typingIndicator);
                }
                
                container.innerHTML += chunk;
                container.appendChild(typingIndicator);
                
                currentIndex += streamingSpeed;
            }
            
            // Scroll to bottom as content is added
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // Continue streaming
            setTimeout(streamNextChunk, 10);
        } else {
            // Streaming complete
            if (typingIndicator.parentNode) {
                container.removeChild(typingIndicator);
            }
        }
    };
    
    // Start the streaming process
    setTimeout(streamNextChunk, 10);
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

// Add the escapeHtml helper function back since we're still using it
function escapeHtml(string) {
    const htmlEntities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return string.replace(/[&<>"']/g, (match) => htmlEntities[match]);
}

// Keep the simple syntax highlighting as a fallback
function highlightSyntax(code) {
    // Keywords for different languages
    const languages = {
        // Common programming keywords
        common: [
            'function', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 
            'continue', 'default', 'new', 'this', 'super', 'class', 'true', 'false', 'null', 
            'void', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in'
        ],
        
        // JavaScript and TypeScript
        javascript: [
            'var', 'let', 'const', 'import', 'export', 'from', 'async', 'await', 'yield',
            'delete', 'debugger', 'arguments', 'undefined', 'NaN', 'Infinity', 'globalThis',
            'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'Proxy', 'Reflect'
        ],
        
        // Java and related
        java: [
            'public', 'private', 'protected', 'static', 'final', 'abstract', 'extends', 
            'implements', 'interface', 'package', 'import', 'throws', 'throw', 'synchronized',
            'volatile', 'transient', 'native', 'strictfp', 'assert', 'enum', 'instanceof'
        ],
        
        // C-family
        c: [
            'int', 'char', 'float', 'double', 'void', 'long', 'short', 'signed', 'unsigned',
            'const', 'static', 'extern', 'register', 'volatile', 'struct', 'union', 'enum',
            'typedef', 'sizeof', 'auto', 'goto', 'inline', 'restrict'
        ],
        
        // C++ additional
        cpp: [
            'namespace', 'template', 'typename', 'using', 'operator', 'friend', 'virtual',
            'mutable', 'explicit', 'export', 'inline', 'constexpr', 'thread_local', 'decltype',
            'noexcept', 'nullptr', 'alignas', 'alignof', 'override', 'final'
        ],
        
        // C# additional
        csharp: [
            'namespace', 'using', 'partial', 'virtual', 'override', 'sealed', 'readonly',
            'ref', 'out', 'params', 'base', 'event', 'delegate', 'unsafe', 'checked', 'unchecked',
            'fixed', 'lock', 'get', 'set', 'value', 'where', 'yield', 'var', 'dynamic', 'async', 'await'
        ],
        
        // Python
        python: [
            'def', 'class', 'import', 'from', 'as', 'pass', 'with', 'lambda', 'global',
            'nonlocal', 'raise', 'assert', 'yield', 'del', 'try', 'except', 'finally',
            'async', 'await', 'None', 'True', 'False', 'and', 'or', 'not', 'is', 'in'
        ],
        
        // Go
        go: [
            'func', 'package', 'import', 'const', 'var', 'type', 'struct', 'interface',
            'map', 'chan', 'go', 'select', 'defer', 'fallthrough', 'goto', 'range', 
            'nil', 'iota', 'make', 'new', 'append', 'cap', 'close', 'complex', 'copy', 'delete',
            'len', 'panic', 'print', 'println', 'recover', 'string', 'int', 'bool', 'byte'
        ],
        
        // Rust
        rust: [
            'fn', 'let', 'mut', 'pub', 'use', 'mod', 'struct', 'enum', 'trait', 'impl',
            'type', 'const', 'static', 'match', 'move', 'ref', 'unsafe', 'where', 'Self',
            'self', 'super', 'crate', 'dyn', 'async', 'await', 'extern', 'union'
        ],
        
        // Swift
        swift: [
            'func', 'var', 'let', 'class', 'struct', 'enum', 'protocol', 'extension',
            'guard', 'if', 'else', 'switch', 'case', 'default', 'for', 'while', 'do',
            'break', 'continue', 'return', 'throw', 'throws', 'rethrows', 'try', 'catch',
            'defer', 'import', 'typealias', 'associatedtype', 'init', 'deinit', 'get', 'set',
            'willSet', 'didSet', 'open', 'public', 'internal', 'fileprivate', 'private',
            'static', 'final', 'required', 'optional', 'lazy', 'dynamic', 'infix', 'prefix', 'postfix'
        ],
        
        // Dart
        dart: [
            'abstract', 'dynamic', 'implements', 'as', 'else', 'import', 'assert', 'enum',
            'in', 'async', 'export', 'interface', 'await', 'extends', 'is', 'break', 'external',
            'library', 'case', 'factory', 'mixin', 'catch', 'false', 'new', 'class', 'final',
            'null', 'const', 'finally', 'on', 'continue', 'for', 'operator', 'covariant',
            'Function', 'part', 'default', 'get', 'rethrow', 'deferred', 'hide', 'return'
        ],
        
        // PHP
        php: [
            'echo', 'print', 'include', 'require', 'require_once', 'include_once', 'die',
            'exit', 'array', 'namespace', 'use', 'public', 'private', 'protected', 'static',
            'final', 'abstract', 'extends', 'implements', 'interface', 'trait', 'global',
            'as', 'clone', 'declare', 'goto', 'instanceof', 'insteadof', 'list'
        ]
    };
    
    // Combine all keywords
    const keywords = [
        ...languages.common,
        ...languages.javascript,
        ...languages.java,
        ...languages.c,
        ...languages.cpp,
        ...languages.csharp,
        ...languages.python,
        ...languages.go,
        ...languages.rust,
        ...languages.swift,
        ...languages.dart,
        ...languages.php
    ];
    
    // Replace PHP tags - special handling for PHP
    let highlighted = code.replace(/(&lt;\?php|\?&gt;)/g, '<span class="keyword">$&</span>');
    
    // Replace strings - handles most languages
    highlighted = highlighted.replace(/(".*?(?<!\\)"|'.*?(?<!\\)'|`.*?(?<!\\)`)/gs, '<span class="string">$&</span>');
    
    // Replace numbers
    highlighted = highlighted.replace(/\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, '<span class="number">$&</span>');
    
    // Replace comments for various languages
    // - C-style: // and /* ... */
    // - Python/Ruby: #
    // - SQL: --
    highlighted = highlighted.replace(/(\/\/.*|#.*|--.*|\/\*[\s\S]*?\*\/)/g, '<span class="comment">$&</span>');
    
    // Replace keywords
    for (const keyword of keywords) {
        const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
        highlighted = highlighted.replace(regex, '<span class="keyword">$&</span>');
    }
    
    // Replace special language-specific patterns
    
    // PHP variables
    highlighted = highlighted.replace(/(\$[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*)/g, '<span class="variable">$&</span>');
    
    // Function declarations - works for most C-family languages
    highlighted = highlighted.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, '<span class="function">$1</span>(');
    
    // Class names (pascal case identifiers often used for classes)
    highlighted = highlighted.replace(/\b([A-Z][a-zA-Z0-9_]*)\b/g, '<span class="class-name">$&</span>');
    
    // Type annotations (common in typed languages like TypeScript, Java, etc.)
    highlighted = highlighted.replace(/(:)\s*([A-Z][a-zA-Z0-9_]*|\b(string|number|boolean|any|void|object|unknown|never)\b)/g, '$1 <span class="type">$2</span>');
    
    return highlighted;
}

// Function to apply fallback syntax highlighting with language-specific enhancements
function applyFallbackHighlighting(element, language) {
    const code = element.innerHTML;
    let highlightedCode = '';
    
    // Apply language-specific variations of syntax highlighting
    switch (language) {
        case 'php':
            highlightedCode = highlightPhpSyntax(code);
            break;
        case 'java':
            highlightedCode = highlightJavaSyntax(code);
            break;
        case 'python':
            highlightedCode = highlightPythonSyntax(code);
            break;
        case 'go':
            highlightedCode = highlightGoSyntax(code);
            break;
        case 'rust':
            highlightedCode = highlightRustSyntax(code);
            break;
        case 'dart':
            highlightedCode = highlightDartSyntax(code);
            break;
        default:
            // Use the general syntax highlighter for other languages
            highlightedCode = highlightSyntax(code);
    }
    
    element.innerHTML = highlightedCode;
    
    // Add language-specific class for CSS styling
    if (language) {
        element.classList.add(`language-${language}`);
    }
}

// Language-specific syntax highlighting functions
function highlightPhpSyntax(code) {
    // Basic highlight
    let highlighted = highlightSyntax(code);
    
    // PHP-specific enhancements
    highlighted = highlighted.replace(/(\$this\b)/g, '<span class="keyword">$1</span>');
    highlighted = highlighted.replace(/(\b__[a-zA-Z]+__\b)/g, '<span class="keyword">$1</span>'); // Magic methods
    
    return highlighted;
}

function highlightJavaSyntax(code) {
    // Basic highlight
    let highlighted = highlightSyntax(code);
    
    // Java-specific enhancements
    highlighted = highlighted.replace(/\b(String|Integer|Boolean|Double|Float|Object|List|Map|Set|Collection)\b/g, 
        '<span class="class-name">$1</span>');
    
    return highlighted;
}

function highlightPythonSyntax(code) {
    // Basic highlight
    let highlighted = highlightSyntax(code);
    
    // Python-specific enhancements
    highlighted = highlighted.replace(/\b(self|cls)\b/g, '<span class="keyword">$1</span>');
    highlighted = highlighted.replace(/(@[a-zA-Z_][a-zA-Z0-9_]*)/g, '<span class="decorator">$1</span>');
    
    return highlighted;
}

function highlightGoSyntax(code) {
    // Basic highlight
    let highlighted = highlightSyntax(code);
    
    // Go-specific enhancements
    highlighted = highlighted.replace(/\b(error|string|int|bool|byte|float32|float64|uint|uint8|uint16|uint32|uint64|int8|int16|int32|int64)\b/g, 
        '<span class="type">$1</span>');
    
    return highlighted;
}

function highlightRustSyntax(code) {
    // Basic highlight
    let highlighted = highlightSyntax(code);
    
    // Rust-specific enhancements
    highlighted = highlighted.replace(/\b(String|Vec|Option|Result|Box|Rc|Arc)\b/g, 
        '<span class="class-name">$1</span>');
    highlighted = highlighted.replace(/'([a-zA-Z_][a-zA-Z0-9_]*)/, '<span class="lifetime">$&</span>');
    
    return highlighted;
}

function highlightDartSyntax(code) {
    // Basic highlight
    let highlighted = highlightSyntax(code);
    
    // Dart-specific enhancements
    highlighted = highlighted.replace(/\b(Widget|BuildContext|State|StatefulWidget|StatelessWidget)\b/g, 
        '<span class="class-name">$1</span>');
    
    return highlighted;
} 