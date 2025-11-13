/**
 * Script de testing manual para validar el sistema de 3 tiers
 * Ejecutar en la consola del navegador en diferentes sitios de e-commerce
 */

console.log('🔍 Iniciando testing del sistema de 3 tiers...');

// Función para detectar tier actual
function detectCurrentTier() {
  const url = window.location.href;
  const domain = window.location.hostname.replace('www.', '');
  
  console.log(`📍 URL actual: ${url}`);
  console.log(`🌐 Dominio: ${domain}`);
  
  // Enviar mensaje al content script para obtener tier info
  chrome.runtime.sendMessage({ action: 'getTierInfo', url }, (response) => {
    if (response) {
      console.log('📊 Tier detectado:', response);
      console.log(`🏷️ Tier: ${response.tier}`);
      console.log(`🏅 Label: ${response.label}`);
      console.log(`📄 Descripción: ${response.description}`);
      console.log(`🏬 Sitio: ${response.siteName || 'N/A'}`);
      console.log(`🔧 Adapter: ${response.adapterName || 'N/A'}`);
      
      // Obtener badge info
      chrome.runtime.sendMessage({ action: 'getBadgeInfo', url }, (badgeResponse) => {
        if (badgeResponse) {
          console.log('🎨 Badge info:', badgeResponse);
          console.log(`🏷️ Texto: ${badgeResponse.text}`);
          console.log(`🎨 Tono: ${badgeResponse.tone}`);
          console.log(`😀 Emoji: ${badgeResponse.emoji}`);
          console.log(`🔢 Nivel: ${badgeResponse.level}`);
        }
      });
    } else {
      console.error('❌ Error al obtener tier info');
    }
  });
}

// Función para probar adapter selection
function testAdapterSelection() {
  const url = window.location.href;
  console.log(`🧪 Probando adapter selection para: ${url}`);
  
  chrome.runtime.sendMessage({ action: 'getAdapterForUrl', url }, (response) => {
    if (response) {
      console.log('✅ Adapter seleccionado:', response);
      console.log(`🔧 Nombre: ${response.name}`);
    } else {
      console.error('❌ Error al obtener adapter');
    }
  });
}

// Función para probar whitelist detection
function testWhitelistDetection() {
  const domain = window.location.hostname.replace('www.', '');
  
  console.log(`🔍 Probando whitelist detection para: ${domain}`);
  
  chrome.runtime.sendMessage({ action: 'isSupportedSite', domain }, (response) => {
    if (response) {
      console.log('✅ Sitio en whitelist:', response);
      console.log(`🏷️ Soportado: ${response.supported}`);
      console.log(`📝 Info:`, response.siteInfo);
    } else {
      console.log('❌ Sitio NO en whitelist');
    }
  });
}

// Función para probar popup interaction
function testPopupInteraction() {
  console.log('🪟 Probando interacción con popup...');
  
  // Simular apertura del popup
  chrome.action.openPopup();
  
  // Esperar un momento y verificar si el popup se abrió correctamente
  setTimeout(() => {
    console.log('✅ Popup abierto - verificar botones y badges');
  }, 1000);
}

// Ejecutar todas las pruebas
function runAllTests() {
  console.log('🚀 Ejecutando todas las pruebas...');
  
  detectCurrentTier();
  testAdapterSelection();
  testWhitelistDetection();
  testPopupInteraction();
}

// Exponer funciones globalmente para ejecución manual
window.testTierSystem = {
  detectCurrentTier,
  testAdapterSelection,
  testWhitelistDetection,
  testPopupInteraction,
  runAllTests
};

console.log('📋 Funciones disponibles:');
console.log('  - testTierSystem.detectCurrentTier()');
console.log('  - testTierSystem.testAdapterSelection()');
console.log('  - testTierSystem.testWhitelistDetection()');
console.log('  - testTierSystem.testPopupInteraction()');
console.log('  - testTierSystem.runAllTests()');

// Ejecutar pruebas automáticamente después de 2 segundos
setTimeout(() => {
  console.log('🎯 Ejecutando pruebas automáticamente...');
  runAllTests();
}, 2000);
