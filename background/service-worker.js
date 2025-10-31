import { summarizeArticle, analyzeBiases, extractAndCheckClaims, runProofreader, runRewriter, identifyLanguage } from '../api/index.js';


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
	chrome.contextMenus.removeAll(() => {
		// Text selection context menus
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
			id: "rewrite",
			title: "Rewrite",
			contexts: ["selection"]
		});

		// Parent context menu for image analysis
		chrome.contextMenus.create({
			id: "analyseImageParent",
			title: "Analyse Image",
			contexts: ["image"]
		});

		// Child context menu items for different image analysis prompts
		chrome.contextMenus.create({
			id: "analyseImage_bias",
			parentId: "analyseImageParent",
			title: "Analyze for Persuasive Bias",
			contexts: ["image"]
		});
		chrome.contextMenus.create({
			id: "analyseImage_context",
			parentId: "analyseImageParent",
			title: "Analyze for Missing Context",
			contexts: ["image"]
		});
		chrome.contextMenus.create({
			id: "analyseImage_symbolism",
			parentId: "analyseImageParent",
			title: "Analyze for Symbolism",
			contexts: ["image"]
		});
		chrome.contextMenus.create({
			id: "analyseImage_data",
			parentId: "analyseImageParent",
			title: "Analyze Chart/Graph for Misleading Data",
			contexts: ["image"]
		});
		chrome.contextMenus.create({
			id: "analyseImage_emotion",
			parentId: "analyseImageParent",
			title: "Analyze for Emotions & Non-Verbal Cues",
			contexts: ["image"]
		});
	});
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
            resizeWidth: 512,
            resizeHeight: 512,
            resizeQuality: 'high'
        });
	} catch (error) {
		throw error;
	}
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	console.log("Context menu clicked:", info, tab);

	// --- IMAGE ANALYSIS LOGIC ---
	if (info.menuItemId.startsWith("analyseImage_")) {
		// A map of menu item IDs to their corresponding prompts
		const imageAnalysisPrompts = {
			"analyseImage_bias": "You are a media literacy expert. Analyze this image for persuasive bias. Consider the camera angle (e.g., low-angle to make subject powerful, high-angle to make them weak), lighting, and focus. What emotional response or opinion is the photographer likely trying to evoke?",
			"analyseImage_context": "You are a photojournalist. Analyze this image. Based on what is visible, what critical context might be missing? What could be happening just outside the frame that would completely change the story or the viewer's interpretation?",
			"analyseImage_symbolism": "Analyze this image (especially if it is a political cartoon or artwork) for symbolism. What do the different elements likely represent, and what is the overall message or argument?",
			"analyseImage_data": "You are a data analyst. Analyze this chart or graph. First, objectively state what the data shows. Second, identify any potential ways this visualization could be misleading (e.g., manipulated Y-axis, cherry-picked data, lack of scale, or misleading correlations)",
			"analyseImage_emotion": "You are an expert in emotional intelligence and non-verbal communication. Analyze this image and identify the emotions being conveyed.\nFirst, describe the overall atmosphere or mood of the scene (e.g., tense, joyful, somber, chaotic).\nSecond, identify the primary emotions visible in the key subjects (people). For each emotion, provide the specific visual evidence from their facial expressions or body language that supports your analysis.\nMake your answer clear and concise."
		};

		try {
            // Signal to the UI that an analysis has started
            chrome.runtime.sendMessage({ type: "IMAGE_ANALYSIS_START" });

			const promptText = imageAnalysisPrompts[info.menuItemId];
			if (!promptText) {
				console.error("No prompt found for menu item:", info.menuItemId);
				return;
			}

			const imageUrl = info.srcUrl;
			if (!imageUrl) {
				console.error("No image URL found in context menu click.");
				return;
			}

			const response = await fetch(imageUrl);
			if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
			const imageBlob = await response.blob();
			const resizedImage = await resizeImage(imageBlob, 512, 512);

			const params = await LanguageModel.params();
			const topK = Math.max(1, Math.min(params.defaultTopK, 100));
			const session = await LanguageModel.create({
				temperature: 0.8,
				topK: topK,
				expectedInputs: [{ type: "image" }],
				expectedOutputs: [{ type: "text" }]
			});

			const analysis = await session.prompt([
				{ role: "user", content: [
					{ type: "text", value: promptText },
					{ type: "image", value: resizedImage }
				]}
			]);
			console.log("Image analysis result:", analysis);

			const url = tab.url;
			const key = `imageAnalyses_${url}`;
			const data = await chrome.storage.local.get(key);
			const analyses = data[key] || [];
			analyses.unshift({ analysis, imageUrl });
			await chrome.storage.local.set({ [key]: analyses });

			chrome.runtime.sendMessage({ type: "IMAGE_ANALYSIS_RESULT", payload: { analysis, imageUrl } });
			session.destroy();
		} catch (error) {
			console.error("Error analyzing image:", error);
            // Still send a result message on error so the UI can stop loading
            chrome.runtime.sendMessage({ type: "IMAGE_ANALYSIS_RESULT", payload: { error: error.message } });
		}
		return; // Stop execution here for image analysis
	}

	// --- TEXT SELECTION LOGIC ---
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

                // Clean the summary for the tooltip
                const cleanedSummary = summarizeResult
                    .replace(/<br>/g, '\n')        // Replace <br> with newlines
                    .replace(/^\s*\*\s*/gm, '• ') // Replace markdown bullets with real bullets
                    .replace(/\*(.*?)\*/g, '$1');    // Remove emphasis asterisks

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
					args: [originalHTMLForSummary[0].result, cleanedSummary]
				});
			}
			break;
	}
});