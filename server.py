import os
import shutil
import json
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama

# LangChain Imports
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

# 1. INITIALIZE THE APP
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. SETUP DIRECTORIES & GLOBAL MEMORY
DATA_DIR = "H:/RAG/data"
DB_DIR = "H:/RAG/chroma_db"
os.makedirs(DATA_DIR, exist_ok=True)

chat_history = []  # Our AI's short-term memory

# 3. BOOT UP THE VECTOR ENGINE
print("INITIALIZING VECTOR ENGINE...")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=embeddings)
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
print("SYSTEM READY.")

class ChatRequest(BaseModel):
    question: str

# 4. THE SMART ROUTER ENDPOINT
@app.post("/ask")
async def ask_ai(request: ChatRequest):
    global chat_history
    print(f"\n--- NEW KERNEL INQUIRY ---")
    print(f"USER: {request.question}")
    
    # Let Llama decide if it needs to search the database
    router_prompt = f"""
    You are a logical router. Analyze the user's input and decide if you need to search their local files to answer it.
    If they are just saying hi, asking how you are, or making small talk, output "chat".
    If they are asking a specific question, asking about a file, or asking for facts, output "search".
    Return ONLY a JSON object with a single key "route" and the value "search" or "chat".
    User Input: "{request.question}"
    """
    
    try:
        route_response = ollama.chat(model='llama3', messages=[{'role': 'user', 'content': router_prompt}])
        # Clean the response to ensure valid JSON
        raw_json = route_response['message']['content'].replace('```json', '').replace('```', '').strip()
        route_decision = json.loads(raw_json).get("route", "chat")
    except Exception as e:
        print(f"ROUTER ERROR, defaulting to search: {e}")
        route_decision = "search"
        
    print(f"SYSTEM_ROUTE: {route_decision.upper()}")

    # Gather Context if the router chose "search"
    context = ""
    if route_decision == "search":
        print("EXECUTING VECTOR SEARCH...")
        try:
            search_results = vectorstore.similarity_search(request.question, k=4)
            context = "\n---\n".join([doc.page_content for doc in search_results])
        except Exception:
            context = "Database empty."

    # Format the past 3 interactions for memory
    history_text = "\n".join([f"User: {msg['user']}\nAI: {msg['ai']}" for msg in chat_history[-3:]])
    
    # The final prompt sent to Llama
    system_prompt = f"""You are Kernel_RAG, a highly advanced local engineering assistant.
    
    PREVIOUS CONVERSATION HISTORY:
    {history_text if history_text else "No previous history."}
    
    LOCAL FILE SYSTEM CONTEXT (If applicable):
    {context if context else "No local context needed for this query."}
    
    INSTRUCTIONS:
    1. Answer the user directly and intelligently.
    2. Use the LOCAL FILE SYSTEM CONTEXT to answer the question if it is provided and relevant.
    3. Use the PREVIOUS CONVERSATION HISTORY to understand pronouns like "it" or "that". 
    4. Do not narrate your process or say things like "Based on the context". Just deliver the data naturally.
    """
    
    final_response = ollama.chat(model='llama3', messages=[
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': request.question},
    ])
    
    answer = final_response['message']['content']
    
    # Save to memory
    chat_history.append({"user": request.question, "ai": answer})
    
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