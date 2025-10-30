// Utility to extract readable article content from arbitrary news pages
function getArticleMetadata() {
	const title = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]')?.content || document.title || '';
	const author = document.querySelector('meta[name="author"], [rel="author"]')?.content || '';
	const publishedTime = document.querySelector('meta[property="article:published_time"], time[datetime]')?.getAttribute('content') || '';
	return { title, author, publishedTime };
}

function getMainText() {
	// Prefer article tags and main landmarks
	const candidates = [
		document.querySelector('article'),
		document.querySelector('main'),
	];
	for (const el of candidates) {
		if (el && el.innerText && el.innerText.trim().length > 400) {
			return el.innerText.trim();
		}
	}
	// Fallback: longest paragraph cluster
	let longest = '';
	document.querySelectorAll('p').forEach(p => {
		const txt = p.innerText?.trim() || '';
		if (txt.length > longest.length) longest = txt;
	});
	return longest;
}

function collectPageContent() {
	const meta = getArticleMetadata();
	const text = getMainText();
	const url = location.href;
	return { ...meta, text, url, collectedAt: new Date().toISOString() };
}

(function initContentCollector() {
	try {
		const payload = collectPageContent();
		// Skip known warmup/empty pages to avoid overwriting valid cache
		const isWarmup = /warmup/i.test(payload.title || '') || /warmup/.test(payload.url || '') || /google\.com\/warmup/i.test(payload.url || '');
		const hasText = !!(payload.text && payload.text.trim().length > 0);
		if (isWarmup || !hasText) {
			console.warn('[News Insight] Skipping PAGE_CONTENT (warmup or empty) for', payload.url);
			return;
		}
		console.log('[News Insight] Collected page content:', payload);
		chrome.runtime.sendMessage({ type: 'PAGE_CONTENT', payload });
	} catch (err) {
		// noop
	}
})();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	if (msg?.type === 'REQUEST_PAGE_CONTENT') {
		const payload = collectPageContent();
		sendResponse({ ok: true, payload });
		return true;
	}
	return false;
});

