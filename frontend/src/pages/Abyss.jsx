import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import api from '../services/api';
import { useAuth } from "../context/AuthContext";

function Abyss() {
  const { logout } = useAuth();
  const [videoUrl, setVideoUrl] = useState("https://www.youtube.com/watch?v=FjCgEbD2r4o");
  const [messages, setMessages] = useState([
    { role: "System", text: "UI is connected. Play a video and ask a doubt. I will automatically check the timestamp!" }
  ]);
  const [query, setQuery] = useState("");
  const [threadId, setThreadId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  
  const playerRef = useRef(null);
  const chatBoxRef = useRef(null);

  // --- NATIVE YOUTUBE API SETUP ---
  useEffect(() => {
    // Load the script only once
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else if (window.YT && window.YT.Player && videoUrl) {
        // If API is already loaded, we can init immediately if needed, 
        // but we'll wait for the user to click "Load" to follow your EJS logic.
    }
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  const extractVideoID = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const loadVideo = () => {
    const videoId = extractVideoID(videoUrl);
    if (!videoId) return alert("Invalid YouTube URL");

    resetSession();

    if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
      playerRef.current.loadVideoById(videoId);
    } else {
      playerRef.current = new window.YT.Player("youtube-player", {
        height: "100%",
        width: "100%",
        videoId: videoId,
        playerVars: { autoplay: 1, playsinline: 1 },
      });
    }
  };

  const resetSession = () => {
    setThreadId(null);
    setMessages([{ role: "System", text: "New session started." }]);
  };

  const getCurrentTimestamp = () => {
    if (!playerRef.current || !playerRef.current.getCurrentTime) return "00:00";
    let totalSeconds = Math.floor(playerRef.current.getCurrentTime());
    let minutes = Math.floor(totalSeconds / 60);
    let seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const sendDoubt = async () => {
    if (!query.trim() || isSending) return;

    const currentTimestamp = getCurrentTimestamp();
    const newMsg = { 
      role: "Student", 
      text: query, 
      time: threadId ? "Follow-up" : currentTimestamp 
    };
    
    setMessages((prev) => [...prev, newMsg]);
    setIsSending(true);

    const payload = { query };
    if (threadId) {
      payload.threadId = threadId;
    } else {
      payload.url = videoUrl;
      payload.timestamp = currentTimestamp;
    }

    setQuery("");

    try {
      const result = await api.post("/doubt", payload);

      if (result.success) {
        setThreadId(result.threadId);
        setMessages((prev) => [...prev, { role: "Abyss", text: result.data?.answer || "Processed." }]);
      } else {
        setMessages((prev) => [...prev, { role: "System Error", text: `⚠️ ${result.message}` }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: "Network Error", text: "🚨 Failed to connect to server." }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-gray-950 text-gray-100 h-screen overflow-hidden flex font-sans">
      {/* LEFT SIDE: VIDEO */}
      <div className="w-2/3 p-4 flex flex-col gap-4 border-r border-gray-800">
        <div className="flex items-center justify-between bg-gray-900 p-4 rounded-xl shadow-lg border border-gray-800">
          <h1 className="text-2xl font-bold text-red-500 tracking-wider">ABYSS.</h1>
          <div className="flex gap-4 items-center">
              <Link to="/roadmap" className="text-sm text-gray-400 hover:text-white transition">Go to Roadmap</Link>
              
              {/* Add this new Logout Button */}
              <button onClick={logout} className="text-sm font-semibold text-red-500 hover:text-red-400 transition">
                Logout
              </button>
            <div className="flex gap-2 w-96">
              <input
                type="text"
                placeholder="Paste YouTube Link Here..."
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-red-500 transition"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
              <button
                onClick={loadVideo}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition shadow-lg shadow-red-500/30"
              >
                Load
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-black rounded-xl overflow-hidden shadow-2xl relative">
          <div id="youtube-player" className="absolute top-0 left-0 w-full h-full"></div>
          {!playerRef.current && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              Paste a link and click Load to start watching.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE: CHAT */}
      <div className="w-1/3 flex flex-col bg-gray-900">
        <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center shadow-md z-10">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Virtual Tutor
          </h2>
          <button onClick={resetSession} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded transition">
            Clear Chat
          </button>
        </div>

        <div ref={chatBoxRef} className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 scroll-smooth">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`px-4 py-3 rounded-xl max-w-[90%] text-sm shadow-md ${
                msg.role === "Student"
                  ? "self-end bg-red-600 text-white rounded-tr-none"
                  : "self-start bg-gray-800 border border-gray-700 text-gray-200 rounded-tl-none"
              }`}
            >
              <div className="font-bold text-xs mb-1 opacity-80">
                {msg.role}
                {msg.time && <span className="text-[10px] opacity-70 ml-2">@ {msg.time}</span>}
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
            </div>
          ))}
        </div>

        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ask your doubt..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500 transition"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendDoubt()}
            />
            <button
              onClick={sendDoubt}
              disabled={isSending}
              className="bg-gray-100 hover:bg-white text-gray-900 px-5 py-3 rounded-lg font-bold transition flex items-center disabled:opacity-50"
            >
              {isSending ? "..." : "Send"}
            </button>
          </div>
          <div className="text-[10px] text-gray-500 mt-2 text-center">Timestamp is automatically captured from the video.</div>
        </div>
      </div>
    </div>
  );
}

export default Abyss;