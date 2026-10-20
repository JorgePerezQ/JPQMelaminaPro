# MelaStudio PRO - Suite de Carpintería y Despiece Milimétrico para SketchUp

Clon 100% configurable, sin simulaciones ni mocks, desarrollado como una extensión nativa para **Trimble SketchUp** (API Ruby + UI interactiva moderna en `UI::HtmlDialog`). Diseñado especialmente para carpinteros, fabricantes de muebles de melamina y talleres de producción.

---

## 🌟 Características Principales

- **Precisión Milimétrica Real**: Todas las dimensiones y cálculos espaciales se procesan internamente con la unidad nativa `.mm` de la API de SketchUp, garantizando cero desfases por redondeo flotante.
- **100% Configurable**: Sin valores fijos forzados; cada medida, luz, ranura, holgura de corredera o espesor de tapacanto puede ajustarse libremente.
- **Barra Flotante con 12 Herramientas**: Integrada directamente en el espacio de trabajo de SketchUp.
- **Edición No Destructiva**: Permite reabrir y modificar cualquier módulo previamente creado conservando su rotación y ubicación en la escena.
- **Reglas Automáticas de Taller**:
  - **Descuento de Tapacantos**: Descuenta milimétricamente el grosor de los cantos (0.45 mm, 1 mm, 2 mm, 3 mm) en $L_1, L_2, A_1, A_2$ para entregar la **medida neta de corte**.
  - **Fondos enranurados**: Generación paramétrica de ranura estándar ($4\times 8\text{ mm}$ a $18\text{ mm}$ del borde posterior) con fondo MDF de 3 mm ajustado con tolerancia térmica.
  - **Cajoneras y Correderas**: Descuento automático estándar de $26\text{ mm}$ ($13\text{ mm}$ por lado) para correderas telescópicas y luces perimetrales de 3 mm.
  - **Puertas Batientes**: Cálculo automático de luces de 2 a 3 mm y cazoletas de $\varnothing 35\text{ mm}$.
- **Optimizador de Corte 2D Guillotina**: Algoritmo real de *Guillotine Bin-Packing* con consideración de kerf de sierra (4 mm), refilado perimetral (10 mm), sentido de veta y visualizador interactivo en HTML5 `<canvas>`.
- **Exportación Comercial Directa**: Formatos listos para importar en tiendas de corte como **Pelíkano, Masisa, Sodimac, Promart** y hojas de cálculo para Excel.
- **Soporte de Temas**: Interfaz adaptativa con modos **Claro**, **Oscuro** y **Taller Madera**.

---

## 📁 Estructura del Proyecto

```plaintext
clon/
├── mela_studio_clone.rb            # Registrador oficial de la extensión de SketchUp
├── mela_studio_pro_clone.rbz       # Instalador empaquetado para SketchUp
├── package_extension.py            # Script empaquetador ZIP/RBZ
├── package_extension.rb            # Script empaquetador nativo Ruby
├── mela_studio_clone/
│   ├── main.rb                     # Barra de 12 iconos, menús y UI::HtmlDialog
│   ├── controller.rb               # Despachador de eventos JS <-> Ruby
│   ├── core/
│   │   ├── cabinet_builder.rb      # Motor geométrico 3D milimétrico (.mm)
│   │   ├── parametric_modifier.rb  # Modificación no destructiva de módulos
│   │   ├── interior_divider.rb     # Repisas equidistantes y parantes verticales
│   │   ├── drawer_builder.rb       # Cajonera con holguras de correderas (26mm)
│   │   ├── groove_manager.rb       # Fondos enranurados (4x8mm) y sobrepuestos
│   │   ├── edgetape_manager.rb     # Asignador de cantos y cálculo de medida neta
│   │   ├── machining_engine.rb     # Perforaciones Minifix (15mm), tarugos y tornillos
│   │   ├── material_manager.rb     # Catálogo de melaminas y control de veta
│   │   ├── doors_builder.rb        # Puertas batientes con luces y cazoletas
│   │   ├── tagger.rb               # Identificadores secuenciales para taller
│   │   └── cutlist_extractor.rb    # Consolidador de despiece y cálculo de m² y metros
│   ├── optimizer/
│   │   └── guillotine_packer.rb    # Algoritmo de optimización 2D guillotina
│   ├── exporters/
│   │   ├── csv_exporter.rb         # CSV para Pelíkano, Masisa, Sodimac, Promart
│   │   └── excel_exporter.rb       # Reporte XML Spreadsheet 2003 para Excel
│   ├── icons/                      # 24 iconos PNG (16x16 y 24x24) para la toolbar
│   └── web/                        # Interfaz gráfica adaptativa para UI::HtmlDialog
│       ├── index.html              # Ventana principal multipestaña
│       ├── css/styles.css          # Estilos tipo PrimeNG (Claro/Oscuro/Taller)
│       └── js/
│           ├── app.js              # Controlador cliente y bridge con SketchUp
│           └── optimizer_canvas.js # Renderizador de diagramas de corte 2D
└── documentos/                     # Especificaciones y documento PDF de referencia
```

