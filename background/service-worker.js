import { summarizeArticle, analyzeBiases, extractAndCheckClaims, runProofreader, runRewriter } from '../api/index.js';

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
		const session = await (chrome?.ai?.languageModel || (typeof window !== 'undefined' && window?.ai?.languageModel)).create({
			temperature: 2.0,
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

	chrome.contextMenus.removeAll(() => {

		chrome.contextMenus.create({

			id: "proofread",

			title: "Proofread",

			contexts: ["selection"]

	});

	chrome.contextMenus.create({

		id: "summarize",

		title: "Summarize",

		contexts: ["selection"]

	});

	chrome.contextMenus.create({

		id: "analyzeBiases",

		title: "Analyze Biases",

		contexts: ["selection"]

	});

	chrome.contextMenus.create({

		id: "extractClaims",

		title: "Extract Claims",

		contexts: ["selection"]

	});

	

	        chrome.contextMenus.create({

				id: "rewrite",

				title: "Rewrite",

				contexts: ["selection"]

			});

			chrome.contextMenus.create({

				id: "analyseImage",		title: "Analyse",

		contexts: ["image"]

	});

	});

	chrome.storage.session.clear();

});chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

                const phrases = await identifyLanguage(content);
                console.log('[News Insight] Identified phrases for highlighting:', phrases);

                console.log('[News Insight] Sending response for HIGHLIGHT_LANGUAGE:', { ok: true, data: { phrases } });
                sendResponse({ ok: true, data: { phrases } });
            }
            catch (e) {
                console.error('[News Insight] Failed to identify language for highlighting.', e);
                sendResponse({ ok: false, error: (e && e.message) || 'Analysis failed', details: e });
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
	if (message?.type === 'RUN_PROOFREADER') {
		(async () => {
			try {
				const content = message.payload;
				if (!content?.text) {
					sendResponse({ ok: false, error: 'No content to proofread' });
					return;
				}
				const result = await runProofreader(content.text);
				sendResponse({ ok: true, data: result });
			} catch (e) {
				sendResponse({ ok: false, error: (e && e.message) || 'Proofreading failed' });
			}
		})();
		return true;
	}
	return false;
});

