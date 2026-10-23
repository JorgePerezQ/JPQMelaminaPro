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

  // 2. Configuración Base de Melamina y Fabricación
  espesorMelamina: 18, // 15, 18, 36 mm
  materialEstructura: 'Pelikano Blanco Nieve 18mm',
  materialFrentes: 'Pelikano Blanco Nieve 18mm',
  resistencia: 'Normal', // 'Normal' o 'RH'
  cantidadModulos: 0,

  // 3. Colección de Módulos Paramétricos
  moduloActivoIndex: 0,
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

  // Inicializar el motor Canvas 3D con callback de selección de módulo
  if (window.Preview3D) {
    Preview3D.init('preview3DCanvas', (indexClickeado) => {
      seleccionarPestanaModulo(indexClickeado);
    });
  }

  // Escuchar redimensionamiento para refrescar el canvas
  window.addEventListener('resize', () => {
    if (window.Preview3D && window.Preview3D.resize) {
      window.Preview3D.resize();
    }
  });

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

  // Si no hay dimensiones completas, vuelve a estado 'vacio'
  if (w <= 0 || h <= 0 || d <= 0) {
    AppState.estadoVisualizador = 'vacio';
    actualizarCanvas();
    actualizarBadgeEstado();
    return;
  }

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

/**
 * Aplica un preset antropométrico rápido de mobiliario estandarizado.
 * @param {string} tipo - 'bajo_cocina', 'aereo_cocina', 'ropero', 'librero'
 */
function aplicarPresetMobiliario(tipo) {
  let w = 2400, h = 2100, d = 600;

  switch (tipo) {
    case 'bajo_cocina':
      w = 1800; h = 850; d = 600;
      break;
    case 'aereo_cocina':
      w = 1800; h = 700; d = 320;
      break;
    case 'ropero':
      w = 2400; h = 2200; d = 600;
      break;
    case 'librero':
      w = 1200; h = 1800; d = 300;
      break;
  }

  document.getElementById('dimAnchoTotal').value = w;
  document.getElementById('dimAltoTotal').value = h;
  document.getElementById('dimProfTotal').value = d;

  onDimensionesGeneralesChange();
}

/**
 * Limpia los campos y regresa al estado inicial vacío.
 */
function reiniciarAEstadoVacio() {
  document.getElementById('dimAnchoTotal').value = '';
  document.getElementById('dimAltoTotal').value = '';
  document.getElementById('dimProfTotal').value = '';
  document.getElementById('inputCantModulos').value = '0';

  AppState.anchoTotal = 0;
  AppState.altoTotal = 0;
  AppState.profTotal = 0;
  AppState.cantidadModulos = 0;
  AppState.modulos = [];
  AppState.estadoVisualizador = 'vacio';

  renderizarPestanasModulos();
  actualizarBadgeEstado();
  actualizarCanvas();
  mostrarNotificacion("Espacio reiniciado a estado vacío.", "info");
}

// ==============================================================================
// 4. PASO 2: CONFIGURACIÓN DE MELAMINA Y CANTIDAD DE MÓDULOS
// ==============================================================================

/**
 * Actualiza el espesor de la melamina (15mm o 18mm estándar).
 */
function onEspesorMelaminaChange() {
  const selEspesor = document.getElementById('dimEspesorMelamina');
  AppState.espesorMelamina = parseFloat(selEspesor.value) || 18;
  actualizarCanvas();
  validarTodosLosModulos();
}

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
    AppState.estadoVisualizador = 'delineado';
    renderizarPestanasModulos();
    actualizarBadgeEstado();
    actualizarCanvas();
    return;
  }

  AppState.cantidadModulos = numModulos;

  // Generar o ajustar array de módulos
  const nuevosModulos = [];
  const anchoBase = Math.floor(AppState.anchoTotal / numModulos);
  const remanente = AppState.anchoTotal - (anchoBase * numModulos);

  for (let i = 0; i < numModulos; i++) {
    const anchoEste = (i === numModulos - 1) ? (anchoBase + remanente) : anchoBase;

    // Si ya existía el módulo, conservar sus preferencias
    const modPrevio = AppState.modulos[i];

    nuevosModulos.push({
      id: i + 1,
      nombre: `Módulo ${i + 1}`,
      ancho: anchoEste,
      alto: modPrevio ? modPrevio.alto : AppState.altoTotal,
      profundidad: modPrevio ? modPrevio.profundidad : AppState.profTotal,
      tiene_zocalo: modPrevio ? modPrevio.tiene_zocalo : true,
      alto_zocalo: modPrevio ? modPrevio.alto_zocalo : 100,
      cant_listones: modPrevio ? modPrevio.cant_listones : 2,

      // Listones independientes para parte posterior y techo
      tiene_liston_post: modPrevio ? (modPrevio.tiene_liston_post !== undefined ? modPrevio.tiene_liston_post : (modPrevio.tiene_liston_amarre && (modPrevio.posicion_liston_amarre === 'posterior' || modPrevio.posicion_liston_amarre === 'ambos'))) : false,
      cant_listones_post: modPrevio ? (modPrevio.cant_listones_post || modPrevio.cant_listones_amarre || 2) : 2,
      medida_liston_post: modPrevio ? (modPrevio.medida_liston_post || modPrevio.alto_liston_amarre || 80) : 80,

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

      tiene_fondo_mdf: modPrevio ? (modPrevio.tiene_fondo_mdf !== false) : true,
      posicion_fondo_mdf: modPrevio ? modPrevio.posicion_fondo_mdf : 'delante_liston',
      tipo_interior: modPrevio ? modPrevio.tipo_interior : 'carcasa',
      cant_repisas: modPrevio ? (modPrevio.cant_repisas || 0) : 0,
      cant_cajones: modPrevio ? modPrevio.cant_cajones : 3,
      material_frentes: AppState.materialFrentes,

      // Configuración de fondo posterior y descuentos
      tipo_fondo: modPrevio ? (modPrevio.tipo_fondo || (modPrevio.tiene_fondo_mdf !== false ? 'mdf' : 'ninguno')) : 'mdf',
      posicion_fondo_melamina: modPrevio ? (modPrevio.posicion_fondo_melamina || 'embutido') : 'embutido',

      // Parantes y división de espacios interiores
      parantes_tipo: modPrevio ? (modPrevio.parantes_tipo || 'ninguno') : 'ninguno',
      parantes: modPrevio && Array.isArray(modPrevio.parantes) ? JSON.parse(JSON.stringify(modPrevio.parantes)) : [],
      espacios_repisas: modPrevio && Array.isArray(modPrevio.espacios_repisas) ? JSON.parse(JSON.stringify(modPrevio.espacios_repisas)) : []
    });
  }

  AppState.modulos = nuevosModulos;
  AppState.moduloActivoIndex = Math.min(AppState.moduloActivoIndex, numModulos - 1);
  AppState.estadoVisualizador = 'modulos';

  renderizarPestanasModulos();
  actualizarFormularioModuloActivo();
  actualizarBadgeEstado();
  actualizarCanvas();
  mostrarNotificacion(`Composición armada: ${numModulos} módulos configurados.`, "success");
}

