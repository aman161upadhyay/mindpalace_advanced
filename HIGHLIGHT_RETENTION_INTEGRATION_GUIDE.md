# Mind Palace Highlight Retention Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent on-page highlight retention to the Mind Palace Chrome extension so saved highlights reappear when a user revisits the original page.

**Architecture:** Treat highlight retention as a set of deep modules with small interfaces: selection anchoring, remote persistence, page restore, and visual rendering. The extension captures a `HighlightAnchor` at save time, the API stores it with the existing highlight row, and the content script restores highlights by asking the background script for `PageHighlight` records for the current `PageKey`. Visual restoration is best effort; the dashboard remains the durable source of truth.

**Tech Stack:** Chrome Extension MV3, plain JavaScript content/background scripts, Vercel serverless API routes, Drizzle ORM, Neon Postgres, React/Vite dashboard.

---

## Principles Applied

This refinement uses the two design-principle files as constraints:

- **Design concept first:** Do not patch highlight retention into random places. Define the data contract and module boundaries before implementation.
- **Ubiquitous language:** Use the same names in docs, code, API payloads, and database columns to reduce semantic drift for humans and agents.
- **Deep modules:** Hide fragile DOM traversal behind a small anchoring interface. Other code should not know how `textNode:nth-of-type()` works.
- **TDD as speed limit:** Add narrow tests or manual probes before broad implementation. Each task should prove one behavior before moving to the next.
- **Premium interaction, not generic UI:** Retained highlights should feel intentional and native to Mind Palace, but they must never fight the host page or leak styles.
- **No placeholder behavior:** Every endpoint, field, restore path, and failure mode should have an explicit contract.

---

## Ubiquitous Language

Use these names consistently:

- `PageKey`: normalized page identity used for restore lookup. Format: `hostname + pathname`, for example `example.com/articles/page`.
- `SourceUrl`: the full URL shown in the dashboard and used as a fallback lookup.
- `HighlightAnchor`: serialized DOM position metadata captured from a browser selection.
- `AnchorQuery`: serialized path to `selection.anchorNode`.
- `FocusQuery`: serialized path to `selection.focusNode`.
- `ContainerQuery`: serialized path to `range.commonAncestorContainer`, promoted to an element when the common ancestor is a text node.
- `RetainedHighlight`: a saved highlight row that has complete anchor metadata and can be painted back onto a page.
- `FoundHighlight`: a retained highlight that was successfully restored into the live page DOM.
- `LostHighlight`: a retained highlight that exists in Mind Palace but could not be restored on the current DOM.

Avoid introducing synonyms like `domPath`, `selectorPath`, `savedRange`, `pageUrlKey`, or `visualHighlight` unless the code intentionally models a different concept.

---

## Source Reference Map

`highlighter-main` should be used as a reference implementation, not copied wholesale.

- `highlighter-main/src/contentScripts/utils/storageManager.js`: strongest source for `getQuery`, `elementFromQuery`, `robustQuerySelector`, storage shape, and local restore flow.
- `highlighter-main/src/contentScripts/highlight/create.js`: shows when to capture `window.getSelection()` and common ancestor metadata.
- `highlighter-main/src/contentScripts/highlight/highlight/highlightV5.js`: best source for multi-node text wrapping, whitespace tolerance, and custom wrapper elements.
- `highlighter-main/src/contentScripts/highlights/loadAll.js`: shows DOM-ready restore timing.
- `highlighter-main/src/contentScripts/utils/errorManager.js`: shows retrying lost highlights for dynamic pages.
- `highlighter-main/src/background/index.js`: shows SPA-aware restore after `chrome.tabs.onUpdated` URL changes.

Important difference: `highlighter-main` stores data in `chrome.storage.local`; Mind Palace should persist anchor data in Postgres so restore works across devices after extension login.

---

## Target Module Boundaries

The current Mind Palace extension is a small plain-JS extension. Keep that simplicity, but introduce deep internal modules as sections in `extension/content.js` first. Split into files later only if the extension packaging is changed.

### `AnchorCodec`

Single responsibility: convert live DOM selection nodes to and from stable string queries.

Public functions:

```js
getPageKey(url?: string): string
getQuery(node: Node): string
elementFromQuery(query: string): Node | undefined
buildHighlightAnchor(selection: Selection): HighlightAnchor | null
```

No other code should manually build CSS-like DOM paths.

### `HighlightPainter`

