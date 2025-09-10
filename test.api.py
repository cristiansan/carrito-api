import requests

url = "https://southtraders.oppen.io/report/authenticate"
data = {
    "md5password": "e10adc3949ba59abbe56e057f20f883e",  # hash de 123456
    "username": "API"
}

res = requests.post(url, json=data)

print("Status:", res.status_code)
print("Response:", res.text)
