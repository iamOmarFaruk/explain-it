// Flag to track if the background script is initialized
let isInitialized = false;

// Cache for storing recent responses
const responseCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Default settings
const defaultSettings = {
    apiKey: '',
    model: 'openai/gpt-4o-mini',
    systemInstructions: 'Please explain the selected text in a clear and concise manner.'
};

// Rate limiting
const rateLimiter = {
    lastRequest: 0,
    minDelay: 1000, // Minimum delay between requests (1 second)
};

// Initialize the extension
function initialize() {
    if (isInitialized) return;
    
    console.log('Initializing background script');
    
    try {
        // Make sure we have access to storage
        chrome.storage.sync.get(defaultSettings, (items) => {
            if (chrome.runtime.lastError) {
                console.error('Error accessing storage:', chrome.runtime.lastError);
            } else {
                console.log('Successfully accessed storage');
            }
            
            // Mark as initialized regardless of the result
            isInitialized = true;
        });
    } catch (error) {
        console.error('Error during initialization:', error);
        // Mark as initialized even if there was an error
        isInitialized = true;
    }
}

// Initialize immediately
initialize();

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Make sure we're initialized
    if (!isInitialized) {
        initialize();
    }
    
    try {
        if (request.action === 'explain') {
            handleExplanationRequest(request, sendResponse);
            return true; // Will respond asynchronously
        } else if (request.action === 'followUp') {
            handleFollowUpRequest(request, sendResponse);
            return true; // Will respond asynchronously
        } else if (request.action === 'getSettings') {
            handleGetSettings(sendResponse);
            return true; // Will respond asynchronously
        } else if (request.action === 'openOptions') {
            try {
                chrome.runtime.openOptionsPage();
                sendResponse({ success: true });
            } catch (error) {
                console.error('Error opening options page:', error);
                sendResponse({ error: error.message });
            }
            return false; // No async response needed
        } else {
            // Unknown action
            sendResponse({ error: 'Unknown action: ' + request.action });
            return false;
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
        return false;
    }
});

// Handle getSettings requests
function handleGetSettings(sendResponse) {
    try {
        chrome.storage.sync.get(defaultSettings, (items) => {
            if (chrome.runtime.lastError) {
                console.error('Error getting settings:', chrome.runtime.lastError);
                sendResponse({ settings: defaultSettings });
            } else {
                sendResponse({ settings: items });
            }
        });
    } catch (error) {
        console.error('Error in handleGetSettings:', error);
        sendResponse({ settings: defaultSettings });
    }
}

