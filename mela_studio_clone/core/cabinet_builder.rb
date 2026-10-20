# ==============================================================================
# Archivo: mela_studio_clone/core/cabinet_builder.rb
# Descripción: Motor geométrico 3D y matemático milimétrico.
#              Genera la volumetría de los módulos aplicando reglas estructurales
#              de carpintería (laterales pasantes, pisos, techos, amarres y fondos).
# ==============================================================================

require 'sketchup.rb'

module MelaStudioClone
  class CabinetBuilder
    class << self
      # ========================================================================
      # Método: build
      # Descripción: Crea un nuevo módulo paramétrico dentro del modelo activo de SketchUp.
      # Parámetros:
      #   - params (Hash): Diccionario con dimensiones en milímetros y opciones:
      #       'nombre', 'tipo', 'alto', 'ancho', 'profundidad', 'espesor',
      #       'tiene_fondo', 'distancia_ranura', 'prof_ranura',
      #       'tiene_repisa', 'cantidad_repisas', 'altura_repisa',
      #       'material', 'tipo_canto'
      # Retorno:
      #   - Hash con estado de la operación ('ok' => true, 'modulo_id', 'conteo_piezas')
      # ========================================================================
      def build(params)
        model = Sketchup.active_model
        model.start_operation('MelaStudio: Crear Módulo', true)

        begin
          # 1. Extracción y conversión estricta a milímetros con .mm de SketchUp
          alto_total   = params['alto'].to_f.mm
          ancho_total  = params['ancho'].to_f.mm
          prof_total   = params['profundidad'].to_f.mm
          t            = params['espesor'].to_f.mm # 15.mm o 18.mm

          nombre_mod   = params['nombre'] || 'Módulo Melamina'
          tipo_mod     = params['tipo'] || 'librero' # 'librero', 'bajo', 'aereo', 'columna'
          modulo_id    = params['modulo_id'] || "MOD-#{Time.now.to_i % 10000}"

          # Opciones de fondo y ranurado
          tiene_fondo      = params['fondo'] != false && params['tiene_fondo'] != false
          prof_ranura      = (params['prof_ranura'] || 8.0).to_f.mm
          dist_ranura      = (params['dist_ranura'] || 18.0).to_f.mm
          espesor_fondo_mm = 3.0
          t_fondo          = espesor_fondo_mm.mm

          # 2. Creación o reutilización del grupo contenedor principal del módulo
          entities = model.active_entities
          grupo_modulo = params['target_group'] || entities.add_group
          grupo_modulo.name = "#{nombre_mod} [#{modulo_id}]"

          # Metadatos del módulo completo en el diccionario raíz
          dict_mod = grupo_modulo.attribute_dictionary('DespieceMelaModulo', true)
          dict_mod['modulo_id']   = modulo_id
          dict_mod['nombre']      = nombre_mod
          dict_mod['tipo']        = tipo_mod
          dict_mod['alto_mm']     = params['alto'].to_f
          dict_mod['ancho_mm']    = params['ancho'].to_f
          dict_mod['prof_mm']     = params['profundidad'].to_f
          dict_mod['espesor_mm']  = params['espesor'].to_f
          dict_mod['material']    = material

          # 3. Cálculo de cotas internas de carpintería
          ancho_int      = ancho_total - (2 * t)
          ancho_int_num  = params['ancho'].to_f - (2 * params['espesor'].to_f)
          alto_int_num   = params['alto'].to_f - (2 * params['espesor'].to_f)
          prof_num       = params['profundidad'].to_f
          alto_num       = params['alto'].to_f
          t_num          = params['espesor'].to_f

          # Configuración inicial de cantos por defecto (ej. frontal con canto 1mm, resto sin canto)
          canto_defecto = { 'canto_L1' => 1.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0 }

          # 4. Construcción de Laterales (Izquierdo y Derecho)
          # Los laterales van de piso a techo y de frente a fondo
          crear_panel(
            grupo_modulo, 'Lateral Izquierdo',
            0.mm, 0.mm, 0.mm,
            t, prof_total, alto_total,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-LAT-IZQ",
              'pieza_nombre' => 'Lateral Izquierdo', 'material' => material,
              'largo_bruto_mm' => alto_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
              'largo_neto_mm' => alto_num - (canto_defecto['canto_L1'] + canto_defecto['canto_L2']),
              'ancho_neto_mm' => prof_num - (canto_defecto['canto_A1'] + canto_defecto['canto_A2']),
              'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => tiene_fondo ? 'Ranura 4x8mm a 18mm' : 'Ninguna'
            }.merge(canto_defecto)
          )

          crear_panel(
            grupo_modulo, 'Lateral Derecho',
            ancho_total - t, 0.mm, 0.mm,
            t, prof_total, alto_total,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-LAT-DER",
              'pieza_nombre' => 'Lateral Derecho', 'material' => material,
              'largo_bruto_mm' => alto_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
              'largo_neto_mm' => alto_num - (canto_defecto['canto_L1'] + canto_defecto['canto_L2']),
              'ancho_neto_mm' => prof_num - (canto_defecto['canto_A1'] + canto_defecto['canto_A2']),
              'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => tiene_fondo ? 'Ranura 4x8mm a 18mm' : 'Ninguna'
            }.merge(canto_defecto)
          )

          # 5. Construcción de Piso (Base interior)
          crear_panel(
            grupo_modulo, 'Piso',
            t, 0.mm, 0.mm,
            ancho_int, prof_total, t,
            {
              'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-PISO",
              'pieza_nombre' => 'Piso', 'material' => material,
              'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
              'largo_neto_mm' => ancho_int_num - (canto_defecto['canto_L1'] + canto_defecto['canto_L2']),
              'ancho_neto_mm' => prof_num - (canto_defecto['canto_A1'] + canto_defecto['canto_A2']),
              'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => tiene_fondo ? 'Ranura 4x8mm a 18mm' : 'Ninguna'
            }.merge(canto_defecto)
          )

          # 6. Construcción de Techo o Amarres Superiores
          if tipo_mod == 'bajo' && params['usar_amarres'] == true
            # Gabinete de cocina bajo: Amarre frontal y trasero de 100mm en lugar de techo completo
            ancho_amarre = 100.0.mm
            ancho_amarre_num = 100.0

            crear_panel(
              grupo_modulo, 'Amarre Superior Frontal',
              t, 0.mm, alto_total - t,
              ancho_int, ancho_amarre, t,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-AMARRE-FRO",
                'pieza_nombre' => 'Amarre Frontal', 'material' => material,
                'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => ancho_amarre_num, 'espesor_mm' => t_num,
                'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => ancho_amarre_num,
                'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => 'Ninguna'
              }.merge(canto_defecto)
            )

            crear_panel(
              grupo_modulo, 'Amarre Superior Trasero',
              t, prof_total - ancho_amarre, alto_total - t,
              ancho_int, ancho_amarre, t,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-AMARRE-TRA",
                'pieza_nombre' => 'Amarre Trasero', 'material' => material,
                'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => ancho_amarre_num, 'espesor_mm' => t_num,
                'largo_neto_mm' => ancho_int_num, 'ancho_neto_mm' => ancho_amarre_num,
                'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => 'Ninguna'
              }.merge(canto_defecto)
            )
          else
            # Techo completo estándar
            crear_panel(
              grupo_modulo, 'Techo',
              t, 0.mm, alto_total - t,
              ancho_int, prof_total, t,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-TECHO",
                'pieza_nombre' => 'Techo', 'material' => material,
                'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num, 'espesor_mm' => t_num,
                'largo_neto_mm' => ancho_int_num - (canto_defecto['canto_L1'] + canto_defecto['canto_L2']),
                'ancho_neto_mm' => prof_num - (canto_defecto['canto_A1'] + canto_defecto['canto_A2']),
                'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => tiene_fondo ? 'Ranura 4x8mm a 18mm' : 'Ninguna'
              }.merge(canto_defecto)
            )
          end

          # 7. Repisas Intermedias (si se solicitan)
          cant_repisas = params['cantidad_repisas'].to_i
          cant_repisas = 1 if params['tiene_repisa'] == true && cant_repisas <= 0

          if cant_repisas > 0
            # Si se especificó una altura fija para la primera repisa
            if params['altura_repisa'] && params['altura_repisa'].to_f > 0
              z_repisa = params['altura_repisa'].to_f.mm
              crear_panel(
                grupo_modulo, "Repisa 1",
                t, 0.mm, z_repisa,
                ancho_int, prof_total - (tiene_fondo ? 10.mm : 0.mm), t,
                {
                  'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-REP-1",
                  'pieza_nombre' => "Repisa 1", 'material' => material,
                  'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num - (tiene_fondo ? 10.0 : 0.0),
                  'espesor_mm' => t_num, 'largo_neto_mm' => ancho_int_num,
                  'ancho_neto_mm' => prof_num - (tiene_fondo ? 10.0 : 0.0),
                  'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => 'Ninguna'
                }.merge(canto_defecto)
              )
            else
              # Repisas distribuidas de manera equidistante en el vano
              paso_z = (alto_total - (2 * t)) / (cant_repisas + 1)
              cant_repisas.times do |idx|
                z_repisa = t + (paso_z * (idx + 1)) - (t / 2.0)
                crear_panel(
                  grupo_modulo, "Repisa #{idx + 1}",
                  t, 0.mm, z_repisa,
                  ancho_int, prof_total - (tiene_fondo ? 10.mm : 0.mm), t,
                  {
                    'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-REP-#{idx + 1}",
                    'pieza_nombre' => "Repisa #{idx + 1}", 'material' => material,
                    'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => prof_num - (tiene_fondo ? 10.0 : 0.0),
                    'espesor_mm' => t_num, 'largo_neto_mm' => ancho_int_num,
                    'ancho_neto_mm' => prof_num - (tiene_fondo ? 10.0 : 0.0),
                    'cantidad' => 1, 'veta' => 'longitudinal', 'ranura' => 'Ninguna'
                  }.merge(canto_defecto)
                )
              end
            end
          end

          # 8. Fondo de MDF 3mm (si tiene ranura activada)
          if tiene_fondo
            # Regla de taller: Fondo = espacio interior + (2 * profundidad ranura) - 2mm de holgura
            fondo_ancho_num = ancho_int_num + (2 * (params['prof_ranura'] || 8.0).to_f) - 2.0
            fondo_alto_num  = alto_int_num + (2 * (params['prof_ranura'] || 8.0).to_f) - 2.0

            fondo_ancho = fondo_ancho_num.mm
            fondo_alto  = fondo_alto_num.mm

            # Posición en el eje Y: retrasado respecto al frente para coincidir con la ranura
            pos_y = prof_total - dist_ranura - t_fondo
            pos_x = t - prof_ranura + 1.mm # 1mm de compensación por holgura
            pos_z = t - prof_ranura + 1.mm

            crear_panel(
              grupo_modulo, 'Fondo MDF 3mm',
              pos_x, pos_y, pos_z,
              fondo_ancho, t_fondo, fondo_alto,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-FONDO",
                'pieza_nombre' => 'Fondo MDF 3mm', 'material' => 'MDF 3mm Blanco',
                'largo_bruto_mm' => fondo_alto_num, 'ancho_bruto_mm' => fondo_ancho_num,
                'espesor_mm' => espesor_fondo_mm, 'largo_neto_mm' => fondo_alto_num,
                'ancho_neto_mm' => fondo_ancho_num, 'cantidad' => 1,
                'veta' => 'libre', 'canto_L1' => 0.0, 'canto_L2' => 0.0,
                'canto_A1' => 0.0, 'canto_A2' => 0.0, 'ranura' => 'Ninguna'
              }
            )
          end

          model.commit_operation
          { 'ok' => true, 'modulo_id' => modulo_id, 'mensaje' => "Módulo #{nombre_mod} generado con éxito." }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => e.message, 'backtrace' => e.backtrace.first }
        end
      end

      # ========================================================================
      # Método: crear_panel
      # Descripción: Genera un prisma 3D extruido limpio, con orientación correcta
      #              de caras y atributos milimétricos en el AttributeDictionary.
      # Parámetros:
      #   - parent_group (Sketchup::Group): Grupo contenedor padre.
      #   - nombre (String): Nombre descriptivo de la pieza.
      #   - x, y, z (Length): Coordenadas de origen en unidades nativas (.mm).
      #   - dx, dy, dz (Length): Dimensiones vectoriales de ancho, fondo y alto.
      #   - attrs (Hash): Diccionario de atributos de despiece.
      # ========================================================================
      def crear_panel(parent_group, nombre, x, y, z, dx, dy, dz, attrs)
        panel_group = parent_group.entities.add_group
        panel_group.name = nombre

        # Definición de vértices en el plano XY base
        pts = [
          Geom::Point3d.new(x, y, z),
          Geom::Point3d.new(x + dx, y, z),
          Geom::Point3d.new(x + dx, y + dy, z),
          Geom::Point3d.new(x, y + dy, z)
        ]

        cara = panel_group.entities.add_face(pts)
        cara.pushpull(dz)

        # Inserción de metadatos en el AttributeDictionary para extracción posterior
        dict = panel_group.attribute_dictionary('DespieceMela', true)
        attrs.each do |k, v|
          dict[k.to_s] = v.to_s
        end

        panel_group
      end
    end
  end
end
