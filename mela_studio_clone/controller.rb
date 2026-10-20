# ==============================================================================
# Archivo: mela_studio_clone/controller.rb
# Descripción: Controlador central de eventos y despachador de peticiones.
#              Recibe las llamadas de JavaScript desde el UI::HtmlDialog,
#              ejecuta la lógica de negocio correspondiente en Ruby y responde a la interfaz.
# ==============================================================================

require 'json'

module MelaStudioClone
  class Controller
    class << self
      # ========================================================================
      # Método: registrar_callbacks
      # Descripción: Enlaza los métodos de acción de JavaScript con la API de Ruby.
      # Parámetros:
      #   - dialog (UI::HtmlDialog): Instancia del diálogo activo.
      # ========================================================================
      def registrar_callbacks(dialog)
        # 1. Crear nuevo módulo paramétrico
        dialog.add_action_callback('crearModulo') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = CabinetBuilder.build(params)
          responder_js(dialog, 'onModuloCreado', resultado)
        end

        # 2. Actualizar módulo existente (Edición paramétrica no destructiva)
        dialog.add_action_callback('actualizarModulo') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = ParametricModifier.update(params)
          responder_js(dialog, 'onModuloActualizado', resultado)
        end

        # 3. Obtener datos del módulo seleccionado en pantalla
        dialog.add_action_callback('obtenerModuloSeleccionado') do |_ctx, _params|
          datos = ParametricModifier.leer_seleccion
          responder_js(dialog, 'onModuloSeleccionado', datos)
        end

        # 4. Insertar repisas o divisiones interiores
        dialog.add_action_callback('aplicarRepisas') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = InteriorDivider.apply(params)
          responder_js(dialog, 'onRepisasAplicadas', resultado)
        end

        # 5. Insertar cajonera con holguras de correderas
        dialog.add_action_callback('insertarCajonera') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = DrawerBuilder.build(params)
          responder_js(dialog, 'onCajoneraCreada', resultado)
        end

        # 6. Configurar fondo MDF 3mm y ranuras
        dialog.add_action_callback('configurarFondo') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = GrooveManager.apply(params)
          responder_js(dialog, 'onFondoConfigurado', resultado)
        end

        # 7. Asignar tapacantos y calcular medida neta de corte
        dialog.add_action_callback('aplicarTapacantos') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = EdgetapeManager.apply(params)
          responder_js(dialog, 'onTapacantosAplicados', resultado)
        end

        # 8. Insertar mecanizados de ensamble (Minifix, tarugos, tornillos)
        dialog.add_action_callback('aplicarMecanizados') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = MachiningEngine.apply(params)
          responder_js(dialog, 'onMecanizadosAplicados', resultado)
        end

        # 9. Asignar material, color y sentido de veta
        dialog.add_action_callback('aplicarMaterial') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = MaterialManager.apply(params)
          responder_js(dialog, 'onMaterialAplicado', resultado)
        end

        # 10. Generar puertas batientes o frentes
        dialog.add_action_callback('generarPuertas') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = DoorsBuilder.build(params)
          responder_js(dialog, 'onPuertasGeneradas', resultado)
        end

        # 11. Extraer lista completa de despiece para cotización y taller
        dialog.add_action_callback('extraerDespiece') do |_ctx, params_json|
          opciones = params_json.empty? ? {} : JSON.parse(params_json)
          lista = CutlistExtractor.extract(opciones)
          responder_js(dialog, 'onDespieceExtraido', lista)
        end

        # 12. Optimizar corte de tableros 2D (Guillotina)
        dialog.add_action_callback('optimizarCorte') do |_ctx, params_json|
          params = JSON.parse(params_json)
          resultado = GuillotinePacker.pack(params)
          responder_js(dialog, 'onCorteOptimizado', resultado)
        end

        # 13. Exportar archivo CSV o Excel
        dialog.add_action_callback('exportarArchivo') do |_ctx, params_json|
          params = JSON.parse(params_json)
          archivo_generado = if params['formato'] == 'excel'
            ExcelExporter.export(params)
          else
            CsvExporter.export(params)
          end
          responder_js(dialog, 'onArchivoExportado', { ruta: archivo_generado })
        end
      end

      # ========================================================================
      # Método: responder_js
      # Descripción: Envía un objeto serializado en JSON como argumento a una
      #              función de respuesta en JavaScript.
      # Parámetros:
      #   - dialog (UI::HtmlDialog): Ventana donde se ejecuta el script.
      #   - funcion_js (String): Nombre de la función receptora en JS.
      #   - datos (Hash/Array): Estructura de datos Ruby a enviar.
      # ========================================================================
      def responder_js(dialog, funcion_js, datos)
        json_data = JSON.generate(datos)
        script = "window.#{funcion_js} && window.#{funcion_js}(#{json_data});"
        dialog.execute_script(script)
      end

      # ========================================================================
      # Método: editar_modulo_seleccionado
      # Descripción: Invocado desde la barra de herramientas al pulsar 'Editar Módulo'.
      #              Verifica si la selección actual contiene un módulo válido.
      # ========================================================================
      def editar_modulo_seleccionado
        datos = ParametricModifier.leer_seleccion
        if datos.nil?
          UI.messagebox("Por favor, selecciona primero un módulo creado con MelaStudio.")
        else
          MelaStudioClone.abrir_dialogo_principal('editor')
          MelaStudioClone.ejecutar_en_dialogo("window.cargarDatosEdicion && window.cargarDatosEdicion(#{JSON.generate(datos)})")
        end
      end

      # ========================================================================
      # Método: etiquetar_piezas_seleccionadas
      # Descripción: Asigna identificadores y etiquetas de taller a todas las piezas.
      # ========================================================================
      def etiquetar_piezas_seleccionadas
        conteo = Tagger.tag_selection_or_all
        UI.messagebox("Se han etiquetado #{conteo} piezas exitosamente para taller.")
      end

      # ========================================================================
      # Método: editar_pieza_individual
      # Descripción: Abre el diálogo para sobremedidas y rotación de una pieza.
      # ========================================================================
      def editar_pieza_individual
        datos = ParametricModifier.leer_pieza_individual
        if datos.nil?
          UI.messagebox("Selecciona una pieza individual (panel de melamina).")
        else
          MelaStudioClone.abrir_dialogo_principal('pieza')
          MelaStudioClone.ejecutar_en_dialogo("window.cargarPiezaIndividual && window.cargarPiezaIndividual(#{JSON.generate(datos)})")
        end
      end
    end
  end
end
