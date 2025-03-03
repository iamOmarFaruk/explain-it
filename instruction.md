Chrome Extension for OpenRouter AI Text Explanation
Develop a Chrome Extension for personal use that integrates with the OpenRouter API. The extension allows users to select text on any webpage, click a floating "Explain it" button, and view AI-generated explanations in a popup window with a macOS-native design aesthetic.
Core Features
1. Configuration Panel (Options Page)

Create a sleek macOS-style options page with:

API Key Field: Secure input for OpenRouter API key
Model Selector: Dropdown with available OpenRouter models
System Instructions: Text area for custom AI instructions
Theme Toggle: Light/Dark mode option that respects system preferences


Implement Chrome Storage API (sync) for persistent settings
Add validation for API key before saving
Include a "Test Connection" button to verify API key validity

2. Text Selection & Floating Button

Inject a content script that detects text selection events
When text is selected, display a floating button that:

Uses macOS-style design (rounded corners, subtle shadow)
Shows a small lightbulb or sparkle icon with "Explain" text
Positions intelligently near the selection without obscuring content
Animates smoothly when appearing/disappearing
Remains accessible via keyboard navigation



3. Explanation Popup Window

Create a macOS-style modal popup with:

Clean, minimal interface with appropriate padding and typography
Subtle window shadow and rounded corners matching macOS aesthetic
Custom CSS loader animation during API requests
Progress indicator for lengthy explanations
Copy, share, and feedback buttons
Responsive design that adjusts to content length



4. Interactive Chat Interface

Implement a chat interface that:

Uses macOS-style message bubbles
Supports markdown formatting in responses
Integrates Highlight.js for code syntax highlighting across languages
Shows typing indicators during AI responses
Allows conversation continuations with context maintenance
Provides options to regenerate or modify responses



Technical Implementation
File Structure
Copychrome-extension/
├── manifest.json
├── background/
│   └── background.js
├── content/
│   ├── content.js
│   ├── selection.js
│   └── styles/
│       ├── button.css
│       └── loader.css
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── styles/
│       ├── popup.css
│       ├── chat.css
│       └── animations.css
├── options/
│   ├── options.html
│   ├── options.js
│   └── styles/
│       └── options.css
├── utils/
│   ├── api.js
│   ├── storage.js
│   └── errorHandler.js
└── assets/
    ├── icons/
    │   ├── icon16.png
    │   ├── icon48.png
    │   ├── icon128.png
    │   └── button-icon.svg
    └── loaders/
        └── spinner.svg
API Integration

Create a dedicated API utility module with:

Async functions for OpenRouter API communication
Request rate limiting to prevent API abuse
Retry logic for transient failures (with exponential backoff)
Response caching for similar queries



Error Handling System

Implement a comprehensive error handling system that:

Categorizes errors (network, API, permission, configuration)
Provides user-friendly error messages with potential solutions
Logs detailed errors to console for debugging
Offers recovery options where possible
Handles edge cases (API quota exceeded, invalid responses, timeout)



CSS Loader

Create a custom macOS-style loader that:

Uses subtle animation matching macOS spinning wheel
Adapts to light/dark mode automatically
Shows progress indication when possible
Includes fallback for various browser compatibility



Security Considerations

Store API keys securely using Chrome's Storage API
Implement content security policy
Handle sensitive data appropriately
Include warning about sending selected text to external API

UI/UX Requirements
macOS Native Style Guidelines

Use SF Pro or similar system font
Implement macOS color palette:

Light theme: White backgrounds, light gray accents (#F5F5F7)
Dark theme: Dark gray backgrounds (#1E1E1E), with blue accents (#0071E3)


Apply subtle transparency effects where appropriate
Use macOS-style controls (buttons, toggles, dropdowns)
Include subtle hover and click animations

Accessibility

Support keyboard navigation
Ensure proper contrast ratios
Add screen reader compatibility
Make all interactive elements properly focusable
Use semantic HTML elements

Development Guidelines
Code Quality Standards

Use modern JavaScript (ES6+) with proper error handling
Implement modular architecture with separation of concerns
Add comprehensive comments explaining complex logic
Follow Chrome Extension best practices
Use consistent code style and naming conventions

Testing Requirements

Test on various websites with different text selection scenarios
Verify functionality across Chrome versions
Ensure responsive behavior on different screen sizes
Test error handling by simulating various failure modes

Performance Considerations

Optimize content script to minimize impact on page performance
Implement lazy loading for non-critical components
Use event delegation for efficient event handling
Optimize API calls to reduce latency

This enhanced specification provides clearer instructions for building a sophisticated Chrome Extension with macOS-native styling, robust error handling, and an optimized user experience.