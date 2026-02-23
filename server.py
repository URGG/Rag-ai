import os
import shutil
import json
import sqlite3
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama

# LangChain Imports
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_community.tools import DuckDuckGoSearchRun

# 1. INITIALIZE THE APP
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. SETUP DIRECTORIES & SQLITE MEMORY
DATA_DIR = "H:/RAG/data"
DB_DIR = "H:/RAG/chroma_db"
os.makedirs(DATA_DIR, exist_ok=True)

# Initialize SQLite Persistent Memory
conn = sqlite3.connect(os.path.join(DATA_DIR, 'kernel_memory.db'), check_same_thread=False)
cursor = conn.cursor()
cursor.execute('''
    CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_query TEXT,
        ai_response TEXT
    )
''')
conn.commit()

def get_history():
    cursor.execute('SELECT user_query, ai_response FROM chat_history ORDER BY id DESC LIMIT 3')
    rows = cursor.fetchall()
    return "\n".join([f"User: {row[0]}\nAI: {row[1]}" for row in reversed(rows)])

def save_to_memory(user_query, ai_response):
    cursor.execute('INSERT INTO chat_history (user_query, ai_response) VALUES (?, ?)', (user_query, ai_response))
    conn.commit()

# 3. BOOT UP THE ENGINES
print("INITIALIZING VECTOR ENGINE...")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=embeddings)
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)

print("INITIALIZING WEB SEARCH...")
web_search = DuckDuckGoSearchRun()
print("SYSTEM READY.")

class ChatRequest(BaseModel):
    question: str

# 4. THE SMART ROUTER ENDPOINT
@app.post("/ask")
async def ask_ai(request: ChatRequest):
    print(f"\n--- NEW KERNEL INQUIRY ---")
    print(f"USER: {request.question}")
    
    # The Router
    router_prompt = f"""
    You are a logical router. Analyze the user's input and decide how to answer it.
    - If they are saying hi or making small talk, output "chat".
    - If they are asking about their files, code, or local data, output "local_search".
    - If they are asking about live news, current events, or searching the internet, output "web_search".
    Return ONLY a JSON object with a single key "route" and the value "local_search", "web_search", or "chat".
    User Input: "{request.question}"
    """
    
    try:
        route_response = ollama.chat(model='llama3', messages=[{'role': 'user', 'content': router_prompt}])
        raw_json = route_response['message']['content'].replace('```json', '').replace('```', '').strip()
        route_decision = json.loads(raw_json).get("route", "chat")
    except Exception as e:
        print(f"ROUTER ERROR, defaulting to local_search: {e}")
        route_decision = "local_search"
        
    print(f"SYSTEM_ROUTE: {route_decision.upper()}")

    # Gather Context based on the route
    context = ""
    if route_decision == "local_search":
        print("EXECUTING LOCAL VECTOR SEARCH...")
        try:
            search_results = vectorstore.similarity_search(request.question, k=4)
            context = "\n---\n".join([doc.page_content for doc in search_results])
        except Exception:
            context = "Local database empty."
            
    elif route_decision == "web_search":
        print("EXECUTING LIVE WEB SEARCH...")
        try:
            context = web_search.run(request.question)
        except Exception as e:
            context = f"Web search failed: {e}"

    # Fetch Persistent Memory
    history_text = get_history()
    
    system_prompt = f"""You are Kernel_RAG, a highly advanced local engineering assistant.
    
    PREVIOUS CONVERSATION HISTORY:
    {history_text if history_text else "No previous history."}
    
    CONTEXT (Local or Web):
    {context if context else "No context needed for this query."}
    
    INSTRUCTIONS:
    1. Answer the user directly and intelligently.
    2. Use the CONTEXT to answer the question if it is provided.
    3. Use the PREVIOUS CONVERSATION HISTORY to understand pronouns like "it" or "that". 
    4. Do not narrate your process.
    """
    
    final_response = ollama.chat(model='llama3', messages=[
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': request.question},
    ])
    
    answer = final_response['message']['content']
    
    # Save to SQLite Persistent Memory
    save_to_memory(request.question, answer)
    
    return {"answer": answer}

# 5. THE FILE UPLOAD ENDPOINT
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_path = os.path.join(DATA_DIR, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    print(f"FS_UPDATE: Saved {file.filename}. Indexing...")
    
    try:
        if file.filename.endswith('.pdf'):
            loader = PyPDFLoader(file_path)
        else:
            loader = TextLoader(file_path, encoding='utf-8')
            
        docs = loader.load()
        chunks = text_splitter.split_documents(docs)
        vectorstore.add_documents(chunks)
        print(f"INDEX_SUCCESS: {len(chunks)} vectors added to memory.")
        
    except Exception as e:
        print(f"INDEX_ERROR: Could not parse {file.filename}. Error: {e}")
        return {"status": "error", "message": str(e)}

    return {"status": "success", "filename": file.filename}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)