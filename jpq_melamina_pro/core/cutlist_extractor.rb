# ==============================================================================
# Archivo: jpq_melamina_pro/core/cutlist_extractor.rb
# Descripción: Extractor y consolidador de la lista oficial de despiece industrial.
#              Recorre el modelo 3D en profundidad y clasifica las piezas por:
#              - Tipo de Material y Espesor (Melamina Estándar vs Melamina RH, MDF Fondos)
#              - Medidas Brutas vs Medidas Netas (descontando milímetros de tapacantos)
#              - Indicador de Ranurado "R" a 18mm del borde
#              - Mecanizados (Minifix, tiras LED, cazoletas de bisagra)
#              - Cálculo de Peso Total (kg) y cubicación de insumos (tornillos y anclajes)
# ==============================================================================

require 'sketchup.rb'
require 'json'

module JPQMelaminaPro
  class CutlistExtractor
    class << self
      # ========================================================================
      # Método: extract
      # Descripción: Extrae y estructura todas las piezas del modelo o selección activa.
      # Parámetros:
      #   - opciones (Hash): {'solo_seleccion' => false, 'agrupar_identicas' => true}
      # ========================================================================
      def extract(opciones = {})
        model = Sketchup.active_model
        return { 'piezas' => [], 'metricas' => metricas_vacias } unless model

        sel = model.selection
        solo_sel = opciones['solo_seleccion'] == true && !sel.empty?
        raices = solo_sel ? sel.to_a : model.entities.to_a

        piezas_crudas = []
        raices.each do |ent|
          recolectar_piezas(ent, piezas_crudas)
        end

        return { 'piezas' => [], 'metricas' => metricas_vacias } if piezas_crudas.empty?

        piezas_finales = consolidar_piezas(piezas_crudas)
        metricas = calcular_metricas(piezas_finales)

        {
          'ok' => true,
          'piezas' => piezas_finales,
          'metricas' => metricas,
          'fecha' => Time.now.strftime('%Y-%m-%d %H:%M:%S'),
          'modelo' => model.title.empty? ? 'Proyecto Carpintería JPQ' : model.title
        }
      end

      private

      # ========================================================================
      # Sub-método: recolectar_piezas
      # Descripción: Recorre el árbol de componentes y lee metadatos DespieceMela.
      # ========================================================================
      def recolectar_piezas(ent, acumulador)
        if ent.is_a?(Sketchup::Group) || ent.is_a?(Sketchup::ComponentInstance)
          dict = ent.attribute_dictionary('DespieceMela')
          if dict
            largo_b = dict['largo_bruto_mm'].to_f
            ancho_b = dict['ancho_bruto_mm'].to_f
            espesor = dict['espesor_mm'].to_f

            c_l1 = (dict['canto_L1'] || 0.0).to_f
            c_l2 = (dict['canto_L2'] || 0.0).to_f
            c_a1 = (dict['canto_A1'] || 0.0).to_f
            c_a2 = (dict['canto_A2'] || 0.0).to_f

            # Cálculo de medida neta exacta de corte descontando los cantos
            largo_n = dict['largo_neto_mm'] ? dict['largo_neto_mm'].to_f : (largo_b - c_l1 - c_l2)
            ancho_n = dict['ancho_neto_mm'] ? dict['ancho_neto_mm'].to_f : (ancho_b - c_a1 - c_a2)

            # Clasificación de ranura técnica para taller
            ranura_str = dict['ranura'] || 'Ninguna'
            ranura_str = 'R (18mm)' if ranura_str =~ /Ranura/i && !(ranura_str =~ /Ninguna/i)

            pieza = {
              'id'             => dict['pieza_id'] || "PZA-#{ent.entityID}",
              'etiqueta'       => dict['numero_etiqueta'] || '',
              'modulo_id'      => dict['modulo_id'] || '',
              'nombre'         => dict['pieza_nombre'] || ent.name,
              'material'       => dict['material'] || 'Pelikano Blanco 18mm',
              'resistencia'    => dict['resistencia'] || (dict['material'].to_s =~ /RH/i ? 'RH' : 'Normal'),
              'espesor'        => espesor > 0 ? espesor : 18.0,
              'largo_bruto'    => largo_b.round(1),
              'ancho_bruto'    => ancho_b.round(1),
              'largo_neto'     => largo_n.round(1),
              'ancho_neto'     => ancho_n.round(1),
              'cantidad'       => (dict['cantidad'] || 1).to_i,
              'veta'           => dict['veta'] || 'longitudinal',
              'canto_L1'       => c_l1,
              'canto_L2'       => c_l2,
              'canto_A1'       => c_a1,
              'canto_A2'       => c_a2,
              'ranura'         => ranura_str,
              'mecanizados'    => dict['mecanizados'] || '[]',
              'mecanizado_led' => dict['mecanizado_led'] || '',
              'entity_id'      => ent.entityID
            }
            acumulador << pieza
          end

          if ent.respond_to?(:entities)
            ent.entities.each { |child| recolectar_piezas(child, acumulador) }
          end
        end
      end

      # ========================================================================
      # Sub-método: consolidar_piezas
      # Descripción: Agrupa piezas idénticas sumando sus cantidades.
      # ========================================================================
      def consolidar_piezas(piezas)
        grupos = Hash.new { |h, k| h[k] = [] }

        piezas.each do |p|
          clave = [
            p['nombre'], p['material'], p['espesor'],
            p['largo_neto'], p['ancho_neto'], p['veta'],
            p['canto_L1'], p['canto_L2'], p['canto_A1'], p['canto_A2'],
            p['ranura']
          ].join('__')
          grupos[clave] << p
        end

        piezas_consolidadas = []
        grupos.each do |_k, items|
          p_base = items.first.dup
          p_base['cantidad'] = items.sum { |i| i['cantidad'] }
          piezas_consolidadas << p_base
        end

        piezas_consolidadas.sort_by { |p| [p['material'], -p['espesor'], -p['largo_neto']] }
      end

      # ========================================================================
      # Sub-método: calcular_metricas
      # Descripción: Computa superficie m², metros lineales de cantos,
      #              peso total estimado en kg y cálculo de tornillería / anclajes.
      # ========================================================================
      def calcular_metricas(piezas)
        total_piezas = 0
        area_m2_melamina_18 = 0.0
        area_m2_melamina_rh = 0.0
        area_m2_mdf = 0.0
        metros_canto_delgado = 0.0
        metros_canto_grueso  = 0.0

        piezas.each do |p|
          cant = p['cantidad']
          total_piezas += cant

          # Área neta en m²
          area_pieza_m2 = (p['largo_neto'] * p['ancho_neto'] / 1_000_000.0) * cant

          if p['espesor'] <= 5.5
            area_m2_mdf += area_pieza_m2
          elsif p['resistencia'] == 'RH'
            area_m2_melamina_rh += area_pieza_m2
          else
            area_m2_melamina_18 += area_pieza_m2
          end

          # Metros lineales de tapacantos
          largo_m = (p['largo_neto'] / 1000.0) * cant
          ancho_m = (p['ancho_neto'] / 1000.0) * cant

          [p['canto_L1'], p['canto_L2']].each do |c|
            if c >= 1.5
              metros_canto_grueso += largo_m
            elsif c > 0.0
              metros_canto_delgado += largo_m
            end
          end

          [p['canto_A1'], p['canto_A2']].each do |c|
            if c >= 1.5
              metros_canto_grueso += ancho_m
            elsif c > 0.0
              metros_canto_delgado += ancho_m
            end
          end
        end

        # PESO TOTAL: Melamina 18mm = 12.5 kg/m² | MDF 3mm = 2.5 kg/m²
        peso_total_kg = ((area_m2_melamina_18 + area_m2_melamina_rh) * 12.5) + (area_m2_mdf * 2.5)

        # RECOMENDACIÓN DE FIJACIONES A MURO
        chazos_sugeridos = [((peso_total_kg / 20.0).ceil * 2), 4].max
        tornillos_soberbios = (total_piezas * 4).round
        tornillos_correderas = (total_piezas * 2).round

        {
          'total_piezas'         => total_piezas,
          'area_total_m2'        => (area_m2_melamina_18 + area_m2_melamina_rh + area_m2_mdf).round(2),
          'area_melamina_std_m2' => area_m2_melamina_18.round(2),
          'area_melamina_rh_m2'  => area_m2_melamina_rh.round(2),
          'area_mdf_m2'          => area_m2_mdf.round(2),
          'canto_delgado_m'      => metros_canto_delgado.round(1),
          'canto_grueso_m'       => metros_canto_grueso.round(1),
          'peso_total_kg'        => peso_total_kg.round(1),
          'anclajes_muro_sugeridos' => "#{chazos_sugeridos} anclajes de expansión 3/8\"",
          'tornillos_soberbios_est' => "#{tornillos_soberbios} tornillos 4x50mm",
          'tornillos_bisagras_est'  => "#{tornillos_correderas} tornillos 3.5x15mm"
        }
      end

      # ========================================================================
      # Sub-método: metricas_vacias
      # ========================================================================
      def metricas_vacias
        {
          'total_piezas' => 0, 'area_total_m2' => 0.0, 'area_melamina_std_m2' => 0.0,
          'area_melamina_rh_m2' => 0.0, 'area_mdf_m2' => 0.0, 'canto_delgado_m' => 0.0,
          'canto_grueso_m' => 0.0, 'peso_total_kg' => 0.0,
          'anclajes_muro_sugeridos' => '4 anclajes 3/8"',
          'tornillos_soberbios_est' => '0 tornillos',
          'tornillos_bisagras_est' => '0 tornillos'
        }
      end
    end
  end
end
