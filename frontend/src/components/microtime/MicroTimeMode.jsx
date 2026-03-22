import React, { useState, useEffect, useRef } from 'react';
import { useUser, useIsOnline } from '../../store/useAppStore';

const SCREENS = {
  PICKER: 1,
  ACTIVE: 2,
  RESULTS: 3,
  LOADING: 4
};

export default function MicroTimeMode() {
  const user = useUser();
  const isOnline = useIsOnline();

  const [screen, setScreen] = useState(SCREENS.PICKER);
  const [duration, setDuration] = useState(2);
  const [subject, setSubject] = useState('All');
  
  const [sessionId, setSessionId] = useState('');
  const [items, setItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState([]);
  
  const [timeLeft, setTimeLeft] = useState(0);
  const [itemStartTime, setItemStartTime] = useState(Date.now());
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [mcqAnswered, setMcqAnswered] = useState(null);

  const [finalStats, setFinalStats] = useState(null);
  const timerRef = useRef(null);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startSession = async () => {
    if (!user) {
      alert("Please log in first!");
      return; 
    }
    
    setScreen(SCREENS.LOADING);
    
    try {
      const payload = {
        user_id: user.id,
        duration_minutes: duration,
        subject: subject === 'All' ? null : subject
      };

      const res = await fetch('/api/microtime/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to start session');
      const data = await res.json();
      
      setSessionId(data.session_id);
      setItems(data.content || []);
      setCurrentIndex(0);
      setResults([]);
      setFlashcardFlipped(false);
      setMcqAnswered(null);
      
      const totalSeconds = duration * 60;
      setTimeLeft(totalSeconds);
      setItemStartTime(Date.now());
      
      setScreen(SCREENS.ACTIVE);
      
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopTimer();
            handleSessionEnd(data.session_id, []);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error(err);
      if (!isOnline) {
         // Fallback logic for offline mode would ideally go here.
         alert('Network error. Offline session not fully cached yet.');
      } else {
         alert('Error starting session. Please try again.');
      }
      setScreen(SCREENS.PICKER);
    }
  };

  const handleSessionEnd = async (activeSessionId = sessionId, forceResults = results) => {
    stopTimer();
    setScreen(SCREENS.LOADING);
    
    // Safety fallback payload for UI if API fails completely
    const fallbackStats = {
      streak: 0,
      accuracy: forceResults.length ? (forceResults.filter(r => r.correct).length / forceResults.length) * 100 : 0,
      oldResults: forceResults
    };

    try {
      const res = await fetch('/api/microtime/session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeSessionId,
          user_id: user?.id,
          items_result: forceResults
        })
      });
      
      if (!res.ok) throw new Error('Failed to complete session');
      const data = await res.json();
      setFinalStats({ ...data, oldResults: forceResults });
      setScreen(SCREENS.RESULTS);
    } catch (err) {
      console.error("Session end API failure:", err);
      if (!isOnline) {
        // Assume pending sync array in Zustand in production
        setFinalStats(fallbackStats);
        setScreen(SCREENS.RESULTS);
      } else {
        setFinalStats(fallbackStats);
        setScreen(SCREENS.RESULTS);
      }
    }
  };

  useEffect(() => {
    return () => stopTimer();
  }, []);

  const handleNextItem = (correct, forceResults = results) => {
    const currentItem = items[currentIndex];
    const timeSpent = (Date.now() - itemStartTime) / 1000;
    
    const newResult = {
      type: currentItem.type,
      card_id: currentItem.card_id || undefined,
      correct: correct,
      time_seconds: timeSpent,
      subject: currentItem.subject,
      topic: currentItem.topic
    };
    
    const updatedResults = [...forceResults, newResult];
    setResults(updatedResults);
    
    if (currentIndex + 1 >= items.length) {
      handleSessionEnd(sessionId, updatedResults);
    } else {
      setCurrentIndex((prev) => prev + 1);
      setItemStartTime(Date.now());
      setFlashcardFlipped(false);
      setMcqAnswered(null);
    }
  };

  const handleSkip = () => {
    handleNextItem(false); 
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --------------------------------------------------------------------------------
  // SCREEN 4: LOADING
  // --------------------------------------------------------------------------------
  if (screen === SCREENS.LOADING) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-gray-600 font-medium">Preparing your session...</p>
      </div>
    );
  }

  // --------------------------------------------------------------------------------
  // SCREEN 3: RESULTS
  // --------------------------------------------------------------------------------
  if (screen === SCREENS.RESULTS) {
    const acc = finalStats?.accuracy || 0;
    const streak = finalStats?.streak || 0;
    
    let msg = "Tough session. Revision scheduled automatically ✓";
    if (acc >= 80) msg = "Excellent! Keep the streak alive 🚀";
    else if (acc >= 50) msg = "Good effort. Review the missed ones 💪";

    // Just in case backend overrode the message, we use theirs if present
    if (finalStats?.message) msg = finalStats.message;

    const summaryResults = finalStats?.oldResults || [];
    const totalCards = summaryResults.filter(r => r.type === 'flashcard').length;
    const totalMcqs = summaryResults.filter(r => r.type === 'mcq').length;

    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-3xl shadow-xl text-center space-y-8 animate-fade-in-up border border-indigo-50">
        <h2 className="text-3xl font-extrabold text-gray-900">Session Complete!</h2>
        
        <div className="py-6">
          <div className="text-7xl font-black text-indigo-600 tracking-tighter drop-shadow-sm">
            {Math.round(acc)}%
          </div>
          <p className="text-indigo-400 mt-2 font-bold uppercase tracking-widest text-sm">Accuracy</p>
        </div>

        <div className="bg-gradient-to-br from-orange-400 to-orange-500 text-white font-black py-4 px-8 rounded-full inline-block text-xl shadow-lg border border-orange-300 transform -rotate-2 hover:rotate-0 transition-all cursor-default">
          🔥 {streak} DAY STREAK!
        </div>

        <div className="text-gray-700 bg-indigo-50 border border-indigo-100 rounded-2xl p-5 font-bold text-lg mb-4 shadow-inner">
          {msg}
        </div>

        <div className="flex justify-center gap-8 text-base text-gray-500 mb-8 bg-gray-50 rounded-2xl py-4 border border-gray-100">
          <div className="flex flex-col"><span className="font-black text-2xl text-gray-800">{totalCards}</span> <span className="text-xs uppercase font-bold text-gray-400">Flashcards</span></div>
          <div className="flex flex-col"><span className="font-black text-2xl text-gray-800">{totalMcqs}</span> <span className="text-xs uppercase font-bold text-gray-400">MCQs</span></div>
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={() => setScreen(SCREENS.PICKER)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold py-4 px-4 rounded-2xl shadow-lg transition-transform"
          >
            Study Again
          </button>
          <button 
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-4 px-4 rounded-2xl transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------------
  // SCREEN 2: ACTIVE SESSION
  // --------------------------------------------------------------------------------
  if (screen === SCREENS.ACTIVE) {
    const currentItem = items[currentIndex];
    
    return (
      <div className="max-w-xl mx-auto flex flex-col min-h-[550px] border border-gray-200 rounded-3xl shadow-2xl overflow-hidden bg-white">
        
        {!isOnline && (
          <div className="bg-yellow-100 text-yellow-800 text-sm text-center py-2 font-bold animate-pulse">
            You're offline — session will sync on reconnect
          </div>
        )}
        
        {/* Top Bar */}
        <div className="bg-white px-6 py-5 flex justify-between items-center border-b border-gray-100 relative z-10">
          <div className="flex items-center gap-4">
            <span className={`text-xl font-mono font-black tracking-tight px-4 py-1.5 rounded-lg ${timeLeft < 30 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>
              {formatTime(timeLeft)}
            </span>
            <div className="text-sm font-bold text-indigo-400 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
              {currentIndex + 1} / {items.length}
            </div>
          </div>
          <div className="flex bg-orange-50 text-orange-500 px-4 py-1.5 rounded-full font-black text-sm border border-orange-100 items-center justify-center shadow-sm">
             🔥 Streak
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="h-2 w-full bg-gray-100">
          <div 
            className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out" 
            style={{ width: `${(currentIndex / items.length) * 100}%` }}
          ></div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 flex flex-col justify-center relative bg-gray-50/50">
          
          {currentItem?.type === 'flashcard' && (
            <div 
              className="w-full max-w-sm mx-auto min-h-[300px] relative cursor-pointer group"
              style={{ perspective: '1000px' }}
              onClick={() => !flashcardFlipped && setFlashcardFlipped(true)}
            >
              <div 
                className="w-full h-full absolute transition-transform duration-500 rounded-3xl shadow-lg hover:shadow-xl"
                style={{ transformStyle: 'preserve-3d', transform: flashcardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
              >
                {/* Front */}
                <div 
                  className="absolute w-full h-full bg-white rounded-3xl p-8 flex flex-col justify-center items-center border-2 border-gray-100 hover:border-indigo-200 transition-colors" 
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <span className="text-xs uppercase tracking-widest text-indigo-400 font-black mb-6 bg-indigo-50 py-1 px-3 rounded-full">{currentItem.topic}</span>
                  <div className="text-2xl font-bold text-center text-gray-800 leading-snug">{currentItem.front}</div>
                  <div className="mt-10 text-sm text-gray-400 font-bold uppercase tracking-wider animate-bounce">↓ Tap to reveal ↓</div>
                </div>
                {/* Back */}
                <div 
                  className="absolute w-full h-full bg-indigo-50 rounded-3xl p-8 flex flex-col justify-center items-center border-2 border-indigo-200" 
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <div className="text-2xl font-bold text-center text-indigo-900 leading-snug overflow-y-auto">{currentItem.back}</div>
                </div>
              </div>
            </div>
          )}

          {currentItem?.type === 'mcq' && (
            <div className="w-full max-w-md mx-auto flex flex-col">
              <span className="text-xs uppercase tracking-widest text-indigo-400 font-black mb-3 self-start">{currentItem.topic}</span>
              <h3 className="text-2xl font-extrabold text-gray-800 mb-8 leading-snug">{currentItem.question}</h3>
              <div className="flex flex-col gap-3">
                {currentItem.options.map((opt, idx) => {
                  let btnClass = "text-left px-6 py-5 rounded-2xl border-2 font-bold transition-all duration-200 text-lg ";
                  if (mcqAnswered === null) {
                    btnClass += "border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 bg-white text-gray-700 shadow-sm";
                  } else {
                    if (idx === currentItem.correct_index) {
                      btnClass += "border-green-500 bg-green-50 text-green-800 shadow-md transform scale-[1.02]";
                    } else if (idx === mcqAnswered) {
                      btnClass += "border-red-500 bg-red-50 text-red-800";
                    } else {
                      btnClass += "border-gray-200 bg-gray-50 text-gray-400 opacity-50";
                    }
                  }
                  
                  return (
                    <button 
                      key={idx}
                      disabled={mcqAnswered !== null}
                      onClick={() => setMcqAnswered(idx)}
                      className={btnClass}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {mcqAnswered !== null && (
                <div className="mt-8 text-sm text-gray-700 bg-white border border-gray-200 p-5 rounded-xl shadow-sm font-medium animate-fade-in-up">
                  <span className="font-black text-indigo-600 block mb-1">Explanation:</span> 
                  {currentItem.explanation || "You've selected an answer. The correct logic follows the principles of " + currentItem.topic + "."}
                </div>
              )}
            </div>
          )}

          {currentItem?.type === 'formula' && (
            <div className="w-full max-w-sm mx-auto flex flex-col items-center">
              <span className="text-xs uppercase tracking-widest text-indigo-400 font-black mb-6">{currentItem.topic}</span>
              <div className="bg-gray-900 text-green-400 font-mono text-2xl py-8 px-8 rounded-2xl shadow-xl w-full text-center tracking-wider mb-8 border border-gray-800">
                {currentItem.formula_text}
              </div>
              <p className="text-gray-700 text-center font-semibold leading-relaxed text-lg bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                {currentItem.explanation}
              </p>
            </div>
          )}
          
        </div>

        {/* Bottom Actions */}
        <div className="bg-white border-t border-gray-100 p-5 flex justify-between items-center z-10">
          <button onClick={handleSkip} className="text-gray-400 hover:text-gray-700 font-bold px-5 py-3 rounded-xl hover:bg-gray-50 transition-colors">
            Skip
          </button>
          
          <div className="flex gap-3">
            {currentItem?.type === 'flashcard' && flashcardFlipped && (
              <>
                <button 
                  onClick={() => handleNextItem(false)} 
                  className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-black py-3 px-8 rounded-xl transition-colors"
                >
                  Missed ✗
                </button>
                <button 
                  onClick={() => handleNextItem(true)} 
                  className="bg-green-500 hover:bg-green-600 text-white font-black py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  Got it ✓
                </button>
              </>
            )}
            
            {currentItem?.type === 'mcq' && mcqAnswered !== null && (
              <button 
                onClick={() => handleNextItem(mcqAnswered === currentItem.correct_index)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-10 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                Next ➔
              </button>
            )}

            {currentItem?.type === 'formula' && (
              <button 
                onClick={() => handleNextItem(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-10 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                Got it ✓
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------------
  // SCREEN 1: DURATION PICKER
  // --------------------------------------------------------------------------------
  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-black text-gray-900 mb-6 tracking-tight">Micro-Time Study</h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto font-medium leading-relaxed">Short, focused burst sessions. Pick your available time limit and crush some concepts before your next class!</p>
      </div>

      <div className="flex justify-center mb-12">
        <div className="relative inline-block w-64">
           <select 
             value={subject} 
             onChange={(e) => setSubject(e.target.value)}
             className="block w-full bg-white border-2 border-gray-200 text-gray-800 py-4 px-6 pr-10 rounded-2xl font-bold shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 appearance-none cursor-pointer text-lg hover:border-gray-300 transition-colors"
             style={{ backgroundImage: `url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%234F46E5%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '1rem auto' }}
           >
             {['All', 'Physics', 'Chemistry', 'Biology', 'Maths'].map(sub => (
               <option key={sub} value={sub}>{sub === 'All' ? '📌  All Subjects' : sub}</option>
             ))}
           </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {[
          { min: 2, label: '2 flashcards', icon: '⚡' },
          { min: 5, label: '2 cards + 1 MCQ', icon: '🧠' },
          { min: 10, label: '3 cards + 2 MCQ + formulas', icon: '🏆' }
        ].map((opt) => (
          <div 
            key={opt.min}
            onClick={() => setDuration(opt.min)}
            className={`cursor-pointer rounded-3xl p-8 border-2 transition-all duration-300 transform flex flex-col items-center justify-center text-center ${duration === opt.min ? 'border-indigo-600 bg-indigo-50 shadow-xl scale-105 ring-4 ring-indigo-600 ring-opacity-10' : 'border-gray-200 bg-white shadow-sm hover:border-indigo-300 hover:shadow-md hover:-translate-y-1'}`}
          >
            <div className="text-5xl mb-6 drop-shadow-sm">{opt.icon}</div>
            <div className={`text-4xl font-black mb-3 ${duration === opt.min ? 'text-indigo-900' : 'text-gray-800'}`}>{opt.min} <span className="text-2xl font-bold">min</span></div>
            <div className={`text-base font-bold uppercase tracking-wider ${duration === opt.min ? 'text-indigo-500' : 'text-gray-400'}`}>{opt.label}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <button 
          onClick={startSession}
          className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-2xl py-5 px-16 rounded-full shadow-2xl hover:shadow-[0_20px_40px_-10px_rgba(79,70,229,0.5)] transition-all duration-300"
        >
          Start Session 🚀
        </button>
      </div>
    </div>
  );
}