// Proactive Language Highlighter
(function initLanguageHighlighter() {
    console.log('[News Insight] Initializing Language Highlighter');
    // 1. Add styles for highlighting
    const style = document.createElement('style');
    style.textContent = `
        /* --- Base styles for highlighted text --- */
        .unbias-highlight-loaded, .unbias-highlight-absolute, .unbias-highlight-weak,
        .unbias-rewritten, .unbias-proofread, .unbias-summary {
            position: relative;
            cursor: help;
        }

        /* --- Underline/background styles for different types --- */
        .unbias-highlight-loaded {
            border-bottom: 2px solid rgba(220, 20, 60, 0.7); /* Vermilion for Loaded Language */
        }
        .unbias-highlight-absolute {
            border-bottom: 2px solid rgba(255, 215, 0, 0.7); /* Amber for Absolutes */
        }
        .unbias-highlight-weak {
            border-bottom: 2px solid rgba(100, 149, 237, 0.7); /* Cornflower Blue for Weak Sources */
        }
        .unbias-proofread {
            background-color: rgba(255, 0, 0, 0.1);
            border-bottom: 2px dotted red;
        }
        .unbias-rewritten {
            background-color: rgba(173, 216, 230, 0.3);
            border-bottom: 2px dotted #007bff;
        }
        .unbias-summary {
            background-color: rgba(144, 238, 144, 0.3);
            border-bottom: 2px dotted #28a745;
        }

        /* --- UNIFIED TOOLTIP STYLE --- */
        .unbias-highlight-loaded::after,
        .unbias-highlight-absolute::after,
        .unbias-highlight-weak::after,
        .unbias-rewritten::after,
        .unbias-proofread::after,
        .unbias-summary::after {
            content: attr(data-tooltip);
            position: absolute;
            bottom: 125%; /* Position the tooltip above the text */
            left: 50%;
            transform: translateX(-50%);

            /* Visuals */
            background-color: #333;
            color: #fff;
            padding: 8px 12px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);

            /* Sizing & Text */
            width: 250px; /* Key fix: set a consistent width */
            font-size: 14px;
            line-height: 1.4;
            white-space: normal;
            word-wrap: break-word;

            /* State & Animation */
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s;
            z-index: 1001;
        }

        /* --- UNIFIED HOVER BEHAVIOR --- */
        .unbias-highlight-loaded:hover::after,
        .unbias-highlight-absolute:hover::after,
        .unbias-highlight-weak:hover::after,
        .unbias-rewritten:hover::after,
        .unbias-proofread:hover::after,
        .unbias-summary:hover::after {
            opacity: 1; /* Show on hover */
        }
    `;
    document.head.appendChild(style);

    // 2. IntersectionObserver to detect when paragraphs are visible
    const observer = new IntersectionObserver(handleIntersection, { threshold: 0.5 });

    // 3. Observe all paragraphs
    const paragraphs = document.querySelectorAll('p');
    console.log(`[News Insight] Observing ${paragraphs.length} paragraphs.`);
    paragraphs.forEach(p => observer.observe(p));

    function handleIntersection(entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const p = entry.target;
                console.log('[News Insight] Paragraph is intersecting:', p);
                // Stop observing once it has been processed
                observer.unobserve(p);
                // Analyze the paragraph
                analyzeAndHighlight(p);
            }
        });
    }

    async function analyzeAndHighlight(p) {
        const text = p.innerText;
        if (!text || text.trim().length < 50) return; // Ignore short paragraphs

        console.log('[News Insight] Analyzing paragraph for highlighting:', p);
        console.log('[News Insight] Preparing to send HIGHLIGHT_LANGUAGE message.'); // New log
        chrome.runtime.sendMessage({ type: 'HIGHLIGHT_LANGUAGE', payload: { text } }, response => {
            console.log('[News Insight] sendMessage callback entered.'); // New log
            if (chrome.runtime.lastError) {
                console.error('[News Insight] Error sending message to background:', chrome.runtime.lastError);
                return;
            }

            console.log('[News Insight] Received response from background for highlighting:', response);

            if (response && response.ok && response.data && response.data.phrases && Array.isArray(response.data.phrases)) {
                console.log('[News Insight] Highlighting data received:', response.data.phrases);
                highlightPhrases(p, response.data.phrases);
            } else {
                console.warn('[News Insight] Received invalid or error response for highlighting. Response:', response);
            }
        });
    }

    function highlightPhrases(element, phrases) {
        if (!phrases || phrases.length === 0) {
            console.log('[News Insight] No phrases to highlight.');
            return;
        }

        console.log(`[News Insight] Attempting to highlight ${phrases.length} phrases in element:`, element);
        let innerHTML = element.innerHTML;
        let highlights = 0;

        phrases.forEach((phraseObj, index) => {
            try {
                const phrase = phraseObj.phrase;
                const category = phraseObj.category;
                if (!phrase || !category) {
                    console.warn(`[News Insight] Phrase object at index ${index} is missing 'phrase' or 'category'.`, phraseObj);
                    return;
                }

                console.log(`[News Insight] Processing phrase #${index + 1}: "${phrase}" (Category: ${category})`);

                // Determine the class and tooltip based on category
                let highlightClass = '';
                let tooltip = '';
                switch (category) {
                    case 'LOADED_LANGUAGE':
                        highlightClass = 'unbias-highlight-loaded';
                        tooltip = 'Loaded & Emotional Language: Words designed to provoke strong emotional responses instead of rational ones.';
                        break;
                    case 'ABSOLUTE_GENERALIZATION':
                        highlightClass = 'unbias-highlight-absolute';
                        tooltip = 'Absolutes & Hyperbole: Sweeping, all-or-nothing generalizations that are often unprovable.';
                        break;
                    case 'WEAK_SOURCE':
                        highlightClass = 'unbias-highlight-weak';
                        tooltip = 'Vague & Uncertain Language: Words that hedge or obscure claims, often from anonymous sources.';
                        break;
                }

                // Escape special characters in the phrase to use it in a regex
                const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b(${escapedPhrase})\\b`, 'gi');

                if (regex.test(innerHTML)) {
                    innerHTML = innerHTML.replace(regex, `<mark class="${highlightClass}" data-tooltip='${tooltip}'>$1</mark>`);
                    highlights++;
                    console.log(`[News Insight]   -> Highlighted "${phrase}" with class ${highlightClass}`);
                } else {
                    console.log(`[News Insight]   -> Phrase "${phrase}" not found in paragraph.`);
                }
            } catch (e) {
                console.error(`[News Insight] Error processing phrase: "${phraseObj.phrase}"`, e);
            }
        });

        if (highlights > 0) {
            element.innerHTML = innerHTML;
            console.log(`[News Insight] Applied ${highlights} highlights to the paragraph.`);
        } else {
            console.log('[News Insight] No phrases were highlighted in this paragraph.');
        }
    }
})();