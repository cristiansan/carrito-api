# Reporte de Stock - Öppen

## Descripción

He creado una interfaz web para consultar y visualizar el stock de productos desde la API de Öppen. La aplicación incluye filtros por categorías (iPhone, MacBooks, Samsung), actualización automática cada 10 segundos y exportación a Excel.

## Características

- **4 Solapas de filtrado**: All, iPhone, MacBooks, Samsung
- **Actualización automática**: Cada 10 segundos (configurable)
- **Exportación a Excel**: Descarga de datos filtrados por solapa
- **Proxy CORS**: Servidor proxy en Vercel para evitar problemas de CORS
- **Autenticación automática**: Manejo de tokens JWT con Öppen
- **Interfaz responsive**: Diseño moderno con tema oscuro

## Tecnologías utilizadas

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Proxy**: Node.js + Express + Axios
- **Despliegue**: Vercel (proxy) + GitHub Pages (frontend)
- **Librerías**: SheetJS para exportación a Excel

## Configuración

### Credenciales de API
- **Usuario**:
- **Contraseña MD5**: 
- **Endpoint base**: 

### Proxy local (desarrollo)
```bash
npm install
npm start
```

### Proxy en Vercel (producción)
```bash
vercel --prod
```

## Uso

1. **Abrir index.html** en cualquier navegador moderno
2. **Seleccionar solapa** para filtrar productos por categoría
3. **Configurar auto-refresh** con el toggle (10 segundos por defecto)
4. **Exportar a Excel** con el botón correspondiente
5. **Refrescar manualmente** cuando sea necesario

## Estructura del proyecto

```
carrito-api/
├── index.html          # Pagina de bienvenida con login
├── login.html          # Pagina de login, registro y recuperacion de contraseña
├── marketplace.html    # Pagina principal con el listado de productos
├── order.html          # Pagina de resumen de pedido
├── main.js             # Lógica de frontend
├── server.js           # Proxy local (desarrollo)
├── package.json        # Dependencias Node.js
├── vercel.json         # Configuración de Vercel
└── README.md           # Este archivo
```

## Campos de stock mapeados

La aplicación detecta automáticamente los siguientes campos de la API de Öppen:
- **Item**: Código del producto
- **Descripción**: Nombre detallado del producto
- **Stock**: Cantidad en depósito
- **Transit**: Cantidad en tránsito

## Despliegue

### Frontend (GitHub Pages)
- Subir `index.html` y `main.js` a un repositorio
- Activar GitHub Pages en Settings > Pages
- El frontend funcionará desde `https://usuario.github.io/repo`

### Proxy (Vercel)
- El proxy ya está desplegado en Vercel
- URL: `https://carrito-api-proxy-ax0ytc195-cristiansans-projects.vercel.app`
- No requiere configuración adicional

## Notas técnicas

- **CORS**: Resuelto con proxy en Vercel
- **Autenticación**: Tokens JWT con expiración automática
- **Filtrado**: Regex case-insensitive por descripción de producto
- **Formato de números**: Soporte para separadores de miles (español/inglés)
- **Exportación**: Archivos Excel con nombre de solapa y fecha

## Solución de problemas

### Error de conexión
- Verificar que el proxy de Vercel esté funcionando
- Revisar credenciales de API en main.js

### Datos no se muestran
- Abrir consola del navegador para ver logs de depuración
- Verificar respuesta de la API en Network tab

### Exportación falla
- Confirmar que SheetJS esté cargado correctamente
- Verificar permisos de descarga del navegador

## Licencia

Proyecto personal para consulta de stock. No comercial.