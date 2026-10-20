# ==============================================================================
# Archivo: mela_studio_clone/main.rb
# Descripción: Inicializador principal de la barra de herramientas (12 iconos),
#              menús y configuración de la interfaz gráfica UI::HtmlDialog.
# ==============================================================================

require 'sketchup.rb'
require 'json'

# Carga de módulos auxiliares y controladores
require_relative 'controller'
require_relative 'core/cabinet_builder'
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

module MelaStudioClone
  # Referencia global a la ventana principal UI::HtmlDialog
  @main_dialog = nil

  # Diccionario base para almacenar metadatos de carpintería en entidades
  DICT_NAME = 'DespieceMela'.freeze

  class << self
    # ==========================================================================
    # Método: abrir_dialogo_principal
    # Descripción: Abre o enfoca la ventana interactiva HTML5/JS del plugin.
    #              Configura callbacks bidireccionales con SketchUp.
    # Parámetros:
    #   - vista_inicial (String): Pestaña o módulo a activar al abrir (ej. 'crear', 'despiece')
    # ==========================================================================
    def abrir_dialogo_principal(vista_inicial = 'creador')
      if @main_dialog && @main_dialog.visible?
        @main_dialog.bring_to_front
        ejecutar_en_dialogo("window.cambiarPestana && window.cambiarPestana('#{vista_inicial}')")
        return
      end

      # Configuración de propiedades de la ventana HtmlDialog
      dialog_options = {
        dialog_title: 'MelaStudio PRO - Suite de Carpintería',
        preferences_key: 'com.melastudio.pro.maindialog',
        scrollable: true,
        resizable: true,
        width: 520,
        height: 780,
        min_width: 440,
        min_height: 600,
        style: UI::HtmlDialog::STYLE_DIALOG
      }

      @main_dialog = UI::HtmlDialog.new(dialog_options)
      html_file = File.join(__dir__, 'web', 'index.html')
      @main_dialog.set_file(html_file)

      # Conectar el controlador central de acciones
      Controller.registrar_callbacks(@main_dialog)

      # Cuando el DOM esté listo, seleccionar la vista solicitada
      @main_dialog.add_action_callback('domListo') do |_context, _params|
        ejecutar_en_dialogo("window.cambiarPestana && window.cambiarPestana('#{vista_inicial}')")
      end

      @main_dialog.show
    end

    # ==========================================================================
    # Método: ejecutar_en_dialogo
    # Descripción: Ejecuta una instrucción JavaScript dentro de la ventana activa.
    # Parámetros:
    #   - script_js (String): Cadena de código JavaScript a ejecutar.
    # ==========================================================================
    def ejecutar_en_dialogo(script_js)
      return unless @main_dialog && @main_dialog.visible?
      @main_dialog.execute_script(script_js)
    end

    # ==========================================================================
    # Método: crear_barra_herramientas
    # Descripción: Construye la barra de herramientas flotante con los 12 iconos
    #              del flujo de trabajo de carpintería y despiece.
    # ==========================================================================
    def crear_barra_herramientas
      toolbar = UI::Toolbar.new('MelaStudio PRO')
      icons_dir = File.join(__dir__, 'icons')

      # 1. Generador de Módulos Base
      cmd_base = UI::Command.new('Crear Módulo') { abrir_dialogo_principal('creador') }
      cmd_base.tooltip = 'Crear Módulo Base Paramétrico'
      cmd_base.status_bar_text = 'Diseña un módulo con cotas milimétricas (bajo, aéreo, torre, librero)'
      cmd_base.small_icon = File.join(icons_dir, 'mod_base_16.png')
      cmd_base.large_icon = File.join(icons_dir, 'mod_base_24.png')
      toolbar.add_item(cmd_base)

      # 2. Modificar Módulo Seleccionado
      cmd_edit = UI::Command.new('Editar Módulo') { Controller.editar_modulo_seleccionado }
      cmd_edit.tooltip = 'Editar Módulo Paramétrico'
      cmd_edit.status_bar_text = 'Modifica dimensiones del módulo seleccionado sin redibujarlo'
      cmd_edit.small_icon = File.join(icons_dir, 'mod_edit_16.png')
      cmd_edit.large_icon = File.join(icons_dir, 'mod_edit_24.png')
      toolbar.add_item(cmd_edit)

      toolbar.add_separator

      # 3. División Interior / Repisas
      cmd_repisas = UI::Command.new('Repisas y Parantes') { abrir_dialogo_principal('repisas') }
      cmd_repisas.tooltip = 'División Interior (Repisas y Parantes)'
      cmd_repisas.status_bar_text = 'Agrega repisas fijas, móviles o parantes equidistantes'
      cmd_repisas.small_icon = File.join(icons_dir, 'repisas_16.png')
      cmd_repisas.large_icon = File.join(icons_dir, 'repisas_24.png')
      toolbar.add_item(cmd_repisas)

      # 4. Cajoneras y Correderas
      cmd_cajones = UI::Command.new('Cajonera') { abrir_dialogo_principal('cajones') }
      cmd_cajones.tooltip = 'Insertar Cajonera'
      cmd_cajones.status_bar_text = 'Inserta cajones con holguras de correderas (26mm) ya calculadas'
      cmd_cajones.small_icon = File.join(icons_dir, 'cajones_16.png')
      cmd_cajones.large_icon = File.join(icons_dir, 'cajones_24.png')
      toolbar.add_item(cmd_cajones)

      toolbar.add_separator

      # 5. Ranuras y Fondo MDF
      cmd_ranura = UI::Command.new('Fondo y Ranurado') { abrir_dialogo_principal('ranura') }
      cmd_ranura.tooltip = 'Configurar Fondo MDF y Ranurado'
      cmd_ranura.status_bar_text = 'Configura fondo enranurado (4x8mm a 18mm) o clavado'
      cmd_ranura.small_icon = File.join(icons_dir, 'ranuras_16.png')
      cmd_ranura.large_icon = File.join(icons_dir, 'ranuras_24.png')
      toolbar.add_item(cmd_ranura)

      # 6. Asignador de Tapacantos
      cmd_cantos = UI::Command.new('Tapacantos') { abrir_dialogo_principal('cantos') }
      cmd_cantos.tooltip = 'Asignar Tapacantos y Descuentos'
      cmd_cantos.status_bar_text = 'Aplica canto delgado (0.45mm) o grueso (1/2/3mm) con descuento a corte neto'
      cmd_cantos.small_icon = File.join(icons_dir, 'tapacantos_16.png')
      cmd_cantos.large_icon = File.join(icons_dir, 'tapacantos_24.png')
      toolbar.add_item(cmd_cantos)

      # 7. Mecanizado y Perforaciones
      cmd_perforaciones = UI::Command.new('Mecanizados') { abrir_dialogo_principal('mecanizados') }
      cmd_perforaciones.tooltip = 'Mecanizado (Minifix, Tarugos, Soberbios)'
      cmd_perforaciones.status_bar_text = 'Aplica perforaciones para ensamble Minifix (15mm), tarugos y tornillos'
      cmd_perforaciones.small_icon = File.join(icons_dir, 'perforaciones_16.png')
      cmd_perforaciones.large_icon = File.join(icons_dir, 'perforaciones_24.png')
      toolbar.add_item(cmd_perforaciones)

      # 8. Gestor de Materiales y Vetas
      cmd_material = UI::Command.new('Materiales y Veta') { abrir_dialogo_principal('materiales') }
      cmd_material.tooltip = 'Gestor de Melaminas y Orientación de Veta'
      cmd_material.status_bar_text = 'Define color y restringe sentido de la veta para el optimizador'
      cmd_material.small_icon = File.join(icons_dir, 'materiales_16.png')
      cmd_material.large_icon = File.join(icons_dir, 'materiales_24.png')
      toolbar.add_item(cmd_material)

      toolbar.add_separator

      # 9. Puertas y Tapas de Cajón
      cmd_puertas = UI::Command.new('Puertas') { abrir_dialogo_principal('puertas') }
      cmd_puertas.tooltip = 'Generar Puertas y Frentes'
      cmd_puertas.status_bar_text = 'Puertas batientes con holguras de 2-3mm y cazoletas de 35mm'
      cmd_puertas.small_icon = File.join(icons_dir, 'puertas_16.png')
      cmd_puertas.large_icon = File.join(icons_dir, 'puertas_24.png')
      toolbar.add_item(cmd_puertas)

      # 10. Etiquetado de Piezas
      cmd_etiquetas = UI::Command.new('Etiquetar') { Controller.etiquetar_piezas_seleccionadas }
      cmd_etiquetas.tooltip = 'Etiquetar Piezas para Armado'
      cmd_etiquetas.status_bar_text = 'Asigna stickers/identificadores numéricos a cada pieza'
      cmd_etiquetas.small_icon = File.join(icons_dir, 'etiquetas_16.png')
      cmd_etiquetas.large_icon = File.join(icons_dir, 'etiquetas_24.png')
      toolbar.add_item(cmd_etiquetas)

      # 11. Editar Pieza Individual
      cmd_pieza_edit = UI::Command.new('Editar Pieza') { Controller.editar_pieza_individual }
      cmd_pieza_edit.tooltip = 'Editar Propiedades de Pieza Individual'
      cmd_pieza_edit.status_bar_text = 'Aplica sobremedida para refile en obra o gira veta individualmente'
      cmd_pieza_edit.small_icon = File.join(icons_dir, 'pieza_edit_16.png')
      cmd_pieza_edit.large_icon = File.join(icons_dir, 'pieza_edit_24.png')
      toolbar.add_item(cmd_pieza_edit)

      toolbar.add_separator

      # 12. Extracción de Despiece y Optimización
      cmd_despiece = UI::Command.new('Despiece y Optimización') { abrir_dialogo_principal('despiece') }
      cmd_despiece.tooltip = 'Extraer Despiece y Optimizar Cortes'
      cmd_despiece.status_bar_text = 'Genera lista de corte para Pelíkano/Masisa/Sodimac y mapa de corte 2D'
      cmd_despiece.small_icon = File.join(icons_dir, 'despiece_16.png')
      cmd_despiece.large_icon = File.join(icons_dir, 'despiece_24.png')
      toolbar.add_item(cmd_despiece)

      toolbar.restore if toolbar.get_last_state == TB_VISIBLE
      toolbar
    end

    # ==========================================================================
    # Método: inicializar_menus
    # Descripción: Añade las opciones al menú superior 'Plugins' de SketchUp.
    # ==========================================================================
    def inicializar_menus
      menu = UI.menu('Plugins').add_submenu('MelaStudio PRO')
      menu.add_item('Abrir Panel de Control') { abrir_dialogo_principal('creador') }
      menu.add_item('Extraer Despiece a Excel / CSV') { abrir_dialogo_principal('despiece') }
      menu.add_item('Optimizar Cortes 2D (Guillotina)') { abrir_dialogo_principal('optimizador') }
      menu.add_separator
      menu.add_item('Acerca de MelaStudio PRO') do
        UI.messagebox("MelaStudio PRO v#{PLUGIN_VERSION}\nSuite paramétrica de carpintería y despiece milimétrico.")
      end
    end
  end

  # Registro único de la barra y menús al cargar el archivo
  unless file_loaded?(__FILE__)
    crear_barra_herramientas
    inicializar_menus
    file_loaded(__FILE__)
  end
end
