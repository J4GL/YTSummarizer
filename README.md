# YouTube Video Summarizer Chrome Extension

**Ultra-Simple YouTube Summarizer** - Just sends the video URL directly to Google Gemini 2.5 Flash and gets an instant summary!

## ✨ How It Works

**Super Simple**: `"Summarize this video: [URL]"` → Gemini 2.5 Flash → Summary ✨

No transcript extraction needed - Gemini 2.5 Flash processes YouTube videos directly!

## 🚀 Features

- 🎯 **One-Click Summarization**: Click button, get summary
- 🖱️ **Right-Click Support**: Right-click any YouTube link to summarize
- ⚡ **Gemini 2.5 Flash**: Lightning-fast AI processing 
- 📊 **Progress Bar**: Visual feedback during processing
- 📋 **Copy Summary**: One-click copy to clipboard
- 🔧 **Easy Setup**: Just add your Gemini API key and start summarizing
- 🎨 **Clean UI**: Beautiful, modern interface

## 📥 Installation

1. **Download** this extension folder
2. **Open Chrome** → `chrome://extensions/`
3. **Enable "Developer mode"** (toggle top-right)
4. **Click "Load unpacked"** → Select this folder
5. **Add your API key** → Click extension icon → Settings → Enter your Gemini API key
6. **Done!** Ready to summarize videos

## 🎮 Usage

### Method 1: Direct Navigation
1. **Go to any YouTube video**
2. **Click extension icon**
3. **Click "▶️ Summarize Video"**
4. **Get instant summary!**

### Method 2: Right-Click Magic
1. **Right-click any YouTube link** (on any website)
2. **Select "Summarize YouTube Video"**
3. **Extension opens with summary ready**
4. **Click summarize and done!**

## ⚙️ Settings

- **API Key**: Required - Get your own from [Google AI Studio](https://aistudio.google.com/apikey)

## 🛠️ Technical Details

### Architecture
```
User Click → Video URL → Gemini 2.5 Flash → Summary → Display
```

**That's it!** No:
- ❌ Transcript extraction required
- ❌ XML parsing needed
- ❌ Complex video processing
- ❌ Multiple API calls

**Just:**
- ✅ Send video URL directly to Gemini 2.5 Flash
- ✅ Gemini processes the video content directly
- ✅ Get comprehensive summary back
- ✅ Show to user

### Files
- `manifest.json` - Extension config
- `background.js` - Handles API calls (very simple!)
- `popup.html/css/js` - UI with progress bar
- `content.js` - Detects YouTube videos

## 🎯 Supported Videos

**All YouTube videos** that Gemini 2.5 Flash can access:
- ✅ Public videos
- ✅ Educational content  
- ✅ Tutorials, reviews, etc.
- ❌ Private videos
- ❌ Age-restricted content (depends on Gemini)

## 🚨 Troubleshooting

**"Failed to summarize"**
- Video might be private/restricted
- Try a different public video
- Check your internet connection

**"API Error"**
- Make sure you've entered your API key in Settings
- Ensure you have API quota available
- Verify your API key is valid

## 🔮 Future Improvements

- Real-time progress updates
- Multiple summary lengths
- Video thumbnail display
- Summary history/caching

## 📄 License

See repository license for details.

---

**Made with ❤️ and Gemini 2.5 Flash**