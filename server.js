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

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Proxy escuchando en http://localhost:${PORT}`);
});