Single responsibility: paint and identify retained highlights in the host page.

Public functions:

```js
paintRetainedHighlight(record: PageHighlight): boolean
hasPaintedHighlight(highlightId: number | string): boolean
injectHighlightStyles(): void
```

This module owns the wrapper element, class names, data attributes, whitespace matching, and text-node splitting.

### `PageRestoreController`

Single responsibility: coordinate fetching, retrying, and restoring page highlights.

Public functions:

```js
restorePageHighlights(reason?: "initial-load" | "url-change" | "manual-retry"): Promise<void>
scheduleLostHighlightRetries(records: PageHighlight[]): void
```

This module owns retry timing and guards against duplicate restore work.

### `ExtensionApiClient`

Single responsibility: content-script-to-background messages.

Public functions:

```js
saveHighlight(payload: SaveHighlightPayload): Promise<SaveHighlightResult>
getPageHighlights(pageKey: string, sourceUrl: string): Promise<PageHighlight[]>
```

The content script should not call `fetch()` directly; background keeps token and dashboard URL ownership.

---

## Data Contracts

### `HighlightAnchor`

```ts
type HighlightAnchor = {
  pageKey: string;
  exactUrl: string;
  containerQuery: string;
  anchorQuery: string;
  anchorOffset: number;
  focusQuery: string;
  focusOffset: number;
  selectedText: string;
  highlightColor: string;
  textColor: string;
  domVersion: "mind-palace-v1";
};
```

### `SaveHighlightPayload`

Existing fields remain required by the extension save flow. Anchor fields are optional at API level for backward compatibility, but the extension should send them whenever selection anchoring succeeds.

```ts
type SaveHighlightPayload = {
  text: string;
  sourceUrl: string;
  pageTitle: string;
  domain: string;
  anchor?: HighlightAnchor;
};
```

### `PageHighlight`

The page-restore endpoint should return only what the extension needs.

```ts
type PageHighlight = {
  id: number;
  text: string;
  sourceUrl: string;
  pageKey: string | null;
  containerQuery: string;
  anchorQuery: string;
  anchorOffset: number;
  focusQuery: string;
  focusOffset: number;
  highlightColor: string;
  textColor: string;
  domVersion: string;
};
```

---

## Data Model

Add nullable DOM metadata columns to `highlights`. Nullable columns keep old rows valid and allow dashboard-created highlights to remain text-only.

Recommended Drizzle fields in `Knowledge_Area51/src/schema.ts`:

```ts
pageKey: text("page_key"),
exactUrl: text("exact_url"),
containerQuery: text("container_query"),
anchorQuery: text("anchor_query"),
anchorOffset: integer("anchor_offset"),
focusQuery: text("focus_query"),
focusOffset: integer("focus_offset"),
highlightColor: varchar("highlight_color", { length: 32 }).notNull().default("#fef08a"),
textColor: varchar("text_color", { length: 32 }).notNull().default("inherit"),
domVersion: varchar("dom_version", { length: 32 }).notNull().default("mind-palace-v1"),
```

If the project uses generated SQL migrations, create one. If it uses Drizzle push during development, run the established Drizzle workflow and document the resulting schema change in the PR.

---

## Extension UX Direction

Retained highlights should match Mind Palace's product feel without turning every website into a branded landing page.

Visual rules:

- Use a warm yellow highlight, `#fef08a`, with a subtle border glow. Avoid neon, heavy gradients, large shadows, or animations on page load.
- Scope every style with `.mp-retained-highlight` and inject one `<style data-mp-retention-styles="true">` node into `document.documentElement`.
- Use `box-decoration-break: clone` so wrapped multi-line highlights look intentional.
- Never import fonts, images, external CSS, GSAP, or animation libraries into host pages.
- No custom cursor and no global resets. The extension must not change the website's layout, typography, or pointer behavior.
- Optional later milestone: on hover, show a compact Shadow DOM tooltip with "Saved in Mind Palace" and an "Open in Compendium" action. This should be separate from first-pass retention.

Recommended CSS:

```css
.mp-retained-highlight {
  background: linear-gradient(180deg, rgba(254, 240, 138, 0.35), rgba(250, 204, 21, 0.55)) !important;
  color: inherit !important;
  border-radius: 0.18em !important;
  box-shadow: 0 0 0 1px rgba(250, 204, 21, 0.22) !important;
  box-decoration-break: clone !important;
  -webkit-box-decoration-break: clone !important;
}
```

