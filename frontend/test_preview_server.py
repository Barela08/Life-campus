import urllib.request
import json

print("=== TESTING PRODUCTION PREVIEW ASSETS ===")
try:
    req = urllib.request.Request("http://127.0.0.1:5173/")
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8')
        print(f"  [OK] GET / -> Code {resp.getcode()}, Length: {len(html)} bytes")
        assert "<div id=\"root\">" in html, "Root element missing in HTML!"
        print("  [OK] <div id=\"root\"> present in HTML")

    req_brand = urllib.request.Request("http://127.0.0.1:8000/api/auth/branding")
    with urllib.request.urlopen(req_brand) as resp:
        brand_data = json.loads(resp.read().decode('utf-8'))
        print(f"  [OK] Backend Branding -> System Name: '{brand_data.get('system_name')}'")
        
    print("=== ALL PREVIEW & BACKEND TESTS PASSED ===")
except Exception as e:
    print(f"  [ERROR] {e}")
