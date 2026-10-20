# ==============================================================================
# Archivo: mela_studio_clone/core/drawer_builder.rb
# Descripción: Generador paramétrico de cajoneras y correderas telescópicas.
#              Aplica el descuento estándar de 26 mm (13 mm por lado) para
#              correderas telescópicas, cajas de cajón y tapas con luz perimetral.
# ==============================================================================

require 'sketchup.rb'

module JPQMelaminaPro
  class DrawerBuilder
    class << self
      # ========================================================================
      # Método: build
      # Descripción: Inserta un bloque de cajones dentro del vano del módulo seleccionado.
      # Parámetros:
      #   - params (Hash):
      #       'cantidad_cajones' (Integer, ej. 3 o 4),
      #       'largo_corredera' (Float, ej. 400 o 450 mm),
      #       'luz_entre_tapas' (Float, ej. 3.0 mm),
      #       'espesor_caja' (Float, ej. 15.0 o 18.0 mm),
      #       'tipo_frente' ('exterior' | 'interior')
      # ========================================================================
      def build(params)
        model = Sketchup.active_model
        sel = model.selection

        modulo = sel.find { |e| e.attribute_dictionary('DespieceMelaModulo') }
        return { 'ok' => false, 'error' => 'Selecciona el módulo donde insertar los cajones.' } unless modulo

        dict_mod = modulo.attribute_dictionary('DespieceMelaModulo')
        alto_mod   = dict_mod['alto_mm'].to_f.mm
        ancho_mod  = dict_mod['ancho_mm'].to_f.mm
        prof_mod   = dict_mod['prof_mm'].to_f.mm
        t_val      = (dict_mod['espesor_mm'] && dict_mod['espesor_mm'].to_f > 0) ? dict_mod['espesor_mm'].to_f : 18.0
        t          = t_val.mm
        modulo_id  = dict_mod['modulo_id']
        material   = dict_mod['material'] || 'Melamina 18mm'

        cant_cajones   = (params['cantidad_cajones'] || 3).to_i
        largo_slide_mm = (params['largo_corredera'] || 450.0).to_f
        luz_mm         = (params['luz_entre_tapas'] || 3.0).to_f
        t_caja_mm      = (params['espesor_caja'] && params['espesor_caja'].to_f > 0) ? params['espesor_caja'].to_f : 18.0
        tipo_frente    = params['tipo_frente'] || 'exterior'

        model.start_operation('JPQMelaminaPro: Insertar Cajonera', true)

        begin
          ancho_int_vano = ancho_mod - (2 * t)
          ancho_int_vano_num = dict_mod['ancho_mm'].to_f - (2 * t_val)
          alto_int_vano_num  = dict_mod['alto_mm'].to_f - (2 * t_val)

          # REGLA DE CARPINTERÍA: 13 mm por lado para corredera telescópica = 26 mm de descuento total
          ancho_ext_caja_num = ancho_int_vano_num - 26.0
          ancho_ext_caja     = ancho_ext_caja_num.mm

          # Cálculo de altura de tapas exteriores
          if tipo_frente == 'exterior'
            alto_disponible_frentes = dict_mod['alto_mm'].to_f - ((cant_cajones + 1) * luz_mm)
            alto_frente_num = alto_disponible_frentes / cant_cajones
            ancho_frente_num = dict_mod['ancho_mm'].to_f - (2 * luz_mm)
          else
            alto_disponible_frentes = alto_int_vano_num - ((cant_cajones + 1) * luz_mm)
            alto_frente_num = alto_disponible_frentes / cant_cajones
            ancho_frente_num = ancho_int_vano_num - (2 * luz_mm)
          end

          # Altura de la caja del cajón (40mm menos que el frente para holgura de acceso)
          alto_caja_num = [alto_frente_num - 40.0, 70.0].max
          alto_caja     = alto_caja_num.mm
          largo_slide   = largo_slide_mm.mm
          t_caja        = t_caja_mm.mm

          # Contenedor para toda la cajonera
          grupo_cajonera = modulo.entities.add_group
          grupo_cajonera.name = "Cajonera [#{cant_cajones} Cajones]"

          paso_vertical = (alto_mod - (2 * t)) / cant_cajones

          cant_cajones.times do |i|
            z_base_cajon = t + (paso_vertical * i) + 15.mm # elevación sobre el piso del hueco

            grupo_cajon = grupo_cajonera.entities.add_group
            grupo_cajon.name = "Cajón #{i + 1}"

            # 1. Frente exterior del cajón (Tapa decorativa)
            z_frente = (tipo_frente == 'exterior') ? (luz_mm.mm + (i * (alto_frente_num + luz_mm).mm)) : (t + luz_mm.mm + (i * (alto_frente_num + luz_mm).mm))
            y_frente = (tipo_frente == 'exterior') ? -t : 0.mm
            x_frente = (tipo_frente == 'exterior') ? luz_mm.mm : (t + luz_mm.mm)

            crear_subpieza(
              grupo_cajon, "Tapa Frente Cajón #{i + 1}",
              x_frente, y_frente, z_frente,
              ancho_frente_num.mm, t, alto_frente_num.mm,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-TAPA-CAJ-#{i + 1}",
                'pieza_nombre' => "Frente Cajón #{i + 1}", 'material' => material,
                'largo_bruto_mm' => ancho_frente_num, 'ancho_bruto_mm' => alto_frente_num,
                'espesor_mm' => dict_mod['espesor_mm'].to_f,
                'largo_neto_mm' => ancho_frente_num - 4.0, # Canto grueso de 2mm por lado
                'ancho_neto_mm' => alto_frente_num - 4.0,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 2.0, 'canto_L2' => 2.0, 'canto_A1' => 2.0, 'canto_A2' => 2.0,
                'ranura' => 'Ninguna'
              }
            )

            # 2. Caja interna del cajón (Estructura)
            # Desplazamiento X: 13 mm por la corredera izquierda
            x_caja = t + 13.mm
            y_caja = 20.mm # 20mm de retroceso respecto al frente interior

            # Laterales del cajón (2 piezas: Izquierdo y Derecho)
            crear_subpieza(
              grupo_cajon, "Lat Izq Cajón #{i + 1}",
              x_caja, y_caja, z_base_cajon,
              t_caja, largo_slide, alto_caja,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-CAJ#{i + 1}-LAT-IZQ",
                'pieza_nombre' => "Lat Izq Cajón #{i + 1}", 'material' => 'Melamina Blanca 15mm',
                'largo_bruto_mm' => largo_slide_mm, 'ancho_bruto_mm' => alto_caja_num,
                'espesor_mm' => t_caja_mm, 'largo_neto_mm' => largo_slide_mm,
                'ancho_neto_mm' => alto_caja_num - 0.45,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 0.45, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                'ranura' => 'Ranura 4x6mm para fondo a 10mm'
              }
            )

            crear_subpieza(
              grupo_cajon, "Lat Der Cajón #{i + 1}",
              x_caja + ancho_ext_caja - t_caja, y_caja, z_base_cajon,
              t_caja, largo_slide, alto_caja,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-CAJ#{i + 1}-LAT-DER",
                'pieza_nombre' => "Lat Der Cajón #{i + 1}", 'material' => 'Melamina Blanca 15mm',
                'largo_bruto_mm' => largo_slide_mm, 'ancho_bruto_mm' => alto_caja_num,
                'espesor_mm' => t_caja_mm, 'largo_neto_mm' => largo_slide_mm,
                'ancho_neto_mm' => alto_caja_num - 0.45,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 0.45, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                'ranura' => 'Ranura 4x6mm para fondo a 10mm'
              }
            )

            # Contrafrente y Trasera del cajón (van entre los laterales del cajón)
            ancho_contra_num = ancho_ext_caja_num - (2 * t_caja_mm)
            ancho_contra     = ancho_contra_num.mm

            crear_subpieza(
              grupo_cajon, "Contrafrente Cajón #{i + 1}",
              x_caja + t_caja, y_caja, z_base_cajon,
              ancho_contra, t_caja, alto_caja,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-CAJ#{i + 1}-CONTRA",
                'pieza_nombre' => "Contrafrente Cajón #{i + 1}", 'material' => 'Melamina Blanca 15mm',
                'largo_bruto_mm' => ancho_contra_num, 'ancho_bruto_mm' => alto_caja_num,
                'espesor_mm' => t_caja_mm, 'largo_neto_mm' => ancho_contra_num,
                'ancho_neto_mm' => alto_caja_num - 0.45,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 0.45, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                'ranura' => 'Ranura 4x6mm para fondo a 10mm'
              }
            )

            crear_subpieza(
              grupo_cajon, "Trasera Cajón #{i + 1}",
              x_caja + t_caja, y_caja + largo_slide - t_caja, z_base_cajon,
              ancho_contra, t_caja, alto_caja,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-CAJ#{i + 1}-TRAS",
                'pieza_nombre' => "Trasera Cajón #{i + 1}", 'material' => 'Melamina Blanca 15mm',
                'largo_bruto_mm' => ancho_contra_num, 'ancho_bruto_mm' => alto_caja_num,
                'espesor_mm' => t_caja_mm, 'largo_neto_mm' => ancho_contra_num,
                'ancho_neto_mm' => alto_caja_num - 0.45,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 0.45, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                'ranura' => 'Ranura 4x6mm para fondo a 10mm'
              }
            )

            # Fondo del cajón en MDF 3mm
            fondo_caj_ancho_num = ancho_contra_num + 12.0 # 6mm por ranura a cada lado
            fondo_caj_largo_num = largo_slide_mm - (2 * t_caja_mm) + 12.0

            crear_subpieza(
              grupo_cajon, "Fondo MDF Cajón #{i + 1}",
              x_caja + t_caja - 6.mm, y_caja + t_caja - 6.mm, z_base_cajon + 10.mm,
              fondo_caj_ancho_num.mm, fondo_caj_largo_num.mm, 3.mm,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-CAJ#{i + 1}-FONDO",
                'pieza_nombre' => "Fondo MDF Cajón #{i + 1}", 'material' => 'MDF 3mm Blanco',
                'largo_bruto_mm' => fondo_caj_largo_num, 'ancho_bruto_mm' => fondo_caj_ancho_num,
                'espesor_mm' => 3.0, 'largo_neto_mm' => fondo_caj_largo_num,
                'ancho_neto_mm' => fondo_caj_ancho_num, 'cantidad' => 1,
                'veta' => 'libre', 'canto_L1' => 0.0, 'canto_L2' => 0.0,
                'canto_A1' => 0.0, 'canto_A2' => 0.0, 'ranura' => 'Ninguna'
              }
            )
          end

          model.commit_operation
          { 'ok' => true, 'mensaje' => "Cajonera de #{cant_cajones} cajones generada con holgura de 26mm para correderas." }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => e.message }
        end
      end

      private

      # ========================================================================
      # Método: crear_subpieza
      # Descripción: Genera la geometría y el diccionario de corte de cada pieza del cajón.
      # ========================================================================
      def crear_subpieza(parent, nombre, x, y, z, dx, dy, dz, attrs)
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