---

## 🚀 Instalación en SketchUp

### Método 1: Archivo `.rbz` (Recomendado)
1. Abre **SketchUp**.
2. Dirígete al menú superior: `Extensiones` > `Administrador de extensiones` (o `Ventana` > `Administrador de extensiones`).
3. Haz clic en el botón **Instalar extensión...** en la esquina inferior izquierda.
4. Selecciona el archivo:
   ```plaintext
   /home/jorge/_desarrollo/clon/mela_studio_pro_clone.rbz
   ```
5. ¡Listo! Aparecerá de inmediato la barra flotante con los 12 iconos y el menú `Plugins` > `MelaStudio PRO`.

### Método 2: Enlace directo en carpeta de Plugins (Modo Desarrollo)
Copia o crea un enlace simbólico de `mela_studio_clone.rb` y la carpeta `mela_studio_clone/` dentro de tu directorio de plugins de SketchUp:
- **Windows**: `%AppData%\SketchUp\SketchUp 202X\SketchUp\Plugins\`
- **Linux (Wine)**: `~/.wine/drive_c/users/<usuario>/AppData/Roaming/SketchUp/SketchUp 202X/SketchUp/Plugins/`
- **macOS**: `~/Library/Application Support/SketchUp 202X/SketchUp/Plugins/`

---

## 🛠️ Las 12 Herramientas de la Barra Flotante

1. **Crear Módulo Base**: Módulos bajos, aéreos, torres o libreros con cotas milimétricas, zócalos y amarres.
2. **Editar Módulo**: Reabre el módulo seleccionado y muta sus medidas sin redibujar.
3. **Repisas y Parantes**: Distribución equidistante o por cota fija, con retroceso frontal para puertas.
4. **Insertar Cajonera**: Genera de 2 a 4 cajones con holguras de 26 mm para correderas y fondos de 3 mm.
5. **Fondo y Ranurado**: Alterna entre fondo ranurado ($4\times 8\text{ mm}$ a $18\text{ mm}$) o sobrepuesto clavado.
6. **Asignador de Tapacantos**: Selector interactivo de bordes con cálculo inmediato de medida neta.
7. **Mecanizados de Ensamble**: Perforaciones estandarizadas Minifix (caja $\varnothing 15\text{ mm}$), tarugos ($\varnothing 8\text{ mm}$) y soberbios.
8. **Gestor de Materiales**: Melaminas lisas y maderadas con restricción de rotación por veta.
9. **Puertas y Frentes**: Puertas batientes (1 o 2 hojas) con luces de $2\text{ a }3\text{ mm}$ y cazoletas de $\varnothing 35\text{ mm}$.
10. **Etiquetado de Piezas**: Rotulación secuencial (`PZA-001`, `PZA-002`) para control de ensamble en taller.
11. **Editar Pieza Individual**: Modificación de atributos particulares (sobredimensiones para refiles en obra).
12. **Despiece y Optimización 2D**: Extracción de lista de corte, cálculo de metros lineales de canto, optimización guillotina y exportación directa a Excel y CSV.

---

## 📐 Fórmulas de Taller Integradas

- **Medida Neta de Corte**:
  $$\text{Largo Neto} = \text{Largo Bruto} - (Canto\ L_1 + Canto\ L_2)$$
  $$\text{Ancho Neto} = \text{Ancho Bruto} - (Canto\ A_1 + Canto\ A_2)$$
- **Fondo enranurado (MDF 3 mm)**:
  $$\text{Ancho Fondo} = \text{Ancho Interno} + (2 \times \text{Profundidad Ranura}) - 2\text{ mm}$$
  $$\text{Alto Fondo} = \text{Alto Interno} + (2 \times \text{Profundidad Ranura}) - 2\text{ mm}$$
- **Ancho Exterior de Cajón (Correderas Telescópicas)**:
  $$\text{Ancho Exterior Caja} = \text{Ancho Interno Vano} - 26\text{ mm}$$