/**
 * Divide el Ancho Total exactamente en partes iguales entre los módulos activos.
 */
function equilibrarAnchosModulos() {
  const numModulos = AppState.modulos.length;
  if (numModulos <= 0) return;

  const anchoBase = Math.floor(AppState.anchoTotal / numModulos);
  const remanente = AppState.anchoTotal - (anchoBase * numModulos);

  AppState.modulos.forEach((m, idx) => {
    m.ancho = (idx === numModulos - 1) ? (anchoBase + remanente) : anchoBase;
  });

  renderizarPestanasModulos();
  actualizarFormularioModuloActivo();
  actualizarCanvas();
  mostrarNotificacion("Anchos equilibrados equitativamente.", "info");
}

/**
 * Redistribuye el ancho total cuando cambia la cota global del mueble.
 */
function distribuirAnchoTotalEnModulos() {
  const numModulos = AppState.modulos.length;
  if (numModulos <= 0) return;

  const sumaActual = AppState.modulos.reduce((acc, m) => acc + m.ancho, 0);
  if (sumaActual <= 0) {
    equilibrarAnchosModulos();
    return;
  }

  let acumulado = 0;
  for (let i = 0; i < numModulos; i++) {
    if (i === numModulos - 1) {
      AppState.modulos[i].ancho = Math.max(150, AppState.anchoTotal - acumulado);
    } else {
      const fraccion = AppState.modulos[i].ancho / sumaActual;
      const nuevoW = Math.max(150, Math.round(AppState.anchoTotal * fraccion));
      AppState.modulos[i].ancho = nuevoW;
      acumulado += nuevoW;
    }
  }

  renderizarPestanasModulos();
  actualizarFormularioModuloActivo();
}

// ==============================================================================
// 5. PASO 3: PESTAÑAS DE MÓDULOS & RECÁLCULO DINÁMICO DE ANCHOS
// ==============================================================================

/**
 * Renderiza la barra de pestañas horizontales [ Módulo 1 ] [ Módulo 2 ] ...
 */
function renderizarPestanasModulos() {
  const container = document.getElementById('moduleTabsHeader');
  const cardConfig = document.getElementById('cardConfigModulo');
  if (!container) return;

  if (AppState.modulos.length === 0) {
    container.innerHTML = `<span class="text-muted" style="font-size: 11px;">Configure cantidad de módulos en el Paso 2 para habilitar las pestañas.</span>`;
    if (cardConfig) cardConfig.style.display = 'none';
    return;
  }

  if (cardConfig) cardConfig.style.display = 'block';

  let html = '';
  AppState.modulos.forEach((m, idx) => {
    const esActivo = (idx === AppState.moduloActivoIndex);
    html += `
      <button type="button" class="module-tab-btn ${esActivo ? 'active' : ''}" onclick="seleccionarPestanaModulo(${idx})">
        <span>Módulo ${idx + 1}</span>
        <span class="module-tab-badge">${m.ancho} mm</span>
      </button>
    `;
  });

  container.innerHTML = html;
}

/**
 * Cambia la pestaña del módulo activo.
 * @param {number} index - Índice del módulo a seleccionar (0-based)
 */
function seleccionarPestanaModulo(index) {
  if (index < 0 || index >= AppState.modulos.length) return;
  AppState.moduloActivoIndex = index;

  renderizarPestanasModulos();
  actualizarFormularioModuloActivo();
  actualizarCanvas();
}

/**
 * Carga los valores del módulo activo en los inputs del panel izquierdo.
 */
