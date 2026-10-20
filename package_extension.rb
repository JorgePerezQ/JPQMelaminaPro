# ==============================================================================
# Archivo: package_extension.rb
# Descripción: Empaquetador nativo en Ruby para generar el archivo jpq_melamina_pro.rbz.
# ==============================================================================

dir_raiz = File.expand_path(__dir__)
archivo_rbz = File.join(dir_raiz, 'jpq_melamina_pro.rbz')

puts "Generando instalador .rbz en: #{archivo_rbz}"

# Comando zip estándar de Linux
system("cd '#{dir_raiz}' && zip -r -q '#{archivo_rbz}' jpq_melamina_pro.rb jpq_melamina_pro/ -x '*.py' '*.pyc' '*.git*' '*Zone.Identifier*'")

if File.exist?(archivo_rbz)
  puts "¡Éxito! Archivo generado con tamaño: #{File.size(archivo_rbz)} bytes."
else
  puts "Por favor ejecuta: python3 package_extension.py"
end
