const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '3600'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers).end();
    return;
  }

  try {
    const { texts, targetLanguages } = req.body;
    
    if (!texts?.length || !targetLanguages?.length) {
      return res.status(400).json({ error: 'Invalid request' });
    }

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
          content: `Translate to ${targetLanguages.join(',')} using ||:\n${texts.join('\n')}`
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'API Error');

    const translations = {};
    const results = data.choices[0].message.content.split('\n');
    targetLanguages.forEach((lang, i) => {
      translations[lang] = results[i]?.split('||').map(t => t.trim()) || [];
    });

    res.writeHead(200, headers).json(translations);
    
  } catch (error) {
    res.writeHead(500, headers).json({ error: error.message });
  }
};