// Handle explanation requests
async function handleExplanationRequest(request, sendResponse) {
    try {
        const { text, settings } = request;
        
        if (!text || !settings) {
            throw new Error('Missing required parameters');
        }
        
        // Check cache first
        const cacheKey = `${text}-${settings.model}`;
        const cachedResponse = responseCache.get(cacheKey);
        if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_EXPIRY) {
            console.log('Using cached response');
            sendResponse({ explanation: cachedResponse.explanation });
            return;
        }

        // Apply rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - rateLimiter.lastRequest;
        if (timeSinceLastRequest < rateLimiter.minDelay) {
            await new Promise(resolve => 
                setTimeout(resolve, rateLimiter.minDelay - timeSinceLastRequest)
            );
        }
        rateLimiter.lastRequest = Date.now();

        // Validate API key
        if (!settings.apiKey) {
            throw new Error('API key is not set. Please configure it in the extension options.');
        }

        console.log('Making API request to OpenRouter with model:', settings.model);
        
        // Make API request
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`,
                "HTTP-Referer": "https://github.com/iamOmarFaruk/explain-it",
                "X-Title": "Explain It Extension",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": settings.model,
                "messages": [
                    {
                        "role": "system",
                        "content": settings.systemInstructions
                    },
                    {
                        "role": "user",
                        "content": `Please explain this text in a clear and concise way: "${text}"`
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 1000
            })
        });

        if (!response.ok) {
            let errorMessage = `API error (${response.status})`;
            
            try {
                const errorData = await response.json();
                console.error('API error:', errorData);
                
                // Provide more specific error messages
                if (response.status === 401) {
                    errorMessage = 'Authentication error: Your API key is invalid';
                } else if (response.status === 403) {
                    errorMessage = 'Access denied: Your API key does not have permission to use this service';
                } else if (response.status === 429) {
                    errorMessage = 'Rate limit exceeded: Too many requests, please try again later';
                } else if (response.status === 404) {
                    errorMessage = 'Model not found: The selected AI model is not available';
                } else if (errorData.error && errorData.error.message) {
                    errorMessage = `API error: ${errorData.error.message}`;
                }
            } catch (e) {
                console.error('Error parsing API error response:', e);
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('API response received successfully');
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Unexpected API response format:', data);
            throw new Error('Unexpected API response format');
        }
        
        const explanation = data.choices[0].message.content;

        // Cache the response
        responseCache.set(cacheKey, {
            explanation,
            timestamp: Date.now()
        });

        // Clean up old cache entries
        cleanCache();

        sendResponse({ explanation });

    } catch (error) {
        console.error('Error in handleExplanationRequest:', error);
        sendResponse({ error: error.message || 'Unknown error occurred' });
    }
}

// Handle follow-up question requests
async function handleFollowUpRequest(request, sendResponse) {
    try {
        const { originalText, originalExplanation, followUpQuestion, settings } = request;
        
        if (!originalText || !followUpQuestion || !settings) {
            throw new Error('Missing required parameters');
        }
        
        // Apply rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - rateLimiter.lastRequest;
        if (timeSinceLastRequest < rateLimiter.minDelay) {
            await new Promise(resolve => 
                setTimeout(resolve, rateLimiter.minDelay - timeSinceLastRequest)
            );
        }
        rateLimiter.lastRequest = Date.now();

        // Validate API key
        if (!settings.apiKey) {
            throw new Error('API key is not set. Please configure it in the extension options.');
        }

        console.log('Making follow-up API request to OpenRouter with model:', settings.model);
        
        // Make API request
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`,
                "HTTP-Referer": "https://github.com/iamOmarFaruk/explain-it",
                "X-Title": "Explain It Extension",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": settings.model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that explains text and answers follow-up questions about it."
                    },
                    {
                        "role": "user",
                        "content": `Please explain this text: "${originalText}"`
                    },
                    {
                        "role": "assistant",
                        "content": originalExplanation || "I'll help you understand this text."
                    },
                    {
                        "role": "user",
                        "content": followUpQuestion
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 1000
            })
        });

        if (!response.ok) {
            let errorMessage = `API error (${response.status})`;
            
            try {
                const errorData = await response.json();
                console.error('API error:', errorData);
                
                // Provide more specific error messages
                if (response.status === 401) {
                    errorMessage = 'Authentication error: Your API key is invalid';
                } else if (response.status === 403) {
                    errorMessage = 'Access denied: Your API key does not have permission to use this service';
                } else if (response.status === 429) {
                    errorMessage = 'Rate limit exceeded: Too many requests, please try again later';
                } else if (response.status === 404) {
                    errorMessage = 'Model not found: The selected AI model is not available';
                } else if (errorData.error && errorData.error.message) {
                    errorMessage = `API error: ${errorData.error.message}`;
                }
            } catch (e) {
                console.error('Error parsing API error response:', e);
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Follow-up API response received successfully');
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Unexpected API response format:', data);
            throw new Error('Unexpected API response format');
        }
        
        const responseText = data.choices[0].message.content;

        sendResponse({ response: responseText });

    } catch (error) {
        console.error('Error in handleFollowUpRequest:', error);
        sendResponse({ error: error.message || 'Unknown error occurred' });
    }
}

// Clean up expired cache entries
function cleanCache() {
    const now = Date.now();
    for (const [key, value] of responseCache.entries()) {
        if (now - value.timestamp > CACHE_EXPIRY) {
            responseCache.delete(key);
        }
    }
}

// Listen for extension installation or update
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // Open options page on install
        chrome.runtime.openOptionsPage();
    }
});

// Service workers don't have access to the window object
// Using the self global object instead for error handling
self.addEventListener('error', function(event) {
    console.error('Error in service worker:', event.message);
});

// Handle unhandled promise rejections in service worker context
self.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection in service worker:', event.reason);
}); 