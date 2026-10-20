/**
 * ==============================================================================
 * JPQMelaminaPro - Lógica de Interfaz y Puente de Comunicación con SketchUp
 * Control de formularios paramétricos, llamadas asíncronas con window.sketchup,
 * gestión de temas y renderizado de tablas de despiece en tiempo real.
 * ==============================================================================
 */

// Estado global de la aplicación
const AppState = {
  despieceActual: null,
  temaActual: 'claro',
  moduloSeleccionado: null
};

// ==============================================================================
// 1. Inicialización y Gestión de Temas
// ==============================================================================
document.addEventListener('DOMContentLoaded', () => {
  inicializarTemas();
  inicializarEventos();
  inicializarPrevisualizador3D();

  // Notificar a SketchUp que el DOM está completamente listo
  if (window.sketchup && window.sketchup.domListo) {
    window.sketchup.domListo();
  }
});

/**
 * Configura el sistema de temas (Claro, Oscuro, Taller Madera) persistente en localStorage.
 */
function inicializarTemas() {
  const temaGuardado = localStorage.getItem('jpqmelaminapro_theme') || 'claro';
  cambiarTema(temaGuardado);

  const themeSelector = document.getElementById('themeSelector');
  if (themeSelector) {
    themeSelector.value = temaGuardado;
    themeSelector.addEventListener('change', (e) => {
      cambiarTema(e.target.value);
      if (window.Preview3D) Preview3D.render();
    });
  }
}

/**
 * Aplica la clase correspondiente de tema al <body>.
 * @param {string} tema - 'claro' | 'oscuro' | 'taller'
 */
function cambiarTema(tema) {
  document.body.classList.remove('theme-dark', 'theme-taller');
  if (tema === 'oscuro') {
    document.body.classList.add('theme-dark');
  } else if (tema === 'taller') {
    document.body.classList.add('theme-taller');
  }
  AppState.temaActual = tema;
  localStorage.setItem('jpqmelaminapro_theme', tema);
}

// ==============================================================================
// 2. Navegación por Pestañas y Eventos de Interfaz
// ==============================================================================
function inicializarEventos() {
  const tabButtons = document.querySelectorAll('.nav-tab');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPane = btn.getAttribute('data-tab');
      cambiarPestana(targetPane);
    });
  });

  // Escuchar cambios en los selectores de tapacantos para actualizar medida neta
  const selectoresCantos = ['cantoL1', 'cantoL2', 'cantoA1', 'cantoA2'];
  selectoresCantos.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', actualizarPrevisualizacionCorteNeto);
  });
}

/**
 * Inicializa el motor de previsualización 3D y conecta los inputs del formulario
 * para redibujar en vivo por cada característica modificada.
 */
function inicializarPrevisualizador3D() {
  if (window.Preview3D) {
    Preview3D.init('preview3DCanvas');
  }

  // Lista de campos del formulario generador que disparan actualización inmediata
  const camposGenerador = [
    'modTipo', 'modAlto', 'modAncho', 'modProfundidad', 'modEspesor',
    'modMaterial', 'modAltoZocalo', 'modVuelo', 'modFondo',
    'modProfRanura', 'modDistRanura', 'modRepisasCheck', 'modCantRepisas', 'modAmarresCheck'
  ];

  camposGenerador.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', actualizarPrevisualizacionDesdeFormulario);
      el.addEventListener('change', actualizarPrevisualizacionDesdeFormulario);
    }
  });

  alCambiarTipoMueble();
}

/**
 * Cambia los valores predeterminados y muestra u oculta campos según el mueble seleccionado.
 */
