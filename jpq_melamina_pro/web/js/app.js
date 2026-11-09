// ==============================================================================
// Archivo: jpq_melamina_pro/web/js/app.js
// Descripción: Controlador Frontend Principal de JPQMelaminaPro.
//              Implementa el flujo interactivo solicitado por el usuario:
//              - Lado Izquierdo (1/3): Ingreso del detalle, melamina y pestañas modulares.
//              - Lado Derecho (2/3): Dibujo en vivo en 3 estados:
//                1. Vacío al inicio.
//                2. Rectángulo delineado al ingresar dimensiones generales (W x H x D).
//                3. Módulos armados al ingresar espesor de melamina y cantidad de módulos.
//              - Pestañas dinámicas con recálculo automático de anchos para sumar el total.
//              - Alturas y profundidades individuales por módulo (menores o iguales al total).
//              - Zócalos por módulo con altura y cantidad de listones.
//              - Validación estricta de medidas mínimas, máximas y reglas de pandeo.
// ==============================================================================

// Estado global de la aplicación (Store Central)
const AppState = {
  // Estado del flujo visualizador: 'vacio' | 'delineado' | 'modulos'
  estadoVisualizador: 'vacio',

  // 1. Dimensiones Generales del Mueble (W, H, D en mm)
  anchoTotal: 0,
  altoTotal: 0,
  profTotal: 0,

  // Zócalo Inferior Perimétrico Continuo (Todo el mueble)
  tieneZocalo: false,
  altoZocalo: 100,
  cantListonesZocalo: 'auto',
  retransZocalo: 35,

  // 2. Configuración Base de Melamina y Fabricación
  espesorMelamina: 18, // 15, 18, 36 mm
  esquemaColor: 'unicolor', // 'unicolor' (todo el mueble) | 'bicolor' (frontis exterior vs interior)
  marcaMelamina: 'Pelikano', // Marca frontis / general
  materialFrentes: 'Pelikano Blanco Nieve 18mm', // Color frontis / exterior (o todo el mueble)
  materialColorHex: '#F5F6F8',
  marcaInterior: 'Pelikano', // Marca interior
  materialEstructura: 'Pelikano Blanco Nieve 18mm', // Color estructura interior / repisas
  materialInteriorHex: '#F5F6F8',
  colorMdf: 'MDF Fondo Blanco 3mm', // Color fondo MDF 3mm
  colorMdfHex: '#F8F9FA',
  resistencia: 'Normal', // 'Normal' o 'RH'
  luzFrentes: 3.0, // Luz perimetral estándar de 3.0 mm
  modoTapacanto: 'estandar', // 'estandar' (Frentes 2mm + Int 0.5mm) | 'economico' (Todo 0.5mm/0) | 'premium' (Todo 2mm) | 'personalizado'
  cantidadModulos: 0,

  // 3. Colección de Módulos Paramétricos y Modo de Selección
  modoSeleccion: 'diseno', // 'diseno' (todo el mueble) | 'modulo' (módulo específico)
  moduloActivoIndex: 0,
  modoSimulacion: false,   // true = Modo interactivo de apertura de puertas y cajones por clic
  modoOcultarPiezas: false,// true = Modo interactivo de ocultar/visualizar piezas con líneas punteadas
  modulos: [],

  // 4. Parámetros de Visualización Técnica
  vistaActual: 'iso',       // 'iso' | 'front' | 'top' | 'side'
  modoRender: 'solido',     // 'solido' | 'alambre'
  mostrarCotas: true,

  // 5. Tema Activo (Claro, Oscuro, Taller Madera)
  temaActual: 'claro',

  // 6. Despiece y Optimización
  despieceActual: [],
  materialesBandeja: []
};

// ==============================================================================
// 1. INICIALIZACIÓN DE LA APLICACIÓN
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Cargar tema guardado
  const temaGuardado = localStorage.getItem('jpq_tema') || 'claro';
  cambiarTema(temaGuardado);

  // Inicializar estado de selección y controles de visibilidad
  AppState.modoSeleccion = 'diseno';
  actualizarVisibilidadPaneles();
  actualizarUIZocaloGeneral();
  renderizarBotonesSelectorCanvas();
  inicializarScrollHorizontalConRueda();
  inicializarSelectorPlantillas();
  poblarSelectoresMateriales();

  // Inicializar el motor Canvas 3D con callback de selección de módulo al hacer clic
  if (window.Preview3D) {
    Preview3D.init('preview3DCanvas', (indexClickeado) => {
      seleccionarModulo(indexClickeado);
    });

    if (typeof Preview3D.setOnElementoSimuladoCallback === 'function') {
      Preview3D.setOnElementoSimuladoCallback((info) => {
        const accion = (info.estado === 'abierto') ? 'Abierto' : 'Cerrado';
        const desc = info.nombrePieza || (info.tipoMovil === 'cajon' ? 'Cajón' : 'Puerta');
        mostrarNotificacion(`🎮 ${desc}: ${accion}`, "info");
      });
    }

    if (typeof Preview3D.setOnPiezaVisibilidadCallback === 'function') {
      Preview3D.setOnPiezaVisibilidadCallback((info) => {
        if (info.oculta) {
          mostrarNotificacion(`👁️ Pieza oculta (perímetro punteado): ${info.nombrePieza}`, "info");
        } else {
          mostrarNotificacion(`✓ Pieza visible restablecida: ${info.nombrePieza}`, "success");
        }
      });
    }
  }

  // Escuchar redimensionamiento para refrescar el canvas
  window.addEventListener('resize', () => {
    if (window.Preview3D && window.Preview3D.resize) {
      window.Preview3D.resize();
    }
  });

  // Atajo de teclado para recargar la ventana en SketchUp UI::HtmlDialog
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
      e.preventDefault();
      window.location.reload(true);
    }
  });

  // Notificar a SketchUp que el DOM está listo para recibir comandos y sincronizaciones
  const suBridge = (typeof window !== 'undefined' && window.sketchup)
    ? window.sketchup
    : (typeof sketchup !== 'undefined' ? sketchup : null);

  if (suBridge && typeof suBridge.domListo === 'function') {
    suBridge.domListo('');
  } else if (typeof window.callSketchup === 'function') {
    window.callSketchup('domListo');
  }

  // Mostrar notificación inicial
  mostrarNotificacion("JPQMelaminaPro iniciado. Ingrese las dimensiones generales para trazar el mueble.", "info");
});

// ==============================================================================
// 2. GESTIÓN DE TEMAS (Claro / Oscuro / Taller Madera)
// ==============================================================================

/**
 * Conmuta el tema visual de toda la suite.
 * @param {string} tema - 'claro', 'oscuro' o 'taller'
 */
function cambiarTema(tema) {
  document.body.className = `theme-${tema}`;
  AppState.temaActual = tema;
  localStorage.setItem('jpq_tema', tema);

  // Actualizar selector visual en el header si existe
  const selectTema = document.getElementById('selectTemaApp');
  if (selectTema) selectTema.value = tema;

  // Re-renderizar visor con los colores correspondientes al tema
  actualizarCanvas();
}

// ==============================================================================
// 3. PASO 1: DIMENSIONES GENERALES DEL MUEBLE (Ancho, Alto, Profundidad)
// ==============================================================================

/**
 * Procesa las dimensiones generales ingresadas en el panel izquierdo.
 * Si las 3 dimensiones son válidas (> 0), pasa a estado 'delineado'
 * (o mantiene 'modulos' si ya se habían configurado módulos).
 */
function onDimensionesGeneralesChange() {
  const elW = document.getElementById('dimAnchoTotal');
  const elH = document.getElementById('dimAltoTotal');
  const elD = document.getElementById('dimProfTotal');

  let w = parseFloat(elW.value) || 0;
  let h = parseFloat(elH.value) || 0;
  let d = parseFloat(elD.value) || 0;

  // Si el usuario ingresa el ancho pero alto o profundidad están aún vacíos, auto-completar con estándares para trazar el marco de inmediato
  if (w >= 150) {
    if (h <= 0 && (!elH.value || elH.value === '')) {
      h = 2100;
      elH.value = h;
    }
    if (d <= 0 && (!elD.value || elD.value === '')) {
      d = 600;
      elD.value = d;
    }
  }

  AppState.anchoTotal = w;
  AppState.altoTotal = h;
  AppState.profTotal = d;

  // Actualizar indicadores del zócalo perimétrico y altura sobrante para módulos
  actualizarUIZocaloGeneral();

  // Si no hay dimensiones completas, vuelve a estado 'vacio'
  if (w <= 0 || h <= 0 || d <= 0) {
    AppState.estadoVisualizador = 'vacio';
    actualizarCanvas();
    actualizarBadgeEstado();
    return;
  }

  // Ajustar la altura de los módulos existentes a las dimensiones sobrantes
  ajustarAlturasModulosPorZocalo();

  // Si no hay módulos configurados aún, pasa a 'delineado'
  if (AppState.cantidadModulos <= 0 || AppState.modulos.length === 0) {
    AppState.estadoVisualizador = 'delineado';
    mostrarNotificacion(`Marco delineado generado: ${w} x ${h} x ${d} mm`, "info");
  } else {
    // Si ya existían módulos, redistribuir el nuevo ancho total proporcionalmente
    distribuirAnchoTotalEnModulos();
    AppState.estadoVisualizador = 'modulos';
  }

  actualizarBadgeEstado();
  actualizarCanvas();
}

// ==============================================================================
// 3. CATÁLOGO DINÁMICO DE MUEBLES PREDISEÑADOS (100% BASADO EN JSON)
// ==============================================================================

/**
 * Catálogo maestro en memoria poblado dinámicamente desde perfiles_config.json.
 * Cualquier mueble, ambiente o rango de edad/género agregado al archivo JSON
 * se integrará inmediatamente sin requerir modificaciones en el código JavaScript.
 */
AppState.catalogoPerfiles = [];

/**
 * Mapeo de iconos para ambientes de mobiliario estándar.
 * Si un ambiente nuevo no está en este mapa, se asigna el icono genérico '🚪'.
 */
const ICONOS_AMBIENTES = {
  'Cocina': '🍳',
  'Baño': '🚿',
  'Lavandería & Despensa': '🧺',
  'Lavandería': '🧺',
  'Dormitorio': '🛏️',
  'Ambiente Infantil': '🧸',
  'Ambiente Juvenil': '🛹',
  'Zona Gamer': '🎮',
  'Oficina & Home Office': '💻',
  'Biblioteca & Estudio': '📚',
  'Sala de Estar & TV': '📺',
  'Comedor & Bar': '🍽️',
  'Tienda & Comercio': '🏪'
};

/**
 * Mapeo de iconos para grupos de edad y género.
 */
const ICONOS_EDAD_GENERO = {
  'Universal': '🌐',
  'Familiar': '👨‍👩‍👧‍👦',
  'Matrimonial': '💍',
  'Juvenil chicos': '👦',
  'Juvenil señoritas': '👧',
  'Infantil (de 2 a 8 años)': '🧸',
  'Escolar (de 6 a 12 años)': '🎒',
  'Adultos / Profesional': '💼',
  'Adultos Mayores / Senior (65+ años)': '🧓',
  'Comercial / Empresa': '🏬'
};

/**
 * Helper global para comunicación IPC bidireccional segura con SketchUp (Chromium CEF / HtmlDialog).
 */
window.callSketchup = function(callbackName, payload = '') {
  const dataStr = (typeof payload === 'object') ? JSON.stringify(payload) : String(payload);
  if (window.sketchup && typeof window.sketchup[callbackName] === 'function') {
    return window.sketchup[callbackName](dataStr);
  }
  if (typeof sketchup !== 'undefined' && typeof sketchup[callbackName] === 'function') {
    return sketchup[callbackName](dataStr);
  }
};

/**
 * Callback de respuesta de SketchUp IPC cuando se solicitan los perfiles.
 * @param {object} datos - Objeto con los perfiles cargados desde Ruby
 */
window.onPerfilesObtenidos = function(datos) {
  procesarDatosPerfiles(datos);
  mostrarNotificacion(`Catálogo sincronizado: ${AppState.catalogoPerfiles.length} muebles disponibles.`, 'info');
};

// ==============================================================================
// 1.1 CATÁLOGO DE MATERIALES, TEXTURAS Y EXTRACCIÓN DESDE SKETCHUP
// ==============================================================================

const CATALOGO_MATERIALES_BASE = [
  // Pelikano (Novopan)
  { id: 'pel_blanco_nieve_18', marca: 'Pelikano', categoria: 'Unicolores', nombre: 'Pelikano Blanco Nieve 18mm', color: '#F5F6F8' },
  { id: 'pel_bellota_18', marca: 'Pelikano', categoria: 'Maderas', nombre: 'Pelikano Bellota 18mm', color: '#8D5B36' },
  { id: 'pel_macadamia_18', marca: 'Pelikano', categoria: 'Maderas', nombre: 'Pelikano Macadamia 18mm', color: '#B99B78' },
  { id: 'pel_rovere_18', marca: 'Pelikano', categoria: 'Maderas', nombre: 'Pelikano Rovere 18mm', color: '#A88B67' },
  { id: 'pel_caramel_18', marca: 'Pelikano', categoria: 'Maderas', nombre: 'Pelikano Caramel 18mm', color: '#A66838' },
  { id: 'pel_cognac_18', marca: 'Pelikano', categoria: 'Maderas', nombre: 'Pelikano Coñac 18mm', color: '#7A3E26' },
  { id: 'pel_duna_18', marca: 'Pelikano', categoria: 'Maderas', nombre: 'Pelikano Duna 18mm', color: '#D6C7B2' },
  { id: 'pel_niebla_18', marca: 'Pelikano', categoria: 'Unicolores', nombre: 'Pelikano Niebla 18mm', color: '#C2C3BF' },
  { id: 'pel_carbono_18', marca: 'Pelikano', categoria: 'Unicolores', nombre: 'Pelikano Carbono 18mm', color: '#33363B' },
  { id: 'pel_oxido_18', marca: 'Pelikano', categoria: 'Fantasía', nombre: 'Pelikano Óxido 18mm', color: '#6B4F43' },

  // Vesto (Arauco)
  { id: 'vesto_blanco_frost_18', marca: 'Vesto', categoria: 'Unicolores', nombre: 'Vesto Blanco Frost 18mm', color: '#F2F4F5' },
  { id: 'vesto_roble_cendra_18', marca: 'Vesto', categoria: 'Maderas', nombre: 'Vesto Roble Cendra 18mm', color: '#9E8C78' },
  { id: 'vesto_aserrado_18', marca: 'Vesto', categoria: 'Maderas', nombre: 'Vesto Aserrado 18mm', color: '#B4926C' },
  { id: 'vesto_seda_giorno_18', marca: 'Vesto', categoria: 'Textil', nombre: 'Vesto Seda Giorno 18mm', color: '#8E7E73' },
  { id: 'vesto_linosa_18', marca: 'Vesto', categoria: 'Textil', nombre: 'Vesto Linosa 18mm', color: '#B7A998' },
  { id: 'vesto_teca_lira_18', marca: 'Vesto', categoria: 'Maderas', nombre: 'Vesto Teca Lira 18mm', color: '#85583B' },
  { id: 'vesto_nogal_terra_18', marca: 'Vesto', categoria: 'Maderas', nombre: 'Vesto Nogal Terracota 18mm', color: '#6E4631' },
  { id: 'vesto_wengue_18', marca: 'Vesto', categoria: 'Maderas', nombre: 'Vesto Wengue 18mm', color: '#3B2B23' },
  { id: 'vesto_cendra_escan_18', marca: 'Vesto', categoria: 'Maderas', nombre: 'Vesto Cendra Escandinavo 18mm', color: '#C9BCAC' },
  { id: 'vesto_titan_18', marca: 'Vesto', categoria: 'Unicolores', nombre: 'Vesto Titán 18mm', color: '#4A4F55' },

  // Universal / Comercial
  { id: 'mel_blanco_18', marca: 'Universal', categoria: 'Unicolores', nombre: 'Melamina Blanca 18mm', color: '#FFFFFF' },
  { id: 'mel_roble_18', marca: 'Universal', categoria: 'Maderas', nombre: 'Melamina Roble Natural 18mm', color: '#D0A87C' },
  { id: 'mel_gris_humo_18', marca: 'Universal', categoria: 'Unicolores', nombre: 'Melamina Gris Humo 18mm', color: '#7F8489' },
  { id: 'mel_negro_18', marca: 'Universal', categoria: 'Unicolores', nombre: 'Melamina Negro Mate 18mm', color: '#222222' },
  { id: 'mel_haya_18', marca: 'Universal', categoria: 'Maderas', nombre: 'Melamina Haya Claro 18mm', color: '#DEB887' },
  { id: 'mel_cedro_18', marca: 'Universal', categoria: 'Maderas', nombre: 'Melamina Cedro 18mm', color: '#A0522D' },
  { id: 'mel_wengue_18', marca: 'Universal', categoria: 'Maderas', nombre: 'Melamina Wengue 18mm', color: '#362B28' }
];

window.onMaterialesBandejaObtenidos = function(materiales) {
  if (Array.isArray(materiales)) {
    AppState.materialesBandeja = materiales;
    poblarSelectoresMateriales();
    mostrarNotificacion(`🎨 Bandeja de SketchUp: ${materiales.length} materiales importados correctamente.`, 'success');
  }
};

window.onMaterialActivoBandeja = function(resp) {
  if (resp && resp.ok && resp.material) {
    aplicarMaterialSegunDestino(resp.material);
    mostrarNotificacion(`🎨 Textura de SketchUp aplicada: ${resp.material.nombre}`, 'success');
  } else if (resp && resp.error) {
    mostrarNotificacion(resp.error, 'warning');
  }
};

window.onMaterialSeleccion3D = function(resp) {
  if (resp && resp.ok && resp.material) {
    aplicarMaterialSegunDestino(resp.material);
    mostrarNotificacion(`💉 Gotero 3D: Textura capturada: ${resp.material.nombre}`, 'success');
  } else if (resp && resp.error) {
    mostrarNotificacion(resp.error, 'warning');
  } else {
    mostrarNotificacion('Selecciona una cara o pieza en SketchUp para tomar su textura.', 'info');
  }
};

let _destinoGotero = 'exterior';

function capturarMaterialCuentagotas(destino = 'exterior') {
  _destinoGotero = destino;
  if (typeof window.callSketchup === 'function') {
    window.callSketchup('obtenerMaterialSeleccion3D', '');
    mostrarNotificacion('💉 Gotero 3D: Leyendo textura de la selección activa en SketchUp...', 'info');
  } else {
    mostrarNotificacion('Gotero 3D: Disponible al ejecutar dentro del plugin de SketchUp.', 'info');
  }
}
window.capturarMaterialCuentagotas = capturarMaterialCuentagotas;

function extraerMaterialesDeSketchUp() {
  if (typeof window.callSketchup === 'function') {
    window.callSketchup('obtenerMaterialesBandeja', '');
    mostrarNotificacion('🎨 Leyendo materiales y texturas de la bandeja de SketchUp...', 'info');
  } else {
    mostrarNotificacion('Bandeja SketchUp: Disponible al ejecutar dentro de SketchUp.', 'info');
  }
}
window.extraerMaterialesDeSketchUp = extraerMaterialesDeSketchUp;

function aplicarMaterialSegunDestino(mat) {
  if (!mat) return;
  if (mat.marca === 'Bandeja SketchUp' || mat.es_de_bandeja) {
    if (!AppState.materialesBandeja.find(m => m.nombre === mat.nombre)) {
      AppState.materialesBandeja.unshift(mat);
    }
  }

  if (_destinoGotero === 'interior') {
    AppState.materialEstructura = mat.nombre;
    AppState.materialInteriorHex = mat.color || '#F5F6F8';
    poblarSelectoresMateriales();
    const selMatInt = document.getElementById('selectMaterialInterior');
    if (selMatInt) selMatInt.value = mat.nombre;
    actualizarMuestraInteriorUI(mat);
  } else {
    AppState.materialFrentes = mat.nombre;
    AppState.materialColorHex = mat.color || '#F5F6F8';
    if (AppState.esquemaColor === 'unicolor') {
      AppState.materialEstructura = mat.nombre;
      AppState.materialInteriorHex = mat.color || '#F5F6F8';
    }
    poblarSelectoresMateriales();
    const selMatExt = document.getElementById('selectMaterialTextura');
    if (selMatExt) selMatExt.value = mat.nombre;
    actualizarMuestraMaterialUI(mat);
  }

  // Sincronizar módulos
  if (Array.isArray(AppState.modulos)) {
    AppState.modulos.forEach(m => {
      m.material_frentes = AppState.materialFrentes;
      m.material_interior = AppState.materialEstructura;
    });
  }

  actualizarCanvas();
  if (AppState.despieceActual && AppState.despieceActual.length > 0) {
    generarDespieceEstimadoLocal();
  }
}

function cambiarEsquemaColor(esquema) {
  AppState.esquemaColor = esquema || 'unicolor';
  const btnUni = document.getElementById('btnEsquemaUnicolor');
  const btnBi = document.getElementById('btnEsquemaBicolor');
  const secInt = document.getElementById('seccionColorInterior');
  const lblTitExt = document.getElementById('lblTituloColorExt');

  const badgeCard = document.getElementById('badgeEsquemaCard');
  const cardDetalleInterior = document.getElementById('cardDetalleInteriorBicolor');

  if (esquema === 'bicolor') {
    if (btnUni) btnUni.className = 'btn btn-outline';
    if (btnBi) btnBi.className = 'btn btn-primary';
    if (secInt) secInt.style.display = 'block';
    if (lblTitExt) lblTitExt.textContent = '1. Color Frontis Exterior (Puertas/Cajones):';
    if (badgeCard) {
      badgeCard.textContent = 'Bicolor';
      badgeCard.className = 'badge badge-warning';
    }
    if (cardDetalleInterior) cardDetalleInterior.style.display = 'flex';
    mostrarNotificacion('🎭 Mueble a 2 Colores activado: Frontis exterior vs Estructura interior.', 'info');
  } else {
    if (btnUni) btnUni.className = 'btn btn-primary';
    if (btnBi) btnBi.className = 'btn btn-outline';
    if (secInt) secInt.style.display = 'none';
    if (lblTitExt) lblTitExt.textContent = '1. Color Frontis / Todo el Mueble:';
    if (badgeCard) {
      badgeCard.textContent = 'Unicolor';
      badgeCard.className = 'badge badge-primary';
    }
    if (cardDetalleInterior) cardDetalleInterior.style.display = 'none';
    
    // Unicolor: igualar interior a exterior
    AppState.materialEstructura = AppState.materialFrentes;
    AppState.materialInteriorHex = AppState.materialColorHex;
    AppState.marcaInterior = AppState.marcaMelamina;
    
    if (Array.isArray(AppState.modulos)) {
      AppState.modulos.forEach(m => {
        m.material_frentes = AppState.materialFrentes;
        m.material_interior = AppState.materialEstructura;
      });
    }
    mostrarNotificacion('🎨 Esquema Unicolor: Todo el mueble y sus tapacantos adoptan el mismo color.', 'info');
  }

  poblarSelectoresMateriales();
  actualizarCanvas();
  if (AppState.despieceActual && AppState.despieceActual.length > 0) {
    generarDespieceEstimadoLocal();
  }
}
window.cambiarEsquemaColor = cambiarEsquemaColor;

function poblarSelectoresMateriales() {
  const selMarcaExt = document.getElementById('selectMarcaMelamina');
  const selTexturaExt = document.getElementById('selectMaterialTextura');
  const selMarcaInt = document.getElementById('selectMarcaInterior');
  const selTexturaInt = document.getElementById('selectMaterialInterior');

  const catalogoTexturasReales = (window.CATALOGO_TEXTURAS_MAESTRO && window.CATALOGO_TEXTURAS_MAESTRO.length > 0)
    ? window.CATALOGO_TEXTURAS_MAESTRO
    : CATALOGO_MATERIALES_BASE;

  const catalogoCombinado = [...catalogoTexturasReales, ...AppState.materialesBandeja];

  // Actualizar etiqueta de bandeja SketchUp en ambos selectores de marca
  const cantSU = AppState.materialesBandeja.length;
  [selMarcaExt, selMarcaInt].forEach(sel => {
    if (sel) {
      const optSU = sel.querySelector('option[value="Bandeja SketchUp"]');
      if (optSU) {
        optSU.textContent = cantSU > 0 ? `🎨 Bandeja SketchUp (${cantSU} texturas)` : '🎨 Bandeja SketchUp';
      }
    }
  });

  // 1. Selector Exterior / Frontis
  if (selTexturaExt) {
    const marcaExt = (selMarcaExt && selMarcaExt.value) ? selMarcaExt.value : (AppState.marcaMelamina || 'PELIKANO');
    const marcaNorm = (marcaExt || '').toUpperCase();
    let itemsExt = [];
    if (marcaExt === 'todas') itemsExt = catalogoCombinado;
    else if (marcaExt === 'Bandeja SketchUp') itemsExt = AppState.materialesBandeja;
    else itemsExt = catalogoCombinado.filter(m => (m.marca || '').toUpperCase().includes(marcaNorm) || marcaNorm.includes((m.marca || '').toUpperCase()));

    selTexturaExt.innerHTML = '';
    if (itemsExt.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = (marcaExt === 'Bandeja SketchUp') ? 'Sin texturas en SketchUp (Pulse Leer)' : 'Sin texturas';
      selTexturaExt.appendChild(opt);
    } else {
      let act = null;
      itemsExt.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.nombre;
        opt.textContent = `${m.nombre} (${m.categoria || m.marca})`;
        if (m.nombre === AppState.materialFrentes) {
          opt.selected = true;
          act = m;
        }
        selTexturaExt.appendChild(opt);
      });
      if (!act && itemsExt.length > 0) act = itemsExt[0];
      if (act) actualizarMuestraMaterialUI(act);
    }
  }

  // 2. Selector Interior / Estructura
  if (selTexturaInt) {
    const marcaInt = (selMarcaInt && selMarcaInt.value) ? selMarcaInt.value : (AppState.marcaInterior || 'PELIKANO');
    const marcaNorm = (marcaInt || '').toUpperCase();
    let itemsInt = [];
    if (marcaInt === 'todas') itemsInt = catalogoCombinado;
    else if (marcaInt === 'Bandeja SketchUp') itemsInt = AppState.materialesBandeja;
    else itemsInt = catalogoCombinado.filter(m => (m.marca || '').toUpperCase().includes(marcaNorm) || marcaNorm.includes((m.marca || '').toUpperCase()));

    selTexturaInt.innerHTML = '';
    if (itemsInt.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = (marcaInt === 'Bandeja SketchUp') ? 'Sin texturas en SketchUp (Pulse Leer)' : 'Sin texturas';
      selTexturaInt.appendChild(opt);
    } else {
      let actInt = null;
      itemsInt.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.nombre;
        opt.textContent = `${m.nombre} (${m.categoria || m.marca})`;
        if (m.nombre === AppState.materialEstructura) {
          opt.selected = true;
          actInt = m;
        }
        selTexturaInt.appendChild(opt);
      });
      if (!actInt && itemsInt.length > 0) actInt = itemsInt[0];
      if (actInt) actualizarMuestraInteriorUI(actInt);
    }
  }
}
window.poblarSelectoresMateriales = poblarSelectoresMateriales;

function onMarcaMelaminaChange(marca) {
  AppState.marcaMelamina = marca;
  poblarSelectoresMateriales();
  const sel = document.getElementById('selectMaterialTextura');
  if (sel && sel.value) {
    onMaterialTexturaChange(sel.value);
  }
}
window.onMarcaMelaminaChange = onMarcaMelaminaChange;

function onMaterialTexturaChange(nombre) {
  const catalogoCombinado = [
    ...(window.CATALOGO_TEXTURAS_MAESTRO || []),
    ...CATALOGO_MATERIALES_BASE,
    ...AppState.materialesBandeja
  ];
  const mat = catalogoCombinado.find(m => m.nombre === nombre) || { nombre: nombre, color: '#F5F6F8', marca: AppState.marcaMelamina };
  
  AppState.materialFrentes = mat.nombre;
  AppState.materialColorHex = mat.color || '#F5F6F8';

  // Si está en modo unicolor, ¡TODO el mueble cambia de inmediato a esta textura!
  if (AppState.esquemaColor === 'unicolor') {
    AppState.materialEstructura = mat.nombre;
    AppState.materialInteriorHex = mat.color || '#F5F6F8';
    actualizarMuestraInteriorUI(mat);
  }

  // Sincronizar en módulos
  if (Array.isArray(AppState.modulos)) {
    AppState.modulos.forEach(m => {
      m.material_frentes = AppState.materialFrentes;
      if (AppState.esquemaColor === 'unicolor') {
        m.material_interior = AppState.materialEstructura;
      }
    });
  }

  actualizarMuestraMaterialUI(mat);
  actualizarCanvas();
  if (AppState.despieceActual && AppState.despieceActual.length > 0) {
    generarDespieceEstimadoLocal();
  }

  if (AppState.esquemaColor === 'unicolor') {
    mostrarNotificacion(`✨ Todo el mueble actualizado a: ${mat.nombre}`, 'success');
  } else {
    mostrarNotificacion(`✨ Frontis exterior actualizado a: ${mat.nombre}`, 'success');
  }
}
window.onMaterialTexturaChange = onMaterialTexturaChange;

function onMarcaInteriorChange(marca) {
  AppState.marcaInterior = marca;
  poblarSelectoresMateriales();
  const sel = document.getElementById('selectMaterialInterior');
  if (sel && sel.value) {
    onMaterialInteriorChange(sel.value);
  }
}
window.onMarcaInteriorChange = onMarcaInteriorChange;

function onMaterialInteriorChange(nombre) {
  const catalogoCombinado = [
    ...(window.CATALOGO_TEXTURAS_MAESTRO || []),
    ...CATALOGO_MATERIALES_BASE,
    ...AppState.materialesBandeja
  ];
  const mat = catalogoCombinado.find(m => m.nombre === nombre) || { nombre: nombre, color: '#F5F6F8', marca: AppState.marcaInterior };

  AppState.materialEstructura = mat.nombre;
  AppState.materialInteriorHex = mat.color || '#F5F6F8';

  if (Array.isArray(AppState.modulos)) {
    AppState.modulos.forEach(m => {
      m.material_interior = AppState.materialEstructura;
    });
  }

  actualizarMuestraInteriorUI(mat);
  actualizarCanvas();
  if (AppState.despieceActual && AppState.despieceActual.length > 0) {
    generarDespieceEstimadoLocal();
  }
  mostrarNotificacion(`✨ Piezas interiores actualizadas a: ${mat.nombre}`, 'info');
}
window.onMaterialInteriorChange = onMaterialInteriorChange;

function copiarColorExteriorAInterior() {
  AppState.materialEstructura = AppState.materialFrentes;
  AppState.materialInteriorHex = AppState.materialColorHex;
  AppState.marcaInterior = AppState.marcaMelamina;
  
  const selMarcaInt = document.getElementById('selectMarcaInterior');
  if (selMarcaInt) selMarcaInt.value = AppState.marcaInterior;
  
  poblarSelectoresMateriales();
  const selMatInt = document.getElementById('selectMaterialInterior');
  if (selMatInt) selMatInt.value = AppState.materialEstructura;

  actualizarMuestraInteriorUI({ nombre: AppState.materialEstructura, color: AppState.materialInteriorHex, marca: AppState.marcaInterior });

  if (Array.isArray(AppState.modulos)) {
    AppState.modulos.forEach(m => {
      m.material_interior = AppState.materialEstructura;
    });
  }

  actualizarCanvas();
  if (AppState.despieceActual && AppState.despieceActual.length > 0) {
    generarDespieceEstimadoLocal();
  }
  mostrarNotificacion('Color exterior copiado a piezas interiores.', 'success');
}
window.copiarColorExteriorAInterior = copiarColorExteriorAInterior;

function onColorMdfChange(val) {
  AppState.colorMdf = val;
  const mapaHex = {
    'MDF Fondo Blanco 3mm': '#F8F9FA',
    'MDF Fondo Negro 3mm': '#1A1A1A',
    'MDF Fondo Grafito 3mm': '#374151',
    'MDF Fondo Roble 3mm': '#A07855',
    'MDF Fondo Haya 3mm': '#DEB887',
    'MDF Fondo Crudo 3mm': '#C8AD8D'
  };
  AppState.colorMdfHex = mapaHex[val] || '#F8F9FA';
  
  const lblMini = document.getElementById('lblNombreMdfMini');
  if (lblMini) lblMini.textContent = val;

  const archTex = (window.Preview3D && window.Preview3D.resolverArchivoTextura) ? window.Preview3D.resolverArchivoTextura(val) : null;
  const swatches = [document.getElementById('swatchColorMdf'), document.getElementById('swatchColorMdfMini')];
  swatches.forEach(swatch => {
    if (swatch) {
      if (archTex) {
        swatch.style.backgroundImage = `url('textures/${archTex}')`;
        swatch.style.backgroundSize = 'cover';
        swatch.style.backgroundPosition = 'center';
      } else {
        swatch.style.backgroundImage = 'none';
        swatch.style.background = AppState.colorMdfHex;
      }
    }
  });

  actualizarCanvas();
  if (AppState.despieceActual && AppState.despieceActual.length > 0) {
    generarDespieceEstimadoLocal();
  }
  mostrarNotificacion(`Fondo MDF 3mm: ${val}`, 'info');
}
window.onColorMdfChange = onColorMdfChange;

function actualizarMuestraMaterialUI(mat) {
  const lblNom = document.getElementById('lblNombreMaterialActivo');
  const lblDet = document.getElementById('lblDetalleMaterialActivo');
  const swatch = document.getElementById('swatchColorMaterial');
  if (lblNom) lblNom.textContent = mat.nombre;
  if (lblDet) lblDet.textContent = `${mat.marca || 'Pelikano'} • ${mat.categoria || 'Frontis'}`;

  // Etiquetas de la tarjeta lateral
  const lblMarcaCard = document.getElementById('lblMarcaMaterialCard');
  if (lblMarcaCard) lblMarcaCard.textContent = mat.marca || 'PELIKANO';

  // Modal elements
  const lblNomModal = document.getElementById('lblNombreMaterialActivoModal');
  const lblDetModal = document.getElementById('lblDetalleMaterialActivoModal');
  const swatchModal = document.getElementById('swatchColorMaterialModal');
  if (lblNomModal) lblNomModal.textContent = mat.nombre;
  if (lblDetModal) lblDetModal.textContent = `${mat.marca || 'Pelikano'} • ${mat.categoria || 'Frontis'}`;

  const archTex = (window.Preview3D && window.Preview3D.resolverArchivoTextura) ? window.Preview3D.resolverArchivoTextura(mat.nombre) : null;
  [swatch, swatchModal].forEach(s => {
    if (s) {
      if (archTex) {
        s.style.backgroundImage = `url('textures/${archTex}')`;
        s.style.backgroundSize = 'cover';
        s.style.backgroundPosition = 'center';
        s.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      } else {
        s.style.backgroundImage = 'none';
        s.style.background = mat.color || '#F5F6F8';
      }
    }
  });
}

function actualizarMuestraInteriorUI(mat) {
  const lblNom = document.getElementById('lblNombreMaterialInterior');
  const lblDet = document.getElementById('lblDetalleMaterialInterior');
  const swatch = document.getElementById('swatchColorInterior');
  if (lblNom) lblNom.textContent = mat.nombre;
  if (lblDet) lblDet.textContent = `${mat.marca || 'Pelikano'} • ${mat.categoria || 'Interior'}`;

  // Mini tarjeta lateral
  const lblMini = document.getElementById('lblNombreMaterialInteriorMini');
  const swatchMini = document.getElementById('swatchColorInteriorMini');
  if (lblMini) lblMini.textContent = mat.nombre;

  const archTex = (window.Preview3D && window.Preview3D.resolverArchivoTextura) ? window.Preview3D.resolverArchivoTextura(mat.nombre) : null;
  [swatch, swatchMini].forEach(s => {
    if (s) {
      if (archTex) {
        s.style.backgroundImage = `url('textures/${archTex}')`;
        s.style.backgroundSize = 'cover';
        s.style.backgroundPosition = 'center';
        s.style.borderColor = 'rgba(16, 185, 129, 0.5)';
      } else {
        s.style.backgroundImage = 'none';
        s.style.background = mat.color || '#F5F6F8';
      }
    }
  });
}

function onLuzFrentesChange(val) {
  const luz = parseFloat(val) || 3.0;
  AppState.luzFrentes = Math.max(0.5, Math.min(10.0, luz));

  const elInp = document.getElementById('dimLuzFrentes');
  if (elInp && parseFloat(elInp.value) !== AppState.luzFrentes) {
    elInp.value = AppState.luzFrentes;
  }

  const badge = document.getElementById('badgeLuzFrentes');
  if (badge) {
    badge.textContent = (AppState.luzFrentes === 3.0) ? '3.0 mm (Estándar)' : `${AppState.luzFrentes.toFixed(1)} mm`;
  }
  const inpModal = document.getElementById('modalInpLuzPuerta');
  if (inpModal) inpModal.value = AppState.luzFrentes;

  // Reacomodar todos los módulos y sus submódulos con la medida de luz seleccionada
  if (Array.isArray(AppState.modulos)) {
    AppState.modulos.forEach(m => {
      m.puertas_luz = AppState.luzFrentes;
      m.cajones_luz = AppState.luzFrentes;
      if (Array.isArray(m.submodulos)) {
        m.submodulos.forEach(sm => {
          sm.puertas_luz = AppState.luzFrentes;
          sm.cajones_luz = AppState.luzFrentes;
        });
      }
    });
  }

  // Revalidar límites técnicos y cotas de bisagras/correderas del módulo activo si corresponde
  if (AppState.moduloActivoIndex >= 0 && AppState.modulos[AppState.moduloActivoIndex]) {
    validarLimitesTecnicosModulo(AppState.modulos[AppState.moduloActivoIndex], AppState.moduloActivoIndex);
  }

  // Reacomodar y re-renderizar de inmediato toda la composición en el visor 3D
  actualizarCanvas();

  // Re-calcular la lista oficial de corte y despiece para reflejar las medidas netas exactas
  generarDespieceEstimadoLocal();

  mostrarNotificacion(`📐 Mueble reacomodado con luz perimetral: ${AppState.luzFrentes} mm`, 'info');
}
window.onLuzFrentesChange = onLuzFrentesChange;

// --- MODAL DE SELECCIÓN DE COLOR Y TEXTURA DE MELAMINA ---
function abrirModalSeleccionarMelamina() {
  const modal = document.getElementById('modalSeleccionarMelamina');
  if (!modal) return;
  poblarSelectoresMateriales();
  modal.style.display = 'flex';
}
window.abrirModalSeleccionarMelamina = abrirModalSeleccionarMelamina;

function cerrarModalSeleccionarMelamina() {
  const modal = document.getElementById('modalSeleccionarMelamina');
  if (modal) modal.style.display = 'none';
}
window.cerrarModalSeleccionarMelamina = cerrarModalSeleccionarMelamina;

// --- MODAL DE CONFIGURACIÓN DE PUERTAS ---
let _tempMontajePuerta = 'exterior';
let _tempPosicionBisagra = 'derecha';

function abrirModalConfigPuerta() {
  const modal = document.getElementById('modalConfigPuerta');
  if (!modal) return;
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const montaje = m.puertas_montaje || 'exterior';
  const pos = m.puertas_posicion_bisagra || m.puertas_apertura || 'derecha';
  const cantBis = m.puertas_cant_bisagras || 'auto';
  const luz = (m.puertas_luz !== undefined) ? m.puertas_luz : (AppState.luzFrentes || 3.0);

  seleccionarMontajePuertaModal(montaje);
  seleccionarPosicionBisagraModal(pos);

  const selCant = document.getElementById('modalSelCantBisagras');
  if (selCant) selCant.value = cantBis;

  const inpLuz = document.getElementById('modalInpLuzPuerta');
  if (inpLuz) inpLuz.value = luz;

  modal.style.display = 'flex';
}
window.abrirModalConfigPuerta = abrirModalConfigPuerta;

function cerrarModalConfigPuerta() {
  const modal = document.getElementById('modalConfigPuerta');
  if (modal) modal.style.display = 'none';
}
window.cerrarModalConfigPuerta = cerrarModalConfigPuerta;

function seleccionarMontajePuertaModal(montaje) {
  _tempMontajePuerta = montaje;
  const btns = {
    'exterior': document.getElementById('btnMontajeExterior'),
    'medio': document.getElementById('btnMontajeMedio'),
    'interior': document.getElementById('btnMontajeInterior')
  };
  Object.keys(btns).forEach(k => {
    const b = btns[k];
    if (!b) return;
    if (k === montaje) {
      b.style.border = '2px solid var(--primary)';
      b.style.background = 'rgba(59, 130, 246, 0.12)';
    } else {
      b.style.border = '1px solid var(--border-color)';
      b.style.background = 'transparent';
    }
  });
}
window.seleccionarMontajePuertaModal = seleccionarMontajePuertaModal;

function seleccionarPosicionBisagraModal(pos) {
  _tempPosicionBisagra = pos;
  const btns = {
    'derecha': document.getElementById('btnPosDerecha'),
    'izquierda': document.getElementById('btnPosIzquierda'),
    'doble': document.getElementById('btnPosDoble'),
    'superior': document.getElementById('btnPosSuperior'),
    'inferior': document.getElementById('btnPosInferior'),
    'corrediza': document.getElementById('btnPosCorrediza')
  };
  Object.keys(btns).forEach(k => {
    const b = btns[k];
    if (!b) return;
    if (k === pos) {
      b.style.border = '2px solid var(--primary)';
      b.style.background = 'rgba(59, 130, 246, 0.12)';
    } else {
      b.style.border = '1px solid var(--border-color)';
      b.style.background = 'transparent';
    }
  });

  const boxInfo = document.getElementById('modalBoxInfoCazoletas');
  if (boxInfo) {
    if (pos === 'corrediza') {
      boxInfo.innerHTML = '★ <strong>Sistema Corredizo de 2 Vías:</strong> Riel superior e inferior de aluminio anodizado con rodamientos silenciosos | <strong>Descuento automático de 80mm</strong> a la profundidad interior de repisas y cajones para libre recorrido de las hojas traslapadas.';
    } else if (pos === 'superior') {
      boxInfo.innerHTML = '★ <strong>Pistón a Gas Elevable:</strong> Apertura hacia arriba a 80° para muebles aéreos | Requiere 2 pistones neumáticos (80N a 120N) | Bisagras rectas 0mm.';
    } else if (pos === 'inferior') {
      boxInfo.innerHTML = '★ <strong>Pistón Gas Inverso / Abatible:</strong> Apertura hacia abajo a 80° | Retenedores o compases con freno.';
    } else {
      boxInfo.innerHTML = 'Perforación estándar: Ø35mm × 11.5mm prof. | Margen K = 4.5mm (centro a 22mm del borde) | Tapacanto grueso 2mm en los 4 bordes.';
    }
  }
}
window.seleccionarPosicionBisagraModal = seleccionarPosicionBisagraModal;

function confirmarConfigPuertaModal() {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.tiene_puertas = true;
  m.puertas_montaje = _tempMontajePuerta || 'exterior';
  m.puertas_posicion_bisagra = _tempPosicionBisagra || 'derecha';
  m.puertas_apertura = _tempPosicionBisagra || 'derecha';

  if (_tempPosicionBisagra === 'corrediza') {
    // Garantizar descuento normativo de 80mm en profundidad para rieles de 2 vías
    m.descuento_frontal = Math.max(80, parseFloat(m.descuento_frontal) || 80);
    const inpDescF = document.getElementById('modDescuentoFrontal');
    if (inpDescF) inpDescF.value = m.descuento_frontal;
  }

  const selCant = document.getElementById('modalSelCantBisagras');
  if (selCant) m.puertas_cant_bisagras = selCant.value;

  const inpLuz = document.getElementById('modalInpLuzPuerta');
  if (inpLuz) m.puertas_luz = parseFloat(inpLuz.value) || AppState.luzFrentes || 3.0;

  const chkPuertas = document.getElementById('modTienePuertas');
  if (chkPuertas) chkPuertas.checked = true;

  const selPos = document.getElementById('modPuertasPosicionBisagra');
  if (selPos) selPos.value = m.puertas_posicion_bisagra;

  const selMont = document.getElementById('modPuertasMontaje');
  if (selMont) selMont.value = m.puertas_montaje;

  const btnConfig = document.getElementById('btnConfigurarPuerta');
  if (btnConfig) btnConfig.style.display = 'inline-block';

  const grpPuertas = document.getElementById('grpDetallePuertas');
  if (grpPuertas) grpPuertas.style.display = 'block';

  cerrarModalConfigPuerta();
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
  sincronizarFormularioModulo();

  if (AppState.despieceActual && AppState.despieceActual.length > 0) {
    generarDespieceEstimadoLocal();
  }

  const descHojas = (m.puertas_posicion_bisagra === 'doble') ? '2 Hojas Batiente Doble' :
                    (m.puertas_posicion_bisagra === 'superior') ? '1 Hoja Superior con Pistón a Gas' :
                    `1 Hoja (${m.puertas_posicion_bisagra === 'derecha' ? 'Derecha' : 'Izquierda'})`;
  mostrarNotificacion(`🚪 Puerta configurada: ${m.puertas_montaje} • ${descHojas}`, 'success');
}
window.confirmarConfigPuertaModal = confirmarConfigPuertaModal;

/**
 * Inicializa el cargador de plantillas y selectores dinámicos al iniciar la app.
 */
function inicializarSelectorPlantillas() {
  recargarCatalogoPerfiles();
}

/**
 * Recarga el catálogo de perfiles desde todas las fuentes posibles (IPC, HTTP o Respaldo Offline).
 */
function recargarCatalogoPerfiles() {
  // 1. Respaldo local inmediato en memoria (100% garantizado y síncrono al cargar la app)
  const respaldoLocal = window.JPQ_PERFILES_CONFIG || window.PERFILES_CONFIG_FALLBACK;
  if (respaldoLocal) {
    procesarDatosPerfiles(respaldoLocal);
  }

  // 2. Si estamos en el entorno de SketchUp, solicitar por IPC
  if (typeof window.callSketchup === 'function') {
    window.callSketchup('obtenerPerfilesUsuario', '');
  }

  // 3. Intentar fetch si estamos en un servidor web local (http o https)
  if (typeof fetch === 'function' && location.protocol && location.protocol.startsWith('http')) {
    fetch('perfiles_config.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(datos => procesarDatosPerfiles(datos))
      .catch(() => {
        fetch('../perfiles_config.json')
          .then(res => res.json())
          .then(datos => procesarDatosPerfiles(datos))
          .catch(() => {});
      });
  }
}

/**
 * Procesa el objeto JSON de perfiles y lo convierte en un arreglo ordenado en AppState.
 * @param {object} datos - Datos del archivo perfiles_config.json
 */
function procesarDatosPerfiles(datos) {
  if (!datos) return;
  const diccionario = datos.perfiles || datos;
  if (typeof diccionario !== 'object') return;

  const lista = [];
  Object.keys(diccionario).forEach(key => {
    const p = diccionario[key];
    if (p && typeof p === 'object') {
      if (!p.id) p.id = key;
      if (!p.ambiente) p.ambiente = 'General';
      if (!p.edad_genero) p.edad_genero = 'Universal';
      if (!p.ancho_sugerido) p.ancho_sugerido = 1200;
      if (!p.alto_sugerido) p.alto_sugerido = 800;
      if (!p.prof_baja) p.prof_baja = p.prof_alta || 600;
      lista.push(p);
    }
  });

  AppState.catalogoPerfiles = lista;

  // Actualizar los 3 selectores en cascada
  poblarSelectoresCascada('todos', 'todos', null);
}

/**
 * Puebla en cascada los tres selectores desplegables:
 * 1. Ambiente
 * 2. Edad / Género
 * 3. Mueble Prediseñado
 * @param {string} ambienteSel - Ambiente seleccionado ('todos' o nombre exacto)
 * @param {string} edadSel - Edad/Género seleccionada ('todos' o nombre exacto)
 * @param {string|null} muebleSelId - ID de mueble a seleccionar si existe
 */
function poblarSelectoresCascada(ambienteSel = 'todos', edadSel = 'todos', muebleSelId = null) {
  const selAmb = document.getElementById('selAmbientePreset');
  const selEdad = document.getElementById('selEdadGeneroPreset');
  const selMue = document.getElementById('selMueblePreset');
  if (!selAmb || !selEdad || !selMue) return;

  const catalogo = AppState.catalogoPerfiles || [];

  // --------------------------------------------------------------------------
  // PASO 1: Poblar Selector de Ambientes dinámicamente desde el conjunto de datos
  // --------------------------------------------------------------------------
  const ambientesUnicos = Array.from(new Set(catalogo.map(p => p.ambiente).filter(Boolean))).sort();

  selAmb.innerHTML = '';
  const optAmbTodos = document.createElement('option');
  optAmbTodos.value = 'todos';
  optAmbTodos.textContent = `🌐 Todos los Ambientes (${catalogo.length})`;
  selAmb.appendChild(optAmbTodos);

  ambientesUnicos.forEach(amb => {
    const cant = catalogo.filter(p => p.ambiente === amb).length;
    const icono = ICONOS_AMBIENTES[amb] || '🚪';
    const opt = document.createElement('option');
    opt.value = amb;
    opt.textContent = `${icono} ${amb} (${cant})`;
    selAmb.appendChild(opt);
  });

  if (ambienteSel !== 'todos' && ambientesUnicos.includes(ambienteSel)) {
    selAmb.value = ambienteSel;
  } else {
    selAmb.value = 'todos';
  }
  const ambienteActivo = selAmb.value;

  // --------------------------------------------------------------------------
  // PASO 2: Poblar Selector de Edad / Género filtrado por el ambiente activo
  // --------------------------------------------------------------------------
  const perfilesPorAmbiente = (ambienteActivo === 'todos')
    ? catalogo
    : catalogo.filter(p => p.ambiente === ambienteActivo);

  const edadesUnicas = Array.from(new Set(perfilesPorAmbiente.map(p => p.edad_genero).filter(Boolean))).sort();

  selEdad.innerHTML = '';
  const optEdadTodas = document.createElement('option');
  optEdadTodas.value = 'todos';
  optEdadTodas.textContent = `👥 Todas las Edades / Géneros (${perfilesPorAmbiente.length})`;
  selEdad.appendChild(optEdadTodas);

  edadesUnicas.forEach(edad => {
    const cant = perfilesPorAmbiente.filter(p => p.edad_genero === edad).length;
    const icono = ICONOS_EDAD_GENERO[edad] || '👤';
    const opt = document.createElement('option');
    opt.value = edad;
    opt.textContent = `${icono} ${edad} (${cant})`;
    selEdad.appendChild(opt);
  });

  if (edadSel !== 'todos' && edadesUnicas.includes(edadSel)) {
    selEdad.value = edadSel;
  } else {
    selEdad.value = 'todos';
  }
  const edadActiva = selEdad.value;

  // --------------------------------------------------------------------------
  // PASO 3: Poblar Selector de Muebles Prediseñados filtrado por Ambiente y Edad
  // --------------------------------------------------------------------------
  const mueblesFiltrados = perfilesPorAmbiente
    .filter(p => (edadActiva === 'todos' || p.edad_genero === edadActiva))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { numeric: true, sensitivity: 'base' }));

  selMue.innerHTML = '';

  if (mueblesFiltrados.length === 0) {
    const optVacio = document.createElement('option');
    optVacio.value = '';
    optVacio.textContent = '(Sin modelos para esta combinación)';
    selMue.appendChild(optVacio);
  } else if (ambienteActivo === 'todos') {
    // Si están todos los ambientes, agrupar con optgroup para máxima claridad visual
    const grupos = {};
    mueblesFiltrados.forEach(p => {
      const ambKey = p.ambiente || 'Otros';
      if (!grupos[ambKey]) grupos[ambKey] = [];
      grupos[ambKey].push(p);
    });

    Object.keys(grupos).sort().forEach(nombreAmb => {
      const optgroup = document.createElement('optgroup');
      const iconoAmb = ICONOS_AMBIENTES[nombreAmb] || '🚪';
      optgroup.label = `${iconoAmb} ${nombreAmb}`;
      grupos[nombreAmb].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { numeric: true, sensitivity: 'base' })).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        const d = p.prof_baja || p.prof_alta || 600;
        opt.textContent = `${p.icono || '🪵'} ${p.nombre} (${p.ancho_sugerido}×${p.alto_sugerido}×${d} mm)`;
        optgroup.appendChild(opt);
      });
      selMue.appendChild(optgroup);
    });
  } else {
    // Ambiente específico seleccionado
    mueblesFiltrados.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const d = p.prof_baja || p.prof_alta || 600;
      opt.textContent = `${p.icono || '🪵'} ${p.nombre} (${p.ancho_sugerido}×${p.alto_sugerido}×${d} mm)`;
      selMue.appendChild(opt);
    });
  }

  // Preseleccionar según parámetro o primer elemento
  if (muebleSelId && mueblesFiltrados.some(p => p.id === muebleSelId)) {
    selMue.value = muebleSelId;
  } else if (mueblesFiltrados.length > 0) {
    selMue.value = mueblesFiltrados[0].id;
  }

  // Actualizar tarjeta resumen y badge numérico
  const actualId = selMue.value;
  const presetActual = catalogo.find(p => p.id === actualId) || mueblesFiltrados[0];
  actualizarTarjetaResumenPreset(presetActual);

  const badge = document.getElementById('badgeTotalPlantillas');
  if (badge) {
    badge.textContent = `${mueblesFiltrados.length} Modelos`;
  }
}

/**
 * Evento al cambiar el ambiente en la lista desplegable 1.
 * @param {string} ambiente - Código o nombre del ambiente seleccionado
 */
function onAmbientePresetChange(ambiente) {
  // Conservar edad/género si es compatible, de lo contrario resetear a 'todos'
  const selEdad = document.getElementById('selEdadGeneroPreset');
  const edadActual = selEdad ? selEdad.value : 'todos';

  poblarSelectoresCascada(ambiente, edadActual, null);

  const selMueble = document.getElementById('selMueblePreset');
  if (selMueble && selMueble.value) {
    onMueblePresetChange(selMueble.value, true);
  }
}

/**
 * Evento al cambiar la edad / género en la lista desplegable 2.
 * @param {string} edad - Categoría de edad / género seleccionada
 */
function onEdadGeneroPresetChange(edad) {
  const selAmb = document.getElementById('selAmbientePreset');
  const ambActual = selAmb ? selAmb.value : 'todos';

  poblarSelectoresCascada(ambActual, edad, null);

  const selMueble = document.getElementById('selMueblePreset');
  if (selMueble && selMueble.value) {
    onMueblePresetChange(selMueble.value, true);
  }
}

/**
 * Evento al cambiar el mueble en la lista desplegable 3.
 * @param {string} muebleId - ID del mueble prediseñado
 * @param {boolean} autoAplicar - Si true, aplica el mueble de inmediato
 */
function onMueblePresetChange(muebleId, autoAplicar = true) {
  const catalogo = AppState.catalogoPerfiles || [];
  const preset = catalogo.find(p => p.id === muebleId);
  if (!preset) return;

  actualizarTarjetaResumenPreset(preset);

  if (autoAplicar) {
    aplicarPresetMobiliario(muebleId);
  }
}

/**
 * Actualiza la tarjeta visual resumen con las especificaciones del mueble seleccionado.
 * @param {object} preset - Objeto de datos del perfil
 */
function actualizarTarjetaResumenPreset(preset) {
  if (!preset) return;
  const lblNom = document.getElementById('lblPresetNombre');
  const lblCot = document.getElementById('lblPresetCotas');
  const lblDet = document.getElementById('lblPresetDetalle');
  const lblAmb = document.getElementById('lblPresetAmbienteBadge');
  const lblEdad = document.getElementById('lblPresetEdadBadge');

  const w = preset.ancho_sugerido || 1200;
  const h = preset.alto_sugerido || 800;
  const d = preset.prof_baja || preset.prof_alta || 600;
  const icono = preset.icono || '🪵';

  if (lblNom) lblNom.innerHTML = `${icono} ${preset.nombre}`;
  if (lblCot) lblCot.textContent = `${w} × ${h} × ${d} mm`;
  if (lblAmb) lblAmb.textContent = preset.ambiente || 'General';
  if (lblEdad) lblEdad.textContent = preset.edad_genero || 'Universal';

  const lblRh = document.getElementById('lblPresetRhBadge');
  if (lblRh) {
    const esRH = (preset.material_resistencia === 'RH');
    lblRh.style.display = esRH ? 'inline-flex' : 'none';
  }

  if (lblDet) {
    const tieneZ = preset.altura_zocalo > 0;
    const zocaloInfo = tieneZ ? `Zócalo ${preset.altura_zocalo}mm` : 'Sin Zócalo';
    const cantMods = (Array.isArray(preset.modulos_sugeridos) && preset.modulos_sugeridos.length > 0)
      ? `${preset.modulos_sugeridos.length} Módulos prediseñados`
      : 'Estructura adaptable';
    const tagRH = (preset.material_resistencia === 'RH') ? '<strong style="color:#059669;"> • 🛡️ Melamina RH Antihumedad</strong>' : '';
    lblDet.innerHTML = `<strong>${zocaloInfo}</strong> • <em>${cantMods}</em>${tagRH} • ${preset.descripcion || ''}`;
  }
}

/**
 * Actualiza los indicadores visuales de Melamina RH en la interfaz de usuario.
 */
function actualizarIndicadorRHUI() {
  const isRH = (AppState.resistencia === 'RH');
  const b1 = document.getElementById('badgeIndicadorRH');
  if (b1) b1.style.display = isRH ? 'inline-block' : 'none';
  const b2 = document.getElementById('lblPresetRhBadge');
  if (b2 && AppState.catalogoPerfiles) {
    b2.style.display = isRH ? 'inline-flex' : 'none';
  }
  const selRes = document.getElementById('selectResistenciaMelamina');
  if (selRes && selRes.value !== AppState.resistencia) {
    selRes.value = AppState.resistencia;
  }
}

/**
 * Maneja el cambio de resistencia/sustrato (Normal vs RH) desde el selector de Melamina.
 * @param {string} val - 'Normal' o 'RH'
 */
function onResistenciaMelaminaChange(val) {
  AppState.resistencia = val || 'Normal';
  actualizarIndicadorRHUI();
  actualizarBadgeEstado();
  actualizarCanvas();

  if (AppState.despieceActual && AppState.despieceActual.length > 0) {
    generarDespieceEstimadoLocal();
  }

  if (val === 'RH') {
    mostrarNotificacion('🛡️ Melamina RH Hidrófuga activada (núcleo verde para ambientes húmedos: Cocina, Baño y Lavandería).', 'success');
  } else {
    mostrarNotificacion('Tablero Estándar seleccionado (núcleo madera para ambientes secos: Dormitorio, Sala, Oficina).', 'info');
  }
}

/**
 * Aplica explícitamente la plantilla seleccionada actualmente en el selector.
 */
function ejecutarAplicacionPresetSeleccionado() {
  const selMueble = document.getElementById('selMueblePreset');
  if (selMueble && selMueble.value) {
    aplicarPresetMobiliario(selMueble.value);
  }
}

/**
 * Aplica un mueble prediseñado según las especificaciones del archivo JSON.
 * @param {string} tipo - Identificador del perfil prediseñado
 */
function aplicarPresetMobiliario(tipo) {
  const catalogo = AppState.catalogoPerfiles || [];
  const preset = catalogo.find(p => p.id === tipo) || catalogo[0];
  if (!preset) return;

  const w = preset.ancho_sugerido || 1200;
  const h = preset.alto_sugerido || 800;
  const d = preset.prof_baja || preset.prof_alta || 600;
  const tieneZ = (preset.altura_zocalo && preset.altura_zocalo > 0);
  const altoZ = tieneZ ? preset.altura_zocalo : 0;
  const retransZ = preset.retrans_zocalo !== undefined ? preset.retrans_zocalo : 35;
  const cantL = preset.cant_listones_zocalo !== undefined ? preset.cant_listones_zocalo : 2;
  const descTecnica = `${preset.nombre}: ${preset.descripcion || ''}`;

  // Sincronizar selectores si difieren
  const selMue = document.getElementById('selMueblePreset');
  if (selMue && selMue.value !== tipo) {
    selMue.value = tipo;
  }
  actualizarTarjetaResumenPreset(preset);

  // Asignar cotas a la interfaz
  const elW = document.getElementById('dimAnchoTotal');
  const elH = document.getElementById('dimAltoTotal');
  const elD = document.getElementById('dimProfTotal');
  if (elW) elW.value = w;
  if (elH) elH.value = h;
  if (elD) elD.value = d;

  AppState.tieneZocalo = tieneZ;
  AppState.altoZocalo = altoZ;
  AppState.retransZocalo = retransZ;
  AppState.cantListonesZocalo = cantL;

  // Sincronizar resistencia de melamina (RH vs Normal) desde la plantilla JSON
  const resPreset = preset.material_resistencia || 'Normal';
  AppState.resistencia = resPreset;
  const selRes = document.getElementById('selectResistenciaMelamina');
  if (selRes) selRes.value = resPreset;
  actualizarIndicadorRHUI();

  // Sincronizar modo de tapacanto desde la plantilla JSON (Grueso 2mm frentes, Delgado 0.5mm interior)
  const tFrentes = preset.tapacanto_frentes || 'Grueso_2mm';
  const tInterior = preset.tapacanto_interior || 'Delgado_0.5mm';
  let modoTap = 'estandar';
  if (tInterior === 'Grueso_2mm') {
    modoTap = 'premium';
  } else if (tFrentes === 'Delgado_0.5mm') {
    modoTap = 'economico';
  }
  AppState.modoTapacanto = modoTap;
  actualizarSelectoresModoTapacanto(modoTap);

  const elRetrans = document.getElementById('muebleRetransZocalo');
  if (elRetrans) elRetrans.value = retransZ;
  const elAltoZ = document.getElementById('muebleAltoZocalo');
  if (elAltoZ) elAltoZ.value = altoZ;
  const elCantL = document.getElementById('muebleCantListones');
  if (elCantL) elCantL.value = cantL;

  actualizarUIZocaloGeneral();

  // Verificar si el usuario tiene activo el auto-armado modular desde el JSON
  const chkAuto = document.getElementById('chkAutoArmarModulos');
  if (chkAuto && chkAuto.checked) {
    armarEstructuraModularDesdePerfil(preset);
    mostrarNotificacion(`⚡ ${preset.nombre}: Módulos y cotas configurados dinámicamente desde JSON.`, "success");
  } else {
    onDimensionesGeneralesChange();
    mostrarNotificacion(descTecnica || `Plantilla aplicada: ${w} x ${h} x ${d} mm`, "info");
  }
}

/**
 * Calcula la cantidad y medida recomendada de listones posteriores según estándares técnicos
 * de carpintería modular y física de carga (altura, ancho y peso/uso del módulo).
 * 
 * Reglas de estándar industrial:
 * - Altura <= 450 mm (altillos, módulos sobre campana/nevera, peso ligero): 1 listón superior (medida 70 mm).
 * - Altura 450 a 1200 mm (muebles bajos y aéreos estándar):
 *     - Si es cajonera pesada o ancho >= 900 mm: 3 listones (medida 100 mm).
 *     - Estándar: 2 listones (superior e inferior, medida 80 mm).
 * - Altura 1200 a 1800 mm (muebles medianos/altos, despensas medianas): 3 listones (medida 80-100 mm).
 * - Altura 1800 a 2300 mm (torres, columnas, roperos/closets estándar): 4 listones (medida 100 mm).
 * - Altura > 2300 mm (muebles extra altos de piso a techo): 5 listones (medida 100 mm).
 * 
 * @param {number} alto - Altura total del módulo en mm.
 * @param {number} ancho - Ancho del módulo en mm.
 * @param {string} tipoInterior - Tipo de interior ('repisas', 'cajonera', 'puertas', etc.).
 * @param {object} [opciones] - Opciones adicionales ({ esPesado: boolean, cantCajones: number }).
 * @returns {{ cant: number, medida: number, orientacion: string }}
 */
function calcularEstandarListonesPosteriores(alto, ancho, tipoInterior = '', opciones = {}) {
  const h = parseFloat(alto) || 800;
  const w = parseFloat(ancho) || 600;
  const esPesado = opciones.esPesado === true ||
                   tipoInterior === 'cajonera' ||
                   (opciones.cantCajones && opciones.cantCajones >= 2) ||
                   tipoInterior === 'horno' ||
                   w >= 900;

  let cant = 2;
  let medida = 80;

  if (h <= 450) {
    // 1 listón: Módulos bajos, altillos pequeños de peso ligero
    cant = 1;
    medida = 70;
  } else if (h <= 1200) {
    // 2 listones estándar (Superior + Inferior), o 3 si es carga pesada o ancho grande
    if (esPesado && h >= 800) {
      cant = 3;
      medida = 100;
    } else {
      cant = 2;
      medida = esPesado ? 100 : 80;
    }
  } else if (h <= 1800) {
    // 3 listones: Módulos medianos/altos (Superior, Central, Inferior)
    cant = 3;
    medida = esPesado ? 100 : 80;
  } else if (h <= 2300) {
    // 4 listones: Torres, columnas altas y roperos/closets estándar
    cant = 4;
    medida = 100;
  } else {
    // 5 listones: Módulos de piso a techo de gran envergadura
    cant = 5;
    medida = 100;
  }

  return {
    cant,
    medida,
    orientacion: 'horizontal'
  };
}

/**
 * Arma la estructura modular completa desde la definición JSON del perfil.
 * Si el perfil incluye 'modulos_sugeridos', los genera con precisión matemática milimétrica.
 * Si no incluye 'modulos_sugeridos', calcula una distribución modular ergonómica anti-pandeo.
 * @param {object} perfil - Objeto del perfil prediseñado
 */
function armarEstructuraModularDesdePerfil(perfil) {
  if (!perfil) return;

  const w = perfil.ancho_sugerido || 1200;
  const h = perfil.alto_sugerido || 800;
  const d = perfil.prof_baja || perfil.prof_alta || 600;
  const tieneZ = (perfil.altura_zocalo && perfil.altura_zocalo > 0);
  const altoZ = tieneZ ? perfil.altura_zocalo : 0;

  AppState.anchoTotal = w;
  AppState.altoTotal = h;
  AppState.profTotal = d;
  AppState.tieneZocalo = tieneZ;
  AppState.altoZocalo = altoZ;

  const altoDisponible = h - (tieneZ ? altoZ : 0);
  const modulos = [];

  const crearModulo = (idx, nombre, ancho, tipoInt, repisas = 0, cajones = 0, tienePiso = true, tieneTecho = true, tieneLaterales = true, tieneFondo = false, altoMod = null, profMod = null, colIdx = null, nivelApilado = 0) => {
    const altoEfectivo = (altoMod && altoMod > 0) ? altoMod : altoDisponible;
    const stdInicial = calcularEstandarListonesPosteriores(altoEfectivo, ancho, tipoInt, { cantCajones: cajones });

    return {
      id: idx + 1,
      nombre: nombre || `Módulo ${idx + 1}`,
      columna_idx: (colIdx !== null && colIdx !== undefined) ? colIdx : idx,
      nivel_apilado: (nivelApilado !== null && nivelApilado !== undefined) ? nivelApilado : 0,
      ancho: ancho,
      alto: altoEfectivo,
      profundidad: (profMod && profMod > 0) ? profMod : d,
      tiene_zocalo: false,
      alto_zocalo: 0,
      retrans_zocalo: AppState.retransZocalo || 35,
      cant_listones: 0,
      cant_listones_internos: 0,
      tiene_laterales: tieneLaterales,
      tiene_piso: tienePiso,
      tiene_liston_piso: false,
      cant_listones_piso: 2,
      medida_liston_piso: 80,
      tiene_zocalo_sup: false,
      alto_zocalo_sup: 70,
      tiene_liston_post: true,
      orientacion_liston_post: 'horizontal',
      cant_listones_post: tienePiso ? ((perfil && perfil.cant_amarres) ? perfil.cant_amarres : stdInicial.cant) : 1,
      ancho_liston_post: stdInicial.medida,
      medida_liston_post: stdInicial.medida,
      tiene_techo: tieneTecho,
      tiene_liston_techo: false,
      cant_listones_techo: 2,
      medida_liston_techo: 80,
      techo_sobre_liston: false,
      techo_doble_melamina: false,
      tiene_liston_amarre: true,
      cant_listones_amarre: (perfil && perfil.cant_amarres) ? perfil.cant_amarres : stdInicial.cant,
      alto_liston_amarre: stdInicial.medida,
      posicion_liston_amarre: 'posterior',
      tiene_fondo: tieneFondo,
      tipo_fondo: 'mdf',
      alto_fondo_melamina: null,
      dist_fondo_melamina: 0,
      panel_tiene_listones_pared: true,
      panel_orientacion_listones: 'horizontal',
      cant_listones_panel: 2,
      medida_liston_panel: 80,
      tiene_fondo_mdf: tieneFondo,
      grosor_mdf: 3,
      posicion_fondo_mdf: 'delante_liston',
      ancho_ranura_mdf: 4,
      prof_ranura_mdf: 8,
      dist_ranura_mdf: (perfil && perfil.distancia_ranura !== undefined) ? perfil.distancia_ranura : 18,
      posicion_fondo_melamina: 'embutido',
      tipo_interior: tipoInt,
      cant_repisas: repisas,
      cant_cajones: cajones,
      material_frentes: AppState.materialFrentes || 'Pelikano Blanco Nieve 18mm',
      material_interior: AppState.materialEstructura || 'Pelikano Blanco Nieve 18mm',
      parantes_tipo: 'ninguno',
      parantes: [],
      espacios_repisas: [],

      // Puertas independientes (por defecto exteriores según estándares industriales)
      tiene_puertas: (tipoInt === 'puertas'),
      puertas_montaje: 'exterior',
      puertas_posicion_bisagra: (ancho > 600) ? 'doble' : 'derecha',
      puertas_cant_bisagras: 'auto',
      puertas_luz: (AppState.luzFrentes !== undefined) ? AppState.luzFrentes : 3.0,
      puertas_liston_tope: 'ninguno',

      // Cajonera industrial (por defecto tapas externas sobrepuestas)
      cajones_montaje: 'exterior',
      cajones_tipo_corredera: 'telescopica',
      cajones_posicion_corredera: 'baja',
      cajones_largo_corredera: 'auto',
      cajones_luz: (AppState.luzFrentes !== undefined) ? AppState.luzFrentes : 3.0
    };
  };

  // Verificación dinámica de módulos sugeridos en el JSON
  if (Array.isArray(perfil.modulos_sugeridos) && perfil.modulos_sugeridos.length > 0) {
    const hayColumnasExplicitas = perfil.modulos_sugeridos.some(ms => ms.columna_idx !== undefined && ms.columna_idx !== null);

    // Mapeo de columna a array de módulos sugeridos
    const columnasMap = new Map();
    perfil.modulos_sugeridos.forEach((ms, idx) => {
      const cIdx = hayColumnasExplicitas
        ? ((ms.columna_idx !== undefined && ms.columna_idx !== null) ? ms.columna_idx : idx)
        : idx;
      if (!columnasMap.has(cIdx)) columnasMap.set(cIdx, []);
      columnasMap.get(cIdx).push({ ms, originalIdx: idx });
    });

    const colIndices = Array.from(columnasMap.keys()).sort((a, b) => a - b);
    const cantColumnas = colIndices.length;

    // Calcular ancho de cada columna a lo largo del eje X (ancho total w)
    let anchoRestante = w;
    const columnasVariables = [];
    const anchosPorColumna = {};

    colIndices.forEach(cIdx => {
      const items = columnasMap.get(cIdx);
      const itemConAnchoFijo = items.find(it => it.ms.ancho_fijo && it.ms.ancho_fijo > 0);
      if (itemConAnchoFijo) {
        anchosPorColumna[cIdx] = itemConAnchoFijo.ms.ancho_fijo;
        anchoRestante -= itemConAnchoFijo.ms.ancho_fijo;
      } else {
        columnasVariables.push(cIdx);
      }
    });

    // Suma de proporciones de columnas variables
    let sumaProporciones = 0;
    columnasVariables.forEach(cIdx => {
      const items = columnasMap.get(cIdx);
      const propItem = items.find(it => it.ms.ancho_proporcional && it.ms.ancho_proporcional > 0);
      const prop = propItem ? propItem.ms.ancho_proporcional : (1 / (columnasVariables.length || 1));
      sumaProporciones += prop;
    });

    let anchoAcumulado = 0;
    colIndices.forEach((cIdx, colSeq) => {
      let anchoCol = 0;
      if (anchosPorColumna[cIdx] !== undefined) {
        anchoCol = anchosPorColumna[cIdx];
      } else if (colSeq === cantColumnas - 1) {
        // La última columna absorbe la diferencia exacta para garantizar suma = w
        anchoCol = Math.max(100, w - anchoAcumulado);
      } else {
        const items = columnasMap.get(cIdx);
        const propItem = items.find(it => it.ms.ancho_proporcional && it.ms.ancho_proporcional > 0);
        const prop = propItem ? propItem.ms.ancho_proporcional : (1 / (columnasVariables.length || 1));
        anchoCol = Math.round((anchoRestante * prop) / (sumaProporciones || 1));
      }
      anchosPorColumna[cIdx] = anchoCol;
      anchoAcumulado += anchoCol;
    });

    // Ahora crear cada módulo con sus dimensiones precisas (ancho de columna y altura individual)
    perfil.modulos_sugeridos.forEach((ms, idx) => {
      const cIdx = hayColumnasExplicitas
        ? ((ms.columna_idx !== undefined && ms.columna_idx !== null) ? ms.columna_idx : idx)
        : idx;
      const anchoMod = (ms.ancho_fijo && ms.ancho_fijo > 0) ? ms.ancho_fijo : (anchosPorColumna[cIdx] || 600);

      const itemsCol = columnasMap.get(cIdx);
      let altoMod = ms.alto;
      if (!altoMod || altoMod <= 0) {
        if (itemsCol.length <= 1) {
          altoMod = altoDisponible;
        } else {
          let altoOcupado = 0;
          let cantSinAlto = 0;
          itemsCol.forEach(it => {
            if (it.ms.alto && it.ms.alto > 0) altoOcupado += it.ms.alto;
            else cantSinAlto++;
          });
          const altoRestanteCol = Math.max(100, altoDisponible - altoOcupado);
          altoMod = Math.round(altoRestanteCol / (cantSinAlto || 1));
        }
      }

      const nivelMod = (ms.nivel_apilado !== undefined && ms.nivel_apilado !== null) ? ms.nivel_apilado : 0;

      const debeTenerFondo = (ms.tiene_fondo !== undefined)
        ? !!ms.tiene_fondo
        : (perfil.ranura_fondo !== false && perfil.ranura_fondo !== undefined);

      const mod = crearModulo(
        idx,
        ms.nombre || `Módulo ${idx + 1}`,
        anchoMod,
        ms.tipo_interior || 'repisas',
        ms.cant_repisas !== undefined ? ms.cant_repisas : 0,
        ms.cant_cajones !== undefined ? ms.cant_cajones : 0,
        ms.tiene_piso !== undefined ? ms.tiene_piso : true,
        ms.tiene_techo !== undefined ? ms.tiene_techo : true,
        ms.tiene_laterales !== undefined ? ms.tiene_laterales : true,
        debeTenerFondo,
        altoMod,
        ms.profundidad,
        cIdx,
        nivelMod
      );

      // REGLA TÉCNICA: En muebles prediseñados con fondo MDF se aplican los estándares y medidas permitidas
      // para los listones posteriores pudiendo ser 1, 2, 3 o más según altura y peso, siendo editables en la UI
      if (debeTenerFondo) {
        mod.tiene_fondo = true;
        mod.tipo_fondo = ms.tipo_fondo || 'mdf';
        mod.tiene_fondo_mdf = (mod.tipo_fondo === 'mdf');
        if (mod.tiene_fondo_mdf) {
          mod.posicion_fondo_mdf = ms.posicion_fondo_mdf || 'delante_liston';
          mod.grosor_mdf = parseFloat(ms.grosor_mdf || perfil.espesor_mdf) || 3;
          mod.ancho_ranura_mdf = parseFloat(ms.ancho_ranura_mdf) || (mod.grosor_mdf + 1);
          mod.prof_ranura_mdf = parseFloat(ms.prof_ranura_mdf) || 8;
          // Retranqueo de 18 mm mínimo para colocar los listones de amarre a pared por detrás
          const distRanuraPreset = parseFloat(ms.dist_ranura_mdf || perfil.distancia_ranura);
          mod.dist_ranura_mdf = (distRanuraPreset && distRanuraPreset >= 18) ? distRanuraPreset : 18;

          // Cálculo según estándares permitidos de carpintería (altura, ancho y peso/uso)
          const esCargaPesada = (ms.cant_cajones > 2 || (perfil.tipo_ambiente === 'cocina' && mod.tipo_interior === 'cajonera') || mod.ancho >= 900);
          const stdListones = calcularEstandarListonesPosteriores(mod.alto, mod.ancho, mod.tipo_interior, {
            esPesado: esCargaPesada,
            cantCajones: ms.cant_cajones || 0
          });

          mod.tiene_liston_post = true;
          mod.cant_listones_post = (ms.cant_listones_post !== undefined) ? parseInt(ms.cant_listones_post) : (mod.tiene_piso ? stdListones.cant : 1);
          mod.orientacion_liston_post = ms.orientacion_liston_post || stdListones.orientacion;
          mod.medida_liston_post = (ms.medida_liston_post !== undefined) ? parseFloat(ms.medida_liston_post) : stdListones.medida;
          mod.ancho_liston_post = mod.medida_liston_post;
        }
      }

      // Heredar configuración de puertas del módulo prediseñado
      if (ms.tiene_puertas !== undefined) {
        mod.tiene_puertas = !!ms.tiene_puertas;
      } else if (ms.tipo_interior === 'puertas') {
        mod.tiene_puertas = true;
      }
      if (ms.puertas_montaje) mod.puertas_montaje = ms.puertas_montaje;
      if (ms.puertas_posicion_bisagra) mod.puertas_posicion_bisagra = ms.puertas_posicion_bisagra;
      if (ms.puertas_cant_bisagras) mod.puertas_cant_bisagras = ms.puertas_cant_bisagras;
      mod.puertas_luz = (AppState.luzFrentes !== undefined) ? AppState.luzFrentes : (ms.puertas_luz || 3.0);

      // Heredar configuración de cajoneras del módulo prediseñado
      if (ms.cajones_montaje) mod.cajones_montaje = ms.cajones_montaje;
      if (ms.cajones_tipo_corredera) mod.cajones_tipo_corredera = ms.cajones_tipo_corredera;
      if (ms.cajones_posicion_corredera) mod.cajones_posicion_corredera = ms.cajones_posicion_corredera;
      if (ms.cajones_largo_corredera) mod.cajones_largo_corredera = ms.cajones_largo_corredera;
      mod.cajones_luz = (AppState.luzFrentes !== undefined) ? AppState.luzFrentes : (ms.cajones_luz || 3.0);
      mod.material_frentes = AppState.materialFrentes;
      mod.material_interior = AppState.materialEstructura;

      modulos.push(mod);
    });
  } else {
    // Fallback ergonómico automático si el perfil no especifica módulos en el JSON
    const cantMod = Math.max(1, Math.min(6, Math.ceil(w / 800)));
    const anchoCadaUno = Math.floor(w / cantMod);
    const tieneFondoFallback = (perfil.ranura_fondo !== false && perfil.ranura_fondo !== undefined);
    for (let i = 0; i < cantMod; i++) {
      const anchoM = (i === cantMod - 1) ? (w - (anchoCadaUno * (cantMod - 1))) : anchoCadaUno;
      const tipoInt = (i === 0 && cantMod > 1) ? 'cajonera' : 'repisas';
      const cajones = (tipoInt === 'cajonera') ? 3 : 0;
      const repisas = (tipoInt === 'repisas') ? 3 : 0;
      const mod = crearModulo(i, `Módulo ${i + 1}`, anchoM, tipoInt, repisas, cajones, true, true, true, tieneFondoFallback);
      if (tieneFondoFallback) {
        mod.tiene_fondo = true;
        mod.tipo_fondo = 'mdf';
        mod.tiene_fondo_mdf = true;
        mod.posicion_fondo_mdf = 'delante_liston';
        mod.grosor_mdf = 3;
        mod.ancho_ranura_mdf = 4;
        mod.prof_ranura_mdf = 8;
        mod.dist_ranura_mdf = (perfil.distancia_ranura && parseFloat(perfil.distancia_ranura) > 0) ? parseFloat(perfil.distancia_ranura) : (AppState.espesorMelamina || 18);

        // Estándar según altura y peso
        const stdListones = calcularEstandarListonesPosteriores(mod.alto, mod.ancho, mod.tipo_interior, {
          esPesado: (cajones > 2),
          cantCajones: cajones
        });
        mod.tiene_liston_post = true;
        mod.cant_listones_post = stdListones.cant;
        mod.orientacion_liston_post = stdListones.orientacion;
        mod.medida_liston_post = stdListones.medida;
        mod.ancho_liston_post = stdListones.medida;
      }
      // Por defecto en muebles cerrados activar puertas exteriores
      if (tipoInt !== 'cajonera') {
        mod.tiene_puertas = true;
        mod.puertas_montaje = 'exterior';
      }
      modulos.push(mod);
    }
  }

  AppState.cantidadModulos = modulos.length;
  AppState.modulos = modulos;
  AppState.moduloActivoIndex = 0;
  AppState.estadoVisualizador = 'modulos';

  // Sincronizar input de cantidad en UI
  const inpCant = document.getElementById('inputCantModulos');
  if (inpCant) inpCant.value = modulos.length;

  actualizarVisibilidadPaneles();
  renderizarBotonesSelectorCanvas();
  renderizarPestanasModulos();
  actualizarFormularioModuloActivo();
  actualizarBadgeEstado();
  actualizarCanvas();
}

/**
 * Limpia los campos y regresa al estado inicial vacío.
 */
function reiniciarAEstadoVacio(notificar = true) {
  const elW = document.getElementById('dimAnchoTotal');
  const elH = document.getElementById('dimAltoTotal');
  const elD = document.getElementById('dimProfTotal');
  const elCant = document.getElementById('inputCantModulos');
  if (elW) elW.value = '';
  if (elH) elH.value = '';
  if (elD) elD.value = '';
  if (elCant) elCant.value = '0';

  const badgePaso3 = document.getElementById('badgeCantModulosPaso3');
  if (badgePaso3) badgePaso3.textContent = '0 módulos';

  const chkZ = document.getElementById('muebleTieneZocalo');
  if (chkZ) chkZ.checked = false;
  const elAltoZ = document.getElementById('muebleAltoZocalo');
  if (elAltoZ) elAltoZ.value = 100;
  const elRetransZ = document.getElementById('muebleRetransZocalo');
  if (elRetransZ) elRetransZ.value = 35;
  const elCantL = document.getElementById('muebleCantListones');
  if (elCantL) elCantL.value = 'auto';

  AppState.anchoTotal = 0;
  AppState.altoTotal = 0;
  AppState.profTotal = 0;
  AppState.tieneZocalo = false;
  AppState.altoZocalo = 100;
  AppState.cantListonesZocalo = 'auto';
  AppState.retransZocalo = 35;
  AppState.cantidadModulos = 0;
  AppState.modulos = [];
  AppState.moduloActivoIndex = -1;
  AppState.modoSeleccion = 'diseno';
  AppState.modoSimulacion = false;
  AppState.modoOcultarPiezas = false;
  AppState.estadoVisualizador = 'vacio';

  if (window.Preview3D && typeof window.Preview3D.setModoOcultarPiezas === 'function') {
    window.Preview3D.setModoOcultarPiezas(false);
  }

  const btnModoOcultar = document.getElementById('btnModoOcultarPiezas');
  const btnToolbarOcultar = document.getElementById('btnToggleOcultarPiezaToolbar');
  if (btnModoOcultar) {
    btnModoOcultar.classList.remove('active');
    btnModoOcultar.style.background = '';
    btnModoOcultar.style.borderColor = '';
    btnModoOcultar.style.color = '';
  }
  if (btnToolbarOcultar) {
    btnToolbarOcultar.classList.remove('active');
    btnToolbarOcultar.style.background = '';
    btnToolbarOcultar.style.borderColor = '';
    btnToolbarOcultar.style.color = '';
    btnToolbarOcultar.innerHTML = `<svg class="svg-icon" style="width: 12px; height: 12px;"><use href="#icon-eye"></use></svg> <span>Ocultar/Ver Piezas</span>`;
  }

  actualizarUIZocaloGeneral();
  actualizarVisibilidadPaneles();
  renderizarBotonesSelectorCanvas();
  renderizarPestanasModulos();
  actualizarBadgeEstado();
  actualizarCanvas();

  if (notificar) {
    mostrarNotificacion("Espacio reiniciado a estado vacío.", "info");
  }
}

/**
 * Función invocada al abrir Estudio Espacial sin muebles seleccionados en SketchUp.
 * Asegura que el panel quede completamente vacío y listo para un nuevo diseño.
 */
function vaciarDiseno() {
  reiniciarAEstadoVacio(false);
  const lbl = document.getElementById('activeModuleDims');
  if (lbl) {
    lbl.innerText = "Esperando dimensiones generales...";
  }
  mostrarNotificacion("Panel vacío: ningún mueble seleccionado en SketchUp 3D. Listo para diseñar.", "info");
}

// ==============================================================================
// 4. PASO 2: CONFIGURACIÓN DE MELAMINA Y CANTIDAD DE MÓDULOS
// ==============================================================================

/**
 * Actualiza el espesor de la melamina (15mm o 18mm estándar).
 */
function onEspesorMelaminaChange(val) {
  const selEspesor = document.getElementById('dimEspesorMelamina');
  const t = parseFloat(val !== undefined ? val : (selEspesor ? selEspesor.value : 18)) || 18;
  AppState.espesorMelamina = t;

  if (AppState.materialEstructura.includes('18mm') || AppState.materialEstructura.includes('15mm') || AppState.materialEstructura.includes('36mm')) {
    AppState.materialEstructura = AppState.materialEstructura.replace(/\d+mm/, `${t}mm`);
  }
  if (AppState.materialFrentes.includes('18mm') || AppState.materialFrentes.includes('15mm') || AppState.materialFrentes.includes('36mm')) {
    AppState.materialFrentes = AppState.materialFrentes.replace(/\d+mm/, `${t}mm`);
  }

  poblarSelectoresMateriales();
  actualizarCanvas();
  validarTodosLosModulos();

  if (AppState.despieceActual && AppState.despieceActual.length > 0) {
    generarDespieceEstimadoLocal();
  }

  mostrarNotificacion(`Tablero: Espesor ${t}mm • Resistencia: ${AppState.resistencia} • Luz: ${AppState.luzFrentes || 3.0}mm`, 'info');
}
window.onEspesorMelaminaChange = onEspesorMelaminaChange;

/**
 * Modifica la cantidad de módulos con los botones [+] y [-] o input directo.
 * @param {number} delta - +1 o -1
 */
function modificarCantidadModulos(delta) {
  let actual = parseInt(document.getElementById('inputCantModulos').value) || 0;
  let nueva = Math.max(0, Math.min(8, actual + delta));
  document.getElementById('inputCantModulos').value = nueva;
  onCantidadModulosChange();
}

/**
 * Se ejecuta al cambiar la cantidad de módulos.
 * Inicializa o redimensiona el array de módulos y reparte el ancho total.
 */
function onCantidadModulosChange() {
  const numModulos = parseInt(document.getElementById('inputCantModulos').value) || 0;

  const badgePaso3 = document.getElementById('badgeCantModulosPaso3');
  if (badgePaso3) {
    badgePaso3.textContent = numModulos > 0 ? `${numModulos} ${numModulos === 1 ? 'módulo' : 'módulos'}` : '0 configurados';
  }

  // Si no había dimensiones previas y el usuario pulsa [+] para armar módulos, asignar plantilla estándar 2400x2100x600mm
  if (AppState.anchoTotal <= 0 || AppState.altoTotal <= 0 || AppState.profTotal <= 0) {
    if (numModulos > 0) {
      document.getElementById('dimAnchoTotal').value = 2400;
      document.getElementById('dimAltoTotal').value = 2100;
      document.getElementById('dimProfTotal').value = 600;
      AppState.anchoTotal = 2400;
      AppState.altoTotal = 2100;
      AppState.profTotal = 600;
      mostrarNotificacion("Dimensiones estándar asignadas automáticamente: 2400 x 2100 x 600 mm", "info");
    } else {
      return;
    }
  }

  if (numModulos <= 0) {
    AppState.cantidadModulos = 0;
    AppState.modulos = [];
    AppState.modoSeleccion = 'diseno';
    AppState.estadoVisualizador = 'delineado';
    actualizarVisibilidadPaneles();
    renderizarBotonesSelectorCanvas();
    renderizarPestanasModulos();
    actualizarBadgeEstado();
    actualizarCanvas();
    return;
  }

  AppState.cantidadModulos = numModulos;

  // Generar o ajustar array de módulos adaptándolos a las dimensiones sobrantes
  const nuevosModulos = [];
  const anchoBase = Math.floor(AppState.anchoTotal / numModulos);
  const remanente = AppState.anchoTotal - (anchoBase * numModulos);
  const altoDisponible = obtenerAltoDisponibleModulos();

  for (let i = 0; i < numModulos; i++) {
    const anchoEste = (i === numModulos - 1) ? (anchoBase + remanente) : anchoBase;

    // Si ya existía el módulo, conservar sus preferencias
    const modPrevio = AppState.modulos[i];

    nuevosModulos.push({
      id: i + 1,
      nombre: (modPrevio && modPrevio.nombre) ? modPrevio.nombre : `Módulo ${i + 1}`,
      columna_idx: i,
      nivel_apilado: 0,
      ancho: anchoEste,
      alto: modPrevio ? Math.min(modPrevio.alto, altoDisponible) : altoDisponible,
      profundidad: modPrevio ? modPrevio.profundidad : AppState.profTotal,
      tiene_zocalo: false, // Ahora se maneja globalmente en el perímetro inferior
      alto_zocalo: 0,
      retrans_zocalo: AppState.retransZocalo,
      cant_listones: 0,
      cant_listones_internos: 0,

      // Laterales (Costados): Por defecto activo (true); si se desactiva, se retiran los laterales quedando vacío
      tiene_laterales: modPrevio ? (modPrevio.tiene_laterales !== false && modPrevio.tiene_laterales !== 'false') : true,

      // Piso de Carcasa y Listones de Piso (Amarres Inferiores)
      tiene_piso: modPrevio ? (modPrevio.tiene_piso !== false && modPrevio.tiene_piso !== 'false') : true,
      tiene_liston_piso: modPrevio ? !!modPrevio.tiene_liston_piso : false,
      cant_listones_piso: modPrevio ? (modPrevio.cant_listones_piso || 2) : 2,
      medida_liston_piso: modPrevio ? (modPrevio.medida_liston_piso || 80) : 80,

      // Zócalo Superior
      tiene_zocalo_sup: modPrevio ? !!modPrevio.tiene_zocalo_sup : false,
      alto_zocalo_sup: modPrevio ? (modPrevio.alto_zocalo_sup || 70) : 70,

      // Listones independientes para parte posterior/fondo y techo
      tiene_liston_post: modPrevio ? (modPrevio.tiene_liston_post !== undefined ? modPrevio.tiene_liston_post : (modPrevio.tiene_liston_amarre && (modPrevio.posicion_liston_amarre === 'posterior' || modPrevio.posicion_liston_amarre === 'ambos'))) : false,
      orientacion_liston_post: modPrevio ? (modPrevio.orientacion_liston_post || 'horizontal') : 'horizontal',
      cant_listones_post: modPrevio ? (modPrevio.cant_listones_post || modPrevio.cant_listones_amarre || 2) : 2,
      ancho_liston_post: modPrevio ? (modPrevio.ancho_liston_post || modPrevio.medida_liston_post || 80) : 80,
      medida_liston_post: modPrevio ? (modPrevio.medida_liston_post || modPrevio.ancho_liston_post || 80) : 80,

      // Techo de Carcasa y Listones de Techo (Amarres Superiores)
      tiene_techo: modPrevio ? (modPrevio.tiene_techo !== false && modPrevio.tiene_techo !== 'false') : true,
      tiene_liston_techo: modPrevio ? (modPrevio.tiene_liston_techo !== undefined ? modPrevio.tiene_liston_techo : (modPrevio.tiene_liston_amarre && (modPrevio.posicion_liston_amarre === 'techo' || modPrevio.posicion_liston_amarre === 'ambos'))) : false,
      cant_listones_techo: modPrevio ? (modPrevio.cant_listones_techo || modPrevio.cant_listones_amarre || 2) : 2,
      medida_liston_techo: modPrevio ? (modPrevio.medida_liston_techo || modPrevio.alto_liston_amarre || 80) : 80,

      techo_sobre_liston: modPrevio ? !!modPrevio.techo_sobre_liston : false,
      techo_doble_melamina: modPrevio ? !!modPrevio.techo_doble_melamina : false,

      // Propiedades de compatibilidad hacia atrás
      tiene_liston_amarre: modPrevio ? modPrevio.tiene_liston_amarre : false,
      cant_listones_amarre: modPrevio ? modPrevio.cant_listones_amarre : 2,
      alto_liston_amarre: modPrevio ? modPrevio.alto_liston_amarre : 80,
      posicion_liston_amarre: modPrevio ? modPrevio.posicion_liston_amarre : 'posterior',

      // Fondo Posterior (MDF, Melamina o Fondo Panel, por default sin fondo)
      tiene_fondo: modPrevio ? !!(modPrevio.tiene_fondo || modPrevio.tiene_fondo_mdf) : false,
      tipo_fondo: modPrevio ? (modPrevio.tipo_fondo || (modPrevio.tiene_fondo_mdf ? 'mdf' : 'mdf')) : 'mdf',
      alto_fondo_melamina: modPrevio ? (modPrevio.alto_fondo_melamina || null) : null,
      dist_fondo_melamina: modPrevio ? (modPrevio.dist_fondo_melamina !== undefined ? modPrevio.dist_fondo_melamina : 0) : 0,
      panel_tiene_listones_pared: modPrevio ? (modPrevio.panel_tiene_listones_pared !== false && modPrevio.panel_tiene_listones_pared !== 'false') : true,
      panel_orientacion_listones: modPrevio ? (modPrevio.panel_orientacion_listones || 'horizontal') : 'horizontal',
      cant_listones_panel: modPrevio ? (modPrevio.cant_listones_panel || 2) : 2,
      medida_liston_panel: modPrevio ? (modPrevio.medida_liston_panel || 80) : 80,
      tiene_fondo_mdf: modPrevio ? !!(modPrevio.tiene_fondo_mdf || (modPrevio.tiene_fondo && modPrevio.tipo_fondo === 'mdf')) : false,
      grosor_mdf: modPrevio ? (modPrevio.grosor_mdf || 3) : 3,
      posicion_fondo_mdf: modPrevio ? (modPrevio.posicion_fondo_mdf || 'delante_liston') : 'delante_liston',
      ancho_ranura_mdf: modPrevio ? (modPrevio.ancho_ranura_mdf || 4) : 4,
      prof_ranura_mdf: modPrevio ? (modPrevio.prof_ranura_mdf || 8) : 8,
      dist_ranura_mdf: modPrevio ? (modPrevio.dist_ranura_mdf !== undefined ? modPrevio.dist_ranura_mdf : 18) : 18,
      posicion_fondo_melamina: modPrevio ? (modPrevio.posicion_fondo_melamina || 'embutido') : 'embutido',
      tipo_interior: modPrevio ? modPrevio.tipo_interior : 'carcasa',
      cant_repisas: modPrevio ? (modPrevio.cant_repisas || 0) : 0,
      cant_cajones: modPrevio ? modPrevio.cant_cajones : 3,
      material_frentes: AppState.materialFrentes,

      // Parantes y división de espacios interiores
      parantes_tipo: modPrevio ? (modPrevio.parantes_tipo || 'ninguno') : 'ninguno',
      parantes: modPrevio && Array.isArray(modPrevio.parantes) ? JSON.parse(JSON.stringify(modPrevio.parantes)) : [],
      espacios_repisas: modPrevio && Array.isArray(modPrevio.espacios_repisas) ? JSON.parse(JSON.stringify(modPrevio.espacios_repisas)) : []
    });
  }

  AppState.modulos = nuevosModulos;
  AppState.moduloActivoIndex = Math.min(AppState.moduloActivoIndex, numModulos - 1);
  AppState.estadoVisualizador = 'modulos';

  // Si no había selección previa o se agregaron módulos, inicializar modoSeleccion
  if (!AppState.modoSeleccion) {
    AppState.modoSeleccion = 'diseno';
  }

  actualizarVisibilidadPaneles();
  renderizarBotonesSelectorCanvas();
  renderizarPestanasModulos();
  actualizarFormularioModuloActivo();
  actualizarBadgeEstado();
  actualizarCanvas();
  mostrarNotificacion(`Composición armada: ${numModulos} módulos configurados.`, "success");
}

/**
 * Obtiene la agrupación de columnas únicas para sincronizar anchos entre submódulos apilados.
 * Computa el ancho representativo de cada columna según el ancho de sus niveles.
 * @returns {Array<{ columna_idx: number, ancho: number, modulos: Array }>}
 */
function obtenerColumnasModulares() {
  const map = new Map();
  AppState.modulos.forEach((m, idx) => {
    const colIdx = (m.columna_idx !== undefined && m.columna_idx !== null) ? m.columna_idx : idx;
    if (!map.has(colIdx)) {
      map.set(colIdx, { columna_idx: colIdx, ancho: m.ancho, modulos: [] });
    }
    map.get(colIdx).modulos.push(m);
  });

  const cols = Array.from(map.values()).sort((a, b) => a.columna_idx - b.columna_idx);
  cols.forEach(col => {
    const nivelesMap = new Map();
    col.modulos.forEach(mod => {
      const n = (mod.nivel_apilado !== undefined && mod.nivel_apilado !== null) ? mod.nivel_apilado : 0;
      if (!nivelesMap.has(n)) nivelesMap.set(n, 0);
      nivelesMap.set(n, nivelesMap.get(n) + (mod.ancho || 0));
    });
    let maxW = 0;
    nivelesMap.forEach(w => {
      if (w > maxW) maxW = w;
    });
    col.ancho = maxW > 0 ? maxW : (col.modulos[0] ? col.modulos[0].ancho : 600);
  });

  return cols;
}

/**
 * Divide el Ancho Total exactamente en partes iguales entre las columnas de la composición.
 */
function equilibrarAnchosModulos() {
  const columnas = obtenerColumnasModulares();
  const numCols = columnas.length;
  if (numCols <= 0) return;

  const anchoBase = Math.floor(AppState.anchoTotal / numCols);
  const remanente = AppState.anchoTotal - (anchoBase * numCols);

  columnas.forEach((col, idx) => {
    const w = (idx === numCols - 1) ? (anchoBase + remanente) : anchoBase;
    col.modulos.forEach(m => {
      m.ancho = w;
    });
  });

  renderizarBotonesSelectorCanvas();
  renderizarPestanasModulos();
  actualizarFormularioModuloActivo();
  actualizarCanvas();
  mostrarNotificacion("Anchos de columnas equilibrados equitativamente.", "info");
}

/**
 * Redistribuye el ancho total cuando cambia la cota global del mueble.
 */
function distribuirAnchoTotalEnModulos() {
  const columnas = obtenerColumnasModulares();
  const numCols = columnas.length;
  if (numCols <= 0) return;

  const sumaActual = columnas.reduce((acc, c) => acc + c.ancho, 0);
  if (sumaActual <= 0) {
    equilibrarAnchosModulos();
    return;
  }

  let acumulado = 0;
  for (let i = 0; i < numCols; i++) {
    const col = columnas[i];
    if (i === numCols - 1) {
      const nuevoW = Math.max(150, AppState.anchoTotal - acumulado);
      col.modulos.forEach(m => { m.ancho = nuevoW; });
    } else {
      const fraccion = col.ancho / sumaActual;
      const nuevoW = Math.max(150, Math.round(AppState.anchoTotal * fraccion));
      col.modulos.forEach(m => { m.ancho = nuevoW; });
      acumulado += nuevoW;
    }
  }

  renderizarBotonesSelectorCanvas();
  renderizarPestanasModulos();
  actualizarFormularioModuloActivo();
}

// ==============================================================================
// 5. GESTIÓN DE SELECCIÓN (DISEÑO / MÓDULOS) & PESTAÑAS PARAMÉTRICAS
// ==============================================================================

/**
 * Renderiza los botones de selección sobre la imagen en el lado derecho:
 * - Botón "Diseño": Selecciona todo el mueble y muestra cotas generales en el lado izquierdo.
 * - Si hay 2 o más módulos: Aparecen botones dinámicos por cada módulo creado (Módulo 1, Módulo 2, ...).
 * - Al seleccionar un módulo, se selecciona en el 3D y en el lado izquierdo solo aparecen sus datos.
 */
function renderizarBotonesSelectorCanvas() {
  const btnDiseno = document.getElementById('btnSelDiseno');
  const container = document.getElementById('canvasModuleButtonsContainer');
  if (!btnDiseno || !container) return;

  const numModulos = AppState.modulos.length;
  const esModoDiseno = (AppState.modoSeleccion === 'diseno');

  // Actualizar estado activo del botón Diseño
  if (esModoDiseno) {
    btnDiseno.classList.add('active');
  } else {
    btnDiseno.classList.remove('active');
  }

  // "si agrego 2 o mas modulos deben aparecer botones por cada modulo creado"
  if (numModulos >= 2) {
    let html = '';
    AppState.modulos.forEach((m, idx) => {
      const esActivo = (!esModoDiseno && AppState.moduloActivoIndex === idx);
      const nombreBtn = m.nombre || `Módulo ${idx + 1}`;
      html += `
        <button type="button" 
                class="canvas-selector-btn ${esActivo ? 'active' : ''}" 
                id="btnCanvasModulo_${idx}" 
                onclick="seleccionarModulo(${idx})" 
                title="Seleccionar ${nombreBtn} (${m.ancho}x${m.alto} mm)">
          <svg class="svg-icon"><use href="#icon-cubo"></use></svg>
          <span id="txtBtnCanvasModulo_${idx}">${nombreBtn}</span>
          <span class="selector-badge-dim">${m.ancho}x${m.alto} mm</span>
        </button>
      `;
    });
    container.innerHTML = html;
    container.style.display = 'flex';

    setTimeout(() => {
      actualizarVisibilidadFlechasScrollCanvas();
      if (!esModoDiseno && AppState.moduloActivoIndex >= 0) {
        const btnActivo = document.getElementById(`btnCanvasModulo_${AppState.moduloActivoIndex}`);
        if (btnActivo) {
          btnActivo.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }, 60);

  } else {
    // Si hay menos de 2 módulos, no se muestran botones particulares de módulos
    container.innerHTML = '';
    container.style.display = 'none';
    const btnL = document.getElementById('btnScrollCanvasModsLeft');
    const btnR = document.getElementById('btnScrollCanvasModsRight');
    if (btnL) btnL.style.display = 'none';
    if (btnR) btnR.style.display = 'none';
  }
}

/**
 * Desplaza horizontalmente los botones de módulos sobre el canvas.
 * @param {number} offset - Cantidad de píxeles a desplazar (+ o -).
 */
function scrollCanvasModulos(offset) {
  const container = document.getElementById('canvasModuleButtonsContainer');
  if (!container) return;
  container.scrollBy({ left: offset, behavior: 'smooth' });
  setTimeout(actualizarVisibilidadFlechasScrollCanvas, 220);
}

/**
 * Controla la visibilidad dinámica de las flechas de scroll de la barra flotante.
 */
function actualizarVisibilidadFlechasScrollCanvas() {
  const container = document.getElementById('canvasModuleButtonsContainer');
  const btnL = document.getElementById('btnScrollCanvasModsLeft');
  const btnR = document.getElementById('btnScrollCanvasModsRight');
  if (!container || !btnL || !btnR) return;

  const hayScroll = (container.scrollWidth > container.clientWidth + 6);
  if (!hayScroll) {
    btnL.style.display = 'none';
    btnR.style.display = 'none';
    return;
  }

  btnL.style.display = (container.scrollLeft > 6) ? 'inline-flex' : 'none';
  btnR.style.display = (container.scrollLeft + container.clientWidth < container.scrollWidth - 6) ? 'inline-flex' : 'none';
}

/**
 * Inicializa el soporte para desplazar horizontalmente las barras de botones usando la rueda del ratón.
 */
function inicializarScrollHorizontalConRueda() {
  const contCanvas = document.getElementById('canvasModuleButtonsContainer');
  if (contCanvas) {
    contCanvas.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        contCanvas.scrollLeft += (e.deltaY * 0.85);
        actualizarVisibilidadFlechasScrollCanvas();
      }
    }, { passive: false });
    contCanvas.addEventListener('scroll', () => {
      actualizarVisibilidadFlechasScrollCanvas();
    }, { passive: true });
  }

  const contTabs = document.getElementById('moduleTabsHeader');
  if (contTabs) {
    contTabs.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        contTabs.scrollLeft += (e.deltaY * 0.85);
      }
    }, { passive: false });
  }
}

/**
 * Activa el modo de selección "Diseño" para todo el mueble.
 * - En el diseño (3D/2D): Selecciona todo el mueble y resalta el marco global.
 * - En el lado izquierdo: Muestra las tarjetas generales del mueble (Paso 1 y Paso 2).
 */
function seleccionarModoDiseno() {
  AppState.modoSeleccion = 'diseno';
  actualizarVisibilidadPaneles();
  renderizarBotonesSelectorCanvas();
  renderizarPestanasModulos();
  actualizarCanvas();
  actualizarBadgeEstado();

  // Actualizar alertas flotantes para la vista general
  evaluarAlertasGeneralesYModulo();

  mostrarNotificacion("Diseño General seleccionado: Viendo todo el mueble.", "info");
}

/**
 * Activa la selección de un módulo individual (Módulo 1, Módulo 2, ...).
 * - En el diseño: Se selecciona visualmente el módulo especificado con resalte ámbar.
 * - En el lado izquierdo: SOLO aparece la configuración y datos de ese módulo (Paso 3).
 * @param {number} index - Índice del módulo a seleccionar (0-based)
 */
function seleccionarModulo(index) {
  if (index < 0 || index >= AppState.modulos.length) return;

  AppState.modoSeleccion = 'modulo';
  AppState.moduloActivoIndex = index;

  actualizarVisibilidadPaneles();
  renderizarBotonesSelectorCanvas();
  renderizarPestanasModulos();
  actualizarFormularioModuloActivo();
  actualizarCanvas();
  actualizarBadgeEstado();

  const nombreMod = AppState.modulos[index].nombre || `Módulo ${index + 1}`;
  mostrarNotificacion(`${nombreMod} seleccionado: Editando únicamente los datos de este módulo.`, "info");
}

/**
 * Wrapper de compatibilidad hacia atrás para llamadas a seleccionarPestanaModulo.
 * @param {number} index - Índice del módulo seleccionado.
 */
function seleccionarPestanaModulo(index) {
  seleccionarModulo(index);
}

/**
 * Controla la visibilidad de las tarjetas del panel izquierdo:
 * - Cuando se selecciona un módulo: Oculta Card 1 y Card 2, y muestra SOLO Card 3.
 * - Cuando se selecciona "Diseño": Muestra Card 1 y Card 2 (dimensiones generales y melamina).
 *   Si hay 2 o más módulos, oculta Card 3 para centrarse en todo el mueble.
 */
function actualizarVisibilidadPaneles() {
  const cardDim = document.getElementById('cardDimensionesGenerales');
  const cardPresets = document.getElementById('cardMueblesPredisenados');
  const cardMel = document.getElementById('cardMelamina') || document.getElementById('cardMelaminaModulos');
  const cardModulos = document.getElementById('cardModulosMueble');
  const cardConfig = document.getElementById('cardConfigModulo');
  const numModulos = AppState.modulos.length;

  if (AppState.modoSeleccion === 'modulo' && numModulos > 0) {
    // Al seleccionar módulo, al lado izquierdo SOLO aparece los datos de configuración de ese módulo
    if (cardDim) cardDim.style.display = 'none';
    if (cardPresets) cardPresets.style.display = 'none';
    if (cardMel) cardMel.style.display = 'none';
    if (cardModulos) cardModulos.style.display = 'none';
    if (cardConfig) cardConfig.style.display = 'block';
  } else {
    // Modo Diseño (selecciona todo el mueble): se muestran las secciones generales
    if (cardDim) cardDim.style.display = 'block';
    if (cardPresets) cardPresets.style.display = 'block';
    if (cardMel) cardMel.style.display = 'block';
    if (cardModulos) cardModulos.style.display = 'block';

    if (numModulos >= 2) {
      if (cardConfig) cardConfig.style.display = 'none';
    } else if (numModulos === 1) {
      if (cardConfig) cardConfig.style.display = 'block';
    } else {
      if (cardConfig) cardConfig.style.display = 'none';
    }
  }

  // Refrescar accesos rápidos si existen en el Paso 2
  actualizarAccesosRapidosPaso2();
}

/**
 * Actualiza la fila de accesos directos en el Paso 2 cuando hay 2 o más módulos creados.
 */
function actualizarAccesosRapidosPaso2() {
  const wrap = document.getElementById('wrapperAccesosModulos');
  const lista = document.getElementById('listaBotonesAccesoModulos');
  const badge = document.getElementById('badgeTotalModulosInfo');
  if (!wrap || !lista) return;

  const numModulos = AppState.modulos.length;
  if (numModulos >= 2) {
    wrap.style.display = 'block';
    if (badge) badge.innerText = `${numModulos} módulos configurados`;

    let html = '';
    AppState.modulos.forEach((m, idx) => {
      const nombreBtn = m.nombre || `Módulo ${idx + 1}`;
      html += `
        <button type="button" class="btn btn-xs btn-outline" id="btnAccesoPaso2_${idx}" onclick="seleccionarModulo(${idx})" style="display: inline-flex; align-items: center; gap: 4px;">
          <svg class="svg-icon" style="width: 12px; height: 12px;"><use href="#icon-cubo"></use></svg>
          <span id="txtBtnAccesoPaso2_${idx}">${nombreBtn} (${m.ancho}x${m.alto} mm)</span>
        </button>
      `;
    });
    lista.innerHTML = html;
  } else {
    wrap.style.display = 'none';
  }
}

/**
 * Renderiza la barra de pestañas horizontales [ Módulo 1 ] [ Módulo 2 ] ...
 */
function renderizarPestanasModulos() {
  const container = document.getElementById('moduleTabsHeader');
  if (!container) return;

  if (AppState.modulos.length === 0) {
    container.innerHTML = `<span class="text-muted" style="font-size: 11px;">Configure cantidad de módulos en el Paso 2 para habilitar las pestañas.</span>`;
    actualizarVisibilidadPaneles();
    return;
  }

  let html = '';
  AppState.modulos.forEach((m, idx) => {
    const esActivo = (AppState.modoSeleccion === 'modulo' && idx === AppState.moduloActivoIndex);
    const nombreBtn = m.nombre || `Módulo ${idx + 1}`;
    html += `
      <button type="button" 
              class="module-tab-btn ${esActivo ? 'active' : ''}" 
              id="btnPestanaModulo_${idx}" 
              onclick="seleccionarModulo(${idx})"
              title="${nombreBtn}: ${m.ancho} x ${m.alto} x ${m.profundidad} mm">
        <span id="txtBtnPestanaModulo_${idx}">${nombreBtn}</span>
        <span class="module-tab-badge">${m.ancho}x${m.alto}</span>
      </button>
    `;
  });

  container.innerHTML = html;
  actualizarVisibilidadPaneles();
}

/**
 * Carga los valores del módulo activo en los inputs del panel izquierdo.
 */
function actualizarFormularioModuloActivo() {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  // Nombre del módulo / submódulo e indicadores de apilado
  const colIdx = (m.columna_idx !== undefined && m.columna_idx !== null) ? m.columna_idx : idx;
  const nivel = (m.nivel_apilado !== undefined && m.nivel_apilado !== null) ? m.nivel_apilado : 0;
  const colMods = AppState.modulos.filter(mod => 
    ((mod.columna_idx !== undefined && mod.columna_idx !== null) ? mod.columna_idx : AppState.modulos.indexOf(mod)) === colIdx
  );
  const esApilado = colMods.length > 1;
  const nombrePorDefecto = esApilado ? `Submódulo ${colIdx + 1}.${nivel + 1}` : `Módulo ${colIdx + 1}`;
  const nombreActivo = (m.nombre && m.nombre.trim()) ? m.nombre.trim() : nombrePorDefecto;

  // Título e inputs de nombre
  const lblTitulo = document.getElementById('lblTituloModuloActivo');
  if (lblTitulo) lblTitulo.innerText = `Configuración de ${nombreActivo}`;

  const inpNombre = document.getElementById('modNombre');
  if (inpNombre) inpNombre.value = nombreActivo;

  // Badges y botones de subdivisión / apilado vertical
  const badgeJerarquia = document.getElementById('badgeJerarquiaModulo');
  const badgeInfoStack = document.getElementById('badgeInfoStackColumna');
  const btnEliminarSub = document.getElementById('btnEliminarSubmodulo');
  const btnEquilibrarAlt = document.getElementById('btnEquilibrarAlturasCol');
  const txtBtnSubdividir = document.getElementById('txtBtnSubdividirApilar');

  if (badgeJerarquia) {
    if (!esApilado) {
      badgeJerarquia.textContent = `Módulo Columna ${colIdx + 1}`;
      badgeJerarquia.className = 'badge badge-info';
    } else {
      badgeJerarquia.textContent = `Nivel ${nivel + 1} de ${colMods.length}`;
      badgeJerarquia.className = 'badge badge-warning';
    }
  }

  if (badgeInfoStack) {
    badgeInfoStack.textContent = esApilado ? `Columna ${colIdx + 1} (${colMods.length} niveles)` : `Columna ${colIdx + 1} (1 nivel)`;
  }

  if (btnEliminarSub) {
    btnEliminarSub.style.display = esApilado ? 'inline-flex' : 'none';
  }

  if (btnEquilibrarAlt) {
    btnEquilibrarAlt.style.display = esApilado ? 'inline-flex' : 'none';
  }

  if (txtBtnSubdividir) {
    txtBtnSubdividir.textContent = esApilado ? 'Subdividir este Submódulo' : 'Subdividir Módulo';
  }

  // Inputs dimensionales
  const inpAncho = document.getElementById('modAncho');
  const inpAlto = document.getElementById('modAlto');
  const inpProf = document.getElementById('modProf');
  const altoDisponible = obtenerAltoDisponibleModulos();

  if (inpAncho) inpAncho.value = m.ancho;
  if (inpAlto) {
    inpAlto.value = m.alto;
    inpAlto.max = altoDisponible;
  }
  if (inpProf) {
    inpProf.value = m.profundidad;
    inpProf.max = AppState.profTotal;
  }

  // Indicador de zócalo base en la tarjeta del módulo
  const badgeInfoZoc = document.getElementById('badgeModuloInfoZocalo');
  const lblInfoZoc = document.getElementById('lblInfoZocaloModulo');
  if (badgeInfoZoc) {
    badgeInfoZoc.className = AppState.tieneZocalo ? 'badge badge-info' : 'badge badge-normal';
    badgeInfoZoc.innerText = AppState.tieneZocalo ? `Activo (${AppState.altoZocalo}mm)` : 'Sin Zócalo';
  }
  if (lblInfoZoc) {
    lblInfoZoc.innerText = AppState.tieneZocalo
      ? `El zócalo continuo de ${AppState.altoZocalo} mm sostiene toda la base. Este módulo ocupa ${m.alto} mm de alto sobrante.`
      : 'El mueble no lleva zócalo inferior. El módulo apoya directamente al nivel del piso (Z = 0).';
  }

  // Zócalo (compatibilidad con campos legados)
  const chkZocalo = document.getElementById('modTieneZocalo');
  const inpAltoZocalo = document.getElementById('modAltoZocalo');
  const inpRetransZocalo = document.getElementById('modRetransZocalo');
  const selListones = document.getElementById('modCantListones');
  const grpZocalo = document.getElementById('grpDetalleZocalo');

  if (chkZocalo) chkZocalo.checked = m.tiene_zocalo;
  if (inpAltoZocalo) inpAltoZocalo.value = (m.alto_zocalo !== undefined) ? m.alto_zocalo : 100;
  if (inpRetransZocalo) inpRetransZocalo.value = (m.retrans_zocalo !== undefined && m.retrans_zocalo !== '') ? m.retrans_zocalo : 35;
  if (selListones) {
    actualizarOpcionesCantListonesZocaloUI(selListones);
    selListones.value = String(resolverCantListonesInternosZocalo(m));
  }
  if (grpZocalo) grpZocalo.style.display = m.tiene_zocalo ? 'grid' : 'none';

  // Laterales (Costados de Carcasa)
  const chkLaterales = document.getElementById('modTieneLaterales');
  if (chkLaterales) chkLaterales.checked = (m.tiene_laterales !== false && m.tiene_laterales !== 'false');

  // Piso de Carcasa y Listones de Piso (Amarres Inferiores)
  const chkPiso = document.getElementById('modTienePiso');
  const grpOpcionesPiso = document.getElementById('grpDetalleOpcionesPiso');
  const chkListonPiso = document.getElementById('modTieneListonPiso');
  const grpListonPiso = document.getElementById('grpDetalleListonPiso');
  const selCantListonPiso = document.getElementById('modCantListonesPiso');
  const inpMedidaListonPiso = document.getElementById('modMedidaListonPiso');

  const tienePiso = (m.tiene_piso !== false && m.tiene_piso !== 'false');
  const tieneListonPiso = !!m.tiene_liston_piso;

  if (chkPiso) chkPiso.checked = tienePiso;
  if (grpOpcionesPiso) grpOpcionesPiso.style.display = tienePiso ? 'block' : 'none';
  if (chkListonPiso) chkListonPiso.checked = tieneListonPiso;
  if (grpListonPiso) grpListonPiso.style.display = (tienePiso && tieneListonPiso) ? 'block' : 'none';
  if (selCantListonPiso) selCantListonPiso.value = m.cant_listones_piso || 2;
  if (inpMedidaListonPiso) inpMedidaListonPiso.value = m.medida_liston_piso || 80;

  // Zócalo Superior
  const chkZocaloSup = document.getElementById('modTieneZocaloSup');
  const inpAltoZocaloSup = document.getElementById('modAltoZocaloSup');
  const grpZocaloSup = document.getElementById('grpDetalleZocaloSup');

  const tieneZocaloSup = !!m.tiene_zocalo_sup;
  if (chkZocaloSup) chkZocaloSup.checked = tieneZocaloSup;
  if (inpAltoZocaloSup) inpAltoZocaloSup.value = (m.alto_zocalo_sup !== undefined) ? m.alto_zocalo_sup : 70;
  if (grpZocaloSup) grpZocaloSup.style.display = tieneZocaloSup ? 'grid' : 'none';

  // Listones en Parte Posterior (Pared)
  const chkPost = document.getElementById('modTieneListonPost');
  const selCantPost = document.getElementById('modCantListonesPost');
  const inpMedidaPost = document.getElementById('modMedidaListonPost');
  const grpPost = document.getElementById('grpDetalleListonPost');
  const badgeOmitidoMel = document.getElementById('badgeListonPostOmitidoPorMelamina');

  // Si el fondo es melamina, el módulo ya no debe tener listón posterior
  const tieneFondoActual = !!(m.tiene_fondo || m.tiene_fondo_mdf);
  const tipoFondoActual = m.tipo_fondo || (m.tiene_fondo_mdf ? 'mdf' : 'mdf');
  const esFondoMelamina = tieneFondoActual && (tipoFondoActual === 'melamina');

  if (esFondoMelamina) {
    m.tiene_liston_post = false;
    if (chkPost) {
      chkPost.checked = false;
      chkPost.disabled = true;
    }
    if (grpPost) grpPost.style.display = 'none';
    if (badgeOmitidoMel) badgeOmitidoMel.style.display = 'block';
  } else {
    if (chkPost) chkPost.disabled = false;
    if (badgeOmitidoMel) badgeOmitidoMel.style.display = 'none';
    const tienePost = (m.tiene_liston_post !== undefined)
      ? !!m.tiene_liston_post
      : (m.tiene_liston_amarre && (m.posicion_liston_amarre === 'posterior' || m.posicion_liston_amarre === 'ambos'));
    if (chkPost) chkPost.checked = tienePost;
    if (grpPost) grpPost.style.display = tienePost ? 'block' : 'none';
  }

  const selOrientacionPost = document.getElementById('modOrientacionListonesPost');
  const orientPost = m.orientacion_liston_post || 'horizontal';
  if (selOrientacionPost) selOrientacionPost.value = orientPost;
  actualizarOpcionesCantListonesPostUI(orientPost, m.cant_listones_post || m.cant_listones_amarre || 2);
  if (selCantPost) selCantPost.value = m.cant_listones_post || m.cant_listones_amarre || 2;
  if (inpMedidaPost) inpMedidaPost.value = m.ancho_liston_post || m.medida_liston_post || m.alto_liston_amarre || 80;

  const selPanelOrient = document.getElementById('modPanelOrientacionListones');
  if (selPanelOrient) selPanelOrient.value = m.panel_orientacion_listones || 'horizontal';

  // Techo y Listones de Techo (Amarres Superiores)
  const chkTieneTecho = document.getElementById('modTieneTecho');
  const grpOpcionesTecho = document.getElementById('grpDetalleOpcionesTecho');
  const chkTecho = document.getElementById('modTieneListonTecho');
  const selCantTecho = document.getElementById('modCantListonesTecho');
  const inpMedidaTecho = document.getElementById('modMedidaListonTecho');
  const grpTecho = document.getElementById('grpDetalleListonTecho');
  const chkTechoSobre = document.getElementById('modTechoSobreListon');
  const grpTechoSobre = document.getElementById('grpDetalleTechoSobre');
  const chkDobleMel = document.getElementById('modTechoDobleMelamina');
  const lblEspesorDesc = document.getElementById('lblEspesorDescontado');

  const tieneTechoGral = (m.tiene_techo !== false && m.tiene_techo !== 'false');
  const tieneTecho = (m.tiene_liston_techo !== undefined)
    ? !!m.tiene_liston_techo
    : (m.tiene_liston_amarre && (m.posicion_liston_amarre === 'techo' || m.posicion_liston_amarre === 'ambos'));

  if (chkTieneTecho) chkTieneTecho.checked = tieneTechoGral;
  if (grpOpcionesTecho) grpOpcionesTecho.style.display = tieneTechoGral ? 'block' : 'none';
  if (chkTecho) chkTecho.checked = tieneTecho;
  if (selCantTecho) selCantTecho.value = m.cant_listones_techo || m.cant_listones_amarre || 2;
  if (inpMedidaTecho) inpMedidaTecho.value = m.ancho_liston_techo || m.medida_liston_techo || m.alto_liston_amarre || 80;
  if (grpTecho) grpTecho.style.display = (tieneTechoGral && tieneTecho) ? 'block' : 'none';
  if (chkTechoSobre) chkTechoSobre.checked = !!m.techo_sobre_liston;
  if (grpTechoSobre) grpTechoSobre.style.display = (tieneTechoGral && tieneTecho && m.techo_sobre_liston) ? 'block' : 'none';
  if (chkDobleMel) chkDobleMel.checked = !!m.techo_doble_melamina;
  if (lblEspesorDesc) {
    const t = AppState.espesorMelamina;
    lblEspesorDesc.textContent = m.techo_doble_melamina ? (2 * t) : t;
  }

  // Fondo Posterior (MDF, Melamina o Fondo Panel)
  const chkTieneFondo = document.getElementById('modTieneFondo');
  const grpDetalleFondo = document.getElementById('grpDetalleFondo');
  const selTipoFondo = document.getElementById('modTipoFondo');
  const grpSubFondoMdf = document.getElementById('grpSubFondoMdf');
  const grpSubFondoMelamina = document.getElementById('grpSubFondoMelamina');
  const grpSubFondoPanel = document.getElementById('grpSubFondoPanel');

  // Subcomponentes MDF
  const selGrosorMdf = document.getElementById('modGrosorMdf');
  const selPosFondo = document.getElementById('modPosicionFondoMdf');
  const inpAnchoRanura = document.getElementById('modAnchoRanuraMdf');
  const inpProfRanura = document.getElementById('modProfRanuraMdf');
  const inpDistRanura = document.getElementById('modDistRanuraMdf');
  const grpRanuraMdf = document.getElementById('grpDetalleRanuraMdf');
  const grpSobreMdf = document.getElementById('grpDetalleSobrepuestoMdf');

  // Subcomponentes Fondo Panel (Listones posteriores atornillados a pared)
  const chkListonesPanel = document.getElementById('modPanelTieneListonesPared');
  const selCantListonesPanel = document.getElementById('modCantListonesPanel');
  const inpMedidaListonPanel = document.getElementById('modMedidaListonPanel');
  const grpDetalleListonesPanel = document.getElementById('grpDetalleListonesPanel');

  // Subcomponentes Melamina
  const inpAltoFondoMel = document.getElementById('modAltoFondoMelamina');
  const hintAltoFondoMel = document.getElementById('hintAltoFondoMelamina');
  const lblDescuento = document.getElementById('lblDescuentoProfDetalle');

  const tieneFondo = tieneFondoActual;
  const tipoFondo = tipoFondoActual;

  if (chkTieneFondo) chkTieneFondo.checked = tieneFondo;
  if (grpDetalleFondo) grpDetalleFondo.style.display = tieneFondo ? 'block' : 'none';
  if (selTipoFondo) selTipoFondo.value = tipoFondo;
  if (grpSubFondoMdf) grpSubFondoMdf.style.display = (tipoFondo === 'mdf') ? 'block' : 'none';
  if (grpSubFondoMelamina) grpSubFondoMelamina.style.display = (tipoFondo === 'melamina') ? 'block' : 'none';
  if (grpSubFondoPanel) grpSubFondoPanel.style.display = (tipoFondo === 'panel') ? 'block' : 'none';

  // Sincronizar parámetros de Fondo Panel
  const tieneListonesPanel = (m.panel_tiene_listones_pared !== false && m.panel_tiene_listones_pared !== 'false');
  if (chkListonesPanel) chkListonesPanel.checked = tieneListonesPanel;
  if (selPanelOrient) selPanelOrient.value = m.panel_orientacion_listones || 'horizontal';
  if (selCantListonesPanel) selCantListonesPanel.value = m.cant_listones_panel || 2;
  if (inpMedidaListonPanel) inpMedidaListonPanel.value = m.medida_liston_panel || 80;
  if (grpDetalleListonesPanel) grpDetalleListonesPanel.style.display = tieneListonesPanel ? 'block' : 'none';



  // Sincronizar parámetros de MDF
  if (selGrosorMdf) selGrosorMdf.value = m.grosor_mdf || 3;
  if (selPosFondo) selPosFondo.value = m.posicion_fondo_mdf || 'delante_liston';
  if (inpAnchoRanura) inpAnchoRanura.value = (m.ancho_ranura_mdf !== undefined) ? m.ancho_ranura_mdf : ((m.grosor_mdf || 3) + 1);
  if (inpProfRanura) inpProfRanura.value = (m.prof_ranura_mdf !== undefined) ? m.prof_ranura_mdf : 8;
  if (inpDistRanura) {
    let valDist = parseFloat(m.dist_ranura_mdf);
    const posActual = m.posicion_fondo_mdf || 'delante_liston';
    const espBase = AppState.espesorMelamina || 18;
    if (isNaN(valDist) || (posActual === 'delante_liston' && valDist < espBase)) {
      valDist = (posActual === 'delante_liston') ? espBase : 0;
    }
    m.dist_ranura_mdf = valDist;
    inpDistRanura.value = valDist;
  }
  if (grpRanuraMdf) grpRanuraMdf.style.display = (m.posicion_fondo_mdf !== 'detras_liston') ? 'block' : 'none';
  if (grpSobreMdf) grpSobreMdf.style.display = (m.posicion_fondo_mdf === 'detras_liston') ? 'block' : 'none';

  // Sincronizar parámetros de Melamina (altura con default al vano total, ajustable de arriba hacia abajo)
  const geoCalculada = calcularDivisionesYEspaciosModulo(m, AppState.espesorMelamina);
  const hVanoUtilModulo = geoCalculada.hVanoUtil;

  if (inpAltoFondoMel) {
    inpAltoFondoMel.max = hVanoUtilModulo;
    const altoMelActual = (m.alto_fondo_melamina !== null && m.alto_fondo_melamina !== undefined && parseFloat(m.alto_fondo_melamina) < hVanoUtilModulo)
      ? Math.max(80, parseFloat(m.alto_fondo_melamina))
      : hVanoUtilModulo;
    inpAltoFondoMel.value = altoMelActual;

    if (hintAltoFondoMel) {
      if (altoMelActual < hVanoUtilModulo) {
        const gapInferior = Math.round(hVanoUtilModulo - altoMelActual);
        hintAltoFondoMel.textContent = `Fondo ajustado de arriba para abajo: Altura ${altoMelActual} mm con vano libre inferior de ${gapInferior} mm. Vano interior total: ${hVanoUtilModulo} mm.`;
      } else {
        hintAltoFondoMel.textContent = `Por default cubre la altura interior total (${hVanoUtilModulo} mm). Puede reducirse para ajustar de arriba para abajo dejando vano libre inferior.`;
      }
    }
  }

  // Sincronizar profundidad posterior / retranqueo a pared del fondo de melamina
  const inpDistFondoMel = document.getElementById('modDistFondoMelamina');
  const hintDistFondoMel = document.getElementById('hintDistFondoMelamina');
  if (inpDistFondoMel) {
    const distMelActual = (m.dist_fondo_melamina !== undefined) ? Math.max(0, parseFloat(m.dist_fondo_melamina)) : 0;
    inpDistFondoMel.value = distMelActual;
    if (hintDistFondoMel) {
      hintDistFondoMel.textContent = (distMelActual > 0)
        ? `Retranqueado ${distMelActual} mm respecto a la pared posterior (la melamina no choca con la pared/instalaciones).`
        : `Por default: 0 mm (al borde posterior). Ingrese milímetros para meter el fondo hacia adentro y evitar que choque con la pared.`;
    }
  }

  const profInfo = calcularProfundidadUtilInterior(m, AppState.espesorMelamina);
  if (lblDescuento) {
    lblDescuento.innerHTML = `
      <strong>${profInfo.profMod} mm (nominal)</strong> → <span style="font-size: 11px; font-weight: 700; color: var(--accent);">${profInfo.profUtil} mm (útil)</span><br>
      <span style="color: var(--text-muted); font-size: 9px;">Descuentos: ${profInfo.detallesTexto}</span>
    `;
  }

  // Sincronización de Profundidad Útil y Carcasa
  const dimCarcasa = calcularDimensionesCarcasa(m, AppState.espesorMelamina);
  const lblDescuentoDetalle = document.getElementById('lblDescuentoProfDetalle');
  if (lblDescuentoDetalle) {
    lblDescuentoDetalle.innerHTML = `
      <div><strong>Profundidad Total Mueble:</strong> ${profInfo.profMod} mm</div>
      <div style="color: ${dimCarcasa.descuentaFrente ? 'var(--accent)' : 'var(--text-muted)'};">
        <strong>Profundidad Carcasa:</strong> ${dimCarcasa.profCarcasa} mm ${dimCarcasa.descuentaFrente ? `(-${dimCarcasa.descFrenteMm}mm por frente exterior)` : ''}
      </div>
      <div><strong>Profundidad Útil Interior:</strong> <span style="font-weight: 700; color: var(--primary);">${profInfo.profUtil} mm</span></div>
      <div style="font-size: 9px; color: var(--text-muted); margin-top: 2px;">${profInfo.detallesTexto}</div>
    `;
  }

  // 1. Equipamiento Interior (Carcasa, Repisas o Cajonera)
  const selInterior = document.getElementById('modTipoInterior');
  let tipoIntActual = m.tipo_interior || 'carcasa';
  if (tipoIntActual === 'puertas') {
    tipoIntActual = (m.cant_repisas > 0) ? 'repisas' : 'carcasa';
    m.tipo_interior = tipoIntActual;
    m.tiene_puertas = true;
  }
  if (selInterior) selInterior.value = tipoIntActual;

  const grpRepisas = document.getElementById('grpDetalleRepisas');
  const grpCajones = document.getElementById('grpDetalleCajonera');
  const inpRep = document.getElementById('modCantRepisas');

  if (grpRepisas) grpRepisas.style.display = (tipoIntActual === 'repisas') ? 'block' : 'none';
  if (grpCajones) grpCajones.style.display = (tipoIntActual === 'cajonera') ? 'block' : 'none';
  if (inpRep) inpRep.value = (m.cant_repisas !== undefined) ? m.cant_repisas : 0;

  // Sincronizar Controles de Cajonera
  const inpCantCaj = document.getElementById('modCantCajones');
  const selMontajeCaj = document.getElementById('modCajonesMontaje');
  const selTipoCorr = document.getElementById('modCajonesTipoCorredera');
  const selPosCorr = document.getElementById('modCajonesPosicionCorredera');
  const selLargoSlide = document.getElementById('modCajonesLargoCorredera');
  const badgeCaj = document.getElementById('badgeInfoCajonera');

  if (inpCantCaj) inpCantCaj.value = m.cant_cajones || 3;
  if (selMontajeCaj) selMontajeCaj.value = m.cajones_montaje || 'exterior';
  if (selTipoCorr) selTipoCorr.value = m.cajones_tipo_corredera || 'telescopica';
  if (selPosCorr) selPosCorr.value = m.cajones_posicion_corredera || 'baja';
  if (selLargoSlide) selLargoSlide.value = m.cajones_largo_corredera || 'auto';
  if (badgeCaj) {
    const cTipo = m.cajones_tipo_corredera || 'telescopica';
    const cDesc = (cTipo === 'oculta') ? '21mm' : (cTipo === 'metalica' ? '37.5mm' : '26mm');
    badgeCaj.textContent = `${m.cant_cajones || 3} Cajones (${cDesc})`;
  }

  // 2. Puertas Frontales Independientes
  const chkPuertas = document.getElementById('modTienePuertas');
  const grpPuertas = document.getElementById('grpDetallePuertas');
  const selMontajeP = document.getElementById('modPuertasMontaje');
  const selPosP = document.getElementById('modPuertasPosicionBisagra');
  const selCantBis = document.getElementById('modPuertasCantBisagras');
  const selListonP = document.getElementById('modPuertasListonTope');
  const badgePuertas = document.getElementById('badgeInfoPuertas');
  const lblCazoleta = document.getElementById('lblInfoCazoletaDetalle');

  const tienePuertas = !!(m.tiene_puertas || m.tipo_interior === 'puertas');
  if (chkPuertas) chkPuertas.checked = tienePuertas;
  if (grpPuertas) grpPuertas.style.display = tienePuertas ? 'block' : 'none';
  if (selMontajeP) selMontajeP.value = m.puertas_montaje || 'exterior';
  if (selPosP) selPosP.value = m.puertas_posicion_bisagra || m.puertas_apertura || ((m.ancho > 600) ? 'doble' : 'derecha');
  if (selCantBis) selCantBis.value = m.puertas_cant_bisagras || 'auto';
  if (selListonP) selListonP.value = m.puertas_liston_tope || 'ninguno';

  if (badgePuertas) {
    if (!tienePuertas) {
      badgePuertas.textContent = 'Sin Puertas';
      badgePuertas.className = 'cota-badge cota-badge-muted';
    } else {
      const posP = m.puertas_posicion_bisagra || m.puertas_apertura || ((m.ancho > 600) ? 'doble' : 'derecha');
      const montP = m.puertas_montaje || 'exterior';
      if (posP === 'corrediza') {
        badgePuertas.textContent = '2 Hojas Corredizas (Riel Doble)';
      } else {
        badgePuertas.textContent = `${posP === 'doble' ? '2 Hojas' : '1 Hoja'} (${montP})`;
      }
      badgePuertas.className = 'cota-badge';
    }
  }

  if (lblCazoleta && tienePuertas) {
    const posP = m.puertas_posicion_bisagra || m.puertas_apertura || ((m.ancho > 600) ? 'doble' : 'derecha');
    if (posP === 'corrediza') {
      lblCazoleta.innerHTML = `
        <strong>Sistema Corredizo de 2 Vías (Riel Doble)</strong> | Riel superior e inferior de aluminio anodizado.<br>
        <span style="color: var(--primary); font-weight: 600;">★ Descuento técnico de 80mm en profundidad interior de repisas y cajones para libre recorrido de las hojas.</span>
      `;
    } else {
      const hC = m.alto - ((m.tiene_zocalo && m.alto_zocalo > 0) ? m.alto_zocalo : 0);
      const bisInfo = calcularBisagrasPuerta(m, hC, m.ancho);
      lblCazoleta.innerHTML = `
        <strong>${bisInfo.tipoBisagra}</strong> | ${bisInfo.cantBis} bisagras por hoja.<br>
        Perforación cazoleta Ø${bisInfo.diametroCazoleta}mm x ${bisInfo.profPerforacion}mm prof. | Margen K = ${bisInfo.margenK}mm (centro a ${bisInfo.distCentroBorde}mm) | Extremos a ${bisInfo.distExtremos}mm.
        ${bisInfo.esPistonGas ? '<br><span style="color: var(--primary); font-weight: 600;">★ Incluye brazos neumáticos de pistón a gas.</span>' : ''}
      `;
    }
  }

  // Renderizar controles avanzados de parantes y repisas por espacio
  if (tipoIntActual === 'repisas') {
    renderizarControlesParantesYEspacios(m);
  }

  // Validación de límites técnicos en vivo
  validarLimitesTecnicosModulo(m, idx);

  // Asegurar que haya una subpestaña activa (por defecto 'carcasa')
  if (!document.querySelector('.subtab-pane.active')) {
    switchModuloConfigSubtab('carcasa');
  }
}

/**
 * Conmuta entre las subpestañas organizadoras del módulo activo (Carcasa, Fondo, Interior, Límites)
 * garantizando un diseño limpio, profesional y sin saturar al usuario de información.
 * @param {string} tabName - 'carcasa' | 'fondo' | 'interior' | 'limites'
 */
function switchModuloConfigSubtab(tabName) {
  const panes = document.querySelectorAll('.subtab-pane');
  const btns = document.querySelectorAll('.p-subtab-btn');
  panes.forEach(p => p.classList.remove('active'));
  btns.forEach(b => b.classList.remove('active'));

  const targetPane = document.getElementById(`subtab_${tabName}`);
  const targetBtn = document.getElementById(`btnSubtab_${tabName}`);
  if (targetPane) targetPane.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');
}
window.switchModuloConfigSubtab = switchModuloConfigSubtab;

// ==============================================================================
// 6. ALGORITMO DE RECÁLCULO DINÁMICO DE ANCHOS (Suma Total Invariable)
// ==============================================================================

/**
 * Se ejecuta al editar el ancho de un módulo particular.
/**
 * Se ejecuta al editar el ancho particular del módulo o columna activa.
 * Regla de negocio:
 * 1. Si el nuevo ancho hace que la suma de anchos NO sobrepase el Ancho Total del mueble,
 *    se permite directamente el cambio SIN alterar los anchos de las demás columnas.
 * 2. Solo si la suma total de anchos sobrepasa el Ancho Total del mueble, se ajustan y
 *    reducen proporcionalmente las demás columnas contiguas para respetar la cota máxima
 *    (garantizando un mínimo técnico de 150 mm en cada columna).
 * @param {number|string} nuevoAncho - Valor en mm ingresado por el usuario.
 */
function onEditarAnchoModulo(nuevoAncho) {
  const idx = AppState.moduloActivoIndex;
  const numModulos = AppState.modulos.length;
  if (numModulos <= 0) return;

  const m = AppState.modulos[idx];
  if (!m) return;

  const wNum = parseFloat(nuevoAncho);
  if (isNaN(wNum)) return;

  const colIdx = (m.columna_idx !== undefined && m.columna_idx !== null) ? m.columna_idx : idx;
  const nivelM = (m.nivel_apilado !== undefined && m.nivel_apilado !== null) ? m.nivel_apilado : 0;
  const minAncho = 150; // Mínimo técnico estándar comercial

  const colMods = AppState.modulos.filter(mod => 
    ((mod.columna_idx !== undefined && mod.columna_idx !== null) ? mod.columna_idx : AppState.modulos.indexOf(mod)) === colIdx
  );

  // Submódulos que comparten exactamente la misma columna y el mismo nivel apilado (lado a lado)
  const modsEnMismoNivel = colMods.filter(mod => 
    ((mod.nivel_apilado !== undefined && mod.nivel_apilado !== null) ? mod.nivel_apilado : 0) === nivelM
  );

  // =========================================================================
  // CASO 1: El submódulo pertenece a un nivel con múltiples submódulos contiguos (lado a lado)
  // =========================================================================
  if (modsEnMismoNivel.length > 1) {
    const otrosDelNivel = modsEnMismoNivel.filter(mod => mod !== m);
    const sumaOtrosNivel = otrosDelNivel.reduce((acc, mod) => acc + (mod.ancho || 0), 0);
    const columnas = obtenerColumnasModulares();
    const colActual = columnas.find(c => c.columna_idx === colIdx);
    const wNivelObjetivo = colActual ? colActual.ancho : (m.ancho + sumaOtrosNivel);

    let wClamped = Math.max(minAncho, Math.round(wNum));
    const sumaProyectada = wClamped + sumaOtrosNivel;

    if (sumaProyectada <= wNivelObjetivo) {
      // No sobrepasa el ancho del nivel: permitir sin modificar a los demás submódulos del nivel
      m.ancho = wClamped;
    } else {
      // Sobrepasa el ancho del nivel: reducir proporcionalmente a los otros submódulos de ese nivel
      const maxPermisible = wNivelObjetivo - (otrosDelNivel.length * minAncho);
      wClamped = Math.min(wClamped, maxPermisible);
      m.ancho = wClamped;

      let saldoPorRepartir = wNivelObjetivo - wClamped;
      let sumaOtrosRestante = sumaOtrosNivel;

      for (let k = 0; k < otrosDelNivel.length; k++) {
        const oMod = otrosDelNivel[k];
        if (k === otrosDelNivel.length - 1) {
          oMod.ancho = Math.max(minAncho, saldoPorRepartir);
        } else {
          const fraccion = (sumaOtrosRestante > 0) ? (oMod.ancho / sumaOtrosRestante) : (1 / (otrosDelNivel.length - k));
          let asignado = Math.floor((saldoPorRepartir * fraccion) / 5) * 5;
          const minParaResto = (otrosDelNivel.length - 1 - k) * minAncho;
          if (saldoPorRepartir - asignado < minParaResto) {
            asignado = saldoPorRepartir - minParaResto;
          }
          asignado = Math.max(minAncho, asignado);
          oMod.ancho = asignado;
          saldoPorRepartir -= asignado;
          sumaOtrosRestante -= oMod.ancho;
        }
      }

      const sumaRealNivel = modsEnMismoNivel.reduce((acc, mod) => acc + (mod.ancho || 0), 0);
      const residuo = wNivelObjetivo - sumaRealNivel;
      if (residuo !== 0 && otrosDelNivel.length > 0) {
        otrosDelNivel[0].ancho += residuo;
      }
    }

    renderizarBotonesSelectorCanvas();
    renderizarPestanasModulos();
    actualizarCanvas();
    validarLimitesTecnicosModulo(m, idx);
    return;
  }

  // =========================================================================
  // CASO 2: Columna completa o submódulo único en su nivel apilado
  // =========================================================================
  const columnas = obtenerColumnasModulares();
  const numCols = columnas.length;

  // Si hay una sola columna en el mueble
  if (numCols <= 1) {
    const wClamped = Math.max(minAncho, Math.round(wNum));
    columnas[0].modulos.forEach(mod => {
      mod.ancho = wClamped;
    });
    // Sincronizar AppState.anchoTotal y la entrada general si es columna única
    AppState.anchoTotal = wClamped;
    const elW = document.getElementById('dimAnchoTotal');
    if (elW) elW.value = wClamped;
    renderizarBotonesSelectorCanvas();
    renderizarPestanasModulos();
    actualizarCanvas();
    validarLimitesTecnicosModulo(AppState.modulos[idx], idx);
    return;
  }

  // Columnas restantes contiguas
  const otrasCols = columnas.filter(c => c.columna_idx !== colIdx);
  const sumaOtras = otrasCols.reduce((acc, c) => acc + (c.ancho || 0), 0);

  // Ancho deseado acotado al mínimo técnico comercial
  let wClamped = Math.max(minAncho, Math.round(wNum));
  const sumaProyectada = wClamped + sumaOtras;

  if (sumaProyectada <= AppState.anchoTotal) {
    // CASO A: La suma de todos los anchos NO sobrepasa la dimensión del mueble.
    // Se permite directamente sin modificar ni alterar los anchos de las otras columnas.
    AppState.modulos.forEach(mod => {
      const c = (mod.columna_idx !== undefined && mod.columna_idx !== null) ? mod.columna_idx : AppState.modulos.indexOf(mod);
      if (c === colIdx) {
        mod.ancho = wClamped;
      }
    });
  } else {
    // CASO B: La suma sobrepasa el Ancho Total del mueble.
    // Solo aquí se ajustan proporcionalmente las demás columnas para respetar la dimensión total.
    const maxPermisible = AppState.anchoTotal - (otrasCols.length * minAncho);
    wClamped = Math.min(wClamped, maxPermisible);

    // Asignar el nuevo ancho a los submódulos de la columna activa
    AppState.modulos.forEach(mod => {
      const c = (mod.columna_idx !== undefined && mod.columna_idx !== null) ? mod.columna_idx : AppState.modulos.indexOf(mod);
      if (c === colIdx) {
        mod.ancho = wClamped;
      }
    });

    // Saldo absoluto disponible para repartir entre las otras columnas
    let saldoPorRepartir = AppState.anchoTotal - wClamped;
    let sumaOtrasRestante = sumaOtras;

    for (let k = 0; k < otrasCols.length; k++) {
      const col = otrasCols[k];
      let nuevoW;
      if (k === otrasCols.length - 1) {
        nuevoW = Math.max(minAncho, saldoPorRepartir);
      } else {
        const fraccion = (sumaOtrasRestante > 0) ? (col.ancho / sumaOtrasRestante) : (1 / (otrasCols.length - k));
        let asignado = Math.floor((saldoPorRepartir * fraccion) / 5) * 5;
        const minParaResto = (otrasCols.length - 1 - k) * minAncho;
        if (saldoPorRepartir - asignado < minParaResto) {
          asignado = saldoPorRepartir - minParaResto;
        }
        nuevoW = Math.max(minAncho, asignado);
        saldoPorRepartir -= nuevoW;
        sumaOtrasRestante -= col.ancho;
      }
      col.modulos.forEach(mod => {
        mod.ancho = nuevoW;
      });
    }

    // Ajuste fino milimétrico para garantizar que la suma de todas las columnas no sobrepase AppState.anchoTotal
    const columnasFinales = obtenerColumnasModulares();
    const sumaReal = columnasFinales.reduce((acc, c) => acc + c.ancho, 0);
    const residuo = AppState.anchoTotal - sumaReal;
    if (residuo !== 0 && otrasCols.length > 0) {
      otrasCols[0].modulos.forEach(mod => {
        mod.ancho += residuo;
      });
    }
  }

  // Actualizar UI
  renderizarBotonesSelectorCanvas();
  renderizarPestanasModulos();
  actualizarCanvas();
  validarLimitesTecnicosModulo(AppState.modulos[idx], idx);
}

/**
 * Se ejecuta al editar la altura particular del módulo o submódulo activo.
 * Regla de negocio:
 * 1. Si la nueva altura hace que la suma de alturas de la columna NO sobrepase el Alto Total del mueble,
 *    se permite directamente el cambio SIN alterar las alturas de los demás submódulos de la columna.
 * 2. Solo si la suma total de alturas sobrepasa el Alto Total del mueble, se ajustan y
 *    reducen proporcionalmente los demás submódulos de la columna para respetar la cota máxima
 *    (garantizando un mínimo técnico de 150 mm en cada submódulo).
 * @param {number|string} nuevoAlto - Valor en mm ingresado por el usuario.
 */
function onEditarAltoModulo(nuevoAlto) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const hNum = parseFloat(nuevoAlto);
  if (isNaN(hNum)) return;

  const minAlto = 150; // Límite técnico comercial estándar mínimo
  const colIdx = (m.columna_idx !== undefined && m.columna_idx !== null) ? m.columna_idx : idx;
  const colMods = AppState.modulos.filter(mod => 
    ((mod.columna_idx !== undefined && mod.columna_idx !== null) ? mod.columna_idx : AppState.modulos.indexOf(mod)) === colIdx
  );

  const hTotalDisponible = obtenerAltoDisponibleModulos();

  if (colMods.length <= 1) {
    // Módulo único en la columna: permite cualquier altura menor o igual a las dimensiones sobrantes
    const hClamped = Math.max(minAlto, Math.min(hTotalDisponible, Math.round(hNum)));
    m.alto = hClamped;
  } else {
    // Submódulos apilados en la misma columna
    const otrosMods = colMods.filter(mod => mod !== m);
    const sumaOtros = otrosMods.reduce((acc, mod) => acc + (mod.alto || 0), 0);

    let hClamped = Math.max(minAlto, Math.round(hNum));
    const sumaProyectada = hClamped + sumaOtros;

    if (sumaProyectada <= hTotalDisponible) {
      // CASO A: La suma de alturas NO sobrepasa la dimensión disponible del mueble.
      m.alto = hClamped;
    } else {
      // CASO B: La suma sobrepasa la dimensión sobrante disponible.
      const maxPermitido = hTotalDisponible - (otrosMods.length * minAlto);
      hClamped = Math.min(hClamped, maxPermitido);
      m.alto = hClamped;

      let saldoPorRepartir = hTotalDisponible - hClamped;
      let sumaOtrosRestante = sumaOtros;

      for (let k = 0; k < otrosMods.length; k++) {
        const oMod = otrosMods[k];
        if (k === otrosMods.length - 1) {
          oMod.alto = Math.max(minAlto, saldoPorRepartir);
        } else {
          const fraccion = (sumaOtrosRestante > 0) ? (oMod.alto / sumaOtrosRestante) : (1 / (otrosMods.length - k));
          let asignado = Math.floor((saldoPorRepartir * fraccion) / 5) * 5;
          const minParaResto = (otrosMods.length - 1 - k) * minAlto;
          if (saldoPorRepartir - asignado < minParaResto) {
            asignado = saldoPorRepartir - minParaResto;
          }
          asignado = Math.max(minAlto, asignado);
          oMod.alto = asignado;
          saldoPorRepartir -= asignado;
          sumaOtrosRestante -= oMod.alto;
        }
      }

      // Ajuste fino milimétrico para garantizar que la suma exacta coincida con hTotalDisponible
      const sumaReal = colMods.reduce((acc, mod) => acc + (mod.alto || 0), 0);
      const residuo = hTotalDisponible - sumaReal;
      if (residuo !== 0 && otrosMods.length > 0) {
        otrosMods[0].alto += residuo;
      }
    }
  }

  // Actualizar UI
  renderizarBotonesSelectorCanvas();
  renderizarPestanasModulos();
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Se ejecuta al editar la profundidad particular del módulo activo.
 * (Puede ser menor o igual a la dimensión total).
 */
function onEditarProfModulo(nuevaProf) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const pClamped = Math.max(150, Math.min(AppState.profTotal, Math.round(nuevaProf)));
  m.profundidad = pClamped;

  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Actualiza en tiempo real el nombre del módulo activo cuando el usuario lo edita en el panel lateral.
 * Por defecto muestra el número del módulo/submódulo, pero al ser editado reemplaza inmediatamente
 * el texto mostrado en los botones superiores (pestañas y selector sobre el canvas) sin perder el foco.
 * @param {string} val - Nuevo nombre ingresado por el usuario.
 */
function onEditarNombreModulo(val) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.nombre = val;

  const colIdx = (m.columna_idx !== undefined && m.columna_idx !== null) ? m.columna_idx : idx;
  const nivel = (m.nivel_apilado !== undefined && m.nivel_apilado !== null) ? m.nivel_apilado : 0;
  const colMods = AppState.modulos.filter(mod => 
    ((mod.columna_idx !== undefined && mod.columna_idx !== null) ? mod.columna_idx : AppState.modulos.indexOf(mod)) === colIdx
  );
  const esApilado = colMods.length > 1;
  const nombrePorDefecto = esApilado ? `Submódulo ${colIdx + 1}.${nivel + 1}` : `Módulo ${colIdx + 1}`;
  const nombreMostrar = val && val.trim() ? val.trim() : nombrePorDefecto;

  // Actualizar título del panel lateral de configuración
  const lblTitulo = document.getElementById('lblTituloModuloActivo');
  if (lblTitulo) lblTitulo.innerText = `Configuración de ${nombreMostrar}`;

  // Actualizar texto del botón en la barra superior de pestañas sin reconstruir el DOM (evita perder foco)
  const txtPestana = document.getElementById(`txtBtnPestanaModulo_${idx}`);
  if (txtPestana) {
    txtPestana.textContent = nombreMostrar;
  }

  // Actualizar texto del botón en la barra de selección flotante sobre el canvas 3D
  const txtCanvas = document.getElementById(`txtBtnCanvasModulo_${idx}`);
  if (txtCanvas) {
    txtCanvas.textContent = nombreMostrar;
  }

  // Actualizar texto del botón en la lista de accesos directos del Paso 2
  const txtPaso2 = document.getElementById(`txtBtnAccesoPaso2_${idx}`);
  if (txtPaso2) {
    txtPaso2.textContent = `${nombreMostrar} (${m.ancho}x${m.alto} mm)`;
  }

  // Actualizar canvas 3D para refrescar el HUD con el nuevo nombre
  actualizarCanvas();
}

// Variable de estado para la orientación de subdivisión seleccionada
let orientacionSubdivActiva = 'horizontal';

/**
 * Disparador para subdividir el módulo activo o apilar submódulos adicionales.
 * Abre el modal interactivo PrimeNG donde el usuario elige la orientación y cantidad exacta de subdivisiones.
 */
function subdividirOApilarModuloActivo() {
  abrirModalSubdividirModulo();
}

/**
 * Conmuta la orientación elegida para subdividir (horizontal: apilados, vertical: lado a lado).
 * @param {'horizontal'|'vertical'} orientacion - Orientación elegida por el usuario
 */
function seleccionarOrientacionSubdiv(orientacion) {
  orientacionSubdivActiva = orientacion;
  const btnH = document.getElementById('btnOrientacionHoriz');
  const btnV = document.getElementById('btnOrientacionVert');

  if (btnH && btnV) {
    if (orientacion === 'horizontal') {
      btnH.style.border = '2px solid var(--primary)';
      btnH.style.background = 'rgba(59, 130, 246, 0.12)';
      btnV.style.border = '1px solid var(--border-color)';
      btnV.style.background = 'transparent';
    } else {
      btnV.style.border = '2px solid var(--primary)';
      btnV.style.background = 'rgba(59, 130, 246, 0.12)';
      btnH.style.border = '1px solid var(--border-color)';
      btnH.style.background = 'transparent';
    }
  }

  const activeIdx = AppState.moduloActivoIndex;
  const m = AppState.modulos[activeIdx];
  if (!m) return;

  const esH = (orientacion === 'horizontal');
  const dimTotal = esH ? m.alto : m.ancho;
  const minMedida = 150;
  const maxSub = Math.max(2, Math.floor(dimTotal / minMedida));

  const elAlto = document.getElementById('subdivModAltoTotal');
  const elTituloDim = document.getElementById('lblTituloDimensionDisponible');
  const elTituloMed = document.getElementById('lblTituloMedidaEstimada');
  const elMax = document.getElementById('lblMaxSubdivisiones');
  const inp = document.getElementById('inpNumSubdivisiones');

  if (elTituloDim) elTituloDim.textContent = esH ? 'Altura total a dividir:' : 'Ancho total a dividir:';
  if (elTituloMed) elTituloMed.textContent = esH ? 'Medida por cada submódulo:' : 'Medida por cada submódulo:';
  if (elAlto) elAlto.textContent = `${dimTotal} mm`;
  if (elMax) elMax.textContent = `${maxSub} subdivisiones (${maxSub} submódulos máx)`;

  // Renderizar píldoras de sugerencias rápidas (2 subdivisiones, 3 subdivisiones, etc.)
  renderizarSugerenciasRapidasSubdiv(dimTotal, esH);

  if (inp) {
    inp.min = 2;
    inp.max = maxSub;
    let actual = parseInt(inp.value, 10) || 2;
    actual = Math.max(2, Math.min(maxSub, actual));
    inp.value = actual;
    actualizarPreviewSubdivision(actual);
  }
}

/**
 * Renderiza botones de selección rápida según la dimensión disponible (2 subdivisiones, 3 subdivisiones, etc.)
 */
function renderizarSugerenciasRapidasSubdiv(dimTotal, esH) {
  const container = document.getElementById('subdivSugerenciasRapidas');
  if (!container) return;

  const minMedidaEstandar = 150;
  const maxSub = Math.min(6, Math.floor(dimTotal / minMedidaEstandar));

  let html = '';
  for (let n = 2; n <= maxSub; n++) {
    const dimBase = Math.floor((dimTotal / n) / 5) * 5;
    const texto = `${n} subdivisiones (${dimBase} mm c/u)`;
    html += `
      <button type="button" class="btn btn-xs btn-outline btn-sug-subdiv" id="btnSugSubdiv_${n}" onclick="seleccionarNumSubdivRapido(${n})" style="font-size: 11px; padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
        <span>${texto}</span>
      </button>
    `;
  }
  container.innerHTML = html;
}

/**
 * Permite al usuario elegir directamente la cantidad con los botones de sugerencia rápida.
 */
function seleccionarNumSubdivRapido(n) {
  const inp = document.getElementById('inpNumSubdivisiones');
  if (inp) {
    inp.value = n;
    actualizarPreviewSubdivision(n);
  }
}

/**
 * Abre el diálogo modal PrimeNG para configurar la subdivisión del módulo activo.
 * Calcula los límites técnicos permitidos tanto en altura (horizontal) como en ancho (vertical):
 *   - Mínimo de subdivisiones: 2 (genera 2 submódulos)
 *   - Medida estándar mínima por submódulo: 150 mm (límite técnico para ensamble con atornillador)
 *   - Medida estándar máxima comercial: 2400 mm
 *   - Máximo de subdivisiones permitidas: Math.floor(dimensión / 150)
 */
function abrirModalSubdividirModulo() {
  const activeIdx = AppState.moduloActivoIndex;
  const m = AppState.modulos[activeIdx];
  if (!m) return;

  const modal = document.getElementById('modalSubdividirModulo');
  if (!modal) return;

  const colIdx = (m.columna_idx !== undefined && m.columna_idx !== null) ? m.columna_idx : activeIdx;
  const nombreMod = m.nombre || `Módulo ${colIdx + 1}`;

  const elNombre = document.getElementById('subdivModNombre');
  const elMin = document.getElementById('lblMinSubdivisiones');

  if (elNombre) elNombre.textContent = nombreMod;
  if (elMin) elMin.textContent = '2 subdivisiones';

  // Inicializar en Horizontal por defecto y sincronizar interfaz
  seleccionarOrientacionSubdiv('horizontal');

  modal.style.display = 'flex';
}

/**
 * Cierra la ventana modal de subdivisión de módulo.
 */
function cerrarModalSubdividirModulo() {
  const modal = document.getElementById('modalSubdividirModulo');
  if (modal) modal.style.display = 'none';
}

/**
 * Incrementa o reduce la cantidad de subdivisiones respetando los límites estándar permitidos.
 * @param {number} delta - Variación numérica (+1 o -1)
 */
function ajustarNumSubdivisiones(delta) {
  const inp = document.getElementById('inpNumSubdivisiones');
  if (!inp) return;
  const min = parseInt(inp.min, 10) || 2;
  const max = parseInt(inp.max, 10) || 10;
  let val = (parseInt(inp.value, 10) || min) + delta;
  val = Math.max(min, Math.min(max, val));
  inp.value = val;
  actualizarPreviewSubdivision(val);
}

/**
 * Responde al cambio del valor en el input numérico de subdivisiones.
 * @param {string|number} val - Cantidad digitada por el usuario
 */
function onCambiarNumSubdivisiones(val) {
  actualizarPreviewSubdivision(val);
}

/**
 * Actualiza en tiempo real la medida estimada de cada subdivisión y valida las cotas estándar comerciales.
 * @param {string|number} nVal - Número propuesto de subdivisiones (2, 3, 4, etc.)
 */
function actualizarPreviewSubdivision(nVal) {
  const activeIdx = AppState.moduloActivoIndex;
  const m = AppState.modulos[activeIdx];
  if (!m) return;

  const esH = (orientacionSubdivActiva === 'horizontal');
  const dimTotal = esH ? m.alto : m.ancho;
  const minMedidaEstandar = 150;
  const maxMedidaEstandar = esH ? 2400 : 1000;
  const minSub = 2;
  const maxSub = Math.floor(dimTotal / minMedidaEstandar);

  const n = parseInt(nVal, 10);
  const btnConfirm = document.getElementById('btnConfirmarSubdivision');
  const lblAlt = document.getElementById('lblAlturaEstimadaSubdiv');
  const lblEstado = document.getElementById('lblEstadoEstandarSubdiv');

  const tipoDimTexto = esH ? 'altura' : 'ancho';
  const tipoModTexto = esH ? 'apilados verticalmente' : 'contiguos (lado a lado)';

  if (dimTotal < minMedidaEstandar * minSub) {
    if (btnConfirm) btnConfirm.disabled = true;
    if (lblAlt) lblAlt.textContent = 'Insuficiente';
    if (lblEstado) {
      lblEstado.textContent = `⛔ El ${tipoDimTexto} actual (${dimTotal} mm) es insuficiente para subdividir. La norma técnica estándar exige al menos 150 mm por submódulo (se requieren mínimo ${minMedidaEstandar * minSub} mm).`;
      lblEstado.style.background = 'rgba(239, 68, 68, 0.15)';
      lblEstado.style.color = 'var(--danger)';
      lblEstado.style.fontWeight = '600';
    }
    return;
  }

  if (isNaN(n) || n < minSub || n > maxSub) {
    if (btnConfirm) btnConfirm.disabled = true;
    if (lblAlt) lblAlt.textContent = 'Inválido';
    if (lblEstado) {
      if (n < minSub) {
        lblEstado.textContent = `⛔ Mínimo permitido: 2 subdivisiones (para dividir se requieren al menos 2 submódulos).`;
      } else {
        lblEstado.textContent = `⛔ Supera el máximo permitido (${maxSub} subdivisiones). Cada submódulo quedaría menor al estándar comercial de 150 mm.`;
      }
      lblEstado.style.background = 'rgba(239, 68, 68, 0.15)';
      lblEstado.style.color = 'var(--danger)';
      lblEstado.style.fontWeight = '600';
    }
    return;
  }

  const dimBase = Math.floor((dimTotal / n) / 5) * 5;
  const dimUltimo = dimTotal - (dimBase * (n - 1));

  if (btnConfirm) btnConfirm.disabled = false;
  if (lblAlt) {
    lblAlt.textContent = (dimBase === dimUltimo)
      ? `${dimBase} mm c/u (${n} submódulos ${tipoModTexto})`
      : `~${dimBase} mm (${n - 1} de ${dimBase} mm y 1 de ${dimUltimo} mm, ${tipoModTexto})`;
  }

  if (lblEstado) {
    const minCalculado = Math.min(dimBase, dimUltimo);
    const maxCalculado = Math.max(dimBase, dimUltimo);
    lblEstado.innerHTML = `✓ Medidas estándar aprobadas: <strong>${n} subdivisiones</strong> generan <strong>${n} submódulos ${tipoModTexto}</strong> de <strong>${minCalculado} mm</strong>${minCalculado !== maxCalculado ? ` a <strong>${maxCalculado} mm</strong>` : ''} (Norma comercial: 150 mm a ${maxMedidaEstandar} mm).`;
    lblEstado.style.background = 'rgba(16, 185, 129, 0.15)';
    lblEstado.style.color = 'var(--success)';
    lblEstado.style.fontWeight = '600';
  }

  // Resaltar botón de sugerencia activa si coincide
  document.querySelectorAll('.btn-sug-subdiv').forEach(b => {
    b.classList.remove('btn-primary');
    b.classList.add('btn-outline');
  });
  const btnSug = document.getElementById(`btnSugSubdiv_${n}`);
  if (btnSug) {
    btnSug.classList.remove('btn-outline');
    btnSug.classList.add('btn-primary');
  }
}

/**
 * Ejecuta la subdivisión del módulo en la cantidad y orientación exacta seleccionada por el usuario:
 *  - Si es Horizontal: divide la altura y apila los submódulos verticalmente (en la misma columna).
 *  - Si es Vertical: divide el ancho y coloca los submódulos uno al lado de otro (en columnas contiguas).
 */
function confirmarSubdivisionModulo() {
  const activeIdx = AppState.moduloActivoIndex;
  const m = AppState.modulos[activeIdx];
  if (!m) return;

  const inp = document.getElementById('inpNumSubdivisiones');
  const n = parseInt(inp ? inp.value : 2, 10);
  const esH = (orientacionSubdivActiva === 'horizontal');
  const dimTotal = esH ? m.alto : m.ancho;
  const minMedidaEstandar = 150;
  const maxSub = Math.floor(dimTotal / minMedidaEstandar);

  if (isNaN(n) || n < 2 || n > maxSub) {
    mostrarNotificacion(`La cantidad de subdivisiones debe estar entre 2 y ${maxSub}.`, "warning");
    return;
  }

  const colIdx = (m.columna_idx !== undefined && m.columna_idx !== null) ? m.columna_idx : activeIdx;
  const colMods = AppState.modulos.filter(mod => 
    ((mod.columna_idx !== undefined && mod.columna_idx !== null) ? mod.columna_idx : AppState.modulos.indexOf(mod)) === colIdx
  );

  if (esH) {
    // =========================================================================
    // CASO 1: SUBDIVISIÓN HORIZONTAL (SUBMÓDULOS APILADOS UNO SOBRE OTRO)
    // =========================================================================
    const hBase = Math.floor((dimTotal / n) / 5) * 5;
    const alturas = [];
    let sumaH = 0;
    for (let i = 0; i < n - 1; i++) {
      alturas.push(hBase);
      sumaH += hBase;
    }
    alturas.push(dimTotal - sumaH);

    if (colMods.length <= 1) {
      m.columna_idx = colIdx;
      m.nivel_apilado = 0;
      m.alto = alturas[0];
      m.nombre = `Submódulo ${colIdx + 1}.1`;
      // Al subdividir el módulo, sus submódulos deben ser carcasas vacías limpias (sin repisas forzadas)
      m.tipo_interior = 'carcasa';
      m.cant_repisas = 0;
      m.cant_cajones = 0;
      m.parantes_tipo = 'ninguno';
      m.parantes = [];
      m.espacios_repisas = [];

      const nuevosSubmodulos = [];
      for (let i = 1; i < n; i++) {
        const nuevo = {
          ...clonarConfiguracionModulo(m),
          id: Date.now() + (i * 100) + Math.floor(Math.random() * 50),
          nombre: `Submódulo ${colIdx + 1}.${i + 1}`,
          columna_idx: colIdx,
          nivel_apilado: i,
          ancho: m.ancho,
          alto: alturas[i],
          profundidad: m.profundidad,
          tiene_zocalo: false,
          alto_zocalo: 0,
          tiene_piso: true,
          tiene_techo: true,
          tiene_zocalo_sup: false,
          tipo_interior: 'carcasa',
          cant_repisas: 0,
          cant_cajones: 0,
          parantes_tipo: 'ninguno',
          parantes: [],
          espacios_repisas: []
        };
        nuevosSubmodulos.push(nuevo);
      }

      const insertIdx = AppState.modulos.indexOf(m) + 1;
      AppState.modulos.splice(insertIdx, 0, ...nuevosSubmodulos);
      AppState.moduloActivoIndex = insertIdx;

    } else {
      const nivelOriginal = m.nivel_apilado || 0;
      m.alto = alturas[0];
      m.tipo_interior = 'carcasa';
      m.cant_repisas = 0;
      m.cant_cajones = 0;
      m.parantes = [];
      m.espacios_repisas = [];
      
      const nuevosSubmodulos = [];
      for (let i = 1; i < n; i++) {
        const nuevo = {
          ...clonarConfiguracionModulo(m),
          id: Date.now() + (i * 100) + Math.floor(Math.random() * 50),
          nombre: `Submódulo ${colIdx + 1}.${nivelOriginal + i + 1}`,
          columna_idx: colIdx,
          nivel_apilado: nivelOriginal + i,
          ancho: m.ancho,
          alto: alturas[i],
          profundidad: m.profundidad,
          tiene_zocalo: false,
          alto_zocalo: 0,
          tiene_piso: true,
          tiene_techo: true,
          tiene_zocalo_sup: false,
          tipo_interior: 'carcasa',
          cant_repisas: 0,
          cant_cajones: 0,
          parantes: [],
          espacios_repisas: []
        };
        nuevosSubmodulos.push(nuevo);
      }

      const pos = AppState.modulos.indexOf(m);
      AppState.modulos.splice(pos + 1, 0, ...nuevosSubmodulos);

      const todosDeCol = AppState.modulos.filter(mod => 
        ((mod.columna_idx !== undefined && mod.columna_idx !== null) ? mod.columna_idx : AppState.modulos.indexOf(mod)) === colIdx
      );
      todosDeCol.sort((a, b) => (a.nivel_apilado || 0) - (b.nivel_apilado || 0));
      todosDeCol.forEach((mod, idx) => {
        mod.nivel_apilado = idx;
        mod.nombre = `Submódulo ${colIdx + 1}.${idx + 1}`;
      });

      AppState.moduloActivoIndex = pos + 1;
    }

  } else {
    // =========================================================================
    // CASO 2: SUBDIVISIÓN VERTICAL (SUBMÓDULOS UNO AL LADO DE OTRO)
    // =========================================================================
    const wBase = Math.floor((dimTotal / n) / 5) * 5;
    const anchos = [];
    let sumaW = 0;
    for (let i = 0; i < n - 1; i++) {
      anchos.push(wBase);
      sumaW += wBase;
    }
    anchos.push(dimTotal - sumaW);

    if (colMods.length > 1) {
      // -----------------------------------------------------------------------
      // SUB-CASO 2A: Subdivisión vertical de un SUBMÓDULO ESPECÍFICO en una columna apilada.
      // Solo afecta a este submódulo activo; los demás submódulos de la columna NO se alteran.
      // -----------------------------------------------------------------------
      const nivelM = (m.nivel_apilado !== undefined && m.nivel_apilado !== null) ? m.nivel_apilado : 0;
      m.ancho = anchos[0];
      m.sub_col_idx = 0;
      m.tipo_interior = 'carcasa';
      m.cant_repisas = 0;
      m.cant_cajones = 0;
      m.parantes_tipo = 'ninguno';
      m.parantes = [];
      m.espacios_repisas = [];
      m.nombre = `Submódulo ${colIdx + 1}.${nivelM + 1}.1`;

      const nuevosSubmodulos = [];
      for (let i = 1; i < n; i++) {
        const nuevo = {
          ...clonarConfiguracionModulo(m),
          id: Date.now() + (i * 100) + Math.floor(Math.random() * 50),
          nombre: `Submódulo ${colIdx + 1}.${nivelM + 1}.${i + 1}`,
          columna_idx: colIdx,
          nivel_apilado: nivelM,
          sub_col_idx: i,
          ancho: anchos[i],
          alto: m.alto,
          profundidad: m.profundidad,
          tiene_zocalo: false,
          alto_zocalo: 0,
          tiene_piso: true,
          tiene_techo: true,
          tiene_zocalo_sup: false,
          tipo_interior: 'carcasa',
          cant_repisas: 0,
          cant_cajones: 0,
          parantes_tipo: 'ninguno',
          parantes: [],
          espacios_repisas: []
        };
        nuevosSubmodulos.push(nuevo);
      }

      const insertIdx = AppState.modulos.indexOf(m) + 1;
      AppState.modulos.splice(insertIdx, 0, ...nuevosSubmodulos);
      AppState.moduloActivoIndex = insertIdx;

    } else {
      // -----------------------------------------------------------------------
      // SUB-CASO 2B: Subdivisión vertical de una COLUMNA COMPLETA (no apilada)
      // Genera (n) columnas contiguas independientes de piso a techo.
      // -----------------------------------------------------------------------
      colMods.forEach(mod => {
        mod.ancho = anchos[0];
        mod.sub_col_idx = 0;
      });

      // Desplazar las columnas posteriores para insertar las (n - 1) columnas adyacentes
      AppState.modulos.forEach(mod => {
        const c = (mod.columna_idx !== undefined && mod.columna_idx !== null) ? mod.columna_idx : AppState.modulos.indexOf(mod);
        if (c > colIdx) {
          mod.columna_idx = c + (n - 1);
        }
      });

      // Crear las nuevas columnas contiguas a la derecha
      const nuevosModulos = [];
      for (let i = 1; i < n; i++) {
        const nuevaCol = colIdx + i;
        colMods.forEach(modBase => {
          const nuevo = {
            ...clonarConfiguracionModulo(modBase),
            id: Date.now() + (i * 1000) + Math.floor(Math.random() * 500),
            columna_idx: nuevaCol,
            sub_col_idx: 0,
            ancho: anchos[i],
            nombre: `Módulo ${nuevaCol + 1}`
          };
          nuevosModulos.push(nuevo);
        });
      }

      const maxIdxCol = Math.max(...colMods.map(mod => AppState.modulos.indexOf(mod)));
      AppState.modulos.splice(maxIdxCol + 1, 0, ...nuevosModulos);

      // Re-indexar y nombrar ordenadamente todas las columnas de izquierda a derecha
      const columnasReorganizadas = obtenerColumnasModulares();
      columnasReorganizadas.forEach((col, idxReal) => {
        col.modulos.forEach(mod => {
          mod.columna_idx = idxReal;
          if (!mod.nombre || mod.nombre.startsWith('Módulo') || mod.nombre.startsWith('Submódulo')) {
            mod.nombre = (col.modulos.length > 1)
              ? `Submódulo ${idxReal + 1}.${(mod.nivel_apilado || 0) + 1}`
              : `Módulo ${idxReal + 1}`;
          }
        });
      });

      AppState.moduloActivoIndex = maxIdxCol + 1;
    }
  }

  cerrarModalSubdividirModulo();

  // Actualizar estados e interfaz gráfica
  AppState.modoSeleccion = 'modulo';
  renderizarBotonesSelectorCanvas();
  renderizarPestanasModulos();
  actualizarAccesosRapidosPaso2();
  actualizarFormularioModuloActivo();
  actualizarCanvas();
  mostrarNotificacion(
    esH
      ? `Módulo subdividido horizontalmente en ${n} submódulos apilados estándar.`
      : `Módulo subdividido verticalmente en ${n} submódulos contiguos (lado a lado) estándar.`,
    "success"
  );
}

/**
 * Elimina el submódulo activo si pertenece a una columna con 2 o más niveles apilados.
 * Su altura se transfiere automáticamente al submódulo adyacente para no dejar espacios vacíos.
 */
function eliminarSubmoduloActivo() {
  const activeIdx = AppState.moduloActivoIndex;
  const m = AppState.modulos[activeIdx];
  if (!m) return;

  const colIdx = (m.columna_idx !== undefined && m.columna_idx !== null) ? m.columna_idx : activeIdx;
  const colMods = AppState.modulos.filter(mod => 
    ((mod.columna_idx !== undefined && mod.columna_idx !== null) ? mod.columna_idx : AppState.modulos.indexOf(mod)) === colIdx
  );

  if (colMods.length <= 1) {
    mostrarNotificacion("No se puede eliminar el único módulo de la columna.", "warning");
    return;
  }

  const nivelM = (m.nivel_apilado !== undefined && m.nivel_apilado !== null) ? m.nivel_apilado : 0;
  const modsEnMismoNivel = colMods.filter(mod => 
    ((mod.nivel_apilado !== undefined && mod.nivel_apilado !== null) ? mod.nivel_apilado : 0) === nivelM
  );
  const idxEnArray = AppState.modulos.indexOf(m);

  if (modsEnMismoNivel.length > 1) {
    // -------------------------------------------------------------------------
    // CASO A: El submódulo comparte nivel con otros submódulos lado a lado.
    // Transfiere su ancho al submódulo contiguo del mismo nivel.
    // -------------------------------------------------------------------------
    modsEnMismoNivel.sort((a, b) => (a.sub_col_idx || 0) - (b.sub_col_idx || 0));
    const posEnNivel = modsEnMismoNivel.indexOf(m);
    const adyacente = (posEnNivel > 0) ? modsEnMismoNivel[posEnNivel - 1] : modsEnMismoNivel[posEnNivel + 1];
    if (adyacente) {
      adyacente.ancho += m.ancho;
    }
    AppState.modulos.splice(idxEnArray, 1);

    // Re-indexar sub_col_idx en este nivel
    const restantesNivel = AppState.modulos.filter(mod => 
      ((mod.columna_idx !== undefined && mod.columna_idx !== null) ? mod.columna_idx : AppState.modulos.indexOf(mod)) === colIdx &&
      ((mod.nivel_apilado !== undefined && mod.nivel_apilado !== null) ? mod.nivel_apilado : 0) === nivelM
    );
    restantesNivel.sort((a, b) => (a.sub_col_idx || 0) - (b.sub_col_idx || 0));
    restantesNivel.forEach((mod, sc) => {
      mod.sub_col_idx = sc;
      if (restantesNivel.length === 1) {
        mod.nombre = `Submódulo ${colIdx + 1}.${nivelM + 1}`;
      } else {
        mod.nombre = `Submódulo ${colIdx + 1}.${nivelM + 1}.${sc + 1}`;
      }
    });

  } else {
    // -------------------------------------------------------------------------
    // CASO B: Es el único submódulo de este nivel vertical.
    // Transfiere su altura al nivel adyacente para no dejar huecos verticales.
    // -------------------------------------------------------------------------
    const hLiberada = m.alto;
    colMods.sort((a, b) => (a.nivel_apilado || 0) - (b.nivel_apilado || 0));
    const posEnCol = colMods.indexOf(m);
    const adyacente = (posEnCol > 0) ? colMods[posEnCol - 1] : colMods[posEnCol + 1];

    if (adyacente) {
      adyacente.alto += hLiberada;
    }

    // Remover de la colección de módulos
    AppState.modulos.splice(idxEnArray, 1);

    // Re-indexar niveles verticales en la columna
    const restantes = AppState.modulos.filter(mod => 
      ((mod.columna_idx !== undefined && mod.columna_idx !== null) ? mod.columna_idx : AppState.modulos.indexOf(mod)) === colIdx
    );
    restantes.sort((a, b) => (a.nivel_apilado || 0) - (b.nivel_apilado || 0));
    restantes.forEach((mod, n) => {
      mod.nivel_apilado = n;
    });

    // Si solo queda 1 módulo y mantiene nombre por defecto "Submódulo X.Y", restaurar "Módulo X"
    if (restantes.length === 1 && restantes[0].nombre && restantes[0].nombre.startsWith('Submódulo')) {
      restantes[0].nombre = `Módulo ${colIdx + 1}`;
    }
  }

  AppState.moduloActivoIndex = Math.max(0, Math.min(AppState.modulos.length - 1, idxEnArray - 1));
  AppState.modoSeleccion = 'modulo';

  renderizarBotonesSelectorCanvas();
  renderizarPestanasModulos();
  actualizarAccesosRapidosPaso2();
  actualizarFormularioModuloActivo();
  actualizarCanvas();
  mostrarNotificacion("Submódulo eliminado. Su altura fue absorbida por el módulo adyacente.", "info");
}

/**
 * Distribuye la altura total de la columna equitativamente entre todos sus submódulos.
 */
function equilibrarAlturasColumnaActiva() {
  const activeIdx = AppState.moduloActivoIndex;
  const m = AppState.modulos[activeIdx];
  if (!m) return;

  const colIdx = (m.columna_idx !== undefined && m.columna_idx !== null) ? m.columna_idx : activeIdx;
  const colMods = AppState.modulos.filter(mod => 
    ((mod.columna_idx !== undefined && mod.columna_idx !== null) ? mod.columna_idx : AppState.modulos.indexOf(mod)) === colIdx
  );

  if (colMods.length <= 1) return;

  const hTotalCol = colMods.reduce((acc, mod) => acc + (mod.alto || 0), 0);
  const hBase = Math.floor((hTotalCol / colMods.length) / 5) * 5;
  const remanente = hTotalCol - (hBase * colMods.length);

  colMods.sort((a, b) => (a.nivel_apilado || 0) - (b.nivel_apilado || 0));
  colMods.forEach((mod, idx) => {
    mod.alto = (idx === colMods.length - 1) ? (hBase + remanente) : hBase;
  });

  actualizarFormularioModuloActivo();
  actualizarCanvas();
  mostrarNotificacion("Alturas de los submódulos de esta columna equilibradas equitativamente.", "info");
}

/**
 * Crea una copia profunda de la configuración de un módulo.
 * @param {Object} m - Objeto de módulo.
 * @returns {Object} Copia profunda del módulo.
 */
function clonarConfiguracionModulo(m) {
  return JSON.parse(JSON.stringify(m));
}

/**
 * Retorna la altura disponible para los módulos descontando el zócalo inferior del mueble.
 * @returns {number} Altura en mm disponible para carcasas de módulos.
 */
function obtenerAltoDisponibleModulos() {
  const hTotal = (AppState.altoTotal && AppState.altoTotal >= 150) ? AppState.altoTotal : 2100;
  const zH = (AppState.tieneZocalo && AppState.altoZocalo > 0) ? AppState.altoZocalo : 0;
  return Math.max(150, hTotal - zH);
}

/**
 * Ajusta automáticamente la altura de todos los módulos a las dimensiones sobrantes del mueble
 * una vez descontado el zócalo inferior perimétrico.
 */
function ajustarAlturasModulosPorZocalo() {
  const altoDisponible = obtenerAltoDisponibleModulos();
  actualizarUIZocaloGeneral();

  if (!AppState.modulos || AppState.modulos.length === 0) return;

  const columnas = obtenerColumnasModulares();
  columnas.forEach(col => {
    if (col.modulos.length <= 1) {
      col.modulos.forEach(m => {
        m.alto = altoDisponible;
      });
    } else {
      // Submódulos apilados en la misma columna: reparto proporcional
      const sumaActual = col.modulos.reduce((sum, m) => sum + (m.alto || 0), 0);
      let acumulado = 0;
      col.modulos.sort((a, b) => (a.nivel_apilado || 0) - (b.nivel_apilado || 0));

      col.modulos.forEach((m, idx) => {
        if (idx === col.modulos.length - 1) {
          m.alto = Math.max(150, altoDisponible - acumulado);
        } else {
          const frac = (sumaActual > 0) ? (m.alto / sumaActual) : (1 / col.modulos.length);
          const nuevoH = Math.max(150, Math.floor((altoDisponible * frac) / 5) * 5);
          m.alto = nuevoH;
          acumulado += nuevoH;
        }
      });
    }
  });

  actualizarFormularioModuloActivo();
  actualizarCanvas();
  actualizarBadgeEstado();
}

/**
 * Actualiza los campos y badges del zócalo perimétrico general en la interfaz,
 * evaluando en vivo la cantidad y ubicación estándar de los listones según la norma <= 600mm y separación libre >= 150mm.
 */
function actualizarUIZocaloGeneral() {
  const chk = document.getElementById('muebleTieneZocalo');
  const grp = document.getElementById('grpDetalleZocaloGeneral');
  const inpAlto = document.getElementById('muebleAltoZocalo');
  const inpRetrans = document.getElementById('muebleRetransZocalo');
  const selListones = document.getElementById('muebleCantListones');
  const badge = document.getElementById('badgeZocaloEstado');
  const badgeNorma = document.getElementById('badgeNormaZocalo');
  const lblNorma = document.getElementById('lblDetalleNormaZocalo');

  const tieneZ = !!AppState.tieneZocalo;
  const zH = tieneZ ? (AppState.altoZocalo || 100) : 0;
  const altoDisp = obtenerAltoDisponibleModulos();
  const t = AppState.espesorMelamina || 18;
  const anchoInterior = Math.max(0, (AppState.anchoTotal || 600) - (2 * t));

  if (chk) chk.checked = tieneZ;
  if (grp) grp.style.display = tieneZ ? 'block' : 'none';
  if (inpAlto) inpAlto.value = (AppState.altoZocalo !== undefined) ? AppState.altoZocalo : 100;
  if (inpRetrans) inpRetrans.value = (AppState.retransZocalo !== undefined) ? AppState.retransZocalo : 35;

  // Evaluar estándares de listones
  const calcFn = (window.Preview3D && window.Preview3D.calcularListonesZocaloEstandar) || window.calcularListonesZocaloEstandar;
  if (typeof calcFn === 'function') {
    const resNorma = calcFn(
      AppState.anchoTotal, AppState.profTotal, AppState.modulos,
      t, zH, AppState.retransZocalo, AppState.cantListonesZocalo
    );

    if (selListones) {
      // 1. Actualizar opción "auto"
      const optAuto = selListones.querySelector('option[value="auto"]');
      if (optAuto) {
        optAuto.textContent = `Auto Estándar (${resNorma.cantSugerida} listón(es): divide interior en ${resNorma.cantSugerida + 1} partes)`;
      }

      // 2. Actualizar dinámicamente cada opción con advertencia o confirmación de separación
      const opciones = selListones.querySelectorAll('option');
      opciones.forEach(opt => {
        const val = opt.value;
        if (val !== 'auto') {
          const numK = parseInt(val);
          if (numK === 0) {
            opt.textContent = `0 listones (Solo marco perimétrico: vano libre ${anchoInterior} mm)`;
            opt.style.color = '';
          } else if (!isNaN(numK)) {
            const partes = numK + 1;
            const paso = anchoInterior / partes;
            const sepLibre = Math.round(paso - t);
            if (sepLibre < 150) {
              opt.textContent = `${numK} listones (⛔ No permitido: sep. libre ${sepLibre} mm < 150 mm)`;
              opt.style.color = '#EF4444';
            } else {
              opt.textContent = `${numK} listón(es) (✓ Divide en ${partes} partes: sep. ${sepLibre} mm)`;
              opt.style.color = '';
            }
          }
        }
      });

      selListones.value = String((AppState.cantListonesZocalo !== undefined) ? AppState.cantListonesZocalo : 'auto');
    }

    if (badgeNorma) {
      if (resNorma.tipoAlerta === 'danger' || !resNorma.cumpleNorma) {
        badgeNorma.className = 'badge badge-danger';
        badgeNorma.style.background = '#EF4444';
        badgeNorma.style.color = '#FFFFFF';
        badgeNorma.innerText = `⛔ No permitido (~${resNorma.separacionMax} mm < 150 mm)`;
      } else if (resNorma.tipoAlerta === 'warning') {
        badgeNorma.className = 'badge badge-warning';
        badgeNorma.style.background = '#F59E0B';
        badgeNorma.style.color = '#000000';
        badgeNorma.innerText = `⚠️ Luz máx. ${resNorma.separacionMax} mm > 600 mm`;
      } else {
        badgeNorma.className = 'badge badge-success';
        badgeNorma.style.background = '';
        badgeNorma.style.color = '';
        badgeNorma.innerText = (resNorma.cantActual === 0)
          ? `✓ Marco Base (${resNorma.separacionMax} mm)`
          : `✓ ${resNorma.cantActual} listón(es) / ${resNorma.cantActual + 1} partes (~${resNorma.separacionMax} mm)`;
      }
    }

    if (lblNorma) {
      if (resNorma.tipoAlerta === 'danger' || !resNorma.cumpleNorma) {
        lblNorma.innerHTML = `<span style="color: #EF4444; font-weight: 700; display: block; padding: 6px 10px; background: rgba(239, 68, 68, 0.12); border-radius: 4px; border-left: 3px solid #EF4444;">${resNorma.mensajeNorma}</span>`;
      } else if (resNorma.tipoAlerta === 'warning') {
        lblNorma.innerHTML = `<span style="color: #D97706; font-weight: 600; display: block; padding: 6px 10px; background: rgba(245, 158, 11, 0.12); border-radius: 4px; border-left: 3px solid #F59E0B;">${resNorma.mensajeNorma}</span>`;
      } else {
        lblNorma.innerHTML = `<span style="color: var(--text-muted);">${resNorma.mensajeNorma}</span>`;
      }
    }
  } else if (selListones) {
    selListones.value = String((AppState.cantListonesZocalo !== undefined) ? AppState.cantListonesZocalo : 'auto');
  }

  const lblSobrante = document.getElementById('lblAltoSobranteModulos');
  const lblTotal = document.getElementById('lblAltoTotalRef');
  const lblZocalo = document.getElementById('lblAltoZocaloRef');

  if (lblSobrante) lblSobrante.innerText = altoDisp;
  if (lblTotal) lblTotal.innerText = AppState.altoTotal || 2100;
  if (lblZocalo) lblZocalo.innerText = zH;

  if (badge) {
    badge.className = tieneZ ? 'badge badge-info' : 'badge badge-normal';
    badge.innerText = tieneZ ? `Activo (${zH}mm)` : 'Sin Zócalo';
  }

  // Sincronizar alertas flotantes técnicas inmediatamente
  if (typeof evaluarAlertasGeneralesYModulo === 'function') {
    evaluarAlertasGeneralesYModulo();
  }
}

/**
 * Activa o desactiva el zócalo inferior perimétrico global al inicio del diseño.
 * Los módulos se acomodan en tiempo real a las dimensiones sobrantes.
 * @param {boolean} tieneZocalo - Estado del switch de zócalo inferior.
 */
function onToggleZocaloGeneral(tieneZocalo) {
  AppState.tieneZocalo = !!tieneZocalo;
  if (AppState.tieneZocalo && (!AppState.altoZocalo || AppState.altoZocalo <= 0)) {
    AppState.altoZocalo = 100;
  }
  ajustarAlturasModulosPorZocalo();
  mostrarNotificacion(
    AppState.tieneZocalo 
      ? `Zócalo inferior activado (${AppState.altoZocalo} mm). Módulos adaptados a ${obtenerAltoDisponibleModulos()} mm sobrantes.`
      : "Zócalo inferior desactivado. Módulos ocupan la altura total.",
    "info"
  );
}

/**
 * Modifica el ancho/altura de listón del zócalo inferior continuo.
 * @param {number|string} alto - Dimensión del zócalo en mm.
 */
function onEditarAltoZocaloGeneral(alto) {
  const val = Math.max(10, parseFloat(alto) || 100);
  AppState.altoZocalo = val;
  ajustarAlturasModulosPorZocalo();
}

/**
 * Modifica la cantidad de listones transversales interiores de refuerzo del zócalo perimétrico.
 * @param {number|string} cant - Cantidad de listones ('auto' o número).
 */
function onEditarCantListonesGeneral(cant) {
  if (cant === 'auto' || cant === undefined || cant === null || cant === '') {
    AppState.cantListonesZocalo = 'auto';
  } else {
    AppState.cantListonesZocalo = Math.max(0, parseInt(cant) || 0);
  }
  actualizarUIZocaloGeneral();
  actualizarCanvas();

  // Si la cantidad seleccionada viola la norma mínima, emitir notificación de error
  const calcFn = (window.Preview3D && window.Preview3D.calcularListonesZocaloEstandar) || window.calcularListonesZocaloEstandar;
  if (typeof calcFn === 'function') {
    const res = calcFn(
      AppState.anchoTotal, AppState.profTotal, AppState.modulos,
      AppState.espesorMelamina, AppState.altoZocalo, AppState.retransZocalo, AppState.cantListonesZocalo
    );
    if (res && (!res.cumpleNorma || res.tipoAlerta === 'danger')) {
      mostrarNotificacion(res.mensajeNorma, "error");
    }
  }
}

/**
 * Modifica el retranqueo frontal del zócalo inferior.
 * @param {number|string} retrans - Retranqueo en mm.
 */
function onEditarRetransZocaloGeneral(retrans) {
  const val = (retrans !== undefined && retrans !== null && retrans !== '' && !isNaN(retrans))
    ? Math.max(0, parseFloat(retrans))
    : 0;
  AppState.retransZocalo = val;
  actualizarUIZocaloGeneral();
  actualizarCanvas();
}

/**
 * Conmuta si el módulo activo lleva o no zócalo (función legada conservada).
 */
function onToggleZocaloModulo(tieneZocalo) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.tiene_zocalo = tieneZocalo;
  const grpZocalo = document.getElementById('grpDetalleZocalo');
  if (grpZocalo) grpZocalo.style.display = tieneZocalo ? 'grid' : 'none';

  actualizarCanvas();
}

/**
 * Cambia la altura del zócalo del módulo activo.
 */
function onEditarAltoZocalo(alto) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.alto_zocalo = Math.max(10, parseFloat(alto) || 100);
  actualizarCanvas();
}

/**
 * Cambia el retranqueo frontal del zócalo (en mm).
 */
function onEditarRetransZocalo(retrans) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.retrans_zocalo = Math.max(0, parseFloat(retrans) || 0);
  actualizarCanvas();
}

/**
 * Determina la cantidad de listones internos transversales de soporte para el zócalo de un módulo.
 * Permite compatibilidad total tanto con configuraciones legadas como con la selección directa (0, 1, 2, 3 listones).
 *
 * @param {Object} m - Datos del módulo analizado.
 * @returns {number} Cantidad de listones de soporte transversales (0, 1, 2 o más).
 */
/**
 * Actualiza dinámicamente las opciones del selector de listones del zócalo inferior en la UI.
 * Garantiza que siempre muestre las 5 opciones oficiales (0 a 4) incluso si el navegador tiene HTML en caché:
 * - 0: Solo perímetro base.
 * - 1: 1 listón al centro (divide en 2 bloques).
 * - 2: 2 listones a tercios (divide en 3 bloques).
 * - 3: 3 listones a cuartos (divide en 4 bloques).
 * - 4: 4 listones a quintos (divide en 5 bloques).
 * @param {HTMLSelectElement} sel - Elemento select de listones de zócalo.
 */
function actualizarOpcionesCantListonesZocaloUI(sel) {
  if (!sel) return;
  const opciones = [
    { val: '0', txt: '0 listones (Solo perímetro base)' },
    { val: '1', txt: '1 listón (Al centro / divide en 2 bloques)' },
    { val: '2', txt: '2 listones (Divide en 3 bloques / 1/3 c/u)' },
    { val: '3', txt: '3 listones (Divide en 4 bloques / 1/4 c/u)' },
    { val: '4', txt: '4 listones (Divide en 5 bloques / 1/5 c/u)' }
  ];
  sel.innerHTML = '';
  opciones.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.val;
    o.textContent = opt.txt;
    sel.appendChild(o);
  });
}

function resolverCantListonesInternosZocalo(m) {
  if (!m) return 0;
  if (m.cant_listones_internos !== undefined && m.cant_listones_internos !== null) {
    return Math.max(0, parseInt(m.cant_listones_internos) || 0);
  }
  const raw = parseInt(m.cant_listones);
  if (isNaN(raw)) return 0;
  return Math.max(0, raw);
}

/**
 * Modifica la cantidad de listones internos de soporte en el zócalo del módulo activo.
 * Se distribuyen en la parte interna transversalmente para dar soporte al mueble que viene arriba:
 * - 0 listones: Solo marco perimetral base.
 * - 1 listón: Ubicado exactamente al centro del bloque (ancho / 2).
 * - 2 listones: Ubicados dividiendo el bloque en 3 partes iguales (un tercio cada uno: a 1/3 y 2/3).
 * - 3 listones: Ubicados dividiendo el bloque en 4 partes iguales (un cuarto cada uno).
 *
 * @param {string|number} cant - Cantidad de listones de soporte elegida en el selector.
 */
function onEditarCantListones(cant) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const n = Math.max(0, parseInt(cant) || 0);
  m.cant_listones_internos = n;
  m.cant_listones = n;
  actualizarCanvas();
}

/**
 * Conmuta si el módulo activo lleva laterales (costados de carcasa).
 * Si se desactiva, los costados se retiran quedando el módulo vacío lateralmente.
 * @param {boolean} tieneLaterales
 */
function onToggleLateralesModulo(tieneLaterales) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.tiene_laterales = tieneLaterales;
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Conmuta si el fondo panel lleva listones posteriores atornillados a pared.
 * @param {boolean} tieneListones
 */
function onTogglePanelListonesPared(tieneListones) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.panel_tiene_listones_pared = tieneListones;
  const grp = document.getElementById('grpDetalleListonesPanel');
  if (grp) grp.style.display = tieneListones ? 'block' : 'none';

  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Edita la cantidad de listones posteriores de anclaje a pared para fondo panel.
 * @param {string|number} cant
 */
function onEditarCantListonesPanel(cant) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.cant_listones_panel = Math.max(1, Math.min(4, parseInt(cant) || 2));
  actualizarCanvas();
}

/**
 * Cambia la orientación de los listones de anclaje de pared en fondo panel ('horizontal' o 'vertical').
 * @param {string} orient - 'horizontal' | 'vertical'
 */
function onCambiarPanelOrientacionListones(orient) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.panel_orientacion_listones = orient;
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Edita el ancho/medida del listón posterior de anclaje a pared en mm.
 * @param {string|number} medida
 */
function onEditarMedidaListonPanel(medida) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.medida_liston_panel = Math.max(20, parseFloat(medida) || 80);
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Conmuta si el módulo activo lleva o no piso de carcasa.
 * @param {boolean} tienePiso
 */
function onTogglePisoModulo(tienePiso) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.tiene_piso = tienePiso;
  const grpOpcionesPiso = document.getElementById('grpDetalleOpcionesPiso');
  if (grpOpcionesPiso) grpOpcionesPiso.style.display = tienePiso ? 'block' : 'none';

  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Conmuta si el piso lleva amarres / listones de piso.
 * @param {boolean} tieneListonPiso
 */
function onToggleListonPiso(tieneListonPiso) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.tiene_liston_piso = tieneListonPiso;
  const grpListonPiso = document.getElementById('grpDetalleListonPiso');
  if (grpListonPiso) grpListonPiso.style.display = tieneListonPiso ? 'block' : 'none';

  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Cambia la cantidad de listones en el piso (1 a 4).
 * @param {string|number} cant
 */
function onEditarCantListonesPiso(cant) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.cant_listones_piso = Math.max(1, Math.min(4, parseInt(cant) || 2));
  actualizarCanvas();
}

/**
 * Cambia la medida/ancho del listón de piso en mm ingresado por el usuario.
 * @param {string|number} medida
 */
function onEditarMedidaListonPiso(medida) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const val = Math.max(10, parseFloat(medida) || 80);
  m.medida_liston_piso = val;
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Conmuta si el módulo activo lleva o no zócalo superior.
 */
function onToggleZocaloSupModulo(tieneZocaloSup) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.tiene_zocalo_sup = tieneZocaloSup;
  const grpZocaloSup = document.getElementById('grpDetalleZocaloSup');
  if (grpZocaloSup) grpZocaloSup.style.display = tieneZocaloSup ? 'grid' : 'none';

  actualizarCanvas();
}

/**
 * Cambia la altura del zócalo superior del módulo activo.
 */
function onEditarAltoZocaloSup(alto) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.alto_zocalo_sup = Math.max(10, parseFloat(alto) || 70);
  actualizarCanvas();
}

/**
 * Conmuta si el módulo activo lleva listones en la parte posterior (pared).
 * @param {boolean} tienePost
 */
function onToggleListonPost(tienePost) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.tiene_liston_post = tienePost;
  const grpPost = document.getElementById('grpDetalleListonPost');
  if (grpPost) grpPost.style.display = tienePost ? 'block' : 'none';

  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Cambia la orientación de los listones en el fondo / parte posterior ('horizontal' o 'vertical').
 * Si se elige 'vertical', los listones se distribuyen a lo ancho del módulo y recorren la altura del vano.
 * Se actualiza la UI para reflejar la distribución correspondiente.
 * @param {string} orient - 'horizontal' | 'vertical'
 */
function onCambiarOrientacionListonesPost(orient) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.orientacion_liston_post = orient;
  actualizarOpcionesCantListonesPostUI(orient, m.cant_listones_post || 2);
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Actualiza dinámicamente las opciones del selector de cantidad de listones en el fondo según su orientación.
 * @param {string} orient - 'horizontal' | 'vertical'
 * @param {number} valorActual - Cantidad seleccionada actualmente
 */
function actualizarOpcionesCantListonesPostUI(orient, valorActual) {
  const sel = document.getElementById('modCantListonesPost');
  const hint = document.getElementById('hintListonPostDistribucion');
  if (!sel) return;

  const esVert = (orient === 'vertical');
  sel.innerHTML = esVert
    ? `
      <option value="1">1 listón (Central)</option>
      <option value="2">2 listones (Laterales Izquierdo + Derecho)</option>
      <option value="3">3 listones (Laterales + Central)</option>
      <option value="4">4 listones (Distribuido equitativo)</option>
      <option value="5">5 listones (Alta rigidez)</option>
      <option value="6">6 listones (Reforzado industrial continuo)</option>
    `
    : `
      <option value="1">1 listón (Superior - Altillo/Nicho bajo)</option>
      <option value="2">2 listones (Superior + Inferior - Estándar)</option>
      <option value="3">3 listones (+ Refuerzo Central - Carga media/alta)</option>
      <option value="4">4 listones (Doble Refuerzo - Torres/Columnas)</option>
      <option value="5">5 listones (Triple Refuerzo - Piso a Techo)</option>
      <option value="6">6 listones (Refuerzo Pesado Industrial)</option>
    `;
  sel.value = valorActual || 2;

  if (hint) {
    hint.textContent = esVert
      ? "Listones verticales en el fondo repartidos a lo ancho para fijación a pared."
      : "Listones horizontales en el fondo repartidos a lo alto según estándar de carga y altura.";
  }
}

/**
 * Edita la cantidad de listones en la parte posterior (1 a 6 o más).
 * @param {string|number} cant
 */
function onEditarCantListonesPost(cant) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.cant_listones_post = Math.max(1, Math.min(6, parseInt(cant) || 2));
  actualizarCanvas();
}

/**
 * Edita el ancho/medida del listón posterior en mm ingresado por el usuario.
 * @param {string|number} medida
 */
function onEditarMedidaListonPost(medida) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const val = Math.max(10, parseFloat(medida) || 80);
  m.medida_liston_post = val;
  m.ancho_liston_post = val;
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Conmuta si el módulo activo lleva o no techo de carcasa.
 * @param {boolean} tieneTecho
 */
function onToggleTechoModulo(tieneTecho) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.tiene_techo = tieneTecho;
  const grpOpcionesTecho = document.getElementById('grpDetalleOpcionesTecho');
  if (grpOpcionesTecho) grpOpcionesTecho.style.display = tieneTecho ? 'block' : 'none';

  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Conmuta si el módulo lleva techo de listón (amarres superiores).
 * Si es falso, se modela techo sólido completo estándar.
 * @param {boolean} tieneTecho
 */
function onToggleListonTecho(tieneTecho) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.tiene_liston_techo = tieneTecho;
  const grpTecho = document.getElementById('grpDetalleListonTecho');
  if (grpTecho) grpTecho.style.display = tieneTecho ? 'block' : 'none';

  if (!tieneTecho && m.techo_sobre_liston) {
    m.techo_sobre_liston = false;
    const chkTechoSobre = document.getElementById('modTechoSobreListon');
    if (chkTechoSobre) chkTechoSobre.checked = false;
    const grpTechoSobre = document.getElementById('grpDetalleTechoSobre');
    if (grpTechoSobre) grpTechoSobre.style.display = 'none';
  }

  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Edita la cantidad de listones en el techo (1 a 4).
 * @param {string|number} cant
 */
function onEditarCantListonesTecho(cant) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.cant_listones_techo = Math.max(1, Math.min(4, parseInt(cant) || 2));
  actualizarCanvas();
}

/**
 * Edita la medida/ancho del listón de techo en mm ingresado por el usuario.
 * @param {string|number} medida
 */
function onEditarMedidaListonTecho(medida) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const val = Math.max(10, parseFloat(medida) || 80);
  m.medida_liston_techo = val;
  m.ancho_liston_techo = val;
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Cambia el retranqueo frontal interior de repisas y parantes en mm ingresado por el usuario.
 * @param {string|number} desc
 */
function onEditarDescuentoFrontal(desc) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const val = Math.max(0, parseFloat(desc) || 0);
  m.descuento_frontal = val;
  m.retrans_repisas = val;

  const lblDescuento = document.getElementById('lblDescuentoProfDetalle');
  const profInfo = calcularProfundidadUtilInterior(m, AppState.espesorMelamina);
  if (lblDescuento) {
    lblDescuento.innerHTML = `
      <strong>${profInfo.profMod} mm (nominal)</strong> → <span style="font-size: 11px; font-weight: 700; color: var(--accent);">${profInfo.profUtil} mm (útil)</span><br>
      <span style="color: var(--text-muted); font-size: 9px;">Descuentos: ${profInfo.detallesTexto}</span>
    `;
  }

  actualizarCanvas();
  if (m.tipo_interior === 'repisas') {
    renderizarControlesParantesYEspacios(m);
  }
}

/**
 * Conmuta si sobre el techo de listón va un techo / tapa sobrepuesta.
 * Descuenta la altura del techo de los costados para conservar la altura exacta del mueble.
 * @param {boolean} tieneTechoSobre
 */
function onToggleTechoSobreListon(tieneTechoSobre) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.techo_sobre_liston = tieneTechoSobre;
  const grpTechoSobre = document.getElementById('grpDetalleTechoSobre');
  if (grpTechoSobre) grpTechoSobre.style.display = tieneTechoSobre ? 'block' : 'none';

  const t = AppState.espesorMelamina;
  const hTecho = m.techo_doble_melamina ? (2 * t) : t;

  const lblEspesor = document.getElementById('lblEspesorDescontado');
  if (lblEspesor) lblEspesor.textContent = hTecho;

  if (tieneTechoSobre) {
    mostrarNotificacion(`Techo sobre listón incluido: se descuentan ${hTecho} mm de los costados para conservar la altura exacta de ${m.alto} mm.`, "info");
  } else {
    mostrarNotificacion(`Techo sobre listón removido: los costados recuperan su altura completa.`, "info");
  }

  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Conmuta si el techo sobrepuesto va con doble melamina (doble engrosado 36mm).
 * Descuenta el espesor total (2 x melamina) de la altura de los costados.
 * @param {boolean} esDoble
 */
function onToggleTechoDobleMelamina(esDoble) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.techo_doble_melamina = esDoble;
  const t = AppState.espesorMelamina;
  const hTecho = esDoble ? (2 * t) : t;

  const lblEspesor = document.getElementById('lblEspesorDescontado');
  if (lblEspesor) lblEspesor.textContent = hTecho;

  mostrarNotificacion(
    esDoble
      ? `Techo configurado con DOBLE melamina (${hTecho} mm engrosado). Se descuentan ${hTecho} mm de los costados.`
      : `Techo configurado con melamina simple (${hTecho} mm). Se descuentan ${hTecho} mm de los costados.`,
    "info"
  );

  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Funciones de compatibilidad hacia atrás para llamadas heredadas.
 */
function onToggleListonAmarre(tieneAmarre) {
  onToggleListonPost(tieneAmarre);
  onToggleListonTecho(tieneAmarre);
}
function onEditarCantListonesAmarre(cant) {
  onEditarCantListonesPost(cant);
  onEditarCantListonesTecho(cant);
}
function onEditarAltoListonAmarre(alto) {
  onEditarMedidaListonPost(alto);
  onEditarMedidaListonTecho(alto);
}
function onCambiarPosicionListonAmarre(pos) {
  if (pos === 'posterior') {
    onToggleListonPost(true);
    onToggleListonTecho(false);
  } else if (pos === 'techo') {
    onToggleListonPost(false);
    onToggleListonTecho(true);
  } else {
    onToggleListonPost(true);
    onToggleListonTecho(true);
  }
}

/**
 * Calcula la profundidad útil neta y el desglose de descuentos para parantes y repisas.
 * Respeta rigurosamente las normas técnicas:
 * - Si el fondo es Melamina: el módulo YA NO tiene listón posterior; descuenta únicamente el espesor t del fondo.
 * - Si el fondo es MDF: descuenta el retranqueo posterior ingresado (por default 0 mm) más el grosor del MDF.
 * @param {Object} m - Módulo actual.
 * @param {number} [t] - Espesor de la melamina (18 o 15 mm).
 * @returns {Object} Desglose detallado con profUtil, descuentoFrontal, descuentoPosterior, y texto explicativo.
 */
/**
 * Calcula las dimensiones y retranqueos estructurales de la carcasa del módulo.
 * REGLA TÉCNICA PRINCIPAL (Carpintería Arquitectónica y Estándares):
 * - Cuando las puertas o tapas de cajón son EXTERIORES (sobrepuestas o semi-sobrepuestas codo 9),
 *   la profundidad de la carcasa (laterales, piso, techo) DEBE restar el espesor de la puerta/frente (t),
 *   para que la profundidad total terminada del mueble (carcasa + puerta) sea EXACTAMENTE igual
 *   a la profundidad nominal configurada (m.profundidad).
 * - Cuando las puertas o tapas son INTERIORES (embutidas), la carcasa conserva la profundidad completa,
 *   y las puertas/tapas se instalan dentro del vano útil interior.
 * @param {Object} m - Objeto del módulo.
 * @param {number} [t] - Espesor de la melamina (18 o 15 mm).
 * @returns {Object} Desglose con profMod, descuentaFrente, descFrenteMm, profCarcasa, yCarcasaStart y motivoDescuento.
 */
function calcularDimensionesCarcasa(m, t) {
  t = t || AppState.espesorMelamina || 18;
  const profMod = m.profundidad;

  // Determinar si hay puertas exteriores o cajones exteriores
  const tienePuerta = !!(m.tiene_puertas || m.tipo_interior === 'puertas');
  const posPuerta = m.puertas_posicion_bisagra || m.puertas_apertura || 'derecha';
  const esCorrediza = tienePuerta && (posPuerta === 'corrediza');
  const montajePuerta = m.puertas_montaje || 'exterior';
  const tienePuertaExt = !esCorrediza && tienePuerta && (montajePuerta === 'exterior' || montajePuerta === 'medio');

  const tieneCajonera = (m.tipo_interior === 'cajonera');
  const montajeCajon = m.cajones_montaje || 'exterior';
  const tieneCajonExt = !esCorrediza && !tienePuerta && tieneCajonera && (montajeCajon === 'exterior');

  const descuentaFrente = tienePuertaExt || tieneCajonExt;
  const descFrenteMm = descuentaFrente ? t : 0;
  const profCarcasa = Math.max(100, profMod - descFrenteMm);
  const yCarcasaStart = descFrenteMm;

  let motivoDescuento = esCorrediza
    ? 'Puertas corredizas embutidas en riel doble: la carcasa conserva la profundidad exterior y el riel ocupa el frontal'
    : 'Sin descuento frontal (carcasa a profundidad nominal completa)';
  if (tienePuertaExt) {
    motivoDescuento = `Descontado ${t}mm de carcasa por puerta ${montajePuerta === 'medio' ? 'semi-sobrepuesta (codo 9)' : 'exterior sobrepuesta'}`;
  } else if (tieneCajonExt) {
    motivoDescuento = `Descontado ${t}mm de carcasa por tapa de cajón exterior sobrepuesta`;
  }

  return {
    profMod,
    descuentaFrente,
    descFrenteMm,
    profCarcasa,
    yCarcasaStart,
    motivoDescuento
  };
}
if (typeof window !== 'undefined') {
  window.calcularDimensionesCarcasa = calcularDimensionesCarcasa;
}

/**
 * Calcula la especificación técnica de bisagras y perforaciones estándar de cazoleta de 35mm
 * conforme a estándares internacionales (DIN 68857 / Blum / DTC / Hettich).
 * @param {Object} m - Objeto del módulo.
 * @param {number} altoP - Altura neta de la puerta en mm.
 * @param {number} anchoP - Ancho neto de la puerta en mm.
 * @returns {Object} Especificación completa de bisagras y perforaciones de cazoleta.
 */
function calcularBisagrasPuerta(m, altoP, anchoP) {
  const montaje = m.puertas_montaje || 'exterior';
  const posicion = m.puertas_posicion_bisagra || m.puertas_apertura || ((m.ancho > 600) ? 'doble' : 'derecha');
  
  let tipoBisagra = 'Bisagra Recta 0mm (Sobrepuesta)';
  if (montaje === 'interior') {
    tipoBisagra = 'Bisagra Codo 18 (Curva Alta / Embutida)';
  } else if (montaje === 'medio') {
    tipoBisagra = 'Bisagra Codo 9 (Semi-curva / Semi-sobrepuesta)';
  }

  // Cantidad de bisagras por hoja
  let cantBis = 2;
  const cfgCant = m.puertas_cant_bisagras || 'auto';
  if (cfgCant !== 'auto' && parseInt(cfgCant) > 0) {
    cantBis = parseInt(cfgCant);
  } else {
    if (posicion === 'superior' || posicion === 'inferior') {
      cantBis = (anchoP > 900) ? 3 : 2;
    } else {
      if (altoP <= 900) cantBis = 2;
      else if (altoP <= 1600) cantBis = 3;
      else if (altoP <= 2000) cantBis = 4;
      else cantBis = 5;
    }
  }

  // Parámetros de perforación estándar de cazoleta
  const diametroCazoleta = 35.0; // mm
  const profPerforacion = 11.5;  // mm
  const margenK = 4.5;           // mm al borde del tablero
  const distCentroBorde = 22.0;  // mm (17.5 radio + 4.5 margen K)
  const distExtremos = 100.0;    // mm desde esquinas al centro de cazoleta

  // Generador de coordenadas relativas de perforación sobre el tablero de la puerta
  function calcularPerforacionesHoja(bordeHinges) {
    const perfs = [];
    if (bordeHinges === 'superior') {
      const yHole = altoP - distCentroBorde;
      if (cantBis === 2) {
        perfs.push({ x: distExtremos, y: yHole, diam: diametroCazoleta, prof: profPerforacion, margenK, borde: 'superior' });
        perfs.push({ x: anchoP - distExtremos, y: yHole, diam: diametroCazoleta, prof: profPerforacion, margenK, borde: 'superior' });
      } else {
        const step = (anchoP - (2 * distExtremos)) / Math.max(1, cantBis - 1);
        for (let i = 0; i < cantBis; i++) {
          perfs.push({ x: distExtremos + (i * step), y: yHole, diam: diametroCazoleta, prof: profPerforacion, margenK, borde: 'superior' });
        }
      }
    } else if (bordeHinges === 'inferior') {
      const yHole = distCentroBorde;
      if (cantBis === 2) {
        perfs.push({ x: distExtremos, y: yHole, diam: diametroCazoleta, prof: profPerforacion, margenK, borde: 'inferior' });
        perfs.push({ x: anchoP - distExtremos, y: yHole, diam: diametroCazoleta, prof: profPerforacion, margenK, borde: 'inferior' });
      } else {
        const step = (anchoP - (2 * distExtremos)) / Math.max(1, cantBis - 1);
        for (let i = 0; i < cantBis; i++) {
          perfs.push({ x: distExtremos + (i * step), y: yHole, diam: diametroCazoleta, prof: profPerforacion, margenK, borde: 'inferior' });
        }
      }
    } else if (bordeHinges === 'derecho') {
      const xHole = anchoP - distCentroBorde;
      if (cantBis === 2) {
        perfs.push({ x: xHole, y: distExtremos, diam: diametroCazoleta, prof: profPerforacion, margenK, borde: 'derecho' });
        perfs.push({ x: xHole, y: altoP - distExtremos, diam: diametroCazoleta, prof: profPerforacion, margenK, borde: 'derecho' });
      } else {
        const step = (altoP - (2 * distExtremos)) / Math.max(1, cantBis - 1);
        for (let i = 0; i < cantBis; i++) {
          perfs.push({ x: xHole, y: distExtremos + (i * step), diam: diametroCazoleta, prof: profPerforacion, margenK, borde: 'derecho' });
        }
      }
    } else {
      // Izquierdo (por defecto)
      const xHole = distCentroBorde;
      if (cantBis === 2) {
        perfs.push({ x: xHole, y: distExtremos, diam: diametroCazoleta, prof: profPerforacion, margenK, borde: 'izquierdo' });
        perfs.push({ x: xHole, y: altoP - distExtremos, diam: diametroCazoleta, prof: profPerforacion, margenK, borde: 'izquierdo' });
      } else {
        const step = (altoP - (2 * distExtremos)) / Math.max(1, cantBis - 1);
        for (let i = 0; i < cantBis; i++) {
          perfs.push({ x: xHole, y: distExtremos + (i * step), diam: diametroCazoleta, prof: profPerforacion, margenK, borde: 'izquierdo' });
        }
      }
    }
    return perfs;
  }

  return {
    montaje,
    posicion,
    tipoBisagra,
    cantBis,
    diametroCazoleta,
    profPerforacion,
    margenK,
    distCentroBorde,
    distExtremos,
    esPistonGas: (posicion === 'superior' || posicion === 'inferior'),
    calcularPerforacionesHoja
  };
}
if (typeof window !== 'undefined') {
  window.calcularBisagrasPuerta = calcularBisagrasPuerta;
}

/**
 * Calcula con precisión milimétrica la profundidad útil real interior del módulo.
 * Integra la deducción de puertas/cajones exteriores sobre la carcasa, los retranqueos frontales,
 * el espesor de fondos MDF (delante o detrás de listón) y fondos de melamina.
 * @param {Object} m - Datos del módulo activo.
 * @param {number} [t] - Espesor de la melamina (18 o 15 mm).
 * @returns {Object} Desglose detallado con profUtil, descuentoFrontal, descuentoPosterior, y texto explicativo.
 */
function calcularProfundidadUtilInterior(m, t) {
  t = t || AppState.espesorMelamina || 18;
  const dimCarcasa = calcularDimensionesCarcasa(m, t);
  const profBase = dimCarcasa.profCarcasa;

  const tienePuerta = !!(m.tiene_puertas || m.tipo_interior === 'puertas');
  const posPuerta = m.puertas_posicion_bisagra || m.puertas_apertura || 'derecha';
  const esCorrediza = tienePuerta && (posPuerta === 'corrediza');

  let descuentoFrontal = (m.descuento_frontal !== undefined && m.descuento_frontal !== '')
    ? Math.max(0, parseFloat(m.descuento_frontal))
    : (m.retrans_repisas !== undefined ? Math.max(0, parseFloat(m.retrans_repisas)) : (esCorrediza ? 80 : 20));

  if (esCorrediza) {
    // REGLA TÉCNICA: En sistemas corredizos se descuenta un mínimo de 80mm para el riel doble de aluminio
    descuentoFrontal = Math.max(80, descuentoFrontal);
  }

  // 1. Determinar tipo y presencia de fondo
  const tieneFondo = !!(m.tiene_fondo || m.tiene_fondo_mdf);
  const tipoFondo = tieneFondo ? (m.tipo_fondo || (m.tiene_fondo_mdf ? 'mdf' : 'mdf')) : 'ninguno';

  // 2. Verificar listones posteriores (REGLA: con fondo de melamina no hay listón posterior)
  let tieneListonPost = false;
  if (tipoFondo !== 'melamina') {
    tieneListonPost = !!(
      m.tiene_liston_posterior ||
      m.tiene_liston_post ||
      (m.tiene_liston_amarre && (m.posicion_liston_amarre === 'posterior' || m.posicion_liston_amarre === 'ambos'))
    );
  }

  let descuentoPosterior = 0;
  let detallesDescuento = [];

  if (dimCarcasa.descuentaFrente) {
    detallesDescuento.push(`-${dimCarcasa.descFrenteMm} mm (frente exterior resta fondo a carcasa)`);
  }
  if (esCorrediza) {
    detallesDescuento.push(`-${descuentoFrontal} mm (riel y puertas corredizas de 2 vías)`);
  } else {
    detallesDescuento.push(`-${descuentoFrontal} mm (retranqueo frontal)`);
  }

  if (tipoFondo === 'melamina') {
    // Fondo de melamina embutido entre laterales (sin listón posterior)
    const distFondoMel = (m.dist_fondo_melamina !== undefined) ? Math.max(0, parseFloat(m.dist_fondo_melamina)) : 0;
    descuentoPosterior = distFondoMel + t;
    if (distFondoMel > 0) {
      detallesDescuento.push(`-${distFondoMel} mm (retranqueo posterior melamina a pared)`);
    }
    detallesDescuento.push(`-${t} mm (fondo melamina)`);
  } else if (tipoFondo === 'mdf') {
    const posMdf = m.posicion_fondo_mdf || 'delante_liston';
    const grosorMdf = parseFloat(m.grosor_mdf) || 3;
    const distRanura = (m.dist_ranura_mdf !== undefined && parseFloat(m.dist_ranura_mdf) > 0)
      ? parseFloat(m.dist_ranura_mdf)
      : (posMdf === 'delante_liston' ? t : 0);
    if (posMdf === 'delante_liston') {
      descuentoPosterior = distRanura + grosorMdf;
      if (distRanura > 0) {
        detallesDescuento.push(`-${distRanura} mm (retranqueo listón posterior)`);
      }
      detallesDescuento.push(`-${grosorMdf} mm (fondo MDF enranurado)`);
    } else {
      if (tieneListonPost) {
        descuentoPosterior = t;
        detallesDescuento.push(`-${t} mm (listón posterior de amarre)`);
      }
    }
  } else {
    // Sin tablero de fondo
    if (tieneListonPost) {
      descuentoPosterior = t;
      detallesDescuento.push(`-${t} mm (listón posterior de amarre)`);
    }
  }

  const profUtil = Math.max(100, profBase - descuentoFrontal - descuentoPosterior);
  const yStart = dimCarcasa.yCarcasaStart + descuentoFrontal;
  const yEnd = yStart + profUtil;

  return {
    profMod: m.profundidad,
    profCarcasa: dimCarcasa.profCarcasa,
    descuentaFrente: dimCarcasa.descuentaFrente,
    descFrenteMm: dimCarcasa.descFrenteMm,
    descuentoFrontal,
    descuentoPosterior,
    descuentoTotal: dimCarcasa.descFrenteMm + descuentoFrontal + descuentoPosterior,
    profUtil,
    yStart,
    yEnd,
    tieneListonPost,
    tipoFondo,
    detallesTexto: detallesDescuento.join(' ')
  };
}
if (typeof window !== 'undefined') {
  window.calcularProfundidadUtilInterior = calcularProfundidadUtilInterior;
}

/**
 * Conmuta si el módulo activo lleva o no fondo (MDF o Melamina).
 * @param {boolean} tiene - Estado del switch de fondo.
 */
function onToggleFondo(tiene) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.tiene_fondo = tiene;
  m.tiene_fondo_mdf = tiene && (m.tipo_fondo !== 'melamina');

  if (tiene && (!m.tipo_fondo || m.tipo_fondo === 'ninguno')) {
    m.tipo_fondo = 'mdf';
    m.tiene_fondo_mdf = true;
  }

  if (tiene && m.tipo_fondo === 'melamina') {
    // Si el fondo es melamina el modulo ya no deberia tener liston posterior
    m.tiene_liston_post = false;
  }

  actualizarFormularioModuloActivo();
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Conmuta el tipo de fondo: 'mdf' o 'melamina'.
 * Si es melamina, desactiva automáticamente los listones posteriores.
 * @param {string} tipo - 'mdf' | 'melamina'
 */
function onCambiarTipoFondo(tipo) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.tipo_fondo = tipo;
  m.tiene_fondo = (tipo !== 'ninguno');
  m.tiene_fondo_mdf = (tipo === 'mdf');

  if (tipo === 'melamina') {
    // Regla mandatoria: Si el fondo es melamina el modulo ya no deberia tener liston posterior
    m.tiene_liston_post = false;
  }

  actualizarFormularioModuloActivo();
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Edita la altura del fondo de melamina dentro de lo técnicamente permitido.
 * Si la altura es menor a la total interior, el fondo se ajusta de arriba para abajo.
 * @param {number|string} alto - Altura en mm.
 */
function onEditarAltoFondoMelamina(alto) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const geo = calcularDivisionesYEspaciosModulo(m, AppState.espesorMelamina);
  const hVanoUtil = geo.hVanoUtil;
  const hNum = parseFloat(alto);

  if (isNaN(hNum)) {
    m.alto_fondo_melamina = null;
  } else {
    m.alto_fondo_melamina = Math.max(80, Math.min(hVanoUtil, Math.round(hNum)));
  }

  actualizarFormularioModuloActivo();
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Modifica la distancia de retranqueo / profundidad posterior del fondo de melamina.
 * Permite meter la melamina hacia adentro cierta cantidad de milímetros para que no choque con la pared.
 * @param {number|string} dist - Retranqueo en mm (>= 0).
 */
function onEditarDistFondoMelamina(dist) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.dist_fondo_melamina = Math.max(0, parseFloat(dist) || 0);
  actualizarFormularioModuloActivo();
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Restablece la altura del fondo de melamina a la altura interior total por default.
 */
function onRestablecerAltoFondoMelaminaMax() {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.alto_fondo_melamina = null;
  actualizarFormularioModuloActivo();
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Cambia la distancia de ranura / retranqueo posterior para el fondo MDF (por default 0 mm al borde posterior).
 * @param {number|string} dist - Retranqueo en mm.
 */
function onEditarDistRanuraMdf(dist) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.dist_ranura_mdf = Math.max(0, parseFloat(dist) || 0);
  actualizarFormularioModuloActivo();
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Conmuta si el módulo activo lleva o no fondo MDF (compatibilidad hacia atrás).
 */
function onToggleFondoMdf(tiene) {
  onToggleFondo(tiene);
}

/**
 * Cambia el grosor del fondo MDF (3mm, 4mm, 5.5mm).
 */
function onEditarGrosorMdf(grosor) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const g = parseFloat(grosor) || 3;
  m.grosor_mdf = g;
  // Sugerir ancho de ranura automáticamente = grosor + 1mm para holgura de carpintería
  m.ancho_ranura_mdf = g + 1;
  const inpAnchoRanura = document.getElementById('modAnchoRanuraMdf');
  if (inpAnchoRanura) inpAnchoRanura.value = m.ancho_ranura_mdf;

  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Cambia la posición del fondo MDF: 'delante_liston' (enranurado) o 'detras_liston' (sobrepuesto).
 * @param {string} pos - 'delante_liston' | 'detras_liston'
 */
function onCambiarPosicionFondoMdf(pos) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.posicion_fondo_mdf = pos;
  if (pos === 'delante_liston') {
    if (!m.dist_ranura_mdf || parseFloat(m.dist_ranura_mdf) <= 0) {
      m.dist_ranura_mdf = AppState.espesorMelamina || 18;
    }
    const inpDist = document.getElementById('modDistRanuraMdf');
    if (inpDist) inpDist.value = m.dist_ranura_mdf;
  }
  const grpRanura = document.getElementById('grpDetalleRanuraMdf');
  const grpSobre = document.getElementById('grpDetalleSobrepuestoMdf');

  if (grpRanura) grpRanura.style.display = (pos !== 'detras_liston') ? 'block' : 'none';
  if (grpSobre) grpSobre.style.display = (pos === 'detras_liston') ? 'block' : 'none';

  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Cambia el ancho de la ranura para fondo MDF.
 */
function onEditarAnchoRanuraMdf(ancho) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.ancho_ranura_mdf = Math.max(2, parseFloat(ancho) || 4);
  actualizarCanvas();
}

/**
 * Cambia la profundidad de la ranura para fondo MDF.
 */
function onEditarProfRanuraMdf(prof) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.prof_ranura_mdf = Math.max(2, parseFloat(prof) || 8);
  actualizarCanvas();
}

/**
 * Cambia la distancia al canto posterior para la ranura de fondo MDF.
 */
function onEditarDistRanuraMdf(dist) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const distNum = parseFloat(dist);
  m.dist_ranura_mdf = (!isNaN(distNum) && distNum >= 18) ? distNum : 18;
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Cambia la posición del fondo de melamina: 'embutido' o 'sobrepuesto'.
 * @param {string} pos - 'embutido' | 'sobrepuesto'
 */
function onCambiarPosicionFondoMelamina(pos) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.posicion_fondo_melamina = pos;
  actualizarFormularioModuloActivo();
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);

  const profInfo = calcularProfundidadUtilInterior(m, AppState.espesorMelamina);
  mostrarNotificacion(`Fondo melamina ${pos}: profundidad útil de repisas/parantes recalculada a ${profInfo.profUtil} mm.`, "info");
}

/**
 * Conmuta si el módulo lleva fondo posterior de MDF (compatibilidad hacia atrás).
 * @param {boolean} tieneFondo - Estado del switch
 */
function onToggleFondoMdf(tieneFondo) {
  onCambiarTipoFondo(tieneFondo ? 'mdf' : 'ninguno');
}

/**
 * Cambia el equipamiento interior del módulo (repisas, cajonera, puertas, carcasa).
 */
/**
 * Cambia el equipamiento interior del módulo (repisas, cajonera, puertas, carcasa).
 * @param {string} tipo - 'carcasa' | 'repisas' | 'cajonera' | 'puertas'
 */
function onCambiarTipoInterior(tipo) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.tipo_interior = tipo;

  if (tipo === 'repisas') {
    if (!m.parantes_tipo) m.parantes_tipo = 'ninguno';
    if (!Array.isArray(m.parantes)) m.parantes = [];
    if (!Array.isArray(m.espacios_repisas)) m.espacios_repisas = [];
    renderizarControlesParantesYEspacios(m);
  } else if (tipo === 'puertas') {
    m.tiene_puertas = true;
    const chkPuertas = document.getElementById('modTienePuertas');
    if (chkPuertas) chkPuertas.checked = true;
    const btnConfig = document.getElementById('btnConfigurarPuerta');
    if (btnConfig) btnConfig.style.display = 'inline-block';
    const grpPuertas = document.getElementById('grpDetallePuertas');
    if (grpPuertas) grpPuertas.style.display = 'block';
    abrirModalConfigPuerta();
  }

  const grpRepisas = document.getElementById('grpDetalleRepisas');
  const grpCajones = document.getElementById('grpDetalleCajonera');

  if (grpRepisas) grpRepisas.style.display = (tipo === 'repisas') ? 'block' : 'none';
  if (grpCajones) grpCajones.style.display = (tipo === 'cajonera') ? 'block' : 'none';

  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Calcula la geometría interna exacta, parantes y espacios con sus respectivas cotas y repisas.
 * Respeta todas las normas técnicas de carpintería y pandeo ("dentro de lo permitido"):
 * - Parante vertical: mínimo 150 mm por vano para atornillador.
 * - Parante horizontal: mínimo 120 mm por vano para herramientas.
 * - Repisas: mínimo 80 mm de espacio vertical libre para soporte de carga.
 * @param {Object} m - Objeto del módulo activo.
 * @param {number} [t] - Espesor de melamina (15 o 18 mm).
 * @returns {Object} Objeto con parantes calculados, espacios y cotas de repisas.
 */
function calcularDivisionesYEspaciosModulo(m, t) {
  t = t || AppState.espesorMelamina || 18;
  const wMod = m.ancho;
  const hMod = m.alto;
  const profMod = m.profundidad;
  const zH = (m.tiene_zocalo && m.alto_zocalo > 0) ? m.alto_zocalo : 0;
  const zSupH = (m.tiene_zocalo_sup && m.alto_zocalo_sup > 0) ? m.alto_zocalo_sup : 0;
  const tienePiso = (m.tiene_piso !== false && m.tiene_piso !== 'false');
  const tieneTecho = (m.tiene_techo !== false && m.tiene_techo !== 'false');
  const hTecho = (tieneTecho && m.techo_sobre_liston) ? ((m.techo_doble_melamina ? 2 : 1) * t) : 0;
  const hCarcasa = m.alto - zH - hTecho - zSupH;

  const tieneLaterales = (m.tiene_laterales !== false && m.tiene_laterales !== 'false');
  const anchoInt = tieneLaterales ? Math.max(0, wMod - (2 * t)) : wMod;
  const xOffsetInt = tieneLaterales ? t : 0;
  const hPiso = tienePiso ? t : 0;
  const hTechoEsp = tieneTecho ? t : 0;
  const hVanoUtil = Math.max(0, hCarcasa - hPiso - hTechoEsp);
  const zInteriorBase = zH + hPiso;

  // Cálculo exacto de profundidad útil descontando listones posteriores, fondo MDF o melamina
  const profInfo = calcularProfundidadUtilInterior(m, t);
  const profInt = profInfo.profUtil;

  const tipo = m.parantes_tipo || 'ninguno';
  const parantesRaw = Array.isArray(m.parantes) ? m.parantes : [];
  const espaciosCfg = Array.isArray(m.espacios_repisas) ? m.espacios_repisas : [];

  const limites = {
    tipo,
    minDist: (tipo === 'vertical') ? 150 : 120,
    maxParantesPermitidos: 0,
    puedeAgregar: false
  };

  if (tipo === 'vertical') {
    limites.maxParantesPermitidos = Math.max(0, Math.floor((anchoInt - 150) / (150 + t)));
  } else if (tipo === 'horizontal') {
    limites.maxParantesPermitidos = Math.max(0, Math.floor((hVanoUtil - 120) / (120 + t)));
  }
  limites.puedeAgregar = (tipo !== 'ninguno') && (parantesRaw.length < limites.maxParantesPermitidos);

  // 1. Resolver parantes respetando cotas fijas o proporcionales
  const parantesResueltos = [];
  const numParantes = (tipo === 'ninguno') ? 0 : Math.min(parantesRaw.length, limites.maxParantesPermitidos);

  if (tipo === 'vertical' && numParantes > 0) {
    const pasoEqui = (anchoInt - (numParantes * t)) / (numParantes + 1);

    for (let i = 0; i < numParantes; i++) {
      const raw = parantesRaw[i] || { modo: 'proporcional' };
      const posProp = Math.round(((i + 1) * pasoEqui) + (i * t));

      // Límite mínimo: 150mm a la izquierda de este parante
      const minX = (i === 0) ? 150 : (parantesResueltos[i - 1].posicion + t + 150);
      // Límite máximo: dejar 150mm para cada parante restante a la derecha
      const cantRestantes = numParantes - 1 - i;
      const maxX = Math.max(minX, anchoInt - t - 150 - (cantRestantes * (150 + t)));

      let posFinal = posProp;
      if (raw.modo === 'fija' && raw.posicion_mm !== undefined && raw.posicion_mm > 0) {
        posFinal = Math.max(minX, Math.min(maxX, Math.round(raw.posicion_mm)));
      }

      parantesResueltos.push({
        index: i,
        id: raw.id || (i + 1),
        modo: raw.modo || 'proporcional',
        posicion: posFinal,
        posicion_prop: posProp,
        min: minX,
        max: maxX,
        dx: t,
        dy: profInt,
        dz: hVanoUtil
      });
    }
  } else if (tipo === 'horizontal' && numParantes > 0) {
    const pasoEqui = (hVanoUtil - (numParantes * t)) / (numParantes + 1);

    for (let j = 0; j < numParantes; j++) {
      const raw = parantesRaw[j] || { modo: 'proporcional' };
      const posProp = Math.round(((j + 1) * pasoEqui) + (j * t));

      const minZ = (j === 0) ? 120 : (parantesResueltos[j - 1].posicion + t + 120);
      const cantRestantes = numParantes - 1 - j;
      const maxZ = Math.max(minZ, hVanoUtil - t - 120 - (cantRestantes * (120 + t)));

      let posFinal = posProp;
      if (raw.modo === 'fija' && raw.posicion_mm !== undefined && raw.posicion_mm > 0) {
        posFinal = Math.max(minZ, Math.min(maxZ, Math.round(raw.posicion_mm)));
      }

      parantesResueltos.push({
        index: j,
        id: raw.id || (j + 1),
        modo: raw.modo || 'proporcional',
        posicion: posFinal,
        posicion_prop: posProp,
        min: minZ,
        max: maxZ,
        dx: anchoInt,
        dy: profInt,
        dz: t
      });
    }
  }

  // 2. Determinar espacios generados por los parantes
  const numEspacios = (tipo === 'ninguno' || numParantes === 0) ? 1 : (numParantes + 1);
  const espacios = [];

  for (let s = 0; s < numEspacios; s++) {
    let xStart = 0, xEnd = anchoInt;
    let zStart = 0, zEnd = hVanoUtil;
    let nombreEspacio = `Espacio ${s + 1}`;

    if (tipo === 'vertical' && numParantes > 0) {
      xStart = (s === 0) ? 0 : (parantesResueltos[s - 1].posicion + t);
      xEnd = (s === numParantes) ? anchoInt : parantesResueltos[s].posicion;
      if (numEspacios === 2) {
        nombreEspacio = (s === 0) ? "Espacio 1 (Izquierdo)" : "Espacio 2 (Derecho)";
      } else {
        nombreEspacio = `Espacio ${s + 1} (${s === 0 ? 'Izquierdo' : (s === numEspacios - 1 ? 'Derecho' : 'Central')})`;
      }
    } else if (tipo === 'horizontal' && numParantes > 0) {
      zStart = (s === 0) ? 0 : (parantesResueltos[s - 1].posicion + t);
      zEnd = (s === numParantes) ? hVanoUtil : parantesResueltos[s].posicion;
      if (numEspacios === 2) {
        nombreEspacio = (s === 0) ? "Espacio 1 (Inferior)" : "Espacio 2 (Superior)";
      } else {
        nombreEspacio = `Espacio ${s + 1} (${s === 0 ? 'Inferior' : (s === numEspacios - 1 ? 'Superior' : 'Intermedio')})`;
      }
    } else {
      nombreEspacio = "Espacio Único (Interior Completo)";
    }

    const anchoEspacio = Math.max(0, xEnd - xStart);
    const altoEspacio = Math.max(0, zEnd - zStart);

    // Configuración de este espacio
    let eCfg = espaciosCfg[s];
    if (!eCfg) {
      if (s === 0 && m.cant_repisas > 0 && espaciosCfg.length === 0) {
        eCfg = { cantidad: m.cant_repisas, modo: 'proporcional', posiciones_fijas: [], sub_parantes: [] };
      } else {
        eCfg = { cantidad: 0, modo: 'proporcional', posiciones_fijas: [], sub_parantes: [] };
      }
    }

    // 2.1 Sub-parantes (subdivisiones secundarias en este espacio)
    // Permite en módulos con parantes horizontales agregar parante(s) vertical(es) en el espacio inferior (o cualquier espacio)
    // y viceversa en módulos verticales agregar parante(s) horizontal(es).
    const esTipoH = (tipo === 'horizontal');
    const esTipoV = (tipo === 'vertical');
    const permiteSubP = (esTipoH || esTipoV);
    const subParantesRaw = Array.isArray(eCfg.sub_parantes) ? eCfg.sub_parantes : [];

    const minDistSubP = esTipoH ? 150 : 120;
    const maxSubPPermitidos = esTipoH
      ? Math.max(0, Math.floor((anchoEspacio - 150) / (150 + t)))
      : (esTipoV ? Math.max(0, Math.floor((altoEspacio - 120) / (120 + t))) : 0);

    const cantSubP = permiteSubP ? Math.min(subParantesRaw.length, maxSubPPermitidos) : 0;
    const subParantesResueltos = [];

    if (permiteSubP && cantSubP > 0) {
      if (esTipoH) {
        // Sub-parantes verticales dentro de un espacio horizontal
        const pasoSub = (anchoEspacio - (cantSubP * t)) / (cantSubP + 1);
        for (let sp = 0; sp < cantSubP; sp++) {
          const rawSp = subParantesRaw[sp] || { modo: 'proporcional' };
          const posProp = Math.round(((sp + 1) * pasoSub) + (sp * t));
          const minXRel = (sp === 0) ? 150 : (subParantesResueltos[sp - 1].posicionRel + t + 150);
          const cantRest = cantSubP - 1 - sp;
          const maxXRel = Math.max(minXRel, anchoEspacio - t - 150 - (cantRest * (150 + t)));

          let posFinal = posProp;
          if (rawSp.modo === 'fija' && rawSp.posicion_mm !== undefined && rawSp.posicion_mm > 0) {
            posFinal = Math.max(minXRel, Math.min(maxXRel, Math.round(rawSp.posicion_mm)));
          }

          subParantesResueltos.push({
            index: sp,
            tipo: 'vertical',
            nombre: `Sub-parante Vertical ${sp + 1}`,
            modo: rawSp.modo || 'proporcional',
            posicionRel: posFinal,
            min: minXRel,
            max: maxXRel,
            x: xStart + posFinal,
            y: 0,
            z: zStart,
            dx: t,
            dy: profInt,
            dz: altoEspacio
          });
        }
      } else if (esTipoV) {
        // Sub-parantes horizontales dentro de un espacio vertical
        const pasoSub = (altoEspacio - (cantSubP * t)) / (cantSubP + 1);
        for (let sp = 0; sp < cantSubP; sp++) {
          const rawSp = subParantesRaw[sp] || { modo: 'proporcional' };
          const posProp = Math.round(((sp + 1) * pasoSub) + (sp * t));
          const minZRel = (sp === 0) ? 120 : (subParantesResueltos[sp - 1].posicionRel + t + 120);
          const cantRest = cantSubP - 1 - sp;
          const maxZRel = Math.max(minZRel, altoEspacio - t - 120 - (cantRest * (120 + t)));

          let posFinal = posProp;
          if (rawSp.modo === 'fija' && rawSp.posicion_mm !== undefined && rawSp.posicion_mm > 0) {
            posFinal = Math.max(minZRel, Math.min(maxZRel, Math.round(rawSp.posicion_mm)));
          }

          subParantesResueltos.push({
            index: sp,
            tipo: 'horizontal',
            nombre: `Sub-parante Horizontal ${sp + 1}`,
            modo: rawSp.modo || 'proporcional',
            posicionRel: posFinal,
            min: minZRel,
            max: maxZRel,
            x: xStart,
            y: 0,
            z: zStart + posFinal,
            dx: anchoEspacio,
            dy: profInt,
            dz: t
          });
        }
      }
    }

    // 2.2 Repisas configuradas para este espacio
    const cantMaxRepisas = Math.max(0, Math.floor((altoEspacio - 80) / (80 + t)));
    const cantRepisas = Math.max(0, Math.min(cantMaxRepisas, parseInt(eCfg.cantidad) || 0));
    const modoRepisas = eCfg.modo || 'proporcional';
    const repisas = [];

    if (cantRepisas > 0) {
      const pasoProp = (altoEspacio - (cantRepisas * t)) / (cantRepisas + 1);

      for (let r = 0; r < cantRepisas; r++) {
        const cotaProp = Math.round(((r + 1) * pasoProp) + (r * t));

        const minZRel = (r === 0) ? 80 : (repisas.length > 0 ? (repisas[repisas.length - 1].zRel + t + 80) : 80);
        const restantesR = cantRepisas - 1 - r;
        const maxZRel = Math.max(minZRel, altoEspacio - t - 80 - (restantesR * (80 + t)));

        let cotaFinal = cotaProp;
        if (modoRepisas === 'fija' && Array.isArray(eCfg.posiciones_fijas) && eCfg.posiciones_fijas[r] !== undefined && eCfg.posiciones_fijas[r] > 0) {
          cotaFinal = Math.max(minZRel, Math.min(maxZRel, Math.round(eCfg.posiciones_fijas[r])));
        }

        if (esTipoH && subParantesResueltos.length > 0) {
          // Subdividir la repisa horizontal en cada sub-vano para no atravesar el sub-parante vertical
          const numSubVanos = subParantesResueltos.length + 1;
          for (let sv = 0; sv < numSubVanos; sv++) {
            const subXStart = (sv === 0) ? xStart : (subParantesResueltos[sv - 1].x + t);
            const subXEnd = (sv === subParantesResueltos.length) ? xEnd : subParantesResueltos[sv].x;
            const subAncho = Math.max(0, subXEnd - subXStart);

            repisas.push({
              index: r,
              subVanoIndex: sv,
              zRel: cotaFinal,
              zProp: cotaProp,
              min: minZRel,
              max: maxZRel,
              xStart: subXStart,
              zStart,
              ancho: subAncho,
              prof: profInt,
              espesor: t
            });
          }
        } else {
          repisas.push({
            index: r,
            zRel: cotaFinal,
            zProp: cotaProp,
            min: minZRel,
            max: maxZRel,
            xStart,
            zStart,
            ancho: anchoEspacio,
            prof: profInt,
            espesor: t
          });
        }
      }
    }

    espacios.push({
      index: s,
      nombre: nombreEspacio,
      xStart,
      xEnd,
      zStart,
      zEnd,
      ancho: anchoEspacio,
      alto: altoEspacio,
      prof: profInt,
      cantMaxRepisas,
      permiteSubP,
      tipoSubP: esTipoH ? 'vertical' : 'horizontal',
      minDistSubP,
      maxSubPPermitidos,
      puedeAgregarSubP: permiteSubP && (subParantesResueltos.length < maxSubPPermitidos),
      subParantes: subParantesResueltos,
      config: {
        cantidad: cantRepisas,
        modo: modoRepisas,
        posiciones_fijas: repisas.filter(rep => rep.subVanoIndex === undefined || rep.subVanoIndex === 0).map(rep => rep.zRel),
        sub_parantes: subParantesResueltos.map(sp => ({
          index: sp.index,
          modo: sp.modo,
          posicion_mm: sp.posicionRel
        }))
      },
      repisas
    });
  }

  return {
    t,
    wMod,
    hMod,
    profMod,
    anchoInt,
    hVanoUtil,
    zInteriorBase,
    tienePiso,
    tieneTecho,
    profInt,
    profInfo,
    limites,
    parantes: parantesResueltos,
    espacios
  };
}
if (typeof window !== 'undefined') {
  window.calcularDivisionesYEspaciosModulo = calcularDivisionesYEspaciosModulo;
}

/**
 * Renderiza dinámicamente los controles de parantes y las repisas configurables por cada espacio.
 * Genera interfaces interactivas para cotas proporcionales y fijas milimétricas con validación visual.
 * @param {Object} m - Datos del módulo activo.
 */
function renderizarControlesParantesYEspacios(m) {
  const t = AppState.espesorMelamina || 18;
  const geo = calcularDivisionesYEspaciosModulo(m, t);

  // Selector de orientación
  const selTipo = document.getElementById('modParantesTipo');
  if (selTipo) selTipo.value = geo.limites.tipo;

  const contParantes = document.getElementById('contenedorConfigParantes');
  if (contParantes) contParantes.style.display = (geo.limites.tipo !== 'ninguno') ? 'block' : 'none';

  // Badges y botones de parantes
  const badgeInfo = document.getElementById('badgeInfoParantesPermitidos');
  if (badgeInfo) {
    if (geo.limites.tipo === 'ninguno') {
      badgeInfo.textContent = '0 Parantes (Vano Libre)';
      badgeInfo.className = 'cota-badge cota-badge-muted';
    } else {
      badgeInfo.textContent = `${geo.parantes.length} / ${geo.limites.maxParantesPermitidos} Máx.`;
      badgeInfo.className = geo.limites.puedeAgregar ? 'cota-badge' : 'cota-badge cota-badge-muted';
    }
  }

  const badgeProf = document.getElementById('badgeProfundidadRepisas');
  if (badgeProf && geo.profInfo) {
    badgeProf.textContent = `Prof. útil: ${geo.profInfo.profUtil} mm`;
    badgeProf.title = `Profundidad nominal ${geo.profInfo.profMod}mm con ${geo.profInfo.descuentoTotal}mm de descuento (${geo.profInfo.detallesTexto})`;
  }

  const btnAgregar = document.getElementById('btnAgregarParante');
  if (btnAgregar) {
    btnAgregar.disabled = !geo.limites.puedeAgregar;
    btnAgregar.title = geo.limites.puedeAgregar
      ? "Agregar una división interior dentro de las cotas permitidas"
      : `Límite alcanzado: Mínimo ${geo.limites.minDist}mm por vano para atornillador`;
  }

  // Lista de parantes
  const listaParantes = document.getElementById('listaParantesModulo');
  if (listaParantes) {
    if (geo.parantes.length === 0) {
      listaParantes.innerHTML = `
        <div style="font-size: 10px; color: var(--text-muted); font-style: italic; padding: 4px 0;">
          No hay divisiones agregadas. Haga clic en "+ Agregar Parante" para dividir el módulo.
        </div>
      `;
    } else {
      let htmlP = '';
      const esV = (geo.limites.tipo === 'vertical');
      geo.parantes.forEach((p, idx) => {
        htmlP += `
          <div class="item-parante-card">
            <div class="item-parante-header">
              <span class="item-parante-title">
                <svg class="svg-icon" style="width: 12px; height: 12px;"><use href="#icon-cubo"></use></svg>
                Parante ${idx + 1} (${esV ? 'Vertical' : 'Horizontal'})
              </span>
              <button type="button" class="btn btn-secondary" onclick="onEliminarParante(${idx})" title="Eliminar este parante" style="padding: 1px 6px; font-size: 10px; height: 20px; color: var(--danger); border-color: var(--danger);">
                ✕
              </button>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; margin-top: 2px;">
              <select onchange="onCambiarModoParante(${idx}, this.value)" style="font-size: 10.5px; padding: 2px 4px; height: 24px; flex: 1;">
                <option value="proporcional" ${p.modo === 'proporcional' ? 'selected' : ''}>Proporcional (Equidistante)</option>
                <option value="fija" ${p.modo === 'fija' ? 'selected' : ''}>Ubicación Fija (mm)</option>
              </select>
              ${p.modo === 'fija' ? `
                <div style="display: flex; align-items: center; gap: 4px;">
                  <input type="number" value="${p.posicion}" min="${p.min}" max="${p.max}" step="1"
                    onchange="onEditarPosicionParante(${idx}, this.value)"
                    style="width: 70px; height: 24px; font-size: 10.5px; padding: 2px 4px; text-align: right;">
                  <span style="font-size: 10px; color: var(--text-muted);">mm</span>
                </div>
              ` : `
                <span class="cota-badge" style="font-size: 10px; white-space: nowrap;">Cota: ${p.posicion} mm</span>
              `}
            </div>
            ${p.modo === 'fija' ? `
              <div style="font-size: 9px; color: var(--text-muted); display: flex; justify-content: space-between;">
                <span>Permitido: ${p.min} mm a ${p.max} mm</span>
                <span>Ancho vano mín: ${geo.limites.minDist}mm</span>
              </div>
            ` : ''}
          </div>
        `;
      });
      listaParantes.innerHTML = htmlP;
    }
  }

  // Lista de espacios y sus repisas
  const listaEspacios = document.getElementById('listaEspaciosRepisasModulo');
  const badgeTotalRep = document.getElementById('badgeTotalRepisas');

  let totalRepisas = 0;
  if (listaEspacios) {
    let htmlE = '';
    geo.espacios.forEach((esp, sIdx) => {
      totalRepisas += esp.repisas.length;
      htmlE += `
        <div class="item-espacio-card">
          <div class="item-espacio-header">
            <span class="item-espacio-title">${esp.nombre}</span>
            <span class="item-espacio-dims">${esp.ancho} x ${esp.alto} mm</span>
          </div>

          <!-- Contador de repisas para este espacio -->
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 10.5px; color: var(--text-secondary);">Cantidad de Repisas:</span>
            <div class="stepper-counter">
              <button type="button" class="stepper-btn" onclick="onCambiarCantRepisasEspacio(${sIdx}, -1)" ${esp.config.cantidad <= 0 ? 'disabled' : ''}>-</button>
              <span class="stepper-value">${esp.config.cantidad}</span>
              <button type="button" class="stepper-btn" onclick="onCambiarCantRepisasEspacio(${sIdx}, 1)" ${esp.config.cantidad >= esp.cantMaxRepisas ? 'disabled' : ''}>+</button>
            </div>
          </div>

          ${esp.config.cantidad > 0 ? `
            <div style="display: flex; gap: 6px; align-items: center; margin-top: 2px;">
              <span style="font-size: 10px; color: var(--text-muted);">Distribución:</span>
              <select onchange="onCambiarModoRepisasEspacio(${sIdx}, this.value)" style="font-size: 10px; padding: 2px 4px; height: 22px; flex: 1;">
                <option value="proporcional" ${esp.config.modo === 'proporcional' ? 'selected' : ''}>Proporcional (Equidistante)</option>
                <option value="fija" ${esp.config.modo === 'fija' ? 'selected' : ''}>Ubicación Fija por Repisa (mm)</option>
              </select>
            </div>

            ${esp.config.modo === 'proporcional' ? `
              <div style="font-size: 9.5px; color: var(--text-muted); display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px;">
                <span>Cotas desde base:</span>
                ${esp.repisas.map(r => `<span class="cota-badge">R${r.index + 1}: ${r.zRel} mm</span>`).join('')}
              </div>
            ` : `
              <div class="cotas-grid">
                ${esp.repisas.map(r => `
                  <div class="cota-item">
                    <label>Repisa ${r.index + 1} (mm):</label>
                    <input type="number" value="${r.zRel}" min="${r.min}" max="${r.max}" step="1"
                      onchange="onEditarCotaRepisaEspacio(${sIdx}, ${r.index}, this.value)">
                    <span style="font-size: 8.5px; color: var(--text-muted);">[${r.min} - ${r.max}] mm</span>
                  </div>
                `).join('')}
              </div>
            `}
          ` : `
            <div style="font-size: 9.5px; color: var(--text-muted); font-style: italic;">
              Sin repisas en este compartimento. (Capacidad máx: ${esp.cantMaxRepisas} repisas con paso mín 80mm).
            </div>
          `}

          <!-- Sub-parantes / Subdivisiones secundarias en este espacio -->
          ${esp.permiteSubP ? `
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--border-color);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 10px; font-weight: 600; color: var(--text-primary);">
                  ${esp.tipoSubP === 'vertical' ? 'Parante Vertical en este espacio:' : 'Parante Horizontal en este espacio:'}
                </span>
                <button type="button" class="btn btn-secondary" style="font-size: 9.5px; padding: 2px 6px;"
                  onclick="onAgregarSubParanteEspacio(${sIdx})" ${esp.puedeAgregarSubP ? '' : 'disabled'}>
                  + Parante ${esp.tipoSubP === 'vertical' ? 'Vertical' : 'Horizontal'}
                </button>
              </div>

              ${esp.subParantes && esp.subParantes.length > 0 ? `
                <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                  ${esp.subParantes.map((sp, spIdx) => `
                    <div style="display: flex; gap: 4px; align-items: center; background: var(--bg-hover); padding: 4px; border-radius: 4px;">
                      <span style="font-size: 9.5px; font-weight: 600; min-width: 55px;">${sp.nombre}:</span>
                      <select onchange="onCambiarModoSubParanteEspacio(${sIdx}, ${spIdx}, this.value)" style="font-size: 9.5px; padding: 1px 3px; height: 22px; flex: 1;">
                        <option value="proporcional" ${sp.modo === 'proporcional' ? 'selected' : ''}>Proporcional</option>
                        <option value="fija" ${sp.modo === 'fija' ? 'selected' : ''}>Cota Fija (mm)</option>
                      </select>
                      ${sp.modo === 'fija' ? `
                        <input type="number" value="${sp.posicionRel}" min="${sp.min}" max="${sp.max}" step="1"
                          onchange="onEditarPosicionSubParanteEspacio(${sIdx}, ${spIdx}, this.value)"
                          style="width: 55px; height: 22px; font-size: 9.5px; padding: 1px 3px; text-align: right;">
                        <span style="font-size: 9px; color: var(--text-muted);">mm</span>
                      ` : `
                        <span class="cota-badge" style="font-size: 9px; padding: 1px 4px;">${sp.posicionRel} mm</span>
                      `}
                      <button type="button" class="btn btn-secondary" onclick="onEliminarSubParanteEspacio(${sIdx}, ${spIdx})"
                        title="Eliminar este sub-parante" style="padding: 0 4px; font-size: 9px; height: 20px; color: var(--danger); border-color: var(--danger);">✕</button>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div style="font-size: 9px; color: var(--text-muted); font-style: italic;">
                  Sin parantes secundarios en este espacio.
                </div>
              `}
            </div>
          ` : ''}
        </div>
      `;
    });
    listaEspacios.innerHTML = htmlE;
  }

  if (badgeTotalRep) {
    badgeTotalRep.textContent = `${totalRepisas} ${totalRepisas === 1 ? 'Repisa' : 'Repisas'}`;
  }

  // Guardar estado sincronizado en el módulo
  m.cant_repisas = totalRepisas;
}

/**
 * Agrega un sub-parante a un espacio específico (por ejemplo, parante vertical en espacio inferior).
 * @param {number} espIdx - Índice del espacio.
 */
function onAgregarSubParanteEspacio(espIdx) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const t = AppState.espesorMelamina || 18;
  const geo = calcularDivisionesYEspaciosModulo(m, t);
  const esp = geo.espacios[espIdx];
  if (!esp || !esp.puedeAgregarSubP) {
    mostrarNotificacion(`No se pueden agregar más parantes a este espacio (${esp ? (esp.tipoSubP === 'vertical' ? '150mm' : '120mm') : ''} mínimo por vano).`, "warning");
    return;
  }

  if (!Array.isArray(m.espacios_repisas)) m.espacios_repisas = [];
  while (m.espacios_repisas.length <= espIdx) {
    m.espacios_repisas.push({ cantidad: 0, modo: 'proporcional', posiciones_fijas: [], sub_parantes: [] });
  }
  if (!Array.isArray(m.espacios_repisas[espIdx].sub_parantes)) {
    m.espacios_repisas[espIdx].sub_parantes = [];
  }

  m.espacios_repisas[espIdx].sub_parantes.push({
    id: Date.now(),
    modo: 'proporcional',
    posicion_mm: 0
  });

  renderizarControlesParantesYEspacios(m);
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
  mostrarNotificacion(`Sub-parante ${esp.tipoSubP} agregado al ${esp.nombre}.`, "info");
}

/**
 * Elimina un sub-parante de un espacio específico.
 * @param {number} espIdx - Índice del espacio.
 * @param {number} spIdx - Índice del sub-parante.
 */
function onEliminarSubParanteEspacio(espIdx, spIdx) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m || !Array.isArray(m.espacios_repisas) || !m.espacios_repisas[espIdx]) return;

  const arr = m.espacios_repisas[espIdx].sub_parantes;
  if (Array.isArray(arr)) {
    arr.splice(spIdx, 1);
  }

  renderizarControlesParantesYEspacios(m);
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
  mostrarNotificacion("Sub-parante eliminado.", "info");
}

/**
 * Cambia el modo de distribución de un sub-parante ('proporcional' o 'fija').
 * @param {number} espIdx - Índice del espacio.
 * @param {number} spIdx - Índice del sub-parante.
 * @param {string} modo - 'proporcional' | 'fija'
 */
function onCambiarModoSubParanteEspacio(espIdx, spIdx, modo) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m || !Array.isArray(m.espacios_repisas) || !m.espacios_repisas[espIdx]) return;

  const arr = m.espacios_repisas[espIdx].sub_parantes;
  if (!Array.isArray(arr) || !arr[spIdx]) return;

  const t = AppState.espesorMelamina || 18;
  const geo = calcularDivisionesYEspaciosModulo(m, t);
  const esp = geo.espacios[espIdx];
  const spCalc = esp && esp.subParantes ? esp.subParantes[spIdx] : null;

  arr[spIdx].modo = modo;
  if (modo === 'fija' && spCalc) {
    arr[spIdx].posicion_mm = spCalc.posicionRel;
  }

  renderizarControlesParantesYEspacios(m);
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Modifica la posición fija de un sub-parante en mm ingresada por el usuario.
 * @param {number} espIdx - Índice del espacio.
 * @param {number} spIdx - Índice del sub-parante.
 * @param {number|string} valor - Cota en mm.
 */
function onEditarPosicionSubParanteEspacio(espIdx, spIdx, valor) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m || !Array.isArray(m.espacios_repisas) || !m.espacios_repisas[espIdx]) return;

  const arr = m.espacios_repisas[espIdx].sub_parantes;
  if (!Array.isArray(arr) || !arr[spIdx]) return;

  const t = AppState.espesorMelamina || 18;
  const geo = calcularDivisionesYEspaciosModulo(m, t);
  const esp = geo.espacios[espIdx];
  const spCalc = esp && esp.subParantes ? esp.subParantes[spIdx] : null;
  if (!spCalc) return;

  const numVal = parseFloat(valor) || 0;
  const cotaValida = Math.max(spCalc.min, Math.min(spCalc.max, Math.round(numVal)));
  arr[spIdx].posicion_mm = cotaValida;

  renderizarControlesParantesYEspacios(m);
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Cambia la orientación de los parantes en el módulo activo ('ninguno', 'vertical', 'horizontal').
 * @param {string} tipo - 'ninguno' | 'vertical' | 'horizontal'
 */
function onCambiarOrientacionParantes(tipo) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.parantes_tipo = tipo;
  if (tipo !== 'ninguno') {
    const t = AppState.espesorMelamina || 18;
    const geo = calcularDivisionesYEspaciosModulo(m, t);
    if (!Array.isArray(m.parantes) || m.parantes.length === 0) {
      if (geo.limites.maxParantesPermitidos >= 1) {
        m.parantes = [{ id: Date.now(), modo: 'proporcional', posicion_mm: 0 }];
      } else {
        m.parantes = [];
      }
    }
  } else {
    m.parantes = [];
  }

  renderizarControlesParantesYEspacios(m);
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Agrega un nuevo parante (vertical u horizontal) al módulo activo dentro del límite permitido.
 */
function onAgregarParante() {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const t = AppState.espesorMelamina || 18;
  const geo = calcularDivisionesYEspaciosModulo(m, t);
  if (!geo.limites.puedeAgregar) {
    mostrarNotificacion(`No se pueden agregar más parantes: no queda espacio suficiente (${geo.limites.minDist}mm mínimo por vano para atornillador).`, "warning");
    return;
  }

  if (!Array.isArray(m.parantes)) m.parantes = [];
  m.parantes.push({
    id: Date.now(),
    modo: 'proporcional',
    posicion_mm: 0
  });

  renderizarControlesParantesYEspacios(m);
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
  mostrarNotificacion("Parante agregado exitosamente.", "info");
}

/**
 * Elimina el parante en la posición indicada del módulo activo.
 * @param {number} pIdx - Índice del parante en el arreglo m.parantes.
 */
function onEliminarParante(pIdx) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m || !Array.isArray(m.parantes)) return;

  m.parantes.splice(pIdx, 1);
  if (Array.isArray(m.espacios_repisas) && m.espacios_repisas.length > m.parantes.length + 1) {
    m.espacios_repisas.splice(pIdx, 1);
  }

  renderizarControlesParantesYEspacios(m);
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
  mostrarNotificacion("Parante eliminado.", "info");
}

/**
 * Cambia el modo de posición de un parante ('proporcional' o 'fija').
 * @param {number} pIdx - Índice del parante.
 * @param {string} modo - 'proporcional' | 'fija'
 */
function onCambiarModoParante(pIdx, modo) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m || !Array.isArray(m.parantes) || !m.parantes[pIdx]) return;

  const t = AppState.espesorMelamina || 18;
  const geo = calcularDivisionesYEspaciosModulo(m, t);
  const pCalc = geo.parantes[pIdx];

  m.parantes[pIdx].modo = modo;
  if (modo === 'fija' && pCalc) {
    m.parantes[pIdx].posicion_mm = pCalc.posicion;
  }

  renderizarControlesParantesYEspacios(m);
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Modifica la cota milimétrica fija de un parante, validando los límites permitidos.
 * @param {number} pIdx - Índice del parante.
 * @param {number|string} valor - Cota en mm ingresada por el usuario.
 */
function onEditarPosicionParante(pIdx, valor) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m || !Array.isArray(m.parantes) || !m.parantes[pIdx]) return;

  const t = AppState.espesorMelamina || 18;
  const geo = calcularDivisionesYEspaciosModulo(m, t);
  const pCalc = geo.parantes[pIdx];
  if (!pCalc) return;

  const numVal = parseFloat(valor) || 0;
  const cotaValida = Math.max(pCalc.min, Math.min(pCalc.max, Math.round(numVal)));
  m.parantes[pIdx].posicion_mm = cotaValida;

  renderizarControlesParantesYEspacios(m);
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Modifica la cantidad de repisas para un espacio específico.
 * @param {number} espIdx - Índice del espacio.
 * @param {number} delta - Variación (+1 o -1).
 */
function onCambiarCantRepisasEspacio(espIdx, delta) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const t = AppState.espesorMelamina || 18;
  const geo = calcularDivisionesYEspaciosModulo(m, t);
  const esp = geo.espacios[espIdx];
  if (!esp) return;

  if (!Array.isArray(m.espacios_repisas)) m.espacios_repisas = [];
  while (m.espacios_repisas.length <= espIdx) {
    m.espacios_repisas.push({ cantidad: 0, modo: 'proporcional', posiciones_fijas: [] });
  }

  const actual = m.espacios_repisas[espIdx].cantidad || 0;
  const nueva = Math.max(0, Math.min(esp.cantMaxRepisas, actual + delta));
  m.espacios_repisas[espIdx].cantidad = nueva;

  renderizarControlesParantesYEspacios(m);
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Cambia el modo de distribución de repisas en un espacio ('proporcional' o 'fija').
 * @param {number} espIdx - Índice del espacio.
 * @param {string} modo - 'proporcional' | 'fija'
 */
function onCambiarModoRepisasEspacio(espIdx, modo) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  if (!Array.isArray(m.espacios_repisas)) m.espacios_repisas = [];
  while (m.espacios_repisas.length <= espIdx) {
    m.espacios_repisas.push({ cantidad: 0, modo: 'proporcional', posiciones_fijas: [] });
  }

  const t = AppState.espesorMelamina || 18;
  const geo = calcularDivisionesYEspaciosModulo(m, t);
  const esp = geo.espacios[espIdx];

  m.espacios_repisas[espIdx].modo = modo;
  if (modo === 'fija' && esp) {
    m.espacios_repisas[espIdx].posiciones_fijas = esp.repisas.map(r => r.zRel);
  }

  renderizarControlesParantesYEspacios(m);
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Modifica la cota milimétrica fija de una repisa en un espacio determinado.
 * @param {number} espIdx - Índice del espacio.
 * @param {number} repIdx - Índice de la repisa dentro del espacio.
 * @param {number|string} valor - Cota en mm ingresada por el usuario desde la base del espacio.
 */
function onEditarCotaRepisaEspacio(espIdx, repIdx, valor) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const t = AppState.espesorMelamina || 18;
  const geo = calcularDivisionesYEspaciosModulo(m, t);
  const esp = geo.espacios[espIdx];
  if (!esp || !esp.repisas[repIdx]) return;

  const rCalc = esp.repisas[repIdx];
  const numVal = parseFloat(valor) || 0;
  const cotaValida = Math.max(rCalc.min, Math.min(rCalc.max, Math.round(numVal)));

  if (!Array.isArray(m.espacios_repisas)) m.espacios_repisas = [];
  while (m.espacios_repisas.length <= espIdx) {
    m.espacios_repisas.push({ cantidad: 0, modo: 'proporcional', posiciones_fijas: [] });
  }
  if (!Array.isArray(m.espacios_repisas[espIdx].posiciones_fijas)) {
    m.espacios_repisas[espIdx].posiciones_fijas = [];
  }

  m.espacios_repisas[espIdx].posiciones_fijas[repIdx] = cotaValida;

  renderizarControlesParantesYEspacios(m);
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Modifica la cantidad de repisas del módulo activo (compatibilidad hacia atrás).
 * @param {number|string} cant - Cantidad de repisas.
 */
function onEditarCantRepisas(cant) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.cant_repisas = Math.max(0, Math.min(8, parseInt(cant) || 0));
  if (Array.isArray(m.espacios_repisas) && m.espacios_repisas.length > 0) {
    m.espacios_repisas[0].cantidad = m.cant_repisas;
  }
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

/**
 * Modifica la cantidad de cajones del módulo activo.
 * @param {number|string} cant - Cantidad de cajones.
 */
function onEditarCantCajones(cant) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.cant_cajones = Math.max(2, Math.min(6, parseInt(cant) || 3));
  const badgeCaj = document.getElementById('badgeInfoCajonera');
  if (badgeCaj) {
    const cTipo = m.cajones_tipo_corredera || 'telescopica';
    const cDesc = (cTipo === 'oculta') ? '21mm' : (cTipo === 'metalica' ? '37.5mm' : '26mm');
    badgeCaj.textContent = `${m.cant_cajones} Cajones (${cDesc})`;
  }
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}
window.onEditarCantCajones = onEditarCantCajones;

/**
 * Modifica el tipo de montaje de las tapas de cajón (exterior sobrepuesta o interior embutida).
 * Si es exterior, se descuenta el espesor de la carcasa.
 * @param {string} montaje - 'exterior' | 'interior'
 */
function onCambiarMontajeCajones(montaje) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.cajones_montaje = montaje;
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
  sincronizarFormularioModulo();
}
window.onCambiarMontajeCajones = onCambiarMontajeCajones;

/**
 * Cambia el tipo de corredera (telescopica 26mm, oculta 21mm, metalica 37.5mm).
 * @param {string} tipo - 'telescopica' | 'oculta' | 'metalica'
 */
function onCambiarTipoCorrederaCajones(tipo) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.cajones_tipo_corredera = tipo;
  const badgeCaj = document.getElementById('badgeInfoCajonera');
  if (badgeCaj) {
    const cDesc = (tipo === 'oculta') ? '21mm' : (tipo === 'metalica' ? '37.5mm' : '26mm');
    badgeCaj.textContent = `${m.cant_cajones || 3} Cajones (${cDesc})`;
  }
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}
window.onCambiarTipoCorrederaCajones = onCambiarTipoCorrederaCajones;

/**
 * Cambia la posición en altura de la corredera en el lateral del cajón (baja, central, al tercio).
 * @param {string} pos - 'baja' | 'central' | 'al_tercio'
 */
function onCambiarPosicionCorrederaCajones(pos) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.cajones_posicion_corredera = pos;
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}
window.onCambiarPosicionCorrederaCajones = onCambiarPosicionCorrederaCajones;

/**
 * Modifica el largo nominal de la corredera o modo automático.
 * @param {string} largo - 'auto' | '250' | '300' | ... | '600'
 */
function onCambiarLargoCorrederaCajones(largo) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.cajones_largo_corredera = largo;
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}
window.onCambiarLargoCorrederaCajones = onCambiarLargoCorrederaCajones;

/**
 * Conmuta la presencia de puertas frontales en el módulo activo.
 * @param {boolean} checked - True si lleva puertas.
 */
function onTogglePuertasModulo(checked) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.tiene_puertas = !!checked;

  const btnConfig = document.getElementById('btnConfigurarPuerta');
  if (btnConfig) btnConfig.style.display = m.tiene_puertas ? 'inline-block' : 'none';

  const grpPuertas = document.getElementById('grpDetallePuertas');
  if (grpPuertas) grpPuertas.style.display = m.tiene_puertas ? 'block' : 'none';

  if (m.tiene_puertas) {
    m.puertas_montaje = m.puertas_montaje || 'exterior';
    m.puertas_posicion_bisagra = m.puertas_posicion_bisagra || 'derecha';
    m.puertas_cant_bisagras = m.puertas_cant_bisagras || 'auto';
    m.puertas_luz = (m.puertas_luz !== undefined) ? m.puertas_luz : (AppState.luzFrentes || 3.0);
    abrirModalConfigPuerta();
  } else {
    actualizarCanvas();
    validarLimitesTecnicosModulo(m, idx);
    sincronizarFormularioModulo();
  }
}
window.onTogglePuertasModulo = onTogglePuertasModulo;

/**
 * Modifica el montaje de las puertas (exterior, medio, interior).
 * Si es exterior o medio, la carcasa descuenta el espesor de la puerta.
 * @param {string} montaje - 'exterior' | 'medio' | 'interior'
 */
function onCambiarMontajePuertas(montaje) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.puertas_montaje = montaje;
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
  sincronizarFormularioModulo();
}
window.onCambiarMontajePuertas = onCambiarMontajePuertas;

/**
 * Modifica la posición de las bisagras y tipo de apertura (doble, izquierda, derecha, superior para pistón gas, inferior, corrediza).
 * @param {string} pos - 'doble' | 'izquierda' | 'derecha' | 'superior' | 'inferior' | 'corrediza'
 */
function onCambiarPosicionBisagrasPuertas(pos) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.puertas_posicion_bisagra = pos;
  m.puertas_apertura = pos;
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
  sincronizarFormularioModulo();
}
window.onCambiarPosicionBisagrasPuertas = onCambiarPosicionBisagrasPuertas;

/**
 * Modifica la cantidad de bisagras por hoja ('auto' o cantidad numérica).
 * @param {string} cant - 'auto' | '2' | '3' | '4' | '5'
 */
function onCambiarCantBisagrasPuertas(cant) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.puertas_cant_bisagras = cant;
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
  sincronizarFormularioModulo();
}
window.onCambiarCantBisagrasPuertas = onCambiarCantBisagrasPuertas;

/**
 * Modifica el listón de tope interior para las puertas.
 * @param {string} tope - 'ninguno' | 'superior' | 'inferior' | 'ambos'
 */
function onCambiarListonTopePuertas(tope) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.puertas_liston_tope = tope;
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}
window.onCambiarListonTopePuertas = onCambiarListonTopePuertas;

/**
 * Modifica el nivel de apertura cinemática en el visor 3D para ver los cajones y puertas abiertos.
 * @param {number|string} val - Porcentaje de apertura (0 a 100).
 */
function onCambiarAperturaAnim(val) {
  const pct = Math.max(0, Math.min(100, parseFloat(val) || 0));
  const lbl = document.getElementById('lblAperturaAnim');
  if (lbl) lbl.textContent = `${Math.round(pct)}%`;

  if (window.Preview3D && typeof window.Preview3D.setAperturaAnim === 'function') {
    window.Preview3D.setAperturaAnim(pct / 100);
  }
}
window.onCambiarAperturaAnim = onCambiarAperturaAnim;

/**
 * Conmuta el Selector del Modo Simulación Cinemática.
 * Al estar activo, al hacer clic sobre una puerta o cajón cerrado lo abre, y si está abierto lo cierra.
 * @param {boolean} [forzar] - Estado forzado opcional.
 */
function toggleModoSimulacion(forzar) {
  AppState.modoSimulacion = (forzar !== undefined) ? !!forzar : !AppState.modoSimulacion;

  if (window.Preview3D && typeof window.Preview3D.setModoSimulacion === 'function') {
    window.Preview3D.setModoSimulacion(AppState.modoSimulacion);
  }

  // Actualizar estado de los botones del selector
  const btnCanvas = document.getElementById('btnModoSimulacion');
  const btnToolbar = document.getElementById('btnToggleSimulacionToolbar');

  if (btnCanvas) {
    if (AppState.modoSimulacion) {
      btnCanvas.classList.add('active');
      btnCanvas.style.background = '#059669';
      btnCanvas.style.borderColor = '#059669';
      btnCanvas.style.color = '#ffffff';
    } else {
      btnCanvas.classList.remove('active');
      btnCanvas.style.background = '';
      btnCanvas.style.borderColor = '';
      btnCanvas.style.color = '';
    }
  }

  if (btnToolbar) {
    if (AppState.modoSimulacion) {
      btnToolbar.classList.add('active');
      btnToolbar.style.background = '#059669';
      btnToolbar.style.borderColor = '#059669';
      btnToolbar.style.color = '#ffffff';
      btnToolbar.innerHTML = `<svg class="svg-icon" style="width: 12px; height: 12px;"><use href="#icon-refresh"></use></svg> <span>Simulación Activa (Clic para abrir/cerrar)</span>`;
    } else {
      btnToolbar.classList.remove('active');
      btnToolbar.style.background = '';
      btnToolbar.style.borderColor = '';
      btnToolbar.style.color = '';
      btnToolbar.innerHTML = `<svg class="svg-icon" style="width: 12px; height: 12px;"><use href="#icon-refresh"></use></svg> <span>Modo Simulación</span>`;
    }
  }

  actualizarBadgeEstado();

  if (AppState.modoSimulacion) {
    mostrarNotificacion("🎮 Modo Simulación Activo: Haz clic en cualquier puerta o cajón para abrirlo o cerrarlo.", "success");

    // Activar también la herramienta interactiva de SketchUp si estamos dentro de la ventana de SketchUp
    const suBridge = (typeof window !== 'undefined' && window.sketchup)
      ? window.sketchup
      : (typeof sketchup !== 'undefined' ? sketchup : null);
    if (suBridge && typeof suBridge.activarHerramientaSimulacion === 'function') {
      suBridge.activarHerramientaSimulacion('');
    }
  } else {
    mostrarNotificacion("Modo Simulación Desactivado: Haz clic en módulos para configurarlos.", "info");
  }
}
window.toggleModoSimulacion = toggleModoSimulacion;

/**
 * Conmuta el Selector del Modo Ocultar / Visualizar Pieza.
 * Al estar activo, las piezas sobre las que se hace clic se ocultan (mostrándose en vez de la pieza
 * líneas punteadas sobre todo el perímetro). Si se hace clic sobre la pieza oculta se vuelve a mostrar.
 * Si se desactiva el selector, todas las piezas que se encuentren ocultas se restablecerán inmediatamente.
 * @param {boolean} [forzar] - Estado forzado opcional.
 */
function toggleModoOcultarPiezas(forzar) {
  AppState.modoOcultarPiezas = (forzar !== undefined) ? !!forzar : !AppState.modoOcultarPiezas;

  // Si se activa modo ocultar, desactivamos modo simulación para no interferir en los clics
  if (AppState.modoOcultarPiezas && AppState.modoSimulacion) {
    toggleModoSimulacion(false);
  }

  if (window.Preview3D && typeof window.Preview3D.setModoOcultarPiezas === 'function') {
    window.Preview3D.setModoOcultarPiezas(AppState.modoOcultarPiezas);
  }

  // Actualizar estado visual de los botones del selector
  const btnCanvas = document.getElementById('btnModoOcultarPiezas');
  const btnToolbar = document.getElementById('btnToggleOcultarPiezaToolbar');

  const activo = AppState.modoOcultarPiezas;

  if (btnCanvas) {
    if (activo) {
      btnCanvas.classList.add('active');
      btnCanvas.style.background = '#0284c7';
      btnCanvas.style.borderColor = '#0284c7';
      btnCanvas.style.color = '#ffffff';
    } else {
      btnCanvas.classList.remove('active');
      btnCanvas.style.background = '';
      btnCanvas.style.borderColor = '';
      btnCanvas.style.color = '';
    }
  }

  if (btnToolbar) {
    if (activo) {
      btnToolbar.classList.add('active');
      btnToolbar.style.background = '#0284c7';
      btnToolbar.style.borderColor = '#0284c7';
      btnToolbar.style.color = '#ffffff';
      btnToolbar.innerHTML = `<svg class="svg-icon" style="width: 12px; height: 12px;"><use href="#icon-eye-off"></use></svg> <span>Ocultar Piezas Activo (Clic para ocultar/ver)</span>`;
    } else {
      btnToolbar.classList.remove('active');
      btnToolbar.style.background = '';
      btnToolbar.style.borderColor = '';
      btnToolbar.style.color = '';
      btnToolbar.innerHTML = `<svg class="svg-icon" style="width: 12px; height: 12px;"><use href="#icon-eye"></use></svg> <span>Ocultar/Ver Piezas</span>`;
    }
  }

  actualizarBadgeEstado();

  if (activo) {
    mostrarNotificacion("👁️ Modo Ocultar Piezas ACTIVO: Haz clic en cualquier pieza para ocultarla (líneas punteadas) o volver a mostrarla.", "info");

    const suBridge = (typeof window !== 'undefined' && window.sketchup)
      ? window.sketchup
      : (typeof sketchup !== 'undefined' ? sketchup : null);
    if (suBridge && typeof suBridge.activarHerramientaOcultarPiezas === 'function') {
      suBridge.activarHerramientaOcultarPiezas('activar');
    } else if (typeof window.callSketchup === 'function') {
      window.callSketchup('activarHerramientaOcultarPiezas', 'activar');
    }
  } else {
    mostrarNotificacion("✓ Modo Ocultar Piezas DESACTIVADO: Todas las piezas ocultas se muestran nuevamente.", "success");

    const suBridge = (typeof window !== 'undefined' && window.sketchup)
      ? window.sketchup
      : (typeof sketchup !== 'undefined' ? sketchup : null);
    if (suBridge && typeof suBridge.activarHerramientaOcultarPiezas === 'function') {
      suBridge.activarHerramientaOcultarPiezas('desactivar');
    } else if (typeof window.callSketchup === 'function') {
      window.callSketchup('activarHerramientaOcultarPiezas', 'desactivar');
    }
  }
}
window.toggleModoOcultarPiezas = toggleModoOcultarPiezas;

// ==============================================================================
// 7. MOTOR DE VALIDACIONES TÉCNICAS & REGLAS DE PANDEO INDUSTRIALES
// ==============================================================================

/**
 * Evalúa rigurosamente todas las piezas que componen el módulo para garantizar:
 * 1. Cumplimiento de estándares de dimensiones mínimas y máximas comerciales:
 *    - Dimensión mínima admisible (>= 50 mm para evitar accidentes en seccionadoras de disco/escuadradoras).
 *    - Dimensión máxima admisible (<= 2750 mm según el largo/ancho comercial de tableros melamínicos).
 * 2. Auditoría geométrica 3D de no colisión volumétrica (que ninguna pieza atraviese o penetre en otra).
 * @param {Object} m - Datos del módulo activo.
 * @param {number} idx - Índice del módulo.
 * @param {number} t - Espesor de melamina (15 o 18 mm).
 * @returns {Array<Object>} Lista de alertas técnicas { tipo: 'danger'|'warning'|'success'|'info', msg: string }.
 */
function evaluarEstandaresYSinColisiones(m, idx, t) {
  const alertas = [];
  const wMod = m.ancho;
  const hMod = m.alto;
  const profMod = m.profundidad;

  const zH = (m.tiene_zocalo && m.alto_zocalo > 0) ? m.alto_zocalo : 0;
  const zSupH = (m.tiene_zocalo_sup && m.alto_zocalo_sup > 0) ? m.alto_zocalo_sup : 0;
  const tienePiso = (m.tiene_piso !== false && m.tiene_piso !== 'false');
  const usaAmarresPiso = tienePiso && (m.tiene_liston_piso === true || m.tiene_liston_piso === 'true');
  const tieneTecho = (m.tiene_techo !== false && m.tiene_techo !== 'false');
  const usaAmarresTecho = tieneTecho && ((m.tiene_liston_techo === true || m.tiene_liston_techo === 'true') ||
    ((m.tiene_liston_amarre === true || m.tiene_liston_amarre === 'true') && (m.posicion_liston_amarre === 'techo' || m.posicion_liston_amarre === 'ambos')));
  const tieneTechoSobre = usaAmarresTecho && (m.techo_sobre_liston === true || m.techo_sobre_liston === 'true');
  const esDobleMelamina = m.techo_doble_melamina === true || m.techo_doble_melamina === 'true';
  const hTecho = tieneTechoSobre ? (esDobleMelamina ? (2 * t) : t) : 0;

  const tieneLaterales = (m.tiene_laterales !== false && m.tiene_laterales !== 'false');
  const hLateral = hMod - zH - hTecho;
  const hCarcasa = hMod - zH - hTecho - zSupH;
  const anchoInt = tieneLaterales ? Math.max(0, wMod - (2 * t)) : wMod;
  const xOffsetInt = tieneLaterales ? t : 0;
  const esModuloVacio = !tieneLaterales && !tieneTecho && !tienePiso;
  const hPisoEsp = tienePiso ? t : 0;
  const hTechoEsp = tieneTecho ? t : 0;
  const hVanoUtil = Math.max(0, hCarcasa - hPisoEsp - hTechoEsp);
  const zIntBase = zH + hPisoEsp;
  const zTop = zIntBase + hVanoUtil;

  // Fondo y profundidad útil
  const tieneFondo = !!(m.tiene_fondo || m.tiene_fondo_mdf);
  const tipoFondo = tieneFondo ? (m.tipo_fondo || (m.tiene_fondo_mdf ? 'mdf' : 'mdf')) : 'ninguno';
  const profInfo = calcularProfundidadUtilInterior(m, t);
  const profInt = profInfo.profUtil;
  const yStartInt = profInfo.yStart;

  const piezasSolidas = [];

  // Costados Izquierdo y Derecho (solo si tiene_laterales está activo)
  if (tieneLaterales) {
    piezasSolidas.push({
      nombre: "Costado Izquierdo",
      minX: 0, maxX: t,
      minY: 0, maxY: profMod,
      minZ: zH, maxZ: zH + hLateral
    });

    piezasSolidas.push({
      nombre: "Costado Derecho",
      minX: wMod - t, maxX: wMod,
      minY: 0, maxY: profMod,
      minZ: zH, maxZ: zH + hLateral
    });
  }

  // Piso
  if (tienePiso) {
    if (usaAmarresPiso) {
      const cantP = m.cant_listones_piso || 2;
      const wLP = parseFloat(m.ancho_liston_piso || m.medida_liston_piso || 80);
      piezasSolidas.push({
        nombre: "Amarre Piso Frontal",
        minX: t, maxX: wMod - t,
        minY: 0, maxY: wLP,
        minZ: zH, maxZ: zH + t
      });
      if (cantP >= 2) {
        piezasSolidas.push({
          nombre: "Amarre Piso Posterior",
          minX: t, maxX: wMod - t,
          minY: profMod - wLP, maxY: profMod,
          minZ: zH, maxZ: zH + t
        });
      }
    } else {
      piezasSolidas.push({
        nombre: "Piso Carcasa",
        minX: t, maxX: wMod - t,
        minY: 0, maxY: profMod,
        minZ: zH, maxZ: zH + t
      });
    }
  }

  // Techo
  if (tieneTecho) {
    if (usaAmarresTecho) {
      const cantT = m.cant_listones_techo || m.cant_listones_amarre || 2;
      const wLT = parseFloat(m.ancho_liston_techo || m.medida_liston_techo || m.alto_liston_amarre || 80);
      piezasSolidas.push({
        nombre: "Amarre Techo Frontal",
        minX: t, maxX: wMod - t,
        minY: 0, maxY: wLT,
        minZ: zH + hCarcasa - t, maxZ: zH + hCarcasa
      });
      if (cantT >= 2) {
        piezasSolidas.push({
          nombre: "Amarre Techo Posterior",
          minX: t, maxX: wMod - t,
          minY: profMod - wLT, maxY: profMod,
          minZ: zH + hCarcasa - t, maxZ: zH + hCarcasa
        });
      }
      if (tieneTechoSobre) {
        piezasSolidas.push({
          nombre: "Tapa Techo Sobrepuesta",
          minX: 0, maxX: wMod,
          minY: 0, maxY: profMod,
          minZ: zH + hCarcasa + zSupH, maxZ: zH + hCarcasa + zSupH + hTecho
        });
      }
    } else {
      piezasSolidas.push({
        nombre: "Techo Carcasa Sólido",
        minX: t, maxX: wMod - t,
        minY: 0, maxY: profMod,
        minZ: zH + hCarcasa - t, maxZ: zH + hCarcasa
      });
    }
  }

  // Zócalo Superior
  if (m.tiene_zocalo_sup && zSupH > 0) {
    piezasSolidas.push({
      nombre: "Frontal Zócalo Superior",
      minX: t, maxX: wMod - t,
      minY: 0, maxY: t,
      minZ: zH + hCarcasa, maxZ: zH + hCarcasa + zSupH
    });
  }

  // Zócalo Inferior
  if (m.tiene_zocalo && zH > 0) {
    const retransZ = (m.retrans_zocalo !== undefined && m.retrans_zocalo !== '') ? parseFloat(m.retrans_zocalo) : 35;
    const largoLatZ = Math.max(50, profMod - retransZ);
    piezasSolidas.push({
      nombre: "Zócalo Frontal",
      minX: t, maxX: wMod - t,
      minY: 0, maxY: t,
      minZ: 0, maxZ: zH
    });
    piezasSolidas.push({
      nombre: "Zócalo Posterior",
      minX: t, maxX: wMod - t,
      minY: profMod - t, maxY: profMod,
      minZ: 0, maxZ: zH
    });
    piezasSolidas.push({
      nombre: "Zócalo Lateral Izquierdo",
      minX: 0, maxX: t,
      minY: 0, maxY: largoLatZ,
      minZ: 0, maxZ: zH
    });
    piezasSolidas.push({
      nombre: "Zócalo Lateral Derecho",
      minX: wMod - t, maxX: wMod,
      minY: 0, maxY: largoLatZ,
      minZ: 0, maxZ: zH
    });

    // Listones transversales interiores de soporte del zócalo
    const cantInternosZocalo = resolverCantListonesInternosZocalo(m);
    if (cantInternosZocalo > 0) {
      for (let k = 1; k <= cantInternosZocalo; k++) {
        const frac = k / (cantInternosZocalo + 1);
        const xCenter = (wMod * frac) - (t / 2);
        piezasSolidas.push({
          nombre: `Zócalo Refuerzo Interior ${k}`,
          minX: xCenter, maxX: xCenter + t,
          minY: retransZ + t, maxY: profMod - t,
          minZ: 0, maxZ: zH
        });
      }
    }
  }

  // Listones Posteriores / Fondo (solo si NO es melamina)
  if (tipoFondo !== 'melamina') {
    const usaAmarresPost = (m.tiene_liston_post === true || m.tiene_liston_post === 'true') ||
      ((m.tiene_liston_amarre === true || m.tiene_liston_amarre === 'true') && (m.posicion_liston_amarre === 'posterior' || m.posicion_liston_amarre === 'ambos'));
    if (usaAmarresPost) {
      const cantPost = Math.max(1, parseInt(m.cant_listones_post || m.cant_listones_amarre || 2));
      const wListonPost = parseFloat(m.ancho_liston_post || m.medida_liston_post || m.alto_liston_amarre || 80);
      const orientacionPost = m.orientacion_liston_post || 'horizontal';
      const hVanoUtilPost = Math.max(50, hCarcasa - (m.tiene_piso !== false ? t : 0) - (m.tiene_techo !== false ? t : 0));
      const zStartPost = zH + (m.tiene_piso !== false ? t : 0);

      // Si el fondo es MDF enranurado (delante_liston), el listón se ubica DETRÁS del fondo
      // a distRanuraPost (18mm estándar) del borde posterior.
      const posMdfPost = m.posicion_fondo_mdf || 'delante_liston';
      const distRanuraPost = (m.dist_ranura_mdf !== undefined && parseFloat(m.dist_ranura_mdf) >= 18)
        ? parseFloat(m.dist_ranura_mdf)
        : 18;
      const grosorMdfPost = parseFloat(m.grosor_mdf) || 3;

      const yMinListon = (tipoFondo === 'mdf' && posMdfPost === 'delante_liston')
        ? (profMod - distRanuraPost)
        : (profMod - t);
      const yMaxListon = profMod;

      if (orientacionPost === 'vertical') {
        const anchoInt = wMod - (2 * t);
        if (cantPost === 1) {
          const xCenter = (wMod / 2) - (wListonPost / 2);
          piezasSolidas.push({
            nombre: "Listón Posterior Vertical Central",
            minX: xCenter, maxX: xCenter + wListonPost,
            minY: yMinListon, maxY: yMaxListon,
            minZ: zStartPost, maxZ: zStartPost + hVanoUtilPost
          });
        } else {
          const espacioGapsX = Math.max(0, anchoInt - (cantPost * wListonPost));
          const pasoGapX = (cantPost > 1) ? espacioGapsX / (cantPost - 1) : 0;
          for (let k = 0; k < cantPost; k++) {
            const xPos = t + Math.round(k * (wListonPost + pasoGapX));
            piezasSolidas.push({
              nombre: `Listón Posterior Vertical ${k === 0 ? 'Izquierdo' : (k === cantPost - 1 ? 'Derecho' : `Intermedio ${k}`)}`,
              minX: xPos, maxX: xPos + wListonPost,
              minY: yMinListon, maxY: yMaxListon,
              minZ: zStartPost, maxZ: zStartPost + hVanoUtilPost
            });
          }
        }
      } else {
        if (cantPost === 1) {
          const zPosSup = zH + hCarcasa - (m.tiene_techo !== false ? t : 0) - wListonPost;
          piezasSolidas.push({
            nombre: "Listón Posterior Superior",
            minX: t, maxX: wMod - t,
            minY: yMinListon, maxY: yMaxListon,
            minZ: zPosSup, maxZ: zPosSup + wListonPost
          });
        } else if (cantPost === 2) {
          const zPosSup = zH + hCarcasa - (m.tiene_techo !== false ? t : 0) - wListonPost;
          piezasSolidas.push({
            nombre: "Listón Posterior Superior",
            minX: t, maxX: wMod - t,
            minY: yMinListon, maxY: yMaxListon,
            minZ: zPosSup, maxZ: zPosSup + wListonPost
          });
          piezasSolidas.push({
            nombre: "Listón Posterior Inferior",
            minX: t, maxX: wMod - t,
            minY: yMinListon, maxY: yMaxListon,
            minZ: zStartPost, maxZ: zStartPost + wListonPost
          });
        } else {
          const espacioGaps = Math.max(0, hVanoUtilPost - (cantPost * wListonPost));
          const pasoGap = (cantPost > 1) ? (espacioGaps / (cantPost - 1)) : 0;
          for (let k = 0; k < cantPost; k++) {
            const zPos = zStartPost + Math.round(k * (wListonPost + pasoGap));
            piezasSolidas.push({
              nombre: `Listón Posterior ${k === 0 ? 'Inferior' : (k === cantPost - 1 ? 'Superior' : `Intermedio ${k}`)}`,
              minX: t, maxX: wMod - t,
              minY: yMinListon, maxY: yMaxListon,
              minZ: zPos, maxZ: zPos + wListonPost
            });
          }
        }
      }
    }
  }

  // Fondo de Melamina
  if (tipoFondo === 'melamina') {
    const altoFondoMel = (m.alto_fondo_melamina !== null && m.alto_fondo_melamina !== undefined && parseFloat(m.alto_fondo_melamina) < hVanoUtil)
      ? Math.max(80, Math.min(hVanoUtil, parseFloat(m.alto_fondo_melamina)))
      : hVanoUtil;
    const distFondoMel = (m.dist_fondo_melamina !== undefined) ? Math.max(0, parseFloat(m.dist_fondo_melamina)) : 0;
    // Se ajusta de arriba para abajo:
    const zFondoMin = zTop - altoFondoMel;
    const zFondoMax = zTop;
    const yFondoMin = profMod - distFondoMel - t;
    const yFondoMax = profMod - distFondoMel;
    piezasSolidas.push({
      nombre: "Fondo Posterior Melamina",
      minX: t, maxX: wMod - t,
      minY: yFondoMin, maxY: yFondoMax,
      minZ: zFondoMin, maxZ: zFondoMax
    });
  }

  // Fondo MDF
  if (tipoFondo === 'mdf') {
    const posMdf = m.posicion_fondo_mdf || 'delante_liston';
    const grosorMdf = parseFloat(m.grosor_mdf) || 3;
    const distRanura = (m.dist_ranura_mdf !== undefined && parseFloat(m.dist_ranura_mdf) >= 18)
      ? parseFloat(m.dist_ranura_mdf)
      : 18;
    if (posMdf === 'delante_liston') {
      // El fondo MDF enranurado se mete dentro de las ranuras de los laterales.
      // Fórmula oficial: Ancho Vano + (2 * profRanura) - 2mm de holgura total
      const profRanuraValid = (m.prof_ranura_mdf !== undefined) ? parseFloat(m.prof_ranura_mdf) : 8;
      const holguraValid = 1.0;
      const yFondoMdf = profMod - distRanura - grosorMdf;
      const xFondoMin = t - profRanuraValid + holguraValid;
      const xFondoMax = wMod - t + profRanuraValid - holguraValid;
      const zFondoMin = zIntBase - profRanuraValid + holguraValid;
      const zFondoMax = zTop + profRanuraValid - holguraValid;
      piezasSolidas.push({
        nombre: "Fondo MDF Ranurado",
        minX: xFondoMin, maxX: xFondoMax,
        minY: yFondoMdf, maxY: yFondoMdf + grosorMdf,
        minZ: zFondoMin, maxZ: zFondoMax,
        esMdfEnranurado: true
      });
    } else {
      piezasSolidas.push({
        nombre: "Fondo MDF Sobrepuesto",
        minX: 0, maxX: wMod,
        minY: profMod, maxY: profMod + grosorMdf,
        minZ: 0, maxZ: hMod
      });
    }
  }

  // Fondo Panel (Melamina continuo o completo si el módulo es vacío)
  if (tipoFondo === 'panel' || (esModuloVacio && tieneFondo)) {
    const tieneListonesPared = (m.panel_tiene_listones_pared !== false && m.panel_tiene_listones_pared !== 'false');
    const yListon = profMod - t;
    const yPanel = tieneListonesPared ? Math.max(0, profMod - (2 * t)) : (profMod - t);

    if (esModuloVacio) {
      piezasSolidas.push({
        nombre: "Fondo Panel Completo",
        minX: 0, maxX: wMod,
        minY: yPanel, maxY: yPanel + t,
        minZ: 0, maxZ: hMod
      });
    } else {
      piezasSolidas.push({
        nombre: "Fondo Panel Melamina",
        minX: xOffsetInt, maxX: xOffsetInt + anchoInt,
        minY: yPanel, maxY: yPanel + t,
        minZ: zIntBase, maxZ: zTop
      });
    }

    if (tieneListonesPared) {
      const cantPanelList = Math.max(1, Math.min(4, parseInt(m.cant_listones_panel) || 2));
      const hListonPanel = Math.max(20, parseFloat(m.medida_liston_panel) || 80);
      const largoListonPanel = esModuloVacio ? Math.max(50, wMod - 60) : anchoInt;
      const xListonMin = esModuloVacio ? 30 : xOffsetInt;

      for (let k = 0; k < cantPanelList; k++) {
        let zListon = esModuloVacio ? 50 : (zIntBase + 40);
        if (cantPanelList === 1) {
          zListon = esModuloVacio ? (hMod - hListonPanel - 50) : (zTop - hListonPanel - 40);
        } else if (cantPanelList === 2) {
          zListon = (k === 0) ? (esModuloVacio ? 50 : (zIntBase + 40)) : (esModuloVacio ? (hMod - hListonPanel - 50) : (zTop - hListonPanel - 40));
        } else {
          const zSpan = esModuloVacio ? (hMod - 100 - hListonPanel) : (hVanoUtil - 80 - hListonPanel);
          zListon = (esModuloVacio ? 50 : (zIntBase + 40)) + k * (zSpan / (cantPanelList - 1));
        }
        piezasSolidas.push({
          nombre: `Listón Anclaje Pared ${k + 1}`,
          minX: xListonMin, maxX: xListonMin + largoListonPanel,
          minY: yListon, maxY: yListon + t,
          minZ: zListon, maxZ: zListon + hListonPanel
        });
      }
    }
  }

  // Parantes y Repisas Interiores
  if (m.tipo_interior === 'repisas') {
    const geo = calcularDivisionesYEspaciosModulo(m, t);
    const esV = (geo.limites.tipo === 'vertical');

    geo.parantes.forEach((p, pIdx) => {
      if (esV) {
        piezasSolidas.push({
          nombre: `Parante Vertical ${pIdx + 1}`,
          minX: t + p.posicion, maxX: t + p.posicion + t,
          minY: yStartInt, maxY: yStartInt + profInt,
          minZ: zIntBase, maxZ: zIntBase + hVanoUtil
        });
      } else {
        piezasSolidas.push({
          nombre: `Parante Horizontal ${pIdx + 1}`,
          minX: t, maxX: wMod - t,
          minY: yStartInt, maxY: yStartInt + profInt,
          minZ: zIntBase + p.posicion, maxZ: zIntBase + p.posicion + t
        });
      }
    });

    geo.espacios.forEach((esp) => {
      if (Array.isArray(esp.subParantes)) {
        esp.subParantes.forEach((sp) => {
          if (sp.tipo === 'vertical') {
            piezasSolidas.push({
              nombre: `Sub-parante Vertical (${esp.nombre})`,
              minX: t + sp.x, maxX: t + sp.x + t,
              minY: yStartInt, maxY: yStartInt + profInt,
              minZ: zIntBase + sp.z, maxZ: zIntBase + sp.z + sp.dz
            });
          } else {
            piezasSolidas.push({
              nombre: `Sub-parante Horizontal (${esp.nombre})`,
              minX: t + sp.x, maxX: t + sp.x + sp.dx,
              minY: yStartInt, maxY: yStartInt + profInt,
              minZ: zIntBase + sp.z, maxZ: zIntBase + sp.z + t
            });
          }
        });
      }

      if (Array.isArray(esp.repisas)) {
        esp.repisas.forEach((rep, rIdx) => {
          piezasSolidas.push({
            nombre: `Repisa ${rIdx + 1} (${esp.nombre})`,
            minX: t + rep.xStart, maxX: t + rep.xStart + rep.ancho,
            minY: yStartInt, maxY: yStartInt + profInt,
            minZ: zIntBase + rep.zStart + rep.zRel, maxZ: zIntBase + rep.zStart + rep.zRel + t
          });
        });
      }
    });
  }

  // 1. EVALUAR ESTÁNDARES DIMENSIONALES COMERCIALES (MÍNIMOS Y MÁXIMOS)
  const piezasFueraEstandar = [];
  piezasSolidas.forEach(p => {
    const dx = Math.round(Math.abs(p.maxX - p.minX));
    const dy = Math.round(Math.abs(p.maxY - p.minY));
    const dz = Math.round(Math.abs(p.maxZ - p.minZ));
    const dims = [dx, dy, dz].sort((a, b) => b - a);
    const largo = dims[0];
    const ancho = dims[1];

    if (largo > 2750) {
      piezasFueraEstandar.push(`${p.nombre} (largo ${largo} mm supera el máx comercial 2750 mm)`);
    }
    if (ancho < 50) {
      piezasFueraEstandar.push(`${p.nombre} (ancho ${ancho} mm inferior al mín permitido 50 mm)`);
    }
  });

  if (piezasFueraEstandar.length > 0) {
    alertas.push({
      tipo: 'warning',
      msg: `⚠️ Medida fuera de estándar: ${piezasFueraEstandar.join('; ')}. Rango permitido: 50 a 2750 mm.`
    });
  }

  // 2. AUDITORÍA GEOMÉTRICA DE INTERSECCIÓN 3D (NINGUNA PIEZA ATRAVIESA OTRA)
  const colisiones = [];
  for (let i = 0; i < piezasSolidas.length; i++) {
    for (let j = i + 1; j < piezasSolidas.length; j++) {
      const p1 = piezasSolidas[i];
      const p2 = piezasSolidas[j];

      // Excepción válida: ranura de fondo MDF alojada dentro de los paneles envolventes o en contacto con listones posteriores
      if ((p1.esMdfEnranurado || p2.esMdfEnranurado) &&
          (p1.nombre.includes('Costado') || p2.nombre.includes('Costado') ||
           p1.nombre.includes('Piso') || p2.nombre.includes('Piso') ||
           p1.nombre.includes('Techo') || p2.nombre.includes('Techo') ||
           p1.nombre.includes('Listón') || p2.nombre.includes('Listón') ||
           p1.nombre.includes('Liston') || p2.nombre.includes('Liston') ||
           p1.nombre.includes('Amarre') || p2.nombre.includes('Amarre'))) {
        continue;
      }

      const overlapX = Math.min(p1.maxX, p2.maxX) - Math.max(p1.minX, p2.minX);
      const overlapY = Math.min(p1.maxY, p2.maxY) - Math.max(p1.minY, p2.minY);
      const overlapZ = Math.min(p1.maxZ, p2.maxZ) - Math.max(p1.minZ, p2.minZ);

      // Si existe penetración volumétrica mayor a 0.5 mm en los 3 ejes, hay colisión real
      if (overlapX > 0.5 && overlapY > 0.5 && overlapZ > 0.5) {
        colisiones.push(`'${p1.nombre}' atraviesa '${p2.nombre}' (${Math.round(overlapX)}x${Math.round(overlapY)}x${Math.round(overlapZ)} mm)`);
      }
    }
  }

  if (colisiones.length > 0) {
    alertas.push({
      tipo: 'danger',
      msg: `⛔ Colisión detectada: ${colisiones.join(', ')}. Ninguna pieza debe atravesar otra.`
    });
  }

  // 3. AUDITORÍA DE CONTENCIÓN DIMENSIONAL (NINGUNA PIEZA SOBREPASA EL MUEBLE INICIAL)
  const piezasDesbordadas = [];
  piezasSolidas.forEach(p => {
    // Si la pieza excede los límites exteriores del módulo por más de 0.5 mm (tolerancia gráfica)
    if (p.minX < -0.5 || p.maxX > wMod + 0.5) {
      piezasDesbordadas.push(`${p.nombre} desborda en ancho (X: ${Math.round(p.minX)} a ${Math.round(p.maxX)} mm, límite: ${wMod})`);
    }
    if (p.minY < -0.5 || p.maxY > profMod + 0.5) {
      piezasDesbordadas.push(`${p.nombre} desborda en profundidad (Y: ${Math.round(p.minY)} a ${Math.round(p.maxY)} mm, límite: ${profMod})`);
    }
    if (p.minZ < zH - 0.5 || p.maxZ > zH + hMod + 0.5) {
      piezasDesbordadas.push(`${p.nombre} desborda en altura (Z: ${Math.round(p.minZ)} a ${Math.round(p.maxZ)} mm, límite: ${zH + hMod})`);
    }
  });

  if (piezasDesbordadas.length > 0) {
    alertas.push({
      tipo: 'danger',
      msg: `⛔ Desbordamiento dimensional: ${piezasDesbordadas.join(', ')}. Las piezas no deben sobrepasar las cotas del mueble.`
    });
  }

  return alertas;
}

/**
 * Valida todas las normas técnicas de carpintería y pandeo para el módulo especificado
 * según la especificación exacta de fabricación en 15mm y 18mm:
 *   - Carcasa: 150mm a 1000mm ancho, 150mm a 2400mm alto, 150mm a 650mm prof.
 *   - Repisas: Pandeo máx 600-700mm en 15mm; máx 800mm en 18mm. Parante obligatorio si > 800mm.
 *   - Cajoneras: Mín 300-350mm, máx 900-1000mm. Refuerzo si > 700mm. Prof 250-550mm.
 *   - Puertas: Mín 250mm, máx 600mm bisagras cazoleta 35mm. Alto máx 2200mm.
 *   - Auditoría de piezas: verificación de medidas mín/máx comerciales y colisiones 3D volumétricas.
 * @param {Object} m - Datos del módulo
 * @param {number} idx - Índice del módulo
 */
function validarLimitesTecnicosModulo(m, idx) {
  const container = document.getElementById('alertasTecnicasModulo');
  if (!container) return;

  const t = AppState.espesorMelamina;
  const w = m.ancho;
  const h = m.alto;
  const p = m.profundidad;
  const vanoInterior = w - (2 * t);

  const alertas = [];

  // 1. CARCASA Y ESTRUCTURA GENERAL
  if (w < 150) {
    alertas.push({ tipo: 'danger', msg: `Ancho crítico (${w} mm): Menos de 150 mm no permite maniobrar un atornillador.` });
  } else if (w > 1000) {
    // Si el módulo es un vano técnico (escritorio para piernas, nicho de TV, puente para pantallas)
    // o cuenta con respaldo estructural rígido (fondo con listones o melamina), la carcasa no pandea.
    const esVanoTecnico = (m.tipo_interior === 'carcasa' || !m.tiene_piso);
    const tieneRefuerzoEstructural = (m.tiene_fondo && (m.tiene_liston_post || m.tipo_fondo === 'melamina'));
    const geo = (m.tipo_interior === 'repisas') ? calcularDivisionesYEspaciosModulo(m, t) : null;
    const tieneParantes = geo && geo.parantes && geo.parantes.length > 0;

    if (!tieneParantes && !esVanoTecnico && !tieneRefuerzoEstructural) {
      alertas.push({
        tipo: 'warning',
        msg: `Ancho amplio (${w} mm): Más de 1000 mm sin parante intermedio o soporte posterior ocasiona pandeo del techo y piso por gravedad y carga.`
      });
    }
  }

  if (h > 2400) {
    alertas.push({ tipo: 'warning', msg: `Altura límite excedida (${h} mm): La plancha comercial permite un largo útil máximo de 2400 mm para laterales continuos de una pieza.` });
  }

  const esTipologiaProfundaValida = (p <= 1200 && (
    (m.nombre && (
      m.nombre.toLowerCase().includes('cama') ||
      m.nombre.toLowerCase().includes('isla') ||
      m.nombre.toLowerCase().includes('mesa') ||
      m.nombre.toLowerCase().includes('escritorio') ||
      m.nombre.toLowerCase().includes('gamer') ||
      m.nombre.toLowerCase().includes('battlestation')
    )) ||
    (AppState.categoriaActual && (
      AppState.categoriaActual.toLowerCase().includes('gaming') ||
      AppState.categoriaActual.toLowerCase().includes('infantil')
    ))
  ));

  if (p < 150) {
    alertas.push({ tipo: 'danger', msg: `Profundidad deficiente (${p} mm): Menos de 150 mm carece de estabilidad estructural.` });
  } else if (p > 650 && !esTipologiaProfundaValida) {
    alertas.push({ tipo: 'warning', msg: `Profundidad amplia (${p} mm): Más de 650 mm dificulta el alcance de objetos al fondo y genera desperdicio en el seccionado del tablero comercial.` });
  }

  // 2. REPISAS Y ESTANTES (REGLA DE PANDEO Y REFUERZOS POR ESPACIO)
  if (m.tipo_interior === 'repisas') {
    const geo = calcularDivisionesYEspaciosModulo(m, t);
    const limitePandeo = (t === 15) ? 700 : 800;

    let hayPandeo = false;
    geo.espacios.forEach((esp) => {
      if (esp.ancho > limitePandeo && esp.repisas.length > 0) {
        // En muebles y vanos que cuentan con fondo estructural rígido (MDF ranurado a 18mm con soporte posterior o melamina),
        // la arista trasera de la repisa va apoyada y atornillada, duplicando su resistencia al pandeo hasta 1300mm.
        const tieneApoyoTrasero = m.tiene_fondo && (m.tipo_fondo === 'melamina' || m.tiene_liston_post || m.dist_ranura_mdf === 18);
        if (!tieneApoyoTrasero || esp.ancho > 1300) {
          hayPandeo = true;
          alertas.push({
            tipo: 'warning',
            msg: `⚠️ ALERTA DE PANDEO en ${esp.nombre}: El vano (${esp.ancho} mm) supera los ${limitePandeo} mm en melamina de ${t}mm sin apoyo. Se requiere agregar un parante vertical intermedio para evitar arqueo por carga.`
          });
        }
      }
    });

    if (!hayPandeo) {
      if (geo.parantes.length > 0) {
        alertas.push({
          tipo: 'success',
          msg: `✓ Estructura reforzada: ${geo.parantes.length} parante(s) dividen el mueble en ${geo.espacios.length} compartimentos estables sin riesgo de pandeo.`
        });
      } else if (vanoInterior <= limitePandeo) {
        alertas.push({
          tipo: 'success',
          msg: `✓ Repisas estructuralmente seguras: Vano de ${vanoInterior} mm dentro del límite de rigidez frente al pandeo (${limitePandeo} mm).`
        });
      }
    }
  }

  // 3. CAJONERAS Y GAVETAS
  if (m.tipo_interior === 'cajonera') {
    const cantCaj = Math.max(1, parseInt(m.cant_cajones) || 3);
    const altoPorCajon = h / cantCaj;

    if (altoPorCajon > 320) {
      alertas.push({
        tipo: 'danger',
        msg: `⚠️ Altura de cajón desproporcionada (${Math.round(altoPorCajon)} mm por cajón): Cada tapa mide más de 320 mm. En armarios y clósets, subdivida el vano vertical en una cajonera baja (~600-750 mm) y colgado/repisas superior para evitar tapas gigantes e imposibles de utilizar.`
      });
    } else if (altoPorCajon < 90) {
      alertas.push({
        tipo: 'danger',
        msg: `Cajones excesivamente bajos (${Math.round(altoPorCajon)} mm): No queda altura útil para la gaveta tras descontar luces perimetrales y holguras.`
      });
    }

    if (w < 300) {
      alertas.push({ tipo: 'danger', msg: `Cajón muy estrecho (${w} mm): Deja un espacio interior minúsculo tras descontar los laterales y 26 mm de las correderas telescópicas.` });
    } else if (w > 700) {
      alertas.push({ tipo: 'warning', msg: `Cajonera ancha (${w} mm): Se debe colocar un listón de amarre de refuerzo bajo el fondo y correderas Heavy Duty, o dividir en 2 columnas.` });
    }

    if (p < 250) {
      alertas.push({ tipo: 'warning', msg: `Profundidad deficiente para cajón (${p} mm): La corredera comercial más corta disponible en el mercado es de 250 mm (25 cm).` });
    }
  }

  // 4. PUERTAS BATIENTES
  if (m.tipo_interior === 'puertas') {
    if (w > 600) {
      alertas.push({ tipo: 'info', msg: `Módulo ancho (${w} mm): Se divide automáticamente en 2 puertas batientes para evitar palanca excesiva en bisagras de cazoleta de 35 mm.` });
    } else if (w < 250) {
      alertas.push({ tipo: 'warning', msg: `Puerta angosta (${w} mm): Menos de 250 mm fuerza el brazo de palanca de las bisagras.` });
    }

    if (h > 2100) {
      alertas.push({ tipo: 'warning', msg: `Puerta alta (${h} mm): Supera 2100 mm. Requiere de 4 a 5 bisagras distribuidas para evitar alabeo o arqueo del tablero.` });
    }
  }

  // 5. EVALUACIÓN DE ESTÁNDARES COMERCIALES Y AUDITORÍA DE NO COLISIÓN 3D
  const alertasPiezas = evaluarEstandaresYSinColisiones(m, idx, t);
  alertas.push(...alertasPiezas);

  // 6. EVALUACIÓN DE ESTÁNDARES EN ZÓCALO INFERIOR CONTINUO
  if (AppState.tieneZocalo && (AppState.altoZocalo || 0) > 0) {
    const calcFn = (window.Preview3D && window.Preview3D.calcularListonesZocaloEstandar) || window.calcularListonesZocaloEstandar;
    if (typeof calcFn === 'function') {
      const resZocalo = calcFn(
        AppState.anchoTotal, AppState.profTotal, AppState.modulos,
        t, AppState.altoZocalo, AppState.retransZocalo, AppState.cantListonesZocalo
      );
      if (resZocalo && (!resZocalo.cumpleNorma || resZocalo.tipoAlerta === 'danger' || resZocalo.tipoAlerta === 'warning')) {
        alertas.push({ tipo: resZocalo.tipoAlerta || 'danger', msg: resZocalo.mensajeNorma });
      }
    }
  }

  // Filtrar para mostrar únicamente alertas reales (peligros o advertencias)
  const alertasRelevantes = alertas.filter(a => a.tipo === 'warning' || a.tipo === 'danger');

  if (alertasRelevantes.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Renderizar alertas flotantes en la parte inferior de la pantalla
  let html = '';
  alertasRelevantes.forEach((a, i) => {
    const icon = a.tipo === 'danger' ? '⛔' : a.tipo === 'warning' ? '⚠️' : 'ℹ️';
    html += `
      <div class="alert-technical ${a.tipo}" id="alertaTec_${i}">
        <div class="alert-technical-content">
          <span class="alert-technical-icon">${icon}</span>
          <span class="alert-technical-text">${a.msg}</span>
        </div>
        <button type="button" class="alert-technical-close" onclick="cerrarAlertaTecnica(this)" title="Cerrar alerta">✕</button>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Evalúa y muestra las alertas técnicas tanto a nivel de diseño general (zócalo perimétrico, dimensiones)
 * como a nivel de módulo específico si se está editando uno individual.
 */
function evaluarAlertasGeneralesYModulo() {
  const container = document.getElementById('alertasTecnicasModulo');
  if (!container) return;

  if (AppState.modoSeleccion === 'modulo' && AppState.modulos && AppState.modulos[AppState.moduloActivoIndex]) {
    validarLimitesTecnicosModulo(AppState.modulos[AppState.moduloActivoIndex], AppState.moduloActivoIndex);
    return;
  }

  // Vista General / Sin módulos configurados aún (Paso 1)
  const alertas = [];
  const t = AppState.espesorMelamina || 18;

  // Auditoría técnica de Zócalo Inferior Perimétrico
  if (AppState.tieneZocalo && (AppState.altoZocalo || 0) > 0) {
    const calcFn = (window.Preview3D && window.Preview3D.calcularListonesZocaloEstandar) || window.calcularListonesZocaloEstandar;
    if (typeof calcFn === 'function') {
      const resZ = calcFn(
        AppState.anchoTotal, AppState.profTotal, AppState.modulos,
        t, AppState.altoZocalo, AppState.retransZocalo, AppState.cantListonesZocalo
      );
      if (resZ && (!resZ.cumpleNorma || resZ.tipoAlerta === 'danger' || resZ.tipoAlerta === 'warning')) {
        alertas.push({
          tipo: resZ.tipoAlerta || 'danger',
          msg: `ALERTA DE ZÓCALO: ${resZ.mensajeNorma}`
        });
      }
    }
  }

  // Filtrar y renderizar alertas en el contenedor flotante
  const alertasRelevantes = alertas.filter(a => a.tipo === 'warning' || a.tipo === 'danger');
  if (alertasRelevantes.length === 0) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  alertasRelevantes.forEach((a, i) => {
    const icon = a.tipo === 'danger' ? '⛔' : a.tipo === 'warning' ? '⚠️' : 'ℹ️';
    html += `
      <div class="alert-technical ${a.tipo}" id="alertaTecGen_${i}">
        <div class="alert-technical-content">
          <span class="alert-technical-icon">${icon}</span>
          <span class="alert-technical-text">${a.msg}</span>
        </div>
        <button type="button" class="alert-technical-close" onclick="cerrarAlertaTecnica(this)" title="Cerrar alerta">✕</button>
      </div>
    `;
  });
  container.innerHTML = html;
}

/**
 * Cierra una alerta técnica flotante específica en la parte inferior.
 * @param {HTMLElement} btn - Botón de cierre presionado.
 */
function cerrarAlertaTecnica(btn) {
  const alertEl = btn.closest('.alert-technical');
  if (alertEl) {
    alertEl.classList.add('alert-technical-fadeout');
    setTimeout(() => {
      if (alertEl.parentNode) alertEl.parentNode.removeChild(alertEl);
    }, 250);
  }
}

/**
 * Valida todos los módulos del mueble.
 */
function validarTodosLosModulos() {
  if (AppState.modulos[AppState.moduloActivoIndex]) {
    validarLimitesTecnicosModulo(AppState.modulos[AppState.moduloActivoIndex], AppState.moduloActivoIndex);
  }
}

// ==============================================================================
// 8. SINCRONIZACIÓN CON EL MOTOR DE PREVISUALIZACIÓN CANVAS
// ==============================================================================

/**
 * Envía el paquete unificado de datos al motor Canvas Preview3D.
 */
function actualizarCanvas() {
  if (!window.Preview3D) return;

  Preview3D.update({
    estado: AppState.estadoVisualizador,
    ancho_total: AppState.anchoTotal,
    alto_total: AppState.altoTotal,
    prof_total: AppState.profTotal,
    espesor: AppState.espesorMelamina,
    esquema_color: AppState.esquemaColor,
    material: AppState.materialEstructura,
    material_frentes: AppState.materialFrentes,
    material_interior: AppState.materialEstructura,
    color_mdf: AppState.colorMdf,
    resistencia: AppState.resistencia,
    luz_frentes: AppState.luzFrentes,
    modo_seleccion: AppState.modoSeleccion,
    modulo_activo: (AppState.modoSeleccion === 'diseno') ? -1 : AppState.moduloActivoIndex,
    modulos: AppState.modulos,
    tiene_zocalo: AppState.tieneZocalo,
    alto_zocalo: AppState.altoZocalo,
    cant_listones: AppState.cantListonesZocalo,
    retrans_zocalo: AppState.retransZocalo
  });
}

/**
 * Actualiza el indicador textual en el header superior.
 */
function actualizarBadgeEstado() {
  const lbl = document.getElementById('activeModuleDims');
  if (!lbl) return;

  if (AppState.estadoVisualizador === 'vacio') {
    lbl.innerText = "Esperando dimensiones generales...";
  } else if (AppState.estadoVisualizador === 'delineado') {
    lbl.innerText = `Marco Delineado: ${AppState.anchoTotal} x ${AppState.altoTotal} x ${AppState.profTotal} mm`;
  } else {
    if (AppState.modoSeleccion === 'diseno') {
      lbl.innerText = `Diseño Todo el Mueble: ${AppState.anchoTotal} x ${AppState.altoTotal} x ${AppState.profTotal} mm (${AppState.modulos.length} Módulos | Melamina ${AppState.espesorMelamina}mm)`;
    } else {
      const idx = AppState.moduloActivoIndex;
      const m = AppState.modulos[idx];
      const w = m ? m.ancho : 0;
      const h = m ? m.alto : AppState.altoTotal;
      const d = m ? m.profundidad : AppState.profTotal;
      lbl.innerText = `Módulo ${idx + 1} de ${AppState.modulos.length}: ${w} x ${h} x ${d} mm (Melamina ${AppState.espesorMelamina}mm)`;
    }
  }
}

// ==============================================================================
// 9. CONSTRUCCIÓN EN SKETCHUP 3D Y COMUNICACIÓN BIDIRECCIONAL
// ==============================================================================

/**
 * Envía el paquete paramétrico completo a Ruby para modelar en SketchUp 3D.
 */
function construirEnSketchup() {
  try {
    // Sincronizar dimensiones si el usuario ve valores en pantalla pero no disparó oninput
    const elW = document.getElementById('dimAnchoTotal');
    const elH = document.getElementById('dimAltoTotal');
    const elD = document.getElementById('dimProfTotal');

    if (AppState.anchoTotal <= 0 && elW) {
      const valW = parseFloat(elW.value) || parseFloat(elW.placeholder) || 2400;
      AppState.anchoTotal = valW;
      elW.value = valW;
    }
    if (AppState.altoTotal <= 0 && elH) {
      const valH = parseFloat(elH.value) || parseFloat(elH.placeholder) || 2100;
      AppState.altoTotal = valH;
      elH.value = valH;
    }
    if (AppState.profTotal <= 0 && elD) {
      const valD = parseFloat(elD.value) || parseFloat(elD.placeholder) || 600;
      AppState.profTotal = valD;
      elD.value = valD;
    }

    if (AppState.anchoTotal <= 0 || AppState.altoTotal <= 0 || AppState.profTotal <= 0) {
      alert("⚠️ JPQMelaminaPro:\nPor favor ingrese las dimensiones generales (Ancho, Alto, Profundidad) en el Paso 1.");
      mostrarNotificacion("Debe ingresar las dimensiones generales en el Paso 1 antes de construir.", "warning");
      return;
    }

    if (!AppState.modulos || AppState.modulos.length === 0) {
      // Auto-generar 1 módulo básico estándar si la lista está vacía
      AppState.cantidadModulos = 1;
      const inpCant = document.getElementById('inputCantModulos');
      if (inpCant) inpCant.value = '1';
      onCantidadModulosChange();
    }

    const calcFn = (window.Preview3D && window.Preview3D.calcularListonesZocaloEstandar) || window.calcularListonesZocaloEstandar;
    const resZocalo = (typeof calcFn === 'function')
      ? calcFn(AppState.anchoTotal, AppState.profTotal, AppState.modulos, AppState.espesorMelamina, AppState.altoZocalo, AppState.retransZocalo, AppState.cantListonesZocalo)
      : null;

    const payload = {
      ancho_total: AppState.anchoTotal,
      alto_total: AppState.altoTotal,
      prof_total: AppState.profTotal,
      espesor: AppState.espesorMelamina,
      material_estructura: AppState.materialEstructura,
      material_frentes: AppState.materialFrentes,
      resistencia: AppState.resistencia,
      luz_frentes: AppState.luzFrentes,
      modo_tapacanto: AppState.modoTapacanto || 'estandar',
      tiene_zocalo: AppState.tieneZocalo,
      alto_zocalo: AppState.altoZocalo,
      cant_listones: AppState.cantListonesZocalo,
      cant_listones_internos: AppState.cantListonesZocalo,
      cant_listones_calculada: resZocalo ? resZocalo.cantActual : AppState.cantListonesZocalo,
      listones_zocalo: resZocalo ? resZocalo.listones : [],
      retrans_zocalo: AppState.retransZocalo,
      modulos: AppState.modulos
    };

    mostrarNotificacion("Construyendo composición de módulos en SketchUp 3D...", "info");

    const suBridge = (typeof window !== 'undefined' && window.sketchup)
      ? window.sketchup
      : (typeof sketchup !== 'undefined' ? sketchup : null);

    if (suBridge && typeof suBridge.construirComposicionModular === 'function') {
      suBridge.construirComposicionModular(JSON.stringify(payload));
    } else if (typeof window.callSketchup === 'function') {
      window.callSketchup('construirComposicionModular', payload);
    } else {
      alert("⚠️ [Modo Simulación Navegador]\nNo se detectó el puente nativo con SketchUp 3D (window.sketchup).");
      console.log("[JPQMelaminaPro Bridge] Payload enviado a SketchUp:", payload);
      setTimeout(() => {
        mostrarNotificacion(`[Simulación] Mueble de ${AppState.modulos.length} módulos construido exitosamente en SketchUp.`, "success");
      }, 600);
    }
  } catch (errJS) {
    alert("❌ Error en JavaScript al preparar la construcción:\n" + errJS.message);
    console.error("[construirEnSketchup]", errJS);
  }
}

/**
 * Carga un diseño completo o módulo seleccionado desde SketchUp 3D y visualiza todo en el panel.
 * @param {object|string} datos - Datos del mueble o composición extraídos de SketchUp.
 */
function cargarDisenoDesdeSketchup(datos) {
  try {
    if (!datos) {
      mostrarNotificacion("No hay ningún diseño seleccionado en SketchUp.", "warning");
      return;
    }

    if (typeof datos === 'string') {
      try { datos = JSON.parse(datos); } catch (e) { console.warn(e); }
    }

    console.log("[JPQMelaminaPro] Cargando diseño desde SketchUp:", datos);

    // Extraer parámetros (soporta datos directos, datos.params o datos.params_json)
    let params = null;
    if (datos.params && typeof datos.params === 'object') {
      params = datos.params;
    } else if (datos.params_json) {
      try {
        params = (typeof datos.params_json === 'string') ? JSON.parse(datos.params_json) : datos.params_json;
      } catch (e) {
        console.warn(e);
      }
    }

    if (!params) {
      params = datos;
    }

    // 1. Dimensiones generales (W, H, D)
    const w = parseFloat(params.ancho_total || params.ancho_mm || params.ancho) || 1200;
    const h = parseFloat(params.alto_total || params.alto_mm || params.alto) || 1800;
    const d = parseFloat(params.prof_total || params.prof_mm || params.profundidad || params.prof_baja) || 600;
    const esp = parseFloat(params.espesor || params.espesor_mm) || 18;

    AppState.anchoTotal = w;
    AppState.altoTotal = h;
    AppState.profTotal = d;
    AppState.espesorMelamina = esp;

    const elW = document.getElementById('dimAnchoTotal');
    const elH = document.getElementById('dimAltoTotal');
    const elD = document.getElementById('dimProfTotal');
    if (elW) elW.value = w;
    if (elH) elH.value = h;
    if (elD) elD.value = d;

    // 2. Zócalo inferior perimétrico continuo
    const tieneZ = (params.tiene_zocalo === true || params.tiene_zocalo === 'true' || (params.alto_zocalo && parseFloat(params.alto_zocalo) > 0));
    const altoZ = tieneZ ? (parseFloat(params.alto_zocalo || params.altura_zocalo) || 100) : 0;
    const retransZ = (params.retrans_zocalo !== undefined && params.retrans_zocalo !== '') ? parseFloat(params.retrans_zocalo) : 35;
    const cantL = params.cant_listones || params.cant_listones_internos || 'auto';

    AppState.tieneZocalo = tieneZ;
    AppState.altoZocalo = altoZ;
    AppState.retransZocalo = retransZ;
    AppState.cantListonesZocalo = cantL;

    const chkZ = document.getElementById('muebleTieneZocalo');
    if (chkZ) chkZ.checked = tieneZ;
    const elAltoZ = document.getElementById('muebleAltoZocalo');
    if (elAltoZ) elAltoZ.value = altoZ;
    const elRetransZ = document.getElementById('muebleRetransZocalo');
    if (elRetransZ) elRetransZ.value = retransZ;
    const elCantL = document.getElementById('muebleCantListones');
    if (elCantL) elCantL.value = cantL;
    actualizarUIZocaloGeneral();

    // 3. Materiales y Tapacantos
    if (params.material_estructura) {
      AppState.materialEstructura = params.material_estructura;
    }
    if (params.material_frentes) {
      AppState.materialFrentes = params.material_frentes;
    }
    if (params.resistencia) {
      AppState.resistencia = params.resistencia;
      const selRes = document.getElementById('selectResistenciaMelamina');
      if (selRes) selRes.value = params.resistencia;
      actualizarIndicadorRHUI();
    }
    if (params.luz_frentes) {
      AppState.luzFrentes = parseFloat(params.luz_frentes);
    }
    if (params.modo_tapacanto) {
      AppState.modoTapacanto = params.modo_tapacanto;
      actualizarSelectoresModoTapacanto(params.modo_tapacanto);
    }

    // 4. Módulos
    let modulos = [];
    if (Array.isArray(params.modulos) && params.modulos.length > 0) {
      modulos = params.modulos.map((m, idx) => {
        return {
          ...m,
          id: m.id || (idx + 1),
          nombre: m.nombre || `Módulo ${idx + 1}`,
          ancho: parseFloat(m.ancho) || Math.round(w / params.modulos.length),
          alto: parseFloat(m.alto) || (h - (tieneZ ? altoZ : 0)),
          profundidad: parseFloat(m.profundidad) || d
        };
      });
    } else {
      modulos = [{
        id: 1,
        nombre: params.nombre || 'Módulo 1',
        ancho: w,
        alto: h - (tieneZ ? altoZ : 0),
        profundidad: d,
        tipo_interior: params.tipo_interior || 'carcasa',
        cant_repisas: parseInt(params.cant_repisas) || 0,
        cant_cajones: parseInt(params.cant_cajones) || 0,
        tiene_puertas: params.tiene_puertas === true || params.tiene_puertas === 'true',
        tiene_fondo: params.tiene_fondo !== false && params.tiene_fondo !== 'false'
      }];
    }

    AppState.cantidadModulos = modulos.length;
    AppState.modulos = modulos;
    AppState.moduloActivoIndex = 0;
    AppState.modoSeleccion = 'diseno';
    AppState.estadoVisualizador = 'modulos';

    // Sincronizar input de cantidad de módulos
    const inpCant = document.getElementById('inputCantModulos');
    if (inpCant) inpCant.value = modulos.length;
    const badgePaso3 = document.getElementById('badgeCantModulosPaso3');
    if (badgePaso3) {
      badgePaso3.textContent = `${modulos.length} ${modulos.length === 1 ? 'módulo' : 'módulos'}`;
    }

    // Actualizar todos los componentes y el renderizado 3D en el Canvas
    actualizarVisibilidadPaneles();
    renderizarBotonesSelectorCanvas();
    renderizarPestanasModulos();
    actualizarFormularioModuloActivo();
    actualizarBadgeEstado();
    actualizarCanvas();

    // Asegurar que el Hub activo sea Estudio Espacial
    if (typeof cambiarHub === 'function') {
      cambiarHub('hub-espacio');
    }

    mostrarNotificacion(`✓ Diseño cargado desde SketchUp: ${w} × ${h} × ${d} mm (${modulos.length} módulos)`, "success");
  } catch (err) {
    console.error("[cargarDisenoDesdeSketchup]", err);
    mostrarNotificacion("Error al procesar el diseño seleccionado: " + err.message, "error");
  }
}

/**
 * Función disparada desde el botón 'Cargar Selección 3D' en la cabecera.
 */
function leerDisenoDesdeSketchupClick() {
  const suBridge = (typeof window !== 'undefined' && window.sketchup)
    ? window.sketchup
    : (typeof sketchup !== 'undefined' ? sketchup : null);

  if (suBridge && typeof suBridge.importarDisenoDesdeSketchup === 'function') {
    suBridge.importarDisenoDesdeSketchup('');
  } else if (typeof window.callSketchup === 'function') {
    window.callSketchup('importarDisenoDesdeSketchup');
  } else {
    mostrarNotificacion("Modo simulación: Selecciona un diseño en SketchUp 3D para cargarlo.", "info");
  }
}

function onModuloSeleccionado(datos) {
  if (datos) {
    cargarDisenoDesdeSketchup(datos);
  }
}

function onNotificacion(datos) {
  if (datos && datos.mensaje) {
    mostrarNotificacion(datos.mensaje, datos.tipo || "info");
  }
}

if (typeof window !== 'undefined') {
  window.construirEnSketchup = construirEnSketchup;
  window.onComposicionModularCreada = onComposicionModularCreada;
  window.cargarDisenoDesdeSketchup = cargarDisenoDesdeSketchup;
  window.cargarDatosEdicion = cargarDisenoDesdeSketchup;
  window.vaciarDiseno = vaciarDiseno;
  window.reiniciarAEstadoVacio = reiniciarAEstadoVacio;
  window.toggleModoOcultarPiezas = toggleModoOcultarPiezas;
  window.leerDisenoDesdeSketchupClick = leerDisenoDesdeSketchupClick;
  window.onModuloSeleccionado = onModuloSeleccionado;
  window.onNotificacion = onNotificacion;
  window.onToggleZocaloGeneral = onToggleZocaloGeneral;
  window.onEditarAltoZocaloGeneral = onEditarAltoZocaloGeneral;
  window.onEditarCantListonesGeneral = onEditarCantListonesGeneral;
  window.onEditarRetransZocaloGeneral = onEditarRetransZocaloGeneral;
  window.onToggleZocaloModulo = onToggleZocaloModulo;
  window.onEditarAltoZocalo = onEditarAltoZocalo;
  window.onEditarRetransZocalo = onEditarRetransZocalo;
  window.onEditarDescuentoFrontal = onEditarDescuentoFrontal;
  window.onAgregarSubParanteEspacio = onAgregarSubParanteEspacio;
  window.onEliminarSubParanteEspacio = onEliminarSubParanteEspacio;
  window.onCambiarModoSubParanteEspacio = onCambiarModoSubParanteEspacio;
  window.onEditarPosicionSubParanteEspacio = onEditarPosicionSubParanteEspacio;
}

// ==============================================================================
// 10. MODAL DE DESPIECE OFICIAL & OPTIMIZADOR 2D GUILLOTINA
// ==============================================================================

/**
 * Abre el modal integrado con la tabla de despiece y corte guillotina 2D.
 */
function abrirModalDespiece() {
  const modal = document.getElementById('modalDespiece');
  if (modal) {
    modal.style.display = 'flex';
    solicitarDespiece();
  }
}

/**
 * Cierra el modal de despiece.
 */
function cerrarModalDespiece() {
  const modal = document.getElementById('modalDespiece');
  if (modal) modal.style.display = 'none';
}

/**
 * Solicita a SketchUp la extracción oficial de piezas o genera lista estimada.
 */
function solicitarDespiece() {
  if (window.sketchup && typeof window.sketchup.extraerDespiece === 'function') {
    window.sketchup.extraerDespiece(JSON.stringify({ solo_seleccion: false }));
  } else {
    // Generar despiece paramétrico estimado a partir del estado de los módulos
    generarDespieceEstimadoLocal();
  }
}

/**
 * Genera la lista de corte local basada en los módulos activos cuando no corre en SketchUp.
 */
function generarDespieceEstimadoLocal() {
  const t = AppState.espesorMelamina;
  const piezas = [];
  let itemNum = 1;
  const esUnicolor = (AppState.esquemaColor === 'unicolor');
  const matFrontis = AppState.materialFrentes || 'Pelikano Blanco Nieve 18mm';
  const matInterior = AppState.materialEstructura || 'Pelikano Blanco Nieve 18mm';
  const matMdfBase = AppState.colorMdf || 'MDF Fondo Blanco 3mm';

  /**
   * Determina los tapacantos normativos, deduce la medida neta exacta de corte y asigna colores:
   * MODOS DISPONIBLES:
   * - 'estandar': Frentes 2mm en 4 cantos, estructura frontal 2mm + interiores 0.5mm.
   * - 'economico': Todo delgado 0.5mm en bordes vistos, sin cantos (0mm) en interiores/posteriores.
   * - 'premium': Alto tránsito, frentes 2mm, estructuras 2mm en vista + 1.0mm perimetral.
   * - 'personalizado': Respeta cambios individuales hechos por el usuario en la tabla.
   *
   * DEDUCCIÓN MILIMÉTRICA ESTRICTA:
   *   Largo_neto = Largo_bruto - (Canto_L1 + Canto_L2)
   *   Ancho_neto = Ancho_bruto - (Canto_A1 + Canto_A2)
   */
  function calcularTapacantosYMedidaNeta(nombrePieza, largoBruto, anchoBruto, opts = {}) {
    const nom = (nombrePieza || '').toLowerCase();
    const modo = AppState.modoTapacanto || 'estandar';
    let cL1 = 0.0, cL2 = 0.0, cA1 = 0.0, cA2 = 0.0;
    let colorL1 = matInterior;
    let colorOtros = matInterior;

    const esMdfPieza = opts.esMdf || nom.includes('mdf') || nom.includes('fondo posterior mdf') || nom.includes('fondo mdf');
    const esFrente = opts.esMesaPuerta || nom.includes('puerta') || nom.includes('frente cajón') || nom.includes('frente cajon') || nom.includes('cubierta') || nom.includes('mesa') || nom.includes('escritorio') || nom.includes('tapa techo');
    const esEstructuraVista = nom.includes('costado') || (nom.includes('lateral') && !nom.includes('gaveta') && !nom.includes('cajón')) || nom.includes('repisa') || nom.includes('piso carcasa') || nom.includes('techo carcasa') || nom.includes('parante') || nom.includes('zócalo frontal');
    const esCajonera = nom.includes('gaveta') || nom.includes('cajón') || nom.includes('cajon') || nom.includes('contrafrente') || nom.includes('trasera');

    if (esMdfPieza) {
      cL1 = 0.0; cL2 = 0.0; cA1 = 0.0; cA2 = 0.0;
      colorL1 = 'Sin canto';
      colorOtros = 'Sin canto';
    } else if (modo === 'economico') {
      // MODO ECONÓMICO: Canto delgado 0.5mm en bordes visibles, 0mm en bordes ocultos (Ahorro de metros y costos)
      if (esFrente) {
        cL1 = 0.5; cL2 = 0.5; cA1 = 0.5; cA2 = 0.5;
        colorL1 = matFrontis;
        colorOtros = matFrontis;
      } else if (esEstructuraVista) {
        cL1 = 0.5; cL2 = 0.0; cA1 = 0.0; cA2 = 0.0;
        colorL1 = esUnicolor ? matInterior : matFrontis;
        colorOtros = matInterior;
      } else if (esCajonera) {
        cL1 = 0.5; cL2 = 0.0; cA1 = 0.0; cA2 = 0.0;
        colorL1 = matInterior;
        colorOtros = matInterior;
      } else {
        cL1 = 0.5; cL2 = 0.0; cA1 = 0.0; cA2 = 0.0;
        colorL1 = matInterior;
        colorOtros = matInterior;
      }
    } else if (modo === 'premium') {
      // MODO PREMIUM: Alto tránsito y máxima protección contra humedad/golpes
      if (esFrente) {
        cL1 = 2.0; cL2 = 2.0; cA1 = 2.0; cA2 = 2.0;
        colorL1 = matFrontis;
        colorOtros = matFrontis;
      } else if (esEstructuraVista) {
        cL1 = 2.0; cL2 = 1.0; cA1 = 1.0; cA2 = 1.0;
        colorL1 = esUnicolor ? matInterior : matFrontis;
        colorOtros = matInterior;
      } else if (esCajonera) {
        cL1 = 1.0; cL2 = 0.5; cA1 = 0.5; cA2 = 0.5;
        colorL1 = matInterior;
        colorOtros = matInterior;
      } else {
        cL1 = 1.0; cL2 = 0.5; cA1 = 0.5; cA2 = 0.5;
        colorL1 = matInterior;
        colorOtros = matInterior;
      }
    } else {
      // MODO ESTÁNDAR (Comercial alta gama por defecto):
      if (esFrente) {
        cL1 = 2.0; cL2 = 2.0; cA1 = 2.0; cA2 = 2.0;
        colorL1 = matFrontis;
        colorOtros = matFrontis;
      } else if (esEstructuraVista) {
        cL1 = 2.0; cL2 = 0.5; cA1 = 0.5; cA2 = 0.5;
        colorL1 = esUnicolor ? matInterior : matFrontis;
        colorOtros = matInterior;
      } else if (esCajonera) {
        cL1 = 0.5; cL2 = 0.0; cA1 = 0.0; cA2 = 0.0;
        colorL1 = matInterior;
        colorOtros = matInterior;
      } else {
        cL1 = 0.5; cL2 = 0.5; cA1 = 0.5; cA2 = 0.5;
        colorL1 = matInterior;
        colorOtros = matInterior;
      }
    }

    // Sobreescritura manual por parte del usuario o de opciones explícitas
    if (opts.canto_L1_manual || (modo === 'personalizado' && opts.canto_L1 !== undefined)) cL1 = parseFloat(opts.canto_L1);
    else if (opts.canto_L1 !== undefined && modo === 'estandar') cL1 = parseFloat(opts.canto_L1);

    if (opts.canto_L2_manual || (modo === 'personalizado' && opts.canto_L2 !== undefined)) cL2 = parseFloat(opts.canto_L2);
    else if (opts.canto_L2 !== undefined && modo === 'estandar') cL2 = parseFloat(opts.canto_L2);

    if (opts.canto_A1_manual || (modo === 'personalizado' && opts.canto_A1 !== undefined)) cA1 = parseFloat(opts.canto_A1);
    else if (opts.canto_A1 !== undefined && modo === 'estandar') cA1 = parseFloat(opts.canto_A1);

    if (opts.canto_A2_manual || (modo === 'personalizado' && opts.canto_A2 !== undefined)) cA2 = parseFloat(opts.canto_A2);
    else if (opts.canto_A2 !== undefined && modo === 'estandar') cA2 = parseFloat(opts.canto_A2);

    // Deducción milimétrica estricta de la medida de corte en sierra
    const largoNeto = Math.round((largoBruto - (cL1 + cL2)) * 10) / 10;
    const anchoNeto = Math.round((anchoBruto - (cA1 + cA2)) * 10) / 10;

    let descColor = '';
    if (cL1 === 0 && cL2 === 0 && cA1 === 0 && cA2 === 0) {
      descColor = 'Sin tapacanto';
    } else if (esUnicolor || colorL1 === colorOtros) {
      descColor = colorL1;
    } else {
      descColor = `L1: ${colorL1} | Otros: ${colorOtros}`;
    }

    return {
      canto_L1: cL1.toFixed(1),
      canto_L2: cL2.toFixed(1),
      canto_A1: cA1.toFixed(1),
      canto_A2: cA2.toFixed(1),
      color_canto_L1: colorL1,
      color_canto_otros: colorOtros,
      desc_color_tapacanto: descColor,
      largo_neto: largoNeto,
      ancho_neto: anchoNeto
    };
  }

  function crearItemDespiece(modId, nomPieza, material, cant, largoBruto, anchoBruto, espesor, ranura = 'Ninguna', opts = {}) {
    const tap = calcularTapacantosYMedidaNeta(nomPieza, largoBruto, anchoBruto, opts);
    let matFinal = material;
    if (AppState.resistencia === 'RH' && !nomPieza.toLowerCase().includes('mdf') && !material.toLowerCase().includes('acero') && !material.toLowerCase().includes('herraje')) {
      if (!matFinal.includes('[RH]')) matFinal = `${matFinal} [RH]`;
    }
    return {
      item: itemNum++,
      modulo: modId,
      pieza: nomPieza,
      material: matFinal,
      cant: cant,
      largo_bruto: Math.round(largoBruto),
      ancho_bruto: Math.round(anchoBruto),
      espesor: espesor,
      largo_neto: tap.largo_neto,
      ancho_neto: tap.ancho_neto,
      canto_L1: tap.canto_L1,
      canto_L2: tap.canto_L2,
      canto_A1: tap.canto_A1,
      canto_A2: tap.canto_A2,
      color_tapacanto: tap.desc_color_tapacanto,
      color_canto_L1: tap.color_canto_L1,
      color_canto_otros: tap.color_canto_otros,
      ranura: ranura,
      ...opts
    };
  }

  // Piezas de Zócalo Base Inferior Global (si el mueble tiene zócalo perimétrico activo)
  if (AppState.tieneZocalo && AppState.altoZocalo > 0) {
    const zH = AppState.altoZocalo;
    const retransZocalo = (AppState.retransZocalo !== undefined && AppState.retransZocalo !== null && AppState.retransZocalo !== '' && !isNaN(AppState.retransZocalo))
      ? Math.max(0, parseFloat(AppState.retransZocalo))
      : 35;
    const largoTrans = Math.max(10, AppState.profTotal - retransZocalo - (2 * t));

    // 1. Zócalo Frontal Continuo (Abarca todo el ancho del mueble: 0 a W)
    piezas.push(crearItemDespiece("Zócalo Base", "Zócalo Frontal Continuo", (esUnicolor ? matInterior : matFrontis), 1, AppState.anchoTotal, zH, t, 'Ninguna'));

    // 2. Zócalo Posterior Continuo (Abarca todo el ancho del mueble: 0 a W)
    piezas.push(crearItemDespiece("Zócalo Base", "Zócalo Posterior Continuo", matInterior, 1, AppState.anchoTotal, zH, t, 'Ninguna'));

    // 3. Lateral Izquierdo de Zócalo (Entre frontal y posterior: longitud = largoTrans)
    piezas.push(crearItemDespiece("Zócalo Base", "Zócalo Lateral Izquierdo", matInterior, 1, largoTrans, zH, t, 'Ninguna'));

    // 4. Lateral Derecho de Zócalo (Entre frontal y posterior: longitud = largoTrans)
    piezas.push(crearItemDespiece("Zócalo Base", "Zócalo Lateral Derecho", matInterior, 1, largoTrans, zH, t, 'Ninguna'));

    // 5. Listones transversales interiores de soporte del zócalo perimétrico según estándares
    const calcFnDesp = (window.Preview3D && window.Preview3D.calcularListonesZocaloEstandar) || window.calcularListonesZocaloEstandar;
    if (typeof calcFnDesp === 'function') {
      const resZocaloDesp = calcFnDesp(
        AppState.anchoTotal, AppState.profTotal, AppState.modulos,
        t, zH, retransZocalo, AppState.cantListonesZocalo
      );
      if (resZocaloDesp && resZocaloDesp.listones && resZocaloDesp.listones.length > 0) {
        resZocaloDesp.listones.forEach((l, lIdx) => {
          piezas.push(crearItemDespiece("Zócalo Base", l.nombre || `Zócalo Listón Soporte ${lIdx + 1}`, matInterior, 1, largoTrans, zH, t, 'Ninguna'));
        });
      }
    } else {
      const cantListones = (AppState.cantListonesZocalo === 'auto') ? 2 : (parseInt(AppState.cantListonesZocalo) || 0);
      if (cantListones > 0 && largoTrans > 0) {
        piezas.push(crearItemDespiece("Zócalo Base", "Zócalo Refuerzo Transversal Interior", matInterior, cantListones, largoTrans, zH, t, 'Ninguna'));
      }
    }
  }

  AppState.modulos.forEach((m, idx) => {
    const modId = (m.nombre && m.nombre.trim()) ? m.nombre.trim() : `M${idx + 1}`;
    // Si hay zócalo global, el módulo no duplica zócalo inferior
    const zH = (!AppState.tieneZocalo && m.tiene_zocalo && m.alto_zocalo > 0) ? m.alto_zocalo : 0;
    const zSupH = (m.tiene_zocalo_sup && m.alto_zocalo_sup > 0) ? m.alto_zocalo_sup : 0;
    const tienePiso = (m.tiene_piso !== false && m.tiene_piso !== 'false');
    const usaAmarresPiso = tienePiso && (m.tiene_liston_piso === true || m.tiene_liston_piso === 'true');
    const tieneTecho = (m.tiene_techo !== false && m.tiene_techo !== 'false');
    const usaAmarresTecho = tieneTecho && ((m.tiene_liston_techo === true || m.tiene_liston_techo === 'true') ||
      ((m.tiene_liston_amarre === true || m.tiene_liston_amarre === 'true') && (m.posicion_liston_amarre === 'techo' || m.posicion_liston_amarre === 'ambos')));
    const tieneTechoSobre = usaAmarresTecho && (m.techo_sobre_liston === true || m.techo_sobre_liston === 'true');
    const esDobleMelamina = m.techo_doble_melamina === true || m.techo_doble_melamina === 'true';
    const hTecho = tieneTechoSobre ? (esDobleMelamina ? (2 * t) : t) : 0;

    const dimCarcasa = calcularDimensionesCarcasa(m, t);
    const profCarcasa = dimCarcasa.profCarcasa;

    // Los laterales van sobre el zócalo inferior (z = zH) y continúan hasta arriba (descontando solo techo sobrepuesto si existe)
    const tieneLaterales = (m.tiene_laterales !== false && m.tiene_laterales !== 'false');
    const hLateral = m.alto - zH - hTecho;
    const hCarcasa = m.alto - zH - hTecho - zSupH;
    const anchoInt = tieneLaterales ? (m.ancho - (2 * t)) : m.ancho;
    const esModuloVacio = !tieneLaterales && !tieneTecho && !tienePiso;

    // Configuración de Fondo (MDF o Melamina)
    const tieneFondo = !!(m.tiene_fondo || m.tiene_fondo_mdf);
    const tipoFondo = tieneFondo ? (m.tipo_fondo || (m.tiene_fondo_mdf ? 'mdf' : 'mdf')) : 'ninguno';
    const tieneFondoMdf = (tipoFondo === 'mdf');
    const posMdf = m.posicion_fondo_mdf || 'delante_liston';
    const grosorMdf = parseFloat(m.grosor_mdf) || 3;
    const anchoRanura = (m.ancho_ranura_mdf !== undefined) ? parseFloat(m.ancho_ranura_mdf) : (grosorMdf + 1);
    const profRanura = (m.prof_ranura_mdf !== undefined) ? parseFloat(m.prof_ranura_mdf) : 8;
    const effDistRanura = (m.dist_ranura_mdf !== undefined && parseFloat(m.dist_ranura_mdf) > 0)
      ? parseFloat(m.dist_ranura_mdf)
      : (posMdf === 'delante_liston' ? t : 0);

    const ranuraCarcasa = (tieneFondoMdf && posMdf === 'delante_liston')
      ? `Ranura ${anchoRanura}x${profRanura}mm a ${effDistRanura}mm`
      : 'Ninguna';

    // Laterales (Costados): usan profCarcasa (descontando espesor si el frente es exterior)
    if (tieneLaterales) {
      piezas.push(crearItemDespiece(modId, "Costado Izquierdo", matInterior, 1, hLateral, profCarcasa, t, ranuraCarcasa, {
        canto_L1: 2.0, canto_L2: 0.5, canto_A1: 0.5, canto_A2: 0.5
      }));
      piezas.push(crearItemDespiece(modId, "Costado Derecho", matInterior, 1, hLateral, profCarcasa, t, ranuraCarcasa, {
        canto_L1: 2.0, canto_L2: 0.5, canto_A1: 0.5, canto_A2: 0.5
      }));
    }

    // Piso Carcasa (Sólido o Listones de Amarre de Piso)
    if (tienePiso) {
      if (usaAmarresPiso) {
        const cantPiso = m.cant_listones_piso || 2;
        const wListonPiso = parseFloat(m.ancho_liston_piso || m.medida_liston_piso || 80);
        piezas.push(crearItemDespiece(modId, "Amarre Piso Frontal (x1)", matInterior, 1, anchoInt, wListonPiso, t, 'Ninguna', {
          canto_L1: 2.0, canto_L2: 0.5, canto_A1: 0.5, canto_A2: 0.5
        }));
        if (cantPiso >= 2) {
          piezas.push(crearItemDespiece(modId, `Amarres Piso Posteriores/Refuerzo (x${cantPiso - 1})`, matInterior, cantPiso - 1, anchoInt, wListonPiso, t, 'Ninguna', {
            canto_L1: 0.5, canto_L2: 0.5, canto_A1: 0.5, canto_A2: 0.5
          }));
        }
      } else {
        piezas.push(crearItemDespiece(modId, "Piso Carcasa", matInterior, 1, anchoInt, profCarcasa, t, ranuraCarcasa, {
          canto_L1: 2.0, canto_L2: 0.0, canto_A1: 0.5, canto_A2: 0.5
        }));
      }
    }

    // Techo o Amarres de Techo (desciende según la altura del zócalo superior)
    if (tieneTecho) {
      if (usaAmarresTecho) {
        const cantTecho = m.cant_listones_techo || m.cant_listones_amarre || 2;
        const wListonTecho = parseFloat(m.ancho_liston_techo || m.medida_liston_techo || m.alto_liston_amarre || 80);
        piezas.push(crearItemDespiece(modId, "Amarre Techo Frontal (x1)", matInterior, 1, anchoInt, wListonTecho, t, 'Ninguna', {
          canto_L1: 2.0, canto_L2: 0.5, canto_A1: 0.5, canto_A2: 0.5
        }));
        if (cantTecho >= 2) {
          piezas.push(crearItemDespiece(modId, `Amarres Techo Posteriores/Refuerzo (x${cantTecho - 1})`, matInterior, cantTecho - 1, anchoInt, wListonTecho, t, 'Ninguna', {
            canto_L1: 0.5, canto_L2: 0.5, canto_A1: 0.5, canto_A2: 0.5
          }));
        }

        // Techo Sobrepuesto
        if (tieneTechoSobre) {
          if (esDobleMelamina) {
            piezas.push(crearItemDespiece(modId, "Tapa Techo Doble Melamina (Engrosado 36mm)", matFrontis, 2, m.ancho, profCarcasa, t, 'Ninguna', {
              esMesaPuerta: true,
              canto_L1: 2.0, canto_L2: 2.0, canto_A1: 2.0, canto_A2: 2.0
            }));
          } else {
            piezas.push(crearItemDespiece(modId, "Tapa Techo Sobrepuesta Simple", matFrontis, 1, m.ancho, profCarcasa, t, 'Ninguna', {
              esMesaPuerta: true,
              canto_L1: 2.0, canto_L2: 2.0, canto_A1: 2.0, canto_A2: 2.0
            }));
          }
        }
      } else {
        piezas.push(crearItemDespiece(modId, "Techo Carcasa Sólido", matInterior, 1, anchoInt, profCarcasa, t, ranuraCarcasa, {
          canto_L1: 2.0, canto_L2: 0.0, canto_A1: 0.5, canto_A2: 0.5
        }));
      }
    }

    // Listones Posteriores de Amarre / Fijación a Pared (REGLA: Con fondo melamina NO lleva listón posterior)
    const usaAmarresPost = (tipoFondo !== 'melamina') && (
      (m.tiene_liston_post === true || m.tiene_liston_post === 'true') ||
      ((m.tiene_liston_amarre === true || m.tiene_liston_amarre === 'true') && (m.posicion_liston_amarre === 'posterior' || m.posicion_liston_amarre === 'ambos'))
    );
    if (usaAmarresPost) {
      const cantPost = m.cant_listones_post || m.cant_listones_amarre || 2;
      const wListonPost = parseFloat(m.ancho_liston_post || m.medida_liston_post || m.alto_liston_amarre || 80);
      const orientacionPost = m.orientacion_liston_post || 'horizontal';
      const hVanoUtilPost = Math.max(50, hCarcasa - (m.tiene_piso !== false ? t : 0) - (m.tiene_techo !== false ? t : 0));

      if (orientacionPost === 'vertical') {
        piezas.push(crearItemDespiece(modId, `Listones Fondo Verticales (x${cantPost})`, matInterior, cantPost, hVanoUtilPost, wListonPost, t, 'Ninguna', {
          canto_L1: 0.5, canto_L2: 0.0, canto_A1: 0.5, canto_A2: 0.5
        }));
      } else {
        piezas.push(crearItemDespiece(modId, `Listones Posteriores Pared (x${cantPost})`, matInterior, cantPost, anchoInt, wListonPost, t, 'Ninguna', {
          canto_L1: 0.5, canto_L2: 0.0, canto_A1: 0.5, canto_A2: 0.5
        }));
      }
    }

    // Zócalo Inferior (solo activo en modo legado individual si el zócalo no es global)
    if (!AppState.tieneZocalo && m.tiene_zocalo && zH > 0) {
      const cantZocalo = m.cant_listones || 2;
      const retransZocalo = (m.retrans_zocalo !== undefined && m.retrans_zocalo !== '')
        ? parseFloat(m.retrans_zocalo)
        : 35;
      const largoLatZocalo = Math.max(50, m.profundidad - retransZocalo);
      const anchoZocaloPerim = Math.max(0, m.ancho - (2 * t));

      // 1. Zócalo Frontal
      piezas.push(crearItemDespiece(modId, "Zócalo Frontal", (esUnicolor ? matInterior : matFrontis), 1, anchoZocaloPerim, zH, t, 'Ninguna', {
        canto_L1: 0.5, canto_L2: 0.0, canto_A1: 0.5, canto_A2: 0.5
      }));
      // 2. Zócalo Posterior
      piezas.push(crearItemDespiece(modId, "Zócalo Posterior", matInterior, 1, anchoZocaloPerim, zH, t, 'Ninguna', {
        canto_L1: 0.0, canto_L2: 0.0, canto_A1: 0.0, canto_A2: 0.0
      }));
      // 3. Lateral Izquierdo de Zócalo (perímetro)
      piezas.push(crearItemDespiece(modId, "Zócalo Lateral Izquierdo", matInterior, 1, largoLatZocalo, zH, t, 'Ninguna', {
        canto_L1: 0.5, canto_L2: 0.0, canto_A1: 0.5, canto_A2: 0.0
      }));
      // 4. Lateral Derecho de Zócalo (perímetro)
      piezas.push(crearItemDespiece(modId, "Zócalo Lateral Derecho", matInterior, 1, largoLatZocalo, zH, t, 'Ninguna', {
        canto_L1: 0.5, canto_L2: 0.0, canto_A1: 0.5, canto_A2: 0.0
      }));

      // 5. Listones transversales interiores de soporte y refuerzo del zócalo
      const cantInternos = resolverCantListonesInternosZocalo(m);
      if (cantInternos > 0) {
        const largoTrans = m.profundidad - retransZocalo - (2 * t);
        if (largoTrans > 0) {
          piezas.push(crearItemDespiece(modId, "Zócalo Refuerzo Transversal Interior", matInterior, cantInternos, largoTrans, zH, t, 'Ninguna', {
            canto_L1: 0.0, canto_L2: 0.0, canto_A1: 0.0, canto_A2: 0.0
          }));
        }
      }
    }

    // Zócalo Superior (Frontal de melamina en todo el ancho interior)
    if (m.tiene_zocalo_sup && zSupH > 0) {
      piezas.push(crearItemDespiece(modId, "Frontal Zócalo Superior", (esUnicolor ? matInterior : matFrontis), 1, anchoInt, zSupH, t, 'Ninguna', {
        canto_L1: 0.5, canto_L2: 0.0, canto_A1: 0.5, canto_A2: 0.5
      }));
    }

    // Fondo Posterior (MDF o Melamina)
    if (tipoFondo === 'mdf') {
      if (posMdf === 'delante_liston') {
        const wMdf = anchoInt + (2 * profRanura) - 2;
        const hVanoPost = Math.max(0, hCarcasa - (tienePiso ? t : 0) - (tieneTecho ? t : 0));
        const hMdf = hVanoPost + (2 * profRanura) - 2;
        piezas.push(crearItemDespiece(modId, `Fondo Posterior MDF ${grosorMdf}mm Enranurado`, matMdfBase, 1, hMdf, wMdf, grosorMdf, `Incrustado en ranura ${anchoRanura}x${profRanura}mm a ${effDistRanura}mm`, {
          esMdf: true
        }));

        // NOTA: Los listones posteriores de amarre a pared ya se añadieron unificadamente en usaAmarresPost
      } else {
        // Sobrepuesto detrás del listón con las medidas completas del módulo
        piezas.push(crearItemDespiece(modId, `Fondo Posterior MDF ${grosorMdf}mm Sobrepuesto`, matMdfBase, 1, m.alto, m.ancho, grosorMdf, 'Sobrepuesto clavado', {
          esMdf: true
        }));
      }
    } else if (tipoFondo === 'melamina') {
      const hPisoEspLocal = tienePiso ? t : 0;
      const hTechoEspLocal = tieneTecho ? t : 0;
      const hVanoUtilLocal = Math.max(0, hCarcasa - hPisoEspLocal - hTechoEspLocal);
      const altoFondoMel = (m.alto_fondo_melamina !== null && m.alto_fondo_melamina !== undefined && parseFloat(m.alto_fondo_melamina) < hVanoUtilLocal)
        ? Math.max(80, Math.min(hVanoUtilLocal, parseFloat(m.alto_fondo_melamina)))
        : hVanoUtilLocal;

      const distFondoMel = (m.dist_fondo_melamina !== undefined) ? Math.max(0, parseFloat(m.dist_fondo_melamina)) : 0;

      piezas.push(crearItemDespiece(modId, altoFondoMel < hVanoUtilLocal
          ? `Fondo Posterior Melamina (${altoFondoMel}x${anchoInt}mm, Ajustado Sup.)`
          : "Fondo Posterior Melamina Embutido",
        matInterior, 1, altoFondoMel, anchoInt, t,
        `${distFondoMel > 0 ? `Retranqueado a ${distFondoMel}mm de pared` : 'Al borde posterior'}${altoFondoMel < hVanoUtilLocal ? ` (ajustado arriba, libre inf ${hVanoUtilLocal - altoFondoMel}mm)` : ''}`, {
          canto_L1: 0.5, canto_L2: 0.5, canto_A1: 0.5, canto_A2: 0.5
        }
      ));
    } else if (tipoFondo === 'panel' || (esModuloVacio && tieneFondo)) {
      const tieneListonesPared = (m.panel_tiene_listones_pared !== false && m.panel_tiene_listones_pared !== 'false');
      const cantPanelList = Math.max(1, Math.min(4, parseInt(m.cant_listones_panel) || 2));
      const hListonPanel = Math.max(20, parseFloat(m.medida_liston_panel) || 80);

      if (esModuloVacio) {
        // Fondo Panel Completo abarcando toda la dimensión
        piezas.push(crearItemDespiece(modId, `Fondo Panel Completo (${m.ancho}x${m.alto}mm)`, matFrontis, 1, m.alto, m.ancho, t, 'Ninguna (Abarca toda la dimensión)', {
          esMesaPuerta: true,
          canto_L1: 2.0, canto_L2: 2.0, canto_A1: 2.0, canto_A2: 2.0
        }));
      } else {
        const hPisoEspLocal = tienePiso ? t : 0;
        const hTechoEspLocal = tieneTecho ? t : 0;
        const hVanoUtilLocal = Math.max(0, hCarcasa - hPisoEspLocal - hTechoEspLocal);
        piezas.push(crearItemDespiece(modId, `Fondo Panel Melamina (${anchoInt}x${hVanoUtilLocal}mm)`, matInterior, 1, hVanoUtilLocal, anchoInt, t, 'Ninguna', {
          canto_L1: 0.5, canto_L2: 0.5, canto_A1: 0.5, canto_A2: 0.5
        }));
      }

      // Listones posteriores atornillados a pared
      if (tieneListonesPared) {
        const largoListonPanel = esModuloVacio ? Math.max(50, m.ancho - 60) : anchoInt;
        piezas.push(crearItemDespiece(modId, `Listón Posterior Anclaje a Pared (x${cantPanelList})`, matInterior, cantPanelList, largoListonPanel, hListonPanel, t, 'Atornillado a pared', {
          canto_L1: 0.5, canto_L2: 0.5, canto_A1: 0.5, canto_A2: 0.5
        }));
      }
    }

    // Parantes y Repisas Interiores por Espacio
    if (m.tipo_interior === 'repisas') {
      const geo = calcularDivisionesYEspaciosModulo(m, t);

      // Piezas de Parantes Principales
      geo.parantes.forEach((p, pIdx) => {
        const esV = (geo.limites.tipo === 'vertical');
        piezas.push(crearItemDespiece(modId, `Parante ${esV ? 'Vertical' : 'Horizontal'} ${pIdx + 1}`, matInterior, 1, esV ? p.dz : p.dx, p.dy, t, 'Ninguna', {
          canto_L1: 2.0, canto_L2: 0.5, canto_A1: 0.5, canto_A2: 0.5
        }));
      });

      // Piezas de Sub-Parantes y Repisas por cada Espacio
      geo.espacios.forEach((esp) => {
        if (Array.isArray(esp.subParantes) && esp.subParantes.length > 0) {
          esp.subParantes.forEach((sp, spIdx) => {
            const esV = (sp.tipo === 'vertical');
            piezas.push(crearItemDespiece(modId, `${esp.nombre} Sub-Parante ${esV ? 'Vertical' : 'Horizontal'} ${spIdx + 1}`, matInterior, 1, esV ? sp.dz : sp.dx, sp.dy, t, 'Ninguna', {
              canto_L1: 2.0, canto_L2: 0.5, canto_A1: 0.5, canto_A2: 0.5
            }));
          });
        }

        if (esp.repisas.length > 0) {
          esp.repisas.forEach((rep, rIdx) => {
            piezas.push(crearItemDespiece(modId, `Repisa ${esp.nombre} R${rIdx + 1}${rep.subVanoIndex !== undefined ? ` (Sub-vano ${rep.subVanoIndex + 1})` : ''}`, matInterior, 1, rep.ancho, rep.prof, t, 'Ninguna', {
              canto_L1: 2.0, canto_L2: 0.0, canto_A1: 0.5, canto_A2: 0.5
            }));
          });
        }
      });
    }

    // Piezas de Cajonera Industrial Completa (Laterales, Contrafrente, Trasera, Fondo MDF 3mm y Correderas)
    if (m.tipo_interior === 'cajonera') {
      const cantCaj = Math.max(2, parseInt(m.cant_cajones) || 3);
      const montajeCaj = m.cajones_montaje || 'exterior';
      const tipoCorr = m.cajones_tipo_corredera || 'telescopica';
      const posCorr = m.cajones_posicion_corredera || 'baja';
      const luzCaj = (m.cajones_luz !== undefined && m.cajones_luz !== null) ? parseFloat(m.cajones_luz) : (AppState.luzFrentes || 3.0);
      const tCaja = 15.0; // melamina 15mm para gaveta interna

      const descCorr = (tipoCorr === 'oculta') ? 21.0 : (tipoCorr === 'metalica' ? 37.5 : 26.0);
      const wExtCaja = Math.max(80, anchoInt - descCorr);
      const wIntCaja = Math.max(50, wExtCaja - (2 * tCaja));

      const maxSlide = profCarcasa - 30;
      let largoSlide = 450;
      const stdSlides = [250, 300, 350, 400, 450, 500, 550, 600];
      if (m.cajones_largo_corredera && m.cajones_largo_corredera !== 'auto') {
        largoSlide = Math.min(maxSlide, parseFloat(m.cajones_largo_corredera) || 450);
      } else {
        largoSlide = 250;
        for (let s of stdSlides) {
          if (s <= maxSlide) largoSlide = s;
        }
      }

      const hVanoUtilCaj = Math.max(0, hCarcasa - (tienePiso ? t : 0) - (tieneTecho ? t : 0));
      let altoFrente = 0, anchoFrente = 0;
      if (montajeCaj === 'exterior') {
        altoFrente = (hCarcasa - ((cantCaj + 1) * luzCaj)) / cantCaj;
        anchoFrente = tieneLaterales ? (m.ancho - (2 * luzCaj)) : (anchoInt - (2 * luzCaj));
      } else {
        altoFrente = (hVanoUtilCaj - ((cantCaj + 1) * luzCaj)) / cantCaj;
        anchoFrente = anchoInt - (2 * luzCaj);
      }
      const altoCaja = Math.max(60, Math.min(260, Math.round(altoFrente - 42)));

      for (let c = 0; c < cantCaj; c++) {
        // 1. Frente de cajón
        piezas.push(crearItemDespiece(modId, `Frente Cajón ${c + 1} (${montajeCaj === 'exterior' ? 'Sobrepuesto' : 'Embutido'})`, (m.material_frentes || matFrontis), 1, Math.round(anchoFrente), Math.round(altoFrente), t, `Tirador central, montaje ${montajeCaj}`, {
          esMesaPuerta: true
        }));

        if (tipoCorr !== 'metalica') {
          // 2. Laterales de gaveta (x2)
          piezas.push(crearItemDespiece(modId, `Laterales Gaveta Cajón ${c + 1} (x2)`, 'Melamina Blanca 15mm', 2, largoSlide, altoCaja, tCaja, `Ranura Fondo 3mm a 12mm de la base (${tipoCorr}, pos: ${posCorr})`, {
            canto_L1: 0.5, canto_L2: 0.0, canto_A1: 0.0, canto_A2: 0.0
          }));
          // 3. Contrafrente
          piezas.push(crearItemDespiece(modId, `Contrafrente Gaveta Cajón ${c + 1}`, 'Melamina Blanca 15mm', 1, Math.round(wIntCaja), altoCaja, tCaja, 'Ranura Fondo 3mm a 12mm de la base', {
            canto_L1: 0.5, canto_L2: 0.0, canto_A1: 0.0, canto_A2: 0.0
          }));
          // 4. Trasera
          piezas.push(crearItemDespiece(modId, `Trasera Gaveta Cajón ${c + 1}`, 'Melamina Blanca 15mm', 1, Math.round(wIntCaja), altoCaja, tCaja, 'Ranura Fondo 3mm a 12mm de la base', {
            canto_L1: 0.5, canto_L2: 0.0, canto_A1: 0.0, canto_A2: 0.0
          }));
          // 5. Fondo MDF 3mm
          piezas.push(crearItemDespiece(modId, `Fondo MDF 3mm Cajón ${c + 1}`, matMdfBase, 1, largoSlide - 4, Math.round(wExtCaja) - 4, 3, 'Incrustado en ranura 3x8mm', {
            esMdf: true
          }));
        }
      }

      // Herraje Corredera
      piezas.push({
        item: itemNum++, modulo: modId, pieza: `Juego Correderas ${tipoCorr.toUpperCase()} ${largoSlide}mm (x${cantCaj} pares)`,
        material: 'Herraje Mecánico / Acero', cant: cantCaj,
        largo_bruto: largoSlide, ancho_bruto: descCorr, espesor: 12,
        largo_neto: largoSlide, ancho_neto: descCorr,
        canto_L1: '0.0', canto_L2: '0.0', canto_A1: '0.0', canto_A2: '0.0',
        color_tapacanto: 'Sin tapacanto',
        ranura: `Posición: ${posCorr} (descuento lateral: ${descCorr}mm)`
      });
    }

    // Piezas de Puertas Frontales (Independiente del equipamiento interior)
    const tienePuertas = !!(m.tiene_puertas || m.tipo_interior === 'puertas');
    if (tienePuertas) {
      const montajeP = m.puertas_montaje || 'exterior';
      const posicionP = m.puertas_posicion_bisagra || m.puertas_apertura || ((m.ancho > 600) ? 'doble' : 'derecha');
      const luzP = (m.puertas_luz !== undefined && m.puertas_luz !== null) ? parseFloat(m.puertas_luz) : (AppState.luzFrentes || 3.0);
      const cantHojas = (posicionP === 'doble') ? 2 : 1;

      let altoP = 0, anchoP = 0;
      if (montajeP === 'exterior') {
        altoP = hCarcasa - (2 * luzP);
        anchoP = (cantHojas === 2) ? ((m.ancho - (3 * luzP)) / 2.0) : (m.ancho - (2 * luzP));
      } else if (montajeP === 'medio') {
        altoP = hCarcasa - (2 * luzP);
        anchoP = (cantHojas === 2) ? ((anchoInt + (2 * t) - (3 * luzP)) / 2.0) : (anchoInt + t - (2 * luzP));
      } else { // interior
        const hVanoUtilP = Math.max(0, hCarcasa - (tienePiso ? t : 0) - (tieneTecho ? t : 0));
        altoP = hVanoUtilP - (2 * luzP);
        anchoP = (cantHojas === 2) ? ((anchoInt - (3 * luzP)) / 2.0) : (anchoInt - (2 * luzP));
      }

      const bisInfo = calcularBisagrasPuerta(m, altoP, anchoP);
      const specRanuraBis = `Perforación: ${bisInfo.cantBis} cazoletas Ø35x11.5mm (K=4.5mm) - ${bisInfo.tipoBisagra} [Bisagras ${bisInfo.posicion}]`;

      // Detección de parante vertical para alinear el encuentro de cierre al centro del parante
      let xCentroParante = null;
      if (m.tipo_interior === 'repisas' && m.parantes_tipo === 'vertical' && Array.isArray(m.parantes) && m.parantes.length === 1) {
        const geo = (typeof calcularDivisionesYEspaciosModulo === 'function') ? calcularDivisionesYEspaciosModulo(m, t) : null;
        if (geo && geo.parantes && geo.parantes[0]) {
          xCentroParante = (tieneLaterales ? t : 0) + geo.parantes[0].posicion + (t / 2);
        }
      }

      for (let p = 0; p < cantHojas; p++) {
        let anchoHojaP = anchoP;
        if (cantHojas === 2 && xCentroParante !== null) {
          if (montajeP === 'interior') {
            anchoHojaP = (p === 0)
              ? (xCentroParante - t - 1.5 * luzP)
              : (m.ancho - t - xCentroParante - 1.5 * luzP);
          } else {
            anchoHojaP = (p === 0)
              ? (xCentroParante - 1.5 * luzP)
              : (m.ancho - xCentroParante - 1.5 * luzP);
          }
        }

        const nomPuerta = (cantHojas === 2)
          ? `Puerta Hoja ${p + 1} (${p === 0 ? 'Izq' : 'Der'}${xCentroParante !== null ? ' -> Cierre a Parante Central' : ''})`
          : `Puerta (${posicionP})`;

        piezas.push(crearItemDespiece(modId, nomPuerta, (m.material_frentes || matFrontis), 1, Math.round(altoP), Math.round(anchoHojaP), t, specRanuraBis, {
          esMesaPuerta: true,
          esPuerta: true,
          cantBisagras: bisInfo.cantBis,
          posicionBisagras: posicionP,
          bisagrasInfo: bisInfo
        }));
      }

      // Listón de tope interior de puerta
      const listonTope = m.puertas_liston_tope || 'ninguno';
      if (listonTope === 'superior' || listonTope === 'ambos') {
        piezas.push(crearItemDespiece(modId, "Listón de Tope Superior Puerta", matInterior, 1, anchoInt, 40, t, 'Ninguna', {
          canto_L1: 0.5, canto_L2: 0.0, canto_A1: 0.5, canto_A2: 0.5
        }));
      }
      if (listonTope === 'inferior' || listonTope === 'ambos') {
        piezas.push(crearItemDespiece(modId, "Listón de Tope Inferior Puerta", matInterior, 1, anchoInt, 40, t, 'Ninguna', {
          canto_L1: 0.5, canto_L2: 0.0, canto_A1: 0.5, canto_A2: 0.5
        }));
      }
    }
  });

  AppState.despieceActual = piezas;
  renderizarTablaDespiece(piezas);
}

/**
 * Retorna la clase CSS de color para el selector de canto según su espesor.
 */
function obtenerClaseColorCanto(val) {
  const f = parseFloat(val) || 0.0;
  if (f === 0) return 'canto-cero';
  if (f <= 0.5) return 'canto-delgado';
  if (f <= 1.0) return 'canto-medio';
  return 'canto-grueso';
}

/**
 * Formatea una medida milimétrica limpia (entero si es exacto, 1 decimal si no).
 */
function formatearMedida(num) {
  const n = parseFloat(num) || 0;
  return (n % 1 === 0) ? n.toFixed(0) : n.toFixed(1);
}

/**
 * Renderiza la tabla HTML interactiva de despiece con medidas brutas, netas, tapacantos y colores asociados.
 */
function renderizarTablaDespiece(piezas) {
  const tbody = document.getElementById('tablaDespieceBody');
  if (!tbody) return;

  if (!piezas || piezas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 20px;">No hay piezas registradas en el despiece.</td></tr>`;
    return;
  }

  let html = '';
  piezas.forEach(p => {
    const badgeColorCanto = formatearBadgeColorCanto(p);

    html += `
      <tr id="fila-pieza-${p.item}">
        <td><strong>${p.item}</strong></td>
        <td><span class="badge badge-info">${p.modulo}</span></td>
        <td><strong>${p.pieza}</strong></td>
        <td style="font-size: 10px;">${p.material}</td>
        <td style="text-align: center;"><strong>${p.cant}</strong></td>
        <td style="white-space: nowrap;">${formatearMedida(p.largo_bruto)} × ${formatearMedida(p.ancho_bruto)} mm</td>
        <td id="celda-medida-neta-${p.item}" class="medida-neta-cell" title="Medida neta exacta de corte en sierra (diseño final menos tapacantos)">
          <strong>${formatearMedida(p.largo_neto)}</strong> × <strong>${formatearMedida(p.ancho_neto)}</strong> mm
        </td>
        <td style="text-align: center;">${p.espesor} mm</td>
        <td>
          <div class="canto-picker-group">
            <label class="canto-cell-tag" title="L1: Largo Frontal o Superior">
              <span>L1:</span>
              <select class="canto-select-mini ${obtenerClaseColorCanto(p.canto_L1)}" onchange="onEditarCantoPieza(${p.item}, 'L1', this.value)">
                <option value="0.0" ${parseFloat(p.canto_L1) === 0 ? 'selected' : ''}>0</option>
                <option value="0.5" ${parseFloat(p.canto_L1) === 0.5 ? 'selected' : ''}>0.5</option>
                <option value="1.0" ${parseFloat(p.canto_L1) === 1.0 ? 'selected' : ''}>1.0</option>
                <option value="2.0" ${parseFloat(p.canto_L1) === 2.0 ? 'selected' : ''}>2.0</option>
              </select>
            </label>
            <label class="canto-cell-tag" title="L2: Largo Posterior o Inferior">
              <span>L2:</span>
              <select class="canto-select-mini ${obtenerClaseColorCanto(p.canto_L2)}" onchange="onEditarCantoPieza(${p.item}, 'L2', this.value)">
                <option value="0.0" ${parseFloat(p.canto_L2) === 0 ? 'selected' : ''}>0</option>
                <option value="0.5" ${parseFloat(p.canto_L2) === 0.5 ? 'selected' : ''}>0.5</option>
                <option value="1.0" ${parseFloat(p.canto_L2) === 1.0 ? 'selected' : ''}>1.0</option>
                <option value="2.0" ${parseFloat(p.canto_L2) === 2.0 ? 'selected' : ''}>2.0</option>
              </select>
            </label>
            <label class="canto-cell-tag" title="A1: Ancho Lateral 1">
              <span>A1:</span>
              <select class="canto-select-mini ${obtenerClaseColorCanto(p.canto_A1)}" onchange="onEditarCantoPieza(${p.item}, 'A1', this.value)">
                <option value="0.0" ${parseFloat(p.canto_A1) === 0 ? 'selected' : ''}>0</option>
                <option value="0.5" ${parseFloat(p.canto_A1) === 0.5 ? 'selected' : ''}>0.5</option>
                <option value="1.0" ${parseFloat(p.canto_A1) === 1.0 ? 'selected' : ''}>1.0</option>
                <option value="2.0" ${parseFloat(p.canto_A1) === 2.0 ? 'selected' : ''}>2.0</option>
              </select>
            </label>
            <label class="canto-cell-tag" title="A2: Ancho Lateral 2">
              <span>A2:</span>
              <select class="canto-select-mini ${obtenerClaseColorCanto(p.canto_A2)}" onchange="onEditarCantoPieza(${p.item}, 'A2', this.value)">
                <option value="0.0" ${parseFloat(p.canto_A2) === 0 ? 'selected' : ''}>0</option>
                <option value="0.5" ${parseFloat(p.canto_A2) === 0.5 ? 'selected' : ''}>0.5</option>
                <option value="1.0" ${parseFloat(p.canto_A2) === 1.0 ? 'selected' : ''}>1.0</option>
                <option value="2.0" ${parseFloat(p.canto_A2) === 2.0 ? 'selected' : ''}>2.0</option>
              </select>
            </label>
          </div>
        </td>
        <td id="celda-color-canto-${p.item}">${badgeColorCanto}</td>
        <td>${p.ranura || 'Ninguna'}</td>
        <td style="text-align: center;">
          <button type="button" class="btn-canto-action" onclick="onQuitarCantosPieza(${p.item})" title="Quitar todos los cantos de esta pieza (0.0mm)">🚫</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  actualizarResumenMetricasDespiece();
}

/**
 * Actualiza los badges de resumen métrico de metros de cantos y totales de piezas.
 */
function actualizarResumenMetricasDespiece() {
  const piezas = AppState.despieceActual || [];
  let totalMetrosGrueso = 0;
  let totalMetrosMedio = 0;
  let totalMetrosDelgado = 0;
  let totalPiezas = 0;

  piezas.forEach(p => {
    const cant = parseInt(p.cant) || 1;
    totalPiezas += cant;

    const lM = (parseFloat(p.largo_bruto) || 0) / 1000.0;
    const aM = (parseFloat(p.ancho_bruto) || 0) / 1000.0;

    [p.canto_L1, p.canto_L2].forEach(c => {
      const v = parseFloat(c) || 0;
      if (v >= 2.0) totalMetrosGrueso += (lM * cant);
      else if (v >= 1.0) totalMetrosMedio += (lM * cant);
      else if (v >= 0.5) totalMetrosDelgado += (lM * cant);
    });
    [p.canto_A1, p.canto_A2].forEach(c => {
      const v = parseFloat(c) || 0;
      if (v >= 2.0) totalMetrosGrueso += (aM * cant);
      else if (v >= 1.0) totalMetrosMedio += (aM * cant);
      else if (v >= 0.5) totalMetrosDelgado += (aM * cant);
    });
  });

  // Actualizar badges
  const bGrueso = document.getElementById('badgeMetrosGrueso');
  if (bGrueso) bGrueso.textContent = `Canto 2mm: ${totalMetrosGrueso.toFixed(1)} m`;

  const bMedio = document.getElementById('badgeMetrosMedio');
  if (bMedio) {
    if (totalMetrosMedio > 0) {
      bMedio.style.display = 'inline-block';
      bMedio.textContent = `Canto 1mm: ${totalMetrosMedio.toFixed(1)} m`;
    } else {
      bMedio.style.display = 'none';
    }
  }

  const bDelgado = document.getElementById('badgeMetrosDelgado');
  if (bDelgado) bDelgado.textContent = `Canto 0.5mm: ${totalMetrosDelgado.toFixed(1)} m`;

  const bTotal = document.getElementById('badgeTotalPiezas');
  if (bTotal) bTotal.textContent = `${totalPiezas} piezas`;

  const bModo = document.getElementById('badgeModoDespiece');
  if (bModo) {
    const m = AppState.modoTapacanto || 'estandar';
    if (m === 'estandar') bModo.textContent = 'Modo: Estándar Comercial';
    else if (m === 'economico') bModo.textContent = 'Modo: Económico (0.5mm)';
    else if (m === 'premium') bModo.textContent = 'Modo: Premium (2mm)';
    else bModo.textContent = 'Modo: Personalizado';
  }

  const bRH = document.getElementById('badgeDespieceRH');
  if (bRH) {
    if (AppState.resistencia === 'RH') {
      bRH.className = 'badge badge-success';
      bRH.style.background = '#059669';
      bRH.style.color = '#FFFFFF';
      bRH.textContent = '🛡️ Melamina RH Hidrófuga';
    } else {
      bRH.className = 'badge badge-normal';
      bRH.style.background = '';
      bRH.style.color = '';
      bRH.textContent = 'Tablero Estándar';
    }
  }
}

/**
 * Permite al usuario cambiar individualmente el tapacanto de un borde (L1, L2, A1, A2) de una pieza.
 * Recalcula en tiempo real la medida neta exacta de corte sin tapacantos.
 */
function onEditarCantoPieza(itemNum, lado, nuevoValor) {
  const piezas = AppState.despieceActual || [];
  const p = piezas.find(x => x.item === itemNum);
  if (!p) return;

  const valFloat = parseFloat(nuevoValor) || 0.0;
  p[`canto_${lado}`] = valFloat.toFixed(1);
  p[`canto_${lado}_manual`] = true;

  // Deducción milimétrica estricta de la medida de corte en máquina
  const cL1 = parseFloat(p.canto_L1) || 0;
  const cL2 = parseFloat(p.canto_L2) || 0;
  const cA1 = parseFloat(p.canto_A1) || 0;
  const cA2 = parseFloat(p.canto_A2) || 0;

  p.largo_neto = Math.round((p.largo_bruto - (cL1 + cL2)) * 10) / 10;
  p.ancho_neto = Math.round((anchoBruto => Math.round((anchoBruto - (cA1 + cA2)) * 10) / 10)(p.ancho_bruto));

  // Cambiar modo global a 'personalizado'
  AppState.modoTapacanto = 'personalizado';
  actualizarSelectoresModoTapacanto('personalizado');

  // Actualizar DOM de la celda de medida neta con animación de feedback
  const celdaNeta = document.getElementById(`celda-medida-neta-${p.item}`);
  if (celdaNeta) {
    celdaNeta.innerHTML = `<strong>${formatearMedida(p.largo_neto)}</strong> × <strong>${formatearMedida(p.ancho_neto)}</strong> mm`;
    celdaNeta.classList.remove('medida-neta-pulse');
    void celdaNeta.offsetWidth; // Forzar reflujo
    celdaNeta.classList.add('medida-neta-pulse');
  }

  // Actualizar badge de color de canto en la fila
  const celdaColor = document.getElementById(`celda-color-canto-${p.item}`);
  if (celdaColor) {
    celdaColor.innerHTML = formatearBadgeColorCanto(p);
  }

  // Actualizar resumen de metros
  actualizarResumenMetricasDespiece();
}

/**
 * Quita todos los tapacantos de una pieza específica (pone L1, L2, A1, A2 en 0.0mm).
 */
function onQuitarCantosPieza(itemNum) {
  const piezas = AppState.despieceActual || [];
  const p = piezas.find(x => x.item === itemNum);
  if (!p) return;

  p.canto_L1 = '0.0';
  p.canto_L2 = '0.0';
  p.canto_A1 = '0.0';
  p.canto_A2 = '0.0';
  p.canto_L1_manual = true;
  p.canto_L2_manual = true;
  p.canto_A1_manual = true;
  p.canto_A2_manual = true;

  p.largo_neto = p.largo_bruto;
  p.ancho_neto = p.ancho_bruto;

  AppState.modoTapacanto = 'personalizado';
  actualizarSelectoresModoTapacanto('personalizado');

  // Volver a renderizar para actualizar los selects de la fila
  renderizarTablaDespiece(piezas);
  mostrarNotificacion(`Pieza #${p.item} (${p.pieza}): Se quitaron todos los tapacantos. Medida neta de corte = ${p.largo_neto} × ${p.ancho_neto} mm`, 'info');
}

/**
 * Cambia el modo global de tapacantos ('estandar', 'economico', 'premium').
 */
function onCambiarModoTapacantos(nuevoModo) {
  if (!nuevoModo || nuevoModo === 'personalizado') return;

  AppState.modoTapacanto = nuevoModo;
  actualizarSelectoresModoTapacanto(nuevoModo);

  // Recalcular todas las piezas en despieceActual según el nuevo modo
  const piezas = AppState.despieceActual || [];
  if (piezas.length > 0) {
    const t = AppState.espesorMelamina;
    const esUnicolor = (AppState.esquemaColor === 'unicolor');
    const matFrontis = AppState.materialFrentes || 'Pelikano Blanco Nieve 18mm';
    const matInterior = AppState.materialEstructura || 'Pelikano Blanco Nieve 18mm';

    piezas.forEach(p => {
      // Limpiar banderas manuales para adoptar el nuevo modo global
      delete p.canto_L1_manual;
      delete p.canto_L2_manual;
      delete p.canto_A1_manual;
      delete p.canto_A2_manual;

      const tap = calcularTapacantosYMedidaNeta(p.pieza, p.largo_bruto, p.ancho_bruto, {
        esMdf: p.pieza.toLowerCase().includes('mdf')
      });
      p.canto_L1 = tap.canto_L1;
      p.canto_L2 = tap.canto_L2;
      p.canto_A1 = tap.canto_A1;
      p.canto_A2 = tap.canto_A2;
      p.largo_neto = tap.largo_neto;
      p.ancho_neto = tap.ancho_neto;
      p.color_tapacanto = tap.desc_color_tapacanto;
      p.color_canto_L1 = tap.color_canto_L1;
      p.color_canto_otros = tap.color_canto_otros;
    });

    renderizarTablaDespiece(piezas);
  }

  const descModo = (nuevoModo === 'economico')
    ? 'Económico (Todo Delgado 0.5mm y 0mm en piezas internas)'
    : (nuevoModo === 'premium')
      ? 'Premium (Frentes 2mm y máxima protección perimetral)'
      : 'Estándar (Frentes 2mm e Interiores 0.5mm)';

  mostrarNotificacion(`📐 Modo de Tapacantos aplicado: ${descModo}`, 'success');
}

/**
 * Restablece los cantos de todas las piezas al modo activo configurado.
 */
function onRestablecerModoTapacantos() {
  const modo = AppState.modoTapacanto === 'personalizado' ? 'estandar' : (AppState.modoTapacanto || 'estandar');
  onCambiarModoTapacantos(modo);
}

/**
 * Pone todos los tapacantos de todas las piezas en 0.0mm.
 * La medida neta de corte es exactamente igual a la medida bruta de diseño.
 */
function onQuitarTodosLosTapacantos() {
  const piezas = AppState.despieceActual || [];
  if (!piezas || piezas.length === 0) return;

  piezas.forEach(p => {
    p.canto_L1 = '0.0';
    p.canto_L2 = '0.0';
    p.canto_A1 = '0.0';
    p.canto_A2 = '0.0';
    p.canto_L1_manual = true;
    p.canto_L2_manual = true;
    p.canto_A1_manual = true;
    p.canto_A2_manual = true;
    p.largo_neto = p.largo_bruto;
    p.ancho_neto = p.ancho_bruto;
    p.color_tapacanto = 'Sin tapacanto';
  });

  AppState.modoTapacanto = 'personalizado';
  actualizarSelectoresModoTapacanto('personalizado');
  renderizarTablaDespiece(piezas);
  mostrarNotificacion('🚫 Se quitaron todos los tapacantos de todas las piezas. Las medidas netas son ahora idénticas a las brutas de corte.', 'warning');
}

/**
 * Mantiene sincronizados los selectores y badges del DOM para el modo de tapacanto.
 */
function actualizarSelectoresModoTapacanto(modo) {
  const sPaso3 = document.getElementById('selectModoTapacantosPaso3');
  if (sPaso3) {
    if (modo === 'personalizado') {
      let optPers = sPaso3.querySelector('option[value="personalizado"]');
      if (optPers) optPers.disabled = false;
    }
    sPaso3.value = modo;
  }

  const sModal = document.getElementById('selectModoTapacantosModal');
  if (sModal) {
    if (modo === 'personalizado') {
      let optPersM = sModal.querySelector('option[value="personalizado"]');
      if (optPersM) optPersM.disabled = false;
    }
    sModal.value = modo;
  }

  const bPaso3 = document.getElementById('badgeModoTapacantosPaso3');
  if (bPaso3) {
    if (modo === 'economico') {
      bPaso3.className = 'badge badge-info';
      bPaso3.textContent = 'Económico (0.5mm)';
    } else if (modo === 'premium') {
      bPaso3.className = 'badge badge-warning';
      bPaso3.textContent = 'Premium (2.0mm)';
    } else if (modo === 'personalizado') {
      bPaso3.className = 'badge badge-secondary';
      bPaso3.textContent = 'Personalizado';
    } else {
      bPaso3.className = 'badge badge-primary';
      bPaso3.textContent = 'Estándar (Frentes 2mm)';
    }
  }

  const bModoDespiece = document.getElementById('badgeModoDespiece');
  if (bModoDespiece) {
    if (modo === 'economico') bModoDespiece.textContent = 'Modo: Económico (0.5mm)';
    else if (modo === 'premium') bModoDespiece.textContent = 'Modo: Premium (2mm)';
    else if (modo === 'personalizado') bModoDespiece.textContent = 'Modo: Personalizado';
    else bModoDespiece.textContent = 'Modo: Estándar Comercial';
  }
}

/**
 * Receptor de SketchUp para la extracción oficial de piezas.
 */
window.onDespieceExtraido = function(datos) {
  if (datos && datos.piezas && Array.isArray(datos.piezas) && datos.piezas.length > 0) {
    AppState.despieceActual = datos.piezas.map((p, idx) => ({
      item: idx + 1,
      modulo: p.modulo_id || 'M1',
      pieza: p.nombre || p.pieza_nombre || `Pieza ${idx + 1}`,
      material: p.material || AppState.materialEstructura,
      cant: p.cantidad || 1,
      largo_bruto: Math.round(p.largo_bruto || 0),
      ancho_bruto: Math.round(p.ancho_bruto || 0),
      espesor: p.espesor || AppState.espesorMelamina,
      largo_neto: p.largo_neto !== undefined ? p.largo_neto : Math.round(p.largo_bruto || 0),
      ancho_neto: p.ancho_neto !== undefined ? p.ancho_neto : Math.round(p.ancho_bruto || 0),
      canto_L1: (p.canto_L1 !== undefined ? parseFloat(p.canto_L1) : 0.0).toFixed(1),
      canto_L2: (p.canto_L2 !== undefined ? parseFloat(p.canto_L2) : 0.0).toFixed(1),
      canto_A1: (p.canto_A1 !== undefined ? parseFloat(p.canto_A1) : 0.0).toFixed(1),
      canto_A2: (p.canto_A2 !== undefined ? parseFloat(p.canto_A2) : 0.0).toFixed(1),
      color_tapacanto: p.color_tapacanto || AppState.materialEstructura,
      ranura: p.ranura || 'Ninguna'
    }));
    renderizarTablaDespiece(AppState.despieceActual);
  }
};

function formatearBadgeColorCanto(p) {
  if (p.canto_L1 === '0.0' && p.canto_L2 === '0.0' && p.canto_A1 === '0.0' && p.canto_A2 === '0.0') {
    return `<span style="color: var(--text-muted); font-size: 10px;">—</span>`;
  }
  const esUnicolor = (AppState.esquemaColor === 'unicolor');
  if (esUnicolor) {
    return `<span class="badge" style="background: rgba(59, 130, 246, 0.1); color: var(--primary); font-size: 9px; font-weight: 600;">${p.color_tapacanto || AppState.materialEstructura}</span>`;
  }
  // Bicolor
  if (p.color_canto_L1 && p.color_canto_otros && p.color_canto_L1 !== p.color_canto_otros) {
    return `
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: var(--primary); font-size: 8.5px; font-weight: 700;">
          L1 Frontal: ${p.color_canto_L1}
        </span>
        <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #059669; font-size: 8.5px;">
          Otros: ${p.color_canto_otros}
        </span>
      </div>
    `;
  }
  return `<span class="badge" style="background: rgba(59, 130, 246, 0.1); color: var(--primary); font-size: 9px; font-weight: 600;">${p.color_tapacanto || AppState.materialFrentes}</span>`;
}

// ==============================================================================
// 11. SISTEMA DE NOTIFICACIONES TOAST (PrimeNG UI)
// ==============================================================================

/**
 * Muestra una notificación emergente tipo PrimeNG Toast.
 * @param {string} mensaje - Texto del mensaje.
 * @param {string} tipo - 'info', 'success', 'warning', 'error'
 */
function mostrarNotificacion(mensaje, tipo = 'info') {
  const container = document.getElementById('notificationArea');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `p-toast p-toast-${tipo}`;
  toast.innerHTML = `
    <span class="p-toast-icon">${tipo === 'success' ? '✓' : tipo === 'warning' ? '⚠' : tipo === 'error' ? '✕' : 'ℹ'}</span>
    <span class="p-toast-message">${mensaje}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('p-toast-fadeout');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3500);
}
