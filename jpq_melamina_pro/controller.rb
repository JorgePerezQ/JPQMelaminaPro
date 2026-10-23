# ==============================================================================
# Archivo: jpq_melamina_pro/controller.rb
# Descripción: Controlador central de eventos y despachador de peticiones.
#              Enlaza las llamadas de JavaScript (UI::HtmlDialog) con la API Ruby:
#              - Construcción de módulos base y matrices modulares (N columnas x 3 zonas)
#              - Simulación cinemática (abrir/cerrar puertas y cajones) y cotas 3D
#              - Gestión de perfiles y ADN técnico (CRUD en JSON)
#              - Fondos con ranura a 18mm y amarres traseros de melamina
#              - Mecanizados eléctricos (perfiles LED, dicroicos y pasacables)
#              - Despiece industrial, optimización 2D y exportaciones oficiales
# ==============================================================================

require 'sketchup.rb'
require 'json'

# Carga de módulos core
require_relative 'core/cabinet_builder'
require_relative 'core/spatial_matrix_builder'
require_relative 'core/kinematics_engine'
require_relative 'core/profile_manager'
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
  class Controller
    class << self
      # ========================================================================
      # Método: registrar_callbacks
      # Descripción: Enlaza todas las acciones de JavaScript con los módulos de Ruby.
      # Parámetros:
      #   - dialog (UI::HtmlDialog): Instancia del diálogo activo.
      # ========================================================================
      # Helper para parsear de forma segura parámetros provenientes de UI::HtmlDialog
      def parsear_json(datos)
        return {} if datos.nil?
        return datos if datos.is_a?(Hash) || datos.is_a?(Array)
        JSON.parse(datos.to_s)
      rescue => e
        puts "[JPQMelaminaPro] Error al parsear JSON: #{e.message}"
        {}
      end

      def registrar_callbacks(dialog)
        # --- HUB 1: ESTUDIO ESPACIAL & MATRIZ MODULAR ---
        dialog.add_action_callback('crearModulo') do |_ctx, params_json|
          params = parsear_json(params_json)
          resultado = CabinetBuilder.build(params)
          responder_js(dialog, 'onModuloCreado', resultado)
        end

        dialog.add_action_callback('generarMatrizModular') do |_ctx, params_json|
          params = parsear_json(params_json)
          resultado = SpatialMatrixBuilder.build_matrix(params)
          responder_js(dialog, 'onMatrizCreada', resultado)
        end

        dialog.add_action_callback('construirComposicionModular') do |_ctx, params_json|
          params = parsear_json(params_json)
          resultado = SpatialMatrixBuilder.construir_modulos_parametricos(params)
          responder_js(dialog, 'onComposicionModularCreada', resultado)
        end

        # --- GESTOR DE ADN TÉCNICO Y PERFILES (CRUD) ---
        dialog.add_action_callback('obtenerPerfilesUsuario') do |_ctx, _params|
          perfiles = ProfileManager.obtener_perfiles
          responder_js(dialog, 'onPerfilesObtenidos', perfiles)
        end

        dialog.add_action_callback('guardarPerfilUsuario') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = ProfileManager.guardar_perfil(params)
          responder_js(dialog, 'onPerfilGuardado', resultado)
        end

        dialog.add_action_callback('eliminarPerfilUsuario') do |_ctx, perfil_id|
          resultado = ProfileManager.eliminar_perfil(perfil_id)
          responder_js(dialog, 'onPerfilEliminado', resultado)
        end

        dialog.add_action_callback('restaurarPerfilesFabrica') do |_ctx, _params|
          resultado = ProfileManager.restaurar_perfiles_fabrica
          responder_js(dialog, 'onPerfilesRestaurados', resultado)
        end

        # --- HUB 2: INGENIERÍA DE FRENTES, HERRAJES Y FONDO ---
        dialog.add_action_callback('insertarCajonera') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = DrawerBuilder.build(params)
          responder_js(dialog, 'onCajoneraCreada', resultado)
        end

        dialog.add_action_callback('generarPuertas') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = DoorsBuilder.build(params)
          responder_js(dialog, 'onPuertasGeneradas', resultado)
        end

        dialog.add_action_callback('configurarFondo') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = GrooveManager.apply(params)
          responder_js(dialog, 'onFondoConfigurado', resultado)
        end

        dialog.add_action_callback('aplicarRanuraLed') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = ElectricalEngine.apply_led_groove(params)
          responder_js(dialog, 'onLedAplicado', resultado)
        end

        dialog.add_action_callback('aplicarDicroicos') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = ElectricalEngine.apply_downlights(params)
          responder_js(dialog, 'onDicroicosAplicados', resultado)
        end

        dialog.add_action_callback('aplicarCaladoElectrico') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = ElectricalEngine.apply_outlets_and_cables(params)
          responder_js(dialog, 'onCaladoElectricoAplicado', resultado)
        end

        # --- HUB 3: INSPECCIÓN TÉCNICA Y CINEMÁTICA 3D ---
        dialog.add_action_callback('alternarAperturaCinematica') do |_ctx, estado|
          resultado = KinematicsEngine.alternar_apertura(estado)
          responder_js(dialog, 'onAperturaCinematica', resultado)
        end

        dialog.add_action_callback('alternarCotasInternas') do |_ctx, visible_flag|
          mostrar = (visible_flag == true || visible_flag.to_s == 'true')
          resultado = KinematicsEngine.alternar_cotas_3d(mostrar)
          responder_js(dialog, 'onCotasAlternadas', resultado)
        end

        # --- HUB 4: MATERIALES, MELAMINA RH Y TAPACANTOS ---
        dialog.add_action_callback('obtenerCatalogoMateriales') do |_ctx, _params|
          catalogo = MaterialManager.obtener_catalogo
          responder_js(dialog, 'onCatalogoMateriales', catalogo)
        end

        dialog.add_action_callback('obtenerMaterialesBandeja') do |_ctx, _params|
          materiales = MaterialManager.obtener_materiales_de_bandeja(Sketchup.active_model)
          responder_js(dialog, 'onMaterialesBandejaObtenidos', materiales)
        end

        dialog.add_action_callback('obtenerMaterialActivoBandeja') do |_ctx, _params|
          resultado = MaterialManager.obtener_material_activo_bandeja(Sketchup.active_model)
          responder_js(dialog, 'onMaterialActivoBandeja', resultado)
        end

        dialog.add_action_callback('obtenerMaterialSeleccion3D') do |_ctx, _params|
          resultado = MaterialManager.obtener_material_seleccion(Sketchup.active_model)
          responder_js(dialog, 'onMaterialSeleccion3D', resultado)
        end

        dialog.add_action_callback('aplicarMaterial') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = MaterialManager.aplicar_materiales_a_modelo(params, Sketchup.active_model)
          responder_js(dialog, 'onMaterialAplicado', resultado)
        end

        dialog.add_action_callback('aplicarTapacantos') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = EdgetapeManager.apply(params)
          responder_js(dialog, 'onTapacantosAplicados', resultado)
        end

        dialog.add_action_callback('proponerTapacantos') do |_ctx, nombre_pieza|
          propuesta = MaterialManager.proponer_tapacantos_pieza(nombre_pieza)
          responder_js(dialog, 'onPropuestaTapacantos', propuesta)
        end

        # --- HUB 5: DESPIECE, OPTIMIZADOR 2D Y EXPORTACIÓN ---
        dialog.add_action_callback('extraerDespiece') do |_ctx, params_json|
          opciones = params_json.nil? || params_json.empty? ? {} : JSON.parse(params_json)
          lista = CutlistExtractor.extract(opciones)
          responder_js(dialog, 'onDespieceExtraido', lista)
        end

        dialog.add_action_callback('optimizarCorte') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = GuillotinePacker.pack(params)
          responder_js(dialog, 'onCorteOptimizado', resultado)
        end

        dialog.add_action_callback('exportarArchivo') do |_ctx, params_json|
          params = JSON.parse(params_json)
          archivo_generado = if params['formato'] == 'excel'
                               ExcelExporter.export(params)
                             else
                               CsvExporter.export(params)
                             end
          responder_js(dialog, 'onArchivoExportado', { 'ruta' => archivo_generado })
        end

        # --- ACCIONES GENERALES Y EDICIÓN RÁPIDA ---
        dialog.add_action_callback('obtenerModuloSeleccionado') do |_ctx, _params|
          datos = ParametricModifier.leer_seleccion
          responder_js(dialog, 'onModuloSeleccionado', datos)
        end

        dialog.add_action_callback('actualizarModulo') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = ParametricModifier.update(params)
          responder_js(dialog, 'onModuloActualizado', resultado)
        end

        dialog.add_action_callback('aplicarRepisas') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = InteriorDivider.apply(params)
          responder_js(dialog, 'onRepisasAplicadas', resultado)
        end

        dialog.add_action_callback('aplicarMecanizados') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = MachiningEngine.apply(params)
          responder_js(dialog, 'onMecanizadosAplicados', resultado)
        end
      end

      # ========================================================================
      # Método: responder_js
      # Descripción: Serializa los datos en JSON y los envía de retorno a JS.
      # ========================================================================
      def responder_js(dialog, funcion_js, datos)
        json_data = JSON.generate(datos)
        script = "window.#{funcion_js} && window.#{funcion_js}(#{json_data});"
        dialog.execute_script(script)
      end

      # ========================================================================
      # Métodos de acceso rápido desde la barra de herramientas de SketchUp
      # ========================================================================
      def editar_modulo_seleccionado
        datos = ParametricModifier.leer_seleccion
        if datos.nil?
          UI.messagebox("Por favor, selecciona primero un módulo creado con JPQMelaminaPro.")
        else
          JPQMelaminaPro.abrir_dialogo_principal('hub-espacio')
          JPQMelaminaPro.ejecutar_en_dialogo("window.cargarDatosEdicion && window.cargarDatosEdicion(#{JSON.generate(datos)})")
        end
      end

      def etiquetar_piezas_seleccionadas
        conteo = Tagger.tag_selection_or_all
        UI.messagebox("Se han etiquetado #{conteo} piezas exitosamente para taller.")
      end

      def editar_pieza_individual
        datos = ParametricModifier.leer_pieza_individual
        if datos.nil?
          UI.messagebox("Selecciona una pieza individual (panel de melamina).")
        else
          JPQMelaminaPro.abrir_dialogo_principal('hub-materiales')
        end
      end
    end
  end
end
