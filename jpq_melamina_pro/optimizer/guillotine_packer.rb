# ==============================================================================
# Archivo: mela_studio_clone/optimizer/guillotine_packer.rb
# Descripción: Algoritmo real de optimización de corte 2D para tableros de melamina
#              (2D Guillotine Bin Packing con heurística Best Short Side Fit).
#              Respeta el espesor del disco de sierra (kerf), refilado perimetral,
#              sentido obligatorio de la veta y genera diagramas secuenciales de corte.
# ==============================================================================

module JPQMelaminaPro
  class GuillotinePacker
    # Representación de un rectángulo libre dentro de la plancha
    RectanguloLibre = Struct.new(:x, :y, :w, :h)

    class << self
      # ========================================================================
      # Método: pack
      # Descripción: Procesa una lista de piezas y las distribuye en tableros comerciales.
      # Parámetros:
      #   - params (Hash):
      #       'piezas' (Array): Piezas con 'largo_neto', 'ancho_neto', 'cantidad', 'veta', 'nombre'.
      #       'tablero_largo' (Float, ej. 2440.0 mm),
      #       'tablero_ancho' (Float, ej. 2140.0 mm),
      #       'refilado' (Float, ej. 10.0 mm por borde),
      #       'kerf' (Float, ej. 4.0 mm espesor de sierra),
      #       'estrategia_corte' ('longitudinal' | 'transversal')
      # Retorno:
      #   - Hash con los tableros generados, piezas ubicadas, líneas de corte y estadísticas.
      # ========================================================================
      def pack(params)
        piezas_entrada = params['piezas'] || []
        if piezas_entrada.empty?
          # Si no se suministraron en params, extraer directamente del modelo activo
          extraccion = CutlistExtractor.extract
          piezas_entrada = extraccion['piezas']
        end

        return { 'ok' => false, 'error' => 'No hay piezas de carpintería para optimizar.' } if piezas_entrada.empty?

        tab_largo = (params['tablero_largo'] || 2440.0).to_f
        tab_ancho = (params['tablero_ancho'] || 2140.0).to_f
        refilado  = (params['refilado'] || 10.0).to_f
        kerf      = (params['kerf'] || 4.0).to_f
        estrategia = params['estrategia_corte'] || 'longitudinal'

        # Expandir piezas individuales según su cantidad
        piezas_a_ubicar = []
        piezas_entrada.each do |p|
          cant = (p['cantidad'] || 1).to_i
          cant.times do |i|
            piezas_a_ubicar << {
              'id'         => "#{p['id']}-#{i + 1}",
              'nombre'     => p['nombre'] || "Pieza #{p['item_numero']}",
              'w'          => (p['largo_neto'] || p['largo_bruto']).to_f,
              'h'          => (p['ancho_neto'] || p['ancho_bruto']).to_f,
              'material'   => p['material'] || 'Melamina 18mm',
              'veta'       => p['veta'] || 'longitudinal'
            }
          end
        end

        # Ordenar piezas de mayor a menor superficie (First Fit Decreasing Area)
        piezas_a_ubicar.sort_by! { |p| -(p['w'] * p['h']) }

        # Agrupar por material para optimizar planchas de cada tipo por separado
        tableros_totales = []
        por_material = piezas_a_ubicar.group_by { |p| p['material'] }

        por_material.each do |material, piezas_mat|
          tableros_material = optimizar_material(piezas_mat, tab_largo, tab_ancho, refilado, kerf, estrategia, material)
          tableros_totales.concat(tableros_material)
        end

        # Resumen general de aprovechamiento
        superficie_utilizada = 0.0
        superficie_bruta_total = tableros_totales.size * (tab_largo * tab_ancho / 1_000_000.0)

        tableros_totales.each do |t|
          superficie_utilizada += t['area_piezas_m2']
        end

        desperdicio_pct = superficie_bruta_total > 0 ? (((superficie_bruta_total - superficie_utilizada) / superficie_bruta_total) * 100.0).round(1) : 0.0

        {
          'ok' => true,
          'total_tableros'        => tableros_totales.size,
          'superficie_total_m2'   => superficie_bruta_total.round(2),
          'superficie_util_m2'    => superficie_utilizada.round(2),
          'desperdicio_total_pct' => desperdicio_pct,
          'tableros'              => tableros_totales
        }
      end

      private

      # ========================================================================
      # Método: optimizar_material
      # Descripción: Empaqueta las piezas de un material específico en tableros guillotina.
      # ========================================================================
      def optimizar_material(piezas, tab_largo, tab_ancho, refilado, kerf, estrategia, material)
        tableros = []
        piezas_pendientes = piezas.dup

        ancho_util = tab_largo - (2 * refilado)
        alto_util  = tab_ancho - (2 * refilado)

        while !piezas_pendientes.empty?
          tablero_index = tableros.size + 1
          rectangulos_libres = [RectanguloLibre.new(refilado, refilado, ancho_util, alto_util)]
          piezas_ubicadas = []
          piezas_no_cupieron = []
          orden_corte = 0

          piezas_pendientes.each do |pieza|
            mejor_rect_idx = nil
            mejor_sobrante_lado = Float::INFINITY
            mejor_rotacion = false

            # Evaluar si la pieza cabe normal o rotada en alguno de los rectángulos libres
            rectangulos_libres.each_with_index do |rect, idx|
              # 1. Orientación normal
              if pieza['w'] <= rect.w && pieza['h'] <= rect.h
                sobrante_min = [rect.w - pieza['w'], rect.h - pieza['h']].min
                if sobrante_min < mejor_sobrante_lado
                  mejor_sobrante_lado = sobrante_min
                  mejor_rect_idx = idx
                  mejor_rotacion = false
                end
              end

              # 2. Orientación rotada (solo permitida si veta == 'libre')
              if pieza['veta'] == 'libre' && pieza['h'] <= rect.w && pieza['w'] <= rect.h
                sobrante_min = [rect.w - pieza['h'], rect.h - pieza['w']].min
                if sobrante_min < mejor_sobrante_lado
                  mejor_sobrante_lado = sobrante_min
                  mejor_rect_idx = idx
                  mejor_rotacion = true
                end
              end
            end

            if mejor_rect_idx
              # Ubicar la pieza en el mejor rectángulo libre encontrado
              rect_elegido = rectangulos_libres.delete_at(mejor_rect_idx)
              ancho_p = mejor_rotacion ? pieza['h'] : pieza['w']
              alto_p  = mejor_rotacion ? pieza['w'] : pieza['h']

              orden_corte += 1
              piezas_ubicadas << {
                'id'          => pieza['id'],
                'nombre'      => pieza['nombre'],
                'x'           => rect_elegido.x.round(1),
                'y'           => rect_elegido.y.round(1),
                'w'           => ancho_p.round(1),
                'h'           => alto_p.round(1),
                'rotada'      => mejor_rotacion,
                'orden_corte' => orden_corte
              }

              # REGLA DE CORTE DE GUILLOTINA:
              # Dividir el espacio sobrante en dos nuevos rectángulos limpios usando kerf
              dividir_rectangulo_guillotina(rect_elegido, ancho_p, alto_p, kerf, estrategia, rectangulos_libres)
            else
              piezas_no_cupieron << pieza
            end
          end

          area_piezas_m2 = piezas_ubicadas.sum { |p| (p['w'] * p['h']) / 1_000_000.0 }
          area_tablero_m2 = (tab_largo * tab_ancho) / 1_000_000.0
          aprovechamiento = ((area_piezas_m2 / area_tablero_m2) * 100.0).round(1)

          tableros << {
            'numero'          => tablero_index,
            'material'        => material,
            'largo'           => tab_largo,
            'ancho'           => tab_ancho,
            'refilado'        => refilado,
            'kerf'            => kerf,
            'piezas'          => piezas_ubicadas,
            'area_piezas_m2'  => area_piezas_m2.round(2),
            'aprovechamiento' => aprovechamiento,
            'desperdicio_pct' => (100.0 - aprovechamiento).round(1)
          }

          # Si ninguna pieza pudo entrar en una plancha nueva vacía, detenerse para evitar bucle infinito
          if piezas_ubicadas.empty?
            puts "[JPQMelaminaPro] Advertencia: La pieza '#{piezas_pendientes.first['nombre']}' excede las dimensiones del tablero útil."
            break
          end

          piezas_pendientes = piezas_no_cupieron
        end

        tableros
      end

      # ========================================================================
      # Método: dividir_rectangulo_guillotina
      # Descripción: Corta el rectángulo restante de lado a lado (Guillotine cut)
      #              según la estrategia longitudinal o transversal considerando el kerf.
      # ========================================================================
      def dividir_rectangulo_guillotina(rect, w, h, kerf, estrategia, rectangulos)
        sobrante_x = rect.w - w - kerf
        sobrante_y = rect.h - h - kerf

        if estrategia == 'longitudinal'
          # Primero corte longitudinal (rasgar a lo largo en X)
          if sobrante_y > 0
            rectangulos << RectanguloLibre.new(rect.x, rect.y + h + kerf, rect.w, sobrante_y)
          end
          if sobrante_x > 0
            rectangulos << RectanguloLibre.new(rect.x + w + kerf, rect.y, sobrante_x, h)
          end
        else
          # Primero corte transversal (a lo alto en Y)
          if sobrante_x > 0
            rectangulos << RectanguloLibre.new(rect.x + w + kerf, rect.y, sobrante_x, rect.h)
          end
          if sobrante_y > 0
            rectangulos << RectanguloLibre.new(rect.x, rect.y + h + kerf, w, sobrante_y)
          end
        end

        # Filtrar rectángulos demasiado pequeños para ser útiles (menores a 50x50 mm)
        rectangulos.reject! { |r| r.w < 50.0 || r.h < 50.0 }
      end
    end
  end
end