---

## Content Script Algorithms

### Generate `PageKey`

Use `hostname + pathname` by default. Do not include query strings because tracking parameters would prevent restore on the same article.

```js
function getPageKey(url = window.location.href) {
  const parsed = new URL(url);
  return parsed.hostname + parsed.pathname;
}
```

### Serialize DOM Nodes

Port and adapt `getQuery`, `elementFromQuery`, `robustQuerySelector`, and `escapeCSSString` from `highlighter-main/src/contentScripts/utils/storageManager.js`.

Required behavior:

- If an element has an `id`, use `#escaped-id`.
- Stop at `html`.
- For text nodes, store `textNode:nth-of-type(index)` because CSS selectors cannot select text nodes directly.
- For element nodes without IDs, walk through parents and use `tag:nth-of-type(index)`.
- If `document.querySelector()` throws because a page contains invalid rendered markup, fall back to manual child traversal.
- Return `undefined`, not an exception, when a stored query cannot be resolved.

### Capture Anchor Before Async Work

Mind Palace already captures selected text before async work because SPAs can clear selection. Extend that same moment to build the anchor.

```js
function buildHighlightAnchor(selection) {
  if (!selection || selection.rangeCount === 0 || !selection.toString().trim()) return null;

  const range = selection.getRangeAt(0);
  let container = range.commonAncestorContainer;

  while (container && !container.innerHTML) {
    container = container.parentNode;
  }

  if (!container || !selection.anchorNode || !selection.focusNode) return null;

  return {
    pageKey: getPageKey(),
    exactUrl: window.location.href,
    containerQuery: getQuery(container),
    anchorQuery: getQuery(selection.anchorNode),
    anchorOffset: selection.anchorOffset,
    focusQuery: getQuery(selection.focusNode),
    focusOffset: selection.focusOffset,
    selectedText: selection.toString(),
    highlightColor: "#fef08a",
    textColor: "inherit",
    domVersion: "mind-palace-v1",
  };
}
```

Merge the result into the existing `SAVE_HIGHLIGHT` payload as `anchor`.

### Restore Highlights

Add a restore flow in `extension/content.js`:

1. Wait for `DOMContentLoaded` if the document is still loading.
2. Call `ExtensionApiClient.getPageHighlights(getPageKey(), window.location.href)`.
3. For each `PageHighlight`, resolve `ContainerQuery`, `AnchorQuery`, and `FocusQuery`.
4. Call `HighlightPainter.paintRetainedHighlight(record)`.
5. Track failures as `LostHighlight` records and retry every 500ms for up to 10 seconds.
6. Stop retrying once the highlight paints or the retry window expires.

Use an in-memory set of painted IDs so repeated restore attempts do not double-wrap text:

```js
const paintedHighlightIds = new Set();
```

### Paint Highlight Text

Port the `highlightV5.js` strategy with Mind Palace names:

- Start at whichever of anchor/focus appears first.
- Walk visible text nodes inside `ContainerQuery`.
- Split text nodes around the selected segment.
- Compare against stored `text` while tolerating whitespace differences.
- Skip wrapping if the parent already has `.mp-retained-highlight`.
- Do not clear browser selection during restore.
- Clear browser selection only after a new save succeeds.

Wrapper recommendation:

```js
const highlightNode = document.createElement("mark");
highlightNode.className = "mp-retained-highlight";
highlightNode.dataset.mindPalaceHighlightId = String(record.id);
highlightNode.textContent = highlightText;
```

---

## Background Script Contract

Extend `Knowledge_Area51/extension/background.js` while keeping token and dashboard URL ownership there.

Messages:

```ts
{ type: "SAVE_HIGHLIGHT", payload: SaveHighlightPayload }
{ type: "GET_PAGE_HIGHLIGHTS", pageKey: string, sourceUrl: string }
{ type: "RESTORE_PAGE_HIGHLIGHTS" }
```

Add a handler:

```js
if (message.type === "GET_PAGE_HIGHLIGHTS") {
  handleGetPageHighlights(message.pageKey, message.sourceUrl)
    .then((result) => sendResponse({ success: true, data: result }))
    .catch((err) => sendResponse({ success: false, error: err.message, data: [] }));
  return true;
}
```

Fetch contract:

```txt
GET /api/extension/page-highlights?apiToken=<token>&pageKey=<encoded>&sourceUrl=<encoded>
```

SPA support:

