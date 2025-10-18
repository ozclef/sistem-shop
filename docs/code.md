



============= 3 c =============

¡Perfecto — todo eso tiene mucho sentido y lo vamos a dejar bien puesto: usuarios/roles, auditoría, cortes (X y Z), exportaciones, impresión de tickets y menú que enlace todo en tiempo real. Abajo te doy **un plan concreto** y **código listo** que puedes pegar en tu repo para añadir estas funciones ahora mismo (todo en cliente, usando `localStorage` y JSON como persistencia; persistirá aunque se apague la compu y se podrá exportar). Lo dejo en español y lo más práctico posible.

--------
# 1) Resumen corto de lo que voy a agregar (ya en tu flujo POS)

* Login / roles: `admin`, `cajero`, `auditor` (simulado en cliente con `users_pos` y `session` en `sessionStorage`).
* Audit log: cada acción importante (venta, editar inventario, import, export, consulta precio, corte) queda registrada en `audits_pos` en `localStorage` y se puede exportar.
* Cortes: `Corte X` (consulta intermedia), `Corte Z` (cierre / cierre de turno — genera reporte y marca cierre por turno). Ambos generan objetos exportables y entradas en `movements_pos` / `sales_pos` resumen.
* Reports: página `reports.html` con reconciliación (ventas vs movimientos), listado de tickets por rango, export CSV/JSON y función de arqueo (ingresar efectivo contado y comparar con caja).
* Botones export/backup: en admin y POS: descargar `inventory_pos`, `sales_pos`, `movements_pos`, `audits_pos`.
* Registro de consultas (ej. consultar precio) como eventos de auditoría para evitar “truquitos”.
* Protección admin: edición solo si session role = admin; si no, vistas readonly.

# 2) Cómo queda la persistencia (claves `localStorage`)

* `inventory_pos` — inventario actual (array)
* `sales_pos` — tickets (append-only)
* `movements_pos` — movimientos contables (append-only)
* `users_pos` — usuarios (array con username, salt+hash or simple password)
* `audits_pos` — logs de auditoría (append-only)
* `settings_pos` — config (tax, tienda, turno)
* `session` (sessionStorage) — usuario loggeado mientras dure la pestaña

# 3) Código a añadir (pegar dentro de tus archivos JS).

Pego funciones pequeñas y páginas: **auth.js**, mejoras en **storage-utils.js** (audit), `reports.html` (reconciliación y cortes).
Puedes copiar todo tal cual y añadir `<script src="auth.js"></script>` en tus páginas.

---

### 3.1 `auth.js` — login simple + roles (cliente)

```js
// auth.js
// Usuarios ejemplo: al inicio ejecuta createDefaultAdmin() si users_pos no existe
function hashSimple(s){ // no es seguro para prod, pero evita ver plain text
  let h = 0;
  for(let i=0;i<s.length;i++){ h = ((h<<5)-h) + s.charCodeAt(i); h |= 0; }
  return 'h'+Math.abs(h);
}

function createDefaultAdmin(){
  const key='users_pos';
  if(localStorage.getItem(key)) return;
  const users = [
    {username:'admin', password_hash:hashSimple('admin123'), role:'admin'},
    {username:'cajero', password_hash:hashSimple('cajero123'), role:'cajero'},
    {username:'auditor', password_hash:hashSimple('auditor123'), role:'auditor'}
  ];
  localStorage.setItem(key, JSON.stringify(users));
}

function login(username, password){
  const users = JSON.parse(localStorage.getItem('users_pos') || '[]');
  const h = hashSimple(password||'');
  const u = users.find(x=> x.username===username && x.password_hash===h);
  if(!u) throw new Error('Usuario o contraseña inválidos');
  // store session (sessionStorage)
  sessionStorage.setItem('session_user', JSON.stringify({username:u.username, role:u.role}));
  recordAudit('login', u.username, {role:u.role});
  return u;
}
function logout(){
  const s = JSON.parse(sessionStorage.getItem('session_user')||'null');
  if(s) recordAudit('logout', s.username, {});
  sessionStorage.removeItem('session_user');
}
function currentUser(){
  return JSON.parse(sessionStorage.getItem('session_user') || 'null');
}
createDefaultAdmin();
```

---

### 3.2 `storage-utils.js` — añadir `recordAudit()` y backups

(Agregar dentro del archivo que ya tienes)

```js
// añadir al final de storage-utils.js

function recordAudit(action, user, details){
  const key='audits_pos';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  const event = {
    id: 'A' + nowISO().slice(0,19).replace(/[:T-]/g,'') + '-' + String(arr.length+1).padStart(4,'0'),
    date: nowISO(),
    action,
    user: user || (currentUser && currentUser()?.username) || 'anon',
    details
  };
  arr.push(event);
  localStorage.setItem(key, JSON.stringify(arr));
  return event;
}

function exportAllBackup(){
  // Genera un objeto con todos los principales archivos y lo descarga
  const data = {
    inventory: JSON.parse(localStorage.getItem(KEY.INVENTORY) || '[]'),
    sales: JSON.parse(localStorage.getItem(KEY.SALES) || '[]'),
    movements: JSON.parse(localStorage.getItem(KEY.MOVEMENTS) || '[]'),
    audits: JSON.parse(localStorage.getItem('audits_pos') || '[]'),
    users: JSON.parse(localStorage.getItem('users_pos') || '[]'),
    settings: JSON.parse(localStorage.getItem(KEY.SETTINGS) || '{}')
  };
  downloadJSON('backup_proyecto_pos_' + nowISO().slice(0,19).replace(/[:T-]/g,'') + '.json', data);
  recordAudit('export_backup', currentUser()? currentUser().username: 'anon', {size: Object.keys(data).length});
}
```

