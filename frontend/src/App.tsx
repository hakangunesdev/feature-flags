import { useState, useEffect } from 'react';
import { apiCall } from './api';

// --- STYLES (Inline simple layout) ---
// Note: index.css handles the main look, but we'll use conditional rendering for "routes"

export default function App() {
    // Simple Routing
    const [path, setPath] = useState(window.location.pathname);
    useEffect(() => {
        const handlePopState = () => setPath(window.location.pathname);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const navigate = (to: string) => {
        window.history.pushState({}, '', to);
        setPath(to);
    };

    // --- SHARED STATE (localStorage) ---
    const [adminKey, setAdminKey] = useState(localStorage.getItem('DEMO_ADMIN_KEY') || '');
    const [sdkKey, setSdkKey] = useState(localStorage.getItem('DEMO_SDK_KEY') || '');
    const [env, setEnv] = useState(localStorage.getItem('DEMO_ENV') || 'prod');

    // --- USER STATE (Fake Auth) ---
    const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('DEMO_USER') || 'null'));

    // --- DASHBOARD STATE ---
    const [logs, setLogs] = useState<string[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [decision, setDecision] = useState<any>(null);
    const [testResults, setTestResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const log = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 5)]);

    const saveConfig = () => {
        localStorage.setItem('DEMO_ADMIN_KEY', adminKey);
        localStorage.setItem('DEMO_SDK_KEY', sdkKey);
        localStorage.setItem('DEMO_ENV', env);
        alert('Configuration Saved! ✅');
    };

    // --- ACTIONS ---
    const getFlags = async () => {
        if (!sdkKey) return alert('Go to /presenter first!');
        log(`GET /sdk/v1/flags?env=${env}`);
        const res = await apiCall(`/sdk/v1/flags?env=${env}`, 'GET', null, { 'X-SDK-Key': sdkKey });
        setMetrics({ time: res.timeMs, hit: (res.timeMs || 0) < 15 });
        if (res.ok) log(`Flags Loaded: ${res.data?.flags?.length} flags found.`);
    };

    const evaluate = async () => {
        if (!user) return;
        log(`POST /sdk/v1/evaluate (User: ${user.country})`);
        const body = { user: { user_id: user.id, email: user.email, country: user.country } };
        const res = await apiCall(`/sdk/v1/evaluate?env=${env}`, 'POST', body, { 'X-SDK-Key': sdkKey });
        if (res.ok) setDecision(res.data?.variants);
    };

    const run30Users = async () => {
        setLoading(true);
        const results = { dark: 0, off: 0 };
        log("Running 30 Users (TR) test...");
        for (let i = 1; i <= 30; i++) {
            const uid = `u_tr_${i}`;
            const body = { user: { user_id: uid, country: 'TR' } };
            const res = await apiCall(`/sdk/v1/evaluate?env=${env}`, 'POST', body, { 'X-SDK-Key': sdkKey });
            const variant = res.data?.variants?.enable_dark_mode || 'off';
            if (variant === 'dark') results.dark++;
            else results.off++;
        }
        setTestResults(results);
        setLoading(false);
        log(`Test Done: Dark=${results.dark}, Off=${results.off}`);
    };

    // --- VIEWS ---

    const Header = () => (
        <nav className="nav" style={{ justifyContent: 'space-between', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
                <span style={{ fontWeight: 800, color: 'var(--primary)', cursor: 'pointer' }} onClick={() => navigate('/')}>ANTIGRAVITY</span>
                {!user ? (
                    <span className="nav-link" onClick={() => navigate('/signup')}>Sign Up</span>
                ) : (
                    <span className="nav-link" onClick={() => navigate('/dashboard')}>Dashboard</span>
                )}
            </div>
            <span className="nav-link" style={{ fontSize: '0.8rem', opacity: 0.5 }} onClick={() => navigate('/presenter')}>Settings ⚙️</span>
        </nav>
    );

    if (path === '/presenter') {
        return (
            <div className="app-container">
                <Header />
                <div className="glass-card">
                    <h2>Presenter Panel 🛠️</h2>
                    <div className="input-group">
                        <label>Admin Key</label>
                        <input type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)} placeholder="dev-admin-..." />
                    </div>
                    <div className="input-group">
                        <label>SDK Key</label>
                        <input value={sdkKey} onChange={e => setSdkKey(e.target.value)} placeholder="smoke-..." />
                    </div>
                    <div className="input-group">
                        <label>Environment</label>
                        <input value={env} onChange={e => setEnv(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={saveConfig}>Save Keys</button>
                        <button className="secondary" onClick={async () => {
                            const res = await apiCall('/healthz');
                            alert(res.ok ? 'Backend Healthy ✅' : 'Backend Down ❌');
                        }}>Check Health</button>
                    </div>
                    <hr style={{ margin: '2rem 0', opacity: 0.1 }} />
                    <button style={{ background: '#334155' }} onClick={() => navigate('/signup')}>Go to Signup Screen →</button>
                </div>
            </div>
        );
    }

    if (path === '/signup') {
        return (
            <div className="app-container">
                <Header />
                <div className="glass-card" style={{ maxWidth: '400px', margin: '0 auto' }}>
                    <h2>Create Demo Account</h2>
                    {!sdkKey && <div className="tag miss" style={{ width: '100%', marginBottom: '1rem', textAlign: 'center' }}>Demo not configured. Go /presenter</div>}
                    <div className="input-group">
                        <label>Email</label>
                        <input id="email" placeholder="john@example.com" />
                    </div>
                    <div className="input-group">
                        <label>Country</label>
                        <select id="country">
                            <option value="TR">Turkey (TR)</option>
                            <option value="US">United States (US)</option>
                            <option value="DE">Germany (DE)</option>
                        </select>
                    </div>
                    <button onClick={() => {
                        const email = (document.getElementById('email') as HTMLInputElement).value;
                        const country = (document.getElementById('country') as HTMLSelectElement).value;
                        const newUser = { id: `u_${Math.floor(Math.random() * 999)}`, email, country };
                        localStorage.setItem('DEMO_USER', JSON.stringify(newUser));
                        setUser(newUser);
                        navigate('/dashboard');
                    }}>Sign Up Now</button>
                </div>
            </div>
        );
    }

    if (path === '/dashboard' && user) {
        return (
            <div className="app-container">
                <Header />
                <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2>Welcome, {user.email}</h2>
                        <p style={{ color: 'var(--text-dim)', marginBottom: 0 }}>ID: <code>{user.id}</code> | Region: <b>{user.country}</b></p>
                    </div>
                    <button className="secondary" style={{ width: 'auto' }} onClick={() => { setUser(null); localStorage.removeItem('DEMO_USER'); navigate('/signup'); }}>Logout</button>
                </div>

                <div className="metrics-grid">
                    <div className="glass-card metric-card">
                        <h3>Fetch Metadata</h3>
                        <button onClick={getFlags} style={{ marginBottom: '1rem' }}>Get Flags</button>
                        {metrics && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span className={`tag ${metrics.hit ? 'hit' : 'miss'}`}>{metrics.hit ? 'HIT' : 'MISS'}</span>
                                <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{metrics.time}ms</span>
                            </div>
                        )}
                    </div>
                    <div className="glass-card metric-card">
                        <h3>Eval Rules</h3>
                        <button className="secondary" onClick={evaluate} style={{ marginBottom: '1rem' }}>Evaluate Features</button>
                        <pre style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                            {JSON.stringify(decision || {}, null, 2)}
                        </pre>
                    </div>
                </div>

                <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>Distribution Test (TR)</h3>
                        <button onClick={run30Users} disabled={loading} style={{ width: 'auto' }}>
                            {loading ? 'Running...' : 'Run 30 Users'}
                        </button>
                    </div>
                    {testResults && (
                        <div style={{ color: 'var(--secondary)', fontWeight: 700, textAlign: 'center', fontSize: '1.2rem', background: 'rgba(3,218,198,0.05)', padding: '1rem', borderRadius: '8px' }}>
                            Dark Mode: {testResults.dark} | Off: {testResults.off}
                        </div>
                    )}
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.5rem', textAlign: 'right' }}>* Uses 30 unique user IDs (u_tr_1..30)</p>
                </div>

                <div className="log-stream">
                    {logs.map((l, i) => <div key={i}>{l}</div>)}
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <Header />
            <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                <h1 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '1.5rem' }}>Cloud Configuration <br /><span style={{ color: 'var(--primary)' }}>Reimagined.</span></h1>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-dim)', marginBottom: '3rem', maxWidth: '600px', margin: '0 auto 3rem auto' }}>
                    Deliver features faster, manage risk, and scale your global infrastructure with Antigravity Feature Flags.
                </p>
                <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
                    <button style={{ width: '240px', padding: '1rem' }} onClick={() => navigate('/signup')}>Start Free Trial</button>
                    <button className="secondary" style={{ width: '240px', padding: '1rem' }} onClick={() => navigate('/presenter')}>Configure Demo</button>
                </div>
            </div>
        </div>
    );
}
