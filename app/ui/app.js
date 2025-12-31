//admin front end'i
const $view = document.getElementById("view");
const $alerts = document.getElementById("alerts");

// Aynı backend içinde servis edeceğimiz için base boş kalsın:
const API_BASE = ""; // istersen "/api" gibi prefix yok

const $adminInput = document.getElementById("adminKeyInput");
const $adminBadge = document.getElementById("adminKeyBadge");

if ($adminInput) {
  $adminInput.value = localStorage.getItem("ADMIN_KEY") || "";
  if ($adminInput.value) $adminBadge.classList.remove("d-none");
  $adminInput.oninput = () => {
    localStorage.setItem("ADMIN_KEY", $adminInput.value);
    if ($adminInput.value) $adminBadge.classList.remove("d-none");
    else $adminBadge.classList.add("d-none");
  };
}

function showAlert(message, type = "danger") {
  $alerts.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${escapeHtml(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function apiFetch(path, { method = "GET", body, headers = {} } = {}) {
  const opts = { method, headers: { ...headers } };

  const adminKey = localStorage.getItem("ADMIN_KEY") || "";
  if (adminKey) opts.headers["X-Admin-Key"] = adminKey;
  /*
  localStorage ifadesi bilgisayarında tutulan bir not defteri gibi düşünebiliriz.sunucu buna erişemez,normalde ben ui kısmından api isteği atabilmem için benden admin key istiyorki bu zaten admin.py içerisinde de doğrulanmış bir kısım,bu key girildikten
  sonra bunu oto olarak yukarıdaki kod yapısı localStorage'de tutar,böylece bundan sonraki her istek atışımda tek tek admin keyini girmeme gerek kalmadan localStorage bunu oto olarak dolduruyor.
  */

  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(API_BASE + path, opts);

  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const detail = (data && data.detail) ? data.detail : data;
    throw new Error(`${res.status} ${res.statusText} — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
  return data;
}

// ---------- Views ----------
async function renderProjects() {
  $alerts.innerHTML = "";
  $view.innerHTML = `
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h3 class="m-0">Projects</h3>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <form id="createProjectForm" class="row g-2">
          <div class="col-md-8">
            <input id="projectName" class="form-control" placeholder="Project name (unique)" required />
          </div>
          <div class="col-md-4 d-grid">
            <button class="btn btn-primary" type="submit">Create</button>
          </div>
        </form>
        <div class="form-text mt-2">POST /admin/v1/projects</div>
      </div>
    </div>

    <div class="card">
        <div class="card-body">
            <div class="d-flex justify-content-between align-items-center">
            <h5 class="m-0">List</h5>
            <button id="refreshProjects" class="btn btn-sm btn-outline-secondary">Refresh</button>
            </div>

            <hr/>
            <div id="projectsTableWrap" class="table-responsive"></div>
        </div>
    </div>

  `;


  async function load() {
    const list = await apiFetch("/admin/v1/projects");
    const rows = (list || []).map(p => `
      <tr>
        <td>${p.id ?? ""}</td>
        <td>${escapeHtml(p.name ?? "")}</td>
      </tr>
    `).join("");

    document.getElementById("projectsTableWrap").innerHTML = `
      <table class="table table-sm align-middle">
        <thead><tr><th style="width:120px">ID</th><th>Name</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="2" class="text-muted">No projects</td></tr>`}</tbody>
      </table>
    `;
  }

  document.getElementById("refreshProjects").onclick = () => load().catch(e => showAlert(e.message));
  document.getElementById("createProjectForm").onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("projectName").value.trim();
    if (!name) return;
    try {
      await apiFetch("/admin/v1/projects", { method: "POST", body: { name } });
      document.getElementById("projectName").value = "";
      await load();
      showAlert("Project created.", "success");
    } catch (err) {
      showAlert(err.message, "danger"); // 409 burada görünecek
    }
  };

  await load();
}

async function renderEnvs() {
  $alerts.innerHTML = "";
  $view.innerHTML = `
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h3 class="m-0">Environments</h3>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <label class="form-label">Project</label>
        <select id="envProjectSelect" class="form-select"></select>
        <div class="form-text mt-2">GET /admin/v1/projects</div>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <form id="createEnvForm" class="row g-2">
          <div class="col-md-8">
            <input id="envName" class="form-control" placeholder="Environment name (prod/dev/staging)" required />
          </div>
          <div class="col-md-4 d-grid">
            <button class="btn btn-primary" type="submit">Create</button>
          </div>
        </form>
        <div class="form-text mt-2">POST /admin/v1/envs</div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center">
          <h5 class="m-0">List</h5>
          <button id="refreshEnvs" class="btn btn-sm btn-outline-secondary">Refresh</button>
        </div>
        <hr/>
        <div id="envsTableWrap" class="table-responsive"></div>
      </div>
    </div>
  `;

  const $project = document.getElementById("envProjectSelect");

  async function loadProjects() {
    const projects = await apiFetch("/admin/v1/projects");
    if (!projects || projects.length === 0) {
      $project.innerHTML = `<option value="">(no projects)</option>`;
      return;
    }
    $project.innerHTML = projects
      .map(p => `<option value="${p.id}">${escapeHtml(p.name)} (#${p.id})</option>`)
      .join("");
  }

  async function loadEnvs() {
    const projectId = Number($project.value);
    if (!projectId) {
      document.getElementById("envsTableWrap").innerHTML =
        `<div class="text-muted">Create/select a project first.</div>`;
      return;
    }

    // Backend: GET /envs tüm env'leri döndürüyor → burada filtreliyoruz
    const allEnvs = await apiFetch("/admin/v1/envs");
    const envs = (allEnvs || []).filter(e => Number(e.project_id) === projectId);

    const rows = envs.map(e => `
      <tr>
        <td>${e.id ?? ""}</td>
        <td>${escapeHtml(e.name ?? "")}</td>
        <td>${e.project_id ?? ""}</td>
      </tr>
    `).join("");

    document.getElementById("envsTableWrap").innerHTML = `
      <table class="table table-sm align-middle">
        <thead><tr><th style="width:120px">ID</th><th>Name</th><th style="width:140px">Project</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3" class="text-muted">No envs for this project</td></tr>`}</tbody>
      </table>
    `;
  }

  await loadProjects();
  $project.onchange = () => loadEnvs().catch(e => showAlert(e.message));
  document.getElementById("refreshEnvs").onclick = () => loadEnvs().catch(e => showAlert(e.message));

  document.getElementById("createEnvForm").onsubmit = async (e) => {
    e.preventDefault();
    const project_id = Number($project.value);
    const name = document.getElementById("envName").value.trim();
    if (!project_id || !name) return;

    try {
      await apiFetch("/admin/v1/envs", { method: "POST", body: { project_id, name } });
      document.getElementById("envName").value = "";
      await loadEnvs();
      showAlert("Environment created.", "success");
    } catch (err) {
      showAlert(err.message, "danger"); // 409/404/422 burada görünür
    }
  };

  await loadEnvs();
}

async function renderKeys() {
  $alerts.innerHTML = "";
  $view.innerHTML = `
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h3 class="m-0">SDK Keys</h3>
    </div>

    <div class="row g-3 mb-3">
      <div class="col-md-6">
        <div class="card">
          <div class="card-body">
            <label class="form-label">Project</label>
            <select id="keyProjectSelect" class="form-select"></select>
            <div class="form-text mt-2">GET /admin/v1/projects</div>
          </div>
        </div>
      </div>

      <div class="col-md-6">
        <div class="card">
          <div class="card-body">
            <label class="form-label">Environment</label>
            <select id="keyEnvSelect" class="form-select"></select>
            <div class="form-text mt-2">GET /admin/v1/envs (client-side filter)</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <form id="createKeyForm" class="row g-2">
          <div class="col-md-8">
            <input id="sdkKeyValue" class="form-control" placeholder="Key value (e.g. demo-prod)" required />
          </div>
          <div class="col-md-4 d-grid">
            <button class="btn btn-primary" type="submit">Create</button>
          </div>
        </form>
        <div class="form-text mt-2">POST /admin/v1/keys</div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center">
          <h5 class="m-0">List</h5>
          <button id="refreshKeys" class="btn btn-sm btn-outline-secondary">Refresh</button>
        </div>
        <hr/>
        <div id="keysTableWrap" class="table-responsive"></div>
      </div>
    </div>
  `;

  const $project = document.getElementById("keyProjectSelect");
  const $env = document.getElementById("keyEnvSelect");

  async function loadProjects() {
    const projects = await apiFetch("/admin/v1/projects");
    if (!projects || projects.length === 0) {
      $project.innerHTML = `<option value="">(no projects)</option>`;
      return;
    }
    $project.innerHTML = projects
      .map(p => `<option value="${p.id}">${escapeHtml(p.name)} (#${p.id})</option>`)
      .join("");
  }

  async function loadEnvsForProject() {
    const projectId = Number($project.value);
    if (!projectId) {
      $env.innerHTML = `<option value="">(no envs)</option>`;
      return;
    }

    const allEnvs = await apiFetch("/admin/v1/envs");
    const envs = (allEnvs || []).filter(e => Number(e.project_id) === projectId);

    if (envs.length === 0) {
      $env.innerHTML = `<option value="">(no envs for this project)</option>`;
      return;
    }

    $env.innerHTML = envs
      .map(e => `<option value="${e.id}">${escapeHtml(e.name)} (#${e.id})</option>`)
      .join("");
  }

  async function loadKeys() {
    const projectId = Number($project.value);
    const envId = Number($env.value);

    const allKeys = await apiFetch("/admin/v1/keys");

    // Backend key obj: {id, key, project_id, environment_id}
    let keys = allKeys || [];
    if (projectId) keys = keys.filter(k => Number(k.project_id) === projectId);
    if (envId) keys = keys.filter(k => Number(k.environment_id) === envId);

    const rows = keys.map(k => `
      <tr>
        <td>${k.id ?? ""}</td>
        <td><code>${escapeHtml(k.key ?? "")}</code></td>
        <td>${k.project_id ?? ""}</td>
        <td>${k.environment_id ?? ""}</td>
      </tr>
    `).join("");

    document.getElementById("keysTableWrap").innerHTML = `
      <table class="table table-sm align-middle">
        <thead><tr>
          <th style="width:120px">ID</th>
          <th>Key</th>
          <th style="width:140px">Project</th>
          <th style="width:160px">Env</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="text-muted">No keys</td></tr>`}</tbody>
      </table>
    `;
  }

  await loadProjects();
  await loadEnvsForProject();

  $project.onchange = async () => {
    try {
      await loadEnvsForProject();
      await loadKeys();
    } catch (e) {
      showAlert(e.message);
    }
  };

  $env.onchange = () => loadKeys().catch(e => showAlert(e.message));
  document.getElementById("refreshKeys").onclick = () => loadKeys().catch(e => showAlert(e.message));

  document.getElementById("createKeyForm").onsubmit = async (e) => {
    e.preventDefault();
    const project_id = Number($project.value);
    const environment_id = Number($env.value);
    const key = document.getElementById("sdkKeyValue").value.trim();

    if (!project_id) return showAlert("Select a project first.");
    if (!environment_id) return showAlert("Select an environment first.");
    if (!key) return;

    try {
      await apiFetch("/admin/v1/keys", {
        method: "POST",
        body: { project_id, environment_id, key }
      });
      document.getElementById("sdkKeyValue").value = "";
      await loadKeys();
      showAlert("SDK key created.", "success");
    } catch (err) {
      showAlert(err.message, "danger"); // 409/422 vs
    }
  };

  await loadKeys();
}

async function renderFlags() {
  $alerts.innerHTML = "";
  $view.innerHTML = `
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h3 class="m-0">Flags</h3>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <label class="form-label">Project</label>
        <select id="flagProjectSelect" class="form-select"></select>
        <div class="form-text mt-2">GET /admin/v1/projects</div>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <form id="createFlagForm" class="row g-2">
          <div class="col-md-4">
            <input id="flagKey" class="form-control" placeholder="flag key (e.g. enable_dark_mode)" required />
          </div>
          <div class="col-md-2">
            <select id="flagOn" class="form-select">
              <option value="true">on: true</option>
              <option value="false">on: false</option>
            </select>
          </div>
          <div class="col-md-3">
            <input id="flagDefaultVariant" class="form-control" placeholder="default_variant (e.g. off)" />
          </div>
          <div class="col-md-3">
            <select id="flagStatus" class="form-select">
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="published">published</option>
            </select>
          </div>
          <div class="col-12 d-grid">
            <button class="btn btn-primary" type="submit">Create Flag</button>
          </div>
        </form>
        <div class="form-text mt-2">POST /admin/v1/flags</div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center">
          <h5 class="m-0">List</h5>
          <button id="refreshFlags" class="btn btn-sm btn-outline-secondary">Refresh</button>
        </div>
        <hr/>
        <div id="flagsTableWrap" class="table-responsive"></div>
        <div class="form-text mt-2">
          Burada şimdilik liste + create var. Sonraki adımda status patch + variants + rules ekleyeceğiz.
        </div>
      </div>
    </div>
  `;

  const $project = document.getElementById("flagProjectSelect");

  async function loadProjects() {
    const projects = await apiFetch("/admin/v1/projects");
    if (!projects || projects.length === 0) {
      $project.innerHTML = `<option value="">(no projects)</option>`;
      return;
    }
    $project.innerHTML = projects
      .map(p => `<option value="${p.id}">${escapeHtml(p.name)} (#${p.id})</option>`)
      .join("");
  }

  async function loadFlags() {
    const projectId = Number($project.value);
    if (!projectId) {
      document.getElementById("flagsTableWrap").innerHTML =
        `<div class="text-muted">Create/select a project first.</div>`;
      return;
    }

    const allFlags = await apiFetch("/admin/v1/flags");
    const flags = (allFlags || []).filter(f => Number(f.project_id) === projectId);

    const rows = flags.map(f => `
      <tr>
        <td>${f.id ?? ""}</td>
        <td><code>${escapeHtml(f.key ?? "")}</code></td>
        <td>
           <button class="btn btn-sm ${f.on ? 'btn-success' : 'btn-secondary'} py-0 px-2 flag-toggle" data-id="${f.id}" data-on="${f.on}">
            ${f.on ? 'ON' : 'OFF'}
           </button>
        </td>
        <td>${escapeHtml(f.default_variant ?? "")}</td>
        <td><span class="badge text-bg-secondary">${escapeHtml(f.status ?? "")}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" data-action="manage" data-id="${f.id}">
            Manage
          </button>
        </td>
      </tr>
    `).join("");

    document.getElementById("flagsTableWrap").innerHTML = `
      <table class="table table-sm align-middle">
        <thead><tr>
          <th style="width:90px">ID</th>
          <th>Key</th>
          <th style="width:90px">On</th>
          <th style="width:180px">Default</th>
          <th style="width:140px">Status</th>
          <th style="width:120px"></th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="6" class="text-muted">No flags</td></tr>`}</tbody>
      </table>
    `;

    document.querySelectorAll(".flag-toggle").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const turningOn = btn.dataset.on === "false";
        try {
          await apiFetch(`/admin/v1/flags/${id}/on?on=${turningOn}`, { method: "PATCH" });
          await loadFlags();
          showAlert(`Flag ${turningOn ? 'enabled' : 'disabled'} (Cache invalidated) ✅`, "success");
        } catch (e) {
          showAlert(e.message);
        }
      };
    });

    document.querySelectorAll('button[data-action="manage"]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        location.hash = `#/flags/${id}`;
      };
    });

  }

  await loadProjects();
  $project.onchange = () => loadFlags().catch(e => showAlert(e.message));
  document.getElementById("refreshFlags").onclick = () => loadFlags().catch(e => showAlert(e.message));

  document.getElementById("createFlagForm").onsubmit = async (e) => {
    e.preventDefault();
    const project_id = Number($project.value);
    const key = document.getElementById("flagKey").value.trim();
    const on = document.getElementById("flagOn").value === "true";
    const default_variant = document.getElementById("flagDefaultVariant").value.trim() || null;
    const status = document.getElementById("flagStatus").value;

    if (!project_id) return showAlert("Select a project first.");
    if (!key) return;

    try {
      await apiFetch("/admin/v1/flags", {
        method: "POST",
        body: { project_id, key, on, default_variant, status }
      });
      document.getElementById("flagKey").value = "";
      document.getElementById("flagDefaultVariant").value = "";
      await loadFlags();
      showAlert("Flag created.", "success");
    } catch (err) {
      showAlert(err.message, "danger"); // 409/422
    }
  };

  await loadFlags();
}

