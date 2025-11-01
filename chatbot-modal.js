/**
 * CHATBOT-MODAL.JS - Versión adaptada para modal
 * Integra el sistema completo de chatbot.js pero con IDs del modal
 */

// ==================== FIREBASE CONFIGURATION ====================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, serverTimestamp, query, orderBy, limit as firestoreLimit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCXjSGtVGfQas_cEyjmI0RTaeEl94jdp6g",
  authDomain: "carrito-138c3.firebaseapp.com",
  projectId: "carrito-138c3",
  storageBucket: "carrito-138c3.firebasestorage.app",
  messagingSenderId: "1002158386608",
  appId: "1:1002158386608:web:5f4f9a3e876a0f44dfe7a4"
};

// Reutilizar la app de Firebase que ya existe
let app, auth, db;

try {
  // Intentar obtener la app existente
  app = initializeApp(firebaseConfig);
} catch (error) {
  // Si ya existe, obtenerla
  const { getApps } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
  const apps = getApps();
  app = apps[0]; // Usar la primera app (la principal)
}

auth = getAuth(app);
db = getFirestore(app);

// ==================== INICIALIZACIÓN ====================
console.log('🤖 Inicializando Chatbot Modal...');

// Verificar autenticación actual
const currentUser = auth.currentUser;

if (currentUser) {
  console.log('✅ Usuario ya autenticado:', currentUser.email);
  initChatbotModal();
} else {
  // Esperar a que se autentique
  console.log('⏳ Esperando autenticación...');
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log('✅ Usuario autenticado:', user.email);
      unsubscribe(); // Desuscribirse para evitar múltiples llamadas
      initChatbotModal();
    } else {
      console.log('⚠️ Usuario no autenticado');
      const messagesDiv = document.getElementById('chatbotMessages');
      if (messagesDiv) {
        messagesDiv.innerHTML = `
          <div class="message bot">
            <div class="message-avatar"><span class="material-icons">lock</span></div>
            <div class="message-content">
              Debes iniciar sesión para usar el asistente virtual.
            </div>
          </div>
        `;
      }
    }
  });
}

