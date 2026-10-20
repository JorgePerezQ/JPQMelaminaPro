# ==============================================================================
# Archivo: mela_studio_clone/core/material_manager.rb
# Descripción: Gestor integral de materiales, texturas y control de veta.
#              Administra el catálogo de melaminas, asigna colores/texturas
#              nativas a SketchUp y restringe la orientación de corte (longitudinal,
#              transversal o libre) para alimentar al motor de optimización 2D.
# ==============================================================================

require 'sketchup.rb'

module MelaStudioClone
  class MaterialManager
    class << self
      # Catálogo base predeterminado de materiales (100% ampliable por el usuario)
      CATALOGO_PREDETERMINADO = [
        { 'id' => 'mel_blanco_18', 'nombre' => 'Melamina Blanca 18mm', 'espesor' => 18.0, 'veta' => 'libre', 'color' => '#FFFFFF', 'precio_m2' => 22.5 },
        { 'id' => 'mel_blanco_15', 'nombre' => 'Melamina Blanca 15mm', 'espesor' => 15.0, 'veta' => 'libre', 'color' => '#F8F9FA', 'precio_m2' => 19.0 },
        { 'id' => 'mel_roble_18',  'nombre' => 'Melamina Roble Natural 18mm', 'espesor' => 18.0, 'veta' => 'longitudinal', 'color' => '#C49A6C', 'precio_m2' => 32.0 },
        { 'id' => 'mel_nogal_18',  'nombre' => 'Melamina Nogal Terracota 18mm', 'espesor' => 18.0, 'veta' => 'longitudinal', 'color' => '#6A4B35', 'precio_m2' => 34.0 },
        { 'id' => 'mel_antracita_18', 'nombre' => 'Melamina Gris Antracita 18mm', 'espesor' => 18.0, 'veta' => 'libre', 'color' => '#383E42', 'precio_m2' => 29.5 },
        { 'id' => 'mdf_blanco_3',  'nombre' => 'MDF Fondo Blanco 3mm', 'espesor' => 3.0, 'veta' => 'libre', 'color' => '#EAEAEA', 'precio_m2' => 8.5 }
      ].freeze

      # ========================================================================
      # Método: obtener_catalogo
      # Descripción: Retorna la lista de materiales disponibles almacenados en
      #              el modelo o el catálogo predeterminado si no hay configuración.
      # ========================================================================
      def obtener_catalogo
        model = Sketchup.active_model
        dict = model.attribute_dictionary('MelaStudioConfig')
        if dict && dict['catalogo_materiales']
          begin
            return JSON.parse(dict['catalogo_materiales'])
          rescue
            # Fallback en caso de error de parseo
          end
        end
        CATALOGO_PREDETERMINADO
      end

      # ========================================================================
      # Método: guardar_material
      # Descripción: Registra un nuevo material o actualiza uno existente en el modelo.
      # Parámetros:
      #   - material_data (Hash): Datos del material ('id', 'nombre', 'espesor', 'veta', 'color', 'precio_m2')
      # ========================================================================
      def guardar_material(material_data)
        catalogo = obtener_catalogo.dup
        idx = catalogo.find_index { |m| m['id'] == material_data['id'] }
        if idx
          catalogo[idx] = material_data
        else
          catalogo << material_data
        end

        model = Sketchup.active_model
        dict = model.attribute_dictionary('MelaStudioConfig', true)
        dict['catalogo_materiales'] = JSON.generate(catalogo)
        { 'ok' => true, 'mensaje' => "Material '#{material_data['nombre']}' guardado en catálogo." }
      end

      # ========================================================================
      # Método: apply
      # Descripción: Asigna el material y la restricción de veta a la selección activa
      #              o al módulo seleccionado, aplicando color nativo de SketchUp.
      # Parámetros:
      #   - params (Hash):
      #       'material_nombre' (String),
      #       'veta' ('longitudinal' | 'transversal' | 'libre'),
      #       'color_hex' (String, opcional ej. '#C49A6C')
      # ========================================================================
      def apply(params)
        model = Sketchup.active_model
        sel = model.selection
        return { 'ok' => false, 'error' => 'Selecciona un módulo o panel.' } if sel.empty?

        nombre_mat = params['material_nombre'] || 'Melamina 18mm'
        veta_mat   = params['veta'] || 'longitudinal'
        color_hex  = params['color_hex']

        model.start_operation('MelaStudio: Asignar Material y Veta', true)

        begin
          # Obtener o crear material nativo en SketchUp
          su_material = obtener_o_crear_material_su(model, nombre_mat, color_hex)

          conteo = 0
          sel.each do |ent|
            recorrer_y_aplicar(ent, nombre_mat, veta_mat, su_material) do
              conteo += 1
            end
          end

          model.commit_operation
          { 'ok' => true, 'mensaje' => "Material '#{nombre_mat}' con veta '#{veta_mat}' aplicado a #{conteo} piezas." }
        rescue => e
          model.abort_operation
          { 'ok' => false, 'error' => e.message }
        end
      end

      private

      # ========================================================================
      # Método: obtener_o_crear_material_su
      # Descripción: Busca un material por nombre en SketchUp o lo crea con el color indicado.
      # ========================================================================
      def obtener_o_crear_material_su(model, nombre, color_hex)
        mat = model.materials[nombre]
        unless mat
          mat = model.materials.add(nombre)
          if color_hex && color_hex =~ /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i
            r = $1.to_i(16)
            g = $2.to_i(16)
            b = $3.to_i(16)
            mat.color = Sketchup::Color.new(r, g, b)
          end
        end
        mat
      end

      # ========================================================================
      # Método: recorrer_y_aplicar
      # Descripción: Asigna metadatos y material de render recursivamente.
      # ========================================================================
      def recorrer_y_aplicar(ent, nombre_mat, veta_mat, su_mat, &block)
        if ent.is_a?(Sketchup::Group) || ent.is_a?(Sketchup::ComponentInstance)
          dict = ent.attribute_dictionary('DespieceMela')
          if dict
            dict['material'] = nombre_mat
            dict['veta']     = veta_mat
            ent.material     = su_mat if su_mat
            yield if block_given?
          end

          if ent.respond_to?(:entities)
            ent.entities.each { |child| recorrer_y_aplicar(child, nombre_mat, veta_mat, su_mat, &block) }
          end
        end
      end
    end
  end
end
