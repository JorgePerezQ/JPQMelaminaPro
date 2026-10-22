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
    material: 'Pelikano Bellota 18mm',
    modulo_activo: 0,
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
    if (!matNombre) return materialColors['Pelikano Bellota 18mm'];
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

    return materialColors['Pelikano Bellota 18mm'];
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
    camera.elevation = Math.max(0.01, Math.min(Math.PI / 2.02, camera.elevation + dy * 0.01));
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
   */
  function generarPrismasModulos() {
    const d = currentData;
    const t = d.espesor || 18;
    const mat = d.material || 'Pelikano Bellota 18mm';
    const modulos = d.modulos || [];
    const prismas = [];

    let xAcumulado = 0;

    modulos.forEach((m, idx) => {
      const wMod = m.ancho || 600;
      const hMod = m.alto || d.alto_total || 2100;
      const profMod = m.profundidad || d.prof_total || 600;
      const xMod = xAcumulado;

      // 1. ZÓCALO Y LISTONES
      const tieneZocalo = (m.tiene_zocalo === true || m.tiene_zocalo === 'true');
      const zocaloH = tieneZocalo ? (m.alto_zocalo || 100) : 0;
      const cantListones = m.cant_listones || 2;
      const retransZocalo = 35;

      if (tieneZocalo && zocaloH > 0) {
        // Listón frontal
        prismas.push({
          x: xMod, y: retransZocalo, z: 0,
          dx: wMod, dy: t, dz: zocaloH,
          mat, name: `M${idx + 1} Zócalo Frontal`,
          moduloIndex: idx
        });

        // Listón posterior
        prismas.push({
          x: xMod, y: profMod - t - retransZocalo, z: 0,
          dx: wMod, dy: t, dz: zocaloH,
          mat, name: `M${idx + 1} Zócalo Posterior`,
          moduloIndex: idx
        });

        // Listón transversal central (si cant_listones >= 3)
        if (cantListones >= 3) {
          const profTrans = profMod - (2 * retransZocalo) - (2 * t);
          prismas.push({
            x: xMod + (wMod / 2) - (t / 2), y: retransZocalo + t, z: 0,
            dx: t, dy: profTrans, dz: zocaloH,
            mat, name: `M${idx + 1} Listón Transversal`,
            moduloIndex: idx
          });
        }
      }

      // 2. CARCASA ESTRUCTURAL (Laterales, Piso y Techo)
      const hCarcasa = hMod - zocaloH;
      const zBase = zocaloH;
      const anchoInt = wMod - (2 * t);

      // Costado Izquierdo
      prismas.push({
        x: xMod, y: 0, z: zBase,
        dx: t, dy: profMod, dz: hCarcasa,
        mat, name: `M${idx + 1} Lateral Izq`,
        moduloIndex: idx
      });

      // Costado Derecho
      prismas.push({
        x: xMod + wMod - t, y: 0, z: zBase,
        dx: t, dy: profMod, dz: hCarcasa,
        mat, name: `M${idx + 1} Lateral Der`,
        moduloIndex: idx
      });

      // Piso de la Carcasa
      prismas.push({
        x: xMod + t, y: 0, z: zBase,
        dx: anchoInt, dy: profMod, dz: t,
        mat, name: `M${idx + 1} Piso`,
        moduloIndex: idx
      });

      // Techo de la Carcasa / Amarres de Techo
      const tieneAmarre = (m.tiene_liston_amarre === true || m.tiene_liston_amarre === 'true');
      const posAmarre = m.posicion_liston_amarre || 'posterior'; // 'posterior', 'techo', 'ambos'
      const hAmarre = (m.alto_liston_amarre && m.alto_liston_amarre >= 50) ? m.alto_liston_amarre : 80;
      const cantAmarre = m.cant_listones_amarre || 2;

      const usaAmarresTecho = tieneAmarre && (posAmarre === 'techo' || posAmarre === 'ambos');

      if (usaAmarresTecho) {
        // Amarre Frontal de Techo
        prismas.push({
          x: xMod + t, y: 0, z: zBase + hCarcasa - t,
          dx: anchoInt, dy: hAmarre, dz: t,
          mat, name: `M${idx + 1} Amarre Techo Frontal`,
          moduloIndex: idx
        });
        // Amarre Posterior de Techo
        prismas.push({
          x: xMod + t, y: profMod - hAmarre, z: zBase + hCarcasa - t,
          dx: anchoInt, dy: hAmarre, dz: t,
          mat, name: `M${idx + 1} Amarre Techo Posterior`,
          moduloIndex: idx
        });

        // Techo / Tapa sobrepuesta sobre los listones de amarre
        if (m.techo_sobre_liston === true || m.techo_sobre_liston === 'true') {
          prismas.push({
            x: xMod, y: 0, z: zBase + hCarcasa,
            dx: wMod, dy: profMod, dz: t,
            mat, name: `M${idx + 1} Tapa Techo Sobrepuesta`,
            moduloIndex: idx
          });
        }
      } else {
        // Techo Sólido Completo
        prismas.push({
          x: xMod + t, y: 0, z: zBase + hCarcasa - t,
          dx: anchoInt, dy: profMod, dz: t,
          mat, name: `M${idx + 1} Techo`,
          moduloIndex: idx
        });
      }

      // Listones Posteriores de Amarre / Fijación a Pared
      const usaAmarresPost = tieneAmarre && (posAmarre === 'posterior' || posAmarre === 'ambos');
      if (usaAmarresPost) {
        // Listón Superior Posterior
        prismas.push({
          x: xMod + t, y: profMod - t, z: zBase + hCarcasa - t - hAmarre,
          dx: anchoInt, dy: t, dz: hAmarre,
          mat, name: `M${idx + 1} Listón Posterior Superior`,
          moduloIndex: idx
        });

        // Listón Inferior Posterior (si cantAmarre >= 2)
        if (cantAmarre >= 2) {
          prismas.push({
            x: xMod + t, y: profMod - t, z: zBase + t,
            dx: anchoInt, dy: t, dz: hAmarre,
            mat, name: `M${idx + 1} Listón Posterior Inferior`,
            moduloIndex: idx
          });
        }
      }

      // Fondo Posterior de MDF (3mm)
      const tieneFondo = (m.tiene_fondo_mdf === true || m.tiene_fondo_mdf === 'true');
      const posFondo = m.posicion_fondo_mdf || 'delante_liston'; // 'delante_liston' o 'detras_liston'
      const matMdf = 'MDF Fondo Blanco 3mm';

      if (tieneFondo) {
        if (posFondo === 'delante_liston') {
          // Fondo incrustado en ranura delante del listón
          prismas.push({
            x: xMod + t - 6, y: profMod - t - 3, z: zBase + t - 6,
            dx: anchoInt + 12, dy: 3, dz: (hCarcasa - 2 * t) + 12,
            mat: matMdf, name: `M${idx + 1} Fondo MDF Ranurado 3mm`,
            moduloIndex: idx
          });
        } else {
          // Fondo sobrepuesto por detrás del listón
          prismas.push({
            x: xMod, y: profMod, z: zBase,
            dx: wMod, dy: 3, dz: hCarcasa,
            mat: matMdf, name: `M${idx + 1} Fondo MDF Sobrepuesto 3mm`,
            moduloIndex: idx
          });
        }
      }

      // 3. COMPONENTES INTERIORES
      const tipoInt = m.tipo_interior || 'repisas';
      const hVanoUtil = hCarcasa - (2 * t);

      if (tipoInt === 'repisas') {
        const cantRep = m.cant_repisas || 2;
        const pasoRep = hVanoUtil / (cantRep + 1);
        const profRep = profMod - 20;

        for (let r = 1; r <= cantRep; r++) {
          const zRep = zBase + t + (r * pasoRep);
          prismas.push({
            x: xMod + t, y: 20, z: zRep,
            dx: anchoInt, dy: profRep, dz: t,
            mat, name: `M${idx + 1} Repisa ${r}`,
            moduloIndex: idx
          });
        }
      } else if (tipoInt === 'cajonera') {
        const cantCaj = m.cant_cajones || 3;
        const altoFr = (hVanoUtil - (cantCaj * 3)) / cantCaj;

        for (let c = 0; c < cantCaj; c++) {
          const zFr = zBase + t + 3 + (c * (altoFr + 3));
          prismas.push({
            x: xMod + t + 3, y: -2, z: zFr,
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

      xAcumulado += wMod;
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
    // ESTADO 2: DELINEADO (Rectángulo delineado según dimensiones ingresadas)
    // =========================================================================
    if (d.estado === 'delineado' || !d.modulos || d.modulos.length === 0) {
      dibujarRectanguloDelineado(ctx, proyectar, anchoTotal, altoTotal, profTotal, isDark);
      if (renderOptions.mostrarCotas) {
        dibujarCotasGlobales(ctx, proyectar, anchoTotal, altoTotal, profTotal, isDark);
      }
      dibujarBadgeHUD("RECTÁNGULO DELINEADO (Marco General Contenedor)", `${anchoTotal} x ${altoTotal} x ${profTotal} mm`, isDark);
      return;
    }

    // =========================================================================
    // ESTADO 3: MÓDULOS ARMADOS DENTRO DEL RECTÁNGULO DELINEADO
    // =========================================================================
    // 1. Dibujar el marco envolvente en trazo sutil de fondo
    dibujarMarcoEnvolventeFondo(ctx, proyectar, anchoTotal, altoTotal, profTotal, isDark);

    // 2. Construir y proyectar todas las caras de melamina
    const prismas = generarPrismasModulos();
    const caras = [];

    const lightDir = { x: 0.5, y: -0.7, z: 0.8 };
    const lLen = Math.sqrt(lightDir.x * lightDir.x + lightDir.y * lightDir.y + lightDir.z * lightDir.z);
    lightDir.x /= lLen; lightDir.y /= lLen; lightDir.z /= lLen;

    prismas.forEach(prisma => {
      const { x, y, z, dx, dy, dz, mat, moduloIndex } = prisma;

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
          caras.push({
            puntos: fc.pts.map(p => proyectar(p[0], p[1], p[2])),
            profundidadVista: projCentro.profundidadVista,
            factorLuz,
            mat,
            moduloIndex
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
      const fill = `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;

      const esActivo = (cara.moduloIndex === d.modulo_activo);

      ctx.beginPath();
      ctx.moveTo(cara.puntos[0].px, cara.puntos[0].py);
      for (let i = 1; i < cara.puntos.length; i++) {
        ctx.lineTo(cara.puntos[i].px, cara.puntos[i].py);
      }
      ctx.closePath();

      if (!modoAlambre) {
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = esActivo ? '#2563EB' : paleta.border;
        ctx.lineWidth = esActivo ? 1.5 : 0.8;
        ctx.stroke();
      } else {
        ctx.strokeStyle = esActivo ? '#2563EB' : (isDark ? '#38BDF8' : '#0284C7');
        ctx.lineWidth = esActivo ? 1.8 : 1.0;
        ctx.stroke();
      }
    });

    // 3. Resaltar Módulo Activo con marco envolvente brillante
    dibujarResalteModuloActivo(ctx, proyectar, d, isDark);

    // 4. Dibujar Cotas Milimétricas individuales por módulo y globales
    if (renderOptions.mostrarCotas) {
      dibujarCotasModulares(ctx, proyectar, d, isDark);
    }

    // 5. HUD de estado en tiempo real
    dibujarBadgeHUD(`MÓDULOS ARMADOS (${d.modulos.length} Módulos)`, `${anchoTotal} x ${altoTotal} x ${profTotal} mm | Melamina ${d.espesor}mm`, isDark);
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
   * Resalta visualmente el módulo actualmente activo/seleccionado en el formulario.
   */
  function dibujarResalteModuloActivo(ctx, proyectar, d, isDark) {
    const idx = d.modulo_activo;
    const modulos = d.modulos || [];
    if (idx < 0 || idx >= modulos.length) return;

    let xOffset = 0;
    for (let i = 0; i < idx; i++) {
      xOffset += (modulos[i].ancho || 0);
    }

    const m = modulos[idx];
    const wMod = m.ancho || 600;
    const hMod = m.alto || d.alto_total || 2100;
    const profMod = m.profundidad || d.prof_total || 600;

    const p1 = proyectar(xOffset, 0, 0);
    const p2 = proyectar(xOffset + wMod, 0, 0);
    const p3 = proyectar(xOffset + wMod, 0, hMod);
    const p4 = proyectar(xOffset, 0, hMod);

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

    ctx.setLineDash([]);
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`★ MÓDULO ${idx + 1} ACTIVO (${wMod} mm)`, midTopX, midTopY);
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

    let xAcum = 0;
    const modulos = d.modulos || [];

    // Cotas de ancho individuales por módulo en la parte superior
    modulos.forEach((m, idx) => {
      const wMod = m.ancho || 600;
      const hMod = m.alto || d.alto_total || 2100;
      const p1 = proyectar(xAcum, 0, hMod + 40);
      const p2 = proyectar(xAcum + wMod, 0, hMod + 40);

      trazarLineaCota(ctx, p1.px, p1.py, p2.px, p2.py, `M${idx + 1}: ${wMod}`);
      xAcum += wMod;
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
    const y = 16;

    ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = isDark ? '#334155' : '#E2E8F0';
    ctx.lineWidth = 1;

    const pad = 10;
    const boxW = 280;
    const boxH = 46;

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

    // En vista frontal (2D) o isométrica, proyectamos el punto central horizontal de cada módulo
    const d = currentData;
    let xAcum = 0;

    for (let i = 0; i < d.modulos.length; i++) {
      const wMod = d.modulos[i].ancho;
      const xStart = xAcum;
      const xEnd = xAcum + wMod;
      xAcum += wMod;

      // Estimación en coordenadas normalizadas de pantalla
      const fraccionInicio = xStart / d.ancho_total;
      const fraccionFin = xEnd / d.ancho_total;

      const pantallaInicio = rect.width * (0.2 + (fraccionInicio * 0.6));
      const pantallaFin = rect.width * (0.2 + (fraccionFin * 0.6));

      if (clickX >= pantallaInicio && clickX <= pantallaFin) {
        onModuleSelectCallback(i);
        break;
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
    render
  };

  if (typeof window !== 'undefined') {
    window.Preview3D = api;
  }

  return api;
})();

// Asegurar disponibilidad en el objeto global window
if (typeof window !== 'undefined') {
  window.Preview3D = Preview3D;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Preview3D;
}

