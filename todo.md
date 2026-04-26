# Mind Palace — Project TODO

## Backend / Database
- [x] Schema: highlights table (id, userId, text, sourceUrl, pageTitle, domain, tags, notes, createdAt)
- [x] Schema: tags table (id, userId, name, color, createdAt)
- [x] DB migration applied
- [x] tRPC: highlights.create (protected)
- [x] tRPC: highlights.list (protected, with search + tag filter)
- [x] tRPC: highlights.getById (protected)
- [x] tRPC: highlights.update (notes, tags)
- [x] tRPC: highlights.delete (protected)
- [x] tRPC: highlights.export (JSON + Markdown)
- [x] tRPC: tags.list (protected)
- [x] tRPC: tags.create (protected)
- [x] tRPC: tags.delete (protected)
- [x] API key endpoint for Chrome extension auth (generate/revoke personal API token)

## Mind Palace Dashboard Frontend
- [x] Global design system (dark theme, typography, color palette)
- [x] DashboardLayout with sidebar navigation
- [x] Home/Mind Palace page: searchable, filterable highlight list grouped by domain
- [x] Full-text search bar
- [x] Tag filter sidebar/chips
- [x] Highlight card component (text preview, source, domain, tags, date)
- [x] Highlight detail view / modal (full text, URL, notes editor, tags editor, date)
- [x] Export page / modal (JSON + Markdown download)
- [x] Settings page: API key management for Chrome extension
- [x] Empty states for all list views
- [x] Loading skeletons

## Chrome Extension (MV3)
- [x] manifest.json (MV3, permissions: storage, activeTab, scripting, contextMenus)
- [x] content.js: listen for mouseup + Ctrl+Shift+S shortcut
- [x] content.js: capture window.getSelection(), sourceUrl, pageTitle, timestamp
- [x] content.js: visual confirmation tooltip after save
- [x] background.js (service worker): handle messages, call API
- [x] popup.html + popup.js: show 5 most recent highlights + link to dashboard
- [x] popup: settings panel to enter API key + dashboard URL
- [x] Extension packaging script (zip)

## Tests
- [x] Vitest: highlights.create procedure
- [x] Vitest: highlights.list with search filter
- [x] Vitest: highlights.export
- [x] All 12 tests passing

## Delivery
- [x] Extension zip packaged and uploaded to CDN
- [x] Implementation plan document written
- [x] Checkpoint saved
