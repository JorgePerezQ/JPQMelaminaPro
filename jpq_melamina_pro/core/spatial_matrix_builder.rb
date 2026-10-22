# ==============================================================================
# Archivo: jpq_melamina_pro/core/spatial_matrix_builder.rb
# Descripción: Motor de Distribución Matricial Paramétrica 100% Dinámica.
#              TODOS los parámetros son configurables y seleccionables por el usuario:
#              - Dimensiones totales: Ancho (W), Alto (H), Profundidad (D)
#              - Alturas de zonas configurables: Zona Baja, Zona Media, Zona Alta
#              - Profundidades diferenciadas por zona (Prof Baja, Media, Alta)
#              - Distribución de N columnas con anchos milimétricos personalizados
#              - Asignación libre de tipología por celda
#              - Holguras, ranuras, amarres traseros y materiales dinámicos
# ==============================================================================

require 'sketchup.rb'
require 'json'
require_relative 'cabinet_builder'
require_relative 'material_manager'

module JPQMelaminaPro
  class SpatialMatrixBuilder
    class << self
      # ========================================================================
      # Método: build_matrix
      # Descripción: Genera la composición paramétrica completa a partir de los
      #              parámetros dinámicos enviados por el usuario desde la UI.
      # Parámetros:
      #   - params (Hash): Recibe todas las cotas, holguras y opciones del usuario.
      # ========================================================================
      def build_matrix(params)
        model = Sketchup.active_model
        model.start_operation('JPQMelaminaPro: Construir Matriz Modular Dinámica', true)

        begin
          # Dimensiones globales ingresadas por el usuario
          ancho_total_num = params['ancho_total'].to_f
          alto_total_num  = params['alto_total'].to_f
          prof_total_num  = params['prof_total'].to_f
          t_num           = (params['espesor'] && params['espesor'].to_f > 0) ? params['espesor'].to_f : 18.0
          zocalo_num      = (params['altura_zocalo'] && params['altura_zocalo'].to_f >= 0) ? params['altura_zocalo'].to_f : 100.0

          ancho_total = ancho_total_num.mm
          alto_total  = alto_total_num.mm
          prof_total  = prof_total_num.mm
          t           = t_num.mm
          zocalo_h    = zocalo_num.mm

          # Alturas de zonas 100% DINÁMICAS (ingresadas por el usuario)
          alto_alta_num = if params['alto_alta'] && params['alto_alta'].to_f > 0
                            params['alto_alta'].to_f
                          elsif alto_total_num >= 2000
                            500.0
                          else
                            alto_total_num * 0.25
                          end

          alto_baja_num = if params['alto_baja'] && params['alto_baja'].to_f > 0
                            params['alto_baja'].to_f
                          else
                            [750.0 - zocalo_num, 300.0].max
                          end

          # La zona media se adapta dinámicamente al remanente o al valor configurado
          alto_media_num = alto_total_num - zocalo_num - alto_baja_num - alto_alta_num
          if alto_media_num < 0
            # Si el usuario ingresó alturas que exceden el total, autoajustar proporcionalmente
            alto_baja_num = (alto_total_num - zocalo_num) * 0.4
            alto_alta_num = (alto_total_num - zocalo_num) * 0.3
            alto_media_num = (alto_total_num - zocalo_num) * 0.3
          end

          alto_alta  = alto_alta_num.mm
          alto_baja  = alto_baja_num.mm
          alto_media = alto_media_num.mm

          # Profundidades dinámicas por zona
          prof_baja_num  = (params['prof_baja'] && params['prof_baja'].to_f > 0) ? params['prof_baja'].to_f : prof_total_num
          prof_media_num = (params['prof_media'] && params['prof_media'].to_f >= 0) ? params['prof_media'].to_f : (prof_total_num * 0.5)
          prof_alta_num  = (params['prof_alta'] && params['prof_alta'].to_f > 0) ? params['prof_alta'].to_f : (prof_total_num * 0.55)

          prof_baja  = prof_baja_num.mm
          prof_media = prof_media_num.mm
          prof_alta  = prof_alta_num.mm

          # Parámetros dinámicos de frentes, luces y fondo
          luz_frentes_num  = (params['luz_frentes'] && params['luz_frentes'].to_f > 0) ? params['luz_frentes'].to_f : 2.0
          tipo_montaje     = params['tipo_montaje'] || 'exterior' # 'exterior', 'medio', 'interior'
          tipo_corredera   = params['tipo_corredera'] || 'telescopica'
          dist_ranura_num  = (params['distancia_ranura'] && params['distancia_ranura'].to_f > 0) ? params['distancia_ranura'].to_f : 18.0
          prof_ranura_num  = (params['prof_ranura'] && params['prof_ranura'].to_f > 0) ? params['prof_ranura'].to_f : 8.0
          cant_amarres     = (params['cant_amarres'] && params['cant_amarres'].to_i > 0) ? params['cant_amarres'].to_i : 2

          # Materiales seleccionados dinámicamente por el usuario
          mat_estructura = params['material_estructura'] || 'Pelikano Blanco Nieve 18mm'
          mat_frentes    = params['material_frentes'] || mat_estructura
          mat_fondos     = params['material_fondos'] || 'MDF Fondo Blanco 3mm'
          resistencia    = params['resistencia'] || 'Normal'
          modulo_id      = params['modulo_id'] || "MOD-DINAMICO-#{Time.now.to_i % 10000}"

          # Grupo contenedor principal en SketchUp
          grupo_matriz = model.active_entities.add_group
          grupo_matriz.name = params['nombre'] || "Mueble Dinámico #{ancho_total_num.to_i}x#{alto_total_num.to_i}x#{prof_total_num.to_i}mm"

          dict_padre = grupo_matriz.attribute_dictionary('DespieceMelaModulo', true)
          dict_padre['modulo_id'] = modulo_id
          dict_padre['tipo'] = 'matriz_modular'
          dict_padre['ancho_mm'] = ancho_total_num
          dict_padre['alto_mm'] = alto_total_num
          dict_padre['prof_mm'] = prof_total_num
          dict_padre['espesor_mm'] = t_num
          dict_padre['resistencia'] = resistencia
          dict_padre['material'] = mat_estructura

          # 1. ZÓCALO CONTINUO UNIFICADO (con altura y retranqueo dinámico)
          retranqueo_zocalo = (params['retranqueo_zocalo'] || 40.0).to_f.mm
          if zocalo_num > 0
            CabinetBuilder.crear_panel(
              grupo_matriz, 'Zócalo Frontal Unificado',
              0.mm, retranqueo_zocalo, 0.mm,
              ancho_total, t, zocalo_h,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-ZOC-FRONT",
                'pieza_nombre' => 'Zócalo Frontal Continuo', 'material' => mat_estructura,
                'resistencia' => resistencia,
                'largo_bruto_mm' => ancho_total_num, 'ancho_bruto_mm' => zocalo_num, 'espesor_mm' => t_num,
                'largo_neto_mm' => ancho_total_num - 1.0, 'ancho_neto_mm' => zocalo_num - 1.0,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                'ranura' => 'Ninguna'
              }
            )

            CabinetBuilder.crear_panel(
              grupo_matriz, 'Zócalo Posterior Unificado',
              0.mm, prof_total - t, 0.mm,
              ancho_total, t, zocalo_h,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-ZOC-POST",
                'pieza_nombre' => 'Zócalo Posterior Continuo', 'material' => mat_estructura,
                'resistencia' => resistencia,
                'largo_bruto_mm' => ancho_total_num, 'ancho_bruto_mm' => zocalo_num, 'espesor_mm' => t_num,
                'largo_neto_mm' => ancho_total_num, 'ancho_neto_mm' => zocalo_num,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                'ranura' => 'Ninguna'
              }
            )
          end

          # 2. PISO ESTRUCTURAL DE BASE
          CabinetBuilder.crear_panel(
            grupo_matriz, 'Piso Estructural Continuo',
            0.mm, 0.mm, zocalo_h,
            ancho_total, prof_baja, t,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PISO-BASE",
              'pieza_nombre' => 'Piso Base Continuo', 'material' => mat_estructura,
              'resistencia' => resistencia,
              'largo_bruto_mm' => ancho_total_num, 'ancho_bruto_mm' => prof_baja_num, 'espesor_mm' => t_num,
              'largo_neto_mm' => ancho_total_num - 1.0, 'ancho_neto_mm' => prof_baja_num - 1.0,
              'cantidad' => 1, 'veta' => 'longitudinal',
              'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
              'ranura' => 'Ninguna'
            }
          )

          # 3. LATERALES EXTERIORES
          alto_lateral = alto_total - zocalo_h
          CabinetBuilder.crear_panel(
            grupo_matriz, 'Costado Exterior Izquierdo',
            0.mm, 0.mm, zocalo_h,
            t, prof_total, alto_lateral,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-COST-IZQ",
              'pieza_nombre' => 'Costado Exterior Izquierdo', 'material' => mat_estructura,
              'resistencia' => resistencia,
              'largo_bruto_mm' => alto_total_num - zocalo_num, 'ancho_bruto_mm' => prof_total_num, 'espesor_mm' => t_num,
              'largo_neto_mm' => alto_total_num - zocalo_num - 2.5, 'ancho_neto_mm' => prof_total_num - 1.0,
              'cantidad' => 1, 'veta' => 'longitudinal',
              'canto_L1' => 2.0, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
              'ranura' => "R (Ranura 4x#{prof_ranura_num.to_i}mm a #{dist_ranura_num.to_i}mm)"
            }
          )

          CabinetBuilder.crear_panel(
            grupo_matriz, 'Costado Exterior Derecho',
            ancho_total - t, 0.mm, zocalo_h,
            t, prof_total, alto_lateral,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-COST-DER",
              'pieza_nombre' => 'Costado Exterior Derecho', 'material' => mat_estructura,
              'resistencia' => resistencia,
              'largo_bruto_mm' => alto_total_num - zocalo_num, 'ancho_bruto_mm' => prof_total_num, 'espesor_mm' => t_num,
              'largo_neto_mm' => alto_total_num - zocalo_num - 2.5, 'ancho_neto_mm' => prof_total_num - 1.0,
              'cantidad' => 1, 'veta' => 'longitudinal',
              'canto_L1' => 2.0, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
              'ranura' => "R (Ranura 4x#{prof_ranura_num.to_i}mm a #{dist_ranura_num.to_i}mm)"
            }
          )

          # 4. TECHO SUPERIOR CONTINUO
          CabinetBuilder.crear_panel(
            grupo_matriz, 'Techo Superior Continuo',
            0.mm, 0.mm, alto_total - t,
            ancho_total, prof_alta, t,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-TECHO-SUP",
              'pieza_nombre' => 'Techo Superior Continuo', 'material' => mat_estructura,
              'resistencia' => resistencia,
              'largo_bruto_mm' => ancho_total_num, 'ancho_bruto_mm' => prof_alta_num, 'espesor_mm' => t_num,
              'largo_neto_mm' => ancho_total_num - 1.0, 'ancho_neto_mm' => prof_alta_num - 1.0,
              'cantidad' => 1, 'veta' => 'longitudinal',
              'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
              'ranura' => 'Ninguna'
            }
          )

          # 5. BASE DE ZONA ALTA / MALETEROS
          z_base_maletero = alto_total - alto_alta
          CabinetBuilder.crear_panel(
            grupo_matriz, 'Piso Divisorio Maleteros',
            t, 0.mm, z_base_maletero,
            ancho_total - (2 * t), prof_alta, t,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PISO-MALETERO",
              'pieza_nombre' => 'Piso Divisorio Maleteros', 'material' => mat_estructura,
              'resistencia' => resistencia,
              'largo_bruto_mm' => ancho_total_num - (2 * t_num), 'ancho_bruto_mm' => prof_alta_num, 'espesor_mm' => t_num,
              'largo_neto_mm' => ancho_total_num - (2 * t_num) - 2.0, 'ancho_neto_mm' => prof_alta_num - 1.0,
              'cantidad' => 1, 'veta' => 'longitudinal',
              'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
              'ranura' => 'Ninguna'
            }
          )

          # 6. DISTRIBUCIÓN DINÁMICA DE COLUMNAS (Anchos asignados por el usuario)
          columnas_config = params['columnas'] || []
          num_columnas = columnas_config.empty? ? 3 : columnas_config.length
          ancho_util_interno_num = ancho_total_num - (2 * t_num) - ((num_columnas - 1) * t_num)

          # Si el usuario mandó anchos específicos en mm, respetarlos directamente
          anchos_cols_num = []
          suma_anchos_usuario = columnas_config.map { |c| c['ancho'].to_f }.sum
          if suma_anchos_usuario > 0 && columnas_config.all? { |c| c['ancho'].to_f > 0 }
            # Escalar proporcionalmente al espacio interno exacto
            columnas_config.each do |c|
              prop = c['ancho'].to_f / suma_anchos_usuario
              anchos_cols_num << (prop * ancho_util_interno_num)
            end
          else
            # Reparto equitativo inicial
            ancho_indiv = ancho_util_interno_num / num_columnas.to_f
            num_columnas.times { anchos_cols_num << ancho_indiv }
          end

          x_acumulado = t_num

          anchos_cols_num.each_with_index do |ancho_col_num, i|
            cfg_col = columnas_config[i] || {}
            ancho_col = ancho_col_num.mm
            x_col = x_acumulado.mm

            # Parante vertical divisorio si no es la última columna
            if i < num_columnas - 1
              x_parante = (x_acumulado + ancho_col_num).mm
              CabinetBuilder.crear_panel(
                grupo_matriz, "Parante Divisorio #{i + 1}",
                x_parante, 0.mm, zocalo_h + t,
                t, prof_baja, alto_lateral - t - t,
                {
                  'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PARANTE-#{i + 1}",
                  'pieza_nombre' => "Parante Divisorio #{i + 1}", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => alto_total_num - zocalo_num - (2 * t_num), 'ancho_bruto_mm' => prof_baja_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => alto_total_num - zocalo_num - (2 * t_num) - 2.0, 'ancho_neto_mm' => prof_baja_num - 1.0,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 2.0, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                  'ranura' => 'Ninguna'
                }
              )
            end

            # Configuración de tipología por celda según el usuario
            tipo_alta  = cfg_col['alta']  || 'maletero_piston'
            tipo_media = cfg_col['media'] || 'repisas'
            tipo_baja  = cfg_col['baja']  || 'cajonera'

            # Poblar Zona Alta
            poblar_zona_alta(grupo_matriz, modulo_id, tipo_alta, x_col, ancho_col, ancho_col_num, z_base_maletero + t, alto_alta - (2 * t), prof_alta, prof_alta_num, t, t_num, luz_frentes_num, tipo_montaje, mat_estructura, mat_frentes, resistencia)

            # Poblar Zona Media
            z_inicio_media = zocalo_h + t + alto_baja
            poblar_zona_media(grupo_matriz, modulo_id, tipo_media, x_col, ancho_col, ancho_col_num, z_inicio_media, alto_media, prof_media, prof_media_num, t, t_num, mat_estructura, mat_frentes, resistencia)

            # Poblar Zona Baja
            poblar_zona_baja(grupo_matriz, modulo_id, tipo_baja, x_col, ancho_col, ancho_col_num, zocalo_h + t, alto_baja, prof_baja, prof_baja_num, t, t_num, luz_frentes_num, tipo_montaje, tipo_corredera, mat_estructura, mat_frentes, resistencia)

            x_acumulado += ancho_col_num + t_num
          end

          # Inyectar Fondo MDF con ranura y N amarres traseros configurados dinámicamente
          if params['fondo_activo'] != false
            GrooveManager.apply({
              'tipo' => params['mdf_metodo'] || 'ranura',
              'prof_ranura' => prof_ranura_num,
              'dist_ranura' => dist_ranura_num,
              'espesor_fondo' => (params['espesor_mdf'] || 3.0).to_f,
              'cantidad_amarres' => cant_amarres
            })
          end

          model.commit_operation
          CabinetBuilder.ultimo_modulo_activo = grupo_matriz
          {
            'ok' => true,
            'mensaje' => "Matriz modular de #{num_columnas} columnas x 3 zonas construida con éxito (#{ancho_total_num.to_i}x#{alto_total_num.to_i}x#{prof_total_num.to_i}mm).",
            'modulo_id' => modulo_id
          }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => "Error al generar matriz dinámica: #{e.message}" }
        end
      end

      private

      # ========================================================================
      # Sub-método: poblar_zona_alta (Dinámico)
      # ========================================================================
      def poblar_zona_alta(parent, modulo_id, tipo, x, ancho, ancho_num, z, alto, prof, prof_num, t, t_num, luz_mm, montaje, mat_est, mat_fre, resistencia)
        return if tipo == 'vacio' || tipo == 'ninguno'

        grupo_alta = parent.entities.add_group
        grupo_alta.name = "Zona Alta [#{tipo.capitalize} #{ancho_num.to_i}mm]"

        alto_puerta_num = alto.to_mm - (2 * luz_mm)
        ancho_puerta_num = ancho_num - (2 * luz_mm)

        panel_puerta = grupo_alta.entities.add_group
        panel_puerta.name = "Frente Zona Alta (#{tipo})"

        pts = [
          Geom::Point3d.new(x + luz_mm.mm, -t, z + luz_mm.mm),
          Geom::Point3d.new(x + luz_mm.mm + ancho_puerta_num.mm, -t, z + luz_mm.mm),
          Geom::Point3d.new(x + luz_mm.mm + ancho_puerta_num.mm, 0.mm, z + luz_mm.mm),
          Geom::Point3d.new(x + luz_mm.mm, 0.mm, z + luz_mm.mm)
        ]
        face = panel_puerta.entities.add_face(pts)
        face.reverse! if face.normal.z < 0
        face.pushpull(alto_puerta_num.mm)

        su_mat = MaterialManager.obtener_o_crear_material_su(parent.model, mat_fre, resistencia)
        panel_puerta.material = su_mat if su_mat

        dict = panel_puerta.attribute_dictionary('DespieceMela', true)
        dict['modulo_id'] = modulo_id
        dict['pieza_id'] = "#{modulo_id}-ALTA-#{x.to_mm.to_i}"
        dict['pieza_nombre'] = "Puerta Alta #{tipo.capitalize}"
        dict['material'] = mat_fre
        dict['resistencia'] = resistencia
        dict['espesor_mm'] = t_num
        dict['largo_bruto_mm'] = alto_puerta_num
        dict['ancho_bruto_mm'] = ancho_puerta_num
        dict['largo_neto_mm'] = alto_puerta_num - 4.0
        dict['ancho_neto_mm'] = ancho_puerta_num - 4.0
        dict['canto_L1'] = 2.0; dict['canto_L2'] = 2.0; dict['canto_A1'] = 2.0; dict['canto_A2'] = 2.0
        dict['cantidad'] = 1
        dict['Tipo_Montaje'] = montaje
        dict['Luz_Frente'] = luz_mm

        # Cinemática según tipo
        if tipo =~ /piston/i
          dict['Tipo_Herraje'] = 'piston_gas_superior'
        else
          dict['Tipo_Herraje'] = 'bisagra_batiente'
          dict['Lado_Bisagra'] = 'izquierdo'
        end
        dict['Transformacion_Original'] = panel_puerta.transformation.to_a.to_json
      end

      # ========================================================================
      # Sub-método: poblar_zona_media (Dinámico)
      # ========================================================================
      def poblar_zona_media(parent, modulo_id, tipo, x, ancho, ancho_num, z, alto, prof, prof_num, t, t_num, mat_est, mat_fre, resistencia)
        return if tipo == 'vacio' || tipo == 'ninguno'

        case tipo
        when 'nicho_tv', 'panel_cables'
          # Panel falso retraído para cableado
          fondo_retraido = 40.mm
          CabinetBuilder.crear_panel(
            parent, "Panel Falso TV Pasacables",
            x, prof - fondo_retraido - t, z,
            ancho, t, alto,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PANEL-TV-#{x.to_mm.to_i}",
              'pieza_nombre' => "Panel Falso Pasacables TV", 'material' => mat_est,
              'resistencia' => resistencia,
              'largo_bruto_mm' => alto.to_mm, 'ancho_bruto_mm' => ancho_num, 'espesor_mm' => t_num,
              'largo_neto_mm' => alto.to_mm - 1.0, 'ancho_neto_mm' => ancho_num - 1.0,
              'cantidad' => 1, 'veta' => 'longitudinal',
              'canto_L1' => 0.5, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
              'ranura' => 'Ranura Pasacables 200x30mm'
            }
          )
        when 'espejo_tocador'
          # Panel para espejo con luz LED perimetral neutra
          CabinetBuilder.crear_panel(
            parent, "Panel Espejo Tocador LED",
            x, prof - 20.mm - t, z,
            ancho, t, alto,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-ESPEJO-#{x.to_mm.to_i}",
              'pieza_nombre' => "Panel Soporte Espejo LED", 'material' => mat_est,
              'resistencia' => resistencia,
              'largo_bruto_mm' => alto.to_mm, 'ancho_bruto_mm' => ancho_num, 'espesor_mm' => t_num,
              'largo_neto_mm' => alto.to_mm - 1.0, 'ancho_neto_mm' => ancho_num - 1.0,
              'cantidad' => 1, 'veta' => 'longitudinal',
              'canto_L1' => 0.5, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
              'ranura' => 'Ranura Perfil LED 17x7mm Perimetral'
            }
          )
        else # 'repisas', 'librero'
          num_rep = 2
          paso = alto / (num_rep + 1)
          num_rep.times do |r|
            z_rep = z + (paso * (r + 1))
            CabinetBuilder.crear_panel(
              parent, "Repisa Intermedia #{r + 1}",
              x, 0.mm, z_rep,
              ancho, prof - 10.mm, t,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-REPI-#{x.to_mm.to_i}-#{r + 1}",
                'pieza_nombre' => "Repisa Abierta #{ancho_num.to_i}mm", 'material' => mat_est,
                'resistencia' => resistencia,
                'largo_bruto_mm' => ancho_num, 'ancho_bruto_mm' => prof_num - 10.0, 'espesor_mm' => t_num,
                'largo_neto_mm' => ancho_num - 2.0, 'ancho_neto_mm' => prof_num - 11.0,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 2.0, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                'ranura' => 'Ninguna'
              }
            )
          end
        end
      end

      # ========================================================================
      # Sub-método: poblar_zona_baja (Dinámico)
      # ========================================================================
      def poblar_zona_baja(parent, modulo_id, tipo, x, ancho, ancho_num, z, alto, prof, prof_num, t, t_num, luz_mm, montaje, tipo_corr, mat_est, mat_fre, resistencia)
        return if tipo == 'vacio' || tipo == 'ninguno'

        case tipo
        when 'mesa_escritorio', 'mesa_gamer'
          espesor_mesa = (ancho_num >= 1000.0 || tipo == 'mesa_gamer') ? (t * 2) : t
          espesor_mesa_num = (ancho_num >= 1000.0 || tipo == 'mesa_gamer') ? (t_num * 2) : t_num

          CabinetBuilder.crear_panel(
            parent, "Mesa Cubierta #{ancho_num.to_i}mm",
            x, 0.mm, z + alto - espesor_mesa,
            ancho, prof, espesor_mesa,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-MESA-#{x.to_mm.to_i}",
              'pieza_nombre' => "Cubierta de Mesa #{espesor_mesa_num.to_i}mm", 'material' => mat_fre,
              'resistencia' => resistencia,
              'largo_bruto_mm' => ancho_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => espesor_mesa_num,
              'largo_neto_mm' => ancho_num - 4.0, 'ancho_neto_mm' => prof_num - 4.0,
              'cantidad' => 1, 'veta' => 'longitudinal',
              'canto_L1' => 2.0, 'canto_L2' => 2.0, 'canto_A1' => 2.0, 'canto_A2' => 2.0,
              'ranura' => 'Ninguna'
            }
          )

          # Faldón estructural
          CabinetBuilder.crear_panel(
            parent, "Faldón Arriostrador",
            x, prof - 80.mm, z + alto - espesor_mesa - 300.mm,
            ancho, t, 300.mm,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-FALDON-#{x.to_mm.to_i}",
              'pieza_nombre' => "Faldón Anti-Bamboleo", 'material' => mat_est,
              'resistencia' => resistencia,
              'largo_bruto_mm' => ancho_num, 'ancho_bruto_mm' => 300.0, 'espesor_mm' => t_num,
              'largo_neto_mm' => ancho_num - 1.0, 'ancho_neto_mm' => 299.0,
              'cantidad' => 1, 'veta' => 'longitudinal',
              'canto_L1' => 0.5, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
              'ranura' => 'Ninguna'
            }
          )

        when 'cajonera', 'cajones'
          cant_cajones = 3
          paso_cajon = alto / cant_cajones
          alto_frente_num = (alto.to_mm / cant_cajones) - (2 * luz_mm)
          ancho_frente_num = ancho_num - (2 * luz_mm)

          cant_cajones.times do |c|
            grupo_cajon = parent.entities.add_group
            grupo_cajon.name = "Cajón #{c + 1} [#{ancho_num.to_i}mm]"

            z_caj = z + (paso_cajon * c) + luz_mm.mm

            pts = [
              Geom::Point3d.new(x + luz_mm.mm, -t, z_caj),
              Geom::Point3d.new(x + luz_mm.mm + ancho_frente_num.mm, -t, z_caj),
              Geom::Point3d.new(x + luz_mm.mm + ancho_frente_num.mm, 0.mm, z_caj),
              Geom::Point3d.new(x + luz_mm.mm, 0.mm, z_caj)
            ]
            f_face = grupo_cajon.entities.add_face(pts)
            f_face.reverse! if f_face.normal.z < 0
            f_face.pushpull(alto_frente_num.mm)

            su_mat = MaterialManager.obtener_o_crear_material_su(parent.model, mat_fre, resistencia)
            grupo_cajon.material = su_mat if su_mat

            dict = grupo_cajon.attribute_dictionary('DespieceMela', true)
            dict['modulo_id'] = modulo_id
            dict['pieza_id'] = "#{modulo_id}-CAJ-#{x.to_mm.to_i}-#{c + 1}"
            dict['pieza_nombre'] = "Frente Cajón #{c + 1}"
            dict['material'] = mat_fre
            dict['resistencia'] = resistencia
            dict['espesor_mm'] = t_num
            dict['largo_bruto_mm'] = ancho_frente_num
            dict['ancho_bruto_mm'] = alto_frente_num
            dict['largo_neto_mm'] = ancho_frente_num - 4.0
            dict['ancho_neto_mm'] = alto_frente_num - 4.0
            dict['canto_L1'] = 2.0; dict['canto_L2'] = 2.0; dict['canto_A1'] = 2.0; dict['canto_A2'] = 2.0
            dict['cantidad'] = 1
            dict['Tipo_Montaje'] = montaje
            dict['Luz_Frente'] = luz_mm
            dict['Tipo_Herraje'] = 'corredera_telescopica'
            dict['Profundidad_Corredera'] = prof_num - 50.0
            dict['Transformacion_Original'] = grupo_cajon.transformation.to_a.to_json
          end

        when 'puertas_bajas'
          alto_p_num = alto.to_mm - (2 * luz_mm)
          ancho_p_num = (ancho_num - (3 * luz_mm)) / 2.0

          2.times do |p_idx|
            x_p = x + luz_mm.mm + (p_idx * (ancho_p_num + luz_mm).mm)
            panel_p = parent.entities.add_group
            panel_p.name = "Puerta Baja #{p_idx + 1}"

            pts = [
              Geom::Point3d.new(x_p, -t, z + luz_mm.mm),
              Geom::Point3d.new(x_p + ancho_p_num.mm, -t, z + luz_mm.mm),
              Geom::Point3d.new(x_p + ancho_p_num.mm, 0.mm, z + luz_mm.mm),
              Geom::Point3d.new(x_p, 0.mm, z + luz_mm.mm)
            ]
            face = panel_p.entities.add_face(pts)
            face.reverse! if face.normal.z < 0
            face.pushpull(alto_p_num.mm)

            su_mat = MaterialManager.obtener_o_crear_material_su(parent.model, mat_fre, resistencia)
            panel_p.material = su_mat if su_mat

            dict = panel_p.attribute_dictionary('DespieceMela', true)
            dict['modulo_id'] = modulo_id
            dict['pieza_id'] = "#{modulo_id}-PTA-BAJA-#{x.to_mm.to_i}-#{p_idx + 1}"
            dict['pieza_nombre'] = "Puerta Baja #{p_idx + 1}"
            dict['material'] = mat_fre
            dict['resistencia'] = resistencia
            dict['espesor_mm'] = t_num
            dict['largo_bruto_mm'] = alto_p_num
            dict['ancho_bruto_mm'] = ancho_p_num
            dict['largo_neto_mm'] = alto_p_num - 4.0
            dict['ancho_neto_mm'] = ancho_p_num - 4.0
            dict['canto_L1'] = 2.0; dict['canto_L2'] = 2.0; dict['canto_A1'] = 2.0; dict['canto_A2'] = 2.0
            dict['cantidad'] = 1
            dict['Tipo_Montaje'] = montaje
            dict['Tipo_Herraje'] = 'bisagra_batiente'
            dict['Lado_Bisagra'] = (p_idx == 0) ? 'izquierdo' : 'derecho'
            dict['Transformacion_Original'] = panel_p.transformation.to_a.to_json
          end
        end
      end

      # ========================================================================
      # Método: construir_modulos_parametricos
      # Descripción: Modela en SketchUp 3D una composición de N módulos individuales
      #              colocados de forma consecutiva según las especificaciones técnicas:
      #              - Anchos recalculados cuya suma iguala el ancho total
      #              - Alturas y profundidades individuales por módulo
      #              - Zócalos independientes con altura y número de listones configurables
      #              - Equipamiento interno (repisas, cajoneras y puertas) con cotas milimétricas
      # Parámetros:
      #   - params (Hash): Estructura enviada desde el panel web de JPQMelaminaPro.
      # ========================================================================
      def construir_modulos_parametricos(params)
        model = Sketchup.active_model
        return { 'ok' => false, 'error' => 'No hay un modelo activo en SketchUp.' } unless model

        model.start_operation('JPQMelaminaPro: Construcción Modular Paramétrica', true)

        begin
          ancho_total_num = params['ancho_total'].to_f
          alto_total_num  = params['alto_total'].to_f
          prof_total_num  = params['prof_total'].to_f
          t_num           = (params['espesor'] && params['espesor'].to_f > 0) ? params['espesor'].to_f : 18.0
          t               = t_num.mm

          mat_estructura = params['material_estructura'] || 'Pelikano Bellota 18mm'
          mat_frentes    = params['material_frentes'] || mat_estructura
          resistencia    = params['resistencia'] || 'Normal'
          composicion_id = params['composicion_id'] || "COMP-MOD-#{Time.now.to_i % 10000}"

          modulos_data = params['modulos'] || []
          if modulos_data.empty?
            # Generar un módulo por defecto si la lista viene vacía
            modulos_data = [{
              'id' => 1, 'nombre' => 'Módulo 1',
              'ancho' => ancho_total_num, 'alto' => alto_total_num, 'profundidad' => prof_total_num,
              'tiene_zocalo' => true, 'alto_zocalo' => 100.0, 'cant_listones' => 2,
              'tipo_interior' => 'repisas', 'cant_repisas' => 2
            }]
          end

          # Grupo contenedor principal en SketchUp
          grupo_composicion = model.active_entities.add_group
          grupo_composicion.name = "Mueble Modular #{ancho_total_num.to_i}x#{alto_total_num.to_i}x#{prof_total_num.to_i}mm (#{modulos_data.length} Módulos)"

          dict_comp = grupo_composicion.attribute_dictionary('DespieceMelaModulo', true)
          dict_comp['modulo_id'] = composicion_id
          dict_comp['tipo'] = 'composicion_modular'
          dict_comp['ancho_mm'] = ancho_total_num
          dict_comp['alto_mm'] = alto_total_num
          dict_comp['prof_mm'] = prof_total_num
          dict_comp['espesor_mm'] = t_num
          dict_comp['resistencia'] = resistencia
          dict_comp['material'] = mat_estructura

          x_acumulado = 0.0

          modulos_data.each_with_index do |m_data, idx|
            w_mod_num = m_data['ancho'].to_f
            h_mod_num = (m_data['alto'] && m_data['alto'].to_f > 0) ? m_data['alto'].to_f : alto_total_num
            d_mod_num = (m_data['profundidad'] && m_data['profundidad'].to_f > 0) ? m_data['profundidad'].to_f : prof_total_num

            w_mod = w_mod_num.mm
            h_mod = h_mod_num.mm
            d_mod = d_mod_num.mm
            x_pos = x_acumulado.mm

            mod_id = "#{composicion_id}-M#{idx + 1}"
            grupo_mod = grupo_composicion.entities.add_group
            grupo_mod.name = "Módulo #{idx + 1} [#{w_mod_num.to_i}x#{h_mod_num.to_i}x#{d_mod_num.to_i}mm]"

            dict_mod = grupo_mod.attribute_dictionary('DespieceMelaModulo', true)
            dict_mod['modulo_id'] = mod_id
            dict_mod['tipo'] = 'modulo_individual'
            dict_mod['indice'] = idx + 1
            dict_mod['ancho_mm'] = w_mod_num
            dict_mod['alto_mm'] = h_mod_num
            dict_mod['prof_mm'] = d_mod_num
            dict_mod['espesor_mm'] = t_num

            # A. Zócalo y Listones
            tiene_zocalo = m_data['tiene_zocalo'] == true || m_data['tiene_zocalo'] == 'true'
            zocalo_h_num = tiene_zocalo ? (m_data['alto_zocalo'] || 100.0).to_f : 0.0
            zocalo_h = zocalo_h_num.mm
            cant_listones = (m_data['cant_listones'] || 2).to_i
            retrans_zocalo = 35.0.mm

            if tiene_zocalo && zocalo_h_num > 0
              # Listón Frontal
              CabinetBuilder.crear_panel(
                grupo_mod, "M#{idx + 1} Zócalo Frontal",
                x_pos, retrans_zocalo, 0.mm,
                w_mod, t, zocalo_h,
                {
                  'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-ZOC-FRONT",
                  'pieza_nombre' => "M#{idx + 1} Zócalo Frontal", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => w_mod_num, 'ancho_bruto_mm' => zocalo_h_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => w_mod_num - 1.0, 'ancho_neto_mm' => zocalo_h_num - 1.0,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                  'ranura' => 'Ninguna'
                }
              )

              # Listón Posterior
              CabinetBuilder.crear_panel(
                grupo_mod, "M#{idx + 1} Zócalo Posterior",
                x_pos, d_mod - t - retrans_zocalo, 0.mm,
                w_mod, t, zocalo_h,
                {
                  'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-ZOC-POST",
                  'pieza_nombre' => "M#{idx + 1} Zócalo Posterior", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => w_mod_num, 'ancho_bruto_mm' => zocalo_h_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => w_mod_num, 'ancho_neto_mm' => zocalo_h_num,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                  'ranura' => 'Ninguna'
                }
              )

              # Listones Transversales de Refuerzo (si cant_listones >= 3)
              if cant_listones >= 3
                largo_trans_num = d_mod_num - (2 * 35.0) - (2 * t_num)
                largo_trans = largo_trans_num.mm
                x_trans = x_pos + (w_mod / 2.0) - (t / 2.0)
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Listón Transversal",
                  x_trans, retrans_zocalo + t, 0.mm,
                  t, largo_trans, zocalo_h,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-LISTON-TRANS",
                    'pieza_nombre' => "M#{idx + 1} Listón Refuerzo Zócalo", 'material' => mat_estructura,
                    'resistencia' => resistencia,
                    'largo_bruto_mm' => largo_trans_num, 'ancho_bruto_mm' => zocalo_h_num, 'espesor_mm' => t_num,
                    'largo_neto_mm' => largo_trans_num, 'ancho_neto_mm' => zocalo_h_num,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                    'ranura' => 'Ninguna'
                  }
                )
              end
            end

            # B. Carcasa del Módulo (Laterales, Piso y Techo)
            h_carcasa_num = h_mod_num - zocalo_h_num
            h_carcasa = h_carcasa_num.mm
            z_base = zocalo_h

            # Costado Izquierdo
            CabinetBuilder.crear_panel(
              grupo_mod, "M#{idx + 1} Costado Izquierdo",
              x_pos, 0.mm, z_base,
              t, d_mod, h_carcasa,
              {
                'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-LAT-IZQ",
                'pieza_nombre' => "M#{idx + 1} Costado Izquierdo", 'material' => mat_estructura,
                'resistencia' => resistencia,
                'largo_bruto_mm' => h_carcasa_num, 'ancho_bruto_mm' => d_mod_num, 'espesor_mm' => t_num,
                'largo_neto_mm' => h_carcasa_num - 2.5, 'ancho_neto_mm' => d_mod_num - 1.0,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 2.0, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                'ranura' => 'Ninguna'
              }
            )

            # Costado Derecho
            CabinetBuilder.crear_panel(
              grupo_mod, "M#{idx + 1} Costado Derecho",
              x_pos + w_mod - t, 0.mm, z_base,
              t, d_mod, h_carcasa,
              {
                'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-LAT-DER",
                'pieza_nombre' => "M#{idx + 1} Costado Derecho", 'material' => mat_estructura,
                'resistencia' => resistencia,
                'largo_bruto_mm' => h_carcasa_num, 'ancho_bruto_mm' => d_mod_num, 'espesor_mm' => t_num,
                'largo_neto_mm' => h_carcasa_num - 2.5, 'ancho_neto_mm' => d_mod_num - 1.0,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 2.0, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                'ranura' => 'Ninguna'
              }
            )

            # Piso de la Carcasa
            ancho_int_num = w_mod_num - (2 * t_num)
            ancho_int = ancho_int_num.mm
            CabinetBuilder.crear_panel(
              grupo_mod, "M#{idx + 1} Piso Carcasa",
              x_pos + t, 0.mm, z_base,
              ancho_int, d_mod, t,
              {
                'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-PISO",
                'pieza_nombre' => "M#{idx + 1} Piso Carcasa", 'material' => mat_estructura,
                'resistencia' => resistencia,
                'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => d_mod_num, 'espesor_mm' => t_num,
                'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => d_mod_num - 1.0,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                'ranura' => 'Ninguna'
              }
            )

            # Techo de la Carcasa / Amarres de Techo
            tiene_amarre = m_data['tiene_liston_amarre'] == true || m_data['tiene_liston_amarre'] == 'true'
            pos_amarre = m_data['posicion_liston_amarre'] || 'posterior' # 'posterior', 'techo', 'ambos'
            h_amarre_num = (m_data['alto_liston_amarre'] && m_data['alto_liston_amarre'].to_f >= 50.0) ? m_data['alto_liston_amarre'].to_f : 80.0
            cant_amarre = (m_data['cant_listones_amarre'] || 2).to_i

            usa_amarres_techo = tiene_amarre && (pos_amarre == 'techo' || pos_amarre == 'ambos')

            if usa_amarres_techo
              # Amarre Frontal de Techo (Estándar muebles bajos para encimera)
              CabinetBuilder.crear_panel(
                grupo_mod, "M#{idx + 1} Amarre Techo Frontal",
                x_pos + t, 0.mm, z_base + h_carcasa - t,
                ancho_int, h_amarre_num.mm, t,
                {
                  'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-AMARRE-TECH-FRONT",
                  'pieza_nombre' => "M#{idx + 1} Amarre Techo Frontal", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => h_amarre_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => h_amarre_num - 1.0,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 2.0, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                  'ranura' => 'Ninguna'
                }
              )

              # Amarre Posterior de Techo
              CabinetBuilder.crear_panel(
                grupo_mod, "M#{idx + 1} Amarre Techo Posterior",
                x_pos + t, d_mod - h_amarre_num.mm, z_base + h_carcasa - t,
                ancho_int, h_amarre_num.mm, t,
                {
                  'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-AMARRE-TECH-POST",
                  'pieza_nombre' => "M#{idx + 1} Amarre Techo Posterior", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => h_amarre_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => h_amarre_num - 1.0,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 0.5, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                  'ranura' => 'Ninguna'
                }
              )

              # Techo / Tapa Sobrepuesta colocada sobre los listones de amarre
              if m_data['techo_sobre_liston'] == true || m_data['techo_sobre_liston'] == 'true'
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Techo Sobrepuesto",
                  x_pos, 0.mm, z_base + h_carcasa,
                  w_mod, d_mod, t,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-TECHO-SOBREPUESTO",
                    'pieza_nombre' => "M#{idx + 1} Tapa Techo Sobrepuesta", 'material' => mat_estructura,
                    'resistencia' => resistencia,
                    'largo_bruto_mm' => w_mod_num, 'ancho_bruto_mm' => d_mod_num, 'espesor_mm' => t_num,
                    'largo_neto_mm' => w_mod_num - 1.0, 'ancho_neto_mm' => d_mod_num - 1.0,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 2.0, 'canto_L2' => 2.0, 'canto_A1' => 2.0, 'canto_A2' => 2.0,
                    'ranura' => 'Ninguna'
                  }
                )
              end
            else
              # Techo Sólido Completo Estándar
              CabinetBuilder.crear_panel(
                grupo_mod, "M#{idx + 1} Techo Carcasa",
                x_pos + t, 0.mm, z_base + h_carcasa - t,
                ancho_int, d_mod, t,
                {
                  'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-TECHO",
                  'pieza_nombre' => "M#{idx + 1} Techo Carcasa", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => d_mod_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => d_mod_num - 1.0,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                  'ranura' => 'Ninguna'
                }
              )
            end

            # Listones Posteriores de Amarre / Fijación a Pared
            usa_amarres_post = tiene_amarre && (pos_amarre == 'posterior' || pos_amarre == 'ambos')
            if usa_amarres_post
              # Listón Superior Posterior
              CabinetBuilder.crear_panel(
                grupo_mod, "M#{idx + 1} Listón Posterior Superior",
                x_pos + t, d_mod - t, z_base + h_carcasa - t - h_amarre_num.mm,
                ancho_int, t, h_amarre_num.mm,
                {
                  'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-LISTON-POST-SUP",
                  'pieza_nombre' => "M#{idx + 1} Listón Amarre Posterior Superior", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => h_amarre_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => h_amarre_num - 1.0,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                  'ranura' => 'Ninguna'
                }
              )

              # Listón Inferior Posterior (si cant_amarre >= 2)
              if cant_amarre >= 2
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Listón Posterior Inferior",
                  x_pos + t, d_mod - t, z_base + t,
                  ancho_int, t, h_amarre_num.mm,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-LISTON-POST-INF",
                    'pieza_nombre' => "M#{idx + 1} Listón Amarre Posterior Inferior", 'material' => mat_estructura,
                    'resistencia' => resistencia,
                    'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => h_amarre_num, 'espesor_mm' => t_num,
                    'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => h_amarre_num - 1.0,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                    'ranura' => 'Ninguna'
                  }
                )
              end
            end

            # D. Fondo Posterior de MDF (3mm) y Ranurado Perimetral Estándar
            tiene_fondo = m_data['tiene_fondo_mdf'] == true || m_data['tiene_fondo_mdf'] == 'true'
            pos_fondo = m_data['posicion_fondo_mdf'] || 'delante_liston' # 'delante_liston' o 'detras_liston'
            mat_fondos = params['material_fondos'] || 'MDF Fondo Blanco 3mm'

            if tiene_fondo
              if pos_fondo == 'delante_liston'
                # Ranura estándar: 4mm de ancho, 8mm de profundidad, a t mm del borde posterior
                # Medida neta del fondo MDF: vano interior + 14mm (7mm de penetración por lado)
                ancho_mdf_num = ancho_int_num + 14.0
                alto_mdf_num  = h_carcasa_num - (2 * t_num) + 14.0
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Fondo MDF Ranurado 3mm",
                  x_pos + t - 7.0.mm, d_mod - t - 3.0.mm, z_base + t - 7.0.mm,
                  ancho_mdf_num.mm, 3.0.mm, alto_mdf_num.mm,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-FONDO-MDF-RAN",
                    'pieza_nombre' => "M#{idx + 1} Fondo MDF Ranurado", 'material' => mat_fondos,
                    'resistencia' => 'Normal',
                    'largo_bruto_mm' => alto_mdf_num, 'ancho_bruto_mm' => ancho_mdf_num, 'espesor_mm' => 3.0,
                    'largo_neto_mm' => alto_mdf_num, 'ancho_neto_mm' => ancho_mdf_num,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                    'ranura' => "Incrustado en ranura 4x8mm a #{t_num.to_i}mm"
                  }
                )
              else
                # Fondo sobrepuesto / clavado por detrás del listón
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Fondo MDF Sobrepuesto 3mm",
                  x_pos, d_mod, z_base,
                  w_mod, 3.0.mm, h_carcasa,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-FONDO-MDF-SOBRE",
                    'pieza_nombre' => "M#{idx + 1} Fondo MDF Sobrepuesto", 'material' => mat_fondos,
                    'resistencia' => 'Normal',
                    'largo_bruto_mm' => h_carcasa_num, 'ancho_bruto_mm' => w_mod_num, 'espesor_mm' => 3.0,
                    'largo_neto_mm' => h_carcasa_num, 'ancho_neto_mm' => w_mod_num,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                    'ranura' => 'Sobrepuesto clavado'
                  }
                )
              end
            end

            # C. Componentes Interiores (Repisas, Cajones o Puertas)
            tipo_interior = m_data['tipo_interior'] || 'repisas'
            h_vano_util_num = h_carcasa_num - (2 * t_num)
            h_vano_util = h_vano_util_num.mm

            case tipo_interior
            when 'repisas'
              cant_rep = (m_data['cant_repisas'] || 2).to_i
              if cant_rep > 0
                paso_rep_num = h_vano_util_num / (cant_rep + 1.0)
                prof_rep_num = d_mod_num - 20.0
                cant_rep.times do |r_idx|
                  z_rep = z_base + t + ((r_idx + 1) * paso_rep_num).mm
                  CabinetBuilder.crear_panel(
                    grupo_mod, "M#{idx + 1} Repisa #{r_idx + 1}",
                    x_pos + t, 20.0.mm, z_rep,
                    ancho_int, prof_rep_num.mm, t,
                    {
                      'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-REP-#{r_idx + 1}",
                      'pieza_nombre' => "M#{idx + 1} Repisa #{r_idx + 1}", 'material' => mat_estructura,
                      'resistencia' => resistencia,
                      'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_rep_num, 'espesor_mm' => t_num,
                      'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => prof_rep_num - 1.0,
                      'cantidad' => 1, 'veta' => 'longitudinal',
                      'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                      'ranura' => 'Ninguna'
                    }
                  )
                end
              end

            when 'cajonera'
              cant_caj = (m_data['cant_cajones'] || 3).to_i
              alto_frente_caj_num = (h_vano_util_num - (cant_caj * 3.0)) / cant_caj.to_f
              cant_caj.times do |c_idx|
                z_frente = z_base + t + 3.0.mm + (c_idx * (alto_frente_caj_num + 3.0)).mm
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Frente Cajón #{c_idx + 1}",
                  x_pos + t + 3.0.mm, 0.mm, z_frente,
                  (ancho_int_num - 6.0).mm, t, alto_frente_caj_num.mm,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-FR-CAJ-#{c_idx + 1}",
                    'pieza_nombre' => "M#{idx + 1} Frente Cajón #{c_idx + 1}", 'material' => mat_frentes,
                    'resistencia' => resistencia,
                    'largo_bruto_mm' => ancho_int_num - 6.0, 'ancho_bruto_mm' => alto_frente_caj_num, 'espesor_mm' => t_num,
                    'largo_neto_mm' => ancho_int_num - 10.0, 'ancho_neto_mm' => alto_frente_caj_num - 4.0,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 2.0, 'canto_L2' => 2.0, 'canto_A1' => 2.0, 'canto_A2' => 2.0,
                    'ranura' => 'Ninguna'
                  }
                )
              end

            when 'puertas'
              cant_p = (w_mod_num > 600.0) ? 2 : 1
              luz_mm = 2.0
              alto_p_num = h_carcasa_num - (2 * luz_mm)
              ancho_p_num = (cant_p == 2) ? ((w_mod_num - (3 * luz_mm)) / 2.0) : (w_mod_num - (2 * luz_mm))

              cant_p.times do |p_idx|
                x_p = x_pos + luz_mm.mm + (p_idx * (ancho_p_num + luz_mm).mm)
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Puerta #{p_idx + 1}",
                  x_p, -t, z_base + luz_mm.mm,
                  ancho_p_num.mm, t, alto_p_num.mm,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-PTA-#{p_idx + 1}",
                    'pieza_nombre' => "M#{idx + 1} Puerta #{p_idx + 1}", 'material' => mat_frentes,
                    'resistencia' => resistencia,
                    'largo_bruto_mm' => alto_p_num, 'ancho_bruto_mm' => ancho_p_num, 'espesor_mm' => t_num,
                    'largo_neto_mm' => alto_p_num - 4.0, 'ancho_neto_mm' => ancho_p_num - 4.0,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 2.0, 'canto_L2' => 2.0, 'canto_A1' => 2.0, 'canto_A2' => 2.0,
                    'ranura' => 'Ninguna'
                  }
                )
              end
            end

            x_acumulado += w_mod_num
          end

          model.commit_operation
          { 'ok' => true, 'mensaje' => "Composición modular de #{modulos_data.length} módulos creada exitosamente.", 'modulo_id' => composicion_id }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => "#{e.message} (en #{File.basename(e.backtrace.first)})", 'backtrace' => e.backtrace }
        end
      end
    end
  end
end
