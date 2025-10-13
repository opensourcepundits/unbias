import { summarizeArticle, analyzeBiases, extractAndCheckClaims } from '../ai/index.js';

// Function to analyse webpage content with LanguageModel
async function analyseWebpage(pageContent) {
	try {
		console.log('[News Insight] Analysing webpage with LanguageModel...');
		
		// Get LanguageModel params and create session
		const params = await LanguageModel.params();
		const session = await LanguageModel.create({
			temperature: 2.0,
			topK: params.defaultTopK,
		});
		
		const predefinedQuestion = "Analyze this webpage content and provide a brief assessment of potential bias indicators, and key factual claims that would benefit from verification. Focus on objectivity and critical analysis.";
		const prompt = `${predefinedQuestion}\n\nPage Title: ${pageContent.title || 'Unknown'}\nURL: ${pageContent.url || 'Unknown'}\n\nContent:\n${pageContent.text}`;
		
		console.log('[News Insight] Processing prompt with LanguageModel API...');
		const analysis = await session.prompt(prompt);
		console.log('[News Insight] AI Analysis of Page Content:', analysis);
		
		session.destroy();
		
		// Return the analysis result
		return analysis;
	} catch (error) {
		console.error('[News Insight] Error analysing webpage with LanguageModel:', error);
		throw error;
	}
}

chrome.runtime.onInstalled.addListener(async () => {
	chrome.storage.session.clear();
	
	// Log LanguageModel params when extension is loaded
	try {
		const params = await LanguageModel.params();
		console.log('[News Insight] Initial LanguageModel.params():', params);
		
		// Initializing a new session must either specify both `topK` and
		// `temperature` or neither of them.
		const slightlyHighTemperatureSession = await LanguageModel.create({
			temperature: 2.0,
			topK: params.defaultTopK,
		});
		
		// Get page content from storage and ask a predefined question
		const { latestPageContent } = await chrome.storage.session.get('latestPageContent');
		if (latestPageContent?.text) {
			const predefinedQuestion = "Analyze this webpage content and provide a brief assessment of its main topics, potential bias indicators, and key factual claims that would benefit from verification. Focus on objectivity and critical analysis.";
			const prompt = `${predefinedQuestion}\n\nPage Title: ${latestPageContent.title || 'Unknown'}\nURL: ${latestPageContent.url || 'Unknown'}\n\nContent:\n${latestPageContent.text}`;
			
			console.log('[News Insight] Processing prompt with LanguageModel API...');
			const analysis = await slightlyHighTemperatureSession.prompt(prompt);
			console.log('[News Insight] AI Analysis of Page Content:', analysis);
		} else {
			console.log('[News Insight] No page content available for analysis');
		}
		
		slightlyHighTemperatureSession.destroy();

		
	} catch (error) {
		console.error('[News Insight] Error with LanguageModel.params() or session creation:', error);
	}
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message?.type === 'PAGE_CONTENT') {
		const { payload } = message;
		console.log('[News Insight] Received PAGE_CONTENT from tab', sender?.tab?.id, payload);
		// Ignore warmup or empty payloads so we don't overwrite good content
		const isWarmup = /warmup/i.test(payload?.title || '') || /warmup/.test(payload?.url || '') || /google\.com\/warmup/i.test(payload?.url || '');
		const hasText = !!(payload?.text && payload.text.trim().length > 0);
		if (isWarmup || !hasText) {
			console.warn('[News Insight] Ignoring warmup/empty PAGE_CONTENT for', payload?.url);
			return false;
		}
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
	if (message?.type === 'ANALYSE_WEBPAGE') {
		(async () => {
			try {
				const content = message.payload || (await chrome.storage.session.get('latestPageContent')).latestPageContent;
				if (!content?.text) {
					sendResponse({ ok: false, error: 'No content to analyse' });
					return;
				}
				const analysis = await analyseWebpage(content);
				sendResponse({ ok: true, data: { analysis } });
			} catch (e) {
				sendResponse({ ok: false, error: (e && e.message) || 'Webpage analysis failed' });
			}
		})();
		return true; // async
	}
	return false;
});
