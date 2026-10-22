# ==============================================================================
# Archivo: jpq_melamina_pro/core/doors_builder.rb
# Descripción: Generador paramétrico de puertas con soporte para:
#              - 3 Tipos de Montaje: Exterior (Sobrepuesto), Medio (Semicerrado) e Interior (Embutido)
#              - Luces perimetrales configurables: 1, 2 o 3 mm
#              - Mecanismos de apertura cinemática:
#                * Bisagra batiente (rotación en Z con bisagra recta, codo 9 o codo 18)
#                * Pistón a gas superior (-85° rotación en X)
#                * Pistón inverso (+85° rotación en X)
#                * Puertas corredizas (traslación lineal en X)
# ==============================================================================

require 'sketchup.rb'
require 'json'
require_relative 'material_manager'

module JPQMelaminaPro
  class DoorsBuilder
    class << self
      # ========================================================================
      # Método: build
      # Descripción: Inserta puertas en el módulo activo calculando milimétricamente
      #              las holguras de carpintería y configurando metadatos cinemáticos.
      # Parámetros:
      #   - params (Hash):
      #       'tipo_montaje' ('exterior' | 'medio' | 'interior'),
      #       'mecanismo' ('batiente' | 'piston_superior' | 'piston_inverso' | 'corrediza'),
      #       'apertura' ('izquierda' | 'derecha' | 'doble'),
      #       'luz_perimetral' (Float: 1.0, 2.0 o 3.0 mm),
      #       'espesor' (Float, ej. 18.0 mm)
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
        t_val      = (dict_mod && dict_mod['espesor_mm'].to_f > 0) ? dict_mod['espesor_mm'].to_f : 18.0
        t_mod      = t_val.mm
        modulo_id  = dict_mod['modulo_id']
        material   = dict_mod['material'] || 'Pelikano Bellota 18mm'

        tipo_montaje = params['tipo_montaje'] || params['tipo'] || 'exterior' # 'exterior', 'medio', 'interior'
        mecanismo    = params['mecanismo'] || 'batiente' # 'batiente', 'piston_superior', 'piston_inverso', 'corrediza'
        apertura     = params['apertura'] || 'doble' # 'izquierda', 'derecha', 'doble'
        hojas        = (apertura == 'doble') ? 2 : 1
        luz_mm       = (params['luz_perimetral'] || 2.0).to_f
        t_p_num      = (params['espesor'] && params['espesor'].to_f > 0) ? params['espesor'].to_f : t_val
        t_puerta     = t_p_num.mm

        model.start_operation('JPQMelaminaPro: Generar Puertas Paramétricas', true)

        begin
          grupo_puertas = modulo.entities.add_group
          grupo_puertas.name = "Puertas [#{hojas} Hojas - #{tipo_montaje.capitalize} - #{mecanismo.capitalize}]"

          ancho_int_num = dict_mod['ancho_mm'].to_f - (2 * t_val)
          alto_int_num  = dict_mod['alto_mm'].to_f - (2 * t_val)

          case tipo_montaje
          when 'exterior'
            alto_p_num = dict_mod['alto_mm'].to_f - (2 * luz_mm)
            ancho_p_num = if hojas == 1
                            dict_mod['ancho_mm'].to_f - (2 * luz_mm)
                          else
                            (dict_mod['ancho_mm'].to_f - (3 * luz_mm)) / 2.0
                          end
            y_puerta = -t_puerta
            z_puerta = luz_mm.mm
            x_inicio = luz_mm.mm
            tipo_bisagra = 'Bisagra Recta (0mm)'
          when 'medio'
            alto_p_num = dict_mod['alto_mm'].to_f - (2 * luz_mm)
            ancho_p_num = if hojas == 1
                            ancho_int_num + t_val - (2 * luz_mm)
                          else
                            (ancho_int_num + (2 * t_val) - (3 * luz_mm)) / 2.0
                          end
            y_puerta = -t_puerta
            z_puerta = luz_mm.mm
            x_inicio = (t_val / 2.0 + luz_mm).mm
            tipo_bisagra = 'Bisagra Codo 9 (Semicurva)'
          else # 'interior' (embutido)
            alto_p_num = alto_int_num - (2 * luz_mm)
            ancho_p_num = if hojas == 1
                            ancho_int_num - (2 * luz_mm)
                          else
                            (ancho_int_num - (3 * luz_mm)) / 2.0
                          end
            y_puerta = 0.mm
            z_puerta = t_mod + luz_mm.mm
            x_inicio = t_mod + luz_mm.mm
            tipo_bisagra = 'Bisagra Codo 18 (Curva Alta)'
          end

          # Bisagras recomendadas según altura
          cant_bisagras = if alto_p_num <= 900
                            2
                          elsif alto_p_num <= 1600
                            3
                          else
                            4
                          end

          hojas.times do |i|
            x_pos = x_inicio + (i * (ancho_p_num + luz_mm).mm)
            lado_bisagra = if hojas == 1
                             apertura
                           else
                             (i == 0) ? 'izquierdo' : 'derecho'
                           end
            nombre_hoja = (hojas == 1) ? "Puerta #{mecanismo.capitalize}" : "Puerta Hoja #{i + 1}"

            panel_hoja = grupo_puertas.entities.add_group
            panel_hoja.name = nombre_hoja

            pts = [
              Geom::Point3d.new(x_pos, y_puerta, z_puerta),
              Geom::Point3d.new(x_pos + ancho_p_num.mm, y_puerta, z_puerta),
              Geom::Point3d.new(x_pos + ancho_p_num.mm, y_puerta + t_puerta, z_puerta),
              Geom::Point3d.new(x_pos, y_puerta + t_puerta, z_puerta)
            ]
            face = panel_hoja.entities.add_face(pts)
            face.reverse! if face.normal.z < 0
            face.pushpull(alto_p_num.mm)

            su_mat = MaterialManager.obtener_o_crear_material_su(modulo.model, material)
            panel_hoja.material = su_mat if su_mat

            # Atributos oficiales de despiece
            dict = panel_hoja.attribute_dictionary('DespieceMela', true)
            dict['modulo_id'] = modulo_id
            dict['pieza_id'] = "#{modulo_id}-PTA-#{i + 1}"
            dict['pieza_nombre'] = nombre_hoja
            dict['material'] = material
            dict['espesor_mm'] = t_p_num
            dict['largo_bruto_mm'] = alto_p_num
            dict['ancho_bruto_mm'] = ancho_p_num
            dict['largo_neto_mm'] = alto_p_num - 4.0 # Canto grueso 2mm en 4 lados
            dict['ancho_neto_mm'] = ancho_p_num - 4.0
            dict['cantidad'] = 1
            dict['veta'] = 'longitudinal'
            dict['canto_L1'] = 2.0; dict['canto_L2'] = 2.0; dict['canto_A1'] = 2.0; dict['canto_A2'] = 2.0
            dict['ranura'] = 'Ninguna'
            dict['Tipo_Montaje'] = tipo_montaje
            dict['Luz_Frente'] = luz_mm

            # Metadatos para simulación cinemática
            tipo_herraje_cinematica = case mecanismo
                                      when 'piston_superior' then 'piston_gas_superior'
                                      when 'piston_inverso'  then 'piston_gas_inverso'
                                      when 'corrediza'       then 'puerta_corrediza'
                                      else                        'bisagra_batiente'
                                      end

            dict['Tipo_Herraje'] = tipo_herraje_cinematica
            dict['Lado_Bisagra'] = lado_bisagra
            dict['Tipo_Bisagra'] = tipo_bisagra
            dict['bisagras'] = { 'cantidad' => cant_bisagras, 'tipo' => tipo_bisagra, 'cazoleta_diametro_mm' => 35.0 }.to_json
            dict['Transformacion_Original'] = panel_hoja.transformation.to_a.to_json
          end

          model.commit_operation
          {
            'ok' => true,
            'mensaje' => "#{hojas} puerta(s) (#{tipo_montaje.capitalize}, #{mecanismo.capitalize}) creadas con luz de #{luz_mm}mm y #{tipo_bisagra}."
          }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => "Error al generar puertas: #{e.message}" }
        end
      end
    end
  end
end