function actualizarFormularioModuloActivo() {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  // Título e indicador
  const lblTitulo = document.getElementById('lblTituloModuloActivo');
  if (lblTitulo) lblTitulo.innerText = `Configuración de Módulo ${idx + 1}`;

  // Inputs dimensionales
  const inpAncho = document.getElementById('modAncho');
  const inpAlto = document.getElementById('modAlto');
  const inpProf = document.getElementById('modProf');

  if (inpAncho) inpAncho.value = m.ancho;
  if (inpAlto) {
    inpAlto.value = m.alto;
    inpAlto.max = AppState.altoTotal;
  }
  if (inpProf) {
    inpProf.value = m.profundidad;
    inpProf.max = AppState.profTotal;
  }

  // Zócalo
  const chkZocalo = document.getElementById('modTieneZocalo');
  const inpAltoZocalo = document.getElementById('modAltoZocalo');
  const selListones = document.getElementById('modCantListones');
  const grpZocalo = document.getElementById('grpDetalleZocalo');

  if (chkZocalo) chkZocalo.checked = m.tiene_zocalo;
  if (inpAltoZocalo) inpAltoZocalo.value = m.alto_zocalo;
  if (selListones) selListones.value = m.cant_listones;
  if (grpZocalo) grpZocalo.style.display = m.tiene_zocalo ? 'grid' : 'none';

  // Listones en Parte Posterior (Pared)
  const chkPost = document.getElementById('modTieneListonPost');
  const selCantPost = document.getElementById('modCantListonesPost');
  const inpMedidaPost = document.getElementById('modMedidaListonPost');
  const grpPost = document.getElementById('grpDetalleListonPost');

  const tienePost = (m.tiene_liston_post !== undefined)
    ? !!m.tiene_liston_post
    : (m.tiene_liston_amarre && (m.posicion_liston_amarre === 'posterior' || m.posicion_liston_amarre === 'ambos'));

  if (chkPost) chkPost.checked = tienePost;
  if (selCantPost) selCantPost.value = m.cant_listones_post || m.cant_listones_amarre || 2;
  if (inpMedidaPost) inpMedidaPost.value = m.medida_liston_post || m.alto_liston_amarre || 80;
  if (grpPost) grpPost.style.display = tienePost ? 'block' : 'none';

  // Techo y Listones de Techo (Amarres Superiores)
  const chkTecho = document.getElementById('modTieneListonTecho');
  const selCantTecho = document.getElementById('modCantListonesTecho');
  const inpMedidaTecho = document.getElementById('modMedidaListonTecho');
  const grpTecho = document.getElementById('grpDetalleListonTecho');
  const chkTechoSobre = document.getElementById('modTechoSobreListon');
  const grpTechoSobre = document.getElementById('grpDetalleTechoSobre');
  const chkDobleMel = document.getElementById('modTechoDobleMelamina');
  const lblEspesorDesc = document.getElementById('lblEspesorDescontado');

  const tieneTecho = (m.tiene_liston_techo !== undefined)
    ? !!m.tiene_liston_techo
    : (m.tiene_liston_amarre && (m.posicion_liston_amarre === 'techo' || m.posicion_liston_amarre === 'ambos'));

  if (chkTecho) chkTecho.checked = tieneTecho;
  if (selCantTecho) selCantTecho.value = m.cant_listones_techo || m.cant_listones_amarre || 2;
  if (inpMedidaTecho) inpMedidaTecho.value = m.medida_liston_techo || m.alto_liston_amarre || 80;
  if (grpTecho) grpTecho.style.display = tieneTecho ? 'block' : 'none';
  if (chkTechoSobre) chkTechoSobre.checked = !!m.techo_sobre_liston;
  if (grpTechoSobre) grpTechoSobre.style.display = m.techo_sobre_liston ? 'block' : 'none';
  if (chkDobleMel) chkDobleMel.checked = !!m.techo_doble_melamina;
  if (lblEspesorDesc) {
    const t = AppState.espesorMelamina;
    lblEspesorDesc.textContent = m.techo_doble_melamina ? (2 * t) : t;
  }

  // Fondo Posterior (MDF, Melamina o Ninguno) y Descuento de Profundidad
  const tipoFondo = m.tipo_fondo || (m.tiene_fondo_mdf !== false ? 'mdf' : 'ninguno');
  m.tipo_fondo = tipoFondo;

  const selTipoFondo = document.getElementById('modTipoFondo');
  const selPosFondo = document.getElementById('modPosicionFondoMdf');
  const selPosMel = document.getElementById('modPosicionFondoMelamina');
  const grpFondoMdf = document.getElementById('grpDetalleFondoMdf');
  const grpFondoMel = document.getElementById('grpDetalleFondoMelamina');
  const lblDescuento = document.getElementById('lblDescuentoProfDetalle');

  if (selTipoFondo) selTipoFondo.value = tipoFondo;
  if (selPosFondo) selPosFondo.value = m.posicion_fondo_mdf || 'delante_liston';
  if (selPosMel) selPosMel.value = m.posicion_fondo_melamina || 'embutido';

  if (grpFondoMdf) grpFondoMdf.style.display = (tipoFondo === 'mdf') ? 'block' : 'none';
  if (grpFondoMel) grpFondoMel.style.display = (tipoFondo === 'melamina') ? 'block' : 'none';

  const profInfo = calcularProfundidadUtilInterior(m, AppState.espesorMelamina);
  if (lblDescuento) {
    lblDescuento.innerHTML = `
      <strong>${profInfo.profMod} mm (nominal)</strong> → <span style="font-size: 11px; font-weight: 700; color: var(--accent);">${profInfo.profUtil} mm (útil)</span><br>
      <span style="color: var(--text-muted); font-size: 9px;">Descuentos: ${profInfo.detallesTexto}</span>
    `;
  }

  // Interior
  const selInterior = document.getElementById('modTipoInterior');
  if (selInterior) selInterior.value = m.tipo_interior || 'carcasa';

  const grpRepisas = document.getElementById('grpDetalleRepisas');
  const grpCajones = document.getElementById('grpDetalleCajonera');
  const inpRep = document.getElementById('modCantRepisas');
  const inpCaj = document.getElementById('modCantCajones');

  if (grpRepisas) grpRepisas.style.display = (m.tipo_interior === 'repisas') ? 'block' : 'none';
  if (grpCajones) grpCajones.style.display = (m.tipo_interior === 'cajonera') ? 'block' : 'none';
  if (inpRep) inpRep.value = (m.cant_repisas !== undefined) ? m.cant_repisas : 0;
  if (inpCaj) inpCaj.value = m.cant_cajones || 3;

  // Renderizar controles avanzados de parantes y repisas por espacio
  if (m.tipo_interior === 'repisas') {
    renderizarControlesParantesYEspacios(m);
  }

  // Validación de límites técnicos en vivo
  validarLimitesTecnicosModulo(m, idx);
}

// ==============================================================================
// 6. ALGORITMO DE RECÁLCULO DINÁMICO DE ANCHOS (Suma Total Invariable)
// ==============================================================================

/**
 * Se ejecuta al editar el ancho de un módulo particular.
 * Recalcula y redistribuye la diferencia entre los demás módulos
 * para que la suma exacta de todos los anchos sea igual al Ancho Total.
 * @param {number} nuevoAncho - Valor en mm ingresado por el usuario.
 */
