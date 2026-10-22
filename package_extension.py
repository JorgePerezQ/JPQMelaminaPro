#!/usr/bin/env python3
"""
Empaquetador oficial de la extensión JPQMelaminaPro para Trimble SketchUp.
Genera el archivo jpq_melamina_pro.rbz y sincroniza de forma segura con la
carpeta de Plugins de SketchUp 2026 en Windows (WSL2).
"""

import os
import shutil
import zipfile

def build_rbz():
    project_dir = os.path.dirname(os.path.abspath(__file__))
    output_rbz = os.path.join(project_dir, 'jpq_melamina_pro.rbz')

    print(f"Empaquetando extensión en: {output_rbz}")

    with zipfile.ZipFile(output_rbz, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # 1. Agregar el registrador principal en la raíz del zip
        main_loader = os.path.join(project_dir, 'jpq_melamina_pro.rb')
        if os.path.exists(main_loader):
            zipf.write(main_loader, 'jpq_melamina_pro.rb')
            print(" + Agregado: jpq_melamina_pro.rb")

        # 2. Agregar toda la carpeta jpq_melamina_pro/ recursivamente (incluye todas las texturas de Pelikano y Vesto)
        sub_dir = os.path.join(project_dir, 'jpq_melamina_pro')
        count = 0
        for root, dirs, files in os.walk(sub_dir):
            for file in files:
                if file.endswith(('.py', '.pyc', '.git', '.DS_Store', 'Thumbs.db', 'Zone.Identifier')):
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, project_dir)
                zipf.write(file_path, rel_path)
                count += 1

    print(f"Total de archivos empaquetados: {count + 1}")
    print(f"¡Extensión empaquetada con éxito! Archivo: {output_rbz}")
    print(f"Tamaño: {os.path.getsize(output_rbz)} bytes")

    # 3. Sincronizar en vivo a Windows SketchUp 2026 Plugins si existe la ruta WSL2
    win_plugins_dir = "/mnt/c/Users/jorge/AppData/Roaming/SketchUp/SketchUp 2026/SketchUp/Plugins"
    if os.path.exists(win_plugins_dir):
        print(f"\nSincronizando de forma segura a SketchUp 2026: {win_plugins_dir}")
        dst_loader = os.path.join(win_plugins_dir, 'jpq_melamina_pro.rb')
        try:
            shutil.copy2(main_loader, dst_loader)
            print(" -> jpq_melamina_pro.rb sincronizado.")
        except Exception as e:
            print(f"Aviso al copiar loader: {e}")

        dst_sub_dir = os.path.join(win_plugins_dir, 'jpq_melamina_pro')
        os.makedirs(dst_sub_dir, exist_ok=True)
        for root, dirs, files in os.walk(sub_dir):
            for file in files:
                if file.endswith(('.py', '.pyc', '.git', '.DS_Store', 'Thumbs.db', 'Zone.Identifier')):
                    continue
                src_file = os.path.join(root, file)
                rel = os.path.relpath(src_file, sub_dir)
                dst_file = os.path.join(dst_sub_dir, rel)
                os.makedirs(os.path.dirname(dst_file), exist_ok=True)
                try:
                    shutil.copy2(src_file, dst_file)
                except Exception as e:
                    pass
        print(" -> Carpeta jpq_melamina_pro y texturas sincronizadas con éxito.")
    else:
        print(f"\nRuta de SketchUp en Windows no encontrada en {win_plugins_dir}. Usar jpq_melamina_pro.rbz.")

if __name__ == '__main__':
    build_rbz()
