# Persistent Highlights: Implementation Plan

## 1. How the Reference "Highlighter" Extension Works

After analyzing the `highlighter-main` repository, I discovered how it achieves persistent on-page highlighting. It uses a precise **DOM Path Serialization** technique rather than just searching for text strings (which would fail if a word appears multiple times on a page).

Here is the exact mechanism:
1. **Serialization (Saving):**
   When you highlight text, the extension captures the browser's `window.getSelection()`. From this, it extracts the `anchorNode` (the exact text node where your cursor started) and the `focusNode` (where it ended), along with the character offsets (`anchorOffset`, `focusOffset`). 
   It then recursively walks up the DOM tree from those nodes to the `<html>` root, generating a highly specific, unique CSS-like selector path (e.g., `#content > div:nth-of-type(2) > p:nth-of-type(1) > textNode:nth-of-type(0)`).
2. **Storage:**
   These generated paths, offsets, and the URL are saved to `chrome.storage.local`.
3. **Deserialization (Restoring):**
   When you revisit the URL, the content script fetches the stored highlights. It parses the custom CSS selectors to navigate back down the live DOM tree and pinpoint the exact text nodes. It then recreates a `Range` object and wraps the text in a `<mark>` element to visually restore the highlight.

---

## 2. Implementation Plan for Highlight Compendium

To bring this powerful, persistent visual highlighting into your current project (`Highlight Compendium`), here is the step-by-step roadmap to integrate it:

### Step 1: Update the Database Schema
Currently, your database only saves the raw text and the URL. We need to store the structural "anchors" so the extension knows exactly *where* to paint the highlight on the screen.
- **Update `src/schema.ts`**: Add the following fields to the `highlights` table:
  - `containerQuery` (text)
  - `anchorQuery` (text)
  - `anchorOffset` (integer)
  - `focusQuery` (text)
  - `focusOffset` (integer)
- **Migration**: Run `npx drizzle-kit push` to apply these new columns to your Neon database.

### Step 2: Update the Vercel APIs
- **Update Save Endpoint (`api/extension/save.ts`)**: Modify the `POST` handler to accept the new DOM path fields from the extension and insert them into the database alongside the text.
- **Create Fetch Endpoint (`api/extension/page-highlights.ts`)**: Create a new lightweight `GET` endpoint. When provided a `url` query parameter, it should return all highlights specific to that exact page (including the DOM path data).

### Step 3: Enhance the Chrome Extension (`content.js`)
This is where the heavy lifting happens. We will port the core logic from the reference repository into your content script.

1. **Add DOM Serialization Utilities**:
   Bring in the `getQuery(element)` and `robustQuerySelector(query)` helper functions to handle the conversion between live DOM nodes and string paths.

2. **Modify the Save Action**:
   Inside your existing `saveHighlight()` function:
   - Before clearing the selection, extract `selection.anchorNode`, `selection.focusNode`, and `selection.getRangeAt(0).commonAncestorContainer`.
   - Run them through the `getQuery()` utility to generate the paths.
   - Append these paths and their `anchorOffset`/`focusOffset` to the `payload` sent to the background script.

3. **Implement Page Load Restoration**:
   - Add a window `load` event listener in `content.js`.
   - Send a message to `background.js` asking it to fetch highlights for `window.location.href` from the new API endpoint.
   - Once the backend returns the highlights, iterate through them:
     - Use `robustQuerySelector()` to locate the anchor and focus nodes in the DOM.
     - Split the text nodes and wrap the target segment in a `<span class="hc-highlighted-text">` element.
   - Inject a small CSS snippet via `content.js` to give `.hc-highlighted-text` a beautiful yellow background and text-color adjustments (perhaps even a subtle hover tooltip showing the tags!).

### Step 4: Handle Edge Cases (Future-Proofing)
- **Dynamic SPAs (React, Twitter, etc.)**: Many modern websites load content dynamically after the initial page load. We will need to implement a `MutationObserver` that listens for changes in the DOM and attempts to restore the highlights once the required text nodes actually render on the screen.
- **Orphaned Highlights**: If a website updates its layout (e.g., Wikipedia completely redesigns its page), the saved DOM paths will break. The script needs to handle this gracefully with `try/catch` blocks. The highlight text will still safely exist in your Dashboard, even if the visual on-page restoration fails.
