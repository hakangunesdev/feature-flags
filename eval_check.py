import json, urllib.request, os, sys
SDK_KEY = os.environ.get("SdkKey")
BASE="http://127.0.0.1:8000/sdk/v1/evaluate?env=prod"

def call(uid,country):
    try:
        body=json.dumps({"user":{"user_id":uid,"country":country}}).encode()
        req=urllib.request.Request(BASE, data=body, headers={"X-SDK-Key":SDK_KEY,"Content-Type":"application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"error": str(e)}

tr={"dark":0,"off":0,"other":0}
print("Simulating 30 TR users...") 
for i in range(1,31):
    uid=f"uTR_{i}"
    res=call(uid,"TR")
    v=(res.get("variants") or {}).get("enable_dark_mode")
    if v=="dark": tr["dark"]+=1
    elif v=="off": tr["off"]+=1
    else: tr["other"]+=1

print(f"TR_DISTRIBUTION: {tr}")

# US check
res_us=call("uUS_1","US")
v_us=(res_us.get("variants") or {}).get("enable_dark_mode")
print(f"US_DECISION: {v_us}")
