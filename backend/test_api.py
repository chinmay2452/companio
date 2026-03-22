import requests

res = requests.post("http://127.0.0.1:8000/api/microtime/session/start", json={
    "user_id": "00000000-0000-0000-0000-000000000000",
    "duration_minutes": 5,
    "subject": "Physics",
    "topic": "Ch 1"
})
print("STATUS CODE:", res.status_code)
try:
    print("RESPONSE JSON:", res.json())
except:
    print("RESPONSE TEXT:", res.text)
