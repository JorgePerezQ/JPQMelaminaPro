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
          params_combinados['material']    = params['material'] || dict_mod['material'] || 'Pelikano Bellota 18mm'
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
    end
  end
end

