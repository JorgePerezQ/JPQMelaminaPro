# ==============================================================================
# Archivo: core/realtime_module_editor_tool.rb
# Descripción: Herramienta interactiva para SketchUp que permite modificar
#              el ancho y alto de un módulo en tiempo real arrastrando con el ratón.
#              - Arrastre vertical (arriba/abajo): aumenta o disminuye la altura.
#              - Arrastre horizontal (derecha/izquierda): aumenta o disminuye el ancho.
#              - Restricción estricta: las dimensiones no pueden superar las cotas
#                del mueble definido.
# ==============================================================================

require 'sketchup.rb'

module JPQMelaminaPro
  class RealtimeModuleEditorTool
    def initialize
      @dragging = false
      @hover_entity = nil
      @modulo_target = nil
      @composicion_target = nil
      @modulo_idx = 0
      @anchor_pt = Geom::Point3d.new(0, 0, 0)

      @start_mouse_x = 0
      @start_mouse_y = 0

      @orig_w = 600.0
      @orig_h = 1800.0
      @orig_d = 600.0

      @current_w = 600.0
      @current_h = 1800.0

      @mueble_ancho = 2400.0
      @mueble_alto = 2100.0
      @max_ancho = 2400.0
      @max_alto = 2100.0
      @min_w = 150.0
      @min_h = 150.0
      @zocalo_h = 0.0
    end

    # ==========================================================================
    # Método: activate
    # ==========================================================================
    def activate
      model = Sketchup.active_model
      sel = model.selection

      # Si ya hay un módulo o composición seleccionada, prepararlo de inmediato
      if sel && !sel.empty?
        preparar_objetivo(sel.first)
      end

      actualizar_mensaje_estado
    end

    # ==========================================================================
    # Método: deactivate
    # ==========================================================================
    def deactivate(view)
      @dragging = false
      @hover_entity = nil
      view.invalidate if view
    end

    # ==========================================================================
    # Método: onMouseMove
    # ==========================================================================
    def onMouseMove(flags, x, y, view)
      if @dragging
        # 1. Calcular desplazamiento del mouse en pantalla
        dx_px = x - @start_mouse_x
        dy_px = @start_mouse_y - y # Hacia arriba = positivo

        # 2. Convertir píxeles a milímetros en el espacio 3D
        pixels_per_mm = 1.0 / (view.pixels_to_model(1, @anchor_pt).to_mm rescue 2.5)
        factor = (pixels_per_mm > 0) ? (1.0 / pixels_per_mm) : 2.5

        delta_w = dx_px * factor
        delta_h = dy_px * factor

        # 3. Aplicar restricciones de límites definidos del mueble
        nuevo_w = [[@orig_w + delta_w, @min_w].max, @max_ancho].min.round
        nuevo_h = [[@orig_h + delta_h, @min_h].max, @max_alto].min.round

        @current_w = nuevo_w
        @current_h = nuevo_h

        Sketchup.status_text = "📐 Editando Módulo #{@modulo_idx + 1}: Ancho = #{@current_w.to_i} mm (Máx: #{@max_ancho.to_i} mm) | Alto = #{@current_h.to_i} mm (Máx: #{@max_alto.to_i} mm) [Suelta el clic para aplicar]"
        view.invalidate
      else
        # Hover interactivo: detectar módulo bajo el cursor
        ph = view.pick_helper
        ph.do_pick(x, y)
        nuevo_hover = resolver_modulo_desde_pick(ph)
        if nuevo_hover != @hover_entity
          @hover_entity = nuevo_hover
          view.invalidate
        end
      end
    end

    # ==========================================================================
    # Método: onLButtonDown
    # ==========================================================================
    def onLButtonDown(flags, x, y, view)
      ph = view.pick_helper
      ph.do_pick(x, y)
      target = resolver_modulo_desde_pick(ph)

      if target
        preparar_objetivo(target)
        @start_mouse_x = x
        @start_mouse_y = y
        @current_w = @orig_w
        @current_h = @orig_h
        @dragging = true
        view.invalidate
      else
        Sketchup.status_text = 'Selecciona con el mouse un módulo modular para modificar su ancho y alto.'
      end
    end

    # ==========================================================================
    # Método: onLButtonUp
    # ==========================================================================
    def onLButtonUp(flags, x, y, view)
      if @dragging
        @dragging = false

        if (@current_w != @orig_w || @current_h != @orig_h) && @composicion_target && @composicion_target.valid?
          aplicar_cambio_parametrico(@current_w, @current_h)
        end

        view.invalidate
      end
      actualizar_mensaje_estado
    end

    # ==========================================================================
    # Método: draw
    # Dibuja la caja dinámica de previsualización 3D y cotas en tiempo real.
    # ==========================================================================
    def draw(view)
      # 1. Dibujar resaltado hover si el cursor está sobre un módulo
      if !@dragging && @hover_entity && @hover_entity.valid?
        bb = @hover_entity.bounds
        view.line_width = 2
        view.drawing_color = Sketchup::Color.new(56, 189, 248) # Cyan brillante
        view.draw(GL_LINE_LOOP, [
          bb.corner(0), bb.corner(1), bb.corner(3), bb.corner(2)
        ])
      end

      return unless @dragging && @composicion_target && @composicion_target.valid?

      # 2. Dibujar la caja tridimensional en tiempo real del módulo modificado
      tr = @composicion_target.transformation
      vx = tr.xaxis.clone.normalize
      vy = tr.yaxis.clone.normalize
      vz = tr.zaxis.clone.normalize

      w_len = @current_w.mm
      d_len = @orig_d.mm
      h_len = @current_h.mm

      p0 = @anchor_pt
      p1 = p0 + (vx * w_len)
      p2 = p1 + (vy * d_len)
      p3 = p0 + (vy * d_len)
      p4 = p0 + (vz * h_len)
      p5 = p1 + (vz * h_len)
      p6 = p2 + (vz * h_len)
      p7 = p3 + (vz * h_len)

      # Caras translúcidas (Glow)
      view.drawing_color = Sketchup::Color.new(2, 132, 199, 50)
      quads = [
        p0, p1, p5, p4, # Frontal
        p1, p2, p6, p5, # Derecha
        p2, p3, p7, p6, # Posterior
        p3, p0, p4, p7, # Izquierda
        p4, p5, p6, p7  # Techo
      ]
      view.draw(GL_QUADS, quads)

      # Aristas 3D nítidas
      view.line_width = 3
      view.drawing_color = Sketchup::Color.new(2, 132, 199)
      aristas = [
        p0, p1, p1, p2, p2, p3, p3, p0, # Base
        p4, p5, p5, p6, p6, p7, p7, p4, # Techo
        p0, p4, p1, p5, p2, p6, p3, p7  # Columnas
      ]
      view.draw(GL_LINES, aristas)

      # Límite máximo del mueble definido (Línea punteada)
      max_w_len = @max_ancho.mm
      max_h_len = @max_alto.mm
      mp1 = p0 + (vx * max_w_len)
      mp4 = p0 + (vz * max_h_len)
      mp5 = mp1 + (vz * max_h_len)

      view.line_width = 1
      view.line_stipple = '-.-'
      view.drawing_color = Sketchup::Color.new(148, 163, 184) # Slate 400
      view.draw(GL_LINE_LOOP, [p0, mp1, mp5, mp4])
      view.line_stipple = ''

      # Texto dinámico flotante con cotas actuales y máximas
      scr_pt = view.screen_coords(p5)
      info_txt = "Ancho: #{@current_w.to_i} mm | Alto: #{@current_h.to_i} mm\n(Límites del Mueble: #{@max_ancho.to_i} x #{@max_alto.to_i} mm)"
      view.draw_text([scr_pt.x + 15, scr_pt.y - 15], info_txt, {
        size: 11,
        bold: true,
        color: Sketchup::Color.new(2, 132, 199)
      })
    end

    # ==========================================================================
    # Método: onSetCursor
    # ==========================================================================
    def onSetCursor
      UI.set_cursor(632) rescue nil # Cursor de mano interactiva
    end

    private

    # ==========================================================================
    # Método: resolver_modulo_desde_pick
    # ==========================================================================
    def resolver_modulo_desde_pick(ph)
      path = ph.path_at(0) || []
      return nil if path.empty?

      # Prioridad 1: Módulo individual
      mod = path.reverse.find do |e|
        e.respond_to?(:attribute_dictionary) &&
          e.attribute_dictionary('DespieceMelaModulo') &&
          e.attribute_dictionary('DespieceMelaModulo')['tipo'] == 'modulo_individual'
      end
      return mod if mod

      # Prioridad 2: Composición modular
      comp = path.reverse.find do |e|
        e.respond_to?(:attribute_dictionary) &&
          e.attribute_dictionary('DespieceMelaModulo') &&
          e.attribute_dictionary('DespieceMelaModulo')['tipo'] == 'composicion_modular'
      end
      return comp if comp

      # Prioridad 3: Subgrupo con DespieceMela o DespieceMelaModulo
      path.reverse.find do |e|
        e.respond_to?(:attribute_dictionary) &&
          (e.attribute_dictionary('DespieceMelaModulo') || e.attribute_dictionary('DespieceMela'))
      end
    end

    # ==========================================================================
    # Método: preparar_objetivo
    # ==========================================================================
    def preparar_objetivo(ent)
      return unless ent && ent.valid?

      model = Sketchup.active_model
      # Encontrar composición padre
      comp = ent
      while comp && comp.respond_to?(:parent)
        dict = comp.respond_to?(:attribute_dictionary) ? comp.attribute_dictionary('DespieceMelaModulo') : nil
        break if dict && dict['tipo'] == 'composicion_modular'
        p_ent = (comp.parent.is_a?(Sketchup::ComponentDefinition) && comp.parent.instances.first) ? comp.parent.instances.first : nil
        break unless p_ent
        comp = p_ent
      end

      # Si no halló por jerarquía ascendente, buscar composición contenedora en modelo
      unless comp && comp.respond_to?(:attribute_dictionary) && comp.attribute_dictionary('DespieceMelaModulo') && comp.attribute_dictionary('DespieceMelaModulo')['tipo'] == 'composicion_modular'
        comp = model.entities.grep(Sketchup::Group).find do |g|
          d = g.attribute_dictionary('DespieceMelaModulo')
          d && d['tipo'] == 'composicion_modular' && g.bounds.contains?(ent.bounds.center)
        end
      end

      comp ||= ent
      @composicion_target = comp
      @modulo_target = ent

      dict_comp = comp.attribute_dictionary('DespieceMelaModulo', true)
      dict_mod = ent.attribute_dictionary('DespieceMelaModulo')

      # Dimensiones del mueble general definido
      @mueble_ancho = (dict_comp['ancho_mm'] || comp.bounds.width.to_mm).to_f.round
      @mueble_alto  = (dict_comp['alto_mm'] || comp.bounds.height.to_mm).to_f.round

      # Detectar zócalo perimétrico continuo
      params = {}
      if dict_comp['params_json']
        params = JSON.parse(dict_comp['params_json']) rescue {}
      end

      @zocalo_h = (params['tiene_zocalo'] == true || params['tiene_zocalo'] == 'true') ? ((params['alto_zocalo'] || 100.0).to_f) : 0.0

      # Límite superior: no superar las cotas del mueble definido
      @max_alto  = [@mueble_alto - @zocalo_h, 150.0].max
      @max_ancho = @mueble_ancho

      # Dimensiones iniciales del módulo seleccionado
      @orig_w = (dict_mod && dict_mod['ancho_mm'] ? dict_mod['ancho_mm'].to_f : ent.bounds.width.to_mm).round
      @orig_h = (dict_mod && dict_mod['alto_mm'] ? dict_mod['alto_mm'].to_f : ent.bounds.height.to_mm).round
      @orig_d = (dict_mod && dict_mod['prof_mm'] ? dict_mod['prof_mm'].to_f : ent.bounds.depth.to_mm).round

      # Índice del módulo dentro del mueble
      @modulo_idx = dict_mod && dict_mod['indice'] ? [dict_mod['indice'].to_i - 1, 0].max : 0

      # Punto de anclaje base para el escalado
      @anchor_pt = ent.bounds.corner(0)
    end

    # ==========================================================================
    # Método: aplicar_cambio_parametrico
    # Reconstruye el mueble in-place con las nuevas dimensiones acotadas.
    # ==========================================================================
    def aplicar_cambio_parametrico(nuevo_w, nuevo_h)
      return unless @composicion_target && @composicion_target.valid?

      dict_comp = @composicion_target.attribute_dictionary('DespieceMelaModulo')
      return unless dict_comp

      params = {}
      if dict_comp['params_json']
        params = JSON.parse(dict_comp['params_json']) rescue {}
      end

      modulos = params['modulos'] || []
      if modulos.empty?
        modulos = [{
          'id' => 1, 'nombre' => 'Módulo 1',
          'ancho' => nuevo_w, 'alto' => nuevo_h, 'profundidad' => @orig_d
        }]
        params['modulos'] = modulos
      end

      idx = [@modulo_idx, modulos.length - 1].min
      mod_activo = modulos[idx]

      mod_activo['ancho'] = nuevo_w
      mod_activo['alto']  = nuevo_h

      # Si el mueble tiene 1 módulo
      if modulos.length == 1
        params['ancho_total'] = nuevo_w
        params['alto_total']  = nuevo_h + @zocalo_h
      else
        # Si el mueble tiene varios módulos contiguos, acotar la suma al ancho del mueble
        ancho_total_mueble = (params['ancho_total'] || @mueble_ancho).to_f
        otros_indices = (0...modulos.length).to_a - [idx]
        ancho_otros_actual = otros_indices.map { |i| (modulos[i]['ancho'] || 100).to_f }.sum
        espacio_restante = [ancho_total_mueble - nuevo_w, otros_indices.length * 100.0].max

        if ancho_otros_actual > 0
          otros_indices.each do |oi|
            factor = (modulos[oi]['ancho'].to_f / ancho_otros_actual)
            modulos[oi]['ancho'] = (espacio_restante * factor).round
          end
        end
      end

      # Indicar target_group para que se reconstruya exactamente en la misma ubicación
      params['target_group'] = @composicion_target

      # Ejecutar la reconstrucción paramétrica industrial
      SpatialMatrixBuilder.construir_matriz_espacial(params)

      # Sincronizar el panel web si está abierto
      JPQMelaminaPro.ejecutar_en_dialogo("window.cargarDisenoDesdeSketchup && window.cargarDisenoDesdeSketchup(#{JSON.generate(params)});")

      Sketchup.status_text = "✓ Módulo #{idx + 1} actualizado: #{nuevo_w.to_i} × #{nuevo_h.to_i} mm (Dentro de los límites del mueble)."
    end

    def actualizar_mensaje_estado
      Sketchup.status_text = 'JPQMelaminaPro [Editar en Tiempo Real]: Haz clic en un módulo y arrastra (Arriba/Abajo: Altura | Izquierda/Derecha: Ancho).'
    end
  end
end
