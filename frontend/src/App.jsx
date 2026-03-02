import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css'; // Don't forget this for the math font!
import './App.css';

const App = () => {
  const [messages, setMessages] = useState([
    { role: 'bot', content: "KERNEL V1.0 // ONLINE. Upload context or query neural engine." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async (e) => {
    if (e.key !== 'Enter' || !input.trim()) return;
    
    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // 1. Send the request
      const res = await axios.post('http://127.0.0.1:8000/ask', {
        question: userMessage
      });

      // 2. EXTRACT THE DATA CORRECTLY (Fixing your bug)
      const botResponse = res.data.response; 
      const sources = res.data.sources;

      // 3. Format Sources nicely
      let finalContent = botResponse;
      if (sources && sources.length > 0) {
        finalContent += `\n\n---\n**Sources Verified:**\n${sources.map(s => `* \`${s}\``).join('\n')}`;
      }

      setMessages(prev => [...prev, { role: 'bot', content: finalContent }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: "⚠️ CONNECTION LOST // NEURAL ENGINE OFFLINE" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      await axios.post('http://127.0.0.1:8000/upload', formData);
      setMessages(prev => [...prev, { role: 'bot', content: `✅ FILE SECURED: ${selectedFile.name} // EMBEDDING COMPLETE` }]);
    } catch (err) {
      alert("Upload Failed");
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="brand">
          <div style={{width: 10, height: 10, background: '#3b82f6'}}></div>
          KERNEL WORKSPACE
        </div>
        
        <label className="drop-zone">
          <input type="file" hidden onChange={handleFileUpload} />
          {file ? file.name : "+ UPLOAD CONTEXT"}
        </label>

        <div style={{marginTop: 'auto', fontSize: 10, color: '#444'}}>
          STATUS: <span style={{color: '#0f0'}}>CONNECTED</span><br/>
          MODEL: QWEN2.5-CODER<br/>
          MEMORY: 16GB
        </div>
      </div>

      {/* Main Chat */}
      <div className="chat-area">
        <div className="messages-scroll">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="bubble">
                {msg.role === 'bot' ? (
                  /* THIS IS THE MAGIC PART THAT RENDERS MATH */
                  <div className="markdown-content">
                    <ReactMarkdown 
                      remarkPlugins={[remarkMath]} 
                      rehypePlugins={[rehypeKatex]}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message bot">
              <div className="loading-indicator">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
                <span>PROCESSING NEURAL VECTORS...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="input-area">
          <div className="input-wrapper">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleSend}
              placeholder="Execute query..."
              disabled={isLoading}
              autoFocus
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;