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
        precio = `L. ${parseFloat(precioVal).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      } else if (r.price?.raw) {
        try {
          const priceObj = typeof r.price.raw === 'string' ? JSON.parse(r.price.raw) : r.price.raw;
          const val = priceObj.sale || priceObj.regular;
          if (val) precio = `L. ${parseFloat(val).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

// ── GROQ ANÁLISIS ────────────────────────────────────────────
async function analizarConIA(producto, resultados) {
  const resumen = resultados.map(r =>
    `${r.tienda}:\n${r.productos.map(p => `  - ${p.nombre}: ${p.precio}`).join('\n')}`
  ).join('\n\n');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Eres HonduPrice, comparador de precios de Honduras.
El usuario busca: "${producto}"

Resultados REALES extraídos de las tiendas:
${resumen}

INSTRUCCIONES ESTRICTAS:\n- Incluye SOLO productos que coincidan con la marca Y modelo exacto buscado\n- Si una tienda devuelve producto de marca diferente (ej: buscaron LG y aparece Frigidaire), NO lo incluyas\n- Si el modelo es diferente (ej: buscaron i5 y aparece i3, buscaron iPhone 16 y aparece iPhone 17), NO lo incluyas\n- Si una tienda no tiene el producto exacto, no la incluyas\n- Conserva los precios EXACTAMENTE como aparecen\n- Ordena de menor a mayor precio\n- En el analisis menciona si alguna tienda no tenia el producto exacto\n\nResponde SOLO JSON válido sin texto extra:
{
  "titulo": "nombre del producto",
  "productos": [
    {
      "tienda": "nombre exacto de la tienda",
      "nombre": "nombre exacto del producto",
      "precio": "precio exacto",
      "detalle": "característica breve"
    }
  ],
  "analisis": "2 oraciones comparando precios y cuál conviene más"
}`
      }]
    })
  });
  const data = await res.json();
  const text = data.choices[0].message.content.trim().replace(/```json|```/g, '').trim();
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

    const analisis = await analizarConIA(productoNorm, resultados);

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
