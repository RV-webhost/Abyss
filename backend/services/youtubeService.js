// src/services/youtubeService.js
const { YoutubeTranscript } = require('@danielxceron/youtube-transcript');
const { getSubtitles } = require('youtube-captions-scraper'); // 🚨 Our new Layer 2 fallback

const extractVideoId = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const fetchVideoTitle = async (url) => {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${url}&format=json`);
    const data = await response.json();
    return data.title;
  } catch (error) {
    return "Unknown Title";
  }
};

const fetchTranscript = async (url) => {
  const videoId = extractVideoId(url);
  if (!videoId) return null;

  // ==========================================
  // LAYER 1: The Primary Scraper
  // ==========================================
  try {
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Primary scraper timed out")), 2500)
    );

    const transcript = await Promise.race([
        YoutubeTranscript.fetchTranscript(url),
        timeoutPromise
    ]);

    if (transcript && transcript.length > 0) return transcript;
    
  } catch (err) {
    console.warn(`[YouTube Service]: Primary scraper blocked/timed out for ${videoId}. Engaging Layer 2...`);
    
    // ==========================================
    // LAYER 2: The Fallback Scraper
    // ==========================================
    try {
      const fallbackTranscript = await getSubtitles({
        videoID: videoId,
        lang: 'en' 
      });

      // Normalize Layer 2's output to match Layer 1's structure so the controller doesn't break
      if (fallbackTranscript && fallbackTranscript.length > 0) {
        return fallbackTranscript.map(item => ({
          text: item.text,
          start: parseFloat(item.start),
          offset: parseFloat(item.start) 
        }));
      }
    } catch (fallbackErr) {
      console.error(`[YouTube Service Fatal]: All scraping layers failed for ${videoId}. Proceeding to Graceful Degradation.`);
      // Returning null triggers the AI to answer based purely on the video title and general knowledge
      return null; 
    }
  }
  
  return null;
};

module.exports = { extractVideoId, fetchVideoTitle, fetchTranscript };