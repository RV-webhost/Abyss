import { useState, useEffect, useRef } from "react";
import api from '../services/api';
import { useAuth } from "../context/AuthContext";
import AbyssListener from '../components/AbyssListener';

// 🚨 1. IMPORT THE NEW ISOLATED QUIZ COMPONENT
import MicroQuiz from '../components/MicroQuiz'; 

import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// 🚨 THE DATA INTERCEPTOR
const MessageParser = ({ text }) => {
  if (!text) return null;
  
  const quizRegex = /\[QUIZ:\s*(\[[\s\S]*?\])\s*\]/;
  const match = text.match(quizRegex);
  
  let cleanText = text;
  let quizData = null;

  if (match) {
    cleanText = text.replace(match[0], ''); 
    try {
      let rawJsonString = match[1];
      rawJsonString = rawJsonString.replace(/```json/gi, '').replace(/```/g, '').trim();
      quizData = JSON.parse(rawJsonString);
    } catch (e) {} 
  }

  const imgRegex = "\\[Im" + "age of (.*?)\\]";
  const parts = cleanText.split(new RegExp(imgRegex, "g"));

  return (
    <div className="text-sm">
      {parts.map((part, index) => {
        if (index % 2 === 0) {
          return (
            <div key={`text-${index}`} className="whitespace-pre-wrap leading-relaxed [&>ul]:list-disc [&>ul]:ml-5 [&>ul]:my-2 [&>ol]:list-decimal [&>ol]:ml-5 [&>ol]:my-2 [&>blockquote]:border-l-4 [&>blockquote]:border-red-500 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:my-3 [&>blockquote]:bg-gray-900 [&>blockquote]:py-2 [&>blockquote]:rounded-r [&_strong]:text-red-400 [&_u]:text-white [&_u]:underline [&_u]:decoration-red-500 [&_u]:underline-offset-4">
              <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{
                  code({node, inline, className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="my-4 rounded-md overflow-hidden shadow-lg border border-gray-700">
                        <div className="bg-gray-800 text-gray-400 text-xs px-4 py-1.5 font-mono uppercase border-b border-gray-700 flex justify-between"><span>{match[1]}</span></div>
                        <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" customStyle={{ margin: 0, padding: '1rem', background: '#0d1117', fontSize: '0.85rem' }} {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                      </div>
                    ) : (<code className="bg-gray-800 text-red-300 px-1.5 py-0.5 rounded font-mono text-[0.8rem]" {...props}>{children}</code>);
                  }
                }}>{part}</ReactMarkdown>
            </div>
          );
        } else {
          return (
            <div key={`img-${index}`} className="my-3 p-3 bg-gray-950 border border-gray-700 rounded-lg shadow-inner flex flex-col gap-2">
              <span className="text-xs text-gray-400 font-mono">⚡ Visual Request: <strong className="text-gray-200">{part}</strong></span>
              <div className="h-32 w-full bg-gray-800 animate-pulse flex items-center justify-center rounded border border-gray-700"><span className="text-gray-500 text-xs">[ Image UI Placeholder ]</span></div>
            </div>
          );
        }
      })}
      
      {/* 🚨 THE CLEAN COMPONENT CALL */}
      {quizData && <MicroQuiz quizData={quizData} />}
    </div>
  );
};

