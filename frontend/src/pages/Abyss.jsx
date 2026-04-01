import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import api from '../services/api';
import { useAuth } from "../context/AuthContext";

// 🚨 The Formatting Engines
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// 🚨 THE PARSER: Intercepts strings, parses Markdown, syntax-highlights code, and extracts images.
const MessageParser = ({ text }) => {
  if (!text) return null;
  
  // Regex to catch image tags. Check your IDE doesn't auto-remove the slashes/brackets!
  const regexString = "\\[Im" + "age of (.*?)\\]";
  const regex = new RegExp(regexString, "g");
  const parts = text.split(regex);

  return (
    <div className="text-sm">
      {parts.map((part, index) => {
        // EVEN INDEXES: Standard text processed by ReactMarkdown
        if (index % 2 === 0) {
          return (
            <div key={index} className="whitespace-pre-wrap leading-relaxed 
                [&>ul]:list-disc [&>ul]:ml-5 [&>ul]:my-2 
                [&>ol]:list-decimal [&>ol]:ml-5 [&>ol]:my-2
                [&>blockquote]:border-l-4 [&>blockquote]:border-red-500 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:my-3 [&>blockquote]:bg-gray-900 [&>blockquote]:py-2 [&>blockquote]:rounded-r
                [&_strong]:text-red-400 [&_u]:text-white [&_u]:underline [&_u]:decoration-red-500 [&_u]:underline-offset-4">
              
              <ReactMarkdown 
                rehypePlugins={[rehypeRaw]}
                components={{
                  // Code block interceptor for IDE-style rendering
                  code({node, inline, className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="my-4 rounded-md overflow-hidden shadow-lg border border-gray-700">
                        <div className="bg-gray-800 text-gray-400 text-xs px-4 py-1.5 font-mono uppercase border-b border-gray-700 flex justify-between">
                          <span>{match[1]}</span>
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ margin: 0, padding: '1rem', background: '#0d1117', fontSize: '0.85rem' }}
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      // Small inline `code` snippets
                      <code className="bg-gray-800 text-red-300 px-1.5 py-0.5 rounded font-mono text-[0.8rem]" {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {part}
              </ReactMarkdown>
            </div>
          );
        } 
        // ODD INDEXES: Extracted Image Tags
        else {
          return (
            <div key={index} className="my-3 p-3 bg-gray-950 border border-gray-700 rounded-lg shadow-inner flex flex-col gap-2">
              <span className="text-xs text-gray-400 font-mono">🔍 Visual Request: <strong className="text-gray-200">{part}</strong></span>
              <div className="h-32 w-full bg-gray-800 animate-pulse flex items-center justify-center rounded border border-gray-700">
                <span className="text-gray-500 text-xs">[ Image UI Placeholder ]</span>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
};

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
    
    // 1. Instantly add the user's message to the UI
    setMessages((prev) => [
      ...prev, 
      { role: "Student", text: query, time: threadId ? "Follow-up" : currentTimestamp }
    ]);
    
    // 2. Instantly add an empty AI placeholder message to the UI
    setMessages((prev) => [...prev, { role: "Abyss", text: "" }]);
    
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
      // 🚨 3. Call our new streaming API method
      const response = await api.stream("/doubt", payload);

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      if (!response.body) {
        throw new Error("No readable stream available");
      }

      // 🚨 4. The Stream Reader Pipeline
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let aiFullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        
        // If the stream is closed, break the loop
        if (done) break;

        // Decode the raw binary chunks into text
        const chunk = decoder.decode(value, { stream: true });
        
        // Split by the double newline that SSE requires
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            
            try {
              const parsedData = JSON.parse(dataStr);
              
              // A. If we get text, append it and update the React state
              if (parsedData.text) {
                aiFullResponse += parsedData.text;
                
                setMessages(prev => {
                  const newMessages = [...prev];
                  // Update the very last message in the array (the AI placeholder we made earlier)
                  newMessages[newMessages.length - 1].text = aiFullResponse;
                  return newMessages;
                });
              }

              // B. If we get the final thread ID, save it
              if (parsedData.done && parsedData.threadId) {
                  setThreadId(parsedData.threadId);
              }

              // C. Handle mid-stream backend errors gracefully
              if (parsedData.error) {
                 setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].text += `\n\n[Error: ${parsedData.error}]`;
                  return newMessages;
                });
              }
              
            } catch (e) {
              // Ignore JSON parse errors here. Sometimes chunks arrive split in half. 
              // The next loop will catch the rest of the string.
            }
          }
        }
      }
    } catch (error) {
      console.error("Stream failed:", error);
      setMessages((prev) => [
        ...prev, 
        { role: "System Error", text: "🚨 Failed to connect to the Abyss engine." }
      ]);
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
              
              {msg.role === "Student" || msg.role.includes("Error") || msg.role === "System" ? (
                 <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              ) : (
                 <MessageParser text={msg.text} />
              )}
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