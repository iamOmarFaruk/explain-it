// Cache for storing recent responses
const responseCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Rate limiting
const rateLimiter = {
    lastRequest: 0,
    minDelay: 1000, // Minimum delay between requests (1 second)
};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'explain') {
        handleExplanationRequest(request, sendResponse);
        return true; // Will respond asynchronously
    }
});

// Handle explanation requests
async function handleExplanationRequest(request, sendResponse) {
    try {
        const { text, settings } = request;
        
        // Check cache first
        const cacheKey = `${text}-${settings.model}`;
        const cachedResponse = responseCache.get(cacheKey);
        if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_EXPIRY) {
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

        // Make API request
        const response = await fetch('https://api.openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': chrome.runtime.getManifest().homepage_url || 'https://github.com/iamOmarFaruk',
            },
            body: JSON.stringify({
                model: settings.model,
                messages: [
                    {
                        role: 'system',
                        content: settings.systemInstructions
                    },
                    {
                        role: 'user',
                        content: `Please explain this text: "${text}"`
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();
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
        sendResponse({ error: error.message });
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

// Service workers don't have access to the window object
// Using the self global object instead for error handling
self.addEventListener('error', function(event) {
    console.error('Error in service worker:', event.message);
});

// Handle unhandled promise rejections in service worker context
self.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection in service worker:', event.reason);
}); 