function alCambiarTipoMueble() {
  const selectTipo = document.getElementById('modTipo');
  if (!selectTipo) return;
  const tipo = selectTipo.value;

  const elNombre = document.getElementById('modNombre');
  const elAlto = document.getElementById('modAlto');
  const elAncho = document.getElementById('modAncho');
  const elProf = document.getElementById('modProfundidad');
  const elZocalo = document.getElementById('modAltoZocalo');
  const elVuelo = document.getElementById('modVuelo');
  const elRepisasCheck = document.getElementById('modRepisasCheck');
  const elCantRepisas = document.getElementById('modCantRepisas');
  const elAmarresCheck = document.getElementById('modAmarresCheck');
  const elFondo = document.getElementById('modFondo');

  const grupoZocalo = document.getElementById('grupoZocalo');
  const grupoVuelo = document.getElementById('grupoVuelo');
  const seccionRepisas = document.getElementById('seccionRepisasModulo');
  const filaAmarres = document.getElementById('filaAmarresCheck');
  const filaFondo = document.getElementById('filaFondoCheck');
  const filaRanura = document.getElementById('filaRanuraConfig');

  switch (tipo) {
    case 'escritorio':
      if (elNombre) elNombre.value = 'Escritorio Profesional';
      if (elAlto) elAlto.value = 750;
      if (elAncho) elAncho.value = 1200;
      if (elProf) elProf.value = 600;
      if (elVuelo) elVuelo.value = 20;
      if (grupoZocalo) grupoZocalo.style.display = 'none';
      if (grupoVuelo) grupoVuelo.style.display = 'block';
      if (seccionRepisas) seccionRepisas.style.display = 'none';
      if (filaAmarres) filaAmarres.style.display = 'none';
      if (filaFondo) filaFondo.style.display = 'none';
      if (filaRanura) filaRanura.style.display = 'none';
      break;

    case 'comoda':
      if (elNombre) elNombre.value = 'Cómoda 4 Cajones';
      if (elAlto) elAlto.value = 950;
      if (elAncho) elAncho.value = 800;
      if (elProf) elProf.value = 450;
      if (elZocalo) elZocalo.value = 80;
      if (grupoZocalo) grupoZocalo.style.display = 'block';
      if (grupoVuelo) grupoVuelo.style.display = 'none';
      if (seccionRepisas) seccionRepisas.style.display = 'none';
      if (filaAmarres) filaAmarres.style.display = 'none';
      if (filaFondo) filaFondo.style.display = 'flex';
      if (filaRanura) filaRanura.style.display = 'grid';
      break;

    case 'ropero':
      if (elNombre) elNombre.value = 'Ropero Clóset 2 Cuerpos';
      if (elAlto) elAlto.value = 2100;
      if (elAncho) elAncho.value = 1400;
      if (elProf) elProf.value = 550;
      if (elZocalo) elZocalo.value = 80;
      if (grupoZocalo) grupoZocalo.style.display = 'block';
      if (grupoVuelo) grupoVuelo.style.display = 'none';
      if (seccionRepisas) seccionRepisas.style.display = 'none';
      if (filaAmarres) filaAmarres.style.display = 'none';
      if (filaFondo) filaFondo.style.display = 'flex';
      if (filaRanura) filaRanura.style.display = 'grid';
      break;

    case 'bajo':
      if (elNombre) elNombre.value = 'Módulo Bajo Cocina';
      if (elAlto) elAlto.value = 850;
      if (elAncho) elAncho.value = 800;
      if (elProf) elProf.value = 600;
      if (elZocalo) elZocalo.value = 100;
      if (elRepisasCheck) elRepisasCheck.checked = true;
      if (elCantRepisas) elCantRepisas.value = 1;
      if (elAmarresCheck) elAmarresCheck.checked = true;
      if (grupoZocalo) grupoZocalo.style.display = 'block';
      if (grupoVuelo) grupoVuelo.style.display = 'none';
      if (seccionRepisas) seccionRepisas.style.display = 'block';
      if (filaAmarres) filaAmarres.style.display = 'flex';
      if (filaFondo) filaFondo.style.display = 'flex';
      if (filaRanura) filaRanura.style.display = 'grid';
      break;

    case 'aereo':
      if (elNombre) elNombre.value = 'Alacena Aérea Cocina';
      if (elAlto) elAlto.value = 700;
      if (elAncho) elAncho.value = 800;
      if (elProf) elProf.value = 320;
      if (elRepisasCheck) elRepisasCheck.checked = true;
      if (elCantRepisas) elCantRepisas.value = 1;
      if (grupoZocalo) grupoZocalo.style.display = 'none';
      if (grupoVuelo) grupoVuelo.style.display = 'none';
      if (seccionRepisas) seccionRepisas.style.display = 'block';
      if (filaAmarres) filaAmarres.style.display = 'none';
      if (filaFondo) filaFondo.style.display = 'flex';
      if (filaRanura) filaRanura.style.display = 'grid';
      break;

    case 'librero':
    default:
      if (elNombre) elNombre.value = 'Librero con Zócalo';
      if (elAlto) elAlto.value = 1800;
      if (elAncho) elAncho.value = 800;
      if (elProf) elProf.value = 300;
      if (elZocalo) elZocalo.value = 70;
      if (elRepisasCheck) elRepisasCheck.checked = true;
      if (elCantRepisas) elCantRepisas.value = 3;
      if (grupoZocalo) grupoZocalo.style.display = 'block';
      if (grupoVuelo) grupoVuelo.style.display = 'none';
      if (seccionRepisas) seccionRepisas.style.display = 'block';
      if (filaAmarres) filaAmarres.style.display = 'none';
      if (filaFondo) filaFondo.style.display = 'flex';
      if (filaRanura) filaRanura.style.display = 'grid';
      break;
  }

  actualizarPrevisualizacionDesdeFormulario();
}

