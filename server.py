import os
import shutil
import logging
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_community.llms import Ollama
from langchain_community.embeddings import OllamaEmbeddings
from langchain_chroma import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.prompts import ChatPromptTemplate
from langchain_community.document_loaders import PyPDFLoader, TextLoader


MODEL_NAME = "qwen3-coder"
EMBEDDING_MODEL = "nomic-embed-text"
PERSIST_DIRECTORY = "./chroma_db"
UPLOAD_DIRECTORY = "./uploads"

os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Kernel-Backend")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm = Ollama(model=MODEL_NAME, temperature=0.3)
embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)
vector_store = Chroma(persist_directory=PERSIST_DIRECTORY, embedding_function=embeddings)

SYSTEM_PROMPT = """
You are the OpenClaw Agent (Kernel Edition). You are a proactive, autonomous AI assistant.
Your goal is to analyze documents, execute logic, and provide highly structured, expert-level feedback.

### Operational Protocols:
1. **Analysis:** When a user provides a file (context), perform a deep scan. Don't just summarize; find the 'why' behind the data.
2. **Coding:** If the user asks for a solution, provide the "Gold Standard" implementation. Use modern best practices.
3. **Tone:** Professional, precise, and slightly witty—like a senior partner at a top engineering firm.
4. **Autonomous Thinking:** If the context is missing info, tell the user exactly what's missing to solve the problem.

Context:
{context}

Query:
{question}
"""
chat_prompt = ChatPromptTemplate.from_template(SYSTEM_PROMPT)

class QueryRequest(BaseModel):
    question: str
    persona: Optional[str] = None

class QueryResponse(BaseModel):
    response: str
    sources: List[str]

@app.get("/")
def health_check():
    return {"status": "online"}

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_DIRECTORY, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        if file.filename.endswith(".pdf"):
            loader = PyPDFLoader(file_path)
        else:
            loader = TextLoader(file_path)
            
        documents = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(documents)
        vector_store.add_documents(chunks)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ask", response_model=QueryResponse)
def ask_question(request: QueryRequest):
    try:
        retriever = vector_store.as_retriever(search_kwargs={"k": 4})
        docs = retriever.invoke(request.question)
        context_text = "\n\n".join([doc.page_content for doc in docs])
        
        formatted_prompt = chat_prompt.format(
            context=context_text,
            question=request.question
        )
        
        response_text = llm.invoke(formatted_prompt)
        sources = list(set([doc.metadata.get("source", "unknown") for doc in docs]))
        
        return QueryResponse(response=response_text, sources=sources)
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)