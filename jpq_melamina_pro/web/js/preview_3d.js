/**
 * ==============================================================================
 * JPQMelaminaPro - Motor de Previsualización 3D en Tiempo Real (Canvas HTML5)
 * ==============================================================================
 * Renderizador 3D autónomo milimétrico para UI::HtmlDialog de SketchUp.
 * Proyecta los muebles en isométrica/perspectiva dinámica con iluminación,
 * soporte de órbita 360° con ratón, grid de piso con Eje Rojo (Z=0),
 * cotas milimétricas y actualización instantánea ante cualquier cambio en el formulario.
 */

const Preview3D = (function() {
  let canvas = null;
  let ctx = null;

  // Parámetros de la cámara 3D
  const camera = {
    azimuth: Math.PI / 5,    // Rotación horizontal (alrededor de Z)
    elevation: Math.PI / 7,  // Inclinación vertical (hacia abajo)
    zoom: 1.0,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0
  };

  // Estado del mueble actual a renderizar
  let currentModel = {
    tipo: 'librero',
    alto: 750,
    ancho: 600,
    profundidad: 500,
    espesor: 18,
    material: 'Melamina Blanca 18mm',
    vuelo: 20,
    alto_zocalo: 80,
    cantidad_repisas: 1,
    tiene_fondo: true,
    usar_amarres: false
  };

  // Paleta de colores según material
  const materialColors = {
    'Melamina Blanca 18mm': { base: [245, 247, 250], border: '#94A3B8', edge: '#E2E8F0' },
    'Melamina Roble Natural 18mm': { base: [214, 166, 117], border: '#8C5B32', edge: '#B87A40' },
    'Melamina Nogal Terracota 18mm': { base: [141, 85, 60], border: '#5C3120', edge: '#783E28' },
    'Melamina Gris Antracita 18mm': { base: [65, 75, 90], border: '#1E293B', edge: '#334155' },
    'MDF Fondo': { base: [225, 215, 195], border: '#A89F91', edge: '#C4B8A5' },
    'Metal Cromado': { base: [210, 220, 230], border: '#64748B', edge: '#94A3B8' }
  };

  /**
   * Inicializa el canvas y los controladores de eventos de ratón para órbita.
   * @param {string} canvasId - ID del elemento HTML <canvas>.
   */
  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Manejo de eventos de ratón para rotación 3D
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Zoom con rueda de ratón
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // Doble clic para resetear vista
    canvas.addEventListener('dblclick', () => setView('iso'));

    // Redimensionar automáticamente según CSS
    window.addEventListener('resize', () => {
      ajustarTamanoCanvas();
      render();
    });

    ajustarTamanoCanvas();
    render();
  }

  function ajustarTamanoCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }

  function onMouseDown(e) {
    camera.isDragging = true;
    camera.lastMouseX = e.clientX;
    camera.lastMouseY = e.clientY;
    if (canvas) canvas.style.cursor = 'grabbing';
  }

  function onMouseMove(e) {
    if (!camera.isDragging) return;
    const dx = e.clientX - camera.lastMouseX;
    const dy = e.clientY - camera.lastMouseY;
    camera.azimuth += dx * 0.01;
    camera.elevation = Math.max(0.05, Math.min(Math.PI / 2.1, camera.elevation + dy * 0.01));
    camera.lastMouseX = e.clientX;
    camera.lastMouseY = e.clientY;
    render();
  }

  function onMouseUp() {
    camera.isDragging = false;
    if (canvas) canvas.style.cursor = 'grab';
  }

  function onWheel(e) {
    e.preventDefault();
    const zoomDelta = e.deltaY * -0.001;
    camera.zoom = Math.max(0.5, Math.min(2.5, camera.zoom + zoomDelta));
    render();
  }

  /**
   * Cambia el ángulo de cámara a vistas predefinidas.
   * @param {string} view - 'iso' | 'front' | 'side' | 'top'
   */
  function setView(view) {
    switch (view) {
      case 'front':
        camera.azimuth = 0;
        camera.elevation = 0.05;
        break;
      case 'side':
        camera.azimuth = Math.PI / 2;
        camera.elevation = 0.05;
        break;
      case 'top':
        camera.azimuth = 0;
        camera.elevation = Math.PI / 2.05;
        break;
      case 'iso':
      default:
        camera.azimuth = Math.PI / 5;
        camera.elevation = Math.PI / 7;
        break;
    }
    camera.zoom = 1.0;
    render();
  }

  /**
   * Actualiza los datos del modelo y re-renderiza inmediatamente.
   * @param {Object} params - Datos actualizados del formulario.
   */
  function update(params) {
    currentModel = Object.assign({}, currentModel, params);
    render();
  }

  /**
   * Genera la lista de prismas 3D [x, y, z, dx, dy, dz, material, nombre] según el tipo de mueble.
   */
  function generarPrismas() {
    const p = currentModel;
    const ancho = p.ancho || 600;
    const alto = p.alto || 750;
    const prof = p.profundidad || 500;
    const t = p.espesor || 18;
    const mat = p.material || 'Melamina Blanca 18mm';
    const prismas = [];

    const tipo = p.tipo || 'librero';

    if (tipo === 'escritorio') {
      const vuelo = p.vuelo || 20;
      const profPatas = prof - vuelo;
      const altoPatas = alto - t;
      const altoFaldon = Math.min(alto * 0.45, 350);

      // 1. Cubierta superior (alineada a Y=0 para apoyarse sobre la línea roja)
      prismas.push({ x: 0, y: 0, z: altoPatas, dx: ancho, dy: prof, dz: t, mat, name: 'Cubierta' });

      // 2. Patas laterales retranqueadas por el vuelo
      prismas.push({ x: 0, y: vuelo, z: 0, dx: t, dy: profPatas, dz: altoPatas, mat, name: 'Pata Izq' });
      prismas.push({ x: ancho - t, y: vuelo, z: 0, dx: t, dy: profPatas, dz: altoPatas, mat, name: 'Pata Der' });

      // 3. Faldón arriostrador trasero anti-bamboleo
      prismas.push({
        x: t, y: prof - t - 50, z: altoPatas - altoFaldon,
        dx: ancho - (2 * t), dy: t, dz: altoFaldon,
        mat, name: 'Faldón Arriostrador'
      });

    } else if (tipo === 'comoda') {
      const altoZocalo = p.alto_zocalo || 80;
      const anchoInt = ancho - (2 * t);

      // Laterales pasantes completos
      prismas.push({ x: 0, y: 0, z: 0, dx: t, dy: prof, dz: alto, mat, name: 'Lat Izq' });
      prismas.push({ x: ancho - t, y: 0, z: 0, dx: t, dy: prof, dz: alto, mat, name: 'Lat Der' });

      // Zócalo frontal y trasero
      prismas.push({ x: t, y: 25, z: 0, dx: anchoInt, dy: t, dz: altoZocalo, mat, name: 'Zócalo Frontal' });
      prismas.push({ x: t, y: prof - 25 - t, z: 0, dx: anchoInt, dy: t, dz: altoZocalo, mat, name: 'Zócalo Trasero' });

      // Piso y Techo
      prismas.push({ x: t, y: 0, z: altoZocalo, dx: anchoInt, dy: prof, dz: t, mat, name: 'Piso' });
      prismas.push({ x: t, y: 0, z: alto - t, dx: anchoInt, dy: prof, dz: t, mat, name: 'Techo' });

      // 4 Frentes de cajón con luces
      const cantCaj = 4;
      const altoVanoCajones = alto - altoZocalo - (2 * t);
      const altoFrente = (altoVanoCajones - (cantCaj * 3)) / cantCaj;
      for (let i = 0; i < cantCaj; i++) {
        const zFrente = altoZocalo + t + 3 + (i * (altoFrente + 3));
        prismas.push({
          x: t + 3, y: -2, z: zFrente,
          dx: anchoInt - 6, dy: t, dz: altoFrente,
          mat, name: `Frente Cajón ${i + 1}`
        });
      }

    } else if (tipo === 'ropero') {
      const altoZocalo = 80;
      const anchoInt = ancho - (2 * t);
      const distMaletero = 400;
      const zMaletero = alto - t - distMaletero;
      const altoVanoInf = zMaletero - (altoZocalo + t);
      const anchoNicho = (anchoInt - t) / 2;
      const xParante = t + anchoNicho;

      // Laterales
      prismas.push({ x: 0, y: 0, z: 0, dx: t, dy: prof, dz: alto, mat, name: 'Lat Izq' });
      prismas.push({ x: ancho - t, y: 0, z: 0, dx: t, dy: prof, dz: alto, mat, name: 'Lat Der' });

      // Zócalo, piso, techo
      prismas.push({ x: t, y: 30, z: 0, dx: anchoInt, dy: t, dz: altoZocalo, mat, name: 'Zócalo' });
      prismas.push({ x: t, y: 0, z: altoZocalo, dx: anchoInt, dy: prof, dz: t, mat, name: 'Piso' });
      prismas.push({ x: t, y: 0, z: alto - t, dx: anchoInt, dy: prof, dz: t, mat, name: 'Techo' });

      // Maletero superior
      prismas.push({ x: t, y: 10, z: zMaletero, dx: anchoInt, dy: prof - 10, dz: t, mat, name: 'Maletero' });

      // Parante central
      prismas.push({ x: xParante, y: 10, z: altoZocalo + t, dx: t, dy: prof - 10, dz: altoVanoInf, mat, name: 'Parante Central' });

      // 3 repisas a la derecha
      const pasoRep = altoVanoInf / 4;
      for (let i = 1; i <= 3; i++) {
        prismas.push({
          x: xParante + t, y: 15, z: altoZocalo + t + (pasoRep * i),
          dx: anchoNicho, dy: prof - 15, dz: t, mat, name: `Repisa Ropero ${i}`
        });
      }

      // Barra / tubo perchero a la izquierda
      prismas.push({
        x: t + 20, y: prof / 2 - 10, z: zMaletero - 50,
        dx: anchoNicho - 40, dy: 20, dz: 20, mat: 'Metal Cromado', name: 'Tubo Perchero'
      });

    } else if (tipo === 'bajo') {
      const altoZocalo = 100;
      const anchoInt = ancho - (2 * t);

      // Laterales
      prismas.push({ x: 0, y: 0, z: 0, dx: t, dy: prof, dz: alto, mat, name: 'Lat Izq' });
      prismas.push({ x: ancho - t, y: 0, z: 0, dx: t, dy: prof, dz: alto, mat, name: 'Lat Der' });

      // Zócalo sanitario retranqueado 40mm
      prismas.push({ x: t, y: 40, z: 0, dx: anchoInt, dy: t, dz: altoZocalo, mat, name: 'Zócalo Sanitario' });
      prismas.push({ x: t, y: 0, z: altoZocalo, dx: anchoInt, dy: prof, dz: t, mat, name: 'Piso' });

      // Amarre frontal horizontal y amarre trasero vertical
      prismas.push({ x: t, y: 0, z: alto - t, dx: anchoInt, dy: 100, dz: t, mat, name: 'Amarre Frontal' });
      prismas.push({ x: t, y: prof - t - 18, z: alto - 100, dx: anchoInt, dy: t, dz: 100, mat, name: 'Amarre Trasero' });

      // Repisa central
      prismas.push({
        x: t, y: 15, z: altoZocalo + t + ((alto - altoZocalo - (2 * t)) / 2),
        dx: anchoInt, dy: prof - 25, dz: t, mat, name: 'Repisa Central'
      });

    } else if (tipo === 'aereo') {
      const anchoInt = ancho - (2 * t);
      prismas.push({ x: 0, y: 0, z: 0, dx: t, dy: prof, dz: alto, mat, name: 'Lat Izq' });
      prismas.push({ x: ancho - t, y: 0, z: 0, dx: t, dy: prof, dz: alto, mat, name: 'Lat Der' });
      prismas.push({ x: t, y: 0, z: 0, dx: anchoInt, dy: prof, dz: t, mat, name: 'Piso' });
      prismas.push({ x: t, y: 0, z: alto - t, dx: anchoInt, dy: prof, dz: t, mat, name: 'Techo' });
      prismas.push({ x: t, y: 15, z: (alto - t) / 2, dx: anchoInt, dy: prof - 25, dz: t, mat, name: 'Repisa Aéreo' });
      prismas.push({ x: t, y: prof - t - 18, z: alto - 100 - t, dx: anchoInt, dy: t, dz: 100, mat, name: 'Refuerzo Muro' });

    } else {
      // Librero Estándar Reforzado con Zócalo
      const altoZocalo = p.alto_zocalo || 70;
      const anchoInt = ancho - (2 * t);
      prismas.push({ x: 0, y: 0, z: 0, dx: t, dy: prof, dz: alto, mat, name: 'Lat Izq' });
      prismas.push({ x: ancho - t, y: 0, z: 0, dx: t, dy: prof, dz: alto, mat, name: 'Lat Der' });
      prismas.push({ x: t, y: 25, z: 0, dx: anchoInt, dy: t, dz: altoZocalo, mat, name: 'Zócalo Frontal' });
      prismas.push({ x: t, y: 0, z: altoZocalo, dx: anchoInt, dy: prof, dz: t, mat, name: 'Piso' });
      prismas.push({ x: t, y: 0, z: alto - t, dx: anchoInt, dy: prof, dz: t, mat, name: 'Techo' });

      // Repisas intermedias
      const cantRep = parseInt(p.cantidad_repisas || 3, 10);
      const altoUtil = alto - altoZocalo - (2 * t);
      const paso = altoUtil / (cantRep + 1);
      for (let i = 1; i <= cantRep; i++) {
        prismas.push({
          x: t, y: 15, z: altoZocalo + t + (paso * i),
          dx: anchoInt, dy: prof - 20, dz: t, mat, name: `Repisa ${i}`
        });
      }
    }

    // Fondo MDF si está activo
    if (p.tiene_fondo && tipo !== 'escritorio') {
      const zFondo = (tipo === 'aereo') ? 0 : (p.alto_zocalo || 70);
      prismas.push({
        x: t - 5, y: prof - 18 - 3, z: zFondo + t - 5,
        dx: ancho - (2 * t) + 10, dy: 3, dz: alto - zFondo - (2 * t) + 10,
        mat: 'MDF Fondo', name: 'Fondo MDF 3mm'
      });
    }

    return prismas;
  }

  /**
   * Renderiza la escena 3D completa: Grid, Eje Rojo (Z=0), Mueble y Cotas.
   */
  function render() {
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // Fondo degradado suave de taller de diseño
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    const isDark = document.body.classList.contains('theme-dark') || document.body.classList.contains('theme-taller');
    if (isDark) {
      bgGrad.addColorStop(0, '#1E293B');
      bgGrad.addColorStop(1, '#0F172A');
    } else {
      bgGrad.addColorStop(0, '#F8FAFC');
      bgGrad.addColorStop(1, '#E2E8F0');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const p = currentModel;
    const ancho = p.ancho || 600;
    const alto = p.alto || 750;
    const prof = p.profundidad || 500;

    // Escala dinámica para encajar el mueble con margen en el canvas
    const maxDim = Math.max(ancho, alto, prof);
    const baseScale = (Math.min(w, h) * 0.55) / maxDim;
    const scale = baseScale * camera.zoom;

    const centerX = w / 2;
    const centerY = h / 2 + (alto * scale * 0.15); // Elevar un poco el centro visual

    // Proyección 3D a pantalla 2D
    const cosA = Math.cos(camera.azimuth);
    const sinA = Math.sin(camera.azimuth);
    const cosE = Math.cos(camera.elevation);
    const sinE = Math.sin(camera.elevation);

    function proyectar(x, y, z) {
      // Centrar el modelo en el plano horizontal
      const dx = x - (ancho / 2);
      const dy = y - (prof / 2);
      const dz = z - (alto / 2);

      // Rotación en Z (azimuth)
      const x1 = (dx * cosA) - (dy * sinA);
      const y1 = (dx * sinA) + (dy * cosA);

      // Rotación en X (elevación)
      const y2 = (y1 * cosE) - (dz * sinE);
      const z2 = (y1 * sinE) + (dz * cosE);

      return {
        px: centerX + (x1 * scale),
        py: centerY - (z2 * scale),
        profundidadVista: y2
      };
    }

    // 1. DIBUJAR PISO Y EJE ROJO (Z = 0)
    dibujarPisoYLineasGuia(ctx, proyectar, ancho, prof, isDark);

    // 2. CONSTRUIR CARAS DE TODOS LOS PRISMAS Y ORDENAR POR PROFUNDIDAD (Pintor)
    const prismas = generarPrismas();
    const caras = [];

    // Vector de iluminación direccional normalizado
    const lightDir = { x: 0.5, y: -0.7, z: 0.8 };
    const lLen = Math.sqrt(lightDir.x * lightDir.x + lightDir.y * lightDir.y + lightDir.z * lightDir.z);
    lightDir.x /= lLen; lightDir.y /= lLen; lightDir.z /= lLen;

    prismas.forEach(prisma => {
      const { x, y, z, dx, dy, dz, mat } = prisma;

      // 6 caras por prisma con su respectiva normal
      const defCaras = [
        // Top (+Z)
        { norm: { x: 0, y: 0, z: 1 }, pts: [[x, y, z + dz], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]] },
        // Front (-Y)
        { norm: { x: 0, y: -1, z: 0 }, pts: [[x, y, z], [x + dx, y, z], [x + dx, y, z + dz], [x, y, z + dz]] },
        // Back (+Y)
        { norm: { x: 0, y: 1, z: 0 }, pts: [[x, y + dy, z], [x, y + dy, z + dz], [x + dx, y + dy, z + dz], [x + dx, y + dy, z]] },
        // Left (-X)
        { norm: { x: -1, y: 0, z: 0 }, pts: [[x, y, z], [x, y + dy, z], [x, y + dy, z + dz], [x, y, z + dz]] },
        // Right (+X)
        { norm: { x: 1, y: 0, z: 0 }, pts: [[x + dx, y, z], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x + dx, y + dy, z]] },
        // Bottom (-Z)
        { norm: { x: 0, y: 0, z: -1 }, pts: [[x, y, z], [x, y + dy, z], [x + dx, y + dy, z], [x + dx, y, z]] }
      ];

      defCaras.forEach(fc => {
        // Calcular centro 3D de la cara
        let cx = 0, cy = 0, cz = 0;
        fc.pts.forEach(p => { cx += p[0]; cy += p[1]; cz += p[2]; });
        cx /= 4; cy /= 4; cz /= 4;

        const projCentro = proyectar(cx, cy, cz);

        // Iluminación Lambertiana
        const dot = Math.max(0, (fc.norm.x * lightDir.x) + (fc.norm.y * lightDir.y) + (fc.norm.z * lightDir.z));
        const factorLuz = 0.45 + (dot * 0.55);

        // Descarte de cara trasera (Back-face culling relativo a cámara)
        const vCamX = sinA * cosE;
        const vCamY = -cosA * cosE;
        const vCamZ = sinE;
        const dotCam = (fc.norm.x * vCamX) + (fc.norm.y * vCamY) + (fc.norm.z * vCamZ);

        if (dotCam <= 0) { // Cara visible
          caras.push({
            puntos: fc.pts.map(p => proyectar(p[0], p[1], p[2])),
            profundidadVista: projCentro.profundidadVista,
            factorLuz,
            mat
          });
        }
      });
    });

    // Ordenar caras de atrás hacia adelante
    caras.sort((a, b) => b.profundidadVista - a.profundidadVista);

    // Renderizar caras
    caras.forEach(c => {
      const paleta = materialColors[c.mat] || materialColors['Melamina Blanca 18mm'];
      const r = Math.round(paleta.base[0] * c.factorLuz);
      const g = Math.round(paleta.base[1] * c.factorLuz);
      const b = Math.round(paleta.base[2] * c.factorLuz);

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.strokeStyle = paleta.border;
      ctx.lineWidth = 1;

      ctx.beginPath();
      c.puntos.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.px, pt.py);
        else ctx.lineTo(pt.px, pt.py);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // 3. COTAS DIMENSIONALES MILIMÉTRICAS
    dibujarCotas(ctx, proyectar, ancho, prof, alto, isDark);

    // 4. INDICADOR VISUAL DE ESTADO (Sobre la línea roja)
    dibujarBadgeEstado(ctx, w, h, p, isDark);
  }

  /**
   * Dibuja la rejilla del piso (Z=0) destacando de forma prominente la Línea Roja (Eje X).
   */
  function dibujarPisoYLineasGuia(ctx, proyectar, ancho, prof, isDark) {
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    const margin = 200;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Rejilla de piso
    const xMin = -margin;
    const xMax = ancho + margin;
    const yMin = -margin;
    const yMax = prof + margin;
    const step = 100;

    for (let x = xMin; x <= xMax; x += step) {
      const p1 = proyectar(x, yMin, 0);
      const p2 = proyectar(x, yMax, 0);
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
    }

    for (let y = yMin; y <= yMax; y += step) {
      const p1 = proyectar(xMin, y, 0);
      const p2 = proyectar(xMax, y, 0);
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
    }

    // EJE VERDE (Y)
    const gy1 = proyectar(0, -margin, 0);
    const gy2 = proyectar(0, prof + margin, 0);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gy1.px, gy1.py);
    ctx.lineTo(gy2.px, gy2.py);
    ctx.stroke();

    // EJE ROJO (X) - ¡DESTACADO PROFESIONALMENTE!
    // Muestra que el mueble apoya estrictamente sobre la línea roja (Piso Z = 0)
    const rx1 = proyectar(-margin, 0, 0);
    const rx2 = proyectar(ancho + margin, 0, 0);
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rx1.px, rx1.py);
    ctx.lineTo(rx2.px, rx2.py);
    ctx.stroke();

    // Etiqueta Eje Rojo
    const rLabel = proyectar(ancho + 40, 0, 0);
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('🔴 Eje Rojo (Piso Z=0)', rLabel.px + 5, rLabel.py);
  }

  /**
   * Dibuja líneas de cota milimétricas en pantalla para Ancho, Alto y Profundidad.
   */
  function dibujarCotas(ctx, proyectar, ancho, prof, alto, isDark) {
    const textColor = isDark ? '#E2E8F0' : '#334155';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = textColor;
    ctx.strokeStyle = isDark ? '#64748B' : '#94A3B8';
    ctx.lineWidth = 1;

    // Cota de Ancho (Frente inferior)
    const w1 = proyectar(0, -30, 0);
    const w2 = proyectar(ancho, -30, 0);
    trazarLineaCota(ctx, w1, w2, `${Math.round(ancho)} mm`);

    // Cota de Altura (Lateral izquierdo)
    const h1 = proyectar(-30, 0, 0);
    const h2 = proyectar(-30, 0, alto);
    trazarLineaCota(ctx, h1, h2, `${Math.round(alto)} mm`);

    // Cota de Profundidad (Costado derecho)
    const d1 = proyectar(ancho + 30, 0, 0);
    const d2 = proyectar(ancho + 30, prof, 0);
    trazarLineaCota(ctx, d1, d2, `${Math.round(prof)} mm`);
  }

  function trazarLineaCota(ctx, p1, p2, texto) {
    ctx.beginPath();
    ctx.moveTo(p1.px, p1.py);
    ctx.lineTo(p2.px, p2.py);
    ctx.stroke();

    // Pequeñas flechas en los extremos
    ctx.fillRect(p1.px - 2, p1.py - 2, 4, 4);
    ctx.fillRect(p2.px - 2, p2.py - 2, 4, 4);

    const mx = (p1.px + p2.px) / 2;
    const my = (p1.py + p2.py) / 2;
    ctx.save();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText(texto, mx + 4, my - 3);
    ctx.restore();
  }

  /**
   * Muestra un distintivo flotante con el tipo de mueble y confirmación de cota sobre el piso.
   */
  function dibujarBadgeEstado(ctx, w, h, p, isDark) {
    const tipoNombres = {
      escritorio: '💻 Escritorio Profesional (Con Faldón)',
      comoda: '🗄️ Cómoda 4 Cajones (Con Zócalo)',
      ropero: '👔 Ropero Clóset 2 Cuerpos',
      bajo: '🍳 Módulo Bajo Cocina (Zócalo 100mm)',
      aereo: '🍽️ Alacena Aérea Cocina',
      librero: '📚 Librero Reforzado con Zócalo'
    };

    const titulo = tipoNombres[p.tipo] || 'Módulo Paramétrico';
    ctx.save();
    ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = isDark ? '#334155' : '#E2E8F0';
    ctx.lineWidth = 1;

    const boxW = 270;
    const boxH = 50;
    const boxX = 10;
    const boxY = 10;

    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxH, 8) : ctx.rect(boxX, boxY, boxW, boxH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isDark ? '#F8FAFC' : '#0F172A';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(titulo, boxX + 10, boxY + 16);

    ctx.fillStyle = '#10B981';
    ctx.font = '10px sans-serif';
    ctx.fillText('✓ Nivel: Sobre el piso (Z ≥ 0)', boxX + 10, boxY + 31);

    ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
    ctx.font = '10px sans-serif';
    ctx.fillText(`📏 Grosor repisas/piezas: ${p.espesor || 18}mm | MDF: 3mm`, boxX + 10, boxY + 44);
    ctx.restore();
  }

  return {
    init,
    update,
    setView,
    render
  };
})();

// Exportar globalmente para consumo de app.js y del diálogo HTML
window.Preview3D = Preview3D;
