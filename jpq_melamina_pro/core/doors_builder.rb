# ==============================================================================
# Archivo: mela_studio_clone/core/doors_builder.rb
# Descripción: Generador paramétrico de puertas batientes y frentes de armario.
#              Calcula automáticamente las luces perimetrales (2 a 3 mm),
#              el número de bisagras y las perforaciones para cazoleta de 35 mm.
# ==============================================================================

require 'sketchup.rb'

module JPQMelaminaPro
  class DoorsBuilder
    class << self
      # ========================================================================
      # Método: build
      # Descripción: Inserta una o dos puertas batientes en el módulo seleccionado.
      # Parámetros:
      #   - params (Hash):
      #       'tipo' ('exterior' | 'interior'),
      #       'cantidad_hojas' (1 | 2),
      #       'apertura' ('izquierda' | 'derecha' | 'doble'),
      #       'luz_perimetral' (Float, ej. 2.0 o 3.0 mm),
      #       'espesor' (Float, ej. 18.0 mm)
      # ========================================================================
      def build(params)
        model = Sketchup.active_model
        sel = model.selection

        modulo = sel.find { |e| e.attribute_dictionary('DespieceMelaModulo') }
        return { 'ok' => false, 'error' => 'Selecciona el módulo para agregarle puertas.' } unless modulo

        dict_mod = modulo.attribute_dictionary('DespieceMelaModulo')
        alto_mod   = dict_mod['alto_mm'].to_f.mm
        ancho_mod  = dict_mod['ancho_mm'].to_f.mm
        prof_mod   = dict_mod['prof_mm'].to_f.mm
        t_mod      = dict_mod['espesor_mm'].to_f.mm
        modulo_id  = dict_mod['modulo_id']
        material   = dict_mod['material'] || 'Melamina 18mm'

        tipo_puerta = params['tipo'] || 'exterior' # 'exterior' o 'interior'
        hojas       = (params['cantidad_hojas'] || (params['apertura'] == 'doble' ? 2 : 1)).to_i
        luz_mm      = (params['luz_perimetral'] || (tipo_puerta == 'exterior' ? 2.0 : 3.0)).to_f
        t_p_num     = (params['espesor'] || dict_mod['espesor_mm'].to_f).to_f
        t_puerta    = t_p_num.mm

        model.start_operation('JPQMelaminaPro: Generar Puertas Batientes', true)

        begin
          grupo_puertas = modulo.entities.add_group
          grupo_puertas.name = "Puertas [#{hojas} Hojas - #{tipo_puerta.capitalize}]"

          ancho_int_num = dict_mod['ancho_mm'].to_f - (2 * dict_mod['espesor_mm'].to_f)
          alto_int_num  = dict_mod['alto_mm'].to_f - (2 * dict_mod['espesor_mm'].to_f)

          if tipo_puerta == 'exterior'
            # Puerta sobrepuesta exterior
            alto_p_num = dict_mod['alto_mm'].to_f - (2 * luz_mm)
            if hojas == 1
              ancho_p_num = dict_mod['ancho_mm'].to_f - (2 * luz_mm)
            else
              ancho_p_num = (dict_mod['ancho_mm'].to_f - (2 * luz_mm) - luz_mm) / 2.0
            end
            y_puerta = -t_puerta
            z_puerta = luz_mm.mm
            x_inicio = luz_mm.mm
          else
            # Puerta embutida interior
            alto_p_num = alto_int_num - (2 * luz_mm)
            if hojas == 1
              ancho_p_num = ancho_int_num - (2 * luz_mm)
            else
              ancho_p_num = (ancho_int_num - (3 * luz_mm)) / 2.0
            end
            y_puerta = 0.mm
            z_puerta = t_mod + luz_mm.mm
            x_inicio = t_mod + luz_mm.mm
          end

          # Cantidad recomendada de bisagras según la altura de la hoja
          cant_bisagras = if alto_p_num <= 900
            2
          elsif alto_p_num <= 1600
            3
          else
            4
          end

          hojas.times do |i|
            x_pos = x_inicio + (i * (ancho_p_num + luz_mm).mm)
            nombre_hoja = hojas == 1 ? 'Puerta Batiente' : "Puerta Hoja #{i + 1}"

            crear_panel_puerta(
              grupo_puertas, nombre_hoja,
              x_pos, y_puerta, z_puerta,
              ancho_p_num.mm, t_puerta, alto_p_num.mm,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PTA-#{i + 1}",
                'pieza_nombre' => nombre_hoja, 'material' => material,
                'largo_bruto_mm' => alto_p_num, 'ancho_bruto_mm' => ancho_p_num,
                'espesor_mm' => t_p_num,
                'largo_neto_mm' => alto_p_num - 4.0, # Canto grueso de 2mm perimetral
                'ancho_neto_mm' => ancho_p_num - 4.0,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 2.0, 'canto_L2' => 2.0, 'canto_A1' => 2.0, 'canto_A2' => 2.0,
                'ranura' => 'Ninguna',
                'bisagras' => { 'cantidad' => cant_bisagras, 'cazoleta_diametro_mm' => 35.0, 'dist_borde_mm' => 21.5 }.to_json
              }
            )
          end

          model.commit_operation
          { 'ok' => true, 'mensaje' => "#{hojas} puerta(s) batiente(s) creada(s) con luces de #{luz_mm}mm y cazoletas de 35mm para bisagras." }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => e.message }
        end
      end

      private

      # ========================================================================
      # Método: crear_panel_puerta
      # Descripción: Genera la geometría tridimensional y metadatos de la hoja de puerta.
      # ========================================================================
      def crear_panel_puerta(parent, nombre, x, y, z, dx, dy, dz, attrs)
        sub = parent.entities.add_group
        sub.name = nombre
        pts = [
          Geom::Point3d.new(x, y, z),
          Geom::Point3d.new(x + dx, y, z),
          Geom::Point3d.new(x + dx, y + dy, z),
          Geom::Point3d.new(x, y + dy, z)
        ]
        face = sub.entities.add_face(pts)
        face.reverse! if face.normal.z < 0
        face.pushpull(dz.abs)

        dict = sub.attribute_dictionary('DespieceMela', true)
        attrs.each { |k, v| dict[k.to_s] = v.to_s }
      end
    end
  end
end
