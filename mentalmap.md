# Chrome Extension Project Mental Map

## Core Files

### Content Scripts
- `content.js` - Main content script that handles text selection, UI rendering, and code highlighting functionality
- `button.css` - Styles for the floating button, popup interface, and code syntax highlighting

### Background Scripts
- `background.js` - Manages API communication, handles extension settings, and processes explanation requests

### UI Components
- `popup.html` - Extension popup interface when clicking the extension icon
- `options.html` - Settings page for configuring API keys and preferences

### Utility Files
- `utils/highlight.min.js` - Third-party library for code syntax highlighting
- `utils/default.min.css` - Default styles for syntax highlighting themes

### Configuration
- `manifest.json` - Chrome extension configuration file defining permissions and resources
- `package.json` - Project dependencies and build scripts

## Directory Structure

```
chrome-extension/
├── content/
│   ├── content.js     # Main content script
│   └── styles/
│       └── button.css # UI styling
├── background/
│   └── background.js  # Background script
├── popup/
│   ├── popup.html    # Extension popup
│   └── popup.js      # Popup logic
├── options/
│   ├── options.html  # Settings page
│   └── options.js    # Settings logic
└── utils/
    ├── highlight.min.js  # Code highlighting
    └── default.min.css   # Highlighting styles
```

## Key Features by File

### content.js
- Text selection detection
- Floating button creation
- Popup interface management
- Code syntax highlighting
- Message streaming
- Bengali text support

### button.css
- Floating button styling
- Popup container design
- Code block formatting
- Dark mode support
- Language-specific syntax colors

### background.js
- API key management
- OpenAI API communication
- Extension settings storage
- Message handling between components

### popup.html/js
- Extension icon click interface
- Quick access to features
- Settings shortcuts

### options.html/js
- API key configuration
- Model selection
- Custom instructions setup
- Theme preferences

## Data Flow

1. User selects text → content.js detects and shows floating button
2. Click triggers API request → background.js handles communication
3. Response processed by content.js → displayed in popup
4. Code blocks handled by highlight.js → styled by button.css 