/**
 * Lee todos los valores del formulario y actualiza la escena 3D en tiempo real.
 */
function actualizarPrevisualizacionDesdeFormulario() {
  if (!window.Preview3D) return;

  const tipo = document.getElementById('modTipo') ? document.getElementById('modTipo').value : 'librero';
  const alto = parseFloat(document.getElementById('modAlto') ? document.getElementById('modAlto').value : 750) || 750;
  const ancho = parseFloat(document.getElementById('modAncho') ? document.getElementById('modAncho').value : 600) || 600;
  const profundidad = parseFloat(document.getElementById('modProfundidad') ? document.getElementById('modProfundidad').value : 500) || 500;
  const espesor = parseFloat(document.getElementById('modEspesor') ? document.getElementById('modEspesor').value : 18) || 18;
  const material = document.getElementById('modMaterial') ? document.getElementById('modMaterial').value : 'Melamina Blanca 18mm';
  const altoZocalo = parseFloat(document.getElementById('modAltoZocalo') ? document.getElementById('modAltoZocalo').value : 70) || 70;
  const vuelo = parseFloat(document.getElementById('modVuelo') ? document.getElementById('modVuelo').value : 20) || 20;
  const tieneFondo = document.getElementById('modFondo') ? document.getElementById('modFondo').checked : true;
  const cantidadRepisas = parseInt(document.getElementById('modCantRepisas') ? document.getElementById('modCantRepisas').value : 1, 10) || 1;
  const usarAmarres = document.getElementById('modAmarresCheck') ? document.getElementById('modAmarresCheck').checked : false;

  Preview3D.update({
    tipo,
    alto,
    ancho,
    profundidad,
    espesor,
    material,
    alto_zocalo: altoZocalo,
    vuelo,
    tiene_fondo: tieneFondo,
    cantidad_repisas: cantidadRepisas,
    usar_amarres: usarAmarres
  });
}

// Exportar globalmente para eventos inline HTML
window.alCambiarTipoMueble = alCambiarTipoMueble;
window.actualizarPrevisualizacionDesdeFormulario = actualizarPrevisualizacionDesdeFormulario;

/**
 * Cambia la pestaña activa mostrada en la interfaz.
 * @param {string} paneId - Identificador de la pestaña a mostrar.
 */
window.cambiarPestana = function(paneId) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  const activeBtn = document.querySelector(`.nav-tab[data-tab="${paneId}"]`);
  const activePane = document.getElementById(`tab-${paneId}`);

  if (activeBtn) activeBtn.classList.add('active');
  if (activePane) activePane.classList.add('active');

  // Si se vuelve al creador, re-renderizar el canvas 3D
  if (paneId === 'creador' && window.Preview3D) {
    setTimeout(() => Preview3D.render(), 50);
  }

  // Si se entra a la pestaña de despiece, actualizar automáticamente
  if (paneId === 'despiece') {
    solicitarDespiece();
  }
};

// ==============================================================================
// 3. Acciones de Envío a SketchUp (Bridge de Ruby)
// ==============================================================================

/**
 * 1. Envía los parámetros para crear un nuevo módulo paramétrico 3D.
 */
function enviarCrearModulo() {
  const payload = {
    nombre: document.getElementById('modNombre').value,
    tipo: document.getElementById('modTipo').value,
    alto: parseFloat(document.getElementById('modAlto').value),
    ancho: parseFloat(document.getElementById('modAncho').value),
    profundidad: parseFloat(document.getElementById('modProfundidad').value),
    espesor: parseFloat(document.getElementById('modEspesor').value),
    alto_zocalo: parseFloat(document.getElementById('modAltoZocalo') ? document.getElementById('modAltoZocalo').value : 70),
    vuelo: parseFloat(document.getElementById('modVuelo') ? document.getElementById('modVuelo').value : 20),
    tiene_fondo: document.getElementById('modFondo') ? document.getElementById('modFondo').checked : true,
    prof_ranura: parseFloat(document.getElementById('modProfRanura') ? document.getElementById('modProfRanura').value : 8),
    dist_ranura: parseFloat(document.getElementById('modDistRanura') ? document.getElementById('modDistRanura').value : 18),
    tiene_repisa: document.getElementById('modRepisasCheck') ? document.getElementById('modRepisasCheck').checked : false,
    cantidad_repisas: parseInt(document.getElementById('modCantRepisas') ? document.getElementById('modCantRepisas').value : 1, 10),
    usar_amarres: document.getElementById('modAmarresCheck') ? document.getElementById('modAmarresCheck').checked : false,
    material: document.getElementById('modMaterial').value
  };

  invocarBridge('crearModulo', payload);
}

