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




module.exports = { extractVideoId, fetchVideoTitle, fetchTranscript };