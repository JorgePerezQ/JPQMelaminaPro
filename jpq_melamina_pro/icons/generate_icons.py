#!/usr/bin/env python3
"""
Generador profesional de iconos PNG antialiased para la barra de herramientas de SketchUp.
Utiliza Pillow para renderizar a 192x192 y reducir con muestreo Lanczos de alta definición a 24x24 y 16x16.
Crea iconos con estética CAD / BIM industrial de alta gama.
"""
import os
from PIL import Image, ImageDraw

def render_highres_icon(symbol, bg_color):
    """Renderiza un icono vectorial antialiased a 192x192 con esquinas redondeadas y glifo blanco."""
    img = Image.new('RGBA', (192, 192), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 1. Fondo estilizado con esquinas redondeadas
    r, g, b = bg_color
    dark_border = (max(0, r - 45), max(0, g - 45), max(0, b - 45), 255)
    
    # Tarjeta redondeada
    draw.rounded_rectangle([10, 10, 182, 182], radius=32, fill=(r, g, b, 255), outline=dark_border, width=6)
    
    # 2. Dibujar glifo vectorial según la herramienta
    white = (255, 255, 255, 255)
    line_w = 12
    
    if symbol == 'box':
        # Módulo 3D isométrico / Caja con división
        draw.rounded_rectangle([34, 34, 158, 158], radius=8, outline=white, width=line_w)
        draw.line([34, 88, 158, 88], fill=white, width=line_w)
        draw.line([96, 88, 96, 158], fill=white, width=line_w)
        
    elif symbol == 'edit':
        # Escuadra y regla de diseño paramétrico
        draw.polygon([(40, 152), (152, 152), (152, 132), (64, 132), (64, 40), (40, 40)], fill=white)
        draw.line([85, 132, 85, 145], fill=(r, g, b, 255), width=4)
        draw.line([115, 132, 115, 145], fill=(r, g, b, 255), width=4)
        draw.line([40, 75, 53, 75], fill=(r, g, b, 255), width=4)
        draw.line([40, 105, 53, 105], fill=(r, g, b, 255), width=4)
        
    elif symbol == 'drawers':
        # Cómoda con 3 gavetas y tiradores elegantes
        draw.rounded_rectangle([36, 32, 156, 160], radius=8, outline=white, width=line_w)
        draw.line([36, 74, 156, 74], fill=white, width=8)
        draw.line([36, 116, 156, 116], fill=white, width=8)
        # Tiradores de gola / perfil
        draw.rounded_rectangle([80, 50, 112, 58], radius=4, fill=white)
        draw.rounded_rectangle([80, 92, 112, 100], radius=4, fill=white)
        draw.rounded_rectangle([80, 134, 112, 142], radius=4, fill=white)
        
    elif symbol == 'door':
        # Gabinete con puertas batientes en perspectiva
        draw.rounded_rectangle([36, 32, 156, 160], radius=8, outline=white, width=line_w)
        draw.line([96, 32, 96, 160], fill=white, width=line_w)
        # Manijas
        draw.rounded_rectangle([80, 88, 88, 104], radius=3, fill=white)
        draw.rounded_rectangle([104, 88, 112, 104], radius=3, fill=white)
        
    elif symbol == 'material':
        # Paleta de texturas con veta de madera ondulada
        draw.rounded_rectangle([36, 36, 156, 156], radius=12, outline=white, width=line_w)
        draw.arc([46, 50, 146, 140], start=0, end=180, fill=white, width=8)
        draw.arc([56, 70, 136, 160], start=180, end=360, fill=white, width=8)
        draw.ellipse([88, 88, 104, 104], fill=white)
        
    elif symbol == 'cutlist':
        # Plano de optimización 2D / Guillotina con piezas empaquetadas
        draw.rounded_rectangle([32, 32, 160, 160], radius=6, outline=white, width=line_w)
        # Cortes guillotina internos
        draw.line([100, 32, 100, 160], fill=white, width=8)
        draw.line([32, 90, 100, 90], fill=white, width=8)
        draw.line([100, 110, 160, 110], fill=white, width=8)
        # Indicador de pieza
        draw.rectangle([44, 44, 88, 78], fill=white)
        
    elif symbol == 'tag':
        # Etiqueta de producción industrial para taller
        draw.polygon([(40, 80), (80, 40), (148, 40), (156, 48), (156, 144), (148, 152), (40, 152)], outline=white, fill=(r, g, b, 255))
        draw.line([(40, 80), (80, 40), (148, 40), (156, 48), (156, 144), (148, 152), (40, 152), (40, 80)], fill=white, width=line_w)
        draw.ellipse([116, 56, 136, 76], fill=white)
        draw.line([64, 100, 132, 100], fill=white, width=8)
        draw.line([64, 124, 110, 124], fill=white, width=8)
        
    elif symbol == 'shelves':
        # Estantería modular en 3 niveles
        draw.rounded_rectangle([36, 32, 156, 160], radius=8, outline=white, width=line_w)
        draw.line([36, 72, 156, 72], fill=white, width=8)
        draw.line([36, 112, 156, 112], fill=white, width=8)
        draw.line([36, 148, 156, 148], fill=white, width=8)
        
    elif symbol == 'groove':
        # Ranura de fondo para panel MDF
        draw.rectangle([40, 40, 152, 152], outline=white, width=line_w)
        draw.rectangle([68, 20, 86, 172], fill=white)
        
    elif symbol == 'edge':
        # Tapacantos grueso perimetral resaltado
        draw.rectangle([42, 42, 150, 150], outline=(255, 255, 255, 120), width=6)
        draw.line([36, 42, 36, 150], fill=white, width=16)
        draw.line([36, 36, 150, 36], fill=white, width=16)
        
    elif symbol == 'drill':
        # Perforaciones sistema 32mm
        for cy in (50, 96, 142):
            for cx in (68, 124):
                draw.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], fill=white)
                
    elif symbol == 'piece':
        # Tablero individual con cotas
        draw.rounded_rectangle([50, 46, 142, 146], radius=6, fill=white)
        draw.line([32, 46, 32, 146], fill=white, width=4)
        draw.line([26, 46, 38, 46], fill=white, width=4)
        draw.line([26, 146, 38, 146], fill=white, width=4)
        
    return img

