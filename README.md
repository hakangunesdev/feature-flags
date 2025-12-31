# Antigravity Feature Flags & Remote Config

A high-performance Feature Flagging and Remote Configuration system built with FastAPI, SQLModel, MariaDB, and Redis.

## 🚀 Demo Runbook (Windows PowerShell)

Follow these steps for a perfect E2E presentation.

### A) Start the Infrastructure
```powershell
# 1. Navigate to project root
cd C:\Users\guneshakan\Dev\feature-flags

# 2. Start Docker stack
docker compose up -d

# 3. Verify Health
Invoke-RestMethod http://127.0.0.1:8000/healthz
```

### B) Generate Demo Data
```powershell
# 1. Get Admin Key from container
$ADMIN_KEY = (docker compose exec -T api printenv ADMIN_KEY).Trim()

# 2. Run Smoke Test with JSON output
python scripts/smoke_test.py --base http://127.0.0.1:8000 --admin-key $ADMIN_KEY --json-output
```
> [!IMPORTANT]
> Copy the `sdk_key` from the JSON output for the next step.

### C) Launch SaaS Frontend
```powershell
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies (First time only)
npm install

# 3. Start Dev Server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🛠️ Presenter Guide
1. Go to `http://localhost:5173/presenter`.
2. Enter the **SDK Key** (generated in Step B) and **Admin Key** (`dev-admin-123`).
3. Set Environment to `prod`.
4. Use **"Check Health"** to verify connection.
5. In **"Flag Control"**, you can toggle the `enable_dark_mode` status.

## 👤 User Flow
1. Go to `http://localhost:5173/signup`.
2. Create a user (e.g., `demo@test.com`, Country: `TR`).
3. In the Dashboard:
   - Click **"Fetch Flags"**: Note the latency (Fast! ⚡).
   - Click **"Evaluate Now"**: See the decision for your specific user context.
   - Switch countries in Signup/Login to see the rule engine in action (TR Distribution vs US default OFF).

---

## 🔑 Access Points
- **SaaS Demo (Frontend):** [http://localhost:5173/signup](http://localhost:5173/signup)
- **Presenter Config:** [http://localhost:5173/presenter](http://localhost:5173/presenter)
- **Admin Panel (Backend UI):** [http://127.0.0.1:8000/ui/](http://127.0.0.1:8000/ui/)
  - Note: Enter `dev-admin-123` in the navbar to enable actions.

---

## 🆘 Troubleshooting (Node/NPM Path)
If `npm` or `node` command is not found, use the full path:
```powershell
# Check versions
& "C:\Program Files\nodejs\node.exe" -v
& "C:\Program Files\nodejs\npm.cmd" -v

# Run Vite manually if npm run dev fails
& "C:\Program Files\nodejs\node.exe" "./node_modules/vite/bin/vite.js" --port 5173
```
