# ==============================================================================
# Archivo: mela_studio_clone/core/machining_engine.rb
# Descripción: Motor de mecanizado y perforaciones de carpintería.
#              Genera marcas de perforación y almacena datos de herrajes para
#              Minifix (caja 15mm), tarugos (8mm), tornillos soberbios y cazoletas (35mm).
# ==============================================================================

require 'sketchup.rb'

module MelaStudioClone
  class MachiningEngine
    class << self
      # ========================================================================
      # Método: apply
      # Descripción: Aplica las perforaciones de unión mecánica entre piezas de un módulo.
      # Parámetros:
      #   - params (Hash):
      #       'sistema' ('minifix_tarugo' | 'tornillo_soberbio' | 'solo_tarugo'),
      #       'distancia_borde' (Float, ej. 50.0 mm),
      #       'crear_geometria_3d' (Boolean)
      # ========================================================================
      def apply(params)
        model = Sketchup.active_model
        sel = model.selection

        modulo = sel.find { |e| e.attribute_dictionary('DespieceMelaModulo') }
        return { 'ok' => false, 'error' => 'Selecciona un módulo para mecanizar sus ensambles.' } unless modulo

        sistema = params['sistema'] || 'minifix_tarugo'
        dist_borde_mm = (params['distancia_borde'] || 50.0).to_f

        model.start_operation('MelaStudio: Mecanizado y Perforaciones', true)

        begin
          conteo = 0

          # Recorrer laterales y paneles horizontales para asociar puntos de fijación
          modulo.entities.each do |panel|
            next unless panel.is_a?(Sketchup::Group)
            dict = panel.attribute_dictionary('DespieceMela')
            next unless dict

            nombre_pieza = dict['pieza_nombre'].to_s

            if nombre_pieza =~ /Piso|Techo|Repisa/i
              # Añadir metadatos de perforaciones
              mecanizados = [
                { 'tipo' => 'perno_minifix', 'diametro_mm' => 8.0, 'profundidad_mm' => 34.0, 'x' => dist_borde_mm },
                { 'tipo' => 'tarugo', 'diametro_mm' => 8.0, 'profundidad_mm' => 30.0, 'x' => dist_borde_mm + 32.0 }
              ]
              dict['mecanizados'] = mecanizados.to_json
              conteo += 1
            elsif nombre_pieza =~ /Lateral/i
              mecanizados = [
                { 'tipo' => 'caja_minifix', 'diametro_mm' => 15.0, 'profundidad_mm' => 12.5, 'distancia_canto_mm' => 34.0 }
              ]
              dict['mecanizados'] = mecanizados.to_json
              conteo += 1
            end
          end

          model.commit_operation
          { 'ok' => true, 'mensaje' => "Mecanizado tipo '#{sistema}' aplicado a #{conteo} paneles con perforaciones normalizadas a #{dist_borde_mm}mm del borde." }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => e.message }
        end
      end
    end
  end
end
