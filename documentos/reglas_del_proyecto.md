# JPQMelaminaPro - Manual Maestro de Reglas del Proyecto
### Reglas de Desarrollo, Reglas del Carpintero y Reglas de Diseño Industrial

---

## 📋 Introducción y Alcance

Este documento constituye la guía oficial y de referencia técnica obligatoria para el proyecto **JPQMelaminaPro**. Reúne de forma integral las directrices normativas que rigen tres pilares fundamentales del sistema:

1. **Reglas de Desarrollo de Software**: Arquitectura técnica, estándares de codificación, convenciones de ingeniería, contenedorización y buenas prácticas.
2. **Reglas del Carpintero**: Límites de rigidez estructural, fórmulas milimétricas de taller, normas anti-pandeo, tolerancias de herrajes y medidas comerciales de corte.
3. **Reglas de Diseño y Ergonomía**: Proporciones arquitectónicas por tipología y ambiente, integración lumínica/eléctrica (BIM), accesibilidad universal, experiencia de usuario (UI/UX) y el principio mandatorio de **evolución aditiva sin pérdida funcional ni supresión de código preexistente**.

---

## 💻 1. REGLAS DE DESARROLLO DE SOFTWARE

### 1.1 Stack Tecnológico Oficial
El proyecto se rige por la siguiente matriz de tecnologías según la plataforma objetivo:

| Capa / Plataforma | Tecnología Oficial | Componentes y Librerías Clave |
| :--- | :--- | :--- |
| **Frontend Web Exclusivo** | **Angular** | Arquitectura modular / Standalone, Reactive Forms, RxJS |
| **Frontend Multiplataforma** | **Flutter** | Soporte unificado para Web, Android e iOS con arquitectura limpia |
| **Componentes UI (Web)** | **PrimeNG** | Sistema de diseño base para formularios, tablas, diálogos y notificaciones |
| **Backend** | **NestJS** | Controladores, servicios, DTOs con validación estricta y Swagger |
| **Persistencia / Base de Datos** | **PostgreSQL + TypeORM** | Migraciones versionadas, entidades tipadas y repositorios |
| **Extensión Nativa 3D** | **Ruby SketchUp API** | Manejo de geometría milimétrica nativa (`.mm`), `UI::HtmlDialog` |
| **Contenedorización & CI/CD** | **Docker + OpenCloud (GCloud)** | `Dockerfile`, `docker-compose.yml`, `cloudbuild.yaml` |
| **Control de Versiones** | **Git / GitHub** | Control de ramas y exclusión rigurosa de secretos y artefactos |

---

### 1.2 Principios de Calidad de Código y Documentación
1. **Legibilidad y Comentarización Exhaustiva**:
   - Cada clase, módulo, servicio y método debe contener un encabezado descriptivo que explique:
     - El propósito del método y su contexto de negocio o carpintería.
     - Detalle de parámetros con sus tipos y rangos válidos.
     - Valor de retorno y excepciones controladas.
   - Todo archivo de código debe llevar un encabezado estandarizado identificando su ruta y función técnica dentro de la suite.
2. **Cero Números Mágicos**:
   - Todas las cotas fijas, tolerancias de ranura, holguras de correderas y límites de pandeo deben declararse como constantes legibles (ej. `DESCUENTO_CORREDERA_TELESCOPICA_MM = 26.0`, `LIMITE_PANDEO_18MM = 800`).
3. **Cero Mocks y Cálculo Milimétrico Real**:
   - No se permiten aproximaciones ni objetos ficticios. Toda pieza tridimensional debe crearse con su volumen exacto en coordenadas globales y metadatos reales de taller (largo neto, ancho neto, espesor, tapacantos $L_1, L_2, A_1, A_2$, ranura y perforaciones).
4. **Auditoría 3D de No Colisión Volumétrica (AABB)**:
   - Toda pieza añadida a la escena se audita contra las demás mediante cajas envolventes tridimensionales alineadas con los ejes (AABB).
   - Se considera colisión prohibida cualquier solapamiento o penetración volumétrica mayor a $0.5\text{ mm}$ en los 3 ejes ($X, Y, Z$), excepto las intersecciones geométricas autorizadas (ej. el alojamiento del fondo de MDF dentro de la ranura de los costados).

---

### 1.3 Sistema de Temas y Estilos Visuales
1. **Conmutación Dinámica de Temas**:
   - Toda interfaz gráfica debe soportar el cambio en caliente entre 3 modos:
     - **Tema Claro** (`claro`): Diseñado para oficinas técnicas y pantallas con iluminación natural.
     - **Tema Oscuro** (`oscuro`): Alta ergonomía visual para sesiones prolongadas de modelado.
     - **Tema Taller Madera** (`taller`): Tonos amaderados y cálidos adaptados al entorno del ebanista.
2. **Tokens CSS Centralizados**:
   - Los estilos deben estructurarse mediante variables CSS en `:root` (fondos, bordes, superficies, colores de acento, estados hover y tipografía), garantizando consistencia en todos los componentes.
3. **Diseño Adaptativo y Recursivo (Responsive & Adaptive)**:
   - Los frontends deben ser completamente fluidos, adaptándose automáticamente a pantallas de smartphones, tablets, laptops y monitores ultrawide sin pérdida de controles ni desbordes.

---

### 1.4 Docker, Cloud Build y Control de Versiones
1. **Contenedores Docker**:
   - El proyecto incluye un `Dockerfile` optimizado y un `docker-compose.yml` para reproducir fielmente el entorno de compilación, empaquetado de extensiones `.rbz` y ejecución de utilidades.
2. **Integración con OpenCloud (Google Cloud CLI)**:
   - Configuración mediante `cloudbuild.yaml` para compilar, validar y publicar releases directamente en Google Cloud Storage.
3. **Configuración de `.gitignore`**:
   - Es de carácter **obligatorio y estricto** que el archivo `.gitignore` excluya:
     - El archivo `.env` y cualquier variación (`.env.*`).
     - Las carpetas `node_modules/` de proyectos Node / Nest / Angular.
     - Temporales de sistema (`.DS_Store`, `Thumbs.db`, `Zone.Identifier`).
     - Entornos virtuales de Python (`__pycache__/`, `*.pyc`).
     - Paquetes binarios pesados no versionados.

---

## 🔨 2. REGLAS DEL CARPINTERO (CARPINTERÍA INDUSTRIAL Y TALLER)

