// Placeholder wrappers for Chrome Built-in AI Challenge APIs.
// Replace internals with chrome.ai.* or window.ai.* calls where available.

export async function summarizeArticle(content) {
	const prompt = `Summarize the following news article in 4-6 bullet points with a neutral tone. Include: who, what, when, where, why, how.\n\nTitle: ${content.title}\nURL: ${content.url}\nText:\n${content.text}`;
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

async function runLocalSummarizer(input) {
	// TODO: Swap with chrome.ai.summarizer or Summarizer API once available.
	return await runLocalPrompt(`SUMMARIZE:\n${input}`);
}

async function runLocalPrompt(prompt, options = {}) {
	// TODO: Implement using Prompt API (on-device Gemini Nano) when exposed.
	// For now, return a deterministic placeholder to wire up the UI flow.
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