```js
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url || !tabId) return;
  chrome.tabs.sendMessage(tabId, { type: "RESTORE_PAGE_HIGHLIGHTS" }, () => {
    void chrome.runtime.lastError;
  });
});
```

Return `[]` if the token is missing, the API fails, or no highlights exist. Host pages should never break because restore failed.

---

## API Contract

### Update `POST /api/extension/save`

File: `Knowledge_Area51/api/extension/save.ts`

Accept optional `anchor`:

```ts
anchor?: {
  pageKey?: string;
  exactUrl?: string;
  containerQuery?: string;
  anchorQuery?: string;
  anchorOffset?: number;
  focusQuery?: string;
  focusOffset?: number;
  selectedText?: string;
  highlightColor?: string;
  textColor?: string;
  domVersion?: string;
}
```

Validation:

- Keep existing API-token, text-length, URL, and domain checks.
- Limit DOM query strings to 4096 characters each.
- Limit `pageKey` to 2048 characters.
- Accept anchor metadata only when `pageKey`, `containerQuery`, `anchorQuery`, `focusQuery`, `anchorOffset`, and `focusOffset` are all valid.
- Store nulls when anchor metadata is absent or incomplete.
- Never trust `selectedText` over top-level `text`; use it only as a consistency check if desired.

### Add `GET /api/extension/page-highlights`

File: `Knowledge_Area51/api/extension/page-highlights.ts`

Input:

- `apiToken`: required.
- `pageKey`: preferred lookup key.
- `sourceUrl`: fallback exact URL lookup.

Output:

```json
[
  {
    "id": 123,
    "text": "selected text",
    "sourceUrl": "https://example.com/article",
    "pageKey": "example.com/article",
    "containerQuery": "html>body:nth-of-type(1)>main:nth-of-type(1)",
    "anchorQuery": "html>body:nth-of-type(1)>main:nth-of-type(1)>p:nth-of-type(2)>textNode:nth-of-type(0)",
    "anchorOffset": 14,
    "focusQuery": "html>body:nth-of-type(1)>main:nth-of-type(1)>p:nth-of-type(2)>textNode:nth-of-type(0)",
    "focusOffset": 42,
    "highlightColor": "#fef08a",
    "textColor": "inherit",
    "domVersion": "mind-palace-v1"
  }
]
```

Security:

- Authenticate `apiToken` with `apiTokens`.
- Filter by the token owner's `userId`.
- Return only rows with complete anchor metadata.
- Do not return notes, tag IDs, metadata tags, or private dashboard-only fields.

---

## Test And Verification Strategy

Use tests where practical and manual browser checks where extension APIs make automation expensive.

### Unit-Level Behaviors To Prove

- `getPageKey("https://www.example.com/a/b?utm=1")` returns `www.example.com/a/b`.
- `getQuery()` and `elementFromQuery()` round-trip an element node.
- `getQuery()` and `elementFromQuery()` round-trip a text node.
- `buildHighlightAnchor()` returns null for empty selection.
- `paintRetainedHighlight()` paints only the selected occurrence when text repeats.
- `paintRetainedHighlight()` can paint a selection across inline elements.
- API save stores null anchor columns when anchor is incomplete.
- Page-highlight endpoint returns only the authenticated user's highlights.

### Manual Browser Scenarios

- Save a highlight on a static article page, reload, and confirm it reappears.
- Save one occurrence of repeated text, reload, and confirm only that occurrence is painted.
- Save text spanning bold/link/inline elements, reload, and confirm the full selection is painted.
- Save on a SPA route, navigate within the SPA, and confirm URL-change restore runs.
- Visit a page after logging out or clearing the extension token and confirm the page remains unaffected.
- Open the dashboard and confirm old text-only highlights still render.

---

## Implementation Tasks

### Task 1: Lock The Data Contract

**Files:**

- Modify: `Knowledge_Area51/HIGHLIGHT_RETENTION_INTEGRATION_GUIDE.md` if contract decisions change

- [ ] Confirm the names in "Ubiquitous Language" are the names to use in code.
- [ ] Confirm the first milestone excludes hover edit/delete tools.
- [ ] Confirm `PageKey` should ignore query strings.
- [ ] Confirm visual style uses the recommended warm yellow CSS.

### Task 2: Schema And Migration

**Files:**

- Modify: `Knowledge_Area51/src/schema.ts`
- Create: Drizzle migration or apply the established Drizzle push workflow

