# Despliegue de TrazApp para la demostración

**Arquitectura:**

```
Navegador ──► https://trazapp.netlify.app ──(/api/* reescrito, status 200)──► https://<DOMINIO> (Caddy) ──► api:8000 ──► database:5432
              (frontend estático)                                              VPS Ubuntu 24.04 con Docker
```

- **Frontend:** Netlify, con «Base directory» = `frontend` y la configuración en `frontend/netlify.toml`. Netlify reenvía `/api/*` al VPS con un rewrite (status 200), así que para el navegador todo es el mismo origen.
- **Backend y base de datos:** VPS con `docker-compose.prod.yml` (servicios `database`, `api` y `caddy`). Caddy termina el HTTPS con un certificado de Let's Encrypt para `<IP-con-guiones>.sslip.io`.
- **El backend no tiene prefijo `/api`:** el rewrite lo quita (`/api/health` → `https://<DOMINIO>/health`).
- **La ficha pública y el QR** usan `URL_PUBLICA_APP=https://trazapp.netlify.app`, porque la ficha `/p/{id}` es una ruta del frontend. Los QR que se hayan impreso en desarrollo apuntan a la URL local y hay que volver a descargarlos.

**Archivos:**

| Archivo | Qué es |
|---|---|
| `docker-compose.prod.yml` | `database`, `api` y `caddy`. Solo `caddy` publica puertos |
| `deploy/Caddyfile` | El dominio (variable `DOMINIO`) con proxy a `api:8000`, sin registro de acceso |
| `.env.production.example` | Nombres de las variables, con comentarios. Se copia a `.env.production`, que **no** se sube |
| `frontend/netlify.toml` | Build, rewrite `/api/*` → VPS, fallback de la SPA y encabezados de `/p/*` |
| `backend/.dockerignore` | Deja fuera de la imagen `tests/`, `.venv`, `__pycache__` y los `.env` |

En el VPS, todos los comandos de `docker compose` llevan el archivo de variables y el de compose. Para no repetirlos:

```bash
alias dc='docker compose --env-file .env.production -f docker-compose.prod.yml'
```

---

## 1. Preparar el VPS (una vez)

```bash
# Docker Engine y el plugin compose (script oficial)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # cierra la sesión SSH y vuelve a entrar

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp     # Let's Encrypt (desafío HTTP) y redirección a HTTPS
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 443/udp    # HTTP/3 (QUIC); sin esta regla Caddy funciona igual por TCP
sudo ufw enable
```

**Docker se salta ufw.** Un puerto publicado con `ports:` queda abierto aunque ufw no lo permita. Por eso en `docker-compose.prod.yml` **solo `caddy` publica puertos** (80/tcp, 443/tcp y 443/udp). `database` y `api` no publican nada y se alcanzan solo por la red interna de Docker. No agregues `ports:` a esos dos servicios.

## 2. Código y variables

```bash
git clone https://github.com/lauritaggz/TrazApp.git ~/trazapp
cd ~/trazapp
cp .env.production.example .env.production
nano .env.production
```

Completa `.env.production`:

- **`DOMINIO`:** la IP pública del VPS con guiones, más `.sslip.io`. Por ejemplo, `203.0.113.10` queda `203-0-113-10.sslip.io`. sslip.io resuelve ese nombre a la IP sin configurar nada.
- **`POSTGRES_PASSWORD`:** `openssl rand -base64 32`, quitando `@`, `:` y `/` si aparecen, porque rompen `DATABASE_URL`.
- **`DATABASE_URL`:** `postgresql+psycopg2://<POSTGRES_USER>:<POSTGRES_PASSWORD>@database:5432/<POSTGRES_DB>`.
- **`JWT_SECRET_KEY`:** `openssl rand -hex 32`. Es **obligatoria**: sin ella, el código usa un valor de desarrollo inseguro.
- **`APP_ENV=production`:** apaga `/docs`, `/redoc` y `/openapi.json`.

```bash
chmod 600 .env.production
```

## 3. Netlify

