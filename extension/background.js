// Background Service Worker — Mind Palace (MV3)

const DEFAULT_DASHBOARD_URL = "https://mindpalace-bice.vercel.app";

// Helper to get dynamic settings from storage
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["apiToken", "dashboardUrl"], (items) => {
      resolve({
        apiToken: items.apiToken || "",
        dashboardUrl: (items.dashboardUrl || DEFAULT_DASHBOARD_URL).replace(/\/$/, "")
      });
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  // Remove any existing context menu items first to avoid "duplicate id" errors
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-highlight",
      title: "Save to Mind Palace",
      contexts: ["selection"],
    });
  });
});

// ─── Context Menu ────────────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-highlight" && info.selectionText && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "TRIGGER_SAVE",
    }, () => { void chrome.runtime.lastError; });
  }
});

// ─── Keyboard Command ─────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  if (command !== "save-highlight") return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) return;

    // Guard: content scripts cannot run on chrome:// or edge:// pages
    const url = tab.url || "";
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") ||
        url.startsWith("edge://") || url.startsWith("about:")) {
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_SAVE" }, () => {
      // Swallow "Could not establish connection"
      void chrome.runtime.lastError;
    });
  });
});

// ─── Message Handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SAVE_HIGHLIGHT") {
    handleSaveHighlight(message.payload)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === "GET_RECENT") {
    handleGetRecent()
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    getSettings().then(settings => sendResponse(settings));
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    const updates = {};
    if (message.apiToken !== undefined) updates.apiToken = message.apiToken;
    if (message.dashboardUrl !== undefined) updates.dashboardUrl = message.dashboardUrl;
    chrome.storage.sync.set(updates, () => sendResponse({ success: true }));
    return true;
  }
});

// ─── API: Save Highlight ──────────────────────────────────────────────────────

async function handleSaveHighlight(payload) {
  const { apiToken, dashboardUrl } = await getSettings();
  
  if (!apiToken) {
    throw new Error("Missing API token! Please configure the extension on the settings page.");
  }

  const response = await fetch(`${dashboardUrl}/api/extension/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiToken,
      text: payload.text,
      sourceUrl: payload.sourceUrl,
      pageTitle: payload.pageTitle,
      domain: payload.domain,
    }),
  });

  if (!response.ok) {
    let errText = "";
    try { errText = await response.text(); } catch (_) {}
    throw new Error(`Save failed (${response.status}): ${errText.slice(0, 150)}`);
  }

  try {
    return await response.json();
  } catch (_) {
    return {};
  }
}

// ─── API: Get Recent ──────────────────────────────────────────────────────────

async function handleGetRecent() {
  try {
    const { apiToken, dashboardUrl } = await getSettings();
    if (!apiToken) return [];
    
    const response = await fetch(
      `${dashboardUrl}/api/extension/recent`,
      { method: "GET", headers: { "Authorization": `Bearer ${apiToken}` } }
    );
    if (!response.ok) return [];
    return await response.json();
  } catch (_) {
    return [];
  }
}
