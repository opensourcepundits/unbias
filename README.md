# News Insight (Chrome Extension)


## To add
- Estimated reading time
- Translation?
- Caching?
- Settings page
- Content filters
- Improve all UIs
- Get name

🚀 Installation
Follow these steps to load the News Insight extension into your Chrome browser for development and testing.

1. Get the Code (Clone the Repository)
First, clone the repository to your local machine using your preferred method:

```
git clone [YOUR_REPO_URL]
```

2. Download [Google Chrome for developers](https://www.google.com/chrome/dev/) because it has the APIs built in.

3. Load as Unpacked Extension in Chrome

Open Chrome and navigate to the Extensions management page: ```chrome://extensions/```

Enable Developer Mode using the toggle switch in the upper right corner.

Click the Load unpacked button (located in the upper left corner).

Navigate to and select the local repository directory (the folder where your manifest.json file is located).

The News Insight: Summary, Bias & Claims extension should now appear in your list. 


To apply any code changes while developing, click the circular Reload arrow on the extension's card.



## Folder Structure

```
unbias/
├── ai/
│   └── index.js
├── background/
│   └── service-worker.js
├── content/
│   └── content.js
├── popup/
│   ├── index.html
│   ├── popup.css
│   └── popup.js
├── manifest.json
└── README.md
```

## Main Functions

This project is a Chrome extension with the following main components:

*   **`background/service-worker.js`**: This script runs in the background to handle tasks such as API communication, event handling, and managing the extension's state.
*   **`content/content.js`**: This script is injected into web pages to interact with the content. It can read and modify the DOM, which is essential for features like highlighting text or displaying in-page information.
*   **`popup/`**: This directory contains the files for the extension's popup UI.
    *   `popup.html`: The main HTML structure of the popup.
    *   `popup.css`: The stylesheet for the popup.
    *   `popup.js`: The script that handles user interactions within the popup.
*   **`api/index.js`**: This could be a backend component for handling API requests, although its exact function would depend on the project's architecture.

## Features

### Proactive Language Highlighter

The Proactive Language Highlighter is a feature that automatically identifies and highlights potentially biased or manipulative language in news articles as you read them. It uses on-device AI to analyze text in real-time and applies subtle underlines to flag specific types of rhetoric.

#### Color-Coding Dictionary

The highlighter uses color-coded underlines to indicate different categories of language:

- **Soft Red (Vermilion)**: Loaded & Emotional Language
  - Flags words designed to provoke strong emotional responses (positive or negative) instead of rational ones.
  - Examples: disaster, threat, shameful, outrageous, catastrophic, miracle, hero, villain, sacred, betrayal, nightmare.

- **Warning Yellow (Amber)**: Absolutes & Hyperbole
  - Flags sweeping, all-or-nothing generalizations that are often unprovable and used to shut down nuance.
  - Examples: always, never, everyone, nobody, completely, totally, impossible, undeniable, clearly, obviously, literally (when used for emphasis).

- **Cool Blue (Cornflower Blue)**: Vague & Uncertain Language (Weasel Words)
  - Flags words that hedge, weaken, or obscure claims, often by attributing them to anonymous or vague sources.
  - Examples: some say, it is believed, reportedly, arguably, studies show, experts claim, according to a source, tends to, may, could.

#### How It Works

1. **Real-Time Analysis**: As you scroll through a webpage, the content script detects visible paragraphs and sends their text to the background script for analysis.

2. **AI-Powered Categorization**: The background script uses the on-device Prompt API to analyze the text with a specialized prompt that identifies phrases in the three categories.

3. **Dynamic Highlighting**: Identified phrases are highlighted in the DOM with the appropriate color-coded underline. The highlighting is subtle to avoid distraction while encouraging critical thinking.

4. **Hover Explanations**: Hover over any highlighted phrase or the underlined text to see a tooltip explaining why it was flagged and the category it belongs to.

5. **No Hard-Coded Lists**: Instead of relying on static word lists, the feature uses AI to adapt to context, ensuring accurate detection in various scenarios (e.g., "threat" in a weather report vs. political rhetoric).

This feature promotes media literacy by making users aware of manipulative language without interrupting their reading experience.
