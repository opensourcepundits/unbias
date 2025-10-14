# News Insight (Chrome Extension)

Summarize the current news page, identify potential biases, and surface verifiable claims to encourage critical reading. Built for the Google Chrome Built-in AI Challenge 2025 using on-device AI (e.g., Gemini Nano via Prompt/Summarizer APIs) when available.

## Folder Structure

```
unbias/
├── ai/
│   └── index.js
├── background/
│   └── service-worker.js
├── content/
│   └── content.js
├── popup/
│   ├── index.html
│   ├── popup.css
│   └── popup.js
├── manifest.json
└── README.md
```

## Capabilities
- **Summarizer**: concise neutral summary of who/what/when/where/why/how
- **Bias analyzer**: highlights loaded language, missing perspectives, subjectivity
- **Claim extractor**: lists verifiable claims and suggests verification steps
- **Privacy-first**: designed to use on-device AI; no user content leaves the device

## Implementation plan (in order)

1) Project setup
- **Verify manifest** in `manifest.json` (MV3), permissions: `activeTab`, `scripting`, `storage`.
- **Add icons** under `assets/icons/` (16/32/48/128). Temporary placeholders are fine.

2) Content extraction
- Implement `content/content.js` to collect: title, author, published time, main text, url.
- Prefer `<article>`/`<main>`; fallback to largest paragraph cluster; trim text.
- Send `{ type: 'PAGE_CONTENT', payload }` to background; respond to `REQUEST_PAGE_CONTENT` messages.

3) Background orchestration
- Implement `background/service-worker.js` to:
  - cache latest page content in `chrome.storage.session`.
  - handle `RUN_ANALYSIS` by calling AI wrappers in parallel: summary, bias, claims.
  - return combined result to the popup.

4) Popup UI
- Build `popup/index.html`, `popup.css`, `popup.js` with a "Rewrite", "Critical Thinking", and "Generate Summary" functionality.
- On click: request page content (via scripting message), then send `RUN_ANALYSIS` to background.
- Render sections: Summary, Bias Signals, Claims to Cross-check, Rewrite, Critical Thinking Questions.

5) On-device AI integration
- Replace stubs in `ai/index.js` with built-in APIs when available:
  - Prompt API: generate structured outputs for bias and claims.
  - Summarizer API: produce concise summary.
  - (Optional) Rewriter/Proofreader/Translator for UX additions.
- Ensure models run locally (Gemini Nano) and handle offline mode gracefully.

6) Claim cross-check heuristics (privacy-preserving)
- On-device only: suggest verification steps without calling external services.
- (Optional opt-in) If allowed by challenge rules, provide a toggle to query web sources using user-approved endpoints; otherwise keep offline.

7) UX & notifications
- Add badge/indicator on action icon when potential high subjectivity is detected.
- Provide short, respectful nudges encouraging critical thinking.
- Allow user controls: thresholds, tone, disable on sites, language.

8) Performance & resilience
- Debounce analysis to avoid repeated work; reuse `latestPageContent` cache.
- Handle long pages by truncating input with sliding windows or chunking.
- Add error states and timeouts.

9) Privacy & settings
- Add a `settings` section (in popup or options page) for data handling, opt-ins, and language preferences.
- Document that analysis runs on-device; no telemetry or remote calls by default.

10) Testing & packaging
- Test on popular news sites with different DOM structures.
- Validate MV3 service worker lifecycle; ensure messages work after cold start.
- Package the extension and load it as "Unpacked" in `chrome://extensions`.

## Built-in AI API integration (stubs → real)

Replace calls in `ai/index.js`:
- `runLocalSummarizer` → Summarizer API
- `runLocalPrompt` → Prompt API with JSON schema output for structured responses

Example pseudocode:
```js
const summarizer = await chrome.ai.summarizer.create();
const summary = await summarizer.summarize({ text });
```

## Development notes
- MV3 requires modules for the service worker; keep files small and stateless.
- Prefer deterministic outputs and guardrails; never claim certainty.
- Clearly communicate limitations and encourage user verification.
