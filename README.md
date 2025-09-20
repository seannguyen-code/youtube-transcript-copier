# YouTube Transcript Copier

A Chrome extension that automatically copies YouTube video transcripts (without timestamps) to your clipboard, along with a customizable prompt for summarization. Perfect for quickly extracting and summarizing video content.

## Features
- One-click transcript extraction from YouTube videos
- Automatically expands hidden descriptions
- Copies transcript text (no timestamps) with a prompt for easy summarization
- Works on YouTube desktop and mobile sites

## How It Works
1. Click the extension icon while viewing a YouTube video.
2. The extension will open the transcript panel (if available).
3. It extracts all transcript text lines and copies them to your clipboard, prefixed with a summarization prompt.
4. You can then paste the result into your favorite note-taking app or AI tool.

## Installation
1. Clone or download this repository.
2. Go to `chrome://extensions` in your browser.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select the project folder.
5. The extension icon should appear in your browser toolbar.

## Usage
- Navigate to any YouTube video page.
- Click the extension icon.
- The transcript (with prompt) will be copied to your clipboard.
- Paste it wherever you need!

## Files
- `manifest.json`: Chrome extension manifest (v3)
- `background.js`: Handles extension icon click and injects content script
- `content.js`: Extracts transcript and copies it to clipboard
- `icon.png`: Extension icon

## Permissions
- `activeTab`, `scripting`, `clipboardWrite`: Required for injecting scripts and copying to clipboard
- Host permissions for YouTube domains

## Publishing
1. Add this repository to GitHub.
2. Include this `README.md` and all source files.
3. Optionally, add screenshots or a demo GIF.
4. Tag a release and submit to the Chrome Web Store if desired.

## License
MIT
