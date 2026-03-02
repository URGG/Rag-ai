@echo off
title Kernel Backend Debugger
echo [1/3] Checking Python Path...
if exist ".venv\Scripts\python.exe" (
    echo Python found in .venv
) else (
    echo CRITICAL ERROR: .venv\Scripts\python.exe not found!
    echo Please run "python -m venv .venv" and install dependencies again.
    pause
    exit
)

echo [2/3] Checking Dependencies...
.venv\Scripts\python -c "import fastapi; import uvicorn; import langchain; import pypdf; import watchdog; print('Dependencies OK')"
if %errorlevel% neq 0 (
    echo CRITICAL ERROR: Missing Python modules!
    echo running pip install...
    .venv\Scripts\pip install fastapi uvicorn langchain langchain-chroma langchain-huggingface langchain-community ollama pydantic duckduckgo-search pypdf watchdog
)

echo [3/3] Launching Server Manually...
echo If this crashes, read the error message below!
echo ---------------------------------------------------
.venv\Scripts\python server.py
pause