let currentVideoData = null;

// Initialize when popup loads
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await checkCurrentVideo();
    setupEventListeners();
    await loadShortModePreference();
    setupVideoDataListener();
});

// Listen for video data updates from background script
function setupVideoDataListener() {
    // Poll for video data updates every second while popup is open
    const pollInterval = setInterval(async () => {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_VIDEO' });
            
            if (response && response.timestamp && (!currentVideoData || response.timestamp > (currentVideoData.timestamp || 0))) {
                console.log('Popup: Detected new video data from context menu:', response);
                currentVideoData = response;
                showVideoInfo(response);
                
                // Check if we already have a cached summary for this new video
                const cachedSummary = await chrome.runtime.sendMessage({ 
                    type: 'GET_CACHED_SUMMARY', 
                    url: response.url 
                });
                
                if (cachedSummary && cachedSummary.summary) {
                    console.log('Popup: Found cached summary for new context menu video, displaying it');
                    showSummary(cachedSummary.summary);
                } else {
                    // Auto-start summarization for new context menu selection only if no cached summary
                    console.log('Popup: No cached summary found, auto-starting summarization for new context menu video');
                    startSummarization();
                }
            }
        } catch (error) {
            console.error('Error polling for video data updates:', error);
        }
    }, 1000);
    
    // Clear interval when popup closes
    window.addEventListener('beforeunload', () => {
        clearInterval(pollInterval);
    });
}

// Load settings from storage
async function loadSettings() {
    const settings = await chrome.storage.sync.get(['geminiApiKey']);
    const apiKeyInput = document.getElementById('api-key');
    
    if (settings.geminiApiKey) {
        apiKeyInput.value = settings.geminiApiKey;
    } else {
        apiKeyInput.value = '';
    }
}

// Check for current video and auto-start if found
async function checkCurrentVideo() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_VIDEO' });
        
        if (response && response.url) {
            currentVideoData = response;
            showVideoInfo(response);
            
            // Check if we already have a cached summary for this video
            const cachedSummary = await chrome.runtime.sendMessage({ 
                type: 'GET_CACHED_SUMMARY', 
                url: response.url 
            });
            
            if (cachedSummary && cachedSummary.summary) {
                console.log('Popup: Found cached summary, displaying it');
                showSummary(cachedSummary.summary);
            } else {
                // Auto-start summarization only if no cached summary exists
                console.log('Popup: No cached summary found, auto-starting summarization');
                startSummarization();
            }
        } else {
            showDefaultState();
        }
    } catch (error) {
        console.error('Error checking current video:', error);
        showDefaultState();
    }
}

// Setup all event listeners
function setupEventListeners() {
    // Retry button (for errors)
    document.getElementById('retry-btn').addEventListener('click', startSummarization);
    
    // New summary button (short version)
    document.getElementById('new-summary-btn').addEventListener('click', startShortSummarization);
    
    // Copy button
    document.getElementById('copy-btn').addEventListener('click', copySummary);
    
    // Settings
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('close-settings').addEventListener('click', closeSettings);
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    
    // Short mode preference
    document.getElementById('default-short-mode').addEventListener('change', saveShortModePreference);
    
    // Modal click outside to close
    document.getElementById('settings-modal').addEventListener('click', (e) => {
        if (e.target.id === 'settings-modal') {
            closeSettings();
        }
    });
}

// Show video information
function showVideoInfo(videoData) {
    const videoTitle = document.getElementById('video-title');
    const videoUrl = document.getElementById('video-url');
    
    videoTitle.textContent = videoData.title || 'YouTube Video';
    videoUrl.textContent = videoData.url;
    
    document.getElementById('video-info').classList.remove('hidden');
}

// Summarize button removed - auto-start functionality

// Show default state
function showDefaultState() {
    hideAllSections();
    document.getElementById('default-section').classList.remove('hidden');
}

// Show progress section
function showProgress() {
    hideAllSections();
    document.getElementById('progress-section').classList.remove('hidden');
    updateProgress(0, "Initializing...", 0);
}

