const admin = require('firebase-admin');

// Inicializar Firebase Admin con las credenciales de las variables de entorno o configuración por defecto
// Si no tienes el archivo de credenciales, puedes usar la configuración de cliente
// Para este script, vamos a crear una página HTML que ejecute esto desde el navegador

console.log('❌ Este script requiere credenciales de Firebase Admin SDK');
console.log('💡 En su lugar, vamos a crear una función en Administration.html para hacer esto desde el navegador');
process.exit(1);

async function fixDuplicateOrders() {
  try {
    console.log('🔍 Buscando órdenes duplicadas con número 10001...');

    // Buscar todas las órdenes con numeroOrden = 10001
    const ordersRef = db.collection('pedidos');
    const querySnapshot = await ordersRef.where('numeroOrden', '==', 10001).get();

    console.log(`📦 Encontradas ${querySnapshot.size} órdenes con número 10001`);

    if (querySnapshot.size <= 1) {
      console.log('✅ No hay duplicados para corregir');
      return;
    }

    const orders = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        numeroOrden: data.numeroOrden,
        fecha: data.fecha,
        fechaLocal: data.fechaLocal,
        clienteNombre: data.clienteNombre,
        usuarioEmail: data.usuarioEmail,
        total: data.total,
        cantidadItems: data.cantidadItems,
        logisticsState: data.logisticsState,
        timestamp: data.timestamp
      });
    });

    // Mostrar información de las órdenes
    console.log('\n📋 Órdenes duplicadas:');
    orders.forEach((order, index) => {
      console.log(`\n${index + 1}. ID: ${order.id}`);
      console.log(`   Fecha: ${order.fechaLocal || order.fecha}`);
      console.log(`   Cliente: ${order.clienteNombre || order.usuarioEmail}`);
      console.log(`   Estado: ${order.logisticsState}`);
      console.log(`   Items: ${order.cantidadItems}`);
      console.log(`   Total: $${order.total}`);
    });

    // Buscar el último número de orden en la BD
    const allOrdersSnapshot = await ordersRef.orderBy('numeroOrden', 'desc').limit(1).get();
    let maxOrderNumber = 10000;

    if (!allOrdersSnapshot.empty) {
      maxOrderNumber = allOrdersSnapshot.docs[0].data().numeroOrden || 10000;
    }

    console.log(`\n🔢 Último número de orden en la BD: ${maxOrderNumber}`);

    // Ordenar las órdenes por timestamp (la más antigua primero)
    orders.sort((a, b) => {
      const timeA = a.timestamp?.toMillis() || 0;
      const timeB = b.timestamp?.toMillis() || 0;
      return timeA - timeB;
    });

    // Cambiar el número de la orden más reciente (la segunda)
    const orderToChange = orders[1];
    const newOrderNumber = maxOrderNumber + 1;

    console.log(`\n🔄 Cambiando orden ${orderToChange.id}`);
    console.log(`   De número: 10001 → ${newOrderNumber}`);

    // Actualizar la orden
    await ordersRef.doc(orderToChange.id).update({
      numeroOrden: newOrderNumber
    });

    console.log(`✅ Orden actualizada exitosamente`);
    console.log(`\n📊 Resumen:`);
    console.log(`   - Orden ${orders[0].id} mantiene número 10001`);
    console.log(`   - Orden ${orderToChange.id} ahora es número ${newOrderNumber}`);

    // Actualizar el contador para futuras órdenes
    const counterRef = db.collection('counters').doc('orderNumber');
    await counterRef.set({ value: newOrderNumber });
    console.log(`✅ Contador actualizado a ${newOrderNumber}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

fixDuplicateOrders();
