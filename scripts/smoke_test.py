import os
import json
import time
import random
import string
import argparse
import urllib.request
import urllib.error
from typing import Any, Dict, Optional, Tuple


def _rand_suffix(n: int = 6) -> str:
    return "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(n))


def http_json(
    method: str,
    url: str,
    body: Optional[dict] = None,
    headers: Optional[dict] = None,
    timeout: int = 15,
) -> Any:
    headers = headers or {}
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers = {**headers, "Content-Type": "application/json"}

    req = urllib.request.Request(url=url, data=data, method=method.upper(), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            if not raw:
                return None
            try:
                return json.loads(raw)
            except Exception:
                return raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(raw)
        except Exception:
            detail = raw
        raise RuntimeError(f"{e.code} {e.reason} — {detail}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error — {e}")


def extract_variant(resp: dict, flag_key: str):
    # Strict schema check
    if "variants" not in resp:
        raise RuntimeError(f"Missing 'variants' key in response: {resp}")
    
    variants = resp["variants"]
    if not isinstance(variants, dict):
        raise RuntimeError(f"'variants' must be a dictionary. Got: {type(variants)}")

    if flag_key not in variants:
        raise RuntimeError(f"Flag '{flag_key}' not found in variants: {variants}")
        
    val = variants[flag_key]
    if not isinstance(val, str):
        raise RuntimeError(f"Variant value for '{flag_key}' must be string. Got: {type(val)} = {val}")

    return val, resp



def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=os.getenv("BASE_URL", "http://127.0.0.1:8000"))
    ap.add_argument("--admin-prefix", default=os.getenv("ADMIN_PREFIX", "/admin/v1"))
    ap.add_argument("--sdk-prefix", default=os.getenv("SDK_PREFIX", "/sdk/v1"))
    ap.add_argument("--admin-key", default=os.getenv("ADMIN_KEY", ""))  # opsiyonel
    ap.add_argument("--admin-header", default=os.getenv("ADMIN_HEADER", "X-Admin-Key"))
    ap.add_argument("--env-name", default=os.getenv("SMOKE_ENV", "prod"))
    ap.add_argument("--flag-key", default=os.getenv("SMOKE_FLAG_KEY", "enable_dark_mode"))
    ap.add_argument("--default-variant", default=os.getenv("SMOKE_DEFAULT_VARIANT", "off"))
    ap.add_argument("--n-users", type=int, default=int(os.getenv("SMOKE_N_USERS", "200")))
    ap.add_argument("--tolerance", type=float, default=float(os.getenv("SMOKE_TOL", "12")))  # yüzde puan
    ap.add_argument("--timeout", type=int, default=int(os.getenv("SMOKE_TIMEOUT", "15")))
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--json-output", action="store_true", help="Print a single line of JSON with results at the end")
    args = ap.parse_args()

    base = args.base.rstrip("/")
    admin = base + args.admin_prefix
    sdk = base + args.sdk_prefix

    admin_headers = {}
    if args.admin_key:
        admin_headers[args.admin_header] = args.admin_key

    suffix = time.strftime("%Y%m%d_%H%M%S") + "_" + _rand_suffix()
    project_name = f"smoke_{suffix}"
    env_name = args.env_name
    sdk_key_value = f"smoke-{suffix}"

    # 70/30
    variant_off = args.default_variant
    variant_dark = "dark"
    distribution = {variant_off: 70, variant_dark: 30}

    predicate = {"attr": "country", "op": "==", "value": "TR"}

    def log(msg: str):
        if not args.json_output:
            print(msg)

    def vlog(msg: str):
        if args.verbose and not args.json_output:
            print(msg)

    log("== Smoke Test starting ==")
    log(f"Base: {base}")
    log(f"Admin: {admin}")
    log(f"SDK:   {sdk}")
    if args.admin_key:
        log(f"Admin auth: {args.admin_header}: (set)")
    else:
        log("Admin auth: (none)")

    # 1) Create project
    log("\n[1/6] Creating project...")
    proj = http_json(
        "POST",
        f"{admin}/projects",
        body={"name": project_name},
        headers=admin_headers,
        timeout=args.timeout,
    )
    project_id = proj["id"]
    vlog(f"Project: {proj}")

    # 2) Create env
    log("[2/6] Creating environment...")
    env = http_json(
        "POST",
        f"{admin}/envs",
        body={"project_id": project_id, "name": env_name},
        headers=admin_headers,
        timeout=args.timeout,
    )
    env_id = env["id"]
    vlog(f"Env: {env}")

    # 3) Create sdk key
    log("[3/6] Creating SDK key...")
    key_obj = http_json(
        "POST",
        f"{admin}/keys",
        body={"project_id": project_id, "environment_id": env_id, "key": sdk_key_value},
        headers=admin_headers,
        timeout=args.timeout,
    )
    vlog(f"SDKKey: {key_obj}")

    # 4) Create flag
    log("[4/6] Creating flag...")
    flag = http_json(
        "POST",
        f"{admin}/flags",
        body={
            "project_id": project_id,
            "key": args.flag_key,
            "on": True,
            "default_variant": args.default_variant,
            "status": "active",
        },
        headers=admin_headers,
        timeout=args.timeout,
    )
    flag_id = flag["id"]
    vlog(f"Flag: {flag}")

    # 5) Create variants
    log("[5/6] Creating variants...")
    v1 = http_json(
        "POST",
        f"{admin}/flags/{flag_id}/variants",
        body={"name": variant_off, "payload": {}},
        headers=admin_headers,
        timeout=args.timeout,
    )
    v2 = http_json(
        "POST",
        f"{admin}/flags/{flag_id}/variants",
        body={"name": variant_dark, "payload": {"theme": "dark"}},
        headers=admin_headers,
        timeout=args.timeout,
    )
    vlog(f"Variant off: {v1}")
    vlog(f"Variant dark: {v2}")

    # 6) Create rule
    log("[6/6] Creating rule (70/30 TR)...")
    rule = http_json(
        "POST",
        f"{admin}/flags/{flag_id}/rules",
        body={
            "environment_id": env_id,
            "priority": 1,
            "predicate": predicate,
            "distribution": distribution,
        },
        headers=admin_headers,
        timeout=args.timeout,
    )
    rule_id = rule.get("id")
    vlog(f"Rule: {rule}")

    # ---- Evaluate tests
    sdk_headers = {"X-SDK-Key": sdk_key_value}

    def eval_user(user_id: str) -> str:
        resp = http_json(
            "POST",
            f"{sdk}/evaluate?env={urllib.parse.quote(env_name)}",
            body={"user": {"user_id": user_id, "country": "TR"}},
            headers=sdk_headers,
            timeout=args.timeout,
        )
        variant, _raw = extract_variant(resp, args.flag_key)
        return variant

    log("\n== Evaluate Stability Test (same user_id x10) ==")
    stable_user = "u-stable-1001"
    first = eval_user(stable_user)
    ok = True
    for i in range(9):
        cur = eval_user(stable_user)
        if cur != first:
            ok = False
            log(f"❌ Stability FAIL: run#{i+2} got={cur} expected={first}")
            break
    if ok:
        log(f"✅ Stability OK: user_id={stable_user} -> {first}")

    log(f"\n== Distribution Test (N={args.n_users}, expected ~70/30) ==")
    counts: Dict[str, int] = {}
    for i in range(args.n_users):
        uid = f"u-{suffix}-{i}"
        var = eval_user(uid)
        counts[var] = counts.get(var, 0) + 1

    total = sum(counts.values()) or 1
    log("Counts:")
    for k, v in sorted(counts.items(), key=lambda x: (-x[1], x[0])):
        pct = (v / total) * 100.0
        log(f"  - {k}: {v} ({pct:.1f}%)")

    off_pct = (counts.get(variant_off, 0) / total) * 100.0
    dark_pct = (counts.get(variant_dark, 0) / total) * 100.0

    tol = args.tolerance
    if abs(off_pct - 70.0) <= tol and abs(dark_pct - 30.0) <= tol:
        log(f"✅ Distribution OK within ±{tol:.1f}pp")
    else:
        raise RuntimeError(f"❌ Distribution out of tolerance (off={off_pct:.1f}%, dark={dark_pct:.1f}%, tol=±{tol:.1f}pp)")

    log("\n== Smoke Test DONE ✅ ==")
    log(f"Created: project={project_name} (id={project_id}), env={env_name} (id={env_id}), sdk_key={sdk_key_value}, flag_id={flag_id}, rule_id={rule_id}")

    if args.json_output:
        res = {
            "project_name": project_name,
            "project_id": project_id,
            "env_name": env_name,
            "env_id": env_id,
            "sdk_key": sdk_key_value,
            "flag_id": flag_id,
            "rule_id": rule_id
        }
        print(json.dumps(res))


if __name__ == "__main__":
    main()


"""
bu dosya yapısı tablolara veri ekleyerek,endpointleri ve bu endpointlere bağlı olan sticky gibi birbirinden farklı kullanıcı oluşturmayı sağlayan test dosyamız.
"""
