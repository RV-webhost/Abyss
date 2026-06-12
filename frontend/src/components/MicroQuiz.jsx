import React, { useState } from 'react';

const MicroQuiz = ({ quizData }) => {
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState({});

  if (!quizData || !Array.isArray(quizData)) return null;

  const handleSelect = (qIndex, optIndex) => {
    if (showResults[qIndex]) return;
    setSelectedAnswers(prev => ({ ...prev, [qIndex]: optIndex }));
  };

  const checkAnswer = (qIndex) => {
    setShowResults(prev => ({ ...prev, [qIndex]: true }));
  };

  return (
    <div className="my-4 flex flex-col gap-6">
      <div className="bg-red-600/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center gap-2 w-max shadow-inner">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
        Interactive Knowledge Check
      </div>
      
      {quizData.map((q, qIndex) => {
        const isAnswered = showResults[qIndex];
        const selectedOpt = selectedAnswers[qIndex];
        
        return (
          <div key={qIndex} className="bg-gray-900 border border-gray-700 rounded-xl p-5 shadow-lg">
            <h4 className="text-gray-100 font-semibold mb-4 text-sm leading-relaxed">{q.question}</h4>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, optIndex) => {
                let btnClass = "text-left px-4 py-3 rounded-lg text-sm transition border ";
                
                if (!isAnswered) {
                  // 🚨 BUG FIX: Using standard hover:bg-gray-700
                  btnClass += selectedOpt === optIndex 
                    ? "bg-red-600/20 border-red-500 text-red-100" 
                    : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-700";
                } else {
                  if (optIndex === q.correctIndex) {
                    btnClass += "bg-green-600/20 border-green-500 text-green-400 font-bold";
                  } else if (selectedOpt === optIndex) {
                    btnClass += "bg-red-900/40 border-red-700 text-red-300 line-through opacity-70";
                  } else {
                    btnClass += "bg-gray-800 border-gray-700 text-gray-500 opacity-50";
                  }
                }

                return (
                  <button key={optIndex} onClick={() => handleSelect(qIndex, optIndex)} disabled={isAnswered} className={btnClass}>
                    {opt}
                  </button>
                );
              })}
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              {!isAnswered ? (
                <button 
                  onClick={() => checkAnswer(qIndex)} 
                  disabled={selectedOpt === undefined}
                  className="bg-gray-200 hover:bg-white text-gray-900 px-4 py-1.5 rounded text-xs font-bold transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Confirm Answer
                </button>
              ) : (
                <div className="text-xs bg-gray-950 p-3 rounded-lg border border-gray-800 text-gray-300 w-full transition-opacity duration-300">
                  <span className={selectedOpt === q.correctIndex ? "text-green-400 font-bold mr-2" : "text-red-400 font-bold mr-2"}>
                    {selectedOpt === q.correctIndex ? "Correct!" : "Incorrect."}
                  </span>
                  {q.explanation}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MicroQuiz;