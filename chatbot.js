/**
 * CHATBOT.JS - Asistente Virtual Inteligente
 *
 * Sistema de chatbot optimizado que:
 * 1. Busca primero en Firebase (sin consumir tokens de IA)
 * 2. Usa Claude API solo para generar respuestas naturales
 * 3. Implementa cache para evitar consultas repetidas
 * 4. Controla throttling para limitar uso de tokens
 *
 * @version 1.0
 */

// ==================== FIREBASE CONFIGURATION ====================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, getDocs, query, where, limit, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCXjSGtVGfQas_cEyjmI0RTaeEl94jdp6g",
  authDomain: "carrito-138c3.firebaseapp.com",
  projectId: "carrito-138c3",
  storageBucket: "carrito-138c3.firebasestorage.app",
  messagingSenderId: "1002158386608",
  appId: "1:1002158386608:web:5f4f9a3e876a0f44dfe7a4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==================== CACHE SYSTEM ====================
/**
 * Sistema de cache simple para evitar consultas repetidas
 * Cache expira después de 5 minutos
 */
const CHATBOT_VERSION = '6';
const chatCache = {
  data: new Map(),
  TTL: 5 * 60 * 1000, // 5 minutos

  set(key, value) {
    this.data.set(key, {
      value,
      timestamp: Date.now()
    });
  },

  get(key) {
    const cached = this.data.get(key);
    if (!cached) return null;

    // Verificar si expiró
    if (Date.now() - cached.timestamp > this.TTL) {
      this.data.delete(key);
      return null;
    }

    return cached.value;
  },

  clear() {
    this.data.clear();
    console.log('🗑️ Cache limpiado');
  }
};

// Limpiar cache al cargar si cambió la versión
const storedVersion = localStorage.getItem('chatbot_js_version');
if (storedVersion !== CHATBOT_VERSION) {
  console.log(`🔄 Nueva versión de chatbot.js detectada (${storedVersion} → ${CHATBOT_VERSION})`);
  chatCache.clear();
  localStorage.setItem('chatbot_js_version', CHATBOT_VERSION);
}

// ==================== THROTTLING SYSTEM ====================
/**
 * Sistema de throttling para limitar llamadas a la API
 * Máximo 10 mensajes por minuto
 */
const throttle = {
  messages: [],
  MAX_MESSAGES_PER_MINUTE: 10,

  canSend() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Limpiar mensajes viejos
    this.messages = this.messages.filter(time => time > oneMinuteAgo);

    if (this.messages.length >= this.MAX_MESSAGES_PER_MINUTE) {
      return false;
    }

    this.messages.push(now);
    return true;
  },

  getRemainingTime() {
    if (this.messages.length === 0) return 0;
    const oldestMessage = Math.min(...this.messages);
    const timeUntilReset = 60000 - (Date.now() - oldestMessage);
    return Math.max(0, timeUntilReset);
  }
};

// ==================== FIREBASE SEARCH ENGINE ====================
/**
 * Motor de búsqueda en Firebase
 * Busca productos usando filtros y texto
 */
class ProductSearchEngine {
  constructor(db) {
    this.db = db;
    this.productsCache = null;
    this.lastFetch = null;
    this.CACHE_DURATION = 2 * 60 * 1000; // 2 minutos
  }

  /**
   * Obtiene todos los productos (con cache)
   */
  async getAllProducts() {
    const now = Date.now();

    // Usar cache si está disponible y es reciente
    if (this.productsCache && this.lastFetch && (now - this.lastFetch < this.CACHE_DURATION)) {
      console.log('📦 Usando productos en cache');
      return this.productsCache;
    }

    console.log('📦 Obteniendo productos de Firebase...');
    const productsSnapshot = await getDocs(collection(this.db, 'precios'));
    const products = [];

    productsSnapshot.forEach(doc => {
      const data = doc.data();
      products.push({
        id: doc.id,
        ...data
      });
    });

    this.productsCache = products;
    this.lastFetch = now;

    console.log(`✅ ${products.length} productos cargados`);

    // Log de ejemplo para debug (primeros 3 productos)
    if (products.length > 0) {
      console.log('📋 Ejemplo de producto:', {
        articulo: products[0].articulo,
        description: products[0].description || products[0].descripcion,
        precio1: products[0].precio1,
        stock: products[0].stock || products[0].stockTeorico
      });
    }

    return products;
  }

