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
const TARGET_LANGUAGES = ['Arabic', 'Spanish', 'Dutch', 'Portuguese', 'French'];
const PROXY_SERVER_URL = 'https://figma-translator-plugin-phi.vercel.app/api/translate';
figma.showUI(__html__, { width: 320, height: 200 });
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === 'translate') {
        try {
            // Validate selection
            const selection = figma.currentPage.selection[0];
            if (!selection || selection.type !== 'FRAME') {
                figma.notify('❌ Select a frame first');
                return;
            }
            // Extract text nodes
            const textNodes = selection.findAll(node => node.type === 'TEXT');
            const texts = textNodes.map(node => ({
                id: node.id,
                text: node.characters
            }));
            // API call
            const response = yield fetch(PROXY_SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    texts: texts.map(t => t.text),
                    targetLanguages: TARGET_LANGUAGES
                })
            });
            // Handle response
            if (!response.ok) {
                const error = yield response.text();
                throw new Error(`Server error: ${response.status} - ${error}`);
            }
            const translations = yield response.json();
            // Create translated frames
            const baseX = selection.x + selection.width + 50;
            TARGET_LANGUAGES.forEach((lang, i) => {
                const frame = selection.clone();
                frame.name = `${selection.name} - ${lang}`;
                frame.x = baseX + (i * (frame.width + 20));
                frame.y = selection.y;
                frame.findAll(node => node.type === 'TEXT')
                    .forEach((textNode, j) => {
                    const tn = textNode;
                    tn.characters = translations[lang][j] || `[Translation Error]`;
                });
                figma.currentPage.appendChild(frame);
            });
            figma.notify('✅ Translations created!');
        }
        catch (error) {
            figma.notify(`❌ Error: ${error.message}`);
            console.error(error);
        }
    }
});
