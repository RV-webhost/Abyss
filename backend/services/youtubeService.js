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
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    if (transcript.length === 0) return null;
    return transcript;
  } catch (err) {
    console.log("⚠️ Transcript fetch failed:", err.message);
    return null;
  }
};

module.exports = { extractVideoId, fetchVideoTitle, fetchTranscript };