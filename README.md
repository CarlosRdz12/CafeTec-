# CafeTEC

Sistema de pedidos para la cafetería escolar: menú, carrito, pedidos con QR, panel de caja, inventario, reportes y usuarios.

- **Stack:** Next.js 16 (App Router, Server Actions), React 19, Tailwind 4, zod.
- **Datos:** archivo JSON en `.data/cafetec.json` (o `CAFETEC_DATA_DIR`), con escrituras serializadas y atómicas. Pensado para **una sola instancia** del servidor.

## Puesta en marcha

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm test           # pruebas automatizadas (vitest)
pnpm build && pnpm start
```

La primera vez, abre `/configuracion-inicial` para crear al administrador. Luego, en **Usuarios**, crea las cuentas con rol **Cajero**.

## Acceso desde cualquier dispositivo: `https://cafetec.local:3000`

```bash
pnpm lan            # compila y sirve en la red local
pnpm lan:dev        # igual, en modo desarrollo (recarga en caliente)
```

Al arrancar, la terminal muestra:

```
Nombre:   https://cafetec.local:3000
IP:       https://192.168.1.40:3000
```

También aparece un QR para abrirlo con la cámara del teléfono.

- **Nombre `.local`:** el servidor lo anuncia por mDNS (Bonjour), sin configurar DNS ni el router. Funciona en iPhone y iPad, Mac, Windows 10/11 y Linux con Avahi. En Android la resolución de `.local` depende del modelo y de la versión: si no abre, usa la dirección IP o el QR de la terminal.
- **HTTPS:** el servidor usa HTTPS porque el navegador solo permite la cámara (escáner de caja) y la cookie de sesión en conexiones seguras. Si alguien escribe `cafetec.local:3000` sin `https://`, se le redirige automáticamente.
- **Primer acceso:** el navegador avisará que el certificado no es de confianza. Pulsa *Avanzado → Continuar*. Para quitar el aviso de forma permanente, descarga e instala la autoridad local de CafeTEC desde `http://cafetec.local:3000/cafetec-ca.crt`:
  - **iPhone/iPad:** instala el perfil descargado y luego actívalo en *Ajustes → General → Información → Ajustes de confianza de certificados*.
  - **Android:** *Ajustes → Seguridad → Cifrado y credenciales → Instalar certificado → Certificado de CA*.
  - **Windows:** abre el archivo, elige *Instalar certificado* y colócalo en *Entidades de certificación raíz de confianza*.
  - **macOS:** ábrelo en *Acceso a Llaveros* y márcalo como *Confiar siempre*.
- **Archivos del certificado:** la autoridad y el certificado se generan una sola vez en `.data/certs/`, que no se sube a git. El certificado del servidor se renueva solo si cambia la IP o está por vencer. No compartas `ca.key`.
- **Firewall:** la primera vez, Windows o macOS preguntarán si permiten a Node.js aceptar conexiones. Permítelo en **redes privadas**. Si el firewall bloquea el puerto UDP 5353 (mDNS), solo funcionará la dirección por IP.

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto (`PORT=8080 pnpm lan`). |
| `CAFETEC_HOSTNAME` | `cafetec.local` | Nombre anunciado. Debe terminar en `.local`. |
| `CAFETEC_LAN_IP` | detectada | IP a anunciar, si el equipo tiene varias redes (VPN, WSL, Docker). |

Si la cámara no está disponible, la caja puede buscar el pedido por **folio**.

## Variables de entorno (opcionales)

| Variable | Uso |
| --- | --- |
| `SESSION_SECRET` | Secreto de sesión (≥ 32 caracteres). Si falta, se genera uno en `.data/session.secret`. |
| `CAFETEC_DATA_DIR` | Carpeta de datos. Por defecto `.data/`. |
| `CAFETEC_PUBLIC_URL` | URL pública que se codifica en los QR (p. ej. `https://cafe.escuela.mx`). Por defecto se toma del host de la petición. |
| `CAFETEC_SIMULATED_PAYMENTS` | `off` oculta el pago "Tarjeta (simulado)". |

## Roles

| Rol | Panel inicial | Puede |
| --- | --- | --- |
| Cliente | `/menu` | Pedir, ver sus pedidos y su QR, pagar con tarjeta simulada, cancelar pedidos pendientes. |
| Personal | `/personal` | Tablero de pedidos, cobro en efectivo e inventario. |
| Cajero | `/caja` | Escanear QR o buscar por folio, cobrar (efectivo o tarjeta simulada), verificar el pago, marcar el pedido en preparación, listo o entregado, y ver su propio historial. **No** puede cancelar pedidos, cambiar precios, inventario ni usuarios. |
| Administrador | `/admin` | Todo lo anterior. |

Todos los permisos se comprueban en el servidor, en `requirePageRole` y `requireActionRole` y en `lib/server/order-service.ts`.

## QR de pedidos

Cada pedido tiene un `qrToken` aleatorio de 192 bits. El QR solo contiene `<origen>/q/<token>`: ningún nombre, precio ni producto. Al escanearlo, el servidor busca el pedido y muestra los datos **actuales** solo al dueño o al personal autorizado. El QR no es un comprobante de pago.

## Pago con tarjeta (simulado)

**SIMULACIÓN — NO SE REALIZA NINGÚN COBRO REAL.** No hay pasarela de pago ni se piden datos de tarjeta: se elige una tarjeta de prueba ("Aprobada" o "Rechazada").

- El importe se calcula en el servidor con las líneas guardadas del pedido. El importe que envía el navegador solo sirve como confirmación.
- Cada intento lleva una clave de idempotencia, así que un doble clic o un reintento no generan un segundo cobro.
- Las escrituras están serializadas y una restricción de integridad impide guardar dos pagos exitosos para el mismo pedido.

## Migraciones

Al arrancar, `lib/server/migrations.ts` actualiza el archivo de datos sin borrar nada. Antes guarda una copia `cafetec.v1.backup-<fecha>.json`. La versión 2 añade `payments`, `orderEvents` (historial) y un `qrToken` para cada pedido existente.