// Function to resize image and return an ImageBitmap
async function resizeImage(blob, maxWidth, maxHeight) {
	try {
		// Create image bitmap from blob with resizing
		return await createImageBitmap(blob, {
            resizeWidth: maxWidth,
            resizeHeight: maxHeight,
            resizeQuality: 'high'
        });
	} catch (error) {
		throw error;
	}
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	console.log("Context menu clicked:", info, tab);
	const selectedText = info.selectionText;
	if (!selectedText) {
		return;
	}

	switch (info.menuItemId) {
		case "proofread":
			const proofreadResult = await runProofreader(selectedText);
			console.log("Proofreader result:", proofreadResult);
			chrome.scripting.executeScript({
				target: { tabId: tab.id },
				function: (segments) => {
					const selection = window.getSelection();
					if (selection.rangeCount > 0) {
						const range = selection.getRangeAt(0);
						range.deleteContents();
						const fragment = document.createDocumentFragment();
						for (const segment of segments) {
							const span = document.createElement('span');
							span.textContent = segment.text;
							if (segment.explanation) {
								span.className = 'unbias-proofread';
								span.dataset.tooltip = segment.explanation.replace(/\n/g, '<br>');
							}
							fragment.appendChild(span);
						}
						range.insertNode(fragment);
					}
				},
				args: [proofreadResult]
			});
			break;
		case "rewrite":
			const originalText = info.selectionText;
			const rewriteResult = await runRewriter(originalText);
			console.log("Rewriter result:", rewriteResult);
			chrome.scripting.executeScript({
				target: { tabId: tab.id },
				function: (original, rewritten) => {
					const selection = window.getSelection();
					if (selection.rangeCount > 0) {
						const range = selection.getRangeAt(0);
						range.deleteContents();
						const span = document.createElement('span');
						span.className = 'unbias-rewritten';
						span.dataset.tooltip = original.replace(/\n/g, '<br>');
						span.textContent = rewritten;
						range.insertNode(span);
					}
				},
				args: [originalText, rewriteResult]
			});
			break;
		case "summarize":
			const originalTextForSummary = info.selectionText;
			const summarizeResult = await summarizeArticle({ text: originalTextForSummary });
			console.log("Summarize result:", summarizeResult);

			if (summarizeResult) {
				// Get the original HTML of the selection
				const originalHTMLForSummary = await chrome.scripting.executeScript({
					target: { tabId: tab.id },
					function: () => {
						const selection = window.getSelection();
						if (selection.rangeCount > 0) {
							const range = selection.getRangeAt(0);
							const div = document.createElement('div');
							div.appendChild(range.cloneContents());
							return div.innerHTML;
						}
						return '';
					},
				});

				chrome.scripting.executeScript({
					target: { tabId: tab.id },
					function: (originalHTML, summary) => {
						const selection = window.getSelection();
						if (selection.rangeCount > 0) {
							const range = selection.getRangeAt(0);
							range.deleteContents();
							const span = document.createElement('span');
							span.className = 'unbias-summary';
							span.dataset.tooltip = summary;
							span.innerHTML = originalHTML;
							range.insertNode(span);
						}
					},
					args: [originalHTMLForSummary[0].result, summarizeResult.replace(/\n/g, '<br>')]
				});
			}
			break;
		case "analyzeBiases":
			const originalTextForBiases = info.selectionText;
			const analyzeBiasesResult = await analyzeBiases({ text: originalTextForBiases });
			console.log("Analyze biases result:", analyzeBiasesResult);
			let formattedBiases = "No biases found.";
			if (analyzeBiasesResult && analyzeBiasesResult.items && analyzeBiasesResult.items.length > 0) {
				formattedBiases = analyzeBiasesResult.items.map(item => `${item.label}: ${item.detail}`).join('\n');
			}

			// Get the original HTML of the selection
			const originalHTMLForBiases = await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				function: () => {
					const selection = window.getSelection();
					if (selection.rangeCount > 0) {
						const range = selection.getRangeAt(0);
						const div = document.createElement('div');
						div.appendChild(range.cloneContents());
						return div.innerHTML;
					}
					return '';
				},
			});

			chrome.scripting.executeScript({
				target: { tabId: tab.id },
				function: (originalHTML, biases) => {
					const selection = window.getSelection();
					if (selection.rangeCount > 0) {
						const range = selection.getRangeAt(0);
						range.deleteContents();
						const span = document.createElement('span');
						span.className = 'unbias-analysis';
						span.dataset.tooltip = biases;
						span.innerHTML = originalHTML;
						range.insertNode(span);
					}
				},
				args: [originalHTMLForBiases[0].result, formattedBiases.replace(/\n/g, '<br>')]
			});
			break;
		case "extractClaims":
			const originalTextForClaims = info.selectionText;
			const extractClaimsResult = await extractAndCheckClaims({ text: originalTextForClaims });
			console.log("Extract claims result:", extractClaimsResult);
			let formattedClaims = "No claims found.";
			if (extractClaimsResult && extractClaimsResult.items && extractClaimsResult.items.length > 0) {
				formattedClaims = extractClaimsResult.items.map(item => `Claim: ${item.short_claim}\nConfidence: ${item.confidence}\nHow to verify: ${item.how_to_verify}`).join('\n\n');
			}

			// Get the original HTML of the selection
			const originalHTMLForClaims = await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				function: () => {
					const selection = window.getSelection();
					if (selection.rangeCount > 0) {
						const range = selection.getRangeAt(0);
						const div = document.createElement('div');
						div.appendChild(range.cloneContents());
						return div.innerHTML;
					}
					return '';
				},
			});

			chrome.scripting.executeScript({
				target: { tabId: tab.id },
				function: (originalHTML, claims) => {
					const selection = window.getSelection();
					if (selection.rangeCount > 0) {
						const range = selection.getRangeAt(0);
						range.deleteContents();
						const span = document.createElement('span');
						span.className = 'unbias-claims';
						span.dataset.tooltip = claims;
						span.innerHTML = originalHTML;
						range.insertNode(span);
					}
				},
				args: [originalHTMLForClaims[0].result, formattedClaims.replace(/\n/g, '<br>')]
			});
			break;
		
		case "analyseImage":
			try {
				// Get the image URL from the context menu
				const imageUrl = info.srcUrl;
				if (!imageUrl) {
					console.error("No image URL found in context menu click.");
					return;
				}

				// Fetch the image data
				const response = await fetch(imageUrl);
				if (!response.ok) {
					throw new Error(`Failed to fetch image: ${response.statusText}`);
				}
				const imageBlob = await response.blob();

				// Resize the image
				const resizedImage = await resizeImage(imageBlob, 1024, 1024);

				// Create a session for multimodal input
				const session = await (chrome?.ai?.languageModel || (typeof window !== 'undefined' && window?.ai?.languageModel)).create({
					temperature: 0.8, // Lower temperature for more predictable output
					expectedInputs: [{ type: "image" }],
					expectedOutputs: [{ type: "text" }]
				});
				

				// Prepare the prompt
				const promptText = "Analyze the image and provide a one-paragraph description. Then, list the key elements in the image.";

				// Use the session to prompt with text and image
				const analysis = await session.prompt([
					{ role: "user", content: [
						{ type: "text", value: promptText },
						{ type: "image", value: resizedImage }
					]}
				]);

				// Log the result to the console
				console.log("Image analysis result:", analysis);

				// Store the analysis result
				const url = tab.url;
				const key = `imageAnalyses_${url}`;
				const data = await chrome.storage.local.get(key);
				const analyses = data[key] || [];
				analyses.unshift({ analysis, imageUrl });
				await chrome.storage.local.set({ [key]: analyses });

				// Send the analysis to the popup
				chrome.runtime.sendMessage({ type: "IMAGE_ANALYSIS_RESULT", payload: { analysis, imageUrl } });

				// Destroy the session
				session.destroy();

			} catch (error) {
				console.error("Error analyzing image:", error);
			}
			break;
	}
});



