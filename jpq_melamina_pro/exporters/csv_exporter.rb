# ==============================================================================
# Archivo: mela_studio_clone/exporters/csv_exporter.rb
# Descripción: Generador y exportador de archivos CSV formateados para centros de
#              corte industriales (Pelíkano, Masisa, Sodimac, Promart y formato estándar).
# ==============================================================================

require 'csv'
require 'sketchup.rb'

module JPQMelaminaPro
  class CsvExporter
    class << self
      # ========================================================================
      # Método: export
      # Descripción: Genera y guarda un archivo CSV listo para taller o centro de corte.
      # Parámetros:
      #   - params (Hash):
      #       'formato' ('estandar' | 'pelikano' | 'masisa' | 'sodimac'),
      #       'separador' (',' | ';'),
      #       'ruta_archivo' (String, opcional)
      # ========================================================================
      def export(params)
        formato   = params['formato'] || 'estandar'
        separador = params['separador'] || ';'

        # Extraer el despiece consolidado actual
        extraccion = CutlistExtractor.extract
        piezas = extraccion['piezas']
        metricas = extraccion['metricas']

        return nil if piezas.empty?

        # Solicitar ruta al usuario si no se suministró
        ruta_salida = params['ruta_archivo']
        unless ruta_salida && !ruta_salida.empty?
          ruta_defecto = File.join(Dir.home, "Despiece_#{Time.now.strftime('%Y%m%d_%H%M%S')}.csv")
          ruta_salida = UI.savepanel('Guardar Lista de Despiece CSV', Dir.home, File.basename(ruta_defecto))
        end

        return nil unless ruta_salida

        # Construcción del archivo CSV según el formato elegido
        CSV.open(ruta_salida, 'wb', col_sep: separador, encoding: 'UTF-8') do |csv|
          # Encabezado informativo del proyecto
          csv << ["JPQMelaminaPro - Lista de Despiece y Centro de Corte"]
          csv << ["Proyecto:", extraccion['modelo'], "Fecha:", extraccion['fecha']]
          csv << ["Total Piezas:", metricas['total_piezas'], "Total Superficie m2:", metricas['area_total_m2']]
          csv << ["Canto Delgado (m):", metricas['canto_delgado_metros'], "Canto Grueso (m):", metricas['canto_grueso_metros']]
          csv << [] # Línea en blanco

          # Encabezados de columnas comerciales
          case formato
          when 'pelikano', 'masisa'
            csv << [
              'ITEM', 'DESCRIPCION', 'CANTIDAD', 'LARGO NETO (mm)', 'ANCHO NETO (mm)',
              'ESPESOR (mm)', 'MATERIAL', 'VETA', 'CANTO L1', 'CANTO L2', 'CANTO A1', 'CANTO A2', 'RANURA / SERVICIO'
            ]
          when 'sodimac'
            csv << [
              'NRO', 'PIEZA', 'CANT', 'LARGO CORTE', 'ANCHO CORTE',
              'ESP', 'TABLERO', 'GIRO', 'CANTO 1', 'CANTO 2', 'CANTO 3', 'CANTO 4', 'OBSERVACIONES'
            ]
          else
            # Formato estándar de taller completo
            csv << [
              'Item', 'Pieza', 'Cantidad', 'Largo Bruto (mm)', 'Ancho Bruto (mm)',
              'Largo Neto (mm)', 'Ancho Neto (mm)', 'Espesor (mm)', 'Material',
              'Veta', 'Canto L1 (mm)', 'Canto L2 (mm)', 'Canto A1 (mm)', 'Canto A2 (mm)',
              'Ranura', 'Detalle Piezas'
            ]
          end

          # Filas de piezas
          piezas.each do |p|
            veta_txt = case p['veta']
            when 'longitudinal' then 'A lo Largo'
            when 'transversal'  then 'A lo Ancho'
            else 'Libre / Puede Girar'
            end

            canto_format = lambda { |val| val > 0 ? "#{val}mm" : '-' }

            if formato == 'sodimac'
              csv << [
                p['item_numero'],
                p['nombre'],
                p['cantidad'],
                p['largo_neto'],
                p['ancho_neto'],
                p['espesor'],
                p['material'],
                p['veta'] == 'libre' ? 'SI' : 'NO',
                canto_format.call(p['canto_L1']),
                canto_format.call(p['canto_L2']),
                canto_format.call(p['canto_A1']),
                canto_format.call(p['canto_A2']),
                p['ranura']
              ]
            else
              csv << [
                p['item_numero'],
                p['nombre'],
                p['cantidad'],
                p['largo_bruto'],
                p['ancho_bruto'],
                p['largo_neto'],
                p['ancho_neto'],
                p['espesor'],
                p['material'],
                veta_txt,
                canto_format.call(p['canto_L1']),
                canto_format.call(p['canto_L2']),
                canto_format.call(p['canto_A1']),
                canto_format.call(p['canto_A2']),
                p['ranura'],
                p['detalle_piezas']
              ]
            end
          end
        end

        UI.messagebox("Archivo CSV exportado exitosamente en:\n#{ruta_salida}") if defined?(UI)
        ruta_salida
      end
    end
  end
end
