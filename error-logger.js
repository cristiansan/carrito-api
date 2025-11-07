// error-logger.js - Sistema de logging de errores
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class ErrorLogger {
  constructor(firebaseApp) {
    this.db = getFirestore(firebaseApp);
    this.consoleMessages = [];
    this.maxConsoleMessages = 50; // Guardar últimos 50 mensajes de consola
    this.currentUser = null;

    this.setupConsoleInterception();
    this.setupGlobalErrorHandlers();
  }

  // Interceptar console.error, console.warn, y console.log
  setupConsoleInterception() {
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleLog = console.log;

    console.error = (...args) => {
      this.addConsoleMessage('error', args);
      originalConsoleError.apply(console, args);
    };

    console.warn = (...args) => {
      this.addConsoleMessage('warn', args);
      originalConsoleWarn.apply(console, args);
    };

    console.log = (...args) => {
      this.addConsoleMessage('log', args);
      originalConsoleLog.apply(console, args);
    };
  }

  // Agregar mensaje a la cola de consola
  addConsoleMessage(type, args) {
    const message = {
      type,
      timestamp: new Date().toISOString(),
      message: args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ')
    };

    this.consoleMessages.push(message);

    // Mantener solo los últimos N mensajes
    if (this.consoleMessages.length > this.maxConsoleMessages) {
      this.consoleMessages.shift();
    }
  }

  // Configurar manejadores globales de errores
  setupGlobalErrorHandlers() {
    // Errores no capturados
    window.addEventListener('error', (event) => {
      this.logError({
        errorMessage: event.message || 'Error desconocido',
        stackTrace: event.error?.stack || '',
        fileName: event.filename || '',
        lineNumber: event.lineno || 0,
        columnNumber: event.colno || 0,
        errorType: 'uncaught_error'
      });
    });

    // Promesas rechazadas no manejadas
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        errorMessage: event.reason?.message || String(event.reason) || 'Promise rechazada',
        stackTrace: event.reason?.stack || '',
        errorType: 'unhandled_rejection'
      });
    });
  }

  // Establecer usuario actual
  setCurrentUser(user) {
    this.currentUser = user;
  }

  // Obtener últimos mensajes de consola
  getRecentConsoleMessages() {
    return [...this.consoleMessages];
  }

  // Logging manual de errores
  async logError({ errorMessage, stackTrace = '', errorType = 'manual', additionalData = {} }) {
    try {
      const errorLog = {
        timestamp: serverTimestamp(),
        dateTime: new Date().toISOString(),
        errorMessage: errorMessage,
        consoleMessages: this.getRecentConsoleMessages(), // Últimos mensajes de consola
        stackTrace: stackTrace,
        errorType: errorType,
        url: window.location.href,
        userAgent: navigator.userAgent,
        userEmail: this.currentUser?.email || 'No autenticado',
        userName: this.currentUser?.displayName || 'Desconocido',
        userUid: this.currentUser?.uid || null,
        ...additionalData
      };

      // Guardar en Firebase
      const docRef = await addDoc(collection(this.db, 'error_logs'), errorLog);
      console.log('✅ Error registrado con ID:', docRef.id);

      return docRef.id;
    } catch (e) {
      console.error('❌ Error al guardar log de error:', e);
      // No queremos crear un loop infinito de errores
      return null;
    }
  }

  // Wrapper para try-catch que automáticamente logea errores
  async wrapWithErrorLogging(fn, errorMessageForUser = 'Ha ocurrido un error') {
    try {
      return await fn();
    } catch (error) {
      console.error('Error capturado:', error);

      // Mostrar mensaje al usuario
      if (window.showNotification) {
        window.showNotification(errorMessageForUser + '\nSi el problema persiste, contacta al administrador.', 'error');
      } else {
        alert(errorMessageForUser + '\nSi el problema persiste, contacta al administrador.');
      }

      // Registrar error
      await this.logError({
        errorMessage: errorMessageForUser,
        stackTrace: error.stack || '',
        errorType: 'caught_error',
        additionalData: {
          originalError: error.message,
          errorName: error.name
        }
      });

      throw error; // Re-throw para que el código pueda manejarlo si necesita
    }
  }
}

// Exportar clase
export default ErrorLogger;
