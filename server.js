const express = require('express');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3002;

// Configurar transporter de Gmail (usando variables de entorno)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'cristiansan@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD || 'yksu gokd gjoh lggh'
  }
});

app.use(cors({
  origin: true, // Permitir todos los orígenes
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Manejar preflight OPTIONS
app.options('*', cors());
app.use(express.json());

// Servir archivos estáticos
app.use(express.static('.'));

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

// Endpoint para enviar email de bienvenida
app.post('/api/send-welcome-email', async (req, res) => {
  try {
    const { email, nombre, rol, clienteNombre } = req.body;

    // Determinar emoji según rol
    let rolEmoji = '👤';
    let rolTexto = 'Cliente';
    if (rol === 'vendedor') {
      rolEmoji = '🤝';
      rolTexto = 'Vendedor';
    } else if (rol === 'admin') {
      rolEmoji = '👑';
      rolTexto = 'Administrador';
    } else if (rol === 'cliente') {
      rolEmoji = '👤';
      rolTexto = 'Cliente';
    }

    const marketplaceUrl = 'https://carrito-api-proxy-1hanoyxmn-cristiansans-projects.vercel.app/marketplace.html';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">

          <!-- Header con fondo oscuro -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">
                🎉 South Traders
              </h1>
              <p style="color: #b0b0b0; margin: 10px 0 0 0; font-size: 16px;">
                Marketplace de Productos
              </p>
            </td>
          </tr>

          <!-- Contenido principal -->
          <tr>
            <td style="padding: 40px 30px;">

              <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px;">
                ¡Bienvenido, ${nombre}!
              </h2>

              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Nos complace informarte que tu cuenta ha sido <strong style="color: #4CAF50;">aprobada exitosamente</strong> y ya puedes acceder a nuestro marketplace.
              </p>

              <!-- Información de la cuenta -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <tr>
                  <td>
                    <p style="margin: 0 0 12px 0; color: #6c757d; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      Detalles de tu cuenta
                    </p>
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #6c757d; font-size: 14px; width: 40%;">Email:</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 600;">${email}</td>
                      </tr>
                      <tr>
                        <td style="color: #6c757d; font-size: 14px;">Rol asignado:</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 600;">${rolEmoji} ${rolTexto}</td>
                      </tr>
                      <tr>
                        <td style="color: #6c757d; font-size: 14px;">Cliente asociado:</td>
                        <td style="color: #1a1a1a; font-size: 14px; font-weight: 600;">${clienteNombre}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 25px 0;">
                Ya puedes iniciar sesión y comenzar a explorar nuestro catálogo de productos.
              </p>

              <!-- Botón CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${marketplaceUrl}" style="display: inline-block; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);">
                      🛒 Acceder al Marketplace
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #6c757d; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0; padding-top: 25px; border-top: 1px solid #e9ecef;">
                Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 25px 30px; text-align: center;">
              <p style="color: #6c757d; font-size: 13px; margin: 0; line-height: 1.5;">
                © 2025 South Traders. Todos los derechos reservados.<br>
                Este es un email automático, por favor no respondas a este mensaje.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const mailOptions = {
      from: '"South Traders" <cristiansan@gmail.com>',
      to: email,
      subject: '✅ Bienvenido a South Traders - Tu cuenta ha sido aprobada',
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de bienvenida enviado a: ${email}`);
    res.json({ ok: true, message: 'Email enviado exitosamente' });

  } catch (error) {
    console.error('❌ Error enviando email:', error);
    res.status(500).json({ ok: false, message: 'Error al enviar email: ' + error.message });
  }
});

// Endpoint para el chatbot con IA
app.post('/api/chat', async (req, res) => {
  try {
    const { userQuery, products, intent } = req.body;

    console.log(`🤖 [CHATBOT] Nueva consulta: "${userQuery}"`);
    console.log(`📦 [CHATBOT] Productos encontrados: ${products.length}`);
    console.log(`🎯 [CHATBOT] Intención: ${intent}`);

    // Validar datos recibidos
    if (!userQuery || !products) {
      return res.status(400).json({
        ok: false,
        message: 'Faltan parámetros requeridos'
      });
    }

    // Construir contexto para Claude
    let productContext = '';
    if (products.length > 0) {
      productContext = 'Productos encontrados:\n';
      products.forEach((p, index) => {
        productContext += `${index + 1}. ${p.articulo || 'Sin código'}: ${p.descripcion || 'Sin descripción'} - Precio: $${p.precio || 'Consultar'} - Stock: ${p.stock || 0} unidades\n`;
      });
    } else {
      productContext = 'No se encontraron productos que coincidan con la búsqueda.';
    }

    // Prompt para Claude optimizado para ser útil y conciso
    const systemPrompt = `Eres un asistente virtual de ventas para South Traders, una tienda de productos electrónicos.

Tu objetivo es ayudar al cliente a encontrar productos y tomar decisiones de compra de manera amigable y profesional.

Reglas importantes:
- Sé conciso y directo (máximo 2-3 oraciones)
- Si hay productos disponibles, recomienda máximo 2 productos
- Menciona el precio y stock si es relevante
- Si no hay productos, sugiere reformular la búsqueda
- Usa un tono amigable pero profesional
- NO inventes información que no esté en los datos proporcionados
- Si un producto no tiene stock, menciónalo

Contexto de la consulta:
Pregunta del usuario: "${userQuery}"
Intención detectada: ${intent}

${productContext}`;

    // Llamar a la API de Claude usando Anthropic SDK
    // NOTA: Si no tienes instalado @anthropic-ai/sdk, usa fetch directo
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || 'tu-api-key-aqui',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Modelo más económico
        max_tokens: 300, // Límite de tokens para respuestas cortas
        messages: [{
          role: 'user',
          content: systemPrompt
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [CHATBOT] Error de Claude API:', errorText);
      throw new Error('Error en la API de Claude');
    }

    const data = await response.json();
    const botResponse = data.content[0].text;

    console.log(`✅ [CHATBOT] Respuesta generada: "${botResponse.substring(0, 100)}..."`);

    res.json({
      ok: true,
      response: botResponse,
      productsCount: products.length,
      intent: intent
    });

  } catch (error) {
    console.error('❌ [CHATBOT] Error:', error);

    // Respuesta de fallback sin IA
    let fallbackResponse = 'Encontré algunos productos que podrían interesarte. ';

    if (req.body.products && req.body.products.length > 0) {
      const firstProduct = req.body.products[0];
      fallbackResponse += `Te recomiendo el ${firstProduct.articulo || 'producto'} por $${firstProduct.precio || 'consultar precio'}.`;
    } else {
      fallbackResponse = 'No encontré productos con esos criterios. ¿Podrías intentar con otras palabras clave?';
    }

    res.json({
      ok: true,
      response: fallbackResponse,
      productsCount: req.body.products ? req.body.products.length : 0,
      fallback: true
    });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Proxy escuchando en http://localhost:${PORT}`);
});