1. **El dominio del rewrite.** En `frontend/netlify.toml`, la regla de `/api/*` tiene el dominio escrito, porque Netlify no lee variables en las reglas:
   ```toml
   to = "https://IP-CON-GUIONES.sslip.io/:splat"
   ```
   Reemplaza `IP-CON-GUIONES.sslip.io` por el mismo valor de `DOMINIO`, haz commit y push. **Si el dominio cambia** (otra IP o DuckDNS, sección 9), hay que cambiarlo en los dos lugares: `DOMINIO` en `.env.production` y esta línea.
2. **`VITE_API_URL`.** En Netlify → Site configuration → Environment variables, define `VITE_API_URL = /api` y vuelve a desplegar. El build falla a propósito si esta variable falta.
3. **El orden de las reglas importa:** primero `/api/*` y después el fallback `/* → /index.html`. No debe existir `frontend/public/_redirects`, porque Netlify lo procesa antes que `netlify.toml` y mandaría las llamadas de la API a `index.html`.

## 4. Primer arranque

Elige **una** de las dos opciones.

- **Base vacía:** `dc up -d --build`. La API ejecuta `alembic upgrade head` al iniciar, y las migraciones crean el esquema, el catálogo de alérgenos y las categorías.
- **Con los datos locales:** sigue la sección 5 **antes** de levantar la API. Si la API arranca primero, crea las tablas vacías y la restauración choca con ellas.

## 5. Carga inicial desde local

### a) En Windows (PowerShell), en la carpeta del proyecto, con Docker de desarrollo corriendo

```powershell
# 1. Respaldo de la base en formato propio (-Fc), escrito DENTRO del contenedor.
docker compose exec database sh -c 'pg_dump -Fc -U $POSTGRES_USER -d $POSTGRES_DB -f /tmp/trazapp.dump'

# 2. Copiarlo al host. No uses ">" en PowerShell: convierte la salida en texto y corrompe el binario.
docker compose cp database:/tmp/trazapp.dump .\trazapp.dump
docker compose exec database rm /tmp/trazapp.dump

# 3. Las imágenes de los productos (volumen /uploads del backend).
docker compose cp backend:/uploads .\uploads_respaldo
```

Las variables van sin comillas dobles dentro de `sh -c '...'` a propósito: PowerShell 5.1 pierde las comillas dobles anidadas al pasarlas a un programa. `trazapp.dump` y `uploads_respaldo/` están en `.gitignore`.

### b) Copiar al VPS

```powershell
scp .\trazapp.dump usuario@IP-DEL-VPS:~/trazapp/
scp -r .\uploads_respaldo usuario@IP-DEL-VPS:~/trazapp/
```

### c) En el VPS: restaurar con SOLO la base levantada

```bash
cd ~/trazapp

# Crea la red, los volúmenes, la imagen de la API y los contenedores, sin iniciarlos.
dc up --no-start --build

# Solo la base.
dc up -d database

# Restaurar. --no-owner y --no-privileges evitan errores si el usuario local se llama distinto.
dc cp ./trazapp.dump database:/tmp/trazapp.dump
dc exec -T database sh -c 'pg_restore --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/trazapp.dump'

# Verificar la migración: debe responder 020_evaluacion_utilidad_hu11.
dc exec -T database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version_num FROM alembic_version;"'

# Copiar las imágenes al volumen product_uploads, con un contenedor temporal.
docker run --rm \
  -v trazapp_product_uploads:/uploads \
  -v "$HOME/trazapp/uploads_respaldo:/origen:ro" \
  alpine sh -c 'cp -a /origen/. /uploads/ && ls /uploads/products | wc -l'

# Recién ahora: la API (alembic no hará nada, ya está en la 020) y Caddy.
dc up -d
```

`trazapp_product_uploads` es el nombre real del volumen, porque el compose fija `name: trazapp`.

### d) Borrar el respaldo del VPS

```bash
dc exec database rm /tmp/trazapp.dump
rm ~/trazapp/trazapp.dump
rm -r ~/trazapp/uploads_respaldo
```

El respaldo contiene todos los datos. Borra también la copia de Windows cuando ya no la necesites.

## 6. Comprobar

