# Clawd Spryt Workspace

## NEMO integration layer

The integration layer in `nemo-integration.py` connects the NEMO gateway to the Python, Node, and Rust services.

### Prerequisites

- Python 3.10+
- Dependencies: `flask` and `requests`
- Services running on localhost:
  - Python service: 5000
  - Node service: 3000
  - Rust service: 8080
  - LM Studio: 1234

### Environment

Set the LM Studio token via environment variable:

```bash
export LM_STUDIO_TOKEN="your-token-here"
```

### Run

```bash
python nemo-integration.py
```

### Endpoints

- `GET /nemo/health`
- `POST /nemo/execute`
