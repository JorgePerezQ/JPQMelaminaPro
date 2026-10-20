# ==============================================================================
# Archivo: mela_studio_clone.rb
# Descripción: Registrador principal de la extensión para SketchUp.
#              Permite que SketchUp reconozca y cargue la extensión MelaStudio Pro Clone.
# ==============================================================================

require 'sketchup.rb'
require 'extensions.rb'

module MelaStudioClone
  # Constante de versión del plugin
  PLUGIN_VERSION = '1.0.0'.freeze

  # Identificador único de la extensión
  PLUGIN_ID = 'mela_studio_clone'.freeze

  unless file_loaded?(__FILE__)
    # Inicialización del objeto de extensión de SketchUp
    extension = SketchupExtension.new(
      'MelaStudio Pro - Suite de Carpintería y Despiece',
      File.join(File.dirname(__FILE__), 'mela_studio_clone', 'main')
    )

    # Metadatos descriptivos de la herramienta
    extension.description = 'Diseño paramétrico milimétrico, mecanizado de herrajes, ranuras, tapacantos y extracción de despiece para centros de corte (Pelíkano, Masisa, Sodimac).'
    extension.version     = PLUGIN_VERSION
    extension.creator     = 'MelaStudio Clone Studio'
    extension.copyright   = '2026'

    # Registrar la extensión para que se active por defecto
    Sketchup.register_extension(extension, true)

    # Marca el archivo como cargado para evitar duplicados en recargas
    file_loaded(__FILE__)
  end
end
