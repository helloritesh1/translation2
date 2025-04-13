const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { texts, targetLanguages } = req.body;
    
    // Validate input
    if (!Array.isArray(texts)) throw new Error('Invalid texts array');
    if (!Array.isArray(targetLanguages)) throw new Error('Invalid languages');

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
          content: `Translate these to ${targetLanguages.join(', ')}. Keep order using ||:\n${texts.join('\n')}`
        }]
      })
    });

    const data = await response.json();
    
    // Process response
    const translations = {};
    const result = data.choices[0].message.content.split('\n');
    
    targetLanguages.forEach((lang, i) => {
      translations[lang] = result[i].split('||').map(t => t.trim());
    });

    res.status(200).json(translations);

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};