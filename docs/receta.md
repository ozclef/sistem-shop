# Perfecto
— estás en la buena ruta y me encanta tu energía. 👏 Aquí tienes **lo mínimo imprescindible** para que todo funcione hoy y, además, un checklist claro y pasos prácticos para que *no se te pierda nada* y puedas avanzar sin volverte loco.

Voy a dividirlo en: **(A) Qué falta y prioridades**, **(B) Pasos para integrar/copiar/arrancar**, **(C) Pruebas rápidas que debes hacer ahora mismo**, **(D) Comandos útiles (zip / servidor / Git)**, **(E) Qué sigue / mejoras recomendadas**.

---

# A) Prioridades (lo que más hace falta ahora)

1. Asegurar que tu `inventario_emilio.json` esté en la misma carpeta que los HTML/JS (`index_pos.html`, `pos.js`, `storage-utils.js`, `accounting.js`, `admin.html`, `auditor.html`, `reports.html`, `auth.js`).
2. Comprobar el **orden de carga** de scripts en cada HTML (auth → storage-utils → accounting → pos/admin/auditor).
3. Probar flujo básico: buscar producto → añadir al carrito → cobrar → verificar que `sales_pos` y `movements_pos` se llenan en `localStorage`.
4. Hacer un **backup** (exportar JSON) y dejarlo guardado.
5. Crear un ZIP con todo para subir a GitHub o para entregar.

---

# B) Pasos concretos para integrar/copiar/arrancar (pégalo y hazlo ya)

1. Crea una carpeta nueva `proyecto-pos` y copia dentro todos los archivos `.html`, `.js`, `.css` y `inventario_emilio.json`.

2. Revisa que `index_pos.html` incluya (al final del body) exactamente este orden:

```html
<script src="auth.js"></script>
<script src="storage-utils.js"></script>
<script src="accounting.js"></script>
<script src="pos.js"></script>
```

Haz lo mismo para `admin.html` y `auditor.html` (ajusta si usan `app_admin.js` o `app_auditor.js` que te generé).

3. Inicia un servidor simple (esto evita errores de CORS al cargar JSON):

* Abre terminal en la carpeta `proyecto-pos` y ejecuta:

```
python -m http.server 8000
```

* Abre en el navegador: `http://localhost:8000/index_pos.html`

4. Si todo carga, prueba Admin y Auditor:

* `http://localhost:8000/admin.html`
* `http://localhost:8000/auditor.html`
* `http://localhost:8000/reports.html` (para cortes y conciliación).

---

# C) Pruebas rápidas (QA) — hazlas y fíjate en lo que debe pasar

1. **Buscar y añadir**

* Buscar “leche” o el código. Clic en producto → se añade al carrito.
* Verifica en UI que qty y subtotal cambian.

2. **Cobrar (venta de prueba)**

* Botón **Cobrar** → se abre modal → Monto recibido pon igual o un poco mayor → Confirmar.
* Resultado esperado: alerta “Venta registrada”, carrito vacío, en `receipt` aparece el ticket.

3. **Verificar `localStorage`**

* Abre consola del navegador (F12) y ejecuta:

```js
JSON.parse(localStorage.getItem('sales_pos') || '[]').slice(-1)   // ver última venta
JSON.parse(localStorage.getItem('movements_pos') || '[]').slice(-1) // último movimiento
JSON.parse(localStorage.getItem('inventory_pos') || '[]').filter(p=>p.stock<10) // ejemplo stocks bajos
```

* Debes ver la venta con `total_cents` y el movimiento correspondiente.

4. **Conciliación**

* En `reports.html` pulsa **Reconciliar ahora**. Debe mostrar `totalSales`, `movSales`, `diff` y normalmente `diff === 0` si todo se guardó bien.

5. **Export / Backup**

* En Admin o Reports pulsa **Exportar auditoría** o botón de backup. Debe descargarse un JSON con `sales`, `movements`, `inventory`, `audits`.

---

# D) Comandos útiles y cómo generar ZIP / Push a GitHub

* Hacer ZIP de la carpeta (Linux/Mac):

```
zip -r proyecto_pos.zip proyecto-pos
```

