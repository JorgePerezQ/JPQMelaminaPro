#!/usr/bin/env python3
"""
Empaquetador oficial de la extensión JPQMelaminaPro para Trimble SketchUp.
Genera el archivo jpq_melamina_pro.rbz instalable directamente desde
el Administrador de Extensiones de SketchUp.
"""

import os
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

        # 2. Agregar toda la carpeta jpq_melamina_pro/ recursivamente
        sub_dir = os.path.join(project_dir, 'jpq_melamina_pro')
        for root, dirs, files in os.walk(sub_dir):
            for file in files:
                # Omitir archivos temporales o scripts de generación
                if file.endswith(('.py', '.pyc', '.git', '.DS_Store', 'Thumbs.db', 'Zone.Identifier')):
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, project_dir)
                zipf.write(file_path, rel_path)
                print(f" + Agregado: {rel_path}")

    print(f"\n¡Extensión empaquetada con éxito! Archivo: {output_rbz}")
    print(f"Tamaño: {os.path.getsize(output_rbz)} bytes")

if __name__ == '__main__':
    build_rbz()
