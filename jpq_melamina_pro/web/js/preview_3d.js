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
  // Opciones de visualización técnica
  const renderOptions = {
    modoRender: 'solido',      // 'solido' (melamina con luz) o 'alambre' (CAD técnico)
    mostrarCotas: true,        // Cotas milimétricas visibles
    mostrarEjes: true,         // Eje Rojo / Verde de SketchUp
    mostrarRejilla: true,      // Retícula milimétrica
    aperturaAnim: 0.0          // Simulación de apertura cinemática (0.0 cerrado a 1.0 abierto)
  };

  // Modo Simulación interactiva por clic (abrir/cerrar puertas y cajones individualmente)
  let modoSimulacion = false;
  const aperturasPiezas = {};   // Mapa: idPieza -> valor (0.0 cerrado a 1.0 completamente abierto)
  let carasRenderizadas = [];   // Caras proyectadas en pantalla para hit-testing de clics
  let onElementoSimuladoCallback = null;

  // Modo Ocultar / Visualizar Pieza interactiva por clic (mostrar perímetro con líneas punteadas)
  let modoOcultarPiezas = false;
  const piezasOcultas = new Set(); // Conjunto de idPieza ocultas
  let onPiezaVisibilidadCallback = null;

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
    'Melamina Blanca 15mm': { base: [248, 250, 252], border: '#94A3B8', edge: '#E2E8F0' },
    'MDF Fondo Blanco 3mm': { base: [248, 249, 250], border: '#94A3B8', edge: '#CBD5E1' },
    'MDF Fondo Negro 3mm': { base: [26, 26, 26], border: '#0A0A0A', edge: '#1F1F1F' },
    'MDF Fondo Grafito 3mm': { base: [55, 65, 81], border: '#1F2937', edge: '#374151' },
    'MDF Fondo Roble 3mm': { base: [160, 120, 85], border: '#684E2E', edge: '#8F6F47' },
    'MDF Fondo Haya 3mm': { base: [222, 184, 135], border: '#A6804B', edge: '#C49D65' },
    'MDF Fondo Crudo 3mm': { base: [200, 173, 141], border: '#8A7050', edge: '#A88D6F' },
    'Herraje Metal Satinado': { base: [148, 163, 184], border: '#475569', edge: '#64748B' },
    'Cazoleta Perforacion': { base: [30, 41, 59], border: '#0F172A', edge: '#1E293B' },
    'Melamina Roble Natural 18mm': { base: [214, 166, 117], border: '#8C5B32', edge: '#B87A40' },
    'Melamina Gris Antracita 18mm': { base: [56, 62, 68], border: '#1E293B', edge: '#334155' },
    'Colchón Acolchado': { base: [241, 245, 249], border: '#94A3B8', edge: '#E2E8F0' },
    'Pantalla Monitor Gamer': { base: [15, 23, 42], border: '#0284C7', edge: '#38BDF8' },
    'Herraje Negro Mate': { base: [30, 41, 59], border: '#0F172A', edge: '#334155' }
  };

  // Mapeo exhaustivo a archivos reales de texturas PNG en la carpeta textures/
  const RUTA_TEXTURAS = 'textures/';
  const MAPA_ARCHIVOS_TEXTURAS = {
    // MDF Fondos específicos primero
    'mdf fondo blanco': 'mdf_blanco.png',
    'mdf fondo negro': 'pelikano_carbono.png',
    'mdf fondo grafito': 'gris_antracita.png',
    'mdf fondo roble': 'roble_natural.png',
    'mdf fondo haya': 'vesto_aserrado.png',
    'mdf fondo crudo': 'pelikano_duna.png',
    'mdf blanco': 'mdf_blanco.png',

    // Pelikano
    'bellota': 'pelikano_bellota.png',
    'blanco nieve': 'pelikano_blanco_nieve.png',
    'caramel': 'pelikano_caramel.png',
    'carbono': 'pelikano_carbono.png',
    'coñac': 'pelikano_cognac.png',
    'cognac': 'pelikano_cognac.png',
    'duna': 'pelikano_duna.png',
    'macadamia': 'pelikano_macadamia.png',
    'niebla': 'pelikano_niebla.png',
    'óxido': 'pelikano_oxido.png',
    'oxido': 'pelikano_oxido.png',
    'rovere': 'pelikano_rovere.png',

    // Vesto
    'aserrado': 'vesto_aserrado.png',
    'blanco frost': 'vesto_blanco_frost.png',
    'cendra escandinavo': 'vesto_cendra_escandinavo.png',
    'linosa': 'vesto_linosa.png',
    'nogal terracota': 'vesto_nogal_terracota.png',
    'roble cendra': 'vesto_roble_cendra.png',
    'seda giorno': 'vesto_seda_giorno.png',
    'teca lira': 'vesto_teca_lira.png',
    'titán': 'vesto_titan.png',
    'titan': 'vesto_titan.png',
    'wengue': 'vesto_wengue.png',

    // Universales y genéricos
    'roble natural': 'roble_natural.png',
    'gris antracita': 'gris_antracita.png',
    'gris humo': 'gris_antracita.png',
    'gris': 'gris_antracita.png',
    'negro': 'pelikano_carbono.png',
    'haya': 'vesto_aserrado.png',
    'cedro': 'nogal_terracota.png',
    'blanca': 'blanco_melamina.png',
    'blanco': 'blanco_melamina.png'
  };

  // Claves ordenadas por longitud descendente para garantizar prioridad a nombres específicos
  const clavesTexturasOrdenadas = Object.keys(MAPA_ARCHIVOS_TEXTURAS).sort((a, b) => b.length - a.length);

  const textureImageCache = {};
  const texturePatternCache = {};

  /**
   * Resuelve el nombre del archivo de textura PNG según el nombre del material.
   * @param {string} matNombre - Nombre del material
   * @returns {string|null} Nombre de archivo en textures/ o null
   */
  function resolverArchivoTextura(matNombre) {
    if (!matNombre) return null;
    const norm = matNombre.toLowerCase();

    // 1. Fondos MDF específicos
    if (norm.includes('mdf')) {
      for (const k of clavesTexturasOrdenadas) {
        if (k.startsWith('mdf') && norm.includes(k)) {
          return MAPA_ARCHIVOS_TEXTURAS[k];
        }
      }
      return 'mdf_blanco.png';
    }

    // 2. Buscar en Catálogo Maestro de 443 texturas reales
    if (typeof window !== 'undefined' && Array.isArray(window.CATALOGO_TEXTURAS_MAESTRO)) {
      const stripAccents = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const normClean = stripAccents(norm);
      const normFuzzy = normClean.replace(/h/g, '');

      // Prioridad A: Coincidencia simultánea de Marca y Modelo
      const matchMarcaYModelo = window.CATALOGO_TEXTURAS_MAESTRO.find(item => {
        const marca = stripAccents(item.marca);
        const mod = stripAccents(item.nombre_modelo);
        const modFuzzy = mod.replace(/h/g, '');
        if (mod.length < 3) return false;
        const marcaCoincide = normClean.includes(marca) || (marca === 'fablac' && normClean.includes('faplac'));
        if (!marcaCoincide) return false;
        const resto = normClean.replace(marca, '').replace(/15mm|18mm|19mm|3mm/g, '');
        const restoFuzzy = resto.replace(/h/g, '');
        return resto.includes(mod) || mod.includes(resto) || restoFuzzy.includes(modFuzzy) || modFuzzy.includes(restoFuzzy);
      });
      if (matchMarcaYModelo && matchMarcaYModelo.archivo) {
        return matchMarcaYModelo.archivo;
      }

      // Prioridad B: Coincidencia por nombre completo del ítem
      const matchCompleto = window.CATALOGO_TEXTURAS_MAESTRO.find(item => {
        const itemNom = stripAccents(item.nombre);
        return itemNom.length >= 4 && (normClean.includes(itemNom) || itemNom.includes(normClean));
      });
      if (matchCompleto && matchCompleto.archivo) {
        return matchCompleto.archivo;
      }

      // Prioridad C: Coincidencia por modelo (mínimo 4 letras)
      const matchModelo = window.CATALOGO_TEXTURAS_MAESTRO.find(item => {
        const mod = stripAccents(item.nombre_modelo);
        const modFuzzy = mod.replace(/h/g, '');
        return mod.length >= 4 && (normClean.includes(mod) || normFuzzy.includes(modFuzzy));
      });
      if (matchModelo && matchModelo.archivo) {
        return matchModelo.archivo;
      }
    }

    // 3. Fallback heurístico por claves ordenadas
    for (const k of clavesTexturasOrdenadas) {
      if (norm.includes(k)) return MAPA_ARCHIVOS_TEXTURAS[k];
    }
    return null;
  }

  /**
   * Obtiene o carga asíncronamente el CanvasPattern para un material dado.
   * Dispara render() automático al cargar la imagen.
   * @param {string} matNombre - Nombre del material
   * @returns {CanvasPattern|null}
   */
  function obtenerTexturaPatron(matNombre) {
    if (!ctx || !matNombre) return null;
    const archivo = resolverArchivoTextura(matNombre);
    if (!archivo) return null;

    if (!textureImageCache[archivo]) {
      const img = new Image();
      img.src = RUTA_TEXTURAS + archivo;
      img.onload = () => {
        try {
          if (ctx) {
            texturePatternCache[archivo] = ctx.createPattern(img, 'repeat');
            render();
          }
        } catch (e) {}
      };
      textureImageCache[archivo] = img;
      return null;
    }

    if (texturePatternCache[archivo]) {
      return texturePatternCache[archivo];
    }

    const img = textureImageCache[archivo];
    if (img && img.complete && img.naturalWidth > 0) {
      try {
        texturePatternCache[archivo] = ctx.createPattern(img, 'repeat');
        return texturePatternCache[archivo];
      } catch (e) {}
    }
    return null;
  }

  /**
   * Resuelve los colores fotorrealistas para un material determinado.
   */
  function obtenerPaleta(matNombre) {
    let p = null;
    if (!matNombre) {
      p = Object.assign({}, materialColors['Pelikano Blanco Nieve 18mm']);
    } else if (materialColors[matNombre]) {
      p = Object.assign({}, materialColors[matNombre]);
    } else {
      const norm = matNombre.toLowerCase();
      for (const [k, v] of Object.entries(materialColors)) {
        if (norm.includes(k.toLowerCase()) || k.toLowerCase().includes(norm)) {
          p = Object.assign({}, v);
          break;
        }
      }
    }

    if (!p && matNombre && matNombre.startsWith('#') && matNombre.length >= 7) {
      const r = parseInt(matNombre.slice(1, 3), 16) || 200;
      const g = parseInt(matNombre.slice(3, 5), 16) || 160;
      const b = parseInt(matNombre.slice(5, 7), 16) || 120;
      p = {
        base: [r, g, b],
        border: `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`,
        edge: `rgb(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)})`
      };
    }

    if (!p) {
      p = Object.assign({}, materialColors['Pelikano Blanco Nieve 18mm']);
    }

    // Identificador visual de Melamina RH: Núcleo verde hidrófugo (Pelikano / Vesto RH)
    const esRH = (currentData && currentData.resistencia === 'RH') || (matNombre && matNombre.includes('[RH]'));
    const esMdfOArra = matNombre && (matNombre.includes('MDF') || matNombre.includes('Herraje'));
    if (esRH && !esMdfOArra) {
      p = Object.assign({}, p, {
        edge: '#059669', // Tono verde del núcleo hidrófugo
        border: '#047857',
        esRH: true
      });
    }

    return p;
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
    if (camera.isDragging) {
      const dx = e.clientX - camera.lastMouseX;
      const dy = e.clientY - camera.lastMouseY;

      camera.azimuth += dx * 0.01;
      // Permite inclinar la cámara ligeramente hacia arriba (hasta -PI/6) para inspeccionar la parte inferior del zócalo
      camera.elevation = Math.max(-Math.PI / 6, Math.min(Math.PI / 2.02, camera.elevation + dy * 0.01));
      camera.lastMouseX = e.clientX;
      camera.lastMouseY = e.clientY;
      render();
      return;
    }

    if ((modoSimulacion || modoOcultarPiezas) && canvas) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (modoOcultarPiezas) {
        const sobrePieza = carasRenderizadas.slice().reverse().some(c => {
          return c.idPieza && c.puntos && puntoEnPoligono2D(mx, my, c.puntos);
        });
        canvas.style.cursor = sobrePieza ? 'pointer' : 'default';
      } else if (modoSimulacion) {
        const sobreMovil = carasRenderizadas.slice().reverse().some(c => {
          return c.esMovil && c.puntos && puntoEnPoligono2D(mx, my, c.puntos);
        });
        canvas.style.cursor = sobreMovil ? 'pointer' : 'default';
      }
    }
  }

  /**
   * Finaliza el arrastre de la cámara.
   */
  function onMouseUp() {
    camera.isDragging = false;
    if (canvas) {
      canvas.style.cursor = (modoSimulacion || modoOcultarPiezas) ? 'default' : 'grab';
    }
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
   * Modifica el nivel de apertura cinemática (0.0 cerrado a 1.0 completamente abierto).
   * Desplaza los cajones hacia adelante y abate/eleva las puertas según sus bisagras.
   * @param {number} val - Nivel de apertura entre 0.0 y 1.0.
   */
  function setAperturaAnim(val) {
    renderOptions.aperturaAnim = Math.max(0, Math.min(1.0, parseFloat(val) || 0));
    // Sincronizar piezas individuales si se ajusta el slider global
    for (const k in aperturasPiezas) {
      delete aperturasPiezas[k];
    }
    render();
  }

  /**
   * Obtiene el nivel actual de apertura cinemática.
   * @returns {number} Valor entre 0.0 y 1.0.
   */
  function getAperturaAnim() {
    return renderOptions.aperturaAnim || 0;
  }

  /**
   * Activa o desactiva el modo de simulación interactiva por clic.
   * @param {boolean} activo
   */
  function setModoSimulacion(activo) {
    modoSimulacion = !!activo;
    if (canvas) {
      canvas.style.cursor = modoSimulacion ? 'default' : 'grab';
    }
    render();
  }

  function getModoSimulacion() {
    return modoSimulacion;
  }

  function toggleModoSimulacion() {
    setModoSimulacion(!modoSimulacion);
    return modoSimulacion;
  }

  /**
   * Activa o desactiva el modo interactivo para ocultar/visualizar piezas por clic.
   * Si se desactiva, todas las piezas que se encuentren ocultas se restauran inmediatamente.
   * @param {boolean} activo
   */
  function setModoOcultarPiezas(activo) {
    modoOcultarPiezas = !!activo;
    if (!modoOcultarPiezas) {
      piezasOcultas.clear();
    }
    if (canvas) {
      canvas.style.cursor = (modoOcultarPiezas || modoSimulacion) ? 'default' : 'grab';
    }
    render();
  }

  function getModoOcultarPiezas() {
    return modoOcultarPiezas;
  }

  function toggleModoOcultarPiezas() {
    setModoOcultarPiezas(!modoOcultarPiezas);
    return modoOcultarPiezas;
  }

  function setOnPiezaVisibilidadCallback(cb) {
    onPiezaVisibilidadCallback = cb;
  }

  function getPiezasOcultas() {
    return Array.from(piezasOcultas);
  }

  function mostrarTodasLasPiezas() {
    piezasOcultas.clear();
    render();
  }

  /**
   * Anima la apertura/cierre de una pieza específica (cajón o puerta).
   * @param {string} idPieza - ID único de la pieza móvil (ej. 'm0_cajon_0')
   * @param {number} meta - Nivel destino (1.0 = abierto, 0.0 = cerrado)
   * @param {number} duracionMs - Duración en ms (por defecto 280ms)
   */
  function animarAperturaPieza(idPieza, meta, duracionMs = 280) {
    const inicio = aperturasPiezas[idPieza] !== undefined ? aperturasPiezas[idPieza] : (renderOptions.aperturaAnim || 0);
    const inicioTiempo = performance.now();

    function paso(ahora) {
      const progreso = Math.min(1.0, (ahora - inicioTiempo) / duracionMs);
      // Easing cúbico natural
      const ease = progreso < 0.5 ? 4 * progreso * progreso * progreso : 1 - Math.pow(-2 * progreso + 2, 3) / 2;
      aperturasPiezas[idPieza] = inicio + ((meta - inicio) * ease);
      render();

      if (progreso < 1.0) {
        requestAnimationFrame(paso);
      } else {
        aperturasPiezas[idPieza] = meta;
        render();
      }
    }

    requestAnimationFrame(paso);
  }

  /**
   * Verifica si un punto 2D (x, y) en píxeles de canvas cae dentro de un polígono.
   * Algoritmo Ray-Casting rápido para hit-testing de caras 3D en pantalla.
   */
  function puntoEnPoligono2D(px, py, puntos) {
    if (!puntos || puntos.length < 3) return false;
    let dentro = false;
    for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
      const xi = puntos[i].px, yi = puntos[i].py;
      const xj = puntos[j].px, yj = puntos[j].py;
      const intersecta = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersecta) dentro = !dentro;
    }
    return dentro;
  }

  function setOnElementoSimuladoCallback(cb) {
    onElementoSimuladoCallback = cb;
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

      // REGLA ERGONÓMICA: Si la columna a nivel de piso (n=0) tiene_piso === false (ej. vano libre para piernas/silla o lavadora),
      // los laterales descansan directamente en el suelo (Z = 0) y NO se elevan sobre el zócalo.
      const itemsNivelCero = nivelesMap.get(0) || [];
      const colSinPisoEnSuelo = itemsNivelCero.some(it => it.m.tiene_piso === false || it.m.tiene_piso === 'false');

      let zAcumulado = (tieneZocaloGlobal && !colSinPisoEnSuelo) ? zocaloGlobalH : 0;
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
   * Genera las 6 caras de un prisma cartesiano con soporte para rotación angular sobre un eje/pivote.
   * Calcula normales exactas por producto cruz para iluminación y descarte de caras posteriores.
   */
  function generarCarasPrismaRotado(x, y, z, dx, dy, dz, rot) {
    const rawPts = [
      [x, y, z],
      [x + dx, y, z],
      [x + dx, y + dy, z],
      [x, y + dy, z],
      [x, y, z + dz],
      [x + dx, y, z + dz],
      [x + dx, y + dy, z + dz],
      [x, y + dy, z + dz]
    ];

    let pts = rawPts;
    if (rot && Math.abs(rot.anguloRad || 0) > 0.0001) {
      const a = rot.anguloRad;
      const cosT = Math.cos(a);
      const sinT = Math.sin(a);
      const px = rot.pivotX || 0;
      const py = rot.pivotY || 0;
      const pz = rot.pivotZ || 0;

      if (rot.eje === 'X') {
        pts = rawPts.map(([vx, vy, vz]) => {
          const dy0 = vy - py;
          const dz0 = vz - pz;
          return [
            vx,
            py + (dy0 * cosT) - (dz0 * sinT),
            pz + (dy0 * sinT) + (dz0 * cosT)
          ];
        });
      } else if (rot.eje === 'Z') {
        pts = rawPts.map(([vx, vy, vz]) => {
          const dx0 = vx - px;
          const dy0 = vy - py;
          return [
            px + (dx0 * cosT) - (dy0 * sinT),
            py + (dx0 * sinT) + (dy0 * cosT),
            vz
          ];
        });
      }
    }

    function calcCara(indices, extra) {
      const pList = indices.map(i => pts[i]);
      const p0 = pList[0], p1 = pList[1], p2 = pList[2];
      const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
      const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
      let nx = (uy * vz) - (uz * vy);
      let ny = (uz * vx) - (ux * vz);
      let nz = (ux * vy) - (uy * vx);
      const len = Math.sqrt((nx * nx) + (ny * ny) + (nz * nz)) || 1;
      return Object.assign({ norm: { x: nx / len, y: ny / len, z: nz / len }, pts: pList }, extra || {});
    }

    return [
      calcCara([4, 5, 6, 7]), // Top (+Z)
      calcCara([0, 1, 5, 4]), // Front (-Y)
      calcCara([3, 7, 6, 2]), // Back (+Y)
      calcCara([0, 4, 7, 3]), // Left (-X)
      calcCara([1, 2, 6, 5]), // Right (+X)
      calcCara([0, 3, 2, 1])  // Bottom (-Z)
    ];
  }

  /**
   * Genera los prismas 3D de cada pieza de la composición paramétrica.
   * @param {Object} [dataOverride] - Datos opcionales para generación sin pasar por currentData.
   */
  function generarPrismasModulos(dataOverride) {
    const d = dataOverride || currentData;
    const t = d.espesor || 18;
    const matInterior = d.material_interior || d.material || 'Pelikano Blanco Nieve 18mm';
    const matFrentes = d.material_frentes || d.material || 'Pelikano Blanco Nieve 18mm';
    const matMdf = d.color_mdf || 'MDF Fondo Blanco 3mm';
    const mat = matInterior;
    const modulos = d.modulos || [];
    const prismas = [];

    const geomMapeo = calcularGeometriaColumnasYApilado(modulos, d);

    // ZÓCALO INFERIOR GLOBAL (Segmentado inteligentemente por columnas para respetar vanos libres/piernas de escritorios)
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

      // Mapear columnas a nivel de piso (nivel 0) para detectar cuáles tienen piso y cuáles son vanos libres
      const modulosPisoCero = modulos.map((m, idx) => ({ m, geom: geomMapeo[idx] }))
        .filter(it => it.geom && it.geom.nivel === 0);

      const columnasConPiso = [];
      const columnasSinPiso = [];
      const colsVistas = new Set();

      modulosPisoCero.forEach(it => {
        const cIdx = it.geom.colIdx;
        if (!colsVistas.has(cIdx)) {
          colsVistas.add(cIdx);
          const tienePisoCol = (it.m.tiene_piso !== false && it.m.tiene_piso !== 'false');
          const colInfo = { colIdx: cIdx, x: it.geom.xPos, w: it.geom.wCol || it.geom.wMod };
          if (tienePisoCol) {
            columnasConPiso.push(colInfo);
          } else {
            columnasSinPiso.push(colInfo);
          }
        }
      });

      if (columnasConPiso.length > 0) {
        if (columnasSinPiso.length === 0) {
          // Mueble 100% cerrado (sin vanos libres de piernas): Zócalo perimétrico continuo estándar
          prismas.push({
            x: 0, y: retransZocalo, z: 0,
            dx: anchoTotal, dy: t, dz: zocaloGlobalH,
            mat, name: 'Zócalo Frontal Continuo',
            moduloIndex: -1,
            esZocaloFrontal: true,
            esZocaloBase: true
          });

          prismas.push({
            x: 0, y: profTotal - t, z: 0,
            dx: anchoTotal, dy: t, dz: zocaloGlobalH,
            mat, name: 'Zócalo Posterior Continuo',
            moduloIndex: -1,
            esZocaloBase: true
          });

          prismas.push({
            x: 0, y: retransZocalo + t, z: 0,
            dx: t, dy: profTrans, dz: zocaloGlobalH,
            mat, name: 'Zócalo Lateral Izquierdo',
            moduloIndex: -1,
            esZocaloBase: true
          });

          prismas.push({
            x: anchoTotal - t, y: retransZocalo + t, z: 0,
            dx: t, dy: profTrans, dz: zocaloGlobalH,
            mat, name: 'Zócalo Lateral Derecho',
            moduloIndex: -1,
            esZocaloBase: true
          });

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
        } else {
          // Mueble HÍBRIDO (ej. escritorio con pedestal cajonero o mostrador con vano de piernas):
          // Solo se genera zócalo bajo las columnas cerradas con piso.
          // El vano libre para las piernas queda 100% despejado hasta el suelo sin ningún obstáculo.
          columnasConPiso.forEach(col => {
            const xC = col.x;
            const wC = col.w;

            prismas.push({
              x: xC, y: retransZocalo, z: 0,
              dx: wC, dy: t, dz: zocaloGlobalH,
              mat, name: `Zócalo Frontal Pedestal (Columna ${col.colIdx + 1})`,
              moduloIndex: -1,
              esZocaloFrontal: true,
              esZocaloBase: true
            });

            prismas.push({
              x: xC, y: profTotal - t, z: 0,
              dx: wC, dy: t, dz: zocaloGlobalH,
              mat, name: `Zócalo Posterior Pedestal (Columna ${col.colIdx + 1})`,
              moduloIndex: -1,
              esZocaloBase: true
            });

            prismas.push({
              x: xC, y: retransZocalo + t, z: 0,
              dx: t, dy: profTrans, dz: zocaloGlobalH,
              mat, name: `Zócalo Lateral Izq (Columna ${col.colIdx + 1})`,
              moduloIndex: -1,
              esZocaloBase: true
            });

            prismas.push({
              x: xC + wC - t, y: retransZocalo + t, z: 0,
              dx: t, dy: profTrans, dz: zocaloGlobalH,
              mat, name: `Zócalo Lateral Der (Columna ${col.colIdx + 1})`,
              moduloIndex: -1,
              esZocaloBase: true
            });
          });
        }
      }
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

      // Descuento de profundidad de carcasa si lleva frente exterior (puerta o tapa de cajón sobrepuesta)
      const dimCarcasa = (typeof window.calcularDimensionesCarcasa === 'function')
        ? window.calcularDimensionesCarcasa(m, t)
        : { profCarcasa: profMod, yCarcasaStart: 0, descuentaFrente: false };
      const profCarcasa = dimCarcasa.profCarcasa;
      const yCarcasaStart = dimCarcasa.yCarcasaStart;

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
          x: xMod, y: yCarcasaStart, z: zBase,
          dx: t, dy: profCarcasa, dz: hLateral,
          mat, name: `M${idx + 1} Lateral Izq`,
          moduloIndex: idx,
          esInteriorConCantoFrontis: true
        });

        prismas.push({
          x: xMod + wMod - t, y: yCarcasaStart, z: zBase,
          dx: t, dy: profCarcasa, dz: hLateral,
          mat, name: `M${idx + 1} Lateral Der`,
          moduloIndex: idx,
          esInteriorConCantoFrontis: true
        });
      }

      // Zócalo Inferior Perimétrico Base (rectángulo perimétrico + listones interiores)
      if (tieneZocalo && zocaloH > 0) {
        const largoLatZocalo = Math.max(50, profCarcasa - retransZocalo);
        const anchoZocaloPerim = Math.max(0, wMod - (2 * t));

        // 1. Listón frontal (va entre los laterales de zócalo)
        prismas.push({
          x: xMod + t, y: yCarcasaStart + retransZocalo, z: zStack,
          dx: anchoZocaloPerim, dy: t, dz: zocaloH,
          mat, name: `M${idx + 1} Zócalo Frontal`,
          moduloIndex: idx,
          esZocaloFrontal: true
        });

        // 2. Listón posterior (va entre los laterales de zócalo)
        prismas.push({
          x: xMod + t, y: yCarcasaStart + profCarcasa - t, z: zStack,
          dx: anchoZocaloPerim, dy: t, dz: zocaloH,
          mat, name: `M${idx + 1} Zócalo Posterior`,
          moduloIndex: idx
        });

        // 3. Lateral Izquierdo de Zócalo (cierra el perímetro)
        prismas.push({
          x: xMod, y: yCarcasaStart + retransZocalo, z: zStack,
          dx: t, dy: largoLatZocalo, dz: zocaloH,
          mat, name: `M${idx + 1} Zócalo Lateral Izquierdo`,
          moduloIndex: idx
        });

        // 4. Lateral Derecho de Zócalo (cierra el perímetro)
        prismas.push({
          x: xMod + wMod - t, y: yCarcasaStart + retransZocalo, z: zStack,
          dx: t, dy: largoLatZocalo, dz: zocaloH,
          mat, name: `M${idx + 1} Zócalo Lateral Derecho`,
          moduloIndex: idx
        });

        // 5. Listones transversales interiores de soporte del zócalo
        if (cantInternosZocalo > 0) {
          const profTrans = profCarcasa - retransZocalo - (2 * t);
          if (profTrans > 0) {
            for (let k = 1; k <= cantInternosZocalo; k++) {
              const frac = k / (cantInternosZocalo + 1);
              const xTrans = xMod + (wMod * frac) - (t / 2);
              const descNombre = (cantInternosZocalo === 1)
                ? `M${idx + 1} Listón Soporte Zócalo Central`
                : `M${idx + 1} Listón Soporte Zócalo ${k}/${cantInternosZocalo}`;

              prismas.push({
                x: xTrans, y: yCarcasaStart + retransZocalo + t, z: zStack,
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
              x: xMod + xOffsetInt, y: yCarcasaStart, z: zBase,
              dx: anchoInt, dy: wListonPiso, dz: t,
              mat, name: `M${idx + 1} Amarre Piso Frontal`,
              moduloIndex: idx
            });
          } else {
            const espacioGapsPiso = Math.max(0, profCarcasa - (cantPiso * wListonPiso));
            const pasoGapPiso = espacioGapsPiso / (cantPiso - 1);

            for (let k = 0; k < cantPiso; k++) {
              const yPos = yCarcasaStart + Math.round(k * (wListonPiso + pasoGapPiso));
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
            x: xMod + xOffsetInt, y: yCarcasaStart, z: zBase,
            dx: anchoInt, dy: profCarcasa, dz: t,
            mat, name: `M${idx + 1} Piso Carcasa`,
            moduloIndex: idx,
            esInteriorConCantoFrontis: true
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
              x: xMod + xOffsetInt, y: yCarcasaStart, z: zBase + hCarcasa - t,
              dx: anchoInt, dy: wListonTecho, dz: t,
              mat, name: `M${idx + 1} Amarre Techo Frontal`,
              moduloIndex: idx
            });
          } else {
            const espacioGaps = Math.max(0, profCarcasa - (cantTecho * wListonTecho));
            const pasoGap = espacioGaps / (cantTecho - 1);

            for (let k = 0; k < cantTecho; k++) {
              const yPos = yCarcasaStart + Math.round(k * (wListonTecho + pasoGap));
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
                x: xMod, y: yCarcasaStart, z: zBase + hCarcasa,
                dx: wMod, dy: profCarcasa, dz: t,
                mat, name: `M${idx + 1} Techo Sobrepuesto Doble Melamina (Capa Inf. ${t}mm)`,
                moduloIndex: idx
              });
              // Capa Superior (18mm engrosado)
              prismas.push({
                x: xMod, y: yCarcasaStart, z: zBase + hCarcasa + t,
                dx: wMod, dy: profCarcasa, dz: t,
                mat, name: `M${idx + 1} Techo Sobrepuesto Doble Melamina (Capa Sup. ${t}mm)`,
                moduloIndex: idx
              });
            } else {
              prismas.push({
                x: xMod, y: yCarcasaStart, z: zBase + hCarcasa,
                dx: wMod, dy: profCarcasa, dz: t,
                mat, name: `M${idx + 1} Tapa Techo Sobrepuesta Simple (${t}mm)`,
                moduloIndex: idx
              });
            }
          }
        } else {
          // Techo Sólido Completo Estándar
          prismas.push({
            x: xMod + xOffsetInt, y: yCarcasaStart, z: zBase + hCarcasa - t,
            dx: anchoInt, dy: profCarcasa, dz: t,
            mat, name: `M${idx + 1} Techo Carcasa Sólido`,
            moduloIndex: idx
          });
        }
      }

      // Zócalo Superior (Frontal de melamina en todo el ancho interior)
      if (tieneZocaloSup && zocaloSupH > 0) {
        prismas.push({
          x: xMod + xOffsetInt, y: yCarcasaStart, z: zBase + hCarcasa,
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

      // Fondo Posterior (Fondo Panel, MDF, Melamina o Ninguno)
      const posFondo = m.posicion_fondo_mdf || 'delante_liston';
      const grosorMdf = parseFloat(m.grosor_mdf) || 3;
      const profRanura = (m.prof_ranura_mdf !== undefined) ? parseFloat(m.prof_ranura_mdf) : 8;
      // Retranqueo de ranura: siempre mínimo t (18 mm) en delante_liston para alojar los listones posteriores
      const distRanura = (posFondo === 'delante_liston')
        ? Math.max(t, (m.dist_ranura_mdf !== undefined && parseFloat(m.dist_ranura_mdf) > 0) ? parseFloat(m.dist_ranura_mdf) : t)
        : Math.max(0, parseFloat(m.dist_ranura_mdf) || 0);
      const matMdfFondo = d.color_mdf || `MDF Fondo Blanco ${grosorMdf}mm`;

      // Listones Posteriores de Amarre / Fijación a Pared (solo si lleva laterales y no es fondo melamina ni panel)
      const usaAmarresPost = tieneLaterales && (tipoFondo !== 'melamina') && (tipoFondo !== 'panel') && (
        (m.tiene_liston_post !== false && m.tiene_liston_post !== 'false') ||
        ((m.tiene_liston_amarre === true || m.tiene_liston_amarre === 'true') && (m.posicion_liston_amarre === 'posterior' || m.posicion_liston_amarre === 'ambos'))
      );

      if (usaAmarresPost) {
        const cantPost = Math.max(1, Math.min(6, parseInt(m.cant_listones_post || m.cant_listones_amarre || 2)));
        const orientacionPost = m.orientacion_liston_post || m.orientacion_listones_post || 'horizontal';
        const wUser = parseFloat(m.ancho_liston_post || m.medida_liston_post || m.alto_liston_amarre || m.ancho_liston);
        const wListonPost = (wUser && wUser > 0) ? wUser : 80;
        const hVanoUtilPost = Math.max(50, hCarcasa - (tienePiso ? t : 0) - (tieneTecho ? t : 0));
        const zStartPost = zBase + (tienePiso ? t : 0);

        // Si el fondo es MDF enranurado (delante_liston), el listón se ubica DETRÁS del fondo
        // a effDistRanura (18mm estándar) del borde posterior.
        const effDistRanura = Math.max(18, distRanura || 18);
        const yListonAmarre = (tipoFondo === 'mdf' && posFondo === 'delante_liston')
          ? (profMod - effDistRanura)
          : (yCarcasaStart + profCarcasa - t);
        const espListon = (tipoFondo === 'mdf' && posFondo === 'delante_liston')
          ? effDistRanura
          : t;

        if (orientacionPost === 'vertical') {
          // Listones VERTICALES en el fondo
          if (cantPost === 1) {
            const xPos = xMod + xOffsetInt + Math.round((anchoInt - wListonPost) / 2);
            prismas.push({
              x: xPos, y: yListonAmarre, z: zStartPost,
              dx: wListonPost, dy: espListon, dz: hVanoUtilPost,
              mat, name: `M${idx + 1} Listón Fondo Vertical Central (${wListonPost}x${hVanoUtilPost}mm)`,
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
                x: xPos, y: yListonAmarre, z: zStartPost,
                dx: wListonPost, dy: espListon, dz: hVanoUtilPost,
                mat, name: nom,
                moduloIndex: idx
              });
            }
          }
        } else {
          // Listones HORIZONTALES en el fondo (repartidos a lo alto)
          if (cantPost === 1) {
            const zPos = zBase + hCarcasa - (tieneTecho ? t : 0) - wListonPost;
            prismas.push({
              x: xMod + xOffsetInt, y: yListonAmarre, z: zPos,
              dx: anchoInt, dy: espListon, dz: wListonPost,
              mat, name: `M${idx + 1} Listón Posterior Superior (${anchoInt}x${wListonPost}mm)`,
              moduloIndex: idx
            });
          } else if (cantPost === 2) {
            // 1 Superior y 1 Inferior (o Faldón Superior si es módulo sin piso como escritorio)
            const zSup = zBase + hCarcasa - (tieneTecho ? t : 0) - wListonPost;
            prismas.push({
              x: xMod + xOffsetInt, y: yListonAmarre, z: zSup,
              dx: anchoInt, dy: espListon, dz: wListonPost,
              mat, name: `M${idx + 1} Listón Posterior Superior (${anchoInt}x${wListonPost}mm)`,
              moduloIndex: idx
            });

            // REGLA ERGONÓMICA: Si el módulo NO tiene piso (vano libre piernas / silla de escritorio),
            // NUNCA se coloca un listón inferior en el suelo (z=0) ya que estorba las piernas.
            if (tienePiso) {
              prismas.push({
                x: xMod + xOffsetInt, y: yListonAmarre, z: zStartPost,
                dx: anchoInt, dy: espListon, dz: wListonPost,
                mat, name: `M${idx + 1} Listón Posterior Inferior (${anchoInt}x${wListonPost}mm)`,
                moduloIndex: idx
              });
            } else {
              // En vano libre sin piso para escritorio, el segundo listón actúa como faldón superior de rigidez
              const zFaldon = zSup - wListonPost - 10;
              if (zFaldon > zBase + 200) {
                prismas.push({
                  x: xMod + xOffsetInt, y: yListonAmarre, z: zFaldon,
                  dx: anchoInt, dy: espListon, dz: wListonPost,
                  mat, name: `M${idx + 1} Listón Faldón Posterior (${anchoInt}x${wListonPost}mm)`,
                  moduloIndex: idx
                });
              }
            }
          } else {
            // 3 o más listones distribuidos proporcionalmente a lo alto
            const espacioGaps = Math.max(0, hVanoUtilPost - (cantPost * wListonPost));
            const pasoGap = (cantPost > 1) ? (espacioGaps / (cantPost - 1)) : 0;

            for (let k = 0; k < cantPost; k++) {
              // Si no tiene piso y es el listón más bajo (k=0), no colocarlo a nivel de suelo
              if (k === 0 && !tienePiso) continue;

              const zPos = zStartPost + Math.round(k * (wListonPost + pasoGap));
              let nom = `M${idx + 1} Listón Posterior `;
              if (k === 0) nom += 'Inferior';
              else if (k === cantPost - 1) nom += 'Superior';
              else nom += `Intermedio ${k}`;

              prismas.push({
                x: xMod + xOffsetInt, y: yListonAmarre, z: zPos,
                dx: anchoInt, dy: espListon, dz: wListonPost,
                mat, name: nom,
                moduloIndex: idx
              });
            }
          }
        }
      }

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
                mat,
                name: `M${idx + 1} Listón Anclaje Pared ${k + 1} (${largoListonPanel}x${hListonPanel}mm)`,
                moduloIndex: idx
              });
            }
          }
        }
      } else if (tipoFondo === 'mdf') {
        if (posFondo === 'delante_liston') {
          // Fondo incrustado en ranura con retranqueo posterior (mínimo 18mm para amarres).
          // Fórmula oficial de taller (reglas_del_proyecto.md Section 2.3):
          // Ancho Fondo MDF = Ancho Interior Vano + (2 * Profundidad Ranura) - 2 mm
          // Alto Fondo MDF  = Alto Interior Vano  + (2 * Profundidad Ranura) - 2 mm
          const holguraMdf = 1.0;  // holgura térmica por lado (2mm total)
          const effDistRanura = Math.max(18, distRanura || 18);
          const hVanoPost = Math.max(0, hCarcasa - (tienePiso ? t : 0) - (tieneTecho ? t : 0));
          const wMdf = anchoInt + (2 * profRanura) - (2 * holguraMdf);
          const hMdf = hVanoPost + (2 * profRanura) - (2 * holguraMdf);
          // Posición X: entra profRanura - holgura en el lateral izquierdo
          const xMdf = xMod + xOffsetInt - profRanura + holguraMdf;
          // Posición Z: entra profRanura - holgura en el piso
          const zMdf = zIntBase - profRanura + holguraMdf;
          prismas.push({
            x: xMdf,
            y: profMod - effDistRanura - grosorMdf,
            z: zMdf,
            dx: wMdf, dy: grosorMdf, dz: hMdf,
            mat: matMdf, name: `M${idx + 1} Fondo MDF Ranurado ${grosorMdf}mm (Retranqueo: ${effDistRanura}mm)`,
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
        // =====================================================================
        // CAJONERA INDUSTRIAL COMPLETA EN 3D (Frentes con tirador, laterales,
        // contrafrente, trasera, fondo MDF 3mm ranurado y rieles correderas)
        // =====================================================================
        const cantCaj = Math.max(2, parseInt(m.cant_cajones) || 3);
        const montajeCaj = m.cajones_montaje || 'exterior';
        const tipoCorr = m.cajones_tipo_corredera || 'telescopica';
        const posCorr = m.cajones_posicion_corredera || 'baja';
        const luz = (m.cajones_luz !== undefined) ? parseFloat(m.cajones_luz) : (d && d.luz_frentes !== undefined ? parseFloat(d.luz_frentes) : 3.0);
        const tCaja = 15.0; // melamina 15mm para caja de gaveta

        const tienePuertasMod = (m.tiene_puertas === true || m.tiene_puertas === 'true' || m.tipo_interior === 'puertas');
        const posPMod = m.puertas_posicion_bisagra || m.puertas_apertura || 'derecha';
        const esCorredizaMod = tienePuertasMod && (posPMod === 'corrediza');

        const descSlide = (tipoCorr === 'oculta') ? 21.0 : (tipoCorr === 'metalica' ? 37.5 : 26.0);
        const wExtBox = Math.max(60, anchoInt - descSlide);
        const maxSlide = esCorredizaMod ? (profCarcasa - 80 - 30) : (profCarcasa - 30);
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

        // Medidas milimétricas de frentes respetando luz estándar perimétrica y entre cajones
        let altoFr = 0, anchoFr = 0, xFr = 0, yFrBase = 0, zFrBase = 0;
        if (esCorredizaMod) {
          // Cajones interiores embutidos detrás de puertas corredizas (-80mm de espacio frontal)
          altoFr = (hVanoUtil - ((cantCaj + 1) * luz)) / cantCaj;
          anchoFr = anchoInt - (2 * luz);
          xFr = xMod + xOffsetInt + luz;
          yFrBase = yCarcasaStart + 80;
          zFrBase = zIntBase + luz;
        } else if (montajeCaj === 'exterior') {
          altoFr = (hCarcasa - ((cantCaj + 1) * luz)) / cantCaj;
          anchoFr = tieneLaterales ? (wMod - (2 * luz)) : (anchoInt - (2 * luz));
          xFr = tieneLaterales ? (xMod + luz) : (xMod + xOffsetInt + luz);
          yFrBase = yCarcasaStart - t;
          zFrBase = zBase + luz;
        } else {
          altoFr = (hVanoUtil - ((cantCaj + 1) * luz)) / cantCaj;
          anchoFr = anchoInt - (2 * luz);
          xFr = xMod + xOffsetInt + luz;
          yFrBase = yCarcasaStart + luz;
          zFrBase = zIntBase + luz;
        }

        const altoBox = Math.max(60, Math.min(Math.round(altoFr - 42), 240));

        for (let c = 0; c < cantCaj; c++) {
          const idCajon = `m${idx}_cajon_${c}`;
          const aperturaCaj = (aperturasPiezas[idCajon] !== undefined)
            ? aperturasPiezas[idCajon]
            : (renderOptions.aperturaAnim || 0);
          const pullY = -aperturaCaj * (largoSlide * 0.72);

          const zFr = zFrBase + (c * (altoFr + luz));
          const yFr = yFrBase + pullY;

          // 1. Frente de cajón con luz perimetral exacta
          prismas.push({
            x: xFr, y: yFr, z: zFr,
            dx: anchoFr, dy: t, dz: altoFr,
            mat: m.material_frentes || d.material_frentes || matFrentes,
            name: `M${idx + 1} Frente Cajón ${c + 1} (${montajeCaj === 'exterior' ? 'Tapa Exterior' : 'Embutido'})`,
            moduloIndex: idx,
            esMovil: true,
            tipoMovil: 'cajon',
            idMovil: idCajon,
            nombrePieza: `Cajón ${c + 1} (Módulo ${idx + 1})`
          });

          // 2. Tirador metálico satinado en el frente
          const wTirador = Math.min(140, Math.max(80, anchoFr * 0.35));
          prismas.push({
            x: xFr + (anchoFr - wTirador) / 2,
            y: yFr - 18,
            z: zFr + (altoFr / 2) - 6,
            dx: wTirador, dy: 18, dz: 12,
            mat: 'Herraje Metal Satinado',
            name: `M${idx + 1} Tirador Cajón ${c + 1}`,
            moduloIndex: idx,
            esMovil: true,
            tipoMovil: 'cajon',
            idMovil: idCajon,
            nombrePieza: `Cajón ${c + 1} (Módulo ${idx + 1})`
          });

          // 3. Estructura 3D de la gaveta interior (Laterales, Contrafrente, Trasera y Fondo)
          const xBox = xMod + xOffsetInt + (descSlide / 2);
          const yBox = (montajeCaj === 'exterior' ? yCarcasaStart : (yFrBase + t)) + pullY;
          const zBox = zFr + 16;

          // Lateral Izquierdo de gaveta (15mm)
          prismas.push({
            x: xBox, y: yBox, z: zBox,
            dx: tCaja, dy: largoSlide, dz: altoBox,
            mat: 'Melamina Blanca 15mm',
            name: `M${idx + 1} Lateral Izq Gaveta ${c + 1}`,
            moduloIndex: idx
          });

          // Lateral Derecho de gaveta (15mm)
          prismas.push({
            x: xBox + wExtBox - tCaja, y: yBox, z: zBox,
            dx: tCaja, dy: largoSlide, dz: altoBox,
            mat: 'Melamina Blanca 15mm',
            name: `M${idx + 1} Lateral Der Gaveta ${c + 1}`,
            moduloIndex: idx
          });

          // Contrafrente interior de gaveta (15mm)
          prismas.push({
            x: xBox + tCaja, y: yBox, z: zBox,
            dx: Math.max(10, wExtBox - (2 * tCaja)), dy: tCaja, dz: altoBox,
            mat: 'Melamina Blanca 15mm',
            name: `M${idx + 1} Contrafrente Gaveta ${c + 1}`,
            moduloIndex: idx
          });

          // Trasera interior de gaveta (15mm)
          prismas.push({
            x: xBox + tCaja, y: yBox + largoSlide - tCaja, z: zBox,
            dx: Math.max(10, wExtBox - (2 * tCaja)), dy: tCaja, dz: altoBox,
            mat: 'Melamina Blanca 15mm',
            name: `M${idx + 1} Trasera Gaveta ${c + 1}`,
            moduloIndex: idx
          });

          // Fondo MDF 3mm ranurado en la gaveta
          prismas.push({
            x: xBox + 4, y: yBox + 4, z: zBox + 12,
            dx: Math.max(10, wExtBox - 8), dy: Math.max(10, largoSlide - 8), dz: 3,
            mat: d.color_mdf || 'MDF Fondo Blanco 3mm',
            name: `M${idx + 1} Fondo MDF 3mm Gaveta ${c + 1}`,
            moduloIndex: idx
          });

          // Listón(es) de amarre / refuerzo estructural bajo el fondo de la gaveta (Norma anti-pandeo para cajones anchos)
          // Si el ancho exterior de la caja supera 600 mm (cajonera >= 700 mm), se colocan listones
          // de melamina longitudinales bajo el MDF para evitar arqueo, pandeo o que se desfonde con peso.
          const cantRefuerzosFondo = (wExtBox >= 900) ? 2 : (wExtBox >= 600 ? 1 : 0);
          if (cantRefuerzosFondo > 0) {
            const wRef = 70; // listón de amarre de 70 mm
            for (let r = 1; r <= cantRefuerzosFondo; r++) {
              const fracR = r / (cantRefuerzosFondo + 1);
              const xRef = xBox + (wExtBox * fracR) - (wRef / 2);
              prismas.push({
                x: xRef,
                y: yBox + tCaja,
                z: zBox,
                dx: wRef,
                dy: Math.max(10, largoSlide - (2 * tCaja)),
                dz: 12,
                mat: 'Melamina Blanca 15mm',
                name: `M${idx + 1} Listón Refuerzo Anti-Pandeo Fondo Gaveta ${c + 1} (${r}/${cantRefuerzosFondo})`,
                moduloIndex: idx
              });
            }
          }

          // 4. Correderas metálicas en los laterales del mueble según posición seleccionada
          const zSlide = (posCorr === 'central')
            ? (zBox + (altoBox / 2) - 12)
            : ((posCorr === 'al_tercio') ? (zBox + (altoBox / 3)) : (zBox + 6));

          // Riel corredera lateral izquierdo
          prismas.push({
            x: xMod + xOffsetInt + 1, y: yCarcasaStart + 4, z: zSlide,
            dx: (descSlide / 2) - 2, dy: largoSlide, dz: 24,
            mat: 'Herraje Metal Satinado',
            name: `M${idx + 1} Riel Corredera Izq Cajón ${c + 1}`,
            moduloIndex: idx
          });

          // Riel corredera lateral derecho
          prismas.push({
            x: xMod + xOffsetInt + anchoInt - (descSlide / 2) + 1, y: yCarcasaStart + 4, z: zSlide,
            dx: (descSlide / 2) - 2, dy: largoSlide, dz: 24,
            mat: 'Herraje Metal Satinado',
            name: `M${idx + 1} Riel Corredera Der Cajón ${c + 1}`,
            moduloIndex: idx
          });
        }
      }

      // =======================================================================
      // 4. PUERTAS INDEPENDIENTES (Compatibles con repisas, carcasa o cajoneras)
      // Perforación estándar de cazoleta Ø35x11.5mm a K=4.5mm y pistones a gas
      // =======================================================================
      const tienePuertas = (m.tiene_puertas === true || m.tiene_puertas === 'true' || tipoInt === 'puertas');
      if (tienePuertas) {
        const montajeP = m.puertas_montaje || 'exterior';
        const posicionP = m.puertas_posicion_bisagra || m.puertas_apertura || ((wMod > 600) ? 'doble' : 'derecha');
        const esCorrediza = (posicionP === 'corrediza');

        if (esCorrediza) {
          // ===================================================================
          // SISTEMA DE PUERTAS CORREDIZAS DE 2 VÍAS (ALUMINIO DUCASSE / PLACARD)
          // Riel superior e inferior en profundidad frontal (0-72mm) con rodamientos
          // ===================================================================
          const wVano = tieneLaterales ? Math.max(100, wMod - (2 * t)) : wMod;
          const xVanoStart = tieneLaterales ? (xMod + t) : xMod;
          const hVanoCorrediza = hVanoUtil;
          const traslape = 30.0; // mm de traslape central estándar entre hojas
          const anchoHojaP = Math.round((wVano + traslape) / 2);
          const altoHojaP = Math.max(100, hVanoCorrediza - 16);
          const zHojaP = zIntBase + 8;
          const distSlide = Math.max(50, anchoHojaP - 60);

          // Riel Superior de Doble Canal (Anodizado Satinado en profundidad frontal 0-72mm)
          prismas.push({
            x: xVanoStart,
            y: yCarcasaStart + 4,
            z: zIntBase + hVanoCorrediza - 40,
            dx: wVano, dy: 72, dz: 40,
            mat: 'Herraje Metal Satinado',
            name: `M${idx + 1} Riel Superior Doble Canal Corredizo (Aluminio)`,
            moduloIndex: idx
          });

          // Riel Inferior de Doble Guía (Anodizado Satinado en profundidad frontal 0-72mm)
          prismas.push({
            x: xVanoStart,
            y: yCarcasaStart + 4,
            z: zIntBase,
            dx: wVano, dy: 72, dz: 10,
            mat: 'Herraje Metal Satinado',
            name: `M${idx + 1} Riel Inferior Doble Guía Corredizo (Aluminio)`,
            moduloIndex: idx
          });

          // 2 Hojas Corredizas Traslapadas
          for (let p = 0; p < 2; p++) {
            const idPuerta = `m${idx}_puerta_${p}`;
            const aperturaPuerta = (aperturasPiezas[idPuerta] !== undefined)
              ? aperturasPiezas[idPuerta]
              : (renderOptions.aperturaAnim || 0);

            // Hoja 0: Interior (canal posterior), corre hacia la derecha (+X)
            // Hoja 1: Exterior (canal frontal), corre hacia la izquierda (-X)
            const xInitial = (p === 0) ? xVanoStart : (xVanoStart + wVano - anchoHojaP);
            const deltaX = (p === 0) ? (aperturaPuerta * distSlide) : (-aperturaPuerta * distSlide);
            const currentX = xInitial + deltaX;
            const yHoja = (p === 0) ? (yCarcasaStart + 12) : (yCarcasaStart + 12 + t + 8);

            // Tablero de melamina de la hoja corrediza
            prismas.push({
              x: currentX, y: yHoja, z: zHojaP,
              dx: anchoHojaP, dy: t, dz: altoHojaP,
              mat: m.material_frentes || d.material_frentes || matFrentes,
              name: `M${idx + 1} Puerta Corrediza Hoja ${p + 1} (${p === 0 ? 'Interior' : 'Exterior'})`,
              moduloIndex: idx,
              esMovil: true,
              tipoMovil: 'puerta',
              idMovil: idPuerta,
              nombrePieza: `Puerta Corrediza ${p + 1} (Módulo ${idx + 1})`
            });

            // Perfil tirador vertical de aluminio anodizado en el canto exterior
            const xTirador = (p === 0) ? (currentX + 2) : (currentX + anchoHojaP - 16);
            prismas.push({
              x: xTirador, y: yHoja - 3, z: zHojaP,
              dx: 14, dy: t + 6, dz: altoHojaP,
              mat: 'Herraje Metal Satinado',
              name: `M${idx + 1} Perfil Tirador Corredizo Hoja ${p + 1}`,
              moduloIndex: idx,
              esMovil: true,
              tipoMovil: 'puerta',
              idMovil: idPuerta,
              nombrePieza: `Puerta Corrediza ${p + 1} (Módulo ${idx + 1})`
            });
          }
        } else {
          const luz = (m.puertas_luz !== undefined) ? parseFloat(m.puertas_luz) : (d && d.luz_frentes !== undefined ? parseFloat(d.luz_frentes) : 3.0);
          const cantP = (posicionP === 'doble') ? 2 : 1;

        let altoP = 0, anchoP = 0, yP = 0, zP = 0;
        if (montajeP === 'exterior') {
          altoP = hCarcasa - (2 * luz);
          anchoP = (cantP === 2) ? ((wMod - (3 * luz)) / 2) : (wMod - (2 * luz));
          yP = yCarcasaStart - t;
          zP = zBase + luz;
        } else if (montajeP === 'medio') {
          altoP = hCarcasa - (2 * luz);
          anchoP = (cantP === 2) ? ((anchoInt + (2 * t) - (3 * luz)) / 2) : (anchoInt + t - (2 * luz));
          yP = yCarcasaStart - t;
          zP = zBase + luz;
        } else {
          // interior (embutida)
          altoP = hVanoUtil - (2 * luz);
          anchoP = (cantP === 2) ? ((anchoInt - (3 * luz)) / 2) : (anchoInt - (2 * luz));
          yP = yCarcasaStart + luz;
          zP = zIntBase + luz;
        }

        const bisInfo = (typeof window.calcularBisagrasPuerta === 'function')
          ? window.calcularBisagrasPuerta(m, altoP, anchoP)
          : { cantBis: 2, distCentroBorde: 22, distExtremos: 100, margenK: 4.5, esPistonGas: (posicionP === 'superior') };
        const cantBis = bisInfo.cantBis || 2;
        const apertura = renderOptions.aperturaAnim || 0;

        // Detección de parante vertical para alinear el encuentro exacto sobre el parante
        let xCentroParante = null;
        if (m.tipo_interior === 'repisas' && m.parantes_tipo === 'vertical' && Array.isArray(m.parantes) && m.parantes.length === 1) {
          const geo = (typeof window.calcularDivisionesYEspaciosModulo === 'function')
            ? window.calcularDivisionesYEspaciosModulo(m, t)
            : null;
          if (geo && geo.parantes && geo.parantes[0]) {
            xCentroParante = (tieneLaterales ? t : 0) + geo.parantes[0].posicion + (t / 2);
          }
        }

        for (let p = 0; p < cantP; p++) {
          const idPuerta = `m${idx}_puerta_${p}`;
          const aperturaPuerta = (aperturasPiezas[idPuerta] !== undefined)
            ? aperturasPiezas[idPuerta]
            : (renderOptions.aperturaAnim || 0);

          let xP = 0;
          let anchoHojaP = anchoP;

          if (cantP === 2 && xCentroParante !== null) {
            if (montajeP === 'interior') {
              if (p === 0) {
                xP = xMod + t + luz;
                anchoHojaP = xCentroParante - t - (1.5 * luz);
              } else {
                xP = xMod + xCentroParante + (luz / 2);
                anchoHojaP = wMod - t - xCentroParante - (1.5 * luz);
              }
            } else {
              if (p === 0) {
                xP = xMod + luz;
                anchoHojaP = xCentroParante - (1.5 * luz);
              } else {
                xP = xMod + xCentroParante + (luz / 2);
                anchoHojaP = wMod - xCentroParante - (1.5 * luz);
              }
            }
          } else if (cantP === 2) {
            const xBaseLeaf = (montajeP === 'interior') ? (xMod + xOffsetInt + luz) : (xMod + luz);
            xP = xBaseLeaf + (p * (anchoP + luz));
            anchoHojaP = anchoP;
          } else {
            xP = (montajeP === 'interior') ? (xMod + xOffsetInt + luz) : (xMod + luz);
            anchoHojaP = anchoP;
          }

          // Definición cinemática de apertura
          let rot = null;
          if (aperturaPuerta > 0) {
            if (posicionP === 'superior') {
              // Puerta con pistón a gas de maletero/altillo: abre HACIA AFUERA (-Y hacia el usuario) y hacia ARRIBA (+Z)
              rot = {
                eje: 'X',
                anguloRad: -aperturaPuerta * (80 * Math.PI / 180),
                pivotX: xP,
                pivotY: yP + t,
                pivotZ: zP + altoP
              };
            } else if (posicionP === 'inferior') {
              // Puerta abatible hacia abajo: abre HACIA AFUERA (-Y) y hacia ABAJO (-Z)
              rot = {
                eje: 'X',
                anguloRad: aperturaPuerta * (80 * Math.PI / 180),
                pivotX: xP,
                pivotY: yP + t,
                pivotZ: zP
              };
            } else if (posicionP === 'derecha' || (posicionP === 'doble' && p === 1)) {
              rot = {
                eje: 'Z',
                anguloRad: aperturaPuerta * (90 * Math.PI / 180),
                pivotX: xP + anchoHojaP,
                pivotY: yP + t,
                pivotZ: zP
              };
            } else {
              // Izquierda o doble hoja izquierda (p === 0)
              rot = {
                eje: 'Z',
                anguloRad: -aperturaPuerta * (90 * Math.PI / 180),
                pivotX: xP,
                pivotY: yP + t,
                pivotZ: zP
              };
            }
          }

          // Caras rotadas de la hoja de puerta
          const customCarasPuerta = generarCarasPrismaRotado(xP, yP, zP, anchoHojaP, t, altoP, rot);

          prismas.push({
            x: xP, y: yP, z: zP,
            dx: anchoHojaP, dy: t, dz: altoP,
            mat: m.material_frentes || d.material_frentes || matFrentes,
            name: `M${idx + 1} Puerta Hoja ${p + 1} (${montajeP === 'exterior' ? 'Puerta Externa' : 'Puerta Embutida'}${xCentroParante !== null ? ' -> Cierre a Parante Central' : ''})`,
            moduloIndex: idx,
            customCaras: customCarasPuerta,
            esMovil: true,
            tipoMovil: 'puerta',
            idMovil: idPuerta,
            nombrePieza: `Puerta ${p + 1} (Módulo ${idx + 1})`
          });

          // Tirador en la puerta
          if (posicionP === 'superior') {
            const wTirador = Math.min(180, anchoHojaP * 0.4);
            const carasTirador = generarCarasPrismaRotado(
              xP + (anchoHojaP - wTirador) / 2, yP - 18, zP + 30,
              wTirador, 18, 12, rot
            );
            prismas.push({
              x: xP + (anchoHojaP - wTirador) / 2, y: yP - 18, z: zP + 30,
              dx: wTirador, dy: 18, dz: 12,
              mat: 'Herraje Metal Satinado',
              name: `M${idx + 1} Tirador Puerta ${p + 1}`,
              moduloIndex: idx,
              customCaras: carasTirador,
              esMovil: true,
              tipoMovil: 'puerta',
              idMovil: idPuerta,
              nombrePieza: `Puerta ${p + 1} (Módulo ${idx + 1})`
            });
          } else if (posicionP === 'inferior') {
            const wTirador = Math.min(180, anchoHojaP * 0.4);
            const carasTirador = generarCarasPrismaRotado(
              xP + (anchoHojaP - wTirador) / 2, yP - 18, zP + altoP - 42,
              wTirador, 18, 12, rot
            );
            prismas.push({
              x: xP + (anchoHojaP - wTirador) / 2, y: yP - 18, z: zP + altoP - 42,
              dx: wTirador, dy: 18, dz: 12,
              mat: 'Herraje Metal Satinado',
              name: `M${idx + 1} Tirador Puerta ${p + 1}`,
              moduloIndex: idx,
              customCaras: carasTirador,
              esMovil: true,
              tipoMovil: 'puerta',
              idMovil: idPuerta,
              nombrePieza: `Puerta ${p + 1} (Módulo ${idx + 1})`
            });
          } else {
            // Tirador vertical
            const xTir = (posicionP === 'derecha' || (posicionP === 'doble' && p === 1))
              ? (xP + 22)
              : (xP + anchoHojaP - 34);
            const carasTirador = generarCarasPrismaRotado(
              xTir, yP - 18, zP + (altoP / 2) - 60,
              12, 18, 120, rot
            );
            prismas.push({
              x: xTir, y: yP - 18, z: zP + (altoP / 2) - 60,
              dx: 12, dy: 18, dz: 120,
              mat: 'Herraje Metal Satinado',
              name: `M${idx + 1} Tirador Puerta ${p + 1}`,
              moduloIndex: idx,
              customCaras: carasTirador,
              esMovil: true,
              tipoMovil: 'puerta',
              idMovil: idPuerta,
              nombrePieza: `Puerta ${p + 1} (Módulo ${idx + 1})`
            });
          }

          // Perforaciones de Cazoleta Ø35x11.5mm y Bisagras Estándar
          // En el tablero de la puerta: canto bisagras con margen K=4.5mm (centro a 22mm del borde)
          const distExt = 100;
          const distC = 22; // mm al centro de la perforación (K=4.5 + R=17.5)
          const diamCazoleta = 35;

          for (let b = 0; b < cantBis; b++) {
            let cX = 0, cZ = 0;
            if (posicionP === 'superior') {
              cZ = zP + altoP - distC;
              const step = (anchoHojaP - (2 * distExt)) / Math.max(1, cantBis - 1);
              cX = xP + distExt + (b * step);
            } else if (posicionP === 'inferior') {
              cZ = zP + distC;
              const step = (anchoHojaP - (2 * distExt)) / Math.max(1, cantBis - 1);
              cX = xP + distExt + (b * step);
            } else if (posicionP === 'derecha' || (posicionP === 'doble' && p === 1)) {
              cX = xP + anchoHojaP - distC;
              const step = (altoP - (2 * distExt)) / Math.max(1, cantBis - 1);
              cZ = zP + distExt + (b * step);
            } else {
              // Izquierda
              cX = xP + distC;
              const step = (altoP - (2 * distExt)) / Math.max(1, cantBis - 1);
              cZ = zP + distExt + (b * step);
            }

            // Perforación de Cazoleta Ø35mm incrustada en la cara interna del tablero
            const carasCazoleta = generarCarasPrismaRotado(
              cX - (diamCazoleta / 2), yP + t - 11.5, cZ - (diamCazoleta / 2),
              diamCazoleta, 11.5, diamCazoleta, rot
            );

            prismas.push({
              x: cX - (diamCazoleta / 2), y: yP + t - 11.5, z: cZ - (diamCazoleta / 2),
              dx: diamCazoleta, dy: 11.5, dz: diamCazoleta,
              mat: 'Cazoleta Perforacion',
              name: `M${idx + 1} Perforación Cazoleta Ø35 Hoja ${p + 1} (#${b + 1})`,
              moduloIndex: idx,
              customCaras: carasCazoleta,
              esCazoleta: true
            });

            // Brazo y placa metálica de la bisagra
            const carasHerrajeBis = generarCarasPrismaRotado(
              cX - 12, yP + t - 6, cZ - 14,
              24, 28, 28, rot
            );
            prismas.push({
              x: cX - 12, y: yP + t - 6, z: cZ - 14,
              dx: 24, dy: 28, dz: 28,
              mat: 'Herraje Metal Satinado',
              name: `M${idx + 1} Herraje Bisagra Hoja ${p + 1} (#${b + 1})`,
              moduloIndex: idx,
              customCaras: carasHerrajeBis
            });
          }

          // PISTONES A GAS para puertas con apertura superior
          if (posicionP === 'superior') {
            // Pistón Izquierdo
            const yPistBase = yCarcasaStart + 140;
            const zPistBase = zP + altoP - 160;
            let yPistDoor = yP + t;
            let zPistDoor = zP + altoP - 70;
            if (rot && Math.abs(rot.anguloRad) > 0.0001) {
              const a = rot.anguloRad;
              const py = rot.pivotY, pz = rot.pivotZ;
              const dy0 = yPistDoor - py, dz0 = zPistDoor - pz;
              yPistDoor = py + (dy0 * Math.cos(a)) - (dz0 * Math.sin(a));
              zPistDoor = pz + (dy0 * Math.sin(a)) + (dz0 * Math.cos(a));
            }

            // Cuerpo del pistón (lado izquierdo)
            prismas.push({
              x: xMod + xOffsetInt + 2,
              y: Math.min(yPistBase, yPistDoor),
              z: Math.min(zPistBase, zPistDoor),
              dx: 14,
              dy: Math.max(20, Math.abs(yPistDoor - yPistBase)),
              dz: Math.max(16, Math.abs(zPistDoor - zPistBase)),
              mat: 'Herraje Metal Satinado',
              name: `M${idx + 1} Pistón a Gas Elevable Izq`,
              moduloIndex: idx
            });

            // Cuerpo del pistón (lado derecho)
            prismas.push({
              x: xMod + xOffsetInt + anchoInt - 16,
              y: Math.min(yPistBase, yPistDoor),
              z: Math.min(zPistBase, zPistDoor),
              dx: 14,
              dy: Math.max(20, Math.abs(yPistDoor - yPistBase)),
              dz: Math.max(16, Math.abs(zPistDoor - zPistBase)),
              mat: 'Herraje Metal Satinado',
              name: `M${idx + 1} Pistón a Gas Elevable Der`,
              moduloIndex: idx
            });
          }
        }
      }
      }
    });

    // =========================================================================
    // VISUALIZACIÓN ERGONÓMICA DE MOBILIARIO REALISTA EN 3D
    // =========================================================================

    // 1. Tipología Cama con Cajonera: Somier con Colchón 1.5 Plazas
    const esMuebleCama = (d.nombre && d.nombre.toLowerCase().includes('cama')) || (d.id && d.id.includes('cama'));
    if (esMuebleCama && !prismas.some(p => p.esColchon)) {
      const zCamaBase = 400; // Altura estándar de la tarima somier
      const wCama = Math.max(800, (d.ancho_total || 2000) - 40);
      const dCama = Math.max(600, (d.prof_total || 1050) - 50);
      prismas.push({
        x: 20,
        y: 20,
        z: zCamaBase,
        dx: wCama,
        dy: dCama,
        dz: 200,
        mat: 'Colchón Acolchado',
        name: 'Colchón 1.5 Plazas Ergonómico Acolchado (1960x1000x200mm)',
        moduloIndex: -1,
        esColchon: true
      });
    }

    // 2. Tipología Setup Gamer: Dual Monitors 27" en el Nicho de Pantallas
    const esSetupGamer = (d.nombre && (d.nombre.toLowerCase().includes('gamer') || d.nombre.toLowerCase().includes('streaming'))) || (d.id && d.id.includes('gamer'));
    if (esSetupGamer && !prismas.some(p => p.esMonitorGamer)) {
      const idxNicho = modulos.findIndex(m => m.nombre && (m.nombre.toLowerCase().includes('pantalla') || m.nombre.toLowerCase().includes('monitor')));
      if (idxNicho >= 0 && geomMapeo[idxNicho]) {
        const gm = geomMapeo[idxNicho];
        const zEscritorio = gm.zBaseStack;
        const wNicho = gm.wMod || 1400;
        const wMon = Math.min(600, Math.max(380, (wNicho - 80) / 2));
        const hMon = 340;
        const yMon = Math.max(100, (d.prof_total || 650) - 220);

        // Monitor Gamer 1 (Izquierdo)
        const xMon1 = gm.xPos + (wNicho / 2) - wMon - 15;
        prismas.push({
          x: xMon1, y: yMon, z: zEscritorio + 60,
          dx: wMon, dy: 22, dz: hMon,
          mat: 'Pantalla Monitor Gamer',
          name: 'Pantalla Monitor Gamer 1 (27" IPS Bezel-less)',
          moduloIndex: idxNicho,
          esMonitorGamer: true
        });
        prismas.push({
          x: xMon1 + (wMon / 2) - 90, y: yMon + 5, z: zEscritorio,
          dx: 180, dy: 140, dz: 60,
          mat: 'Herraje Negro Mate',
          name: 'Soporte Peana Monitor 1',
          moduloIndex: idxNicho,
          esMonitorGamer: true
        });

        // Monitor Gamer 2 (Derecho)
        const xMon2 = gm.xPos + (wNicho / 2) + 15;
        prismas.push({
          x: xMon2, y: yMon, z: zEscritorio + 60,
          dx: wMon, dy: 22, dz: hMon,
          mat: 'Pantalla Monitor Gamer',
          name: 'Pantalla Monitor Gamer 2 (27" IPS Bezel-less)',
          moduloIndex: idxNicho,
          esMonitorGamer: true
        });
        prismas.push({
          x: xMon2 + (wMon / 2) - 90, y: yMon + 5, z: zEscritorio,
          dx: 180, dy: 140, dz: 60,
          mat: 'Herraje Negro Mate',
          name: 'Soporte Peana Monitor 2',
          moduloIndex: idxNicho,
          esMonitorGamer: true
        });
      }
    }

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
      carasRenderizadas = [];
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

    // Asignar ID único y nombre descriptivo a cada prisma para el selector de ocultar/visualizar
    const contadoresTipoPrisma = {};
    prismas.forEach((prisma, idxP) => {
      if (!prisma.idPieza) {
        const tipoP = prisma.tipoPieza || (prisma.esZocaloFrontal ? 'zocalo_frontal' : (prisma.esZocaloBase ? 'zocalo' : (prisma.name ? prisma.name.replace(/\s+/g, '_').toLowerCase() : 'pieza')));
        const modTag = (prisma.moduloIndex !== undefined && prisma.moduloIndex >= 0) ? `m${prisma.moduloIndex + 1}` : 'base';
        contadoresTipoPrisma[tipoP] = (contadoresTipoPrisma[tipoP] || 0) + 1;
        prisma.idPieza = prisma.idMovil || `${modTag}_${tipoP}_${contadoresTipoPrisma[tipoP]}`;
      }
      if (!prisma.nombrePieza) {
        prisma.nombrePieza = prisma.name || prisma.idPieza;
      }
    });

    const lightDir = { x: 0.5, y: -0.7, z: 0.8 };
    const lLen = Math.sqrt(lightDir.x * lightDir.x + lightDir.y * lightDir.y + lightDir.z * lightDir.z);
    lightDir.x /= lLen; lightDir.y /= lLen; lightDir.z /= lLen;

    prismas.forEach(prisma => {
      const { x, y, z, dx, dy, dz, mat, moduloIndex, esZocaloFrontal, esListonSoporteZocalo, esZocaloBase } = prisma;

      const defCaras = prisma.customCaras || [
        { norm: { x: 0, y: 0, z: 1 }, pts: [[x, y, z + dz], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]] },
        { norm: { x: 0, y: -1, z: 0 }, pts: [[x, y, z], [x + dx, y, z], [x + dx, y, z + dz], [x, y, z + dz]] },
        { norm: { x: 0, y: 1, z: 0 }, pts: [[x, y + dy, z], [x, y + dy, z + dz], [x + dx, y + dy, z + dz], [x + dx, y + dy, z]] },
        { norm: { x: -1, y: 0, z: 0 }, pts: [[x, y, z], [x, y + dy, z], [x, y + dy, z + dz], [x, y, z + dz]] },
        { norm: { x: 1, y: 0, z: 0 }, pts: [[x + dx, y, z], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x + dx, y + dy, z]] },
        { norm: { x: 0, y: 0, z: -1 }, pts: [[x, y, z], [x, y + dy, z], [x + dx, y + dy, z], [x + dx, y, z]] }
      ];

      defCaras.forEach(fc => {
        let cx = 0, cy = 0, cz = 0;
        const nPts = fc.pts.length || 4;
        fc.pts.forEach(p => { cx += p[0]; cy += p[1]; cz += p[2]; });
        cx /= nPts; cy /= nPts; cz /= nPts;

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
            centro2D: projCentro,
            profundidadVista: projCentro.profundidadVista + prioridadFrontal,
            factorLuz,
            mat: (fc.mat || ((prisma.esInteriorConCantoFrontis && fc.norm.y < -0.85 && d.esquema_color === 'bicolor' && d.material_frentes) ? d.material_frentes : mat)),
            moduloIndex,
            esZocaloFrontal: !!esZocaloFrontal,
            esListonSoporteZocalo: !!esListonSoporteZocalo,
            esNoPermitido: !!prisma.esNoPermitido,
            esZocaloBase: !!esZocaloBase,
            esCazoleta: !!fc.esCazoleta || !!prisma.esCazoleta,
            esHerraje: !!fc.esHerraje || !!prisma.esHerraje,
            esMovil: !!prisma.esMovil,
            idMovil: prisma.idMovil,
            tipoMovil: prisma.tipoMovil,
            nombrePieza: prisma.nombrePieza,
            idPieza: prisma.idPieza,
            estaOculta: piezasOcultas.has(prisma.idPieza)
          });
        }
      });
    });

    // Ordenar caras de atrás hacia adelante (Algoritmo del Pintor)
    caras.sort((a, b) => b.profundidadVista - a.profundidadVista);
    carasRenderizadas = caras;

    // Dibujar las caras proyectadas
    const modoAlambre = renderOptions.modoRender === 'alambre';

    caras.forEach(cara => {
      const estaOculta = piezasOcultas.has(cara.idPieza);

      ctx.beginPath();
      ctx.moveTo(cara.puntos[0].px, cara.puntos[0].py);
      for (let i = 1; i < cara.puntos.length; i++) {
        ctx.lineTo(cara.puntos[i].px, cara.puntos[i].py);
      }
      ctx.closePath();

      // Si la pieza está marcada como oculta:
      // NO rellenamos con melamina opaca para que el usuario pueda ver el interior a través de ella.
      // En su lugar, dibujamos líneas punteadas sobre todo el perímetro de la pieza.
      if (estaOculta) {
        ctx.save();
        ctx.setLineDash([5, 4]); // Líneas punteadas nítidas
        ctx.strokeStyle = isDark ? '#38BDF8' : '#0284C7';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        return;
      }

      const paleta = obtenerPaleta(cara.mat);
      const [r, g, b] = paleta.base;
      const f = cara.factorLuz;
      let fill = `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;

      if (cara.esCazoleta) {
        // Hueco de cazoleta estándar Ø35mm: profundidad nítida oscura con aro técnico
        fill = `rgb(15, 23, 42)`;
      } else if (cara.esZocaloFrontal) {
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

      if (!modoAlambre) {
        const patron = (cara.esCazoleta || (cara.esListonSoporteZocalo && cara.esNoPermitido)) ? null : obtenerTexturaPatron(cara.mat);
        if (patron) {
          ctx.fillStyle = patron;
          ctx.fill();
          // Aplicar sombreado 3D de luz direccional sobre la textura real
          if (f < 0.98) {
            ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.65, (1.0 - f) * 0.85)})`;
            ctx.fill();
          } else if (f > 1.02) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.35, (f - 1.0) * 0.6)})`;
            ctx.fill();
          }
        } else {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        ctx.strokeStyle = cara.esCazoleta
          ? '#38BDF8'
          : (cara.esZocaloFrontal
              ? (isDark ? '#38BDF8' : '#1D4ED8')
              : (cara.esListonSoporteZocalo 
                  ? (cara.esNoPermitido ? '#DC2626' : '#1E40AF') 
                  : (esActivo ? '#2563EB' : paleta.border)));
        ctx.lineWidth = cara.esCazoleta ? 1.4 : ((cara.esZocaloFrontal || cara.esListonSoporteZocalo) ? 1.6 : (esActivo ? 1.4 : 0.8));
        ctx.stroke();

        // En perforación de cazoleta trazar cruz central de centrado milimétrico
        if (cara.esCazoleta && cara.centro2D) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cara.centro2D.px - 4, cara.centro2D.py);
          ctx.lineTo(cara.centro2D.px + 4, cara.centro2D.py);
          ctx.moveTo(cara.centro2D.px, cara.centro2D.py - 4);
          ctx.lineTo(cara.centro2D.px, cara.centro2D.py + 4);
          ctx.stroke();
        }
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

    // Si la melamina activa es RH, mostrar badge de certificación antihumedad
    if (currentData && currentData.resistencia === 'RH') {
      const rhX = x + boxW + 8;
      const rhW = 195;
      ctx.fillStyle = 'rgba(5, 150, 105, 0.92)';
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(rhX, y, rhW, boxH, 8) : ctx.rect(rhX, y, rhW, boxH);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.fillText('🛡️ TABLERO RH ACTIVO', rhX + 10, y + 18);

      ctx.fillStyle = '#D1FAE5';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillText('Hidrófugo • Núcleo Verde', rhX + 10, y + 34);
    }

    ctx.restore();
  }

  /**
   * Detecta clics sobre el canvas para seleccionar el módulo correspondiente.
   */
  function onCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // 1. MODO SIMULACIÓN INTERACTIVA: Si está activo, un clic sobre una puerta o cajón cerrado lo abre, y si está abierto lo cierra
    if (modoSimulacion) {
      // Buscar la cara móvil más cercana al usuario que contenga las coordenadas del clic
      const caraClickeada = carasRenderizadas.slice().reverse().find(c => {
        return c.esMovil && c.puntos && puntoEnPoligono2D(clickX, clickY, c.puntos);
      });

      if (caraClickeada && caraClickeada.idMovil) {
        const id = caraClickeada.idMovil;
        const actual = aperturasPiezas[id] !== undefined ? aperturasPiezas[id] : (renderOptions.aperturaAnim || 0);
        const meta = (actual > 0.4) ? 0.0 : 1.0;
        animarAperturaPieza(id, meta);

        if (typeof onElementoSimuladoCallback === 'function') {
          onElementoSimuladoCallback({
            idMovil: id,
            tipoMovil: caraClickeada.tipoMovil,
            nombrePieza: caraClickeada.nombrePieza,
            estado: (meta === 1.0) ? 'abierto' : 'cerrado'
          });
        }
        return;
      }
    }

    // 1b. MODO OCULTAR / VISUALIZAR PIEZA INTERACTIVA:
    // Al estar activo este selector las piezas sobre las que se hace clic se ocultan
    // mostrándose en su lugar líneas punteadas sobre todo el perímetro.
    // Si se hace clic sobre la pieza oculta, se vuelve a mostrar.
    if (modoOcultarPiezas) {
      const caraClickeada = carasRenderizadas.slice().reverse().find(c => {
        return c.idPieza && c.puntos && puntoEnPoligono2D(clickX, clickY, c.puntos);
      });

      if (caraClickeada && caraClickeada.idPieza) {
        const id = caraClickeada.idPieza;
        const yaOculta = piezasOcultas.has(id);
        if (yaOculta) {
          piezasOcultas.delete(id);
        } else {
          piezasOcultas.add(id);
        }
        render();

        if (typeof onPiezaVisibilidadCallback === 'function') {
          onPiezaVisibilidadCallback({
            idPieza: id,
            nombrePieza: caraClickeada.nombrePieza || id,
            oculta: !yaOculta
          });
        }
        return;
      }
    }

    // 2. MODO NORMAL: Detección de clics para selección de módulos
    if (!onModuleSelectCallback || !currentData.modulos || currentData.modulos.length === 0) return;

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
    setAperturaAnim,
    getAperturaAnim,
    setModoSimulacion,
    getModoSimulacion,
    toggleModoSimulacion,
    setModoOcultarPiezas,
    getModoOcultarPiezas,
    toggleModoOcultarPiezas,
    setOnPiezaVisibilidadCallback,
    getPiezasOcultas,
    mostrarTodasLasPiezas,
    animarAperturaPieza,
    setOnElementoSimuladoCallback,
    resize: ajustarTamano,
    render,
    generarPrismas: generarPrismasModulos,
    calcularListonesZocaloEstandar,
    resolverArchivoTextura,
    obtenerTexturaPatron
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

