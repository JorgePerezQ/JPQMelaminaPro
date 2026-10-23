# ==============================================================================
# Archivo: jpq_melamina_pro/core/cabinet_builder.rb
# Descripción: Motor geométrico 3D y matemático milimétrico profesional.
#              Diseña muebles estructuralmente estables y normalizados para carpintería:
#              - Libreros / Estanterías con Zócalo de apoyo
#              - Módulos Bajos de Cocina con Zócalo sanitario y Amarres
#              - Alacenas / Módulos Aéreos con refuerzo de colgado
#              - Escritorios con Faldón de Arriostramiento lateral (anti-bamboleo)
#              - Cómodas con Zócalo y Travesaños de rigidez entre cajones
#              - Roperos / Clósets de 2 Cuerpos con Maletero y Tubo Perchero
# ==============================================================================

require 'sketchup.rb'

module JPQMelaminaPro
  class CabinetBuilder
    class << self
      attr_accessor :ultimo_modulo_activo
      # ========================================================================
      # Método: build
      # Descripción: Punto de entrada para generar cualquier mueble paramétrico 3D.
      # Parámetros:
      #   - params (Hash): Diccionario completo con dimensiones, tipo y opciones de taller.
      # ========================================================================
      def build(params)
        model = Sketchup.active_model
        model.start_operation('JPQMelaminaPro: Crear Módulo Profesional', true)

        begin
          tipo_mod = params['tipo'] || 'librero'
          resultado = case tipo_mod
          when 'escritorio'
            construir_escritorio(model, params)
          when 'comoda'
            construir_comoda(model, params)
          when 'ropero'
            construir_ropero(model, params)
          when 'aereo'
            construir_modulo_aereo(model, params)
          when 'bajo'
            construir_modulo_bajo(model, params)
          else
            construir_librero_estandar(model, params)
          end

          model.commit_operation
          resultado
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => "#{e.message} (en #{File.basename(e.backtrace.first)})", 'backtrace' => e.backtrace }
        end
      end

      # ========================================================================
      # 1. ESCRITORIO PROFESIONAL CON FALDÓN ESTRUCTURAL ANTI-BAMBOLEO
      # ========================================================================
      def construir_escritorio(model, params)
        alto_total  = params['alto'].to_f.mm
        ancho_total = params['ancho'].to_f.mm
        prof_total  = params['profundidad'].to_f.mm
        t_num       = (params['espesor'] && params['espesor'].to_f > 0) ? params['espesor'].to_f : 18.0
        t           = t_num.mm
        material    = params['material'] || 'Pelikano Blanco Nieve 18mm'
        nombre_mod  = params['nombre'] || 'Escritorio Profesional'
        modulo_id   = params['modulo_id'] || "ESC-#{Time.now.to_i % 10000}"

        alto_num  = params['alto'].to_f
        ancho_num = params['ancho'].to_f
        prof_num  = params['profundidad'].to_f

        grupo_modulo = inicializar_grupo(model, params, nombre_mod, modulo_id, 'escritorio')

        # Vuelo frontal de la cubierta (20mm de voladizo para confort de muñecas)
        vuelo_mm = (params['vuelo'] || 20.0).to_f
        vuelo    = vuelo_mm.mm

        prof_patas = prof_total - vuelo
        alto_patas = alto_total - t

        # A. Cubierta Principal Superior
        # Inicia exactamente en Y = 0.mm para alinearse sobre el eje frontal (línea roja)
        crear_panel(
          grupo_modulo, 'Cubierta Escritorio',
          0.mm, 0.mm, alto_patas,
          ancho_total, prof_total, t,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-CUBIERTA",
            'pieza_nombre' => 'Cubierta Superior', 'material' => material,
            'largo_bruto_mm' => ancho_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_num - 4.0, 'ancho_neto_mm' => prof_num - 4.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 2.0, 'canto_L2' => 2.0, 'canto_A1' => 2.0, 'canto_A2' => 2.0,
            'ranura' => 'Ninguna'
          }
        )

        # B. Patas / Laterales de Soporte (Izquierdo y Derecho)
        canto_patas = { 'canto_L1' => 2.0, 'canto_L2' => 0.45, 'canto_A1' => 0.45, 'canto_A2' => 0.45 }
        crear_panel(
          grupo_modulo, 'Pata Lateral Izquierda',
          0.mm, vuelo, 0.mm,
          t, prof_patas, alto_patas,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PATA-IZQ",
            'pieza_nombre' => 'Pata Lateral Izquierda', 'material' => material,
            'largo_bruto_mm' => alto_num - t_num, 'ancho_bruto_mm' => prof_num - vuelo_mm, 'espesor_mm' => t_num,
            'largo_neto_mm' => alto_num - t_num - 2.45, 'ancho_neto_mm' => prof_num - vuelo_mm - 0.9,
            'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => 'Ninguna'
          }.merge(canto_patas)
        )

        crear_panel(
          grupo_modulo, 'Pata Lateral Derecha',
          ancho_total - t, vuelo, 0.mm,
          t, prof_patas, alto_patas,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PATA-DER",
            'pieza_nombre' => 'Pata Lateral Derecha', 'material' => material,
            'largo_bruto_mm' => alto_num - t_num, 'ancho_bruto_mm' => prof_num - vuelo_mm, 'espesor_mm' => t_num,
            'largo_neto_mm' => alto_num - t_num - 2.45, 'ancho_neto_mm' => prof_num - vuelo_mm - 0.9,
            'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => 'Ninguna'
          }.merge(canto_patas)
        )

        # C. FALDÓN TRASERO ESTRUCTURAL (Elemento de Arriostramiento Anti-Bamboleo)
        alto_faldon_mm = [alto_num * 0.45, 350.0].min
        alto_faldon    = alto_faldon_mm.mm
        ancho_int_num  = ancho_num - (2 * t_num)
        pos_z_faldon   = alto_patas - alto_faldon

        crear_panel(
          grupo_modulo, 'Faldón Estructural Arriostrador',
          t, prof_total - t - 50.mm, pos_z_faldon,
          ancho_total - (2 * t), t, alto_faldon,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-FALDON",
            'pieza_nombre' => 'Faldón Arriostrador Trasero', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => alto_faldon_mm, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => alto_faldon_mm - 0.45,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 0.45, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ninguna'
          }
        )

        # D. CAJONERA INTEGRADA (Pedestal de 3 Cajones paramétrico)
        cajonera_pos = params['cajonera_pos'] || 'ninguna'
        if cajonera_pos != 'ninguna' && ancho_num >= 850.0
          ancho_caj_mm = 380.0
          ancho_caj = ancho_caj_mm.mm
          x_caj_base = (cajonera_pos == 'derecha') ? (ancho_total - t - ancho_caj) : t
          x_lat_int  = (cajonera_pos == 'derecha') ? x_caj_base : (x_caj_base + ancho_caj - t)

          # Lateral interior divisor del pedestal
          crear_panel(
            grupo_modulo, 'Lateral Pedestal Cajonera',
            x_lat_int, vuelo, 0.mm,
            t, prof_patas, alto_patas,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-LAT-CAJ",
              'pieza_nombre' => 'Lateral Pedestal Cajonera', 'material' => material,
              'largo_bruto_mm' => alto_num - t_num, 'ancho_bruto_mm' => prof_num - vuelo_mm, 'espesor_mm' => t_num,
              'largo_neto_mm' => alto_num - t_num - 1.0, 'ancho_neto_mm' => prof_num - vuelo_mm - 0.45,
              'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => 'Ninguna'
            }.merge(canto_patas)
          )

          # Piso base del pedestal (Zócalo de 60mm)
          zocalo_caj_mm = 60.0
          zocalo_caj = zocalo_caj_mm.mm
          x_piso_caj = (cajonera_pos == 'derecha') ? (x_caj_base + t) : t
          crear_panel(
            grupo_modulo, 'Piso Pedestal Cajonera',
            x_piso_caj, vuelo, zocalo_caj,
            ancho_caj - (2 * t), prof_patas, t,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PISO-CAJ",
              'pieza_nombre' => 'Piso Pedestal Cajonera', 'material' => material,
              'largo_bruto_mm' => ancho_caj_mm - (2 * t_num), 'ancho_bruto_mm' => prof_num - vuelo_mm, 'espesor_mm' => t_num,
              'largo_neto_mm' => ancho_caj_mm - (2 * t_num) - 0.45, 'ancho_neto_mm' => prof_num - vuelo_mm - 0.45,
              'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => 'Ninguna'
            }
          )

          # 3 Cajones en el pedestal
          alto_vano_caj = alto_patas - zocalo_caj - t
          cant_caj = 3
          luz_caj_mm = 3.0
          h_frente_mm = (alto_vano_caj.to_mm - (cant_caj * luz_caj_mm)) / cant_caj
          h_frente = h_frente_mm.mm

          cant_caj.times do |idx|
            z_frente = zocalo_caj + t + (idx * (h_frente + luz_caj_mm.mm)) + luz_caj_mm.mm
            crear_panel(
              grupo_modulo, "Frente Cajón #{idx + 1}",
              x_piso_caj, vuelo - 2.mm, z_frente,
              ancho_caj - (2 * t), t, h_frente,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-FR-CAJ-#{idx+1}",
                'pieza_nombre' => "Frente Cajón Pedestal #{idx + 1}", 'material' => material,
                'largo_bruto_mm' => ancho_caj_mm - (2 * t_num), 'ancho_bruto_mm' => h_frente_mm, 'espesor_mm' => t_num,
                'largo_neto_mm' => ancho_caj_mm - (2 * t_num) - 2.0, 'ancho_neto_mm' => h_frente_mm - 2.0,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 1.0, 'canto_L2' => 1.0, 'canto_A1' => 1.0, 'canto_A2' => 1.0, 'ranura' => 'Ninguna'
              }
            )
          end
        end

        # E. NICHO PARA TORRE PC CON REPISA ELEVADA DE VENTILACIÓN
        pc_pos = params['pc_pos'] || 'ninguna'
        if pc_pos != 'ninguna' && pc_pos != cajonera_pos && ancho_num >= 950.0
          ancho_pc_mm = 240.0
          ancho_pc = ancho_pc_mm.mm
          x_pc_base = (pc_pos == 'derecha') ? (ancho_total - t - ancho_pc) : t
          x_lat_pc  = (pc_pos == 'derecha') ? x_pc_base : (x_pc_base + ancho_pc - t)

          # Lateral divisor del nicho PC
          crear_panel(
            grupo_modulo, 'Lateral Nicho CPU',
            x_lat_pc, vuelo, 0.mm,
            t, prof_patas, alto_patas,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-LAT-CPU",
              'pieza_nombre' => 'Lateral Nicho CPU', 'material' => material,
              'largo_bruto_mm' => alto_num - t_num, 'ancho_bruto_mm' => prof_num - vuelo_mm, 'espesor_mm' => t_num,
              'largo_neto_mm' => alto_num - t_num - 1.0, 'ancho_neto_mm' => prof_num - vuelo_mm - 0.45,
              'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => 'Ninguna'
            }.merge(canto_patas)
          )

          # Repisa elevada para PC (60mm del suelo para proteger de polvo y humedad)
          x_piso_pc = (pc_pos == 'derecha') ? (x_pc_base + t) : t
          crear_panel(
            grupo_modulo, 'Base Elevada CPU',
            x_piso_pc, vuelo + 20.mm, 60.mm,
            ancho_pc - (2 * t), prof_patas - 40.mm, t,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-BASE-CPU",
              'pieza_nombre' => 'Base Ventilada CPU', 'material' => material,
              'largo_bruto_mm' => ancho_pc_mm - (2 * t_num), 'ancho_bruto_mm' => prof_num - vuelo_mm - 40.0, 'espesor_mm' => t_num,
              'largo_neto_mm' => ancho_pc_mm - (2 * t_num) - 0.45, 'ancho_neto_mm' => prof_num - vuelo_mm - 40.0 - 0.45,
              'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => 'Ninguna'
            }
          )
        end

        # F. REPISA ALZADA PARA MONITOR O IMPRESORA
        if params['impresora_alzada'] == true || params['impresora_alzada'] == 'true'
          h_alzada_mm = 140.0
          h_alzada    = h_alzada_mm.mm
          prof_alzada_mm = [prof_num * 0.42, 280.0].min
          prof_alzada    = prof_alzada_mm.mm
          z_alzada_sup   = alto_patas + t + h_alzada

          # Soporte izquierdo de repisa alzada
          crear_panel(
            grupo_modulo, 'Soporte Repisa Alzada Izq',
            0.mm, prof_total - prof_alzada, alto_patas + t,
            t, prof_alzada, h_alzada,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-SOP-ALZ-IZQ",
              'pieza_nombre' => 'Soporte Repisa Alzada Izq', 'material' => material,
              'largo_bruto_mm' => prof_alzada_mm, 'ancho_bruto_mm' => h_alzada_mm, 'espesor_mm' => t_num,
              'largo_neto_mm' => prof_alzada_mm - 0.45, 'ancho_neto_mm' => h_alzada_mm - 0.45,
              'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => 'Ninguna'
            }
          )

          # Soporte derecho de repisa alzada
          crear_panel(
            grupo_modulo, 'Soporte Repisa Alzada Der',
            ancho_total - t, prof_total - prof_alzada, alto_patas + t,
            t, prof_alzada, h_alzada,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-SOP-ALZ-DER",
              'pieza_nombre' => 'Soporte Repisa Alzada Der', 'material' => material,
              'largo_bruto_mm' => prof_alzada_mm, 'ancho_bruto_mm' => h_alzada_mm, 'espesor_mm' => t_num,
              'largo_neto_mm' => prof_alzada_mm - 0.45, 'ancho_neto_mm' => h_alzada_mm - 0.45,
              'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => 'Ninguna'
            }
          )

          # Repisa Superior para Monitor / Impresora
          crear_panel(
            grupo_modulo, 'Repisa Alzada Impresora / Monitor',
            0.mm, prof_total - prof_alzada, z_alzada_sup,
            ancho_total, prof_alzada, t,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-REP-ALZADA",
              'pieza_nombre' => 'Repisa Superior Monitor/Impresora', 'material' => material,
              'largo_bruto_mm' => ancho_num, 'ancho_bruto_mm' => prof_alzada_mm, 'espesor_mm' => t_num,
              'largo_neto_mm' => ancho_num - 2.0, 'ancho_neto_mm' => prof_alzada_mm - 2.0,
              'cantidad' => 1, 'veta' => 'longitudinal',
              'canto_L1' => 1.0, 'canto_L2' => 1.0, 'canto_A1' => 1.0, 'canto_A2' => 1.0, 'ranura' => 'Ninguna'
            }
          )
        end

        { 'ok' => true, 'modulo_id' => modulo_id, 'mensaje' => "Escritorio profesional con accesorios paramétricos creado exitosamente." }
      end

      # ========================================================================
      # 2. CÓMODA CON ZÓCALO Y TRAVESAÑOS INTERMEDIOS DE ESTABILIDAD
      # ========================================================================
      def construir_comoda(model, params)
        alto_total  = params['alto'].to_f.mm
        ancho_total = params['ancho'].to_f.mm
        prof_total  = params['profundidad'].to_f.mm
        t_num       = (params['espesor'] && params['espesor'].to_f > 0) ? params['espesor'].to_f : 18.0
        t           = t_num.mm
        material    = params['material'] || 'Melamina Blanca 18mm'
        nombre_mod  = params['nombre'] || 'Cómoda 4 Cajones'
        modulo_id   = params['modulo_id'] || "COM-#{Time.now.to_i % 10000}"

        alto_num  = params['alto'].to_f
        ancho_num = params['ancho'].to_f
        prof_num  = params['profundidad'].to_f

        grupo_modulo = inicializar_grupo(model, params, nombre_mod, modulo_id, 'comoda')

        # Zócalo inferior estructural de 80 mm para despegar los cajones del piso
        alto_zocalo_mm = 80.0
        alto_zocalo    = alto_zocalo_mm.mm
        ancho_int_num  = ancho_num - (2 * t_num)
        ancho_int      = ancho_total - (2 * t)

        # A. Laterales pasantes completos
        crear_panel(
          grupo_modulo, 'Lateral Izquierdo Cómoda',
          0.mm, 0.mm, 0.mm,
          t, prof_total, alto_total,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-LAT-IZQ",
            'pieza_nombre' => 'Lateral Izquierdo', 'material' => material,
            'largo_bruto_mm' => alto_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => alto_num - 1.0, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 1.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        crear_panel(
          grupo_modulo, 'Lateral Derecho Cómoda',
          ancho_total - t, 0.mm, 0.mm,
          t, prof_total, alto_total,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-LAT-DER",
            'pieza_nombre' => 'Lateral Derecho', 'material' => material,
            'largo_bruto_mm' => alto_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => alto_num - 1.0, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 1.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        # B. Zócalo Frontal y Trasero (Rigidez de Base)
        crear_panel(
          grupo_modulo, 'Zócalo Frontal',
          t, 25.mm, 0.mm, # retranqueado 25mm de la cara frontal para no chocar con pies
          ancho_int, t, alto_zocalo,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-ZOC-FRO",
            'pieza_nombre' => 'Zócalo Frontal Base', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => alto_zocalo_mm, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => alto_zocalo_mm - 0.45,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 0.45, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ninguna'
          }
        )

        crear_panel(
          grupo_modulo, 'Zócalo Trasero',
          t, prof_total - 25.mm - t, 0.mm,
          ancho_int, t, alto_zocalo,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-ZOC-TRA",
            'pieza_nombre' => 'Zócalo Trasero Base', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => alto_zocalo_mm, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => alto_zocalo_mm,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ninguna'
          }
        )

        # C. Piso encima del zócalo
        crear_panel(
          grupo_modulo, 'Piso Cómoda',
          t, 0.mm, alto_zocalo,
          ancho_int, prof_total, t,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PISO",
            'pieza_nombre' => 'Piso', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        # D. Techo Superior Cubierta
        crear_panel(
          grupo_modulo, 'Techo Cómoda',
          t, 0.mm, alto_total - t,
          ancho_int, prof_total, t,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-TECHO",
            'pieza_nombre' => 'Techo Superior', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        # E. Fondo MDF 3mm Enranurado para cuadratura absoluta
        agregar_fondo_enranurado(grupo_modulo, modulo_id, t, prof_total, alto_total - alto_zocalo, ancho_int_num, alto_num - alto_zocalo_mm, t_num, 8.0, 18.0, alto_zocalo)

        # F. Insertar automáticamente la cajonera estándar de 4 cajones
        DrawerBuilder.build({
          'cantidad_cajones' => 4,
          'largo_corredera' => [prof_num - 50.0, 450.0].min,
          'luz_entre_tapas' => 3.0,
          'espesor_caja' => t_num,
          'tipo_frente' => 'exterior'
        })

        { 'ok' => true, 'modulo_id' => modulo_id, 'mensaje' => "Cómoda profesional con zócalo y 4 cajones generada exitosamente." }
      end

      # ========================================================================
      # 3. ROPERO / CLÓSET DE 2 CUERPOS CON MALETERO Y PERCHERO
      # ========================================================================
      def construir_ropero(model, params)
        alto_total  = params['alto'].to_f.mm
        ancho_total = params['ancho'].to_f.mm
        prof_total  = params['profundidad'].to_f.mm
        t_num       = (params['espesor'] && params['espesor'].to_f > 0) ? params['espesor'].to_f : 18.0
        t           = t_num.mm
        material    = params['material'] || 'Melamina Roble Natural 18mm'
        nombre_mod  = params['nombre'] || 'Ropero Clóset 2 Cuerpos'
        modulo_id   = params['modulo_id'] || "ROP-#{Time.now.to_i % 10000}"

        alto_num  = params['alto'].to_f
        ancho_num = params['ancho'].to_f
        prof_num  = params['profundidad'].to_f

        grupo_modulo = inicializar_grupo(model, params, nombre_mod, modulo_id, 'ropero')

        alto_zocalo_mm = 80.0
        alto_zocalo    = alto_zocalo_mm.mm
        ancho_int_num  = ancho_num - (2 * t_num)
        ancho_int      = ancho_total - (2 * t)

        # A. Laterales Pasantes hasta el piso
        crear_panel(
          grupo_modulo, 'Lateral Izquierdo Ropero',
          0.mm, 0.mm, 0.mm,
          t, prof_total, alto_total,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-LAT-IZQ",
            'pieza_nombre' => 'Lateral Izquierdo', 'material' => material,
            'largo_bruto_mm' => alto_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => alto_num - 2.0, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 1.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        crear_panel(
          grupo_modulo, 'Lateral Derecho Ropero',
          ancho_total - t, 0.mm, 0.mm,
          t, prof_total, alto_total,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-LAT-DER",
            'pieza_nombre' => 'Lateral Derecho', 'material' => material,
            'largo_bruto_mm' => alto_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => alto_num - 2.0, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 1.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        # B. Zócalo estructural
        crear_panel(
          grupo_modulo, 'Zócalo Frontal Ropero',
          t, 30.mm, 0.mm,
          ancho_int, t, alto_zocalo,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-ZOC-FRO",
            'pieza_nombre' => 'Zócalo Frontal', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => alto_zocalo_mm, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => alto_zocalo_mm - 0.45,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 0.45, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ninguna'
          }
        )

        # C. Piso del armario
        crear_panel(
          grupo_modulo, 'Piso Ropero',
          t, 0.mm, alto_zocalo,
          ancho_int, prof_total, t,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PISO",
            'pieza_nombre' => 'Piso', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        # D. Techo
        crear_panel(
          grupo_modulo, 'Techo Ropero',
          t, 0.mm, alto_total - t,
          ancho_int, prof_total, t,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-TECHO",
            'pieza_nombre' => 'Techo', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        # E. Maletero Superior (Repisa horizontal a 400 mm del techo)
        dist_maletero_mm = 400.0
        pos_z_maletero = alto_total - t - dist_maletero_mm.mm
        crear_panel(
          grupo_modulo, 'Maletero Superior',
          t, 10.mm, pos_z_maletero,
          ancho_int, prof_total - 10.mm, t,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-MALETERO",
            'pieza_nombre' => 'Repisa Maletero Superior', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num - 10.0, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => prof_num - 11.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ninguna'
          }
        )

        # F. Parante / División Vertical Central (Divide el espacio inferior en 2 cuerpos iguales)
        alto_vano_inf = pos_z_maletero - (alto_zocalo + t)
        alto_vano_inf_num = (alto_num - t_num - dist_maletero_mm) - (alto_zocalo_mm + t_num)
        pos_x_parante = t + (ancho_int / 2.0) - (t / 2.0)

        crear_panel(
          grupo_modulo, 'Parante Central Ropero',
          pos_x_parante, 10.mm, alto_zocalo + t,
          t, prof_total - 10.mm, alto_vano_inf,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PARANTE-CENTRAL",
            'pieza_nombre' => 'Parante Central Divisor', 'material' => material,
            'largo_bruto_mm' => alto_vano_inf_num, 'ancho_bruto_mm' => prof_num - 10.0, 'espesor_mm' => t_num,
            'largo_neto_mm' => alto_vano_inf_num - 1.0, 'ancho_neto_mm' => prof_num - 10.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ninguna'
          }
        )

        # G. Lado Derecho: 3 Repisas organizadoras
        ancho_nicho = (ancho_int - t) / 2.0
        ancho_nicho_num = (ancho_int_num - t_num) / 2.0
        paso_repisas = alto_vano_inf / 4.0

        3.times do |i|
          z_r = (alto_zocalo + t) + (paso_repisas * (i + 1))
          crear_panel(
            grupo_modulo, "Repisa Nicho Derecho #{i + 1}",
            pos_x_parante + t, 15.mm, z_r,
            ancho_nicho, prof_total - 15.mm, t,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-REP-DER-#{i + 1}",
              'pieza_nombre' => "Repisa Ropero #{i + 1}", 'material' => material,
              'largo_bruto_mm' => ancho_nicho_num, 'ancho_bruto_mm' => prof_num - 15.0, 'espesor_mm' => t_num,
              'largo_neto_mm' => ancho_nicho_num, 'ancho_neto_mm' => prof_num - 16.0,
              'cantidad' => 1, 'veta' => 'longitudinal',
              'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
              'ranura' => 'Ninguna'
            }
          )
        end

        # H. Lado Izquierdo: Tubo Perchero para Colgar Ropa
        crear_tubo_perchero(grupo_modulo, t + 20.mm, prof_total / 2.0, pos_z_maletero - 60.mm, ancho_nicho - 40.mm)

        # I. Fondo MDF 3mm Completo
        agregar_fondo_enranurado(grupo_modulo, modulo_id, t, prof_total, alto_total - alto_zocalo, ancho_int_num, alto_num - alto_zocalo_mm, t_num, 8.0, 18.0, alto_zocalo)

        { 'ok' => true, 'modulo_id' => modulo_id, 'mensaje' => "Ropero de 2 cuerpos con maletero y tubo perchero creado exitosamente." }
      end

      # ========================================================================
      # 4. MÓDULO BAJO DE COCINA CON ZÓCALO Y AMARRES DE ARRIOSTRAMIENTO
      # ========================================================================
      def construir_modulo_bajo(model, params)
        alto_total  = params['alto'].to_f.mm
        ancho_total = params['ancho'].to_f.mm
        prof_total  = params['profundidad'].to_f.mm
        t_num       = (params['espesor'] && params['espesor'].to_f > 0) ? params['espesor'].to_f : 18.0
        t           = t_num.mm
        material    = params['material'] || 'Melamina Blanca 18mm'
        nombre_mod  = params['nombre'] || 'Módulo Bajo Cocina'
        modulo_id   = params['modulo_id'] || "BAJ-#{Time.now.to_i % 10000}"

        alto_num  = params['alto'].to_f
        ancho_num = params['ancho'].to_f
        prof_num  = params['profundidad'].to_f

        grupo_modulo = inicializar_grupo(model, params, nombre_mod, modulo_id, 'bajo')

        # Zócalo sanitario estándar de 100 mm (desmontable o continuo en cocina)
        alto_zocalo_mm = 100.0
        alto_zocalo    = alto_zocalo_mm.mm
        ancho_int_num  = ancho_num - (2 * t_num)
        ancho_int      = ancho_total - (2 * t)

        # Laterales
        crear_panel(
          grupo_modulo, 'Lateral Izquierdo Bajo',
          0.mm, 0.mm, 0.mm,
          t, prof_total, alto_total,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-LAT-IZQ",
            'pieza_nombre' => 'Lateral Izquierdo', 'material' => material,
            'largo_bruto_mm' => alto_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => alto_num - 2.0, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 1.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        crear_panel(
          grupo_modulo, 'Lateral Derecho Bajo',
          ancho_total - t, 0.mm, 0.mm,
          t, prof_total, alto_total,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-LAT-DER",
            'pieza_nombre' => 'Lateral Derecho', 'material' => material,
            'largo_bruto_mm' => alto_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => alto_num - 2.0, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 1.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        # Zócalo frontal sanitario
        crear_panel(
          grupo_modulo, 'Zócalo Sanitario Frontal',
          t, 40.mm, 0.mm, # retranqueado 40mm para meter los pies al cocinar
          ancho_int, t, alto_zocalo,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-ZOC-SAN",
            'pieza_nombre' => 'Zócalo Frontal Sanitario', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => alto_zocalo_mm, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => alto_zocalo_mm - 0.45,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 0.45, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ninguna'
          }
        )

        # Piso
        crear_panel(
          grupo_modulo, 'Piso Bajo Cocina',
          t, 0.mm, alto_zocalo,
          ancho_int, prof_total, t,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PISO",
            'pieza_nombre' => 'Piso', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        # Amarres superiores de 100mm (Regla de oro: No usar tapa completa en bajos de cocina para permitir paso de tuberías y mesada)
        ancho_amarre_mm = 100.0
        ancho_amarre = ancho_amarre_mm.mm

        crear_panel(
          grupo_modulo, 'Amarre Superior Frontal',
          t, 0.mm, alto_total - t,
          ancho_int, ancho_amarre, t,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-AMARRE-FRO",
            'pieza_nombre' => 'Amarre Frontal Superior', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => ancho_amarre_mm, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => ancho_amarre_mm - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ninguna'
          }
        )

        crear_panel(
          grupo_modulo, 'Amarre Superior Trasero Vertical',
          t, prof_total - t - 18.mm, alto_total - ancho_amarre, # Colocado vertical para anclar a muro
          ancho_int, t, ancho_amarre,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-AMARRE-TRA",
            'pieza_nombre' => 'Amarre Trasero Fijación Muro', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => ancho_amarre_mm, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => ancho_amarre_mm,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ninguna'
          }
        )

        # Repisa intermedia
        crear_panel(
          grupo_modulo, 'Repisa Central Bajo',
          t, 15.mm, alto_zocalo + t + ((alto_total - alto_zocalo - (2 * t)) / 2.0),
          ancho_int, prof_total - 25.mm, t,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-REP-CENTRAL",
            'pieza_nombre' => 'Repisa Central', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num - 25.0, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => prof_num - 26.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ninguna'
          }
        )

        agregar_fondo_enranurado(grupo_modulo, modulo_id, t, prof_total, alto_total - alto_zocalo, ancho_int_num, alto_num - alto_zocalo_mm, t_num, 8.0, 18.0, alto_zocalo)

        { 'ok' => true, 'modulo_id' => modulo_id, 'mensaje' => "Módulo bajo de cocina con zócalo sanitario y amarres creado con éxito." }
      end

      # ========================================================================
      # 5. ALACENA / MÓDULO AÉREO CON AMARRE TRASERO DE COLGADO
      # ========================================================================
      def construir_modulo_aereo(model, params)
        alto_total  = params['alto'].to_f.mm
        ancho_total = params['ancho'].to_f.mm
        prof_total  = params['profundidad'].to_f.mm
        t_num       = (params['espesor'] && params['espesor'].to_f > 0) ? params['espesor'].to_f : 18.0
        t           = t_num.mm
        material    = params['material'] || 'Melamina Blanca 18mm'
        nombre_mod  = params['nombre'] || 'Alacena Aérea Cocina'
        modulo_id   = params['modulo_id'] || "AER-#{Time.now.to_i % 10000}"

        alto_num  = params['alto'].to_f
        ancho_num = params['ancho'].to_f
        prof_num  = params['profundidad'].to_f

        grupo_modulo = inicializar_grupo(model, params, nombre_mod, modulo_id, 'aereo')

        ancho_int_num = ancho_num - (2 * t_num)
        ancho_int     = ancho_total - (2 * t)

        crear_panel(
          grupo_modulo, 'Lateral Izquierdo Aéreo',
          0.mm, 0.mm, 0.mm,
          t, prof_total, alto_total,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-LAT-IZQ",
            'pieza_nombre' => 'Lateral Izquierdo', 'material' => material,
            'largo_bruto_mm' => alto_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => alto_num - 2.0, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 1.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        crear_panel(
          grupo_modulo, 'Lateral Derecho Aéreo',
          ancho_total - t, 0.mm, 0.mm,
          t, prof_total, alto_total,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-LAT-DER",
            'pieza_nombre' => 'Lateral Derecho', 'material' => material,
            'largo_bruto_mm' => alto_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => alto_num - 2.0, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 1.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        crear_panel(
          grupo_modulo, 'Piso Aéreo',
          t, 0.mm, 0.mm,
          ancho_int, prof_total, t,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PISO",
            'pieza_nombre' => 'Piso', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        crear_panel(
          grupo_modulo, 'Techo Aéreo',
          t, 0.mm, alto_total - t,
          ancho_int, prof_total, t,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-TECHO",
            'pieza_nombre' => 'Techo', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        # Amarre de colgado superior para anclaje a pared
        crear_panel(
          grupo_modulo, 'Amarre Colgado Pared',
          t, prof_total - t - 18.mm, alto_total - 100.mm - t,
          ancho_int, t, 100.mm,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-COLGADOR",
            'pieza_nombre' => 'Refuerzo Colgado a Muro', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => 100.0, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => 100.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ninguna'
          }
        )

        agregar_fondo_enranurado(grupo_modulo, modulo_id, t, prof_total, alto_total, ancho_int_num, alto_num, t_num, 8.0, 18.0)

        { 'ok' => true, 'modulo_id' => modulo_id, 'mensaje' => "Módulo aéreo con refuerzo de colgado creado exitosamente." }
      end

      # ========================================================================
      # 6. LIBRERO REFORZADO CON ZÓCALO Y REPISAS EQUIDISTANTES
      # ========================================================================
      def construir_librero_estandar(model, params)
        alto_total  = params['alto'].to_f.mm
        ancho_total = params['ancho'].to_f.mm
        prof_total  = params['profundidad'].to_f.mm
        t_num       = (params['espesor'] && params['espesor'].to_f > 0) ? params['espesor'].to_f : 18.0
        t           = t_num.mm
        material    = params['material'] || 'Melamina Blanca 18mm'
        nombre_mod  = params['nombre'] || 'Librero con Zócalo'
        modulo_id   = params['modulo_id'] || "LIB-#{Time.now.to_i % 10000}"

        alto_num  = params['alto'].to_f
        ancho_num = params['ancho'].to_f
        prof_num  = params['profundidad'].to_f

        grupo_modulo = inicializar_grupo(model, params, nombre_mod, modulo_id, 'librero')

        # Zócalo estructural de 70mm para evitar que los libros inferiores toquen el piso
        alto_zocalo_mm = (params['alto_zocalo'] || 70.0).to_f
        alto_zocalo    = alto_zocalo_mm.mm
        ancho_int_num  = ancho_num - (2 * t_num)
        ancho_int      = ancho_total - (2 * t)

        # Laterales
        crear_panel(
          grupo_modulo, 'Lateral Izquierdo',
          0.mm, 0.mm, 0.mm,
          t, prof_total, alto_total,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-LAT-IZQ",
            'pieza_nombre' => 'Lateral Izquierdo', 'material' => material,
            'largo_bruto_mm' => alto_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => alto_num - 2.0, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 1.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        crear_panel(
          grupo_modulo, 'Lateral Derecho',
          ancho_total - t, 0.mm, 0.mm,
          t, prof_total, alto_total,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-LAT-DER",
            'pieza_nombre' => 'Lateral Derecho', 'material' => material,
            'largo_bruto_mm' => alto_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => alto_num - 2.0, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 2.0, 'canto_L2' => 0.0, 'canto_A1' => 1.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        # Zócalo Frontal
        if alto_zocalo_mm > 0
          crear_panel(
            grupo_modulo, 'Zócalo Frontal',
            t, 20.mm, 0.mm,
            ancho_int, t, alto_zocalo,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-ZOC-FRO",
              'pieza_nombre' => 'Zócalo Frontal', 'material' => material,
              'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => alto_zocalo_mm, 'espesor_mm' => t_num,
              'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => alto_zocalo_mm - 0.45,
              'cantidad' => 1, 'veta' => 'longitudinal',
              'canto_L1' => 0.45, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
              'ranura' => 'Ninguna'
            }
          )
        end

        # Piso elevado
        crear_panel(
          grupo_modulo, 'Piso',
          t, 0.mm, alto_zocalo,
          ancho_int, prof_total, t,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PISO",
            'pieza_nombre' => 'Piso', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        # Techo
        crear_panel(
          grupo_modulo, 'Techo',
          t, 0.mm, alto_total - t,
          ancho_int, prof_total, t,
          {
            'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-TECHO",
            'pieza_nombre' => 'Techo', 'material' => material,
            'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
            'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => prof_num - 1.0,
            'cantidad' => 1, 'veta' => 'longitudinal',
            'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
            'ranura' => 'Ranura 4x8mm a 18mm'
          }
        )

        # Repisas intermedias
        cant_repisas = (params['cantidad_repisas'] || 3).to_i
        if cant_repisas > 0
          paso_z = (alto_total - alto_zocalo - (2 * t)) / (cant_repisas + 1)
          cant_repisas.times do |idx|
            z_repisa = alto_zocalo + t + (paso_z * (idx + 1)) - (t / 2.0)
            crear_panel(
              grupo_modulo, "Repisa #{idx + 1}",
              t, 10.mm, z_repisa,
              ancho_int, prof_total - 10.mm, t,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-REP-#{idx + 1}",
                'pieza_nombre' => "Repisa #{idx + 1}", 'material' => material,
                'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num - 10.0, 'espesor_mm' => t_num,
                'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => prof_num - 11.0,
                'cantidad' => 1, 'veta' => 'longitudinal',
                'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                'ranura' => 'Ninguna'
              }
            )
          end
        end

        agregar_fondo_enranurado(grupo_modulo, modulo_id, t, prof_total, alto_total - alto_zocalo, ancho_int_num, alto_num - alto_zocalo_mm, t_num, 8.0, 18.0, alto_zocalo)

        { 'ok' => true, 'modulo_id' => modulo_id, 'mensaje' => "Librero reforzado con zócalo y repisas creado exitosamente." }
      end

      private

      # ========================================================================
      # Método: inicializar_grupo
      # Descripción: Crea o vacía el grupo del módulo y guarda los metadatos raíz.
      # ========================================================================
      def inicializar_grupo(model, params, nombre_mod, modulo_id, tipo_mod)
        entities = model.active_entities
        grupo = params['target_group'] || entities.add_group
        grupo.entities.clear! if params['target_group']
        grupo.name = "#{nombre_mod} [#{modulo_id}]"

        dict_mod = grupo.attribute_dictionary('DespieceMelaModulo', true)
        dict_mod['modulo_id']   = modulo_id
        dict_mod['nombre']      = nombre_mod
        dict_mod['tipo']        = tipo_mod
        dict_mod['alto_mm']     = params['alto'].to_f
        dict_mod['ancho_mm']    = params['ancho'].to_f
        dict_mod['prof_mm']     = params['profundidad'].to_f
        esp_val = (params['espesor'] && params['espesor'].to_f > 0) ? params['espesor'].to_f : 18.0
        dict_mod['espesor_mm']  = esp_val
        dict_mod['material']    = params['material'] || 'Pelikano Blanco Nieve 18mm'
        dict_mod['params_json'] = JSON.generate(params)

        # Seleccionar automáticamente el módulo en SketchUp y registrarlo como activo
        model.selection.clear
        model.selection.add(grupo)
        @ultimo_modulo_activo = grupo

        grupo
      end

      # ========================================================================
      # Método: agregar_fondo_enranurado
      # Descripción: Crea el fondo MDF 3mm ajustado a la ranura con holgura térmica.
      # ========================================================================
      def agregar_fondo_enranurado(parent, mod_id, t, prof_total, alto_util, ancho_int_num, alto_util_num, t_num, prof_ran_num, dist_ran_num, z_base = 0.mm)
        fondo_ancho_num = ancho_int_num + (2 * prof_ran_num) - 2.0
        fondo_alto_num  = alto_util_num + (2 * prof_ran_num) - 2.0
        t_fondo = 3.0.mm

        pos_y = prof_total - dist_ran_num.mm - t_fondo
        pos_x = t - prof_ran_num.mm + 1.mm
        pos_z = z_base + t - prof_ran_num.mm + 1.mm

        crear_panel(
          parent, 'Fondo MDF 3mm',
          pos_x, pos_y, pos_z,
          fondo_ancho_num.mm, t_fondo, fondo_alto_num.mm,
          {
            'modulo_id' => mod_id, 'pieza_id' => "#{mod_id}-FONDO",
            'pieza_nombre' => 'Fondo MDF 3mm', 'material' => 'MDF Fondo Blanco 3mm',
            'largo_bruto_mm' => fondo_alto_num, 'ancho_bruto_mm' => fondo_ancho_num,
            'espesor_mm' => 3.0, 'largo_neto_mm' => fondo_alto_num,
            'ancho_neto_mm' => fondo_ancho_num, 'cantidad' => 1,
            'veta' => 'libre', 'canto_L1' => 0.0, 'canto_L2' => 0.0,
            'canto_A1' => 0.0, 'canto_A2' => 0.0, 'ranura' => 'Ninguna'
          }
        )
      end

      # ========================================================================
      # Método: crear_tubo_perchero
      # Descripción: Genera un tubo perchero ovalado 3D realista con soportes.
      # ========================================================================
      def crear_tubo_perchero(parent, x, y, z, largo)
        grupo_tubo = parent.entities.add_group
        grupo_tubo.name = "Tubo Perchero Ovalado Metal"

        # Barra cilíndrica horizontal
        radio = 12.0.mm
        circle = grupo_tubo.entities.add_circle(Geom::Point3d.new(x, y, z), Geom::Vector3d.new(1, 0, 0), radio, 16)
        face = grupo_tubo.entities.add_face(circle)
        face.reverse! if face.normal.x < 0
        face.pushpull(largo.abs)

        # Aplicar material cromado
        mat = parent.model.materials['Metal Cromado'] || parent.model.materials.add('Metal Cromado')
        mat.color = Sketchup::Color.new(180, 190, 200)
        grupo_tubo.material = mat
      end

      # ========================================================================
      # Método: crear_panel
      # Descripción: Genera un prisma 3D extruido limpio, con orientación correcta
      #              de caras y atributos milimétricos en el AttributeDictionary.
      #              Garantiza que la extrusión siempre sea positiva hacia arriba (+Z)
      #              para que ningún elemento quede bajo el nivel del piso (Z < 0).
      # ========================================================================
      def crear_panel(parent_group, nombre, x, y, z, dx, dy, dz, attrs)
        panel_group = parent_group.entities.add_group
        panel_group.name = nombre

        pts = [
          Geom::Point3d.new(x, y, z),
          Geom::Point3d.new(x + dx, y, z),
          Geom::Point3d.new(x + dx, y + dy, z),
          Geom::Point3d.new(x, y + dy, z)
        ]

        cara = panel_group.entities.add_face(pts)
        
        # En SketchUp, las caras horizontales creadas sobre Z=0 se orientan automáticamente
        # hacia abajo (0, 0, -1). Si se ejecuta pushpull(dz) directamente, la pieza
        # se extruye hacia el eje Z negativo (debajo del piso / bajo la línea roja).
        # Invertimos la normal si apunta hacia abajo para garantizar que se proyecte en +Z:
        cara.reverse! if cara.normal.z < 0
        cara.pushpull(dz.abs)

        # Asignar color y textura fotorrealista de SketchUp (Pelikano, Vesto o Universal)
        mat_nombre = attrs['material'] || 'Pelikano Blanco Nieve 18mm'
        su_mat = MaterialManager.obtener_o_crear_material_su(parent_group.model, mat_nombre)
        panel_group.material = su_mat if su_mat

        dict = panel_group.attribute_dictionary('DespieceMela', true)
        attrs.each { |k, v| dict[k.to_s] = v.to_s }

        panel_group
      end
    end
  end
end
