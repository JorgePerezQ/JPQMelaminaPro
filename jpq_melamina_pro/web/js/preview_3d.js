/**
 * ==============================================================================
 * JPQMelaminaPro - Motor de Previsualización Paramétrica 2D / 3D (Canvas HTML5)
 * ==============================================================================
 * Desarrollado para UI::HtmlDialog de SketchUp y visualizador interactivo.
 * Soporta los 3 estados solicitados por el usuario:
 *   1. ESTADO VACÍO:
 *      Lado derecho completamente limpio con retícula milimétrica CAD y mensaje guía.
 *   2. ESTADO DELINEADO:
 *      Rectángulo/volumen envolvente delineado con líneas técnicas discontinuas
 *      y cotas acotadas milimétricas según las dimensiones totales (W x H x D).
 *   3. ESTADO MÓDULOS ARMADOS:
 *      Estructuras paramétricas completas (espesor de melamina 15/18mm, laterales,
 *      pisos, techos, zócalos con listones, repisas, cajones y puertas)
 *      con cotas individuales por módulo y recálculo visual en tiempo real.
 * ==============================================================================
 */

const Preview3D = (function() {
  let canvas = null;
  let ctx = null;

  // Parámetros de la cámara 3D interactiva
  const camera = {
    azimuth: Math.PI / 5.5,    // Ángulo horizontal alrededor del eje Z
    elevation: Math.PI / 7.5,  // Inclinación vertical
    zoom: 1.0,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    vistaActual: 'iso'         // 'iso', 'front', 'top', 'side'
  };

  // Opciones de visualización técnica
  const renderOptions = {
    modoRender: 'solido',      // 'solido' (melamina con luz) o 'alambre' (CAD técnico)
    mostrarCotas: true,        // Cotas milimétricas visibles
    mostrarEjes: true,         // Eje Rojo / Verde de SketchUp
    mostrarRejilla: true       // Retícula milimétrica
  };

  // Callback cuando se hace clic sobre un módulo en el lienzo
  let onModuleSelectCallback = null;

  // Estado del modelo activo
  let currentData = {
    estado: 'vacio',           // 'vacio' | 'delineado' | 'modulos'
    ancho_total: 0,
    alto_total: 0,
    prof_total: 0,
    espesor: 18,
    material: 'Pelikano Blanco Nieve 18mm',
    modo_seleccion: 'diseno',  // 'diseno' (todo el mueble) | 'modulo' (módulo individual)
    modulo_activo: -1,
    modulos: []
  };

  // Catálogo fotorrealista de melaminas comerciales (Novopan / Pelikano, Arauco / Vesto, Universales)
  const materialColors = {
    'Pelikano Bellota 18mm': { base: [141, 91, 54], border: '#4E2D16', edge: '#724222' },
    'Pelikano Macadamia 18mm': { base: [185, 155, 120], border: '#7C6042', edge: '#9B7B58' },
    'Pelikano Rovere 18mm': { base: [168, 139, 103], border: '#684E2E', edge: '#8F6F47' },
    'Pelikano Caramel 18mm': { base: [166, 104, 56], border: '#6E3E18', edge: '#995B2A' },
    'Pelikano Coñac 18mm': { base: [122, 62, 38], border: '#451B0C', edge: '#6B3019' },
    'Pelikano Duna 18mm': { base: [214, 199, 178], border: '#94836D', edge: '#BDB09B' },
    'Pelikano Niebla 18mm': { base: [194, 195, 191], border: '#82847E', edge: '#AEB0A9' },
    'Pelikano Carbono 18mm': { base: [51, 54, 59], border: '#1A1C1F', edge: '#2E3136' },
    'Pelikano Blanco Nieve 18mm': { base: [245, 246, 248], border: '#CBD5E1', edge: '#E2E8F0' },
    'Pelikano Óxido 18mm': { base: [107, 79, 67], border: '#422C24', edge: '#66493D' },
    'Vesto Roble Cendra 18mm': { base: [158, 140, 120], border: '#5E4E3E', edge: '#857462' },
    'Vesto Aserrado 18mm': { base: [180, 146, 108], border: '#775734', edge: '#A0794F' },
    'Vesto Seda Giorno 18mm': { base: [142, 126, 115], border: '#54463C', edge: '#756457' },
    'Vesto Linosa 18mm': { base: [183, 169, 152], border: '#7E6E5A', edge: '#A69680' },
    'Vesto Blanco Frost 18mm': { base: [242, 244, 245], border: '#CBD5E1', edge: '#E2E8F0' },
    'Melamina Blanca 18mm': { base: [245, 247, 250], border: '#94A3B8', edge: '#E2E8F0' },
    'Melamina Roble Natural 18mm': { base: [214, 166, 117], border: '#8C5B32', edge: '#B87A40' },
    'Melamina Nogal Terracota 18mm': { base: [110, 70, 49], border: '#422414', edge: '#663B23' },
    'Melamina Gris Antracita 18mm': { base: [56, 62, 68], border: '#1E293B', edge: '#334155' }
  };

  /**
   * Resuelve los colores fotorrealistas para un material determinado.
   */
  function obtenerPaleta(matNombre) {
    if (!matNombre) return materialColors['Pelikano Blanco Nieve 18mm'];
    if (materialColors[matNombre]) return materialColors[matNombre];

    const norm = matNombre.toLowerCase();
    for (const [k, v] of Object.entries(materialColors)) {
      if (norm.includes(k.toLowerCase()) || k.toLowerCase().includes(norm)) {
        return v;
      }
    }

    if (matNombre.startsWith('#') && matNombre.length >= 7) {
      const r = parseInt(matNombre.slice(1, 3), 16) || 200;
      const g = parseInt(matNombre.slice(3, 5), 16) || 160;
      const b = parseInt(matNombre.slice(5, 7), 16) || 120;
      return {
        base: [r, g, b],
        border: `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`,
        edge: `rgb(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)})`
      };
    }

    return materialColors['Pelikano Blanco Nieve 18mm'];
  }

  /**
   * Inicializa el visor 3D enlazando el canvas y los eventos de ratón.
   * @param {string} canvasId - ID del elemento canvas HTML.
   * @param {Function} onSelectCallback - Callback al hacer clic en un módulo.
   */
  function init(canvasId, onSelectCallback) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    onModuleSelectCallback = onSelectCallback || null;

    // Manejadores de ratón para órbita 3D y selección
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', () => setView('iso'));

    // Detección de clics para selección directa de módulos
    canvas.addEventListener('click', onCanvasClick);

    // Redimensionamiento responsive
    window.addEventListener('resize', () => {
      ajustarTamano();
      render();
    });

    ajustarTamano();
    render();
  }

  /**
   * Sincroniza dinámicamente el búfer interno del canvas con el tamaño real CSS del contenedor.
   * Evita distorsiones, bordes borrosos y desajustes de resolución en cualquier pantalla o DPI.
   * @returns {{w: number, h: number}} Dimensiones en píxeles CSS para el cálculo de proyección.
   */
  function sincronizarCanvas() {
    if (!canvas || !ctx) return { w: 800, h: 600 };
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(200, Math.floor(rect.width));
    const h = Math.max(200, Math.floor(rect.height));

    const pixelW = Math.floor(w * dpr);
    const pixelH = Math.floor(h * dpr);

    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }

    // Restablecer matriz identidad y escalar únicamente por el ratio de píxeles del dispositivo (DPR)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    return { w, h };
  }

  function ajustarTamano() {
    sincronizarCanvas();
  }

  /**
   * Inicia el arrastre de órbita 3D con el ratón.
   */
  function onMouseDown(e) {
    camera.isDragging = true;
    camera.lastMouseX = e.clientX;
    camera.lastMouseY = e.clientY;
    if (canvas) canvas.style.cursor = 'grabbing';
  }

  /**
   * Actualiza el ángulo de la cámara al arrastrar con el ratón.
   */
  function onMouseMove(e) {
    if (!camera.isDragging) return;
    const dx = e.clientX - camera.lastMouseX;
    const dy = e.clientY - camera.lastMouseY;

    camera.azimuth += dx * 0.01;
    // Permite inclinar la cámara ligeramente hacia arriba (hasta -PI/6) para inspeccionar la parte inferior del zócalo
    camera.elevation = Math.max(-Math.PI / 6, Math.min(Math.PI / 2.02, camera.elevation + dy * 0.01));
    camera.lastMouseX = e.clientX;
    camera.lastMouseY = e.clientY;
    render();
  }

  /**
   * Finaliza el arrastre de la cámara.
   */
  function onMouseUp() {
    camera.isDragging = false;
    if (canvas) canvas.style.cursor = 'grab';
  }

  /**
   * Zoom progresivo con la rueda del ratón.
   */
  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY * -0.0012;
    camera.zoom = Math.max(0.4, Math.min(3.0, camera.zoom + delta));
    render();
  }

  /**
   * Cambia el ángulo de la cámara a una vista técnica predefinida.
   * @param {string} view - 'iso' | 'front' | 'top' | 'side'
   */
  function setView(view) {
    camera.vistaActual = view;
    switch (view) {
      case 'front':
        camera.azimuth = 0;
        camera.elevation = 0.001; // Vista 2D ortogonal de frente
        break;
      case 'side':
        camera.azimuth = Math.PI / 2;
        camera.elevation = 0.001; // Vista lateral
        break;
      case 'top':
        camera.azimuth = 0;
        camera.elevation = Math.PI / 2.001; // Vista en planta
        break;
      case 'iso':
      default:
        camera.azimuth = Math.PI / 5.5;
        camera.elevation = Math.PI / 7.5; // Vista isométrica técnica
        break;
    }
    camera.zoom = 1.0;
    render();
  }

  /**
   * Alterna entre modo de visualización Sólido (melamina) y Alambre (wireframe CAD).
   */
  function setRenderMode(modo) {
    renderOptions.modoRender = modo;
    render();
  }

  /**
   * Conmuta la visibilidad de cotas milimétricas.
   */
  function toggleCotas(mostrar) {
    renderOptions.mostrarCotas = (mostrar !== undefined) ? mostrar : !renderOptions.mostrarCotas;
    render();
  }

  /**
   * Actualiza los datos del modelo y re-renderiza inmediatamente.
   * @param {Object} newData - Datos globales y array de módulos.
   */
  function update(newData) {
    currentData = Object.assign({}, currentData, newData);
    render();
  }

  /**
   * Genera los prismas geométricos [x, y, z, dx, dy, dz] para todos los módulos.
  /**
   * Calcula las coordenadas espaciales X y elevación Z (apilado vertical) para cada módulo/submódulo.
   * Soporta submódulos apilados verticalmente y submódulos subdivididos uno al lado del otro en un nivel específico.
   * @param {Array} modulos - Lista de módulos.
   * @returns {Array<{ xPos: number, zBaseStack: number, wMod: number, hMod: number, colIdx: number, nivel: number, wCol: number }>}
   */
  function calcularGeometriaColumnasYApilado(modulos, dataOverride) {
    const mapeo = [];
    const columnasMap = new Map();
    const d = dataOverride || currentData || {};
    const tieneZocaloGlobal = (d.tiene_zocalo === true || d.tiene_zocalo === 'true');
    const zocaloGlobalH = tieneZocaloGlobal ? (parseFloat(d.alto_zocalo) || 100) : 0;

    modulos.forEach((m, idx) => {
      const cIdx = (m.columna_idx !== undefined && m.columna_idx !== null) ? m.columna_idx : idx;
      const nIdx = (m.nivel_apilado !== undefined && m.nivel_apilado !== null) ? m.nivel_apilado : 0;
      const scIdx = (m.sub_col_idx !== undefined && m.sub_col_idx !== null) ? m.sub_col_idx : idx;
      if (!columnasMap.has(cIdx)) {
        columnasMap.set(cIdx, []);
      }
      columnasMap.get(cIdx).push({ m, originalIdx: idx, nivel: nIdx, subCol: scIdx });
    });

    const columnasOrdenadas = Array.from(columnasMap.entries()).sort((a, b) => a[0] - b[0]);

    let xAcumulado = 0;
    columnasOrdenadas.forEach(([cIdx, items]) => {
      // Agrupar items de la columna por nivel_apilado
      const nivelesMap = new Map();
      items.forEach(item => {
        const n = item.nivel;
        if (!nivelesMap.has(n)) {
          nivelesMap.set(n, []);
        }
        nivelesMap.get(n).push(item);
      });

      const nivelesOrdenados = Array.from(nivelesMap.entries()).sort((a, b) => a[0] - b[0]);

      // Ancho total representativo de la columna: el mayor ancho ocupado por cualquiera de sus niveles
      let wColMax = 0;
      nivelesOrdenados.forEach(([n, subItems]) => {
        const wNivel = subItems.reduce((sum, it) => sum + (it.m.ancho || 0), 0);
        if (wNivel > wColMax) wColMax = wNivel;
      });
      if (wColMax <= 0) wColMax = 600;

      let zAcumulado = tieneZocaloGlobal ? zocaloGlobalH : 0;
      nivelesOrdenados.forEach(([n, subItems]) => {
        // Ordenar submódulos del mismo nivel por su sub_col_idx o índice de creación
        subItems.sort((a, b) => a.subCol - b.subCol);

        const hNivel = (subItems[0].m.alto && subItems[0].m.alto > 0) ? subItems[0].m.alto : 2100;
        let xEnNivel = 0;

        subItems.forEach(item => {
          const wMod = (item.m.ancho && item.m.ancho > 0) ? item.m.ancho : (wColMax / subItems.length);
          const hMod = (item.m.alto && item.m.alto > 0) ? item.m.alto : hNivel;

          mapeo[item.originalIdx] = {
            xPos: xAcumulado + xEnNivel,
            zBaseStack: zAcumulado,
            wMod: wMod,
            hMod: hMod,
            colIdx: cIdx,
            nivel: n,
            wCol: wColMax
          };
          xEnNivel += wMod;
        });

        zAcumulado += hNivel;
      });

      xAcumulado += wColMax;
    });

    return mapeo;
  }

  /**
   * Calcula la cantidad y ubicaciones exactas de los listones transversales de zócalo
   * dividiendo el área interior del zócalo en partes proporcionales iguales y
   * respetando la separación mínima permitida en carpintería industrial (>= 150mm libre)
   * y la norma anti-pandeo (<= 600mm).
   * 
   * Por ejemplo:
   * - 1 listón: divide el interior en 2 partes iguales (al centro, 1/2 c/u).
   * - 2 listones: divide el interior en 3 partes iguales (a 1/3 y 2/3 c/u).
   * - 3 listones: divide el interior en 4 partes iguales (a 1/4, 2/4 y 3/4 c/u).
   * - N listones: divide el interior en N+1 partes iguales.
   * @param {number} anchoTotal - Ancho total del mueble en mm.
   * @param {number} profTotal - Profundidad total del mueble en mm.
   * @param {Array} modulos - Módulos definidos en la composición.
   * @param {number} t - Espesor de la melamina en mm.
   * @param {number} altoZocalo - Altura del zócalo en mm.
   * @param {number} retransZocalo - Retranqueo frontal en mm.
   * @param {string|number} cantConfig - 'auto' o número manual de listones.
   * @returns {Object} { listones, cantSugerida, cantActual, separacionMax, separacionMin, cantMaxPermitida, cumpleNorma, mensajeNorma, tipoAlerta }
   */
  function calcularListonesZocaloEstandar(anchoTotal, profTotal, modulos, t, altoZocalo, retransZocalo, cantConfig) {
    anchoTotal = Math.max(0, parseFloat(anchoTotal) || 0);
    profTotal = Math.max(0, parseFloat(profTotal) || 0);
    t = Math.max(1, parseFloat(t) || 18);
    retransZocalo = (retransZocalo !== undefined && retransZocalo !== null && retransZocalo !== '' && !isNaN(retransZocalo))
      ? Math.max(0, parseFloat(retransZocalo))
      : 35;

    const SEPARACION_MINIMA_MM = 150; // Norma técnica de carpintería: separación libre mínima entre listones
    const NORMA_LUZ_MAXIMA_MM = 600;  // Norma de flecha y pandeo en melamina

    const profTrans = Math.max(0, profTotal - retransZocalo - (2 * t));
    const anchoInterior = Math.max(0, anchoTotal - (2 * t));

    if (anchoTotal <= 0 || profTotal <= 0 || profTrans <= 0 || anchoInterior <= 0) {
      return {
        listones: [],
        cantSugerida: 0,
        cantActual: 0,
        separacionMax: 0,
        separacionMin: 0,
        cantMaxPermitida: 0,
        cumpleNorma: true,
        mensajeNorma: 'Dimensiones insuficientes para listones interiores.',
        tipoAlerta: 'info'
      };
    }

    // Cantidad máxima permitida manteniendo separación libre >= 150mm:
    // (N + 1) * 150 + N * t <= anchoInterior => N * (150 + t) <= anchoInterior - 150
    const cantMaxPermitida = Math.max(0, Math.floor((anchoInterior - SEPARACION_MINIMA_MM) / (SEPARACION_MINIMA_MM + t)));

    // Cantidad sugerida según norma anti-pandeo (<= 600 mm)
    const cantSugeridaAuto = Math.max(0, Math.ceil(anchoInterior / NORMA_LUZ_MAXIMA_MM) - 1);
    const cantSugeridaFinal = Math.min(cantSugeridaAuto, cantMaxPermitida);

    // Cantidad N seleccionada
    let N = 0;
    const esAuto = (cantConfig === 'auto' || cantConfig === undefined || cantConfig === null || cantConfig === '');
    if (esAuto) {
      N = cantSugeridaFinal;
    } else {
      N = Math.max(0, parseInt(cantConfig) || 0);
    }

    // Auditoría de cumplimiento: ¿La cantidad elegida deja separación < 150mm?
    const partesIguales = N + 1;
    const pasoProporcional = (N > 0) ? (anchoInterior / partesIguales) : anchoInterior;
    const separacionLibre = (N > 0) ? Math.round(pasoProporcional - t) : anchoInterior;

    const excedeMinima = (N > 0 && separacionLibre < SEPARACION_MINIMA_MM);
    const excedeMaxima = (separacionLibre > NORMA_LUZ_MAXIMA_MM);

    const listones = [];

    if (N > 0) {
      for (let k = 1; k <= N; k++) {
        const xCentro = t + (k * pasoProporcional);
        const xPos = Math.round(xCentro - (t / 2));

        let nombreListon = `Listón Soporte Zócalo ${k}/${N} (Divide interior en ${partesIguales} partes)`;
        if (N === 1) {
          nombreListon = `Listón Soporte Zócalo Central (Divide interior en 2 partes)`;
        }

        listones.push({
          x: xPos,
          y: retransZocalo + t,
          z: 0,
          dx: t,
          dy: profTrans,
          dz: altoZocalo,
          tipo: (N === 1) ? 'central' : 'proporcional',
          nombre: nombreListon,
          moduloIndex: -1,
          esListonSoporteZocalo: true,
          esZocaloBase: true
        });
      }
    }

    const cumpleNorma = !excedeMinima && !excedeMaxima;

    let mensajeNorma = '';
    let tipoAlerta = 'success';

    if (excedeMinima) {
      tipoAlerta = 'danger';
      mensajeNorma = `⛔ NO PERMITIDO: ${N} listones en ${anchoTotal} mm deja una separación de solo ${separacionLibre} mm (mínimo reglamentario: ${SEPARACION_MINIMA_MM} mm). Máximo permitido para este ancho: ${cantMaxPermitida} listón(es).`;
    } else if (excedeMaxima) {
      tipoAlerta = 'warning';
      mensajeNorma = `⚠️ Separación de ${separacionLibre} mm excede la norma de 600 mm para evitar pandeo. Se sugieren mín. ${cantSugeridaFinal} listón(es).`;
    } else if (N === 0) {
      mensajeNorma = `✓ Marco perimétrico base sin listones: luz interior de ${anchoInterior} mm ≤ 600 mm (estable sin refuerzos).`;
    } else {
      mensajeNorma = `✓ ${N} listón(es) dividen el interior en ${partesIguales} partes iguales de ~${Math.round(pasoProporcional)} mm (separación libre: ${separacionLibre} mm ≥ 150 mm). Cumple estándar técnico.`;
    }

    return {
      listones,
      cantSugerida: cantSugeridaFinal,
      cantActual: N,
      cantMaxPermitida,
      separacionMax: separacionLibre,
      separacionMin: separacionLibre,
      cumpleNorma,
      mensajeNorma,
      tipoAlerta
    };
  }

  /**
   * Genera los prismas 3D de cada pieza de la composición paramétrica.
   * @param {Object} [dataOverride] - Datos opcionales para generación sin pasar por currentData.
   */
  function generarPrismasModulos(dataOverride) {
    const d = dataOverride || currentData;
    const t = d.espesor || 18;
    const mat = d.material || 'Pelikano Blanco Nieve 18mm';
    const modulos = d.modulos || [];
    const prismas = [];

    const geomMapeo = calcularGeometriaColumnasYApilado(modulos, d);

    // ZÓCALO INFERIOR GLOBAL CONTINUO (ocupa todo el perímetro inferior del mueble)
    const tieneZocaloGlobal = (d.tiene_zocalo === true || d.tiene_zocalo === 'true');
    const zocaloGlobalH = tieneZocaloGlobal ? (parseFloat(d.alto_zocalo) || 100) : 0;

    if (tieneZocaloGlobal && zocaloGlobalH > 0) {
      const anchoTotal = d.ancho_total || (modulos.reduce((sum, it) => sum + (it.ancho || 0), 0)) || 2400;
      const profTotal = d.prof_total || 600;
      const retransZocalo = (d.retrans_zocalo !== undefined && d.retrans_zocalo !== null && d.retrans_zocalo !== '' && !isNaN(d.retrans_zocalo))
        ? Math.max(0, parseFloat(d.retrans_zocalo))
        : 35;
      const cantConfig = d.cant_listones;
      const profTrans = Math.max(10, profTotal - retransZocalo - (2 * t));

      // 1. Zócalo Frontal Continuo (ABARCA TODO EL ANCHO DEL MUEBLE: X = 0 a X = AnchoTotal)
      prismas.push({
        x: 0, y: retransZocalo, z: 0,
        dx: anchoTotal, dy: t, dz: zocaloGlobalH,
        mat, name: 'Zócalo Frontal Continuo',
        moduloIndex: -1,
        esZocaloFrontal: true,
        esZocaloBase: true
      });

      // 2. Zócalo Posterior Continuo (ABARCA TODO EL ANCHO DEL MUEBLE: X = 0 a X = AnchoTotal)
      prismas.push({
        x: 0, y: profTotal - t, z: 0,
        dx: anchoTotal, dy: t, dz: zocaloGlobalH,
        mat, name: 'Zócalo Posterior Continuo',
        moduloIndex: -1,
        esZocaloBase: true
      });

      // 3. Lateral Izquierdo de Zócalo (ENTRE frontal y posterior: Y = retransZocalo + t hasta profTotal - t)
      prismas.push({
        x: 0, y: retransZocalo + t, z: 0,
        dx: t, dy: profTrans, dz: zocaloGlobalH,
        mat, name: 'Zócalo Lateral Izquierdo',
        moduloIndex: -1,
        esZocaloBase: true
      });

      // 4. Lateral Derecho de Zócalo (ENTRE frontal y posterior: Y = retransZocalo + t hasta profTotal - t)
      prismas.push({
        x: anchoTotal - t, y: retransZocalo + t, z: 0,
        dx: t, dy: profTrans, dz: zocaloGlobalH,
        mat, name: 'Zócalo Lateral Derecho',
        moduloIndex: -1,
        esZocaloBase: true
      });

      // 5. Listones transversales interiores de soporte (ENTRE frontal y posterior)
      const calculoListones = calcularListonesZocaloEstandar(
        anchoTotal, profTotal, modulos, t, zocaloGlobalH, retransZocalo, cantConfig
      );

      calculoListones.listones.forEach(l => {
        prismas.push({
          x: l.x, y: l.y, z: l.z,
          dx: l.dx, dy: l.dy, dz: l.dz,
          mat, name: l.nombre,
          moduloIndex: -1,
          tipo: l.tipo,
          esListonSoporteZocalo: true,
          esNoPermitido: !calculoListones.cumpleNorma,
          esZocaloBase: true
        });
      });
    }

    modulos.forEach((m, idx) => {
      const geom = geomMapeo[idx] || { xPos: 0, zBaseStack: (tieneZocaloGlobal ? zocaloGlobalH : 0), wMod: m.ancho || 600, hMod: m.alto || d.alto_total || 2100 };
      const wMod = geom.wMod;
      const hMod = m.alto || d.alto_total || 2100;
      const profMod = m.profundidad || d.prof_total || 600;
      const xMod = geom.xPos;
      const zStack = geom.zBaseStack;

      // 1. ZÓCALO Y CARCASA ESTRUCTURAL (Laterales, Piso y Techo)
      // Si el zócalo es global, el módulo no duplica zócalo inferior individual
      const tieneZocalo = !tieneZocaloGlobal && (m.tiene_zocalo === true || m.tiene_zocalo === 'true');
      const zocaloH = tieneZocalo ? (parseFloat(m.alto_zocalo) || 100) : 0;
      const rawCantListones = parseInt(m.cant_listones);
      const cantInternosZocalo = (m.cant_listones_internos !== undefined && m.cant_listones_internos !== null)
        ? Math.max(0, parseInt(m.cant_listones_internos) || 0)
        : (isNaN(rawCantListones) ? 0 : Math.max(0, rawCantListones));
      const retransZocalo = (m.retrans_zocalo !== undefined && m.retrans_zocalo !== '')
        ? parseFloat(m.retrans_zocalo)
        : (m.retransporte_zocalo !== undefined ? parseFloat(m.retransporte_zocalo) : 35);

      // Selector de Laterales (Costados): Si está desactivado, se retiran los laterales quedando vacío lateralmente
      const tieneLaterales = (m.tiene_laterales !== false && m.tiene_laterales !== 'false');
      const xOffsetInt = tieneLaterales ? t : 0;
      const anchoInt = tieneLaterales ? (wMod - (2 * t)) : wMod;

      // Piso y Techo de Carcasa (con soporte para listones de piso y techo)
      const tienePiso = (m.tiene_piso !== false && m.tiene_piso !== 'false');
      const usaAmarresPiso = tienePiso && (m.tiene_liston_piso === true || m.tiene_liston_piso === 'true');

      const tieneTecho = (m.tiene_techo !== false && m.tiene_techo !== 'false');
      const usaAmarresTecho = tieneTecho && ((m.tiene_liston_techo === true || m.tiene_liston_techo === 'true') ||
        ((m.tiene_liston_amarre === true || m.tiene_liston_amarre === 'true') && (m.posicion_liston_amarre === 'techo' || m.posicion_liston_amarre === 'ambos')));

      const techoSobreListon = usaAmarresTecho && (m.techo_sobre_liston === true || m.techo_sobre_liston === 'true');
      const esDobleMelamina = m.techo_doble_melamina === true || m.techo_doble_melamina === 'true';
      const hTecho = (tieneTecho && techoSobreListon) ? (esDobleMelamina ? (2 * t) : t) : 0;

      // Zócalo Superior
      const tieneZocaloSup = (m.tiene_zocalo_sup === true || m.tiene_zocalo_sup === 'true');
      const zocaloSupH = tieneZocaloSup ? (parseFloat(m.alto_zocalo_sup) || 70) : 0;

      // Los laterales (costados) van sobre el zócalo inferior (z = zBase) y continúan hasta el tope superior
      const hLateral = hMod - zocaloH - hTecho;
      const hCarcasa = hMod - zocaloH - hTecho - zocaloSupH;
      const zBase = zStack + zocaloH;
      const zIntBase = zBase + (tienePiso ? t : 0);

      // Costados Izquierdo y Derecho (solo si tieneLaterales está activado)
      if (tieneLaterales) {
        prismas.push({
          x: xMod, y: 0, z: zBase,
          dx: t, dy: profMod, dz: hLateral,
          mat, name: `M${idx + 1} Lateral Izq`,
          moduloIndex: idx
        });

        prismas.push({
          x: xMod + wMod - t, y: 0, z: zBase,
          dx: t, dy: profMod, dz: hLateral,
          mat, name: `M${idx + 1} Lateral Der`,
          moduloIndex: idx
        });
      }

      // Zócalo Inferior Perimétrico Base (rectángulo perimétrico + listones interiores)
      if (tieneZocalo && zocaloH > 0) {
        const largoLatZocalo = Math.max(50, profMod - retransZocalo);
        // El ancho entre laterales propios del zócalo es siempre wMod - 2*t,
        // independiente de si la carcasa superior lleva costados laterales o no.
        const anchoZocaloPerim = Math.max(0, wMod - (2 * t));

        // 1. Listón frontal (va entre los laterales de zócalo)
        prismas.push({
          x: xMod + t, y: retransZocalo, z: zStack,
          dx: anchoZocaloPerim, dy: t, dz: zocaloH,
          mat, name: `M${idx + 1} Zócalo Frontal`,
          moduloIndex: idx,
          esZocaloFrontal: true
        });

        // 2. Listón posterior (va entre los laterales de zócalo)
        prismas.push({
          x: xMod + t, y: profMod - t, z: zStack,
          dx: anchoZocaloPerim, dy: t, dz: zocaloH,
          mat, name: `M${idx + 1} Zócalo Posterior`,
          moduloIndex: idx
        });

        // 3. Lateral Izquierdo de Zócalo (cierra el perímetro)
        prismas.push({
          x: xMod, y: retransZocalo, z: zStack,
          dx: t, dy: largoLatZocalo, dz: zocaloH,
          mat, name: `M${idx + 1} Zócalo Lateral Izquierdo`,
          moduloIndex: idx
        });

        // 4. Lateral Derecho de Zócalo (cierra el perímetro)
        prismas.push({
          x: xMod + wMod - t, y: retransZocalo, z: zStack,
          dx: t, dy: largoLatZocalo, dz: zocaloH,
          mat, name: `M${idx + 1} Zócalo Lateral Derecho`,
          moduloIndex: idx
        });

        // 5. Listones transversales interiores de soporte del zócalo
        // Proporcionan sustento directo en la base al mueble o divisiones situadas encima:
        // - 1 listón: centrado en el bloque (wMod / 2).
        // - 2 listones: dividen el bloque en 3 partes iguales (un tercio cada uno, a 1/3 y 2/3).
        // - N listones: dividen el bloque en N + 1 partes iguales.
        if (cantInternosZocalo > 0) {
          const profTrans = profMod - retransZocalo - (2 * t);
          if (profTrans > 0) {
            for (let k = 1; k <= cantInternosZocalo; k++) {
              const frac = k / (cantInternosZocalo + 1);
              const xTrans = xMod + (wMod * frac) - (t / 2);
              const descNombre = (cantInternosZocalo === 1)
                ? `M${idx + 1} Listón Soporte Zócalo Central`
                : `M${idx + 1} Listón Soporte Zócalo ${k}/${cantInternosZocalo}`;

              prismas.push({
                x: xTrans, y: retransZocalo + t, z: zStack,
                dx: t, dy: profTrans, dz: zocaloH,
                mat, name: descNombre,
                moduloIndex: idx,
                esListonSoporteZocalo: true
              });
            }
          }
        }
      }

      // Piso de la Carcasa (apoya sobre el zócalo a altura zBase)
      if (tienePiso) {
        if (usaAmarresPiso) {
          const cantPiso = Math.max(1, parseInt(m.cant_listones_piso || 2));
          const wUserPiso = parseFloat(m.ancho_liston_piso || m.medida_liston_piso);
          const wListonPiso = (wUserPiso && wUserPiso > 0) ? wUserPiso : 80;

          if (cantPiso === 1) {
            prismas.push({
              x: xMod + xOffsetInt, y: 0, z: zBase,
              dx: anchoInt, dy: wListonPiso, dz: t,
              mat, name: `M${idx + 1} Amarre Piso Frontal`,
              moduloIndex: idx
            });
          } else {
            const espacioGapsPiso = Math.max(0, profMod - (cantPiso * wListonPiso));
            const pasoGapPiso = espacioGapsPiso / (cantPiso - 1);

            for (let k = 0; k < cantPiso; k++) {
              const yPos = Math.round(k * (wListonPiso + pasoGapPiso));
              let nom = `M${idx + 1} Amarre Piso `;
              if (k === 0) nom += 'Frontal';
              else if (k === cantPiso - 1) nom += 'Posterior';
              else nom += `Intermedio ${k}`;

              prismas.push({
                x: xMod + xOffsetInt, y: yPos, z: zBase,
                dx: anchoInt, dy: wListonPiso, dz: t,
                mat, name: nom,
                moduloIndex: idx
              });
            }
          }
        } else {
          // Piso Sólido Completo Estándar
          prismas.push({
            x: xMod + xOffsetInt, y: 0, z: zBase,
            dx: anchoInt, dy: profMod, dz: t,
            mat, name: `M${idx + 1} Piso Carcasa`,
            moduloIndex: idx
          });
        }
      }

      // Techo de la Carcasa / Amarres de Techo con distribución milimétrica exacta sin solapamientos
      if (tieneTecho) {
        if (usaAmarresTecho) {
          const cantTecho = Math.max(1, parseInt(m.cant_listones_techo || m.cant_listones_amarre || 2));
          const wUser = parseFloat(m.ancho_liston_techo || m.medida_liston_techo || m.alto_liston_amarre || m.ancho_liston);
          const wListonTecho = (wUser && wUser > 0) ? wUser : 80;

          if (cantTecho === 1) {
            prismas.push({
              x: xMod + xOffsetInt, y: 0, z: zBase + hCarcasa - t,
              dx: anchoInt, dy: wListonTecho, dz: t,
              mat, name: `M${idx + 1} Amarre Techo Frontal`,
              moduloIndex: idx
            });
          } else {
            const espacioGaps = Math.max(0, profMod - (cantTecho * wListonTecho));
            const pasoGap = espacioGaps / (cantTecho - 1);

            for (let k = 0; k < cantTecho; k++) {
              const yPos = Math.round(k * (wListonTecho + pasoGap));
              let nom = `M${idx + 1} Amarre Techo `;
              if (k === 0) nom += 'Frontal';
              else if (k === cantTecho - 1) nom += 'Posterior';
              else nom += `Intermedio ${k}`;

              prismas.push({
                x: xMod + xOffsetInt, y: yPos, z: zBase + hCarcasa - t,
                dx: anchoInt, dy: wListonTecho, dz: t,
                mat, name: nom,
                moduloIndex: idx
              });
            }
          }

          // Techo / Tapa sobrepuesta sobre los listones de amarre
          if (techoSobreListon) {
            if (esDobleMelamina) {
              // Capa Inferior (18mm)
              prismas.push({
                x: xMod, y: 0, z: zBase + hCarcasa,
                dx: wMod, dy: profMod, dz: t,
                mat, name: `M${idx + 1} Techo Sobrepuesto Doble Melamina (Capa Inf. ${t}mm)`,
                moduloIndex: idx
              });
              // Capa Superior (18mm engrosado)
              prismas.push({
                x: xMod, y: 0, z: zBase + hCarcasa + t,
                dx: wMod, dy: profMod, dz: t,
                mat, name: `M${idx + 1} Techo Sobrepuesto Doble Melamina (Capa Sup. ${t}mm)`,
                moduloIndex: idx
              });
            } else {
              prismas.push({
                x: xMod, y: 0, z: zBase + hCarcasa,
                dx: wMod, dy: profMod, dz: t,
                mat, name: `M${idx + 1} Tapa Techo Sobrepuesta Simple (${t}mm)`,
                moduloIndex: idx
              });
            }
          }
        } else {
          // Techo Sólido Completo Estándar
          prismas.push({
            x: xMod + xOffsetInt, y: 0, z: zBase + hCarcasa - t,
            dx: anchoInt, dy: profMod, dz: t,
            mat, name: `M${idx + 1} Techo Carcasa Sólido`,
            moduloIndex: idx
          });
        }
      }

      // Zócalo Superior (Frontal de melamina en todo el ancho interior)
      if (tieneZocaloSup && zocaloSupH > 0) {
        prismas.push({
          x: xMod + xOffsetInt, y: 0, z: zBase + hCarcasa,
          dx: anchoInt, dy: t, dz: zocaloSupH,
          mat, name: `M${idx + 1} Frontal Zócalo Superior`,
          moduloIndex: idx
        });
      }

      // Determinar configuración de fondo del módulo
      const tieneFondo = (m.tiene_fondo === true || m.tiene_fondo === 'true' || m.tiene_fondo_mdf === true || m.tiene_fondo_mdf === 'true');
      const tipoFondo = tieneFondo ? (m.tipo_fondo || (m.tiene_fondo_mdf ? 'mdf' : 'mdf')) : 'ninguno';

      // Identificar si el módulo carece de laterales, techo y piso (módulo abierto/vacío para panel completo)
      const esModuloVacio = (!tieneLaterales && !tieneTecho && !tienePiso);

      // Listones Posteriores de Amarre / Fijación a Pared (solo si lleva laterales y no es fondo melamina ni panel)
      const usaAmarresPost = tieneLaterales && (tipoFondo !== 'melamina') && (tipoFondo !== 'panel') && (
        (m.tiene_liston_post === true || m.tiene_liston_post === 'true') ||
        ((m.tiene_liston_amarre === true || m.tiene_liston_amarre === 'true') && (m.posicion_liston_amarre === 'posterior' || m.posicion_liston_amarre === 'ambos'))
      );

      if (usaAmarresPost) {
        const cantPost = Math.max(1, parseInt(m.cant_listones_post || m.cant_listones_amarre || 2));
        const orientacionPost = m.orientacion_liston_post || m.orientacion_listones_post || 'horizontal';
        const wUser = parseFloat(m.ancho_liston_post || m.medida_liston_post || m.alto_liston_amarre || m.ancho_liston);
        const wListonPost = (wUser && wUser > 0) ? wUser : 80;
        const hVanoUtilPost = Math.max(50, hCarcasa - (tienePiso ? t : 0) - (tieneTecho ? t : 0));
        const zStartPost = zBase + (tienePiso ? t : 0);

        if (orientacionPost === 'vertical') {
          // Listones VERTICALES en el fondo:
          // Se extienden en Z cubriendo la altura del vano interior.
          // Se distribuyen en X a lo ancho del módulo para fijación a pared.
          if (cantPost === 1) {
            const xPos = xMod + xOffsetInt + (anchoInt / 2) - (wListonPost / 2);
            prismas.push({
              x: xPos, y: profMod - t, z: zStartPost,
              dx: wListonPost, dy: t, dz: hVanoUtilPost,
              mat, name: `M${idx + 1} Listón Fondo Vertical Central`,
              moduloIndex: idx
            });
          } else {
            const espacioGapsX = Math.max(0, anchoInt - (cantPost * wListonPost));
            const pasoGapX = (cantPost > 1) ? espacioGapsX / (cantPost - 1) : 0;

            for (let k = 0; k < cantPost; k++) {
              const xPos = xMod + xOffsetInt + Math.round(k * (wListonPost + pasoGapX));
              let nom = `M${idx + 1} Listón Fondo Vertical `;
              if (k === 0) nom += 'Izquierdo';
              else if (k === cantPost - 1) nom += 'Derecho';
              else nom += `Intermedio ${k}`;

              prismas.push({
                x: xPos, y: profMod - t, z: zStartPost,
                dx: wListonPost, dy: t, dz: hVanoUtilPost,
                mat, name: nom,
                moduloIndex: idx
              });
            }
          }
        } else {
          // Listones HORIZONTALES en el fondo (repartidos a lo alto):
          if (cantPost === 1) {
            prismas.push({
              x: xMod + xOffsetInt, y: profMod - t, z: zBase + hCarcasa - t - wListonPost,
              dx: anchoInt, dy: t, dz: wListonPost,
              mat, name: `M${idx + 1} Listón Posterior Superior`,
              moduloIndex: idx
            });
          } else {
            const espacioGaps = Math.max(0, hVanoUtilPost - (cantPost * wListonPost));
            const pasoGap = (cantPost > 1) ? (espacioGaps / (cantPost - 1)) : 0;

            for (let k = 0; k < cantPost; k++) {
              const zPos = zStartPost + Math.round(k * (wListonPost + pasoGap));
              let nom = `M${idx + 1} Listón Posterior `;
              if (k === 0) nom += 'Inferior';
              else if (k === cantPost - 1) nom += 'Superior';
              else nom += `Intermedio ${k}`;

              prismas.push({
                x: xMod + xOffsetInt, y: profMod - t, z: zPos,
                dx: anchoInt, dy: t, dz: wListonPost,
                mat, name: nom,
                moduloIndex: idx
              });
            }
          }
        }
      }

      // Fondo Posterior (Fondo Panel, MDF, Melamina o Ninguno)
      const posFondo = m.posicion_fondo_mdf || 'delante_liston';
      const grosorMdf = parseFloat(m.grosor_mdf) || 3;
      const profRanura = (m.prof_ranura_mdf !== undefined) ? parseFloat(m.prof_ranura_mdf) : 8;
      const distRanura = (m.dist_ranura_mdf !== undefined) ? Math.max(0, parseFloat(m.dist_ranura_mdf)) : 0;
      const matMdf = `MDF Fondo Blanco ${grosorMdf}mm`;

      if (tipoFondo === 'panel' || (esModuloVacio && tieneFondo)) {
        const tieneListonesPared = (m.panel_tiene_listones_pared !== false && m.panel_tiene_listones_pared !== 'false');
        const cantPanelList = Math.max(1, Math.min(4, parseInt(m.cant_listones_panel) || 2));
        const hListonPanel = Math.max(20, parseFloat(m.medida_liston_panel) || 80);
        const yListon = profMod - t;
        const yPanel = tieneListonesPared ? Math.max(0, profMod - (2 * t)) : (profMod - t);

        if (esModuloVacio) {
          // REGLA: Si no tiene laterales ni techo ni piso, el fondo panel abarca TODA la dimensión completa (ancho y alto total) del módulo
          prismas.push({
            x: xMod,
            y: yPanel,
            z: zStack,
            dx: wMod,
            dy: t,
            dz: hMod,
            mat,
            name: `M${idx + 1} Fondo Panel Completo ${t}mm (${wMod}x${hMod}mm)`,
            moduloIndex: idx
          });

          // Listones posteriores atornillados a pared (soporte / anclaje estructural)
          if (tieneListonesPared) {
            const orientacionPanelList = m.panel_orientacion_listones || 'horizontal';
            if (orientacionPanelList === 'vertical') {
              const altoListonPanel = Math.max(50, hMod - 60);
              const zListon = zStack + 30;
              const wListonPanel = hListonPanel;
              const espacioGapsX = Math.max(0, (wMod - 60) - (cantPanelList * wListonPanel));
              const pasoGapX = (cantPanelList > 1) ? espacioGapsX / (cantPanelList - 1) : 0;

              for (let k = 0; k < cantPanelList; k++) {
                const xPos = xMod + 30 + Math.round(k * (wListonPanel + pasoGapX));
                prismas.push({
                  x: xPos, y: yListon, z: zListon,
                  dx: wListonPanel, dy: t, dz: altoListonPanel,
                  mat, name: `M${idx + 1} Listón Vertical Anclaje Pared Panel ${k + 1}/${cantPanelList}`,
                  moduloIndex: idx
                });
              }
            } else {
              const largoListonPanel = Math.max(50, wMod - 60); // Retranqueado 30mm por lado para quedar oculto
              const xListon = xMod + 30;

              for (let k = 0; k < cantPanelList; k++) {
                let zListon = zStack + 50;
                if (cantPanelList === 1) {
                  zListon = zStack + hMod - hListonPanel - 50;
                } else if (cantPanelList === 2) {
                  zListon = (k === 0) ? (zStack + 50) : (zStack + hMod - hListonPanel - 50);
                } else {
                  zListon = zStack + 50 + k * ((hMod - 100 - hListonPanel) / (cantPanelList - 1));
                }

                prismas.push({
                  x: xListon,
                  y: yListon,
                  z: zListon,
                  dx: largoListonPanel,
                  dy: t,
                  dz: hListonPanel,
                  mat,
                  name: `M${idx + 1} Listón Anclaje Pared ${k + 1} (${largoListonPanel}x${hListonPanel}mm)`,
                  moduloIndex: idx
                });
              }
            }
          }
        } else {
          // Fondo panel embutido de melamina
          const hVanoUtilLocal = Math.max(0, hCarcasa - (tienePiso ? t : 0) - (tieneTecho ? t : 0));
          prismas.push({
            x: xMod + xOffsetInt,
            y: yPanel,
            z: zIntBase,
            dx: anchoInt,
            dy: t,
            dz: Math.max(80, hVanoUtilLocal),
            mat,
            name: `M${idx + 1} Fondo Panel Melamina ${t}mm (${anchoInt}x${hVanoUtilLocal}mm)`,
            moduloIndex: idx
          });

          if (tieneListonesPared) {
            const largoListonPanel = anchoInt;
            const xListon = xMod + xOffsetInt;

            for (let k = 0; k < cantPanelList; k++) {
              let zListon = zIntBase + 40;
              if (cantPanelList === 1) {
                zListon = zIntBase + hVanoUtilLocal - hListonPanel - 40;
              } else if (cantPanelList === 2) {
                zListon = (k === 0) ? (zIntBase + 40) : (zIntBase + hVanoUtilLocal - hListonPanel - 40);
              } else {
                zListon = zIntBase + 40 + k * ((hVanoUtilLocal - 80 - hListonPanel) / (cantPanelList - 1));
              }

              prismas.push({
                x: xListon,
                y: yListon,
                z: zListon,
                dx: largoListonPanel,
                dy: t,
                dz: hListonPanel,
                mat,
                name: `M${idx + 1} Listón Anclaje Pared ${k + 1} (${largoListonPanel}x${hListonPanel}mm)`,
                moduloIndex: idx
              });
            }
          }
        }
      } else if (tipoFondo === 'mdf') {
        if (posFondo === 'delante_liston') {
          // Fondo incrustado en ranura con retranqueo posterior (0mm = al borde posterior)
          const hVanoPost = Math.max(0, hCarcasa - (tienePiso ? t : 0) - (tieneTecho ? t : 0));
          const wMdf = anchoInt + (2 * profRanura) - 2;
          const hMdf = hVanoPost + (2 * profRanura) - 2;
          prismas.push({
            x: xMod + xOffsetInt - profRanura + 1,
            y: profMod - distRanura - grosorMdf,
            z: zIntBase - profRanura + 1,
            dx: wMdf, dy: grosorMdf, dz: hMdf,
            mat: matMdf, name: `M${idx + 1} Fondo MDF Ranurado ${grosorMdf}mm (Prof. Post: ${distRanura}mm)`,
            moduloIndex: idx
          });
        } else {
          // Fondo sobrepuesto por detrás con las medidas completas del módulo
          prismas.push({
            x: xMod, y: profMod, z: zStack,
            dx: wMod, dy: grosorMdf, dz: hMod,
            mat: matMdf, name: `M${idx + 1} Fondo MDF Sobrepuesto ${grosorMdf}mm (${wMod}x${hMod}mm)`,
            moduloIndex: idx
          });
        }
      } else if (tipoFondo === 'melamina') {
        const hVanoUtilLocal = Math.max(0, hCarcasa - (tienePiso ? t : 0) - (tieneTecho ? t : 0));
        const altoFondoMel = (m.alto_fondo_melamina !== null && m.alto_fondo_melamina !== undefined && parseFloat(m.alto_fondo_melamina) < hVanoUtilLocal)
          ? Math.max(80, Math.min(hVanoUtilLocal, parseFloat(m.alto_fondo_melamina)))
          : hVanoUtilLocal;
        const distFondoMel = (m.dist_fondo_melamina !== undefined) ? Math.max(0, parseFloat(m.dist_fondo_melamina)) : 0;

        // Se ajusta de arriba para abajo: anclado en zTop, desciende altoFondoMel
        const zTopLocal = zIntBase + hVanoUtilLocal;
        const zFondoMel = zTopLocal - altoFondoMel;
        const yMel = profMod - distFondoMel - t;

        prismas.push({
          x: xMod + xOffsetInt, y: yMel, z: zFondoMel,
          dx: anchoInt, dy: t, dz: altoFondoMel,
          mat, name: `M${idx + 1} Fondo Melamina Embutido ${t}mm (${anchoInt}x${altoFondoMel}mm${distFondoMel > 0 ? `, Retranqueo: ${distFondoMel}mm` : ''})`,
          moduloIndex: idx
        });
      }

      // 3. COMPONENTES INTERIORES
      const tipoInt = m.tipo_interior || 'carcasa';
      const hVanoUtil = Math.max(0, hCarcasa - (tienePiso ? t : 0) - (tieneTecho ? t : 0));

      if (tipoInt === 'repisas') {
        const geo = (typeof window.calcularDivisionesYEspaciosModulo === 'function')
          ? window.calcularDivisionesYEspaciosModulo(m, t)
          : null;

        if (geo) {
          const yStart = (geo.profInfo && geo.profInfo.yStart !== undefined) ? geo.profInfo.yStart : 20;
          const dyRep = (geo.profInfo && geo.profInfo.profUtil) ? geo.profInfo.profUtil : (profMod - yStart);

          // A. Parantes Principales (Verticales u Horizontales)
          geo.parantes.forEach((p, pIdx) => {
            if (geo.limites.tipo === 'vertical') {
              prismas.push({
                x: xMod + xOffsetInt + p.posicion,
                y: yStart,
                z: zIntBase,
                dx: p.dx,
                dy: dyRep,
                dz: p.dz,
                mat,
                name: `M${idx + 1} Parante Vertical ${pIdx + 1}`,
                moduloIndex: idx
              });
            } else if (geo.limites.tipo === 'horizontal') {
              prismas.push({
                x: xMod + xOffsetInt,
                y: yStart,
                z: zIntBase + p.posicion,
                dx: p.dx,
                dy: dyRep,
                dz: p.dz,
                mat,
                name: `M${idx + 1} Parante Horizontal ${pIdx + 1}`,
                moduloIndex: idx
              });
            }
          });

          // B. Espacios: Sub-parantes Secundarios y Repisas Compartimentadas
          geo.espacios.forEach((esp) => {
            // Sub-parantes (por ej. vertical en espacio inferior)
            if (Array.isArray(esp.subParantes) && esp.subParantes.length > 0) {
              esp.subParantes.forEach((sp, spIdx) => {
                prismas.push({
                  x: xMod + xOffsetInt + sp.x,
                  y: yStart,
                  z: zIntBase + sp.z,
                  dx: sp.dx,
                  dy: dyRep,
                  dz: sp.dz,
                  mat,
                  name: `M${idx + 1} ${esp.nombre} ${sp.nombre}`,
                  moduloIndex: idx
                });
              });
            }

            // Repisas en este espacio
            esp.repisas.forEach((rep) => {
              prismas.push({
                x: xMod + xOffsetInt + rep.xStart,
                y: yStart,
                z: zIntBase + rep.zStart + rep.zRel,
                dx: rep.ancho,
                dy: dyRep,
                dz: rep.espesor,
                mat,
                name: `M${idx + 1} ${esp.nombre} Repisa ${rep.index + 1}`,
                moduloIndex: idx
              });
            });
          });
        } else {
          // Modo de contingencia sin cálculo de espacios
          const cantRep = (m.cant_repisas !== undefined) ? m.cant_repisas : 0;
          if (cantRep > 0) {
            const pasoRep = hVanoUtil / (cantRep + 1);
            const profInfoFallback = (typeof window.calcularProfundidadUtilInterior === 'function')
              ? window.calcularProfundidadUtilInterior(m, t)
              : { profUtil: Math.max(100, profMod - 20), yStart: 20 };
            const yRep = profInfoFallback.yStart;
            const profRep = profInfoFallback.profUtil;

            for (let r = 1; r <= cantRep; r++) {
              const zRep = zIntBase + (r * pasoRep);
              prismas.push({
                x: xMod + xOffsetInt, y: yRep, z: zRep,
                dx: anchoInt, dy: profRep, dz: t,
                mat, name: `M${idx + 1} Repisa ${r}`,
                moduloIndex: idx
              });
            }
          }
        }
      } else if (tipoInt === 'cajonera') {
        const cantCaj = m.cant_cajones || 3;
        const altoFr = (hVanoUtil - (cantCaj * 3)) / cantCaj;

        for (let c = 0; c < cantCaj; c++) {
          const zFr = zIntBase + 3 + (c * (altoFr + 3));
          prismas.push({
            x: xMod + xOffsetInt + 3, y: -2, z: zFr,
            dx: anchoInt - 6, dy: t, dz: altoFr,
            mat: m.material_frentes || mat, name: `M${idx + 1} Frente Cajón ${c + 1}`,
            moduloIndex: idx
          });
        }
      } else if (tipoInt === 'puertas') {
        const cantP = (wMod > 600) ? 2 : 1;
        const luz = 2;
        const altoP = hCarcasa - (2 * luz);
        const anchoP = (cantP === 2) ? ((wMod - (3 * luz)) / 2) : (wMod - (2 * luz));

        for (let p = 0; p < cantP; p++) {
          const xP = xMod + luz + (p * (anchoP + luz));
          prismas.push({
            x: xP, y: -t, z: zBase + luz,
            dx: anchoP, dy: t, dz: altoP,
            mat: m.material_frentes || mat, name: `M${idx + 1} Puerta ${p + 1}`,
            moduloIndex: idx
          });
        }
      }
    });

    return prismas;
  }

  /**
   * Motor de dibujo principal del canvas.
   */
  function render() {
    if (!canvas || !ctx) return;

    // Sincronización continua de resolución milimétrica y escala DPR
    const { w, h } = sincronizarCanvas();

    const isDark = document.body.classList.contains('theme-oscuro') || document.body.classList.contains('theme-taller');

    // Fondo del canvas según el tema activo
    ctx.fillStyle = isDark ? '#0B1120' : '#F1F5F9';
    ctx.fillRect(0, 0, w, h);

    const d = currentData;
    const anchoTotal = d.ancho_total || 0;
    const altoTotal = d.alto_total || 0;
    const profTotal = d.prof_total || 0;

    // =========================================================================
    // ESTADO 1: VACÍO (Lado derecho vacío con retícula milimétrica y guía CAD)
    // =========================================================================
    if (d.estado === 'vacio' || anchoTotal <= 0 || altoTotal <= 0 || profTotal <= 0) {
      dibujarEstadoVacio(w, h, isDark);
      return;
    }

    // =========================================================================
    // CONFIGURACIÓN DE PROYECCIÓN 3D A PANTALLA 2D
    // =========================================================================
    const maxDim = Math.max(anchoTotal, altoTotal, profTotal);
    const baseScale = (Math.min(w, h) * 0.58) / maxDim;
    const scale = baseScale * camera.zoom;

    const centerX = w / 2;
    const centerY = h / 2 + (altoTotal * scale * 0.12);

    const cosA = Math.cos(camera.azimuth);
    const sinA = Math.sin(camera.azimuth);
    const cosE = Math.cos(camera.elevation);
    const sinE = Math.sin(camera.elevation);

    function proyectar(x, y, z) {
      const dx = x - (anchoTotal / 2);
      const dy = y - (profTotal / 2);
      const dz = z - (altoTotal / 2);

      const x1 = (dx * cosA) - (dy * sinA);
      const y1 = (dx * sinA) + (dy * cosA);

      const y2 = (y1 * cosE) - (dz * sinE);
      const z2 = (y1 * sinE) + (dz * cosE);

      return {
        px: centerX + (x1 * scale),
        py: centerY - (z2 * scale),
        profundidadVista: y2
      };
    }

    // Dibujar piso y retícula en Z=0
    dibujarPisoYRejilla(ctx, proyectar, anchoTotal, profTotal, isDark);

    // =========================================================================
    // ESTADO 2 / 3: DELINEADO Y/O ZÓCALO BASE EN TIEMPO REAL
    // =========================================================================
    const tieneZocaloGlobal = (d.tiene_zocalo === true || d.tiene_zocalo === 'true');
    const zocaloGlobalH = tieneZocaloGlobal ? (parseFloat(d.alto_zocalo) || 100) : 0;
    const hayZocaloActivo = tieneZocaloGlobal && zocaloGlobalH > 0 && anchoTotal > 0 && profTotal > 0;
    const sinModulos = (!d.modulos || d.modulos.length === 0);

    // Si no hay módulos Y tampoco hay zócalo activo, trazar únicamente el marco delineado vacío
    if (sinModulos && !hayZocaloActivo) {
      dibujarRectanguloDelineado(ctx, proyectar, anchoTotal, altoTotal, profTotal, isDark);
      if (renderOptions.mostrarCotas) {
        dibujarCotasGlobales(ctx, proyectar, anchoTotal, altoTotal, profTotal, isDark);
      }
      dibujarBadgeHUD("RECTÁNGULO DELINEADO (Marco General Contenedor)", `${anchoTotal} x ${altoTotal} x ${profTotal} mm`, isDark);
      return;
    }

    // Si hay zócalo pero aún no hay módulos configurados:
    // Dibujar el marco delineado técnico para el volumen superior sobrante de los módulos
    if (sinModulos && hayZocaloActivo) {
      dibujarMarcoEnvolventeSuperior(ctx, proyectar, anchoTotal, zocaloGlobalH, altoTotal, profTotal, isDark);
    } else {
      // Dibujar el marco envolvente en trazo sutil de fondo cuando hay módulos
      dibujarMarcoEnvolventeFondo(ctx, proyectar, anchoTotal, altoTotal, profTotal, isDark);
    }

    // 2. Construir y proyectar todas las caras de melamina
    const prismas = generarPrismasModulos();
    const caras = [];

    const lightDir = { x: 0.5, y: -0.7, z: 0.8 };
    const lLen = Math.sqrt(lightDir.x * lightDir.x + lightDir.y * lightDir.y + lightDir.z * lightDir.z);
    lightDir.x /= lLen; lightDir.y /= lLen; lightDir.z /= lLen;

    prismas.forEach(prisma => {
      const { x, y, z, dx, dy, dz, mat, moduloIndex, esZocaloFrontal, esListonSoporteZocalo, esZocaloBase } = prisma;

      const defCaras = [
        { norm: { x: 0, y: 0, z: 1 }, pts: [[x, y, z + dz], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]] },
        { norm: { x: 0, y: -1, z: 0 }, pts: [[x, y, z], [x + dx, y, z], [x + dx, y, z + dz], [x, y, z + dz]] },
        { norm: { x: 0, y: 1, z: 0 }, pts: [[x, y + dy, z], [x, y + dy, z + dz], [x + dx, y + dy, z + dz], [x + dx, y + dy, z]] },
        { norm: { x: -1, y: 0, z: 0 }, pts: [[x, y, z], [x, y + dy, z], [x, y + dy, z + dz], [x, y, z + dz]] },
        { norm: { x: 1, y: 0, z: 0 }, pts: [[x + dx, y, z], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x + dx, y + dy, z]] },
        { norm: { x: 0, y: 0, z: -1 }, pts: [[x, y, z], [x, y + dy, z], [x + dx, y + dy, z], [x + dx, y, z]] }
      ];

      defCaras.forEach(fc => {
        let cx = 0, cy = 0, cz = 0;
        fc.pts.forEach(p => { cx += p[0]; cy += p[1]; cz += p[2]; });
        cx /= 4; cy /= 4; cz /= 4;

        const projCentro = proyectar(cx, cy, cz);
        const dot = Math.max(0, (fc.norm.x * lightDir.x) + (fc.norm.y * lightDir.y) + (fc.norm.z * lightDir.z));
        const factorLuz = 0.45 + (dot * 0.55);

        const vCamX = sinA * cosE;
        const vCamY = -cosA * cosE;
        const vCamZ = sinE;
        const dotCam = (fc.norm.x * vCamX) + (fc.norm.y * vCamY) + (fc.norm.z * vCamZ);

        // La cara apunta al observador si dotCam > 0. En modo alambre se admiten todas.
        const caraVisible = (renderOptions.modoRender === 'alambre') || (dotCam > 0.001);

        if (caraVisible) {
          // Si es la cara frontal del zócalo frontal (la que mira hacia adelante al usuario),
          // le aplicamos una leve prioridad de profundidad para evitar artefactos coplanares
          const prioridadFrontal = (esZocaloFrontal && fc.norm.y < 0) ? -0.5 : 0;
          caras.push({
            puntos: fc.pts.map(p => proyectar(p[0], p[1], p[2])),
            profundidadVista: projCentro.profundidadVista + prioridadFrontal,
            factorLuz,
            mat,
            moduloIndex,
            esZocaloFrontal: !!esZocaloFrontal,
            esListonSoporteZocalo: !!esListonSoporteZocalo,
            esNoPermitido: !!prisma.esNoPermitido,
            esZocaloBase: !!esZocaloBase
          });
        }
      });
    });

    // Ordenar caras de atrás hacia adelante (Algoritmo del Pintor)
    caras.sort((a, b) => b.profundidadVista - a.profundidadVista);

    // Dibujar las caras proyectadas
    const modoAlambre = renderOptions.modoRender === 'alambre';

    caras.forEach(cara => {
      const paleta = obtenerPaleta(cara.mat);
      const [r, g, b] = paleta.base;
      const f = cara.factorLuz;
      let fill = `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;

      if (cara.esZocaloFrontal) {
        // Zócalo frontal continuo: melamina sólida 100% opaca nítida
        fill = `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
      } else if (cara.esListonSoporteZocalo) {
        // Listones internos de soporte: si violan la norma de 150mm, destacar en rojo advertencia
        if (cara.esNoPermitido) {
          fill = `rgb(${Math.round(239 * f)}, ${Math.round(68 * f)}, ${Math.round(68 * f)})`;
        } else {
          fill = `rgb(${Math.min(255, Math.round(r * 1.05 * f))}, ${Math.round(g * 0.95 * f)}, ${Math.round(b * 0.85 * f)})`;
        }
      }

      const esActivo = (d.modo_seleccion === 'diseno' || d.modulo_activo === -1 || cara.esZocaloBase || sinModulos)
        ? true
        : (cara.moduloIndex === d.modulo_activo);

      ctx.beginPath();
      ctx.moveTo(cara.puntos[0].px, cara.puntos[0].py);
      for (let i = 1; i < cara.puntos.length; i++) {
        ctx.lineTo(cara.puntos[i].px, cara.puntos[i].py);
      }
      ctx.closePath();

      if (!modoAlambre) {
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = cara.esZocaloFrontal
          ? (isDark ? '#38BDF8' : '#1D4ED8')
          : (cara.esListonSoporteZocalo 
              ? (cara.esNoPermitido ? '#DC2626' : '#1E40AF') 
              : (esActivo ? '#2563EB' : paleta.border));
        ctx.lineWidth = (cara.esZocaloFrontal || cara.esListonSoporteZocalo) ? 1.6 : (esActivo ? 1.4 : 0.8);
        ctx.stroke();
      } else {
        ctx.strokeStyle = cara.esZocaloFrontal 
          ? '#38BDF8' 
          : (cara.esListonSoporteZocalo 
              ? (cara.esNoPermitido ? '#EF4444' : '#F59E0B') 
              : (esActivo ? '#2563EB' : (isDark ? '#38BDF8' : '#0284C7')));
        ctx.lineWidth = (cara.esZocaloFrontal || cara.esListonSoporteZocalo) ? 2.0 : (esActivo ? 1.8 : 1.0);
        ctx.stroke();
      }
    });

    // Si estamos en la etapa inicial de diseño con zócalo pero sin módulos aún
    if (sinModulos && hayZocaloActivo) {
      if (renderOptions.mostrarCotas) {
        dibujarCotasGlobales(ctx, proyectar, anchoTotal, altoTotal, profTotal, isDark);
      }
      dibujarBadgeHUD(
        "ZÓCALO EN DISEÑO (Base del Mueble)",
        `${anchoTotal} x ${profTotal} x ${zocaloGlobalH} mm (Alto disponible módulos: ${altoTotal - zocaloGlobalH} mm)`,
        isDark
      );
      return;
    }

    // 3. Resaltar Módulo Activo o Todo el Mueble según modo de selección
    if (d.modo_seleccion === 'diseno' || d.modulo_activo === -1) {
      dibujarResalteTodoElMueble(ctx, proyectar, d, isDark);
    } else {
      dibujarResalteModuloActivo(ctx, proyectar, d, isDark);
    }

    // 4. Dibujar Cotas Milimétricas individuales por módulo y globales
    if (renderOptions.mostrarCotas) {
      dibujarCotasModulares(ctx, proyectar, d, isDark);
    }

    // 4.1. Dibujar Cotas dimensionales del módulo o submódulo seleccionado activo
    if (d.modo_seleccion !== 'diseno' && d.modulo_activo >= 0) {
      dibujarCotasModuloSeleccionado(ctx, proyectar, d, isDark);
    }

    // 5. HUD de estado en tiempo real (esquina inferior izquierda)
    if (d.modo_seleccion === 'diseno' || d.modulo_activo === -1) {
      const cant = (d.modulos && d.modulos.length) || 0;
      dibujarBadgeHUD(`DISEÑO GENERAL: TODO EL MUEBLE`, `${anchoTotal} x ${altoTotal} x ${profTotal} mm (${cant} Módulos | Melamina ${d.espesor}mm)`, isDark);
    } else {
      const idx = d.modulo_activo;
      const m = d.modulos[idx];
      const nomMod = (m && m.nombre) ? m.nombre : `Módulo ${idx + 1}`;
      const wMod = m ? m.ancho : 0;
      const hMod = m ? m.alto : altoTotal;
      const pMod = m ? m.profundidad : profTotal;
      dibujarBadgeHUD(`${nomMod.toUpperCase()} SELECCIONADO`, `${wMod} x ${hMod} x ${pMod} mm | Elemento ${idx + 1} de ${d.modulos.length}`, isDark);
    }
  }

  /**
   * Dibuja el estado inicial vacío con retícula milimétrica y mensaje explicativo.
   */
  function dibujarEstadoVacio(w, h, isDark) {
    // Retícula milimétrica CAD
    const gridStep = 24;
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x += gridStep) {
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
    }
    for (let y = 0; y < h; y += gridStep) {
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Marco central punteado con guía técnica
    const boxW = Math.min(460, w - 40);
    const boxH = Math.min(260, h - 40);
    const boxX = (w - boxW) / 2;
    const boxY = (h - boxH) / 2;

    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = isDark ? '#334155' : '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.restore();

    // Texto guía
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = isDark ? '#38BDF8' : '#0284C7';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.fillText("LADO DERECHO (2/3) : ÁREA DE DIBUJO PARAMÉTRICO", w / 2, boxY + 45);

    ctx.fillStyle = isDark ? '#E2E8F0' : '#1E293B';
    ctx.font = '600 13px -apple-system, sans-serif';
    ctx.fillText("El espacio se encuentra actualmente vacío", w / 2, boxY + 85);

    ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
    ctx.font = '11.5px -apple-system, sans-serif';
    ctx.fillText("1. Ingrese Ancho, Alto y Profundidad en el panel izquierdo (1/3)", w / 2, boxY + 125);
    ctx.fillText("para trazar el rectángulo delimitador a escala.", w / 2, boxY + 145);
    ctx.fillText("2. Luego ingrese el espesor y la cantidad de módulos para ver el armado.", w / 2, boxY + 175);

    // Estatus inferior
    ctx.fillStyle = isDark ? '#475569' : '#94A3B8';
    ctx.font = 'italic 10.5px -apple-system, sans-serif';
    ctx.fillText("Cálculo geométrico en tiempo real con precisión milimétrica (.mm)", w / 2, boxY + boxH - 25);
  }

  /**
   * Dibuja el rectángulo/volumen delineado según las dimensiones ingresadas.
   */
  function dibujarRectanguloDelineado(ctx, proyectar, W, H, D, isDark) {
    const pts = [
      proyectar(0, 0, 0), proyectar(W, 0, 0),
      proyectar(W, D, 0), proyectar(0, D, 0),
      proyectar(0, 0, H), proyectar(W, 0, H),
      proyectar(W, D, H), proyectar(0, D, H)
    ];

    const aristas = [
      [0, 1], [1, 2], [2, 3], [3, 0], // Base inferior
      [4, 5], [5, 6], [6, 7], [7, 4], // Techo superior
      [0, 4], [1, 5], [2, 6], [3, 7]  // Columnas verticales
    ];

    ctx.save();
    // Línea continua brillante con halo técnico
    ctx.setLineDash([7, 4]);
    ctx.strokeStyle = isDark ? '#38BDF8' : '#0284C7';
    ctx.lineWidth = 2.0;

    aristas.forEach(([i, j]) => {
      ctx.beginPath();
      ctx.moveTo(pts[i].px, pts[i].py);
      ctx.lineTo(pts[j].px, pts[j].py);
      ctx.stroke();
    });

    // Marcadores de esquina tipo CAD
    ctx.setLineDash([]);
    ctx.fillStyle = isDark ? '#38BDF8' : '#0284C7';
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.px, p.py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  /**
   * Dibuja el marco envolvente exterior de fondo cuando hay módulos armados.
   */
  function dibujarMarcoEnvolventeFondo(ctx, proyectar, W, H, D, isDark) {
    const pts = [
      proyectar(0, 0, 0), proyectar(W, 0, 0),
      proyectar(W, D, 0), proyectar(0, D, 0),
      proyectar(0, 0, H), proyectar(W, 0, H),
      proyectar(W, D, H), proyectar(0, D, H)
    ];

    const aristas = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.25)';
    ctx.lineWidth = 1.2;

    aristas.forEach(([i, j]) => {
      ctx.beginPath();
      ctx.moveTo(pts[i].px, pts[i].py);
      ctx.lineTo(pts[j].px, pts[j].py);
      ctx.stroke();
    });
    ctx.restore();
  }

  /**
   * Dibuja el marco envolvente técnico superior para el volumen libre sobre el zócalo en diseño inicial.
   */
  function dibujarMarcoEnvolventeSuperior(ctx, proyectar, W, ZBase, H, D, isDark) {
    const pts = [
      proyectar(0, 0, ZBase), proyectar(W, 0, ZBase),
      proyectar(W, D, ZBase), proyectar(0, D, ZBase),
      proyectar(0, 0, H), proyectar(W, 0, H),
      proyectar(W, D, H), proyectar(0, D, H)
    ];

    const aristas = [
      [0, 1], [1, 2], [2, 3], [3, 0], // Base sobre el zócalo
      [4, 5], [5, 6], [6, 7], [7, 4], // Techo superior
      [0, 4], [1, 5], [2, 6], [3, 7]  // Pilares verticales
    ];

    ctx.save();
    ctx.setLineDash([7, 4]);
    ctx.strokeStyle = isDark ? '#38BDF8' : '#0284C7';
    ctx.lineWidth = 1.8;

    aristas.forEach(([i, j]) => {
      ctx.beginPath();
      ctx.moveTo(pts[i].px, pts[i].py);
      ctx.lineTo(pts[j].px, pts[j].py);
      ctx.stroke();
    });

    // Marcadores de esquina tipo CAD
    ctx.setLineDash([]);
    ctx.fillStyle = isDark ? '#38BDF8' : '#0284C7';
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.px, p.py, 3.0, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  /**
   * Resalta visualmente el módulo actualmente activo/seleccionado en el formulario.
   */
  function dibujarResalteModuloActivo(ctx, proyectar, d, isDark) {
    const idx = d.modulo_activo;
    const modulos = d.modulos || [];
    if (idx < 0 || idx >= modulos.length) return;

    const geomMapeo = calcularGeometriaColumnasYApilado(modulos);
    const geom = geomMapeo[idx] || { xPos: 0, zBaseStack: 0, wMod: modulos[idx].ancho || 600 };
    const xOffset = geom.xPos;
    const zOffset = geom.zBaseStack;

    const m = modulos[idx];
    const wMod = geom.wMod;
    const hMod = m.alto || d.alto_total || 2100;
    const profMod = m.profundidad || d.prof_total || 600;

    const p1 = proyectar(xOffset, 0, zOffset);
    const p2 = proyectar(xOffset + wMod, 0, zOffset);
    const p3 = proyectar(xOffset + wMod, 0, zOffset + hMod);
    const p4 = proyectar(xOffset, 0, zOffset + hMod);

    ctx.save();
    ctx.strokeStyle = '#F59E0B'; // Ámbar PrimeNG
    ctx.lineWidth = 2.2;
    ctx.setLineDash([5, 3]);

    ctx.beginPath();
    ctx.moveTo(p1.px, p1.py);
    ctx.lineTo(p2.px, p2.py);
    ctx.lineTo(p3.px, p3.py);
    ctx.lineTo(p4.px, p4.py);
    ctx.closePath();
    ctx.stroke();

    // Etiqueta flotante superior
    const midTopX = (p3.px + p4.px) / 2;
    const midTopY = (p3.py + p4.py) / 2 - 14;

    const nomMod = (m && m.nombre) ? m.nombre : `Módulo ${idx + 1}`;
    ctx.setLineDash([]);
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`★ ${nomMod.toUpperCase()} ACTIVO (${wMod}x${hMod} mm)`, midTopX, midTopY);
    ctx.restore();
  }

  /**
   * Resalta visualmente TODO el mueble cuando está activo el modo "Diseño".
   * Traza la caja delimitadora envolvente tridimensional con efecto técnico CAD y etiqueta.
   */
  function dibujarResalteTodoElMueble(ctx, proyectar, d, isDark) {
    const w = d.ancho_total || 0;
    const h = d.alto_total || 0;
    const prof = d.prof_total || 0;
    if (w <= 0 || h <= 0) return;

    // Cara frontal envolvente
    const p1 = proyectar(0, 0, 0);
    const p2 = proyectar(w, 0, 0);
    const p3 = proyectar(w, 0, h);
    const p4 = proyectar(0, 0, h);

    // Cara posterior envolvente
    const p5 = proyectar(0, prof, 0);
    const p6 = proyectar(w, prof, 0);
    const p7 = proyectar(w, prof, h);
    const p8 = proyectar(0, prof, h);

    ctx.save();
    const colorHighlight = isDark ? '#38BDF8' : '#2563EB';
    ctx.strokeStyle = colorHighlight;
    ctx.lineWidth = 2.0;
    ctx.setLineDash([6, 4]);

    // Marco frontal
    ctx.beginPath();
    ctx.moveTo(p1.px, p1.py);
    ctx.lineTo(p2.px, p2.py);
    ctx.lineTo(p3.px, p3.py);
    ctx.lineTo(p4.px, p4.py);
    ctx.closePath();
    ctx.stroke();

    // Aristas de profundidad
    ctx.beginPath();
    ctx.moveTo(p1.px, p1.py); ctx.lineTo(p5.px, p5.py);
    ctx.moveTo(p2.px, p2.py); ctx.lineTo(p6.px, p6.py);
    ctx.moveTo(p3.px, p3.py); ctx.lineTo(p7.px, p7.py);
    ctx.moveTo(p4.px, p4.py); ctx.lineTo(p8.px, p8.py);
    // Marco posterior
    ctx.moveTo(p5.px, p5.py); ctx.lineTo(p6.px, p6.py);
    ctx.lineTo(p7.px, p7.py); ctx.lineTo(p8.px, p8.py);
    ctx.closePath();
    ctx.stroke();

    // Etiqueta flotante superior
    const midTopX = (p3.px + p4.px) / 2;
    const midTopY = Math.min(p3.py, p4.py) - 16;

    ctx.setLineDash([]);
    ctx.fillStyle = colorHighlight;
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const cantModsText = (d.modulos && d.modulos.length > 0) ? ` (${d.modulos.length} Módulos)` : '';
    ctx.fillText(`★ DISEÑO GENERAL: TODO EL MUEBLE${cantModsText}`, midTopX, midTopY);
    ctx.restore();
  }

  /**
   * Dibuja las cotas globales milimétricas para el estado delineado.
   */
  function dibujarCotasGlobales(ctx, proyectar, W, H, D, isDark) {
    ctx.save();
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDark ? '#38BDF8' : '#0284C7';
    ctx.strokeStyle = isDark ? '#38BDF8' : '#0284C7';
    ctx.lineWidth = 1.2;

    // Cota Ancho Frontal Superior (W mm)
    const pW1 = proyectar(0, 0, H + 60);
    const pW2 = proyectar(W, 0, H + 60);
    trazarLineaCota(ctx, pW1.px, pW1.py, pW2.px, pW2.py, `W: ${W} mm`);

    // Cota Alto Lateral Izquierdo (H mm)
    const pH1 = proyectar(-60, 0, 0);
    const pH2 = proyectar(-60, 0, H);
    trazarLineaCota(ctx, pH1.px, pH1.py, pH2.px, pH2.py, `H: ${H} mm`);

    // Cota Profundidad (D mm)
    const pD1 = proyectar(W + 60, 0, 0);
    const pD2 = proyectar(W + 60, D, 0);
    trazarLineaCota(ctx, pD1.px, pD1.py, pD2.px, pD2.py, `D: ${D} mm`);

    ctx.restore();
  }

  /**
   * Dibuja las cotas individuales por módulo y la cota global superior.
   */
  function dibujarCotasModulares(ctx, proyectar, d, isDark) {
    ctx.save();
    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const colorCota = isDark ? '#38BDF8' : '#0369A1';
    ctx.fillStyle = colorCota;
    ctx.strokeStyle = colorCota;
    ctx.lineWidth = 1.0;

    const modulos = d.modulos || [];
    const geomMapeo = calcularGeometriaColumnasYApilado(modulos);

    // Cotas de ancho por columna única en la parte superior
    const colsVistas = new Set();
    modulos.forEach((m, idx) => {
      const geom = geomMapeo[idx];
      if (!geom || colsVistas.has(geom.colIdx)) return;
      const wColCota = geom.wCol || geom.wMod;
      const p1 = proyectar(geom.xPos, 0, d.alto_total + 40);
      const p2 = proyectar(geom.xPos + wColCota, 0, d.alto_total + 40);

      trazarLineaCota(ctx, p1.px, p1.py, p2.px, p2.py, `Col ${geom.colIdx + 1}: ${wColCota}`);
    });

    // Cota Total Global superior
    const pTot1 = proyectar(0, 0, d.alto_total + 90);
    const pTot2 = proyectar(d.ancho_total, 0, d.alto_total + 90);
    ctx.lineWidth = 1.4;
    trazarLineaCota(ctx, pTot1.px, pTot1.py, pTot2.px, pTot2.py, `ANCHO TOTAL: ${d.ancho_total} mm`);

    // Cota de Alto Global
    const pH1 = proyectar(-60, 0, 0);
    const pH2 = proyectar(-60, 0, d.alto_total);
    trazarLineaCota(ctx, pH1.px, pH1.py, pH2.px, pH2.py, `${d.alto_total} mm`);

    // Cota de Zócalo Inferior si está activo
    const tieneZocaloGlobal = (d.tiene_zocalo === true || d.tiene_zocalo === 'true');
    const zocaloGlobalH = tieneZocaloGlobal ? (parseFloat(d.alto_zocalo) || 100) : 0;
    if (tieneZocaloGlobal && zocaloGlobalH > 0) {
      const pZ1 = proyectar(-25, 0, 0);
      const pZ2 = proyectar(-25, 0, zocaloGlobalH);
      trazarLineaCota(ctx, pZ1.px, pZ1.py, pZ2.px, pZ2.py, `Zócalo: ${zocaloGlobalH}`);
    }

    ctx.restore();
  }

  /**
   * Dibuja las cotas específicas del módulo o submódulo seleccionado activo.
   * Muestra las cotas exactas de Ancho (W), Alto (H) y Profundidad (D)
   * del elemento seleccionado con estilo técnico ámbar / dorado destacado.
   */
  function dibujarCotasModuloSeleccionado(ctx, proyectar, d, isDark) {
    const idx = d.modulo_activo;
    const modulos = d.modulos || [];
    if (idx < 0 || idx >= modulos.length) return;

    const geomMapeo = calcularGeometriaColumnasYApilado(modulos);
    const geom = geomMapeo[idx];
    if (!geom) return;

    const m = modulos[idx];
    const x0 = geom.xPos;
    const wMod = (m && m.ancho > 0) ? m.ancho : geom.wMod;
    const x1 = x0 + wMod;

    const z0 = geom.zBaseStack;
    const hMod = (m && m.alto > 0) ? m.alto : geom.hMod;
    const z1 = z0 + hMod;

    const profMod = (m && m.profundidad > 0) ? m.profundidad : (d.prof_total || 600);
    const y0 = 0;
    const y1 = profMod;

    const vista = camera.vistaActual || 'iso';
    const colorSel = isDark ? '#FBBF24' : '#D97706'; // Ámbar PrimeNG

    ctx.save();
    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. COTA DE ANCHO (W) DEL MÓDULO O SUBMÓDULO SELECCIONADO
    // Visible en vista isométrica, frontal y planta
    if (vista !== 'side') {
      const offZ = (z0 === 0) ? -28 : -20;
      const pW1 = proyectar(x0, -12, z0 + offZ);
      const pW2 = proyectar(x1, -12, z0 + offZ);

      // Líneas de extensión tenues
      const pOrigW1 = proyectar(x0, 0, z0);
      const pOrigW2 = proyectar(x1, 0, z0);
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = isDark ? 'rgba(251, 191, 36, 0.45)' : 'rgba(217, 119, 6, 0.45)';
      ctx.beginPath();
      ctx.moveTo(pOrigW1.px, pOrigW1.py); ctx.lineTo(pW1.px, pW1.py);
      ctx.moveTo(pOrigW2.px, pOrigW2.py); ctx.lineTo(pW2.px, pW2.py);
      ctx.stroke();
      ctx.restore();

      trazarLineaCotaDestacada(ctx, pW1.px, pW1.py, pW2.px, pW2.py, `${wMod} mm`, colorSel, isDark);
    }

    // 2. COTA DE ALTO (H) DEL MÓDULO O SUBMÓDULO SELECCIONADO
    // Visible en vista isométrica, frontal y lateral
    if (vista !== 'top') {
      const alBordeDerecho = (x1 >= ((d.ancho_total || 1800) - 40));
      const offX = alBordeDerecho ? -26 : 26;
      const refX = alBordeDerecho ? x0 : x1;

      const pH1 = proyectar(refX + offX, -10, z0);
      const pH2 = proyectar(refX + offX, -10, z1);

      // Líneas de extensión tenues
      const pOrigH1 = proyectar(refX, 0, z0);
      const pOrigH2 = proyectar(refX, 0, z1);
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = isDark ? 'rgba(251, 191, 36, 0.45)' : 'rgba(217, 119, 6, 0.45)';
      ctx.beginPath();
      ctx.moveTo(pOrigH1.px, pOrigH1.py); ctx.lineTo(pH1.px, pH1.py);
      ctx.moveTo(pOrigH2.px, pOrigH2.py); ctx.lineTo(pH2.px, pH2.py);
      ctx.stroke();
      ctx.restore();

      trazarLineaCotaDestacada(ctx, pH1.px, pH1.py, pH2.px, pH2.py, `${hMod} mm`, colorSel, isDark);
    }

    // 3. COTA DE PROFUNDIDAD (D) DEL MÓDULO O SUBMÓDULO SELECCIONADO
    // Visible en vista isométrica, planta y lateral
    if (vista === 'iso' || vista === 'top' || vista === 'side') {
      const pD1 = proyectar(x1 + 18, y0, z0);
      const pD2 = proyectar(x1 + 18, y1, z0);

      // Líneas de extensión tenues
      const pOrigD1 = proyectar(x1, y0, z0);
      const pOrigD2 = proyectar(x1, y1, z0);
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = isDark ? 'rgba(251, 191, 36, 0.45)' : 'rgba(217, 119, 6, 0.45)';
      ctx.beginPath();
      ctx.moveTo(pOrigD1.px, pOrigD1.py); ctx.lineTo(pD1.px, pD1.py);
      ctx.moveTo(pOrigD2.px, pOrigD2.py); ctx.lineTo(pD2.px, pD2.py);
      ctx.stroke();
      ctx.restore();

      trazarLineaCotaDestacada(ctx, pD1.px, pD1.py, pD2.px, pD2.py, `Prof: ${profMod} mm`, colorSel, isDark);
    }

    ctx.restore();
  }

  /**
   * Traza una cota destacada con terminaciones perpendiculares y badge flotante de alto contraste.
   */
  function trazarLineaCotaDestacada(ctx, x1, y1, x2, y2, texto, color, isDark) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Ticks transversales perpendiculares en los extremos
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const nx = -dy / len * 5;
      const ny = dx / len * 5;
      ctx.beginPath();
      ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(x1 - nx, y1 - ny);
      ctx.moveTo(x2 + nx, y2 + ny); ctx.lineTo(x2 - nx, y2 - ny);
      ctx.stroke();
    }

    // Badge rectangular con fondo de alto contraste para máxima legibilidad
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const textWidth = ctx.measureText(texto).width;
    const padX = 6;
    const padY = 3;
    const badgeW = textWidth + (padX * 2);
    const badgeH = 16;

    ctx.fillStyle = isDark ? '#0F172A' : '#FFFFFF';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;

    const rx = midX - (badgeW / 2);
    const ry = midY - (badgeH / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(rx, ry, badgeW, badgeH, 4);
    } else {
      ctx.rect(rx, ry, badgeW, badgeH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillText(texto, midX, midY);
    ctx.restore();
  }

  /**
   * Traza una línea de cota con terminaciones transversales y texto centrado.
   */
  function trazarLineaCota(ctx, x1, y1, x2, y2, texto) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Ticks perpendiculares en los extremos
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const nx = -dy / len * 4;
      const ny = dx / len * 4;

      ctx.beginPath();
      ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(x1 - nx, y1 - ny);
      ctx.moveTo(x2 + nx, y2 + ny); ctx.lineTo(x2 - nx, y2 - ny);
      ctx.stroke();
    }

    // Texto de la cota con cápsula de fondo para legibilidad
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const textWidth = ctx.measureText(texto).width;

    ctx.save();
    ctx.fillStyle = document.body.classList.contains('theme-oscuro') ? '#0B1120' : '#FFFFFF';
    ctx.fillRect(midX - (textWidth / 2) - 4, midY - 7, textWidth + 8, 14);
    ctx.restore();

    ctx.fillText(texto, midX, midY);
  }

  /**
   * Dibuja el plano base Z=0 con Eje Rojo (X) y Verde (Y) de SketchUp.
   */
  function dibujarPisoYRejilla(ctx, proyectar, W, D, isDark) {
    if (!renderOptions.mostrarEjes) return;

    // Eje Rojo (X) de SketchUp
    const pRojo1 = proyectar(-200, 0, 0);
    const pRojo2 = proyectar(W + 300, 0, 0);
    ctx.strokeStyle = '#EF4444'; // Eje Rojo
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pRojo1.px, pRojo1.py); ctx.lineTo(pRojo2.px, pRojo2.py);
    ctx.stroke();

    // Eje Verde (Y) de SketchUp
    const pVerde1 = proyectar(0, -200, 0);
    const pVerde2 = proyectar(0, D + 300, 0);
    ctx.strokeStyle = '#10B981'; // Eje Verde
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pVerde1.px, pVerde1.py); ctx.lineTo(pVerde2.px, pVerde2.py);
    ctx.stroke();
  }

  /**
   * Dibuja un HUD de estado elegante en la esquina inferior izquierda.
   */
  function dibujarBadgeHUD(titulo, subtitulo, isDark) {
    ctx.save();
    const x = 16;
    const { h } = sincronizarCanvas();
    const boxH = 46;
    const y = Math.max(16, h - boxH - 16);

    ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = isDark ? '#334155' : '#E2E8F0';
    ctx.lineWidth = 1;

    const pad = 10;
    const boxW = 280;

    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, boxW, boxH, 8) : ctx.rect(x, y, boxW, boxH);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = isDark ? '#38BDF8' : '#0284C7';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillText(titulo, x + pad, y + 18);

    ctx.fillStyle = isDark ? '#CBD5E1' : '#475569';
    ctx.font = '10.5px -apple-system, sans-serif';
    ctx.fillText(subtitulo, x + pad, y + 34);

    ctx.restore();
  }

  /**
   * Detecta clics sobre el canvas para seleccionar el módulo correspondiente.
   */
  function onCanvasClick(e) {
    if (!onModuleSelectCallback || !currentData.modulos || currentData.modulos.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const d = currentData;
    const geomMapeo = calcularGeometriaColumnasYApilado(d.modulos);

    for (let i = 0; i < d.modulos.length; i++) {
      const geom = geomMapeo[i];
      if (!geom) continue;

      const wMod = geom.wMod;
      const hMod = d.modulos[i].alto || d.alto_total || 2100;
      const xStart = geom.xPos;
      const xEnd = geom.xPos + wMod;
      const zStart = geom.zBaseStack;
      const zEnd = geom.zBaseStack + hMod;

      const fraccionInicioX = xStart / d.ancho_total;
      const fraccionFinX = xEnd / d.ancho_total;
      const pantallaInicioX = rect.width * (0.2 + (fraccionInicioX * 0.6));
      const pantallaFinX = rect.width * (0.2 + (fraccionFinX * 0.6));

      if (clickX >= pantallaInicioX && clickX <= pantallaFinX) {
        const fz1 = zStart / d.alto_total;
        const fz2 = zEnd / d.alto_total;
        const pyTop = rect.height * (0.8 - (fz2 * 0.6));
        const pyBottom = rect.height * (0.8 - (fz1 * 0.6));

        if (clickY >= Math.min(pyTop, pyBottom) && clickY <= Math.max(pyTop, pyBottom)) {
          onModuleSelectCallback(i);
          return;
        }
      }
    }
  }

  // API Pública del Motor Preview3D
  const api = {
    init,
    update,
    setView,
    setRenderMode,
    toggleCotas,
    resize: ajustarTamano,
    render,
    generarPrismas: generarPrismasModulos,
    calcularListonesZocaloEstandar
  };

  if (typeof window !== 'undefined') {
    window.Preview3D = api;
    window.calcularListonesZocaloEstandar = calcularListonesZocaloEstandar;
  }

  return api;
})();

// Asegurar disponibilidad en el objeto global window
if (typeof window !== 'undefined') {
  window.Preview3D = Preview3D;
  window.calcularListonesZocaloEstandar = Preview3D.calcularListonesZocaloEstandar;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Preview3D;
}

