const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// ── EL GALLO MÁS GALLO (Algolia) ────────────────────────────
async function buscarGallo(producto) {
  try {
    const APP_ID = 'WLT832EA3J';
    const API_KEY = 'YTYwZjI3ODFjOTI3YWQ0MjJmYzQ3ZjBiNmY1Y2FiYjRhZjNiMmM3NmMxYTMyNDUwOGUxYjhkMWFhMzFlOGExNnRhZ0ZpbHRlcnM9';
    const INDEX = 'monge_upgrade_prod_elgallo_hn_products';

    const res = await fetch(
      `https://${APP_ID}-dsn.algolia.net/1/indexes/${INDEX}/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Algolia-Application-Id': APP_ID,
          'X-Algolia-API-Key': API_KEY
        },
        body: JSON.stringify({
          query: producto,
          hitsPerPage: 3,
          attributesToRetrieve: ['name', 'price', 'url'],
          numericFilters: ['visibility_search=1']
        })
      }
    );
    const data = await res.json();
    const resultados = (data.hits || []).slice(0, 3).map(h => {
      const nombre = h.name || '';
      const precioVal = h.price?.HNL?.default;
      const precio = precioVal ? `L. ${parseFloat(precioVal).toLocaleString('es-HN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '';
      const precioOriginal = h.price?.HNL?.default_original_formated || '';
      const detalle = precioOriginal ? `Precio regular: ${precioOriginal}` : 'Precio en línea';
      const url = h.url || `https://www.elgallomasgallo.com.hn/search?q=${encodeURIComponent(nombre)}`;
      return { nombre, precio, detalle, url };
    }).filter(r => r.nombre && r.precio);

    console.log(`El Gallo: ${resultados.length} resultados`);
    return resultados.length > 0 ? { tienda: 'El Gallo Más Gallo', productos: resultados } : null;
  } catch (e) {
    console.error('El Gallo error:', e.message);
    return null;
  }
}

// ── JETSTEREO (Elastic App Search) ──────────────────────────
async function buscarJetstereo(producto) {
  try {
    const res = await fetch(
      'https://jetstereo-search-engine.ent.us-west-1.aws.found.io/api/as/v1/engines/jetstereo-main-engine/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer search-5t4ro38vq5xc6femwcezfixr'
        },
        body: JSON.stringify({
          query: producto,
          page: { current: 1, size: 3 },
          filters: { all: [{ sale_status: 'AVAILABLE' }] },
          precision: 3
        })
      }
    );
    const data = await res.json();
    const resultados = (data.results || []).slice(0, 3).map(r => {
      const nombre = r.name?.raw || '';
      const precioVal = r.price_gral?.raw;
      let precio = '';
      if (precioVal && !isNaN(parseFloat(precioVal))) {
        precio = `L. ${parseFloat(precioVal).toLocaleString('es-HN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      } else if (r.price?.raw) {
        try {
          const priceObj = typeof r.price.raw === 'string' ? JSON.parse(r.price.raw) : r.price.raw;
          const val = priceObj.sale || priceObj.regular;
          if (val) precio = `L. ${parseFloat(val).toLocaleString('es-HN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        } catch (e) {}
      }
      const detalle = r.main_category?.raw || 'Disponible';
      const slug = r.slug?.raw || '';
      const id = r._meta?.id || '';
      // Store both slug and ID to match after Groq selection
      const url = slug ? `https://www.jetstereo.com/product/${slug}` : `https://www.jetstereo.com/resultados-de-busqueda?q=${encodeURIComponent(nombre)}`;
      return { nombre, precio, detalle, url, _id: id, _slug: slug };
    }).filter(r => r.nombre && r.precio);

    console.log(`Jetstereo: ${resultados.length} resultados`);
    return resultados.length > 0 ? { tienda: 'Jetstereo', productos: resultados } : null;
  } catch (e) {
    console.error('Jetstereo error:', e.message);
    return null;
  }
}

// ── DIUNSA (API interna dapplications) ──────────────────────
async function buscarDiunsa(producto) {
  try {
    const res = await fetch(
      'https://apicsm.dapplications.tech/api/em/material/paginate?skip=0&take=5',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://www.diunsa.hn',
          'Referer': 'https://www.diunsa.hn/'
        },
        body: JSON.stringify({
          businessPartner: 1,
          storeId: null,
          groupCode: '0',
          officeCode: '0',
          type: 'PD',
          sortBy: 'category',
          sortOption: 'ASC',
          search: producto,
          filter: { priceMin: null, priceMax: null, brand: null }
        })
      }
    );
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    const items = data.data || [];
    // Ordenar por precio antes de tomar los primeros 3
    const itemsOrdenados = [...items].sort((a, b) => {
      const pa = parseFloat(a.newPrice || a.oldPrice || 999999);
      const pb = parseFloat(b.newPrice || b.oldPrice || 999999);
      return pa - pb;
    });
    const resultados = itemsOrdenados.slice(0, 3).map(item => {
      const nombre = item.name || '';
      const precioVal = item.newPrice || item.oldPrice || '';
      const precio = precioVal ? `L. ${parseFloat(precioVal).toLocaleString('es-HN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '';
      const detalle = item.discount && parseFloat(item.discount) > 0 ? `${Math.round(parseFloat(item.discount))}% de descuento` : 'Precio en línea';
      const slug = item.slug || '';
      const code = item.externalKeys?.code || item.code || '';
      // Use slug for direct product page, fallback to search with exact name
      const url = slug ? `https://www.diunsa.hn/${slug}` : 
                  code ? `https://www.diunsa.hn/todos?search=${encodeURIComponent(code)}` :
                  `https://www.diunsa.hn/todos?search=${encodeURIComponent(nombre)}`;
      return { nombre, precio, detalle, url };
    }).filter(r => r.nombre && r.precio);

    console.log(`Diunsa: ${resultados.length} resultados`);
    return resultados.length > 0 ? { tienda: 'Diunsa', productos: resultados } : null;
  } catch (e) {
    console.error('Diunsa error:', e.message);
    return null;
  }
}

