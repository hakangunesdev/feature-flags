# Feature Flags Minimal Frontend Demo

This is a **Vite + React + TypeScript** demo application to showcase your Feature Flags backend.

## 🚀 How to Run

1.  **Install Dependencies**:
    ```bash
    cd frontend
    npm install
    # or
    yarn
    ```

2.  **Start Dev Server**:
    ```bash
    npm run dev
    ```

3.  **Open Browser**:
    Go to `http://localhost:5173` (or the port shown in terminal).

## 🎮 How to Demo

1.  **Connection**:
    *   Ensure Backend is running on port 8000.
    *   Click **"Check Health"** -> Should see `{"ok":true}`.
2.  **Admin Setup**:
    *   Click **"▶ RUN ALL"**.
    *   Watch the log populate. It creates a Project, Env, Key, Flag, Variants, and Rule.
3.  **SDK Flags**:
    *   Click **"GET /sdk/v1/flags"** twice.
    *   First request: `MISS 🐢` (>20ms).
    *   Second request: `HIT ⚡` (<20ms).
4.  **Evaluate**:
    *   Click **"Evaluate"** to see the flag decision for the JSON user user.
    *   Click **"Repeat x10"** to prove stability (sticky sessions if implemented via cache/hashing).
