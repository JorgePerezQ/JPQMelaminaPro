# ==============================================================================
# Archivo: mela_studio_clone/exporters/excel_exporter.rb
# Descripción: Generador de reportes de taller en formato compatible con Excel
#              (XML Spreadsheet 2003) con estilos visuales, colores de encabezado,
#              fórmulas de totales y tablas estructuradas de despiece.
# ==============================================================================

require 'sketchup.rb'

module MelaStudioClone
  class ExcelExporter
    class << self
      # ========================================================================
      # Método: export
      # Descripción: Genera y guarda una hoja de cálculo formateada (.xml / .xls).
      # Parámetros:
      #   - params (Hash): {'ruta_archivo' => String}
      # Retorno:
      #   - String: Ruta del archivo generado.
      # ========================================================================
      def export(params = {})
        extraccion = CutlistExtractor.extract
        piezas = extraccion['piezas']
        metricas = extraccion['metricas']

        return nil if piezas.empty?

        ruta_salida = params['ruta_archivo']
        unless ruta_salida && !ruta_salida.empty?
          ruta_defecto = File.join(Dir.home, "Hoja_Despiece_#{Time.now.strftime('%Y%m%d_%H%M%S')}.xls")
          ruta_salida = UI.savepanel('Guardar Reporte Excel de Taller', Dir.home, File.basename(ruta_defecto))
        end

        return nil unless ruta_salida

        # Generación de XML Spreadsheet 2003 nativo (abrible en Excel sin librerías externas)
        xml_content = construir_xml_excel(extraccion, piezas, metricas)

        File.open(ruta_salida, 'w:UTF-8') do |f|
          f.write(xml_content)
        end

        UI.messagebox("Reporte Excel generado con éxito:\n#{ruta_salida}") if defined?(UI)
        ruta_salida
      end

      private

      # ========================================================================
      # Método: construir_xml_excel
      # Descripción: Estructura el documento XML con hojas, estilos y filas de datos.
      # ========================================================================
      def construir_xml_excel(extraccion, piezas, metricas)
        <<~XML
          <?xml version="1.0" encoding="UTF-8"?>
          <?mso-application progid="Excel.Sheet"?>
          <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
           xmlns:o="urn:schemas-microsoft-com:office:office"
           xmlns:x="urn:schemas-microsoft-com:office:excel"
           xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
           xmlns:html="http://www.w3.org/TR/REC-html40">
           <Styles>
            <Style ss:ID="Default" ss:Name="Normal">
             <Alignment ss:Vertical="Center"/>
             <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
            </Style>
            <Style ss:ID="Titulo">
             <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#1E3A8A"/>
             <Alignment ss:Vertical="Center"/>
            </Style>
            <Style ss:ID="Subtitulo">
             <Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#475569"/>
            </Style>
            <Style ss:ID="HeaderTabla">
             <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
             <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>
             <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
             <Borders>
              <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
             </Borders>
            </Style>
            <Style ss:ID="DatoCentro">
             <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
             <Borders>
              <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
             </Borders>
            </Style>
            <Style ss:ID="DatoNumero">
             <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
             <NumberFormat ss:Format="#,##0.0"/>
             <Borders>
              <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
             </Borders>
            </Style>
            <Style ss:ID="ResumenHeader">
             <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1E293B"/>
             <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
            </Style>
           </Styles>
           <Worksheet ss:Name="Lista de Despiece">
            <Table>
             <Column ss:Width="40"/>
             <Column ss:Width="160"/>
             <Column ss:Width="60"/>
             <Column ss:Width="90"/>
             <Column ss:Width="90"/>
             <Column ss:Width="70"/>
             <Column ss:Width="140"/>
             <Column ss:Width="90"/>
             <Column ss:Width="60"/>
             <Column ss:Width="60"/>
             <Column ss:Width="60"/>
             <Column ss:Width="60"/>
             <Column ss:Width="130"/>
             <Row ss:Height="26">
              <Cell ss:MergeAcross="12" ss:StyleID="Titulo"><Data ss:Type="String">MelaStudio PRO - Hoja Oficial de Despiece de Taller</Data></Cell>
             </Row>
             <Row ss:Height="18">
              <Cell ss:MergeAcross="12" ss:StyleID="Subtitulo"><Data ss:Type="String">Proyecto: #{extraccion['modelo']} | Fecha: #{extraccion['fecha']}</Data></Cell>
             </Row>
             <Row ss:Height="10"/>
             <Row ss:Height="22">
              <Cell ss:StyleID="HeaderTabla"><Data ss:Type="String">Item</Data></Cell>
              <Cell ss:StyleID="HeaderTabla"><Data ss:Type="String">Pieza</Data></Cell>
              <Cell ss:StyleID="HeaderTabla"><Data ss:Type="String">Cant.</Data></Cell>
              <Cell ss:StyleID="HeaderTabla"><Data ss:Type="String">Largo Neto</Data></Cell>
              <Cell ss:StyleID="HeaderTabla"><Data ss:Type="String">Ancho Neto</Data></Cell>
              <Cell ss:StyleID="HeaderTabla"><Data ss:Type="String">Espesor</Data></Cell>
              <Cell ss:StyleID="HeaderTabla"><Data ss:Type="String">Material</Data></Cell>
              <Cell ss:StyleID="HeaderTabla"><Data ss:Type="String">Veta</Data></Cell>
              <Cell ss:StyleID="HeaderTabla"><Data ss:Type="String">C. L1</Data></Cell>
              <Cell ss:StyleID="HeaderTabla"><Data ss:Type="String">C. L2</Data></Cell>
              <Cell ss:StyleID="HeaderTabla"><Data ss:Type="String">C. A1</Data></Cell>
              <Cell ss:StyleID="HeaderTabla"><Data ss:Type="String">C. A2</Data></Cell>
              <Cell ss:StyleID="HeaderTabla"><Data ss:Type="String">Ranura</Data></Cell>
             </Row>
             #{filas_piezas_xml(piezas)}
             <Row ss:Height="12"/>
             <Row ss:Height="20">
              <Cell ss:MergeAcross="1" ss:StyleID="ResumenHeader"><Data ss:Type="String">Total Piezas a Fabricar:</Data></Cell>
              <Cell ss:StyleID="DatoCentro"><Data ss:Type="Number">#{metricas['total_piezas']}</Data></Cell>
             </Row>
             <Row ss:Height="20">
              <Cell ss:MergeAcross="1" ss:StyleID="ResumenHeader"><Data ss:Type="String">Total Superficie Neta:</Data></Cell>
              <Cell ss:StyleID="DatoNumero"><Data ss:Type="Number">#{metricas['area_total_m2']}</Data></Cell>
              <Cell><Data ss:Type="String">m²</Data></Cell>
             </Row>
             <Row ss:Height="20">
              <Cell ss:MergeAcross="1" ss:StyleID="ResumenHeader"><Data ss:Type="String">Total Tapacantos Requeridos:</Data></Cell>
              <Cell ss:StyleID="DatoNumero"><Data ss:Type="Number">#{metricas['total_canto_metros']}</Data></Cell>
              <Cell><Data ss:Type="String">metros lineales</Data></Cell>
             </Row>
            </Table>
           </Worksheet>
          </Workbook>
        XML
      end

      # ========================================================================
      # Método: filas_piezas_xml
      # Descripción: Genera las etiquetas <Row> de cada pieza para la tabla.
      # ========================================================================
      def filas_piezas_xml(piezas)
        filas = []
        piezas.each do |p|
          filas << <<~ROW
            <Row ss:Height="19">
             <Cell ss:StyleID="DatoCentro"><Data ss:Type="Number">#{p['item_numero']}</Data></Cell>
             <Cell><Data ss:Type="String">#{p['nombre']}</Data></Cell>
             <Cell ss:StyleID="DatoCentro"><Data ss:Type="Number">#{p['cantidad']}</Data></Cell>
             <Cell ss:StyleID="DatoNumero"><Data ss:Type="Number">#{p['largo_neto']}</Data></Cell>
             <Cell ss:StyleID="DatoNumero"><Data ss:Type="Number">#{p['ancho_neto']}</Data></Cell>
             <Cell ss:StyleID="DatoCentro"><Data ss:Type="Number">#{p['espesor']}</Data></Cell>
             <Cell><Data ss:Type="String">#{p['material']}</Data></Cell>
             <Cell ss:StyleID="DatoCentro"><Data ss:Type="String">#{p['veta']}</Data></Cell>
             <Cell ss:StyleID="DatoCentro"><Data ss:Type="String">#{p['canto_L1'] > 0 ? "#{p['canto_L1']}mm" : '-'}</Data></Cell>
             <Cell ss:StyleID="DatoCentro"><Data ss:Type="String">#{p['canto_L2'] > 0 ? "#{p['canto_L2']}mm" : '-'}</Data></Cell>
             <Cell ss:StyleID="DatoCentro"><Data ss:Type="String">#{p['canto_A1'] > 0 ? "#{p['canto_A1']}mm" : '-'}</Data></Cell>
             <Cell ss:StyleID="DatoCentro"><Data ss:Type="String">#{p['canto_A2'] > 0 ? "#{p['canto_A2']}mm" : '-'}</Data></Cell>
             <Cell><Data ss:Type="String">#{p['ranura']}</Data></Cell>
            </Row>
          ROW
        end
        filas.join("\n")
      end
    end
  end
end
