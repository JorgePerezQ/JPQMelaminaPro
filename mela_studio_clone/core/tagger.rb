# ==============================================================================
# Archivo: mela_studio_clone/core/tagger.rb
# Descripción: Sistema de etiquetado y rotulado para taller.
#              Asigna identificadores secuenciales únicos (Stickers / Tags)
#              a cada pieza del modelo (ej. LAT-IZQ-01, PISO-01) y permite
#              insertar marcas de texto nativas visibles en el modelo 3D.
# ==============================================================================

require 'sketchup.rb'

module MelaStudioClone
  class Tagger
    class << self
      # ========================================================================
      # Método: tag_selection_or_all
      # Descripción: Recorre las piezas del modelo (o de la selección si no está vacía)
      #              y numera formalmente cada componente para su seguimiento en ensamble.
      # Parámetros:
      #   - opciones (Hash, opcional): {'crear_texto_3d' => false, 'prefijo' => 'PZA'}
      # Retorno:
      #   - Integer: Número de piezas etiquetadas.
      # ========================================================================
      def tag_selection_or_all(opciones = {})
        model = Sketchup.active_model
        sel = model.selection
        origen = sel.empty? ? model.entities : sel

        model.start_operation('MelaStudio: Etiquetar Piezas', true)

        conteo = 0
        prefijo = opciones['prefijo'] || 'PZA'

        begin
          origen.each do |ent|
            recorrer_y_etiquetar(ent, prefijo) do
              conteo += 1
            end
          end

          model.commit_operation
          conteo
        rescue => e
          model.abort_operation
          0
        end
      end

      private

      # ========================================================================
      # Método: recorrer_y_etiquetar
      # Descripción: Recorre recursivamente las entidades en busca de diccionarios DespieceMela.
      # ========================================================================
      def recorrer_y_etiquetar(ent, prefijo, &block)
        if ent.is_a?(Sketchup::Group) || ent.is_a?(Sketchup::ComponentInstance)
          dict = ent.attribute_dictionary('DespieceMela')
          if dict
            num_actual = dict['numero_etiqueta']
            unless num_actual && !num_actual.empty?
              @contador ||= 0
              @contador += 1
              tag = "#{prefijo}-#{sprintf('%03d', @contador)}"
              dict['numero_etiqueta'] = tag
              # Actualizar nombre del grupo si no tiene tag
              ent.name = "#{tag} | #{dict['pieza_nombre']}" unless ent.name.include?(tag)
            end
            yield if block_given?
          end

          if ent.respond_to?(:entities)
            ent.entities.each { |child| recorrer_y_etiquetar(child, prefijo, &block) }
          end
        end
      end
    end
  end
end
