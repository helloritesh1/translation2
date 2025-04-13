// api/translate.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // CORS Setup
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { texts, targetLanguages } = req.body;
        
        if (!Array.isArray(texts) || !Array.isArray(targetLanguages)) {
            return res.status(400).json({ error: 'Invalid request format' });
        }

        const translations = {};
        
        // Single API call for all languages
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [{
                    role: "user",
                    content: `Translate these texts to ${targetLanguages.join(', ')}. Keep same order and format. Use || separator:\n${texts.join('\n')}`
                }]
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'OpenAI API Error');

        // Parse translations from OpenAI response
        const resultText = data.choices[0].message.content;
        targetLanguages.forEach((lang, index) => {
            translations[lang] = resultText
                .split('\n')
                [index].split('||')
                .map(t => t.trim());
        });

        res.status(200).json(translations);
        
    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ error: error.message });
    }
};