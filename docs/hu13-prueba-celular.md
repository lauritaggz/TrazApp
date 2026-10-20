# HU13 — Prueba del escáner en un celular real (T13-07)

Guía paso a paso para probar el escáner de códigos de barras en **Chrome para Android** y en **Safari para iOS**, usando el computador como servidor de desarrollo. Al final hay tablas vacías para anotar los resultados a mano.

**Por qué hace falta preparar esto.** La cámara de un celular solo se puede usar en un **contexto seguro** (HTTPS). Una dirección IP local con HTTP (`http://192.168.x.x:5175`) no sirve. Y si la página va por HTTPS, el navegador bloquea las llamadas a un backend por HTTP (contenido mixto). Por eso existe `npm run dev:https`: sirve la aplicación por HTTPS con un certificado propio y reenvía las llamadas a la API (`/api/...`) al backend local, de modo que el celular habla con un solo origen.

Es una ayuda **solo para desarrollo**. `npm run dev` y `npm run build` funcionan igual que antes.

---

## 1. Antes de empezar

- El computador y el celular en la **misma red Wi-Fi**. Una red de invitados o con «aislamiento de clientes» suele impedir que el celular llegue al computador; si pasa, usa otra red o el túnel del apartado 7.
- El perfil de esa red en Windows debe ser **Privada** (Configuración → Red e Internet → Wi-Fi → propiedades de la red).
- El computador con **internet**: el backend consulta Open Food Facts por ti.
- Una cuenta de prueba de TrazApp (la que ya usas en desarrollo). No pegues contraseñas en ningún archivo.
- Los envases del conjunto de prueba de la sección 8 (o sus códigos de barras en pantalla o impresos).
- Un producto con ingredientes ya creados en tu cuenta, para poder elegir el ingrediente al registrar un insumo.

## 2. Levantar el backend

Desde la carpeta del proyecto:

```powershell
docker compose up -d database backend
```

Comprueba que responde (debe decir `"status":"ok"`):

```powershell
curl.exe http://localhost:8000/health
```

El backend queda en el puerto 8000. Si otro proyecto usa ese puerto, el proxy no llegará a TrazApp: ciérralo o apunta el proxy a otro destino con `VITE_DEV_API_TARGET` (por ejemplo `$env:VITE_DEV_API_TARGET="http://localhost:8001"` antes de correr el servidor).

## 3. Correr el servidor HTTPS

En otra terminal:

```powershell
cd frontend
npm run dev:https
```

Debe imprimir direcciones `https://...` y, al final, las direcciones de la red local y el destino de la API. La primera vez tarda un poco más (Vite vuelve a optimizar las dependencias y se crea el certificado).

- Usa el puerto **5175**. Si está ocupado (por ejemplo, porque `npm run dev` sigue corriendo), ciérralo o elige otro: `npm run dev:https -- --port 5176`.
- No hace falta tocar archivos `.env`: el script fija solo `VITE_API_URL=/api` para esa ejecución.

## 4. Averiguar la IP del computador

```powershell
ipconfig
```

Busca el adaptador **Wi-Fi** («Adaptador de LAN inalámbrica Wi-Fi») y copia la **Dirección IPv4**, por ejemplo `192.168.1.28`. Ignora los adaptadores virtuales (WSL, VirtualBox, Docker): suelen ser `172.x.x.x` o `192.168.56.x`. El propio script también lista las direcciones disponibles.

## 5. Permitir el puerto en el firewall de Windows

Al primer arranque Windows puede preguntar si permite a Node.js acceder a la red: acepta para **redes privadas**. Si no preguntó, o el celular no logra conectar, crea la regla (PowerShell **como administradora**):

```powershell
New-NetFirewallRule -DisplayName "TrazApp dev HTTPS 5175" -Direction Inbound -Protocol TCP -LocalPort 5175 -Action Allow -Profile Private
```

Al terminar la prueba, quítala:

```powershell
Remove-NetFirewallRule -DisplayName "TrazApp dev HTTPS 5175"
```

Prueba rápida desde el propio computador, con la IP del paso 4 (debe responder `200`):

```powershell
curl.exe -k -s -o NUL -w "%{http_code}" https://192.168.1.28:5175/
```

## 6. Abrir la aplicación en el celular

Escribe `https://IP:5175` (con tu IP) en el navegador del celular. Como el certificado es propio, el navegador avisa; es esperado:

- **Android (Chrome):** «Tu conexión no es privada» → **Avanzado** → **Ir a 192.168.x.x (no seguro)**.
- **iOS (Safari):** «Esta conexión no es privada» → **Mostrar detalles** → **visitar este sitio web** → confirma con **Visitar sitio web**.

Inicia sesión, entra a **Insumos → Nuevo insumo** y pulsa **Escanear código de barras**. El navegador debe pedir permiso para la cámara: **Permitir**. Con buena luz, a unos 10 o 15 cm del código y en horizontal.

Si el celular dice que no puede conectar, revisa en este orden: misma red, firewall (apartado 5), puerto correcto, que el servidor siga corriendo.

## 7. Si Safari no da acceso a la cámara

Safari para iOS puede negar la cámara en una página abierta con una **excepción de certificado** que aceptaste a mano. El síntoma: el panel del escáner dice que no pudo usar la cámara, o el aviso de permiso nunca aparece, aunque el campo para escribir el número sí funciona.

Alternativa: un **túnel con cloudflared**, que da una dirección `https://....trycloudflare.com` con certificado válido.