- [ ] Add the nullable DOM metadata columns listed in "Data Model".
- [ ] Keep defaults for `highlightColor`, `textColor`, and `domVersion`.
- [ ] Run the project's schema update workflow.
- [ ] Verify old dashboard rows still load with null DOM metadata.

### Task 3: Save Endpoint Anchor Support

**Files:**

- Modify: `Knowledge_Area51/api/extension/save.ts`

- [ ] Parse `anchor` from `req.body`.
- [ ] Validate anchor completeness and length limits.
- [ ] Insert anchor fields when valid.
- [ ] Insert null anchor fields when absent or incomplete.
- [ ] Preserve existing text-only save behavior.

### Task 4: Page Highlights Endpoint

**Files:**

- Create: `Knowledge_Area51/api/extension/page-highlights.ts`

- [ ] Authenticate `apiToken` like `Knowledge_Area51/api/extension/recent.ts`.
- [ ] Query `highlights` by `userId` and `pageKey`.
- [ ] Fall back to exact `sourceUrl` when `pageKey` has no matches.
- [ ] Return only `PageHighlight` fields.
- [ ] Return `[]` for no matches.

### Task 5: Content Script Deep Modules

**Files:**

- Modify: `Knowledge_Area51/extension/content.js`

- [ ] Add `AnchorCodec` section with `getPageKey`, `getQuery`, `elementFromQuery`, `robustQuerySelector`, `escapeCSSString`, and `buildHighlightAnchor`.
- [ ] Add `HighlightPainter` section with style injection, duplicate guard, and text-node wrapping.
- [ ] Add `PageRestoreController` section with restore and retry logic.
- [ ] Add `ExtensionApiClient` section for `SAVE_HIGHLIGHT` and `GET_PAGE_HIGHLIGHTS` messages.
- [ ] Keep existing FAB, tooltip, keyboard fallback, and settings bridge behavior intact.

### Task 6: Save Anchor Metadata From Extension

**Files:**

- Modify: `Knowledge_Area51/extension/content.js`
- Modify: `Knowledge_Area51/extension/background.js`

- [ ] Capture `selection`, `range`, `container`, offsets, and queries before any async work.
- [ ] Send `anchor` in the existing save payload.
- [ ] Pass `anchor` through `handleSaveHighlight()` to `/api/extension/save`.
- [ ] Keep success/error tooltip behavior unchanged except for text if needed.

### Task 7: Restore Highlights In Extension

**Files:**

- Modify: `Knowledge_Area51/extension/content.js`
- Modify: `Knowledge_Area51/extension/background.js`

- [ ] Add `GET_PAGE_HIGHLIGHTS` message handling in background.
- [ ] Add content-script restore on DOM-ready.
- [ ] Add `RESTORE_PAGE_HIGHLIGHTS` message handling in content script.
- [ ] Add `chrome.tabs.onUpdated` URL-change restore trigger in background.
- [ ] Track `FoundHighlight` and `LostHighlight` states in memory.
- [ ] Avoid double painting with `paintedHighlightIds`.

### Task 8: Verification

**Files:**

- `Knowledge_Area51/extension/*`
- `Knowledge_Area51/api/extension/*`
- `Knowledge_Area51/src/schema.ts`

- [ ] Run `npm run lint` from `Knowledge_Area51` if dependencies are installed.
- [ ] Run `npm run build` from `Knowledge_Area51` if environment variables needed for build are present.
- [ ] Load unpacked extension from `Knowledge_Area51/extension`.
- [ ] Configure API token through the Mind Palace settings bridge.
- [ ] Complete all manual browser scenarios from "Test And Verification Strategy".
- [ ] Confirm no console errors are thrown into host pages during restore failure.

---

## Risks And Guardrails

- DOM paths break when websites redesign pages. Keep dashboard data as the durable source of truth and treat page painting as best effort.
- Shadow DOM, canvas, PDFs, Google Docs, and custom editors may not support standard text-node wrapping.
- Avoid broad fallbacks that search and highlight every matching text string; false positives are worse than a clean `LostHighlight`.
- Do not introduce jQuery, GSAP, image assets, external CSS, custom cursors, or global reset styles into content pages.
- Do not commit or publish `highlighter-main` as part of Mind Palace. Use it only as reference material.
- Keep first milestone focused on restore. Hover tools, color editing, and dashboard jump links can be follow-up milestones after retention is reliable.


