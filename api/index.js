// Placeholder wrappers for Chrome Built-in AI Challenge APIs.
// Replace internals with chrome.ai.* or window.ai.* calls where available.

export async function summarizeArticle(content) {
    const text = content?.text || '';
    const titleLine = content?.title ? `Title: ${content.title}\n` : '';
    const outputLanguage = getPreferredOutputLanguage();
    // Prefer on-device Summarizer API when available
    try {
        const summarizer = await tryCreateSummarizer();
        if (summarizer) {
            console.log('[News Insight][AI] Using Summarizer API');
            // Use the article text that has already been fetched
            const summary = await summarizer.summarize(text, {
                context: 'This article is intended for a curious audience.',
                outputLanguage
            });
            if (summary) {
                console.log('[News Insight][AI] Summarizer API returned summary:', summary);
                return summary;
            } else {
                console.warn('[News Insight][AI] Summarizer API returned empty summary');
            }
        } else {
            console.log('[News Insight][AI] No summarizer available, falling back');
        }
    } catch (error) {
        console.error('[News Insight][AI] Summarizer API error:', error);
        // fall through to prompt-based fallback
    }
    console.log('[News Insight][AI] Falling back to local prompt-based summarizer');
    const prompt = `Summarize the following news article in 4-6 bullet points with a neutral tone. Include: who, what, when, where, why, how.\n\n${titleLine}URL: ${content.url}\nText:\n${text}`;
    return await runLocalSummarizer(prompt);
}

export async function analyzeBiases(content) {
	const prompt = `Identify potential biases, loaded language, and missing perspectives in the article. Provide concise bullet points and a 0-100 subjectivity score.\n\nTitle: ${content.title}\nText:\n${content.text}`;
	return await runLocalPrompt(prompt, { structured: true });
}

export async function extractAndCheckClaims(content) {
	const prompt = `Extract up to 8 verifiable factual claims from the article. For each claim, provide:\n- short_claim\n- confidence (0-1)\n- how_to_verify (concise steps)\nDo not fabricate sources.\n\nText:\n${content.text}`;
	const claims = await runLocalPrompt(prompt, { structured: true });
	// Optionally attempt on-device corroboration heuristics (no external network) or defer to user for cross-check links.
	return claims;
}

export async function identifyLanguage(content) {
	try {
		console.log('[News Insight] Identifying language with LanguageModel...');

		// Get LanguageModel params and create session, similar to analyseWebpage
		const params = await LanguageModel.params();
		const topK = Math.max(1, Math.min(params.defaultTopK, 100));
		const session = await LanguageModel.create({
			temperature: 2.0,
			topK: topK,
		});

		const prompt = `From the following text, identify and extract phrases that are emotionally charged, subjective, or represent potential logical fallacies. Return ONLY a valid JSON object in the format: {"items": [{"label": "phrase1"}, {"label": "phrase2"}]} where each phrase is a string.

Text:
${content.text}`;

		console.log('[News Insight] Processing prompt with LanguageModel API for highlighting...');
		const response = await session.prompt(prompt);
		console.log('[News Insight] LanguageModel response for highlighting:', response);

		session.destroy();

		// Parse the response as JSON if possible, otherwise return as is
		// First, try to extract JSON from the response in case the model added extra text
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			try {
				return JSON.parse(jsonMatch[0]);
			} catch (parseError) {
				console.warn('[News Insight] Failed to parse extracted JSON, returning raw response');
				return { items: [{ label: response.trim() }] }; // Fallback structure
			}
		} else {
			console.warn('[News Insight] No JSON found in response, returning raw response');
			return { items: [{ label: response.trim() }] }; // Fallback structure
		}
	} catch (error) {
		console.error('[News Insight] Error identifying language with LanguageModel:', error);
		// Fallback to placeholder if LanguageModel fails
		console.warn('[News Insight][AI] LanguageModel unavailable for highlighting, returning placeholder');
		return {
			items: [
				{ label: 'Potential framing bias', detail: 'Focus on partisan quotes without counterpoints', score: 0.62 },
			]
		};
	}
}

async function runLocalSummarizer(input) {
    return await runLocalPrompt(`SUMMARIZE:
${input}`);
}

