# 🌍 GeoGuessr AI Match Reviewer

Enhance your GeoGuessr skills with an elite AI Coach. This script integrates Google's **Gemini AI** directly into your Duels summary page to provide technical breakdowns, meta-clues, and regional insights for every round you play.

## ✨ Features
* **Deep Technical Analysis:** Identifies specific "Meta" clues like bollards, utility poles, camera generations, and car colors.
* **Environmental Insights:** Learn to distinguish regions based on flora (e.g., Larch vs. Pine), soil color, and road markings.
* **Regional Accuracy:** Moves beyond country names to physiographic regions (e.g., "The Po Valley," "Pampas," or "Appalachian Foothills").
* **Visual Analysis:** The AI "looks" at the Street View images from your match to tell you exactly what you missed.
* **Privacy Focused:** Your API keys are stored locally in your browser. No data is sent to third-party servers except for Google's official API.

---

## 🔑 Setup Guide (Important!)

To keep this tool free and fast, it uses your own Google Gemini API keys.
**Note:** You can analyze roughly **60 games every 24 hours** with this setup.

### How to get your keys:
1. Visit **[Google AI Studio](https://aistudio.google.com/app/apikey)**.
2. Sign in with your standard Google Account.
3. Click the blue **"Create API key"** button in the top-left sidebar.
4. Copy the generated key (a long string of 39 characters).
5. **Repeat this 3 times** to generate 3 unique keys.
* *Why 3?* The script rotates keys to bypass "Rate Limits," ensuring your analysis never hangs or slows down.

---

## 🚀 Installation

1. Install a user script manager like [Tampermonkey](https://www.tampermonkey.net/).
2. Install this script from [Greasy Fork](https://greasyfork.org/it/scripts/567003-geoguessr-ai-match-reviewer) or copy-paste the code into a new script.
3. Go to GeoGuessr and finish any **Duel** match.
4. On the Summary page, click the new **"Show Round Review"** button.
5. Paste your 3 unique keys into the setup form and hit **Save**.

---

## 🛠️ How it Works
* **Metadata Extraction:** The script reads the match data (coordinates, pano IDs, and scores) directly from the game's internal state.
* **Visual Prompting:** It fetches the Street View thumbnails you saw during the round and sends them to the Gemini model.
* **Contextual Feedback:** The AI compares your guess location to the actual location and provides 5 actionable tips to improve your future guesses in that specific area.

## 📜 License
This project is licensed under the [MIT License](LICENSE).

---
*Created with ❤️ for the GeoGuessr community by 123cobloc.*
