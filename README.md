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