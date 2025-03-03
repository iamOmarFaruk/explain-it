// Initialize variables to store settings
let extensionSettings = {
    apiKey: '',
    model: 'openai/gpt-4o-mini',
    systemInstructions: 'Please explain the selected text in a clear and concise manner.'
};

// Set debug mode
const DEBUG = true;

function debugLog(...args) {
    if (DEBUG) {
        console.log('[ExplainIt Debug]', ...args);
    }
}

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
            debugLog('Settings loaded from background script');
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
                debugLog('Settings updated:', extensionSettings);
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

// Add Bengali font support to the document
function addBengaliFontSupport() {
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;700&display=swap';
    document.head.appendChild(fontLink);

    // Add CSS for Bengali text
    const bengaliStyle = document.createElement('style');
    bengaliStyle.textContent = `
        .bengali-code {
            font-family: 'Noto Sans Bengali', Arial, sans-serif !important;
            line-height: 1.5;
            direction: ltr;
        }
    `;
    document.head.appendChild(bengaliStyle);
}

// Add highlight.js link and script to document head
function addHighlightJs() {
    // Add CSS
    const highlightCss = document.createElement('link');
    highlightCss.rel = 'stylesheet';
    highlightCss.href = chrome.runtime.getURL('utils/default.min.css');
    document.head.appendChild(highlightCss);
    
    // Add additional styling for code blocks
    const codeBlockStyle = document.createElement('style');
    codeBlockStyle.textContent = `
        .code-block {
            position: relative;
            margin: 10px 0;
            border-radius: 6px;
            overflow: hidden;
        }
        
        .code-block pre {
            margin: 0;
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
        }
        
        .code-block code {
            font-family: 'Consolas', 'Monaco', 'Menlo', monospace;
            font-size: 0.9em;
            tab-size: 4;
        }
        
        .bengali-code {
            font-family: 'Noto Sans Bengali', Arial, sans-serif !important;
            font-size: 1.1em;
        }
        
        .copy-code-button {
            position: absolute;
            top: 5px;
            right: 5px;
            padding: 4px 8px;
            border: none;
            border-radius: 4px;
            background-color: rgba(255, 255, 255, 0.1);
            color: inherit;
            font-size: 12px;
            cursor: pointer;
            transition: background-color 0.2s;
            z-index: 10;
        }
        
        .copy-code-button:hover {
            background-color: rgba(255, 255, 255, 0.2);
        }

        /* Improve placeholder rendering */
        .explain-it-message.loading {
            display: flex;
            justify-content: center;
            padding: 20px 0;
        }

        .explain-it-popup-container.visible {
            display: flex;
        }

        .explain-it-popup {
            width: 90%;
            max-width: 500px;
            height: 90%;
            max-height: 600px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            border-radius: 12px;
            overflow: hidden;
        }
    `;
    document.head.appendChild(codeBlockStyle);
    
    // Check if highlight.js is already loaded
    if (typeof window.hljs !== 'undefined') {
        debugLog('highlight.js already loaded');
        return;
    }
    
    // Add JS
    const highlightJs = document.createElement('script');
    highlightJs.src = chrome.runtime.getURL('utils/highlight.min.js');
    
    // Initialize highlight.js after it loads
    highlightJs.onload = function() {
        debugLog('highlight.js loaded successfully');
        
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
                debugLog(`Found ${existingCodeBlocks.length} existing code blocks to highlight`);
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

// Call the function to add highlight.js and Bengali font support
addHighlightJs();
addBengaliFontSupport();

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
    
    debugLog('Explain button shown');
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

// Improved escapeHtml function to prevent double escaping
function escapeHtml(string) {
    // Check if already escaped
    if (string.includes('&lt;') || string.includes('&gt;') || string.includes('&amp;')) {
        return string;
    }
    
    const htmlEntities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return string.replace(/[&<>"']/g, (match) => htmlEntities[match]);
}

// Parse markdown text to HTML with improved code block handling
function parseMarkdown(text) {
    // Track code blocks separately for better handling
    const codeBlockPlaceholders = {};
    let codeBlockId = 0;
    
    // Replace all code blocks with unique placeholders
    let processedText = text.replace(/```(.*?)\n([\s\S]*?)```/g, (match, lang, code) => {
        const placeholder = `__CODE_BLOCK_${codeBlockId}__`;
        codeBlockPlaceholders[placeholder] = { lang: lang.trim(), code: code };
        codeBlockId++;
        return placeholder;
    });
    
    // Track inline code separately
    const inlineCodePlaceholders = {};
    let inlineCodeId = 0;
    
    // Replace all inline code with unique placeholders
    processedText = processedText.replace(/`([^`]+)`/g, (match, code) => {
        const placeholder = `__INLINE_CODE_${inlineCodeId}__`;
        inlineCodePlaceholders[placeholder] = code;
        inlineCodeId++;
        return placeholder;
    });
    
    // Process standard markdown
    // Headers
    processedText = processedText.replace(/^### (.*?)$/gm, '<h3 class="chat-heading">$1</h3>');
    processedText = processedText.replace(/^## (.*?)$/gm, '<h2 class="chat-heading">$1</h2>');
    processedText = processedText.replace(/^# (.*?)$/gm, '<h1 class="chat-heading">$1</h1>');
    
    // Bold
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    processedText = processedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Strikethrough
    processedText = processedText.replace(/~~(.*?)~~/g, '<del>$1</del>');
    
    // Lists - improve list handling
    // Unordered lists
    processedText = processedText.replace(/^\s*[\-\*] (.*?)$/gm, '<ul><li>$1</li></ul>');
    processedText = processedText.replace(/<\/ul>\s*<ul>/g, '');
    
    // Ordered lists
    processedText = processedText.replace(/^\s*(\d+)\. (.*?)$/gm, '<ol><li>$2</li></ol>');
    processedText = processedText.replace(/<\/ol>\s*<ol>/g, '');
    
    // Blockquote
    processedText = processedText.replace(/^\> (.*?)$/gm, '<blockquote>$1</blockquote>');
    processedText = processedText.replace(/<\/blockquote>\s*<blockquote>/g, '<br>');
    
    // Links
    processedText = processedText.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Line breaks
    processedText = processedText.replace(/\n/g, '<br>');
    
    // Restore inline code with proper HTML escaping
    for (const placeholder in inlineCodePlaceholders) {
        const escapedCode = escapeHtml(inlineCodePlaceholders[placeholder]);
        processedText = processedText.replace(placeholder, `<code>${escapedCode}</code>`);
    }
    
    // For code blocks, we'll return the placeholders and process them separately during streaming
    return {
        text: processedText,
        codeBlocks: codeBlockPlaceholders
    };
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

// Improved streaming content function
function streamContent(text, container) {
    // Parse the markdown and prepare the content with code blocks separated
    const parsedContent = parseMarkdown(text);
    const formattedText = parsedContent.text;
    const codeBlocks = parsedContent.codeBlocks;
    
    // Process thinking tags for thinker model
    const isThinkingModel = extensionSettings.model.toLowerCase().includes('thinker');
    let processedText = formattedText.replace(/<think>([\s\S]*?)<\/think>/gi, (match, content) => {
        if (isThinkingModel) {
            return `<div class="thinking-content">${content}</div>`;
        }
        return match;
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
    
    // Debug info
    debugLog('Starting streaming with text length:', processedText.length);
    debugLog('Code blocks found:', Object.keys(codeBlocks).length);
    
    // Streaming function
    const streamNextChunk = () => {
        if (currentIndex < processedText.length) {
            // Check if we're at a code block placeholder
            const codeBlockRegex = /__CODE_BLOCK_(\d+)__/;
            const remainingText = processedText.substring(currentIndex);
            const match = remainingText.match(codeBlockRegex);
            
            if (match && match.index === 0) {
                // Found a code block placeholder at the current position
                const placeholder = match[0];
                const blockId = match[1];
                debugLog('Found code block:', placeholder);
                
                // Remove the typing indicator
                if (typingIndicator.parentNode) {
                    container.removeChild(typingIndicator);
                }
                
                if (codeBlocks[placeholder]) {
                    const { lang, code } = codeBlocks[placeholder];
                    
                    // Check for Bengali content
                    const containsBengali = /[\u0980-\u09FF]/.test(code);
                    const bengaliClass = containsBengali ? 'bengali-code' : '';
                    
                    // Create code block HTML
                    const codeBlockHtml = `
                        <div class="code-block">
                            <button class="copy-code-button">Copy</button>
                            <pre><code class="hljs ${lang ? 'language-' + lang : ''} ${bengaliClass}">${escapeHtml(code)}</code></pre>
                        </div>
                    `;
                    
                    // Append code block using DOM methods to ensure proper structure
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = codeBlockHtml;
                    const codeBlockElement = tempDiv.firstChild;
                    container.appendChild(codeBlockElement);
                    
                    // Add copy button functionality
                    const copyButton = codeBlockElement.querySelector('.copy-code-button');
                    if (copyButton) {
                        copyButton.addEventListener('click', () => {
                            const codeContent = code;
                            navigator.clipboard.writeText(codeContent).then(() => {
                                copyButton.textContent = 'Copied!';
                                copyButton.style.backgroundColor = '#4a6cf7';
                                copyButton.style.color = 'white';
                                
                                setTimeout(() => {
                                    copyButton.textContent = 'Copy';
                                    copyButton.style.backgroundColor = '';
                                    copyButton.style.color = '';
                                }, 2000);
                            }).catch(err => {
                                console.error('Copy failed:', err);
                                copyButton.textContent = 'Failed';
                                copyButton.style.backgroundColor = '#f44336';
                                
                                setTimeout(() => {
                                    copyButton.textContent = 'Copy';
                                    copyButton.style.backgroundColor = '';
                                }, 2000);
                            });
                        });
                    }
                    
                    // Apply syntax highlighting
                    const codeElement = codeBlockElement.querySelector('pre code');
                    if (codeElement) {
                        try {
                            if (typeof window.hljs !== 'undefined') {
                                window.hljs.highlightElement(codeElement);
                            } else {
                                // Fallback to simple highlighting
                                applyFallbackHighlighting(codeElement, lang);
                            }
                        } catch (err) {
                            console.error('Syntax highlighting error:', err);
                            // Fallback to displaying without highlighting
                        }
                    }
                } else {
                    // Placeholder not found in codeBlocks, just insert as text
                    const textNode = document.createTextNode(placeholder);
                    container.appendChild(textNode);
                }
                
                // Add the typing indicator back
                container.appendChild(typingIndicator);
                
                // Skip past the placeholder
                currentIndex += placeholder.length;
            } else {
                // Stream regular content
                const chunk = processedText.substring(currentIndex, currentIndex + streamingSpeed);
                
                // Remove the typing indicator, add the chunk, then add the indicator back
                if (typingIndicator.parentNode) {
                    container.removeChild(typingIndicator);
                }
                
                // Append the chunk as HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = chunk;
                
                // Add each child node individually to maintain proper structure
                while (tempDiv.firstChild) {
                    container.appendChild(tempDiv.firstChild);
                }
                
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
            debugLog('Streaming completed');
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
            debugLog('Getting settings');
            
            // First show the popup with loading state
            showPopup(selectedText, '');
            const loadingElement = showLoading();
            
            // Update button state
            floatingButton.classList.add('loading');
            
            debugLog('Sending explanation request to background script');
            
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

// Improved function for fallback syntax highlighting
function applyFallbackHighlighting(element, language) {
    // Simple language detection
    const code = element.textContent;
    
    // Check for Bengali content - use special handling
    if (/[\u0980-\u09FF]/.test(code)) {
        element.classList.add('bengali-code');
        // For Bengali, we don't apply syntax highlighting to avoid breaking characters
        return;
    }
    
    // Apply basic syntax highlighting based on language
    let highlightedCode = '';
    
    // Basic language-specific highlighting patterns
    const patterns = {
        // Keywords by language
        keywords: {
            common: ['function', 'return', 'if', 'else', 'for', 'while', 'break', 'continue', 'class', 'true', 'false', 'null'],
            javascript: ['var', 'let', 'const', 'import', 'export', 'async', 'await'],
            python: ['def', 'import', 'from', 'as', 'with', 'None', 'True', 'False'],
            java: ['public', 'private', 'static', 'void', 'new', 'this', 'extends', 'implements'],
            go: ['func', 'package', 'import', 'type', 'struct', 'interface', 'map', 'chan', 'defer']
        },
        
        // Regex patterns for syntax elements
        strings: /(["'`])(.*?)\1/g,
        comments: /(\/\/.*|#.*|\/\*[\s\S]*?\*\/)/g,
        numbers: /\b(\d+(\.\d+)?)\b/g,
        functions: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
        classes: /\b([A-Z][a-zA-Z0-9_]*)\b/g
    };
    
    // Apply simple highlighting
    highlightedCode = code
        .replace(patterns.strings, '<span class="hljs-string">$&</span>')
        .replace(patterns.comments, '<span class="hljs-comment">$&</span>')
        .replace(patterns.numbers, '<span class="hljs-number">$&</span>')
        .replace(patterns.functions, '<span class="hljs-function">$1</span>(')
        .replace(patterns.classes, '<span class="hljs-class">$&</span>');
    
    // Apply language-specific keywords
    const allKeywords = [
        ...patterns.keywords.common,
        ...(patterns.keywords[language] || [])
    ];
    
    for (const keyword of allKeywords) {
        const keywordRegex = new RegExp(`\\b(${keyword})\\b`, 'g');
        highlightedCode = highlightedCode.replace(keywordRegex, '<span class="hljs-keyword">$&</span>');
    }
    
    // Set the highlighted content
    element.innerHTML = highlightedCode;
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
    debugLog('Showing notification:', message, type);
    
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