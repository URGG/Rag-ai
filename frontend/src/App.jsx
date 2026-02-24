import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, FileText, Terminal, Bot, Database, User, Activity, UploadCloud, Layout, Settings, AlertCircle, Cpu } from 'lucide-react';
function App() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Workspace initialized. Agentic RAG and Streaming active." }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [stagedCommand, setStagedCommand] = useState(null); 
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping, stagedCommand]);

  // --- DRAG AND DROP ---
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    for (let file of files) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("http://127.0.0.1:8000/upload", {
          method: "POST",
          body: formData,
        });
        const result = await response.json();
        setMessages(prev => [...prev, { 
          role: 'ai', 
          text: `Successfully indexed ${result.filename} into workspace memory.` 
        }]);
      } catch (err) {
        console.error("Upload error", err);
      }
    }
  };

  // --- AUTOMATION APPROVAL ---
  const runApproval = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/approve_command', { method: 'POST' });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', text: `Terminal Output:\n${data.output || data.error}` }]);
      setStagedCommand(null);
    } catch (error) {
       setMessages(prev => [...prev, { role: 'ai', text: "Error: Failed to execute command." }]);
    }
  };

  // --- THE STREAMING CHAT LOGIC ---
  const handleSend = async () => {
    if (!input) return;
    
    if (input === 'test command') {
      try {
         const res = await fetch('http://127.0.0.1:8000/request_command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: 'dir' }), 
         });
         const data = await res.json();
         setStagedCommand(data.command);
         setInput("");
         return;
      } catch (e) {
          console.error(e);
      }
    }

    const userText = input;
    setInput("");
    
    setMessages(prev => [
      ...prev, 
      { role: 'user', text: userText },
      { role: 'ai', text: "" } 
    ]);
    setIsTyping(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userText }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        setMessages(prev => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            text: newMessages[lastIndex].text + chunk
          };
          return newMessages;
        });
      }
    } catch (error) {
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        newMessages[lastIndex] = { role: 'ai', text: "Error: Connection to backend failed." };
        return newMessages;
      });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex h-screen bg-white text-gray-800 font-sans selection:bg-blue-200 overflow-hidden relative"
    >
      {/* DRAG OVERLAY - Frosted Glass */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center pointer-events-none transition-all">
          <div className="border border-gray-200 p-12 rounded-2xl bg-white shadow-xl flex flex-col items-center gap-4">
            <UploadCloud size={40} className="text-gray-400" />
            <p className="text-gray-600 font-medium text-lg">Drop files to add to Workspace</p>
          </div>
        </div>
      )}

      {/* SIDEBAR - Notion Style Light Gray */}
      <div className="w-64 bg-[#F7F7F5] border-r border-[#EBEBEA] flex flex-col z-10">
        <div className="p-4 flex items-center gap-2 mb-2 hover:bg-gray-200/50 mx-2 mt-2 rounded-md cursor-pointer transition-colors">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            K
          </div>
          <h1 className="font-semibold text-sm text-gray-700">Kernel Workspace</h1>
        </div>
        
        <div className="flex-1 px-3 space-y-6 overflow-y-auto">
          {/* Section: Knowledge */}
          <div>
            <div className="flex items-center gap-2 mb-1 px-2 text-xs font-semibold text-gray-500">
              Files
            </div>
            <div className="space-y-0.5">
              {['emulator.c', 'notes.pdf'].map(file => (
                <div key={file} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-200/50 cursor-pointer transition-colors">
                  <FileText size={16} className="text-gray-400" />
                  <span className="truncate">{file}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Status */}
          <div className="pt-4 border-t border-[#EBEBEA]">
            <div className="flex items-center gap-2 mb-2 px-2 text-xs font-semibold text-gray-500">
              System
            </div>
            <div className="px-2 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 flex items-center gap-1"><Cpu size={12}/> Model</span>
                <span className="text-gray-700 bg-gray-200/60 px-1.5 py-0.5 rounded">Llama 3</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 flex items-center gap-1"><Activity size={12}/> Status</span>
                <span className="text-emerald-600 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>Online</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Profile Area */}
        <div className="p-3 border-t border-[#EBEBEA]">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-200/50 cursor-pointer transition-colors">
             <Settings size={16} className="text-gray-400" />
             <span>Settings</span>
          </div>
        </div>
      </div>

      {/* MAIN VIEW */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          <div className="max-w-3xl mx-auto space-y-8">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center shadow-sm border ${m.role === 'user' ? 'bg-gray-100 border-gray-200 text-gray-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                  {m.role === 'user' ? <User size={18}/> : <Bot size={18}/>}
                </div>
                
                {/* Text Bubble */}
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-[#F7F7F5] border border-[#EBEBEA] text-gray-800' : 'bg-white text-gray-800'}`}>
                  {m.text}
                  {/* Blinking cursor for the AI while it's typing */}
                  {isTyping && m.role === 'ai' && i === messages.length - 1 && (
                    <span className="ml-1 inline-block w-1.5 h-4 bg-gray-400 animate-pulse align-middle" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* STAGED COMMAND UI - Notion Callout Style */}
        {stagedCommand && (
          <div className="max-w-3xl mx-auto w-full px-4 mb-4 z-20">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex justify-between items-center shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-500 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-amber-800 mb-1">Execution Required</span>
                  <code className="bg-amber-100/50 px-2 py-1 rounded text-amber-900 text-xs font-mono border border-amber-200/50">{stagedCommand}</code>
                </div>
              </div>
              <button 
                onClick={runApproval}
                className="bg-white border border-gray-300 hover:bg-gray-50 transition-colors text-gray-700 text-sm px-4 py-1.5 rounded-md font-medium shadow-sm"
              >
                Approve
              </button>
            </div>
          </div>
        )}

        {/* INPUT */}
        <div className="p-4 md:p-6 pt-0 z-20 max-w-4xl mx-auto w-full">
          <div className="relative bg-white border border-gray-300 shadow-sm rounded-xl flex items-center focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
            <input 
              className="w-full bg-transparent border-none py-3.5 pl-4 pr-12 text-[15px] focus:ring-0 placeholder-gray-400"
              placeholder="Ask Kernel or type a command..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              onClick={handleSend}
              disabled={!input || isTyping}
              className={`absolute right-2 p-2 rounded-lg transition-colors ${input && !isTyping ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400'}`}
            >
              <Send size={16} className={input && !isTyping ? 'ml-0.5' : ''}/>
            </button>
          </div>
          <div className="text-center mt-2 text-[11px] text-gray-400">
            Kernel_RAG uses local processing. Your data never leaves this machine.
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;