/**
 * ==============================================================================
 * JPQMelaminaPro - Motor de Renderizado 2D en HTML5 Canvas
 * Dibuja los diagramas de corte de guillotina para taller con secuencia de sierra,
 * refilado perimetral, dimensiones de piezas y cálculo de merma en tiempo real.
 * ==============================================================================
 */

class OptimizerCanvasRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.tableros = [];
    this.tableroActualIndex = 0;
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;

    // Paleta de colores armónica para diferenciar piezas en taller
    this.coloresPiezas = [
      '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899',
      '#06B6D4', '#84CC16', '#EAB308', '#6366F1', '#14B8A6'
    ];

    window.addEventListener('resize', () => this.redibujar());
  }

  /**
   * Carga los datos de tableros generados por el algoritmo GuillotinePacker de Ruby.
   * @param {Array} tableros - Lista de tableros optimizados con piezas y coordenadas.
   */
  cargarTableros(tableros) {
    this.tableros = tableros || [];
    this.tableroActualIndex = 0;
    this.redibujar();
  }

  /**
   * Cambia a la siguiente o anterior plancha.
   * @param {number} delta - Dirección (-1 para anterior, +1 para siguiente).
   */
  cambiarPlancha(delta) {
    if (this.tableros.length === 0) return;
    const nuevoIndex = this.tableroActualIndex + delta;
    if (nuevoIndex >= 0 && nuevoIndex < this.tableros.length) {
      this.tableroActualIndex = nuevoIndex;
      this.redibujar();
    }
  }

  /**
   * Renderiza el tablero actual en el canvas adaptando la escala al contenedor.
   */
  redibujar() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const width = this.canvas.parentElement.clientWidth - 20;
    const height = Math.max(380, this.canvas.parentElement.clientHeight - 20);

    this.canvas.width = width;
    this.canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (this.tableros.length === 0) {
      ctx.fillStyle = '#64748B';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No hay optimización activa. Haz clic en "Optimizar Cortes 2D".', width / 2, height / 2);
      return;
    }

    const t = this.tableros[this.tableroActualIndex];
    if (!t) return;

    // Actualizar indicador de plancha en la interfaz
    const lbl = document.getElementById('lblPlanchaActual');
    if (lbl) lbl.textContent = `Plancha ${t.numero} de ${this.tableros.length} (${t.material} - ${t.largo}x${t.ancho}mm)`;

    const lblAprov = document.getElementById('lblAprovechamientoPlancha');
    if (lblAprov) lblAprov.textContent = `Aprovechamiento: ${t.aprovechamiento}% | Merma: ${t.desperdicio_pct}%`;

    // Calcular factor de escala para centrar la plancha en el canvas con márgenes
    const padding = 30;
    const escalaX = (width - padding * 2) / t.largo;
    const escalaY = (height - padding * 2) / t.ancho;
    const escala = Math.min(escalaX, escalaY);

    const origenX = (width - (t.largo * escala)) / 2;
    const origenY = (height - (t.ancho * escala)) / 2;

    // 1. Dibujar contorno de la plancha completa (Fondo de desperdicio)
    ctx.fillStyle = '#1E293B'; // Color de retazo / merma
    ctx.fillRect(origenX, origenY, t.largo * escala, t.ancho * escala);

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(origenX, origenY, t.largo * escala, t.ancho * escala);

    // 2. Dibujar zona de refilado perimetral
    const ref = t.refilado * escala;
    ctx.strokeStyle = '#EF4444'; // Línea roja punteada para refilado de limpieza
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(origenX + ref, origenY + ref, (t.largo - 2 * t.refilado) * escala, (t.ancho - 2 * t.refilado) * escala);
    ctx.setLineDash([]);

    // 3. Dibujar cada una de las piezas ubicadas
    t.piezas.forEach((p, idx) => {
      const px = origenX + (p.x * escala);
      const py = origenY + (p.y * escala);
      const pw = p.w * escala;
      const ph = p.h * escala;

      // Color de relleno según índice
      const color = this.coloresPiezas[idx % this.coloresPiezas.length];
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(px, py, pw, ph);
      ctx.globalAlpha = 1.0;

      // Borde de corte de sierra
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px, py, pw, ph);

      // Texto de identificación en la pieza (si cabe)
      if (pw > 35 && ph > 20) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Número de orden de corte
        ctx.fillText(`#${p.orden_corte} ${p.nombre}`, px + (pw / 2), py + (ph / 2) - 7);

        // Medidas netas en mm
        ctx.font = '9px sans-serif';
        ctx.fillText(`${Math.round(p.w)} × ${Math.round(p.h)} mm`, px + (pw / 2), py + (ph / 2) + 7);
      }

      // 3.1. Dibujar perforaciones estándar de cazoletas Ø35mm en el tablero si la pieza es una puerta
      const esPuerta = (p.esPuerta === true || (p.nombre && p.nombre.toLowerCase().includes('puerta')));
      if (esPuerta && pw > 20 && ph > 20) {
        let perfs = (Array.isArray(p.perforaciones) && p.perforaciones.length > 0) ? p.perforaciones : null;
        if (!perfs) {
          // Generar perforaciones estándar automáticamente según medidas de la pieza en el tablero
          perfs = [];
          const dimLargo = Math.max(p.w, p.h);
          const esHorizontal = (p.w >= p.h);
          let nHoles = 2;
          if (dimLargo > 2000) nHoles = 5;
          else if (dimLargo > 1500) nHoles = 4;
          else if (dimLargo > 900) nHoles = 3;

          const distC = 22; // mm centro a borde (K=4.5 + R=17.5)
          const distExt = Math.min(100, dimLargo * 0.2);
          const step = (dimLargo - (2 * distExt)) / Math.max(1, nHoles - 1);

          for (let hIdx = 0; hIdx < nHoles; hIdx++) {
            const posAlong = distExt + (hIdx * step);
            if (esHorizontal) {
              perfs.push({ x: posAlong, y: distC, diam: 35 });
            } else {
              perfs.push({ x: distC, y: posAlong, diam: 35 });
            }
          }
        }

        // Trazar las perforaciones circulares sobre el tablero
        perfs.forEach(perf => {
          const hX = px + (perf.x * escala);
          const hY = py + (perf.y * escala);
          const rHole = Math.max(2.5, (perf.diam || 35) / 2 * escala);

          ctx.beginPath();
          ctx.arc(hX, hY, rHole, 0, Math.PI * 2);
          ctx.fillStyle = '#0F172A';
          ctx.fill();
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Cruz de centro CAD
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
          ctx.beginPath();
          ctx.moveTo(hX - rHole - 1, hY); ctx.lineTo(hX + rHole + 1, hY);
          ctx.moveTo(hX, hY - rHole - 1); ctx.lineTo(hX, hY + rHole + 1);
          ctx.stroke();

          if (rHole >= 5) {
            ctx.fillStyle = '#38BDF8';
            ctx.font = '7px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Ø35', hX, hY - rHole - 2);
          }
        });
      }
    });

    // 4. Cotas generales de la plancha exterior
    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${t.largo} mm`, origenX + (t.largo * escala) / 2, origenY - 8);

    ctx.save();
    ctx.translate(origenX - 8, origenY + (t.ancho * escala) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${t.ancho} mm`, 0, 0);
    ctx.restore();
  }
}

// Instancia global del renderizador disponible para app.js
window.optimizerRenderer = null;
document.addEventListener('DOMContentLoaded', () => {
  window.optimizerRenderer = new OptimizerCanvasRenderer('optimizerCanvas');
});
