@echo off
title Kernel Bootloader
echo [1/3] Igniting Neural Engine (Python Backend)...
start /MIN cmd /c "python server.py"

echo [2/3] Starting Workspace Interface (Vite Frontend)...
start /MIN cmd /c "cd frontend && npm run dev"

echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak > NUL

echo Launching Kernel Workspace...
start chrome --app=http://localhost:5173

exit