// ── PRE-FILTRO DE RELEVANCIA ────────────────────────────────
function esProductoExacto(nombreProducto, nombreBuscado) {
  const buscado = nombreBuscado.toLowerCase();
  const producto = nombreProducto.toLowerCase();
  
  // Extraer palabras del término buscado (ignorar artículos)
  const ignorar = ['de', 'el', 'la', 'los', 'las', 'un', 'una', 'con', 'para', 'y', 'o'];
  const palabrasBuscadas = buscado.split(/\s+/).filter(w => w.length > 1 && !ignorar.includes(w));
  
  // Variantes de modelo que son obligatorias (pro, lite, ultra, etc.)
  const variantes = ['pro', 'lite', 'ultra', 'max', 'plus', 'mini', 'air', 'se', 'neo', '5g'];
  const variantesBuscadas = palabrasBuscadas.filter(w => variantes.includes(w));
  
  // Números que son parte del nombre del modelo (no especificaciones)
  // "magic 8 lite" -> 8 es modelo; "8gb" -> 8 es especificación
  const numerosModelo = [];
  for (let i = 0; i < palabrasBuscadas.length; i++) {
    const w = palabrasBuscadas[i];
    if (/^\d+$/.test(w) && parseInt(w) < 10000) {
      // Es número de modelo si no va seguido de gb/tb/ram/etc en la búsqueda
      const siguiente = palabrasBuscadas[i+1] || '';
      if (!/^(gb|tb|ram|hz|w|mp|mah|pulgadas|pulg)$/i.test(siguiente)) {
        numerosModelo.push(w);
      }
    }
  }
  
  // 1. Verificar variantes obligatorias (pro, lite, etc.)
  for (const v of variantesBuscadas) {
    if (!producto.includes(v)) return false;
  }
  
  // 2. Verificar números de modelo
  for (const n of numerosModelo) {
    // El número debe aparecer en el producto
    // Pero NO debe aparecer SOLO como especificación (8gb, 256gb, etc.)
    const regex = new RegExp('\\b' + n + '\\b', 'i');
    if (!regex.test(producto)) return false;
    
    // Verificar que no sea solo especificación
    const soloEspecificacion = new RegExp('\\b' + n + '\\s*(gb|tb|ram|hz|w|mp|mah|"|pulgadas)', 'i');
    const apareceSoloComoSpec = soloEspecificacion.test(producto) && 
      (producto.match(new RegExp('\\b' + n + '\\b', 'gi')) || []).length === 
      (producto.match(new RegExp('\\b' + n + '\\s*(gb|tb|ram|hz|w|mp|mah|"|pulgadas)', 'gi')) || []).length;
    
    if (apareceSoloComoSpec) return false;
  }
  
  // 3. Las palabras principales deben coincidir
  const palabrasPrincipales = palabrasBuscadas.filter(w => !variantes.includes(w) && !/^\d+$/.test(w));
  const coincidencias = palabrasPrincipales.filter(w => producto.includes(w)).length;
  const umbral = Math.max(1, Math.ceil(palabrasPrincipales.length * 0.7));
  
  return coincidencias >= umbral;
}

