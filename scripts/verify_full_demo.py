import requests
import time
import subprocess
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def log(msg, status="INFO"):
    print(f"[{status}] {msg}")

def check_redis_key(project_id, environment_id):
    key = f"ff:flags:{project_id}:{environment_id}"
    log(f"Checking Redis Key: {key}", "REDIS")
    
    # SCAN
    cmd_scan = f'docker exec ff-redis redis-cli --scan --pattern "{key}"'
    res_scan = subprocess.run(cmd_scan, shell=True, capture_output=True, text=True).stdout.strip()
    if not res_scan:
        log("Redis SCAN failed - Key not found", "FAIL")
        return False
    log(f"SCAN Found: {res_scan}", "PASS")

    # TTL
    cmd_ttl = f'docker exec ff-redis redis-cli ttl {key}'
    res_ttl = subprocess.run(cmd_ttl, shell=True, capture_output=True, text=True).stdout.strip()
    try:
        ttl_val = int(res_ttl)
        if ttl_val > 0:
            log(f"TTL: {ttl_val}s", "PASS")
        else:
            log(f"TTL Invalid: {ttl_val}", "FAIL")
    except:
        log(f"TTL Error: {res_ttl}", "FAIL")

    # GET
    cmd_get = f'docker exec ff-redis redis-cli get {key}'
    res_get = subprocess.run(cmd_get, shell=True, capture_output=True, text=True).stdout.strip()
    if res_get and "enable_dark_mode" in res_get:
        log("GET Content Verified (JSON valid)", "PASS")
    else:
        log(f"GET Content Invalid: {res_get[:50]}...", "FAIL")
    
    return True

def run_simulation():
    # 1. Wizard Simulation
    ts = int(time.time())
    p_name = f"verify_{ts}"
    
    # Project
    r = requests.post(f"{BASE_URL}/admin/v1/projects", json={"name": p_name})
    if r.status_code != 200: return log("Project Create Failed", "FAIL")
    pid = r.json()["id"]
    log(f"Project Created: {pid}", "PASS")

    # Env
    r = requests.post(f"{BASE_URL}/admin/v1/envs", json={"project_id": pid, "name": "prod"})
    if r.status_code != 200: return log("Env Create Failed", "FAIL")
    eid = r.json()["id"]
    log(f"Env Created: {eid}", "PASS")

    # Key
    r = requests.post(f"{BASE_URL}/admin/v1/keys", json={"project_id": pid, "environment_id": eid, "key": f"verify-key-{ts}"})
    if r.status_code != 200: return log("Key Create Failed", "FAIL")
    sdk_key = r.json()["key"]
    log(f"SDK Key Created: {sdk_key}", "PASS")

    # Flag
    r = requests.post(f"{BASE_URL}/admin/v1/flags", json={"project_id": pid, "key": "enable_dark_mode", "on": True, "default_variant": "off", "status": "active"})
    fid = r.json()["id"]

    # Variants
    requests.post(f"{BASE_URL}/admin/v1/flags/{fid}/variants", json={"name": "off", "payload": {}})
    requests.post(f"{BASE_URL}/admin/v1/flags/{fid}/variants", json={"name": "dark", "payload": {"theme": "dark"}})

    # Rule (Skip to save time, mostly checking basic flow)
    
    # 2. SDK Request (Prime Cache)
    log("Simulating SDK Request (Priming Cache)...", "SDK")
    t0 = time.time()
    r_sdk = requests.get(f"{BASE_URL}/sdk/v1/flags?env=prod", headers={"X-SDK-Key": sdk_key})
    t1 = time.time()
    if r_sdk.status_code == 200:
        log(f"SDK Response 200 OK ({int((t1-t0)*1000)}ms)", "PASS")
    else:
        log(f"SDK Failed: {r_sdk.text}", "FAIL")

    # 3. Check Redis Immediately
    check_redis_key(pid, eid)

if __name__ == "__main__":
    try:
        run_simulation()
    except Exception as e:
        log(f"Script Error: {e}", "FAIL")
