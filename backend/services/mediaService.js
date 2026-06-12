// src/services/mediaService.js
const ytdl = require('@distube/ytdl-core');
const { DeepgramClient } = require('@deepgram/sdk');

// Fail-fast mechanism
if (!process.env.DEEPGRAM_API_KEY) {
    console.error("FATAL ERROR: DEEPGRAM_API_KEY is missing.");
    process.exit(1);
}

// v5 Syntax: Class instantiation. 
// Note: It automatically detects process.env.DEEPGRAM_API_KEY, no need to pass it in.
const deepgram = new DeepgramClient();

const mediaService = {
    /**
     * Extracts a pure audio stream from a YouTube URL.
     */
    extractAudioStream: (url) => {
        if (!ytdl.validateURL(url)) throw new Error("Invalid YouTube URL.");
        
        return ytdl(url, { 
            filter: 'audioonly',
            quality: 'highestaudio' 
        });
    },

    /**
     * Pipes a raw audio stream directly to Deepgram for real-time transcription.
     * Returns a structured array of timestamped text objects.
     */
    transcribeStream: async (audioStream) => {
        try {
            // v5 Syntax: Routing changed to listen.v1.media
            const response = await deepgram.listen.v1.media.transcribeFile(
                audioStream,
                {
                    model: 'nova-3', // Upgraded to their latest model
                    smart_format: true,
                    utterances: true,
                    punctuate: true
                }
            );

            // v5 Syntax: Navigating the new response object hierarchy
            return response.results.utterances.map(utterance => ({
                text: utterance.transcript,
                start: utterance.start,
                end: utterance.end,
                offset: utterance.start 
            }));

        } catch (err) {
            // v5 now throws raw errors directly to the catch block
            console.error(`[ASR Engine Failure]:`, err);
            throw new Error("Failed to transcribe media stream.");
        }
    },

    /**
     * Pipes a raw file buffer directly to Deepgram for real-time transcription.
     * Used for the Local Media Pipeline.
     */
    transcribeBuffer: async (audioBuffer, mimetype) => {
        try {
            const response = await deepgram.listen.v1.media.transcribeFile(
                audioBuffer,
                {
                    model: 'nova-3', 
                    smart_format: true,
                    utterances: true,
                    punctuate: true,
                    mimetype: mimetype 
                }
            );

            return response.results.utterances.map(utterance => ({
                text: utterance.transcript,
                start: utterance.start,
                end: utterance.end,
                offset: utterance.start
            }));

        } catch (err) {
            console.error(`[Buffer ASR Engine Failure]:`, err);
            throw new Error("Failed to transcribe local media buffer.");
        }
    }
};

module.exports = mediaService;