async function renderConfigs() {
  $alerts.innerHTML = "";
  $view.innerHTML = `
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h3 class="m-0">Remote Configs</h3>
    </div>

    <div class="row g-3 mb-3">
      <div class="col-md-6">
        <div class="card">
          <div class="card-body">
            <label class="form-label">Project</label>
            <select id="cfgProject" class="form-select"></select>
            <div class="form-text mt-2">GET /admin/v1/projects</div>
          </div>
        </div>
      </div>

      <div class="col-md-6">
        <div class="card">
          <div class="card-body">
            <label class="form-label">Environment scope</label>
            <select id="cfgEnv" class="form-select"></select>
            <div class="form-text mt-2">
              GLOBAL = environment_id null (override için env seç)
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center">
          <h5 class="m-0" id="cfgFormTitle">Create Config</h5>
          <button id="cfgCancelEdit" class="btn btn-sm btn-outline-secondary d-none">Cancel edit</button>
        </div>
        <hr/>

        <form id="cfgForm" class="row g-2">
          <div class="col-md-4">
            <label class="form-label">Key</label>
            <input id="cfgKey" class="form-control" placeholder="support_email" required />
          </div>

          <div class="col-md-8">
            <label class="form-label">Value (JSON)</label>
            <textarea id="cfgValue" class="form-control" rows="2">{}</textarea>
          </div>

          <div class="col-12 d-grid">
            <button id="cfgSubmit" class="btn btn-primary" type="submit">Create</button>
          </div>
        </form>

        <div class="form-text mt-2" id="cfgFormHint">
          POST /admin/v1/configs
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center">
          <h5 class="m-0">List</h5>
          <button id="refreshCfg" class="btn btn-sm btn-outline-secondary">Refresh</button>
        </div>
        <hr/>
        <div id="cfgTableWrap" class="table-responsive"></div>
      </div>
    </div>
  `;

  const $project = document.getElementById("cfgProject");
  const $env = document.getElementById("cfgEnv");

  const $title = document.getElementById("cfgFormTitle");
  const $cancel = document.getElementById("cfgCancelEdit");
  const $submit = document.getElementById("cfgSubmit");
  const $hint = document.getElementById("cfgFormHint");

  const $key = document.getElementById("cfgKey");
  const $value = document.getElementById("cfgValue");

  let editId = null; // null => create mode

  function setCreateMode() {
    editId = null;
    $title.textContent = "Create Config";
    $submit.textContent = "Create";
    $hint.textContent = "POST /admin/v1/configs";
    $cancel.classList.add("d-none");
    $key.value = "";
    $value.value = "{}";
  }

  function setEditMode(cfg) {
    editId = cfg.id;
    $title.textContent = `Edit Config (id=${cfg.id})`;
    $submit.textContent = "Update";
    $hint.textContent = `PATCH /admin/v1/configs/${cfg.id}`;
    $cancel.classList.remove("d-none");
    $key.value = cfg.key ?? "";
    $value.value = JSON.stringify(cfg.value ?? {}, null, 2);

    // scope dropdown’ı da sync edelim
    if (cfg.environment_id == null) $env.value = "";
    else $env.value = String(cfg.environment_id);
  }

  async function loadProjects() {
    const projects = await apiFetch("/admin/v1/projects");
    if (!projects || projects.length === 0) {
      $project.innerHTML = `<option value="">(no projects)</option>`;
      return;
    }
    $project.innerHTML = projects
      .map(p => `<option value="${p.id}">${escapeHtml(p.name)} (#${p.id})</option>`)
      .join("");
  }

  async function loadEnvsForProject() {
    const projectId = Number($project.value);
    if (!projectId) {
      $env.innerHTML = `<option value="">GLOBAL</option>`;
      return;
    }

    const allEnvs = await apiFetch("/admin/v1/envs");
    const envs = (allEnvs || []).filter(e => Number(e.project_id) === projectId);

    // GLOBAL seçeneği en üstte
    const opts = [`<option value="">GLOBAL (environment_id = null)</option>`]
      .concat(envs.map(e => `<option value="${e.id}">${escapeHtml(e.name)} (#${e.id})</option>`));

    $env.innerHTML = opts.join("");
  }

  async function loadConfigs() {
    const projectId = Number($project.value);
    if (!projectId) {
      document.getElementById("cfgTableWrap").innerHTML =
        `<div class="text-muted">Create/select a project first.</div>`;
      return;
    }

    const all = await apiFetch("/admin/v1/configs");
    const cfgs = (all || []).filter(c => Number(c.project_id) === projectId);

    const rows = cfgs.map(c => {
      const scope = (c.environment_id == null)
        ? `<span class="badge text-bg-secondary">GLOBAL</span>`
        : `<span class="badge text-bg-info">env:${c.environment_id}</span>`;

      return `
        <tr>
          <td>${c.id ?? ""}</td>
          <td><code>${escapeHtml(c.key ?? "")}</code></td>
          <td>${scope}</td>
          <td><code>${escapeHtml(JSON.stringify(c.value ?? {}))}</code></td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-act="edit" data-id="${c.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-act="del" data-id="${c.id}">Delete</button>
          </td>
        </tr>
      `;
    }).join("");

    document.getElementById("cfgTableWrap").innerHTML = `
      <table class="table table-sm align-middle">
        <thead>
          <tr>
            <th style="width:90px">ID</th>
            <th style="width:220px">Key</th>
            <th style="width:160px">Scope</th>
            <th>Value</th>
            <th style="width:180px"></th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="5" class="text-muted">No configs</td></tr>`}</tbody>
      </table>
    `;

    // Edit/Delete button actions
    const mapById = new Map(cfgs.map(x => [Number(x.id), x]));
    document.querySelectorAll("button[data-act='edit']").forEach(btn => {
      btn.onclick = () => setEditMode(mapById.get(Number(btn.dataset.id)));
    });

    document.querySelectorAll("button[data-act='del']").forEach(btn => {
      btn.onclick = async () => {
        const id = Number(btn.dataset.id);
        if (!confirm(`Delete config id=${id}?`)) return;
        try {
          await apiFetch(`/admin/v1/configs/${id}`, { method: "DELETE" });
          if (editId === id) setCreateMode();
          await loadConfigs();
          showAlert("Config deleted.", "success");
        } catch (e) {
          showAlert(e.message, "danger");
        }
      };
    });
  }

  $cancel.onclick = () => setCreateMode();

  $project.onchange = async () => {
    try {
      await loadEnvsForProject();
      setCreateMode();
      await loadConfigs();
    } catch (e) {
      showAlert(e.message, "danger");
    }
  };

  document.getElementById("refreshCfg").onclick = () => loadConfigs().catch(e => showAlert(e.message));

  document.getElementById("cfgForm").onsubmit = async (e) => {
    e.preventDefault();

    const project_id = Number($project.value);
    if (!project_id) return showAlert("Select a project first.");

    const environment_id = $env.value === "" ? null : Number($env.value);
    const key = $key.value.trim();
    if (!key) return;

    let valueObj;
    try {
      valueObj = parseJsonOrThrow("Config value", $value.value.trim());
    } catch (err) {
      return showAlert(err.message, "danger");
    }

    try {
      if (editId == null) {
        await apiFetch("/admin/v1/configs", {
          method: "POST",
          body: { project_id, environment_id, key, value: valueObj }
        });
        showAlert("Config created.", "success");
      } else {
        await apiFetch(`/admin/v1/configs/${editId}`, {
          method: "PATCH",
          body: { environment_id, key, value: valueObj }
        });
        showAlert("Config updated.", "success");
      }

      setCreateMode();
      await loadConfigs();
    } catch (err) {
      showAlert(err.message, "danger"); // 409/422 vb burada görünür
    }
  };

  // initial
  await loadProjects();
  await loadEnvsForProject();
  setCreateMode();
  await loadConfigs();
}

async function renderSdkPreview() {
  $alerts.innerHTML = "";
  $view.innerHTML = `
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h3 class="m-0">SDK Preview</h3>
    </div>

    <div class="row g-3 mb-3">
      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <label class="form-label">Project</label>
            <select id="prevProject" class="form-select"></select>
            <div class="form-text mt-2">GET /admin/v1/projects</div>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <label class="form-label">Environment</label>
            <select id="prevEnv" class="form-select"></select>
            <div class="form-text mt-2">GET /admin/v1/envs (filter by project)</div>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <label class="form-label">SDK Key</label>
            <select id="prevKey" class="form-select"></select>
            <div class="form-text mt-2">GET /admin/v1/keys (filter by env)</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <div class="d-flex gap-2">
          <button id="btnFetchFlags" class="btn btn-primary">Fetch /sdk/v1/flags</button>
          <button id="btnClear" class="btn btn-outline-secondary">Clear</button>
        </div>
        <div class="form-text mt-2">
          GET /sdk/v1/flags?env=... + Header: X-SDK-Key
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <h5 class="m-0">Response</h5>
        <hr/>
        <pre id="sdkOut" class="bg-light p-3 rounded" style="min-height: 240px; white-space: pre-wrap;"></pre>
      </div>
    </div>
  `;

  const $project = document.getElementById("prevProject");
  const $env = document.getElementById("prevEnv");
  const $key = document.getElementById("prevKey");
  const $out = document.getElementById("sdkOut");

  function setOut(objOrText) {
    if (typeof objOrText === "string") $out.textContent = objOrText;
    else $out.textContent = JSON.stringify(objOrText, null, 2);
  }

  async function loadProjects() {
    const projects = await apiFetch("/admin/v1/projects");
    if (!projects || projects.length === 0) {
      $project.innerHTML = `<option value="">(no projects)</option>`;
      return;
    }
    $project.innerHTML = projects
      .map(p => `<option value="${p.id}">${escapeHtml(p.name)} (#${p.id})</option>`)
      .join("");
  }

  async function loadEnvsForProject() {
    const projectId = Number($project.value);
    const allEnvs = await apiFetch("/admin/v1/envs");
    const envs = (allEnvs || []).filter(e => Number(e.project_id) === projectId);

    if (envs.length === 0) {
      $env.innerHTML = `<option value="">(no envs)</option>`;
      return;
    }
    $env.innerHTML = envs
      .map(e => `<option value="${e.id}">${escapeHtml(e.name)} (#${e.id})</option>`)
      .join("");
  }

  async function loadKeysForEnv() {
    const projectId = Number($project.value);
    const envId = Number($env.value);

    const allKeys = await apiFetch("/admin/v1/keys");
    const keys = (allKeys || [])
      .filter(k => Number(k.project_id) === projectId)
      .filter(k => Number(k.environment_id) === envId);

    if (keys.length === 0) {
      $key.innerHTML = `<option value="">(no keys for this env)</option>`;
      return;
    }
    $key.innerHTML = keys
      .map(k => `<option value="${escapeHtml(k.key)}">${escapeHtml(k.key)} (id:${k.id})</option>`)
      .join("");
  }

  async function refreshAll() {
    await loadProjects();
    await loadEnvsForProject();
    await loadKeysForEnv();
  }

  $project.onchange = async () => {
    try {
      await loadEnvsForProject();
      await loadKeysForEnv();
    } catch (e) {
      showAlert(e.message, "danger");
    }
  };

  $env.onchange = async () => {
    try {
      await loadKeysForEnv();
    } catch (e) {
      showAlert(e.message, "danger");
    }
  };

  document.getElementById("btnClear").onclick = () => setOut("");

  document.getElementById("btnFetchFlags").onclick = async () => {
    try {
      const envId = Number($env.value);
      const sdkKey = $key.value;

      if (!envId) return showAlert("Select an environment.", "danger");
      if (!sdkKey) return showAlert("Select an SDK key.", "danger");

      // env name lazım: env select option text'inden çekiyoruz (örn "prod (#1)")
      const envLabel = $env.options[$env.selectedIndex].textContent || "";
      const envName = envLabel.split(" (")[0].trim(); // "prod"

      const resp = await apiFetch(`/sdk/v1/flags?env=${encodeURIComponent(envName)}`, {
        method: "GET",
        headers: { "X-SDK-Key": sdkKey }
      });

      setOut(resp);
      showAlert("Fetched /sdk/v1/flags", "success");
    } catch (e) {
      setOut(String(e.message));
      showAlert(e.message, "danger");
    }
  };

  await refreshAll();
  setOut("Select project/env/key and click Fetch.");
}

