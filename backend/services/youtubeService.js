// src/services/youtubeService.js
const { YoutubeTranscript } = require('@danielxceron/youtube-transcript');

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
  try {
    // 🚨 THE SPEED FIX: Injected directly into your service layer
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Transcript fetch timed out")), 2500)
    );

    const transcript = await Promise.race([
        YoutubeTranscript.fetchTranscript(url),
        timeoutPromise
    ]);

    if (!transcript || transcript.length === 0) return null;
    return transcript;
  } catch (err) {
    console.warn(`[YouTube Service Warning]: Transcript blocked or timed out. Bypassing.`);
    return null;
  }
};

module.exports = { extractVideoId, fetchVideoTitle, fetchTranscript };