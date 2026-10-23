# ==============================================================================
# Archivo: jpq_melamina_pro/core/groove_manager.rb
# Descripción: Gestor de ranuras de carpintería, fondos de MDF (3/4mm)
#              y amarres estructurales traseros ocultos a 18mm.
#              Permite cambiar entre fondo enranurado (a 18mm del borde) o clavado,
#              e inyecta dinámicamente de 1 a 4 amarres estructurales traseros
#              de melamina para anclaje a muro y refuerzo de escuadra.
# ==============================================================================

require 'sketchup.rb'
require 'json'
require_relative 'cabinet_builder'

module JPQMelaminaPro
  class GrooveManager
    class << self
      # ========================================================================
      # Método: apply
      # Descripción: Aplica o actualiza la configuración del fondo y los amarres
      #              traseros en el módulo seleccionado.
      # Parámetros:
      #   - params (Hash):
      #       'tipo' ('ranura' | 'clavado'),
      #       'prof_ranura' (Float, estándar 8.0 mm),
      #       'dist_ranura' (Float, estándar 18.0 mm para albergar amarres),
      #       'espesor_fondo' (Float, estándar 3.0 mm),
      #       'cantidad_amarres' (Integer, de 1 a 4 amarres traseros de melamina)
      # ========================================================================
      def apply(params)
        model = Sketchup.active_model
        sel = model.selection

        modulo = sel.find { |e| e.attribute_dictionary('DespieceMelaModulo') }
        modulo ||= CabinetBuilder.ultimo_modulo_activo if defined?(CabinetBuilder) && CabinetBuilder.ultimo_modulo_activo && CabinetBuilder.ultimo_modulo_activo.valid?
        return { 'ok' => false, 'error' => 'Por favor, crea o selecciona un módulo primero.' } unless modulo

        dict_mod = modulo.attribute_dictionary('DespieceMelaModulo')
        alto_mod   = dict_mod['alto_mm'].to_f.mm
        ancho_mod  = dict_mod['ancho_mm'].to_f.mm
        prof_mod   = dict_mod['prof_mm'].to_f.mm
        t_val      = (dict_mod['espesor_mm'] && dict_mod['espesor_mm'].to_f > 0) ? dict_mod['espesor_mm'].to_f : 18.0
        t          = t_val.mm
        modulo_id  = dict_mod['modulo_id']
        material   = dict_mod['material'] || 'Pelikano Blanco Nieve 18mm'

        tipo         = params['tipo'] || 'ranura'
        prof_ranura  = (params['prof_ranura'] || 8.0).to_f.mm
        dist_ranura  = (params['dist_ranura'] || 18.0).to_f.mm # 18mm fijos para amarres traseros
        t_fondo_num  = (params['espesor_fondo'] || 3.0).to_f
        t_fondo      = t_fondo_num.mm
        cant_amarres = (params['cantidad_amarres'] || 2).to_i

        model.start_operation('JPQMelaminaPro: Configurar Fondo y Amarres Traseros', true)

        begin
          # 1. Eliminar fondo y amarres previos si existen
          modulo.entities.grep(Sketchup::Group).each do |g|
            modulo.entities.erase_entities(g) if g.name =~ /Fondo|Amarre Trasero/i
          end

          ancho_int_num = dict_mod['ancho_mm'].to_f - (2 * t_val)
          alto_int_num  = dict_mod['alto_mm'].to_f - (2 * t_val)

          if tipo == 'ranura'
            # FÓRMULA ESTÁNDAR: Ancho Interno + (2 * Profundidad Ranura) - 2mm de holgura
            fondo_ancho_num = ancho_int_num + (2 * prof_ranura.to_mm) - 2.0
            fondo_alto_num  = alto_int_num + (2 * prof_ranura.to_mm) - 2.0

            pos_x = t - prof_ranura + 1.mm
            pos_y = prof_mod - dist_ranura - t_fondo
            pos_z = t - prof_ranura + 1.mm

            crear_fondo_panel(
              modulo, "Fondo MDF #{t_fondo_num.to_i}mm (Con Ranura)",
              pos_x, pos_y, pos_z,
              fondo_ancho_num.mm, t_fondo, fondo_alto_num.mm,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-FONDO",
                'pieza_nombre' => "Fondo MDF #{t_fondo_num.to_i}mm", 'material' => "MDF #{t_fondo_num.to_i}mm Blanco",
                'largo_bruto_mm' => fondo_alto_num, 'ancho_bruto_mm' => fondo_ancho_num,
                'espesor_mm' => t_fondo_num, 'largo_neto_mm' => fondo_alto_num,
                'ancho_neto_mm' => fondo_ancho_num, 'cantidad' => 1,
                'veta' => 'libre', 'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                'ranura' => "R (Ranura 4x#{prof_ranura.to_mm.to_i}mm a 18mm)"
              }
            )

            # 2. INYECTAR AMARRES ESTRUCTURALES TRASEROS (Melamina 18mm x 100mm alto)
            # Situados detrás del MDF (entre pos_y + t_fondo y prof_mod)
            y_amarre = prof_mod - dist_ranura
            alto_liston_num = 100.0
            alto_liston = alto_liston_num.mm

            posiciones_z = []
            if cant_amarres == 1
              posiciones_z << (alto_mod - t - alto_liston) # Solo superior
            elsif cant_amarres >= 2
              posiciones_z << (t) # Inferior (sobre el piso)
              posiciones_z << (alto_mod - t - alto_liston) # Superior

              if cant_amarres > 2
                amarres_intermedios = cant_amarres - 2
                espacio_libre = (alto_mod - (2 * t) - (2 * alto_liston))
                intervalo = espacio_libre / (amarres_intermedios + 1)
                (1..amarres_intermedios).each do |k|
                  posiciones_z << (t + alto_liston + (intervalo * k) - (alto_liston / 2.0))
                end
              end
            end

            posiciones_z.each_with_index do |z_am, idx|
              CabinetBuilder.crear_panel(
                modulo, "Amarre Trasero #{idx + 1}",
                t, y_amarre, z_am,
                ancho_int_num.mm, t, alto_liston,
                {
                  'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-AMARRE-TRAS-#{idx + 1}",
                  'pieza_nombre' => "Amarre Trasero #{idx + 1}", 'material' => material,
                  'largo_bruto_mm' => ancho_int_num, 'ancho_bruto_mm' => alto_liston_num,
                  'espesor_mm' => t_val, 'largo_neto_mm' => ancho_int_num - 1.0,
                  'ancho_neto_mm' => alto_liston_num - 1.0, 'cantidad' => 1,
                  'veta' => 'longitudinal',
                  'canto_L1' => 0.5, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                  'ranura' => 'Ninguna'
                }
              )
            end

          else # Clavado / Sobrepuesto
            fondo_ancho_num = dict_mod['ancho_mm'].to_f - 4.0 # Luz de seguridad de 4mm
            fondo_alto_num  = dict_mod['alto_mm'].to_f - 4.0

            crear_fondo_panel(
              modulo, "Fondo MDF #{t_fondo_num.to_i}mm (Sobrepuesto Clavado)",
              2.mm, prof_mod, 2.mm,
              fondo_ancho_num.mm, t_fondo, fondo_alto_num.mm,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-FONDO",
                'pieza_nombre' => "Fondo MDF #{t_fondo_num.to_i}mm", 'material' => "MDF #{t_fondo_num.to_i}mm Blanco",
                'largo_bruto_mm' => fondo_alto_num, 'ancho_bruto_mm' => fondo_ancho_num,
                'espesor_mm' => t_fondo_num, 'largo_neto_mm' => fondo_alto_num,
                'ancho_neto_mm' => fondo_ancho_num, 'cantidad' => 1,
                'veta' => 'libre', 'canto_L1' => 0.0, 'canto_L2' => 0.0, 'canto_A1' => 0.0, 'canto_A2' => 0.0,
                'ranura' => 'Sobrepuesto Clavado'
              }
            )
          end

          model.commit_operation
          mensaje_retorno = if tipo == 'ranura'
                              "Fondo MDF con ranura a 18mm y #{cant_amarres} amarre(s) estructural(es) traseros aplicados."
                            else
                              "Fondo MDF sobrepuesto clavado aplicado."
                            end
          { 'ok' => true, 'mensaje' => mensaje_retorno }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => "Error al configurar fondo: #{e.message}" }
        end
      end

      private

      # ========================================================================
      # Sub-método: crear_fondo_panel
      # Descripción: Genera la geometría 3D y asigna material para la placa de fondo.
      # ========================================================================
      def crear_fondo_panel(parent, nombre, x, y, z, dx, dy, dz, attrs)
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

        su_mat = MaterialManager.obtener_o_crear_material_su(parent.model, attrs['material'])
        sub.material = su_mat if su_mat

        dict = sub.attribute_dictionary('DespieceMela', true)
        attrs.each { |k, v| dict[k.to_s] = v.to_s }
      end
    end
  end
end