async function runLocalPrompt(prompt, options = {}) {
    // Attempt to use on-device Prompt API if available
    try {
        const session = await tryCreatePromptSession();
        if (session) {
            console.log('[News Insight][AI] Using Prompt API session');
            const response = await session.prompt(prompt);
            return response;
        }
    } catch (_) {
        // fall back to placeholder below
    }
    console.warn('[News Insight][AI] Prompt API unavailable, returning placeholder');
    const structured = !!options.structured;
    if (structured) {
        return {
            items: [
                { label: 'Potential framing bias', detail: 'Focus on partisan quotes without counterpoints', score: 0.62 },
            ]
        };
    }
    return `Placeholder analysis. Replace with on-device Prompt API.\n\n${prompt.slice(0, 240)}...`;
}

async function tryCreateSummarizer() {
    const outputLanguage = getPreferredOutputLanguage();
    const options = {
        sharedContext: 'This is a news article',
        type: 'key-points',
        format: 'markdown',
        length: 'medium',
        outputLanguage,
        monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
                console.log(`Downloaded ${e.loaded * 100}%`);
            });
        }
    };

    console.log('[News Insight][AI] Attempting to create summarizer with options:', options);

    // chrome.ai.summarizer (preferred) or window.ai.summarizer
    try {
        if (chrome?.ai?.summarizer?.availability) {
            const availability = await chrome.ai.summarizer.availability();
            console.log('[News Insight][AI] Summarizer availability (chrome.ai):', availability);
            if (availability === 'unavailable') {
                return null;
            }
            if (chrome?.ai?.summarizer?.create) {
                // Check for user activation before creating the summarizer (if available)
                if (navigator?.userActivation?.isActive) {
                    console.log('[News Insight][AI] User activation active, using custom options');
                    return await chrome.ai.summarizer.create(options);
                }
                console.log('[News Insight][AI] User activation not available/active, using default options');
                return await chrome.ai.summarizer.create();
            }
        } else if (typeof Summarizer !== 'undefined' && Summarizer?.availability) {
            const availability = await Summarizer.availability();
            console.log('[News Insight][AI] Summarizer availability (global Summarizer):', availability);
            if (availability === 'unavailable') {
                return null;
            }
            if (typeof Summarizer.create === 'function') {
                // Check for user activation before creating the summarizer (if available)
                if (navigator?.userActivation?.isActive) {
                    console.log('[News Insight][AI] User activation active, using custom options');
                    return await Summarizer.create(options);
                }
                console.log('[News Insight][AI] User activation not available/active, using default options');
                return await Summarizer.create();
            }
        } else if (window?.ai?.summarizer?.availability) {
            const availability = await window.ai.summarizer.availability();
            console.log('[News Insight][AI] Summarizer availability (window.ai):', availability);
            if (availability === 'unavailable') {
                return null;
            }
            if (window?.ai?.summarizer?.create) {
                // Check for user activation before creating the summarizer (if available)
                if (navigator?.userActivation?.isActive) {
                    console.log('[News Insight][AI] User activation active, using custom options');
                    return await window.ai.summarizer.create(options);
                }
                console.log('[News Insight][AI] User activation not available/active, using default options');
                return await window.ai.summarizer.create();
            }
        }
        if (chrome?.ai?.summarizer?.create) {
            return await chrome.ai.summarizer.create();
        }
    } catch (error) {
        console.error('[News Insight][AI] Error in chrome.ai.summarizer:', error);
    }
    try {
        if (window?.ai?.summarizer?.create) {
            return await window.ai.summarizer.create();
        }
    } catch (error) {
        console.error('[News Insight][AI] Error in window.ai.summarizer:', error);
    }
    console.log('[News Insight][AI] No summarizer could be created');
    return null;
}

async function tryCreatePromptSession() {
    // chrome.ai.languageModel / window.ai.languageModel (naming may vary by channel)
    try {
        if (chrome?.ai?.languageModel?.create) {
            return await chrome.ai.languageModel.create();
        }
    } catch (_) {}
    try {
        if (window?.ai?.languageModel?.create) {
            return await window.ai.languageModel.create();
        }
    } catch (_) {}
    return null;
}

function getPreferredOutputLanguage() {
    try {
        const supported = ['en', 'es', 'ja'];
        const lang = (navigator?.language || 'en').slice(0, 2).toLowerCase();
        return supported.includes(lang) ? lang : 'en';
    } catch (_) {
        return 'en';
    }
}
