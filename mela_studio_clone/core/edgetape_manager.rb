# ==============================================================================
# Archivo: mela_studio_clone/core/edgetape_manager.rb
# Descripción: Motor de asignación de tapacantos y cálculo de medida neta de corte.
#              Descuenta milimétricamente el grosor de los cantos (0.45, 1, 2 o 3 mm)
#              en cada una de las 4 aristas (L1, L2, A1, A2).
# ==============================================================================

require 'sketchup.rb'

module MelaStudioClone
  class EdgetapeManager
    class << self
      # ========================================================================
      # Método: apply
      # Descripción: Asigna cantos a la pieza seleccionada o a todo el módulo.
      # Parámetros:
      #   - params (Hash):
      #       'canto_L1' (Float), 'canto_L2' (Float),
      #       'canto_A1' (Float), 'canto_A2' (Float),
      #       'aplicar_a' ('seleccion' | 'modulo_completo')
      # ========================================================================
      def apply(params)
        model = Sketchup.active_model
        sel = model.selection
        return { 'ok' => false, 'error' => 'Selecciona una pieza o un módulo.' } if sel.empty?

        cL1 = (params['canto_L1'] || 0.0).to_f
        cL2 = (params['canto_L2'] || 0.0).to_f
        cA1 = (params['canto_A1'] || 0.0).to_f
        cA2 = (params['canto_A2'] || 0.0).to_f

        aplicar_a = params['aplicar_a'] || 'seleccion'

        model.start_operation('MelaStudio: Aplicar Tapacantos', true)

        begin
          piezas_actualizadas = 0

          entidades = if aplicar_a == 'modulo_completo'
            modulo = sel.find { |e| e.attribute_dictionary('DespieceMelaModulo') }
            modulo ? modulo.entities.to_a : sel.to_a
          else
            sel.to_a
          end

          entidades.each do |ent|
            # Buscar diccionario DespieceMela recursivamente
            procesar_pieza(ent, cL1, cL2, cA1, cA2) do
              piezas_actualizadas += 1
            end
          end

          model.commit_operation
          { 'ok' => true, 'mensaje' => "Tapacantos aplicados a #{piezas_actualizadas} piezas. Medidas netas recalculadas." }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => e.message }
        end
      end

      # ========================================================================
      # Método: procesar_pieza
      # Descripción: Actualiza los atributos del diccionario de despiece y recalcula
      #              la medida neta de corte de la pieza.
      # ========================================================================
      def procesar_pieza(ent, cL1, cL2, cA1, cA2, &block)
        if ent.is_a?(Sketchup::Group) || ent.is_a?(Sketchup::ComponentInstance)
          dict = ent.attribute_dictionary('DespieceMela')
          if dict
            l_bruto = dict['largo_bruto_mm'].to_f
            a_bruto = dict['ancho_bruto_mm'].to_f

            # FÓRMULA DE TALLER: Descuento de cantos para obtener la medida neta del tablero
            l_neto = l_bruto - (cL1 + cL2)
            a_neto = a_bruto - (cA1 + cA2)

            dict['canto_L1']      = cL1
            dict['canto_L2']      = cL2
            dict['canto_A1']      = cA1
            dict['canto_A2']      = cA2
            dict['largo_neto_mm'] = l_neto.round(2)
            dict['ancho_neto_mm'] = a_neto.round(2)

            yield if block_given?
          else
            # Explorar subentidades si es un contenedor
            ent.entities.each { |child| procesar_pieza(child, cL1, cL2, cA1, cA2, &block) } if ent.respond_to?(:entities)
          end
        end
      end
    end
  end
end
