import ollama
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
import os

# 1. Check if data exists
if not os.path.exists('./data') or not os.listdir('./data'):
    print("Error: The 'data' folder is empty. Drop a .c or .txt file in there first!")
    exit()

print("--- Step 1: Loading Files ---")
loader = DirectoryLoader('./data', glob="**/*.*", loader_cls=TextLoader)
docs = loader.load()
print(f"Loaded {len(docs)} document(s).")

# 2. Split logic
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
chunks = text_splitter.split_documents(docs)

# 3. Embedding (Turning text into math)
print("--- Step 2: Generating Vectors (This takes a moment the first time) ---")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# 4. Create Database
vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory="./chroma_db"
)
print("--- Step 3: Database Created! ---")

# 5. The Query Function
def ask_ai(question):
    # Find relevant chunks
    results = vectorstore.similarity_search(question, k=2)
    context = "\n".join([res.page_content for res in results])
    
    # Prompt Ollama
    response = ollama.chat(model='llama3', messages=[
        {'role': 'system', 'content': 'You are a helpful assistant. Use the context to answer.'},
        {'role': 'user', 'content': f"Context: {context}\n\nQuestion: {question}"},
    ])
    print(f"\n[AI]: {response['message']['content']}")

# TEST
ask_ai("What is this code/document about?")