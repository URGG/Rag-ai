import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Send, FileText, Bot, Database, User, Activity, UploadCloud, Settings, Cpu, Copy, Check, Sun, Moon, Brain, Square, Loader2, Eraser, Code2, Network, Trash2, ChevronDown, Play, Terminal } from 'lucide-react';
// --- THE CUSTOM KERNEL LOGO ---
const KernelLogo = ({ className }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 5L90 27.5V72.5L50 95L10 72.5V27.5L50 5Z" stroke="currentColor" strokeWidth="6" strokeLinejoin="round"/>
    <path d="M50 25V75M28 38L72 62M72 38L28 62" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="50" cy="50" r="10" fill="currentColor"/>
  </svg>
);

function App() {
  const [messages, setMessages] = useState([{ role: 'ai', text: "Kernel Workspace initialized. Neural engine is online." }]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [agentStatus, setAgentStatus] = useState("");
  const [abortController, setAbortController] = useState(null);
  
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [activePersona, setActivePersona] = useState("Standard AI");
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
  
  const scrollRef = useRef(null);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping, agentStatus]);

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  const handleClearContext = async () => {
    try {
      await fetch('http://127.0.0.1:8000/clear_memory', { method: 'POST' });
      setMessages([{ role: 'ai', text: "Context wiped. Awaiting new instructions." }]);
      setUploadedFiles([]); 
    } catch (error) {
      console.error(error);
    }
  };

  const triggerAutoAnalysis = async (filename) => {
    const autoPrompt = `System Event: The user just uploaded a file named "${filename}". Based on your file previews, briefly summarize what this file is, and tell the user exactly what tasks or problems need to be solved in it.`;

    setMessages(prev => [
      ...prev, 
      { role: 'user', text: `[Attached File: ${filename}]` }, 
      { role: 'ai', text: "" }
    ]);
    
    setIsTyping(true);
    setAgentStatus("Analyzing document...");

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch('http://127.0.0.1:8000/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: autoPrompt,
          persona: activePersona 
        }),
        signal: controller.signal
      });

      setAgentStatus(response.headers.get("X-Agent-Status") || "Generating summary...");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages(prev => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          newMessages[lastIndex] = { ...newMessages[lastIndex], text: newMessages[lastIndex].text + chunk };
          return newMessages;
        });
      }
    } catch (error) {
      if (error.name !== 'AbortError') console.error(error);
    } finally {
      setIsTyping(false);
      setAgentStatus("");
      setAbortController(null);
    }
  };

  const handleSend = async () => {
    if (!input) return;
    const userText = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userText }, { role: 'ai', text: "" }]);
    setIsTyping(true);
    setAgentStatus("Routing query...");

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch('http://127.0.0.1:8000/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userText, persona: activePersona }),
        signal: controller.signal
      });

      setAgentStatus(response.headers.get("X-Agent-Status") || "Generating...");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages(prev => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          newMessages[lastIndex] = { ...newMessages[lastIndex], text: newMessages[lastIndex].text + chunk };
          return newMessages;
        });
      }
    } catch (error) {
      if (error.name !== 'AbortError') console.error(error);
    } finally {
      setIsTyping(false);
      setAgentStatus("");
      setAbortController(null);
    }
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setIsTyping(false);
      setAgentStatus("");
    }
  };

  const commitToMemory = async (text) => {
    try {
      await fetch('http://127.0.0.1:8000/commit_memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    
    for (let file of files) {
      const formData = new FormData();
      formData.append("file", file);
      
      try {
        setAgentStatus(`Uploading and parsing ${file.name}...`);
        const response = await fetch("http://127.0.0.1:8000/upload", { method: "POST", body: formData });
        const result = await response.json();
        
        setUploadedFiles(prev => [...new Set([...prev, result.filename])]);
        
        setAgentStatus("Extracting document context...");
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        await triggerAutoAnalysis(result.filename);
      } catch (err) {
        console.error("Upload failed", err);
      }
    }
  };

  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="flex h-screen bg-[#FAFAFA] dark:bg-[#0A0A0B] text-gray-900 dark:text-gray-100 font-sans selection:bg-blue-500/30 overflow-hidden relative">
      
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-white/60 dark:bg-black/60 backdrop-blur-md flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-blue-500 p-12 rounded-2xl bg-white dark:bg-[#111] shadow-2xl flex flex-col items-center gap-4">
            <UploadCloud size={48} className="text-blue-500 animate-bounce" />
            <p className="text-blue-500 font-bold text-lg">Drop to embed in ChromaDB</p>
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <div className="w-80 bg-white/80 dark:bg-[#0E0E10]/80 backdrop-blur-xl border-r border-gray-200 dark:border-zinc-800 flex flex-col z-10 shadow-lg">
        <div className="h-20 flex items-center justify-between px-6 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <KernelLogo className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold tracking-wide dark:text-gray-100 leading-tight">Kernel</h1>
              <span className="text-[10px] font-mono text-blue-500 font-bold uppercase tracking-widest">Workspace</span>
            </div>
          </div>
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 transition-all">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        
        <div className="flex-1 px-5 py-6 space-y-8 overflow-y-auto">
          <div>
            <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 px-1">Engine Behavior</div>
            <div className="relative">
              <button 
                onClick={() => setIsPersonaMenuOpen(!isPersonaMenuOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#141417] border border-gray-200 dark:border-zinc-800 rounded-lg text-sm font-medium hover:border-blue-500/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Cpu size={16} className="text-blue-500" />
                  {activePersona}
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isPersonaMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isPersonaMenuOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-[#1A1A1D] border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl overflow-hidden z-20">
                  {["Standard AI", "Strict Code Debugger", "Algorithm Explainer"].map((persona) => (
                    <button 
                      key={persona}
                      onClick={() => { setActivePersona(persona); setIsPersonaMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      {persona}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Session Context</div>
              <span className="text-[10px] font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                {uploadedFiles.length} files
              </span>
            </div>
            
            <div className="space-y-2">
              {uploadedFiles.length === 0 ? (
                <div className="border border-dashed border-gray-300 dark:border-zinc-700 rounded-lg p-6 text-center">
                  <FileText size={20} className="mx-auto text-gray-400 mb-2 opacity-50" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Drag files here to build context</p>
                </div>
              ) : (
                uploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-[#141417] border border-gray-200 dark:border-zinc-800 rounded-lg group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText size={14} className="text-blue-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{file}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 px-1">System Telemetry</div>
            <div className="bg-gray-50 dark:bg-[#141417] rounded-lg border border-gray-200 dark:border-zinc-800 p-4 space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-500">GPU VRAM Allocation</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono">4.7 GB</span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[60%]"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-500">Vector Database</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">Online</span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[100%]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative z-10">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-12 pt-8 pb-32">
          <div className="max-w-4xl mx-auto space-y-8">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border ${m.role === 'user' ? 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-900 border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-gray-300' : 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400'}`}>
                  {m.role === 'user' ? <User size={20}/> : <Bot size={20}/>}
                </div>
                
                <div className={`flex-1 min-w-0 ${m.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                  <div className={`inline-block max-w-[90%] ${m.role === 'user' ? 'bg-blue-600 text-white px-5 py-3 rounded-2xl rounded-tr-sm shadow-md' : 'text-gray-800 dark:text-gray-200'}`}>
                    <div className={`prose dark:prose-invert max-w-none text-[15px] leading-relaxed ${m.role === 'user' ? 'text-white' : ''}`}>
                      {m.role === 'user' ? (
                        m.text
                      ) : (
                        <ReactMarkdown components={{
                          code({ node, inline, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeStr = String(children).replace(/\n$/, '');
                            const [copy, setCopy] = useState(false);
                            const [output, setOutput] = useState(null);
                            const [isRunning, setIsRunning] = useState(false);

                            const executeCode = async () => {
                              setIsRunning(true);
                              setOutput("Compiling and executing...");
                              try {
                                const res = await fetch('http://127.0.0.1:8000/execute', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ code: codeStr, language: match[1] })
                                });
                                const data = await res.json();
                                setOutput(data.output);
                              } catch (e) {
                                setOutput("Execution error: " + String(e));
                              } finally {
                                setIsRunning(false);
                              }
                            };

                            return !inline && match ? (
                              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800 my-5 shadow-lg bg-[#FAFAFA] dark:bg-[#111113]">
                                <div className="bg-white dark:bg-[#18181B] px-4 py-2.5 flex justify-between items-center border-b border-gray-200 dark:border-zinc-800">
                                  <div className="flex items-center gap-2">
                                    <Code2 size={14} className="text-gray-400" />
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{match[1]}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {(match[1].toLowerCase() === 'python' || match[1].toLowerCase() === 'java') && (
                                      <button onClick={executeCode} disabled={isRunning} className="text-gray-400 hover:text-emerald-500 transition-colors flex items-center gap-1.5 bg-gray-100 dark:bg-zinc-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 px-2.5 py-1 rounded-md disabled:opacity-50">
                                        {isRunning ? <Loader2 size={14} className="animate-spin text-emerald-500"/> : <Play size={14}/>}
                                        <span className="text-xs font-semibold">{isRunning ? 'Running' : 'Run'}</span>
                                      </button>
                                    )}
                                    <button onClick={() => {navigator.clipboard.writeText(codeStr); setCopy(true); setTimeout(() => setCopy(false), 2000)}} className="text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1.5 bg-gray-100 dark:bg-zinc-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2.5 py-1 rounded-md">
                                      {copy ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
                                      <span className="text-xs font-semibold">{copy ? 'Copied' : 'Copy'}</span>
                                    </button>
                                  </div>
                                </div>
                                <SyntaxHighlighter style={theme === 'light' ? oneLight : vscDarkPlus} language={match[1]} PreTag="div" customStyle={{margin:0, padding:'1.5rem', fontSize:'14px', background: 'transparent'}} {...props}>
                                  {codeStr}
                                </SyntaxHighlighter>
                                
                                {/* THE NEW LOCAL TERMINAL OUTPUT */}
                                {output && (
                                  <div className="border-t border-gray-200 dark:border-zinc-800 bg-[#F4F4F5] dark:bg-[#09090B] p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Terminal size={12} className="text-gray-400" />
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Terminal Output</span>
                                    </div>
                                    <pre className="text-xs font-mono text-gray-800 dark:text-gray-300 whitespace-pre-wrap">{output}</pre>
                                  </div>
                                )}
                              </div>
                            ) : <code className="bg-gray-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded-md text-pink-600 dark:text-pink-400 font-mono text-sm border border-gray-200 dark:border-zinc-700" {...props}>{children}</code>
                          }
                        }}>
                          {m.text}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                  
                  {m.role === 'ai' && m.text && !isTyping && (
                    <div className="mt-3 flex gap-3">
                      <button onClick={() => commitToMemory(m.text)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all border border-transparent hover:border-gray-200 dark:hover:border-zinc-700">
                        <Brain size={14}/> Extract to Vector DB
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA] to-transparent dark:from-[#0A0A0B] dark:via-[#0A0A0B] pt-10 pb-6 px-4 md:px-12 z-20">
          <div className="max-w-4xl mx-auto">
            
            <div className="flex justify-between items-center h-8 px-2 mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {isTyping && <Loader2 size={14} className="animate-spin text-blue-500" />}
                {agentStatus}
              </div>
              {isTyping && (
                <button onClick={handleStop} className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-colors text-[11px] font-bold uppercase tracking-wider shadow-sm">
                  <Square size={12} className="fill-current" /> Terminate
                </button>
              )}
            </div>

            <div className="relative flex items-end gap-3 bg-white dark:bg-[#141417] border border-gray-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-2 transition-all focus-within:border-blue-500/50 dark:focus-within:border-blue-500/50 focus-within:ring-4 focus-within:ring-blue-500/10">
              <button onClick={handleClearContext} title="Wipe SQLite Context" className="p-3.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all flex-shrink-0">
                <Eraser size={22} />
              </button>

              <textarea 
                className="w-full bg-transparent border-none py-3.5 px-2 text-[15px] focus:ring-0 placeholder-gray-400 dark:placeholder-gray-600 resize-none max-h-48 min-h-[52px]"
                placeholder="Initialize workflow or paste code..."
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = '52px';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 192)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                    e.target.style.height = '52px';
                  }
                }}
              />
              
              <button onClick={handleSend} disabled={!input || isTyping} className={`p-3.5 rounded-xl transition-all flex-shrink-0 flex items-center justify-center ${input && !isTyping ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-600'}`}>
                <Send size={20} className={input && !isTyping ? 'ml-0.5' : ''}/>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;