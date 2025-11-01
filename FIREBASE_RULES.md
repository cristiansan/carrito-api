# Firebase Rules para Chatbot

## Instrucciones

Para que el sistema de chatbot funcione correctamente, necesitas actualizar las reglas de Firestore en Firebase Console.

## Pasos para actualizar las reglas:

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **carrito-138c3**
3. Ve a **Firestore Database** en el menú lateral
4. Haz clic en la pestaña **Rules** (Reglas)
5. Agrega las siguientes reglas a la colección `chatbot_interactions`

## Reglas a agregar:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ... tus reglas existentes ...

    // NUEVAS REGLAS PARA CHATBOT
    match /chatbot_interactions/{interactionId} {
      // Permitir escritura a cualquier usuario autenticado
      // (necesario para que los usuarios puedan hacer preguntas)
      allow create: if request.auth != null;

      // Permitir lectura solo a usuarios autorizados
      // (solo admins pueden exportar todas las preguntas)
      allow read: if request.auth != null &&
        (request.auth.token.email == 'santifn@gmail.com' ||
         request.auth.token.email == 'cristiansan@gmail.com');

      // No permitir actualizaciones ni eliminaciones
      allow update, delete: if false;
    }
  }
}
```

## Explicación de las reglas:

- **create**: Cualquier usuario autenticado puede crear interacciones (hacer preguntas)
- **read**: Solo santifn@gmail.com y cristiansan@gmail.com pueden leer todas las interacciones
- **update/delete**: Nadie puede modificar o eliminar interacciones (para mantener integridad de datos)

## Verificación:

Después de actualizar las reglas, prueba:
1. Hacer una pregunta en el chatbot (debería funcionar)
2. Hacer clic en el botón de exportar (debería descargar Excel)

Si ves errores de permisos, verifica que:
- Las reglas se guardaron correctamente
- El usuario está autenticado
- El email del usuario coincide exactamente con los permitidos
