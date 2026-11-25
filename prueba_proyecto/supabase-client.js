/**
 * Happy Warmi Spa - Conector de Base de Datos Supabase (Versión 2.2)
 * UPDS 2026 • Auditoría de Eventos, Bitácora en la Nube y Reservas
 * 
 * Funcionalidad:
 * 1. Conexión ligera y directa con Supabase mediante @supabase/supabase-js
 * 2. Registro bidireccional de eventos (Supabase Cloud + LocalStorage de respaldo)
 * 3. Tolerancia total a fallos (Modo Híbrido: Si no hay internet o no hay llaves, funciona 100% en local)
 * 4. Métodos unificados para registrar eventos, consultar bitácora y sincronizar reservas
 */

(function (window) {
  'use strict';

  // ============================================================================
  // 1. CONFIGURACIÓN POR DEFECTO
  // ============================================================================
  // Puedes pegar aquí tus llaves directamente o configurarlas desde el Panel de Admin
  const DEFAULT_SUPABASE_URL = 'https://igchpwsambancqpvgmlm.supabase.co/rest/v1/'; // Ej: 'https://xyzabcdefg.supabase.co'
  const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_d_-vjtmCjScL4HzBkLUmeg_kxJGHVXl'; // Tu anon / public key

  const STORAGE_KEY_URL = 'happy_warmi_supabase_url';
  const STORAGE_KEY_KEY = 'happy_warmi_supabase_anon_key';
  const STORAGE_KEY_BITACORA = 'happy_warmi_bitacora';
  const STORAGE_KEY_RESERVATIONS = 'happy_warmi_reservations';

  let supabaseClient = null;
  let connectionState = {
    configured: false,
    online: false,
    source: 'local', // 'supabase' | 'local'
    lastSync: null,
    error: null
  };

  /**
   * Limpia y normaliza la URL de Supabase para evitar errores si el usuario copia con /rest/v1
   */
  function normalizeUrl(rawUrl) {
    if (!rawUrl) return '';
    let clean = rawUrl.trim();
    clean = clean.replace(/\/rest\/v1\/?$/i, '');
    clean = clean.replace(/\/+$/, '');
    return clean;
  }

  /**
   * Obtiene las credenciales actuales (prioriza localStorage, luego constantes)
   */
  function getCredentials() {
    const storedUrl = localStorage.getItem(STORAGE_KEY_URL);
    const storedKey = localStorage.getItem(STORAGE_KEY_KEY);

    const url = (storedUrl && storedUrl.trim()) || DEFAULT_SUPABASE_URL;
    const key = (storedKey && storedKey.trim()) || DEFAULT_SUPABASE_ANON_KEY;

    return {
      url: normalizeUrl(url),
      key: key.trim()
    };
  }

  /**
   * Inicializa el cliente oficial de Supabase si la librería y las llaves están presentes
   */
  function initClient() {
    const { url, key } = getCredentials();

    if (url && key && url.startsWith('http') && key.length > 15) {
      if (window.supabase && typeof window.supabase.createClient === 'function') {
        try {
          supabaseClient = window.supabase.createClient(url, key, {
            auth: {
              persistSession: false,
              autoRefreshToken: false
            }
          });
          connectionState.configured = true;
          connectionState.source = 'supabase';
          console.info('🌿 [WarmiDB] Cliente Supabase inicializado correctamente.');
          return true;
        } catch (err) {
          console.warn('⚠️ [WarmiDB] Error al inicializar cliente Supabase:', err);
          supabaseClient = null;
          connectionState.configured = false;
          connectionState.source = 'local';
          connectionState.error = err.message;
          return false;
        }
      } else {
        console.warn('⚠️ [WarmiDB] La librería @supabase/supabase-js aún no está cargada en el DOM.');
      }
    }

    supabaseClient = null;
    connectionState.configured = false;
    connectionState.source = 'local';
    return false;
  }

  // ============================================================================
  // 2. MÓDULO UNIFICADO WarmiDB
  // ============================================================================
  const WarmiDB = {
    /**
     * Devuelve el estado actual de la conexión
     */
    getStatus() {
      const creds = getCredentials();
      return {
        ...connectionState,
        url: creds.url ? `${creds.url.slice(0, 22)}...` : null,
        hasKey: Boolean(creds.key)
      };
    },

    /**
     * Guarda nuevas credenciales en localStorage y reconecta
     */
    async saveCredentials(url, key) {
      try {
        const cleanUrl = normalizeUrl(url);
        const cleanKey = (key || '').trim();

        if (cleanUrl) {
          localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
        } else {
          localStorage.removeItem(STORAGE_KEY_URL);
        }

        if (cleanKey) {
          localStorage.setItem(STORAGE_KEY_KEY, cleanKey);
        } else {
          localStorage.removeItem(STORAGE_KEY_KEY);
        }

        initClient();
        return await this.testConnection();
      } catch (err) {
        return { success: false, message: err.message };
      }
    },

    /**
     * Restablece credenciales locales
     */
    clearCredentials() {
      localStorage.removeItem(STORAGE_KEY_URL);
      localStorage.removeItem(STORAGE_KEY_KEY);
      initClient();
    },

    /**
     * Prueba la conexión realizando una consulta mínima a la tabla bitacora
     */
    async testConnection(customUrl, customKey) {
      let clientToTest = supabaseClient;

      if (customUrl && customKey) {
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
          return { success: false, message: 'La librería de Supabase no está cargada en el navegador.' };
        }
        try {
          const normUrl = normalizeUrl(customUrl);
          clientToTest = window.supabase.createClient(normUrl, customKey.trim(), {
            auth: { persistSession: false }
          });
        } catch (e) {
          return { success: false, message: 'URL o Llave inválida: ' + e.message };
        }
      }

      if (!clientToTest) {
        return {
          success: false,
          message: 'No hay credenciales configuradas para Supabase. Se utilizará el modo local.'
        };
      }

      try {
        const { data, error, count } = await clientToTest
          .from('bitacora')
          .select('id, tipo, mensaje, created_at', { count: 'exact' })
          .limit(1);

        if (error) {
          connectionState.online = false;
          connectionState.error = error.message;
          return {
            success: false,
            message: `Error de Supabase: ${error.message} (Revisa si ejecutaste el script SQL de tablas y políticas).`
          };
        }

        connectionState.online = true;
        connectionState.error = null;
        connectionState.lastSync = new Date().toISOString();

        return {
          success: true,
          message: `¡Conexión exitosa con Supabase! Tabla 'bitacora' detectada (${count || 0} registros encontrados).`,
          count: count || 0
        };
      } catch (err) {
        connectionState.online = false;
        connectionState.error = err.message;
        return {
          success: false,
          message: `Error de red o conexión: ${err.message}`
        };
      }
    },

    /**
     * REGISTRAR EVENTO EN LA BITÁCORA
     * Guarda en localStorage y envía asíncronamente a Supabase
     */
    async logEvent(tipo, mensaje, usuario_tipo = 'cliente', detalles = null) {
      const hora = new Date().toLocaleTimeString();
      const timestamp = new Date().toISOString();

      const entry = {
        hora,
        tipo: (tipo || 'EVENTO').toUpperCase(),
        mensaje: String(mensaje || ''),
        usuario_tipo: usuario_tipo || 'cliente',
        detalles: detalles || {},
        timestamp
      };

      // 1. Guardar de inmediato en LocalStorage (Respaldo offline & síncrono)
      try {
        const localList = JSON.parse(localStorage.getItem(STORAGE_KEY_BITACORA) || '[]');
        localList.unshift(entry);
        if (localList.length > 200) localList.length = 200;
        localStorage.setItem(STORAGE_KEY_BITACORA, JSON.stringify(localList));
      } catch (e) {
        console.warn('[WarmiDB] Error guardando bitácora local:', e);
      }

      // 2. Disparar evento personalizado en el DOM para observadores en vivo
      try {
        window.dispatchEvent(new CustomEvent('warmi:event_logged', { detail: entry }));
      } catch (e) {}

      // 3. Si Supabase está disponible, enviar a la tabla 'bitacora'
      if (supabaseClient) {
        try {
          const { error } = await supabaseClient.from('bitacora').insert([
            {
              hora: entry.hora,
              tipo: entry.tipo,
              mensaje: entry.mensaje,
              usuario_tipo: entry.usuario_tipo,
              detalles: entry.detalles
            }
          ]);

          if (error) {
            console.warn('⚠️ [WarmiDB] Advertencia al sincronizar evento en Supabase:', error.message);
          } else {
            connectionState.online = true;
          }
        } catch (err) {
          console.warn('⚠️ [WarmiDB] Fallo de red registrando evento en Supabase:', err.message);
        }
      }

      return entry;
    },

    /**
     * OBTENER EVENTOS DE LA BITÁCORA
     * Si hay Supabase configurado, consulta la nube; si no, devuelve los registros de localStorage
     */
    async fetchBitacora(filter = 'all', limit = 100) {
      let events = [];
      let source = 'local';

      if (supabaseClient) {
        try {
          let query = supabaseClient
            .from('bitacora')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

          if (filter && filter !== 'all') {
            query = query.ilike('tipo', `%${filter}%`);
          }

          const { data, error } = await query;

          if (!error && Array.isArray(data)) {
            events = data.map(item => ({
              id: item.id,
              hora: item.hora || new Date(item.created_at).toLocaleTimeString(),
              tipo: item.tipo,
              mensaje: item.mensaje,
              usuario_tipo: item.usuario_tipo || 'cliente',
              detalles: item.detalles,
              created_at: item.created_at
            }));
            source = 'supabase';
            connectionState.online = true;
            return { events, source, success: true };
          }
        } catch (e) {
          console.warn('[WarmiDB] Error consultando Supabase, recurriendo a local:', e);
        }
      }

      // Fallback a LocalStorage
      try {
        const localList = JSON.parse(localStorage.getItem(STORAGE_KEY_BITACORA) || '[]');
        const filtered = localList.filter(item => {
          if (!filter || filter === 'all') return true;
          return (item.tipo || '').toUpperCase().includes(filter.toUpperCase());
        });
        events = filtered.slice(0, limit);
      } catch (e) {
        events = [];
      }

      return { events, source: 'local', success: true };
    },

    /**
     * LIMPIAR LA BITÁCORA
     */
    async clearBitacora() {
      // 1. Limpiar local
      localStorage.setItem(STORAGE_KEY_BITACORA, JSON.stringify([]));

      // 2. Si hay Supabase, eliminar registros
      if (supabaseClient) {
        try {
          await supabaseClient.from('bitacora').delete().gte('id', 0);
        } catch (e) {
          console.warn('[WarmiDB] Error vaciando tabla bitacora en Supabase:', e);
        }
      }

      await this.logEvent('BITACORA_VACIADA', 'El administrador reinició los registros de la bitácora', 'admin');
      return true;
    },

    /**
     * GUARDAR O ACTUALIZAR UNA RESERVA
     */
    async saveReservation(reserva) {
      // 1. Guardar localmente
      try {
        const localList = JSON.parse(localStorage.getItem(STORAGE_KEY_RESERVATIONS) || '[]');
        const index = localList.findIndex(r => r.code === reserva.code);
        if (index >= 0) {
          localList[index] = { ...localList[index], ...reserva };
        } else {
          localList.unshift(reserva);
        }
        localStorage.setItem(STORAGE_KEY_RESERVATIONS, JSON.stringify(localList));
      } catch (e) {
        console.warn('[WarmiDB] Error guardando reserva local:', e);
      }

      // 2. Sincronizar en Supabase si está disponible
      if (supabaseClient) {
        try {
          const dbRecord = {
            code: reserva.code,
            client_name: reserva.clientName,
            phone: reserva.phone,
            person_count: reserva.personCount || 1,
            experience_name: reserva.experience?.name || '',
            duration: reserva.experience?.duration || '',
            price: reserva.experience?.price || 0,
            specialist_name: reserva.specialist?.name || '',
            date_time: reserva.dateTime || '',
            date_key: reserva.dateKey || '',
            time_slot: reserva.timeSlot || '',
            status: reserva.status || 'Confirmada',
            cancellation_reason: reserva.cancellationReason || null
          };

          const { error } = await supabaseClient
            .from('reservas')
            .upsert(dbRecord, { onConflict: 'code' });

          if (error) {
            console.warn('⚠️ [WarmiDB] Error sincronizando reserva en Supabase:', error.message);
          }
        } catch (err) {
          console.warn('⚠️ [WarmiDB] Error de red en reserva Supabase:', err.message);
        }
      }
    },

    /**
     * ACTUALIZAR ESTADO DE RESERVA (ej. cancelación justificada)
     */
    async updateReservationStatus(code, newStatus, cancellationReason = null) {
      // 1. Local
      try {
        const localList = JSON.parse(localStorage.getItem(STORAGE_KEY_RESERVATIONS) || '[]');
        const target = localList.find(r => r.code === code);
        if (target) {
          target.status = newStatus;
          if (cancellationReason) {
            target.cancellationReason = cancellationReason;
          }
          localStorage.setItem(STORAGE_KEY_RESERVATIONS, JSON.stringify(localList));
        }
      } catch (e) {}

      // 2. Supabase
      if (supabaseClient) {
        try {
          const updateData = { status: newStatus };
          if (cancellationReason) updateData.cancellation_reason = cancellationReason;

          await supabaseClient
            .from('reservas')
            .update(updateData)
            .eq('code', code);
        } catch (e) {
          console.warn('[WarmiDB] Error actualizando estado en Supabase:', e);
        }
      }
    },

    /**
     * CONSULTAR TODAS LAS RESERVAS
     */
    async fetchReservations() {
      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient
            .from('reservas')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data) && data.length > 0) {
            // Mapear al formato usado por la app
            const mapped = data.map(r => ({
              code: r.code,
              clientName: r.client_name,
              phone: r.phone,
              personCount: r.person_count,
              experience: {
                name: r.experience_name,
                duration: r.duration,
                price: Number(r.price || 0)
              },
              specialist: {
                name: r.specialist_name,
                role: r.specialist_name === 'Rosa' ? 'Faciales & Piel' :
                      r.specialist_name === 'Moy' ? 'Rituales Zen' : 'Masajes y Terapias'
              },
              dateTime: r.date_time,
              dateKey: r.date_key,
              timeSlot: r.time_slot,
              status: r.status,
              cancellationReason: r.cancellation_reason,
              createdAt: r.created_at
            }));
            // Sincronizar espejo local
            localStorage.setItem(STORAGE_KEY_RESERVATIONS, JSON.stringify(mapped));
            return mapped;
          }
        } catch (e) {
          console.warn('[WarmiDB] Error leyendo reservas de Supabase:', e);
        }
      }

      // Local fallback
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_RESERVATIONS) || '[]');
      } catch (e) {
        return [];
      }
    }
  };

  // Inicializar al cargar el script
  initClient();

  // Exponer globalmente
  window.WarmiDB = WarmiDB;

})(window);
