# ==============================================================================
# Archivo: mela_studio_clone/core/interior_divider.rb
# Descripción: Módulo para generar repisas y divisiones interiores equidistantes
#              o a cotas específicas dentro de un vano de mueble.
# ==============================================================================

require 'sketchup.rb'

module JPQMelaminaPro
  class InteriorDivider
    class << self
      # ========================================================================
      # Método: apply
      # Descripción: Inserta repisas o montantes verticales dentro del módulo
      #              seleccionado o según los parámetros recibidos.
      # Parámetros:
      #   - params (Hash):
      #       'tipo' ('horizontal' | 'vertical'),
      #       'cantidad' (Integer),
      #       'altura_fija' (Float opcional),
      #       'espesor' (Float),
      #       'retroceso_frente' (Float, ej. 10mm para no chocar con puertas)
      # ========================================================================
      def apply(params)
        model = Sketchup.active_model
        sel = model.selection

        # Buscar grupo del módulo
        modulo = sel.find { |e| e.attribute_dictionary('DespieceMelaModulo') }
        return { 'ok' => false, 'error' => 'Por favor, selecciona un módulo primero.' } unless modulo

        dict_mod = modulo.attribute_dictionary('DespieceMelaModulo')
        alto_mod   = dict_mod['alto_mm'].to_f.mm
        ancho_mod  = dict_mod['ancho_mm'].to_f.mm
        prof_mod   = dict_mod['prof_mm'].to_f.mm
        t          = dict_mod['espesor_mm'].to_f.mm
        modulo_id  = dict_mod['modulo_id']
        material   = dict_mod['material'] || 'Melamina 18mm'

        tipo_division = params['tipo'] || 'horizontal' # 'horizontal' (repisas) o 'vertical' (parante)
        cantidad      = (params['cantidad'] || 1).to_i
        retroceso     = (params['retroceso_frente'] || 10.0).to_f.mm
        prof_efectiva = prof_mod - retroceso

        model.start_operation('JPQMelaminaPro: Insertar Repisas/Divisiones', true)

        begin
          if tipo_division == 'horizontal'
            ancho_int = ancho_mod - (2 * t)
            ancho_int_num = dict_mod['ancho_mm'].to_f - (2 * dict_mod['espesor_mm'].to_f)
            prof_efectiva_num = dict_mod['prof_mm'].to_f - (params['retroceso_frente'] || 10.0).to_f

            if params['altura_fija'] && params['altura_fija'].to_f > 0
              z_repisa = params['altura_fija'].to_f.mm
              crear_repisa(modulo, modulo_id, 1, t, retroceso, z_repisa, ancho_int, prof_efectiva, t, ancho_int_num, prof_efectiva_num, dict_mod['espesor_mm'].to_f, material)
            else
              paso_z = (alto_mod - (2 * t)) / (cantidad + 1)
              cantidad.times do |i|
                z_repisa = t + (paso_z * (i + 1)) - (t / 2.0)
                crear_repisa(modulo, modulo_id, i + 1, t, retroceso, z_repisa, ancho_int, prof_efectiva, t, ancho_int_num, prof_efectiva_num, dict_mod['espesor_mm'].to_f, material)
              end
            end
          else
            # División vertical (Montante / Parante)
            alto_int = alto_mod - (2 * t)
            alto_int_num = dict_mod['alto_mm'].to_f - (2 * dict_mod['espesor_mm'].to_f)
            prof_efectiva_num = dict_mod['prof_mm'].to_f - (params['retroceso_frente'] || 10.0).to_f

            paso_x = (ancho_mod - (2 * t)) / (cantidad + 1)
            cantidad.times do |i|
              x_parante = t + (paso_x * (i + 1)) - (t / 2.0)
              crear_parante(modulo, modulo_id, i + 1, x_parante, retroceso, t, t, prof_efectiva, alto_int, dict_mod['espesor_mm'].to_f, prof_efectiva_num, alto_int_num, material)
            end
          end

          model.commit_operation
          { 'ok' => true, 'mensaje' => "Se insertaron #{cantidad} #{tipo_division == 'horizontal' ? 'repisas' : 'parantes'} correctamente." }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => e.message }
        end
      end

      private

      # ========================================================================
      # Método: crear_repisa
      # Descripción: Crea la geometría 3D y los metadatos de una repisa horizontal.
      # ========================================================================
      def crear_repisa(parent, mod_id, index, x, y, z, dx, dy, dz, l_num, a_num, t_num, material)
        sub = parent.entities.add_group
        sub.name = "Repisa #{index}"
        pts = [
          Geom::Point3d.new(x, y, z),
          Geom::Point3d.new(x + dx, y, z),
          Geom::Point3d.new(x + dx, y + dy, z),
          Geom::Point3d.new(x, y + dy, z)
        ]
        face = sub.entities.add_face(pts)
        face.pushpull(dz)

        dict = sub.attribute_dictionary('DespieceMela', true)
        dict['modulo_id']      = mod_id
        dict['pieza_id']       = "#{mod_id}-REP-#{index}"
        dict['pieza_nombre']   = "Repisa #{index}"
        dict['material']       = material
        dict['largo_bruto_mm'] = l_num
        dict['ancho_bruto_mm'] = a_num
        dict['espesor_mm']     = t_num
        dict['largo_neto_mm']  = l_num
        dict['ancho_neto_mm']  = a_num - 1.0 # Descuento canto frontal de 1mm
        dict['cantidad']       = 1
        dict['veta']           = 'longitudinal'
        dict['canto_L1']       = 1.0 # Canto frontal
        dict['canto_L2']       = 0.0
        dict['canto_A1']       = 0.0
        dict['canto_A2']       = 0.0
        dict['ranura']         = 'Ninguna'
      end

      # ========================================================================
      # Método: crear_parante
      # Descripción: Crea la geometría 3D y los metadatos de un parante vertical.
      # ========================================================================
      def crear_parante(parent, mod_id, index, x, y, z, dx, dy, dz, t_num, a_num, l_num, material)
        sub = parent.entities.add_group
        sub.name = "Parante #{index}"
        pts = [
          Geom::Point3d.new(x, y, z),
          Geom::Point3d.new(x + dx, y, z),
          Geom::Point3d.new(x + dx, y + dy, z),
          Geom::Point3d.new(x, y + dy, z)
        ]
        face = sub.entities.add_face(pts)
        face.pushpull(dz)

        dict = sub.attribute_dictionary('DespieceMela', true)
        dict['modulo_id']      = mod_id
        dict['pieza_id']       = "#{mod_id}-PAR-#{index}"
        dict['pieza_nombre']   = "Parante #{index}"
        dict['material']       = material
        dict['largo_bruto_mm'] = l_num
        dict['ancho_bruto_mm'] = a_num
        dict['espesor_mm']     = t_num
        dict['largo_neto_mm']  = l_num - 1.0
        dict['ancho_neto_mm']  = a_num
        dict['cantidad']       = 1
        dict['veta']           = 'longitudinal'
        dict['canto_L1']       = 1.0
        dict['canto_L2']       = 0.0
        dict['canto_A1']       = 0.0
        dict['canto_A2']       = 0.0
        dict['ranura']         = 'Ninguna'
      end
    end
  end
end
