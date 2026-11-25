-- ==============================================================================
-- HAPPY WARMI SPA - BASE DE DATOS SUPABASE (UPDS 2026)
-- Script de configuración para Bitácora de Auditoría en Tiempo Real y Reservas
-- ==============================================================================
-- INSTRUCCIONES RÁPIDAS PARA COPIAR Y PEGAR:
-- 1. Inicia sesión en https://supabase.com y abre tu proyecto (o crea uno gratis).
-- 2. En el menú lateral izquierdo, haz clic en "SQL Editor" (ícono de terminal/consola).
-- 3. Haz clic en el botón "+ New query" (Nueva consulta).
-- 4. Copia TODO el contenido de este archivo, pégalo en el editor y haz clic en "RUN".
-- 5. Ve a "Project Settings" (ícono de engranaje) -> "API" y copia:
--      - Project URL (URL del proyecto)
--      - anon / public key (Llave anónima pública)
-- 6. Pega estas llaves en `supabase-client.js` o en el panel de Admin de la aplicación.
-- ==============================================================================

-- 1. TABLA: bitacora (Registro y Auditoría de Eventos)
CREATE TABLE IF NOT EXISTS public.bitacora (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  hora TEXT NOT NULL,
  tipo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  usuario_tipo TEXT DEFAULT 'cliente', -- 'cliente', 'admin' o 'sistema'
  detalles JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.bitacora IS 'Bitácora de eventos y auditoría de acciones en tiempo real de Happy Warmi Spa';

-- 2. TABLA: reservas (Registro de Citas del Spa)
CREATE TABLE IF NOT EXISTS public.reservas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  code TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  phone TEXT,
  person_count INTEGER DEFAULT 1,
  experience_name TEXT,
  duration TEXT,
  price NUMERIC DEFAULT 0,
  specialist_name TEXT,
  date_time TEXT,
  date_key TEXT,
  time_slot TEXT,
  status TEXT DEFAULT 'Confirmada',
  cancellation_reason TEXT
);

COMMENT ON TABLE public.reservas IS 'Reservas de citas y asignación a especialistas Maya, Rosa y Moy';

-- 3. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_bitacora_created_at ON public.bitacora (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_tipo ON public.bitacora (tipo);
CREATE INDEX IF NOT EXISTS idx_bitacora_usuario_tipo ON public.bitacora (usuario_tipo);
CREATE INDEX IF NOT EXISTS idx_reservas_code ON public.reservas (code);
CREATE INDEX IF NOT EXISTS idx_reservas_date_key ON public.reservas (date_key);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON public.reservas (status);

-- 4. SEGURIDAD A NIVEL DE FILAS (Row Level Security - RLS)
ALTER TABLE public.bitacora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

-- Limpieza preventiva de políticas anteriores para evitar conflictos
DROP POLICY IF EXISTS "Permitir insercion anonima en bitacora" ON public.bitacora;
DROP POLICY IF EXISTS "Permitir lectura anonima en bitacora" ON public.bitacora;
DROP POLICY IF EXISTS "Permitir eliminacion anonima en bitacora" ON public.bitacora;

DROP POLICY IF EXISTS "Permitir insercion anonima en reservas" ON public.reservas;
DROP POLICY IF EXISTS "Permitir lectura anonima en reservas" ON public.reservas;
DROP POLICY IF EXISTS "Permitir actualizacion anonima en reservas" ON public.reservas;
DROP POLICY IF EXISTS "Permitir eliminacion anonima en reservas" ON public.reservas;

-- Políticas para la tabla bitacora:
-- Permite que clientes y administradores registren eventos con la anon key
CREATE POLICY "Permitir insercion anonima en bitacora" 
ON public.bitacora FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- Permite consultar los eventos para el panel de auditoría
CREATE POLICY "Permitir lectura anonima en bitacora" 
ON public.bitacora FOR SELECT 
TO anon, authenticated 
USING (true);

-- Permite que el admin pueda vaciar la bitácora
CREATE POLICY "Permitir eliminacion anonima en bitacora" 
ON public.bitacora FOR DELETE 
TO anon, authenticated 
USING (true);

-- Políticas para la tabla reservas:
-- Permite que los clientes agenden citas
CREATE POLICY "Permitir insercion anonima en reservas" 
ON public.reservas FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- Permite consultar reservas (para 'Mis Citas' y para el panel admin)
CREATE POLICY "Permitir lectura anonima en reservas" 
ON public.reservas FOR SELECT 
TO anon, authenticated 
USING (true);

-- Permite actualizar estado o registrar motivo de cancelación
CREATE POLICY "Permitir actualizacion anonima en reservas" 
ON public.reservas FOR UPDATE 
TO anon, authenticated 
USING (true);

-- Permite eliminar reservas si el admin lo requiere
CREATE POLICY "Permitir eliminacion anonima en reservas" 
ON public.reservas FOR DELETE 
TO anon, authenticated 
USING (true);

-- 5. EVENTO DE INICIALIZACIÓN DE PRUEBA
INSERT INTO public.bitacora (hora, tipo, mensaje, usuario_tipo, detalles)
VALUES 
  (TO_CHAR(NOW(), 'HH24:MI:SS'), 'SISTEMA_INICIALIZADO', 'Base de datos Supabase conectada exitosamente con Happy Warmi Spa.', 'sistema', '{"proyecto": "Happy Warmi Spa", "version": "2.2.0"}'::jsonb);

-- 6. CONFIRMACIÓN FINAL
SELECT 
  'Configuración completada con éxito. Las tablas bitacora y reservas están listas para recibir eventos.' AS resultado;
