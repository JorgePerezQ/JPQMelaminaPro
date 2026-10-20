#!/usr/bin/env python3
"""
Generador de iconos PNG nativos para la barra de herramientas de SketchUp.
Genera versiones de 16x16 y 24x24 para las 12 herramientas de MelaStudio PRO.
"""
import struct
import zlib
import os

def create_png(width, height, color_rgb, symbol_type):
    """Genera un archivo PNG binario puro sin dependencias externas."""
    # Matriz de píxeles RGBA
    pixels = bytearray()
    
    r_bg, g_bg, b_bg = color_rgb
    
    for y in range(height):
        # Scanline filter byte (0 = None)
        pixels.append(0)
        for x in range(width):
            # Dibujar borde y forma simbólica
            is_border = (x == 0 or x == width - 1 or y == 0 or y == height - 1)
            is_corner = (x <= 1 and y <= 1) or (x >= width - 2 and y <= 1) or (x <= 1 and y >= height - 2) or (x >= width - 2 and y >= height - 2)
            
            # Centro o icono interno
            cx, cy = width // 2, height // 2
            
            draw_fg = False
            if symbol_type == 'box':
                # Rectángulo tipo módulo
                if (3 <= x <= width - 4 and 3 <= y <= height - 4) and (x == 3 or x == width - 4 or y == 3 or y == height - 4 or x == width // 2):
                    draw_fg = True
            elif symbol_type == 'edit':
                # Lápiz diagonal
                if abs(x - y) <= 1 and 2 <= x <= width - 3:
                    draw_fg = True
            elif symbol_type == 'shelves':
                # Repisas horizontales
                if 2 <= x <= width - 3 and (y == height // 3 or y == (2 * height) // 3 or x == 2 or x == width - 3):
                    draw_fg = True
            elif symbol_type == 'drawers':
                # Cajones horizontales divididos
                if 2 <= x <= width - 3 and 2 <= y <= height - 3:
                    if y in (2, height - 3, height // 2) or x in (2, width - 3):
                        draw_fg = True
            elif symbol_type == 'groove':
                # Líneas de ranura paralela
                if (x in (4, 8) and 2 <= y <= height - 3) or (y in (2, height - 3) and 2 <= x <= width - 3):
                    draw_fg = True
            elif symbol_type == 'edge':
                # Borde grueso resaltado
                if x in (2, 3) or y in (2, 3):
                    draw_fg = True
            elif symbol_type == 'drill':
                # Puntos de perforación
                dist_sq = (x - cx)**2 + (y - cy)**2
                if dist_sq <= (width // 4)**2:
                    draw_fg = True
            elif symbol_type == 'material':
                # Vetas de madera onduladas
                if (x + y) % 4 == 0 and 2 <= x <= width - 3 and 2 <= y <= height - 3:
                    draw_fg = True
            elif symbol_type == 'door':
                # Marco con manija
                if (2 <= x <= width - 3 and 2 <= y <= height - 3) and (x in (2, width - 3) or y in (2, height - 3) or (x == width - 5 and abs(y - cy) <= 1)):
                    draw_fg = True
            elif symbol_type == 'tag':
                # Etiqueta / Rombo
                if abs(x - cx) + abs(y - cy) <= width // 2 - 2:
                    draw_fg = True
            elif symbol_type == 'piece':
                # Panel individual acotado
                if (3 <= x <= width - 4 and 5 <= y <= height - 6):
                    draw_fg = True
            elif symbol_type == 'cutlist':
                # Lista / Tabla con filas
                if 3 <= x <= width - 4 and (y in (3, 6, 9, 12, height - 4) or x in (3, width - 4)):
                    draw_fg = True

            if is_corner:
                pixels.extend([0, 0, 0, 0]) # Transparente en esquinas
            elif draw_fg:
                pixels.extend([255, 255, 255, 255]) # Blanco puro para el símbolo
            elif is_border:
                pixels.extend([max(0, r_bg - 40), max(0, g_bg - 40), max(0, b_bg - 40), 255])
            else:
                pixels.extend([r_bg, g_bg, b_bg, 255]) # Color de fondo temático

    def png_chunk(chunk_type, data):
        return struct.pack('>I', len(data)) + chunk_type + data + struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)

    # Encabezado PNG
    header = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(pixels))
    
    return header + png_chunk(b'IHDR', ihdr) + png_chunk(b'IDAT', idat) + png_chunk(b'IEND', b'')

# Definición de las 12 herramientas y sus paletas
HERRAMIENTAS = [
    ('mod_base', (37, 99, 235), 'box'),           # Azul intenso
    ('mod_edit', (16, 185, 129), 'edit'),         # Verde esmeralda
    ('repisas', (245, 158, 11), 'shelves'),       # Ámbar
    ('cajones', (234, 88, 12), 'drawers'),        # Naranja
    ('ranuras', (139, 92, 246), 'groove'),        # Púrpura
    ('tapacantos', (236, 72, 153), 'edge'),       # Rosa / Magenta
    ('perforaciones', (239, 68, 68), 'drill'),    # Rojo
    ('materiales', (180, 83, 9), 'material'),     # Madera / Ocre
    ('puertas', (14, 165, 233), 'door'),          # Celeste
    ('etiquetas', (100, 116, 139), 'tag'),        # Gris pizarra
    ('pieza_edit', (20, 184, 166), 'piece'),      # Turquesa
    ('despiece', (34, 197, 94), 'cutlist')        # Verde lima
]

icons_dir = os.path.dirname(os.path.abspath(__file__))

for name, color, symbol in HERRAMIENTAS:
    for size in (16, 24):
        filename = os.path.join(icons_dir, f"{name}_{size}.png")
        data = create_png(size, size, color, symbol)
        with open(filename, 'wb') as f:
            f.write(data)
        print(f"Generado: {filename}")

print("Todos los iconos han sido generados exitosamente.")
