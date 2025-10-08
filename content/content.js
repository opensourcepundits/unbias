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
