/// <reference types="@figma/plugin-typings" />

const TARGET_LANGUAGES = ['Arabic', 'Spanish', 'Dutch', 'Portuguese', 'French'];
const PROXY_SERVER_URL = 'https://figma-translator-plugin-phi.vercel.app/api/translate';

type TranslationResult = { [key: string]: string[] };

figma.showUI(__html__, { width: 320, height: 200 });

figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === 'translate') {
    try {
      // Validate selection
      const selection = figma.currentPage.selection[0];
      if (!selection || selection.type !== 'FRAME') {
        figma.notify('❌ Select a frame first');
        return;
      }

      // Extract text nodes
      const textNodes = selection.findAll(node => node.type === 'TEXT') as TextNode[];
      const texts = textNodes.map(node => ({
        id: node.id,
        text: node.characters
      }));

      // API call
      const response = await fetch(PROXY_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: texts.map(t => t.text),
          targetLanguages: TARGET_LANGUAGES
        })
      });

      // Handle response
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Server error: ${response.status} - ${error}`);
      }

      const translations: TranslationResult = await response.json();

      // Create translated frames
      const baseX = selection.x + selection.width + 50;
      TARGET_LANGUAGES.forEach((lang, i) => {
        const frame = selection.clone();
        frame.name = `${selection.name} - ${lang}`;
        frame.x = baseX + (i * (frame.width + 20));
        frame.y = selection.y;
        
        frame.findAll(node => node.type === 'TEXT')
          .forEach((textNode, j) => {
            const tn = textNode as TextNode;
            tn.characters = translations[lang][j] || `[Translation Error]`;
          });
        
        figma.currentPage.appendChild(frame);
      });

      figma.notify('✅ Translations created!');

    } catch (error) {
      figma.notify(`❌ Error: ${(error as Error).message}`);
      console.error(error);
    }
  }
};