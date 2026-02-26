from flask import Flask, request, jsonify
import requests
from requests.exceptions import RequestException
import time
import os

app = Flask(__name__)

LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions"
LM_STUDIO_TOKEN = os.getenv('LM_STUDIO_TOKEN', '')

@app.route('/health', methods=['GET'])
def health_check():
	return jsonify({"status": "healthy", "service": "python", "port": 5001})


@app.route('/api/generate', methods=['POST'])
def generate():
	try:
		data = request.get_json()
		prompt = data.get('prompt')
		temperature = data.get('temperature', 0.7)
		model = data.get('model', 'yqwen2.5-coder-7b-instruct')  # Default model name, change as needed

		if not prompt:
			return jsonify({"success": False, "message": "Prompt is required"}), 400

		headers = {'Authorization': f'Bearer {LM_STUDIO_TOKEN}'} if LM_STUDIO_TOKEN else {}
		payload = {
			'model': model,
			'messages': [
				{"role": "user", "content": prompt}
			],
			'temperature': temperature
		}

		start_time = time.time()
		response = requests.post(LM_STUDIO_URL, headers=headers, json=payload, timeout=60)
		end_time = time.time()

		if response.status_code == 200:
			return jsonify({"success": True, "content": response.json(), "tokens": response.json().get('usage', {})})
		else:
			return jsonify({"success": False, "message": "Failed to generate text", "status_code": response.status_code, "details": response.text}), response.status_code

	except RequestException as e:
		return jsonify({"success": False, "message": f"Request exception: {str(e)}"}), 500
	except Exception as e:
		return jsonify({"success": False, "message": f"An error occurred: {str(e)}"}), 500

if __name__ == '__main__':
	app.run(port=5002, debug=True)
# [PASTE LM STUDIO CODE HERE]
