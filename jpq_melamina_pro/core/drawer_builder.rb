# ==============================================================================
# Archivo: jpq_melamina_pro/core/drawer_builder.rb
# Descripción: Generador paramétrico avanzado de cajoneras y correderas.
#              Soporta 3 tipos de correderas industriales:
#              - Telescópicas Estándar (descuento 26 mm: 13 mm por lado)
#              - Ocultas Undermount / Blumotion (descuento 21 mm y elevación fondo 14 mm)
#              - Laterales Metálicos Slim Box (descuento 37.5 mm)
#              Soporta 3 montajes de frente: Exterior, Medio e Interior
#              con luces perimetrales configurables (1, 2 o 3 mm).
#              Almacena metadatos cinemáticos para simulación de apertura al 80%.
# ==============================================================================

require 'sketchup.rb'
require 'json'
require_relative 'material_manager'

module JPQMelaminaPro
  class DrawerBuilder
    class << self
      # ========================================================================
      # Método: build
      # Descripción: Inserta un bloque completo de cajones en el módulo activo.
      # Parámetros:
      #   - params (Hash):
      #       'cantidad_cajones' (Integer, ej. 3 o 4),
      #       'tipo_corredera' ('telescopica' | 'oculta' | 'metalica'),
      #       'largo_corredera' (Float, ej. 400, 450 o 500 mm),
      #       'luz_entre_tapas' (Float: 1.0, 2.0 o 3.0 mm),
      #       'tipo_montaje' ('exterior' | 'medio' | 'interior'),
      #       'espesor_caja' (Float, ej. 15.0 o 18.0 mm)
      # ========================================================================
      def build(params)
        model = Sketchup.active_model
        sel = model.selection

        modulo = sel.find { |e| e.attribute_dictionary('DespieceMelaModulo') }
        modulo ||= CabinetBuilder.ultimo_modulo_activo if defined?(CabinetBuilder) && CabinetBuilder.ultimo_modulo_activo && CabinetBuilder.ultimo_modulo_activo.valid?
        return { 'ok' => false, 'error' => 'Por favor, crea o selecciona un módulo primero.' } unless modulo

        dict_mod   = modulo.attribute_dictionary('DespieceMelaModulo')
        alto_mod   = dict_mod['alto_mm'].to_f.mm
        ancho_mod  = dict_mod['ancho_mm'].to_f.mm
        prof_mod   = dict_mod['prof_mm'].to_f.mm
        t_val      = (dict_mod['espesor_mm'] && dict_mod['espesor_mm'].to_f > 0) ? dict_mod['espesor_mm'].to_f : 18.0
        t          = t_val.mm
        modulo_id  = dict_mod['modulo_id']
        material   = dict_mod['material'] || 'Pelikano Bellota 18mm'

        cant_cajones   = (params['cantidad_cajones'] || 3).to_i
        tipo_corr      = params['tipo_corredera'] || 'telescopica'
        largo_slide_mm = (params['largo_corredera'] || 450.0).to_f
        luz_mm         = (params['luz_entre_tapas'] || 2.0).to_f
        tipo_montaje   = params['tipo_montaje'] || 'exterior' # 'exterior', 'medio', 'interior'
        t_caja_mm      = (params['espesor_caja'] && params['espesor_caja'].to_f > 0) ? params['espesor_caja'].to_f : 18.0

        model.start_operation('JPQMelaminaPro: Insertar Cajonera Paramétrica', true)

        begin
          ancho_int_vano_num = dict_mod['ancho_mm'].to_f - (2 * t_val)
          alto_int_vano_num  = dict_mod['alto_mm'].to_f - (2 * t_val)

          # Descuento exacto según tipo de corredera
          descuento_corredera_num = case tipo_corr
                                    when 'oculta'   then 21.0
                                    when 'metalica' then 37.5
                                    else                 26.0 # Telescópica estándar (13mm x lado)
                                    end

          ancho_ext_caja_num = ancho_int_vano_num - descuento_corredera_num
          ancho_ext_caja     = ancho_ext_caja_num.mm

          # Cálculo de dimensiones del frente según el tipo de montaje
          case tipo_montaje
          when 'exterior'
            alto_disponible_frentes = dict_mod['alto_mm'].to_f - ((cant_cajones + 1) * luz_mm)
            alto_frente_num = alto_disponible_frentes / cant_cajones
            ancho_frente_num = dict_mod['ancho_mm'].to_f - (2 * luz_mm)
            y_frente = -t
          when 'medio'
            alto_disponible_frentes = dict_mod['alto_mm'].to_f - ((cant_cajones + 1) * luz_mm)
            alto_frente_num = alto_disponible_frentes / cant_cajones
            ancho_frente_num = ancho_int_vano_num + t_val - (2 * luz_mm)
            y_frente = -t
          else # 'interior' (embutido)
            alto_disponible_frentes = alto_int_vano_num - ((cant_cajones + 1) * luz_mm)
            alto_frente_num = alto_disponible_frentes / cant_cajones
            ancho_frente_num = ancho_int_vano_num - (2 * luz_mm)
            y_frente = 0.mm
          end

          alto_caja_num = [alto_frente_num - 40.0, 70.0].max
          alto_caja     = alto_caja_num.mm
          largo_slide   = largo_slide_mm.mm
          t_caja        = t_caja_mm.mm

          # Grupo contenedor general de la cajonera
          grupo_cajonera = modulo.entities.add_group
          grupo_cajonera.name = "Cajonera [#{cant_cajones} Cajones - #{tipo_corr.capitalize}]"

          paso_vertical = (alto_mod - (2 * t)) / cant_cajones

          cant_cajones.times do |i|
            z_base_cajon = t + (paso_vertical * i) + 15.mm

            grupo_cajon = grupo_cajonera.entities.add_group
            grupo_cajon.name = "Cajón #{i + 1}"

            # 1. Frente de Cajón
            z_frente = case tipo_montaje
                       when 'interior'
                         t + luz_mm.mm + (i * (alto_frente_num + luz_mm).mm)
                       else
                         luz_mm.mm + (i * (alto_frente_num + luz_mm).mm)
                       end
            x_frente = (tipo_montaje == 'interior') ? (t + luz_mm.mm) : luz_mm.mm

            crear_subpieza(
              grupo_cajon, "Frente Cajón #{i + 1}",
              x_frente, y_frente, z_frente,
              ancho_frente_num.mm, t, alto_frente_num.mm,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-FRENTE-CAJ-#{i + 1}",
                'pieza_nombre' => "Frente Cajón #{i + 1}", 'material' => material,
                'largo_bruto_mm' => ancho_frente_num, 'ancho_bruto_mm' => alto_frente_num,
                'espesor_mm' => t_val, 'largo_neto_mm' => ancho_frente_num - 4.0,
                'ancho_neto_mm' => alto_frente_num - 4.0, 'cantidad' => 1,
                'veta' => 'longitudinal',
                'canto_L1' => 2.0, 'canto_L2' => 2.0, 'canto_A1' => 2.0, 'canto_A2' => 2.0,
                'ranura' => 'Ninguna'
              }
            )

            # 2. Caja Interna del Cajón (si no es metálica Slim Box)
            unless tipo_corr == 'metalica'
              x_caja = t + (descuento_corredera_num / 2.0).mm
              y_caja = (tipo_montaje == 'interior') ? t : 0.mm

              # Lateral Izquierdo Caja
              crear_subpieza(
                grupo_cajon, "Lateral Izq Cajón #{i + 1}",
                x_caja, y_caja, z_base_cajon,
                t_caja, largo_slide, alto_caja,
                {
                  'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-CAJ-LAT-IZQ-#{i + 1}",
                  'pieza_nombre' => "Lat Cajón #{i + 1}", 'material' => 'Melamina Blanca 18mm',
                  'largo_bruto_mm' => largo_slide_mm, 'ancho_bruto_mm' => alto_caja_num,
                  'espesor_mm' => t_caja_mm, 'largo_neto_mm' => largo_slide_mm - 1.0,
                  'ancho_neto_mm' => alto_caja_num - 1.0, 'cantidad' => 1,
                  'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                  'ranura' => 'Ranura Fondo 3mm a 12mm'
                }
              )

              # Lateral Derecho Caja
              crear_subpieza(
                grupo_cajon, "Lateral Der Cajón #{i + 1}",
                x_caja + ancho_ext_caja - t_caja, y_caja, z_base_cajon,
                t_caja, largo_slide, alto_caja,
                {
                  'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-CAJ-LAT-DER-#{i + 1}",
                  'pieza_nombre' => "Lat Cajón #{i + 1}", 'material' => 'Melamina Blanca 18mm',
                  'largo_bruto_mm' => largo_slide_mm, 'ancho_bruto_mm' => alto_caja_num,
                  'espesor_mm' => t_caja_mm, 'largo_neto_mm' => largo_slide_mm - 1.0,
                  'ancho_neto_mm' => alto_caja_num - 1.0, 'cantidad' => 1,
                  'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                  'ranura' => 'Ranura Fondo 3mm a 12mm'
                }
              )

              # Contrafrente y Trasera de la Caja
              ancho_contra_num = ancho_ext_caja_num - (2 * t_caja_mm)
              crear_subpieza(
                grupo_cajon, "Contrafrente Cajón #{i + 1}",
                x_caja + t_caja, y_caja, z_base_cajon,
                ancho_contra_num.mm, t_caja, alto_caja,
                {
                  'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-CAJ-CONTRA-#{i + 1}",
                  'pieza_nombre' => "Contrafrente Cajón #{i + 1}", 'material' => 'Melamina Blanca 18mm',
                  'largo_bruto_mm' => ancho_contra_num, 'ancho_bruto_mm' => alto_caja_num,
                  'espesor_mm' => t_caja_mm, 'largo_neto_mm' => ancho_contra_num - 0.5,
                  'ancho_neto_mm' => alto_caja_num - 0.5, 'cantidad' => 1,
                  'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                  'ranura' => 'Ranura Fondo 3mm a 12mm'
                }
              )

              crear_subpieza(
                grupo_cajon, "Trasera Cajón #{i + 1}",
                x_caja + t_caja, y_caja + largo_slide - t_caja, z_base_cajon,
                ancho_contra_num.mm, t_caja, alto_caja,
                {
                  'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-CAJ-TRAS-#{i + 1}",
                  'pieza_nombre' => "Trasera Cajón #{i + 1}", 'material' => 'Melamina Blanca 18mm',
                  'largo_bruto_mm' => ancho_contra_num, 'ancho_bruto_mm' => alto_caja_num,
                  'espesor_mm' => t_caja_mm, 'largo_neto_mm' => ancho_contra_num - 0.5,
                  'ancho_neto_mm' => alto_caja_num - 0.5, 'cantidad' => 1,
                  'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                  'ranura' => 'Ranura Fondo 3mm a 12mm'
                }
              )
            end

            # Metadatos para simulación cinemática
            dict_cajon = grupo_cajon.attribute_dictionary('DespieceMela', true)
            dict_cajon['Tipo_Herraje'] = 'corredera_telescopica'
            dict_cajon['Profundidad_Corredera'] = largo_slide_mm
            dict_cajon['Transformacion_Original'] = grupo_cajon.transformation.to_a.to_json
          end

          model.commit_operation
          { 'ok' => true, 'mensaje' => "#{cant_cajones} cajones con corredera '#{tipo_corr}' (#{descuento_corredera_num}mm desc.), montaje #{tipo_montaje} y luz de #{luz_mm}mm insertados exitosamente." }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => "Error al insertar cajonera: #{e.message}" }
        end
      end

      private

      # ========================================================================
      # Sub-método: crear_subpieza
      # Descripción: Genera la geometría tridimensional de una pieza del cajón.
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

        mat_nombre = attrs['material'] || 'Pelikano Bellota 18mm'
        su_mat = MaterialManager.obtener_o_crear_material_su(parent.model, mat_nombre)
        sub.material = su_mat if su_mat

        dict = sub.attribute_dictionary('DespieceMela', true)
        attrs.each { |k, v| dict[k.to_s] = v.to_s }
      end
    end
  end
end
