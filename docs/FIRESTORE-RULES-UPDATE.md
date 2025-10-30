# Actualización de Reglas de Firestore

## Problema
Error al crear órdenes nuevas:
```
POST https://firestore.googleapis.com/v1/projects/carrito-138c3/databases/(default)/documents:batchGet 403 (Forbidden)
FirebaseError: Missing or insufficient permissions.
```

Esto ocurre porque las reglas de Firestore no permiten acceso a la colección `counters/orderNumber`.

## Solución

### Paso 1: Ir a Firebase Console
1. Abre https://console.firebase.google.com/
2. Selecciona tu proyecto: **carrito-138c3**
3. En el menú lateral, haz clic en **Firestore Database**
4. Ve a la pestaña **Reglas** (Rules)

### Paso 2: Reemplazar las reglas
Copia y pega el contenido del archivo `firestore.rules` de este repositorio en el editor de reglas de Firebase Console.

O copia directamente estas reglas:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function to check if user is admin
    function isAdmin() {
      return request.auth != null &&
             get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.admin == true;
    }

    // Helper function to check if user is authenticated and approved
    function isApprovedUser() {
      return request.auth != null &&
             exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.approved == true;
    }

    // Helper function to check if user is vendedor
    function isVendedor() {
      return request.auth != null &&
             get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.role == 'vendedor';
    }

    // Counters collection - for order numbers
    match /counters/{counterId} {
      // Allow authenticated users to read and write counters
      allow read, write: if request.auth != null;
    }

    // Usuarios collection
    match /usuarios/{userId} {
      // Anyone authenticated can create their own user document during registration
      allow create: if request.auth != null && request.auth.uid == userId;

      // Users can read their own profile, admins can read all
      allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());

      // Users can update their own profile (name, address, phone), admins can update any profile
      allow update: if (request.auth != null && request.auth.uid == userId) || isAdmin();

      // Only admins can delete
      allow delete: if isAdmin();
    }

    // Clientes collection
    match /clientes/{clienteId} {
      // Approved users can read, only admins can write
      allow read: if isApprovedUser() || isAdmin();
      allow write: if isAdmin();
    }

    // Vendedores collection
    match /vendedores/{vendedorId} {
      // Approved users can read, only admins can write
      allow read: if isApprovedUser() || isAdmin();
      allow write: if isAdmin();
    }

    // Precios collection
    match /precios/{precioId} {
      // Approved users can read prices, only admins can write
      allow read: if isApprovedUser() || isAdmin();
      allow write: if isAdmin();
    }

    // Pedidos (orders) collection
    match /pedidos/{pedidoId} {
      // Authenticated approved users can create orders
      allow create: if isApprovedUser() || isAdmin();

      // Users can read their own orders, admins can read all
      allow read: if request.auth != null &&
                     (resource.data.userId == request.auth.uid || isAdmin());

      // Users can update their own orders, admins can update any order
      allow update: if request.auth != null &&
                       (resource.data.userId == request.auth.uid || isAdmin());

      // Only admins can delete orders
      allow delete: if isAdmin();
    }
  }
}
```

### Paso 3: Publicar las reglas
1. Haz clic en el botón **Publicar** (Publish) en la parte superior
2. Confirma la publicación

### Paso 4: Verificar
Las reglas deberían aplicarse inmediatamente. Prueba crear una orden nueva desde cart.html para confirmar que el error desapareció.

## Cambios clave en las reglas

### Nueva sección: Counters
```javascript
match /counters/{counterId} {
  allow read, write: if request.auth != null;
}
```
Esto permite que cualquier usuario autenticado pueda leer y escribir en la colección `counters`, que es necesaria para generar números de orden secuenciales.

### Usuarios - Auto-edición
Los usuarios ahora pueden editar su propio perfil (nombre, dirección, teléfono) además de los admins.

### Pedidos - Mejor control
Los usuarios pueden:
- Crear sus propias órdenes
- Leer sus propias órdenes
- Editar sus propias órdenes
- Los admins pueden hacer todo

## Notas importantes
- Las reglas se aplican inmediatamente después de publicar
- No es necesario reiniciar el servidor ni redesplegar la aplicación
- Si tienes problemas, verifica que el usuario esté autenticado y aprobado (approved: true)
