"use strict";
/// <reference types="@figma/plugin-typings" />
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// --- Constants ---
const TARGET_LANGUAGES = ['AR', 'ES', 'NL', 'PT', 'FR']; // Use codes OpenAI understands if needed
const FRAME_SPACING = 50;
// !!! PASTE YOUR ACTUAL VERCEL URL HERE !!!
const PROXY_SERVER_URL = 'https://figma-translator-plugin-phi.vercel.app/api/translate'; // Your proxy endpoint
// --- Show UI ---
figma.showUI(__html__, { width: 320, height: 150 }); // Adjusted height
console.log('[Code] Plugin UI Shown.');
// --- Global State ---
let originalFrameNode = null;
let originalTextNodes = [];
let originalTextData = [];
// --- Helper Function to Call Proxy Server ---
function callProxyServerForTranslations(textsToTranslate) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('[Code] Entering callProxyServerForTranslations function.');
        const sourceTexts = textsToTranslate.map(item => item.text);
        const results = {};
        TARGET_LANGUAGES.forEach((lang) => results[lang] = []); // Initialize structure
        if (sourceTexts.length === 0) {
            console.log('[Code] No source texts to send to proxy.');
            return results; // Return empty results
        }
        if (PROXY_SERVER_URL.includes('YOUR_VERCEL_DEPLOYMENT_URL_HERE')) {
            throw new Error('Proxy URL not configured in code.ts!');
        }
        try {
            console.log(`[Code] Calling Proxy Server: ${PROXY_SERVER_URL}`);
            figma.ui.postMessage({ type: 'show-status', message: `Calling proxy server...` });
            const proxyResponse = yield fetch(PROXY_SERVER_URL, {
                method: 'POST',
                // No headers object needed when not specifying Content-Type? Let's keep JSON for proxy.
                headers: {
                    'Content-Type': 'application/json' // Send JSON to proxy
                },
                body: JSON.stringify({
                    texts: sourceTexts, // Send array of original text strings
                    targetLanguages: TARGET_LANGUAGES // Send target language codes
                    // No API key sent from plugin - proxy handles it
                }),
            });
            console.log(`[Code] Proxy server response status: ${proxyResponse.status}, OK: ${proxyResponse.ok}`);
            figma.ui.postMessage({ type: 'show-status', message: `Proxy status: ${proxyResponse.status}` });
            if (!proxyResponse.ok) {
                let errorMsg = `Proxy error ${proxyResponse.status}`;
                try {
                    const errorData = yield proxyResponse.json();
                    console.error('[Code] Proxy server error response (parsed):', errorData);
                    errorMsg = (errorData === null || errorData === void 0 ? void 0 : errorData.error) || errorMsg;
                }
                catch (e) {
                    const textError = yield proxyResponse.text();
                    console.error('[Code] Proxy server error response (text):', textError);
                    errorMsg = textError.substring(0, 100) || errorMsg;
                }
                throw new Error(errorMsg); // Propagate the error
            }
            // Process successful response from proxy
            const proxyResult = yield proxyResponse.json();
            console.log('[Code] Parsed success response from proxy:', proxyResult);
            // Reconstruct the data structure needed for applyTranslationsToFrames
            TARGET_LANGUAGES.forEach(lang => {
                const translatedTexts = proxyResult[lang]; // Should be array of strings
                if (translatedTexts && Array.isArray(translatedTexts) && translatedTexts.length === originalTextData.length) {
                    for (let i = 0; i < originalTextData.length; i++) {
                        results[lang].push({
                            id: originalTextData[i].id,
                            text: translatedTexts[i] || `[Proxy Format Err ${lang}]` // Use translation or placeholder
                        });
                    }
                }
                else {
                    console.warn(`[Code] Mismatch or missing data from proxy for lang ${lang}. Response segment:`, translatedTexts);
                    for (let i = 0; i < originalTextData.length; i++) {
                        results[lang].push({
                            id: originalTextData[i].id,
                            text: `[Proxy Data Err ${lang}]`
                        });
                    }
                }
            });
        }
        catch (proxyCallError) {
            // Handle network errors calling the proxy or errors thrown above
            const errorMessage = proxyCallError instanceof Error ? proxyCallError.message : String(proxyCallError);
            console.error('[Code] Error calling or processing proxy server:', proxyCallError);
            // Populate ALL languages with error for skipping frames later
            TARGET_LANGUAGES.forEach(lang => {
                results[lang] = []; // Ensure array exists
                for (let i = 0; i < originalTextData.length; i++) {
                    results[lang].push({ id: originalTextData[i].id, text: `[Proxy Call Err: ${errorMessage.substring(0, 50)}]` });
                }
            });
            figma.ui.postMessage({ type: 'show-status', message: `Proxy/Network Error: ${errorMessage}`, isError: true });
        }
        console.log('[Code] Exiting callProxyServerForTranslations function.');
        return results;
    });
}
// --- Main Message Handler ---
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('[Code] Received message from UI:', msg.type);
    // --- Handle request FROM UI to start the whole process ---
    if (msg.type === 'start-translation-process') {
        console.log('[Code] Received start-translation-process request.');
        // No API key check needed here as proxy handles it
        // 1. Get Selected Frame
        const selection = figma.currentPage.selection;
        if (selection.length !== 1 || selection[0].type !== 'FRAME') {
            figma.notify('❌ Select one Frame.', { error: true });
            figma.ui.postMessage({ type: 'show-status', message: 'Error: Select one Frame.', isError: true });
            return;
        }
        originalFrameNode = selection[0];
        figma.ui.postMessage({ type: 'show-status', message: 'Selected: ' + originalFrameNode.name });
        // 2. Find Text Nodes
        originalTextNodes = originalFrameNode.findAllWithCriteria({ types: ['TEXT'] });
        if (originalTextNodes.length === 0) {
            figma.notify('🤷 No text found.', { timeout: 3000 });
            figma.ui.postMessage({ type: 'show-status', message: 'No text found.' });
            originalFrameNode = null;
            return;
        }
        // 3. Extract Text Content & Store It
        originalTextData = originalTextNodes.map(node => ({ id: node.id, text: node.characters }));
        console.log(`[Code] Extracted ${originalTextData.length} text items.`);
        // 4. Call the PROXY SERVER
        // Status update moved inside callProxyServerForTranslations
        const translationsByLang = yield callProxyServerForTranslations(originalTextData);
        console.log('[Code] Proxy server call finished. Result:', translationsByLang);
        // 5. Proceed to apply translations (if any results are valid)
        yield applyTranslationsToFrames(translationsByLang);
    }
    // --- Handle other message types if needed ---
    // else if (msg.type === '...') { ... }
}); // End figma.ui.onmessage
// --- Helper Function to Apply Translations ---
function applyTranslationsToFrames(translationsByLang) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('[Code] Entering applyTranslationsToFrames.');
        if (!originalFrameNode || originalTextNodes.length === 0) {
            console.error('[Code] Cannot apply translations, original frame/text data missing.');
            figma.notify('❌ Error: Original frame data lost before applying translations.', { error: true });
            return;
        }
        // --- Font Loading ---
        const fontsToLoad = new Set();
        // *** FIX 1 HERE: Changed 's: StyledTextSegment' to 's: any' ***
        originalTextNodes.forEach(node => { if (typeof node.fontName === 'symbol') {
            node.getStyledTextSegments(['fontName']).forEach((s) => fontsToLoad.add(s.fontName));
        }
        else {
            fontsToLoad.add(node.fontName);
        } });
        try {
            figma.ui.postMessage({ type: 'show-status', message: 'Loading fonts...' });
            yield Promise.all(Array.from(fontsToLoad).map(font => figma.loadFontAsync(font)));
            console.log('[Code] Fonts loaded.');
            figma.ui.postMessage({ type: 'show-status', message: 'Fonts loaded. Creating frames...' });
        }
        catch (e) {
            const err = e instanceof Error ? e.message : String(e);
            console.error("[Code] Error loading fonts:", e);
            figma.notify(`❌ Font Error: ${err}`, { error: true });
            figma.ui.postMessage({ type: 'show-status', message: `Font Error: ${err}`, isError: true });
            return;
        }
        // --- Frame Creation Loop ---
        let currentX = originalFrameNode.x + originalFrameNode.width + FRAME_SPACING;
        const startY = originalFrameNode.y;
        let framesCreated = 0;
        for (const langCode of TARGET_LANGUAGES) {
            const translatedTexts = translationsByLang[langCode];
            // Check if data exists AND doesn't contain specific error placeholders we generated
            const hasErrors = !translatedTexts || translatedTexts.length === 0 || translatedTexts.some(t => t.text.startsWith('[API/Network Err') || t.text.startsWith('[Proxy') || t.text.startsWith('[DeepL') || t.text.startsWith('[OpenAI'));
            if (hasErrors) {
                console.warn(`[Code] Skipping frame for ${langCode} due to missing data or upstream errors.`);
                if (translatedTexts && translatedTexts.length > 0) {
                    figma.notify(`⚠️ Skipping ${langCode} frame due to upstream errors.`, { timeout: 3000 });
                }
                continue; // Skip creating frame if data is bad
            }
            // Proceed if data seems valid
            const newFrame = originalFrameNode.clone();
            newFrame.name = `${originalFrameNode.name} (${langCode.toUpperCase()})`;
            newFrame.x = currentX;
            newFrame.y = startY;
            currentX += newFrame.width + FRAME_SPACING;
            const newTextNodes = newFrame.findAllWithCriteria({ types: ['TEXT'] });
            if (newTextNodes.length !== originalTextNodes.length) {
                console.error(`[Code] Text node mismatch ${langCode}`);
                newFrame.remove();
                continue;
            }
            const translationMap = new Map();
            translatedTexts.forEach((item) => translationMap.set(item.id, item.text));
            let appliedCount = 0;
            for (let i = 0; i < originalTextNodes.length; i++) {
                const originalNodeId = originalTextNodes[i].id;
                const newNode = newTextNodes[i];
                const translatedText = translationMap.get(originalNodeId);
                if (!newNode || newNode.type !== 'TEXT') {
                    continue;
                }
                if (translatedText !== undefined && !translatedText.startsWith('[')) { // Only apply if not an error/placeholder? Your choice. Let's apply placeholders too now.
                    try {
                        // *** FIX 2 HERE: Changed 's: StyledTextSegment' to 's: any' ***
                        const nodeFontsToLoad = new Set();
                        if (typeof newNode.fontName === 'symbol') {
                            newNode.getStyledTextSegments(['fontName']).forEach((s) => nodeFontsToLoad.add(s.fontName));
                        }
                        else {
                            nodeFontsToLoad.add(newNode.fontName);
                        }
                        yield Promise.all(Array.from(nodeFontsToLoad).map(font => figma.loadFontAsync(font)));
                        newNode.characters = translatedText;
                        appliedCount++;
                    }
                    catch (e) {
                        const fontErr = e instanceof Error ? e.message : String(e);
                        console.error(`[Code] Font/Set error node ${i} lang ${langCode}: ${fontErr}`);
                        try {
                            yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
                            newNode.characters = '[Font Err]';
                        }
                        catch (e2) { }
                    }
                }
                else if (translatedText !== undefined && translatedText.startsWith('[')) {
                    // Apply placeholder/error text
                    try {
                        yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
                        newNode.characters = translatedText;
                    }
                    catch (e) { }
                    console.log(`[Code] Applied placeholder/error text for node ${originalNodeId} in ${langCode}: ${translatedText}`);
                }
            }
            console.log(`[Code] Applied ${appliedCount} valid translations for ${langCode}.`); // Changed log slightly
            figma.currentPage.appendChild(newFrame);
            framesCreated++;
        } // End language loop
        // --- Final Status Update ---
        if (framesCreated > 0) {
            figma.notify(`✅ Translation complete! ${framesCreated} frames created.`, { timeout: 5000 });
            figma.ui.postMessage({ type: 'show-status', message: 'Done!' });
        }
        else {
            figma.notify(`ℹ️ Translation finished, but no valid frames created. Check logs/API key.`, { timeout: 5000 });
            figma.ui.postMessage({ type: 'show-status', message: 'Finished. No frames created (check logs).' });
        }
        // Reset state
        originalFrameNode = null;
        originalTextNodes = [];
        originalTextData = [];
    });
} // End applyTranslationsToFrames