function Abyss() {
  const { logout } = useAuth();
  
  const [mediaMode, setMediaMode] = useState("youtube"); 
  const [videoUrl, setVideoUrl] = useState("https://www.youtube.com/watch?v=FjCgEbD2r4o");
  const [localVideoFile, setLocalVideoFile] = useState(null);
  
  const [messages, setMessages] = useState([{ role: "System", text: "UI is connected. Load a video, connect the tab, and ask a doubt!" }]);
  const [query, setQuery] = useState("");
  const [threadId, setThreadId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  
  const liveContextRef = useRef("");
  const playerRef = useRef(null); 
  const localPlayerRef = useRef(null); 
  const chatBoxRef = useRef(null);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') playerRef.current.destroy();
      if (localVideoFile) URL.revokeObjectURL(localVideoFile); 
    };
  }, []);

  useEffect(() => {
    if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [messages]);

  const extractVideoID = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const loadVideo = () => {
    if (mediaMode === "local") return; 
    const videoId = extractVideoID(videoUrl);
    if (!videoId) return alert("Invalid YouTube URL");
    resetSession();
    if (playerRef.current && typeof playerRef.current.loadVideoById === "function") {
      playerRef.current.loadVideoById(videoId);
    } else {
      playerRef.current = new window.YT.Player("youtube-player", {
        height: "100%", width: "100%", videoId: videoId, playerVars: { autoplay: 1, playsinline: 1 },
      });
    }
  };

  const handleLocalFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (localVideoFile) URL.revokeObjectURL(localVideoFile);
    const objectUrl = URL.createObjectURL(file);
    setLocalVideoFile(objectUrl);
    resetSession();
  };

  const resetSession = () => {
    setThreadId(null);
    setMessages([{ role: "System", text: "New session started." }]);
  };

  const getCurrentTimestamp = () => {
    let totalSeconds = 0;
    if (mediaMode === "youtube" && playerRef.current && playerRef.current.getCurrentTime) {
      totalSeconds = Math.floor(playerRef.current.getCurrentTime());
    } else if (mediaMode === "local" && localPlayerRef.current) {
      totalSeconds = Math.floor(localPlayerRef.current.currentTime);
    }
    let minutes = Math.floor(totalSeconds / 60);
    let seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const sendDoubt = async () => {
    if (!query.trim() || isSending) return;
    const currentTimestamp = getCurrentTimestamp();
    
    setMessages((prev) => [ ...prev, { role: "Student", text: query, time: threadId ? "Follow-up" : currentTimestamp } ]);
    setMessages((prev) => [...prev, { role: "Abyss", text: "" }]);
    setIsSending(true);

    const payload = { 
        query, 
        timestamp: currentTimestamp,
        contextText: liveContextRef.current 
    };
    
    if (threadId) { payload.threadId = threadId; } else { payload.url = mediaMode === "youtube" ? videoUrl : "local_file"; }
    setQuery("");

    try {
      const response = await api.stream("/doubt", payload);
      if (!response.ok) {
        if (response.status === 401) throw new Error("Unauthorized: Please Logout and Login again.");
        throw new Error(`Server responded with status: ${response.status}`);
      }
      if (!response.body) throw new Error("No readable stream available");

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let aiFullResponse = "";
      let buffer = ""; 

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); 
        
        for (const part of parts) {
          if (part.startsWith('data: ')) {
            const dataStr = part.replace('data: ', '');
            try {
              const parsedData = JSON.parse(dataStr);
              if (parsedData.text) {
                aiFullResponse += parsedData.text;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].text = aiFullResponse;
                  return newMessages;
                });
              }
              if (parsedData.done && parsedData.threadId) setThreadId(parsedData.threadId);
              if (parsedData.error) {
                 setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].text += `\n\n[Error: ${parsedData.error}]`;
                  return newMessages;
                });
              }
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      setMessages((prev) => [ ...prev, { role: "System Error", text: `⚡ Connection Error: ${error.message}` } ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-gray-950 text-gray-100 h-screen overflow-hidden flex font-sans">
      <div className="w-2/3 p-4 flex flex-col gap-4 border-r border-gray-800">
        <div className="flex items-center justify-between bg-gray-900 p-4 rounded-xl shadow-lg border border-gray-800">
          <h1 className="text-2xl font-bold text-red-500 tracking-wider">ABYSS.</h1>
          <div className="flex gap-4 items-center w-3/4 justify-end">
            <button onClick={logout} className="text-sm font-semibold text-gray-500 hover:text-red-400 transition">Logout</button>
            
            <div className="flex gap-2 w-full max-w-xl">
              <select 
                className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 focus:outline-none focus:border-red-500 transition"
                value={mediaMode}
                onChange={(e) => setMediaMode(e.target.value)}
              >
                <option value="youtube">YouTube URL</option>
                <option value="local">Local MP4</option>
              </select>

              {mediaMode === "youtube" ? (
                <>
                  <input type="text" placeholder="Paste YouTube Link..." className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-red-500 transition" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                  <button onClick={loadVideo} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition shadow-lg shadow-red-500/30">Load</button>
                </>
              ) : (
                <div className="w-full relative bg-gray-800 border border-dashed border-gray-600 hover:border-red-500 rounded-lg transition flex items-center justify-center cursor-pointer overflow-hidden">
                  <input type="file" accept="video/mp4,video/webm" onChange={handleLocalFileUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  <span className="text-sm text-gray-400 font-medium">Click to select local video file</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 bg-black rounded-xl overflow-hidden shadow-2xl relative">
          {mediaMode === "youtube" ? (
            <>
              <div id="youtube-player" className="absolute top-0 left-0 w-full h-full"></div>
              {!playerRef.current && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">Paste a link and click Load to start watching.</div>
              )}
            </>
          ) : (
            <>
              {localVideoFile ? (
                <video ref={localPlayerRef} src={localVideoFile} controls className="w-full h-full outline-none" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">Upload a local video file above to start.</div>
              )}
            </>
          )}
        </div>

        <div className="h-48 bg-gray-900 border border-gray-800 rounded-xl shadow-lg overflow-hidden shrink-0">
            <AbyssListener liveContextRef={liveContextRef} />
        </div>
      </div>

      <div className="w-1/3 flex flex-col bg-gray-900">
        <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center shadow-md z-10">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Virtual Tutor
          </h2>
          <button onClick={resetSession} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded transition">Clear Chat</button>
        </div>

        <div ref={chatBoxRef} className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 scroll-smooth">
          {messages.map((msg, idx) => (
            <div key={idx} className={`px-4 py-3 rounded-xl max-w-[90%] text-sm shadow-md ${ msg.role === "Student" ? "self-end bg-red-600 text-white rounded-tr-none" : "self-start bg-gray-800 border border-gray-700 text-gray-200 rounded-tl-none" }`}>
              <div className="font-bold text-xs mb-1 opacity-80">
                {msg.role} {msg.time && <span className="text-[10px] opacity-70 ml-2">@ {msg.time}</span>}
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
            <input type="text" placeholder="Ask your doubt or explicitly request a quiz..." className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500 transition" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendDoubt()} />
            <button onClick={sendDoubt} disabled={isSending} className="bg-gray-100 hover:bg-white text-gray-900 px-5 py-3 rounded-lg font-bold transition flex items-center disabled:opacity-50">
              {isSending ? "..." : "Send"}
            </button>
          </div>
          <div className="text-[10px] text-gray-500 mt-2 text-center">Timestamp is automatically captured from the active video player.</div>
        </div>
      </div>
    </div>
  );
}

export default Abyss;