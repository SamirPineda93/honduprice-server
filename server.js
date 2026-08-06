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
      body: JSON.stringify({ query: producto, hitsPerPage: 8, attributesToRetrieve: ['name', 'price', 'url'], numericFilters: ['visibility_search=1'] })
    });
    const data = await res.json();
    const resultados = (data.hits || []).slice(0, 8).map(h => {
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

// ── JETSTEREO ────────────────────────────────────────────────
async function buscarJetstereo(producto) {
  try {
    const res = await fetch('https://jetstereo-search-engine.ent.us-west-1.aws.found.io/api/as/v1/engines/jetstereo-main-engine/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer search-5t4ro38vq5xc6femwcezfixr' },
      body: JSON.stringify({ query: producto, page: { current: 1, size: 8 }, filters: { all: [{ sale_status: 'AVAILABLE' }] }, precision: 3 })
    });
    const data = await res.json();
    const resultados = (data.results || []).slice(0, 8).map(r => {
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
    const res = await fetch('https://apicsm.dapplications.tech/api/em/material/paginate?skip=0&take=20', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Origin': 'https://www.diunsa.hn', 'Referer': 'https://www.diunsa.hn/' },
      body: JSON.stringify({ businessPartner: 1, storeId: null, groupCode: '0', officeCode: '0', type: 'PD', sortBy: 'category', sortOption: 'ASC', search: producto, filter: { priceMin: null, priceMax: null, brand: null } })
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    const items = data.data || [];
    const resultados = items.slice(0, 6).map(item => {
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

// ── GROQ ANÁLISIS ────────────────────────────────────────────
async function analizarConIA(producto, resultados) {
  const resumen = resultados.map(r =>
    `${r.tienda}:\n${r.productos.map(p => `  - ${p.nombre}: ${p.precio}`).join('\n')}`
  ).join('\n\n');

  const prompt = `Eres HonduPrice, comparador de precios de Honduras.
El usuario busca: "${producto}"

Resultados REALES de las tiendas:
${resumen}

REGLA PRINCIPAL: El número de versión del modelo es OBLIGATORIO.
- Si buscan "Magic 8", el "Magic 7" NO es el mismo producto aunque sea similar
- Si buscan "iPhone 16", el "iPhone 17" NO es el mismo producto
- Si buscan "S23", el "S24" o "S25" NO son el mismo producto
- El nombre puede estar escrito diferente (mayúsculas, sin espacio) pero el número debe coincidir

INSTRUCCIONES:
- Incluye SOLO productos donde el número de versión coincida exactamente con el buscado
- "CELULAR HONOR MAGIC 8 LITE" y "Honor Magic8 Lite" son el MISMO (ambos tienen 8)
- "CELULAR HONOR MAGIC 7 LITE" NO es Magic 8 Lite (número diferente)
- Si una tienda solo tiene versiones diferentes, no la incluyas
- Conserva los precios EXACTAMENTE como aparecen
- Ordena de menor a mayor precio
- Por cada tienda incluye solo la opción más barata del modelo exacto

Responde SOLO JSON sin texto extra:
{
  "titulo": "nombre del producto",
  "productos": [
    {"tienda": "nombre exacto", "nombre": "nombre exacto", "precio": "precio exacto", "detalle": "característica breve"}
  ],
  "analisis": "2 oraciones comparando precios reales y cuál conviene más"
}`;

  console.log('\n=== ENVIANDO A GROQ ===');
  console.log(resumen);
  console.log('======================\n');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] })
  });
  console.log('Groq status:', res.status);
  const data = await res.json();
  if (!data.choices || !data.choices[0]) {
    console.error('Groq response error:', JSON.stringify(data).substring(0, 500));
    throw new Error('Groq no devolvio respuesta valida: ' + JSON.stringify(data).substring(0, 200));
  }
  const text = data.choices[0].message.content.trim().replace(/```json|```/g, '').trim();
  // Extraer solo el JSON si hay texto extra
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No se encontro JSON en respuesta de Groq');
  return JSON.parse(jsonMatch[0]);
}

// ── RUTA PRINCIPAL ───────────────────────────────────────────
app.post('/buscar', async (req, res) => {
  const { producto } = req.body;
  if (!producto) return res.status(400).json({ error: 'Falta el producto' });

  const productoNorm = producto.trim();
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

    let analisis;
    try {
      analisis = await analizarConIA(productoNorm, resultados);
    } catch(groqError) {
      console.error('Groq fallo, usando fallback:', groqError.message);
      // Fallback: mostrar todos los resultados sin filtro de IA
      const todosProductos = [];
      resultados.forEach(r => {
        r.productos.slice(0, 2).forEach(p => {
          todosProductos.push({ tienda: r.tienda, nombre: p.nombre, precio: p.precio, detalle: p.detalle, url: p.url });
        });
      });
      todosProductos.sort((a, b) => {
        const limpiar = p => parseFloat((p.precio || '').replace(/L\.?\s*/gi, '').replace(/,/g, '').trim()) || 999999;
        return limpiar(a) - limpiar(b);
      });
      analisis = {
        titulo: productoNorm,
        productos: todosProductos,
        analisis: 'Resultados encontrados en las tiendas. El precio más bajo aparece primero.'
      };
    }

    // Restaurar URLs
    (analisis.productos || []).forEach(p => {
      const tiendaData = resultados.find(r => r.tienda === p.tienda);
      if (tiendaData) {
        const prod = tiendaData.productos.find(pr => pr.nombre === p.nombre) || tiendaData.productos[0];
        if (prod?.url) p.url = prod.url;
      }
    });

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