/**
 * 2. Solicita a SketchUp leer el módulo actualmente seleccionado.
 */
function cargarModuloSeleccionado() {
  invocarBridge('obtenerModuloSeleccionado', {});
}

/**
 * 3. Aplica cambios paramétricos no destructivos al módulo seleccionado.
 */
function enviarActualizarModulo() {
  const payload = {
    nombre: document.getElementById('editNombre').value,
    alto: parseFloat(document.getElementById('editAlto').value),
    ancho: parseFloat(document.getElementById('editAncho').value),
    profundidad: parseFloat(document.getElementById('editProfundidad').value),
    espesor: parseFloat(document.getElementById('editEspesor').value),
    material: document.getElementById('editMaterial').value
  };

  invocarBridge('actualizarModulo', payload);
}

/**
 * 4. Inserta repisas o parantes.
 */
function enviarRepisas() {
  const payload = {
    tipo: document.getElementById('repisaTipo').value,
    cantidad: parseInt(document.getElementById('repisaCantidad').value, 10),
    altura_fija: parseFloat(document.getElementById('repisaAlturaFija').value || 0),
    retroceso_frente: parseFloat(document.getElementById('repisaRetroceso').value || 10)
  };

  invocarBridge('aplicarRepisas', payload);
}

/**
 * 5. Inserta cajones con holguras de correderas.
 */
function enviarCajonera() {
  const payload = {
    cantidad_cajones: parseInt(document.getElementById('cajonesCantidad').value, 10),
    largo_corredera: parseFloat(document.getElementById('cajonesCorredera').value),
    luz_entre_tapas: parseFloat(document.getElementById('cajonesLuz').value),
    espesor_caja: parseFloat(document.getElementById('cajonesEspesorCaja').value),
    tipo_frente: document.getElementById('cajonesTipoFrente').value
  };

  invocarBridge('insertarCajonera', payload);
}

/**
 * 6. Configura el fondo y las ranuras.
 */
function enviarFondo() {
  const payload = {
    tipo: document.getElementById('fondoTipo').value,
    prof_ranura: parseFloat(document.getElementById('fondoProfRanura').value),
    dist_ranura: parseFloat(document.getElementById('fondoDistRanura').value),
    espesor_fondo: parseFloat(document.getElementById('fondoEspesor').value)
  };

  invocarBridge('configurarFondo', payload);
}

/**
 * 7. Aplica tapacantos con cálculo automático de medida neta.
 */
function enviarTapacantos() {
  const payload = {
    canto_L1: parseFloat(document.getElementById('cantoL1').value),
    canto_L2: parseFloat(document.getElementById('cantoL2').value),
    canto_A1: parseFloat(document.getElementById('cantoA1').value),
    canto_A2: parseFloat(document.getElementById('cantoA2').value),
    aplicar_a: document.getElementById('cantoAplicarA').value
  };

  invocarBridge('aplicarTapacantos', payload);
}

/**
 * 8. Aplica mecanizados Minifix / Tarugos / Soberbios.
 */
function enviarMecanizados() {
  const payload = {
    sistema: document.getElementById('mecanizadoSistema').value,
    distancia_borde: parseFloat(document.getElementById('mecanizadoDistBorde').value)
  };

  invocarBridge('aplicarMecanizados', payload);
}

/**
 * 9. Asigna material y veta.
 */
function enviarMaterial() {
  const payload = {
    material_nombre: document.getElementById('matNombre').value,
    veta: document.getElementById('matVeta').value,
    color_hex: document.getElementById('matColor').value
  };

  invocarBridge('aplicarMaterial', payload);
}

/**
 * 10. Genera puertas batientes con luces.
 */