HERRAMIENTAS = [
    ('mod_base', (30, 64, 175), 'box'),           # Azul marino CAD (#1E40AF)
    ('mod_edit', (99, 102, 241), 'edit'),         # Índigo ingeniería (#6366F1)
    ('repisas', (13, 148, 136), 'shelves'),       # Verde azulado (#0D9488)
    ('cajones', (217, 119, 6), 'drawers'),        # Ámbar carpintero (#D97706)
    ('ranuras', (124, 58, 237), 'groove'),        # Púrpura herraje (#7C3AED)
    ('tapacantos', (225, 29, 72), 'edge'),        # Carmesí precisión (#E11D48)
    ('perforaciones', (220, 38, 38), 'drill'),    # Rojo perforación (#DC2626)
    ('materiales', (180, 83, 9), 'material'),     # Madera cálida (#B45309)
    ('puertas', (2, 132, 199), 'door'),           # Azul cerúleo (#0284C7)
    ('etiquetas', (71, 85, 105), 'tag'),          # Pizarra industrial (#475569)
    ('pieza_edit', (16, 185, 129), 'piece'),      # Esmeralda corte (#10B981)
    ('despiece', (5, 150, 105), 'cutlist')        # Verde producción (#059669)
]

def main():
    icons_dir = os.path.dirname(os.path.abspath(__file__))
    print(f"Generando iconos profesionales en: {icons_dir}")
    
    for name, color, symbol in HERRAMIENTAS:
        highres = render_highres_icon(symbol, color)
        for size in (16, 24):
            # Reducir con filtro de máxima calidad Lanczos
            resized = highres.resize((size, size), Image.Resampling.LANCZOS)
            filename = os.path.join(icons_dir, f"{name}_{size}.png")
            resized.save(filename, 'PNG')
            print(f" -> {name}_{size}.png ({os.path.getsize(filename)} bytes)")

    print("¡Todos los iconos PNG para SketchUp fueron generados con éxito!")

if __name__ == '__main__':
    main()
