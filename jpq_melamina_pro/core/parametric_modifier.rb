# ==============================================================================
# Archivo: mela_studio_clone/core/parametric_modifier.rb
# Descripción: Módulo de edición paramétrica no destructiva.
#              Permite consultar los atributos de un mueble seleccionado y
#              actualizar sus medidas o configuración sin tener que redibujar a mano.
# ==============================================================================

require 'sketchup.rb'

module JPQMelaminaPro
  class ParametricModifier
    class << self
      # ========================================================================
      # Método: leer_seleccion_completa
      # Descripción: Examina la selección en SketchUp (mueble modular completo,
      #              módulo interior o pieza individual) y extrae la definición
      #              paramétrica completa con todas sus cotas y módulos para
      #              cargar y visualizar todo el diseño en el panel web.
      # Retorno:
      #   - Hash con { ok: true, tipo: ..., params: { ... }, entity_id: ... } o nil
      # ========================================================================
      def leer_seleccion_completa
        model = Sketchup.active_model
        return nil unless model
        sel = model.selection

      # 1. Encontrar la entidad raíz del mueble o composición
        entidad = resolver_entidad_mueble(model, sel)

        return nil unless entidad && (entidad.is_a?(Sketchup::Group) || entidad.is_a?(Sketchup::ComponentInstance))

        dict = entidad.attribute_dictionary('DespieceMelaModulo')
        return nil unless dict

        # 2. Si tiene params_json serializado, es el camino directo y 100% exacto
        if dict['params_json'] && !dict['params_json'].to_s.strip.empty?
          begin
            parsed_params = JSON.parse(dict['params_json'])
            return {
              'ok' => true,
              'tipo' => dict['tipo'] || 'composicion_modular',
              'entity_id' => entidad.entityID,
              'params' => parsed_params
            }
          rescue => e
            puts "[JPQMelaminaPro] Error al parsear params_json: #{e.message}"
          end
        end

        # 3. Reconstrucción inteligente si params_json no estaba presente
        tipo_elem = dict['tipo'] || 'composicion_modular'
        ancho_total = (dict['ancho_mm'] || entidad.bounds.width.to_mm).to_f.round
        alto_total  = (dict['alto_mm'] || entidad.bounds.height.to_mm).to_f.round
        prof_total  = (dict['prof_mm'] || entidad.bounds.depth.to_mm).to_f.round
        espesor     = (dict['espesor_mm'] || 18.0).to_f
        resistencia = dict['resistencia'] || 'Normal'
        material_est= dict['material'] || 'Pelikano Blanco Nieve 18mm'

        # Detectar zócalo perimétrico
        grupo_zoc = entidad.entities.grep(Sketchup::Group).find do |g|
          g.name.to_s.downcase.include?('zócalo') || g.name.to_s.downcase.include?('zocalo')
        end
        tiene_zoc = !grupo_zoc.nil?
        alto_zoc = tiene_zoc ? grupo_zoc.bounds.height.to_mm.round : 0

        # Detectar sub-módulos
        modulos = []
        grupos_hijos = entidad.entities.grep(Sketchup::Group).select do |g|
          d = g.attribute_dictionary('DespieceMelaModulo')
          d && d['tipo'] == 'modulo_individual'
        end

        if grupos_hijos.empty?
          grupos_hijos = entidad.entities.grep(Sketchup::Group).select do |g|
            !g.name.to_s.downcase.include?('zócalo') && !g.name.to_s.downcase.include?('zocalo')
          end
        end

        grupos_hijos.sort_by! { |g| g.bounds.min.x }

        grupos_hijos.each_with_index do |gh, idx|
          dm = gh.attribute_dictionary('DespieceMelaModulo') || {}
          w_m = (dm['ancho_mm'] || gh.bounds.width.to_mm).to_f.round
          h_m = (dm['alto_mm'] || gh.bounds.height.to_mm).to_f.round
          d_m = (dm['prof_mm'] || gh.bounds.depth.to_mm).to_f.round
          nom_m = dm['nombre'] || gh.name || "Módulo #{idx + 1}"

          # Inspeccionar paneles internos para deducir equipamiento
          nombres_paneles = gh.entities.grep(Sketchup::Group).map { |p| p.name.to_s.downcase }
          cant_caj = nombres_paneles.count { |n| n.include?('cajón') || n.include?('cajon') || n.include?('gaveta') }
          cant_rep = nombres_paneles.count { |n| n.include?('repisa') }
          cant_pta = nombres_paneles.count { |n| n.include?('puerta') }

          tipo_int = if cant_caj > 0
                       'cajonera'
                     elsif cant_rep > 0
                       'repisas'
                     elsif cant_pta > 0
                       'puertas'
                     else
                       'carcasa'
                     end

          modulos << {
            'id' => dm['indice'] || (idx + 1),
            'nombre' => nom_m,
            'columna_idx' => dm['columna_idx'] || idx,
            'nivel_apilado' => dm['nivel_apilado'] || 0,
            'ancho' => w_m,
            'alto' => h_m,
            'profundidad' => d_m,
            'tipo_interior' => tipo_int,
            'cant_cajones' => [cant_caj, 3].min,
            'cant_repisas' => cant_rep,
            'tiene_puertas' => cant_pta > 0,
            'tiene_fondo' => true
          }
        end

        if modulos.empty?
          modulos << {
            'id' => 1,
            'nombre' => entidad.name || 'Módulo Principal',
            'ancho' => ancho_total,
            'alto' => alto_total - alto_zoc,
            'profundidad' => prof_total,
            'tipo_interior' => 'carcasa',
            'cant_repisas' => 0,
            'cant_cajones' => 0,
            'tiene_puertas' => false,
            'tiene_fondo' => true
          }
        end

        payload = {
          'ancho_total' => ancho_total,
          'alto_total' => alto_total,
          'prof_total' => prof_total,
          'espesor' => espesor,
          'tiene_zocalo' => tiene_zoc,
          'alto_zocalo' => alto_zoc,
          'resistencia' => resistencia,
          'material_estructura' => material_est,
          'material_frentes' => material_est,
          'modulos' => modulos
        }

        {
          'ok' => true,
          'tipo' => tipo_elem,
          'entity_id' => entidad.entityID,
          'params' => payload
        }
      end

      # ========================================================================
      # Método: leer_seleccion
      # Descripción: Examina el objeto actualmente seleccionado en SketchUp y extrae
      #              sus variables maestras si corresponde a un módulo JPQMelaminaPro.
      # Retorno:
      #   - Hash con los parámetros del módulo o nil si no es un módulo válido.
      # ========================================================================
      def leer_seleccion
        model = Sketchup.active_model
        sel = model.selection

        entidad = sel.find { |e| e.attribute_dictionary('DespieceMelaModulo') }
        entidad ||= sel.first if !sel.empty? && sel.first.respond_to?(:attribute_dictionary) && sel.first.attribute_dictionary('DespieceMelaModulo')
        entidad ||= CabinetBuilder.ultimo_modulo_activo if defined?(CabinetBuilder) && CabinetBuilder.ultimo_modulo_activo && CabinetBuilder.ultimo_modulo_activo.valid?

        return nil unless entidad && (entidad.is_a?(Sketchup::Group) || entidad.is_a?(Sketchup::ComponentInstance))

        dict = entidad.attribute_dictionary('DespieceMelaModulo')
        return nil unless dict

        datos = {}
        dict.each_pair do |k, v|
          datos[k] = v
        end

        datos['entity_id'] = entidad.entityID
        datos
      end

      # ========================================================================
      # Método: leer_pieza_individual
      # Descripción: Obtiene los atributos individuales de un solo panel de melamina
      #              (para ajuste de sobredimensión, cambio de veta o nombre).
      # Retorno:
      #   - Hash con los datos de la pieza individual o nil.
      # ========================================================================
      def leer_pieza_individual
        model = Sketchup.active_model
        sel = model.selection
        return nil if sel.empty?

        entidad = sel.first
        dict = entidad.attribute_dictionary('DespieceMela')
        return nil unless dict

        datos = {}
        dict.each_pair do |k, v|
          datos[k] = v
        end
        datos['entity_id'] = entidad.entityID
        datos
      end

      # ========================================================================
      # Método: update
      # Descripción: Actualiza paramétricamente el módulo seleccionado conservando
      #              su tipo original (evita deformación a librero) y manteniendo
      #              todos los accesorios estructurales de carpintería.
      # Parámetros:
      #   - params (Hash): Nuevas dimensiones y opciones del formulario.
      # ========================================================================
      def update(params)
        model = Sketchup.active_model
        sel = model.selection

        # Buscar la entidad correspondiente o el último módulo activo
        entidad = sel.find { |e| e.attribute_dictionary('DespieceMelaModulo') != nil }
        entidad ||= CabinetBuilder.ultimo_modulo_activo if defined?(CabinetBuilder) && CabinetBuilder.ultimo_modulo_activo && CabinetBuilder.ultimo_modulo_activo.valid?

        return { 'ok' => false, 'error' => 'No se encontró el módulo original para actualizar.' } unless entidad

        model.start_operation('JPQMelaminaPro: Actualizar Módulo', true)

        begin
          dict_mod = entidad.attribute_dictionary('DespieceMelaModulo', true)

          # Recuperar parámetros originales serializados para preservar opciones del mueble
          params_originales = {}
          if dict_mod['params_json']
            begin
              params_originales = JSON.parse(dict_mod['params_json'])
            rescue
            end
          end

          tipo_preservado = params['tipo'] || params_originales['tipo'] || dict_mod['tipo'] || 'librero'

          # Mezclar parámetros sin perder el tipo de mueble ni accesorios
          params_combinados = params_originales.merge(params)
          params_combinados['tipo']        = tipo_preservado
          params_combinados['alto']        = (params['alto'] && params['alto'].to_f > 0) ? params['alto'].to_f : dict_mod['alto_mm'].to_f
          params_combinados['ancho']       = (params['ancho'] && params['ancho'].to_f > 0) ? params['ancho'].to_f : dict_mod['ancho_mm'].to_f
          params_combinados['profundidad'] = (params['profundidad'] && params['profundidad'].to_f > 0) ? params['profundidad'].to_f : dict_mod['prof_mm'].to_f
          esp_val = (params['espesor'] && params['espesor'].to_f > 0) ? params['espesor'].to_f : (dict_mod['espesor_mm'] ? dict_mod['espesor_mm'].to_f : 18.0)
          params_combinados['espesor']     = esp_val
          params_combinados['material']    = params['material'] || dict_mod['material'] || 'Pelikano Blanco Nieve 18mm'
          params_combinados['target_group']= entidad

          # Eliminar geometría interna previa
          entidad.entities.clear!

          # Reejecutar la lógica de paneles con el tipo exacto preservado
          resultado = CabinetBuilder.build(params_combinados)

          model.commit_operation
          { 'ok' => true, 'mensaje' => "Módulo '#{tipo_preservado}' actualizado gradualmente sin deformación.", 'resultado' => resultado }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => e.message }
        end
      end

      # ========================================================================
      # Método: resolver_entidad_mueble
      # Descripción: Resuelve jerárquicamente la entidad raíz del mueble modular
      #              a partir de la selección activa (grupo principal, submódulo,
      #              pieza interior, o contexto activo de edición).
      # Parámetros:
      #   - model (Sketchup::Model)
      #   - sel (Sketchup::Selection)
      # Retorno:
      #   - Sketchup::Group o Sketchup::ComponentInstance raíz con DespieceMelaModulo
      # ========================================================================
      def resolver_entidad_mueble(model, sel)
        return nil unless model

        # Si el usuario no tiene ninguna selección activa en SketchUp y no está editando dentro de un contenedor
        if (sel.nil? || sel.empty?) && (model.active_path.nil? || model.active_path.empty?)
          return nil
        end

        # 1. Si la selección tiene directamente una composición modular
        comp_directa = sel.find do |e|
          e.respond_to?(:attribute_dictionary) &&
            e.attribute_dictionary('DespieceMelaModulo') &&
            e.attribute_dictionary('DespieceMelaModulo')['tipo'] == 'composicion_modular'
        end
        return comp_directa if comp_directa

        # 2. Si la selección tiene un módulo o grupo con DespieceMelaModulo
        cand = sel.find do |e|
          e.respond_to?(:attribute_dictionary) && e.attribute_dictionary('DespieceMelaModulo')
        end

        # 3. Si se seleccionó una pieza o elemento interno (cara, arista, subgrupo DespieceMelaPieza)
        if cand.nil?
          # A. Buscar en el active_path de SketchUp (si el usuario entró al grupo)
          if model.active_path && !model.active_path.empty?
            # Priorizar composicion_modular
            comp_path = model.active_path.reverse.find do |g|
              g.respond_to?(:attribute_dictionary) &&
                g.attribute_dictionary('DespieceMelaModulo') &&
                g.attribute_dictionary('DespieceMelaModulo')['tipo'] == 'composicion_modular'
            end
            return comp_path if comp_path

            cand = model.active_path.reverse.find do |g|
              g.respond_to?(:attribute_dictionary) && g.attribute_dictionary('DespieceMelaModulo')
            end
          end

          # B. Subir por parent definitions desde el elemento seleccionado
          if cand.nil? && !sel.empty?
            elem = sel.first
            curr = elem
            while curr && curr.respond_to?(:parent) && curr.parent.is_a?(Sketchup::ComponentDefinition)
              p_def = curr.parent
              inst = p_def.instances.first
              if inst && inst.respond_to?(:attribute_dictionary) && inst.attribute_dictionary('DespieceMelaModulo')
                d = inst.attribute_dictionary('DespieceMelaModulo')
                return inst if d['tipo'] == 'composicion_modular'
                cand ||= inst
              end
              curr = inst
            end
          end
        end

        # 4. Si el candidato encontrado es un modulo_individual, buscar su composicion_modular padre
        if cand && cand.respond_to?(:attribute_dictionary)
          d_cand = cand.attribute_dictionary('DespieceMelaModulo')
          if d_cand && d_cand['tipo'] != 'composicion_modular'
            padre = model.entities.grep(Sketchup::Group).find do |g|
              d = g.attribute_dictionary('DespieceMelaModulo')
              next false unless d && d['tipo'] == 'composicion_modular'
              (g.definition.entities.include?(cand) rescue false) || g.bounds.contains?(cand.bounds.center)
            end
            cand = padre if padre
          end
        end

        return cand if cand

        # 5. Si la selección contiene una entidad interna dentro de los límites de una composición modular
        if !sel.empty?
          elem = sel.first
          if elem.respond_to?(:bounds)
            comp_padre = model.entities.grep(Sketchup::Group).find do |g|
              d = g.attribute_dictionary('DespieceMelaModulo')
              d && d['tipo'] == 'composicion_modular' && g.bounds.contains?(elem.bounds.center)
            end
            return comp_padre if comp_padre
          end
        end

        nil
      end
    end
  end
end

