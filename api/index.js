// Placeholder wrappers for Chrome Built-in AI Challenge APIs.
// Replace internals with chrome.ai.* or window.ai.* calls where available.

export async function summarizeArticle(content) {
    const text = content?.text || '';
    const titleLine = content?.title ? `Title: ${content.title}
` : '';
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
    }
    catch (error) {
        console.error('[News Insight][AI] Summarizer API error:', error);
        // fall through to prompt-based fallback
    }
    console.log('[News Insight][AI] Falling back to local prompt-based summarizer');
    const prompt = `Summarize the following news article in 4-6 bullet points with a neutral tone. Include: who, what, when, where, why, how.

${titleLine}URL: ${content.url}
Text:
${text}`;
    return await runLocalSummarizer(prompt);
}

export async function analyzeBiases(content) {
	const prompt = `Identify potential biases, loaded language, and missing perspectives in the article. Provide concise bullet points and a 0-100 subjectivity score.

Title: ${content.title}
Text:
${content.text}`;
	return await runLocalPrompt(prompt, { structured: true });
}

export async function extractAndCheckClaims(content) {
	const prompt = `Extract up to 8 verifiable factual claims from the article. For each claim, provide:
- short_claim
- confidence (0-1)
- how_to_verify (concise steps)
Do not fabricate sources.

Text:
${content.text}`;
	const claims = await runLocalPrompt(prompt, { structured: true });
	// Optionally attempt on-device corroboration heuristics (no external network) or defer to user for cross-check links.
	return claims;
}

export async function identifyLanguage(content) {
    console.log('[News Insight][AI] Identifying language in text:', content.text);
    try {
        const session = await tryCreatePromptSession();
        if (!session) {
            console.warn('[News Insight][AI] Prompt API unavailable, skipping language identification.');
            return [];
        }

        const prompt = `You are a linguistic analyst specializing in media literacy. Your task is to identify specific, high-impact phrases in the provided text that fall into one of three categories. Be conservative in your analysis; only select phrases that are clear and strong examples.

Categories:
1.  **LOADED_LANGUAGE**: Words or phrases with strong emotional connotations intended to influence the reader, rather than using neutral, objective language. (e.g., "brutal crackdown", "so-called expert", "a pathetic excuse").
2.  **ABSOLUTE_GENERALIZATION**: Sweeping statements that claim something is true for all cases, often unprovable. (e.g., "nobody believes", "it's always been this way", "all politicians are the same").
3.  **WEAK_SOURCE**: Language that attributes a claim to an unnamed, vague, or anonymous source, weakening its credibility. (e.g., "experts say", "sources claim", "it is widely reported").

Analyze the following text. Return a JSON array of objects, where each object has a "phrase" and "category" property. Do not identify phrases that are shorter than 3 words unless they are a very strong example.

Text to analyze:
${content.text}`;

        const response = await session.prompt(prompt);
        console.log('[News Insight][AI] Language identification response:', response);

        // Clean the response to extract only the JSON part.
        // The model sometimes wraps the JSON in markdown ```json ... ```
        const firstBracket = response.indexOf('[');
        const lastBracket = response.lastIndexOf(']');
        let cleanedResponse = response;

        if (firstBracket !== -1 && lastBracket > firstBracket) {
            cleanedResponse = response.substring(firstBracket, lastBracket + 1);
        } else {
            // Fallback for object-based responses, though the prompt expects an array.
            const firstBrace = response.indexOf('{');
            const lastBrace = response.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                cleanedResponse = response.substring(firstBrace, lastBrace + 1);
            }
        }

        const result = JSON.parse(cleanedResponse);
        if (Array.isArray(result)) {
            return result;
        } else {
            return [];
        }
    } catch (error) {
        console.error('[News Insight][AI] Error identifying language:', error);
        return [];
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
    }
    catch (_) {
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
    return `Placeholder analysis. Replace with on-device Prompt API.

${prompt.slice(0, 240)}...`;
}

