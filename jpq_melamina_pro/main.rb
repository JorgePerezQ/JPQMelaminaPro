# ==============================================================================
# Archivo: jpq_melamina_pro/main.rb
# Descripción: Inicializador principal de la barra de herramientas,
#              menús y configuración de la interfaz gráfica UI::HtmlDialog.
#              Organizado en 5 Hubs de Trabajo Profesionales:
#              1. Estudio Espacial & Grilla Modular
#              2. Ingeniería de Frentes, Mecanismos & Fondo
#              3. Inspección Técnica & Cinemática 3D
#              4. Catálogo de Melaminas, RH & Tapacantos
#              5. Despiece Industrial, Optimización 2D & Costos
# ==============================================================================

require 'sketchup.rb'
require 'json'

# Carga de controladores y módulos del motor de carpintería
require_relative 'controller'
require_relative 'core/profile_manager'
require_relative 'core/cabinet_builder'
require_relative 'core/spatial_matrix_builder'
require_relative 'core/kinematics_engine'
require_relative 'core/electrical_engine'
require_relative 'core/parametric_modifier'
require_relative 'core/interior_divider'
require_relative 'core/drawer_builder'
require_relative 'core/groove_manager'
require_relative 'core/edgetape_manager'
require_relative 'core/machining_engine'
require_relative 'core/material_manager'
require_relative 'core/doors_builder'
require_relative 'core/tagger'
require_relative 'core/cutlist_extractor'
require_relative 'optimizer/guillotine_packer'
require_relative 'exporters/csv_exporter'
require_relative 'exporters/excel_exporter'

