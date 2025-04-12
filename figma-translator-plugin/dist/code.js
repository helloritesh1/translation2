"use strict";
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
const TARGET_LANGUAGES = ['AR', 'ES', 'NL', 'PT', 'FR'];
const FRAME_SPACING = 50;
const API_KEY_STORAGE_KEY = 'frameTranslatorDeepLApiKey_v1';
const PROXY_SERVER_URL = 'https://figma-translator-plugin-phi.vercel.app/api/translate'; // Use your actual URL
// --- Show UI and Request Key Load ---
// Use figma global directly - the reference comment helps TS find it
figma.showUI(__html__, { width: 320, height: 280 });
console.log('[Code] Plugin UI Shown.');
// figma.ui.postMessage({ type: 'ui-ready-request-key-load' }); // Temporarily removed as UI doesn't need it now
// console.log('[Code] Sent ui-ready-request-key-load message to UI.');
// --- Global State ---
let originalFrameNode = null;
let originalTextNodes = [];
let originalTextData = [];
// --- DeepL API Call Function (Via Proxy - Manual Form Encoding) ---
// Note: Renamed to callProxyServer as it doesn't call DeepL directly
function callProxyServer(textsToTranslate, apiKey) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('[Code] Entering callProxyServer function.');
        const sourceTexts = textsToTranslate.map(item => item.text);
        const results = {};
        TARGET_LANGUAGES.forEach((lang) => results[lang] = []); // Initialize structure
        if (sourceTexts.length === 0) {
            return results;
        }
        if (PROXY_SERVER_URL.includes('YOUR_VERCEL_DEPLOYMENT_URL_HERE'))
            throw new Error('Proxy URL not configured!');
        try {
            console.log(`[Code] Calling Proxy Server at: ${PROXY_SERVER_URL}`);
            // Using fetch - tsconfig "lib": ["dom"] provides base definition
            const proxyResponse = yield fetch(PROXY_SERVER_URL, {
                method: 'POST',
                // No headers object needed when not specifying Content-Type
                body: JSON.stringify({
                    texts: sourceTexts,
                    targetLanguages: TARGET_LANGUAGES,
                    apiKey: apiKey
                }),
            });
            console.log(`[Code] Proxy response status: ${proxyResponse.status}, OK: ${proxyResponse.ok}`);
            if (!proxyResponse.ok) {
                let errorMsg = `Proxy error ${proxyResponse.status}`;
                try {
                    const errorData = yield proxyResponse.json();
                    errorMsg = (errorData === null || errorData === void 0 ? void 0 : errorData.error) || errorMsg;
                }
                catch (e) {
                    const textError = yield proxyResponse.text();
                    errorMsg = textError.substring(0, 100) || errorMsg;
                }
                throw new Error(errorMsg);
            }
            const proxyResult = yield proxyResponse.json();
            console.log('[Code] Parsed success response from proxy:', proxyResult);
            // Reconstruct the data structure
            TARGET_LANGUAGES.forEach(lang => {
                const translatedTexts = proxyResult[lang];
                if (translatedTexts && translatedTexts.length === originalTextData.length) {
                    for (let i = 0; i < originalTextData.length; i++) {
                        results[lang].push({ id: originalTextData[i].id, text: translatedTexts[i] });
                    }
                }
                else {
                    console.warn(`[Code] Mismatch/missing data from proxy for ${lang}.`);
                    for (let i = 0; i < originalTextData.length; i++) {
                        results[lang].push({ id: originalTextData[i].id, text: `[Proxy Data Err ${lang}]` });
                    }
                }
            });
        }
        catch (proxyCallError) {
            const errorMessage = proxyCallError instanceof Error ? proxyCallError.message : String(proxyCallError);
            console.error('[Code] Error calling or processing proxy server:', proxyCallError);
            TARGET_LANGUAGES.forEach(lang => {
                results[lang] = [];
                for (let i = 0; i < originalTextData.length; i++) {
                    results[lang].push({ id: originalTextData[i].id, text: `[Proxy Call Err: ${errorMessage.substring(0, 50)}]` });
                }
            });
            figma.ui.postMessage({ type: 'show-status', message: `Proxy/Network Error: ${errorMessage}`, isError: true });
        }
        console.log('[Code] Exiting callProxyServer function.');
        return results;
    });
}
// --- Main Message Handler ---
// Add explicit 'any' type for msg until we define specific message types
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('[Code] Received message from UI:', msg.type);
    // --- REMOVED Storage Handlers ---
    // --- Handle request FROM UI to start the whole process ---
    if (msg.type === 'start-translation-process') {
        console.log('[Code] Received start-translation-process request.');
        const apiKey = msg.apiKey; // API key is sent WITH the request
        if (!apiKey) { /* ... API key missing error ... */
            return;
        }
        // 1. Get Selected Frame
        const selection = figma.currentPage.selection;
        if (selection.length !== 1 || selection[0].type !== 'FRAME') {
            figma.notify('❌ Select one Frame.', { error: true });
            figma.ui.postMessage({ type: 'show-status', message: 'Error: Select one Frame.', isError: true });
            return;
        }
        originalFrameNode = selection[0];
        figma.ui.postMessage({ type: 'show-status', message: 'Selected frame: ' + originalFrameNode.name });
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
        figma.ui.postMessage({ type: 'show-status', message: `Found ${originalTextData.length} text items. Calling proxy...` });
        // 4. Call the PROXY SERVER
        const translationsByLang = yield callProxyServer(originalTextData, apiKey);
        console.log('[Code] Proxy server call finished. Result:', translationsByLang);
        // 5. Proceed to apply translations
        yield applyTranslationsToFrames(translationsByLang);
    }
    // --- Handle translation errors reported BY the UI ---
    else if (msg.type === 'translation-error') { /* ... */ }
}); // End figma.ui.onmessage
// --- Helper Function to Apply Translations ---
function applyTranslationsToFrames(translationsByLang) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('[Code] Entering applyTranslationsToFrames.');
        if (!originalFrameNode || originalTextNodes.length === 0) { /* ... */
            return;
        }
        // Font Loading
        const fontsToLoad = new Set();
        originalTextNodes.forEach(node => { if (typeof node.fontName === 'symbol') {
            node.getStyledTextSegments(['fontName']).forEach((s) => fontsToLoad.add(s.fontName));
        }
        else {
            fontsToLoad.add(node.fontName);
        } }); // Added type for 's'
        try {
            figma.ui.postMessage({ type: 'show-status', message: 'Loading fonts...' });
            yield Promise.all(Array.from(fontsToLoad).map(font => figma.loadFontAsync(font)));
            console.log('[Code] Fonts loaded.');
            figma.ui.postMessage({ type: 'show-status', message: 'Fonts loaded. Creating frames...' });
        }
        catch (e) { /* ... Font error handling ... */ }
        // Frame Creation Loop
        let currentX = originalFrameNode.x + originalFrameNode.width + FRAME_SPACING;
        const startY = originalFrameNode.y;
        let framesCreated = 0;
        for (const langCode of TARGET_LANGUAGES) {
            const translatedTexts = translationsByLang[langCode];
            if (!translatedTexts || translatedTexts.length === 0 || translatedTexts.some(t => t.text.startsWith('[API/Network Err') || t.text.startsWith('[Proxy'))) { /* ... Skip frame ... */
                continue;
            }
            const newFrame = originalFrameNode.clone();
            newFrame.name = `${originalFrameNode.name} (${langCode.toUpperCase()})`;
            newFrame.x = currentX;
            newFrame.y = startY;
            currentX += newFrame.width + FRAME_SPACING;
            const newTextNodes = newFrame.findAllWithCriteria({ types: ['TEXT'] });
            if (newTextNodes.length !== originalTextNodes.length) { /* ... Error ... */
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
                if (translatedText !== undefined) {
                    try {
                        const nodeFontsToLoad = new Set();
                        if (typeof newNode.fontName === 'symbol') {
                            newNode.getStyledTextSegments(['fontName']).forEach((s) => nodeFontsToLoad.add(s.fontName));
                        }
                        else {
                            nodeFontsToLoad.add(newNode.fontName);
                        } // Added type for 's'
                        yield Promise.all(Array.from(nodeFontsToLoad).map(font => figma.loadFontAsync(font)));
                        newNode.characters = translatedText;
                        appliedCount++;
                    }
                    catch (e) { /* ... Font error handling ... */ }
                }
            }
            console.log(`[Code] Applied ${appliedCount} translations for ${langCode}.`);
            figma.currentPage.appendChild(newFrame);
            framesCreated++;
        }
        // Final Status Update
        if (framesCreated > 0) { /* ... Success ... */ }
        else { /* ... No frames ... */ }
        // Reset state
        originalFrameNode = null;
        originalTextNodes = [];
        originalTextData = [];
    });
} // End applyTranslationsToFrames
