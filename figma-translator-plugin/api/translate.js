const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { texts, targetLanguages } = req.body;
    
    // Validate input
    if (!Array.isArray(texts) || !Array.isArray(targetLanguages)) {
      return res.status(400).json({ error: 'Invalid request format' });
    }

    // OpenAI API Call
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "user",
          content: `Translate these texts to ${targetLanguages.join(', ')}. Keep order and use || separators:\n${texts.join('\n')}`
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI API Error');

    // Process translations
    const resultText = data.choices[0].message.content;
    const translations = {};
    targetLanguages.forEach((lang, i) => {
      translations[lang] = resultText.split('\n')[i].split('||').map(t => t.trim());
    });

    res.status(200).json(translations);
    
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: error.message });
  }
};