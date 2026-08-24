(async function () {
  const loadingEl = document.getElementById('loading');
  const errorEl   = document.getElementById('error');
  const errorMsg  = document.getElementById('error-msg');
  const resultEl  = document.getElementById('result');

  function showError(msg) {
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    errorMsg.textContent = msg;
  }

  // --- 1. Read URL parameters ---
  const params    = new URLSearchParams(window.location.search);
  const supplier  = (params.get('Supplier') || '').trim();
  const brand     = (params.get('Brand')    || '').trim();
  const code      = (params.get('Code')     || '').trim();

  if (!supplier || !brand || !code) {
    showError('Missing URL parameters. Usage: ?Supplier=<name>&Brand=<name>&Code=<code>');
    return;
  }

  // --- 2. Load sql.js and the database binary ---
  let SQL;
  try {
    SQL = await initSqlJs(window.sqlJsConfig);
  } catch (e) {
    showError('Failed to load the SQL engine: ' + e.message);
    return;
  }

  let db;
  try {
    const resp = await fetch('products.db?t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const buf  = await resp.arrayBuffer();
    db = new SQL.Database(new Uint8Array(buf));
  } catch (e) {
    showError('Failed to load the database: ' + e.message);
    return;
  }

  // --- 3. Query ---
  const selectCols = `
      p.code, 
      p.[group],  
      p.chemistry,
      p.voltage, 
      p.capacity, 
      p.rc, 
      p.ccaen, 
      p.ccasae, 
      p.weight,
      b.name AS brand_name,
      s.name           AS supplier_name,
      s.commercialname AS supplier_commercialname,
      s.vat            AS supplier_vat,
      s.subject        AS supplier_subject,
      s.street         AS supplier_street,
      s.city           AS supplier_city,
      s.country        AS supplier_country,
      s.telephone      AS supplier_telephone,
      s.website_url    AS supplier_website,
      s.production_code_img AS supplier_production_code_img,
      m.manufacturing_date        AS manufacturing_date,
      m.hazardous_substances      AS hazardous_substances,
      m.critical_raw_materials    AS critical_raw_materials,
      m.extinguishing_agents      AS extinguishing_agents,
      m.declaration_of_conformity AS declaration_of_conformity
    FROM Product p
    JOIN Brand       b ON p.brand_name    = b.name
    JOIN Supplier    s ON p.supplier_name = s.name
    LEFT JOIN Manufacture m ON m.supplier_name = s.name`;

  const sqlExact    = `SELECT ${selectCols} WHERE LOWER(s.name) = LOWER(?) AND LOWER(b.name) = LOWER(?) AND LOWER(REPLACE(p.code, ' ', '')) = LOWER(REPLACE(?, ' ', ''))`;
  const sqlFallback = `SELECT ${selectCols} WHERE LOWER(s.name) = LOWER(?) AND LOWER(REPLACE(p.code, ' ', '')) = LOWER(REPLACE(?, ' ', '')) LIMIT 1`;

  function runQuery(sql, params) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const result = [];
    while (stmt.step()) result.push(stmt.getAsObject());
    stmt.free();
    return result;
  }

  let rows = [];
  let usedFallback = false;
  try {
    rows = runQuery(sqlExact, [supplier, brand, code]);
    if (rows.length === 0) {
      rows = runQuery(sqlFallback, [supplier, code]);
      if (rows.length > 0) {
        // Override brand_name with the value from the URL parameter
        rows[0].brand_name = brand;
        usedFallback = true;
      }
    }
  } catch (e) {
    showError('Query error: ' + e.message);
    db.close();
    return;
  }
  db.close();

  loadingEl.classList.add('hidden');

  if (rows.length === 0) {
    showError(`No product found for Supplier "${supplier}", Brand "${brand}" and Code "${code}".`);
    return;
  }

  // --- 4. Render ---
  const r = rows[0];

  const specRows = [
    ['Category',  r.group],
    ['Chemistry', r.chemistry],
    ['Voltage',   r.voltage  != null ? r.voltage  + ' V'   : '—'],
    ['Capacity',  r.capacity != null ? r.capacity + ' Ah'  : '—'],
    ['RC',        r.rc       != null ? r.rc        + ' min' : '—'],
    ['CCA (EN)',  r.ccaen    != null ? r.ccaen     + ' A'   : '—'],
    ['CCA (SAE)', r.ccasae   != null ? r.ccasae    + ' A'   : '—'],
    ['Weight',    r.weight   != null ? r.weight + '± 5% kg' : '—'],
    [
      'Manufacturing Date',
      r.manufacturing_date
        ? (r.supplier_production_code_img
            ? `${esc(r.manufacturing_date)}. See pattern <a href="img/${esc(r.supplier_production_code_img)}" target="_blank">here</a>`
            : esc(r.manufacturing_date))
        : '—',
      true
    ],
  ];

  const specHTML = specRows.map(([label, val, isHTML]) => `
    <tr>
      <th>${esc(label)}</th>
      <td>${isHTML ? val : esc(String(val ?? '—'))}</td>
    </tr>
  `).join('');

  const websiteHTML = r.supplier_website
    ? `<a href="${esc(r.supplier_website)}" target="_blank" rel="noopener">${esc(r.supplier_website)}</a>`
    : '—';

  const addressParts = [r.supplier_street, r.supplier_city, r.supplier_country].filter(Boolean);
  const addressHTML  = addressParts.length ? esc(addressParts.join(', ')) : '—';

  resultEl.innerHTML = `
    <div class="product-card">
      <div class="product-card-header">
        <span class="product-badge">${esc(r.brand_name)}</span>
        <h2>${esc(r.code)}</h2>
      </div>

      <section class="card-section">
        <h3>Manufacturer</h3>
        <dl class="supplier-info">
          <div class="dl-row"><dt>Name</dt><dd>${esc(r.supplier_commercialname ?? '—')}</dd></div>
          <div class="dl-row"><dt>Address</dt><dd>${addressHTML}</dd></div>
          <div class="dl-row"><dt>Telephone</dt><dd>${esc(r.supplier_telephone ?? '—')}</dd></div>
          <div class="dl-row"><dt>Website</dt><dd>${websiteHTML}</dd></div>
        </dl>
      </section>

      <section class="card-section">
        <h3>Specifications</h3>
        <table class="spec-table">
          <tbody>${specHTML}</tbody>
        </table>
      </section>

      <section class="card-section">
        <h3>Composition</h3>
        <dl class="supplier-info">
          <div class="dl-row"><dt>Hazardous Substances</dt><dd>${esc(r.hazardous_substances ?? '—')}</dd></div>
          <div class="dl-row"><dt>Critical Raw Materials</dt><dd>${esc(r.critical_raw_materials ?? '—')}</dd></div>
          <div class="dl-row"><dt>Extinguishing Agents</dt><dd>${esc(r.extinguishing_agents ?? '—')}</dd></div>
        </dl>
      </section>

      <section class="card-section">
        <h3>Safety and Handling Information</h3>
        <ul class="safety-list">
          <li>Due to hydrogen gas generated from battery, handling without care can cause fire and explosion.</li>
          <li>This 12V battery is only for starting engine. Do not apply this product for other uses.</li>
          <li>Charge this battery only at well ventilated places, and avoid shorts or sparks.</li>
          <li>Refer to the instruction manual of vehicle or battery before using booster cable.</li>
          <li>Sulfuric acid may cause blindness or severe burn. In case eyes, skin, clothes or any articles are stained with acid, flush objects immediately with water. If acid being swallowed, drink plenty of water promptly.</li>
          <li>In case of accidental contact, consult a doctor immediately.</li>
          <li>Battery filled with acid (do not tilt or spill)</li>
          <li>Flammable. Do not charge near fire or sparks</li>
          <li>Do not charge rapidly</li>
          <li>Do not disassemble the battery.</li>
        </ul>
        <img src="img/safety.png" alt="Safety icons" class="safety-img" />
      </section>

      <section class="card-section">
        <h3>Environmental and Recycling Information</h3>
        <ul class="safety-list">
          <li>Contains Lead (Pb). Recycle properly.</li>
          <li>Do NOT dispose of with household waste.</li>
          <li>Take the battery to authorized collection or recycling centers.</li>
          <li>Follow local environmental regulations for disposal.</li>
          <li>Prevent leakage or release into the environment.</li>
        </ul>
        <img src="img/recycling.png" alt="Recycling" class="recycling-img" />
      </section>

      <section class="card-section">
        <h3>EU Declaration of Conformity</h3>
        ${r.declaration_of_conformity
          ? `<a class="download-btn" href="assets/${esc(r.declaration_of_conformity)}.pdf" download="${esc(r.declaration_of_conformity)}.pdf">Download</a>`
          : '<p>—</p>'}
      </section>
    </div>
  `;

  resultEl.classList.remove('hidden');

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
