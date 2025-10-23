# Actualización de Reglas de Firebase Storage

## Propósito
Permitir que las órdenes generen PDFs y los suban a Firebase Storage para compartir por WhatsApp.

## Paso 1: Ir a Firebase Console
1. Abre https://console.firebase.google.com/
2. Selecciona tu proyecto: **carrito-138c3**
3. En el menú lateral, haz clic en **Storage**
4. Si es la primera vez usando Storage, haz clic en **Comenzar** (Get Started)
5. Ve a la pestaña **Reglas** (Rules)

## Paso 2: Reemplazar las reglas
Copia y pega el contenido del archivo `storage.rules` de este repositorio en el editor de reglas de Storage.

O copia directamente estas reglas:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Orders PDF files
    match /orders/{fileName} {
      // Allow authenticated users to create/write order PDFs
      allow create, write: if request.auth != null;

      // Allow anyone to read order PDFs (via URL)
      allow read: if true;
    }

    // Default: deny all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## Paso 3: Publicar las reglas
1. Haz clic en el botón **Publicar** (Publish) en la parte superior
2. Confirma la publicación

## Paso 4: Verificar
Las reglas deberían aplicarse inmediatamente. Prueba crear una orden nueva desde cart.html para confirmar que:
- El PDF se genera correctamente
- Se sube a Firebase Storage
- El enlace se envía por WhatsApp

## Estructura de archivos en Storage

Los PDFs se guardarán en:
```
orders/
  ├── orden-10001-1729699200000.pdf
  ├── orden-10002-1729699300000.pdf
  └── orden-10003-1729699400000.pdf
```

## Seguridad

- ✅ Solo usuarios autenticados pueden crear/subir PDFs
- ✅ Cualquier persona con el enlace puede descargar el PDF (necesario para WhatsApp)
- ✅ Los archivos están organizados en la carpeta `orders/`
- ✅ Los nombres incluyen timestamp para evitar colisiones

## Notas importantes
- Las reglas se aplican inmediatamente después de publicar
- No es necesario reiniciar el servidor ni redesplegar la aplicación
- Los PDFs permanecen en Storage indefinidamente (puedes configurar limpieza automática después si lo deseas)
