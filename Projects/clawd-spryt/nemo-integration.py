"""
NEMO Integration Layer
Connects NEMO agent to Python/Node/Rust services
"""

import os
import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

# Service endpoints
PYTHON_SERVICE = "http://localhost:5000"
NODE_SERVICE = "http://localhost:3000"
RUST_SERVICE = "http://localhost:8080"
LM_STUDIO = "http://localhost:1234"
NEMO_GATEWAY = "http://localhost:18789"

LM_STUDIO_TOKEN = os.getenv("LM_STUDIO_TOKEN")


@app.route('/nemo/health', methods=['GET'])
def health():
    """Check all services."""
    services = {}

    try:
        r = requests.get(f"{PYTHON_SERVICE}/health", timeout=2)
        services['python'] = r.json()
    except Exception:
        services['python'] = {'status': 'offline'}

    try:
        r = requests.get(f"{NODE_SERVICE}/health", timeout=2)
        services['node'] = r.json()
    except Exception:
        services['node'] = {'status': 'offline'}

    try:
        r = requests.get(f"{RUST_SERVICE}/health", timeout=2)
        services['rust'] = r.json()
    except Exception:
        services['rust'] = {'status': 'offline'}

    try:
        requests.get(
            f"{LM_STUDIO}/v1/models",
            headers={"Authorization": f"Bearer {LM_STUDIO_TOKEN}"},
            timeout=2
        )
        services['lm_studio'] = {'status': 'healthy'}
    except Exception:
        services['lm_studio'] = {'status': 'offline'}

    return jsonify({
        'nemo_status': 'operational',
        'services': services
    })


@app.route('/nemo/execute', methods=['POST'])
def execute_task():
    """
    NEMO task execution endpoint.
    Routes tasks to appropriate services.
    """
    data = request.get_json()
    task = data.get('task')
    task_type = data.get('type', 'general')

    if task_type == 'ai_generation':
        # Route to Python -> LM Studio
        response = requests.post(
            f"{PYTHON_SERVICE}/api/generate",
            json={'prompt': task}
        )
        return jsonify(response.json())

    if task_type == 'api_gateway':
        # Route through Node gateway
        response = requests.post(
            f"{NODE_SERVICE}/api/gateway/generate",
            json={'prompt': task}
        )
        return jsonify(response.json())

    if task_type == 'processing':
        # Route to Rust for performance tasks
        response = requests.post(
            f"{RUST_SERVICE}/api/process",
            json={'data': task}
        )
        return jsonify(response.json())

    # Default: use Python service
    response = requests.post(
        f"{PYTHON_SERVICE}/api/generate",
        json={'prompt': task}
    )
    return jsonify(response.json())


if __name__ == '__main__':
    print("NEMO Integration Layer starting...")
    print(f"Python: {PYTHON_SERVICE}")
    print(f"Node: {NODE_SERVICE}")
    print(f"Rust: {RUST_SERVICE}")
    print(f"LM Studio: {LM_STUDIO}")
    app.run(host='127.0.0.1', port=9000, debug=True)
