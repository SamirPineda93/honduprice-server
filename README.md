# HonduPrice 🇭🇳

Comparador inteligente de precios en línea para Honduras. Busca un artículo y HonduPrice consulta en tiempo real las principales comerciales del país para mostrarte dónde está más barato.

## ¿Qué hace?

El usuario escribe el nombre de un producto (televisor, celular, electrodoméstico, etc.) y HonduPrice:

1. Busca simultáneamente en **El Gallo Más Gallo**, **Diunsa** y **Jetstereo**
2. Filtra los resultados para mostrar solo el modelo exacto buscado
3. Ordena los resultados de menor a mayor precio
4. Genera un análisis con inteligencia artificial indicando cuál es la mejor opción

## Tiendas activas

| Tienda | API utilizada |
|--------|--------------|
| El Gallo Más Gallo | Algolia Search |
| Diunsa | API interna dapplications.tech |
| Jetstereo | Elastic App Search |

**Próximamente:** La Curacao, Elektra, Lady Lee, RadioShack

## Tecnologías

- **Frontend:** HTML, CSS, JavaScript puro — desplegado en [Netlify](https://honduprice.netlify.app)
- **Backend:** Node.js + Express — desplegado en [Render.com](https://honduprice-server.onrender.com)
- **IA:** Groq API con modelo `llama-3.3-70b-versatile` para clasificar y analizar resultados
- **Control de versiones:** GitHub

## URLs del proyecto

- **Aplicación pública:** https://honduprice.netlify.app
- **API del servidor:** https://honduprice-server.onrender.com
- **Repositorio:** https://github.com/SamirPineda93/honduprice-server

## Cómo se usa

1. Entra a **https://honduprice.netlify.app**
2. Escribe el producto que buscas en el campo de búsqueda
3. Haz clic en **Comparar**
4. Espera unos segundos mientras se consultan las tiendas
5. Ve los resultados ordenados de menor a mayor precio
6. Haz clic en **Ver en tienda →** para ir directamente al producto

## Cómo ejecutarlo localmente

### Requisitos
- Node.js v18 o superior
- Una API key de [Groq](https://console.groq.com)

### Pasos

```bash
# Clonar el repositorio
git clone https://github.com/SamirPineda93/honduprice-server.git
cd honduprice-server

# Instalar dependencias
npm install

# Configurar variable de entorno
set GROQ_API_KEY=tu_api_key_aqui   # Windows
export GROQ_API_KEY=tu_api_key_aqui  # Mac/Linux

# Iniciar el servidor
node server.js
```

El servidor corre en `http://localhost:3001`. Para el frontend, abre el archivo `index.html` directamente en el navegador o usa un servidor local.

## Arquitectura

```
Usuario
  ↓
Frontend (Netlify)
  ↓ POST /buscar
Backend Node.js (Render)
  ↓ Consultas paralelas
┌─────────────────────────────┐
│ El Gallo  │ Diunsa │ Jetstereo │
│ (Algolia) │ (API)  │ (Elastic) │
└─────────────────────────────┘
  ↓ Resultados
Groq IA (llama-3.3-70b)
  ↓ JSON clasificado
Usuario ve resultados ordenados
```

## Notas importantes

- El plan gratuito de Render puede tardar hasta 50 segundos en responder si el servidor estuvo inactivo. La primera búsqueda puede demorar — las siguientes son rápidas.
- Los precios son en **Lempiras hondureños (L.)** y se obtienen en tiempo real de las APIs de cada tienda.

## Autor

Samir Edgardo Pineda Ramos — Universidad Tecnológica de Honduras (UTH)  
Proyecto integrador — Inteligencia Artificial Aplicada