```bash
dc ps                                      # los tres servicios «running»; database «healthy»
dc logs --tail=50 caddy                    # debe decir que obtuvo el certificado para DOMINIO
curl -s https://<DOMINIO>/health           # {"status":"ok",...,"database":"ok"}
curl -s -o /dev/null -w "%{http_code}\n" https://<DOMINIO>/docs   # 404 (APP_ENV=production)
curl -sI https://www.jumbo.cl | head -1    # el VPS llega a Jumbo (búsqueda de insumos, HU07)
```

Desde el navegador:

- `https://trazapp.netlify.app/api/health` debe dar lo mismo que el `curl` (comprueba el rewrite).
- Inicia sesión, abre un producto publicado y descarga el QR: debe apuntar a `https://trazapp.netlify.app/p/...`.
- Sube una imagen de producto y busca un insumo por código de barras y por nombre.
- **Si Jumbo no responde desde el VPS** (algunas tiendas bloquean IP de centros de datos), la búsqueda sigue con Open Food Facts y el ingreso manual.

## 7. Actualizar

```bash
cd ~/trazapp
git pull
dc up -d --build      # reconstruye la API; las migraciones nuevas se aplican al iniciar
dc logs --tail=50 api
```

Si cambió el dominio del VPS, actualiza también `frontend/netlify.toml` (sección 3).

## 8. Respaldar y restaurar

### Respaldo

```bash
cd ~/trazapp
mkdir -p ~/respaldos
FECHA=$(date +%F)

# Base
dc exec -T database sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/trazapp.dump'
dc cp database:/tmp/trazapp.dump ~/respaldos/trazapp-$FECHA.dump
dc exec database rm /tmp/trazapp.dump

# Imágenes
docker run --rm -v trazapp_product_uploads:/uploads:ro -v ~/respaldos:/destino alpine \
  tar czf /destino/uploads-$FECHA.tar.gz -C /uploads .
```

Descarga los dos archivos fuera del VPS, por ejemplo con `scp usuario@IP-DEL-VPS:~/respaldos/* .`.

### Restaurar sobre un servidor en uso

```bash
cd ~/trazapp
dc stop api                       # que nadie escriba durante la restauración

dc cp ~/respaldos/trazapp-AAAA-MM-DD.dump database:/tmp/trazapp.dump
dc exec -T database sh -c 'pg_restore --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/trazapp.dump'
dc exec database rm /tmp/trazapp.dump

docker run --rm -v trazapp_product_uploads:/uploads -v ~/respaldos:/origen:ro alpine \
  sh -c 'rm -rf /uploads/* && tar xzf /origen/uploads-AAAA-MM-DD.tar.gz -C /uploads'

dc start api
```

`--clean --if-exists` borra los objetos antes de recrearlos. Sobre un servidor nuevo y vacío, sigue la sección 5 c.

## 9. Si Let's Encrypt rechaza sslip.io

sslip.io es un dominio compartido. Si Caddy registra un error de límite de emisión de Let's Encrypt (`too many certificates` o `rateLimited`), usa un subdominio propio de **DuckDNS**:

1. Crea `trazapp-<algo>.duckdns.org` en https://www.duckdns.org y apúntalo a la IP del VPS.
2. Cambia `DOMINIO` en `.env.production` y ejecuta `dc up -d`. Caddy pide el certificado nuevo.
3. Cambia el dominio del rewrite en `frontend/netlify.toml` (sección 3), haz commit y push, y Netlify vuelve a desplegar.

## 10. Notas

- **Sin registro de acceso de Caddy** (el `Caddyfile` no tiene `log`) **y sin `--proxy-headers` en uvicorn.** El registro de la API ve la IP de Caddy, no la del visitante, y además descarta las líneas de `/evaluaciones` (HU11). Netlify guarda sus propios registros: eso queda fuera del alcance de la aplicación.
- **Registros:** `dc logs -f api`, `dc logs -f caddy`.
- **Reinicio:** los tres servicios tienen `restart: unless-stopped`, así que vuelven solos si se reinicia el VPS.
- **Secretos:** `.env.production` solo vive en el VPS, con permisos `600`. Nunca lo subas ni lo pegues en un chat o en un ticket.