> Nota: `currentUser()` proviene de `auth.js`. Si no lo importas en cierto orden, asegúrate de cargar `auth.js` antes.

---

### 3.3 Hooks importantes (modifica `sell()` y `admin` actions)

* Después de crear `sale` en `sell()` agrega:

```js
recordAudit('venta', cashier, {saleId: sale.id, items: sale.items.length, total_cents: sale.total_cents});
```

* Cuando un admin edite o importe inventario, agrega:

```js
recordAudit('edit_inventory', currentUser()?.username || 'admin', {action:'edit/item', id: prod.id});
```

* Ante cualquier consulta de precio:

```js
recordAudit('consulta_precio', currentUser()?.username || 'guest', {product_id: id});
```

---

### 3.4 `reports.html` — Corte X / Z + conciliación (archivo completo)

Crea un archivo `reports.html` con este contenido (lo dejo compacto):

```html
<!doctype html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Reports - POS</title>
<link rel="stylesheet" href="styles_pos.css"></head>
<body>
  <main style="max-width:1000px;margin:16px auto">
    <h1>Reports y Cortes</h1>
    <section>
      <div style="display:flex;gap:8px;align-items:center">
        <button id="btn-x">Generar Corte X (intermedio)</button>
        <button id="btn-z">Generar Corte Z (cierre turno)</button>
        <button id="btn-reconcile">Reconciliar ahora</button>
        <button id="btn-export-audits">Exportar auditoría</button>
      </div>
      <div id="report-output" style="margin-top:12px;white-space:pre-wrap;background:#fff;padding:12px;border-radius:8px"></div>
    </section>
    <section style="margin-top:12px">
      <h3>Arqueo / Cierre</h3>
      <label>Dinero contado (cash): <input id="arqueo-cash" type="number" step="0.01" /></label>
      <button id="btn-arqueo">Registrar Arqueo</button>
      <div id="arqueo-result" style="margin-top:8px"></div>
    </section>
  </main>

<script src="storage-utils.js"></script>
<script src="auth.js"></script>
<script>
async function loadAll(){
  const sales = JSON.parse(localStorage.getItem('sales_pos')||'[]');
  const movements = JSON.parse(localStorage.getItem('movements_pos')||'[]');
  const inventory = JSON.parse(localStorage.getItem('inventory_pos')||'[]');
  const audits = JSON.parse(localStorage.getItem('audits_pos')||'[]');
  return {sales, movements, inventory, audits};
}

function formatMoney(c){ return (c/100).toFixed(2); }

document.getElementById('btn-x').addEventListener('click', async ()=>{
  const {sales, movements} = await loadAll();
  // Corte X: totales desde inicio de día (o desde last Z)
  const lastZ = movements.slice().reverse().find(m=> m.type === 'corte_z');
  const since = lastZ ? new Date(lastZ.date) : new Date(new Date().setHours(0,0,0,0));
  const salesSince = sales.filter(s => new Date(s.date) >= since);
  const total = salesSince.reduce((s,x)=> s + (x.total_cents||0), 0);
  const out = `Corte X\nDesde: ${since.toISOString()}\nVentas: ${salesSince.length}\nTotal: ${formatMoney(total)}\n\nTickets:\n` + salesSince.map(s=> `${s.id} ${s.date} ${formatMoney(s.total_cents)}`).join('\n');
  document.getElementById('report-output').textContent = out;
  recordAudit('corte_x', currentUser()?.username || 'unknown', {since: since.toISOString(), total_cents: total, tickets: salesSince.length});
});

document.getElementById('btn-z').addEventListener('click', async ()=>{
  const {sales, movements} = await loadAll();
  const lastZ = movements.slice().reverse().find(m=> m.type === 'corte_z');
  const since = lastZ ? new Date(lastZ.date) : new Date(new Date().setHours(0,0,0,0));
  const salesSince = sales.filter(s => new Date(s.date) >= since);
  const total = salesSince.reduce((s,x)=> s + (x.total_cents||0), 0);

  // crear movimiento tipo corte_z
  const moves = JSON.parse(localStorage.getItem('movements_pos')||'[]');
  const mv = { id: 'M' + new Date().toISOString().slice(0,19).replace(/[:T-]/g,'') + '-C', date: new Date().toISOString(), type:'corte_z', ref:null, debit_cents: total, credit_cents:0, account:'Caja', note:`Corte Z total ${total}` };
  moves.push(mv);
  localStorage.setItem('movements_pos', JSON.stringify(moves));

  const out = `Corte Z realizado\nVentas: ${salesSince.length}\nTotal: ${formatMoney(total)}`;
  document.getElementById('report-output').textContent = out;
  recordAudit('corte_z', currentUser()?.username || 'unknown', {since: since.toISOString(), total_cents: total, tickets: salesSince.length});
});

document.getElementById('btn-reconcile').addEventListener('click', ()=>{
  const r = reconcile();
  document.getElementById('report-output').textContent = `Reconcile\nTotalSales: ${formatMoney(r.totalSales)}\nMovSales: ${formatMoney(r.movSales)}\nDiff: ${formatMoney(r.diff)}`;
  recordAudit('reconcile', currentUser()?.username || 'unknown', r);
});

document.getElementById('btn-export-audits').addEventListener('click', ()=>{
  const a = JSON.parse(localStorage.getItem('audits_pos')||'[]');
  downloadJSON('audits_export_'+nowISO().slice(0,19).replace(/[:T-]/g,'')+'.json', a);
});

document.getElementById('btn-arqueo').addEventListener('click', ()=>{
  const input = document.getElementById('arqueo-cash').value || '0';
  const cashCounted = Math.round(Number(input)*100);
  const sales = JSON.parse(localStorage.getItem('sales_pos')||'[]');
  const totalSales = sales.reduce((s,x)=> s + (x.total_cents||0), 0);
  const diff = cashCounted - totalSales;
  document.getElementById('arqueo-result').textContent = `Caja esperado: ${formatMoney(totalSales)} / Contado: ${formatMoney(cashCounted)} / Diff: ${formatMoney(diff)}`;
  recordAudit('arqueo', currentUser()?.username || 'unknown', {cashCounted, expected: totalSales, diff});
});
</script>
</body>
</html>
```

