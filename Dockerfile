FROM ruby:3.2-slim

# Instalar dependencias del sistema y Python para utilidades y empaquetado
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    zip \
    unzip \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar el proyecto
COPY . /app

# Comando predeterminado: verificar sintaxis y empaquetar el instalador .rbz
CMD ["python3", "package_extension.py"]