### 2.1 Reglas Anti-Pandeo y Rigidez Estructural
El pandeo (flecha por flexión estática) es la deformación irreversible que sufre el tablero aglomerado bajo su propio peso o carga distribuida. Las normas son:

| Elemento | Espesor Melamina | Vano Máximo Libre | Norma y Acción Correctiva |
| :--- | :---: | :---: | :--- |
| **Repisas y Estantes** | **15 mm** | **700 mm** | Vano $\le 700\text{ mm}$ es estable. Si supera $700\text{ mm}$, **parante vertical obligatorio**. |
| **Repisas y Estantes** | **18 mm** | **800 mm** | Vano $\le 800\text{ mm}$ es estable. Si supera $800\text{ mm}$, **parante vertical obligatorio**. |
| **Piso y Techo de Módulo** | **15 / 18 mm** | **1000 mm** | Más de $1000\text{ mm}$ sin soporte central arquea piso y techo por gravedad. |
| **Costados Continuos** | **15 / 18 mm** | **2400 mm** | Altura máxima para laterales de una sola pieza según plancha estándar. |
| **Profundidad Mínima** | Estructural | **150 mm** | Menos de $150\text{ mm}$ no proporciona estabilidad estática contra vuelco. |
| **Profundidad Máxima** | Funcional | **650 mm** | Más de $650\text{ mm}$ dificulta alcanzar piezas al fondo y desperdicia material. |

---

### 2.2 Zócalo Sanitario Inferior y Listones de Soporte
El zócalo aísla el mueble de la humedad del piso y sirve de base niveladora.

1. **Altura Estándar**: De **70 mm a 100 mm** (permite trapear el piso sin tocar los costados del mueble).
2. **Retranqueo Frontal (Patada)**: De **35 mm a 50 mm** respecto a la línea frontal de los costados, lo que permite al usuario pararse frente al mueble sin golpear los dedos de los pies.
3. **Listones Transversales de Apoyo**:
   - Distribución proporcional en partes iguales ($N$ listones dividen el interior en $N+1$ vanos simétricos).
   - **Separación libre mínima reglamentaria**: $\ge \mathbf{150\text{ mm}}$ (para permitir el ingreso del atornillador inalámbrico durante el armado).
   - **Separación máxima reglamentaria (anti-pandeo)**: $\le \mathbf{600\text{ mm}}$ (para evitar el arqueo del piso estructural del mueble).

$$\text{Cantidad Sugerida de Listones} = \max\left(0, \left\lceil \frac{\text{Ancho Interior}}{600\text{ mm}} \right\rceil - 1\right)$$

---

### 2.3 Fondos de Mueble y Ranurado
1. **Fondo Enranurado en MDF de 3 mm**:
   - **Dimensiones de la Ranura**: Canal de **4 mm de espesor** por **8 mm de profundidad**.
   - **Distancia al Borde**: Ranura mecanizada a **18 mm del borde posterior** de costados, piso y techo.
   - **Tolerancia Térmica**: El fondo de MDF debe cortarse con **2 mm de holgura total** para absorber dilataciones térmicas e higrométricas sin pandearse:
     $$\text{Ancho Fondo MDF} = \text{Ancho Interior Vano} + (2 \times \text{Profundidad Ranura}) - 2\text{ mm}$$
     $$\text{Alto Fondo MDF} = \text{Alto Interior Vano} + (2 \times \text{Profundidad Ranura}) - 2\text{ mm}$$
2. **Fondo Sobrepuesto**:
   - Clavado o engrapado posterior directo sobre la carcasa con tornillos autorroscantes de $3.5\times 15\text{ mm}$ cada $100\text{ a }150\text{ mm}$.
3. **Fondo de Melamina (15 o 18 mm)**:
   - Obligatorio en muebles aéreos pesados o con herrajes de suspensión oculta (Camar / Italiana Ferramenta) que descargan el peso directamente al muro.
4. **Listones de Amarre Posterior**:
   - Listones de melamina de **80 a 100 mm de ancho**, orientados horizontal o verticalmente para rigidizar la escuadra del módulo y anclar al muro.

---

### 2.4 Cajoneras y Sistemas de Correderas
1. **Descuentos Estandarizados según el Tipo de Corredera**:
   - **Correderas Telescópicas Estándar**: Descuento total de **26 mm** ($13\text{ mm}$ de holgura por cada lateral).
     $$\text{Ancho Exterior Caja Cajón} = \text{Ancho Interior Vano} - 26\text{ mm}$$
   - **Correderas Ocultas Undermount (Cierre Lento / Push)**: Descuento total de **21 mm** y elevación del fondo de cajón a $14\text{ mm}$ respecto al canto inferior.
   - **Laterales Metálicos Slim Box / Tandembox**: Descuento total de **37.5 mm**.
2. **Largo Nominal de Correderas**:
   - Tamaños comerciales: **250, 300, 350, 400, 450, 500 y 550 mm**.
   - La profundidad exterior del mueble debe superar en al menos **15 a 20 mm** el largo nominal de la corredera.
3. **Límites de Ancho en Cajones**:
   - **Ancho mínimo útil**: **300 mm** (por debajo de 300 mm el cajón interior queda inutilizable tras descontar costados y correderas).
   - **Ancho mayor a 700 mm**: Requiere correderas Heavy Duty (de 45 kg de carga) y listón central de amarre inferior bajo el fondo MDF de 3 mm para evitar desfondamiento.
4. **Luces y Altura de Caja**:
   - Luz entre frentes contiguos: **2 a 3 mm**.
   - Altura de la caja interior de madera: $\text{Alto de Frente} - 40\text{ mm}$ (mínimo 70 mm).

---

### 2.5 Puertas Batientes y Herrajes
1. **Reglas Dimensionales por Hoja**:
   - **Ancho Mínimo**: **250 mm** (por debajo se fuerza el brazo de palanca de la bisagra).
   - **Ancho Máximo**: **600 mm** (si el vano supera los 600 mm, debe dividirse obligatoriamente en **2 puertas batientes** para evitar el descuelgue de tornillos).
   - **Altura Máxima Recomendada**: **2100 mm**. Para puertas entre 1800 y 2100 mm se deben colocar entre **4 y 5 bisagras** distribuidas para prevenir el alabeo del tablero.
2. **Selección de Bisagras según el Tipo de Montaje**:
   - **Montaje Exterior (Sobrepuesto / Parche completo)**: Bisagra Recta (Codo 0 mm). Cubre completamente el canto del lateral.
   - **Montaje Medio (Semi-parche / Pared compartida)**: Bisagra Codo 9 mm (Semicurva). Permite compartir un mismo lateral divisorio entre dos puertas adyacentes.
   - **Montaje Interior (Embutido)**: Bisagra Codo 18 mm (Curva alta). La puerta queda al ras dentro del vano interior.
