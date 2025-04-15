// File: api/translate.js (Using OpenAI)

// Use global fetch
// IMPORTANT: Add your OpenAI API Key securely.
// Best practice is to use Vercel Environment Variables:
// 1. Go to your Vercel project settings -> Environment Variables.
// 2. Add a variable named OPENAI_API_KEY with your actual key as the value.
// 3. Redeploy the function (vercel --prod).
// Then access it here: const OPENAI_KEY = process.env.OPENAI_API_KEY;
// FOR TESTING ONLY (Less Secure): Paste key directly:
const OPENAI_KEY = "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"; // <<< PASTE YOUR KEY HERE FOR NOW (or use env var)

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

module.exports = async (req, res) => {
  // --- CORS Handling ---
  console.log(`Proxy: Received request method: ${req.method}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    console.log('Proxy: Responding to OPTIONS preflight.');
    res.status(204).end();
    return;
  }
  // --- End CORS Handling ---

  if (req.method !== 'POST') { /* ... Method Not Allowed ... */ return; }

  console.log('Proxy: Received POST request for OpenAI translation.');

  try {
    const { texts, targetLanguages } = req.body; // Don't need apiKey from Figma anymore

    if (!Array.isArray(texts) || !Array.isArray(targetLanguages) || texts.length === 0 || targetLanguages.length === 0) {
      console.error('Proxy: Invalid input:', req.body);
      res.status(400).json({ error: 'Invalid input: Missing texts or targetLanguages.' });
      return;
    }
    if (!OPENAI_KEY || OPENAI_KEY === "YOUR_OPENAI_API_KEY_HERE") {
         console.error('Proxy: OpenAI API Key not configured on server!');
         res.status(500).json({ error: 'OpenAI API Key not configured.' });
         return;
    }

    // --- Call OpenAI API ---
    // We need to call OpenAI multiple times, once per language, per text (or batch carefully)
    // Let's keep it simple: one call per language, translating all texts for that language
    const openAIResults = {};

    for (const lang of targetLanguages) {
        console.log(`Proxy: Requesting OpenAI translation to ${lang}...`);
        // Construct a prompt for OpenAI
        // Example: Asking it to translate each text item individually
        // Adjust the model (gpt-3.5-turbo, gpt-4, etc.) as needed
        const prompts = texts.map(text => `Translate the following English text to ${lang}: "${text}"`);
        // A more advanced prompt might ask for JSON output, but let's parse simple text first.

        try {
            // We might need multiple calls if the prompt gets too long,
            // but let's try sending all texts in one go via a structured prompt
            // if the model supports it well, or call one by one.
            // Calling one by one is simpler to parse but slower/more expensive.

            // Let's try one text at a time for simplicity:
            const translationsForLang = [];
            for (const text of texts) {
                 const prompt = `Translate the following English text to ${lang} WITHOUT any introductory text or quotes, just the translation: "${text}"`;
                 console.log(`Proxy: Calling OpenAI for text: "${text}" to ${lang}`);
                 const openAIResponse = await fetch(OPENAI_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${OPENAI_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: "gpt-3.5-turbo-instruct", // Or gpt-3.5-turbo, gpt-4 etc. Check compatibility
                        prompt: prompt,
                        max_tokens: 150, // Adjust as needed
                        temperature: 0.3 // Lower temp for more direct translation
                    }),
                });

                const responseData = await openAIResponse.json();

                if (!openAIResponse.ok) {
                    console.error(`Proxy: OpenAI API Error for text "${text}" to ${lang} (Status: ${openAIResponse.status}):`, responseData);
                    translationsForLang.push(`[OpenAI API Err: ${responseData?.error?.message || openAIResponse.statusText}]`);
                } else {
                    const translation = responseData.choices?.[0]?.text?.trim() || '[No OpenAI Translation]';
                    console.log(`Proxy: OpenAI translation for "${text}" to ${lang}: "${translation}"`);
                    translationsForLang.push(translation);
                }
            } // End loop through texts for one language
             openAIResults[lang] = translationsForLang;


        } catch (error) {
            console.error(`Proxy: Network error calling OpenAI for ${lang}:`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Mark all texts for this lang as error if the whole loop fails
            openAIResults[lang] = texts.map(() => `[Proxy Network Err: ${errorMessage.substring(0,50)}]`);
        }
    } // End language loop

    // --- Send results back to Figma plugin ---
    console.log('Proxy: Sending OpenAI results back to Figma plugin.');
    res.status(200).json(openAIResults);

  } catch (error) { // Catch errors in request processing itself
     console.error('Proxy: Internal Server Error:', error);
     res.status(500).json({ error: error.message || 'Internal server error' });
  }
};