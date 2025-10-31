# News Insight (Chrome Extension)

Core On-Page and Contextual Features

These are features that interact directly with the content of the webpage you are viewing.

Proactive Language Highlighting: Automatically scans the text of articles and underlines phrases that may represent:

Loaded & Emotional Language: Words designed to provoke an emotional response.

Absolutes & Generalizations: Sweeping statements that are often unprovable.

Weak or Vague Sources: Citing unnamed "experts" or "sources."

Context Menu for Text Selection: When you highlight any text on a page and right-click, you get the following options:

Proofread: Checks the selected text for grammatical errors and suggests corrections.

Summarize: Generates a concise summary of the selected text, which appears in a tooltip when you hover over it.

Rewrite: Replaces the selected text with an improved version, showing the original text in a tooltip.

Advanced Context Menu for Images: When you right-click on an image, a multi-option "Analyse Image" menu appears, allowing you to ask the AI to analyze it from different perspectives:

Analyze for Persuasive Bias: (Media Literacy Expert) Looks at camera angles, lighting, and focus to determine the intended emotional effect.

Analyze for Missing Context: (Photojournalist) Considers what might be happening outside the frame that could change the image's meaning.

Analyze for Symbolism: (Art Historian) Interprets the symbolic meaning of elements within the image, especially for cartoons or artwork.

Analyze Chart/Graph: (Data Analyst) Objectively states what the data shows and identifies any potentially misleading aspects of the visualization.

Analyze for Emotions: (Emotional Intelligence Expert) Describes the mood of the scene and identifies the emotions of people based on non-verbal cues.

Popup Window Features (Main UI)

These features are available when you click the extension's icon in the Chrome toolbar. The popup is organized into several tabs:

Critical Thinking Tab:

Generate Questions: Reads the article and generates a list of 3-5 critical thinking questions to help you engage with the content more deeply and question its premises.

Summary Tab:

Generate Summary: Provides a clean, bulleted list summarizing the key points of the entire article.

AI Analysis Tab:

Analyse Page: Performs a holistic AI analysis of the webpage, assessing its main topics, potential bias indicators, and key factual claims that might need verification.

Rewrite Content Tab:

Full-Text Rewriter: Allows you to rewrite the entire article's text with specific options to control the Tone (more casual or formal) and Length (shorter, same, or more detailed).

Image Analysis Tab:

View Analysis Results: Displays the results from any image analyses you have run using the context menu, creating a convenient history for the current page.

Calendar Events Tab:

Smart Event Extraction: Uses an intelligent, multi-turn AI process to:

Scan the article for any mention of dates or events.

Filter out past dates and irrelevant mentions.

Identify only actionable, future events.

Generate a descriptive title and a contextual summary for each event.

Remove any duplicate entries.

Add to Calendar: Each extracted event has a button that opens a pre-filled Google Calendar event in a new tab, ready for you to save.


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

### Proofreader

The Proofreader feature allows you to check the spelling and grammar of the text on a webpage. It uses the built-in Proofreader API to identify and suggest corrections for any errors found in the page content.
