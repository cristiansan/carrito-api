# 🔐 Configuración de Permisos Admin

## 📋 Resumen
El hamburger menu con configuraciones ahora solo es visible para usuarios con permisos de **administrador** usando documentos en **Firestore**.

## 🚀 Configuración Manual desde Firebase Console

### 1. Ir a Firebase Console
1. Abrir [Firebase Console](https://console.firebase.google.com)
2. Seleccionar tu proyecto

### 2. Ir a Firestore Database
1. En el menú lateral: **Firestore Database**
2. Navegar a la colección **`usuarios`**
3. Buscar el documento del usuario (por UID o email)

### 3. Editar Campo Admin
1. Hacer click en el documento del usuario
2. Encontrar el campo **`admin`** (debería estar en `false`)
3. Hacer click en **"Edit field"** 
4. Cambiar el valor a `true`
5. Hacer click en **"Update"**

### 4. ¡Listo!
- **No necesita cerrar sesión** - cambio es instantáneo
- El hamburger menu aparecerá automáticamente al recargar la página

## 📱 Cómo Funciona

### Frontend (marketplace.html & login.html)
- ✅ Crea documento en colección `usuarios` automáticamente al registrarse/loguearse
- ✅ Verifica campo `admin: true` en Firestore
- ✅ Muestra/oculta hamburger menu automáticamente
- ✅ Log detallado en consola para debugging

## 🎯 Estados del Usuario

| Tipo Usuario | Campo Admin | Hamburger Menu |
|--------------|-------------|----------------|
| **Admin**    | `true`      | ✅ Visible     |
| **Regular**  | `false`     | ❌ Oculto      |
| **No Auth**  | `null`      | ❌ Oculto      |

## 🔧 Testing

### Verificar en Console del Browser:
```javascript
// Ver documento del usuario actual en Firestore
const user = firebase.auth().currentUser;
firebase.firestore().collection('usuarios').doc(user.uid).get()
  .then(doc => console.log('User data:', doc.data()));
```

### Debug en marketplace.html:
```javascript
// Los logs aparecen automáticamente en consola:
// "Admin status checked: {userId, email, isAdmin, userData}"
// "New user document created: [uid] [email]"
// "User document updated: [uid] [email]"
// "Hamburger menu shown/hidden for admin/regular user"
```

## ⚠️ Importante

1. **Automático**: Los usuarios se crean automáticamente en Firestore al registrarse/loguearse
2. **Instantáneo**: Cambios de admin son inmediatos (solo recargar página)
3. **Sin cache**: Los datos se leen directamente desde Firestore

## 🚨 Troubleshooting

### Menu no aparece para admin:
```javascript
// En consola del browser:
const user = firebase.auth().currentUser;
firebase.firestore().collection('usuarios').doc(user.uid).get()
  .then(doc => {
    console.log('User admin status:', doc.data().admin);
    if (doc.data().admin === true) {
      window.location.reload(); // Recargar página
    }
  });
```

### Error "Firebase no disponible":
- Verificar que Firebase SDK esté cargado antes que marketplace.html
- Verificar conexión a internet
- Verificar configuración de Firebase en main.js

### Colección "usuarios" no existe:
- Se creará automáticamente cuando el primer usuario se registre/loguee
- Los documentos tendrán la estructura: `{email, displayName, photoURL, admin, createdAt, lastLogin, provider}`

## 👥 Configuración de Múltiples Admins

Para configurar varios usuarios como admin:
1. Repetir los pasos 2-4 para cada usuario
2. En cada documento cambiar `admin: false` → `admin: true`
3. Los cambios son instantáneos (solo necesitan recargar la página)

## 📊 Estructura del Documento Usuario

```javascript
{
  admin: false,                    // Campo a editar para dar permisos
  createdAt: timestamp,           // Fecha de creación automática
  displayName: "Usuario Ejemplo", // Nombre del usuario
  email: "user@example.com",      // Email del usuario
  lastLogin: timestamp,           // Última vez que se autenticó
  photoURL: "https://...",        // Foto de perfil (Google)
  provider: "google.com"          // Proveedor (google.com, password)
}
```

---

✅ **¡Listo!** Los usuarios se crean automáticamente en Firestore y solo necesitas cambiar `admin: true` en la consola para dar permisos.