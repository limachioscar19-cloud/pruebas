# Guía de Conexión a Supabase & División de Roles (Happy Warmi Spa)

Esta guía explica paso a paso cómo enlazar **Supabase** como base de datos ligera en la nube para registrar eventos en la **Bitácora**, y cómo funciona la **división entre el Usuario Normal (Cliente) y el Administrador**.

---

## 🌟 1. Resumen de la Arquitectura

1. **Usuario Normal (Cliente) - `index.html`**:
   - **Ver el Catálogo:** Explora masajes corporales, tratamientos faciales y rituales holísticos con precios y duraciones.
   - **Información del Spa:** Consulta la historia, las instalaciones, redes sociales, horarios y contacto directo por WhatsApp.
   - **Agendar Citas:** Selecciona tratamientos, tamaño de grupo (1 a 3 personas), fechas, horarios y asignación de terapeutas oficiales (**Maya, Rosa y Moy**).
   - **Mis Citas:** Consulta el estado de sus citas y puede cancelarlas ingresando una justificación obligatoria.
   - **Experiencia Live Comunitaria:** Puede enviar reacciones (corazones), chatear con las terapeutas y seleccionar ofertas exclusivas.
   - **Privacidad de Auditoría:** La consola interna de auditoría y los botones de limpieza de bitácora **no son visibles para el cliente normal**.

2. **Administrador - `admin.html`**:
   - **Control de Acceso (Login/PIN):** Protegido por autenticación administrativa (PIN por defecto: `admin123`).
   - **Bitácora de Auditoría en Vivo:** Visualiza en tiempo real todos los eventos registrados tanto de usuarios normales (navegación, reservas, cancelaciones justificadas, likes, chats) como acciones del sistema.
   - **Conexión Directa a Supabase:** Panel con indicador visual de estado (`🟢 Supabase En Línea` / `🟡 Modo Local`) y botón para enlazar credenciales sin modificar código.
   - **Gestión Total de Citas:** Crear reservas manuales, confirmar, completar, cancelar con justificación y exportar reportes en CSV.

---

## 🚀 2. Paso a Paso para Enlazar Supabase

### Paso 1: Iniciar sesión o crear proyecto en Supabase
1. Ingresa a [https://supabase.com](https://supabase.com) e inicia sesión con GitHub o tu correo.
2. Haz clic en **"New Project"** (Nuevo proyecto).
3. Ingresa un nombre (por ejemplo: `Happy-Warmi-Spa`), elige una contraseña segura para tu base de datos y selecciona la región más cercana.
4. Espera aproximadamente 1-2 minutos hasta que el proyecto termine de aprovisionarse.

---

### Paso 2: Ejecutar el script SQL (`supabase_setup.sql`)
1. En el menú lateral izquierdo de tu proyecto en Supabase, haz clic en el ícono de terminal: **"SQL Editor"**.
2. Haz clic en el botón verde **"+ New query"** (o "Create query").
3. Abre el archivo [`supabase_setup.sql`](./supabase_setup.sql) ubicado en esta carpeta.
4. **Copia todo su contenido** y pégalo dentro del editor SQL de Supabase.
5. Haz clic en el botón verde **"Run"** (o presiona `Ctrl + Enter`).
6. Deberías ver el mensaje de confirmación:
   > *"Configuración completada con éxito. Las tablas bitacora y reservas están listas para recibir eventos."*

---

### Paso 3: Obtener las Llaves de API de Supabase

En la versión actual de Supabase (como se ve en la pantalla de **Settings > API Keys**):

1. **La Clave que debes copiar:**
   * En tu pantalla verás dos secciones: **"Publishable key"** y **"Secret keys"**.
   * ✅ **Copia la clave de "Publishable key"**: Haz clic en el botón de copiar (ícono de dos hojas) al lado de la clave que empieza por:
     `sb_publishable_...`
   * ⚠️ **NO copies la "Secret key"** (`sb_secret_...`), esa es una clave secreta administrativa para servidores y nunca debe ir en el navegador.

2. **La Project URL (URL del Proyecto):**
   * En el menú izquierdo de tu panel (justo debajo de "INTEGRATIONS" o en "CONFIGURATION"):
     * Haz clic en **"Data API"** (o en **"General"**).
     * Ahí encontrarás el campo llamado **"Project URL"** (o **"URL"**), que tiene la forma:
       `https://tu-codigo-de-proyecto.supabase.co`
     * *(Nota: Si ves tu **Reference ID** en General, por ejemplo `abcdefghijklm`, tu URL es simplemente `https://abcdefghijklm.supabase.co`)*.

---

### Paso 4: Enlazar las Llaves al Proyecto

Tienes **dos opciones muy sencillas**:

#### Opción A (La más fácil - Desde la interfaz web del Admin):
1. Abre [`admin.html`](./admin.html) en tu navegador.
2. Ingresa el PIN de administrador: `admin123`.
3. En la barra superior, haz clic en el botón **"⚙️ Conectar Supabase"**.
4. Pega la **Project URL** (ej: `https://xxxx.supabase.co`) y la **Publishable Key** (`sb_publishable_...`).
5. Haz clic en **"🔍 Probar Conexión"**. El sistema verificará la tabla `bitacora` de inmediato.
6. Haz clic en **"💾 Guardar Credenciales"**. ¡Listo! El indicador cambiará a `🟢 Supabase En Línea`.

#### Opción B (Directamente en el código):
Abre el archivo [`supabase-client.js`](./supabase-client.js) y en las primeras líneas coloca tus credenciales:
```javascript
const DEFAULT_SUPABASE_URL = 'https://tu-codigo-de-proyecto.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_tu_clave_completa_aqui';
```

---

## 🧪 3. Verificación de Funcionamiento

1. **Como Cliente:**
   - Abre [`index.html`](./index.html).
   - Navega por el catálogo de experiencias.
   - En **"Reserva tu cita"**, agenda un masaje con **Maya**, **Rosa** o **Moy**.
   - Ingresa a **"Cosas del Spa"**, dale like al Live o escribe un mensaje en el chat.
2. **Como Administrador:**
   - Abre [`admin.html`](./admin.html) (o haz clic en el botón `🔒 Admin` del menú del cliente).
   - Ingresa el PIN `admin123`.
   - Dirígete al final de la página a la sección **"📊 Bitácora de Eventos y Auditoría en Vivo"**.
   - Verás aparecer todos los eventos (navegación, likes, chat, reservas y cancelaciones) con la insignia `[NUBE - SUPABASE]`.
   - Si revisas tu panel en [supabase.com](https://supabase.com) en el apartado **Table Editor** > `bitacora`, ¡verás los registros reflejados en tu base de datos!

---

## 🛡️ 4. Tolerancia a Fallos y Modo Híbrido

- Si la conexión a internet se interrumpe o si aún no has enlazado Supabase, **el proyecto sigue funcionando perfectamente**: todos los eventos y citas se guardan en el almacenamiento local (`localStorage`).
- Tan pronto configuras Supabase, los nuevos eventos se sincronizan automáticamente con la nube.
