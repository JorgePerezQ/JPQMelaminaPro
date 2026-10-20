# ==============================================================================
# Archivo: package_extension.rb
# Descripción: Empaquetador nativo en Ruby para generar el archivo .rbz de SketchUp.
# ==============================================================================

require 'zip' rescue nil

# Generación directa mediante llamada al sistema o empaquetado zip
dir_raiz = File.expand_path(__dir__)
archivo_rbz = File.join(dir_raiz, 'mela_studio_pro_clone.rbz')

puts "Generando instalador .rbz en: #{archivo_rbz}"

# Comando zip estándar de Linux
system("cd '#{dir_raiz}' && zip -r -q '#{archivo_rbz}' mela_studio_clone.rb mela_studio_clone/ -x '*.py' '*.pyc' '*.git*' '*Zone.Identifier*'")

if File.exist?(archivo_rbz)
  puts "¡Éxito! Archivo generado con tamaño: #{File.size(archivo_rbz)} bytes."
else
  puts "Por favor ejecuta: python3 package_extension.py"
end