function enviarPuertas() {
  const payload = {
    tipo: document.getElementById('puertaTipo').value,
    cantidad_hojas: parseInt(document.getElementById('puertaHojas').value, 10),
    luz_perimetral: parseFloat(document.getElementById('puertaLuz').value),
    espesor: parseFloat(document.getElementById('puertaEspesor').value)
  };

  invocarBridge('generarPuertas', payload);
}

/**
 * 11. Solicita la extracción completa de despiece.
 */
function solicitarDespiece() {
  const soloSel = document.getElementById('chkSoloSeleccion') ? document.getElementById('chkSoloSeleccion').checked : false;
  invocarBridge('extraerDespiece', { solo_seleccion: soloSel });
}

/**
 * 12. Ejecuta la optimización 2D de cortes de guillotina.
 */
function ejecutarOptimizacion2D() {
  const payload = {
    tablero_largo: parseFloat(document.getElementById('optTabLargo').value || 2440),
    tablero_ancho: parseFloat(document.getElementById('optTabAncho').value || 2140),
    refilado: parseFloat(document.getElementById('optRefilado').value || 10),
    kerf: parseFloat(document.getElementById('optKerf').value || 4),
    estrategia_corte: document.getElementById('optEstrategia').value || 'longitudinal'
  };

  invocarBridge('optimizarCorte', payload);
}

/**
 * 13. Exporta la lista a formato CSV / Excel.
 * @param {string} formato - 'estandar' | 'pelikano' | 'masisa' | 'sodimac'
 */
function exportarDespiece(formato) {
  invocarBridge('exportarArchivo', {
    formato: formato,
    separador: document.getElementById('exportSeparador').value || ';'
  });
}

/**
 * Invoca de forma segura un callback expuesto en window.sketchup.
 */
function invocarBridge(accion, payload) {
  if (window.sketchup && typeof window.sketchup[accion] === 'function') {
    window.sketchup[accion](JSON.stringify(payload));
  } else {
    console.warn(`[Bridge] Acción '${accion}' invocada fuera de SketchUp con payload:`, payload);
    mostrarNotificacion(`Acción '${accion}' simulada en modo navegador.`, 'success');
  }
}

// ==============================================================================
// 4. Respuestas recibidas desde Ruby (Callbacks de Retorno)
// ==============================================================================

window.onModuloCreado = function(resultado) {
  if (resultado.ok) {
    mostrarNotificacion(resultado.mensaje || 'Módulo creado exitosamente.', 'success');
  } else {
    mostrarNotificacion(resultado.error || 'Error al crear el módulo.', 'error');
  }
};

window.onModuloSeleccionado = function(datos) {
  if (!datos) {
    mostrarNotificacion('No se detectó ningún módulo JPQMelaminaPro en la selección.', 'error');
    return;
  }
  AppState.moduloSeleccionado = datos;
  document.getElementById('editNombre').value = datos.nombre || '';
  document.getElementById('editAlto').value = datos.alto_mm || 0;
  document.getElementById('editAncho').value = datos.ancho_mm || 0;
  document.getElementById('editProfundidad').value = datos.prof_mm || 0;
  document.getElementById('editEspesor').value = datos.espesor_mm || 18;
  document.getElementById('editMaterial').value = datos.material || 'Melamina 18mm';

  document.getElementById('lblModuloActivo').textContent = `Módulo: ${datos.nombre} [${datos.modulo_id}]`;
  mostrarNotificacion(`Datos cargados del módulo: ${datos.nombre}`, 'success');
};

window.onDespieceExtraido = function(data) {
  AppState.despieceActual = data;
  renderizarTablaDespiece(data);
};

window.onCorteOptimizado = function(resultado) {
  if (!resultado.ok) {
    mostrarNotificacion(resultado.error || 'No se pudo optimizar el corte.', 'error');
    return;
  }

  // Actualizar indicadores numéricos
  document.getElementById('statTablerosUsados').textContent = resultado.total_tableros;
  document.getElementById('statAprovechamiento').textContent = `${(100.0 - resultado.desperdicio_total_pct).toFixed(1)}%`;
  document.getElementById('statMerma').textContent = `${resultado.desperdicio_total_pct}%`;

  // Pasar datos al renderizador Canvas 2D
  if (window.optimizerRenderer) {
    window.optimizerRenderer.cargarTableros(resultado.tableros);
  }
  mostrarNotificacion(`Optimización completada: ${resultado.total_tableros} tablero(s) generados.`, 'success');
};

