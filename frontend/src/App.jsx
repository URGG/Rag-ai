import React, { useState, useEffect, useRef } from 'react';
import { Send, FileCode, Terminal, Cpu, Database, ChevronRight, Activity, UploadCloud } from 'lucide-react';

function App() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: "SYSTEM INITIALIZED. Agentic RAG and Automation active." }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [stagedCommand, setStagedCommand] = useState(null); 
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping, stagedCommand]);

  // --- DRAG AND DROP LOGIC ---
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
          text: `FILE_UPLOAD_SUCCESS: ${result.filename} added to kernel memory.` 
        }]);
      } catch (err) {
        console.error("Upload error", err);
      }
    }
  };

  // --- AUTOMATION APPROVAL LOGIC ---
  const runApproval = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/approve_command', { method: 'POST' });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', text: `TERMINAL_OUTPUT:\n${data.output || data.error}` }]);
      setStagedCommand(null);
    } catch (error) {
       setMessages(prev => [...prev, { role: 'ai', text: "ERROR: Failed to run command." }]);
    }
  };

  // --- CHAT LOGIC ---
  const handleSend = async () => {
    if (!input) return;
    
    // TEMPORARY OVERRIDE: Type exactly 'test command' to trigger the staging tool safely
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

    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'ai', text: data.answer }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: "ERROR: Connection to Neural Engine failed." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex h-screen bg-[#050505] text-[#d1d1d1] font-mono selection:bg-blue-500/30 overflow-hidden relative"
    >
      {/* DRAG OVERLAY */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-blue-600/10 backdrop-blur-md flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-blue-500 p-16 rounded-3xl bg-black/90 flex flex-col items-center gap-4 shadow-[0_0_50px_rgba(59,130,246,0.2)]">
            <UploadCloud size={48} className="text-blue-500 animate-bounce" />
            <p className="text-blue-400 font-black text-xl tracking-[0.3em] uppercase">Release to Index</p>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <div className="w-72 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col z-10">
        <div className="p-6 border-b border-[#1a1a1a] flex items-center gap-3">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]" />
          <h1 className="font-black text-sm uppercase tracking-[0.2em] text-white">Kernel_RAG</h1>
        </div>
        
        <div className="flex-1 p-4 space-y-8 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 mb-4 text-[#444] px-2 text-[10px] font-bold uppercase tracking-widest">
              <Database size={12} /> Knowledge Base
            </div>
            <div className="space-y-1">
              {['emulator.c', 'notes.pdf'].map(file => (
                <div key={file} className="flex items-center gap-2 px-3 py-2 rounded text-xs text-[#888] hover:bg-white/5 cursor-default">
                  <FileCode size={14} className="text-blue-400" />
                  <span>{file}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-[#1a1a1a]">
            <div className="flex items-center gap-2 mb-4 text-[#444] px-2 text-[10px] font-bold uppercase tracking-widest">
              <Activity size={12} /> System Status
            </div>
            <div className="px-2 space-y-3">
              <div className="flex justify-between text-[9px]"><span className="text-[#555]">MODEL:</span><span className="text-blue-500">LLAMA3_LOCAL</span></div>
              <div className="flex justify-between text-[9px]"><span className="text-[#555]">UPTIME:</span><span className="text-emerald-500">99.9%</span></div>
              <div className="w-full bg-[#1a1a1a] h-1 rounded-full"><div className="bg-blue-600 h-full w-[65%]" /></div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN VIEW */}
      <div className="flex-1 flex flex-col relative bg-[#050505]">
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_2px,3px_100%]" />

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-2xl flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded border flex items-center justify-center ${m.role === 'user' ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' : 'border-[#333] bg-[#111] text-[#666]'}`}>
                  {m.role === 'user' ? 'U' : <Cpu size={14}/>}
                </div>
                <div className={`px-5 py-3 rounded text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600/10 border border-blue-500/20' : 'bg-[#0d0d0d] border border-[#222]'}`}>
                  <div className="text-[9px] mb-1 opacity-30 font-bold uppercase">{m.role === 'user' ? 'USR' : 'SYS'}</div>
                  {m.text}
                </div>
              </div>
            </div>
          ))}
          {isTyping && <div className="text-[10px] text-blue-500 animate-pulse px-12">THINKING_...</div>}
        </div>

        {/* STAGED COMMAND UI */}
        {stagedCommand && (
          <div className="mx-8 mb-4 p-4 bg-red-950/20 border border-red-500/50 rounded flex justify-between items-center z-20">
            <div className="text-xs text-red-400 font-bold flex flex-col">
              <span className="opacity-50 uppercase tracking-tighter mb-1">Warning: Pending Execution</span>
              <code className="bg-black/50 px-2 py-1 rounded text-red-300">{stagedCommand}</code>
            </div>
            <button 
              onClick={runApproval}
              className="bg-red-500 hover:bg-red-600 transition-colors text-white text-[10px] px-4 py-2 rounded font-black uppercase shadow-[0_0_15px_rgba(239,68,68,0.4)]"
            >
              Approve & Execute
            </button>
          </div>
        )}

        {/* INPUT */}
        <div className="p-8 pt-0 z-20">
          <div className="max-w-4xl mx-auto relative bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg flex items-center focus-within:border-blue-500/50 transition-all">
            <Terminal size={18} className="ml-4 text-blue-900" />
            <input 
              className="w-full bg-transparent border-none py-4 px-4 text-sm focus:ring-0"
              placeholder="COMMAND_> _ (Type 'test command' to try automation)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;