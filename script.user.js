// ==UserScript==
// @name         GeoGuessr AI Match Reviewer
// @namespace    https://github.com/123cobloc/
// @version      1.0.0
// @description  Analyses your GeoGuessr Duels with Gemini AI. Get technical meta tips (bollards, vegetation, car meta) and region-guessing insights after every match. Requires free Google AI Studio API keys.
// @author       123cobloc
// @match        https://www.geoguessr.com/duels/*/summary
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geoguessr.com
// @grant        none
// @run-at       document-end
// @license      MIT
// @supportURL   https://github.com/123cobloc/geoguessr-ai-review/issues
// ==/UserScript==

(function() {
    'use strict';

    let roundObserver = null;
    let matchReviews = null;
    let isFetching = false;
    const MODEL_NAME = "gemini-3-flash-preview";

    // Retrieve keys from local storage
    function getApiKeys() {
        const keys = localStorage.getItem('geoguessr_ai_keys');
        return keys ? keys.split(',').map(k => k.trim()).filter(k => k !== "") : [];
    }

    // CSS Styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ai-aurora-glow {
            0% { text-shadow: 0 0 10px rgba(142, 68, 173, 0.7), 0 0 20px rgba(142, 68, 173, 0.4); }
            33% { text-shadow: 0 0 15px rgba(46, 204, 113, 0.8), 0 0 25px rgba(46, 204, 113, 0.5); }
            66% { text-shadow: 0 0 15px rgba(52, 152, 219, 0.8), 0 0 25px rgba(52, 152, 219, 0.5); }
            100% { text-shadow: 0 0 10px rgba(142, 68, 173, 0.7), 0 0 20px rgba(142, 68, 173, 0.4); }
        }
        .ai-loading-text {
            animation: ai-aurora-glow 4s infinite ease-in-out;
            color: #ffffff; font-style: italic; font-size: 1.1rem;
            letter-spacing: 1px; font-weight: bold; display: inline-block;
        }
        .setup-input {
            width: 100%; background: #1a1a2e; border: 1px solid #444;
            color: white; padding: 8px; margin: 5px 0; border-radius: 4px; outline: none;
        }
        .setup-input:focus { border-color: #8e44ad; }
        .setup-btn {
            width: 100%; padding: 12px; margin-top: 15px; border-radius: 5px;
            border: none; cursor: pointer; font-weight: bold; transition: 0.3s;
        }
        .setup-btn:disabled { background: #444; cursor: not-allowed; color: #888; }
        .setup-btn:enabled { background: #8e44ad; color: white; }
        .setup-btn:enabled:hover { background: #9b59b6; }
    `;
    document.head.appendChild(style);

    function showSetupUI(aiBox) {
        aiBox.innerHTML = `
            <div style="padding: 10px; text-align: left; font-weight: normal;">
                <h3 style="color: #8e44ad; margin-bottom: 10px;">✨ First AI Analysis Setup</h3>
                
                <div style="background: rgba(52, 152, 219, 0.1); border-left: 3px solid #3498db; padding: 12px; margin-bottom: 20px; font-size: 0.85rem;">
                    <strong>How to get your free API keys:</strong>
                    <ol style="margin: 10px 0; padding-left: 20px; line-height: 1.5;">
                        <li>1) Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #3498db; text-decoration: underline;">Google AI Studio</a> and sign in with your Google account.</li>
                        <li>2) Click the <strong>"Create API key"</strong> button in the top right.</li>
                        <li>3) Press <strong>"Create key"</strong> to finish the process.</li>
                        <li>4) Repeat these steps until you have 3 API keys visible in the main section.</li>
                        <li>5) Copy the API keys one by one in the following fields using the <strong>"Copy API key"</strong> button in Google AI Studio.</li>
                    </ol>
                    <p style="margin-top: 10px; font-size: 0.75rem; color: #ccc;">
                        <u>Note:</u> With this free setup, you can analyze a <strong>maximum of 60 games every 24 hours</strong>.
                    </p>
                </div>

                <div style="margin-top: 10px;">
                    <label style="font-size: 0.7rem; color: #aaa; text-transform: uppercase;">API Key 1 (Primary)</label>
                    <input type="text" id="key-1" class="setup-input" placeholder="Paste first key here...">
                    
                    <label style="font-size: 0.7rem; color: #aaa; text-transform: uppercase;">API Key 2 (Backup)</label>
                    <input type="text" id="key-2" class="setup-input" placeholder="Paste second key here...">
                    
                    <label style="font-size: 0.7rem; color: #aaa; text-transform: uppercase;">API Key 3 (Backup)</label>
                    <input type="text" id="key-3" class="setup-input" placeholder="Paste third key here...">
                    
                    <button id="save-keys-btn" class="setup-btn" disabled>Save & Start Analysis</button>
                </div>
            </div>
        `;

        const inputs = [document.getElementById('key-1'), document.getElementById('key-2'), document.getElementById('key-3')];
        const btn = document.getElementById('save-keys-btn');

        const validate = () => {
            const values = inputs.map(i => i.value.trim());

            const allCorrectLength = values.every(v => v.length === 39);

            const uniqueValues = new Set(values.filter(v => v !== ""));
            const allUnique = uniqueValues.size === inputs.length;

            btn.disabled = !(allCorrectLength && allUnique);
        };

        inputs.forEach(i => i.oninput = validate);
        btn.onclick = () => {
            const keyString = inputs.map(i => i.value.trim()).join(',');
            localStorage.setItem('geoguessr_ai_keys', keyString);
            updateRoundDisplay(); // Restart the logic immediately
        };
    }

    // --- Core Logic ---

    async function fetchAllReviews(gameData, myUserId) {
        const keys = getApiKeys();
        if (keys.length === 0) return null;

        const cacheKey = `georeview_${gameData.gameId}`;
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) return JSON.parse(cachedData);

        if (isFetching) return null;
        isFetching = true;

        const roundsSummary = gameData.rounds.map((r, i) => {
            const roundNum = i + 1;
            const myTeam = gameData.teams.find(t => t.players[0].playerId === myUserId);
            const oppTeam = gameData.teams.find(t => t.players[0].playerId !== myUserId);
            const myG = myTeam?.players[0].guesses.find(g => g.roundNumber === roundNum);
            const oppG = oppTeam?.players[0].guesses.find(g => g.roundNumber === roundNum);

            return {
                round: roundNum,
                multiplier: r.multiplier,
                country: r.panorama.countryCode,
                loc: { panoId: hexToAscii(r.panorama.panoId), lat: r.panorama.lat, lng: r.panorama.lng, heading: r.panorama.heading, pitch: r.panorama.pitch },
                myGuess: myG ? { score: myG.score, dist: myG.distance + "m" } : "No guess",
                oppGuess: oppG ? { score: oppG.score, dist: oppG.distance + "m" } : "No guess"
            };
        });

        const promptText = `
            You are an elite GeoGuessr Coach and World Cup analyst.
            Analyze these ${roundsSummary.length} rounds from a ${gameData.options.competitiveGameMode} match on the map "${gameData.options.map.name}".

            CRITICAL CONSTRAINTS:
            1. Tone: Professional, encouraging, and insightful. Avoid being rude. Always refers to the opponent in third person and to the player in second person, you are not part of the game.
            2. Technicality: Focus on "GeoGuessr Meta" (copyright, camera generations, car colors, bollards, utility poles) and "Env-Guessing" (soil, flora, road markings).
            3. Tip: Provide 5 distinct tips for every round, based on what you can see from the images and on the general knowledge. If my guess is in the wrong country, focus on how to get that country right. If the country is right, focus more on regionguessing.
            4. Regions: Use descriptive geographic regions (e.g., "The Pampas," "The Po Valley," "Appalachian Foothills", "Mojave Desert") rather than just state/province names.
            5. Output Format: Return EXACTLY ONE raw JSON array. Do not repeat the output. Do not include any text before or after the array.
            6. Termination: End the response immediately after the final ']' bracket of the array.
            7. For each round, you are given ${gameData.options.competitiveGameMode === 'NmpzDuels' ? '2 images (slightly left, slightly right, they overlap in the centre)' : '6 images (front, right, back, left, up, bottom)'}. Use them to provide me more accurate tips based on what I actually saw during the round.
            8. During the description of what you can see in the images, avoid to use numbering. Use instead the name i provided you for each image in the point 7: all the images follows the order stated there. Do not mention that you actually have multiple images. Treat them all as one big image, so say like "on the left we can see", "looking at the bottom" and so on.

            STRUCTURE:
            [
            {
                "round": number,
                "actualRegion": "Physiographic region name",
                "myGuessRegion": "Region name (distance in km)",
                "opponentGuessRegion": "Region name (distance in km)",
                "generalReview": "A balanced summary of the round. Acknowledge what led both players to their guesses, and explain the key differences between the player's guess and the actual location.",
                "locationReview": "A technical breakdown of the specific landscape. Mention things like copyright, coverage generation, meta cars, specific vegetation (e.g., Larch trees vs. Pines), or road line styles that confirm the exact location.",
                "tips": [
                {
                    "title": "Specific Meta/Clue",
                    "body": "A specific, actionable piece of advice based on the clues present in this round."
                }
                ]
            }
            ]

            DATA: ${JSON.stringify(roundsSummary)}`;

        const getBase64 = async (url) => {
            try {
                const res = await fetch(url);
                const buffer = await res.arrayBuffer();
                return btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
            } catch (e) { return null; }
        };

        const contentParts = [{ text: promptText + " DATA: " + JSON.stringify(roundsSummary) }];
        
        for (let i = 0; i < roundsSummary.length; i++) {
            const r = roundsSummary[i];
            const baseHeading = r.loc.heading || 0;
            const basePitch = r.loc.pitch || 0;
            let baseUrl = `https://streetviewpixels-pa.googleapis.com/v1/thumbnail?cb_client=maps_sv.tactile&w=1600&panoid=${r.loc.panoId}`;

            contentParts.push({ text: `--- Visuals for Round ${i + 1} ---` });

            let viewUrls = [];
            if (gameData.options.competitiveGameMode === 'NmpzDuels') {
                baseUrl += '&h=1300';
                viewUrls = [
                    { n: 'LEFT', yaw: baseHeading - 20, pitch: basePitch },
                    { n: 'RIGHT', yaw: baseHeading + 20, pitch: basePitch }
                ];
            } else {
                baseUrl += '&h=1600';
                viewUrls = [
                    { n: 'FRONT', yaw: baseHeading, pitch: 0 },
                    { n: 'RIGHT', yaw: (baseHeading + 90) % 360, pitch: 0 },
                    { n: 'BACK', yaw: (baseHeading + 180) % 360, pitch: 0 },
                    { n: 'LEFT', yaw: (baseHeading + 270) % 360, pitch: 0 },
                    { n: 'SKY', yaw: 0, pitch: -90 },
                    { n: 'GROUND', yaw: 0, pitch: 90 }
                ];
            }

            // 1. Creiamo un array di Promesse (i download partono tutti insieme)
            const imagePromises = viewUrls.map(view => {
                const url = view.pitch !== undefined 
                    ? `${baseUrl}&yaw=${view.yaw || 0}&pitch=${view.pitch}`
                    : `${baseUrl}&yaw=${view.yaw || 0}`;
                return getBase64(url);
            });

            // 2. Attendiamo che tutte siano completate.
            const b64Results = await Promise.all(imagePromises);

            // 3. Aggiungiamo i dati al prompt
            b64Results.forEach(b64 => {
                if (b64) {
                    contentParts.push({
                        inlineData: { mimeType: "image/jpeg", data: b64 }
                    });
                }
            });
        }

        // Attempt analysis rotating through provided keys
        for (const currentKey of keys) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${currentKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: contentParts }] })
                });

                if (response.status === 429) continue; // Rate limited, try next key
                
                const data = await response.json();
                let rawText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
                const parsedReviews = JSON.parse(rawText);

                localStorage.setItem(cacheKey, JSON.stringify(parsedReviews));
                isFetching = false;
                return parsedReviews;
            } catch (error) {
                console.error("API Key Error:", error);
            }
        }
        isFetching = false;
        return null;
    }

    async function updateRoundDisplay() {
        const displayDiv = document.getElementById('custom-round-review-div');
        if (!displayDiv) return;

        const pageProps = getNextData();
        if (!pageProps?.game) return;

        const selectedRoundElem = document.querySelector('.game-summary_selectedRound__pSEko');
        const roundNumber = parseInt(selectedRoundElem?.querySelector('.game-summary_text__viPc6')?.innerText?.replace(/\D/g, '')) || 1;

        renderLayoutStructure(displayDiv, pageProps.game.rounds[roundNumber-1], roundNumber);
        const aiBox = document.getElementById('ai-content-area');

        // Check if keys exist
        if (getApiKeys().length === 0) {
            showSetupUI(aiBox);
            return;
        }

        if (!matchReviews) {
            aiBox.innerHTML = `
                <div style="padding: 40px 20px; text-align:center;">
                    <span class="ai-loading-text">✨ Generating round report ✨</span>
                    <div style="color: #666; font-size: 0.7rem; margin-top: 10px;">Gemini is analyzing the match...</div>
                </div>`;
            matchReviews = await fetchAllReviews(pageProps.game, pageProps.userId);
            if (!matchReviews) {
                aiBox.innerHTML = `<div style="color: #e74c3c; padding: 20px;">Error generating review. Please check your API keys.</div>`;
                return;
            }
        }

        const currentReview = matchReviews.find(r => r.round === roundNumber);
        aiBox.innerHTML = currentReview ? `
            <div style="text-align: left; line-height: 1.5; font-size: 0.95rem; font-weight: normal;">
                <b>Actual Location:</b> ${currentReview.actualRegion}<br>
                <b>Your Guess:</b> ${currentReview.myGuessRegion}<br>
                <b>Opponent Guess:</b> ${currentReview.opponentGuessRegion}<br><br>
                <div>${currentReview.generalReview}</div><br>
                <div>${currentReview.locationReview}</div><br>
                <ul>
                    ${currentReview.tips.map(t => `<li style="margin-bottom: 10px;"><b>• ${t.title}:</b> ${t.body}</li>`).join('')}
                </ul>
            </div>` : "No review data available for this round.";
    }

    // --- UI Rendering & Helpers ---

    function getNextData() {
        try {
            return JSON.parse(document.getElementById('__NEXT_DATA__').textContent).props.pageProps;
        } catch (e) { return null; }
    }

    function hexToAscii(hex) {
        let str = '';
        for (let n = 0; n < hex.length; n += 2) str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
        return str;
    }

    function renderLayoutStructure(container, roundData, roundNum) {
        if (container.dataset.currentRound == roundNum) return;
        container.dataset.currentRound = roundNum;
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; height: 100%;">
                <div style="padding-bottom: 10px; border-bottom: 1px solid #444; font-size: 1.2rem; font-weight: bold; text-align: center;">Round ${roundNum} Review</div>
                <div id="ai-content-area" style="flex-grow: 1; overflow-y: auto; padding: 15px 0; scrollbar-width: thin;"></div>
                <div style="padding-top: 10px; border-top: 1px solid #333; font-size: 0.65rem; color: #666; text-align: center;">This analysis is AI generated and may contain inaccuracies.</div>
            </div>
        `;
    }

    function toggleReview(btnLabel) {
        let displayDiv = document.getElementById('custom-round-review-div');
        if (!displayDiv) {
            const innerContainer = document.querySelector('.game-summary_innerContainer__4_OgQ');
            if (innerContainer) {
                displayDiv = document.createElement('div');
                displayDiv.id = 'custom-round-review-div';
                displayDiv.style.cssText = `position: sticky; top: 80px; width: 35%; height: calc(100vh - 273px); margin: 0 20px; background: #252531; color: white; border: 2px solid #444; border-radius: 10px; padding: 15px 20px; z-index: 100; display: none; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.4);`;
                innerContainer.after(displayDiv);
            }
        }
        const isHidden = displayDiv.style.display === 'none';
        displayDiv.style.display = isHidden ? 'block' : 'none';
        btnLabel.innerText = isHidden ? "Hide Round Review" : "Show Round Review";
        if (isHidden) startRoundObserver();
    }

    function startRoundObserver() {
        if (roundObserver) roundObserver.disconnect();
        const targetNode = document.querySelector('.game-summary_playedRounds__Yljl9');
        if (!targetNode) return;
        roundObserver = new MutationObserver(() => updateRoundDisplay());
        roundObserver.observe(targetNode, { attributes: true, subtree: true, attributeFilter: ['class'] });
        updateRoundDisplay();
    }

    function injectCustomButton() {
        const buttonContainer = document.querySelector('.buttons_buttons__3yvvA');
        if (!buttonContainer || document.getElementById('custom-toggle-button')) return;
        
        const newButton = document.createElement('a');
        newButton.id = 'custom-toggle-button';
        newButton.className = 'next-link_anchor__CQUJ3 button_link__LWagc button_variantSecondary__hvM_F';
        newButton.style.cursor = 'pointer';
        newButton.innerHTML = `<div class="button_wrapper__zayJ3"><span id="toggle-label-text" class="button_label__ERkjz">Show Round Review</span></div>`;
        newButton.onclick = (e) => { e.preventDefault(); toggleReview(document.getElementById('toggle-label-text')); };
        buttonContainer.appendChild(newButton);
    }

    const mainObserver = new MutationObserver(injectCustomButton);
    mainObserver.observe(document.body, { childList: true, subtree: true });

})();
