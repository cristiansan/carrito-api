# Configurar CORS en Firebase Storage

## Problema
Error: `Access to XMLHttpRequest ... has been blocked by CORS policy`

Esto ocurre porque Firebase Storage no permite peticiones desde dominios web por defecto.

## Solución: Configurar CORS con Google Cloud SDK

### Paso 1: Instalar Google Cloud SDK

1. Descarga desde: https://cloud.google.com/sdk/docs/install
2. Ejecuta el instalador (GoogleCloudSDKInstaller.exe)
3. Sigue las instrucciones del instalador
4. **IMPORTANTE**: Marca la casilla "Run 'gcloud init'" al finalizar
5. Cierra y abre una nueva terminal/cmd después de instalar

### Paso 2: Inicializar y autenticar

Abre una **nueva** ventana de CMD o PowerShell y ejecuta:

```bash
gcloud init
```

Sigue los pasos:
1. Elige "Re-initialize this configuration"
2. Selecciona tu cuenta de Google (la misma de Firebase)
3. Selecciona el proyecto: **carrito-138c3**

### Paso 3: Aplicar configuración CORS

En la misma terminal, ve a la carpeta del proyecto:

```bash
cd C:\git\carrito-api
```

Aplica el archivo cors.json:

```bash
gcloud storage buckets update gs://carrito-138c3.appspot.com --cors-file=cors.json
```

O si tienes una versión antigua de gcloud:

```bash
gsutil cors set cors.json gs://carrito-138c3.appspot.com
```

### Paso 4: Verificar configuración

```bash
gcloud storage buckets describe gs://carrito-138c3.appspot.com --format="json(cors_config)"
```

O con gsutil:

```bash
gsutil cors get gs://carrito-138c3.appspot.com
```

Deberías ver la configuración CORS aplicada.

### Paso 5: Probar

1. Recarga la página web
2. Crea una orden nueva
3. El PDF debería subirse sin errores de CORS

## Archivo cors.json

El archivo `cors.json` en este repositorio contiene:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type"]
  }
]
```

Esto permite:
- ✅ Cualquier origen (`"*"`) - puedes restringirlo después
- ✅ Todos los métodos HTTP necesarios
- ✅ Cache de 1 hora
- ✅ Headers necesarios para Firebase

## Restringir orígenes (opcional, después de probar)

Para mayor seguridad, cambia `cors.json` a:

```json
[
  {
    "origin": [
      "https://stock.south-traders.com",
      "http://localhost:3002",
      "https://carrito-api-proxy-r0wv02gdp-cristiansans-projects.vercel.app"
    ],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type"]
  }
]
```

Y vuelve a ejecutar el comando del Paso 3.

## Troubleshooting

### Error: "gcloud: command not found"
- Cierra y abre una **nueva** terminal
- Verifica la instalación: `gcloud --version`

### Error: "You do not currently have an active account selected"
- Ejecuta: `gcloud auth login`
- Sigue el proceso de autenticación

### Error: "Permission denied"
- Verifica que tienes permisos de propietario/editor en el proyecto Firebase
- Ve a Firebase Console → Configuración → Usuarios y permisos

### Error: "Invalid bucket name"
- Verifica el nombre exacto del bucket en Firebase Console → Storage
- Debería ser: `carrito-138c3.appspot.com`

## Alternativa: Cloud Console Web

Si prefieres no instalar SDK:

1. Ve a https://console.cloud.google.com/storage/browser
2. Busca el bucket `carrito-138c3.appspot.com`
3. Click en **Permissions** (Permisos)
4. Busca la sección **CORS**
5. Click en **Edit CORS configuration**
6. Pega el contenido de `cors.json`
7. Guarda

**Nota**: Esta opción web no siempre está disponible dependiendo de tu configuración de proyecto.