async function renderEvaluate() {
  $alerts.innerHTML = "";
  $view.innerHTML = `
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h3 class="m-0">Evaluate</h3>
    </div>

    <div class="row g-3 mb-3">
      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <label class="form-label">Project</label>
            <select id="evProject" class="form-select"></select>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <label class="form-label">Environment</label>
            <select id="evEnv" class="form-select"></select>
          </div>
        </div>
      </div>

      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <label class="form-label">SDK Key</label>
            <select id="evKey" class="form-select"></select>
          </div>
        </div>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <label class="form-label">User attributes (JSON)</label>
        <textarea id="evUserJson" class="form-control" rows="5">{
  "user_id": "u-1001",
  "country": "TR"
}</textarea>

        <div class="d-flex gap-2 mt-3">
          <button id="btnEvaluate" class="btn btn-primary">POST /sdk/v1/evaluate</button>
          <button id="btnEvalClear" class="btn btn-outline-secondary">Clear</button>
        </div>

        <div class="form-text mt-2">
          POST /sdk/v1/evaluate?env=... + Header: X-SDK-Key
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <h5 class="m-0">Response</h5>
        <hr/>
        <pre id="evOut" class="bg-light p-3 rounded" style="min-height: 240px; white-space: pre-wrap;"></pre>
      </div>
    </div>
  `;

  const $project = document.getElementById("evProject");
  const $env = document.getElementById("evEnv");
  const $key = document.getElementById("evKey");
  const $out = document.getElementById("evOut");

  function setOut(objOrText) {
    if (typeof objOrText === "string") $out.textContent = objOrText;
    else $out.textContent = JSON.stringify(objOrText, null, 2);
  }

  async function loadProjects() {
    const projects = await apiFetch("/admin/v1/projects");
    if (!projects || projects.length === 0) {
      $project.innerHTML = `<option value="">(no projects)</option>`;
      return;
    }
    $project.innerHTML = projects
      .map(p => `<option value="${p.id}">${escapeHtml(p.name)} (#${p.id})</option>`)
      .join("");
  }

  async function loadEnvsForProject() {
    const projectId = Number($project.value);
    const allEnvs = await apiFetch("/admin/v1/envs");
    const envs = (allEnvs || []).filter(e => Number(e.project_id) === projectId);

    if (envs.length === 0) {
      $env.innerHTML = `<option value="">(no envs)</option>`;
      return;
    }
    $env.innerHTML = envs
      .map(e => `<option value="${e.id}">${escapeHtml(e.name)} (#${e.id})</option>`)
      .join("");
  }

  async function loadKeysForEnv() {
    const projectId = Number($project.value);
    const envId = Number($env.value);

    const allKeys = await apiFetch("/admin/v1/keys");
    const keys = (allKeys || [])
      .filter(k => Number(k.project_id) === projectId)
      .filter(k => Number(k.environment_id) === envId);

    if (keys.length === 0) {
      $key.innerHTML = `<option value="">(no keys for this env)</option>`;
      return;
    }
    $key.innerHTML = keys
      .map(k => `<option value="${escapeHtml(k.key)}">${escapeHtml(k.key)} (id:${k.id})</option>`)
      .join("");
  }

  $project.onchange = async () => {
    try {
      await loadEnvsForProject();
      await loadKeysForEnv();
    } catch (e) {
      showAlert(e.message, "danger");
    }
  };

  $env.onchange = async () => {
    try {
      await loadKeysForEnv();
    } catch (e) {
      showAlert(e.message, "danger");
    }
  };

  document.getElementById("btnEvalClear").onclick = () => setOut("");

  document.getElementById("btnEvaluate").onclick = async () => {
    try {
      const envLabel = $env.options[$env.selectedIndex]?.textContent || "";
      const envName = envLabel.split(" (")[0].trim();
      const sdkKey = $key.value;
      if (!envName) return showAlert("Select an environment.", "danger");
      if (!sdkKey) return showAlert("Select an SDK key.", "danger");

      const userText = document.getElementById("evUserJson").value.trim();
      const userObj = parseJsonOrThrow("User JSON", userText);

      // Body'yi en güvenlisi: direkt user obj
      const resp = await apiFetch(`/sdk/v1/evaluate?env=${encodeURIComponent(envName)}`, {
        method: "POST",
        headers: { "X-SDK-Key": sdkKey },
        body: { user: userObj }
      });

      setOut(resp);
      showAlert("Evaluate OK", "success");
    } catch (e) {
      setOut(String(e.message));
      showAlert(e.message, "danger");
    }
  };

  // initial
  await loadProjects();
  await loadEnvsForProject();
  await loadKeysForEnv();
  setOut("Enter user JSON and click Evaluate.");
}


