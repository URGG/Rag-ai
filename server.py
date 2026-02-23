import os
import shutil
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ollama

app = FastAPI()

# Enable CORS for React (Running on port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set your data directory
DATA_DIR = "H:/RAG/data"
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

class ChatRequest(BaseModel):
    question: str

@app.post("/ask")
async def ask_ai(request: ChatRequest):
    print(f"KERNEL_QUERY: {request.question}")
    
    # Simple Llama3 call (Next step: add Vector Search here)
    response = ollama.chat(model='llama3', messages=[
        {'role': 'system', 'content': 'You are a Senior Dev Kernel. Be concise and technical.'},
        {'role': 'user', 'content': request.question},
    ])
    
    return {"answer": response['message']['content']}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_path = os.path.join(DATA_DIR, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    print(f"FS_UPDATE: Indexed {file.filename}")
    return {"status": "success", "filename": file.filename}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)