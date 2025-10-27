import { summarizeArticle, analyzeBiases, extractAndCheckClaims, identifyLanguage } from '../api/index.js';

// Default settings
const DEFAULT_SETTINGS = {
	highlightLoadedLanguage: true,
	highlightAbsolutes: true,
	highlightWeakSources: true,
	summaryGeneration: true,
	biasDetection: true,
	claimsExtraction: true,
	aiAnalysis: true,
	contentRewriting: true,
	criticalThinking: true,
	calendarEvents: true
};

// Get settings from storage
async function getSettings() {
	try {
		const stored = await chrome.storage.sync.get('extensionSettings');
		return stored.extensionSettings || DEFAULT_SETTINGS;
	} catch (error) {
		console.error('[News Insight] Error getting settings:', error);
		return DEFAULT_SETTINGS;
	}
}

// Check if a feature is enabled
async function isFeatureEnabled(featureName) {
	const settings = await getSettings();
	return settings[featureName] !== false;
}

function getCalendarAuthToken() {
	return new Promise((resolve, reject) => {
	  // Setting interactive: true prompts the user for sign-in/authorization if needed
	  chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
		if (chrome.runtime.lastError) {
		  return reject(chrome.runtime.lastError);
		}
		if (!token) {
		  return reject(new Error("Could not obtain access token."));
		}
		resolve(token);
	  });
	});
  }


  async function createCalendarEvent(eventData) {
	try {
	  const accessToken = await getCalendarAuthToken();
	  
	  // The default calendar is 'primary'
	  const calendarId = 'primary'; 
	  const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
  
	  const response = await fetch(apiUrl, {
		method: 'POST',
		headers: {
		  'Authorization': `Bearer ${accessToken}`,
		  'Content-Type': 'application/json'
		},
		// Event structure expected by the Google Calendar API
		body: JSON.stringify({
		  summary: eventData.title,
		  description: eventData.description,
		  start: {
			dateTime: eventData.startDateTime, // e.g., '2025-10-25T10:00:00'
			timeZone: 'Asia/Dubai' // Use the user's inferred or set timezone
		  },
		  end: {
			dateTime: eventData.endDateTime,
			timeZone: 'Asia/Dubai'
		  }
		})
	  });
  
	  if (!response.ok) {
		throw new Error(`Calendar API Error: ${response.statusText}`);
	  }
  
	  const event = await response.json();
	  console.log('Event created successfully:', event);
	  return event;
  
	} catch (error) {
	  console.error('Failed to create calendar event:', error);
	  // You may need to handle token expiration here using chrome.identity.removeCachedAuthToken
	}
  }

// Function to analyse webpage content with LanguageModel
async function analyseWebpage(pageContent) {
	try {
		console.log('[News Insight] Analysing webpage with LanguageModel...');
		
		// Get LanguageModel params and create session
		const params = await LanguageModel.params();
		const topK = Math.max(1, Math.min(params.defaultTopK, 100));
		const session = await LanguageModel.create({
			temperature: 2.0,
			topK: topK,
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
		const topK = Math.max(1, Math.min(params.defaultTopK, 100));
		const slightlyHighTemperatureSession = await LanguageModel.create({
			temperature: 2.0,
			topK: topK,
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
				
				// Check which features are enabled
				const summaryEnabled = await isFeatureEnabled('summaryGeneration');
				const biasEnabled = await isFeatureEnabled('biasDetection');
				const claimsEnabled = await isFeatureEnabled('claimsExtraction');
				
				// Only run enabled features
				const tasks = [];
				if (summaryEnabled) tasks.push(summarizeArticle(content));
				else tasks.push(Promise.resolve('Summary generation is disabled'));
				
				if (biasEnabled) tasks.push(analyzeBiases(content));
				else tasks.push(Promise.resolve({ items: [] }));
				
				if (claimsEnabled) tasks.push(extractAndCheckClaims(content));
				else tasks.push(Promise.resolve({ items: [] }));
				
				const [summary, biases, claims] = await Promise.all(tasks);
				sendResponse({ ok: true, data: { summary, biases, claims } });
			} catch (e) {
				sendResponse({ ok: false, error: (e && e.message) || 'Analysis failed' });
			}
		})();
		return true; // async
	}
	if (message?.type === 'HIGHLIGHT_LANGUAGE') {
        (async () => {
            try {
                const content = message.payload;
                console.log('[News Insight] Received HIGHLIGHT_LANGUAGE request with content:', content);

                if (!content?.text) {
                    console.warn('[News Insight] HIGHLIGHT_LANGUAGE request is missing text content.');
                    sendResponse({ ok: false, error: 'No content to analyze' });
                    return;
                }
                
                // Check if any highlighting feature is enabled
                const settings = await getSettings();
                if (!settings.highlightLoadedLanguage && !settings.highlightAbsolutes && !settings.highlightWeakSources) {
                    console.log('[News Insight] All highlighting features disabled.');
                    sendResponse({ ok: true, data: { phrases: [] } });
                    return;
                }

                const phrases = await identifyLanguage(content);
                console.log('[News Insight] Identified phrases for highlighting:', phrases);

                console.log('[News Insight] Sending response for HIGHLIGHT_LANGUAGE:', { ok: true, data: { phrases } });
                sendResponse({ ok: true, data: { phrases } });
            } catch (e) {
                console.error('[News Insight] Failed to identify language for highlighting.', e);
                sendResponse({ ok: false, error: (e && e.message) || 'Analysis failed', details: e });
            }
        })();
        return true; // async
    }
	if (message?.type === 'ANALYSE_WEBPAGE') {
		(async () => {
			try {
				// Check if AI analysis is enabled
				if (!(await isFeatureEnabled('aiAnalysis'))) {
					sendResponse({ ok: false, error: 'AI Analysis is disabled in settings' });
					return;
				}
				
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