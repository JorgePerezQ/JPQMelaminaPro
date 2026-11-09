# ==============================================================================
# Archivo: jpq_melamina_pro/core/kinematics_engine.rb
# Descripción: Motor cinemático de simulación de apertura tridimensional y cotas.
#              Simula en tiempo real la apertura sincronizada de:
#              - Cajoneras (desplazamiento frontal del 80% en eje Y)
#              - Puertas batientes (rotación angular de 90° sobre eje Z)
#              - Puertas con pistón a gas superior (rotación de -85° en eje X)
#              - Puertas corredizas (traslación lineal en eje X)
#              - Generación de líneas de cota 3D flotantes de validación técnica
# ==============================================================================

require 'sketchup.rb'
require 'json'

module JPQMelaminaPro
  class KinematicsEngine
    class << self
      # Estado global de apertura ('cerrado' o 'abierto')
      @estado_actual = 'cerrado'

      # ========================================================================
      # Método: alternar_apertura
      # Descripción: Control maestro que abre o cierra todas las partes móviles
      #              del módulo activo o seleccionado en SketchUp.
      # Parámetros:
      #   - estado (String): 'abierto', 'cerrado' o 'alternar'
      # ========================================================================
      def alternar_apertura(estado = 'alternar')
        model = Sketchup.active_model
        return { 'ok' => false, 'error' => 'No hay modelo activo en SketchUp.' } unless model

        nuevo_estado = if estado == 'alternar'
                         (@estado_actual == 'abierto') ? 'cerrado' : 'abierto'
                       else
                         estado
                       end

        model.start_operation("JPQMelaminaPro: #{nuevo_estado.capitalize} Puertas y Cajones", true)

        begin
          conteo_modificados = 0
          modulo_objetivo = obtener_modulo_objetivo(model)

          entidades = modulo_objetivo ? modulo_objetivo.entities : model.active_entities

          recorrer_y_transformar(entidades, nuevo_estado) do |_ent|
            conteo_modificados += 1
          end

          @estado_actual = nuevo_estado
          model.commit_operation

          mensaje = if nuevo_estado == 'abierto'
                      "🔓 #{conteo_modificados} elemento(s) abiertos (cajones al 80% y puertas rotadas para inspección)."
                    else
                      "🔒 #{conteo_modificados} elemento(s) devueltos a posición cerrada de render."
                    end

          { 'ok' => true, 'estado' => nuevo_estado, 'mensaje' => mensaje, 'conteo' => conteo_modificados }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => "Error cinemático: #{e.message}" }
        end
      end

      # ========================================================================
      # Método: alternar_cotas_3d
      # Descripción: Muestra u oculta cotas tridimensionales de validación en SketchUp.
      # Parámetros:
      #   - mostrar (Boolean): true para generar/visualizar, false para eliminar.
      # ========================================================================
      def alternar_cotas_3d(mostrar)
        model = Sketchup.active_model
        return { 'ok' => false, 'error' => 'No hay modelo activo.' } unless model

        model.start_operation('JPQMelaminaPro: Alternar Cotas 3D', true)

        begin
          # Capa o layer dedicada a cotas técnicas
          capa_cotas = model.layers['JPQ_Cotas_Tecnicas'] || model.layers.add('JPQ_Cotas_Tecnicas')
          capa_cotas.visible = mostrar

          # Eliminar cotas previas existentes si se apaga
          unless mostrar
            model.active_entities.grep(Sketchup::DimensionLinear).each do |dim|
              model.active_entities.erase_entities(dim) if dim.layer == capa_cotas
            end
          end

          if mostrar
            modulo = obtener_modulo_objetivo(model)
            if modulo
              dict = modulo.attribute_dictionary('DespieceMelaModulo')
              if dict
                w = dict['ancho_mm'].to_f.mm
                h = dict['alto_mm'].to_f.mm
                d = dict['prof_mm'].to_f.mm

                # Cota de Ancho Total
                dim_w = model.active_entities.add_dimension_linear(
                  Geom::Point3d.new(0, -50.mm, 0),
                  Geom::Point3d.new(w, -50.mm, 0),
                  Geom::Vector3d.new(0, -100.mm, 0)
                )
                dim_w.layer = capa_cotas

                # Cota de Alto Total
                dim_h = model.active_entities.add_dimension_linear(
                  Geom::Point3d.new(-50.mm, 0, 0),
                  Geom::Point3d.new(-50.mm, 0, h),
                  Geom::Vector3d.new(-100.mm, 0, 0)
                )
                dim_h.layer = capa_cotas
              end
            end
          end

          model.commit_operation
          { 'ok' => true, 'cotas_visibles' => mostrar, 'mensaje' => mostrar ? '📐 Cotas técnicas 3D mostradas.' : 'Cotas ocultas.' }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => "Error al alternar cotas: #{e.message}" }
        end
      end

      private

      # ========================================================================
      # Sub-método: obtener_modulo_objetivo
      # Descripción: Encuentra el módulo activo o seleccionado en el modelo.
      # ========================================================================
      def obtener_modulo_objetivo(model)
        sel = model.selection
        modulo = sel.find { |e| e.attribute_dictionary('DespieceMelaModulo') }
        modulo ||= CabinetBuilder.ultimo_modulo_activo if defined?(CabinetBuilder) && CabinetBuilder.ultimo_modulo_activo && CabinetBuilder.ultimo_modulo_activo.valid?
        modulo
      end

      # ========================================================================
      # Sub-método: recorrer_y_transformar
      # Descripción: Explora recursivamente el árbol de entidades y aplica
      #              la cinemática adecuada según el herraje guardado.
      # ========================================================================
      def recorrer_y_transformar(entidades, nuevo_estado, &bloque)
        entidades.each do |ent|
          next unless ent.is_a?(Sketchup::Group) || ent.is_a?(Sketchup::ComponentInstance)

          dict = ent.attribute_dictionary('DespieceMela')
          if dict && dict['Tipo_Herraje']
            aplicar_movimiento_pieza(ent, dict, nuevo_estado)
            bloque.call(ent) if bloque
          elsif ent.name =~ /Cajón|Puerta|Frente/i
            # Detección inteligente por nombre si no tiene atributo explícito
            aplicar_movimiento_por_nombre(ent, nuevo_estado)
            bloque.call(ent) if bloque
          end

          # Explorar submódulos recursivamente
          if ent.respond_to?(:entities)
            recorrer_y_transformar(ent.entities, nuevo_estado, &bloque)
          end
        end
      end

      # ========================================================================
      # Sub-método: aplicar_movimiento_pieza
      # Descripción: Aplica cinemática basada en el diccionario de herraje.
      # ========================================================================
      def aplicar_movimiento_pieza(ent, dict, estado)
        herraje = dict['Tipo_Herraje'].to_s

        # Asegurar almacenamiento de transformación base
        guardar_transformacion_base(ent, dict)

        if estado == 'cerrado'
          restaurar_transformacion_base(ent, dict)
          return
        end

        # Estado 'abierto'
        case herraje
        when 'corredera_telescopica', 'cajon_interno'
          prof_slide = (dict['Profundidad_Corredera'] || 450.0).to_f.mm
          desplazamiento_y = -(prof_slide * 0.8) # 80% hacia adelante (eje Y negativo en pantalla)
          trans_mov = Geom::Transformation.translation(Geom::Vector3d.new(0, desplazamiento_y, 0))
          ent.transform!(trans_mov)

        when 'piston_gas_superior'
          bb = ent.bounds
          # Bisagras superiores ubicadas en la cara posterior superior de la puerta
          origen_pivote = Geom::Point3d.new(bb.min.x, bb.max.y, bb.max.z)
          rot = Geom::Transformation.rotation(origen_pivote, Geom::Vector3d.new(1, 0, 0), -85.degrees)
          centro_prev = ent.bounds.center
          ent.transform!(rot)
          # Verificar que abra hacia afuera (menor Y hacia la habitación)
          if ent.bounds.center.y > centro_prev.y
            ent.transform!(rot.inverse)
            rot_corr = Geom::Transformation.rotation(origen_pivote, Geom::Vector3d.new(1, 0, 0), 85.degrees)
            ent.transform!(rot_corr)
          end

        when 'piston_gas_inverso'
          bb = ent.bounds
          origen_pivote = Geom::Point3d.new(bb.min.x, bb.max.y, bb.min.z)
          rot = Geom::Transformation.rotation(origen_pivote, Geom::Vector3d.new(1, 0, 0), 85.degrees)
          centro_prev = ent.bounds.center
          ent.transform!(rot)
          # Verificar que abata hacia afuera (menor Y)
          if ent.bounds.center.y > centro_prev.y
            ent.transform!(rot.inverse)
            rot_corr = Geom::Transformation.rotation(origen_pivote, Geom::Vector3d.new(1, 0, 0), -85.degrees)
            ent.transform!(rot_corr)
          end

        when 'bisagra_batiente', 'puerta_batiente'
          bb = ent.bounds
          lado = dict['Lado_Bisagra'] || 'izquierdo'
          x_pivote = (lado == 'derecho') ? bb.max.x : bb.min.x
          angulo = (lado == 'derecho') ? -95.degrees : 95.degrees
          origen_pivote = Geom::Point3d.new(x_pivote, bb.min.y, bb.min.z)
          rot = Geom::Transformation.rotation(origen_pivote, Geom::Vector3d.new(0, 0, 1), angulo)
          ent.transform!(rot)

        when 'puerta_corrediza'
          ancho_p = (dict['ancho_bruto_mm'] || 500.0).to_f.mm
          lado = dict['Lado_Bisagra'] || 'izquierdo'
          dist_x = (lado == 'izquierdo') ? (ancho_p - 60.mm) : -(ancho_p - 60.mm)
          trans_mov = Geom::Transformation.translation(Geom::Vector3d.new(dist_x, 0, 0))
          ent.transform!(trans_mov)
        end
      end

      # ========================================================================
      # Sub-método: aplicar_movimiento_por_nombre
      # Descripción: Fallback para cajones o puertas sin metadatos cinemáticos explícitos.
      # ========================================================================
      def aplicar_movimiento_por_nombre(ent, estado)
        dict = ent.attribute_dictionary('DespieceMela', true)
        guardar_transformacion_base(ent, dict)

        if estado == 'cerrado'
          restaurar_transformacion_base(ent, dict)
          return
        end

        if ent.name =~ /Cajón|Cajon/i
          trans = Geom::Transformation.translation(Geom::Vector3d.new(0, -350.mm, 0))
          ent.transform!(trans)
        elsif ent.name =~ /Puerta/i
          bb = ent.bounds
          origen_pivote = Geom::Point3d.new(bb.min.x, bb.min.y, bb.min.z)
          rot = Geom::Transformation.rotation(origen_pivote, Geom::Vector3d.new(0, 0, 1), 90.degrees)
          ent.transform!(rot)
        end
      end

      # ========================================================================
      # Sub-método: guardar_transformacion_base
      # Descripción: Guarda la matriz 4x4 original de posición cerrada.
      # ========================================================================
      def guardar_transformacion_base(ent, dict)
        unless dict['Transformacion_Original']
          dict['Transformacion_Original'] = ent.transformation.to_a.to_json
        end
      end

      # ========================================================================
      # Sub-método: restaurar_transformacion_base
      # Descripción: Restaura exactamente la posición cerrada original sin desfasajes.
      # ========================================================================
      def restaurar_transformacion_base(ent, dict)
        json_matriz = dict['Transformacion_Original']
        return unless json_matriz

        begin
          array_matriz = JSON.parse(json_matriz)
          nueva_trans = Geom::Transformation.new(array_matriz)
          ent.transformation = nueva_trans
        rescue => e
          puts "[JPQMelaminaPro] Error al restaurar transformación: #{e.message}"
        end
      end

      # ========================================================================
      # Método: encontrar_objeto_movil
      # Descripción: Busca si la entidad o alguno de sus contenedores es un
      #              cajón o puerta cinemática.
      # ========================================================================
      def encontrar_objeto_movil(ent)
        curr = ent
        while curr
          if curr.respond_to?(:attribute_dictionary)
            dict = curr.attribute_dictionary('DespieceMela')
            return curr if dict && dict['Tipo_Herraje']
            return curr if curr.name =~ /Cajón|Cajon|Puerta|Frente/i
          end
          if curr.respond_to?(:parent) && curr.parent.is_a?(Sketchup::ComponentDefinition)
            curr = curr.parent.instances.first
          else
            break
          end
        end
        nil
      end

      # ========================================================================
      # Método: alternar_apertura_entidad
      # Descripción: Abre si está cerrado o cierra si está abierto una pieza
      #              individual al hacer clic sobre ella en SketchUp 3D.
      # ========================================================================
      def alternar_apertura_entidad(ent)
        target = encontrar_objeto_movil(ent)
        return false unless target

        model = Sketchup.active_model
        return false unless model

        model.start_operation("JPQMelaminaPro: Alternar Apertura #{target.name}", true)
        dict = target.attribute_dictionary('DespieceMela', true)
        estado_actual = dict['Estado_Animacion'] || 'cerrado'
        nuevo_estado = (estado_actual == 'abierto') ? 'cerrado' : 'abierto'

        if dict['Tipo_Herraje']
          aplicar_movimiento_pieza(target, dict, nuevo_estado)
        else
          aplicar_movimiento_por_nombre(target, nuevo_estado)
        end

        dict['Estado_Animacion'] = nuevo_estado
        model.commit_operation

        Sketchup.status_text = (nuevo_estado == 'abierto') ? "🔓 #{target.name} ABIERTO." : "🔒 #{target.name} CERRADO."
        true
      end
    end
  end

  # ============================================================================
  # Herramienta Interactiva de SketchUp: SimulacionInteractivaTool
  # Permite hacer clic directamente en el modelo 3D de SketchUp para abrir/cerrar
  # cualquier cajón o puerta de manera inmediata.
  # ============================================================================
  class SimulacionInteractivaTool
    def activate
      Sketchup.status_text = 'JPQMelaminaPro [Modo Simulación 3D]: Haz clic sobre cualquier puerta o cajón para abrirlo o cerrarlo.'
    end

    def onLButtonDown(flags, x, y, view)
      ph = view.pick_helper
      ph.do_pick(x, y)
      ent = ph.best_picked
      if ent
        exito = KinematicsEngine.alternar_apertura_entidad(ent)
        unless exito
          Sketchup.status_text = 'No se detectó un cajón o puerta interactiva en el punto cliqueado.'
        end
      end
    end

    def onSetCursor
      UI.set_cursor(632) rescue nil # 632 = Cursor interactivo de mano
    end
  end

  # ============================================================================
  # Herramienta Interactiva de SketchUp: OcultarVisualizarPiezaTool
  # Permite hacer clic directamente en el modelo 3D de SketchUp para ocultar
  # cualquier pieza (lateral, repisa, puerta, zócalo, cajón).
  # Si la pieza está oculta, al hacer clic se vuelve a mostrar.
  # Al desactivar la herramienta, todas las piezas que estaban ocultas se muestran.
  # ============================================================================
  class OcultarVisualizarPiezaTool
    def initialize
      @piezas_ocultas = []
    end

    def activate
      @piezas_ocultas ||= []
      Sketchup.status_text = 'JPQMelaminaPro [Modo Ocultar/Ver Piezas]: Haz clic sobre cualquier pieza para ocultarla o mostrarla. Al salir, todas volverán a mostrarse.'
    end

    def deactivate(view)
      restablecer_piezas_ocultas
      view.invalidate if view
    end

    def onLButtonDown(flags, x, y, view)
      ph = view.pick_helper
      ph.do_pick(x, y)
      ent = ph.best_picked

      target = resolver_pieza_objetivo(ent, ph)

      if target
        model = Sketchup.active_model
        model.start_operation('Ocultar/Ver Pieza', true)
        if target.hidden?
          target.hidden = false
          @piezas_ocultas.delete(target)
          Sketchup.status_text = "👁️ Pieza visible: #{target.name}"
        else
          target.hidden = true
          @piezas_ocultas << target unless @piezas_ocultas.include?(target)
          Sketchup.status_text = "🔒 Pieza oculta: #{target.name}. Haz clic nuevamente para mostrarla."
        end
        model.commit_operation
        view.invalidate
      else
        Sketchup.status_text = 'Haz clic sobre una pieza del mueble para ocultarla o visualizarla.'
      end
    end

    def restablecer_piezas_ocultas
      return if @piezas_ocultas.nil? || @piezas_ocultas.empty?
      model = Sketchup.active_model
      return unless model
      model.start_operation('Restablecer Piezas Ocultas', true)
      @piezas_ocultas.each do |e|
        e.hidden = false if e && e.valid?
      end
      @piezas_ocultas.clear
      model.commit_operation
      Sketchup.status_text = '✓ Todas las piezas han sido restablecidas a visibles.'
    end

    def resolver_pieza_objetivo(ent, ph)
      return nil unless ent
      if ent.is_a?(Sketchup::Group) || ent.is_a?(Sketchup::ComponentInstance)
        return ent
      end
      path = ph.path_at(0)
      if path && !path.empty?
        sub = path.reverse.find do |e|
          (e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)) &&
            (e.attribute_dictionary('DespieceMela') || e.attribute_dictionary('DespieceMelaPieza') || e.name.to_s.length > 0)
        end
        return sub if sub
        return path.reverse.find { |e| e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance) }
      end
      nil
    end

    def onSetCursor
      UI.set_cursor(632) rescue nil
    end
  end
end
