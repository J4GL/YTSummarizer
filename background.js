let currentVideoData = null;
let summaryCache = new Map(); // Cache for summaries by URL

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Background: Creating context menu...');
  
  // Remove any existing context menu first
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "summarizeYouTubeVideo",
      title: "Summarize YouTube Video",
      contexts: ["link", "page"],
      targetUrlPatterns: [
        "*://www.youtube.com/watch*",
        "*://youtube.com/watch*",
        "*://youtu.be/*",
        "*://www.youtu.be/*",
        "*://m.youtube.com/watch*"
      ]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Background: Error creating context menu:', chrome.runtime.lastError);
      } else {
        console.log('Background: Context menu created successfully');
      }
    });
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('Background: Context menu clicked!', {
    menuItemId: info.menuItemId,
    linkUrl: info.linkUrl,
    pageUrl: info.pageUrl
  });
  
  if (info.menuItemId === "summarizeYouTubeVideo" && info.linkUrl) {
    console.log('Background: Processing YouTube link:', info.linkUrl);
    
    const videoId = extractVideoIdFromUrl(info.linkUrl);
    console.log('Background: Extracted video ID:', videoId);
    
    if (videoId) {
      // Always update currentVideoData with new context menu selection
      currentVideoData = {
        videoId: videoId,
        url: info.linkUrl,
        title: `YouTube Video: ${videoId}`,
        source: 'contextMenu',
        timestamp: Date.now()  // Add timestamp to ensure freshness
      };
      
      console.log('Background: Set currentVideoData from context menu:', currentVideoData);
      
      // Clear any existing video data to force using context menu URL
      console.log('Background: Clearing any existing page-detected video data to prioritize context menu selection');
      
      // Set badge to indicate video is ready
      chrome.action.setBadgeText({
        text: "✓",
        tabId: tab.id
      });
      
      chrome.action.setBadgeBackgroundColor({
        color: "#28a745",
        tabId: tab.id
      });
      
      // Try to open popup, fallback to notification
      try {
        await chrome.action.openPopup();
        console.log('Background: Popup opened successfully');
      } catch (error) {
        console.log('Background: openPopup failed, creating notification:', error);
        
        // Show notification to click extension icon
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.svg',
          title: 'YouTube Video Ready',
          message: 'Click the extension icon to summarize this video!'
        });
      }
    } else {
      console.error('Background: Could not extract video ID from URL:', info.linkUrl);
    }
  }
});

// Extract video ID from various YouTube URL formats
function extractVideoIdFromUrl(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VIDEO_DETECTED') {
    console.log('Background: VIDEO_DETECTED received:', {
      videoId: message.videoId,
      url: message.url,
      title: message.title
    });
    
    currentVideoData = {
      videoId: message.videoId,
      url: message.url,
      title: message.title,
      source: 'pageDetection'
    };
    return false;
  }
  
  if (message.type === 'GET_CURRENT_VIDEO') {
    console.log('Background: GET_CURRENT_VIDEO requested, returning:', currentVideoData);
    sendResponse(currentVideoData);
    return false;
  }
  
  if (message.type === 'GET_CACHED_SUMMARY') {
    console.log('Background: GET_CACHED_SUMMARY requested for URL:', message.url);
    const cached = summaryCache.get(message.url);
    sendResponse(cached || null);
    return false;
  }
  
  if (message.type === 'CACHE_SUMMARY') {
    console.log('Background: CACHE_SUMMARY storing summary for URL:', message.url, 'Mode:', message.mode);
    summaryCache.set(message.url, {
      summary: message.summary,
      mode: message.mode,
      timestamp: Date.now()
    });
    sendResponse({ success: true });
    return false;
  }
  
  if (message.type === 'SUMMARIZE_VIDEO') {
    // Handle async operation properly
    const isShortMode = message.mode === 'SHORT';
    console.log('Background: Processing video summary request, short mode:', isShortMode);
    
    summarizeVideoWithGemini(message.url, isShortMode)
      .then(result => {
        try {
          sendResponse(result);
        } catch (e) {
          console.error('Failed to send response:', e);
        }
      })
      .catch(error => {
        try {
          sendResponse({ error: error.message || 'Failed to summarize video' });
        } catch (e) {
          console.error('Failed to send error response:', e);
        }
      });
    return true; // Keep message channel open for async response
  }
  
  return false;
});

// Main summarization function with retry logic
async function summarizeVideoWithGemini(videoUrl, isShortMode = false, retryCount = 0) {
  console.log('Background: About to summarize video:', videoUrl, 'Short mode:', isShortMode, 'Retry:', retryCount);
  
  const settings = await chrome.storage.sync.get(['geminiApiKey']);
  const apiKey = settings.geminiApiKey;
  
  if (!apiKey) {
    throw new Error("Please configure your Gemini API key in settings");
  }
  
  console.log('Background: Sending video to Gemini for analysis:', videoUrl);
  console.log('Background: Using fileData approach for direct video processing, short mode:', isShortMode);
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            fileData: {
              fileUri: videoUrl,
              mimeType: "video/*"
            }
          },
          {
            text: isShortMode 
              ? "Provide a SHORT summary of this video with ONLY the most important information:\n• Main topic (1 sentence)\n• Top 3 key points (bullet points)\n• Most important conclusion or takeaway (1 sentence)\n\nKeep it concise and focused on only the essential information."
              : "Provide a comprehensive summary of this video including:\n1. Main topic and key points\n2. Important insights or conclusions\n3. Any actionable takeaways\n4. Overall summary of the video's message"
          }
        ]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        responseModalities: ["TEXT"],
        thinkingConfig: {
          thinkingBudget: 1024  // Enable thinking mode
        }
      }
    })
  });
  
  console.log('Background: Gemini API response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Background: Gemini API error response:', errorText);
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch (e) {
      errorData = { message: errorText };
    }
    
    // Handle 503 errors with automatic retry
    if (response.status === 503 && retryCount < 3) {
      console.log(`Background: 503 Service Unavailable, retrying... Attempt ${retryCount + 1}/3`);
      
      // Wait before retrying (exponential backoff: 1s, 2s, 4s)
      const delay = Math.pow(2, retryCount) * 1000;
      console.log(`Background: Waiting ${delay/1000}s before retry`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Recursive retry
      return await summarizeVideoWithGemini(videoUrl, isShortMode, retryCount + 1);
    }
    
    // If all retries failed, include retry info in error
    const retryInfo = response.status === 503 && retryCount >= 3 ? ' (after 3 retries)' : '';
    throw new Error(`Gemini API error (${response.status})${retryInfo}: ${errorData.error?.message || errorData.message || 'Unknown error'}`);
  }
  
  const data = await response.json();
  console.log('Background: Full Gemini response:', JSON.stringify(data, null, 2));
  
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    console.error('Background: Invalid Gemini response structure:', data);
    throw new Error('Invalid response from Gemini API - no candidates found');
  }
  
  const candidate = data.candidates[0];
  console.log('Background: Candidate data:', JSON.stringify(candidate, null, 2));
  
  if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
    console.error('Background: Invalid candidate content structure:', candidate);
    throw new Error('Invalid response from Gemini API - no content parts found');
  }
  
  const summary = candidate.content.parts[0].text;
  
  if (!summary || summary.trim().length === 0) {
    throw new Error('Gemini returned empty content');
  }
  
  return { 
    success: true, 
    summary: summary.trim() 
  };
}