function onEditarAnchoModulo(nuevoAncho) {
  const idx = AppState.moduloActivoIndex;
  const numModulos = AppState.modulos.length;
  if (numModulos <= 0) return;

  const minAncho = 150; // Mínimo técnico para atornillador
  const maxAncho = 1000; // Máximo recomendado sin división vertical

  // Si hay un solo módulo, su ancho es siempre el Ancho Total
  if (numModulos === 1) {
    AppState.modulos[0].ancho = AppState.anchoTotal;
    actualizarFormularioModuloActivo();
    actualizarCanvas();
    return;
  }

  // Límite superior estricto: dejar al menos 150 mm para cada uno de los demás módulos
  const maxPermisible = AppState.anchoTotal - ((numModulos - 1) * minAncho);
  nuevoAncho = Math.max(minAncho, Math.min(maxPermisible, Math.round(nuevoAncho)));

  const anchoPrevio = AppState.modulos[idx].ancho;
  const delta = nuevoAncho - anchoPrevio;
  AppState.modulos[idx].ancho = nuevoAncho;

  // Índices de los otros módulos que deben absorber el delta inverso (-delta)
  const otrosIndices = AppState.modulos.map((_, i) => i).filter(i => i !== idx);
  let sumaOtros = otrosIndices.reduce((acc, i) => acc + AppState.modulos[i].ancho, 0);

  let remanentePorRepartir = -delta;

  // Distribuir proporcionalmente o equitativamente
  for (let k = 0; k < otrosIndices.length; k++) {
    const oIdx = otrosIndices[k];
    if (k === otrosIndices.length - 1) {
      // El último absorbe el remanente exacto para evitar errores de coma flotante
      AppState.modulos[oIdx].ancho = Math.max(minAncho, Math.round(AppState.modulos[oIdx].ancho + remanentePorRepartir));
    } else {
      const fraccion = (sumaOtros > 0) ? (AppState.modulos[oIdx].ancho / sumaOtros) : (1 / otrosIndices.length);
      const ajuste = Math.round(remanentePorRepartir * fraccion);
      AppState.modulos[oIdx].ancho = Math.max(minAncho, AppState.modulos[oIdx].ancho + ajuste);
      remanentePorRepartir -= ajuste;
      sumaOtros -= AppState.modulos[oIdx].ancho;
    }
  }

  // Ajuste fino para garantizar milimétricamente la suma total
  const sumaReal = AppState.modulos.reduce((acc, m) => acc + m.ancho, 0);
  const residuo = AppState.anchoTotal - sumaReal;
  if (residuo !== 0 && otrosIndices.length > 0) {
    AppState.modulos[otrosIndices[0]].ancho += residuo;
  }

  // Actualizar UI
  renderizarPestanasModulos();
  actualizarCanvas();
  validarLimitesTecnicosModulo(AppState.modulos[idx], idx);
}

/**
 * Se ejecuta al editar la altura particular del módulo activo.
 * (Puede ser menor o igual a la dimensión total).
 */
function onEditarAltoModulo(nuevoAlto) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  const hClamped = Math.max(150, Math.min(AppState.altoTotal, Math.round(nuevoAlto)));
  m.alto = hClamped;

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
 * Conmuta si el módulo activo lleva o no zócalo.
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

  m.alto_zocalo = Math.max(40, Math.min(250, parseFloat(alto) || 100));
  actualizarCanvas();
}

/**
 * Cambia la cantidad de listones del zócalo (2, 3 o 4 listones).
 */
function onEditarCantListones(cant) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.cant_listones = parseInt(cant) || 2;
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
 * Edita la cantidad de listones en la parte posterior (1 a 4).
 * @param {string|number} cant
 */
function onEditarCantListonesPost(cant) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.cant_listones_post = Math.max(1, Math.min(4, parseInt(cant) || 2));
  actualizarCanvas();
}

/**
 * Edita la medida/altura del listón posterior en mm (40 a 250 mm).
 * @param {string|number} medida
 */
function onEditarMedidaListonPost(medida) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.medida_liston_post = Math.max(40, Math.min(250, parseFloat(medida) || 80));
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
 * Edita la medida/ancho del listón de techo en mm (40 a 250 mm).
 * @param {string|number} medida
 */
function onEditarMedidaListonTecho(medida) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.medida_liston_techo = Math.max(40, Math.min(250, parseFloat(medida) || 80));
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
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
 * Descuenta según la presencia de listones posteriores, fondo MDF (enranurado/sobrepuesto)
 * o fondo de melamina, más el retranqueo frontal estándar de seguridad (20mm).
 * @param {Object} m - Módulo actual.
 * @param {number} [t] - Espesor de la melamina (18 o 15 mm).
 * @returns {Object} Desglose detallado con profUtil, descuentoFrontal, descuentoPosterior, y texto explicativo.
 */