3. **Mecanizado de Cazoleta**:
   - Diámetro de fresado: $\varnothing \mathbf{35\text{ mm}}$.
   - Profundidad de cazoleta: **11.5 a 12.0 mm**.
   - Distancia al borde del tablero ($K$): **4 a 5 mm**.

---

### 2.6 Tapacantos y Medida Neta de Corte
El despiece entregado al centro de corte debe reflejar siempre la **Medida Neta**, descontando el espesor de los cantos aplicados:

$$\text{Largo Neto} = \text{Largo Bruto} - (\text{Canto } L_1 + \text{Canto } L_2)$$
$$\text{Ancho Neto} = \text{Ancho Bruto} - (\text{Canto } A_1 + \text{Canto } A_2)$$

- **Tapacanto Delgado (0.45 mm a 0.5 mm)**: Se aplica en piezas interiores, costados no visibles, repisas fijas y fondos. Descuento nominal: $0.5\text{ mm}$ por borde.
- **Tapacanto Grueso (1.0 mm, 2.0 mm, 3.0 mm)**: Se aplica en frentes de cajón, puertas, cubiertas, frentes de repisa y frentes de zócalo. Brinda resistencia a impactos y bordes redondeados (boleados).

---

### 2.7 Límites de Seccionado y Parámetros del Optimizador 2D
1. **Seguridad en Máquinas**:
   - **Dimensión mínima admisible para corte**: **50 mm**. Cortar piezas con ancho inferior a 50 mm en escuadradoras de disco o seccionadoras industriales representa alto riesgo de accidente o fractura del material.
   - **Dimensión máxima comercial**: **2750 mm** (según el formato del tablero suministrado por Pelíkano, Masisa, Arauco o Novopan).
2. **Parámetros del Algoritmo Guillotina**:
   - **Kerf de Sierra**: Espesor de corte del disco de diamante de **4 mm**.
   - **Refilado Perimetral (Saneado)**: Descuento de **10 mm en todo el contorno** de la plancha para eliminar golpes, astillados o esquinas dañadas por transporte.
   - **Restricción de Veta**: Las piezas con textura maderada deben respetar obligatoriamente el sentido longitudinal y no pueden rotarse 90° en la optimización.

---

### 2.8 Fórmulas de Peso e Insumos de Taller
1. **Peso Estimado de Materiales**:
   - Melamina de 18 mm: $\mathbf{12.5\text{ kg/m}^2}$.
   - Melamina de 15 mm: $\mathbf{10.5\text{ kg/m}^2}$.
   - Fondo MDF de 3 mm: $\mathbf{2.5\text{ kg/m}^2}$.
2. **Cálculo de Fijaciones a Muro**:
   $$\text{Chazos / Anclajes Muro} = \max\left(4, \left\lceil \frac{\text{Peso Total Mueble (kg)}}{20} \right\rceil \times 2\right)$$
3. **Cálculo de Tornillería**:
   - Tornillos Soberbios ($4\times 50\text{ mm}$): Promedio de **4 tornillos por pieza estructural** ensamblada.
   - Tornillos de Correderas / Bisagras ($3.5\times 15\text{ mm}$): Promedio de **12 tornillos por cajón** y **4 tornillos por bisagra**.

---

## 📐 3. REGLAS DE DISEÑO, ERGONOMÍA Y ARQUITECTURA

### 3.1 Proporciones Ergonómicas por Tipología de Mueble

#### A. Cocinas Integrales
- **Módulos Bajos**:
  - Altura final mesón terminado: **850 mm a 900 mm** (ajustable según estatura del usuario).
  - Profundidad de carcasa: **580 mm** (para recibir mesón de granito, cuarzo o postformado de **600 mm**, dejando un goteo/voladizo frontal de 20 mm).
  - Zócalo sanitario: **100 mm** de altura con melamina RH (Resistente a la Humedad).
- **Módulos Aéreos**:
  - Altura de montaje: Separación libre de **500 mm a 600 mm** sobre la superficie del mesón de trabajo.
  - Profundidad máxima: **300 mm a 320 mm** (evita golpes en la frente del usuario al inclinarse sobre el mesón).
  - Puertas superiores con bisagras o pistones a gas elevables (-85°).

#### B. Baños y Vanitorios
- Muebles suspendidos / flotantes anclados a muro (despeje de 200 a 300 mm respecto al piso para facilitar aseo).
- Fabricación obligatoria en **Melamina RH 100% hidrófuga**.
- Calado en forma de **"U"** en el primer cajón o repisas centrales para librar el desagüe y sifón del lavamanos.

#### C. Clósets, Roperos y Vestidores
- **Profundidad Mínima**: **580 mm a 600 mm** (necesaria para que los ganchos de ropa queden holgados sin que las mangas rocen con las puertas).
- **Distribución Funcional de Alturas**:
  - **Maletero Superior**: Ubicado desde los **1900 mm hasta los 2400 mm** para ropa de cama y maletas.
  - **Colgado Largo (Vestidos y Abrigos)**: Vano libre vertical de **1300 mm a 1500 mm**.
  - **Colgado Corto (Camisas, Chaquetas, Pantalones)**: Vano libre vertical de **900 mm a 1050 mm**.
  - **Zapateras**: Repisas inclinadas a 20° con pestaña frontal de retención de 30 mm, o bandejas con correderas telescópicas.

#### D. Home Office, Escritorios y Battlestations Gamer
- **Altura de Cubierta**: **730 mm a 750 mm**.
- **Profundidad de Mesa**: Mínimo **600 mm**; recomendado **700 mm** para monitores grandes.
- **Espacio Libre de Piernas**: Vano inferior mínimo de **600 mm de ancho** libre de parantes o cajoneras.
- **Cubiertas Engrosadas (36 mm)**: Doble placa encolada para soportar pantallas ultrawide montadas en brazos hidráulicos pesados.
- **Cámara Pasacables Retraída**: Separación de 40 a 60 mm en el fondo para canalización de enchufes y cables sin perforaciones visibles.

#### E. Centros de TV y Entretenimiento
- Panel de fondo con separación técnica de 40 a 50 mm contra la pared para canalizaciones de HDMI, corriente y consolas.
- Módulos bajos con puertas abatibles o batientes y calados pasacables circulares de $\varnothing 60\text{ mm}$.

