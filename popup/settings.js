// Default settings - all features enabled by default
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

// Load settings from storage
async function loadSettings() {
	try {
		const stored = await chrome.storage.sync.get('extensionSettings');
		const settings = stored.extensionSettings || DEFAULT_SETTINGS;
		
		// Update all toggle switches
		for (const [key, value] of Object.entries(settings)) {
			const toggle = document.getElementById(key);
			if (toggle) {
				toggle.checked = value;
			}
		}
		
		console.log('[News Insight][Settings] Loaded settings:', settings);
	} catch (error) {
		console.error('[News Insight][Settings] Error loading settings:', error);
	}
}

// Save a single setting
async function saveSetting(key, value) {
	try {
		const stored = await chrome.storage.sync.get('extensionSettings');
		const settings = stored.extensionSettings || DEFAULT_SETTINGS;
		
		settings[key] = value;
		
		await chrome.storage.sync.set({ extensionSettings: settings });
		console.log('[News Insight][Settings] Saved setting:', key, '=', value);
		
		// Notify content scripts that settings have changed
		notifySettingsChanged();
	} catch (error) {
		console.error('[News Insight][Settings] Error saving setting:', error);
	}
}

// Notify all tabs that settings have changed
async function notifySettingsChanged() {
	try {
		const tabs = await chrome.tabs.query({});
		for (const tab of tabs) {
			chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_CHANGED' }).catch(() => {
				// Ignore errors for tabs that don't have content script
			});
		}
	} catch (error) {
		console.error('[News Insight][Settings] Error notifying tabs:', error);
	}
}

// Reset all settings to default
async function resetSettings() {
	try {
		await chrome.storage.sync.set({ extensionSettings: DEFAULT_SETTINGS });
		console.log('[News Insight][Settings] Reset all settings to default');
		
		// Update UI
		await loadSettings();
		
		// Notify tabs
		notifySettingsChanged();
		
		// Show feedback
		showResetFeedback();
	} catch (error) {
		console.error('[News Insight][Settings] Error resetting settings:', error);
	}
}

// Show visual feedback for reset
function showResetFeedback() {
	const resetBtn = document.getElementById('resetBtn');
	const originalText = resetBtn.textContent;
	
	resetBtn.textContent = '✓ Settings Reset!';
	resetBtn.style.background = '#10b981';
	resetBtn.style.color = 'white';
	resetBtn.style.borderColor = '#10b981';
	
	setTimeout(() => {
		resetBtn.textContent = originalText;
		resetBtn.style.background = '';
		resetBtn.style.color = '';
		resetBtn.style.borderColor = '';
	}, 2000);
}

// Initialize the settings page
document.addEventListener('DOMContentLoaded', async () => {
	// Load current settings
	await loadSettings();
	
	// Set up back button
	const backBtn = document.getElementById('backBtn');
	if (backBtn) {
		backBtn.addEventListener('click', () => {
			window.close();
		});
	}
	
	// Set up toggle switches
	const toggles = [
		'highlightLoadedLanguage',
		'highlightAbsolutes',
		'highlightWeakSources',
		'summaryGeneration',
		'biasDetection',
		'claimsExtraction',
		'aiAnalysis',
		'contentRewriting',
		'criticalThinking',
		'calendarEvents'
	];
	
	toggles.forEach(toggleId => {
		const toggle = document.getElementById(toggleId);
		if (toggle) {
			toggle.addEventListener('change', (event) => {
				saveSetting(toggleId, event.target.checked);
			});
		}
	});
	
	// Set up reset button
	const resetBtn = document.getElementById('resetBtn');
	if (resetBtn) {
		resetBtn.addEventListener('click', () => {
			if (confirm('Are you sure you want to reset all settings to default? This will enable all features.')) {
				resetSettings();
			}
		});
	}
});



