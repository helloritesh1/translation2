// File: api/translate.js (Node.js code for your mini-server)

// This function will run when your server gets a request at the /api/translate URL

module.exports = async (req, res) => {
    // Allow requests from anywhere (important for Figma plugin)
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Still handle OPTIONS requests just in case
    if (req.method === 'OPTIONS') {
    // Add Methods/Headers needed for preflight response
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
    return;
    }
  
    // We only want POST requests
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
  
    // Get the data sent FROM the Figma plugin
    const { texts, targetLanguages, apiKey } = req.body;
  
    // Check if we got the data needed
    if (!Array.isArray(texts) || !Array.isArray(targetLanguages) || !apiKey) {
      console.error('Mini-Server: Invalid input received:', req.body);
      res.status(400).json({ error: 'Missing texts, targetLanguages, or apiKey.' });
      return;
    }
  
    // --- Call DeepL API ---
    const deepLResults = {};
    const isFreeTier = apiKey.endsWith(':fx');
    const endpoint = isFreeTier
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';
  
    console.log(`Mini-Server: Calling DeepL (${endpoint}) for ${targetLanguages.length} languages.`);
  
    for (const lang of targetLanguages) {
      try {
        // Server calls DeepL directly
        const deepLResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/json', // Use JSON from server-to-server
          },
          body: JSON.stringify({
            text: texts,
            target_lang: lang,
          }),
        });
  
        const responseData = await deepLResponse.json();
  
        if (!deepLResponse.ok) {
          // Handle errors FROM DeepL
          console.error(`Mini-Server: DeepL Error for ${lang}:`, responseData);
          deepLResults[lang] = texts.map(() => `[DeepL API Err: ${responseData?.message || deepLResponse.statusText}]`);
        } else {
          // Handle success FROM DeepL
          const translations = responseData?.translations?.map(t => t.text || '[No Translation]');
          if (!translations || translations.length !== texts.length) {
            deepLResults[lang] = texts.map(() => '[DeepL Resp. Format Err]');
          } else {
            deepLResults[lang] = translations;
          }
          console.log(`Mini-Server: Got translations for ${lang}.`);
        }
      } catch (error) {
        // Handle network errors trying to reach DeepL
        console.error(`Mini-Server: Network error calling DeepL for ${lang}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        deepLResults[lang] = texts.map(() => `[Mini-Server Network Err: ${errorMessage.substring(0,50)}]`);
      }
    } // End language loop
  
    // --- Send results back to the Figma plugin ---
    console.log('Mini-Server: Sending results back to Figma plugin.');
    res.status(200).json(deepLResults); // Send { langCode: [text1, text2,...], ... }
  };