#!/usr/bin/env python3
"""
Generador procedural de texturas de alta calidad para Pelikano, Vesto y Universales.
Crea archivos PNG con veta orgánica de madera, hilado textil y acabados mate para SketchUp.
"""
import os
import math
import random
from PIL import Image, ImageDraw, ImageFilter

TEXTURES_DIR = os.path.join(os.path.dirname(__file__), 'jpq_melamina_pro', 'textures')
os.makedirs(TEXTURES_DIR, exist_ok=True)

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

def adjust_color(rgb, delta):
    return (
        max(0, min(255, rgb[0] + delta)),
        max(0, min(255, rgb[1] + delta)),
        max(0, min(255, rgb[2] + delta))
    )

def generate_wood_texture(filename, base_hex, dark_delta=28, light_delta=18, seed=42, freq=0.015, rough=1.2):
    """Genera textura de madera con anillos de crecimiento, vetas sinuosas y poros naturales."""
    random.seed(seed)
    base_rgb = hex_to_rgb(base_hex)
    w, h = 512, 512
    img = Image.new('RGB', (w, h), base_rgb)
    draw = ImageDraw.Draw(img)

    # 1. Bandas de veta ancha y catedrales
    num_cathedrals = random.randint(2, 4)
    centers_x = [random.randint(50, w - 50) for _ in range(num_cathedrals)]
    
    for y in range(h):
        for cx in centers_x:
            # Curvatura parabólica suave para catedrales de madera
            dist_c = abs(y - 256) * 0.4
            shift = int(math.sin(y * freq + seed) * 16)
            x_line = cx + shift
            if 0 <= x_line < w:
                color = adjust_color(base_rgb, -random.randint(10, dark_delta))
                draw.point((x_line, y), fill=color)

    # 2. Vetas longitudinales finas y continuas
    for _ in range(400):
        start_x = random.randint(-40, w + 40)
        c_delta = -random.randint(12, dark_delta) if random.random() > 0.4 else random.randint(6, light_delta)
        c = adjust_color(base_rgb, c_delta)
        line_w = random.choice([1, 1, 2])
        pts = []
        cur_x = start_x
        for y in range(0, h + 1, 12):
            cur_x += math.sin(y * freq + seed) * rough + (random.random() - 0.5) * 1.5
            pts.append((cur_x, y))
        draw.line(pts, fill=c, width=line_w)

    # 3. Micro-poros naturales de la madera
    for _ in range(8000):
        px = random.randint(0, w - 1)
        py = random.randint(0, h - 1)
        draw.point((px, py), fill=adjust_color(base_rgb, -random.randint(15, 35)))

    # Suavizado para simular la película de resina melamínica termofusionada
    img = img.filter(ImageFilter.GaussianBlur(radius=0.9))
    out_path = os.path.join(TEXTURES_DIR, filename)
    img.save(out_path, 'PNG', optimize=True)
    print(f"Textura creada: {filename} ({w}x{h})")

def generate_textile_texture(filename, base_hex, seed=88):
    """Genera textura textil/lino tejido para acabados como Linosa o Seda Giorno."""
    random.seed(seed)
    base_rgb = hex_to_rgb(base_hex)
    w, h = 512, 512
    img = Image.new('RGB', (w, h), base_rgb)
    draw = ImageDraw.Draw(img)

    # Urdimbre y trama cruzada
    spacing = 4
    for x in range(0, w, spacing):
        c = adjust_color(base_rgb, random.randint(-18, 12))
        draw.line([(x, 0), (x, h)], fill=c, width=1)
    for y in range(0, h, spacing):
        c = adjust_color(base_rgb, random.randint(-18, 12))
        draw.line([(0, y), (w, y)], fill=c, width=1)

    # Ruido textil entrelazado
    for _ in range(12000):
        px = random.randint(0, w - 1)
        py = random.randint(0, h - 1)
        delta = random.choice([-14, -8, 8, 14])
        draw.point((px, py), fill=adjust_color(base_rgb, delta))

    img = img.filter(ImageFilter.GaussianBlur(radius=0.7))
    out_path = os.path.join(TEXTURES_DIR, filename)
    img.save(out_path, 'PNG', optimize=True)
    print(f"Textura textil creada: {filename}")

def generate_solid_texture(filename, base_hex, noise_range=6, seed=12):
    """Genera textura unicolor mate con micro-grano sedoso anti-reflejos."""
    random.seed(seed)
    base_rgb = hex_to_rgb(base_hex)
    w, h = 512, 512
    img = Image.new('RGB', (w, h), base_rgb)
    draw = ImageDraw.Draw(img)

    for _ in range(15000):
        px = random.randint(0, w - 1)
        py = random.randint(0, h - 1)
        delta = random.randint(-noise_range, noise_range)
        draw.point((px, py), fill=adjust_color(base_rgb, delta))

    img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
    out_path = os.path.join(TEXTURES_DIR, filename)
    img.save(out_path, 'PNG', optimize=True)
    print(f"Textura unicolor creada: {filename}")

