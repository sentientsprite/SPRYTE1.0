#!/bin/bash

echo "=================================="
echo "NEMO AGENT SYSTEM STARTUP"
echo "=================================="

# Expect LM_STUDIO_TOKEN to be set in the environment before running.
if [[ -z "${LM_STUDIO_TOKEN}" ]]; then
  echo "LM_STUDIO_TOKEN is not set. Export it before running this script."
  echo "Example: export LM_STUDIO_TOKEN=\"your-token-here\""
fi

# Start services in background
echo "Starting Python service..."
cd python-service
source venv/bin/activate
python app.py > ../logs/python.log 2>&1 &
PYTHON_PID=$!
cd ..

echo "Starting Node service..."
cd node-service
node index.js > ../logs/node.log 2>&1 &
NODE_PID=$!
cd ..

echo "Starting Rust service..."
cd rust-service
cargo run --release > ../logs/rust.log 2>&1 &
RUST_PID=$!
cd ..

echo "Starting NEMO integration..."
python3 nemo-integration.py > logs/nemo.log 2>&1 &
NEMO_PID=$!

echo ""
echo "=================================="
echo "ALL SERVICES STARTED"
echo "=================================="
echo ""
echo "Process IDs:"
echo "  Python: $PYTHON_PID"
echo "  Node: $NODE_PID"
echo "  Rust: $RUST_PID"
echo "  NEMO: $NEMO_PID"
echo ""
echo "Services:"
echo "  Python: http://localhost:5000"
echo "  Node: http://localhost:3000"
echo "  Rust: http://localhost:8080"
echo "  NEMO: http://localhost:9000"
echo "  LM Studio: http://localhost:1234"
echo ""
echo "Check health: curl http://localhost:9000/nemo/health"
echo ""
echo "To stop all: kill $PYTHON_PID $NODE_PID $RUST_PID $NEMO_PID"
