#!/bin/bash

# Navigate to the directory where this script is located
cd "$(dirname "$0")"

echo "🚀 Booting Kernel Workspace..."

echo "[1/3] Igniting Neural Engine (Python Backend)..."
# Start the backend in the background
python3 server.py &
BACKEND_PID=$!

echo "[2/3] Starting Workspace Interface (Vite Frontend)..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo "[3/3] Waiting for servers to initialize..."
sleep 4

echo "Launching Kernel Workspace..."
# Launch Chrome in standalone App mode
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --app="http://localhost:5173" 2>/dev/null &

echo ""
echo "================================================="
echo "   Kernel Workspace is running in the background. "
echo "   Press [CTRL+C] in this terminal to shut it down."
echo "================================================="

# Cleanly shut down the ports when you close the terminal
trap "echo 'Shutting down servers...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM
wait