def generate_rustic_saw_texture(filename, base_hex, seed=55):
    """Genera textura con marcas de aserrado rústico transversal y veta."""
    random.seed(seed)
    base_rgb = hex_to_rgb(base_hex)
    w, h = 512, 512
    img = Image.new('RGB', (w, h), base_rgb)
    draw = ImageDraw.Draw(img)

    # Veta vertical
    for _ in range(300):
        x = random.randint(-20, w + 20)
        c = adjust_color(base_rgb, -random.randint(10, 30))
        pts = [(x + math.sin(y * 0.02) * 2, y) for y in range(0, h + 1, 10)]
        draw.line(pts, fill=c, width=random.choice([1, 2]))

    # Huellas de aserrado transversal (corte de sierra rústico)
    for y in range(0, h, random.randint(24, 48)):
        c = adjust_color(base_rgb, -random.randint(18, 35))
        draw.line([(0, y), (w, y + random.randint(-4, 4))], fill=c, width=random.choice([1, 2]))

    img = img.filter(ImageFilter.GaussianBlur(radius=0.8))
    out_path = os.path.join(TEXTURES_DIR, filename)
    img.save(out_path, 'PNG', optimize=True)
    print(f"Textura aserrado rústico creada: {filename}")

def generate_oxido_texture(filename, base_hex, seed=77):
    """Genera acabado fantasía óxido corten / metalizado."""
    random.seed(seed)
    base_rgb = hex_to_rgb(base_hex)
    w, h = 512, 512
    img = Image.new('RGB', (w, h), base_rgb)
    draw = ImageDraw.Draw(img)

    for _ in range(120):
        cx = random.randint(0, w)
        cy = random.randint(0, h)
        rad = random.randint(15, 60)
        c = adjust_color(base_rgb, random.randint(-40, 35))
        draw.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=c)

    img = img.filter(ImageFilter.GaussianBlur(radius=8.0))
    # Ruido granular
    draw = ImageDraw.Draw(img)
    for _ in range(18000):
        px = random.randint(0, w - 1)
        py = random.randint(0, h - 1)
        draw.point((px, py), fill=adjust_color(base_rgb, random.randint(-20, 20)))

    img = img.filter(ImageFilter.GaussianBlur(radius=0.6))
    out_path = os.path.join(TEXTURES_DIR, filename)
    img.save(out_path, 'PNG', optimize=True)
    print(f"Textura óxido creada: {filename}")

def main():
    print("=== Generando catálogo completo de texturas para JPQMelaminaPro ===")
    
    # --- PELIKANO (NOVOPAN) ---
    generate_wood_texture('pelikano_bellota.png', '#8D5B36', dark_delta=32, seed=101)
    generate_wood_texture('pelikano_macadamia.png', '#B99B78', dark_delta=25, seed=102)
    generate_wood_texture('pelikano_rovere.png', '#A88B67', dark_delta=24, seed=103)
    generate_wood_texture('pelikano_caramel.png', '#A66838', dark_delta=30, seed=104)
    generate_solid_texture('pelikano_niebla.png', '#C2C3BF', noise_range=5, seed=105)
    generate_solid_texture('pelikano_carbono.png', '#33363B', noise_range=6, seed=106)
    generate_wood_texture('pelikano_cognac.png', '#7A3E26', dark_delta=34, seed=107)
    generate_wood_texture('pelikano_duna.png', '#D6C7B2', dark_delta=20, seed=108)
    generate_solid_texture('pelikano_blanco_nieve.png', '#F5F6F8', noise_range=4, seed=109)
    generate_oxido_texture('pelikano_oxido.png', '#6B4F43', seed=110)

    # --- VESTO (ARAUCO) ---
    generate_wood_texture('vesto_roble_cendra.png', '#9E8C78', dark_delta=28, seed=201)
    generate_rustic_saw_texture('vesto_aserrado.png', '#B4926C', seed=202)
    generate_textile_texture('vesto_seda_giorno.png', '#8E7E73', seed=203)
    generate_textile_texture('vesto_linosa.png', '#B7A998', seed=204)
    generate_wood_texture('vesto_teca_lira.png', '#85583B', dark_delta=35, seed=205)
    generate_wood_texture('vesto_nogal_terracota.png', '#6E4631', dark_delta=36, seed=206)
    generate_wood_texture('vesto_wengue.png', '#3B2B23', dark_delta=25, seed=207)
    generate_wood_texture('vesto_cendra_escandinavo.png', '#C9BCAC', dark_delta=22, seed=208)
    generate_solid_texture('vesto_blanco_frost.png', '#F2F4F5', noise_range=4, seed=209)
    generate_solid_texture('vesto_titan.png', '#4A4F55', noise_range=6, seed=210)

    # --- CLÁSICOS / UNIVERSALES ---
    generate_solid_texture('blanco_melamina.png', '#FFFFFF', noise_range=4, seed=301)
    generate_wood_texture('roble_natural.png', '#D0A87C', dark_delta=28, seed=302)
    generate_wood_texture('nogal_terracota.png', '#6E4631', dark_delta=35, seed=303)
    generate_solid_texture('gris_antracita.png', '#383E44', noise_range=6, seed=304)
    generate_solid_texture('mdf_blanco.png', '#E8E2D6', noise_range=8, seed=305)

    print("=== Todas las texturas fueron generadas exitosamente ===")

if __name__ == '__main__':
    main()