#### F. Diseño Inclusivo y Accesibilidad Universal
- **Mobiliario Infantil (Método Montessori)**:
  - Altura total reducida: Máximo **900 mm a 1000 mm** para autonomía total del infante.
  - Bordes redondeados y cantos gruesos de **2 mm boleados** para máxima seguridad física.
- **Adultos Mayores / Senior (Accesibilidad Universal)**:
  - Almacenamiento concentrado en la **zona de alcance seguro** (entre **450 mm y 1400 mm** del piso).
  - Eliminación de cajoneras pegadas al suelo que exijan agacharse en cuclillas y repisas altas que exijan escaleras.
  - Tiradores de asa amplia tipo C o D que permitan apertura con la mano completa sin requerir fuerza en dedos con artritis.

---

### 3.2 Integración Lumínica y Eléctrica (Mecanizados BIM)
1. **Canal para Tiras LED**:
   - Ranura continua normalizada de **17 mm de ancho por 7 mm de profundidad**, diseñada para alojar perfiles de aluminio de sobreponer/embutir con difusor opalino.
   - Ubicación estándar: A **50 mm del borde frontal** en fondos de muebles aéreos o bajo repisas flotantes.
2. **Spots Dicroicos**:
   - Perforaciones circulares de $\varnothing \mathbf{60\text{ mm}}$ o $\varnothing \mathbf{75\text{ mm}}$ en el cielo de muebles o marquesinas.
3. **Cajas de Mecanismos Eléctricos**:
   - Calado rectangular de **100 mm por 55 mm** para instalación empotrada de tomas de corriente e interruptores en paneles melamínicos.

---

### 3.3 Sentido de Veta y Armonía Visual
1. **Continuidad de Veta en Cascada**:
   - Al fabricar cajoneras en materiales maderados, las piezas de los frentes deben cortarse secuencialmente del mismo paño para conservar el dibujo de la veta continuo de arriba hacia abajo.
2. **Regla de Orientación Longitudinal**:
   - Los costados, parantes, puertas y frentes de zócalo deben llevar la veta orientada en sentido longitudinal (vertical en costados/puertas, horizontal en amarres y zócalos).

---

### 3.4 Principios UI/UX del Proyecto (Diseño de Interfaz)
1. **Experiencia de Modelado en Tres Fases**:
   - **Fase 1 (Vacío)**: Lienzo despejado al arrancar, invitando al usuario a fijar cotas globales.
   - **Fase 2 (Delineado Alámbrico)**: Al definir $W \times H \times D$, se proyecta la envolvente dimensional en tiempo real.
   - **Fase 3 (Módulos Sólidos Armados)**: Al ingresar espesor y cantidad de módulos, se materializa la estructura tridimensional con ensambles, repisas y frentes.
2. **Retroalimentación No Intrusiva con Semáforo Técnico**:
   - ⛔ **Peligro Crítico (Rojo)**: Colisiones volumétricas o anchos de módulo $< 150\text{ mm}$. Bloquea la exportación hasta su corrección.
   - ⚠️ **Advertencia Técnica (Amarillo)**: Vanos mayores a 700/800 mm con riesgo de pandeo, o cajones de más de 700 mm sin refuerzo.
   - ℹ️ **Información Aprobada (Verde/Azul)**: Estructura conforme a normas de taller y tolerancias industriales.
3. **Control Cinemático Interactivo**:
   - Apertura interactiva de cajones al 80% y rotación de puertas a 90° para auditoría visual interna de vanos antes del envío a fabricación.

---

### 3.5 Regla Fundamental de Diseño: Evolución Aditiva y Preservación Integral de Código
> [!IMPORTANT]
> **Principio Mandatorio de No Regresión y Conservación Funcional**:
> **Todo cambio, mejora o nueva característica que se solicite en el proyecto debe incluirse de manera aditiva, sin quitar ni degradar ninguna otra funcionalidad preexistente, y sin alterar, recortar ni eliminar código en archivos o secciones donde no interviene directamente el cambio solicitado.**

1. **Aditividad Estricta**: Cada modificación debe sumar o refinar capacidades existentes, nunca restar funcionalidades previamente operativas.
2. **Preservación e Integridad de Código**: Queda terminantemente prohibido suprimir, refactorizar agresivamente o alterar bloques de código, funciones o utilidades en módulos donde el requerimiento actual no tiene injerencia.
3. **Compatibilidad Hacia Atrás**: Toda configuración, módulo paramétrico, vista 3D, exportación o cálculo milimétrico diseñado previamente debe continuar funcionando sin rupturas de contrato ni desfases.

---

### 3.6 Fichas Técnicas y Catálogo Maestro de Plantillas Normalizadas de Taller

Las plantillas normalizadas condensan las directrices antropométricas, ergonómicas y estructurales de taller para permitir el modelado instantáneo y la fabricación sin desperdicio ni errores de ensamble.

#### Matriz de Plantillas Normalizadas Oficiales por Ambiente