  /**
   * Busca productos por texto (nombre, descripción, código)
   */
  async searchByText(searchText) {
    const allProducts = await this.getAllProducts();
    const searchLower = searchText.toLowerCase().trim();

    console.log(`🔍 Buscando: "${searchText}"`);
    console.log(`📦 Total productos disponibles: ${allProducts.length}`);

    // Si la búsqueda es muy corta, usar coincidencia exacta
    if (searchLower.length <= 3) {
      const results = allProducts.filter(product => {
        const searchableText = `
          ${product.articulo || ''}
          ${product.description || product.descripcion || product.Descripcion || ''}
          ${product.categoria || product.Categoria || ''}
          ${product.marca || product.Marca || ''}
          ${product.rubro || product.Rubro || ''}
        `.toLowerCase();

        return searchableText.includes(searchLower);
      });
      console.log(`✅ Productos encontrados (búsqueda corta): ${results.length}`);
      return results;
    }

    // Palabras clave para búsqueda más larga
    const keywords = searchLower.split(' ').filter(word => word.length > 2);
    console.log(`🔑 Keywords: [${keywords.join(', ')}]`);

    let matchCount = 0;
    const results = allProducts.filter(product => {
      const searchableText = `
        ${product.articulo || ''}
        ${product.description || product.descripcion || product.Descripcion || ''}
        ${product.categoria || product.Categoria || ''}
        ${product.marca || product.Marca || ''}
        ${product.rubro || product.Rubro || ''}
      `.toLowerCase();

      // Coincidir si tiene al menos una palabra clave
      const matches = keywords.some(keyword => searchableText.includes(keyword));

      // Log de ejemplo para ver qué está buscando (primeros 3 matches)
      if (matches && matchCount < 3) {
        console.log(`🎯 Match encontrado: ${product.articulo} - ${(product.description || product.descripcion || '')?.substring(0, 50)}`);
        matchCount++;
      }

      return matches;
    });

    console.log(`✅ Productos encontrados: ${results.length}`);
    return results;
  }

  /**
   * Busca productos con stock disponible (ordenados por stock descendente)
   */
  async searchWithStock() {
    const allProducts = await this.getAllProducts();

    // Debug: mostrar estructura de stock de los primeros 3 productos
    if (allProducts.length > 0) {
      console.log('🔍 Analizando estructura de stock...');
      for (let i = 0; i < Math.min(3, allProducts.length); i++) {
        const p = allProducts[i];
        console.log(`Producto ${i + 1}:`, {
          articulo: p.articulo,
          stock: p.stock,
          stockTeorico: p.stockTeorico,
          Stock: p.Stock,
          typeof_stock: typeof p.stock,
          typeof_stockTeorico: typeof p.stockTeorico
        });
      }
    }

    const results = allProducts
      .filter(product => {
        const stock = parseInt(product.stock || product.stockTeorico || product.Stock) || 0;
        return stock > 0;
      })
      .sort((a, b) => {
        // Ordenar por stock descendente (más stock = más popular)
        const stockA = parseInt(a.stock || a.stockTeorico || a.Stock) || 0;
        const stockB = parseInt(b.stock || b.stockTeorico || b.Stock) || 0;
        return stockB - stockA;
      });

    console.log(`📦 Productos con stock > 0: ${results.length} de ${allProducts.length}`);

    if (results.length > 0) {
      console.log(`📊 Stock máximo: ${parseInt(results[0].stock || results[0].stockTeorico || 0)}`);
    } else {
      console.warn('⚠️ No se encontraron productos con stock > 0');
      // Intentar mostrar productos ordenados por stock (incluso si es 0)
      const allSorted = allProducts
        .sort((a, b) => {
          const stockA = parseInt(a.stock || a.stockTeorico || a.Stock) || 0;
          const stockB = parseInt(b.stock || b.stockTeorico || b.Stock) || 0;
          return stockB - stockA;
        });

      if (allSorted.length > 0) {
        console.log(`📊 Mostrando productos ordenados por stock. Máximo stock: ${parseInt(allSorted[0].stock || allSorted[0].stockTeorico || 0)}`);
      }

      return allSorted.slice(0, 20); // Devolver al menos los primeros 20
    }

    return results;
  }

