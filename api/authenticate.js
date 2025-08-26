const axios = require('axios');

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://cristiansan.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  // Manejar preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const url = 'https://southtraders.oppen.io/report/authenticate';
    const response = await axios.post(url, req.body, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ ok: false, message: 'Proxy error (authenticate)' });
    }
  }
};