1. Instala la herramienta (una vez): `winget install --id Cloudflare.cloudflared`
2. Con `npm run dev:https` corriendo, en otra terminal:
   ```powershell
   cloudflared tunnel --url https://localhost:5175 --no-tls-verify
   ```
3. Abre en el celular la dirección `https://....trycloudflare.com` que imprime. No hay aviso de certificado y la cámara debería pedir permiso.
4. Para cerrar el túnel: `Ctrl + C`.

**Cuidado con el túnel:** esa dirección es pública mientras esté abierto; cualquiera que la tenga llega a tu servidor de desarrollo y, por el proxy, a tu backend local. Úsalo solo un rato, con datos de prueba, sin credenciales reales, y ciérralo al terminar. No requiere cambiar la configuración de Vite.

Si el escáner no abre la cámara pero el campo manual funciona, anótalo en la tabla de resultados: es información útil sobre el navegador, no un fallo del ingreso manual.

## 8. Al terminar

- Detén el servidor con `Ctrl + C`.
- Quita la regla del firewall (apartado 5) y cierra el túnel si lo usaste.
- El certificado queda en `frontend/node_modules/.vite/basic-ssl/_cert.pem` (ignorado por git, vence a los 30 días). **No lo agregues al repositorio.**
- Pasa los resultados de las tablas a `docs/hu13-test-results.md` (T13-08).

---

## 9. Tablas de verificación

Marca ✔ (bien), ✘ (mal) o — (no probado), y anota lo que veas en «Observaciones». Open Food Facts es una base colaborativa en vivo: si un producto cambió, anota la diferencia.

### 9.1 Datos de la prueba

| Dato | Chrome para Android | Safari para iOS |
|---|---|---|
| Fecha | | |
| Quién probó | | |
| Modelo del celular | | |
| Versión de Android / iOS | | |
| Versión del navegador | | |
| Red / forma de acceso (IP local o túnel) | | |
| Commit probado | | |

### 9.2 Conjunto de prueba (sección 7 del documento de HU13)

«Lee» = la cámara reconoce el código sin escribirlo. «Encuentra» = el formulario se completa con el producto. «Alérgenos» = los sugeridos coinciden con lo esperado.

| Código | Producto | Resultado esperado | Chrome Android: Lee | Encuentra | Alérgenos | Safari iOS: Lee | Encuentra | Alérgenos | Observaciones |
|---|---|---|---|---|---|---|---|---|---|
| 7802910000971 | Loncoleche sin lactosa | Lo encuentra; sugiere Leche (según el texto de ingredientes) | | | | | | | |
| 8445291716841 | Galleta Triton sabor vainilla | Lo encuentra; sugiere gluten y soya (según la etiqueta) | | | | | | | |
| 7808709504767 | Leche entera | Lo encuentra; sugiere Leche (según el texto) | | | | | | | |
| 7801505231974 | Azúcar flor | Lo encuentra; sin alérgenos sugeridos | | | | | | | |
| 7801505231950 | Azúcar rubia | Lo encuentra con datos incompletos (sin ingredientes) | | | | | | | |
| 400001143070 | Atún lomitos en aceite (UPC-A) | Lo lee como UPC-A y lo encuentra | | | | | | | |
| 7790272001005 | Aceite de girasol | Lo encuentra; soya como «Contiene» y maní como «Puede contener» | | | | | | | |
| 7802410002239 | Polvos de hornear | Lo encuentra con datos incompletos (sin ingredientes) | | | | | | | |
| 8413700064197 | Bicarbonato sódico | Lo encuentra (producto importado) | | | | | | | |
| 7803600002053 | (sin nombre) | Lo encuentra con datos mínimos: hay que completar nombre y marca a mano | | | | | | | |
| 7801505000358 | (no existe) | «No encontramos este código»; el formulario queda con el código escrito | | | | | | | |

### 9.3 Casos de la historia

| Caso | Qué hacer | Resultado esperado | Chrome Android | Safari iOS | Observaciones |
|---|---|---|---|---|---|
| PT13-01 / PT13-02 | Escanear un EAN-13 | Se reconoce, el panel se cierra y se inicia la búsqueda | | | |
| PT13-03 | Escanear un UPC-A (el atún) | Se reconoce correctamente | | | |
| PT13-04 | Denegar el permiso de la cámara | Lo informa, explica cómo habilitarlo y ofrece escribir el número | | | |
| PT13-05 | Escribir el número a mano y pulsar «Buscar» | Se busca el producto | | | |
| PT13-14 | Reconocer un código, y por separado pulsar «Cerrar» | La cámara se detiene (se apaga el indicador de cámara del celular) | | | |
| PT13-15 | Con el computador sin internet, escanear un código | Dice que no pudo consultar la fuente y deja escribir los datos | | | |
| — | Abrir el escáner en un celular con linterna | Aparece el botón «Linterna» y funciona | | | |
| — | Rotar el celular con el escáner abierto | El panel se sigue viendo completo | | | |
| — | Escanear con poca luz o reflejos | Si no lee, el campo manual sigue disponible | | | |
| PT13-13 | Confirmar el registro de un producto encontrado | El insumo queda con su código, la fuente y la fecha; el detalle dice «Obtenido de Open Food Facts el dd-mm-aaaa» | | | |

### 9.4 Problemas encontrados

| # | Dispositivo | Qué pasó | Cómo reproducirlo | Gravedad |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |
