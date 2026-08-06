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
    const res = await fetch(`https://${APP_ID}-dsn.algolia.net/1/indexes/${INDEX}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Algolia-Application-Id': APP_ID, 'X-Algolia-API-Key': API_KEY },
      body: JSON.stringify({ query: producto, hitsPerPage: 5, attributesToRetrieve: ['name', 'price', 'url'], numericFilters: ['visibility_search=1'] })
    });
    const data = await res.json();
    const resultados = (data.hits || []).slice(0, 5).map(h => {
      const nombre = h.name || '';
      const precioVal = h.price?.HNL?.default;
      const precio = precioVal ? `L. ${parseFloat(precioVal).toLocaleString('es-HN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '';
      const detalle = h.price?.HNL?.default_original_formated ? `Precio regular: ${h.price.HNL.default_original_formated}` : 'Precio en línea';
      const url = h.url || `https://www.elgallomasgallo.com.hn/search?q=${encodeURIComponent(nombre)}`;
      return { nombre, precio, detalle, url };
    }).filter(r => r.nombre && r.precio);
    console.log(`El Gallo: ${resultados.length} resultados`);
    return resultados.length > 0 ? { tienda: 'El Gallo Más Gallo', productos: resultados } : null;
  } catch (e) { console.error('El Gallo error:', e.message); return null; }
}

// ── JETSTEREO (Elastic App Search) ──────────────────────────
async function buscarJetstereo(producto) {
  try {
    const res = await fetch('https://jetstereo-search-engine.ent.us-west-1.aws.found.io/api/as/v1/engines/jetstereo-main-engine/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer search-5t4ro38vq5xc6femwcezfixr' },
      body: JSON.stringify({ query: producto, page: { current: 1, size: 5 }, filters: { all: [{ sale_status: 'AVAILABLE' }] }, precision: 3 })
    });
    const data = await res.json();
    const resultados = (data.results || []).slice(0, 5).map(r => {
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
      const url = slug ? `https://www.jetstereo.com/product/${slug}` : `https://www.jetstereo.com/resultados-de-busqueda?q=${encodeURIComponent(nombre)}`;
      return { nombre, precio, detalle, url };
    }).filter(r => r.nombre && r.precio);
    console.log(`Jetstereo: ${resultados.length} resultados`);
    return resultados.length > 0 ? { tienda: 'Jetstereo', productos: resultados } : null;
  } catch (e) { console.error('Jetstereo error:', e.message); return null; }
}

// ── DIUNSA ───────────────────────────────────────────────────
async function buscarDiunsa(producto) {
  try {
    const res = await fetch('https://apicsm.dapplications.tech/api/em/material/paginate?skip=0&take=8', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Origin': 'https://www.diunsa.hn', 'Referer': 'https://www.diunsa.hn/' },
      body: JSON.stringify({ businessPartner: 1, storeId: null, groupCode: '0', officeCode: '0', type: 'PD', sortBy: 'category', sortOption: 'ASC', search: producto, filter: { priceMin: null, priceMax: null, brand: null } })
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    const items = data.data || [];
    const itemsOrdenados = [...items].sort((a, b) => parseFloat(a.newPrice || 999999) - parseFloat(b.newPrice || 999999));
    const resultados = itemsOrdenados.slice(0, 5).map(item => {
      const nombre = item.name || '';
      const precioVal = item.newPrice || item.oldPrice || '';
      const precio = precioVal ? `L. ${parseFloat(precioVal).toLocaleString('es-HN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '';
      const detalle = item.discount && parseFloat(item.discount) > 0 ? `${Math.round(parseFloat(item.discount))}% de descuento` : 'Precio en línea';
      const slug = item.slug || '';
      const code = item.externalKeys?.code || '';
      const url = slug ? `https://www.diunsa.hn/${slug}` : code ? `https://www.diunsa.hn/todos?search=${encodeURIComponent(code)}` : `https://www.diunsa.hn/todos?search=${encodeURIComponent(nombre)}`;
      return { nombre, precio, detalle, url };
    }).filter(r => r.nombre && r.precio);
    console.log(`Diunsa: ${resultados.length} resultados`);
    return resultados.length > 0 ? { tienda: 'Diunsa', productos: resultados } : null;
  } catch (e) { console.error('Diunsa error:', e.message); return null; }
}

// ── GROQ: CLASIFICAR EXACTOS VS SUGERENCIAS ──────────────────
async function analizarConIA(producto, resultados) {
  const resumen = resultados.map(r =>
    `${r.tienda}:\n${r.productos.map(p => `  - ${p.nombre}: ${p.precio}`).join('\n')}`
  ).join('\n\n');

  const prompt = `Eres HonduPrice, comparador de precios de Honduras.
El usuario busca exactamente: "${producto}"

Resultados obtenidos de las tiendas:
${resumen}

Clasifica CADA producto en dos categorías:
1. "productos": Los que son EXACTAMENTE el modelo buscado (misma marca, mismo número de versión, misma variante)
2. "sugerencias_ia": Los que son similares pero NO exactamente el modelo (diferente número, diferente variante)

Ejemplos de clasificación:
- Buscan "Honor Magic 8 Lite" → "Honor Magic 7 Lite" va en sugerencias_ia
- Buscan "iPhone 16" → "iPhone 17" va en sugerencias_ia
- Buscan "Samsung Galaxy S23 Ultra" → "Samsung Galaxy S23" sin Ultra va en sugerencias_ia
- Buscan "televisor Samsung 55" → "televisor Samsung 65" va en sugerencias_ia

Responde SOLO JSON sin texto extra:
{
  "titulo": "nombre del producto buscado",
  "productos": [
    {"tienda": "tienda exacta", "nombre": "nombre exacto", "precio": "precio exacto", "detalle": "característica"}
  ],
  "sugerencias_ia": [
    {"tienda": "tienda exacta", "nombre": "nombre exacto", "precio": "precio exacto", "detalle": "por qué es similar"}
  ],
  "analisis": "2 oraciones comparando precios de los productos exactos"
}
Ordena productos de menor a mayor precio.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
  });
  const data = await res.json();
  const text = data.choices[0].message.content.trim().replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

// ── RUTA PRINCIPAL ───────────────────────────────────────────
app.post('/buscar', async (req, res) => {
  const { producto } = req.body;
  if (!producto) return res.status(400).json({ error: 'Falta el producto' });

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

    // Groq clasifica exactos vs sugerencias
    const analisis = await analizarConIA(productoNorm, resultados);

    // Restaurar URLs a sugerencias de la IA
    const sugerenciasIA = analisis.sugerencias_ia || [];
    sugerenciasIA.forEach(s => {
      const tiendaData = resultados.find(r => r.tienda === s.tienda);
      if (tiendaData) {
        const prod = tiendaData.productos.find(p => p.nombre === s.nombre) || tiendaData.productos[0];
        if (prod?.url) s.url = prod.url;
      }
    });

    // Restaurar URLs a productos exactos
    (analisis.productos || []).forEach(p => {
      const tiendaData = resultados.find(r => r.tienda === p.tienda);
      if (tiendaData) {
        const prod = tiendaData.productos.find(pr => pr.nombre === p.nombre) || tiendaData.productos[0];
        if (prod?.url) p.url = prod.url;
      }
    });

    analisis.sugerencias = sugerenciasIA.slice(0, 5);
    delete analisis.sugerencias_ia;

    // Ordenar por precio
    (analisis.productos || []).sort((a, b) => {
      const limpiar = p => parseFloat((p.precio || '').replace(/L\.?\s*/gi, '').replace(/,/g, '').trim()) || 999999;
      return limpiar(a) - limpiar(b);
    });

    res.json(analisis);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'OK', tiendas: ['El Gallo Más Gallo', 'Diunsa', 'Jetstereo'] }));

app.listen(3001, () => console.log('HonduPrice Server corriendo en http://localhost:3001'));