| Ambiente | Código | Mueble / Plantilla | Ancho ($W$) | Alto ($H$) | Prof. ($D$) | Zócalo | Configuración Modular Típica |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **🍳 Cocina** | `bajo_cocina` | **Bajo Cocina Estándar** | 1800 mm | 850 mm | 600 mm | 100 mm | 3 Mód.: Cajonera ollera (3 cajones) + 2 módulos con puertas |
| **🍳 Cocina** | `aereo_cocina` | **Módulo Aéreo Superior** | 1800 mm | 700 mm | 320 mm | 0 mm | 3 Mód.: Puertas batientes o pistones (profundidad anti-golpes) |
| **🍳 Cocina** | `alacena` | **Torre Alacena / Hornos** | 600 mm | 2100 mm | 600 mm | 100 mm | 1 Columna: 4 repisas y espacio horno a 900 mm |
| **🍳 Cocina** | `isla_cocina` | **Isla / Península Central** | 1400 mm | 900 mm | 800 mm | 100 mm | 2 Mód.: Cajonera utensilios + módulo puertas |
| **🚿 Baño** | `vanitorio` | **Vanitorio Flotante RH** | 800 mm | 550 mm | 480 mm | 0 mm | 1 Mód.: Flotante a 300 mm de piso en melamina RH hidrófuga |
| **🚿 Baño** | `columna_bano` | **Columna Auxiliar Suspendida** | 400 mm | 1500 mm | 320 mm | 0 mm | 1 Mód. vertical con 3 repisas y puerta batiente |
| **🚿 Baño** | `botiquin` | **Botiquín Espejo Aéreo** | 600 mm | 700 mm | 150 mm | 0 mm | 1 Mód. compacto de 150 mm con repisas y puertas espejo |
| **📺 Sala / TV** | `centro_tv` | **Centro TV Integral con Panel** | 2000 mm | 1800 mm | 400 mm | 70 mm | 3 Mód.: 2 laterales puertas + centro repisas consolas/panel TV |
| **📺 Sala / TV** | `rack_tv_bajo` | **Rack TV Bajo / Consolas** | 1600 mm | 500 mm | 400 mm | 70 mm | 2 Mód.: Cajonera consolas + repisas receptores |
| **📺 Sala / TV** | `repisa` | **Repisa Flotante de Muro** | 1000 mm | 300 mm | 250 mm | 0 mm | 1 Mód.: Anclaje invisible o listón francés (*French Cleat*) |
| **📺 Sala / TV** | `estanteria` | **Estantería Modular Alta** | 800 mm | 1800 mm | 300 mm | 70 mm | 1 Mód.: 4 repisas fijas (límite anti-pandeo melamina 18 mm) |
| **📺 Sala / TV** | `mesa_centro` | **Mesa de Centro con Revistero** | 900 mm | 420 mm | 500 mm | 0 mm | 1 Mód. abierto a ras de sofá con nicho inferior |
| **🍷 Comedor** | `aparador` | **Aparador / Buffet de Comedor** | 1500 mm | 850 mm | 450 mm | 80 mm | 3 Mód.: 2 laterales puertas vajilla + centro 4 cajones cubiertos |
| **🍷 Comedor** | `vitrina` | **Vitrina Vajillera Alta** | 900 mm | 1800 mm | 400 mm | 80 mm | 1 Mód.: 4 repisas interiores con puertas batientes de cristal |
| **🍷 Comedor** | `bar_mural` | **Mueble Bar / Cava Mural** | 1000 mm | 900 mm | 350 mm | 0 mm | 1 Mód. flotante con copero y compartimentos porta-botellas |
| **🛏️ Dormitorio** | `ropero` | **Ropero / Clóset 3 Cuerpos** | 2400 mm | 2200 mm | 600 mm | 80 mm | 3 Mód.: Columna repisas, colgado largo y cajonera + camisas |
| **🛏️ Dormitorio** | `comoda` | **Cómoda 4 Cajones** | 900 mm | 900 mm | 480 mm | 80 mm | 1 Mód.: 4 cajones con correderas telescópicas (descuento 26 mm) |
| **🛏️ Dormitorio** | `comoda_doble` | **Cómoda Doble Master** | 1400 mm | 850 mm | 500 mm | 80 mm | 2 Mód.: 2 columnas simétricas con 8 cajones totales |
| **🛏️ Dormitorio** | `velador` | **Velador / Mesa de Noche** | 500 mm | 550 mm | 400 mm | 60 mm | 1 Mód. compacto de 2 cajones a ras del colchón estándar |
| **🛏️ Dormitorio** | `zapatera` | **Zapatera Ergonómica** | 800 mm | 1000 mm | 350 mm | 70 mm | 1 Mód.: 4 repisas a 20° para visión directa de calzado |
| **🛏️ Dormitorio** | `cabecero` | **Panel Cabecero con Repisa** | 1600 mm | 1100 mm | 150 mm | 0 mm | 1 Mód. mural para cama Queen de 1500 mm con repisa y LED |
| **📚 Biblioteca** | `librero` | **Librero / Biblioteca Doble** | 1200 mm | 1800 mm | 300 mm | 60 mm | 2 Mód. simétricos de 600 mm con 4 repisas c/u ($\le 800\text{ mm}$) |
| **📚 Biblioteca** | `estanteria_libros` | **Estantería Alta para Libros** | 800 mm | 2100 mm | 300 mm | 80 mm | 1 Mód. vertical de 6 niveles con vanos anti-pandeo |
| **📚 Biblioteca** | `repisero_cubos` | **Repisero Modular en Cubos** | 1000 mm | 1000 mm | 280 mm | 0 mm | 1 Mód. cuadrado de 3x3 nichos para libros y colecciones |
| **💻 Oficina** | `escritorio` | **Escritorio Home Office** | 1200 mm | 750 mm | 600 mm | 0 mm | 2 Mód.: Cajonera 400 mm (3 cajones) + Vano libre de piernas 800 mm |
| **💻 Oficina** | `escritorio_gamer` | **Battlestation Gamer** | 1600 mm | 750 mm | 700 mm | 0 mm | 2 Mód.: Pedestal CPU 450 mm + Vano libre 1150 mm y pasacables |
| **💻 Oficina** | `credencia` | **Credencia / Auxiliar Oficina** | 1400 mm | 750 mm | 450 mm | 70 mm | 2 Mód.: Cajonera archivador de carpetas + módulo puertas |
| **💻 Oficina** | `cajonera_movil` | **Cajonera Pedestal Rodante** | 400 mm | 600 mm | 480 mm | 0 mm | 1 Mód. de 3 cajones con cerradura para colocar bajo escritorio |
| **🏪 Tienda** | `mostrador_caja` | **Mostrador Atención / Caja** | 1400 mm | 950 mm | 600 mm | 100 mm | 2 Mód.: Cajón de dinero y repisa bolso + repisas de atención |
| **🏪 Tienda** | `gondola_exhibidora` | **Góndola Central Comercial** | 1200 mm | 1200 mm | 500 mm | 80 mm | 2 Mód. con repisas bilaterales a $1200\text{ mm}$ de altura visual |
| **🏪 Tienda** | `estante_exhibidor` | **Vitrina Exhibidora Comercial** | 900 mm | 1900 mm | 400 mm | 80 mm | 1 Mód.: 4 repisas reforzadas para alta carga comercial |

---