window.onRepisasAplicadas = function(r) { mostrarNotificacion(r.mensaje, r.ok ? 'success' : 'error'); };
window.onCajoneraCreada = function(r) { mostrarNotificacion(r.mensaje, r.ok ? 'success' : 'error'); };
window.onFondoConfigurado = function(r) { mostrarNotificacion(r.mensaje, r.ok ? 'success' : 'error'); };
window.onTapacantosAplicados = function(r) { mostrarNotificacion(r.mensaje, r.ok ? 'success' : 'error'); };
window.onMecanizadosAplicados = function(r) { mostrarNotificacion(r.mensaje, r.ok ? 'success' : 'error'); };
window.onMaterialAplicado = function(r) { mostrarNotificacion(r.mensaje, r.ok ? 'success' : 'error'); };
window.onPuertasGeneradas = function(r) { mostrarNotificacion(r.mensaje, r.ok ? 'success' : 'error'); };
window.onModuloActualizado = function(r) { mostrarNotificacion(r.mensaje, r.ok ? 'success' : 'error'); };
window.onArchivoExportado = function(r) {
  if (r && r.ruta) {
    mostrarNotificacion(`Archivo exportado con éxito en:\n${r.ruta}`, 'success');
  } else {
    mostrarNotificacion('Operación de exportación completada.', 'success');
  }
};

// ==============================================================================
// 5. Utilidades y Renderizado de Tablas
// ==============================================================================

/**
 * Renderiza la lista completa de despiece y actualiza las tarjetas de resumen.
 */
function renderizarTablaDespiece(data) {
  const tbody = document.getElementById('despieceTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  const piezas = data.piezas || [];

  if (piezas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 20px; color: var(--text-muted);">No se encontraron piezas en el modelo. Diseña un módulo primero.</td></tr>';
    return;
  }

  piezas.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center; font-weight: 700;">${p.item_numero}</td>
      <td><strong>${p.nombre}</strong><br><small style="color:var(--text-muted);">${p.detalle_piezas || ''}</small></td>
      <td style="text-align:center; font-weight: 700; color: ${p.espesor === 3 ? 'var(--warning)' : 'var(--primary)'};">${p.espesor} mm</td>
      <td style="text-align:center;"><span class="badge badge-blue">${p.cantidad}</span></td>
      <td style="text-align:right;">${p.largo_bruto}</td>
      <td style="text-align:right;">${p.ancho_bruto}</td>
      <td style="text-align:right; font-weight:700; color:var(--primary);">${p.largo_neto}</td>
      <td style="text-align:right; font-weight:700; color:var(--primary);">${p.ancho_neto}</td>
      <td>${p.material}</td>
      <td style="font-size:11px;">L:[${p.canto_L1}|${p.canto_L2}] A:[${p.canto_A1}|${p.canto_A2}]</td>
      <td><small>${p.ranura}</small></td>
    `;
    tbody.appendChild(tr);
  });

  // Métricas del pie
  const m = data.metricas || {};
  document.getElementById('metricTotalPiezas').textContent = m.total_piezas || 0;
  document.getElementById('metricTotalM2').textContent = `${m.area_total_m2 || 0} m²`;
  document.getElementById('metricCantoDelgado').textContent = `${m.canto_delgado_metros || 0} m`;
  document.getElementById('metricCantoGrueso').textContent = `${m.canto_grueso_metros || 0} m`;
}

/**
 * Actualiza la etiqueta de cota neta en el previsualizador de tapacantos.
 */
function actualizarPrevisualizacionCorteNeto() {
  const l1 = parseFloat(document.getElementById('cantoL1').value || 0);
  const l2 = parseFloat(document.getElementById('cantoL2').value || 0);
  const a1 = parseFloat(document.getElementById('cantoA1').value || 0);
  const a2 = parseFloat(document.getElementById('cantoA2').value || 0);

  const descL = l1 + l2;
  const descA = a1 + a2;

  const lbl = document.getElementById('lblDescuentoCantos');
  if (lbl) {
    lbl.textContent = `Descuento Largo: -${descL}mm | Descuento Ancho: -${descA}mm`;
  }
}

/**
 * Muestra un banner flotante de notificación temporal.
 */
function mostrarNotificacion(mensaje, tipo = 'success') {
  const contenedor = document.getElementById('notificationArea');
  if (!contenedor) return;

  const div = document.createElement('div');
  div.className = `notification notification-${tipo}`;
  div.textContent = mensaje;
  contenedor.innerHTML = '';
  contenedor.appendChild(div);

  setTimeout(() => {
    if (div.parentNode) div.parentNode.removeChild(div);
  }, 4000);
}
