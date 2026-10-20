# ==============================================================================
# Archivo: mela_studio_clone/core/groove_manager.rb
# Descripción: Gestor de ranuras de carpintería y fondos de MDF (3 mm).
#              Permite cambiar entre fondo enranurado (con profundidad y desfase)
#              o fondo sobrepuesto clavado/atornillado.
# ==============================================================================

require 'sketchup.rb'

module JPQMelaminaPro
  class GrooveManager
    class << self
      # ========================================================================
      # Método: apply
      # Descripción: Aplica o actualiza la configuración del fondo en el módulo seleccionado.
      # Parámetros:
      #   - params (Hash):
      #       'tipo' ('ranurado' | 'clavado'),
      #       'prof_ranura' (Float, por defecto 8.0 mm),
      #       'dist_ranura' (Float, por defecto 18.0 mm),
      #       'espesor_fondo' (Float, por defecto 3.0 mm)
      # ========================================================================
      def apply(params)
        model = Sketchup.active_model
        sel = model.selection

        modulo = sel.find { |e| e.attribute_dictionary('DespieceMelaModulo') }
        return { 'ok' => false, 'error' => 'Selecciona un módulo primero.' } unless modulo

        dict_mod = modulo.attribute_dictionary('DespieceMelaModulo')
        alto_mod  = dict_mod['alto_mm'].to_f.mm
        ancho_mod = dict_mod['ancho_mm'].to_f.mm
        prof_mod  = dict_mod['prof_mm'].to_f.mm
        t         = dict_mod['espesor_mm'].to_f.mm
        modulo_id = dict_mod['modulo_id']

        tipo         = params['tipo'] || 'ranurado'
        prof_ranura  = (params['prof_ranura'] || 8.0).to_f.mm
        dist_ranura  = (params['dist_ranura'] || 18.0).to_f.mm
        t_fondo_num  = (params['espesor_fondo'] || 3.0).to_f
        t_fondo      = t_fondo_num.mm

        model.start_operation('JPQMelaminaPro: Configurar Fondo y Ranuras', true)

        begin
          # Eliminar fondo previo si existe
          fondo_previo = modulo.entities.find { |e| e.name =~ /Fondo/i }
          modulo.entities.erase_entities(fondo_previo) if fondo_previo

          ancho_int_num = dict_mod['ancho_mm'].to_f - (2 * dict_mod['espesor_mm'].to_f)
          alto_int_num  = dict_mod['alto_mm'].to_f - (2 * dict_mod['espesor_mm'].to_f)

          if tipo == 'ranurado'
            # Cálculo de cota neta de corte para fondo enranurado con 2mm de holgura
            fondo_ancho_num = ancho_int_num + (2 * (params['prof_ranura'] || 8.0).to_f) - 2.0
            fondo_alto_num  = alto_int_num + (2 * (params['prof_ranura'] || 8.0).to_f) - 2.0

            pos_x = t - prof_ranura + 1.mm
            pos_y = prof_mod - dist_ranura - t_fondo
            pos_z = t - prof_ranura + 1.mm

            crear_fondo(
              modulo, "Fondo MDF #{t_fondo_num}mm (Ranurado)",
              pos_x, pos_y, pos_z,
              fondo_ancho_num.mm, t_fondo, fondo_alto_num.mm,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-FONDO",
                'pieza_nombre' => "Fondo MDF #{t_fondo_num}mm", 'material' => "MDF #{t_fondo_num}mm Blanco",
                'largo_bruto_mm' => fondo_alto_num, 'ancho_bruto_mm' => fondo_ancho_num,
                'espesor_mm' => t_fondo_num, 'largo_neto_mm' => fondo_alto_num,
                'ancho_neto_mm' => fondo_ancho_num, 'cantidad' => 1,
                'veta' => 'libre', 'canto_L1' => 0.0, 'canto_L2' => 0.0,
                'canto_A1' => 0.0, 'canto_A2' => 0.0,
                'ranura' => "Ranura 4x#{params['prof_ranura'] || 8.0}mm a #{params['dist_ranura'] || 18.0}mm"
              }
            )
          else
            # Fondo sobrepuesto/clavado por detrás del módulo completo
            fondo_ancho_num = dict_mod['ancho_mm'].to_f
            fondo_alto_num  = dict_mod['alto_mm'].to_f

            pos_x = 0.mm
            pos_y = prof_mod
            pos_z = 0.mm

            crear_fondo(
              modulo, "Fondo MDF #{t_fondo_num}mm (Sobrepuesto)",
              pos_x, pos_y, pos_z,
              ancho_mod, t_fondo, alto_mod,
              {
                'modulo_id' => modulo_id, 'pieza_id' => "#{modulo_id}-FONDO",
                'pieza_nombre' => "Fondo MDF #{t_fondo_num}mm", 'material' => "MDF #{t_fondo_num}mm Blanco",
                'largo_bruto_mm' => fondo_alto_num, 'ancho_bruto_mm' => fondo_ancho_num,
                'espesor_mm' => t_fondo_num, 'largo_neto_mm' => fondo_alto_num,
                'ancho_neto_mm' => fondo_ancho_num, 'cantidad' => 1,
                'veta' => 'libre', 'canto_L1' => 0.0, 'canto_L2' => 0.0,
                'canto_A1' => 0.0, 'canto_A2' => 0.0,
                'ranura' => 'Sobrepuesto clavado'
              }
            )
          end

          model.commit_operation
          { 'ok' => true, 'mensaje' => "Fondo configurado como #{tipo} exitosamente." }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => e.message }
        end
      end

      private

      # ========================================================================
      # Método: crear_fondo
      # Descripción: Genera el prisma del fondo con sus respectivos metadatos.
      # ========================================================================
      def crear_fondo(parent, nombre, x, y, z, dx, dy, dz, attrs)
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