* Windows PowerShell:

```
Compress-Archive -Path .\proyecto-pos\* -DestinationPath .\proyecto_pos.zip
```

* Empujar a GitHub (si ya tienes repo):

```bash
cd proyecto-pos
git init
git add .
git commit -m "Initial POS prototype"
# crea repo en GitHub y pega la URL que te da GitHub
git remote add origin https://github.com/tuUsuario/tuRepo.git
git branch -M main
git push -u origin main
```

* Desplegar (GitHub Pages): Ve a Settings → Pages → Branch `main` / folder `/ (root)` y activa — la URL será `https://tuUsuario.github.io/tuRepo/`. (Recuerda: para que fetch a JSON funcione en GH Pages, las rutas deben estar correctas; si hay problemas, usa `fetch('./inventario_emilio.json')`.)

---

# E) Errores típicos y cómo solucionarlos

1. **JSON no carga → CORS / file://**

   * Síntoma: `fetch` falla con error de origen.
   * Solución: usar `python -m http.server` y abrir `http://localhost:8000`.

2. **Scripts cargan en orden incorrecto → funciones no definidas**

   * Síntoma: `ReferenceError: recordAudit is not defined` u otros.
   * Solución: comprueba el orden de `<script>`.

3. **Valores monetarios incorrectos (decimales raros)**

   * Síntoma: 0.3000000004 en vez de 0.30
   * Solución: siempre **usar céntimos** (`price_cents`) y la función `toMoney(cents)` para mostrar.

4. **Stock no se resta**

   * Síntoma: venta registrada pero stock no cambia.
   * Solución: revisa que `sell()` haga `localStorage.setItem(KEY.INVENTORY, JSON.stringify(inventory))` al final.

5. **Auth “bloquea” sin querer**

   * Solución: mantuvimos `auth.js` en modo pasivo por defecto — si te pones a probarlo y te da problemas, comenta la llamada `createDefaultAdmin()` o no uses el login.

---

# F) Qué más te conviene hacer pronto (prioridad alta → baja)

1. (ALTA) Hacer backups automáticos diarios (botón o script cron).
2. (ALTA) Exportar `sales_pos` y `movements_pos` al final del día (ZIP/JSON) y guardarlo fuera (pendrive/Google Drive).
3. (MEDIA) Añadir página `reports.html` con filtros por fecha (ya la tengo básica — ampliar).
4. (MEDIA) Añadir ‘arqueo’ guiado (form que guarde `arqueos_pos` con usuario y foto del conteo si quieres).
5. (BAJA) Backend mínimo (Node/Express) para seguridad, multi-terminal y base de datos real — cuando quieras monetizar.
6. (EXTRA) Conectar un lector de códigos de barras físico: la mayoría mandan el código al input y Enter; tu campo `barcode` ya soporta eso.

---

# G) Mini-lista “ya hecho / pendiente” para que no te agobies

* ✅ Demo Emilio (tabla de caducados) — terminado.
* ✅ Admin CRUD + Auditor — ya creados (tienes los archivos).
* ✅ POS básico (carrito + cobrar + ticket) — archivo generado.
* ✅ Accounting / sell() con commit atómico — listo.
* ⚪ Auth (simulada) integrado pero **pasivo** — listo para activar cuando quieras.
* ⚪ Reports / cortes X & Z — versión básica lista (puedo mejorar filtros).
* ⚪ Backup/ZIP/GitHub — listo para que lo hagas; puedo generar ZIP si quieres.

---

# H) Si quieres ahora mismo (elige 1 o más)

* 1 → Te genero aquí mismo el **ZIP** con todos los archivos listos (y te doy enlace de descarga).
* 2 → Te hago una **lista de comprobación** con pasos exactos para entregar a la uni (qué pegar en el Word, qué imprimir).
* 3 → Mejoro `reports.html` para que filtre por rango de fechas y permita exportar CSV.

Dime 1 / 2 / 3 (o “todo”) y lo hago ya.
Si no, perfecto: prueba los pasos de arriba, copia/pega con calma y me vas diciendo resultados; yo voy ajustando lo que haga falta. 💪✨
