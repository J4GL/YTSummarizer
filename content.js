// Simple YouTube video detector
let currentVideoId = null;

function extractVideoId() {
  const url = window.location.href;
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

function detectVideo() {
  const videoId = extractVideoId();
  const currentUrl = window.location.href;
  
  console.log('detectVideo called:', {
    videoId,
    currentVideoId,
    currentUrl,
    pathname: window.location.pathname
  });
  
  if (videoId && videoId !== currentVideoId && window.location.pathname === '/watch') {
    currentVideoId = videoId;
    
    console.log('NEW YouTube video detected:', {
      videoId,
      url: currentUrl,
      title: document.title
    });
    
    chrome.runtime.sendMessage({
      type: 'VIDEO_DETECTED',
      videoId: videoId,
      url: currentUrl,
      title: document.title
    }).catch(error => {
      console.error('Error sending message:', error);
    });
  }
}

// Initial detection
detectVideo();

// Listen for URL changes (YouTube is SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(detectVideo, 100);
  }
}).observe(document, { subtree: true, childList: true });

// Fallback: check periodically
setInterval(detectVideo, 3000);