module JPQMelaminaPro
  @main_dialog = nil
  DICT_NAME = 'DespieceMela'.freeze
  PLUGIN_VERSION = '2.5.0'.freeze unless defined?(PLUGIN_VERSION)

  class << self
    # ==========================================================================
    # Método: abrir_dialogo_principal
    # Descripción: Abre o enfoca la ventana interactiva HTML5/JS del plugin.
    #              Configura callbacks bidireccionales con SketchUp.
    # Parámetros:
    #   - vista_inicial (String): Hub a activar (ej. 'hub-espacio', 'hub-despiece')
    # ==========================================================================
    def abrir_dialogo_principal(vista_inicial = 'hub-espacio')
      if @main_dialog && @main_dialog.visible?
        @main_dialog.set_size(1360, 860)
        @main_dialog.bring_to_front
        ejecutar_en_dialogo("window.cambiarHub && window.cambiarHub('#{vista_inicial}')")
        return
      end

      # Configuración de ventana amplia profesional para vista dividida (1/3 configuración, 2/3 visor 3D CAD)
      dialog_options = {
        dialog_title: 'JPQMelaminaPro - Suite Industrial de Carpintería y Despiece',
        preferences_key: 'com.jpq.melaminapro.workspace_dialog_v3',
        scrollable: false,
        resizable: true,
        width: 1360,
        height: 860,
        min_width: 980,
        min_height: 640,
        style: UI::HtmlDialog::STYLE_DIALOG
      }

      @main_dialog = UI::HtmlDialog.new(dialog_options)
      @main_dialog.set_size(1360, 860)
      @main_dialog.center

      html_file = File.join(__dir__, 'web', 'index.html')
      @main_dialog.set_file(html_file)

      # Conectar el controlador central
      Controller.registrar_callbacks(@main_dialog)

      # Al cargar el DOM, activar el hub solicitado
      @main_dialog.add_action_callback('domListo') do |_context, _params|
        ejecutar_en_dialogo("window.cambiarHub && window.cambiarHub('#{vista_inicial}')")
      end

      @main_dialog.show
      @main_dialog.bring_to_front
    end

    # ==========================================================================
    # Método: ejecutar_en_dialogo
    # Descripción: Ejecuta una instrucción JavaScript dentro de la ventana activa.
    # ==========================================================================
    def ejecutar_en_dialogo(script_js)
      return unless @main_dialog && @main_dialog.visible?
      @main_dialog.execute_script(script_js)
    end

    # ==========================================================================
    # Método: crear_barra_herramientas
    # Descripción: Construye la barra de herramientas organizada por flujos de trabajo.
    # ==========================================================================
    def crear_barra_herramientas
      toolbar = UI::Toolbar.new('JPQMelaminaPro')
      icons_dir = File.join(__dir__, 'icons')

      # 1. Estudio Espacial & Grilla Modular
      cmd_base = UI::Command.new('Estudio Espacial') { abrir_dialogo_principal('hub-espacio') }
      cmd_base.tooltip = 'Estudio Espacial y Grilla Modular (W, H, D)'
      cmd_base.status_bar_text = 'Diseña muebles modulares y matrices en 3 zonas verticales'
      cmd_base.small_icon = File.join(icons_dir, 'mod_base_16.png')
      cmd_base.large_icon = File.join(icons_dir, 'mod_base_24.png')
      toolbar.add_item(cmd_base)

      # 2. Modificar Módulo Seleccionado
      cmd_edit = UI::Command.new('Editar Módulo') { Controller.editar_modulo_seleccionado }
      cmd_edit.tooltip = 'Editar Módulo Paramétrico en Tiempo Real'
      cmd_edit.status_bar_text = 'Ajusta cotas milimétricas del mueble seleccionado'
      cmd_edit.small_icon = File.join(icons_dir, 'mod_edit_16.png')
      cmd_edit.large_icon = File.join(icons_dir, 'mod_edit_24.png')
      toolbar.add_item(cmd_edit)

      toolbar.add_separator

      # 3. Ingeniería de Frentes, Mecanismos y Fondos
      cmd_frentes = UI::Command.new('Frentes y Fondos') { abrir_dialogo_principal('hub-frentes') }
      cmd_frentes.tooltip = 'Frentes, Cajoneras, Fondos y Luces'
      cmd_frentes.status_bar_text = 'Montaje exterior/medio/interior, correderas y amarres traseros a 18mm'
      cmd_frentes.small_icon = File.join(icons_dir, 'cajones_16.png')
      cmd_frentes.large_icon = File.join(icons_dir, 'cajones_24.png')
      toolbar.add_item(cmd_frentes)

      # 4. Inspección Técnica y Cinemática 3D
      cmd_cinematica = UI::Command.new('Cinemática 3D') { abrir_dialogo_principal('hub-inspeccion') }
      cmd_cinematica.tooltip = 'Simulación de Apertura y Cotas 3D'
      cmd_cinematica.status_bar_text = 'Abrir puertas y cajones al 80% y validar cotas internas'
      cmd_cinematica.small_icon = File.join(icons_dir, 'puertas_16.png')
      cmd_cinematica.large_icon = File.join(icons_dir, 'puertas_24.png')
      toolbar.add_item(cmd_cinematica)

      toolbar.add_separator

      # 5. Catálogo de Melaminas, RH y Tapacantos
      cmd_material = UI::Command.new('Materiales y Cantos') { abrir_dialogo_principal('hub-materiales') }
      cmd_material.tooltip = 'Catálogo Pelíkano, Vesto, Melamina RH y Cantos'
      cmd_material.status_bar_text = 'Gestión de tableros estándar vs RH y propuesta automática de tapacantos'
      cmd_material.small_icon = File.join(icons_dir, 'materiales_16.png')
      cmd_material.large_icon = File.join(icons_dir, 'materiales_24.png')
      toolbar.add_item(cmd_material)

      # 6. Despiece Industrial, Optimización 2D y Costos
      cmd_despiece = UI::Command.new('Despiece y Optimización') { abrir_dialogo_principal('hub-despiece') }
      cmd_despiece.tooltip = 'Despiece Industrial, Optimización 2D y Costos'
      cmd_despiece.status_bar_text = 'Cálculo de corte neto, peso del mueble, optimizador 2D y exportaciones'
      cmd_despiece.small_icon = File.join(icons_dir, 'despiece_16.png')
      cmd_despiece.large_icon = File.join(icons_dir, 'despiece_24.png')
      toolbar.add_item(cmd_despiece)

      toolbar.add_separator

      # 7. Etiquetado de Piezas para Taller
      cmd_etiquetas = UI::Command.new('Etiquetar') { Controller.etiquetar_piezas_seleccionadas }
      cmd_etiquetas.tooltip = 'Etiquetar Piezas para Armado en Taller'
      cmd_etiquetas.status_bar_text = 'Asigna identificadores y etiquetas de producción a cada pieza'
      cmd_etiquetas.small_icon = File.join(icons_dir, 'etiquetas_16.png')
      cmd_etiquetas.large_icon = File.join(icons_dir, 'etiquetas_24.png')
      toolbar.add_item(cmd_etiquetas)

      toolbar.restore if toolbar.get_last_state == TB_VISIBLE
      toolbar
    end

    # ==========================================================================
    # Método: inicializar_menus
    # Descripción: Añade las opciones organizadas al menú superior 'Plugins'.
    # ==========================================================================
    def inicializar_menus
      menu = UI.menu('Plugins').add_submenu('JPQMelaminaPro')
      menu.add_item('1. Estudio Espacial & Grilla Modular') { abrir_dialogo_principal('hub-espacio') }
      menu.add_item('2. Frentes, Mecanismos y Fondos') { abrir_dialogo_principal('hub-frentes') }
      menu.add_item('3. Inspección Técnica y Cinemática 3D') { abrir_dialogo_principal('hub-inspeccion') }
      menu.add_item('4. Melaminas, RH y Tapacantos') { abrir_dialogo_principal('hub-materiales') }
      menu.add_item('5. Despiece Oficial y Optimización 2D') { abrir_dialogo_principal('hub-despiece') }
      menu.add_separator
      menu.add_item('Simular Apertura (Abrir / Cerrar Todo)') do
        KinematicsEngine.alternar_apertura('alternar')
      end
      menu.add_item('Alternar Cotas Técnicas 3D') do
        capa = Sketchup.active_model.layers['JPQ_Cotas_Tecnicas']
        nuevo_val = capa ? !capa.visible? : true
        KinematicsEngine.alternar_cotas_3d(nuevo_val)
      end
      menu.add_separator
      menu.add_item('Recargar Código (Hot Reload)') do
        recargar_modulos_en_caliente
        UI.messagebox("Todos los módulos de JPQMelaminaPro v#{PLUGIN_VERSION} fueron recargados en memoria exitosamente.")
      end
      menu.add_item('Acerca de JPQMelaminaPro') do
        UI.messagebox("JPQMelaminaPro v#{PLUGIN_VERSION}\nSuite paramétrica industrial de carpintería y despiece milimétrico.")
      end
    end

    # ==========================================================================
    # Método: recargar_modulos_en_caliente
    # ==========================================================================
    def recargar_modulos_en_caliente
      Dir[File.join(__dir__, '{core,optimizer,exporters}', '*.rb')].each do |archivo|
        load archivo
      end
      load File.join(__dir__, 'controller.rb')
    end
  end

  unless file_loaded?(__FILE__)
    crear_barra_herramientas
    inicializar_menus
    file_loaded(__FILE__)
  end
end