async function tryCreateSummarizer() {
    const outputLanguage = getPreferredOutputLanguage();
    const options = {
        sharedContext: 'This is a news article',
        type: 'key-points',
        format: 'markdown',
        length: 'long',
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
        if (typeof Summarizer !== 'undefined' && Summarizer?.availability) {
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
        } else if (chrome?.ai?.summarizer?.availability) {
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
        } else if (typeof window !== 'undefined' && window?.ai?.summarizer?.availability) {
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
    }
    catch (error) {
        console.error('[News Insight][AI] Error in chrome.ai.summarizer:', error);
    }
    try {
        if (typeof window !== 'undefined' && window?.ai?.summarizer?.create) {
            return await window.ai.summarizer.create();
        }
    }
    catch (error) {
        console.error('[News Insight][AI] Error in window.ai.summarizer:', error);
    }
    console.log('[News Insight][AI] No summarizer could be created');
    return null;
}

async function tryCreatePromptSession() {
    try {
        // Standardized way to get the Language Model API, checking all common locations.
        const LanguageModelAPI = chrome?.ai?.languageModel ||
                              (typeof window !== 'undefined' && window?.ai?.languageModel) ||
                              (typeof LanguageModel !== 'undefined' ? LanguageModel : null);

        if (LanguageModelAPI && typeof LanguageModelAPI.create === 'function') {
            return await LanguageModelAPI.create();
        }
    } catch (error) {
        console.error('[News Insight][AI] Error creating prompt session:', error);
    }
    return null;
}

function getPreferredOutputLanguage() {
    try {
        const supported = ['en', 'es', 'ja'];
        const lang = (navigator?.language || 'en').slice(0, 2).toLowerCase();
        return supported.includes(lang) ? lang : 'en';
    }
    catch (_) {
        return 'en';
    }
}

function chunkText(text, chunkSize = 2000) {
	const chunks = [];
	for (let i = 0; i < text.length; i += chunkSize) {
		chunks.push(text.substring(i, i + chunkSize));
	}
	return chunks;
}

export async function runRewriter(text) {
  try {
    // 1. Find the Rewriter API without referencing 'window' directly.
    const RewriterAPI = chrome?.ai?.rewriter || (typeof Rewriter !== 'undefined' ? Rewriter : null);

    if (!RewriterAPI) {
      throw new Error("Rewriter API is not available.");
    }

    // 2. Check availability and create an instance.
    const availability = await RewriterAPI.availability();
    if (availability !== 'available') {
       // Optionally, you could handle the 'downloadable' state.
      throw new Error(`Rewriter is not available. Status: ${availability}`);
    }

    const rewriter = await RewriterAPI.create();
    const result = await rewriter.rewrite(text);
    rewriter.destroy();
    
    return result;

  } catch (e) {
    console.error('[News Insight][AI] Rewriter API error:', e);
    // Return the original text or an error message as a fallback.
    return `Error during rewrite: ${e.message}`;
  }
}

export async function runProofreader(text) {
    console.log('--- ENTERING runProofreader ---');
    try {
        console.log('--- CHECKING PROOFREADER AVAILABILITY ---');
        const availability = await (chrome?.ai?.proofreader || window?.ai?.proofreader).availability({ includeCorrectionExplanations: true });
        console.log('--- PROOFREADER AVAILABILITY ---', availability);
        if (availability === 'unavailable') {
            console.log('--- PROOFREADER API NOT AVAILABLE, RETURNING ORIGINAL TEXT ---');
            return [{ text: text }];
        }

        console.log('[News Insight][AI] Running proofreader on text:', text);
        const proofreader = await (chrome?.ai?.proofreader || window?.ai?.proofreader).create({ includeCorrectionExplanations: true });
        console.log('--- PROOFREADER API INPUT ---', text);
        const result = await proofreader.proofread(text);
        console.log('--- PROOFREADER API OUTPUT ---', JSON.stringify(result, null, 2));

        if (!result || !result.corrections || result.corrections.length === 0) {
            console.log('--- NO CORRECTIONS FOUND, RETURNING ORIGINAL TEXT ---');
            return [{ text: text }];
        }

        console.log('--- PROCESSING CORRECTIONS ---');
        const corrections = result.corrections.sort((a, b) => a.offset - b.offset);

        const segments = [];
        let lastOffset = 0;
        for (const correction of corrections) {
            // Add the text before the correction
            if (correction.offset > lastOffset) {
                segments.push({ text: text.substring(lastOffset, correction.offset) });
            }
            // Add the corrected text with tooltip
            segments.push({
                text: correction.correction,
                original: text.substring(correction.offset, correction.offset + correction.length),
                explanation: correction.explanation
            });
            lastOffset = correction.offset + correction.length;
        }
        // Add the remaining text
        if (lastOffset < text.length) {
            segments.push({ text: text.substring(lastOffset) });
        }

        console.log('[News Insight][AI] Corrected segments:', segments);
        console.log('--- LEAVING runProofreader ---');
        return segments;
    }
    catch (error) {
        console.error('[News Insight][AI] Proofreader API error:', error);
        console.log('--- ERROR IN runProofreader, RETURNING ORIGINAL TEXT ---');
        return [{ text: text }]; // Return original text on error
    }
}