  /**
   * Obtiene productos más baratos
   */
  async getCheapestProducts(limit = 5) {
    const allProducts = await this.getAllProducts();
    const results = allProducts
      .filter(p => {
        const precio = p.precio1 || p.precio || p.Precio;
        return precio && precio > 0;
      })
      .sort((a, b) => {
        const precioA = a.precio1 || a.precio || a.Precio || 0;
        const precioB = b.precio1 || b.precio || b.Precio || 0;
        return precioA - precioB;
      })
      .slice(0, limit);
    console.log(`💰 Productos más baratos: ${results.length}`);
    return results;
  }

  /**
   * Obtiene productos por categoría
   */
  async searchByCategory(category) {
    const allProducts = await this.getAllProducts();
    const categoryLower = category.toLowerCase();

    const results = allProducts.filter(product => {
      const productCategory = (
        product.categoria ||
        product.Categoria ||
        product.rubro ||
        product.Rubro ||
        ''
      ).toLowerCase();
      return productCategory.includes(categoryLower);
    });

    console.log(`📂 Productos en categoría "${category}": ${results.length}`);
    return results;
  }

  /**
   * Busca celulares más vendidos (ordenados por stock)
   */
  async searchCellphonesBestSellers(searchText) {
    const allProducts = await this.getAllProducts();
    const searchLower = searchText.toLowerCase();

    // Si busca "celulares" genérico, buscar palabras clave comunes
    const keywords = searchLower === 'celulares' || searchLower === 'celular'
      ? ['iphone', 'samsung', 'galaxy', 'phone', 'móvil', 'movil', 'smartphone', 'celular', 'xiaomi', 'motorola', 'huawei']
      : [searchLower];

    console.log(`📱 Buscando con keywords: [${keywords.join(', ')}]`);

    const results = allProducts
      .filter(product => {
        const searchableText = `
          ${product.articulo || ''}
          ${product.description || product.descripcion || product.Descripcion || ''}
        `.toLowerCase();

        // Buscar cualquiera de las palabras clave
        return keywords.some(keyword => searchableText.includes(keyword));
      })
      .sort((a, b) => {
        // Ordenar por stock descendente (más stock = más vendidos)
        const stockA = parseInt(a.stock || a.stockTeorico || a.Stock) || 0;
        const stockB = parseInt(b.stock || b.stockTeorico || b.Stock) || 0;
        return stockB - stockA;
      });

    console.log(`📱 Celulares encontrados: ${results.length}`);

    // Si no encuentra nada, mostrar qué productos hay disponibles
    if (results.length === 0 && allProducts.length > 0) {
      console.log(`⚠️ No se encontraron productos. Ejemplo de descripción:`, allProducts[0].description?.substring(0, 100));
    }

    return results;
  }

  /**
   * Búsqueda inteligente que determina el tipo de consulta
   */
  async smartSearch(userQuery) {
    const queryLower = userQuery.toLowerCase();
    console.log(`🎯 SmartSearch recibió: "${userQuery}"`);

    // Detectar intención de búsqueda por STOCK
    if (queryLower.includes('stock') || queryLower.includes('disponible')) {
      console.log('✅ Intención detectada: STOCK');
      const products = await this.searchWithStock();
      return {
        intent: 'stock',
        products: products.slice(0, 20) // Limitar a 20 productos
      };
    }

    // Detectar intención de búsqueda por PRECIO BAJO
    if (queryLower.includes('barato') || queryLower.includes('económico') || queryLower.includes('precio bajo') || queryLower.includes('más baratos')) {
      console.log('✅ Intención detectada: PRECIO BAJO');
      return {
        intent: 'cheap',
        products: await this.getCheapestProducts(15)
      };
    }

    // Detectar categorías específicas de celulares (ordenar por más vendidos)
    if (queryLower.includes('celular') || queryLower.includes('teléfono') || queryLower.includes('móvil') || queryLower.includes('iphone') || queryLower.includes('samsung')) {
      console.log('✅ Intención detectada: CELULARES (más vendidos)');
      return {
        intent: 'bestsellers',
        products: await this.searchCellphonesBestSellers(userQuery)
      };
    }

    // Búsqueda por texto general
    console.log('✅ Intención detectada: BÚSQUEDA GENERAL');
    return {
      intent: 'general',
      products: await this.searchByText(userQuery)
    };
  }
}

