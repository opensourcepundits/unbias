let cachedPageContent = null;

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

function renderAnalysis(analysis) {
	const analysisElement = document.getElementById('analysis');
	if (typeof analysis === 'string') {
		// Enhanced markdown to HTML conversion for better formatting
		let htmlContent = analysis
			// Convert headers
			.replace(/^### (.+)$/gm, '<h3 style="color: #1f2937; font-size: 14px; font-weight: bold; margin: 15px 0 8px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">$1</h3>')
			.replace(/^## (.+)$/gm, '<h2 style="color: #111827; font-size: 16px; font-weight: bold; margin: 20px 0 10px 0; border-bottom: 2px solid #d1d5db; padding-bottom: 6px;">$1</h2>')
			// Convert bold text
			.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: bold; color: #1f2937;">$1</strong>')
			.replace(/\*(.+?)\*/g, '<em style="font-style: italic;">$1</em>')
			// Convert numbered lists
			.replace(/^(\d+\.\s+.+)$/gm, '<div style="margin: 8px 0 8px 20px; padding-left: 10px; border-left: 3px solid #3b82f6;">$1</div>')
			// Convert bullet points (both * and -)
			.replace(/^[\*\-\s]+(.+)$/gm, '<div style="margin: 6px 0 6px 20px; padding-left: 10px;">• $1</div>')
			// Convert inline bullet points
			.replace(/\*\s*(.+?)(?=\n|$)/g, '<div style="margin: 4px 0 4px 20px;">• $1</div>')
			// Convert line breaks
			.replace(/\n\n/g, '<br><br>')
			.replace(/\n/g, '<br>')
			// Style specific sections
			.replace(/(Objectivity Assessment|General Note|Disclaimer):/g, '<div style="margin: 12px 0 8px 0; font-weight: bold; color: #dc2626;">$1:</div>')
			.replace(/(Verification Needed|Bias Potential):/g, '<div style="margin: 8px 0 4px 0; font-weight: bold; color: #059669;">$1:</div>')
			.replace(/(Claim:)/g, '<div style="margin: 8px 0 4px 0; font-weight: bold; color: #7c3aed;">$1</div>');
		
		analysisElement.innerHTML = htmlContent;
	} else {
		analysisElement.textContent = JSON.stringify(analysis, null, 2);
	}
}

function renderImageAnalysis({ analysis, imageUrl }) {
	const analysisContainer = document.getElementById('image-analysis-content');

	const analysisEntry = document.createElement('div');
	analysisEntry.style.marginBottom = '20px';

	if (imageUrl) {
		const img = document.createElement('img');
		img.src = imageUrl;
		img.style.maxWidth = '50%';
		img.style.height = 'auto';
		img.style.marginBottom = '10px';
		analysisEntry.appendChild(img);
	}

	const analysisText = document.createElement('div');
	if (typeof analysis === 'string') {
		analysisText.innerHTML = analysis.replace(/\n/g, '<br>');
	} else {
		analysisText.textContent = JSON.stringify(analysis, null, 2);
	}
	analysisEntry.appendChild(analysisText);

	analysisContainer.appendChild(analysisEntry);
}

// Tab functionality
function initializeTabs() {
	const tabButtons = document.querySelectorAll('.tab-btn');
	const tabPanels = document.querySelectorAll('.tab-panel');

	tabButtons.forEach(button => {
		button.addEventListener('click', () => {
			const targetTab = button.getAttribute('data-tab');
			switchToTab(targetTab);
		});
	});
}

function switchToTab(tabName) {
	const tabButtons = document.querySelectorAll('.tab-btn');
	const tabPanels = document.querySelectorAll('.tab-panel');
	
	// Remove active class from all tabs and panels
	tabButtons.forEach(btn => btn.classList.remove('active'));
	tabPanels.forEach(panel => panel.classList.remove('active'));
	
	// Add active class to target tab and panel
	const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
	const targetPanel = document.getElementById(`${tabName}-tab`);
	
	if (targetButton) targetButton.classList.add('active');
	if (targetPanel) targetPanel.classList.add('active');
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

async function criticalThinking() {
    const outputDiv = document.getElementById('questions-output');
    outputDiv.innerHTML = 'Generating questions…';
    let pageText = null;
    try {
        // Try using the cached page content
        if (cachedPageContent?.text) {
            pageText = cachedPageContent.text;
        } else {
            const tabId = await getActiveTabId();
            const payload = await requestPageContent(tabId);
            if (payload?.text) {
                pageText = payload.text;
            }
        }
        if (!pageText || !pageText.trim()) throw new Error('Page text unavailable.');

        // First API call - original critical thinking questions
        const session1 = await LanguageModel.create({
            initialPrompts: [
                {
                    role: 'system',
                    content: 'You are a critical thinking expert. Read the following text and generate three questions that challenge the author\'s core assumptions.'
                }
            ],
        });
        const questions1 = await session1.prompt(pageText);

        // Second API call - additional questions about unsupported claims
        const session2 = await LanguageModel.create({
            initialPrompts: [
                {
                    role: 'system',
                    content: 'Analyze this text and identify which claims are not supported by evidence. Generate two questions that a reader should ask about these unsupported claims.'
                }
            ],
        });
        const questions2 = await session2.prompt(pageText);

        // Combine and display results
        let combinedResults = '';

        // Add first set of questions
        if (Array.isArray(questions1)) {
            combinedResults += '<div style="margin-bottom: 15px;"><strong>Core Assumption Questions:</strong></div>';
            combinedResults += questions1.map(q => `<div style='margin-bottom:8px; margin-left: 10px;'>${q}</div>`).join('');
        } else if (typeof questions1 === 'string') {
            combinedResults += '<div style="margin-bottom: 15px;"><strong>Core Assumption Questions:</strong></div>';
            combinedResults += `<div style='margin-bottom:8px; margin-left: 10px;'>${questions1.replace(/\n/g, '<br>')}</div>`;
        }

        // Add second set of questions
        if (Array.isArray(questions2)) {
            combinedResults += '<div style="margin-bottom: 15px;"><strong>Unsupported Claims Questions:</strong></div>';
            combinedResults += questions2.map(q => `<div style='margin-bottom:8px; margin-left: 10px;'>${q}</div>`).join('');
        } else if (typeof questions2 === 'string') {
            combinedResults += '<div style="margin-bottom: 15px;"><strong>Unsupported Claims Questions:</strong></div>';
            combinedResults += `<div style='margin-bottom:8px; margin-left: 10px;'>${questions2.replace(/\n/g, '<br>')}</div>`;
        }

        outputDiv.innerHTML = combinedResults || JSON.stringify({questions1, questions2}, null, 2);
    } catch (err) {
        outputDiv.innerHTML = `<span style='color:red;'>Failed: ${err.message}</span>`;
        console.warn('[Generate Questions]', err);
    }
}

async function rewriter(event) {
    // Determine output target div: if called from Rewrite Content tab, use 'rewrite-content'; else, fallback to 'questions-output'.
    let outputDiv = document.getElementById('questions-output');
    if (event && event.target && event.target.id === 'rewriteContentBtn') {
        outputDiv = document.getElementById('rewrite-content');
    }
    let pageText = null;
    // Read values from dropdowns if present
    const toneSelect = document.getElementById('rewrite-tone-select');
    const lengthSelect = document.getElementById('rewrite-length-select');
    let options = {
        sharedContext: '',
        tone: toneSelect ? toneSelect.value : 'more-casual',
        length: lengthSelect ? lengthSelect.value : 'shorter',
    };
    // Get page text
    if (cachedPageContent?.text) {
        pageText = cachedPageContent.text;
    } else {
        const tabId = await getActiveTabId();
        const payload = await requestPageContent(tabId);
        if (payload?.text) {
            pageText = payload.text;
        }
    }
    if (!pageText || !pageText.trim()) {
        outputDiv.innerHTML = `<span style='color:red;'>Failed: Page text unavailable.</span>`;
        return;
    }
    options.sharedContext = pageText;
    // Model availability and possible download
    let available = await Rewriter.availability();
    console.log('[Rewriter] API availability:', available);
    if (available === 'unavailable') {
        console.warn('[Rewriter] API unavailable.');
        outputDiv.innerHTML = `<span style='color:red;'>Rewriter API unavailable.</span>`;
        return;
    }
    // Download if needed
    if (available === 'downloadable') {
        console.log('[Rewriter] Model is downloadable. Downloading…');
        await downloadApiIfDownloadable('Rewriter');
        // Recheck availability after download
        available = await Rewriter.availability();
        console.log('[Rewriter] API availability after download:', available);
        if (available !== 'available') {
            outputDiv.innerHTML = `<span style='color:red;'>Could not download model.</span>`;
            return;
        }
    }
    console.log('[Rewriter] Creating rewriter with options:', options);
    let rewriter;
    rewriter = await Rewriter.create(options);
    // Attach progress logging if supported
    if (rewriter && rewriter.addEventListener) {
        rewriter.addEventListener('downloadprogress', (e) => {
            console.log('[Rewriter] Download progress:', e.loaded, e.total);
        });
    }
    console.log('[Rewriter] Rewriter instance created:', rewriter);
    outputDiv.innerHTML = 'Rewriting…';
    try {
        let rewritten;
        if (rewriter.rewrite) {
            console.log('[Rewriter] Beginning inference with .rewrite()');
            rewritten = await rewriter.rewrite(pageText);
        } else if (rewriter.run) {
            console.log('[Rewriter] Beginning inference with .run()');
            const res = await rewriter.run(pageText);
            rewritten = res?.output || res;
        } else if (typeof rewriter === 'function') {
            console.log('[Rewriter] Beginning inference with direct function call');
            rewritten = await rewriter(pageText);
        } else {
            throw new Error('Rewriter instance does not support rewrite/run/function invocation');
        }
        console.log('[Rewriter] Inference result:', rewritten);
        outputDiv.innerHTML = typeof rewritten === 'string' ? rewritten.replace(/\n/g, '<br>') : JSON.stringify(rewritten, null, 2);
    } catch (err) {
        outputDiv.innerHTML = `<span style='color:red;'>Failed: ${err.message}</span>`;
        console.warn('[Rewriter] Error during inference', err);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message?.type === 'IMAGE_ANALYSIS_RESULT') {
		loadAndRenderImageAnalyses();
	}
});

async function loadAndRenderImageAnalyses() {
	const tabId = await getActiveTabId();
	const tab = await chrome.tabs.get(tabId);
	const url = tab.url;
	const key = `imageAnalyses_${url}`;
	const data = await chrome.storage.local.get(key);
	const analyses = data[key] || [];

	const analysisContainer = document.getElementById('image-analysis-content');
	
	for (const analysis of analyses) {
		renderImageAnalysis(analysis);
	}
}

window.addEventListener('DOMContentLoaded', () => {
	// Initialize tab functionality
	initializeTabs();
	
	// Load and render stored image analyses
	loadAndRenderImageAnalyses();

	// Initialize button handlers
	document.getElementById('analyzeBtn').addEventListener('click', runAnalysis);
	const rewriteBtn = document.getElementById('rewriteBtn');
	const identifyBiasesBtn = document.getElementById('identifyBiasesBtn');
	const analyseWebpageBtn = document.getElementById('analyseWebpageBtn');
	const speakBtn = document.getElementById('speakBtn');
	const crossExamineBtn = document.getElementById('crossExamineBtn');
	const rewriteContentBtn = document.getElementById('rewriteContentBtn');
	const generateQuestionsBtn = document.getElementById('generateQuestionsBtn');

	if (rewriteBtn) {
		rewriteBtn.addEventListener('click', rewriter);
	}
	if (identifyBiasesBtn) {
		identifyBiasesBtn.addEventListener('click', async () => {
			const status = await getApiAvailability('LanguageModel');
			if (status === 'downloadable') {
				await downloadApiIfDownloadable('LanguageModel');
				await initAvailabilityColors({
					summarizeBtn: document.getElementById('analyzeBtn'),
					rewriteBtn,
					identifyBiasesBtn,
					speakBtn
				});
			}
			await runAction('RUN_ANALYSIS');
		});
	}
	if (analyseWebpageBtn) {
		analyseWebpageBtn.addEventListener('click', async () => {
			const status = await getApiAvailability('LanguageModel');
			if (status === 'downloadable') {
				await downloadApiIfDownloadable('LanguageModel');
				await initAvailabilityColors({
					summarizeBtn: document.getElementById('analyzeBtn'),
					rewriteBtn,
					identifyBiasesBtn,
					speakBtn
				});
			}
			await runAction('ANALYSE_WEBPAGE');
		});
	}
	if (speakBtn) {
		speakBtn.addEventListener('click', async () => {
			const status = await getApiAvailability('LanguageModel');
			if (status === 'downloadable') {
				await downloadApiIfDownloadable('LanguageModel');
				await initAvailabilityColors({
					summarizeBtn: document.getElementById('analyzeBtn'),
					rewriteBtn,
					identifyBiasesBtn,
					speakBtn
				});
			}
			await runAction('SPEAK_WITH_PAGE');
		});
	}
	if (crossExamineBtn) {
		crossExamineBtn.addEventListener('click', async () => {
			await runAction('CROSS_EXAMINE');
		});
	}
	if (rewriteContentBtn) {
		rewriteContentBtn.addEventListener('click', rewriter);
	}
	if (generateQuestionsBtn) {
		generateQuestionsBtn.addEventListener('click', criticalThinking);
	}
	const extractDatesBtn = document.getElementById('extractDatesBtn');
	if (extractDatesBtn) {
		extractDatesBtn.addEventListener('click', extractDates);
	}

	// Run startup flow: fetch and cache page content, then update button colors
	OnStartUp({
		summarizeBtn: document.getElementById('analyzeBtn'),
		rewriteBtn,
		identifyBiasesBtn,
		speakBtn
	}).catch(err => console.warn('[News Insight][Popup] OnStartUp failed', err));
});

async function runAction(actionType) {
	await logSummarizerAvailability();
	const tabId = await getActiveTabId();
	let payload = await requestPageContent(tabId);
	if (!payload || !payload.text || payload.text.trim().length === 0 || /warmup/i.test(payload.title || '') || /warmup/.test(payload.url || '')) {
		payload = cachedPageContent || undefined;
	}
	const res = await chrome.runtime.sendMessage({ type: actionType, payload });
	if (res?.ok) {
		if (res.data?.summary) {
			renderSummary(res.data.summary);
			switchToTab('summary');
		}
		if (res.data?.biases) {
			renderBiases(res.data.biases);
			switchToTab('bias');
		}
		if (res.data?.claims) {
			renderClaims(res.data.claims);
			switchToTab('claims');
		}
		if (res.data?.analysis) {
			renderAnalysis(res.data.analysis);
			switchToTab('analysis');
		}
	} else {
		renderSummary(res?.error || 'Failed to run action.');
	}
}

function setStatusClass(button, status) {
	if (!button) return;
	button.classList.remove('status-red', 'status-yellow', 'status-blue', 'status-green');
	switch (status) {
		case 'downloadable':
			button.classList.add('status-yellow');
			break;
		case 'downloading':
			button.classList.add('status-blue');
			break;
		case 'available':
			button.classList.add('status-green');
			break;
		default:
			button.classList.add('status-red');
	}
}

async function initAvailabilityColors(refs) {
	try {
		// Summarizer
		let summarizerAvailability;
		if (typeof Summarizer !== 'undefined' && Summarizer?.availability) {
			summarizerAvailability = await Summarizer.availability();
		} else if (window?.ai?.summarizer?.availability) {
			summarizerAvailability = await window.ai.summarizer.availability();
		} else if (chrome?.ai?.summarizer?.availability) {
			summarizerAvailability = await chrome.ai.summarizer.availability();
		}
		if (refs.summarizeBtn) setStatusClass(refs.summarizeBtn, summarizerAvailability?.status || summarizerAvailability);

		// Rewriter
		let rewriterAvailability;
		if (typeof Rewriter !== 'undefined' && Rewriter?.availability) {
			rewriterAvailability = await Rewriter.availability();
		}
		if (refs.rewriteBtn) setStatusClass(refs.rewriteBtn, rewriterAvailability?.status || rewriterAvailability);

		// LanguageModel (for Speak and Identify Biases)
		let lmAvailability;
		if (typeof LanguageModel !== 'undefined' && LanguageModel?.availability) {
			lmAvailability = await LanguageModel.availability();
		}
		const lmStatus = lmAvailability?.status || lmAvailability;
		if (refs.speakBtn) setStatusClass(refs.speakBtn, lmStatus);
		if (refs.identifyBiasesBtn) setStatusClass(refs.identifyBiasesBtn, lmStatus);
	} catch (e) {
		console.warn('[News Insight][Popup] Availability checks failed', e);
	}
}

async function OnStartUp(refs) {
	// 1) Get all information on the page and store it
	try {
		const tabId = await getActiveTabId();
		let payload = await requestPageContent(tabId);
		if (payload && payload.text && payload.text.trim().length > 0 && !/warmup/i.test(payload.title || '') && !/warmup/.test(payload.url || '')) {
			cachedPageContent = payload;
		} else {
			cachedPageContent = null;
		}
	} catch (e) {
		cachedPageContent = null;
	}

	// 2) Call availability functions to change buttons' colors
	await initAvailabilityColors(refs);
}

// Download helper: pass 'LanguageModel', 'Summarizer', or 'Rewriter'
export async function downloadApiIfDownloadable(apiName) {
	try {
		const availability = await getApiAvailability(apiName);
		if (availability !== 'downloadable') {
			console.log(`[News Insight][Popup] ${apiName} not downloadable (status: ${availability})`);
			return false;
		}
		console.log(`[News Insight][Popup] Downloading ${apiName}...`);
		await createApiWithMonitor(apiName);
		return true;
	} catch (e) {
		console.warn(`[News Insight][Popup] Failed to download ${apiName}`, e);
		return false;
	}
}

async function getApiAvailability(apiName) {
	switch (apiName) {
		case 'Summarizer':
			if (typeof Summarizer !== 'undefined' && Summarizer?.availability) return await Summarizer.availability();
			if (window?.ai?.summarizer?.availability) return await window.ai.summarizer.availability();
			if (chrome?.ai?.summarizer?.availability) return await chrome.ai.summarizer.availability();
			return 'unavailable';
		case 'LanguageModel':
			if (typeof LanguageModel !== 'undefined' && LanguageModel?.availability) return await LanguageModel.availability();
			if (chrome?.ai?.languageModel?.availability) return await chrome.ai.languageModel.availability();
			if (window?.ai?.languageModel?.availability) return await window.ai.languageModel.availability();
			return 'unavailable';
		case 'Rewriter':
			if (typeof Rewriter !== 'undefined' && Rewriter?.availability) return await Rewriter.availability();
			return 'unavailable';
		default:
			return 'unavailable';
	}
}

async function createApiWithMonitor(apiName) {
	const monitor = (m) => {
		m.addEventListener('downloadprogress', (e) => {
			console.log(`Downloaded ${e.loaded * 100}%`);
		});
	};
	if (apiName === 'LanguageModel') {
		if (typeof LanguageModel !== 'undefined' && LanguageModel?.create) {
			return await LanguageModel.create({ monitor });
		}
		if (chrome?.ai?.languageModel?.create) {
			return await chrome.ai.languageModel.create({ monitor });
		}
		if (window?.ai?.languageModel?.create) {
			return await window.ai.languageModel.create({ monitor });
		}
	}
	if (apiName === 'Summarizer') {
		const outputLanguage = (navigator?.language || 'en').slice(0, 2).toLowerCase();
		const supported = ['en', 'es', 'ja'];
		const lang = supported.includes(outputLanguage) ? outputLanguage : 'en';
		const options = { outputLanguage: lang, monitor };
		if (typeof Summarizer !== 'undefined' && Summarizer?.create) {
			return await Summarizer.create(options);
		}
		if (chrome?.ai?.summarizer?.create) {
			return await chrome.ai.summarizer.create(options);
		}
		if (window?.ai?.summarizer?.create) {
			return await window.ai.summarizer.create(options);
		}
	}
	if (apiName === 'Rewriter') {
		if (typeof Rewriter !== 'undefined' && Rewriter?.create) {
			return await Rewriter.create({ monitor });
		}
	}
	throw new Error(`Create not supported for ${apiName}`);
}

async function extractDates() {
	const container = document.getElementById('calendar-events');
	const tabId = await getActiveTabId();
	const currentUrl = (await chrome.tabs.get(tabId)).url;

	// Check if we already have extracted events for this URL
	const storageKey = `calendar_events_${currentUrl}`;
	const cached = await chrome.storage.local.get([storageKey]);

	if (cached[storageKey]) {
		// Render cached events
		container.innerHTML = '';
		const events = cached[storageKey];
		if (events.length > 0) {
			events.forEach(eventData => {
				renderCalendarEventCard(eventData);
			});
		} else {
			container.innerHTML = '<div class="no-dates-message">No dates detected in the page content.</div>';
		}
		return;
	}

	container.innerHTML = 'Extracting dates…';

	try {
		let pageText = null;
		// Get page text
		if (cachedPageContent?.text) {
			pageText = cachedPageContent.text;
		} else {
			const payload = await requestPageContent(tabId);
			if (payload?.text) {
				pageText = payload.text;
			}
		}

		if (!pageText || !pageText.trim()) {
			container.innerHTML = 'No page text available to analyze.';
			return;
		}

		// Check if LanguageModel is available
		const status = await getApiAvailability('LanguageModel');
		if (status === 'unavailable') {
			container.innerHTML = 'LanguageModel API unavailable.';
			return;
		}
		if (status === 'downloadable') {
			await downloadApiIfDownloadable('LanguageModel');
		}

		const session = await LanguageModel.create();

		// Schema for structured output compatible with Google Calendar
		const schema = {
			type: "object",
			properties: {
				events: {
					type: "array",
					items: {
						type: "object",
						properties: {
							date: {
								type: "string",
								description: "The date in YYYY-MM-DD format (e.g., '2024-10-16') or a relative date like 'tomorrow', 'next week'"
							},
							event: {
								type: "string",
								description: "Brief description of the event associated with this date"
							},
							duration_hours: {
								type: "number",
								description: "Estimated duration in hours (default 1)"
							}
						},
						required: ["date", "event"]
					}
				}
			},
			required: ["events"]
		};

		const result = await session.prompt(
			pageText,
			{
				systemPrompt: "Extract all dates and the event associated with the date from this text. If no dates are found, return an empty events array.",
				responseConstraint: schema,
			}
		);

		const responseData = JSON.parse(result);

		// Clear loading message
		container.innerHTML = '';

		if (responseData.events && responseData.events.length > 0) {
			responseData.events.forEach(eventData => {
				renderCalendarEventCard(eventData);
			});

			// Cache the events for this URL
			await chrome.storage.local.set({ [storageKey]: responseData.events });
		} else {
			container.innerHTML = '<div class="no-dates-message">No dates detected in the page content.</div>';
			await chrome.storage.local.set({ [storageKey]: [] });
		}

	} catch (err) {
		container.innerHTML = `<span style='color:red;'>Failed to extract dates: ${err.message}</span>`;
		console.warn('[Extract Dates]', err);
	}
}

function renderCalendarEventCard(eventData) {
	const container = document.getElementById('calendar-events');
	if (!container) return;

	const eventDiv = document.createElement('div');
	eventDiv.className = 'calendar-event-card';

	eventDiv.innerHTML = `
		<div class="calendar-event-card-header">
			<div class="calendar-event-date">${eventData.date}</div>
			<button class="calendar-add-btn action-btn">Add to Calendar</button>
		</div>
		<div class="calendar-event-description">${eventData.event}</div>
		<div class="calendar-event-duration">${eventData.duration_hours || 1} hour(s)</div>
	`;

	// Add click handler for the "Add to Calendar" button
	const addButton = eventDiv.querySelector('.calendar-add-btn');
	addButton.addEventListener('click', () => {
		createCalendarEventFromData(eventData);
	});

	container.appendChild(eventDiv);
}

async function createCalendarEventFromData(eventData) {
	try {
		// Parse date - if it's in YYYY-MM-DD format, use it directly
		let startDate;
		if (/^\d{4}-\d{2}-\d{2}$/.test(eventData.date)) {
			startDate = new Date(eventData.date + 'T00:00:00');
		} else {
			// For relative dates like 'tomorrow', 'next week', calculate from now
			const now = new Date();
			if (eventData.date.toLowerCase().includes('tomorrow')) {
				startDate = new Date(now);
				startDate.setDate(now.getDate() + 1);
			} else if (eventData.date.toLowerCase().includes('next week')) {
				startDate = new Date(now);
				startDate.setDate(now.getDate() + 7);
			} else {
				// Default to today if unrecognized format
				startDate = new Date(now);
			}
		}

		const endDate = new Date(startDate);
		endDate.setHours(startDate.getHours() + (eventData.duration_hours || 1));

		const eventTitle = eventData.event;
		const eventDescription = `From article\n\n${eventData.event}`;

		// Construct Google Calendar URL
		const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${startDate.toISOString().replace(/-|:/g, '').slice(0, -5)}/${endDate.toISOString().replace(/-|:/g, '').slice(0, -5)}&details=${encodeURIComponent(eventDescription)}&sf=true&output=xml`;

		await chrome.tabs.create({ url: googleCalendarUrl });

		// Show success feedback (optional)
		alert('Calendar event opened in new tab!');

	} catch (err) {
		console.warn('[Create Calendar Event from Data]', err);
		alert('Failed to create calendar event: ' + err.message);
	}
}
