import { summarizeArticle, analyzeBiases, extractAndCheckClaims } from '../ai/index.js';

chrome.runtime.onInstalled.addListener(() => {
	chrome.storage.session.clear();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message?.type === 'PAGE_CONTENT') {
		const { payload } = message;
		chrome.storage.session.set({ latestPageContent: payload });
		return false;
	}
	if (message?.type === 'RUN_ANALYSIS') {
		(async () => {
			try {
				const content = message.payload || (await chrome.storage.session.get('latestPageContent')).latestPageContent;
				if (!content?.text) {
					sendResponse({ ok: false, error: 'No content to analyze' });
					return;
				}
				const [summary, biases, claims] = await Promise.all([
					summarizeArticle(content),
					analyzeBiases(content),
					extractAndCheckClaims(content),
				]);
				sendResponse({ ok: true, data: { summary, biases, claims } });
			} catch (e) {
				sendResponse({ ok: false, error: (e && e.message) || 'Analysis failed' });
			}
		})();
		return true; // async
	}
	return false;
});
