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

# Forzar recarga dinámica de cabinet_builder para asegurar visibilidad de crear_panel
begin
  load File.join(__dir__, 'cabinet_builder.rb')
rescue => _e
end

# Registro diagnóstico automático al cargar el archivo en SketchUp
begin
  log_path = File.join(ENV['APPDATA'] || 'C:/Users/jorge/AppData/Roaming', 'SketchUp', 'jpq_debug.log')
  File.open(log_path, 'a') { |f| f.puts("[#{Time.now}] spatial_matrix_builder.rb CARGADO con éxito en Ruby") }
rescue => _e
  # Ignorar si no se puede escribir
end

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

      public

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
        log_path = File.join(ENV['APPDATA'] || 'C:/Users/jorge/AppData/Roaming', 'SketchUp', 'jpq_debug.log')
        File.open(log_path, 'a') do |f|
          f.puts("\n=======================================================")
          f.puts("[#{Time.now}] INICIO construir_modulos_parametricos")
          f.puts("Parametros recibidos: #{params.inspect rescue 'error'}")
        end

        model = Sketchup.active_model
        unless model
          File.open(log_path, 'a') { |f| f.puts("[#{Time.now}] ERROR: No hay un modelo activo en SketchUp.") }
          UI.messagebox("JPQMelaminaPro: No hay un modelo activo en SketchUp.")
          return { 'ok' => false, 'error' => 'No hay un modelo activo en SketchUp.' }
        end

        model.start_operation('JPQMelaminaPro: Construcción Modular Paramétrica', true)

        begin
          ancho_total_num = params['ancho_total'].to_f
          alto_total_num  = params['alto_total'].to_f
          prof_total_num  = params['prof_total'].to_f
          t_num           = (params['espesor'] && params['espesor'].to_f > 0) ? params['espesor'].to_f : 18.0
          t               = t_num.mm
          ancho_total     = ancho_total_num.mm
          alto_total      = alto_total_num.mm
          prof_total      = prof_total_num.mm

          mat_estructura = params['material_estructura'] || 'Pelikano Blanco Nieve 18mm'
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
              'tipo_interior' => 'carcasa', 'cant_repisas' => 0
            }]
          end

          # Grupo contenedor principal en SketchUp (soporta edición paramétrica in-place)
          es_edicion = params['target_group'] && params['target_group'].valid?
          if es_edicion
            grupo_composicion = params['target_group']
            grupo_composicion.entities.clear!
          else
            grupo_composicion = model.active_entities.add_group
          end
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
          dict_comp['params_json'] = JSON.generate(params)
          dict_comp['modulos_json'] = JSON.generate(modulos_data)

          CabinetBuilder.ultimo_modulo_activo = grupo_composicion if defined?(CabinetBuilder)

          # 1. ZÓCALO INFERIOR CONTINUO GENERAL (Ocupa todo el perímetro inferior del mueble)
          tiene_zocalo_global = (params['tiene_zocalo'] == true || params['tiene_zocalo'] == 'true')
          zocalo_global_h_num = tiene_zocalo_global ? ((params['alto_zocalo'] || params['altura_zocalo'] || 100.0).to_f) : 0.0
          zocalo_global_h = zocalo_global_h_num.mm
          cant_listones_global = (params['cant_listones'] || params['cant_listones_internos'] || 2).to_i
          retrans_zocalo_global_num = (params['retrans_zocalo'] != nil && params['retrans_zocalo'] != '') ? params['retrans_zocalo'].to_f : 35.0
          retrans_zocalo_global = retrans_zocalo_global_num.mm

          if tiene_zocalo_global && zocalo_global_h_num > 0
            grupo_zocalo = grupo_composicion.entities.add_group
            grupo_zocalo.name = "Zócalo Inferior Perimétrico Continuo [#{ancho_total_num.to_i}x#{prof_total_num.to_i}x#{zocalo_global_h_num.to_i}mm]"

            prof_trans_num = [prof_total_num - retrans_zocalo_global_num - (2 * t_num), 10.0].max
            prof_trans = prof_trans_num.mm

            # 1. Zócalo Frontal Continuo (ABARCA TODO EL ANCHO DEL MUEBLE: X = 0 a X = AnchoTotal)
            CabinetBuilder.crear_panel(
              grupo_zocalo, 'Zócalo Frontal Continuo',
              0.mm, retrans_zocalo_global, 0.mm,
              ancho_total, t, zocalo_global_h,
              {
                'modulo_id' => composicion_id, 'pieza_id' => "#{composicion_id}-ZOC-FRONT",
                'pieza_nombre' => 'Zócalo Frontal Continuo', 'material' => mat_estructura,
                'resistencia' => resistencia,
                'largo_bruto_mm' => ancho_total_num, 'ancho_bruto_mm' => zocalo_global_h_num, 'espesor_mm' => t_num,
                'largo_neto_mm' => ancho_total_num - 1.0, 'ancho_neto_mm' => zocalo_global_h_num - 1.0,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                'ranura' => 'Ninguna'
              }
            )

            # 2. Zócalo Posterior Continuo (ABARCA TODO EL ANCHO DEL MUEBLE: X = 0 a X = AnchoTotal)
            CabinetBuilder.crear_panel(
              grupo_zocalo, 'Zócalo Posterior Continuo',
              0.mm, prof_total - t, 0.mm,
              ancho_total, t, zocalo_global_h,
              {
                'modulo_id' => composicion_id, 'pieza_id' => "#{composicion_id}-ZOC-POST",
                'pieza_nombre' => 'Zócalo Posterior Continuo', 'material' => mat_estructura,
                'resistencia' => resistencia,
                'largo_bruto_mm' => ancho_total_num, 'ancho_bruto_mm' => zocalo_global_h_num, 'espesor_mm' => t_num,
                'largo_neto_mm' => ancho_total_num, 'ancho_neto_mm' => zocalo_global_h_num,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                'ranura' => 'Ninguna'
              }
            )

            # 3. Lateral Izquierdo de Zócalo (ENTRE frontal y posterior: Y = retrans + t, profundidad = prof_trans)
            CabinetBuilder.crear_panel(
              grupo_zocalo, 'Zócalo Lateral Izquierdo',
              0.mm, retrans_zocalo_global + t, 0.mm,
              t, prof_trans, zocalo_global_h,
              {
                'modulo_id' => composicion_id, 'pieza_id' => "#{composicion_id}-ZOC-LAT-IZQ",
                'pieza_nombre' => 'Zócalo Lateral Izquierdo', 'material' => mat_estructura,
                'resistencia' => resistencia,
                'largo_bruto_mm' => prof_trans_num, 'ancho_bruto_mm' => zocalo_global_h_num, 'espesor_mm' => t_num,
                'largo_neto_mm' => prof_trans_num - 1.0, 'ancho_neto_mm' => zocalo_global_h_num,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.0,
                'ranura' => 'Ninguna'
              }
            )

            # 4. Lateral Derecho de Zócalo (ENTRE frontal y posterior: Y = retrans + t, profundidad = prof_trans)
            CabinetBuilder.crear_panel(
              grupo_zocalo, 'Zócalo Lateral Derecho',
              ancho_total - t, retrans_zocalo_global + t, 0.mm,
              t, prof_trans, zocalo_global_h,
              {
                'modulo_id' => composicion_id, 'pieza_id' => "#{composicion_id}-ZOC-LAT-DER",
                'pieza_nombre' => 'Zócalo Lateral Derecho', 'material' => mat_estructura,
                'resistencia' => resistencia,
                'largo_bruto_mm' => prof_trans_num, 'ancho_bruto_mm' => zocalo_global_h_num, 'espesor_mm' => t_num,
                'largo_neto_mm' => prof_trans_num - 1.0, 'ancho_neto_mm' => zocalo_global_h_num,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.0,
                'ranura' => 'Ninguna'
              }
            )

            # 5. Listones Transversales Interiores de Soporte según Estándares Técnicos
            listones_payload = params['listones_zocalo']
            if prof_trans_num > 0
              if listones_payload.is_a?(Array) && !listones_payload.empty?
                listones_payload.each_with_index do |l_item, k|
                  x_trans_num = (l_item['x'] || 0).to_f
                  desc_nom = l_item['nombre'] || "Listón Soporte Zócalo #{k + 1}"

                  CabinetBuilder.crear_panel(
                    grupo_zocalo, desc_nom,
                    x_trans_num.mm, retrans_zocalo_global + t, 0.mm,
                    t, prof_trans, zocalo_global_h,
                    {
                      'modulo_id' => composicion_id, 'pieza_id' => "#{composicion_id}-ZOC-LISTON-#{k + 1}",
                      'pieza_nombre' => desc_nom, 'material' => mat_estructura,
                      'resistencia' => resistencia,
                      'largo_bruto_mm' => prof_trans_num, 'ancho_bruto_mm' => zocalo_global_h_num, 'espesor_mm' => t_num,
                      'largo_neto_mm' => prof_trans_num, 'ancho_neto_mm' => zocalo_global_h_num,
                      'cantidad' => 1, 'veta' => 'longitudinal',
                      'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                      'ranura' => 'Ninguna'
                    }
                  )
                end
              elsif cant_listones_global > 0
                ancho_interior = [ancho_total_num - (2 * t_num), 0.0].max
                partes_iguales = cant_listones_global + 1
                paso_proporcional = ancho_interior / partes_iguales.to_f

                (1..cant_listones_global).each do |k|
                  x_centro = t_num + (k * paso_proporcional)
                  x_trans_num = (x_centro - (t_num / 2.0)).round
                  desc_nom = (cant_listones_global == 1) ? 'Listón Soporte Zócalo Central' : "Listón Soporte Zócalo #{k}/#{cant_listones_global} (1/#{partes_iguales} interior)"

                  CabinetBuilder.crear_panel(
                    grupo_zocalo, desc_nom,
                    x_trans_num.mm, retrans_zocalo_global + t, 0.mm,
                    t, prof_trans, zocalo_global_h,
                    {
                      'modulo_id' => composicion_id, 'pieza_id' => "#{composicion_id}-ZOC-LISTON-#{k}",
                      'pieza_nombre' => desc_nom, 'material' => mat_estructura,
                      'resistencia' => resistencia,
                      'largo_bruto_mm' => prof_trans_num, 'ancho_bruto_mm' => zocalo_global_h_num, 'espesor_mm' => t_num,
                      'largo_neto_mm' => prof_trans_num, 'ancho_neto_mm' => zocalo_global_h_num,
                      'cantidad' => 1, 'veta' => 'longitudinal',
                      'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                      'ranura' => 'Ninguna'
                    }
                  )
                end
              end
            end
          end

          # Agrupación espacial por columnas y niveles apilados verticalmente
          columnas_map = {}
          modulos_data.each_with_index do |m_data, idx|
            c_idx = (m_data['columna_idx'] != nil && m_data['columna_idx'] != '') ? m_data['columna_idx'].to_i : idx
            n_idx = (m_data['nivel_apilado'] != nil && m_data['nivel_apilado'] != '') ? m_data['nivel_apilado'].to_i : 0
            sc_idx = (m_data['sub_col_idx'] != nil && m_data['sub_col_idx'] != '') ? m_data['sub_col_idx'].to_i : idx
            columnas_map[c_idx] ||= []
            columnas_map[c_idx] << { 'data' => m_data, 'orig_idx' => idx, 'nivel' => n_idx, 'sub_col' => sc_idx }
          end

          cols_ordenadas = columnas_map.keys.sort.map { |c_k| [c_k, columnas_map[c_k]] }

          mapeo_espacial = {}
          x_acum = 0.0
          cols_ordenadas.each do |_c_idx, items|
            # Agrupar items de la columna por nivel_apilado
            niveles_map = {}
            items.each do |it|
              n = it['nivel']
              niveles_map[n] ||= []
              niveles_map[n] << it
            end

            niveles_ordenados = niveles_map.keys.sort.map { |nk| [nk, niveles_map[nk]] }

            # Ancho total de la columna: el mayor ancho ocupado por cualquiera de sus niveles
            w_col_max = 0.0
            niveles_ordenados.each do |_nk, sub_items|
              w_nivel = sub_items.inject(0.0) { |sum, it| sum + (it['data']['ancho'] ? it['data']['ancho'].to_f : 0.0) }
              w_col_max = w_nivel if w_nivel > w_col_max
            end
            w_col_max = 600.0 if w_col_max <= 0.0

            z_acum = tiene_zocalo_global ? zocalo_global_h_num : 0.0
            niveles_ordenados.each do |_nk, sub_items|
              sub_items.sort_by! { |it| it['sub_col'] }
              h_nivel = (sub_items.first['data']['alto'] && sub_items.first['data']['alto'].to_f > 0) ? sub_items.first['data']['alto'].to_f : alto_total_num
              x_en_nivel = 0.0

              sub_items.each do |it|
                w_m = (it['data']['ancho'] && it['data']['ancho'].to_f > 0) ? it['data']['ancho'].to_f : (w_col_max / sub_items.length)
                h_m = (it['data']['alto'] && it['data']['alto'].to_f > 0) ? it['data']['alto'].to_f : h_nivel

                mapeo_espacial[it['orig_idx']] = {
                  'x_pos' => x_acum + x_en_nivel,
                  'z_pos' => z_acum,
                  'w_mod' => w_m,
                  'h_mod' => h_m
                }
                x_en_nivel += w_m
              end
              z_acum += h_nivel
            end
            x_acum += w_col_max
          end

          modulos_data.each_with_index do |m_data, idx|
            esp = mapeo_espacial[idx] || { 'x_pos' => 0.0, 'z_pos' => 0.0, 'w_mod' => m_data['ancho'].to_f, 'h_mod' => m_data['alto'].to_f }
            w_mod_num = esp['w_mod']
            h_mod_num = esp['h_mod']
            d_mod_num = (m_data['profundidad'] && m_data['profundidad'].to_f > 0) ? m_data['profundidad'].to_f : prof_total_num

            w_mod = w_mod_num.mm
            h_mod = h_mod_num.mm
            d_mod = d_mod_num.mm
            x_pos = esp['x_pos'].mm
            z_pos = esp['z_pos'].mm

            prof_carcasa_num = d_mod_num
            y_carcasa_start = 0.mm

            nom_mod = (m_data['nombre'] && !m_data['nombre'].to_s.strip.empty?) ? m_data['nombre'].to_s : "Módulo #{idx + 1}"
            mod_id = "#{composicion_id}-M#{idx + 1}"
            grupo_mod = grupo_composicion.entities.add_group
            grupo_mod.name = "#{nom_mod} [#{w_mod_num.to_i}x#{h_mod_num.to_i}x#{d_mod_num.to_i}mm]"

            dict_mod = grupo_mod.attribute_dictionary('DespieceMelaModulo', true)
            dict_mod['modulo_id'] = mod_id
            dict_mod['nombre'] = nom_mod
            dict_mod['tipo'] = 'modulo_individual'
            dict_mod['indice'] = idx + 1
            dict_mod['columna_idx'] = m_data['columna_idx'] ? m_data['columna_idx'].to_i : idx
            dict_mod['nivel_apilado'] = m_data['nivel_apilado'] ? m_data['nivel_apilado'].to_i : 0
            dict_mod['ancho_mm'] = w_mod_num
            dict_mod['alto_mm'] = h_mod_num
            dict_mod['prof_mm'] = d_mod_num
            dict_mod['espesor_mm'] = t_num

            # A. Ancho interior del módulo
            ancho_int_num = w_mod_num - (2 * t_num)
            ancho_int = ancho_int_num.mm

            # A1. Zócalo y Listones
            # Si el zócalo global está activo, los módulos no duplican zócalo inferior
            tiene_zocalo = tiene_zocalo_global ? false : (m_data['tiene_zocalo'] == true || m_data['tiene_zocalo'] == 'true')
            zocalo_h_num = tiene_zocalo ? (m_data['alto_zocalo'] || 100.0).to_f : 0.0
            zocalo_h = zocalo_h_num.mm
            cant_listones = (m_data['cant_listones'] || 2).to_i
            retrans_zocalo_num = (m_data['retrans_zocalo'] || m_data['retransporte_zocalo'] || 35.0).to_f
            retrans_zocalo = retrans_zocalo_num.mm

            # Zócalo Superior
            tiene_zocalo_sup = m_data['tiene_zocalo_sup'] == true || m_data['tiene_zocalo_sup'] == 'true'
            zocalo_sup_h_num = tiene_zocalo_sup ? (m_data['alto_zocalo_sup'] || 70.0).to_f : 0.0
            zocalo_sup_h = zocalo_sup_h_num.mm

            if tiene_zocalo && zocalo_h_num > 0
              largo_lat_zoc_num = [d_mod_num - retrans_zocalo_num, 50.0].max
              largo_lat_zoc = largo_lat_zoc_num.mm

              # 1. Listón Frontal (entre laterales de zócalo)
              CabinetBuilder.crear_panel(
                grupo_mod, "M#{idx + 1} Zócalo Frontal",
                x_pos + t, retrans_zocalo, z_pos,
                ancho_int, t, zocalo_h,
                {
                  'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-ZOC-FRONT",
                  'pieza_nombre' => "M#{idx + 1} Zócalo Frontal", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => zocalo_h_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => zocalo_h_num - 1.0,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                  'ranura' => 'Ninguna'
                }
              )

              # 2. Listón Posterior (entre laterales de zócalo)
              CabinetBuilder.crear_panel(
                grupo_mod, "M#{idx + 1} Zócalo Posterior",
                x_pos + t, d_mod - t, z_pos,
                ancho_int, t, zocalo_h,
                {
                  'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-ZOC-POST",
                  'pieza_nombre' => "M#{idx + 1} Zócalo Posterior", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => zocalo_h_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => zocalo_h_num,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                  'ranura' => 'Ninguna'
                }
              )

              # 3. Lateral Izquierdo de Zócalo (cierra el perímetro)
              CabinetBuilder.crear_panel(
                grupo_mod, "M#{idx + 1} Zócalo Lateral Izquierdo",
                x_pos, retrans_zocalo, z_pos,
                t, largo_lat_zoc, zocalo_h,
                {
                  'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-ZOC-LAT-IZQ",
                  'pieza_nombre' => "M#{idx + 1} Zócalo Lateral Izquierdo", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => largo_lat_zoc_num, 'ancho_bruto_mm' => zocalo_h_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => largo_lat_zoc_num - 1.0, 'ancho_neto_mm' => zocalo_h_num,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.0,
                  'ranura' => 'Ninguna'
                }
              )

              # 4. Lateral Derecho de Zócalo (cierra el perímetro)
              CabinetBuilder.crear_panel(
                grupo_mod, "M#{idx + 1} Zócalo Lateral Derecho",
                x_pos + w_mod - t, retrans_zocalo, z_pos,
                t, largo_lat_zoc, zocalo_h,
                {
                  'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-ZOC-LAT-DER",
                  'pieza_nombre' => "M#{idx + 1} Zócalo Lateral Derecho", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => largo_lat_zoc_num, 'ancho_bruto_mm' => zocalo_h_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => largo_lat_zoc_num - 1.0, 'ancho_neto_mm' => zocalo_h_num,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.0,
                  'ranura' => 'Ninguna'
                }
              )

              # 5. Listones Transversales Interiores de Soporte del Zócalo
              # Proporcionan sustento directo en la base al mueble superior y sus divisorias:
              # - 1 listón: ubicado al centro del bloque (w_mod / 2).
              # - 2 listones: dividen el bloque en 3 partes iguales (un tercio cada uno, a 1/3 y 2/3).
              # - N listones: dividen el bloque en N + 1 partes iguales.
              cant_internos = if m_data.key?('cant_listones_internos')
                                [m_data['cant_listones_internos'].to_i, 0].max
                              else
                                [(m_data['cant_listones'] || 0).to_i, 0].max
                              end

              if cant_internos > 0
                largo_trans_num = d_mod_num - retrans_zocalo_num - (2 * t_num)
                if largo_trans_num > 0
                  largo_trans = largo_trans_num.mm
                  1.upto(cant_internos) do |k|
                    frac = k.to_f / (cant_internos + 1).to_f
                    x_trans = x_pos + (w_mod * frac) - (t / 2.0)
                    nom_liston = (cant_internos == 1) ? "M#{idx + 1} Listón Soporte Zócalo Central" : "M#{idx + 1} Listón Soporte Zócalo #{k}/#{cant_internos}"
                    pieza_id_str = (cant_internos == 1) ? "#{mod_id}-ZOC-SOPORTE-CENTRAL" : "#{mod_id}-ZOC-SOPORTE-#{k}"

                    CabinetBuilder.crear_panel(
                      grupo_mod, nom_liston,
                      x_trans, retrans_zocalo + t, z_pos,
                      t, largo_trans, zocalo_h,
                      {
                        'modulo_id' => mod_id, 'pieza_id' => pieza_id_str,
                        'pieza_nombre' => nom_liston, 'material' => mat_estructura,
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
              end
            end

            # Determinar configuración de piso y listones de piso
            tiene_piso = m_data['tiene_piso'] != false && m_data['tiene_piso'] != 'false'
            usa_amarres_piso = tiene_piso && (m_data['tiene_liston_piso'] == true || m_data['tiene_liston_piso'] == 'true')

            # Determinar si lleva listones de techo y techo sobrepuesto
            tiene_techo = m_data['tiene_techo'] != false && m_data['tiene_techo'] != 'false'
            tiene_amarre_ant = m_data['tiene_liston_amarre'] == true || m_data['tiene_liston_amarre'] == 'true'
            pos_amarre_ant = m_data['posicion_liston_amarre'] || 'posterior'

            usa_amarres_techo = tiene_techo && ((m_data['tiene_liston_techo'] == true || m_data['tiene_liston_techo'] == 'true') ||
                                (tiene_amarre_ant && (pos_amarre_ant == 'techo' || pos_amarre_ant == 'ambos')))

            tiene_techo_sobre = usa_amarres_techo && (m_data['techo_sobre_liston'] == true || m_data['techo_sobre_liston'] == 'true')
            es_doble_melamina = (m_data['techo_doble_melamina'] == true || m_data['techo_doble_melamina'] == 'true')

            # Descontar la altura del techo de los costados si lleva tapa sobrepuesta (1x melamina o 2x melamina si es doble)
            h_techo_num = (tiene_techo && tiene_techo_sobre) ? (es_doble_melamina ? (2.0 * t_num) : t_num) : 0.0

            # B. Carcasa del Módulo (Laterales van sobre el zócalo inferior en z_base y continúan hasta el tope superior)
            tiene_laterales = m_data['tiene_laterales'] != false && m_data['tiene_laterales'] != 'false'
            x_offset_int = tiene_laterales ? t : 0.mm
            ancho_int_num = tiene_laterales ? (w_mod_num - (2 * t_num)) : w_mod_num
            ancho_int = ancho_int_num.mm
            es_modulo_vacio = !tiene_laterales && !tiene_techo && !tiene_piso

            z_base = z_pos + zocalo_h
            z_int_base = z_base + (tiene_piso ? t : 0.mm)
            h_lateral_num = h_mod_num - zocalo_h_num - h_techo_num
            h_lateral = h_lateral_num.mm
            h_carcasa_num = h_mod_num - zocalo_h_num - h_techo_num - zocalo_sup_h_num
            h_carcasa = h_carcasa_num.mm

            # Configuración de Fondo (MDF, Melamina o Fondo Panel)
            tiene_fondo = (m_data['tiene_fondo'] == true || m_data['tiene_fondo'] == 'true' || m_data['tiene_fondo_mdf'] == true || m_data['tiene_fondo_mdf'] == 'true')
            tipo_fondo = tiene_fondo ? (m_data['tipo_fondo'] || (m_data['tiene_fondo_mdf'] ? 'mdf' : 'mdf')) : 'ninguno'
            tiene_fondo_mdf = (tipo_fondo == 'mdf')
            pos_fondo_mdf = m_data['posicion_fondo_mdf'] || 'delante_liston'
            grosor_mdf_num = (m_data['grosor_mdf'] || 3.0).to_f
            ancho_ranura_num = (m_data['ancho_ranura_mdf'] || (grosor_mdf_num + 1.0)).to_f
            prof_ranura_num = (m_data['prof_ranura_mdf'] || 8.0).to_f
            dist_ranura_num = (m_data['dist_ranura_mdf'] && m_data['dist_ranura_mdf'].to_f > 0) ? m_data['dist_ranura_mdf'].to_f : (pos_fondo_mdf == 'delante_liston' ? t_num : 0.0)

            ranura_carcasa = if tiene_fondo_mdf && pos_fondo_mdf == 'delante_liston'
                               "Ranura #{ancho_ranura_num.to_i}x#{prof_ranura_num.to_i}mm a #{dist_ranura_num.to_i}mm"
                             else
                               'Ninguna'
                             end

            # Costados Izquierdo y Derecho (solo si tiene_laterales está activo)
            if tiene_laterales
              # Costado Izquierdo (apoya sobre el zócalo inferior en z_base y continúa hasta arriba)
              CabinetBuilder.crear_panel(
                grupo_mod, "M#{idx + 1} Costado Izquierdo",
                x_pos, 0.mm, z_base,
                t, d_mod, h_lateral,
                {
                  'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-LAT-IZQ",
                  'pieza_nombre' => "M#{idx + 1} Costado Izquierdo", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => h_lateral_num, 'ancho_bruto_mm' => d_mod_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => h_lateral_num - 2.5, 'ancho_neto_mm' => d_mod_num - 1.0,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 2.0, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                  'ranura' => ranura_carcasa
                }
              )

              # Costado Derecho (apoya sobre el zócalo inferior en z_base y continúa hasta arriba)
              CabinetBuilder.crear_panel(
                grupo_mod, "M#{idx + 1} Costado Derecho",
                x_pos + w_mod - t, 0.mm, z_base,
                t, d_mod, h_lateral,
                {
                  'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-LAT-DER",
                  'pieza_nombre' => "M#{idx + 1} Costado Derecho", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => h_lateral_num, 'ancho_bruto_mm' => d_mod_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => h_lateral_num - 2.5, 'ancho_neto_mm' => d_mod_num - 1.0,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 2.0, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                  'ranura' => ranura_carcasa
                }
              )
            end

            # Piso de la Carcasa (Sólido o Listones de Amarre de Piso)

            if tiene_piso
              if usa_amarres_piso
                cant_piso = [(m_data['cant_listones_piso'] || 2).to_i, 1].max
                w_user_piso = (m_data['ancho_liston_piso'] || m_data['medida_liston_piso'] || 80.0).to_f
                w_liston_piso_num = (w_user_piso > 0) ? w_user_piso : 80.0

                if cant_piso == 1
                  CabinetBuilder.crear_panel(
                    grupo_mod, "M#{idx + 1} Amarre Piso Frontal",
                    x_pos + x_offset_int, 0.mm, z_base,
                    ancho_int, w_liston_piso_num.mm, t,
                    {
                      'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-AMARRE-PISO-FRONT",
                      'pieza_nombre' => "M#{idx + 1} Amarre Piso Frontal", 'material' => mat_estructura,
                      'resistencia' => resistencia,
                      'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => w_liston_piso_num, 'espesor_mm' => t_num,
                      'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => w_liston_piso_num - 1.0,
                      'cantidad' => 1, 'veta' => 'longitudinal',
                      'canto_L1' => 2.0, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                      'ranura' => 'Ninguna'
                    }
                  )
                else
                  espacio_gaps_piso = [d_mod_num - (cant_piso * w_liston_piso_num), 0.0].max
                  paso_gap_piso = espacio_gaps_piso / (cant_piso - 1.0)

                  cant_piso.times do |k|
                    y_pos_num = (k * (w_liston_piso_num + paso_gap_piso)).round
                    nom_sub = if k == 0
                                'Frontal'
                              elsif k == cant_piso - 1
                                'Posterior'
                              else
                                "Intermedio #{k}"
                              end
                    pieza_code = if k == 0
                                   'FRONT'
                                 elsif k == cant_piso - 1
                                   'POST'
                                 else
                                   "INT#{k}"
                                 end

                    CabinetBuilder.crear_panel(
                      grupo_mod, "M#{idx + 1} Amarre Piso #{nom_sub}",
                      x_pos + x_offset_int, y_pos_num.mm, z_base,
                      ancho_int, w_liston_piso_num.mm, t,
                      {
                        'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-AMARRE-PISO-#{pieza_code}",
                        'pieza_nombre' => "M#{idx + 1} Amarre Piso #{nom_sub}", 'material' => mat_estructura,
                        'resistencia' => resistencia,
                        'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => w_liston_piso_num, 'espesor_mm' => t_num,
                        'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => w_liston_piso_num - 1.0,
                        'cantidad' => 1, 'veta' => 'longitudinal',
                        'canto_L1' => (k == 0 ? 2.0 : 0.5), 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                        'ranura' => 'Ninguna'
                      }
                    )
                  end
                end
              else
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Piso Carcasa",
                  x_pos + x_offset_int, 0.mm, z_base,
                  ancho_int, d_mod, t,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-PISO",
                    'pieza_nombre' => "M#{idx + 1} Piso Carcasa", 'material' => mat_estructura,
                    'resistencia' => resistencia,
                    'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => d_mod_num, 'espesor_mm' => t_num,
                    'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => d_mod_num - 1.0,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                    'ranura' => ranura_carcasa
                  }
                )
              end
            end

            # Techo de la Carcasa / Amarres de Techo con distribución milimétrica exacta sin solapamientos
            if tiene_techo
              if usa_amarres_techo
                cant_techo = [(m_data['cant_listones_techo'] || m_data['cant_listones_amarre'] || 2).to_i, 1].max
                w_user_techo = (m_data['ancho_liston_techo'] || m_data['medida_liston_techo'] || m_data['alto_liston_amarre'] || m_data['ancho_liston'] || 80.0).to_f
                w_liston_techo_num = (w_user_techo > 0) ? w_user_techo : 80.0

                if cant_techo == 1
                  CabinetBuilder.crear_panel(
                    grupo_mod, "M#{idx + 1} Amarre Techo Frontal",
                    x_pos + x_offset_int, 0.mm, z_base + h_carcasa - t,
                    ancho_int, w_liston_techo_num.mm, t,
                    {
                      'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-AMARRE-TECH-FRONT",
                      'pieza_nombre' => "M#{idx + 1} Amarre Techo Frontal", 'material' => mat_estructura,
                      'resistencia' => resistencia,
                      'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => w_liston_techo_num, 'espesor_mm' => t_num,
                      'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => w_liston_techo_num - 1.0,
                      'cantidad' => 1, 'veta' => 'longitudinal',
                      'canto_L1' => 2.0, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                      'ranura' => 'Ninguna'
                    }
                  )
                else
                  espacio_gaps = [d_mod_num - (cant_techo * w_liston_techo_num), 0.0].max
                  paso_gap = espacio_gaps / (cant_techo - 1.0)

                  cant_techo.times do |k|
                    y_pos_num = (k * (w_liston_techo_num + paso_gap)).round
                    nom_sub = if k == 0
                                'Frontal'
                              elsif k == cant_techo - 1
                                'Posterior'
                              else
                                "Intermedio #{k}"
                              end
                    pieza_code = if k == 0
                                   'FRONT'
                                 elsif k == cant_techo - 1
                                   'POST'
                                 else
                                   "INT#{k}"
                                 end

                    CabinetBuilder.crear_panel(
                      grupo_mod, "M#{idx + 1} Amarre Techo #{nom_sub}",
                      x_pos + x_offset_int, y_pos_num.mm, z_base + h_carcasa - t,
                      ancho_int, w_liston_techo_num.mm, t,
                      {
                        'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-AMARRE-TECH-#{pieza_code}",
                        'pieza_nombre' => "M#{idx + 1} Amarre Techo #{nom_sub}", 'material' => mat_estructura,
                        'resistencia' => resistencia,
                        'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => w_liston_techo_num, 'espesor_mm' => t_num,
                        'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => w_liston_techo_num - 1.0,
                        'cantidad' => 1, 'veta' => 'longitudinal',
                        'canto_L1' => (k == 0 ? 2.0 : 0.5), 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                        'ranura' => 'Ninguna'
                      }
                    )
                  end
                end

                # Techo / Tapa Sobrepuesta colocada sobre los listones de amarre
                if tiene_techo_sobre
                  if es_doble_melamina
                    # Tapa Capa Inferior
                    CabinetBuilder.crear_panel(
                      grupo_mod, "M#{idx + 1} Techo Sobrepuesto Doble Melamina (1/2)",
                      x_pos, 0.mm, z_base + h_carcasa,
                      w_mod, d_mod, t,
                      {
                        'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-TECHO-SOBREPUESTO-1",
                        'pieza_nombre' => "M#{idx + 1} Tapa Techo Doble (Capa 1)", 'material' => mat_estructura,
                        'resistencia' => resistencia,
                        'largo_bruto_mm' => w_mod_num, 'ancho_bruto_mm' => d_mod_num, 'espesor_mm' => t_num,
                        'largo_neto_mm' => w_mod_num - 1.0, 'ancho_neto_mm' => d_mod_num - 1.0,
                        'cantidad' => 1, 'veta' => 'longitudinal',
                        'canto_L1' => 2.0, 'canto_L2' => 2.0, 'canto_A1' => 2.0, 'canto_A2' => 2.0,
                        'ranura' => 'Ninguna'
                      }
                    )
                    # Tapa Capa Superior (engrosado 36mm)
                    CabinetBuilder.crear_panel(
                      grupo_mod, "M#{idx + 1} Techo Sobrepuesto Doble Melamina (2/2)",
                      x_pos, 0.mm, z_base + h_carcasa + t,
                      w_mod, d_mod, t,
                      {
                        'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-TECHO-SOBREPUESTO-2",
                        'pieza_nombre' => "M#{idx + 1} Tapa Techo Doble (Capa 2)", 'material' => mat_estructura,
                        'resistencia' => resistencia,
                        'largo_bruto_mm' => w_mod_num, 'ancho_bruto_mm' => d_mod_num, 'espesor_mm' => t_num,
                        'largo_neto_mm' => w_mod_num - 1.0, 'ancho_neto_mm' => d_mod_num - 1.0,
                        'cantidad' => 1, 'veta' => 'longitudinal',
                        'canto_L1' => 2.0, 'canto_L2' => 2.0, 'canto_A1' => 2.0, 'canto_A2' => 2.0,
                        'ranura' => 'Ninguna'
                      }
                    )
                  else
                    # Tapa Simple (18mm)
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
                end
              else
                # Techo Sólido Completo Estándar
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Techo Carcasa",
                  x_pos + x_offset_int, 0.mm, z_base + h_carcasa - t,
                  ancho_int, d_mod, t,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-TECHO",
                    'pieza_nombre' => "M#{idx + 1} Techo Carcasa", 'material' => mat_estructura,
                    'resistencia' => resistencia,
                    'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => d_mod_num, 'espesor_mm' => t_num,
                    'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => d_mod_num - 1.0,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                    'ranura' => ranura_carcasa
                  }
                )
              end
            end

            # Zócalo Superior (Frontal de melamina en todo el ancho interior)
            if tiene_zocalo_sup && zocalo_sup_h_num > 0
              CabinetBuilder.crear_panel(
                grupo_mod, "M#{idx + 1} Frontal Zócalo Superior",
                x_pos + x_offset_int, 0.mm, z_base + h_carcasa,
                ancho_int, t, zocalo_sup_h,
                {
                  'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-ZOC-SUP-FRONT",
                  'pieza_nombre' => "M#{idx + 1} Frontal Zócalo Superior", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => zocalo_sup_h_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => zocalo_sup_h_num - 1.0,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                  'ranura' => 'Ninguna'
                }
              )
            end

            # Listones Posteriores de Amarre / Fijación a Pared (REGLA: Con fondo melamina NO lleva listón posterior)
            usa_amarres_post = (tipo_fondo != 'melamina') && (
                                 (m_data['tiene_liston_post'] == true || m_data['tiene_liston_post'] == 'true') ||
                                 (tiene_amarre_ant && (pos_amarre_ant == 'posterior' || pos_amarre_ant == 'ambos'))
                               )
            if usa_amarres_post
              cant_post = [(m_data['cant_listones_post'] || m_data['cant_listones_amarre'] || 2).to_i, 1].max
              orientacion_post = m_data['orientacion_liston_post'] || m_data['orientacion_listones_post'] || 'horizontal'
              h_user_post = (m_data['ancho_liston_post'] || m_data['medida_liston_post'] || m_data['alto_liston_amarre'] || m_data['ancho_liston'] || 80.0).to_f
              w_liston_post_num = (h_user_post > 0) ? h_user_post : 80.0
              w_liston_post = w_liston_post_num.mm
              h_vano_util_post_num = [h_carcasa_num - (tiene_piso ? t_num : 0.0) - (tiene_techo ? t_num : 0.0), 50.0].max
              h_vano_util_post = h_vano_util_post_num.mm
              z_start_post = z_base + (tiene_piso ? t : 0.mm)

              # Si es MDF enranurado (delante_liston), el listón se ubica DETRÁS del fondo
              # a eff_dist_amarre (18mm estándar) del borde posterior.
              es_mdf_delante = (tipo_fondo == 'mdf' || tiene_fondo_mdf) && (pos_fondo_mdf == 'delante_liston')
              eff_dist_amarre = (dist_ranura_num >= 18.0) ? dist_ranura_num : 18.0
              y_liston_pos = es_mdf_delante ? (d_mod - eff_dist_amarre.mm) : (d_mod - t)
              esp_liston_pos = es_mdf_delante ? eff_dist_amarre.mm : t
              esp_liston_num = esp_liston_pos.to_mm

              if orientacion_post == 'vertical'
                # Listones VERTICALES en el fondo / parte posterior
                if cant_post == 1
                  x_pos_liston = x_pos + x_offset_int + (ancho_int / 2.0) - (w_liston_post / 2.0)
                  CabinetBuilder.crear_panel(
                    grupo_mod, "M#{idx + 1} Listón Fondo Vertical Central",
                    x_pos_liston, y_liston_pos, z_start_post,
                    w_liston_post, esp_liston_pos, h_vano_util_post,
                    {
                      'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-LISTON-POST-VERT-CENTRAL",
                      'pieza_nombre' => "M#{idx + 1} Listón Fondo Vertical Central", 'material' => mat_estructura,
                      'resistencia' => resistencia,
                      'largo_bruto_mm' => h_vano_util_post_num, 'ancho_bruto_mm' => w_liston_post_num, 'espesor_mm' => esp_liston_num,
                      'largo_neto_mm' => h_vano_util_post_num - 1.0, 'ancho_neto_mm' => w_liston_post_num - 1.0,
                      'cantidad' => 1, 'veta' => 'longitudinal',
                      'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                      'ranura' => 'Ninguna'
                    }
                  )
                else
                  espacio_gaps_x = [ancho_int_num - (cant_post * w_liston_post_num), 0.0].max
                  paso_gap_x = (cant_post > 1) ? (espacio_gaps_x / (cant_post - 1.0)) : 0.0

                  cant_post.times do |k|
                    x_offset_k = (k * (w_liston_post_num + paso_gap_x)).round
                    x_pos_liston = x_pos + x_offset_int + x_offset_k.mm
                    nom_sub = if k == 0
                                'Izquierdo'
                              elsif k == cant_post - 1
                                'Derecho'
                              else
                                "Intermedio #{k}"
                              end
                    pieza_code = if k == 0
                                   'IZQ'
                                 elsif k == cant_post - 1
                                   'DER'
                                 else
                                   "INT#{k}"
                                 end

                    CabinetBuilder.crear_panel(
                      grupo_mod, "M#{idx + 1} Listón Fondo Vertical #{nom_sub}",
                      x_pos_liston, y_liston_pos, z_start_post,
                      w_liston_post, esp_liston_pos, h_vano_util_post,
                      {
                        'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-LISTON-POST-VERT-#{pieza_code}",
                        'pieza_nombre' => "M#{idx + 1} Listón Fondo Vertical #{nom_sub}", 'material' => mat_estructura,
                        'resistencia' => resistencia,
                        'largo_bruto_mm' => h_vano_util_post_num, 'ancho_bruto_mm' => w_liston_post_num, 'espesor_mm' => esp_liston_num,
                        'largo_neto_mm' => h_vano_util_post_num - 1.0, 'ancho_neto_mm' => w_liston_post_num - 1.0,
                        'cantidad' => 1, 'veta' => 'longitudinal',
                        'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                        'ranura' => 'Ninguna'
                      }
                    )
                  end
                end
              else
                # Listones HORIZONTALES (repartidos a lo alto)
                if cant_post == 1
                  CabinetBuilder.crear_panel(
                    grupo_mod, "M#{idx + 1} Listón Posterior Superior",
                    x_pos + x_offset_int, y_liston_pos, z_base + h_carcasa - t - w_liston_post,
                    ancho_int, esp_liston_pos, w_liston_post,
                    {
                      'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-LISTON-POST-SUP",
                      'pieza_nombre' => "M#{idx + 1} Listón Amarre Posterior Superior", 'material' => mat_estructura,
                      'resistencia' => resistencia,
                      'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => w_liston_post_num, 'espesor_mm' => esp_liston_num,
                      'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => w_liston_post_num - 1.0,
                      'cantidad' => 1, 'veta' => 'longitudinal',
                      'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                      'ranura' => 'Ninguna'
                    }
                  )
                else
                  espacio_gaps_post = [h_vano_util_post_num - (cant_post * w_liston_post_num), 0.0].max
                  paso_gap_post = (cant_post > 1) ? (espacio_gaps_post / (cant_post - 1.0)) : 0.0

                  cant_post.times do |k|
                    z_pos_num = (k * (w_liston_post_num + paso_gap_post)).round
                    nom_sub = if k == 0
                                'Inferior'
                              elsif k == cant_post - 1
                                'Superior'
                              else
                                "Intermedio #{k}"
                              end
                    pieza_code = if k == 0
                                   'INF'
                                 elsif k == cant_post - 1
                                   'SUP'
                                 else
                                   "INT#{k}"
                                 end

                    CabinetBuilder.crear_panel(
                      grupo_mod, "M#{idx + 1} Listón Posterior #{nom_sub}",
                      x_pos + x_offset_int, y_liston_pos, z_start_post + z_pos_num.mm,
                      ancho_int, esp_liston_pos, w_liston_post,
                      {
                        'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-LISTON-POST-#{pieza_code}",
                        'pieza_nombre' => "M#{idx + 1} Listón Amarre Posterior #{nom_sub}", 'material' => mat_estructura,
                        'resistencia' => resistencia,
                        'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => w_liston_post_num, 'espesor_mm' => esp_liston_num,
                        'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => w_liston_post_num - 1.0,
                        'cantidad' => 1, 'veta' => 'longitudinal',
                        'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                        'ranura' => 'Ninguna'
                      }
                    )
                  end
                end
              end
            end

            # D. Fondo Posterior (MDF o Melamina o Ninguno)
            mat_fondos = params['material_fondos'] || "MDF Fondo Blanco #{grosor_mdf_num.to_i}mm"

            if tiene_fondo_mdf || tipo_fondo == 'mdf'
              if pos_fondo_mdf == 'delante_liston'
                # Tolerancia térmica oficial de 2mm (1mm por lado) según reglas_del_proyecto.md Section 2.3:
                # Ancho Fondo MDF = Ancho Interior Vano + (2 * Profundidad Ranura) - 2 mm
                # Alto Fondo MDF  = Alto Interior Vano  + (2 * Profundidad Ranura) - 2 mm
                holgura_mdf = 1.0   # holgura térmica por lado
                eff_prof_ranura = (prof_ranura_num > 0) ? prof_ranura_num : 8.0
                eff_dist_ranura = (dist_ranura_num >= 18.0) ? dist_ranura_num : 18.0

                ancho_mdf_num = ancho_int_num + (2.0 * eff_prof_ranura) - (2.0 * holgura_mdf)

                h_vano_mdf_num = [h_carcasa_num - (tiene_piso ? t_num : 0.0) - (tiene_techo ? t_num : 0.0), 0.0].max
                alto_mdf_num   = h_vano_mdf_num + (2.0 * eff_prof_ranura) - (2.0 * holgura_mdf)

                # Posición Y: a eff_dist_ranura + grosor_mdf desde el borde posterior bruto
                y_mdf = d_mod - eff_dist_ranura.mm - grosor_mdf_num.mm

                # Posición X: fondo entra en ranura del lateral izquierdo (1mm antes del fondo del canal)
                x_mdf = x_pos + t - eff_prof_ranura.mm + holgura_mdf.mm

                # Posición Z: fondo entra en ranura del piso (1mm antes del fondo del canal)
                z_mdf = z_int_base - eff_prof_ranura.mm + holgura_mdf.mm

                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Fondo MDF Enranurado #{grosor_mdf_num.to_i}mm",
                  x_mdf, y_mdf, z_mdf,
                  ancho_mdf_num.mm, grosor_mdf_num.mm, alto_mdf_num.mm,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-FONDO-MDF-RAN",
                    'pieza_nombre' => "M#{idx + 1} Fondo MDF Enranurado", 'material' => mat_fondos,
                    'resistencia' => 'Normal',
                    'largo_bruto_mm' => alto_mdf_num, 'ancho_bruto_mm' => ancho_mdf_num, 'espesor_mm' => grosor_mdf_num,
                    'largo_neto_mm' => alto_mdf_num, 'ancho_neto_mm' => ancho_mdf_num,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                    'ranura' => "Incrustado en ranura #{ancho_ranura_num.to_i}x#{prof_ranura_num.to_i}mm a #{eff_dist_ranura.to_i}mm"
                  }
                )
              else
                # Fondo sobrepuesto / clavado por detrás del listón con las medidas completas del módulo
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Fondo MDF Sobrepuesto #{grosor_mdf_num.to_i}mm",
                  x_pos, d_mod, z_pos,
                  w_mod, grosor_mdf_num.mm, h_mod,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-FONDO-MDF-SOBRE",
                    'pieza_nombre' => "M#{idx + 1} Fondo MDF Sobrepuesto", 'material' => mat_fondos,
                    'resistencia' => 'Normal',
                    'largo_bruto_mm' => h_mod_num, 'ancho_bruto_mm' => w_mod_num, 'espesor_mm' => grosor_mdf_num,
                    'largo_neto_mm' => h_mod_num, 'ancho_neto_mm' => w_mod_num,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                    'ranura' => 'Sobrepuesto clavado'
                  }
                )
              end
            elsif tipo_fondo == 'melamina'
              h_vano_util_local_num = [h_carcasa_num - (tiene_piso ? t_num : 0.0) - (tiene_techo ? t_num : 0.0), 0.0].max
              alto_mel_num = (m_data['alto_fondo_melamina'] && m_data['alto_fondo_melamina'].to_f < h_vano_util_local_num && m_data['alto_fondo_melamina'].to_f >= 80.0) ? m_data['alto_fondo_melamina'].to_f : h_vano_util_local_num
              dist_fondo_mel_num = (m_data['dist_fondo_melamina'] ? m_data['dist_fondo_melamina'].to_f : 0.0)

              # Regla: Se ajusta de arriba para abajo dejando vano libre inferior
              z_top_num = z_int_base + h_vano_util_local_num.mm
              z_mel = z_top_num - alto_mel_num.mm
              # Posición Y: por default al borde posterior (0.mm), o retraído para no chocar la pared
              y_mel_pos = d_mod - dist_fondo_mel_num.mm - t

              CabinetBuilder.crear_panel(
                grupo_mod, "M#{idx + 1} Fondo Melamina Embutido #{t_num.to_i}mm",
                x_pos + t, y_mel_pos, z_mel,
                ancho_int, t, alto_mel_num.mm,
                {
                  'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-FONDO-MEL-EMB",
                  'pieza_nombre' => "M#{idx + 1} Fondo Melamina Embutido", 'material' => mat_estructura,
                  'resistencia' => resistencia,
                  'largo_bruto_mm' => alto_mel_num, 'ancho_bruto_mm' => ancho_int_num, 'espesor_mm' => t_num,
                  'largo_neto_mm' => alto_mel_num - 1.0, 'ancho_neto_mm' => ancho_int_num - 1.0,
                  'cantidad' => 1, 'veta' => 'longitudinal',
                  'canto_L1' => 0.5, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                  'ranura' => "#{dist_fondo_mel_num > 0 ? "Retranqueado a #{dist_fondo_mel_num.to_i}mm de pared" : 'Al borde posterior'}#{alto_mel_num < h_vano_util_local_num ? " (sup., vano inf libre #{(h_vano_util_local_num - alto_mel_num).round}mm)" : ''}"
                }
              )
            elsif tipo_fondo == 'panel' || (es_modulo_vacio && tiene_fondo)
              tiene_listones_pared = m_data['panel_tiene_listones_pared'] != false && m_data['panel_tiene_listones_pared'] != 'false'
              cant_panel_list = [(m_data['cant_listones_panel'] || 2).to_i, 1].max
              h_user_pl = (m_data['medida_liston_panel'] || 80.0).to_f
              h_liston_panel_num = (h_user_pl > 0) ? h_user_pl : 80.0
              y_liston_pos = d_mod - t
              y_panel_pos = tiene_listones_pared ? [d_mod - (2 * t), 0.mm].max : (d_mod - t)

              if es_modulo_vacio
                # REGLA: Si no tiene laterales ni techo ni piso, el fondo panel abarca TODA la dimensión completa (ancho y alto total) del módulo
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Fondo Panel Completo #{t_num.to_i}mm",
                  x_pos, y_panel_pos, z_pos,
                  w_mod, t, h_mod,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-FONDO-PANEL-COMPLETO",
                    'pieza_nombre' => "M#{idx + 1} Fondo Panel Completo", 'material' => mat_estructura,
                    'resistencia' => resistencia,
                    'largo_bruto_mm' => h_mod_num, 'ancho_bruto_mm' => w_mod_num, 'espesor_mm' => t_num,
                    'largo_neto_mm' => h_mod_num - 1.0, 'ancho_neto_mm' => w_mod_num - 1.0,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 2.0, 'canto_L2' => 2.0, 'canto_A1' => 2.0, 'canto_A2' => 2.0,
                    'ranura' => 'Ninguna'
                  }
                )

                if tiene_listones_pared
                  panel_orient = m_data['panel_orientacion_listones'] || 'horizontal'
                  if panel_orient == 'vertical'
                    alto_liston_p_num = [h_mod_num - 60.0, 50.0].max
                    z_liston_p = z_pos + 30.mm
                    w_liston_p_num = h_liston_panel_num
                    espacio_gaps_x = [(w_mod_num - 60.0) - (cant_panel_list * w_liston_p_num), 0.0].max
                    paso_gap_x = (cant_panel_list > 1) ? (espacio_gaps_x / (cant_panel_list - 1.0)) : 0.0

                    cant_panel_list.times do |k|
                      x_liston_k = x_pos + 30.mm + (k * (w_liston_p_num + paso_gap_x)).round.mm
                      CabinetBuilder.crear_panel(
                        grupo_mod, "M#{idx + 1} Listón Vertical Anclaje Pared #{k + 1}",
                        x_liston_k, y_liston_pos, z_liston_p,
                        w_liston_p_num.mm, t, alto_liston_p_num.mm,
                        {
                          'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-LISTON-PANEL-VERT-#{k + 1}",
                          'pieza_nombre' => "M#{idx + 1} Listón Vertical Anclaje Pared #{k + 1}", 'material' => mat_estructura,
                          'resistencia' => resistencia,
                          'largo_bruto_mm' => alto_liston_p_num, 'ancho_bruto_mm' => w_liston_p_num, 'espesor_mm' => t_num,
                          'largo_neto_mm' => alto_liston_p_num - 1.0, 'ancho_neto_mm' => w_liston_p_num - 1.0,
                          'cantidad' => 1, 'veta' => 'longitudinal',
                          'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                          'ranura' => 'Ninguna'
                        }
                      )
                    end
                  else
                    largo_liston_p_num = [w_mod_num - 60.0, 50.0].max
                    x_liston_p = x_pos + 30.mm

                    cant_panel_list.times do |k|
                      z_liston_num = if cant_panel_list == 1
                                       h_mod_num - h_liston_panel_num - 50.0
                                     elsif cant_panel_list == 2
                                       (k == 0) ? 50.0 : (h_mod_num - h_liston_panel_num - 50.0)
                                     else
                                       50.0 + k * ((h_mod_num - 100.0 - h_liston_panel_num) / (cant_panel_list - 1.0))
                                     end

                      CabinetBuilder.crear_panel(
                        grupo_mod, "M#{idx + 1} Listón Anclaje Pared #{k + 1}",
                        x_liston_p, y_liston_pos, z_pos + z_liston_num.mm,
                        largo_liston_p_num.mm, t, h_liston_panel_num.mm,
                        {
                          'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-LISTON-PARED-#{k + 1}",
                          'pieza_nombre' => "M#{idx + 1} Listón Anclaje Pared #{k + 1}", 'material' => mat_estructura,
                          'resistencia' => resistencia,
                          'largo_bruto_mm' => largo_liston_p_num, 'ancho_bruto_mm' => h_liston_panel_num, 'espesor_mm' => t_num,
                          'largo_neto_mm' => largo_liston_p_num - 1.0, 'ancho_neto_mm' => h_liston_panel_num - 1.0,
                          'cantidad' => 1, 'veta' => 'longitudinal',
                          'canto_L1' => 0.5, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                          'ranura' => 'Ninguna'
                        }
                      )
                    end
                  end
                end
              else
                h_vano_util_local_num = [h_carcasa_num - (tiene_piso ? t_num : 0.0) - (tiene_techo ? t_num : 0.0), 0.0].max
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Fondo Panel Melamina #{t_num.to_i}mm",
                  x_pos + x_offset_int, y_panel_pos, z_int_base,
                  ancho_int, t, h_vano_util_local_num.mm,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-FONDO-PANEL-MEL",
                    'pieza_nombre' => "M#{idx + 1} Fondo Panel Melamina", 'material' => mat_estructura,
                    'resistencia' => resistencia,
                    'largo_bruto_mm' => h_vano_util_local_num, 'ancho_bruto_mm' => ancho_int_num, 'espesor_mm' => t_num,
                    'largo_neto_mm' => h_vano_util_local_num - 1.0, 'ancho_neto_mm' => ancho_int_num - 1.0,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 0.5, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                    'ranura' => 'Ninguna'
                  }
                )

                if tiene_listones_pared
                  cant_panel_list.times do |k|
                    z_liston_num = if cant_panel_list == 1
                                     h_vano_util_local_num - h_liston_panel_num - 40.0
                                   elsif cant_panel_list == 2
                                     (k == 0) ? 40.0 : (h_vano_util_local_num - h_liston_panel_num - 40.0)
                                   else
                                     40.0 + k * ((h_vano_util_local_num - 80.0 - h_liston_panel_num) / (cant_panel_list - 1.0))
                                   end

                    CabinetBuilder.crear_panel(
                      grupo_mod, "M#{idx + 1} Listón Anclaje Pared #{k + 1}",
                      x_pos + x_offset_int, y_liston_pos, z_int_base + z_liston_num.mm,
                      ancho_int, t, h_liston_panel_num.mm,
                      {
                        'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-LISTON-PARED-#{k + 1}",
                        'pieza_nombre' => "M#{idx + 1} Listón Anclaje Pared #{k + 1}", 'material' => mat_estructura,
                        'resistencia' => resistencia,
                        'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => h_liston_panel_num, 'espesor_mm' => t_num,
                        'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => h_liston_panel_num - 1.0,
                        'cantidad' => 1, 'veta' => 'longitudinal',
                        'canto_L1' => 0.5, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                        'ranura' => 'Ninguna'
                      }
                    )
                  end
                end
              end
            end

            # C. Componentes Interiores (Repisas, Cajones o Puertas)
            tipo_interior = m_data['tipo_interior'] || 'carcasa'
            h_vano_util_num = [h_carcasa_num - (tiene_piso ? t_num : 0.0) - (tiene_techo ? t_num : 0.0), 0.0].max
            h_vano_util = h_vano_util_num.mm

            case tipo_interior
            when 'repisas', 'puertas'
              # Parantes y Repisas Interiores por Espacio
              parantes_tipo = m_data['parantes_tipo'] || 'ninguno'
              parantes_raw = m_data['parantes'] || []
              espacios_cfg = m_data['espacios_repisas'] || []

              # Cálculo exacto de descuento de profundidad para parantes y repisas:
              tiene_puertas_mod_local = (m_data['tiene_puertas'] == true || m_data['tiene_puertas'] == 'true' || tipo_interior == 'puertas')
              pos_p_local = m_data['puertas_posicion_bisagra'] || 'derecha'
              es_corrediza_local = tiene_puertas_mod_local && (pos_p_local == 'corrediza')

              descuento_frontal_num = (m_data['descuento_frontal'] || m_data['retrans_repisas'] || (es_corrediza_local ? 80.0 : 20.0)).to_f
              descuento_frontal_num = [80.0, descuento_frontal_num].max if es_corrediza_local
              descuento_post_num = 0.0

              if tipo_fondo == 'mdf'
                if pos_fondo_mdf == 'delante_liston'
                  descuento_post_num = dist_ranura_num + grosor_mdf_num
                else
                  descuento_post_num = usa_amarres_post ? t_num : 0.0
                end
              elsif tipo_fondo == 'melamina'
                dist_fondo_mel_num = (m_data['dist_fondo_melamina'] ? m_data['dist_fondo_melamina'].to_f : 0.0)
                descuento_post_num = dist_fondo_mel_num + t_num
              else
                descuento_post_num = usa_amarres_post ? t_num : 0.0
              end

              prof_rep_num = [d_mod_num - descuento_frontal_num - descuento_post_num, 50.0].max
              y_rep_start = descuento_frontal_num.mm

              # 1. Resolver y construir Parantes (Verticales u Horizontales)
              parantes_resueltos = []
              max_parantes = (parantes_tipo == 'vertical') ? [((ancho_int_num - 150.0) / (150.0 + t_num)).floor, 0].max : [((h_vano_util_num - 120.0) / (120.0 + t_num)).floor, 0].max
              num_parantes = (parantes_tipo == 'ninguno') ? 0 : [parantes_raw.length, max_parantes].min

              if parantes_tipo == 'vertical' && num_parantes > 0
                paso_equi = (ancho_int_num - (num_parantes * t_num)) / (num_parantes + 1.0)
                num_parantes.times do |p_idx|
                  p_item = parantes_raw[p_idx] || {}
                  pos_prop = ((p_idx + 1) * paso_equi) + (p_idx * t_num)
                  min_x = (p_idx == 0) ? 150.0 : (parantes_resueltos[p_idx - 1] + t_num + 150.0)
                  cant_rest = num_parantes - 1 - p_idx
                  max_x = [min_x, ancho_int_num - t_num - 150.0 - (cant_rest * (150.0 + t_num))].max

                  pos_final = pos_prop
                  if p_item['modo'] == 'fija' && p_item['posicion_mm'].to_f > 0
                    pos_final = [[p_item['posicion_mm'].to_f, min_x].max, max_x].min
                  end
                  parantes_resueltos << pos_final

                  CabinetBuilder.crear_panel(
                    grupo_mod, "M#{idx + 1} Parante Vertical #{p_idx + 1}",
                    x_pos + x_offset_int + pos_final.mm, y_rep_start, z_int_base,
                    t, prof_rep_num.mm, h_vano_util,
                    {
                      'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-PAR-V#{p_idx + 1}",
                      'pieza_nombre' => "M#{idx + 1} Parante Vertical #{p_idx + 1}", 'material' => mat_estructura,
                      'resistencia' => resistencia,
                      'largo_bruto_mm' => h_vano_util_num, 'ancho_bruto_mm' => prof_rep_num, 'espesor_mm' => t_num,
                      'largo_neto_mm' => h_vano_util_num - 1.0, 'ancho_neto_mm' => prof_rep_num - 1.0,
                      'cantidad' => 1, 'veta' => 'longitudinal',
                      'canto_L1' => 0.5, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                      'ranura' => 'Ninguna'
                    }
                  )
                end
              elsif parantes_tipo == 'horizontal' && num_parantes > 0
                paso_equi = (h_vano_util_num - (num_parantes * t_num)) / (num_parantes + 1.0)
                num_parantes.times do |p_idx|
                  p_item = parantes_raw[p_idx] || {}
                  pos_prop = ((p_idx + 1) * paso_equi) + (p_idx * t_num)
                  min_z = (p_idx == 0) ? 120.0 : (parantes_resueltos[p_idx - 1] + t_num + 120.0)
                  cant_rest = num_parantes - 1 - p_idx
                  max_z = [min_z, h_vano_util_num - t_num - 120.0 - (cant_rest * (120.0 + t_num))].max

                  pos_final = pos_prop
                  if p_item['modo'] == 'fija' && p_item['posicion_mm'].to_f > 0
                    pos_final = [[p_item['posicion_mm'].to_f, min_z].max, max_z].min
                  end
                  parantes_resueltos << pos_final

                  CabinetBuilder.crear_panel(
                    grupo_mod, "M#{idx + 1} Parante Horizontal #{p_idx + 1}",
                    x_pos + x_offset_int, y_rep_start, z_int_base + pos_final.mm,
                    ancho_int, prof_rep_num.mm, t,
                    {
                      'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-PAR-H#{p_idx + 1}",
                      'pieza_nombre' => "M#{idx + 1} Parante Horizontal #{p_idx + 1}", 'material' => mat_estructura,
                      'resistencia' => resistencia,
                      'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_rep_num, 'espesor_mm' => t_num,
                      'largo_neto_mm' => ancho_int_num - 1.0, 'ancho_neto_mm' => prof_rep_num - 1.0,
                      'cantidad' => 1, 'veta' => 'longitudinal',
                      'canto_L1' => 0.5, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                      'ranura' => 'Ninguna'
                    }
                  )
                end
              end

              # 2. Determinar Espacios y Construir Repisas por cada Espacio
              num_espacios = (parantes_tipo == 'ninguno' || num_parantes == 0) ? 1 : (num_parantes + 1)
              num_espacios.times do |s_idx|
                x_start_num = 0.0
                x_end_num = ancho_int_num
                z_start_num = 0.0
                z_end_num = h_vano_util_num

                if parantes_tipo == 'vertical' && num_parantes > 0
                  x_start_num = (s_idx == 0) ? 0.0 : (parantes_resueltos[s_idx - 1] + t_num)
                  x_end_num = (s_idx == num_parantes) ? ancho_int_num : parantes_resueltos[s_idx]
                elsif parantes_tipo == 'horizontal' && num_parantes > 0
                  z_start_num = (s_idx == 0) ? 0.0 : (parantes_resueltos[s_idx - 1] + t_num)
                  z_end_num = (s_idx == num_parantes) ? h_vano_util_num : parantes_resueltos[s_idx]
                end

                w_esp_num = [x_end_num - x_start_num, 0.0].max
                h_esp_num = [z_end_num - z_start_num, 0.0].max

                # Configuración de este espacio
                e_cfg = espacios_cfg[s_idx] || {}

                # 2.1 Sub-parantes secundarios dentro de este espacio
                sub_parantes_resueltos = []
                es_tipo_h = (parantes_tipo == 'horizontal')
                es_tipo_v = (parantes_tipo == 'vertical')
                permite_sub = es_tipo_h || es_tipo_v
                sub_p_raw = e_cfg['sub_parantes'] || []

                max_sub_p = es_tipo_h ? [((w_esp_num - 150.0) / (150.0 + t_num)).floor, 0].max : (es_tipo_v ? [((h_esp_num - 120.0) / (120.0 + t_num)).floor, 0].max : 0)
                cant_sub_p = permite_sub ? [sub_p_raw.length, max_sub_p].min : 0

                if cant_sub_p > 0
                  if es_tipo_h
                    paso_sub = (w_esp_num - (cant_sub_p * t_num)) / (cant_sub_p + 1.0)
                    cant_sub_p.times do |sp|
                      raw_sp = sub_p_raw[sp] || {}
                      pos_prop = ((sp + 1) * paso_sub) + (sp * t_num)
                      min_x_rel = (sp == 0) ? 150.0 : (sub_parantes_resueltos[sp - 1][:posicion_rel] + t_num + 150.0)
                      cant_rest = cant_sub_p - 1 - sp
                      max_x_rel = [min_x_rel, w_esp_num - t_num - 150.0 - (cant_rest * (150.0 + t_num))].max

                      pos_final = pos_prop
                      if raw_sp['modo'] == 'fija' && raw_sp['posicion_mm'].to_f > 0
                        pos_final = [[raw_sp['posicion_mm'].to_f, min_x_rel].max, max_x_rel].min
                      end

                      sub_parantes_resueltos << {
                        posicion_rel: pos_final,
                        x: x_start_num + pos_final,
                        z: z_start_num
                      }

                      CabinetBuilder.crear_panel(
                        grupo_mod, "M#{idx + 1} E#{s_idx + 1} Sub-Parante Vertical #{sp + 1}",
                        x_pos + x_offset_int + (x_start_num + pos_final).mm, y_rep_start, z_int_base + z_start_num.mm,
                        t, prof_rep_num.mm, h_esp_num.mm,
                        {
                          'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-E#{s_idx + 1}-SUBPAR-V#{sp + 1}",
                          'pieza_nombre' => "M#{idx + 1} E#{s_idx + 1} Sub-Parante Vertical #{sp + 1}", 'material' => mat_estructura,
                          'resistencia' => resistencia,
                          'largo_bruto_mm' => h_esp_num, 'ancho_bruto_mm' => prof_rep_num, 'espesor_mm' => t_num,
                          'largo_neto_mm' => h_esp_num - 1.0, 'ancho_neto_mm' => prof_rep_num - 1.0,
                          'cantidad' => 1, 'veta' => 'longitudinal',
                          'canto_L1' => 0.5, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                          'ranura' => 'Ninguna'
                        }
                      )
                    end
                  elsif es_tipo_v
                    paso_sub = (h_esp_num - (cant_sub_p * t_num)) / (cant_sub_p + 1.0)
                    cant_sub_p.times do |sp|
                      raw_sp = sub_p_raw[sp] || {}
                      pos_prop = ((sp + 1) * paso_sub) + (sp * t_num)
                      min_z_rel = (sp == 0) ? 120.0 : (sub_parantes_resueltos[sp - 1][:posicion_rel] + t_num + 120.0)
                      cant_rest = cant_sub_p - 1 - sp
                      max_z_rel = [min_z_rel, h_esp_num - t_num - 120.0 - (cant_rest * (120.0 + t_num))].max

                      pos_final = pos_prop
                      if raw_sp['modo'] == 'fija' && raw_sp['posicion_mm'].to_f > 0
                        pos_final = [[raw_sp['posicion_mm'].to_f, min_z_rel].max, max_z_rel].min
                      end

                      sub_parantes_resueltos << {
                        posicion_rel: pos_final,
                        x: x_start_num,
                        z: z_start_num + pos_final
                      }

                      CabinetBuilder.crear_panel(
                        grupo_mod, "M#{idx + 1} E#{s_idx + 1} Sub-Parante Horizontal #{sp + 1}",
                        x_pos + x_offset_int + x_start_num.mm, y_rep_start, z_int_base + (z_start_num + pos_final).mm,
                        w_esp_num.mm, prof_rep_num.mm, t,
                        {
                          'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-E#{s_idx + 1}-SUBPAR-H#{sp + 1}",
                          'pieza_nombre' => "M#{idx + 1} E#{s_idx + 1} Sub-Parante Horizontal #{sp + 1}", 'material' => mat_estructura,
                          'resistencia' => resistencia,
                          'largo_bruto_mm' => w_esp_num, 'ancho_bruto_mm' => prof_rep_num, 'espesor_mm' => t_num,
                          'largo_neto_mm' => w_esp_num - 1.0, 'ancho_neto_mm' => prof_rep_num - 1.0,
                          'cantidad' => 1, 'veta' => 'longitudinal',
                          'canto_L1' => 0.5, 'canto_L2' => 0.5, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                          'ranura' => 'Ninguna'
                        }
                      )
                    end
                  end
                end

                # 2.2 Repisas del espacio
                cant_max_r = [((h_esp_num - 80.0) / (80.0 + t_num)).floor, 0].max
                cant_r = if e_cfg['cantidad']
                           [e_cfg['cantidad'].to_i, cant_max_r].min
                         elsif s_idx == 0 && m_data['cant_repisas'].to_i > 0
                           [m_data['cant_repisas'].to_i, cant_max_r].min
                         else
                           0
                         end

                if cant_r > 0
                  modo_r = e_cfg['modo'] || 'proporcional'
                  pos_fijas = e_cfg['posiciones_fijas'] || []
                  paso_r_num = (h_esp_num - (cant_r * t_num)) / (cant_r + 1.0)
                  repisas_z_resueltas = []

                  cant_r.times do |r_idx|
                    cota_prop = ((r_idx + 1) * paso_r_num) + (r_idx * t_num)
                    min_z_rel = (r_idx == 0) ? 80.0 : (repisas_z_resueltas[r_idx - 1] + t_num + 80.0)
                    cant_r_rest = cant_r - 1 - r_idx
                    max_z_rel = [min_z_rel, h_esp_num - t_num - 80.0 - (cant_r_rest * (80.0 + t_num))].max

                    cota_final = cota_prop
                    if modo_r == 'fija' && pos_fijas[r_idx].to_f > 0
                      cota_final = [[pos_fijas[r_idx].to_f, min_z_rel].max, max_z_rel].min
                    end
                    repisas_z_resueltas << cota_final

                    z_rep_panel = z_int_base + (z_start_num + cota_final).mm

                    if es_tipo_h && sub_parantes_resueltos.length > 0
                      # Subdividir repisa en los sub-vanos para que no colisione con el sub-parante vertical
                      num_sub_vanos = sub_parantes_resueltos.length + 1
                      num_sub_vanos.times do |sv|
                        sub_x_start = (sv == 0) ? x_start_num : (sub_parantes_resueltos[sv - 1][:x] + t_num)
                        sub_x_end   = (sv == sub_parantes_resueltos.length) ? x_end_num : sub_parantes_resueltos[sv][:x]
                        sub_ancho   = [sub_x_end - sub_x_start, 0.0].max

                        CabinetBuilder.crear_panel(
                          grupo_mod, "M#{idx + 1} Repisa E#{s_idx + 1}-V#{sv + 1}-#{r_idx + 1}",
                          x_pos + x_offset_int + sub_x_start.mm, y_rep_start, z_rep_panel,
                          sub_ancho.mm, prof_rep_num.mm, t,
                          {
                            'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-E#{s_idx + 1}-V#{sv + 1}-REP-#{r_idx + 1}",
                            'pieza_nombre' => "M#{idx + 1} Repisa E#{s_idx + 1} V#{sv + 1}-#{r_idx + 1}", 'material' => mat_estructura,
                            'resistencia' => resistencia,
                            'largo_bruto_mm' => sub_ancho, 'ancho_bruto_mm' => prof_rep_num, 'espesor_mm' => t_num,
                            'largo_neto_mm' => sub_ancho - 1.0, 'ancho_neto_mm' => prof_rep_num - 1.0,
                            'cantidad' => 1, 'veta' => 'longitudinal',
                            'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                            'ranura' => 'Ninguna'
                          }
                        )
                      end
                    else
                      CabinetBuilder.crear_panel(
                        grupo_mod, "M#{idx + 1} Repisa E#{s_idx + 1}-#{r_idx + 1}",
                        x_pos + x_offset_int + x_start_num.mm, y_rep_start, z_rep_panel,
                        w_esp_num.mm, prof_rep_num.mm, t,
                        {
                          'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-E#{s_idx + 1}-REP-#{r_idx + 1}",
                          'pieza_nombre' => "M#{idx + 1} Repisa E#{s_idx + 1}-#{r_idx + 1}", 'material' => mat_estructura,
                          'resistencia' => resistencia,
                          'largo_bruto_mm' => w_esp_num, 'ancho_bruto_mm' => prof_rep_num, 'espesor_mm' => t_num,
                          'largo_neto_mm' => w_esp_num - 1.0, 'ancho_neto_mm' => prof_rep_num - 1.0,
                          'cantidad' => 1, 'veta' => 'longitudinal',
                          'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 0.5, 'canto_A2' => 0.5,
                          'ranura' => 'Ninguna'
                        }
                      )
                    end
                  end
                end
              end

            when 'cajonera'
              cant_caj = [(m_data['cant_cajones'] || 3).to_i, 2].max
              montaje_caj = m_data['cajones_montaje'] || 'exterior'
              tipo_corr = m_data['cajones_tipo_corredera'] || 'telescopica'
              luz_caj_num = (m_data['cajones_luz'] || params['luz_frentes'] || 3.0).to_f
              luz_caj = luz_caj_num.mm
              t_caja_num = 15.0
              t_caja = t_caja_num.mm

              desc_corr_num = case tipo_corr
                              when 'oculta' then 21.0
                              when 'metalica' then 37.5
                              else 26.0
                              end
              desc_corr = desc_corr_num.mm
              w_ext_box_num = [ancho_int_num - desc_corr_num, 60.0].max
              w_ext_box = w_ext_box_num.mm
              tiene_puertas_mod_local = (m_data['tiene_puertas'] == true || m_data['tiene_puertas'] == 'true' || tipo_interior == 'puertas')
              pos_p_local = m_data['puertas_posicion_bisagra'] || 'derecha'
              es_corrediza_local = tiene_puertas_mod_local && (pos_p_local == 'corrediza')

              max_slide_num = es_corrediza_local ? [prof_carcasa_num - 80.0 - 30.0, 250.0].max : [prof_carcasa_num - 30.0, 250.0].max
              largo_slide_num = if m_data['cajones_largo_corredera'] && m_data['cajones_largo_corredera'].to_s != 'auto' && m_data['cajones_largo_corredera'].to_f > 0
                                  [max_slide_num, m_data['cajones_largo_corredera'].to_f].min
                                else
                                  slide_calc = 250.0
                                  [250.0, 300.0, 350.0, 400.0, 450.0, 500.0, 550.0, 600.0].each do |s|
                                    slide_calc = s if s <= max_slide_num
                                  end
                                  slide_calc
                                end
              largo_slide = largo_slide_num.mm

              alto_fr_num = if es_corrediza_local
                              (h_vano_util_num - ((cant_caj + 1) * luz_caj_num)) / cant_caj.to_f
                            elsif montaje_caj == 'exterior'
                              (h_carcasa_num - ((cant_caj + 1) * luz_caj_num)) / cant_caj.to_f
                            else
                              (h_vano_util_num - ((cant_caj + 1) * luz_caj_num)) / cant_caj.to_f
                            end
              ancho_fr_num = if es_corrediza_local
                               ancho_int_num - (2 * luz_caj_num)
                             elsif montaje_caj == 'exterior'
                               tiene_laterales ? (w_mod_num - (2 * luz_caj_num)) : (ancho_int_num - (2 * luz_caj_num))
                             else
                               ancho_int_num - (2 * luz_caj_num)
                             end
              x_fr = if es_corrediza_local
                       x_pos + x_offset_int + luz_caj
                     elsif montaje_caj == 'exterior'
                       tiene_laterales ? (x_pos + luz_caj) : (x_pos + x_offset_int + luz_caj)
                     else
                       x_pos + x_offset_int + luz_caj
                     end
              y_fr_base = if es_corrediza_local
                            y_carcasa_start + 80.0.mm
                          elsif montaje_caj == 'exterior'
                            y_carcasa_start - t
                          else
                            y_carcasa_start + luz_caj
                          end
              z_fr_base = (montaje_caj == 'exterior' && !es_corrediza_local) ? (z_base + luz_caj) : (z_int_base + luz_caj)
              if alto_fr_num > 320.0
                puts "[JPQMelaminaPro] AVISO TÉCNICO: Módulo #{idx + 1} tiene frentes de cajón de #{alto_fr_num.round}mm (>320mm). Se limita la caja interna a 240mm por normativa de peso y correderas."
              end
              alto_box_num = [[(alto_fr_num - 42.0), 60.0].max, 240.0].min

              cant_caj.times do |c_idx|
                z_fr = z_fr_base + (c_idx * (alto_fr_num + luz_caj_num)).mm

                # 1. Frente de cajón
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Frente Cajón #{c_idx + 1}",
                  x_fr, y_fr_base, z_fr,
                  ancho_fr_num.mm, t, alto_fr_num.mm,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-FR-CAJ-#{c_idx + 1}",
                    'pieza_nombre' => "M#{idx + 1} Frente Cajón #{c_idx + 1} (#{montaje_caj})", 'material' => mat_frentes,
                    'resistencia' => resistencia,
                    'largo_bruto_mm' => ancho_fr_num, 'ancho_bruto_mm' => alto_fr_num, 'espesor_mm' => t_num,
                    'largo_neto_mm' => ancho_fr_num - 4.0, 'ancho_neto_mm' => alto_fr_num - 4.0,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 2.0, 'canto_L2' => 2.0, 'canto_A1' => 2.0, 'canto_A2' => 2.0,
                    'ranura' => "Tirador central, montaje #{montaje_caj}",
                    'Tipo_Herraje' => 'corredera_telescopica',
                    'Profundidad_Corredera' => largo_slide_num
                  }
                )

                # 2. Caja de gaveta: Laterales, Contrafrente, Trasera y Fondo MDF 3mm
                x_box = x_pos + x_offset_int + (desc_corr / 2.0)
                y_box = (montaje_caj == 'exterior') ? y_carcasa_start : (y_fr_base + t)
                z_box = z_fr + 16.0.mm

                # Lateral Izquierdo de gaveta
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Lat Izq Gaveta #{c_idx + 1}",
                  x_box, y_box, z_box,
                  t_caja, largo_slide, alto_box_num.mm,
                  { 'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-CAJ-#{c_idx + 1}-LI", 'pieza_nombre' => "M#{idx + 1} Lat Izq Gaveta #{c_idx + 1}", 'material' => 'Melamina Blanca 15mm', 'espesor_mm' => t_caja_num, 'largo_bruto_mm' => largo_slide_num, 'ancho_bruto_mm' => alto_box_num, 'cantidad' => 1 }
                )
                # Lateral Derecho de gaveta
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Lat Der Gaveta #{c_idx + 1}",
                  x_box + w_ext_box - t_caja, y_box, z_box,
                  t_caja, largo_slide, alto_box_num.mm,
                  { 'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-CAJ-#{c_idx + 1}-LD", 'pieza_nombre' => "M#{idx + 1} Lat Der Gaveta #{c_idx + 1}", 'material' => 'Melamina Blanca 15mm', 'espesor_mm' => t_caja_num, 'largo_bruto_mm' => largo_slide_num, 'ancho_bruto_mm' => alto_box_num, 'cantidad' => 1 }
                )
                # Contrafrente
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Contrafrente Gaveta #{c_idx + 1}",
                  x_box + t_caja, y_box, z_box,
                  (w_ext_box_num - (2 * t_caja_num)).mm, t_caja, alto_box_num.mm,
                  { 'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-CAJ-#{c_idx + 1}-CF", 'pieza_nombre' => "M#{idx + 1} Contrafrente Gaveta #{c_idx + 1}", 'material' => 'Melamina Blanca 15mm', 'espesor_mm' => t_caja_num, 'largo_bruto_mm' => w_ext_box_num - (2 * t_caja_num), 'ancho_bruto_mm' => alto_box_num, 'cantidad' => 1 }
                )
                # Trasera
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Trasera Gaveta #{c_idx + 1}",
                  x_box + t_caja, y_box + largo_slide - t_caja, z_box,
                  (w_ext_box_num - (2 * t_caja_num)).mm, t_caja, alto_box_num.mm,
                  { 'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-CAJ-#{c_idx + 1}-TR", 'pieza_nombre' => "M#{idx + 1} Trasera Gaveta #{c_idx + 1}", 'material' => 'Melamina Blanca 15mm', 'espesor_mm' => t_caja_num, 'largo_bruto_mm' => w_ext_box_num - (2 * t_caja_num), 'ancho_bruto_mm' => alto_box_num, 'cantidad' => 1 }
                )
                # Fondo MDF 3mm
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Fondo MDF Gaveta #{c_idx + 1}",
                  x_box + 4.0.mm, y_box + 4.0.mm, z_box + 12.0.mm,
                  (w_ext_box_num - 8.0).mm, (largo_slide_num - 8.0).mm, 3.0.mm,
                  { 'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-CAJ-#{c_idx + 1}-FND", 'pieza_nombre' => "M#{idx + 1} Fondo MDF Gaveta #{c_idx + 1}", 'material' => 'MDF Fondo Blanco 3mm', 'espesor_mm' => 3.0, 'largo_bruto_mm' => largo_slide_num - 8.0, 'ancho_bruto_mm' => w_ext_box_num - 8.0, 'cantidad' => 1 }
                )
              end
            end

            # D. Puertas Independientes (compatibles con repisas, cajoneras o carcasa)
            tiene_puertas_mod = (m_data['tiene_puertas'] == true || m_data['tiene_puertas'] == 'true' || tipo_interior == 'puertas')
            if tiene_puertas_mod
              montaje_p = m_data['puertas_montaje'] || 'exterior'
              posicion_p = m_data['puertas_posicion_bisagra'] || ((w_mod_num > 600.0) ? 'doble' : 'derecha')
              es_corrediza = (posicion_p == 'corrediza')

              if es_corrediza
                # =============================================================
                # SISTEMA DE PUERTAS CORREDIZAS DE 2 VÍAS (ALUMINIO DUCASSE/PLACARD)
                # =============================================================
                w_vano_num = tiene_laterales ? [w_mod_num - (2 * t_num), 100.0].max : w_mod_num
                x_vano_start = tiene_laterales ? (x_pos + t) : x_pos
                traslape_num = 30.0 # mm traslape estándar entre hojas
                ancho_hoja_num = ((w_vano_num + traslape_num) / 2.0).round
                alto_hoja_num = [h_vano_util_num - 16.0, 100.0].max
                z_hoja = z_int_base + 8.0.mm

                # 1. Riel Superior Doble Canal (Aluminio Anodizado)
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Riel Superior Doble Canal Corredizo",
                  x_vano_start, y_carcasa_start + 4.0.mm, z_int_base + (h_vano_util_num - 40.0).mm,
                  w_vano_num.mm, 72.0.mm, 40.0.mm,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-RIEL-SUP",
                    'pieza_nombre' => "M#{idx + 1} Riel Superior Doble Canal Corredizo (Aluminio)", 'material' => 'Herraje Metal Satinado',
                    'resistencia' => resistencia,
                    'largo_bruto_mm' => w_vano_num, 'ancho_bruto_mm' => 72.0, 'espesor_mm' => 40.0,
                    'cantidad' => 1, 'Tipo_Herraje' => 'riel_corrediza_superior'
                  }
                )

                # 2. Riel Inferior Doble Guía (Aluminio Anodizado)
                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Riel Inferior Doble Guía Corredizo",
                  x_vano_start, y_carcasa_start + 4.0.mm, z_int_base,
                  w_vano_num.mm, 72.0.mm, 10.0.mm,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-RIEL-INF",
                    'pieza_nombre' => "M#{idx + 1} Riel Inferior Doble Guía Corredizo (Aluminio)", 'material' => 'Herraje Metal Satinado',
                    'resistencia' => resistencia,
                    'largo_bruto_mm' => w_vano_num, 'ancho_bruto_mm' => 72.0, 'espesor_mm' => 10.0,
                    'cantidad' => 1, 'Tipo_Herraje' => 'riel_corrediza_inferior'
                  }
                )

                # 3. Dos Hojas Corredizas Traslapadas
                2.times do |p_idx|
                  x_p = (p_idx == 0) ? x_vano_start : (x_vano_start + (w_vano_num - ancho_hoja_num).mm)
                  y_p = (p_idx == 0) ? (y_carcasa_start + 12.0.mm) : (y_carcasa_start + (12.0 + t_num + 8.0).mm)
                  lado = (p_idx == 0) ? 'izquierdo' : 'derecho'
                  nombre_hoja = (p_idx == 0) ? 'Hoja 1 (Interior)' : 'Hoja 2 (Exterior)'

                  panel_puerta = CabinetBuilder.crear_panel(
                    grupo_mod, "M#{idx + 1} Puerta Corrediza #{p_idx + 1}",
                    x_p, y_p, z_hoja,
                    ancho_hoja_num.mm, t, alto_hoja_num.mm,
                    {
                      'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-PTA-CORR-#{p_idx + 1}",
                      'pieza_nombre' => "M#{idx + 1} Puerta Corrediza #{nombre_hoja}", 'material' => mat_frentes,
                      'resistencia' => resistencia,
                      'largo_bruto_mm' => alto_hoja_num, 'ancho_bruto_mm' => ancho_hoja_num, 'espesor_mm' => t_num,
                      'largo_neto_mm' => alto_hoja_num - 4.0, 'ancho_neto_mm' => ancho_hoja_num - 4.0,
                      'cantidad' => 1, 'veta' => 'longitudinal',
                      'canto_L1' => 2.0, 'canto_L2' => 2.0, 'canto_A1' => 2.0, 'canto_A2' => 2.0,
                      'ranura' => 'Guías correderas con rodamientos',
                      'Tipo_Herraje' => 'puerta_corrediza',
                      'Lado_Bisagra' => lado
                    }
                  )

                  # Perfil Tirador de Aluminio en el canto exterior
                  x_tir = (p_idx == 0) ? (x_p + 2.0.mm) : (x_p + (ancho_hoja_num - 16.0).mm)
                  CabinetBuilder.crear_panel(
                    grupo_mod, "M#{idx + 1} Perfil Tirador Corredizo #{p_idx + 1}",
                    x_tir, y_p - 3.0.mm, z_hoja,
                    14.0.mm, (t_num + 6.0).mm, alto_hoja_num.mm,
                    {
                      'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-TIR-CORR-#{p_idx + 1}",
                      'pieza_nombre' => "M#{idx + 1} Perfil Tirador Corredizo Hoja #{p_idx + 1}", 'material' => 'Herraje Metal Satinado',
                      'resistencia' => resistencia,
                      'largo_bruto_mm' => alto_hoja_num, 'ancho_bruto_mm' => 14.0, 'espesor_mm' => t_num + 6.0,
                      'cantidad' => 1, 'Tipo_Herraje' => 'puerta_corrediza',
                      'Lado_Bisagra' => lado
                    }
                  )
                end
              else
                luz_p_num = (m_data['puertas_luz'] || params['luz_frentes'] || 3.0).to_f
                luz_p = luz_p_num.mm
                cant_p = (posicion_p == 'doble') ? 2 : 1

              alto_p_num = (montaje_p == 'interior') ? (h_vano_util_num - (2 * luz_p_num)) : (h_carcasa_num - (2 * luz_p_num))
              ancho_p_num = if montaje_p == 'interior'
                              (cant_p == 2) ? ((ancho_int_num - (3 * luz_p_num)) / 2.0) : (ancho_int_num - (2 * luz_p_num))
                            elsif montaje_p == 'medio'
                              (cant_p == 2) ? ((ancho_int_num + (2 * t_num) - (3 * luz_p_num)) / 2.0) : (ancho_int_num + t_num - (2 * luz_p_num))
                            else
                              (cant_p == 2) ? ((w_mod_num - (3 * luz_p_num)) / 2.0) : (w_mod_num - (2 * luz_p_num))
                            end
              y_p = (montaje_p == 'interior') ? (y_carcasa_start + luz_p) : (y_carcasa_start - t)
              z_p = (montaje_p == 'interior') ? (z_int_base + luz_p) : (z_base + luz_p)

              cant_bis = case m_data['puertas_cant_bisagras'].to_s
                         when '2' then 2
                         when '3' then 3
                         when '4' then 4
                         when '5' then 5
                         else
                           (posicion_p == 'superior' || posicion_p == 'inferior') ? ((ancho_p_num > 900.0) ? 3 : 2) : (alto_p_num > 2000.0 ? 5 : (alto_p_num > 1600.0 ? 4 : (alto_p_num > 900.0 ? 3 : 2)))
                         end

              x_centro_parante_num = nil
              if tipo_interior == 'repisas' && m_data['parantes_tipo'] == 'vertical' && defined?(parantes_resueltos) && parantes_resueltos && parantes_resueltos.length == 1
                p_v = parantes_resueltos.first
                p_v_num = p_v.is_a?(Hash) ? (p_v[:x] || p_v['x'] || 0.0).to_f : p_v.to_f
                x_centro_parante_num = (tiene_laterales ? t_num : 0.0) + p_v_num + (t_num / 2.0)
              end

              cant_p.times do |p_idx|
                ancho_hoja_p_num = ancho_p_num
                x_p = if cant_p == 2 && x_centro_parante_num
                        if montaje_p == 'interior'
                          if p_idx == 0
                            ancho_hoja_p_num = x_centro_parante_num - t_num - (1.5 * luz_p_num)
                            x_pos + t + luz_p
                          else
                            ancho_hoja_p_num = w_mod_num - t_num - x_centro_parante_num - (1.5 * luz_p_num)
                            x_pos + x_centro_parante_num.mm + (luz_p / 2.0)
                          end
                        else
                          if p_idx == 0
                            ancho_hoja_p_num = x_centro_parante_num - (1.5 * luz_p_num)
                            x_pos + luz_p
                          else
                            ancho_hoja_p_num = w_mod_num - x_centro_parante_num - (1.5 * luz_p_num)
                            x_pos + x_centro_parante_num.mm + (luz_p / 2.0)
                          end
                        end
                      elsif cant_p == 2
                        x_base_leaf = (montaje_p == 'interior') ? (x_pos + x_offset_int + luz_p) : (x_pos + luz_p)
                        x_base_leaf + (p_idx * (ancho_p_num + luz_p_num)).mm
                      else
                        (montaje_p == 'interior') ? (x_pos + x_offset_int + luz_p) : (x_pos + luz_p)
                      end

                CabinetBuilder.crear_panel(
                  grupo_mod, "M#{idx + 1} Puerta #{p_idx + 1}",
                  x_p, y_p, z_p,
                  ancho_hoja_p_num.mm, t, alto_p_num.mm,
                  {
                    'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-PTA-#{p_idx + 1}",
                    'pieza_nombre' => "M#{idx + 1} Puerta #{p_idx + 1} (#{montaje_p})#{x_centro_parante_num ? ' [Cierre a Parante Central]' : ''}", 'material' => mat_frentes,
                    'resistencia' => resistencia,
                    'largo_bruto_mm' => alto_p_num, 'ancho_bruto_mm' => ancho_hoja_p_num, 'espesor_mm' => t_num,
                    'largo_neto_mm' => alto_p_num - 4.0, 'ancho_neto_mm' => ancho_hoja_p_num - 4.0,
                    'cantidad' => 1, 'veta' => 'longitudinal',
                    'canto_L1' => 2.0, 'canto_L2' => 2.0, 'canto_A1' => 2.0, 'canto_A2' => 2.0,
                    'ranura' => "#{cant_bis} cazoletas Ø35x11.5mm (K=4.5mm) - [Bisagras #{posicion_p}]",
                    'bisagras_cant' => cant_bis,
                    'bisagras_posicion' => posicion_p,
                    'perforacion_cazoleta' => "#{cant_bis}x Ø35mm K=4.5mm",
                    'Tipo_Herraje' => (posicion_p == 'superior') ? 'piston_gas_superior' : ((posicion_p == 'inferior') ? 'piston_gas_inverso' : 'bisagra_batiente'),
                    'Lado_Bisagra' => (cant_p == 2) ? ((p_idx == 0) ? 'izquierdo' : 'derecho') : posicion_p
                  }
                )
              end
            end
          end
        end

          # ====================================================================
          # Posicionamiento inteligente no destructivo:
          # Si ya existen otros muebles o componentes en el espacio de trabajo,
          # ubicar el nuevo mueble al lado (a lo largo del eje X) con una
          # separación de 300 mm para evitar sobreponerse con los diseños previos.
          # ====================================================================
          otros_elementos = model.active_entities.select do |e|
            e != grupo_composicion && e.valid? && (e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance))
          end
          otros_elementos.reject! { |e| e.bounds.empty? }

          unless otros_elementos.empty? || es_edicion
            max_x = otros_elementos.map { |e| e.bounds.max.x }.max
            if max_x && max_x.to_f.finite?
              separacion = 300.mm
              desplazamiento_x = max_x + separacion
              tr = Geom::Transformation.translation([desplazamiento_x, 0, 0])
              grupo_composicion.transform!(tr)
            end
          end

          model.commit_operation
          model.selection.clear rescue nil
          model.selection.add(grupo_composicion) rescue nil
          model.active_view.zoom_extents if model.active_view
          model.active_view.invalidate if model.active_view

          File.open(log_path, 'a') do |f|
            f.puts("[#{Time.now}] EXITO TOTAL: Mueble #{composicion_id} construido con #{modulos_data.length} modulos.")
          end

          UI.messagebox("JPQMelaminaPro: ¡Diseño insertado con éxito en SketchUp 3D!\n\nSe crearon #{modulos_data.length} módulos (#{ancho_total_num.to_i} x #{alto_total_num.to_i} x #{prof_total_num.to_i} mm).")

          { 'ok' => true, 'mensaje' => "Composición modular de #{modulos_data.length} módulos creada exitosamente.", 'modulo_id' => composicion_id }
        rescue => e
          model.abort_operation
          File.open(log_path, 'a') do |f|
            f.puts("[#{Time.now}] ERROR FATAL al construir: #{e.class} - #{e.message}")
            f.puts(e.backtrace.first(15).join("\n")) if e.backtrace
          end
          puts "[JPQMelaminaPro] ERROR al construir módulos: #{e.message}"
          puts e.backtrace.first(6).join("\n") if e.backtrace
          UI.messagebox("JPQMelaminaPro ERROR al insertar en SketchUp:\n\n#{e.class}: #{e.message}\n\nEn: #{e.backtrace ? e.backtrace.first : 'desconocido'}")
          { 'ok' => false, 'error' => "#{e.message} (en #{File.basename(e.backtrace.first)})", 'backtrace' => e.backtrace }
        end
      end
    end
  end
end
