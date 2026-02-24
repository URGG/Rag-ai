import os
import shutil
import json
import sqlite3
import subprocess
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import ollama
from ollama import AsyncClient
from langchain_core.documents import Document
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_community.tools import DuckDuckGoSearchRun

ollama_process = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global ollama_process
    try:
        ollama_process = subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(2)
    except Exception:
        pass
    yield
    if ollama_process:
        ollama_process.terminate()
        ollama_process.wait()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Agent-Status"]
)

DATA_DIR = "H:/RAG/data"
DB_DIR = "H:/RAG/chroma_db"
os.makedirs(DATA_DIR, exist_ok=True)

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=embeddings)
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
web_search = DuckDuckGoSearchRun()

conn = sqlite3.connect(os.path.join(DATA_DIR, 'kernel_memory.db'), check_same_thread=False)
cursor = conn.cursor()
cursor.execute('CREATE TABLE IF NOT EXISTS chat_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_query TEXT, ai_response TEXT)')
conn.commit()

class ChatRequest(BaseModel):
    question: str

pending_command = None
recent_uploads = [] 

def get_history():
    cursor.execute('SELECT user_query, ai_response FROM chat_history ORDER BY id DESC LIMIT 5')
    rows = cursor.fetchall()
    return "\n".join([f"User: {row[0]}\nAI: {row[1]}" for row in reversed(rows)])

def save_to_memory(user_query, ai_response):
    cursor.execute('INSERT INTO chat_history (user_query, ai_response) VALUES (?, ?)', (user_query, ai_response))
    conn.commit()

async def generate_stream(question: str, system_prompt: str):
    client = AsyncClient()
    response_iter = await client.chat(
        model='llama3',
        messages=[{'role': 'system', 'content': system_prompt}, {'role': 'user', 'content': question}],
        stream=True
    )
    full_response = ""
    async for chunk in response_iter:
        token = chunk['message']['content']
        full_response += token
        yield token
    save_to_memory(question, full_response)

@app.post("/ask")
async def ask_ai(request: ChatRequest):
    user_input_lower = request.question.lower().strip()
    route_decision = "chat"
    status_header = "Generating response..."
    
    files_str = ", ".join(recent_uploads) if recent_uploads else "None"
    
    if len(user_input_lower.split()) > 3 and user_input_lower not in ["hi", "hello", "hey", "test"]:
        router_prompt = f"Active files: {files_str}. If the user asks about these files, or says 'it' or 'this', route to 'local_search'. Output ONLY a JSON object with 'route': 'local_search', 'web_search', or 'chat'."
        try:
            client = AsyncClient()
            route_response = await client.chat(model='llama3', messages=[{'role': 'user', 'content': router_prompt}])
            raw_json = route_response['message']['content'].replace('```json', '').replace('```', '').strip()
            route_decision = json.loads(raw_json).get("route", "chat")
        except Exception:
            pass

    context = ""
    if route_decision == "local_search":
        status_header = "Searching Workspace files..."
        try:
            search_results = vectorstore.similarity_search(request.question, k=4)
            context = "\n---\n".join([doc.page_content for doc in search_results])
        except Exception:
            pass
    elif route_decision == "web_search":
        status_header = "Browsing the web..."
        try:
            context = web_search.run(request.question)
        except Exception:
            pass

    history_text = get_history()
    system_prompt = f"Context: {context if context else 'None'}. History: {history_text}. Active Workspace Files: {files_str}. Answer directly based on the provided Context. If asked about a file, assume it is one of the Active Workspace Files."
    
    return StreamingResponse(
        generate_stream(request.question, system_prompt), 
        media_type="text/plain",
        headers={"X-Agent-Status": status_header}
    )

@app.post("/request_command")
async def request_command(request: ChatRequest):
    global pending_command
    pending_command = request.question 
    return {"status": "Awaiting Approval", "command": pending_command}

@app.post("/approve_command")
async def approve_command():
    global pending_command
    if not pending_command:
        return {"error": "No command staged."}
    try:
        result = subprocess.run(pending_command, shell=True, capture_output=True, text=True)
        output = result.stdout if result.returncode == 0 else result.stderr
        pending_command = None
        return {"status": "Success", "output": output}
    except Exception as e:
        return {"status": "Failed", "error": str(e)}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_path = os.path.join(DATA_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    try:
        if file.filename.endswith('.pdf'):
            loader = PyPDFLoader(file_path)
        else:
            loader = TextLoader(file_path, encoding='utf-8')
        docs = loader.load()
        chunks = text_splitter.split_documents(docs)
        vectorstore.add_documents(chunks)
        
        if file.filename not in recent_uploads:
            recent_uploads.append(file.filename)
            
    except Exception as e:
        return {"status": "error", "message": str(e)}
    return {"status": "success", "filename": file.filename}

@app.post("/commit_memory")
async def commit_memory(request: ChatRequest):
    try:
        new_doc = Document(
            page_content=request.question,
            metadata={"source": "user_verified_solution", "timestamp": time.time()}
        )
        vectorstore.add_documents([new_doc])
        return {"status": "success", "message": "Solution committed to long-term memory."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/clear_memory")
async def clear_memory():
    try:
        cursor.execute('DELETE FROM chat_history')
        conn.commit()
        recent_uploads.clear() 
        return {"status": "success", "message": "Short-term memory wiped."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)