---

# 4) Cambios UI mínimos a `index_pos.html` / `admin.html`

* Añade un botón `Iniciar sesión` (o modal de login). Llamará a `login(username,password)`.
* Solo habilita botones de edición si `currentUser().role === 'admin'`. En la inicialización de Admin: si no admin, deshabilitar `btn-add`, `btn-import`, botones `Eliminar/Editar`.

Ejemplo (pegar al inicio de `pos.js`):

```js
// comprobar sesión y mostrar usuario
function ensureUIByRole(){
  const u = currentUser();
  if(u){
    document.getElementById('btn-admin').textContent = `Admin (${u.username})`;
  } else {
    document.getElementById('btn-admin').textContent = 'Iniciar sesión';
  }
}
document.getElementById('btn-admin').addEventListener('click', ()=>{
  const u = currentUser();
  if(u) { if(confirm('Cerrar sesión?')) { logout(); location.reload(); } }
  else {
    const username = prompt('Usuario:'); const pw = prompt('Contraseña:');
    try{ login(username,pw); alert('Sesión iniciada'); ensureUIByRole(); }catch(e){ alert(e.message); }
  }
});
ensureUIByRole();
```

# 5) Auditoría de consultas (precio / consulta)

Cuando el cajero use el buscador y haga clic en producto, además de agregar al carrito, ejecuta:

```js
recordAudit('consulta_producto', currentUser()?.username || 'anon', {product_id: p.id || p.Codigo, name: p.name || p.Item});
```

# 6) Impresión de tickets

Ya generamos `generateReceipt(sale)` — para imprimir:

```js
function printReceiptText(text){
  const w = window.open('', '_blank', 'width=400,height=600');
  w.document.write('<pre>'+text.replace(/</g,'&lt;')+'</pre>');
  w.document.close();
  w.print();
}
```

Llamar `printReceiptText(generateReceipt(sale))` al confirmar pago.

# 7) Export / backup / persistencia

* `exportAllBackup()` te da un snapshot JSON descargable.
* Recomienda: hacer backup diario (puedes ejecutar manualmente en `reports.html` o programar un botón).

# 8) Seguridad y límites (nota importante)

* Esto es **cliente-only** (solo JS + localStorage). No es seguro para producción con dinero real sin backend y autenticación segura. Para entregas universitarias y pruebas es correcto y transparente. Para una versión remunerable/profesional necesitas backend, verificación y cifrado.

# 9) Qué ya puedo crear ahora (y lo hago si quieres)

* Añadir los archivos nuevos (`auth.js`, `reports.html`) y modificar `storage-utils.js` y `pos.js` para llamar `recordAudit()` donde corresponde.
* Añadir botones UI para Login, Export, Corte X/Z ya listos.

---

Si quieres **lo implemento ahora mismo** en tu carpeta (generar `auth.js`, `reports.html`, y actualizar `storage-utils.js`/`pos.js` con los hooks `recordAudit`), dime “sí genera todo” y lo creo ahora y te doy los links a los archivos.
Si prefieres, también puedo **aplicar solo el login + audit** o **solo reports** primero — pero ya dejé todo preparado arriba; si me das OK lo escribo en archivos y lo pruebas con `python -m http.server` en `/mnt/data`.

¿Le doy “generar todo ahora” y te lo subo, o prefieres que haga solo `auth + audit` primero?