function filtrarRelevantes(producto, resultados) {
  return resultados.map(r => {
    const exactos = r.productos.filter(p => esProductoExacto(p.nombre, producto));
    const sugeridos = r.productos.filter(p => !esProductoExacto(p.nombre, producto));
    return {
      tienda: r.tienda,
      productos: exactos,
      sugerencias: sugeridos
    };
  });
}

// ── GROQ ANÁLISIS + CLASIFICACIÓN ──────────────────────────
async function analizarConIA(producto, resultados) {
  const resumen = resultados.map(r =>
    `${r.tienda}:\n${r.productos.map(p => `  - ${p.nombre}: ${p.precio}`).join('\n')}`
  ).join('\n\n');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Eres HonduPrice, comparador de precios de Honduras.
El usuario busca exactamente: "${producto}"

Resultados obtenidos de las tiendas:
${resumen}

Tu tarea es clasificar CADA producto en dos categorías:
1. "productos": Los que son EXACTAMENTE el modelo buscado (misma marca, mismo modelo, mismo número de versión)
2. "sugerencias": Los que son similares pero NO son exactamente el modelo buscado (diferente número de versión, diferente variante, etc.)

Ejemplo: si buscan "Honor Magic 8 Lite", el "Honor Magic 7 Lite" va en sugerencias, el "Honor Magic 8 Lite" va en productos.
Ejemplo: si buscan "iPhone 16", el "iPhone 17" va en sugerencias, el "iPhone 16" va en productos.
Ejemplo: si buscan "Samsung 55 4K", el "Samsung 65 4K" va en sugerencias.

Responde SOLO JSON válido sin texto extra:
{
  "titulo": "nombre del producto buscado",
  "productos": [
    {
      "tienda": "nombre exacto de la tienda",
      "nombre": "nombre exacto del producto",
      "precio": "precio exacto",
      "detalle": "característica breve"
    }
  ],
  "sugerencias_ia": [
    {
      "tienda": "nombre exacto de la tienda",
      "nombre": "nombre exacto del producto",
      "precio": "precio exacto",
      "detalle": "por qué es similar pero diferente"
    }
  ],
  "analisis": "2 oraciones comparando los precios exactos encontrados y cuál conviene más"
}
Ordena productos de menor a mayor precio. Si no hay productos exactos, deja productos vacío y pon todo en sugerencias.`
      }]
    })
  });
  const data = await res.json();
  const text = data.choices[0].message.content.trim().replace(/\`\`\`json|\`\`\`/g, '').trim();
  return JSON.parse(text);
}

// ── RUTA PRINCIPAL ───────────────────────────────────────────
app.post('/buscar', async (req, res) => {
  const { producto } = req.body;
  if (!producto) return res.status(400).json({ error: 'Falta el producto' });

  // Normalizar búsqueda: agregar espacio entre letras y números (magic7 -> magic 7)
  const productoNorm = producto.replace(/([a-zA-Z])([0-9])/g, '$1 $2').replace(/([0-9])([a-zA-Z])/g, '$1 $2');
  console.log(`\nBuscando: "${productoNorm}"`);

  try {
    const [gallo, jetstereo, diunsa] = await Promise.allSettled([
      buscarGallo(productoNorm),
      buscarJetstereo(productoNorm),
      buscarDiunsa(productoNorm)
    ]);

    const resultados = [gallo, jetstereo, diunsa]
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);

    console.log(`Tiendas con resultados: ${resultados.map(r => r.tienda).join(', ') || 'ninguna'}`);

    if (resultados.length === 0) {
      return res.status(404).json({ error: 'No se encontraron resultados en las tiendas' });
    }

    // Separar resultados exactos de sugerencias
    const todosFiltrados = filtrarRelevantes(productoNorm, resultados);
    const resultadosExactos = todosFiltrados.filter(r => r.productos.length > 0);
    
    // Recolectar sugerencias de todas las tiendas
    const sugerencias = [];
    todosFiltrados.forEach(r => {
      r.sugerencias.forEach(p => {
        sugerencias.push({ tienda: r.tienda, ...p });
      });
    });

    if (resultadosExactos.length === 0 && sugerencias.length === 0) {
      return res.status(404).json({ error: 'No se encontraron resultados para ese producto' });
    }

    const analisis = await analizarConIA(productoNorm, resultadosExactos.length > 0 ? resultadosExactos : todosFiltrados);
    // Combinar sugerencias del filtro con sugerencias de la IA
    const sugerenciasIA = analisis.sugerencias_ia || [];
    const todasSugerencias = [...sugerenciasIA, ...sugerencias].slice(0, 5);
    
    // Restaurar URLs a sugerencias de la IA
    todasSugerencias.forEach(s => {
      if (!s.url) {
        const tiendaData = resultados.find(r => r.tienda === s.tienda);
        if (tiendaData) {
          const prod = tiendaData.productos.find(p => p.nombre === s.nombre) || tiendaData.productos[0];
          if (prod?.url) s.url = prod.url;
        }
      }
    });
    
    analisis.sugerencias = todasSugerencias;
    delete analisis.sugerencias_ia;

    // Asegurar que todas las tiendas aparezcan
    const tiendasEnAnalisis = new Set(analisis.productos.map(p => p.tienda));
    resultados.forEach(r => {
      if (!tiendasEnAnalisis.has(r.tienda) && r.productos.length > 0) {
        const p = r.productos[0];
        analisis.productos.push({
          tienda: r.tienda,
          nombre: p.nombre,
          precio: p.precio,
          detalle: p.detalle || 'Disponible en tienda',
          url: p.url || ''
        });
      }
    });

    // Agregar URLs a los productos del análisis de Groq
    // Groq no devuelve URLs, las buscamos en los resultados originales
    analisis.productos = analisis.productos.map(ap => {
      if (ap.url) return ap;
      // Buscar URL en resultados originales por tienda
      const tiendaData = resultados.find(r => r.tienda === ap.tienda);
      if (tiendaData) {
        // Buscar el producto más similar por nombre
        // Try exact match first, then partial, then first result
        const prod = tiendaData.productos.find(p => p.nombre === ap.nombre) ||
          tiendaData.productos.find(p => 
            p.nombre.toLowerCase().includes(ap.nombre.toLowerCase().substring(0, 25)) ||
            ap.nombre.toLowerCase().includes(p.nombre.toLowerCase().substring(0, 25))
          ) || tiendaData.productos[0];
        if (prod?.url) ap.url = prod.url;
      }
      return ap;
    });

    // Ordenar por precio
    const limpiarPrecio = p => parseFloat((p.precio || '').replace(/L\.?\s*/gi, '').replace(/,/g, '').trim()) || 999999;
    analisis.productos.sort((a, b) => limpiarPrecio(a) - limpiarPrecio(b));
    
    // Calcular ahorro
    if (analisis.productos.length >= 2) {
      const precios = analisis.productos.map(limpiarPrecio).filter(p => p < 999999);
      const minPrecio = Math.min(...precios);
      const maxPrecio = Math.max(...precios);
      analisis.ahorro = maxPrecio - minPrecio;
    }

    res.json(analisis);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'OK', tiendas: ['El Gallo Más Gallo', 'Jetstereo', 'Diunsa'] }));

app.listen(3001, () => console.log('HonduPrice Server corriendo en http://localhost:3001'));
