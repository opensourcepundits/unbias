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