// Show summary section
function showSummary(summary) {
    hideAllSections();
    document.getElementById('summary-content').textContent = summary;
    document.getElementById('summary-section').classList.remove('hidden');
}

// Show error section
function showError(message) {
    hideAllSections();
    document.getElementById('error-message').textContent = message;
    document.getElementById('error-section').classList.remove('hidden');
}

// Hide all sections
function hideAllSections() {
    const sections = [
        'progress-section',
        'summary-section', 
        'error-section',
        'default-section'
    ];
    
    sections.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.add('hidden');
        }
    });
}

// Update progress bar and message
function updateProgress(step, message, progress) {
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('progress-message').textContent = message;
    document.getElementById('current-step').textContent = `Step ${step} of 5`;
}

// Get current tab URL as backup
async function getCurrentTabUrl() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab.url;
    } catch (error) {
        console.error('Error getting current tab URL:', error);
        return null;
    }
}

// Start summarization process
async function startSummarization() {
    console.log('Popup: startSummarization called with currentVideoData:', currentVideoData);
    
    // Check if short mode is enabled by default
    const settings = await chrome.storage.sync.get(['defaultShortMode']);
    const useShortMode = settings.defaultShortMode || false;
    console.log('Popup: Default short mode enabled:', useShortMode);
    
    if (useShortMode) {
        return startShortSummarization();
    }
    
    // Get current tab URL as backup
    const currentTabUrl = await getCurrentTabUrl();
    console.log('Popup: Current tab URL:', currentTabUrl);
    
    let urlToSummarize = currentVideoData?.url;
    
    // Only use current tab URL if no stored video data OR if stored data is from page detection
    // Context menu data should always take priority
    if (!currentVideoData || (currentVideoData.source !== 'contextMenu' && currentTabUrl && currentTabUrl.includes('youtube.com/watch?v='))) {
        urlToSummarize = currentTabUrl;
        console.log('Popup: Using current tab URL (no context menu data or page-detected data)');
    } else if (currentVideoData?.source === 'contextMenu') {
        console.log('Popup: Using context menu URL (priority):', urlToSummarize);
    }
    
    if (!urlToSummarize) {
        showError('No video URL found');
        return;
    }
    
    console.log('Popup: Final URL to summarize:', urlToSummarize);
    
    // Show simple loading state
    showProgress();
    updateProgress(1, "Connecting to Gemini 2.5 Flash...", 30);
    
    try {
        // Simulate some progress steps
        setTimeout(() => updateProgress(2, "Sending video for analysis...", 60), 500);
        setTimeout(() => updateProgress(3, "Processing summary... (may take up to 1 minute)", 90), 1000);
        
        // Send message to background script
        const response = await new Promise((resolve, reject) => {
            console.log('Popup: Sending SUMMARIZE_VIDEO message with URL:', urlToSummarize);
            chrome.runtime.sendMessage({
                type: 'SUMMARIZE_VIDEO',
                url: urlToSummarize
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                
                if (response.success) {
                    resolve(response);
                    return;
                }
                
                reject(new Error('Unexpected response format'));
            });
        });
        
        if (response.success && response.summary) {
            updateProgress(5, "Summary complete!", 100);
            
            // Cache the summary for future use
            await chrome.runtime.sendMessage({
                type: 'CACHE_SUMMARY',
                url: urlToSummarize,
                summary: response.summary,
                mode: 'NORMAL'
            });
            
            setTimeout(() => showSummary(response.summary), 500);
        }
        
    } catch (error) {
        console.error('Error during summarization:', error);
        showError(error.message || 'Failed to summarize video');
    }
}

