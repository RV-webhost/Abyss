import React, { useState, useRef, useEffect } from 'react';

const AbyssListener = ({ liveContextRef }) => {
    const [isListening, setIsListening] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Standby');
    const [error, setError] = useState('');
    const [showOnboarding, setShowOnboarding] = useState(false);
    
    const [liveTranscript, setLiveTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState(''); 
    
    const streamRef = useRef(null);
    const socketRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    
    // Auto-scroll ref
    const transcriptEndRef = useRef(null);

    // Auto-scroll effect
    useEffect(() => {
        if (transcriptEndRef.current) {
            transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [liveTranscript, interimTranscript]);

    useEffect(() => {
        return () => {
            killAllConnections(false); 
        };
    }, []);

    const handleConnectClick = () => {
        setShowOnboarding(true);
    };

    const getSupportedMimeType = () => {
        const types = [
            'audio/webm;codecs=opus',
            'audio/ogg;codecs=opus',
            'audio/mp4',
            'audio/webm'
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return ''; 
    };

    const startCapture = async () => {
        setShowOnboarding(false);
        setError('');
        setStatusMessage('Waiting for user permission...');
        setLiveTranscript('');
        setInterimTranscript('');
        
        if (liveContextRef) liveContextRef.current = '';

        const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
        if (!apiKey) {
            setError("CRITICAL: Vite cannot see your Deepgram API Key. Check .env!");
            setStatusMessage('Failed.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true, 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                stream.getTracks().forEach(track => track.stop());
                setError("Audio missing! You forgot to check 'Also share tab audio'.");
                setStatusMessage('Failed.');
                return;
            }

            streamRef.current = stream;
            setIsListening(true);
            setStatusMessage(`Live AI Tracking: ${audioTracks[0].label}`);

            // 🚨 BUG FIX: Isolate the audio track so video frames don't flood the websocket
            const audioOnlyStream = new MediaStream(audioTracks);

            // 🚨 BUG FIX: Added keepalive, punctuate, vad_events, and utterance_end_ms
            const wsUrl = 'wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&endpointing=300&keepalive=true&punctuate=true&vad_events=true&utterance_end_ms=1000';
            
            const socket = new WebSocket(wsUrl, ['token', apiKey]);
            socketRef.current = socket;

            socket.onopen = () => {
                setStatusMessage(`Live Tracking Active`);
                
                const mimeType = getSupportedMimeType();
                const options = mimeType ? { mimeType } : undefined;
                    
                const mediaRecorder = new MediaRecorder(audioOnlyStream, options); 
                mediaRecorderRef.current = mediaRecorder;
                
                mediaRecorder.ondataavailable = (event) => {
                    // 🚨 BUG FIX: Magic number removed, using WebSocket.OPEN
                    if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                        socket.send(event.data);
                    }
                };
                
                mediaRecorder.start(250); 
            };

            socket.onmessage = (message) => {
                try {
                    const received = JSON.parse(message.data);
                    const transcript = received.channel?.alternatives[0]?.transcript;
                    
                    if (transcript) {
                        if (received.is_final) {
                            setLiveTranscript(prev => {
                                // 🚨 BUG FIX: Prevent leading space when prev is empty
                                const newText = prev ? prev + " " + transcript : transcript;
                                if(liveContextRef) liveContextRef.current = newText;
                                return newText;
                            });
                            setInterimTranscript('');
                        } else {
                            setInterimTranscript(transcript);
                        }
                    }
                } catch (parseError) {
                    console.warn("Deepgram JSON Parse Error:", parseError);
                    // Silently ignore single malformed frames to prevent crash
                }
            };

            socket.onclose = (event) => {
                if (event.code !== 1000 && event.code !== 1005) {
                    console.warn("WebSocket closed abruptly:", event);
                    setError("Connection to AI Engine dropped by server.");
                }
                killAllConnections(false);
            };

            socket.onerror = (err) => {
                console.error("WebSocket Error:", err);
                setError("Connection to AI Engine lost.");
            };

            // 🚨 BUG FIX: Safely listen for any track ending natively
            stream.getTracks().forEach(track => {
                track.onended = () => {
                    killAllConnections(true);
                };
            });

        } catch (err) {
            console.error("Capture Error:", err);
            // 🚨 BUG FIX: Differentiate between User Denial and real errors
            if (err.name === 'NotAllowedError') {
                setError("Permission denied. You must select a tab to share.");
            } else {
                setError(err.message || "Capture failed.");
            }
            setStatusMessage('Standby');
            setIsListening(false);
        }
    };

    const killAllConnections = (resetErrorState = true) => {
        try {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.close(1000); 
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        } catch (cleanupError) {
            console.error("Error during cleanup:", cleanupError);
        } finally {
            streamRef.current = null;
            socketRef.current = null;
            mediaRecorderRef.current = null;
            
            setIsListening(false);
            setStatusMessage('Session Ended');
            if (resetErrorState) setError('');
        }
    };

    return (
        <div className="h-full flex flex-col p-4 bg-gray-900 text-gray-100 font-sans relative">
            
            {showOnboarding && (
                <div className="fixed inset-0 bg-gray-950/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-gray-900 border border-red-500 rounded-xl p-6 max-w-sm shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">CRITICAL STEP</h3>
                        <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                            To allow Abyss to hear the lecture, you must do two things on the next screen:
                        </p>
                        <ol className="text-sm text-gray-300 list-decimal pl-5 mb-6 space-y-2">
                            <li>Select the <strong>Chrome Tab</strong> option.</li>
                            <li>Click the current Abyss tab to select it.</li>
                            <li className="text-red-400 font-bold">Toggle "Also share tab audio" ON at the bottom.</li>
                        </ol>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowOnboarding(false)} className="text-sm text-gray-500 hover:text-white transition">Cancel</button>
                            <button onClick={startCapture} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold shadow-lg shadow-red-500/30 transition">I Understand, Start</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-lg flex items-center gap-2 text-red-500">
                    <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                    Live Context Extractor
                </h2>
                {!isListening ? (
                    <button onClick={handleConnectClick} className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition shadow-lg shadow-red-500/20">Connect Video</button>
                ) : (
                    <button onClick={() => killAllConnections(true)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition">Disconnect</button>
                )}
            </div>

            <div className="text-xs text-gray-400 mb-2">Status: <span className="text-gray-200">{statusMessage}</span></div>
            {error && <div className="text-xs text-red-500 font-bold mb-2">{error}</div>}

            <div className="flex-1 bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-y-auto font-mono text-sm leading-relaxed text-green-400 shadow-inner">
                {liveTranscript || interimTranscript ? (
                    <>
                        <span>{liveTranscript}</span>
                        <span className="text-green-700 ml-1">{interimTranscript}</span>
                        {/* 🚨 BUG FIX: Auto-scroll anchor */}
                        <div ref={transcriptEndRef} />
                    </>
                ) : "Awaiting video connection... (Click 'Connect Video' to begin)"}
            </div>
        </div>
    );
};

export default AbyssListener;