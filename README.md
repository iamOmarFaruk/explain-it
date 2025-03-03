# Explain It - Chrome Extension

A Chrome extension that uses OpenRouter AI to provide instant explanations for selected text on any webpage. Built with a clean, macOS-style interface.

## Features

- 🔍 Select any text and get AI-powered explanations
- 💬 Chat-like interface with markdown support
- 🎨 Beautiful macOS-style design
- 🌓 Automatic dark/light mode
- 📋 Copy and share explanations
- ⚡ Fast response times with caching
- 🔒 Secure API key storage

## Installation

1. Clone this repository or download the ZIP file
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `chrome-extension` folder

## Configuration

1. Click the extension icon in Chrome's toolbar
2. Click the settings icon (⚙️) to open the options page
3. Enter your OpenRouter API key
4. Select your preferred AI model
5. Customize system instructions if desired
6. Save your settings

## Usage

1. Select any text on a webpage
2. Click the "Explain" button that appears
3. View the AI-generated explanation in the popup
4. Use the buttons to:
   - Regenerate the explanation
   - Copy the text
   - Share the explanation

## Development

The extension is built with vanilla JavaScript and follows Chrome's extension architecture:

- `manifest.json`: Extension configuration
- `background/`: Service worker for API communication
- `content/`: Content scripts for text selection
- `popup/`: Extension popup UI
- `options/`: Settings page

## Credits

Created by [Omar Faruk](https://github.com/iamOmarFaruk)

## License

MIT License - Feel free to use and modify for your needs. 