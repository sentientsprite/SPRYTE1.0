import requests
from time import sleep

# Define the URLs for the services
lm_studio_url = "http://localhost:1234/health"
python_service_url = "http://localhost:5001/health"
node_service_url = "http://localhost:3001/health"
rust_service_url = "http://localhost:8081/health"
gateway_url = "http://localhost:8082/send_message"  # Assuming the gateway listens on port 8082

def check_response(url, expected_status_code):
    try:
        response = requests.get(url)
        if response.status_code == expected_status_code:
            print(f"{url}: PASS")
        else:
            print(f"{url}: FAIL - Status code was {response.status_code}, expected {expected_status_code}")
    except requests.exceptions.RequestException as e:
        print(f"{url}: FAIL - Error occurred: {e}")

def send_test_message(url, message):
    try:
        response = requests.post(url, json={"message": message})
        if response.status_code == 200:
            print(f"Message sent to {url}: PASS")
        else:
            print(f"Message sent to {url}: FAIL - Status code was {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"Message sent to {url}: FAIL - Error occurred: {e}")

def main():
    print("Checking LM Studio health...")
    check_response(lm_studio_url, 200)

    sleep(1)  # Wait for services to start

    print("\nChecking Python service health...")
    check_response(python_service_url, 200)

    print("\nChecking Node service health...")
    check_response(node_service_url, 200)

    print("\nChecking Rust service health...")
    check_response(rust_service_url, 200)

    sleep(1)  # Wait for gateway to start

    test_message = "Hello, Gateway!"
    print(f"\nSending test message through the gateway: {test_message}")
    send_test_message(gateway_url, test_message)

if __name__ == "__main__":
    main()
