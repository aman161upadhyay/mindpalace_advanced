// Content Script — Mind Palace (MV3)
// Fixes:
//  1. CSP-safe tooltip: uses Shadow DOM with inline styles only (no external resources)
//  2. Floating button uses position:fixed (not absolute) so it works on Gemini/Google
//  3. saveHighlight() captures selection BEFORE any async work (Gemini clears it)
//  4. chrome.runtime.sendMessage wrapped in try/catch for invalidated context
//  5. Direct keydown listener uses capture phase with stopImmediatePropagation
//  6. No eval, no external scripts, no blob URLs — fully CSP-compliant

(function () {
  "use strict";

  // Prevent double-injection
  if (window.__hcLoaded) return;
  window.__hcLoaded = true;

  // Mark the page so the web app can detect us
  document.documentElement.setAttribute("data-hc-extension", "true");
  document.dispatchEvent(new CustomEvent("HC_EXTENSION_PRESENT"));

  // ─── Tooltip (Shadow DOM, position:fixed, CSP-safe) ──────────────────────────

  let _tooltipHost = null;
  let _tooltipRoot = null;
  let _tooltipTimer = null;

  function ensureTooltip() {
    if (_tooltipHost) return;

    _tooltipHost = document.createElement("div");
    // Use setAttribute so the style string is treated as a plain attribute,
    // not parsed by the page's CSP. All styles are inline — no external sheets.
    _tooltipHost.setAttribute("style", [
      "all:initial",
      "position:fixed",
      "top:0",
      "left:0",
      "width:0",
      "height:0",
      "overflow:visible",
      "z-index:2147483647",
      "pointer-events:none",
    ].join("!important;") + "!important");

    // Append to <html> not <body> — Gemini replaces <body> children aggressively
    (document.documentElement || document.body).appendChild(_tooltipHost);

    _tooltipRoot = _tooltipHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      #tip {
        position: fixed;
        padding: 9px 15px;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 500;
        line-height: 1.4;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 8px;
        pointer-events: none;
        z-index: 2147483647;
        max-width: 340px;
        box-shadow: 0 6px 24px rgba(0,0,0,0.35);
        opacity: 0;
        transform: translateY(6px);
        transition: opacity 0.18s ease, transform 0.18s ease;
        white-space: nowrap;
      }
      #tip.visible {
        opacity: 1;
        transform: translateY(0);
      }
      #tip.success { background: linear-gradient(135deg, #6366f1, #8b5cf6); border: 1px solid rgba(139,92,246,0.4); }
      #tip.error   { background: #dc2626; border: 1px solid rgba(220,38,38,0.5); }
      #tip.saving  { background: #1e1e2e; border: 1px solid rgba(255,255,255,0.12); }
      .icon {
        width: 18px; height: 18px; border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; flex-shrink: 0;
      }
    `;
    _tooltipRoot.appendChild(style);

    const tip = document.createElement("div");
    tip.id = "tip";
    _tooltipRoot.appendChild(tip);
  }

  function showTooltip(msg, type, x, y) {
    ensureTooltip();
    const tip = _tooltipRoot.getElementById("tip");

    // Set class for colour
    tip.className = type || "saving";

    // Build content
    const icon = type === "success" ? "✓" : type === "error" ? "✗" : "…";
    tip.innerHTML = "";
    const iconEl = document.createElement("span");
    iconEl.className = "icon";
    iconEl.textContent = icon;
    const msgEl = document.createElement("span");
    msgEl.textContent = msg;
    tip.appendChild(iconEl);
    tip.appendChild(msgEl);

    // Position: x/y are viewport-relative (from getBoundingClientRect)
    // position:fixed means we use them directly — no scrollX/Y offset
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const TIP_W = 300;
    const TIP_H = 44;

    let left = (x != null) ? x : vw / 2 - TIP_W / 2;
    let top  = (y != null) ? y + 12 : vh / 2;

    if (left + TIP_W > vw - 8) left = vw - TIP_W - 8;
    if (left < 8) left = 8;
    if (top + TIP_H > vh - 8) top = (y != null ? y : vh / 2) - TIP_H - 12;
    if (top < 8) top = 8;

    tip.style.left = left + "px";
    tip.style.top  = top  + "px";

    // Trigger transition
    tip.classList.remove("visible");
    void tip.offsetWidth; // reflow
    tip.classList.add("visible");

    clearTimeout(_tooltipTimer);
    if (type !== "saving") {
      _tooltipTimer = setTimeout(hideTooltip, type === "error" ? 4000 : 2500);
    }
  }

  function hideTooltip() {
    if (!_tooltipRoot) return;
    const tip = _tooltipRoot.getElementById("tip");
    if (tip) tip.classList.remove("visible");
  }

  // ─── Floating "Save" Button ───────────────────────────────────────────────────
  // Uses position:fixed so it works on Gemini (which has a transformed/sticky layout)

  let _fabHost = null;
  let _fabRoot = null;
  let _fabVisible = false;

  function ensureFab() {
    if (_fabHost) return;

    _fabHost = document.createElement("div");
    _fabHost.setAttribute("style", [
      "all:initial",
      "position:fixed",
      "top:0",
      "left:0",
      "width:0",
      "height:0",
      "overflow:visible",
      "z-index:2147483646",
      "pointer-events:none",
    ].join("!important;") + "!important");

    (document.documentElement || document.body).appendChild(_fabHost);
    _fabRoot = _fabHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      #fab {
        position: fixed;
        padding: 6px 13px;
        border-radius: 7px;
        background: #1e1e2e;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,0.28);
        border: 1px solid rgba(255,255,255,0.12);
        display: none;
        align-items: center;
        gap: 5px;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 0.14s ease, transform 0.14s ease, background 0.12s;
        pointer-events: auto;
        user-select: none;
        white-space: nowrap;
      }
      #fab.visible {
        opacity: 1;
        transform: translateY(0);
      }
      #fab:hover { background: #2d2d44; }
      #fab:active { transform: translateY(1px); }
    `;
    _fabRoot.appendChild(style);

    const fab = document.createElement("div");
    fab.id = "fab";
    fab.textContent = "✦ Save";

    fab.addEventListener("mousedown", (e) => e.preventDefault()); // don't clear selection
    fab.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideFab();
      saveHighlight();
    });

    _fabRoot.appendChild(fab);
  }

  function showFab(x, y) {
    ensureFab();
    const fab = _fabRoot.getElementById("fab");
    const vw = window.innerWidth;
    const FAB_W = 90;

    let left = x - FAB_W / 2;
    if (left + FAB_W > vw - 8) left = vw - FAB_W - 8;
    if (left < 8) left = 8;

    let top = y - 44;
    if (top < 8) top = y + 12;

    fab.style.left = left + "px";
    fab.style.top  = top  + "px";
    fab.style.display = "flex";
    void fab.offsetWidth;
    fab.classList.add("visible");
    _fabVisible = true;
  }

  function hideFab() {
    if (!_fabRoot) return;
    const fab = _fabRoot.getElementById("fab");
    if (!fab) return;
    fab.classList.remove("visible");
    _fabVisible = false;
    setTimeout(() => { if (!_fabVisible) fab.style.display = "none"; }, 150);
  }

  // Show FAB after mouseup if there is a selection
  document.addEventListener("mouseup", () => {
    setTimeout(() => {
      const text = getSelectedText();
      if (text) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          // Use viewport-relative coords (rect is already viewport-relative)
          showFab(rect.left + rect.width / 2, rect.top);
        }
      } else {
        hideFab();
      }
    }, 30);
  }, true);

  document.addEventListener("selectionchange", () => {
    if (!getSelectedText()) hideFab();
  });

  // ─── Core: Get Selected Text ──────────────────────────────────────────────────

  function getSelectedText() {
    try {
      const sel = window.getSelection();
      return sel ? sel.toString().trim() : "";
    } catch (_) {
      return "";
    }
  }

  function getSelectionRect() {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        return sel.getRangeAt(0).getBoundingClientRect();
      }
    } catch (_) {}
    return null;
  }

  // ─── Core: Save Highlight ─────────────────────────────────────────────────────

  async function saveHighlight() {
    // CRITICAL: Capture text and position IMMEDIATELY before any async work.
    // On Gemini and other SPAs, the selection is cleared the moment focus shifts.
    const text = getSelectedText();
    const rect = getSelectionRect();
    const tipX = rect ? rect.right : window.innerWidth / 2;
    const tipY = rect ? rect.bottom : window.innerHeight / 2;

    if (!text) {
      showTooltip("Select some text first", "error", tipX, tipY);
      return;
    }

    if (text.length > 50000) {
      showTooltip("Selection too long (max 50k chars)", "error", tipX, tipY);
      return;
    }

    showTooltip("Saving…", "saving", tipX, tipY);

    const payload = {
      text,
      sourceUrl: window.location.href,
      pageTitle: document.title || "",
      domain: (() => {
        try { return new URL(window.location.href).hostname.replace(/^www\./, ""); }
        catch (_) { return ""; }
      })(),
    };

    try {
      const response = await sendToBackground({ type: "SAVE_HIGHLIGHT", payload });

      if (response && response.success) {
        showTooltip("Saved to Mind Palace ✓", "success", tipX, tipY);
        try { window.getSelection().removeAllRanges(); } catch (_) {}
      } else {
        const err = (response && response.error) || "Unknown error";
        showTooltip("Error: " + err.slice(0, 60), "error", tipX, tipY);
      }
    } catch (err) {
      // Extension context invalidated or background not responding
      showTooltip("Extension error — try reloading the page", "error", tipX, tipY);
      console.error("[HC]", err);
    }
  }

  // ─── Helper: Send message to background safely ────────────────────────────────

  function sendToBackground(msg) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(msg, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  // ─── Message Listener (from background: keyboard shortcut relay) ──────────────

  try {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "TRIGGER_SAVE") {
        saveHighlight();
      }
    });
  } catch (_) {
    // Extension context already invalidated on this page
  }

  // ─── Direct Keyboard Fallback ─────────────────────────────────────────────────
  // Capture phase (true) so we intercept BEFORE the page's own handlers.
  // This is the fallback for cases where the background relay doesn't arrive.

  document.addEventListener("keydown", (e) => {
    const isMac = navigator.platform ? /mac/i.test(navigator.platform) : false;
    const mainMod = isMac ? e.metaKey : e.ctrlKey;

    if (mainMod && e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.stopImmediatePropagation();
      saveHighlight();
    }
  }, true /* capture phase */);

  // ─── Website ↔ Extension Bridge (DOM Custom Events) ──────────────────────────
  // The Settings page on the web app uses these events to read/write extension config.

  document.addEventListener("HC_GET_SETTINGS", () => {
    try {
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
        if (chrome.runtime.lastError) return;
        document.dispatchEvent(new CustomEvent("HC_SETTINGS_RESPONSE", {
          detail: {
            apiToken: (response && response.apiToken) || "",
            dashboardUrl: (response && response.dashboardUrl) || "",
          }
        }));
      });
    } catch (_) {}
  });

  document.addEventListener("HC_SAVE_SETTINGS", (e) => {
    const detail = (e && e.detail) || {};
    try {
      chrome.runtime.sendMessage(
        { type: "SAVE_SETTINGS", apiToken: detail.apiToken || "", dashboardUrl: detail.dashboardUrl || "" },
        (response) => {
          if (chrome.runtime.lastError) return;
          document.dispatchEvent(new CustomEvent("HC_SETTINGS_SAVED", {
            detail: { success: !!(response && response.success) }
          }));
        }
      );
    } catch (_) {}
  });

})();
