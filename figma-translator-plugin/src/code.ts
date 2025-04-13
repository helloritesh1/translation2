/// <reference types="@figma/plugin-typings" />

const TARGET_LANGUAGES = ['Arabic', 'Spanish', 'Dutch', 'Portuguese', 'French'];
const PROXY_SERVER_URL = 'https://figma-translator-plugin-phi.vercel.app/api/translate';

type TranslationResult = { [key: string]: string[] };

figma.showUI(__html__, { width: 320, height: 200 });

figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === 'translate') {
    try {
      // --- Stage 1: Frame Validation ---
      const selection = figma.currentPage.selection[0];
      if (!selection || selection.type !== 'FRAME') {
        throw new Error('No frame selected - Select a frame first');
      }

      // --- Stage 2: Text Extraction ---
      const textNodes = selection.findAll(node => node.type === 'TEXT') as TextNode[];
      if (textNodes.length === 0) {
        throw new Error('No text layers in selected frame');
      }
      const texts = textNodes.map(node => ({ id: node.id, text: node.characters }));

      // --- Stage 3: API Call ---
      let response;
      try {
        response = await fetch(PROXY_SERVER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texts: texts.map(t => t.text),
            targetLanguages: TARGET_LANGUAGES
          })
        });
      } catch (error) {
        console.error('Network Error:', error);
        throw new Error(`Network error: ${(error as Error).message}`);
      }

      // --- Stage 4: Response Handling ---
      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Failed to read error body');
        console.error('Server Response Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody
        });
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const translations: TranslationResult = await response.json().catch(error => {
        console.error('JSON Parse Error:', error);
        throw new Error('Invalid server response format');
      });

      // --- Stage 5: Translation Validation ---
      if (!Object.keys(translations).length) {
        throw new Error('Server returned empty translations');
      }

      // --- Stage 6: Frame Creation ---
      const baseX = selection.x + selection.width + 50;
      TARGET_LANGUAGES.forEach((lang, i) => {
        if (!translations[lang]?.length) {
          console.warn(`Missing translations for ${lang}`);
          return;
        }

        const frame = selection.clone();
        frame.name = `${selection.name} - ${lang}`;
        frame.x = baseX + (i * (frame.width + 20));
        frame.y = selection.y;
        
        frame.findAll(node => node.type === 'TEXT')
          .forEach((textNode, j) => {
            const tn = textNode as TextNode;
            tn.characters = translations[lang][j] || `[TRANSLATION FAILED: ${lang}]`;
          });
        
        figma.currentPage.appendChild(frame);
      });

      figma.notify(`Created ${TARGET_LANGUAGES.length} translated frames!`);

    } catch (error) {
      const errorMessage = (error as Error).message;
      figma.notify(`Error: ${errorMessage}`);
      console.error('Full Error:', error);
    }
  }
};