// ==================== AI RESPONSE GENERATOR ====================
/**
 * Generador de respuestas con IA (Claude API)
 * Solo se llama cuando es necesario generar lenguaje natural
 */
class AIResponseGenerator {
  constructor() {
    // URL del backend que maneja las llamadas a Claude
    this.API_ENDPOINT = window.location.hostname === 'localhost'
      ? 'http://localhost:3002/api/chat'
      : '/api/chat';
  }

  /**
   * Genera una respuesta natural usando Claude API
   */
  async generateResponse(userQuery, products, intent) {
    // Limitar productos (máximo 5 para mostrar)
    const limitedProducts = products.slice(0, 5);

    try {
      console.log('🤖 Generando respuesta con IA...');

      // Preparar datos simplificados para enviar a la IA
      const productData = limitedProducts.map(p => ({
        articulo: p.articulo,
        descripcion: p.description || p.descripcion || p.Descripcion,
        precio: p.precio1 || p.precio || p.Precio,
        stock: p.stock || p.stockTeorico || p.Stock || 0
      }));

      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userQuery,
          products: productData,
          intent
        })
      });

      if (!response.ok) {
        throw new Error('Error en la API de chat');
      }

      const data = await response.json();
      return {
        text: data.response,
        products: limitedProducts
      };

    } catch (error) {
      console.error('❌ Error generando respuesta:', error);

      // Fallback: devolver productos con mensaje simple
      let fallbackText = '';
      if (intent === 'stock') {
        fallbackText = `📦 Encontré ${products.length} productos con stock disponible. Aquí están los que tienen más inventario:`;
      } else if (intent === 'cheap') {
        fallbackText = `💰 Estos son los ${limitedProducts.length} productos más económicos:`;
      } else if (intent === 'bestsellers') {
        fallbackText = `📱 Estos son los celulares más vendidos (${limitedProducts.length} productos):`;
      } else if (products.length > 0) {
        fallbackText = `Encontré ${products.length} productos. Aquí están algunos:`;
      } else {
        fallbackText = 'No encontré productos con esos criterios. ¿Podrías intentar con otras palabras clave?';
      }

      return {
        text: fallbackText,
        products: limitedProducts
      };
    }
  }
}

// ==================== CHATBOT CONTROLLER ====================
/**
 * Controlador principal del chatbot
 */
class ChatbotController {
  constructor() {
    this.searchEngine = new ProductSearchEngine(db);
    this.aiGenerator = new AIResponseGenerator();
    this.conversationHistory = [];
  }

  /**
   * Procesa un mensaje del usuario
   */
  async processMessage(userMessage) {
    try {
      // 1. Verificar throttling
      if (!throttle.canSend()) {
        const waitTime = Math.ceil(throttle.getRemainingTime() / 1000);
        return {
          text: `⏱️ Has enviado muchos mensajes. Por favor espera ${waitTime} segundos antes de continuar.`,
          products: [],
          fromCache: false
        };
      }

      // 2. Verificar cache
      const cacheKey = userMessage.toLowerCase().trim();
      const cached = chatCache.get(cacheKey);
      if (cached) {
        console.log('💾 Respuesta desde cache');
        return { ...cached, fromCache: true };
      }

      // 3. Buscar productos en Firebase
      const searchResult = await this.searchEngine.smartSearch(userMessage);

      // 4. Si no hay productos, responder directamente
      if (searchResult.products.length === 0) {
        const response = {
          text: 'No encontré productos que coincidan con tu búsqueda. ¿Podrías ser más específico o probar con otras palabras?',
          products: [],
          fromCache: false
        };
        chatCache.set(cacheKey, response);
        return response;
      }

      // 5. Generar respuesta natural con IA
      console.log(`🤖 Generando respuesta para ${searchResult.products.length} productos...`);
      const aiResponse = await this.aiGenerator.generateResponse(
        userMessage,
        searchResult.products,
        searchResult.intent
      );

      console.log(`✅ Respuesta generada. Productos a mostrar: ${aiResponse.products?.length || 0}`);

      // 6. Guardar en cache
      const response = {
        text: aiResponse.text,
        products: aiResponse.products,
        fromCache: false
      };
      chatCache.set(cacheKey, response);

      // 7. Guardar en historial de conversación
      this.conversationHistory.push({
        user: userMessage,
        bot: response.text,
        timestamp: new Date()
      });

      return response;

    } catch (error) {
      console.error('❌ Error procesando mensaje:', error);
      return {
        text: 'Disculpa, ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.',
        products: [],
        fromCache: false
      };
    }
  }

