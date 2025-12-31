import re, pathlib
try:
    t = pathlib.Path("smoke_last.txt").read_text(encoding="utf-8", errors="ignore")
    # sdk_key=...
    m_key = re.search(r"sdk_key=([A-Za-z0-9_-]+)", t)
    # Created: ... (id=12), env=... (id=12)
    m_ids = re.search(r"Created:.*?\(id=(\d+)\).*?env=.*?\(id=(\d+)\)", t, re.S)
    print("PARSE_RESULT")
    print("PARSE_OK" if (m_key and m_ids) else "PARSE_FAIL")
    if m_key: print("SDK_KEY", m_key.group(1))
    if m_ids: print("PROJECT_ID", m_ids.group(1)); print("ENV_ID", m_ids.group(2))
except Exception as e:
    print(f"ERROR: {e}")
