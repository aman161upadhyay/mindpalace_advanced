// Popup Script — Mind Palace v2

document.addEventListener("DOMContentLoaded", () => {
  const viewMain      = document.getElementById("view-main");
  const viewSettings  = document.getElementById("view-settings");
  const listEl        = document.getElementById("highlights-list");
  const btnSettings   = document.getElementById("btn-settings");
  const btnBack       = document.getElementById("btn-back");
  const btnDashboard  = document.getElementById("btn-open-dashboard");
  const btnSave       = document.getElementById("btn-save-settings");
  const inputUrl      = document.getElementById("input-dashboard-url");
  const inputToken    = document.getElementById("input-api-token");
  const statusEl      = document.getElementById("settings-status");
  let currentSettings = { dashboardUrl: "", apiToken: "" };

  // ─── View Switching ──────────────────────────────────────────────────────────

  function show(name) {
    viewMain.classList.toggle("active", name === "main");
    viewSettings.classList.toggle("active", name === "settings");
  }

  btnSettings.addEventListener("click", async () => {
    currentSettings = await getSettings();
    inputUrl.value = currentSettings.dashboardUrl || "";
    inputToken.value = currentSettings.apiToken || "";
    show("settings");
  });

  btnBack.addEventListener("click", () => {
    show("main");
    loadRecent();
  });

  // ─── Save Settings ───────────────────────────────────────────────────────────

  btnSave.addEventListener("click", () => {
    const url = inputUrl.value.trim().replace(/\/$/, "");
    const token = inputToken.value.trim();

    if (!url || !token) {
      showStatus("Dashboard URL and API token are required.", "error");
      return;
    }

    chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", apiToken: token, dashboardUrl: url }, () => {
      currentSettings = { dashboardUrl: url, apiToken: token };
      showStatus("Settings saved!", "success");
      setTimeout(() => { show("main"); loadRecent(); }, 1200);
    });
  });

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "status-msg " + type;
    setTimeout(() => { statusEl.className = "status-msg"; }, 3000);
  }

  // ─── Open Dashboard ──────────────────────────────────────────────────────────

  btnDashboard.addEventListener("click", async () => {
    const settings = await getSettings();
    if (!settings.dashboardUrl) {
      show("settings");
      showStatus("Add your dashboard URL first.", "error");
      return;
    }
    chrome.tabs.create({ url: settings.dashboardUrl.replace(/\/$/, "") + "/mind-palace" });
    window.close();
  });

  // ─── Load Recent Highlights ──────────────────────────────────────────────────

  function loadRecent() {
    listEl.innerHTML = '<div class="spinner"></div>';

    getSettings().then((settings) => {
      currentSettings = settings;
      if (!settings.dashboardUrl || !settings.apiToken) {
        renderNeedsSetup();
        return;
      }

      chrome.runtime.sendMessage({ type: "GET_RECENT" }, (response) => {
        if (chrome.runtime.lastError) {
          renderError("Extension error. Try reloading the page.");
          return;
        }
        if (!response || !response.success) {
          renderError((response && response.error) || "Could not load highlights");
          return;
        }
        const items = response.data;
        if (!items || items.length === 0) {
          renderEmpty();
        } else {
          renderHighlights(items);
        }
      });
    });
  }

  function getSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
        resolve({
          dashboardUrl: (response && response.dashboardUrl) || "",
          apiToken: (response && response.apiToken) || "",
        });
      });
    });
  }

  function renderHighlights(items) {
    listEl.innerHTML = "";
    items.forEach((h) => {
      const div = document.createElement("div");
      div.className = "highlight-item";
      const domain = h.domain || tryDomain(h.sourceUrl);
      const date = new Date(h.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      div.innerHTML =
        '<div class="hi-text">"' + esc(h.text) + '"</div>' +
        '<div class="hi-meta"><span class="hi-domain">' + esc(domain) + '</span><span>' + date + '</span></div>';
      listEl.appendChild(div);
    });
  }

  function renderEmpty() {
    listEl.innerHTML =
      '<div class="empty-state">' +
      '<div class="empty-icon">✦</div>' +
      '<div class="empty-title">No highlights yet</div>' +
      '<div class="empty-desc">Select text on any webpage and press<br><strong>Ctrl+Shift+S</strong> to save your first highlight.</div>' +
      '</div>';
  }

  function renderNeedsSetup() {
    listEl.innerHTML =
      '<div class="empty-state">' +
      '<div class="empty-icon">✦</div>' +
      '<div class="empty-title">Connect Mind Palace v2</div>' +
      '<div class="empty-desc">Open settings and add your v2 dashboard URL plus API token.</div>' +
      '</div>';
  }

  function renderError(msg) {
    listEl.innerHTML =
      '<div class="empty-state">' +
      '<div class="empty-icon" style="color:#ef4444">✗</div>' +
      '<div class="empty-title">Could not load</div>' +
      '<div class="empty-desc">' + esc(msg) + '</div>' +
      '</div>';
  }

  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  function tryDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch (_) { return url || "unknown"; }
  }

  // ─── Init ────────────────────────────────────────────────────────────────────
  loadRecent();
});
