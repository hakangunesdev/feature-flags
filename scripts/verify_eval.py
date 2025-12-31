import json, urllib.request
SDK_KEY = "smoke-20251219_231216_c0e4yi"
BASE="http://127.0.0.1:8000/sdk/v1/evaluate?env=prod"
def call(uid, country):
    try:
        body=json.dumps({"user":{"user_id":uid,"country":country}}).encode()
        req=urllib.request.Request(BASE, data=body, headers={"X-SDK-Key":SDK_KEY,"Content-Type":"application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"error": str(e)}

tr_counts = {"dark": 0, "off": 0, "other": 0}
for i in range(1, 31):
    uid = f"uTR_{i}"
    res = call(uid, "TR")
    variants = res.get("variants") or {}
    v = variants.get("enable_dark_mode", "off")
    if v in tr_counts: tr_counts[v] += 1
    else: tr_counts["other"] += 1

# US check
res_us = call("uUS_1", "US")
us_decision = (res_us.get("variants") or {}).get("enable_dark_mode", "off")

print("EVAL_RESULT")
print(f"TR_COUNTS: {json.dumps(tr_counts)}")
print(f"US_DECISION: {us_decision}")
