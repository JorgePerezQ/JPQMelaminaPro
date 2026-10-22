# ==============================================================================
# Archivo: jpq_melamina_pro/core/profile_manager.rb
# Descripción: Gestor integral de Perfiles Prediseñados y ADN Técnico (CRUD).
#              Incluye un catálogo maestro de perfiles de fábrica para:
#              - Todo tipo de muebles: Cocinas, Baños, Clósets, Roperos, Cómodas,
#                Camas/Cabeceras, Escritorios, Libreros, Recibidores y Lavanderías.
#              - Todo tipo de usos: Gaming, Trabajo Ejecutivo, Maquillaje/Belleza,
#                Almacenamiento masivo, Exhibición comercial y Lectura.
#              - Todo tipo de edades y géneros: Infantil (Montessori / Estudio),
#                Juvenil Femenino (Tocador), Juvenil Masculino/Gamer (Battlestation),
#                Adultos/Matrimonial y Adultos Mayores/Senior (Accesibilidad universal).
# ==============================================================================

require 'sketchup.rb'
require 'json'

module JPQMelaminaPro
  class ProfileManager
    # Ruta del archivo de persistencia de perfiles del usuario
    CONFIG_FILE = File.join(__dir__, '..', 'perfiles_config.json').freeze

    # Catálogo maestro de perfiles predeterminados de fábrica
    PERFILES_POR_DEFECTO = {
      # --- 1. COCINAS Y BAÑOS ---
      'cocina_modular' => {
        'id' => 'cocina_modular',
        'nombre' => 'Cocina Integral Modular (BIM Ergonómica)',
        'categoria' => 'Cocina y Baño',
        'ambiente' => 'Cocina',
        'edad_genero' => 'Universal / Familiar',
        'icono' => '🍳',
        'descripcion' => 'Módulos bajos de 580mm con zócalo sanitario antihumedad, aéreos de 320mm para evitar golpes y melamina RH recomendada.',
        'editable' => false,
        'ancho_sugerido' => 2400, 'alto_sugerido' => 2100,
        'prof_baja' => 580, 'prof_media' => 0, 'prof_alta' => 320,
        'altura_zocalo' => 100, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'telescopica', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 2, 'material_resistencia' => 'RH',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => true, 'led_ubicacion' => 'bajo_altos'
      },
      'bano_vanitorio_flotante' => {
        'id' => 'bano_vanitorio_flotante',
        'nombre' => 'Vanitorio de Baño Flotante y Botiquín',
        'categoria' => 'Cocina y Baño',
        'ambiente' => 'Baño',
        'edad_genero' => 'Universal',
        'icono' => '🚿',
        'descripcion' => 'Mueble suspendido 100% en Melamina RH hidrófuga con corte en U para sifón, cajón amplio y botiquín con espejo LED.',
        'editable' => false,
        'ancho_sugerido' => 900, 'alto_sugerido' => 1800,
        'prof_baja' => 480, 'prof_media' => 0, 'prof_alta' => 180,
        'altura_zocalo' => 0, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'oculta', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 2, 'material_resistencia' => 'RH',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Grueso_2mm',
        'led_integrado' => true, 'led_ubicacion' => 'espejo'
      },
      'lavanderia_despensa_rh' => {
        'id' => 'lavanderia_despensa_rh',
        'nombre' => 'Módulo de Lavandería y Despensa Antihumedad',
        'categoria' => 'Cocina y Baño',
        'ambiente' => 'Lavandería / Cocina',
        'edad_genero' => 'Universal / Familiar',
        'icono' => '🧺',
        'descripcion' => 'Fabricado en Melamina RH hidrófuga con nicho para lavadora/secadora, mueble superior para detergentes con pistón a gas y armario de escobas.',
        'editable' => false,
        'ancho_sugerido' => 1600, 'alto_sugerido' => 2200,
        'prof_baja' => 650, 'prof_media' => 0, 'prof_alta' => 350,
        'altura_zocalo' => 100, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'telescopica', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 3, 'material_resistencia' => 'RH',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => true, 'led_ubicacion' => 'bajo_altos'
      },

      # --- 2. DORMITORIOS Y CLÓSETS ---
      'closet_vestidor' => {
        'id' => 'closet_vestidor',
        'nombre' => 'Clóset & Vestidor Walk-in Matrimonial',
        'categoria' => 'Dormitorio y Clóset',
        'ambiente' => 'Dormitorio Principal',
        'edad_genero' => 'Adultos / Matrimonial',
        'icono' => '👗',
        'descripcion' => 'Profundidad de 600mm para colgado sin rozar puertas, módulos dobles para ropa larga y corta, cajoneras y maleteros continuos.',
        'editable' => false,
        'ancho_sugerido' => 2800, 'alto_sugerido' => 2400,
        'prof_baja' => 600, 'prof_media' => 600, 'prof_alta' => 600,
        'altura_zocalo' => 100, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'telescopica', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 3, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => true, 'led_ubicacion' => 'repi_closet'
      },
      'ropero_puertas_corredizas' => {
        'id' => 'ropero_puertas_corredizas',
        'nombre' => 'Ropero Compacto con Puertas Corredizas',
        'categoria' => 'Dormitorio y Clóset',
        'ambiente' => 'Dormitorio Secundario',
        'edad_genero' => 'Universal / Juvenil',
        'icono' => '👔',
        'descripcion' => 'Diseñado para dormitorios compactos con riel superior e inferior Duclós/Aluminio que evita invadir el paso al abrir.',
        'editable' => false,
        'ancho_sugerido' => 1800, 'alto_sugerido' => 2200,
        'prof_baja' => 620, 'prof_media' => 620, 'prof_alta' => 620,
        'altura_zocalo' => 80, 'tipo_montaje' => 'exterior', 'luz_frentes' => 3,
        'tipo_corredera' => 'telescopica', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 3, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => false, 'led_ubicacion' => 'ninguno'
      },
      'cama_cabecera_integrada' => {
        'id' => 'cama_cabecera_integrada',
        'nombre' => 'Cabecera Flotante con Veladores Integrados',
        'categoria' => 'Dormitorio y Clóset',
        'ambiente' => 'Dormitorio',
        'edad_genero' => 'Adultos / Matrimonial',
        'icono' => '🛏️',
        'descripcion' => 'Panel de respaldo amaderado con ranuras para iluminación indirecta LED cálida, calados para enchufes y 2 mesas de noche flotantes.',
        'editable' => false,
        'ancho_sugerido' => 2600, 'alto_sugerido' => 1200,
        'prof_baja' => 380, 'prof_media' => 50, 'prof_alta' => 50,
        'altura_zocalo' => 0, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'oculta', 'mdf_metodo' => 'clavado', 'distancia_ranura' => 18,
        'cant_amarres' => 2, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => true, 'led_ubicacion' => 'bajo_altos'
      },
      'comoda_chifonier' => {
        'id' => 'comoda_chifonier',
        'nombre' => 'Cómoda Chifonier de 6 Cajones',
        'categoria' => 'Dormitorio y Clóset',
        'ambiente' => 'Dormitorio',
        'edad_genero' => 'Universal',
        'icono' => '🗄️',
        'descripcion' => 'Torre de almacenamiento masivo con 6 cajones de frentes amplios, travesaños de arriostramiento interno y zócalo sanitario.',
        'editable' => false,
        'ancho_sugerido' => 1000, 'alto_sugerido' => 1250,
        'prof_baja' => 480, 'prof_media' => 480, 'prof_alta' => 480,
        'altura_zocalo' => 80, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'telescopica', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 2, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => false, 'led_ubicacion' => 'ninguno'
      },

      # --- 3. INFANTIL Y JUVENIL ---
      'infantil_montessori' => {
        'id' => 'infantil_montessori',
        'nombre' => 'Mueble Juguetero y Cuentacuentos Montessori',
        'categoria' => 'Infantil y Juvenil',
        'ambiente' => 'Dormitorio Infantil',
        'edad_genero' => 'Infantil (2 a 8 años)',
        'icono' => '🧸',
        'descripcion' => 'Baja altura ergonómica (900mm) accesible para niños, repisas frontales para libros, gavetas bajas con ruedas y cantos 2mm boleados sin esquinas filosas.',
        'editable' => false,
        'ancho_sugerido' => 1400, 'alto_sugerido' => 900,
        'prof_baja' => 380, 'prof_media' => 300, 'prof_alta' => 250,
        'altura_zocalo' => 60, 'tipo_montaje' => 'exterior', 'luz_frentes' => 3,
        'tipo_corredera' => 'telescopica', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 2, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Grueso_2mm',
        'led_integrado' => false, 'led_ubicacion' => 'ninguno'
      },
      'infantil_estudio_creativo' => {
        'id' => 'infantil_estudio_creativo',
        'nombre' => 'Escritorio Infantil de Dibujo y Tareas',
        'categoria' => 'Infantil y Juvenil',
        'ambiente' => 'Dormitorio Niños',
        'edad_genero' => 'Infantil / Escolar (6 a 12 años)',
        'icono' => '🎨',
        'descripcion' => 'Mesa de estudio a altura adaptada (650mm), organizadores laterales de útiles escolares, panel para corcho/pizarra y cajones livianos.',
        'editable' => false,
        'ancho_sugerido' => 1200, 'alto_sugerido' => 1500,
        'prof_baja' => 550, 'prof_media' => 250, 'prof_alta' => 300,
        'altura_zocalo' => 70, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'telescopica', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 2, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => true, 'led_ubicacion' => 'bajo_altos'
      },
      'tocador_juvenil' => {
        'id' => 'tocador_juvenil',
        'nombre' => 'Tocador Makeup Juvenil Femenino',
        'categoria' => 'Infantil y Juvenil',
        'ambiente' => 'Dormitorio Juvenil',
        'edad_genero' => 'Juvenil / Señoritas',
        'icono' => '💄',
        'descripcion' => 'Espejo con ranura LED perimetral neutra 4000K, cajón joyero de baja altura con rejilla organizadora de MDF 5.5mm y torre para skincare.',
        'editable' => false,
        'ancho_sugerido' => 1800, 'alto_sugerido' => 2000,
        'prof_baja' => 600, 'prof_media' => 300, 'prof_alta' => 600,
        'altura_zocalo' => 100, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'oculta', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 2, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => true, 'led_ubicacion' => 'espejo'
      },

      # --- 4. ESTUDIO, OFICINA Y GAMING ---
      'escritorio_gamer' => {
        'id' => 'escritorio_gamer',
        'nombre' => 'Battlestation Gamer / Streaming Setup',
        'categoria' => 'Estudio y Gaming',
        'ambiente' => 'Sala Gamer / Estudio',
        'edad_genero' => 'Juvenil / Chicos / Entusiastas',
        'icono' => '🎮',
        'descripcion' => 'Mesa engrosada de 36mm para soportar pantallas ultrawide, cámara de cables trasera retraída a 60mm, exhibición de CPU sobre mesa y ventilación técnica.',
        'editable' => false,
        'ancho_sugerido' => 3000, 'alto_sugerido' => 2000,
        'prof_baja' => 600, 'prof_media' => 300, 'prof_alta' => 600,
        'altura_zocalo' => 100, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'telescopica', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 2, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => true, 'led_ubicacion' => 'bajo_altos'
      },
      'home_office_ejecutivo' => {
        'id' => 'home_office_ejecutivo',
        'nombre' => 'Home Office Ejecutivo con Cajón de Archivo',
        'categoria' => 'Estudio y Gaming',
        'ambiente' => 'Oficina / Estudio',
        'edad_genero' => 'Adultos / Profesional',
        'icono' => '💼',
        'descripcion' => 'Estación de trabajo ergonómica con pedestal de 3 cajones (incluye cajón para carpetas colgantes tamaño carta/oficio), librero superior y gestión pasacables.',
        'editable' => false,
        'ancho_sugerido' => 2000, 'alto_sugerido' => 2100,
        'prof_baja' => 650, 'prof_media' => 320, 'prof_alta' => 400,
        'altura_zocalo' => 100, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'telescopica', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 2, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => true, 'led_ubicacion' => 'bajo_altos'
      },
      'librero_biblioteca_32mm' => {
        'id' => 'librero_biblioteca_32mm',
        'nombre' => 'Biblioteca de Pared Completa (Sistema 32mm)',
        'categoria' => 'Estudio y Gaming',
        'ambiente' => 'Estudio / Sala',
        'edad_genero' => 'Universal',
        'icono' => '📚',
        'descripcion' => 'Módulo de repisas regulables cada 32mm con perforaciones Euro de 5mm, parantes verticales intermedios que evitan pandeo y zócalo reforzado.',
        'editable' => false,
        'ancho_sugerido' => 2400, 'alto_sugerido' => 2300,
        'prof_baja' => 350, 'prof_media' => 350, 'prof_alta' => 350,
        'altura_zocalo' => 100, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'telescopica', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 4, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => true, 'led_ubicacion' => 'laterales_librero'
      },

      # --- 5. SALAS, RECIBIDORES Y ESTAR ---
      'centro_entretenimiento' => {
        'id' => 'centro_entretenimiento',
        'nombre' => 'Centro de Entretenimiento (Home Theater 55-65")',
        'categoria' => 'Sala y Estar',
        'ambiente' => 'Sala de Estar',
        'edad_genero' => 'Familiar / Adultos',
        'icono' => '📺',
        'descripcion' => 'Nicho para pantallas grandes con panel trasero pasacables retraído 40mm, módulos bajos suspendidos con puertas abatibles y vitrina decorativa LED.',
        'editable' => false,
        'ancho_sugerido' => 2600, 'alto_sugerido' => 2000,
        'prof_baja' => 450, 'prof_media' => 300, 'prof_alta' => 350,
        'altura_zocalo' => 80, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'telescopica', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 2, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => true, 'led_ubicacion' => 'nicho_tv'
      },
      'recibidor_zapatera' => {
        'id' => 'recibidor_zapatera',
        'nombre' => 'Recibidor de Entrada con Zapatera Inclinada',
        'categoria' => 'Sala y Estar',
        'ambiente' => 'Hall de Entrada',
        'edad_genero' => 'Universal',
        'icono' => '👟',
        'descripcion' => 'Módulo angosto para no cortar la circulación: repisas de calzado inclinadas a 20° con listón tope frontal, espejo vertical y percheros para abrigos.',
        'editable' => false,
        'ancho_sugerido' => 1200, 'alto_sugerido' => 2000,
        'prof_baja' => 360, 'prof_media' => 280, 'prof_alta' => 320,
        'altura_zocalo' => 70, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'telescopica', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 2, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => false, 'led_ubicacion' => 'ninguno'
      },

      # --- 6. COMERCIAL Y SENIOR / ACCESIBILIDAD ---
      'senior_accesibilidad' => {
        'id' => 'senior_accesibilidad',
        'nombre' => 'Mueble Ergonómico de Alcance Seguro (Senior)',
        'categoria' => 'Comercial y Senior',
        'ambiente' => 'Dormitorio / Sala',
        'edad_genero' => 'Adultos Mayores / Senior (65+ años)',
        'icono' => '🧓',
        'descripcion' => 'Diseño ergonómico 100% accesible: todos los compartimentos entre 450mm y 1400mm de altura para evitar agacharse o trepar, sin cajones al ras del suelo y con tiradores anchos.',
        'editable' => false,
        'ancho_sugerido' => 1600, 'alto_sugerido' => 1600,
        'prof_baja' => 500, 'prof_media' => 400, 'prof_alta' => 350,
        'altura_zocalo' => 150, 'tipo_montaje' => 'exterior', 'luz_frentes' => 3,
        'tipo_corredera' => 'oculta', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 3, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => true, 'led_ubicacion' => 'bajo_altos'
      },
      'comercial_mostrador_recepcion' => {
        'id' => 'comercial_mostrador_recepcion',
        'nombre' => 'Mostrador de Atención al Cliente y Recepción',
        'categoria' => 'Comercial y Senior',
        'ambiente' => 'Local Comercial / Tienda',
        'edad_genero' => 'Comercial / Empresa',
        'icono' => '🏬',
        'descripcion' => 'Módulo comercial con marquesina frontal para rotulación o logo, cubierta de doble espesor de 36mm, cajonera con cerradura de seguridad y pasacables.',
        'editable' => false,
        'ancho_sugerido' => 2000, 'alto_sugerido' => 1150,
        'prof_baja' => 650, 'prof_media' => 300, 'prof_alta' => 300,
        'altura_zocalo' => 100, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'telescopica', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 2, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => true, 'led_ubicacion' => 'bajo_altos'
      },
      'comercial_vitrina_exhibidora' => {
        'id' => 'comercial_vitrina_exhibidora',
        'nombre' => 'Vitrina Comercial con Iluminación LED Continua',
        'categoria' => 'Comercial y Senior',
        'ambiente' => 'Comercio / Exhibición',
        'edad_genero' => 'Comercial / Retail',
        'icono' => '💎',
        'descripcion' => 'Vitrinas verticales para exhibición de productos, repisas iluminadas con canaletas LED 17x7mm en cada nivel y cajonera inferior de stock.',
        'editable' => false,
        'ancho_sugerido' => 1800, 'alto_sugerido' => 2200,
        'prof_baja' => 450, 'prof_media' => 400, 'prof_alta' => 400,
        'altura_zocalo' => 100, 'tipo_montaje' => 'exterior', 'luz_frentes' => 2,
        'tipo_corredera' => 'telescopica', 'mdf_metodo' => 'ranura', 'distancia_ranura' => 18,
        'cant_amarres' => 3, 'material_resistencia' => 'Normal',
        'tapacanto_frentes' => 'Grueso_2mm', 'tapacanto_interior' => 'Delgado_0.5mm',
        'led_integrado' => true, 'led_ubicacion' => 'laterales_librero'
      }
    }.freeze

    class << self
      # ========================================================================
      # Método: obtener_perfiles
      # Descripción: Lee los perfiles guardados en el archivo JSON local.
      #              Si el archivo no existe, lo crea con el catálogo maestro de fábrica.
      # Retorno:
      #   - Hash con los perfiles estructurados por ID.
      # ========================================================================
      def obtener_perfiles
        asegurar_archivo_configuracion
        begin
          contenido = File.read(CONFIG_FILE, encoding: 'UTF-8')
          datos = JSON.parse(contenido)
          datos['perfiles'] || PERFILES_POR_DEFECTO
        rescue => e
          puts "[JPQMelaminaPro] Error al leer perfiles: #{e.message}. Retornando fábrica."
          PERFILES_POR_DEFECTO
        end
      end

      # ========================================================================
      # Método: guardar_perfil
      # Descripción: Crea o actualiza un perfil de usuario en el archivo de configuración.
      # Parámetros:
      #   - perfil_data (Hash): Datos completos del perfil a persistir.
      # ========================================================================
      def guardar_perfil(perfil_data)
        perfiles = obtener_perfiles.dup
        perfil_id = perfil_data['id'] || "perfil_#{Time.now.to_i}"
        perfil_data['id'] = perfil_id
        perfil_data['editable'] = true unless PERFILES_POR_DEFECTO.key?(perfil_id)

        perfiles[perfil_id] = perfil_data

        File.write(CONFIG_FILE, JSON.pretty_generate({ 'perfiles' => perfiles }), encoding: 'UTF-8')
        { 'ok' => true, 'mensaje' => "Perfil '#{perfil_data['nombre']}' guardado exitosamente.", 'perfiles' => perfiles }
      rescue => e
        { 'ok' => false, 'error' => "Error al guardar perfil: #{e.message}" }
      end

      # ========================================================================
      # Método: eliminar_perfil
      # Descripción: Elimina un perfil personalizado creado por el usuario.
      #              Los perfiles de fábrica están protegidos contra eliminación accidental.
      # ========================================================================
      def eliminar_perfil(perfil_id)
        if PERFILES_POR_DEFECTO.key?(perfil_id)
          return { 'ok' => false, 'error' => 'Los perfiles de fábrica están protegidos y no pueden eliminarse.' }
        end

        perfiles = obtener_perfiles.dup
        perfiles.delete(perfil_id)

        File.write(CONFIG_FILE, JSON.pretty_generate({ 'perfiles' => perfiles }), encoding: 'UTF-8')
        { 'ok' => true, 'mensaje' => 'Perfil eliminado correctamente.', 'perfiles' => perfiles }
      rescue => e
        { 'ok' => false, 'error' => "Error al eliminar perfil: #{e.message}" }
      end

      # ========================================================================
      # Método: restaurar_perfiles_fabrica
      # Descripción: Restablece todos los perfiles a los valores predeterminados de fábrica.
      # ========================================================================
      def restaurar_perfiles_fabrica
        File.write(CONFIG_FILE, JSON.pretty_generate({ 'perfiles' => PERFILES_POR_DEFECTO }), encoding: 'UTF-8')
        { 'ok' => true, 'mensaje' => 'Perfiles de fábrica restaurados con éxito.', 'perfiles' => PERFILES_POR_DEFECTO }
      rescue => e
        { 'ok' => false, 'error' => "Error al restaurar fábrica: #{e.message}" }
      end

      private

      # ========================================================================
      # Sub-método: asegurar_archivo_configuracion
      # Descripción: Crea el archivo perfiles_config.json si aún no existe.
      # ========================================================================
      def asegurar_archivo_configuracion
        return if File.exist?(CONFIG_FILE)
        File.write(CONFIG_FILE, JSON.pretty_generate({ 'perfiles' => PERFILES_POR_DEFECTO }), encoding: 'UTF-8')
      end
    end
  end
end
