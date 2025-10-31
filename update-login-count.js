/**
 * Script para actualizar loginCount de usuarios existentes
 * Establece loginCount = 1 para todos los usuarios que se han conectado al menos una vez
 *
 * NOTA: Este script requiere credenciales de Firebase Admin.
 * Para ejecutarlo desde el navegador, usa la función en Administration.html en su lugar.
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin
// Opción 1: Usar serviceAccountKey.json (si existe)
// const serviceAccount = require('./serviceAccountKey.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// Opción 2: Usar credenciales de entorno (recomendado para producción)
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'carrito-138c3'
});

const db = admin.firestore();

async function updateLoginCounts() {
  try {
    console.log('🔧 Iniciando actualización de loginCount...');

    // Obtener todos los usuarios
    const usersSnapshot = await db.collection('usuarios').get();
    console.log(`📊 Total de usuarios encontrados: ${usersSnapshot.size}`);

    let updatedCount = 0;
    let skippedCount = 0;

    // Procesar cada usuario
    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore permite máximo 500 operaciones por batch

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userRef = db.collection('usuarios').doc(doc.id);

      // Si el usuario tiene lastLogin (se ha conectado al menos una vez)
      // Y no tiene loginCount o es 0, establecer en 1
      if (userData.lastLogin && (!userData.loginCount || userData.loginCount === 0)) {
        batch.update(userRef, { loginCount: 1 });
        batchCount++;
        updatedCount++;

        console.log(`✅ Actualizado: ${userData.email || doc.id} - loginCount: 1`);

        // Si llegamos al límite del batch, ejecutarlo y crear uno nuevo
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`💾 Batch de ${batchCount} operaciones guardado`);
          batchCount = 0;
        }
      } else {
        skippedCount++;
        console.log(`⏭️  Omitido: ${userData.email || doc.id} - loginCount: ${userData.loginCount || 0}, lastLogin: ${userData.lastLogin ? 'Sí' : 'No'}`);
      }
    }

    // Ejecutar el último batch si tiene operaciones pendientes
    if (batchCount > 0) {
      await batch.commit();
      console.log(`💾 Último batch de ${batchCount} operaciones guardado`);
    }

    console.log('\n✅ Actualización completada:');
    console.log(`   - Usuarios actualizados: ${updatedCount}`);
    console.log(`   - Usuarios omitidos: ${skippedCount}`);
    console.log(`   - Total procesado: ${usersSnapshot.size}`);

  } catch (error) {
    console.error('❌ Error actualizando loginCount:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Ejecutar la actualización
updateLoginCounts();
