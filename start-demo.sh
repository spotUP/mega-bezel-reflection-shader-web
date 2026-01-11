#!/bin/bash
echo "🚀 Starting Mega Bezel Demo..."

# Kill anything running on port 8084
if lsof -Pi :8084 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 8084 is in use. Stopping existing process..."
    lsof -t -i:8084 | xargs kill
    sleep 1
fi

echo "✅ Port 8084 cleared."
echo "🌍 Opening browser and starting server..."

# Start Vite and open the browser
# We use --host to ensure it binds correctly and --open to launch the browser
npm run dev -- --port 8084 --open &

# Capture the process ID
PID=$!

echo "💻 Demo is running! Press Ctrl+C to stop."

# Keep script running
wait $PID