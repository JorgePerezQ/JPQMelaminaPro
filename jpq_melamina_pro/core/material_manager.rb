# ==============================================================================
# Archivo: jpq_melamina_pro/core/material_manager.rb
# Descripción: Gestor integral de materiales, melamina normal vs RH (antihumedad)
#              y motor de recomendación inteligente de tapacantos.
#              Administra texturas fotorrealistas de marcas líderes (Pelikano, Vesto),
#              diferencia el núcleo verde en melamina RH hidrófuga y calcula
#              la recomendación automática de cantos grueso (2mm) vs delgado (0.5mm).
# ==============================================================================

require 'sketchup.rb'
require 'json'

module JPQMelaminaPro
  class MaterialManager
    class << self
      CATALOGO_PREDETERMINADO = [
        # --- PELIKANO (NOVOPAN) ---
        { 'id' => 'pel_bellota_18',      'marca' => 'Pelikano', 'categoria' => 'Maderas',    'nombre' => 'Pelikano Bellota 18mm',       'espesor' => 18.0, 'veta' => 'longitudinal', 'color' => '#8D5B36', 'precio_m2' => 38.0 },
        { 'id' => 'pel_macadamia_18',    'marca' => 'Pelikano', 'categoria' => 'Maderas',    'nombre' => 'Pelikano Macadamia 18mm',     'espesor' => 18.0, 'veta' => 'longitudinal', 'color' => '#B99B78', 'precio_m2' => 36.5 },
        { 'id' => 'pel_rovere_18',       'marca' => 'Pelikano', 'categoria' => 'Maderas',    'nombre' => 'Pelikano Rovere 18mm',        'espesor' => 18.0, 'veta' => 'longitudinal', 'color' => '#A88B67', 'precio_m2' => 37.0 },
        { 'id' => 'pel_caramel_18',      'marca' => 'Pelikano', 'categoria' => 'Maderas',    'nombre' => 'Pelikano Caramel 18mm',       'espesor' => 18.0, 'veta' => 'longitudinal', 'color' => '#A66838', 'precio_m2' => 37.5 },
        { 'id' => 'pel_cognac_18',       'marca' => 'Pelikano', 'categoria' => 'Maderas',    'nombre' => 'Pelikano Coñac 18mm',         'espesor' => 18.0, 'veta' => 'longitudinal', 'color' => '#7A3E26', 'precio_m2' => 37.0 },
        { 'id' => 'pel_duna_18',         'marca' => 'Pelikano', 'categoria' => 'Maderas',    'nombre' => 'Pelikano Duna 18mm',          'espesor' => 18.0, 'veta' => 'longitudinal', 'color' => '#D6C7B2', 'precio_m2' => 35.5 },
        { 'id' => 'pel_niebla_18',       'marca' => 'Pelikano', 'categoria' => 'Unicolores', 'nombre' => 'Pelikano Niebla 18mm',        'espesor' => 18.0, 'veta' => 'libre',        'color' => '#C2C3BF', 'precio_m2' => 31.0 },
        { 'id' => 'pel_carbono_18',      'marca' => 'Pelikano', 'categoria' => 'Unicolores', 'nombre' => 'Pelikano Carbono 18mm',       'espesor' => 18.0, 'veta' => 'libre',        'color' => '#33363B', 'precio_m2' => 34.0 },
        { 'id' => 'pel_blanco_nieve_18', 'marca' => 'Pelikano', 'categoria' => 'Unicolores', 'nombre' => 'Pelikano Blanco Nieve 18mm',  'espesor' => 18.0, 'veta' => 'libre',        'color' => '#F5F6F8', 'precio_m2' => 24.0 },
        { 'id' => 'pel_oxido_18',        'marca' => 'Pelikano', 'categoria' => 'Fantasía',   'nombre' => 'Pelikano Óxido 18mm',         'espesor' => 18.0, 'veta' => 'libre',        'color' => '#6B4F43', 'precio_m2' => 42.0 },

        # --- VESTO (ARAUCO) ---
        { 'id' => 'vesto_roble_cendra_18', 'marca' => 'Vesto', 'categoria' => 'Maderas',    'nombre' => 'Vesto Roble Cendra 18mm',     'espesor' => 18.0, 'veta' => 'longitudinal', 'color' => '#9E8C78', 'precio_m2' => 38.0 },
        { 'id' => 'vesto_aserrado_18',     'marca' => 'Vesto', 'categoria' => 'Maderas',    'nombre' => 'Vesto Aserrado 18mm',         'espesor' => 18.0, 'veta' => 'longitudinal', 'color' => '#B4926C', 'precio_m2' => 39.0 },
        { 'id' => 'vesto_seda_giorno_18',  'marca' => 'Vesto', 'categoria' => 'Textil',     'nombre' => 'Vesto Seda Giorno 18mm',      'espesor' => 18.0, 'veta' => 'libre',        'color' => '#8E7E73', 'precio_m2' => 40.0 },
        { 'id' => 'vesto_linosa_18',       'marca' => 'Vesto', 'categoria' => 'Textil',     'nombre' => 'Vesto Linosa 18mm',           'espesor' => 18.0, 'veta' => 'libre',        'color' => '#B7A998', 'precio_m2' => 38.5 },
        { 'id' => 'vesto_teca_lira_18',    'marca' => 'Vesto', 'categoria' => 'Maderas',    'nombre' => 'Vesto Teca Lira 18mm',         'espesor' => 18.0, 'veta' => 'longitudinal', 'color' => '#85583B', 'precio_m2' => 38.5 },
        { 'id' => 'vesto_nogal_terra_18',  'marca' => 'Vesto', 'categoria' => 'Maderas',    'nombre' => 'Vesto Nogal Terracota 18mm',  'espesor' => 18.0, 'veta' => 'longitudinal', 'color' => '#6E4631', 'precio_m2' => 37.0 },
        { 'id' => 'vesto_wengue_18',       'marca' => 'Vesto', 'categoria' => 'Maderas',    'nombre' => 'Vesto Wengue 18mm',           'espesor' => 18.0, 'veta' => 'longitudinal', 'color' => '#3B2B23', 'precio_m2' => 36.0 },
        { 'id' => 'vesto_cendra_escan_18', 'marca' => 'Vesto', 'categoria' => 'Maderas',    'nombre' => 'Vesto Cendra Escandinavo 18mm','espesor' => 18.0,'veta' => 'longitudinal', 'color' => '#C9BCAC', 'precio_m2' => 36.5 },
        { 'id' => 'vesto_blanco_frost_18', 'marca' => 'Vesto', 'categoria' => 'Unicolores', 'nombre' => 'Vesto Blanco Frost 18mm',     'espesor' => 18.0, 'veta' => 'libre',        'color' => '#F2F4F5', 'precio_m2' => 24.5 },
        { 'id' => 'vesto_titan_18',        'marca' => 'Vesto', 'categoria' => 'Unicolores', 'nombre' => 'Vesto Titán 18mm',            'espesor' => 18.0, 'veta' => 'libre',        'color' => '#4A4F55', 'precio_m2' => 33.5 },

        # --- UNIVERSALES ---
        { 'id' => 'mel_blanco_18',         'marca' => 'Universal', 'categoria' => 'Unicolores', 'nombre' => 'Melamina Blanca 18mm',     'espesor' => 18.0, 'veta' => 'libre',        'color' => '#FFFFFF', 'precio_m2' => 22.5 },
        { 'id' => 'mel_roble_18',          'marca' => 'Universal', 'categoria' => 'Maderas',    'nombre' => 'Melamina Roble Natural 18mm','espesor' => 18.0,'veta' => 'longitudinal', 'color' => '#D0A87C', 'precio_m2' => 32.0 },
        { 'id' => 'mel_gris_humo_18',      'marca' => 'Universal', 'categoria' => 'Unicolores', 'nombre' => 'Melamina Gris Humo 18mm',   'espesor' => 18.0, 'veta' => 'libre',        'color' => '#7F8489', 'precio_m2' => 28.0 },
        { 'id' => 'mdf_blanco_3',          'marca' => 'Universal', 'categoria' => 'Fondos',     'nombre' => 'MDF Fondo Blanco 3mm',      'espesor' => 3.0,  'veta' => 'libre',        'color' => '#E8E2D6', 'precio_m2' => 8.5 }
      ].freeze

      # ========================================================================
      # Método: obtener_catalogo
      # ========================================================================
      def obtener_catalogo
        CATALOGO_PREDETERMINADO
      end

      # ========================================================================
      # Método: buscar_material
      # ========================================================================
      def buscar_material(nombre_o_id)
        return nil if nombre_o_id.nil?
        nom_clean = nombre_o_id.to_s.strip.downcase
        obtener_catalogo.find do |m|
          m['nombre'].to_s.strip.downcase == nom_clean ||
          m['id'].to_s.strip.downcase == nom_clean ||
          nom_clean.include?(m['nombre'].to_s.strip.downcase)
        end
      end

      # ========================================================================
      # Método: obtener_materiales_de_bandeja
      # Descripción: Lee todos los materiales y texturas actualmente cargados
      #              en la bandeja de materiales de SketchUp (active_model.materials).
      # Retorno:
      #   - Array<Hash>: Lista de materiales con nombre, color HEX y estado de textura.
      # ========================================================================
      def obtener_materiales_de_bandeja(model = Sketchup.active_model)
        return [] unless model && model.materials

        materiales = []
        model.materials.each do |mat|
          next if mat.nil?
          nom = mat.name.to_s.strip
          next if nom.empty?

          color_hex = sprintf('#%02X%02X%02X', mat.color.red, mat.color.green, mat.color.blue)
          tiene_textura = !mat.texture.nil?
          ancho_tex = tiene_textura ? mat.texture.width.to_mm.round(1) : nil
          alto_tex = tiene_textura ? mat.texture.height.to_mm.round(1) : nil

          materiales << {
            'id' => "su_tray_#{mat.name.gsub(/[^0-9A-Za-z_-]/, '_')}",
            'marca' => 'Bandeja SketchUp',
            'categoria' => 'Bandeja SketchUp',
            'nombre' => mat.display_name.to_s.empty? ? nom : mat.display_name.to_s,
            'nombre_su' => nom,
            'color' => color_hex,
            'tiene_textura' => tiene_textura,
            'textura_ancho' => ancho_tex,
            'textura_alto' => alto_tex,
            'es_de_bandeja' => true,
            'espesor' => 18.0,
            'veta' => tiene_textura ? 'longitudinal' : 'libre'
          }
        end

        materiales.sort_by { |m| m['nombre'].downcase }
      end

      # ========================================================================
      # Método: obtener_material_activo_bandeja
      # Descripción: Obtiene el material actualmente seleccionado por el usuario
      #              en la bandeja de materiales de SketchUp (model.materials.current).
      # ========================================================================
      def obtener_material_activo_bandeja(model = Sketchup.active_model)
        return { 'ok' => false, 'error' => 'No hay modelo activo en SketchUp.' } unless model

        mat = model.materials.current
        # Si no hay material activo en el bote de pintura, intentar leer de la selección
        if mat.nil? && model.selection && !model.selection.empty?
          ent = model.selection.first
          mat = ent.material if ent.respond_to?(:material)
        end

        if mat.nil?
          return { 'ok' => false, 'error' => 'No hay ningún material seleccionado en la bandeja ni en la selección.' }
        end

        color_hex = sprintf('#%02X%02X%02X', mat.color.red, mat.color.green, mat.color.blue)
        tiene_textura = !mat.texture.nil?

        {
          'ok' => true,
          'material' => {
            'id' => "su_tray_#{mat.name.gsub(/[^0-9A-Za-z_-]/, '_')}",
            'marca' => 'Bandeja SketchUp',
            'categoria' => 'Bandeja SketchUp',
            'nombre' => mat.display_name.to_s.empty? ? mat.name : mat.display_name.to_s,
            'nombre_su' => mat.name,
            'color' => color_hex,
            'tiene_textura' => tiene_textura,
            'es_de_bandeja' => true
          }
        }
      end

      # ========================================================================
      # Método: obtener_material_seleccion
      # Descripción: Herramienta Cuentagotas / Gotero que toma el material
      #              directamente de la pieza o cara 3D seleccionada en SketchUp.
      # ========================================================================
      def obtener_material_seleccion(model = Sketchup.active_model)
        return { 'ok' => false, 'error' => 'No hay modelo activo en SketchUp.' } unless model

        if model.selection.empty?
          return { 'ok' => false, 'error' => 'Selecciona un módulo o pieza en el modelo 3D con el cursor.' }
        end

        entidad = model.selection.first
        mat = nil

        if entidad.respond_to?(:material) && entidad.material
          mat = entidad.material
        elsif entidad.is_a?(Sketchup::ComponentInstance) || entidad.is_a?(Sketchup::Group)
          entidades = entidad.is_a?(Sketchup::ComponentInstance) ? entidad.definition.entities : entidad.entities
          cara_con_mat = entidades.grep(Sketchup::Face).find { |f| f.material }
          mat = cara_con_mat.material if cara_con_mat
        end

        if mat.nil?
          return { 'ok' => false, 'error' => 'La pieza seleccionada no tiene ningún material asignado.' }
        end

        color_hex = sprintf('#%02X%02X%02X', mat.color.red, mat.color.green, mat.color.blue)
        {
          'ok' => true,
          'material' => {
            'id' => "su_tray_#{mat.name.gsub(/[^0-9A-Za-z_-]/, '_')}",
            'marca' => 'Bandeja SketchUp',
            'categoria' => 'Bandeja SketchUp',
            'nombre' => mat.display_name.to_s.empty? ? mat.name : mat.display_name.to_s,
            'nombre_su' => mat.name,
            'color' => color_hex,
            'tiene_textura' => !mat.texture.nil?,
            'es_de_bandeja' => true
          }
        }
      end

      # ========================================================================
      # Método: obtener_o_crear_material_su
      # Descripción: Crea o devuelve un material en SketchUp. Prioriza los materiales
      #              ya existentes en la Bandeja de SketchUp conservando sus texturas.
      # ========================================================================
      def obtener_o_crear_material_su(model, nombre, resistencia = 'Normal')
        return nil unless model
        nombre = 'Pelikano Blanco Nieve 18mm' if nombre.nil? || nombre.to_s.strip.empty?
        nombre_clean = nombre.to_s.strip

        # 1. Si el material ya está cargado en la bandeja del usuario en SketchUp
        mat_existente = model.materials[nombre_clean]
        return mat_existente if mat_existente && resistencia == 'Normal'

        nombre_final = (resistencia == 'RH') ? "#{nombre_clean} [RH]" : nombre_clean
        mat = model.materials[nombre_final]
        return mat if mat

        # 2. Si el material base existía en bandeja pero se pide variante RH
        if mat_existente
          mat = model.materials.add(nombre_final)
          mat.color = mat_existente.color
          if mat_existente.texture
            mat.texture = mat_existente.texture.filename
            mat.texture.width = mat_existente.texture.width
            mat.texture.height = mat_existente.texture.height
          end
          return mat
        end

        # 3. Si no existe en la bandeja, buscar en el catálogo integrado de marcas
        mat = model.materials.add(nombre_final)
        item = buscar_material(nombre_clean)

        color_hex = item ? item['color'] : '#8D5B36'
        r = color_hex[1..2].to_i(16)
        g = color_hex[3..4].to_i(16)
        b = color_hex[5..6].to_i(16)

        mat.color = Sketchup::Color.new(r, g, b)

        # Buscar archivo de textura en la carpeta textures/ si aplica
        texturas_dir = File.join(__dir__, '..', 'textures')
        if item && Dir.exist?(texturas_dir)
          archivo_png = Dir[File.join(texturas_dir, "*#{item['id']}*.png")].first
          if archivo_png && File.exist?(archivo_png)
            mat.texture = archivo_png
            mat.texture.width = 1200.mm # Mapeo a escala real de veta
          end
        end

        mat
      end

      # ========================================================================
      # Método: aplicar_materiales_a_modelo
      # Descripción: Aplica las texturas y materiales seleccionados a las piezas
      #              del módulo activo o de la selección en SketchUp.
      # ========================================================================
      def aplicar_materiales_a_modelo(params, model = Sketchup.active_model)
        return { 'ok' => false, 'error' => 'No hay modelo activo en SketchUp.' } unless model

        nom_est = params['material'] || 'Pelikano Blanco Nieve 18mm'
        nom_fre = params['material_frentes'] || nom_est
        resistencia = params['resistencia'] || 'Normal'

        su_mat_est = obtener_o_crear_material_su(model, nom_est, resistencia)
        su_mat_fre = obtener_o_crear_material_su(model, nom_fre, resistencia)

        model.start_operation('JPQ: Aplicar Materiales de Melamina', true)

        objetivos = if model.selection && !model.selection.empty?
                      model.selection.to_a
                    else
                      model.entities.grep(Sketchup::ComponentInstance) + model.entities.grep(Sketchup::Group)
                    end

        piezas_pintadas = 0

        pintar_entidad = lambda do |ent|
          nom = ent.name.to_s
          def_nom = ent.respond_to?(:definition) ? ent.definition.name.to_s : ''
          es_frente = (nom =~ /Puerta|Frente|Tapa Frente|Gaveta/i) || (def_nom =~ /Puerta|Frente|Tapa Frente|Gaveta/i)

          mat_a_usar = es_frente ? su_mat_fre : su_mat_est
          ent.material = mat_a_usar
          piezas_pintadas += 1

          hijas = if ent.is_a?(Sketchup::ComponentInstance)
                    ent.definition.entities
                  elsif ent.is_a?(Sketchup::Group)
                    ent.entities
                  else
                    []
                  end

          hijas.grep(Sketchup::Face).each do |f|
            f.material = mat_a_usar
            f.back_material = mat_a_usar
          end

          hijas.grep(Sketchup::ComponentInstance).each { |sub| pintar_entidad.call(sub) }
          hijas.grep(Sketchup::Group).each { |sub| pintar_entidad.call(sub) }
        end

        objetivos.each { |obj| pintar_entidad.call(obj) }

        model.commit_operation

        {
          'ok' => true,
          'mensaje' => "Se aplicó '#{nom_est}' a #{piezas_pintadas} piezas en SketchUp.",
          'piezas_afectadas' => piezas_pintadas
        }
      rescue => e
        model.abort_operation if model
        { 'ok' => false, 'error' => "Error al aplicar materiales: #{e.message}" }
      end

      alias apply aplicar_materiales_a_modelo

      # ========================================================================
      # Método: proponer_tapacantos_pieza
      # Descripción: Motor de recomendación automática de cantos del Clon:
      #              - Canto Grueso (2mm): Frentes de cajón, puertas, cubiertas de escritorio, repisas expuestas.
      #              - Canto Delgado (0.5mm): Estructuras internas, amarres, zócalos, laterales de cajón.
      #              - Sin Canto: Traseras y fijaciones a pared o suelo.
      # ========================================================================
      def proponer_tapacantos_pieza(nombre_pieza)
        case nombre_pieza
        when /Puerta|Frente|Tapa Frente|Cubierta|Mesa/i
          { 'L1' => 2.0, 'L2' => 2.0, 'A1' => 2.0, 'A2' => 2.0, 'tipo' => 'Grueso 2mm (Alto Tránsito)' }
        when /Repisa Abierta|Estante/i
          { 'L1' => 2.0, 'L2' => 0.0, 'A1' => 0.5, 'A2' => 0.5, 'tipo' => 'Grueso Frontal 2mm' }
        when /Lateral|Costado|Parante/i
          { 'L1' => 2.0, 'L2' => 0.5, 'A1' => 0.5, 'A2' => 0.5, 'tipo' => 'Mixto (Grueso Frontal + Delgado)' }
        when /Piso|Techo/i
          { 'L1' => 2.0, 'L2' => 0.0, 'A1' => 0.5, 'A2' => 0.5, 'tipo' => 'Grueso Frontal' }
        when /Amarre|Faldón|Zócalo/i
          { 'L1' => 0.5, 'L2' => 0.0, 'A1' => 0.5, 'A2' => 0.5, 'tipo' => 'Delgado 0.5mm' }
        when /Cajón|Lat Cajón|Contrafrente/i
          { 'L1' => 0.5, 'L2' => 0.0, 'A1' => 0.0, 'A2' => 0.0, 'tipo' => 'Delgado Superior 0.5mm' }
        when /Fondo/i
          { 'L1' => 0.0, 'L2' => 0.0, 'A1' => 0.0, 'A2' => 0.0, 'tipo' => 'Sin Canto (Embutido/Clavado)' }
        else
          { 'L1' => 0.5, 'L2' => 0.5, 'A1' => 0.5, 'A2' => 0.5, 'tipo' => 'Estándar Taller' }
        end
      end
    end
  end
end
