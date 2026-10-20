# ==============================================================================
# Archivo: mela_studio_clone/core/cutlist_extractor.rb
# Descripción: Extractor y consolidador de la lista completa de despiece.
#              Recorre el modelo 3D, agrupa piezas idénticas y calcula métricas
#              financieras y de taller (metros lineales de tapacantos por espesor,
#              área neta de tableros y total de piezas).
# ==============================================================================

require 'sketchup.rb'

module JPQMelaminaPro
  class CutlistExtractor
    class << self
      # ========================================================================
      # Método: extract
      # Descripción: Extrae todas las piezas de carpintería del modelo activo
      #              o de la selección actual.
      # Parámetros:
      #   - opciones (Hash): {'solo_seleccion' => false, 'agrupar_identicas' => true}
      # Retorno:
      #   - Hash con la lista detallada de piezas y el resumen de métricas.
      # ========================================================================
      def extract(opciones = {})
        model = Sketchup.active_model
        sel = model.selection

        solo_sel = opciones['solo_seleccion'] == true && !sel.empty?
        raices = solo_sel ? sel.to_a : model.entities.to_a

        piezas_crudas = []
        raices.each do |ent|
          recolectar_piezas(ent, piezas_crudas)
        end

        return { 'piezas' => [], 'metricas' => metricas_vacias } if piezas_crudas.empty?

        # Agrupación o consolidación opcional de piezas idénticas
        piezas_finales = consolidar_piezas(piezas_crudas)

        # Cálculo de métricas globales (metros de cantos, área total m2, etc.)
        metricas = calcular_metricas(piezas_finales)

        {
          'ok' => true,
          'piezas' => piezas_finales,
          'metricas' => metricas,
          'fecha' => Time.now.strftime('%Y-%m-%d %H:%M:%S'),
          'modelo' => model.title.empty? ? 'Proyecto Sin Título' : model.title
        }
      end

      private

      # ========================================================================
      # Método: recolectar_piezas
      # Descripción: Escanea entidades en profundidad buscando metadatos DespieceMela.
      # ========================================================================
      def recolectar_piezas(ent, acumulador)
        if ent.is_a?(Sketchup::Group) || ent.is_a?(Sketchup::ComponentInstance)
          dict = ent.attribute_dictionary('DespieceMela')
          if dict
            largo_b = dict['largo_bruto_mm'].to_f
            ancho_b = dict['ancho_bruto_mm'].to_f
            largo_n = dict['largo_neto_mm'] ? dict['largo_neto_mm'].to_f : largo_b
            ancho_n = dict['ancho_neto_mm'] ? dict['ancho_neto_mm'].to_f : ancho_b

            pieza = {
              'id'             => dict['pieza_id'] || "PZA-#{ent.entityID}",
              'etiqueta'       => dict['numero_etiqueta'] || '',
              'modulo_id'      => dict['modulo_id'] || '',
              'nombre'         => dict['pieza_nombre'] || ent.name,
              'material'       => dict['material'] || 'Melamina 18mm',
              'espesor'        => dict['espesor_mm'].to_f,
              'largo_bruto'    => largo_b,
              'ancho_bruto'    => ancho_b,
              'largo_neto'     => largo_n,
              'ancho_neto'     => ancho_n,
              'cantidad'       => (dict['cantidad'] || 1).to_i,
              'veta'           => dict['veta'] || 'longitudinal',
              'canto_L1'       => (dict['canto_L1'] || 0.0).to_f,
              'canto_L2'       => (dict['canto_L2'] || 0.0).to_f,
              'canto_A1'       => (dict['canto_A1'] || 0.0).to_f,
              'canto_A2'       => (dict['canto_A2'] || 0.0).to_f,
              'ranura'         => dict['ranura'] || 'Ninguna',
              'mecanizados'    => dict['mecanizados'] || '[]',
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
      # Método: consolidar_piezas
      # Descripción: Agrupa piezas con dimensiones, espesor, material, veta y cantos idénticos.
      # ========================================================================
      def consolidar_piezas(piezas)
        grupos = {}

        piezas.each do |p|
          clave = [
            p['material'], p['espesor'], p['largo_neto'], p['ancho_neto'],
            p['veta'], p['canto_L1'], p['canto_L2'], p['canto_A1'], p['canto_A2'],
            p['ranura']
          ].join('|')

          if grupos[clave]
            grupos[clave]['cantidad'] += p['cantidad']
            grupos[clave]['nombres_incluidos'] << p['nombre'] unless grupos[clave]['nombres_incluidos'].include?(p['nombre'])
          else
            item = p.dup
            item['nombres_incluidos'] = [p['nombre']]
            grupos[clave] = item
          end
        end

        # Asignar índice y consolidar nombres
        lista = []
        grupos.values.each_with_index do |item, idx|
          item['item_numero'] = idx + 1
          item['detalle_piezas'] = item['nombres_incluidos'].join(', ')
          lista << item
        end
        lista
      end

      # ========================================================================
      # Método: calcular_metricas
      # Descripción: Calcula metros lineales de tapacanto por tipo y superficie total.
      # ========================================================================
      def calcular_metricas(piezas)
        total_piezas = 0
        metros_canto_delgado = 0.0
        metros_canto_medio   = 0.0
        metros_canto_grueso  = 0.0
        metros_ranura        = 0.0
        area_por_material    = {}

        piezas.each do |p|
          cant = p['cantidad']
          total_piezas += cant

          largo_m = p['largo_bruto'] / 1000.0
          ancho_m = p['ancho_bruto'] / 1000.0
          area_m2 = largo_m * ancho_m * cant

          # Sumar área por tipo de material
          mat = p['material']
          area_por_material[mat] = (area_por_material[mat] || 0.0) + area_m2

          # Sumar metros lineales de tapacantos
          sumar_canto = lambda do |espesor_canto, longitud_m|
            if espesor_canto > 0.0 && espesor_canto <= 0.6
              metros_canto_delgado += (longitud_m * cant)
            elsif espesor_canto > 0.6 && espesor_canto <= 1.5
              metros_canto_medio += (longitud_m * cant)
            elsif espesor_canto > 1.5
              metros_canto_grueso += (longitud_m * cant)
            end
          end

          sumar_canto.call(p['canto_L1'], largo_m)
          sumar_canto.call(p['canto_L2'], largo_m)
          sumar_canto.call(p['canto_A1'], ancho_m)
          sumar_canto.call(p['canto_A2'], ancho_m)

          # Ranuras
          if p['ranura'] && p['ranura'] != 'Ninguna'
            metros_ranura += (largo_m * cant)
          end
        end

        area_total = area_por_material.values.sum

        {
          'total_piezas'         => total_piezas,
          'area_total_m2'        => area_total.round(2),
          'area_por_material'    => area_por_material.transform_values { |v| v.round(2) },
          'canto_delgado_metros' => metros_canto_delgado.round(2),
          'canto_medio_metros'   => metros_canto_medio.round(2),
          'canto_grueso_metros'  => metros_canto_grueso.round(2),
          'total_canto_metros'   => (metros_canto_delgado + metros_canto_medio + metros_canto_grueso).round(2),
          'metros_ranura'        => metros_ranura.round(2)
        }
      end

      # ========================================================================
      # Método: metricas_vacias
      # Descripción: Retorna un esquema de métricas en cero si no hay piezas.
      # ========================================================================
      def metricas_vacias
        {
          'total_piezas' => 0, 'area_total_m2' => 0.0,
          'area_por_material' => {}, 'canto_delgado_metros' => 0.0,
          'canto_medio_metros' => 0.0, 'canto_grueso_metros' => 0.0,
          'total_canto_metros' => 0.0, 'metros_ranura' => 0.0
        }
      end
    end
  end
end