async function initChatbotModal() {
  console.log('🤖 Inicializando chatbot en modal...');

  // Los elementos del modal
  const messagesContainer = document.getElementById('chatbotMessages');
  const chatInput = document.getElementById('chatbotInput');
  const sendBtn = document.getElementById('chatbotSendBtn');
  const typingIndicator = document.getElementById('chatbotTyping');
  const welcomeMessage = document.getElementById('chatbotWelcome');

  if (!messagesContainer || !chatInput || !sendBtn) {
    console.error('❌ Elementos del modal no encontrados');
    return;
  }

  // Crear instancia del motor de búsqueda
  const searchEngine = {
    productsCache: null,
    lastFetch: null,
    CACHE_DURATION: 2 * 60 * 1000,

    async getAllProducts() {
      const now = Date.now();
      if (this.productsCache && this.lastFetch && (now - this.lastFetch < this.CACHE_DURATION)) {
        console.log('📦 Usando productos en cache');
        return this.productsCache;
      }

      console.log('📦 Obteniendo productos de Firebase...');
      const productsSnapshot = await getDocs(collection(db, 'precios'));
      const products = [];

      productsSnapshot.forEach(doc => {
        const data = doc.data();
        products.push({ id: doc.id, ...data });
      });

      this.productsCache = products;
      this.lastFetch = now;
      console.log(`✅ ${products.length} productos cargados`);
      return products;
    },

    async searchByText(searchText) {
      const allProducts = await this.getAllProducts();
      const searchLower = searchText.toLowerCase().trim();
      const keywords = searchLower.split(' ').filter(word => word.length > 2);

      return allProducts.filter(product => {
        const searchableText = `
          ${product.articulo || ''}
          ${product.description || product.descripcion || product.Descripcion || ''}
          ${product.categoria || product.Categoria || ''}
        `.toLowerCase();
        return keywords.some(keyword => searchableText.includes(keyword));
      });
    },

    async searchWithStock() {
      const allProducts = await this.getAllProducts();
      const results = allProducts.filter(product => {
        const stock = parseInt(product.stock || product.stockTeorico || product.Stock) || 0;
        return stock > 0;
      }).sort((a, b) => {
        const stockA = parseInt(a.stock || a.stockTeorico || a.Stock) || 0;
        const stockB = parseInt(b.stock || b.stockTeorico || b.Stock) || 0;
        return stockB - stockA;
      });
      return results.length > 0 ? results : allProducts.sort((a, b) => {
        const stockA = parseInt(a.stock || a.stockTeorico || a.Stock) || 0;
        const stockB = parseInt(b.stock || b.stockTeorico || b.Stock) || 0;
        return stockB - stockA;
      }).slice(0, 20);
    },

    async getCheapestProducts(limit = 15) {
      const allProducts = await this.getAllProducts();
      return allProducts
        .filter(p => (p.precio1 || p.precio || p.Precio) > 0)
        .sort((a, b) => {
          const precioA = a.precio1 || a.precio || a.Precio || 0;
          const precioB = b.precio1 || b.precio || b.Precio || 0;
          return precioA - precioB;
        })
        .slice(0, limit);
    },

    async searchCellphonesBestSellers(searchText) {
      const allProducts = await this.getAllProducts();
      const searchLower = searchText.toLowerCase();
      const keywords = searchLower === 'celulares' || searchLower === 'celular'
        ? ['iphone', 'samsung', 'galaxy', 'phone', 'móvil', 'smartphone', 'celular', 'xiaomi', 'motorola']
        : [searchLower];

      console.log(`🔍 Buscando celulares con keywords:`, keywords);

      const results = allProducts
        .filter(product => {
          const searchableText = `
            ${product.articulo || ''}
            ${product.description || product.descripcion || product.Descripcion || ''}
            ${product.categoria || product.Categoria || ''}
          `.toLowerCase();
          return keywords.some(keyword => searchableText.includes(keyword));
        })
        .sort((a, b) => {
          const stockA = parseInt(a.stock || a.stockTeorico || a.Stock) || 0;
          const stockB = parseInt(b.stock || b.stockTeorico || b.Stock) || 0;
          return stockB - stockA;
        });

      console.log(`📱 Resultados búsqueda celulares: ${results.length}`);
      if (results.length > 0) {
        console.log('Primeros 3 productos con TODOS los campos:', results.slice(0, 3).map(p => p));
        console.log('Campos extraídos:', results.slice(0, 3).map(p => ({
          articulo: p.articulo,
          desc: p.description || p.descripcion || p.Descripcion,
          stock: p.stock,
          stockTeorico: p.stockTeorico,
          Stock: p.Stock,
          precio1: p.precio1,
          precio: p.precio,
          Precio: p.Precio
        })));
      }

      return results;
    },

    async smartSearch(userQuery) {
      const queryLower = userQuery.toLowerCase();
      console.log(`🎯 SmartSearch: "${userQuery}"`);

      // Detectar intención: Stock disponible
      if (queryLower.includes('stock') || queryLower.includes('disponible')) {
        console.log('✅ Intención detectada: Stock');
        return { intent: 'stock', products: await this.searchWithStock() };
      }

      // Detectar intención: Productos baratos
      if (queryLower.includes('barato') || queryLower.includes('económico') || queryLower.includes('más baratos')) {
        console.log('✅ Intención detectada: Baratos');
        return { intent: 'cheap', products: await this.getCheapestProducts() };
      }

      // Detectar intención: Mejor relación precio/calidad o recomendaciones
      const isRecommendation =
        queryLower.includes('conviene') ||
        queryLower.includes('recomiend') ||
        queryLower.includes('recomendación') ||
        queryLower.includes('mejor') ||
        queryLower.includes('calidad') ||
        queryLower.includes('precio/calidad') ||
        queryLower.includes('precio calidad') ||
        queryLower.includes('bueno') ||
        queryLower.includes('vale la pena');

      console.log(`🤔 ¿Es recomendación? ${isRecommendation}`);
      console.log(`📱 ¿Incluye celular? ${queryLower.includes('celular')}`);

      // Si pregunta por celulares + recomendación
      if ((queryLower.includes('celular') || queryLower.includes('teléfono') || queryLower.includes('phone')) && isRecommendation) {
        console.log('✅ Intención: Recomendación de celular (precio/calidad)');
        const celulares = await this.searchCellphonesBestSellers('celular');
        console.log(`📱 Total celulares encontrados: ${celulares.length}`);

        // Filtrar celulares con stock y ordenar por mejor relación precio/stock
        const conStock = celulares.filter(p => {
          const stock = parseInt(p.stock || p.stockTeorico || p.Stock) || 0;
          const precio = p.precio1 || p.precio || p.Precio || 0;
          return stock > 0 && precio > 0;
        });
        console.log(`📦 Celulares con stock y precio: ${conStock.length}`);

        // Ordenar por score: (stock * 10 / precio) - más stock y menos precio = mejor score
        const sorted = conStock.sort((a, b) => {
          const stockA = parseInt(a.stock || a.stockTeorico || a.Stock) || 0;
          const stockB = parseInt(b.stock || b.stockTeorico || b.Stock) || 0;
          const precioA = a.precio1 || a.precio || a.Precio || 99999;
          const precioB = b.precio1 || b.precio || b.Precio || 99999;

          const scoreA = (stockA * 10) / precioA;
          const scoreB = (stockB * 10) / precioB;

          return scoreB - scoreA;
        });

        return {
          intent: 'recommendation',
          products: sorted.slice(0, 10),
          message: 'mejores celulares relación precio/calidad'
        };
      }

      // Si pregunta por iPhone o Samsung específico + recomendación
      if ((queryLower.includes('iphone') || queryLower.includes('samsung')) && isRecommendation) {
        const marca = queryLower.includes('iphone') ? 'iphone' : 'samsung';
        console.log(`✅ Intención: Recomendación de ${marca}`);
        const productos = await this.searchCellphonesBestSellers(marca);

        const conStock = productos.filter(p => {
          const stock = parseInt(p.stock || p.stockTeorico || p.Stock) || 0;
          const precio = p.precio1 || p.precio || p.Precio || 0;
          return stock > 0 && precio > 0;
        });

        return {
          intent: 'recommendation',
          products: conStock.slice(0, 10),
          message: `mejores ${marca} disponibles`
        };
      }

      // Recomendación general (sin categoría específica)
      if (isRecommendation) {
        console.log('✅ Intención: Recomendación general');
        const allProducts = await this.getAllProducts();
        const conStock = allProducts.filter(p => {
          const stock = parseInt(p.stock || p.stockTeorico || p.Stock) || 0;
          const precio = p.precio1 || p.precio || p.Precio || 0;
          return stock > 0 && precio > 0;
        });

        // Ordenar por mejor relación stock/precio
        const sorted = conStock.sort((a, b) => {
          const stockA = parseInt(a.stock || a.stockTeorico || a.Stock) || 0;
          const stockB = parseInt(b.stock || b.stockTeorico || b.Stock) || 0;
          const precioA = a.precio1 || a.precio || a.Precio || 99999;
          const precioB = b.precio1 || b.precio || b.Precio || 99999;

          const scoreA = (stockA * 10) / precioA;
          const scoreB = (stockB * 10) / precioB;

          return scoreB - scoreA;
        });

        return {
          intent: 'recommendation',
          products: sorted.slice(0, 10),
          message: 'productos recomendados'
        };
      }

      // Celulares más vendidos (sin recomendación)
      if (queryLower.includes('celular') || queryLower.includes('iphone') || queryLower.includes('samsung')) {
        return { intent: 'bestsellers', products: await this.searchCellphonesBestSellers(userQuery) };
      }

      // Búsqueda general por texto
      return { intent: 'general', products: await this.searchByText(userQuery) };
    }
  };

  // Event listeners
  sendBtn.addEventListener('click', () => sendMessage());

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Quick suggestions
  document.querySelectorAll('#chatbotSuggestions .suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const message = chip.getAttribute('data-message');
      chatInput.value = message;
      sendMessage();
    });
  });

  // Función para guardar interacción en Firebase
  async function saveChatInteraction(userQuestion, botResponse, intent, productsCount) {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log('⚠️ No hay usuario autenticado, no se guardará la interacción');
        return;
      }

      const interactionData = {
        userEmail: user.email,
        userName: user.displayName || user.email,
        question: userQuestion,
        response: botResponse,
        intent: intent || 'unknown',
        productsCount: productsCount || 0,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'chatbot_interactions'), interactionData);
      console.log('✅ Interacción guardada en Firebase');
    } catch (error) {
      console.error('❌ Error guardando interacción:', error);
    }
  }

  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    chatInput.value = '';
    sendBtn.disabled = true;

    if (welcomeMessage) {
      welcomeMessage.style.display = 'none';
    }

    addUserMessage(message);
    showTyping();

    try {
      // Buscar productos
      const searchResult = await searchEngine.smartSearch(message);

      hideTyping();

      let responseText = '';
      if (searchResult.products.length === 0) {
        responseText = 'No encontré productos que coincidan con tu búsqueda. ¿Podrías ser más específico?';
        addBotMessage(responseText, []);

        // Guardar interacción sin productos
        await saveChatInteraction(message, responseText, searchResult.intent, 0);
      } else {
        // Generar respuesta según intención
        if (searchResult.intent === 'stock') {
          responseText = `📦 Encontré ${searchResult.products.length} productos con stock disponible:`;
        } else if (searchResult.intent === 'cheap') {
          responseText = `💰 Estos son los productos más económicos:`;
        } else if (searchResult.intent === 'bestsellers') {
          responseText = `📱 Estos son los celulares más vendidos:`;
        } else if (searchResult.intent === 'recommendation') {
          responseText = `⭐ Aquí están los ${searchResult.message} con mejor relación precio/calidad:`;
        } else {
          responseText = `Encontré ${searchResult.products.length} productos:`;
        }

        const limitedProducts = searchResult.products.slice(0, 5);
        addBotMessage(responseText, limitedProducts);

        // Guardar interacción con productos
        await saveChatInteraction(message, responseText, searchResult.intent, searchResult.products.length);
      }
    } catch (error) {
      console.error('❌ Error:', error);
      hideTyping();
      addBotMessage('Lo siento, hubo un error al procesar tu consulta. Por favor intenta de nuevo.', []);
    } finally {
      sendBtn.disabled = false;
      chatInput.focus();
    }
  }

  function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
      <div class="message-content">
        ${escapeHtml(text)}
      </div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
  }

  function addBotMessage(text, products = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';

    let productsHTML = '';
    if (products && products.length > 0) {
      productsHTML = '<div style="margin-top: 10px;">';
      products.forEach(product => {
        const precio = product.precio1 || product.precio || product.Precio;
        const price = precio ? `$${Number(precio).toFixed(2)}` : 'Consultar';
        const stock = parseInt(product.stock || product.stockTeorico || product.Stock) || 0;
        const stockText = stock > 0 ? `Stock: ${stock}` : 'Sin stock';
        const description = product.description || product.descripcion || product.Descripcion || 'Sin descripción';

        productsHTML += `
          <div class="product-card" onclick="window.location.href='marketplace.html?search=${encodeURIComponent(product.articulo)}'">
            <div class="product-info">
              <h4>${escapeHtml(product.articulo || 'Sin código')}</h4>
              <p>${escapeHtml(description)}</p>
              <p style="color: ${stock > 0 ? '#4CAF50' : '#666'};">${stockText}</p>
              <div class="product-price">${price}</div>
            </div>
          </div>
        `;
      });
      productsHTML += '</div>';
    }

    messageDiv.innerHTML = `
      <div class="message-avatar">
        <span class="material-icons">smart_toy</span>
      </div>
      <div>
        <div class="message-content">
          ${escapeHtml(text)}
          ${productsHTML}
        </div>
      </div>
    `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
  }

  function showTyping() {
    if (typingIndicator) {
      typingIndicator.classList.add('active');
      scrollToBottom();
    }
  }

  function hideTyping() {
    if (typingIndicator) {
      typingIndicator.classList.remove('active');
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Función para exportar preguntas a Excel
  async function exportQuestionsToExcel() {
    try {
      console.log('📥 Iniciando exportación de preguntas...');

      // Obtener todas las interacciones de Firebase
      const interactionsRef = collection(db, 'chatbot_interactions');
      const q = query(interactionsRef, orderBy('createdAt', 'desc'), firestoreLimit(1000));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert('No hay preguntas para exportar');
        return;
      }

      // Preparar datos para Excel
      const data = [];
      querySnapshot.forEach((doc) => {
        const interaction = doc.data();
        data.push({
          'Fecha': interaction.createdAt ? new Date(interaction.createdAt).toLocaleString('es-AR') : 'N/A',
          'Usuario': interaction.userName || 'N/A',
          'Email': interaction.userEmail || 'N/A',
          'Pregunta': interaction.question || 'N/A',
          'Respuesta': interaction.response || 'N/A',
          'Intención': interaction.intent || 'N/A',
          'Productos Encontrados': interaction.productsCount || 0
        });
      });

      console.log(`✅ ${data.length} interacciones encontradas`);

      // Cargar librería SheetJS dinámicamente
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
      script.onload = () => {
        // Crear libro de Excel
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Preguntas Chatbot');

        // Descargar archivo
        const filename = `chatbot_preguntas_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
        console.log('✅ Archivo Excel descargado:', filename);
      };
      document.head.appendChild(script);

    } catch (error) {
      console.error('❌ Error exportando preguntas:', error);
      alert('Error al exportar preguntas. Por favor verifica los permisos de Firebase.');
    }
  }

  // Event listener para botón de exportar
  const exportBtn = document.getElementById('chatbotExportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportQuestionsToExcel);
    console.log('✅ Botón de exportar configurado');
  }

  console.log('✅ Chatbot modal inicializado');
}