  /**
   * Obtiene sugerencias rápidas basadas en productos populares
   */
  async getQuickSuggestions() {
    try {
      const products = await this.searchEngine.getAllProducts();
      const withStock = products.filter(p => (parseInt(p.stock) || 0) > 0);
      return [
        '¿Qué productos tienen stock disponible?',
        'Muéstrame los productos más baratos',
        '¿Qué celulares tienen disponibles?',
        'Recomiéndame un producto popular'
      ];
    } catch (error) {
      console.error('Error obteniendo sugerencias:', error);
      return [];
    }
  }
}

// ==================== UI CONTROLLER ====================
/**
 * Controlador de la interfaz de usuario
 */
class ChatUI {
  constructor(chatbot) {
    this.chatbot = chatbot;
    this.messagesContainer = document.getElementById('chatMessages');
    this.chatInput = document.getElementById('chatInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.typingIndicator = document.getElementById('typingIndicator');
    this.welcomeMessage = document.getElementById('welcomeMessage');

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Enviar mensaje con botón
    this.sendBtn.addEventListener('click', () => this.sendMessage());

    // Enviar mensaje con Enter
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Quick suggestions
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const message = chip.getAttribute('data-message');
        this.chatInput.value = message;
        this.sendMessage();
      });
    });
  }

  async sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message) return;

    // Limpiar input
    this.chatInput.value = '';
    this.sendBtn.disabled = true;

    // Ocultar mensaje de bienvenida
    if (this.welcomeMessage) {
      this.welcomeMessage.style.display = 'none';
    }

    // Mostrar mensaje del usuario
    this.addUserMessage(message);

    // Mostrar indicador de escritura
    this.showTyping();

    // Procesar mensaje
    const response = await this.chatbot.processMessage(message);

    // Ocultar indicador de escritura
    this.hideTyping();

    // Mostrar respuesta del bot
    this.addBotMessage(response.text, response.products, response.fromCache);

    // Habilitar botón de envío
    this.sendBtn.disabled = false;
    this.chatInput.focus();
  }

  addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
      <div class="message-content">
        ${this.escapeHtml(text)}
      </div>
    `;
    this.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  addBotMessage(text, products = [], fromCache = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';

    console.log(`📨 Mostrando mensaje: "${text}"`);
    console.log(`📦 Productos a renderizar: ${products?.length || 0}`);

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
          <div class="product-card" onclick="window.open('marketplace.html?search=${encodeURIComponent(product.articulo)}', '_blank')">
            <div class="product-info">
              <h4>${this.escapeHtml(product.articulo || 'Sin código')}</h4>
              <p>${this.escapeHtml(description)}</p>
              <p style="color: ${stock > 0 ? '#4CAF50' : '#666'};">${stockText}</p>
              <div class="product-price">${price}</div>
            </div>
          </div>
        `;
      });
      productsHTML += '</div>';
    }

    const cacheIndicator = fromCache ? '<small style="color: #666; font-size: 10px;">💾 Respuesta en cache</small>' : '';

    messageDiv.innerHTML = `
      <div class="message-avatar">
        <span class="material-icons">smart_toy</span>
      </div>
      <div>
        <div class="message-content">
          ${this.escapeHtml(text)}
          ${productsHTML}
        </div>
        ${cacheIndicator}
      </div>
    `;

    this.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  showTyping() {
    this.typingIndicator.classList.add('active');
    this.scrollToBottom();
  }

  hideTyping() {
    this.typingIndicator.classList.remove('active');
  }

  scrollToBottom() {
    setTimeout(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }, 100);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// ==================== INITIALIZATION ====================
console.log('🤖 Inicializando Chatbot...');

// Verificar autenticación
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log('⚠️ Usuario no autenticado, redirigiendo...');
    window.location.href = 'login.html';
    return;
  }

  console.log('✅ Usuario autenticado:', user.email);

  // Inicializar chatbot
  const chatbot = new ChatbotController();
  const ui = new ChatUI(chatbot);

  console.log('✅ Chatbot inicializado correctamente');
});
