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

        return nil if sel.empty?

        entidad = sel.first
        return nil unless entidad.is_a?(Sketchup::Group) || entidad.is_a?(Sketchup::ComponentInstance)

        dict = entidad.attribute_dictionary('DespieceMelaModulo')
        return nil unless dict

        # Mapeo de atributos a un Hash estándar de Ruby
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
      #              su posición y orientación original en el espacio 3D.
      # Parámetros:
      #   - params (Hash): Nuevas dimensiones y opciones del formulario.
      # ========================================================================
      def update(params)
        model = Sketchup.active_model
        sel = model.selection

        # Buscar la entidad correspondiente
        entidad = sel.find do |e|
          e.attribute_dictionary('DespieceMelaModulo') != nil
        end

        return { 'ok' => false, 'error' => 'No se encontró el módulo original para actualizar.' } unless entidad

        model.start_operation('JPQMelaminaPro: Actualizar Módulo', true)

        begin
          transformacion = entidad.transformation

          # Eliminar geometría interna previa
          entidad.entities.clear!

          # Reconstruir los paneles dentro del mismo grupo
          alto_total   = params['alto'].to_f.mm
          ancho_total  = params['ancho'].to_f.mm
          prof_total   = params['profundidad'].to_f.mm
          t            = params['espesor'].to_f.mm

          # Actualizar diccionario del módulo
          dict_mod = entidad.attribute_dictionary('DespieceMelaModulo', true)
          dict_mod['alto_mm']    = params['alto'].to_f
          dict_mod['ancho_mm']   = params['ancho'].to_f
          dict_mod['prof_mm']    = params['profundidad'].to_f
          dict_mod['espesor_mm'] = params['espesor'].to_f

          # Reejecutar la lógica de paneles
          CabinetBuilder.build(params.merge('target_group' => entidad))

          model.commit_operation
          { 'ok' => true, 'mensaje' => 'Módulo actualizado correctamente.' }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => e.message }
        end
      end
    end
  end
end
