async function getActiveTabId() {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab?.id;
}

async function requestPageContent(tabId) {
	try {
		console.log('[News Insight][Popup] Requesting content from active tab:', tabId);
		const res = await chrome.tabs.sendMessage(tabId, { type: 'REQUEST_PAGE_CONTENT' });
		return res?.payload;
	} catch (e) {
		return null;
	}
}

function renderSummary(summary) {
	const summaryElement = document.getElementById('summary');
	if (typeof summary === 'string') {
		// Convert markdown bullet points to HTML for better display
		const htmlContent = summary
			.replace(/\*\s*(.+)/g, '• $1') // Convert * to bullet points
			.replace(/\n/g, '<br>') // Convert newlines to line breaks
			.replace(/•\s*(.+)/g, '<div style="margin-left: 20px; margin-bottom: 5px;">• $1</div>'); // Style bullet points
		summaryElement.innerHTML = htmlContent;
	} else {
		summaryElement.textContent = JSON.stringify(summary, null, 2);
	}
}

function renderBiases(biases) {
	const ul = document.getElementById('biases');
	ul.innerHTML = '';
	const items = biases?.items || [];
	for (const item of items) {
		const li = document.createElement('li');
		li.textContent = `${item.label}: ${item.detail}${item.score != null ? ` (score ${Math.round(item.score * 100) / 100})` : ''}`;
		ul.appendChild(li);
	}
}

function renderClaims(claims) {
	const ol = document.getElementById('claims');
	ol.innerHTML = '';
	const items = claims?.items || [];
	for (const c of items) {
		const li = document.createElement('li');
		li.textContent = c.short_claim || JSON.stringify(c);
		ol.appendChild(li);
	}
}

async function runAnalysis() {
	await logSummarizerAvailability();
	const tabId = await getActiveTabId();
	let payload = await requestPageContent(tabId);
	// Guard: if payload is empty or looks like a warmup page, try background cache
	if (!payload || !payload.text || payload.text.trim().length === 0 || /warmup/i.test(payload.title || '') || /warmup/.test(payload.url || '')) {
		console.warn('[News Insight][Popup] Empty/warmup payload. Falling back to latest stored content.');
		payload = undefined;
	}
	const res = await chrome.runtime.sendMessage({ type: 'RUN_ANALYSIS', payload });
	if (res?.ok) {
		renderSummary(res.data.summary);
		renderBiases(res.data.biases);
		renderClaims(res.data.claims);
	} else {
		renderSummary(res?.error || 'Failed to analyze.');
	}
}

async function logSummarizerAvailability() {
	try {
		if (chrome?.ai?.summarizer?.availability) {
			const availability = await chrome.ai.summarizer.availability();
			console.log('[News Insight][Popup] Summarizer availability (chrome.ai):', availability);
			return;
		}
		if (typeof Summarizer !== 'undefined' && Summarizer?.availability) {
			const availability = await Summarizer.availability();
			console.log('[News Insight][Popup] Summarizer availability (global Summarizer):', availability);
			return;
		}
		if (window?.ai?.summarizer?.availability) {
			const availability = await window.ai.summarizer.availability();
			console.log('[News Insight][Popup] Summarizer availability (window.ai):', availability);
			return;
		}
		console.warn('[News Insight][Popup] Summarizer availability API not found');
	} catch (e) {
		console.warn('[News Insight][Popup] Summarizer availability check failed', e);
	}
}

window.addEventListener('DOMContentLoaded', () => {
	document.getElementById('analyzeBtn').addEventListener('click', runAnalysis);
});
