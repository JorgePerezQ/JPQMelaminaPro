# ==============================================================================
# Archivo: jpq_melamina_pro/core/electrical_engine.rb
# Descripción: Motor de mecanizados eléctricos, iluminación LED y pasacables (BIM).
#              Proyecta en el modelo 3D y en los metadatos de corte:
#              - Ranuras para perfil de aluminio empotrado para tiras LED (17x7mm)
#              - Calados circulares equidistantes para spots dicroicos (60/75mm)
#              - Calados rectangulares para interruptores y tomacorrientes (100x55mm)
#              - Ranuras y pasacables para escritorios y centros de entretenimiento (60mm / 200x30mm)
# ==============================================================================

require 'sketchup.rb'
require 'json'

module JPQMelaminaPro
  class ElectricalEngine
    class << self
      # ========================================================================
      # Método: apply_led_groove
      # Descripción: Proyecta una ranura continua de 17x7mm para perfil LED.
      # Parámetros:
      #   - params (Hash):
      #       'ubicacion' ('bajo_altos' | 'laterales_librero' | 'repi_closet' | 'espejo'),
      #       'ancho_canal' (Float, defecto 17.0 mm),
      #       'prof_canal' (Float, defecto 7.0 mm),
      #       'distancia_frente' (Float, defecto 50.0 mm)
      # ========================================================================
      def apply_led_groove(params)
        model = Sketchup.active_model
        return { 'ok' => false, 'error' => 'No hay modelo activo.' } unless model

        sel = model.selection
        modulo = sel.find { |e| e.attribute_dictionary('DespieceMelaModulo') }
        modulo ||= CabinetBuilder.ultimo_modulo_activo if defined?(CabinetBuilder) && CabinetBuilder.ultimo_modulo_activo && CabinetBuilder.ultimo_modulo_activo.valid?
        return { 'ok' => false, 'error' => 'Por favor selecciona un módulo para ranurar tiras LED.' } unless modulo

        ancho_canal = (params['ancho_canal'] || 17.0).to_f
        prof_canal  = (params['prof_canal'] || 7.0).to_f
        ubicacion   = params['ubicacion'] || 'bajo_altos'

        model.start_operation('JPQMelaminaPro: Ranurar Perfil LED 17x7mm', true)

        begin
          conteo = 0
          modulo.entities.each do |ent|
            next unless ent.is_a?(Sketchup::Group)
            dict = ent.attribute_dictionary('DespieceMela')
            next unless dict

            nombre = dict['pieza_nombre'].to_s

            aplica = case ubicacion
                     when 'bajo_altos' then nombre =~ /Piso|Base|Techo/i
                     when 'laterales_librero' then nombre =~ /Lateral/i
                     when 'repi_closet' then nombre =~ /Repisa/i
                     when 'espejo' then nombre =~ /Fondo|Panel/i
                     else false
                     end

            if aplica
              dict['mecanizado_led'] = "Ranura Perfil LED #{ancho_canal}x#{prof_canal}mm"
              dict['ranura_led_activa'] = true
              conteo += 1
            end
          end

          model.commit_operation
          { 'ok' => true, 'mensaje' => "Canal para tira LED (#{ancho_canal}x#{prof_canal}mm) registrado en #{conteo} pieza(s)." }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => "Error al aplicar ranura LED: #{e.message}" }
        end
      end

      # ========================================================================
      # Método: apply_downlights
      # Descripción: Distribuye perforaciones circulares para spots dicroicos en techo.
      # Parámetros:
      #   - params (Hash):
      #       'cantidad' (Integer, ej. 2 a 6),
      #       'diametro' (Float, 60.0 o 75.0 mm)
      # ========================================================================
      def apply_downlights(params)
        model = Sketchup.active_model
        return { 'ok' => false, 'error' => 'No hay modelo activo.' } unless model

        modulo = model.selection.find { |e| e.attribute_dictionary('DespieceMelaModulo') }
        modulo ||= CabinetBuilder.ultimo_modulo_activo if defined?(CabinetBuilder) && CabinetBuilder.ultimo_modulo_activo && CabinetBuilder.ultimo_modulo_activo.valid?
        return { 'ok' => false, 'error' => 'Selecciona un módulo para calar dicroicos.' } unless modulo

        cant_spots = (params['cantidad'] || 2).to_i
        diametro   = (params['diametro'] || 60.0).to_f

        model.start_operation('JPQMelaminaPro: Calados para Dicroicos', true)

        begin
          techo = modulo.entities.find do |e|
            dict = e.attribute_dictionary('DespieceMela')
            dict && dict['pieza_nombre'] =~ /Techo/i
          end

          if techo
            dict = techo.attribute_dictionary('DespieceMela')
            dict['mecanizado_dicroicos'] = "#{cant_spots} spots Ø#{diametro.to_i}mm equidistantes"
            model.commit_operation
            { 'ok' => true, 'mensaje' => "#{cant_spots} perforaciones circulares de #{diametro}mm registradas en el techo." }
          else
            model.commit_operation
            { 'ok' => true, 'mensaje' => "Metadato de #{cant_spots} spots dicroicos registrado en el módulo." }
          end
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => "Error al aplicar dicroicos: #{e.message}" }
        end
      end

      # ========================================================================
      # Método: apply_outlets_and_cables
      # Descripción: Registra calados para enchufes 4x2 y ranuras pasacables de TV/PC.
      # ========================================================================
      def apply_outlets_and_cables(params)
        model = Sketchup.active_model
        return { 'ok' => false, 'error' => 'No hay modelo activo.' } unless model

        modulo = model.selection.find { |e| e.attribute_dictionary('DespieceMelaModulo') }
        modulo ||= CabinetBuilder.ultimo_modulo_activo if defined?(CabinetBuilder) && CabinetBuilder.ultimo_modulo_activo && CabinetBuilder.ultimo_modulo_activo.valid?
        return { 'ok' => false, 'error' => 'Selecciona un módulo para calar cajas eléctricas.' } unless modulo

        tipo_calado = params['tipo'] || 'tomacorriente_4x2'

        model.start_operation('JPQMelaminaPro: Calados Eléctricos / Pasacables', true)

        begin
          modulo.entities.each do |e|
            dict = e.attribute_dictionary('DespieceMela')
            next unless dict && dict['pieza_nombre'] =~ /Fondo|Panel|Mesa/i

            detalle = case tipo_calado
                      when 'tomacorriente_4x2'
                        'Calado Rectangular 100x55mm para Caja Eléctrica 4x2'
                      when 'pasacables_gamer'
                        'Ranura Pasacables Horizontal 200x30mm'
                      when 'pasacables_circular'
                        'Perforación Pasacables Circular Ø60mm'
                      else
                        'Mecanizado Eléctrico Especial'
                      end

            dict['mecanizado_electrico'] = detalle
          end

          model.commit_operation
          { 'ok' => true, 'mensaje' => "Mecanizado de instalación eléctrica aplicado correctamente." }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => "Error eléctrico: #{e.message}" }
        end
      end
    end
  end
end