// Start short summarization process
async function startShortSummarization() {
    console.log('Popup: startShortSummarization called with currentVideoData:', currentVideoData);
    
    // Get current tab URL as backup
    const currentTabUrl = await getCurrentTabUrl();
    console.log('Popup: Current tab URL:', currentTabUrl);
    
    let urlToSummarize = currentVideoData?.url;
    
    // Only use current tab URL if no stored video data OR if stored data is from page detection
    // Context menu data should always take priority
    if (!currentVideoData || (currentVideoData.source !== 'contextMenu' && currentTabUrl && currentTabUrl.includes('youtube.com/watch?v='))) {
        urlToSummarize = currentTabUrl;
        console.log('Popup: Using current tab URL (no context menu data or page-detected data)');
    } else if (currentVideoData?.source === 'contextMenu') {
        console.log('Popup: Using context menu URL (priority):', urlToSummarize);
    }
    
    if (!urlToSummarize) {
        showError('No video URL found');
        return;
    }
    
    console.log('Popup: Final URL to summarize (SHORT):', urlToSummarize);
    
    // Show simple loading state
    showProgress();
    updateProgress(1, "Connecting to Gemini 2.5 Flash...", 30);
    
    try {
        // Simulate some progress steps
        setTimeout(() => updateProgress(2, "Creating short summary...", 60), 500);
        setTimeout(() => updateProgress(3, "Extracting key points... (may take up to 1 minute)", 90), 1000);
        
        // Send message to background script with SHORT flag
        const response = await new Promise((resolve, reject) => {
            console.log('Popup: Sending SHORT SUMMARIZE_VIDEO message with URL:', urlToSummarize);
            chrome.runtime.sendMessage({
                type: 'SUMMARIZE_VIDEO',
                url: urlToSummarize,
                mode: 'SHORT'  // Flag for short summary
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                
                if (response.success) {
                    resolve(response);
                    return;
                }
                
                reject(new Error('Unexpected response format'));
            });
        });
        
        if (response.success && response.summary) {
            updateProgress(5, "Short summary complete!", 100);
            
            // Cache the short summary for future use
            await chrome.runtime.sendMessage({
                type: 'CACHE_SUMMARY',
                url: urlToSummarize,
                summary: response.summary,
                mode: 'SHORT'
            });
            
            setTimeout(() => {
                showSummary(response.summary);
                // Disable the "New Summary" button after use
                const newSummaryBtn = document.getElementById('new-summary-btn');
                newSummaryBtn.disabled = true;
                newSummaryBtn.textContent = '✅ Short Version Created';
                newSummaryBtn.style.opacity = '0.6';
                newSummaryBtn.style.cursor = 'not-allowed';
            }, 500);
        }
        
    } catch (error) {
        console.error('Error during short summarization:', error);
        showError(error.message || 'Failed to create short summary');
    }
}

// Copy summary to clipboard
async function copySummary() {
    const summaryContent = document.getElementById('summary-content').textContent;
    
    try {
        await navigator.clipboard.writeText(summaryContent);
        
        const button = document.getElementById('copy-btn');
        const originalText = button.textContent;
        button.textContent = '✅ Copied!';
        button.style.background = '#28a745';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
        }, 2000);
    } catch (error) {
        console.error('Error copying to clipboard:', error);
    }
}

// Settings functions
function openSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
}

async function saveSettings() {
    const apiKey = document.getElementById('api-key').value;
    
    try {
        await chrome.storage.sync.set({ geminiApiKey: apiKey });
        
        const button = document.getElementById('save-settings');
        const originalText = button.textContent;
        button.textContent = '✅ Saved!';
        button.style.background = '#28a745';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
            closeSettings();
        }, 1500);
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// Load short mode preference
async function loadShortModePreference() {
    const settings = await chrome.storage.sync.get(['defaultShortMode']);
    const checkbox = document.getElementById('default-short-mode');
    checkbox.checked = settings.defaultShortMode || false;
    console.log('Popup: Loaded short mode preference:', settings.defaultShortMode);
}

// Save short mode preference
async function saveShortModePreference() {
    const checkbox = document.getElementById('default-short-mode');
    await chrome.storage.sync.set({ defaultShortMode: checkbox.checked });
    console.log('Popup: Saved short mode preference:', checkbox.checked);
}