function calcularProfundidadUtilInterior(m, t) {
  t = t || AppState.espesorMelamina || 18;
  const profMod = m.profundidad;
  const descuentoFrontal = 20; // 20mm de retranqueo frontal estándar

  // 1. Verificar listones posteriores
  const tieneListonPost = !!(
    m.tiene_liston_posterior ||
    m.tiene_liston_post ||
    (m.tiene_liston_amarre && (m.posicion_liston_amarre === 'posterior' || m.posicion_liston_amarre === 'ambos'))
  );

  // 2. Determinar tipo y posición del fondo
  let tipoFondo = m.tipo_fondo;
  if (!tipoFondo) {
    tipoFondo = (m.tiene_fondo_mdf !== false) ? 'mdf' : 'ninguno';
  }

  let descuentoPosterior = 0;
  let detallesDescuento = [];

  detallesDescuento.push(`-${descuentoFrontal} mm (retranqueo frontal)`);

  if (tipoFondo === 'mdf') {
    const posMdf = m.posicion_fondo_mdf || 'delante_liston';
    if (posMdf === 'delante_liston') {
      // El MDF va enranurado delante del listón posterior
      descuentoPosterior = t + 3;
      detallesDescuento.push(`-${t} mm (listón posterior)`);
      detallesDescuento.push(`-3 mm (fondo MDF enranurado)`);
    } else {
      // MDF sobrepuesto por fuera del módulo
      if (tieneListonPost) {
        descuentoPosterior = t;
        detallesDescuento.push(`-${t} mm (listón posterior de amarre)`);
      }
    }
  } else if (tipoFondo === 'melamina') {
    const posMel = m.posicion_fondo_melamina || 'embutido';
    if (posMel === 'embutido') {
      if (tieneListonPost) {
        descuentoPosterior = t + t;
        detallesDescuento.push(`-${t} mm (listón posterior)`);
        detallesDescuento.push(`-${t} mm (fondo melamina interior)`);
      } else {
        descuentoPosterior = t;
        detallesDescuento.push(`-${t} mm (fondo melamina interior)`);
      }
    } else {
      // Melamina sobrepuesta por fuera
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

  const profUtil = Math.max(100, profMod - descuentoFrontal - descuentoPosterior);
  const yStart = descuentoFrontal;
  const yEnd = yStart + profUtil;

  return {
    profMod,
    descuentoFrontal,
    descuentoPosterior,
    descuentoTotal: descuentoFrontal + descuentoPosterior,
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
 * Cambia el tipo de fondo posterior: 'mdf', 'melamina' o 'ninguno'.
 * @param {string} tipo - 'mdf' | 'melamina' | 'ninguno'
 */
function onCambiarTipoFondo(tipo) {
  const idx = AppState.moduloActivoIndex;
  const m = AppState.modulos[idx];
  if (!m) return;

  m.tipo_fondo = tipo;
  m.tiene_fondo_mdf = (tipo === 'mdf');

  const grpFondoMdf = document.getElementById('grpDetalleFondoMdf');
  const grpFondoMel = document.getElementById('grpDetalleFondoMelamina');

  if (grpFondoMdf) grpFondoMdf.style.display = (tipo === 'mdf') ? 'block' : 'none';
  if (grpFondoMel) grpFondoMel.style.display = (tipo === 'melamina') ? 'block' : 'none';

  actualizarFormularioModuloActivo();
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);

  const profInfo = calcularProfundidadUtilInterior(m, AppState.espesorMelamina);
  mostrarNotificacion(`Fondo configurado como ${tipo.toUpperCase()}: repisas y parantes ajustados a ${profInfo.profUtil} mm de profundidad.`, "info");
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
  actualizarFormularioModuloActivo();
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);

  const profInfo = calcularProfundidadUtilInterior(m, AppState.espesorMelamina);
  mostrarNotificacion(`MDF ${pos === 'delante_liston' ? 'enranurado' : 'sobrepuesto'}: profundidad útil de repisas/parantes recalculada a ${profInfo.profUtil} mm.`, "info");
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
  const hTecho = m.techo_sobre_liston ? ((m.techo_doble_melamina ? 2 : 1) * t) : 0;
  const hCarcasa = hMod - zH - hTecho;

  const anchoInt = Math.max(0, wMod - (2 * t));
  const hVanoUtil = Math.max(0, hCarcasa - (2 * t));

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

    // Repisas configuradas para este espacio
    let eCfg = espaciosCfg[s];
    if (!eCfg) {
      if (s === 0 && m.cant_repisas > 0 && espaciosCfg.length === 0) {
        eCfg = { cantidad: m.cant_repisas, modo: 'proporcional', posiciones_fijas: [] };
      } else {
        eCfg = { cantidad: 0, modo: 'proporcional', posiciones_fijas: [] };
      }
    }

    const cantMaxRepisas = Math.max(0, Math.floor((altoEspacio - 80) / (80 + t)));
    const cantRepisas = Math.max(0, Math.min(cantMaxRepisas, parseInt(eCfg.cantidad) || 0));
    const modoRepisas = eCfg.modo || 'proporcional';
    const repisas = [];

    if (cantRepisas > 0) {
      const pasoProp = (altoEspacio - (cantRepisas * t)) / (cantRepisas + 1);

      for (let r = 0; r < cantRepisas; r++) {
        const cotaProp = Math.round(((r + 1) * pasoProp) + (r * t));

        const minZRel = (r === 0) ? 80 : (repisas[r - 1].zRel + t + 80);
        const restantesR = cantRepisas - 1 - r;
        const maxZRel = Math.max(minZRel, altoEspacio - t - 80 - (restantesR * (80 + t)));

        let cotaFinal = cotaProp;
        if (modoRepisas === 'fija' && Array.isArray(eCfg.posiciones_fijas) && eCfg.posiciones_fijas[r] !== undefined && eCfg.posiciones_fijas[r] > 0) {
          cotaFinal = Math.max(minZRel, Math.min(maxZRel, Math.round(eCfg.posiciones_fijas[r])));
        }

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
      config: {
        cantidad: cantRepisas,
        modo: modoRepisas,
        posiciones_fijas: repisas.map(rep => rep.zRel)
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

  m.cant_cajones = Math.max(2, Math.min(5, parseInt(cant) || 3));
  actualizarCanvas();
  validarLimitesTecnicosModulo(m, idx);
}

// ==============================================================================
// 7. MOTOR DE VALIDACIONES TÉCNICAS & REGLAS DE PANDEO INDUSTRIALES
// ==============================================================================

/**
 * Valida todas las normas técnicas de carpintería y pandeo para el módulo especificado
 * según la especificación exacta de fabricación en 15mm y 18mm:
 *   - Carcasa: 150mm a 1000mm ancho, 150mm a 2400mm alto, 150mm a 650mm prof.
 *   - Repisas: Pandeo máx 600-700mm en 15mm; máx 800mm en 18mm. Parante obligatorio si > 800mm.
 *   - Cajoneras: Mín 300-350mm, máx 900-1000mm. Refuerzo si > 700mm. Prof 250-550mm.
 *   - Puertas: Mín 250mm, máx 600mm bisagras cazoleta 35mm. Alto máx 2200mm.
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
    alertas.push({ tipo: 'warning', msg: `Ancho excesivo (${w} mm): Más de 1000 mm sin división vertical ocasiona pandeo del techo y piso por gravedad y carga.` });
  }

  if (h > 2400) {
    alertas.push({ tipo: 'warning', msg: `Altura límite excedida (${h} mm): La plancha comercial permite un largo útil máximo de 2400 mm para laterales continuos de una pieza.` });
  }

  if (p < 150) {
    alertas.push({ tipo: 'danger', msg: `Profundidad deficiente (${p} mm): Menos de 150 mm carece de estabilidad estructural.` });
  } else if (p > 650) {
    alertas.push({ tipo: 'warning', msg: `Profundidad amplia (${p} mm): Más de 650 mm dificulta el alcance de objetos al fondo y genera desperdicio en el seccionado del tablero comercial.` });
  }

  // 2. REPISAS Y ESTANTES (REGLA DE PANDEO Y REFUERZOS POR ESPACIO)
  if (m.tipo_interior === 'repisas') {
    const geo = calcularDivisionesYEspaciosModulo(m, t);
    const limitePandeo = (t === 15) ? 700 : 800;

    let hayPandeo = false;
    geo.espacios.forEach((esp) => {
      if (esp.ancho > limitePandeo && esp.repisas.length > 0) {
        hayPandeo = true;
        alertas.push({
          tipo: 'warning',
          msg: `⚠️ ALERTA DE PANDEO en ${esp.nombre}: El vano (${esp.ancho} mm) supera los ${limitePandeo} mm en melamina de ${t}mm. Se requiere agregar un parante vertical intermedio para evitar arqueo por carga.`
        });
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
    if (w < 300) {
      alertas.push({ tipo: 'danger', msg: `Cajón muy estrecho (${w} mm): Deja un espacio interior minúsculo tras descontar los laterales y 26 mm de las correderas telescópicas.` });
    } else if (w > 700) {
      alertas.push({ tipo: 'warning', msg: `Cajonera ancha (${w} mm): Se debe colocar un listón de amarre de refuerzo bajo el fondo y correderas Heavy Duty, o dividir en 2 columnas.` });
    }

    if (p < 250 || p > 550) {
      alertas.push({ tipo: 'warning', msg: `Profundidad de corredera: Medidas comerciales estándar disponibles son 25, 30, 35, 40, 45, 50 y 55 cm. Profundidad actual: ${p} mm.` });
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

  // Renderizar alertas
  let html = '';
  alertas.forEach(a => {
    html += `
      <div class="alert-technical ${a.tipo}">
        <span>${a.msg}</span>
      </div>
    `;
  });

  container.innerHTML = html;
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
    material: AppState.materialEstructura,
    modulo_activo: AppState.moduloActivoIndex,
    modulos: AppState.modulos
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
    lbl.innerText = `${AppState.anchoTotal} x ${AppState.altoTotal} x ${AppState.profTotal} mm (${AppState.modulos.length} Módulos | Melamina ${AppState.espesorMelamina}mm)`;
  }
}

// ==============================================================================
// 9. CONSTRUCCIÓN EN SKETCHUP 3D Y COMUNICACIÓN BIDIRECCIONAL
// ==============================================================================

/**
 * Envía el paquete paramétrico completo a Ruby para modelar en SketchUp 3D.
 */
function construirEnSketchup() {
  if (AppState.estadoVisualizador === 'vacio') {
    mostrarNotificacion("Debe ingresar las dimensiones generales en el Paso 1 antes de construir.", "warning");
    return;
  }

  if (AppState.modulos.length === 0) {
    mostrarNotificacion("Configure al menos 1 módulo en el Paso 2 antes de modelar.", "warning");
    return;
  }

  const payload = {
    ancho_total: AppState.anchoTotal,
    alto_total: AppState.altoTotal,
    prof_total: AppState.profTotal,
    espesor: AppState.espesorMelamina,
    material_estructura: AppState.materialEstructura,
    material_frentes: AppState.materialFrentes,
    resistencia: AppState.resistencia,
    modulos: AppState.modulos
  };

  mostrarNotificacion("Construyendo composición de módulos en SketchUp 3D...", "info");

  if (window.sketchup && typeof window.sketchup.construirComposicionModular === 'function') {
    window.sketchup.construirComposicionModular(JSON.stringify(payload));
  } else {
    // Modo simulación en navegador web independiente
    console.log("[JPQMelaminaPro Bridge] Payload enviado a SketchUp:", payload);
    setTimeout(() => {
      mostrarNotificacion(`[Simulación] Mueble de ${AppState.modulos.length} módulos construido exitosamente en SketchUp.`, "success");
    }, 600);
  }
}

/**
 * Callback ejecutado cuando Ruby termina la construcción en SketchUp.
 */
function onComposicionModularCreada(resp) {
  if (resp && resp.ok) {
    mostrarNotificacion(resp.mensaje || "Módulos creados exitosamente en SketchUp.", "success");
  } else {
    mostrarNotificacion(resp ? resp.error : "Error al construir en SketchUp.", "error");
  }
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

  AppState.modulos.forEach((m, idx) => {
    const modId = `M${idx + 1}`;
    const usaAmarresTecho = (m.tiene_liston_techo === true || m.tiene_liston_techo === 'true') ||
      ((m.tiene_liston_amarre === true || m.tiene_liston_amarre === 'true') && (m.posicion_liston_amarre === 'techo' || m.posicion_liston_amarre === 'ambos'));
    const tieneTechoSobre = usaAmarresTecho && (m.techo_sobre_liston === true || m.techo_sobre_liston === 'true');
    const esDobleMelamina = m.techo_doble_melamina === true || m.techo_doble_melamina === 'true';
    const hTecho = tieneTechoSobre ? (esDobleMelamina ? (2 * t) : t) : 0;

    // Altura de carcasa descontando zócalo y techo sobrepuesto
    const hCarcasa = m.alto - zH - hTecho;
    const anchoInt = m.ancho - (2 * t);

    // Laterales (Costados)
    piezas.push({
      item: itemNum++, modulo: modId, pieza: "Costado Izquierdo",
      material: AppState.materialEstructura, cant: 1,
      largo_bruto: hCarcasa, ancho_bruto: m.profundidad, espesor: t,
      largo_neto: hCarcasa - 2.5, ancho_neto: m.profundidad - 1.0,
      canto_L1: '2.0', canto_L2: '0.5', canto_A1: '0.5', canto_A2: '0.5', ranura: 'Ninguna'
    });
    piezas.push({
      item: itemNum++, modulo: modId, pieza: "Costado Derecho",
      material: AppState.materialEstructura, cant: 1,
      largo_bruto: hCarcasa, ancho_bruto: m.profundidad, espesor: t,
      largo_neto: hCarcasa - 2.5, ancho_neto: m.profundidad - 1.0,
      canto_L1: '2.0', canto_L2: '0.5', canto_A1: '0.5', canto_A2: '0.5', ranura: 'Ninguna'
    });

    // Piso Carcasa
    piezas.push({
      item: itemNum++, modulo: modId, pieza: "Piso Carcasa",
      material: AppState.materialEstructura, cant: 1,
      largo_bruto: anchoInt, ancho_bruto: m.profundidad, espesor: t,
      largo_neto: anchoInt - 1.0, ancho_neto: m.profundidad - 1.0,
      canto_L1: '2.0', canto_L2: '0.0', canto_A1: '0.5', canto_A2: '0.5', ranura: 'Ninguna'
    });

    // Techo o Amarres de Techo
    if (usaAmarresTecho) {
      const cantTecho = m.cant_listones_techo || m.cant_listones_amarre || 2;
      const wListonTecho = m.medida_liston_techo || m.alto_liston_amarre || 80;
      piezas.push({
        item: itemNum++, modulo: modId, pieza: `Amarre Techo Frontal (x${cantTecho > 1 ? '1' : '1'})`,
        material: AppState.materialEstructura, cant: 1,
        largo_bruto: anchoInt, ancho_bruto: wListonTecho, espesor: t,
        largo_neto: anchoInt - 1.0, ancho_neto: wListonTecho - 1.0,
        canto_L1: '2.0', canto_L2: '0.5', canto_A1: '0.5', canto_A2: '0.5', ranura: 'Ninguna'
      });
      if (cantTecho >= 2) {
        piezas.push({
          item: itemNum++, modulo: modId, pieza: `Amarres Techo Posteriores/Refuerzo (x${cantTecho - 1})`,
          material: AppState.materialEstructura, cant: cantTecho - 1,
          largo_bruto: anchoInt, ancho_bruto: wListonTecho, espesor: t,
          largo_neto: anchoInt - 1.0, ancho_neto: wListonTecho - 1.0,
          canto_L1: '0.5', canto_L2: '0.5', canto_A1: '0.5', canto_A2: '0.5', ranura: 'Ninguna'
        });
      }

      // Techo Sobrepuesto
      if (tieneTechoSobre) {
        if (esDobleMelamina) {
          piezas.push({
            item: itemNum++, modulo: modId, pieza: "Tapa Techo Doble Melamina (Engrosado 36mm)",
            material: AppState.materialEstructura, cant: 2,
            largo_bruto: m.ancho, ancho_bruto: m.profundidad, espesor: t,
            largo_neto: m.ancho - 1.0, ancho_neto: m.profundidad - 1.0,
            canto_L1: '2.0', canto_L2: '2.0', canto_A1: '2.0', canto_A2: '2.0', ranura: 'Ninguna'
          });
        } else {
          piezas.push({
            item: itemNum++, modulo: modId, pieza: "Tapa Techo Sobrepuesta Simple",
            material: AppState.materialEstructura, cant: 1,
            largo_bruto: m.ancho, ancho_bruto: m.profundidad, espesor: t,
            largo_neto: m.ancho - 1.0, ancho_neto: m.profundidad - 1.0,
            canto_L1: '2.0', canto_L2: '2.0', canto_A1: '2.0', canto_A2: '2.0', ranura: 'Ninguna'
          });
        }
      }
    } else {
      piezas.push({
        item: itemNum++, modulo: modId, pieza: "Techo Carcasa Sólido",
        material: AppState.materialEstructura, cant: 1,
        largo_bruto: anchoInt, ancho_bruto: m.profundidad, espesor: t,
        largo_neto: anchoInt - 1.0, ancho_neto: m.profundidad - 1.0,
        canto_L1: '2.0', canto_L2: '0.0', canto_A1: '0.5', canto_A2: '0.5', ranura: 'Ninguna'
      });
    }

    // Listones Posteriores de Amarre / Fijación a Pared
    const usaAmarresPost = (m.tiene_liston_post === true || m.tiene_liston_post === 'true') ||
      ((m.tiene_liston_amarre === true || m.tiene_liston_amarre === 'true') && (m.posicion_liston_amarre === 'posterior' || m.posicion_liston_amarre === 'ambos'));
    if (usaAmarresPost) {
      const cantPost = m.cant_listones_post || m.cant_listones_amarre || 2;
      const hListonPost = m.medida_liston_post || m.alto_liston_amarre || 80;
      piezas.push({
        item: itemNum++, modulo: modId, pieza: `Listones Posteriores Pared (x${cantPost})`,
        material: AppState.materialEstructura, cant: cantPost,
        largo_bruto: anchoInt, ancho_bruto: hListonPost, espesor: t,
        largo_neto: anchoInt - 1.0, ancho_neto: hListonPost - 1.0,
        canto_L1: '0.5', canto_L2: '0.0', canto_A1: '0.5', canto_A2: '0.5', ranura: 'Ninguna'
      });
    }

    // Zócalo
    if (m.tiene_zocalo && zH > 0) {
      piezas.push({
        item: itemNum++, modulo: modId, pieza: "Zócalo Frontal",
        material: AppState.materialEstructura, cant: 1,
        largo_bruto: m.ancho, ancho_bruto: zH, espesor: t,
        largo_neto: m.ancho - 1.0, ancho_neto: zH - 1.0,
        canto_L1: '0.5', canto_L2: '0.0', canto_A1: '0.5', canto_A2: '0.5', ranura: 'Ninguna'
      });
      piezas.push({
        item: itemNum++, modulo: modId, pieza: "Zócalo Posterior",
        material: AppState.materialEstructura, cant: 1,
        largo_bruto: m.ancho, ancho_bruto: zH, espesor: t,
        largo_neto: m.ancho, ancho_neto: zH,
        canto_L1: '0.0', canto_L2: '0.0', canto_A1: '0.0', canto_A2: '0.0', ranura: 'Ninguna'
      });
    }

    // Fondo Posterior (MDF 3mm, Melamina 18mm/15mm o Ninguno)
    const tipoFondo = m.tipo_fondo || (m.tiene_fondo_mdf !== false ? 'mdf' : 'ninguno');
    if (tipoFondo === 'mdf') {
      const posMdf = m.posicion_fondo_mdf || 'delante_liston';
      if (posMdf === 'delante_liston') {
        const wMdf = anchoInt + 14;
        const hMdf = hCarcasa - (2 * t) + 14;
        piezas.push({
          item: itemNum++, modulo: modId, pieza: "Fondo Posterior MDF 3mm Ranurado",
          material: "MDF Fondo Blanco 3mm", cant: 1,
          largo_bruto: hMdf, ancho_bruto: wMdf, espesor: 3,
          largo_neto: hMdf, ancho_neto: wMdf,
          canto_L1: '0.0', canto_L2: '0.0', canto_A1: '0.0', canto_A2: '0.0', ranura: "Incrustado ranura 4x8mm"
        });
      } else {
        piezas.push({
          item: itemNum++, modulo: modId, pieza: "Fondo Posterior MDF 3mm Sobrepuesto",
          material: "MDF Fondo Blanco 3mm", cant: 1,
          largo_bruto: hCarcasa, ancho_bruto: m.ancho, espesor: 3,
          largo_neto: hCarcasa, ancho_neto: m.ancho,
          canto_L1: '0.0', canto_L2: '0.0', canto_A1: '0.0', canto_A2: '0.0', ranura: "Sobrepuesto clavado"
        });
      }
    } else if (tipoFondo === 'melamina') {
      const posMel = m.posicion_fondo_melamina || 'embutido';
      if (posMel === 'embutido') {
        const wMel = anchoInt + 14;
        const hMel = hCarcasa - (2 * t) + 14;
        piezas.push({
          item: itemNum++, modulo: modId, pieza: "Fondo Posterior Melamina Embutido",
          material: AppState.materialEstructura, cant: 1,
          largo_bruto: hMel, ancho_bruto: wMel, espesor: t,
          largo_neto: hMel, ancho_neto: wMel,
          canto_L1: '0.0', canto_L2: '0.0', canto_A1: '0.0', canto_A2: '0.0', ranura: "Embutido ranura"
        });
      } else {
        piezas.push({
          item: itemNum++, modulo: modId, pieza: "Fondo Posterior Melamina Sobrepuesto",
          material: AppState.materialEstructura, cant: 1,
          largo_bruto: hCarcasa, ancho_bruto: m.ancho, espesor: t,
          largo_neto: hCarcasa, ancho_neto: m.ancho,
          canto_L1: '0.0', canto_L2: '0.0', canto_A1: '0.0', canto_A2: '0.0', ranura: "Sobrepuesto posterior"
        });
      }
    }

    // Parantes y Repisas Interiores por Espacio
    if (m.tipo_interior === 'repisas') {
      const geo = calcularDivisionesYEspaciosModulo(m, t);

      // Piezas de Parantes
      geo.parantes.forEach((p, pIdx) => {
        const esV = (geo.limites.tipo === 'vertical');
        piezas.push({
          item: itemNum++, modulo: modId,
          pieza: `Parante ${esV ? 'Vertical' : 'Horizontal'} ${pIdx + 1}`,
          material: AppState.materialEstructura, cant: 1,
          largo_bruto: esV ? p.dz : p.dx, ancho_bruto: p.dy, espesor: t,
          largo_neto: (esV ? p.dz : p.dx) - 1.0, ancho_neto: p.dy - 1.0,
          canto_L1: '0.5', canto_L2: '0.5', canto_A1: '0.5', canto_A2: '0.5', ranura: 'Ninguna'
        });
      });

      // Piezas de Repisas por cada Espacio
      geo.espacios.forEach((esp) => {
        if (esp.repisas.length > 0) {
          piezas.push({
            item: itemNum++, modulo: modId,
            pieza: `Repisas ${esp.nombre} (x${esp.repisas.length})`,
            material: AppState.materialEstructura, cant: esp.repisas.length,
            largo_bruto: esp.ancho, ancho_bruto: esp.prof, espesor: t,
            largo_neto: esp.ancho - 1.0, ancho_neto: esp.prof - 1.0,
            canto_L1: '2.0', canto_L2: '0.0', canto_A1: '0.5', canto_A2: '0.5', ranura: 'Ninguna'
          });
        }
      });
    }
  });

  AppState.despieceActual = piezas;
  renderizarTablaDespiece(piezas);
}

/**
 * Renderiza la tabla HTML de despiece con medidas brutas, netas y tapacantos.
 */
function renderizarTablaDespiece(piezas) {
  const tbody = document.getElementById('tablaDespieceBody');
  if (!tbody) return;

  if (!piezas || piezas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 20px;">No hay piezas registradas en el despiece.</td></tr>`;
    return;
  }

  let html = '';
  piezas.forEach(p => {
    html += `
      <tr>
        <td><strong>${p.item}</strong></td>
        <td><span class="badge badge-info">${p.modulo}</span></td>
        <td>${p.pieza}</td>
        <td>${p.material}</td>
        <td><strong>${p.cant}</strong></td>
        <td>${p.largo_bruto} x ${p.ancho_bruto}</td>
        <td style="color: var(--primary); font-weight: bold;">${p.largo_neto} x ${p.ancho_neto}</td>
        <td>${p.espesor} mm</td>
        <td>${p.canto_L1}/${p.canto_L2}/${p.canto_A1}/${p.canto_A2}</td>
        <td>${p.ranura || 'Ninguna'}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
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
