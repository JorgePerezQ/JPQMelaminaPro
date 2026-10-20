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
    themeSelector.addEventListener('change', (e) => cambiarTema(e.target.value));
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
// 2. Navegación por Pestañas
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
    tiene_fondo: document.getElementById('modFondo').checked,
    prof_ranura: parseFloat(document.getElementById('modProfRanura').value || 8),
    dist_ranura: parseFloat(document.getElementById('modDistRanura').value || 18),
    tiene_repisa: document.getElementById('modRepisasCheck').checked,
    cantidad_repisas: parseInt(document.getElementById('modCantRepisas').value || 1, 10),
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
