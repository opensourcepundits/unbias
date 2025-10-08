async function getActiveTabId() {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab?.id;
}

async function requestPageContent(tabId) {
	try {
		const [{ result }] = await chrome.scripting.executeScript({
			target: { tabId },
			func: () => {
				return new Promise(resolve => {
					chrome.runtime.sendMessage({ type: 'REQUEST_PAGE_CONTENT' }, (res) => resolve(res));
				});
			}
		});
		return result?.payload;
	} catch (e) {
		return null;
	}
}

function renderSummary(summary) {
	document.getElementById('summary').textContent = typeof summary === 'string' ? summary : JSON.stringify(summary, null, 2);
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
	const tabId = await getActiveTabId();
	let payload = await requestPageContent(tabId);
	if (!payload) {
		// Fallback: ask background to use last stored content
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

window.addEventListener('DOMContentLoaded', () => {
	document.getElementById('analyzeBtn').addEventListener('click', runAnalysis);
});