#### 1. Ficha Técnica: Escritorios (Home Office & Gamer)
1. **Reglas Ergonómicas y Estructurales**:
   - **Altura de Trabajo**: Exactamente **750 mm** (normativa internacional ISO 9241 para posición sentada estándar).
   - **Vano para Piernas**: Mínimo libre de **600 a 800 mm de ancho**, sin piso inferior para permitir el libre ingreso de las ruedas de la silla de oficina y los pies del usuario.
   - **Profundidad de Mesa**: **600 mm** para uso con laptops; **700 mm** en escritorios Gamer para garantizar la distancia focal mínima a pantallas ultrawide ($>27"$) con brazos articulados.
2. **Cámara Pasacables (BIM)**:
   - El amarre o faldón posterior de melamina debe retranquearse entre **40 y 60 mm** respecto al filo posterior de la cubierta, creando un canal oculto vertical que desciende los cables hacia el enchufe de pared.
3. **Cajonera Auxiliar Integrada**:
   - Módulo lateral de **400 mm de ancho**, equipado con 3 cajones con correderas telescópicas (descuento $26\text{ mm}$). Cajón superior de $140\text{ mm}$ (papelería) y dos cajones inferiores de $200\text{ mm}$ (carpetas/archivos).

---

#### 2. Ficha Técnica: Cómodas y Cajoneras
1. **Reglas de Construcción y Seguridad**:
   - **Profundidad Óptima**: De **450 mm a 500 mm**, permitiendo utilizar correderas telescópicas comerciales de **400 mm o 450 mm** dejando un remanente trasero de seguridad $\ge 20\text{ mm}$.
   - **Altura Total**: **850 mm a 900 mm** (permite apoyar objetos decorativos, joyeros o espejos sin forzar la postura).
   - **Zócalo Sanitario**: Altura de **80 mm** con retranqueo frontal de **35 mm**.
2. **Distribución de Cajones y Anti-Desfondamiento**:
   - Cómoda Estándar ($W=900\text{ mm}$): 4 frentes de cajón iguales de aproximadamente $190\text{ mm}$ de altura.
   - En cajones mayores a $700\text{ mm}$ de ancho, es obligatorio instalar un listón central inferior de soporte de melamina ($80\text{ mm}$) bajo el fondo de MDF de 3 mm para impedir que se arquee con el peso de la ropa.

---

#### 3. Ficha Técnica: Repisas y Estanterías Modulares
1. **Reglas Anti-Pandeo**:
   - Para melamina de **18 mm**, el vano libre entre laterales no debe exceder jamás los **800 mm**.
   - Para melamina de **15 mm**, el vano máximo es de **700 mm**.
   - Si la estantería mide más de $800\text{ mm}$ (ej. $1200\text{ mm}$), debe dividirse obligatoriamente con un **parante vertical divisorio**.
2. **Repisas Flotantes de Muro**:
   - Profundidad máxima recomendada de **250 mm a 300 mm** para evitar un par de torsión excesivo sobre los tacos de fijación al muro de ladrillo o drywall.
   - Ensamble mediante listón de amarre posterior embutido de $80\text{ mm}$ (corte a 45° tipo *French Cleat*) o pernos invisibles de alta resistencia.

---

#### 4. Ficha Técnica: Centros de TV y Entretenimiento
1. **Ergonomía Visual**:
   - La base baja del mueble debe situarse entre **450 mm y 550 mm de altura**, de manera que el centro óptico de un televisor de 55" a 75" coincida exactamente con la línea de visión horizontal de un espectador sentado en el sofá ($1000\text{ a }1100\text{ mm}$ del nivel de piso terminado).
2. **Compartimentos de Conectividad y Audio**:
   - Vanos centrales abiertos de altura libre de **150 a 180 mm** para decodificadores, barras de sonido y consolas de videojuegos con calados pasacables circulares de $\varnothing 60\text{ mm}$ en el fondo posterior.
3. **Panel Mural de Soporte TV**:
   - Panel posterior flotante con cámara trasera de **40 a 50 mm** separada del muro mediante listones dobles, permitiendo ocultar regletas multicontacto, enchufes y cables HDMI sin perforaciones visibles frontales.

---

### 3.7 Arquitectura Dinámica de Muebles Prediseñados (100% Data-Driven desde JSON)

Para garantizar la máxima escalabilidad y evitar la necesidad de modificar código JavaScript al agregar nuevos muebles, ambientes o categorías etarias, el sistema opera bajo una **arquitectura 100% desacoplada y orientada a datos**:

#### A. Cascada Dinámica de 3 Desplegables
1. **Selector 1: Ambiente (`#selAmbientePreset`)**:
   - Se puebla en tiempo de ejecución extrayendo dinámicamente los valores únicos del atributo `ambiente` de todos los perfiles definidos en `perfiles_config.json`.
   - Incluye la opción inicial `🌐 Todos los Ambientes`.
   - Ambientes soportados de fábrica: *Cocina, Baño, Lavandería & Despensa, Dormitorio, Ambiente Infantil, Ambiente Juvenil, Zona Gamer, Oficina & Home Office, Biblioteca & Estudio, Sala de Estar & TV, Comedor & Bar, Tienda & Comercio*.
2. **Selector 2: Edad / Género (`#selEdadGeneroPreset`)**:
   - Se puebla en tiempo de ejecución filtrando los perfiles del ambiente activo y extrayendo los valores únicos de `edad_genero`.
   - Incluye la opción inicial `👥 Todas las Edades / Géneros`.
   - Categorías etarias estandarizadas: *Universal, Familiar, Matrimonial, Juvenil chicos, Juvenil señoritas, Infantil (de 2 a 8 años), Escolar (de 6 a 12 años), Adultos / Profesional, Adultos Mayores / Senior (65+ años), Comercial / Empresa*.
3. **Selector 3: Mueble Prediseñado (`#selMueblePreset`)**:
   - Filtra los muebles que coinciden simultáneamente con el Ambiente y la Edad/Género seleccionados.
   - Si se selecciona `Todos los Ambientes`, agrupa visualmente los muebles mediante etiquetas `<optgroup>`.

#### B. Motor de Auto-Armado Modular Paramétrico (`modulos_sugeridos`)
Cada perfil en el archivo JSON puede definir su matriz modular interna sin recurrir a código duro:
```json
"mi_mueble_personalizado": {
  "id": "mi_mueble_personalizado",
  "nombre": "Estación de Costura y Manualidades",
  "categoria": "Hogar y Manualidades",
  "ambiente": "Taller Creativo",
  "edad_genero": "Familiar",
  "icono": "🧵",
  "descripcion": "Mueble con gavetero amplio para rollos de tela y vano libre para máquina.",
  "ancho_sugerido": 1500,
  "alto_sugerido": 800,
  "prof_baja": 650,
  "altura_zocalo": 80,
  "retrans_zocalo": 35,
  "cant_listones_zocalo": 2,
  "modulos_sugeridos": [
    {
      "nombre": "Cajonera Telas 4C",
      "ancho_proporcional": 0.4,
      "tipo_interior": "cajonera",
      "cant_cajones": 4,
      "tiene_fondo": true
    },
    {
      "nombre": "Vano Libre Máquina",
      "ancho_proporcional": 0.6,
      "tipo_interior": "carcasa",
      "tiene_piso": false,
      "tiene_fondo": false
    }
  ]
}
```

#### C. Cero Modificaciones de Código
- Al agregar, modificar o suprimir un mueble en `perfiles_config.json`:
  1. El nuevo **Ambiente** aparece automáticamente en el Selector 1.
  2. El nuevo rango de **Edad / Género** aparece automáticamente en el Selector 2.
  3. El nuevo **Mueble** se lista en el Selector 3 con sus dimensiones $W \times H \times D$.
  4. Al pulsar **✓ Aplicar** con el check activo, los módulos y divisiones se generan automáticamente a partir de `modulos_sugeridos`.
  5. Se provee un botón **🔄 Recargar JSON** en la interfaz para refrescar el catálogo en caliente sin reiniciar la ventana.

#### D. Familias Estandarizadas de Roperos, Cocinas, Centros TV y Tocadores (Cero Duplicados)
1. **Roperos Modulares con Maleteros Superiores Independientes y Cajoneras Subdivididas**:
   - *Norma de Taller*: Una puerta batiente no debe superar los 1600-1800 mm de altura para evitar alabeo, exceso de peso y sobrecarga de bisagras. Los muebles altos de dormitorio integran obligatoriamente maletero superior independiente (`nivel_apilado: 1` o `2`). Las cajoneras interiores o frontales se configuran con alturas proporcionales (450 a 800 mm) para mantener tapas de 170 a 240 mm, dejando el espacio superior para colgado o repisas sin crear frentes monstruosos.
   - `ropero_1_cuerpo` (600 × 2100 × 580 mm): 1 columna. Cajonera inferior de 2 cajones (460 mm) + Colgado de camisas/ropa (1140 mm) + Maletero superior independiente (420 mm).
   - `ropero_2_cuerpos` (1200 × 2100 × 580 mm): 2 columnas de 600 mm. Columna 1: colgado largo y calzado (1600 mm) + maletero (420 mm). Columna 2: cajonera inferior de 3 cajones (660 mm) + colgado de camisas (940 mm) + maletero independiente (420 mm).
   - `ropero_3_cuerpos` (1800 × 2100 × 580 mm): 3 columnas de 600 mm. Columna 1: repisas ropa doblada (1600 mm) + maletero. Columna 2: colgado central de trajes y vestidos (1600 mm) + maletero. Columna 3: cajonera inferior 3C (660 mm) + colgado camisas (940 mm) + maletero (420 mm).
   - `ropero_4_cuerpos` (2400 × 2200 × 600 mm): 4 columnas de 600 mm. Columna 1: colgado largo dama (1650 mm). Columna 2: cajonera dama 4C (800 mm) + repisas organizadoras (850 mm). Columna 3: cajonera varón 4C (800 mm) + colgado corto camisas (850 mm). Columna 4: colgado trajes y pantalonero (1650 mm). Batería superior continua de 4 maleteros de 470 mm.
   - `closet_vestidor` (2700 × 2400 × 600 mm): Vestidor walk-in master con 3 columnas de 900 mm. Columna 1: ropa larga y calzado (1800 mm). Columna 2: cajonera doble de 4 gavetas (800 mm) + colgado camisas/sacos (1000 mm). Columna 3: ropa corta y pantalonero (1800 mm). 3 maleteros superiores independientes de 500 mm.
   - `ropero_puertas_corredizas` (1800 × 2200 × 620 mm): Ropero corredizo de 2 columnas de 900 mm. Columna 1: colgado y calzado (1650 mm) + maletero corredizo (470 mm). Columna 2: cajonera interior 3C (650 mm) + repisas organizadoras (1000 mm) + maletero corredizo (470 mm).
2. **Bajos de Cocina Modulares por Cantidad de Módulos (Módulos de 600 mm en Melamina RH)**:
   - `cocina_1_modulo` (600 × 850 × 580 mm): Módulo fregadero individual o torre horno.
   - `cocina_2_modulos` (1200 × 850 × 580 mm): Cajonera ollera 3C + Módulo fregadero lavaplatos.
   - `cocina_3_modulos` (1800 × 850 × 580 mm): Cajonera ollera 3C + Fregadero + Despensa vajilla.
   - `cocina_4_modulos` (2400 × 850 × 580 mm): Línea completa: ollera, zona cocción/anafe, lavaplatos y despensa.
   - `cocina_5_modulos` (3000 × 850 × 580 mm): Línea master de chef: 6 cajones telescópicos y 3 zonas de puertas.
3. **Módulos Aéreos de Cocina con Altillos Telescópicos (1, 2, 3, 4 y 5 Módulos)**:
   - *Norma de Taller*: La puerta de un módulo aéreo no puede ir continua hasta el techo porque golpea la cabeza y sobrecarga las bisagras. Se divide en alacena inferior de 550 mm con puertas batientes y altillo superior de 350 mm con puerta elevable mediante compás telescópico / pistón a gas.
   - `aereo_cocina_1_modulo` (600 × 900 × 340 mm): 1 columna. Alacena vajillera inferior de 550 mm + Altillo superior telescópico de 350 mm.
   - `aereo_cocina_2_modulos` (1200 × 900 × 340 mm): 2 columnas de 600 mm. Alacena vajilla y módulo campana + 2 altillos superiores con puertas telescópicas.
   - `aereo_cocina_3_modulos` (1800 × 900 × 340 mm): 3 columnas de 600 mm. Alacenas laterales, campana central + 3 altillos superiores telescópicos.
   - `aereo_cocina_4_modulos` (2400 × 900 × 340 mm): 4 columnas de 600 mm. Despensa aéreo, vajillero, extractor y copero + 4 altillos superiores telescópicos.
   - `aereo_cocina_5_modulos` (3000 × 900 × 340 mm): 5 columnas de 600 mm. Línea completa para mesones de chef con 5 altillos superiores telescópicos.
4. **Centros de Entretenimiento Específicos por Tamaño de Pantalla (Pulgadas)**:
   - `centro_tv_40_pulgadas` (1550 × 1500 × 400 mm): Nicho central de 1050 mm para TV 40" (pantalla 920 mm) con librero lateral de 500 mm.
   - `centro_tv_48_pulgadas` (1850 × 1600 × 400 mm): Nicho central de 1250 mm para TV 48" (pantalla 1080 mm) con repisas y columnas simétricas.
   - `centro_tv_55_pulgadas` (2200 × 1750 × 420 mm): Nicho central de 1400 mm para TV 55" (pantalla 1240 mm) con espacio soundbar, audio y vitrina.
   - `centro_tv_65_pulgadas` (2600 × 1900 × 450 mm): Nicho central master de 1650 mm para TV 65" (pantalla 1460 mm) con vitrinas laterales dobles.
   - *Depuración*: Se eliminó el antiguo perfil genérico `centro_entretenimiento` para evitar duplicidad y garantizar nichos normalizados exactos.
5. **Tocadores de Maquillaje Ergonómicos para Señoritas**:
   - `tocador_juvenil` (1100 × 780 × 450 mm): Altura ergonómica de mesa (780 mm con zócalo 80 mm) y fondo de 450 mm para alcance óptimo al espejo. Incluye cajonera lateral de 4 gavetas para skincare y vano ergonómico para sentarse con cajón joyero superior.
   - `tocador_hollywood_led` (1200 × 800 × 480 mm): Modelo amplio con torre de 5 cajones cosméticos y cubierta engrosada.
6. **Estaciones Gamer y Home Office con Módulos Apilados y Mesa Ergonómica**:
   - `setup_gamer_pro` (2400 × 2000 × 650 mm): Estación integral de streaming y gaming distribuida en 3 columnas y 2 niveles de altura:
     - **Columna 0**: Vitrina lateral de coleccionables RGB (500 × 1920 mm) con 4 repisas.
     - **Columna 1 - Nivel 0 (Mesa de Escritorio Gamer)**: Ancho 1400 mm, Alto 670 mm ($80\text{ zócalo} + 670 = 750\text{ mm}$ altura ergonómica exacta), Profundidad 650 mm. Diseñado con `tiene_piso: false` (espacio libre para piernas y silla gamer), `tiene_techo: true` (tablero de mesa de trabajo macizo) y `tiene_fondo: true` para canalización de cables.
     - **Columna 1 - Nivel 1 (Puente Superior Pantallas y Repisa RGB)**: Ancho 1400 mm, Alto 1250 mm ($750 + 1250 = 2000\text{ mm}$), Profundidad retraída a 350 mm para evitar golpes en la cabeza. Espacio inferior abierto para 2 monitores ultrawide de hasta 32" y repisa superior de exhibición con tira LED.
     - **Columna 2**: Pedestal gabinete CPU y periféricos (500 × 1920 mm) con 3 cajones de almacenamiento.
   - `home_office_ejecutivo` (2000 × 2100 × 650 mm): Idéntico esquema arquitectónico apilado ($100\text{ zócalo} + 650 = 750\text{ mm}$ en mesa ergonómica nivel 0, coronado por módulo aéreo archivador nivel 1 de 1350 mm).
7. **Regla de Fabricación: Fondos MDF Ranurados a 18 mm y Soporte Posterior**:
   - Todos los muebles con fondo MDF (roperos, libreros, cómodas, centros TV, escritorios, etc.) se diseñan con mecanizado de ranura a **18 mm del filo posterior** (`distancia_ranura: 18`, `dist_ranura_mdf: 18`).
   - Alojan en el espacio posterior de 18 mm listones de amarre y soporte posterior de melamina maciza de 18 mm (`tiene_liston_post: true`, `cant_amarres: 2`).
   - Los listones posteriores aprisionan el MDF en la ranura garantizando resistencia al pandeo y soporte seguro para anclaje a muro sin deformaciones ni tornillos pasantes.
   - **Tolerancia Milimétrica Cero-Colisiones**: La posición en Z de los listones horizontales parte de `zStartPost = zBase + (tienePiso ? t : 0)`, impidiendo que piezas atraviesen los techos o bases de carcasa bajo cualquier configuración modular.

---

## 📌 4. RESUMEN DE CONSTANTES MAESTRAS DE TALLER

```plaintext
================================================================================
CONSTANTES INDUSTRIALES DE TALLER - JPQMELAMINAPRO
================================================================================
ESPESORES DE MELAMINA COMERCIALES : 15 mm, 18 mm, 36 mm (engrosado doble)
ESPESOR DE FONDO MDF ESTÁNDAR    : 3.0 mm (ranurado) / 5.5 mm (muebles pesados)
DIMENSIONES DE RANURA DE FONDO   : 4.0 mm ancho x 8.0 mm profundidad
DISTANCIA DE RANURA A TRASERA    : 18.0 mm al filo posterior
TOLERANCIA TÉRMICA FONDO MDF     : -2.0 mm (holgura total en X e Y)

DESCUENTO CORREDERA TELESCÓPICA  : 26.0 mm (13.0 mm por cada lateral)
DESCUENTO CORREDERA OCULTA (BLUM): 21.0 mm (fondo levantado a 14.0 mm)
DESCUENTO LATERALES METÁLICOS    : 37.5 mm (cajones Slim Box)

LUCES ENTRE PUERTAS Y FRENTES    : 2.0 mm a 3.0 mm perimetrales
LÍMITE ANCHO PUERTA 1 HOJA       : 600.0 mm (mayor a 600 mm -> 2 hojas obligatorias)
PERFORACIÓN CAZOLETA BISAGRA     : Diámetro 35.0 mm | Profundidad 11.5 - 12.0 mm

VANO MÁXIMO PANDEO (MELAMINA 15) : 700.0 mm (requiere parante si es mayor)
VANO MÁXIMO PANDEO (MELAMINA 18) : 800.0 mm (requiere parante si es mayor)
SEPARACIÓN LISTONES DE ZÓCALO    : Mín. 150.0 mm libre | Máx. 600.0 mm (anti-pandeo)
RETRANQUEO DE ZÓCALO FRONTAL     : 35.0 mm a 50.0 mm (ergonomía de pies)

DIMENSIÓN MÍNIMA SEGURA DE CORTE : 50.0 mm (seccionadoras / escuadradoras)
DIMENSIÓN MÁXIMA DE TABLERO      : 2750.0 mm (largo máximo de plancha comercial)
KERF DEL DISCO DE SIERRA         : 4.0 mm
REFILADO PERIMETRAL DE TABLERO   : 10.0 mm por borde
CANAL EMBUTIDO PERFIL LED        : 17.0 mm ancho x 7.0 mm profundidad
================================================================================
```

---
*Manual aprobado como especificación técnica oficial para el desarrollo e implementación del ecosistema **JPQMelaminaPro**.*
