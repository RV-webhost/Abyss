import { useState } from "react";
import { Link } from "react-router-dom";
import api from '../services/api';
import { useAuth } from "../context/AuthContext";

function Roadmap() {
  const [topic, setTopic] = useState("");
  const [fullRoadmap, setFullRoadmap] = useState([]);
  const [activeStepIndex, setActiveStepIndex] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { logout } = useAuth();

  const generateRoadmap = async () => {
    if (!topic.trim()) return alert("Please enter a topic!");

    setIsGenerating(true);
    setFullRoadmap([]);
    setActiveStepIndex(null);

    try {
      const result = await api.post("/roadmap/generate", { topic });

      if (result.success) {
        setFullRoadmap(result.steps);
        setActiveStepIndex(0); 
      } else {
        alert("Error: " + result.message);
      }
    } catch (err) {
      alert("Server connection failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const activeStep = activeStepIndex !== null ? fullRoadmap[activeStepIndex] : null;

  return (
    <div className="bg-gray-950 text-gray-100 h-screen overflow-hidden flex flex-col font-sans">
      {/* HEADER */}
      <div className="bg-gray-900 p-6 border-b border-gray-800 shadow-xl z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-3xl font-black text-red-600 tracking-tighter">ABYSS.RDMP</h1>
          <div className="flex gap-2 w-1/2">
            <input
              type="text"
              placeholder="e.g., MERN Stack Career or How to push to GitHub"
              className="w-full px-5 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:border-red-500 transition shadow-inner"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generateRoadmap()}
            />
            <button
              onClick={generateRoadmap}
              disabled={isGenerating}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold transition shadow-lg shadow-red-500/20 disabled:bg-gray-600"
            >
              {isGenerating ? "Architecting..." : "Generate"}
            </button>
          </div>
          <Link to="/" className="text-sm text-gray-500 hover:text-white transition">
            Back to Tutor
          </Link>
          <button onClick={logout} className="text-sm font-semibold text-red-500 hover:text-red-400 transition">
            Logout
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR */}
        <div className="w-1/3 bg-gray-900 border-r border-gray-800 overflow-y-auto p-4 space-y-3">
          {isGenerating && (
            <div className="animate-pulse space-y-4 p-4">
              <div className="h-12 bg-gray-800 rounded"></div>
              <div className="h-12 bg-gray-800 rounded"></div>
              <div className="h-12 bg-gray-800 rounded"></div>
            </div>
          )}

          {!isGenerating && fullRoadmap.length === 0 && (
            <div className="text-center mt-20 text-gray-600">
              <p>Enter a topic above to generate a path.</p>
            </div>
          )}

          {!isGenerating && fullRoadmap.length > 0 && (
            <>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">
                Path Milestones
              </h3>
              {fullRoadmap.map((item, index) => (
                <button
                  key={index}
                  onClick={() => setActiveStepIndex(index)}
                  className={`w-full text-left p-4 rounded-xl transition flex items-center gap-4 group hover:bg-gray-800 active:scale-95 ${
                    activeStepIndex === index ? "bg-gray-800 border border-gray-700" : ""
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition ${
                    activeStepIndex === index ? "bg-red-600/20 border-red-500 text-red-500" : "bg-gray-800 border-gray-700 group-hover:border-red-500 text-white"
                  }`}>
                    {item.step}
                  </div>
                  <div className={`font-semibold ${activeStepIndex === index ? "text-white" : "text-gray-300 group-hover:text-white"}`}>
                    {item.title}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>

        {/* MAIN DETAILS AREA */}
        <div className="w-2/3 bg-gray-950 p-12 overflow-y-auto">
          {!activeStep ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-xl font-medium">Your interactive roadmap will appear here.</p>
            </div>
          ) : (
            <div className="max-w-3xl animate-fadeIn">
              
              {/* 🚨 ADDED: Step and Time Estimate Header row */}
              <div className="flex items-center gap-4 mb-2">
                <span className="text-red-500 font-bold text-sm uppercase tracking-widest">
                  Step {activeStep.step}
                </span>
                {activeStep.timeEstimate && (
                  <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded font-mono border border-gray-700">
                    ⏱️ {activeStep.timeEstimate}
                  </span>
                )}
              </div>

              <h2 className="text-5xl font-black mt-2 mb-6">{activeStep.title}</h2>
              
              {/* 🚨 FIXED: Changed .description to .concept */}
              <p className="text-gray-400 text-xl leading-relaxed mb-8">{activeStep.concept}</p>

              {/* 🚨 FIXED: Changed .command to .action */}
              {activeStep.action && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8 relative group">
                  <div className="text-xs text-gray-600 mb-2 font-mono uppercase">Execution Action</div>
                  <code className="text-green-400 font-mono text-lg">{activeStep.action}</code>
                </div>
              )}

              <div className="mt-12">
                <h4 className="text-sm font-bold text-gray-500 uppercase mb-4">Recommended for this step:</h4>
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(activeStep.videoQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-red-500 transition group"
                >
                  <div className="w-16 h-12 bg-red-600/20 rounded-lg flex items-center justify-center text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold">Tutorial Search: {activeStep.videoQuery}</div>
                    <div className="text-xs text-gray-500">Click to find the best video in Abyss</div>
                  </div>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Roadmap;