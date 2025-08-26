const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const API_BASE = 'https://southtraders.oppen.io/report';

app.post('/api/authenticate', async (req, res) => {
  try {
    const url = `${API_BASE}/authenticate`;
    const resp = await axios.post(url, req.body, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.status(resp.status).json(resp.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(500).json({ ok: false, message: 'Proxy error (authenticate)' });
    }
  }
});

app.get('/api/stock', async (req, res) => {
  try {
    const url = `${API_BASE}/StockList`;
    const resp = await axios.get(url, {
      params: req.query,
      headers: {
        Authorization: req.header('Authorization') || ''
      }
    });
    res.status(resp.status).json(resp.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).send(error.response.data);
    } else {
      res.status(500).json({ ok: false, message: 'Proxy error (stock)' });
    }
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Proxy escuchando en http://localhost:${PORT}`);
});