function parseJsonOrThrow(label, text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${label} JSON invalid: ${e.message}`);
  }
}

async function renderFlagManage(flagId) {
  $alerts.innerHTML = "";
  $view.innerHTML = `<div class="text-muted">Loading...</div>`;

  // Flag'ı tek endpoint ile çekemiyoruz → listeden buluyoruz
  const allFlags = await apiFetch("/admin/v1/flags");
  const flag = (allFlags || []).find(f => Number(f.id) === Number(flagId));

  if (!flag) {
    showAlert(`Flag not found: id=${flagId}`, "danger");
    location.hash = "#/flags";
    return;
  }

  $view.innerHTML = `
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <h3 class="m-0">Manage Flag</h3>
        <div class="text-muted">
          <code>${escapeHtml(flag.key)}</code> • id=${flag.id} • project=${flag.project_id}
        </div>
      </div>
      <div class="d-flex gap-2">
        <button id="backToFlags" class="btn btn-outline-secondary">← Back</button>
      </div>
    </div>

    <!-- STATUS -->
    <div class="card mb-3">
      <div class="card-body">
        <h5 class="m-0">Status</h5>
        <hr/>
        <form id="statusForm" class="row g-2 align-items-end">
          <div class="col-md-4">
            <label class="form-label">Current</label>
            <input class="form-control" value="${escapeHtml(flag.status ?? "")}" disabled />
          </div>
          <div class="col-md-4">
            <label class="form-label">New status</label>
            <select id="newStatus" class="form-select">
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="published">published</option>
            </select>
          </div>
          <div class="col-md-4 d-grid">
            <button class="btn btn-primary" type="submit">Update Status</button>
          </div>
        </form>
        <div class="form-text mt-2">PATCH /admin/v1/flags/${flagId}/status</div>
      </div>
    </div>

    <!-- VARIANTS -->
    <div class="card mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center">
            <h5 class="m-0">Variants</h5>
            <div class="d-flex gap-2">
                <button id="deleteAllVariants" class="btn btn-sm btn-outline-danger">Delete All</button>
                <button id="refreshVariants" class="btn btn-sm btn-outline-secondary">Refresh</button>
            </div>
        </div>

        <hr/>
        <form id="variantForm" class="row g-2 mb-3">
          <div class="col-md-3">
            <input id="variantName" class="form-control" placeholder="name (e.g. dark)" required />
          </div>
          <div class="col-md-7">
            <input id="variantPayload" class="form-control" placeholder='payload JSON (e.g. {"theme":"dark"})' value='{}' required />
          </div>
          <div class="col-md-2 d-grid">
            <button class="btn btn-primary" type="submit">Add Variant</button>
          </div>
        </form>
        <div id="variantsWrap" class="table-responsive"></div>
        <div class="form-text mt-2">GET/POST /admin/v1/flags/${flagId}/variants</div>
      </div>
    </div>

    <!-- RULES -->
    <div class="card">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center">
            <h5 class="m-0">Rules</h5>
            <div class="d-flex gap-2">
                <button id="deleteAllRules" class="btn btn-sm btn-outline-danger">Delete All</button>
                <button id="refreshRules" class="btn btn-sm btn-outline-secondary">Refresh</button>
            </div>
        </div>

        <hr/>

        <form id="ruleForm" class="row g-2 mb-3">
          <div class="col-md-3">
            <label class="form-label">Environment</label>
            <select id="ruleEnv" class="form-select"></select>
          </div>
          <div class="col-md-2">
            <label class="form-label">Priority</label>
            <input id="rulePriority" type="number" class="form-control" value="1" min="1" />
          </div>
          <div class="col-md-7">
            <label class="form-label">Predicate (JSON)</label>
            <textarea id="rulePredicate" class="form-control" rows="2">{ "attr":"country", "op":"==", "value":"TR" }</textarea>
          </div>

          <div class="col-md-12">
            <label class="form-label">Distribution (JSON)</label>
            <textarea id="ruleDistribution" class="form-control" rows="2">{ "off":70, "dark":30 }</textarea>
          </div>

          <div class="col-12 d-grid">
            <button class="btn btn-primary" type="submit">Add Rule</button>
          </div>
        </form>

        <div id="ruleEditor" class="card mb-3 d-none">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                <h6 class="m-0">Edit Rule • <span id="editRuleId"></span></h6>
                <button id="closeRuleEditor" class="btn btn-sm btn-outline-secondary" type="button">Close</button>
                </div>
                <hr/>

                <form id="ruleEditForm" class="row g-2" novalidate>
                <div class="col-md-2">
                    <label class="form-label">Priority</label>
                    <input id="editRulePriority" type="number" class="form-control" min="1" value="1" />
                </div>

                <div class="col-md-5">
                    <label class="form-label">Predicate (JSON)</label>
                    <textarea id="editRulePredicate" class="form-control" rows="3"></textarea>
                </div>

                <div class="col-md-5">
                    <label class="form-label">Distribution (JSON)</label>
                    <textarea id="editRuleDistribution" class="form-control" rows="3"></textarea>
                </div>

                <div class="col-12 d-grid">
                    <button class="btn btn-primary" type="submit">Save Changes</button>
                </div>
                </form>

                <div class="form-text mt-2">PATCH /admin/v1/rules/&lt;id&gt;</div>
            </div>
        </div>


        <div id="rulesWrap" class="table-responsive"></div>
        <div class="form-text mt-2">GET/POST /admin/v1/flags/${flagId}/rules</div>
      </div>
    </div>
  `;

  // RULE EDIT state
  let editingRuleId = null;

  // Edit panel kapat
  document.getElementById("closeRuleEditor").onclick = () => {
    editingRuleId = null;
    document.getElementById("ruleEditor").classList.add("d-none");
  };

  // Save Changes (PATCH)
  document.getElementById("ruleEditForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
      if (!editingRuleId) return showAlert("No rule selected.", "warning");

      const priority = Number(document.getElementById("editRulePriority").value || 1);
      if (priority < 1) return showAlert("Priority must be >= 1", "danger");

      const predicateText = document.getElementById("editRulePredicate").value.trim();
      const distributionText = document.getElementById("editRuleDistribution").value.trim();

      const predicate = parseJsonOrThrow("Predicate", predicateText);
      const distribution = parseJsonOrThrow("Distribution", distributionText);

      await apiFetch(`/admin/v1/rules/${editingRuleId}`, {
        method: "PATCH",
        body: { priority, predicate, distribution }
      });

      document.getElementById("ruleEditor").classList.add("d-none");
      editingRuleId = null;

      await loadRules();
      showAlert("Rule updated.", "success");
    } catch (err) {
      showAlert(err.message, "danger");
    }
  };


  document.getElementById("backToFlags").onclick = () => (location.hash = "#/flags");

  // default select
  const $newStatus = document.getElementById("newStatus");
  if (flag.status) $newStatus.value = String(flag.status);

  // ---- Load envs for rule env dropdown (filter by project_id)
  async function loadRuleEnvs() {
    const allEnvs = await apiFetch("/admin/v1/envs");
    const envs = (allEnvs || []).filter(e => Number(e.project_id) === Number(flag.project_id));
    window.__ruleEnvsById = Object.fromEntries(envs.map(e => [Number(e.id), e]));
    const $ruleEnv = document.getElementById("ruleEnv");

    if (envs.length === 0) {
      $ruleEnv.innerHTML = `<option value="">(no envs for this project)</option>`;
      return;
    }

    $ruleEnv.innerHTML = envs.map(e => `<option value="${e.id}">${escapeHtml(e.name)} (#${e.id})</option>`).join("");
  }

  // ---- Variants
  async function loadVariants() {
    const variants = await apiFetch(`/admin/v1/flags/${flagId}/variants`);

    const rows = (variants || []).map(v => `
    <tr>
      <td>${v.id ?? ""}</td>
      <td><code>${escapeHtml(v.name ?? "")}</code></td>
      <td><code>${escapeHtml(JSON.stringify(v.payload ?? {}))}</code></td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger"
                data-act="del-variant"
                data-id="${v.id}">
          Delete
        </button>
      </td>
    </tr>
  `).join("");

    document.getElementById("variantsWrap").innerHTML = `
    <table class="table table-sm align-middle">
      <thead>
        <tr>
          <th style="width:90px">ID</th>
          <th style="width:180px">Name</th>
          <th>Payload</th>
          <th style="width:140px"></th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="4" class="text-muted">No variants</td></tr>`}</tbody>
    </table>
  `;

    document.querySelectorAll('button[data-act="del-variant"]').forEach(btn => {
      btn.onclick = async () => {
        const variantId = Number(btn.dataset.id);
        if (!variantId) return;
        if (!confirm(`Delete variant id=${variantId}?`)) return;

        try {
          await apiFetch(`/admin/v1/variants/${variantId}`, { method: "DELETE" });
          await loadVariants();
          showAlert("Variant deleted.", "success");
        } catch (err) {
          showAlert(err.message, "danger");
        }
      };
    });
  }

  // Refresh button
  document.getElementById("refreshVariants").onclick =
    () => loadVariants().catch(e => showAlert(e.message));

  // Delete All Variants button
  document.getElementById("deleteAllVariants").onclick = async () => {
    try {
      // 1) Önce rule var mı bak → varsa variant silmeyelim (409 yememek için)
      const rules = await apiFetch(`/admin/v1/flags/${flagId}/rules`);
      if (rules && rules.length > 0) {
        return showAlert(
          `Bu flag için ${rules.length} rule var. Önce Rules bölümünden "Delete All" yap, sonra variantları silebilirsin.`,
          "warning"
        );
      }

      // 2) Variantları çek
      const variants = await apiFetch(`/admin/v1/flags/${flagId}/variants`);
      if (!variants || variants.length === 0) return showAlert("No variants to delete.", "info");

      if (!confirm(`Delete ALL variants for flag_id=${flagId}? (${variants.length} items)`)) return;

      // 3) Tek tek sil
      for (const v of variants) {
        await apiFetch(`/admin/v1/variants/${v.id}`, { method: "DELETE" });
      }

      await loadVariants();
      showAlert("All variants deleted.", "success");
    } catch (err) {
      showAlert(err.message, "danger");
    }
  };


  document.getElementById("variantForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const name = document.getElementById("variantName").value.trim();
      const payloadText = document.getElementById("variantPayload").value.trim();
      const payload = parseJsonOrThrow("Variant payload", payloadText);

      await apiFetch(`/admin/v1/flags/${flagId}/variants`, {
        method: "POST",
        body: { name, payload }
      });

      document.getElementById("variantName").value = "";
      document.getElementById("variantPayload").value = "{}";
      await loadVariants();
      showAlert("Variant added.", "success");
    } catch (err) {
      showAlert(err.message, "danger");
    }
  };

  // ---- Rules
  async function loadRules() {

    const rules = await apiFetch(`/admin/v1/flags/${flagId}/rules`);

    const selectedEnvId = Number(document.getElementById("ruleEnv").value || 0);
    let filtered = rules || [];
    if (selectedEnvId) {
      filtered = filtered.filter(r => Number(r.environment_id) === selectedEnvId);
    }

    const rows = (filtered || []).map(r => `
    <tr>
      <td>${r.id ?? ""}</td>
      <td>${escapeHtml((window.__ruleEnvsById?.[Number(r.environment_id)]?.name) || String(r.environment_id ?? ""))}</td>
      <td>${r.priority ?? ""}</td>
      <td><code>${escapeHtml(JSON.stringify(r.predicate ?? {}))}</code></td>
      <td><code>${escapeHtml(JSON.stringify(r.distribution ?? {}))}</code></td>
      <td class="text-end">
        <div class="d-flex gap-2 justify-content-end">
          <button class="btn btn-sm btn-outline-primary"
                  data-act="edit-rule"
                  data-id="${r.id}">
            Edit
          </button>
          <button class="btn btn-sm btn-outline-danger"
                  data-act="del-rule"
                  data-id="${r.id}">
            Delete
          </button>
        </div>
      </td>
    </tr>
  `).join("");


    document.getElementById("rulesWrap").innerHTML = `
    <table class="table table-sm align-middle">
      <thead><tr>
        <th style="width:90px">ID</th>
        <th style="width:120px">Env</th>
        <th style="width:120px">Priority</th>
        <th>Predicate</th>
        <th>Distribution</th>
        <th style="width:140px"></th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="text-muted">No rules</td></tr>`}</tbody>
    </table>
  `;

    document.querySelectorAll('button[data-act="del-rule"]').forEach(btn => {
      btn.onclick = async () => {
        const ruleId = Number(btn.dataset.id);
        if (!ruleId) return;
        if (!confirm(`Delete rule id=${ruleId}?`)) return;

        try {
          await apiFetch(`/admin/v1/rules/${ruleId}`, { method: "DELETE" });
          await loadRules();
          showAlert("Rule deleted.", "success");
        } catch (err) {
          showAlert(err.message, "danger");
        }
      };
    });

    // Edit handlers
    document.querySelectorAll('button[data-act="edit-rule"]').forEach(btn => {
      btn.onclick = () => {
        const ruleId = Number(btn.dataset.id);
        if (!ruleId) return;

        // aynı loadRules içinde çekilmiş rules listesinden bul
        const rule = (rules || []).find(x => Number(x.id) === ruleId);
        if (!rule) return showAlert("Rule not found in list.", "danger");

        editingRuleId = ruleId;

        document.getElementById("editRuleId").textContent = `id=${ruleId}`;
        document.getElementById("editRulePriority").value = String(rule.priority ?? 1);
        document.getElementById("editRulePredicate").value = JSON.stringify(rule.predicate ?? {}, null, 2);
        document.getElementById("editRuleDistribution").value = JSON.stringify(rule.distribution ?? {}, null, 2);

        document.getElementById("ruleEditor").classList.remove("d-none");
        document.getElementById("editRulePredicate").focus();
      };
    });


  }

  // Refresh button
  document.getElementById("refreshRules").onclick =
    () => loadRules().catch(e => showAlert(e.message));

  document.getElementById("deleteAllRules").onclick = async () => {
    try {
      const selectedEnvId = Number(document.getElementById("ruleEnv").value || 0);
      if (!selectedEnvId) return showAlert("Select an environment first.", "warning");

      const rules = await apiFetch(`/admin/v1/flags/${flagId}/rules`);
      const envRules = (rules || []).filter(r => Number(r.environment_id) === selectedEnvId);

      if (envRules.length === 0) {
        return showAlert("No rules to delete for selected environment.", "info");
      }

      const envName = window.__ruleEnvsById?.[selectedEnvId]?.name || `env_id=${selectedEnvId}`;

      if (!confirm(`Delete ALL rules for ${envName}? (${envRules.length} items)`)) return;

      for (const r of envRules) {
        await apiFetch(`/admin/v1/rules/${r.id}`, { method: "DELETE" });
      }

      await loadRules();
      showAlert(`All rules deleted for ${envName}.`, "success");
    } catch (err) {
      showAlert(err.message, "danger");
    }
  };


  document.getElementById("ruleForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const environment_id = Number(document.getElementById("ruleEnv").value);
      const priority = Number(document.getElementById("rulePriority").value || 1);

      const predicateText = document.getElementById("rulePredicate").value.trim();
      const distributionText = document.getElementById("ruleDistribution").value.trim();

      const predicate = parseJsonOrThrow("Predicate", predicateText);
      const distribution = parseJsonOrThrow("Distribution", distributionText);

      await apiFetch(`/admin/v1/flags/${flagId}/rules`, {
        method: "POST",
        body: { environment_id, priority, predicate, distribution }
      });

      await loadRules();
      showAlert("Rule added.", "success");
    } catch (err) {
      showAlert(err.message, "danger");
    }
  };

  // ---- Status PATCH
  document.getElementById("statusForm").onsubmit = async (e) => {
    e.preventDefault();
    const status = document.getElementById("newStatus").value;
    try {
      await apiFetch(`/admin/v1/flags/${flagId}/status`, {
        method: "PATCH",
        body: { status }
      });
      showAlert("Status updated. (Back to Flags to see refreshed list)", "success");
    } catch (err) {
      showAlert(err.message, "danger");
    }
  };

  // Initial loads
  await loadRuleEnvs();
  document.getElementById("ruleEnv").onchange = () => loadRules().catch(e => showAlert(e.message));
  await loadVariants();
  await loadRules();
}


function renderComingSoon(title) {
  $alerts.innerHTML = "";
  $view.innerHTML = `
    <div class="card">
      <div class="card-body">
        <h3 class="mb-2">${escapeHtml(title)}</h3>
        <p class="text-muted m-0">Bu ekranı bir sonraki adımda bağlayacağız.</p>
      </div>
    </div>
  `;
}

// ---------- Router ----------
async function route() {
  const hash = location.hash || "#/projects";
  try {
    if (hash.startsWith("#/projects")) return await renderProjects();
    if (hash.startsWith("#/envs")) return await renderEnvs();
    if (hash.startsWith("#/keys")) return await renderKeys();
    const m = hash.match(/^#\/flags\/(\d+)/);
    if (m) return await renderFlagManage(Number(m[1]));
    if (hash.startsWith("#/flags")) return await renderFlags();
    if (hash.startsWith("#/configs")) return await renderConfigs();
    if (hash.startsWith("#/sdk-preview")) return await renderSdkPreview();
    if (hash.startsWith("#/evaluate")) return await renderEvaluate();
    return await renderProjects();
  } catch (e) {
    showAlert(e.message);
  }
}


window.addEventListener("hashchange", route);
route();
