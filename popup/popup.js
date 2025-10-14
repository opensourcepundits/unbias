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
        const session = await LanguageModel.create({
            initialPrompts: [
                {
                    role: 'system',
                    content: 'You are a critical thinking expert. Read the following text and generate three questions that challenge the author\'s core assumptions.'
                }
            ],
        });
        const questions = await session.prompt(pageText);
        outputDiv.innerHTML = Array.isArray(questions)
            ? questions.map(q => `<div style='margin-bottom:8px;'>${q}</div>`).join('')
            : (typeof questions === 'string' ? questions.replace(/\n/g, '<br>') : JSON.stringify(questions, null, 2));
    } catch (err) {
        outputDiv.innerHTML = `<span style='color:red;'>Failed: ${err.message}</span>`;
        console.warn('[Generate Questions]', err);
    }
}

window.addEventListener('DOMContentLoaded', () => {
	// Initialize tab functionality
	initializeTabs();
	
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
		rewriteBtn.addEventListener('click', async () => {
			const status = await getApiAvailability('Rewriter');
			if (status === 'downloadable') {
				await downloadApiIfDownloadable('Rewriter');
				await initAvailabilityColors({
					summarizeBtn: document.getElementById('analyzeBtn'),
					rewriteBtn,
					identifyBiasesBtn,
					speakBtn
				});
			}
			await runAction('REWRITE');
		});
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
		rewriteContentBtn.addEventListener('click', async () => {
			if (typeof Rewriter !== 'undefined' && Rewriter?.availability) {
				const availability = await Rewriter.availability();
				console.log('[Rewrite content tab] Rewriter availability:', availability);
			} else {
				console.error('[Rewrite content tab] Rewriter is not defined or does not have an availability method');
			}
		});
	}
	if (generateQuestionsBtn) {
		generateQuestionsBtn.addEventListener('click', criticalThinking);
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
