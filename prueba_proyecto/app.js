/**
 * Happy Warmi Spa - Aplicación Principal (Versión 2.1)
 * UPDS 2026 • Diseño Web II • Criterio 1: JS y DOM/BOM
 * 
 * Características:
 * 1. Panel de Bitácora y Auditoría de Eventos en Tiempo Real (Event Bubbling & Delegación)
 * 2. Personal exclusivo: Maya, Rosa y Moy (Capacidad total = 3 terapeutas)
 * 3. Selección de grupo (1 persona, 2 personas, 3 personas) con ocupación dinámica
 * 4. Bloqueo de horarios cuando todo el personal esté ocupado
 * 5. Validación estricta en tiempo real (Nombre: solo letras; Teléfono: solo números)
 * 6. Cancelación de citas por el usuario con JUSTIFICACIÓN obligatoria registrada en la Bitácora
 * 7. Apartado "Cosas del Spa" (WhatsApp, redes, contacto y stream)
 * 8. Soporte PWA offline y escritorio con prevención de memory leaks
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // ==========================================================================
  // 1. CONSTANTES, ALMACENAMIENTO Y MIGRACIÓN
  // ==========================================================================
  const STORAGE_KEY_RESERVATIONS = 'happy_warmi_reservations';
  const STORAGE_KEY_BITACORA = 'happy_warmi_bitacora';
  const LEGACY_STORAGE_KEY = 'asio_spa_reservations';

  // Migración transparente si existían datos anteriores
  function getStoredReservations() {
    try {
      const current = localStorage.getItem(STORAGE_KEY_RESERVATIONS);
      if (current) return JSON.parse(current);
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        // Migrar formato
        const adapted = parsed.map(r => ({
          ...r,
          code: r.code ? r.code.replace('ASIO-', 'HWARMI-') : `HWARMI-${Math.floor(10000 + Math.random() * 90000)}`,
          personCount: r.personCount || 1,
          specialist: r.specialist?.name === 'Haru' ? { name: 'Rosa', role: 'Faciales & Piel' } :
                      r.specialist?.name === 'Sora' || r.specialist?.name === 'Kenji' ? { name: 'Moy', role: 'Rituales Zen' } :
                      { name: 'Maya', role: 'Masajes y Terapias' }
        }));
        localStorage.setItem(STORAGE_KEY_RESERVATIONS, JSON.stringify(adapted));
        return adapted;
      }
      return [];
    } catch (e) {
      console.warn('Error leyendo reservas:', e);
      return [];
    }
  }

  function saveStoredReservations(list) {
    try {
      localStorage.setItem(STORAGE_KEY_RESERVATIONS, JSON.stringify(list));
    } catch (e) {
      console.warn('Error guardando reservas:', e);
    }
  }

  // Personal oficial de Happy Warmi Spa (Solo 3 personas)
  const SPECIALISTS = [
    { id: 'maya', name: 'Maya', role: 'Masajes y Terapias Corporales' },
    { id: 'rosa', name: 'Rosa', role: 'Faciales & Cuidado de la Piel' },
    { id: 'moy',  name: 'Moy',  role: 'Rituales Zen & Armonización' }
  ];

  // ==========================================================================
  // 2. SISTEMA DE BITÁCORA DE EVENTOS (UPDS 2026)
  // ==========================================================================
  // 2. SISTEMA DE BITÁCORA DE EVENTOS (SUPABASE + LOCALSTORAGE HÍBRIDO)
  // ==========================================================================
  const logOutput = document.getElementById('logOutput');

  function logEvent(tipo, mensaje, detalles = null) {
    // 1. Enviar a WarmiDB (registra en Supabase en la nube y en LocalStorage de respaldo)
    if (window.WarmiDB && typeof window.WarmiDB.logEvent === 'function') {
      window.WarmiDB.logEvent(tipo, mensaje, 'cliente', detalles);
    } else {
      const hora = new Date().toLocaleTimeString();
      try {
        const bitacora = JSON.parse(localStorage.getItem(STORAGE_KEY_BITACORA) || '[]');
        bitacora.unshift({
          hora,
          tipo,
          mensaje,
          usuario_tipo: 'cliente',
          timestamp: new Date().toISOString()
        });
        if (bitacora.length > 200) bitacora.length = 200;
        localStorage.setItem(STORAGE_KEY_BITACORA, JSON.stringify(bitacora));
      } catch (e) {}
    }

    // 2. Si existe elemento logOutput (para compatibilidad)
    if (logOutput) {
      const hora = new Date().toLocaleTimeString();
      const item = document.createElement('div');
      item.textContent = `[${hora}] ${tipo}: ${mensaje}`;
      logOutput.prepend(item);
    }
  }

  // Cargar bitácora si existe panel en el DOM
  function loadInitialBitacora() {
    if (!logOutput) return;
    try {
      const bitacora = JSON.parse(localStorage.getItem(STORAGE_KEY_BITACORA) || '[]');
      if (bitacora.length > 0) {
        bitacora.slice(0, 15).reverse().forEach(entry => {
          const item = document.createElement('div');
          item.textContent = `[${entry.hora}] ${entry.tipo}: ${entry.mensaje}`;
          logOutput.prepend(item);
        });
      }
    } catch (e) {
      console.warn('Bitacora init:', e);
    }
  }
  loadInitialBitacora();

  // Limpiar Bitácora si existe botón
  const btnClearClientBitacora = document.getElementById('btnClearClientBitacoraBtn');
  if (btnClearClientBitacora) {
    btnClearClientBitacora.addEventListener('click', () => {
      if (window.WarmiDB && typeof window.WarmiDB.clearBitacora === 'function') {
        window.WarmiDB.clearBitacora();
      } else {
        localStorage.setItem(STORAGE_KEY_BITACORA, JSON.stringify([]));
      }
      if (logOutput) {
        logOutput.innerHTML = '<div>[Bitácora vaciada] Escuchando nuevas interacciones...</div>';
      }
      showToast('Bitácora reiniciada con éxito');
    });
  }

  // ==========================================================================
  // 3. EVENT BUBBLING & DELEGACIÓN EN EL CONTENEDOR LIVE (#liveSpaContainer)
  //    (Rastreo de Clics, Doble Clic y Keyup según guía oficial)
  // ==========================================================================
  const liveContainer = document.getElementById('liveSpaContainer');
  const chatInput = document.getElementById('chatInput');
  const btnSendChat = document.getElementById('btnSendChat');
  const liveChatFeed = document.getElementById('liveChatFeed');

  if (liveContainer) {
    // 1. Delegación de eventos de ratón (click)
    liveContainer.addEventListener('click', (e) => {
      // Clic en Oferta de producto
      const btnOferta = e.target.closest('[data-prod]');
      if (btnOferta) {
        const prod = btnOferta.dataset.prod;
        logEvent('OFERTA_CLICK', `Producto de Live seleccionado: ${prod}`);
        showToast(`Oferta seleccionada: ${prod}`);
        return;
      }

      // Clic en botón "Me Gusta"
      const btnLike = e.target.closest('[data-action="like"]');
      if (btnLike) {
        logEvent('LIKE_STREAM', '¡El usuario envió un ❤️ al Live de Happy Warmi!');
        renderFloatingHeart(e.clientX, e.clientY);
        showToast('¡Gracias por tu ❤️ en el Live!');
      }
    });

    // 2. Evento de ratón dblclick (Enviar corazones / Likes dobles)
    liveContainer.addEventListener('dblclick', (e) => {
      logEvent('LIKE_STREAM_DBLCLICK', '¡Doble corazón ❤️❤️ enviado al Live de Happy Warmi Spa!');
      renderFloatingHeart(e.clientX, e.clientY);
      setTimeout(() => renderFloatingHeart(e.clientX + 15, e.clientY - 15), 120);
      showToast('¡❤️❤️ Doble like enviado!');
    });
  }

  // 3. Envío de mensajes en el chat de la comunidad
  function handleSendChatMessage() {
    if (!chatInput) return;
    const msg = chatInput.value.trim();
    if (!msg) return;

    logEvent('CHAT_MENSAJE_ENVIADO', `Mensaje enviado al chat: "${msg}"`);
    showToast('Mensaje enviado al chat del live');

    if (liveChatFeed) {
      const bubble = document.createElement('div');
      bubble.style.padding = '0.3rem 0.5rem';
      bubble.style.background = 'rgba(255,255,255,0.06)';
      bubble.style.borderRadius = '6px';
      bubble.innerHTML = `<strong>Tú:</strong> ${msg}`;
      liveChatFeed.appendChild(bubble);
      liveChatFeed.scrollTop = liveChatFeed.scrollHeight;

      // Respuesta cálida de terapeutas
      setTimeout(() => {
        const therapistNames = ['Maya (Masajes)', 'Rosa (Faciales)', 'Moy (Rituales)'];
        const randomTherapist = therapistNames[Math.floor(Math.random() * therapistNames.length)];
        const reply = document.createElement('div');
        reply.style.padding = '0.3rem 0.5rem';
        reply.style.background = 'rgba(90, 73, 120, 0.2)';
        reply.style.borderRadius = '6px';
        reply.style.color = '#E9D5FF';
        reply.innerHTML = `🌿 <strong>${randomTherapist}:</strong> ¡Gracias por escribirnos! Estaremos encantadas de recibirte.`;
        liveChatFeed.appendChild(reply);
        liveChatFeed.scrollTop = liveChatFeed.scrollHeight;
      }, 1200);
    }

    chatInput.value = '';
  }

  if (chatInput) {
    chatInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        handleSendChatMessage();
      }
    });
  }

  if (btnSendChat) {
    btnSendChat.addEventListener('click', handleSendChatMessage);
  }

  // Animación visual de corazón flotante al interactuar
  function renderFloatingHeart(clientX, clientY) {
    const heart = document.createElement('div');
    heart.className = 'floating-heart-anim';
    heart.textContent = '❤️';
    
    // Posición relativa al contenedor o a la ventana
    const x = clientX || window.innerWidth / 2;
    const y = clientY || window.innerHeight / 2;
    heart.style.left = `${x}px`;
    heart.style.top = `${y}px`;

    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 1200);
  }

  // ==========================================================================
  // 4. SISTEMA DE DESPLIEGUE DE VISTAS (SPA CERO SCROLL)
  // ==========================================================================
  const viewPanels = document.querySelectorAll('.spa-view-panel');
  const viewTabButtons = document.querySelectorAll('.view-btn-tab');
  const mobileNavItems = document.querySelectorAll('.mobile-nav-item');

  function switchView(targetViewName) {
    if (!targetViewName) return;

    viewPanels.forEach(panel => panel.classList.remove('active'));

    const activePanel = document.getElementById(`view-${targetViewName}`);
    if (activePanel) {
      activePanel.classList.add('active');
      activePanel.scrollTop = 0;
    }

    viewTabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.targetView === targetViewName);
    });

    mobileNavItems.forEach(item => {
      item.classList.toggle('active', item.dataset.targetView === targetViewName);
    });

    logEvent('CAMBIO_VISTA', `Navegación del usuario hacia la vista: ${targetViewName}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.view-trigger-btn, .view-btn-tab, .mobile-nav-item');
    if (trigger && trigger.dataset.targetView) {
      e.preventDefault();
      switchView(trigger.dataset.targetView);
    }
  });

  // ==========================================================================
  // 5. ESTADO DE LA RESERVA (CON GRUPOS Y CAPACIDAD DE PERSONAL)
  // ==========================================================================
  const bookingState = {
    step: 1,
    personCount: 1, // 1, 2, o 3
    experience: {
      id: 'masaje-relajante',
      name: 'Masaje Relajante',
      duration: '60 min',
      price: 40
    },
    specialist: {
      id: 'maya',
      name: 'Maya',
      role: 'Masajes y Terapias Corporales'
    },
    date: {
      day: 19,
      month: 3, // Abril (0-indexed)
      year: 2025,
      dateString: 'Sábado, 19 de Abril 2025',
      dateKey: '2025-04-19'
    },
    timeSlot: '10:00'
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Elementos del formulario y calendario
  const calendarDaysContainer = document.getElementById('calendarDaysGrid');
  const calendarMonthTitle = document.getElementById('calendarMonthTitle');
  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  const continueBookingBtn = document.getElementById('continueBookingBtn');
  const stepperItems = document.querySelectorAll('.step-item');
  const groupSizeContainer = document.getElementById('groupSizeContainer');
  const timeSlotsContainer = document.getElementById('timeSlotsGridContainer');

  // ==========================================================================
  // 6. SELECCIÓN DE EXPERIENCIAS, GRUPOS Y ESPECIALISTAS
  // ==========================================================================
  // Selección de experiencia
  const experienceContainer = document.querySelector('.experience-selection-grid');
  if (experienceContainer) {
    experienceContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.experience-select-item');
      if (!item) return;

      document.querySelectorAll('.experience-select-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');

      bookingState.experience = {
        id: item.dataset.id,
        name: item.dataset.name,
        duration: item.dataset.duration,
        price: parseFloat(item.dataset.price)
      };

      updateStepper(1);
      logEvent('EXPERIENCIA_SELECT', `Servicio seleccionado: ${bookingState.experience.name}`);
      showToast(`Experiencia: ${bookingState.experience.name}`);
    });
  }

  // Clic en "Reservar ahora" desde la vista de experiencias
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.deploy-reserve-btn');
    if (!btn) return;

    const targetId = btn.dataset.targetId;
    const matchingExpItem = document.querySelector(`.experience-select-item[data-id="${targetId}"]`);
    if (matchingExpItem) matchingExpItem.click();
    switchView('reserva');
  });

  // Selección de Cantidad de Personas (Grupo: 1, 2 o 3 personas)
  if (groupSizeContainer) {
    groupSizeContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.group-size-pill');
      if (!pill) return;

      document.querySelectorAll('.group-size-pill').forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');

      const count = parseInt(pill.dataset.persons, 10) || 1;
      bookingState.personCount = count;

      // Actualizar especialista según tamaño de grupo
      if (count === 3) {
        bookingState.specialist = {
          id: 'grupo-completo',
          name: 'Maya, Rosa y Moy',
          role: 'Todo el Equipo Asignado'
        };
        showToast('Grupo de 3 personas: Asignados Maya, Rosa y Moy');
      } else if (count === 2) {
        bookingState.specialist = {
          id: 'pareja-dos',
          name: 'Maya y Rosa (Dúo)',
          role: '2 Terapeutas Asignadas'
        };
        showToast('Cita para 2 personas: 2 Terapeutas asignadas');
      }

      updateStepper(2);
      logEvent('GRUPO_SELECT', `Tamaño de reserva: ${count} persona(s)`);
      // Refrescar disponibilidad de horarios con la nueva cantidad de personas
      updateSlotsAvailability();
    });
  }

  // Selección de Especialista (Maya, Rosa, Moy)
  const specialistContainer = document.getElementById('specialistsListContainer');
  if (specialistContainer) {
    specialistContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.specialist-card');
      if (!card) return;

      document.querySelectorAll('.specialist-card').forEach(el => el.classList.remove('selected'));
      card.classList.add('selected');

      bookingState.specialist = {
        id: card.dataset.id,
        name: card.dataset.name,
        role: card.dataset.role
      };

      updateStepper(2);
      logEvent('ESPECIALISTA_SELECT', `Terapeuta seleccionado: ${bookingState.specialist.name}`);
      showToast(`Terapeuta: ${bookingState.specialist.name}`);
      updateSlotsAvailability();
    });
  }

  // ==========================================================================
  // 7. LÓGICA DE OCUPACIÓN Y DISPONIBILIDAD DE HORARIOS
  //    (Total personal = 3: Maya, Rosa y Moy. Si todos están ocupados, se cierra la hora)
  // ==========================================================================
  function updateSlotsAvailability() {
    if (!timeSlotsContainer) return;

    const allReservations = getStoredReservations();
    const currentDateKey = bookingState.date.dateKey;
    const requestedPersons = bookingState.personCount || 1;

    // Filtrar citas activas para esta fecha
    const dateReservations = allReservations.filter(r => 
      (r.dateKey === currentDateKey || (r.dateTime && r.dateTime.includes(bookingState.date.dateString))) &&
      (r.status || 'Confirmada') !== 'Cancelada'
    );

    const slotButtons = timeSlotsContainer.querySelectorAll('.time-slot-pill');
    let hasSelectedValidSlot = false;

    slotButtons.forEach(btn => {
      const time = btn.dataset.time;
      
      // Contar terapeutas ocupados a esta hora
      const reservationsAtTime = dateReservations.filter(r => 
        r.timeSlot === time || (r.dateTime && r.dateTime.includes(time))
      );

      let occupiedStaffCount = 0;
      reservationsAtTime.forEach(r => {
        occupiedStaffCount += (r.personCount || 1);
      });

      const freeSpots = Math.max(0, 3 - occupiedStaffCount);

      // Limpiar estados previos
      btn.classList.remove('slot-occupied', 'disabled');
      btn.removeAttribute('disabled');
      btn.title = '';

      // Si todo el personal (3) está ocupado -> CERRADO
      if (occupiedStaffCount >= 3) {
        btn.classList.add('slot-occupied');
        btn.setAttribute('disabled', 'true');
        btn.title = 'Horario totalmente ocupado: Maya, Rosa y Moy tienen citas asignadas.';
      } 
      // Si los cupos libres no alcanzan para el grupo solicitado (ej. quiere 2 y solo queda 1)
      else if (freeSpots < requestedPersons) {
        btn.classList.add('slot-occupied');
        btn.setAttribute('disabled', 'true');
        btn.title = `Solo queda ${freeSpots} terapeuta disponible para esta hora (solicitas ${requestedPersons}).`;
      } 
      else {
        btn.title = `Disponible: ${freeSpots} terapeuta(s) libre(s)`;
        if (btn.dataset.time === bookingState.timeSlot) {
          hasSelectedValidSlot = true;
          btn.classList.add('selected');
        }
      }
    });

    // Si el horario seleccionado quedó ocupado, elegir el primer disponible
    if (!hasSelectedValidSlot) {
      const firstAvailable = timeSlotsContainer.querySelector('.time-slot-pill:not(.slot-occupied)');
      if (firstAvailable) {
        slotButtons.forEach(b => b.classList.remove('selected'));
        firstAvailable.classList.add('selected');
        bookingState.timeSlot = firstAvailable.dataset.time;
      }
    }
  }

  // Delegación de clics en Horarios Disponibles
  if (timeSlotsContainer) {
    timeSlotsContainer.addEventListener('click', (e) => {
      const slot = e.target.closest('.time-slot-pill:not(.slot-occupied):not([disabled])');
      if (!slot) return;

      document.querySelectorAll('.time-slot-pill').forEach(s => s.classList.remove('selected'));
      slot.classList.add('selected');
      bookingState.timeSlot = slot.dataset.time || slot.textContent.trim();

      updateStepper(3);
      logEvent('HORA_SELECT', `Hora seleccionada: ${bookingState.timeSlot} hrs`);
      showToast(`Hora: ${bookingState.timeSlot} hrs`);
    });
  }

  // ==========================================================================
  // 8. CALENDARIO INTERACTIVO
  // ==========================================================================
  let currentViewingYear = 2025;
  let currentViewingMonth = 3; // Abril

  function renderCalendar(year, month) {
    if (!calendarDaysContainer || !calendarMonthTitle) return;

    calendarMonthTitle.textContent = `${monthNames[month]} ${year}`;
    calendarDaysContainer.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const startingOffset = (firstDay + 6) % 7; // Lunes inicio
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Días vacíos de relleno
    for (let i = 0; i < startingOffset; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'cal-day-cell disabled';
      calendarDaysContainer.appendChild(emptyCell);
    }

    // Días del mes
    for (let d = 1; d <= daysInMonth; d++) {
      const dayCell = document.createElement('div');
      dayCell.className = 'cal-day-cell';
      dayCell.textContent = String(d);
      dayCell.dataset.day = String(d);

      if (d === bookingState.date.day && month === bookingState.date.month && year === bookingState.date.year) {
        dayCell.classList.add('selected');
      }

      calendarDaysContainer.appendChild(dayCell);
    }

    updateSlotsAvailability();
  }

  // Delegación de clics en días del calendario
  if (calendarDaysContainer) {
    calendarDaysContainer.addEventListener('click', (e) => {
      const cell = e.target.closest('.cal-day-cell:not(.disabled)');
      if (!cell || !cell.dataset.day) return;

      document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');

      const d = parseInt(cell.dataset.day, 10);
      bookingState.date.day = d;
      bookingState.date.month = currentViewingMonth;
      bookingState.date.year = currentViewingYear;

      const padMonth = String(currentViewingMonth + 1).padStart(2, '0');
      const padDay = String(d).padStart(2, '0');
      bookingState.date.dateKey = `${currentViewingYear}-${padMonth}-${padDay}`;

      const dateObj = new Date(currentViewingYear, currentViewingMonth, d);
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      bookingState.date.dateString = `${dayNames[dateObj.getDay()]}, ${d} de ${monthNames[currentViewingMonth]} ${currentViewingYear}`;

      updateStepper(3);
      logEvent('FECHA_SELECT', `Fecha seleccionada: ${bookingState.date.dateString}`);
      showToast(`Fecha: ${bookingState.date.dateString}`);
      
      updateSlotsAvailability();
    });
  }

  if (prevMonthBtn && nextMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      currentViewingMonth--;
      if (currentViewingMonth < 0) {
        currentViewingMonth = 11;
        currentViewingYear--;
      }
      renderCalendar(currentViewingYear, currentViewingMonth);
    });

    nextMonthBtn.addEventListener('click', () => {
      currentViewingMonth++;
      if (currentViewingMonth > 11) {
        currentViewingMonth = 0;
        currentViewingYear++;
      }
      renderCalendar(currentViewingYear, currentViewingMonth);
    });
  }

  renderCalendar(currentViewingYear, currentViewingMonth);

  // Stepper
  function updateStepper(stepNumber) {
    bookingState.step = Math.max(bookingState.step, stepNumber);
    stepperItems.forEach((stepEl, idx) => {
      stepEl.classList.toggle('active', (idx + 1) === bookingState.step);
    });
  }

  if (continueBookingBtn) {
    continueBookingBtn.addEventListener('click', () => {
      openBookingConfirmationModal();
    });
  }

  // ==========================================================================
  // 9. FORMULARIO DE RESERVA: VALIDACIÓN ESTRICTA
  //    (Nombre: solo letras; Teléfono: solo números)
  // ==========================================================================
  const bookingModal = document.getElementById('bookingModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const confirmBookingForm = document.getElementById('confirmBookingForm');
  const clientNameInput = document.getElementById('clientName');
  const clientPhoneInput = document.getElementById('clientPhone');
  const clientNameError = document.getElementById('clientNameError');
  const clientPhoneError = document.getElementById('clientPhoneError');

  // Regex para validación
  // Nombre: Solo letras del alfabeto latino, acentos, diéresis y espacios (al menos 3 letras)
  const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]{3,60}$/;
  // Teléfono: Solo números (opcional un + inicial), de 7 a 15 dígitos
  const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

  // Validación y filtrado estricto en el input de Nombre
  if (clientNameInput) {
    clientNameInput.addEventListener('input', (e) => {
      // Bloquear o limpiar números y símbolos en tiempo real
      const cleanVal = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
      if (cleanVal !== e.target.value) {
        e.target.value = cleanVal;
      }
      validateName();
    });
  }

  function validateName() {
    if (!clientNameInput) return false;
    const val = clientNameInput.value.trim();
    const isValid = NAME_REGEX.test(val);
    if (!isValid && val.length > 0) {
      clientNameInput.classList.add('is-invalid');
      clientNameInput.classList.remove('is-valid');
      if (clientNameError) clientNameError.classList.add('visible');
    } else if (isValid) {
      clientNameInput.classList.remove('is-invalid');
      clientNameInput.classList.add('is-valid');
      if (clientNameError) clientNameError.classList.remove('visible');
    } else {
      clientNameInput.classList.remove('is-invalid', 'is-valid');
      if (clientNameError) clientNameError.classList.remove('visible');
    }
    return isValid;
  }

  // Validación y filtrado estricto en el input de Teléfono
  if (clientPhoneInput) {
    clientPhoneInput.addEventListener('input', (e) => {
      // Bloquear letras y permitir solo dígitos y un posible '+'
      const cleanVal = e.target.value.replace(/[^0-9+]/g, '');
      if (cleanVal !== e.target.value) {
        e.target.value = cleanVal;
      }
      validatePhone();
    });
  }

  function validatePhone() {
    if (!clientPhoneInput) return false;
    const val = clientPhoneInput.value.trim();
    const isValid = PHONE_REGEX.test(val);
    if (!isValid && val.length > 0) {
      clientPhoneInput.classList.add('is-invalid');
      clientPhoneInput.classList.remove('is-valid');
      if (clientPhoneError) clientPhoneError.classList.add('visible');
    } else if (isValid) {
      clientPhoneInput.classList.remove('is-invalid');
      clientPhoneInput.classList.add('is-valid');
      if (clientPhoneError) clientPhoneError.classList.remove('visible');
    } else {
      clientPhoneInput.classList.remove('is-invalid', 'is-valid');
      if (clientPhoneError) clientPhoneError.classList.remove('visible');
    }
    return isValid;
  }

  function openBookingConfirmationModal() {
    if (!bookingModal) return;

    const groupText = bookingState.personCount === 1 ? '1 Persona (Individual)' :
                      bookingState.personCount === 2 ? '2 Personas (Dúo / Pareja)' :
                      '3 Personas (Grupo Relax)';
    const totalPrice = bookingState.experience.price * bookingState.personCount;

    document.getElementById('summaryExpName').textContent = bookingState.experience.name;
    document.getElementById('summaryGroupSize').textContent = groupText;
    document.getElementById('summaryDuration').textContent = bookingState.experience.duration;
    document.getElementById('summaryPrice').textContent = `Bs ${totalPrice.toFixed(2)}`;
    document.getElementById('summarySpecialist').textContent = `${bookingState.specialist.name} (${bookingState.specialist.role})`;
    document.getElementById('summaryDateTime').textContent = `${bookingState.date.dateString} - ${bookingState.timeSlot} hrs`;

    bookingModal.classList.add('active');
    logEvent('MODAL_RESERVA_ABIERTO', `Revisión de reserva para ${bookingState.experience.name}`);
  }

  function closeBookingConfirmationModal() {
    if (!bookingModal) return;
    bookingModal.classList.remove('active');
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeBookingConfirmationModal);
  if (bookingModal) {
    bookingModal.addEventListener('click', (e) => {
      if (e.target === bookingModal) closeBookingConfirmationModal();
    });
  }

  // Envío del formulario de confirmación
  if (confirmBookingForm) {
    confirmBookingForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const isNameValid = validateName();
      const isPhoneValid = validatePhone();

      if (!isNameValid) {
        if (clientNameInput) clientNameInput.focus();
        showToast('El nombre solo debe contener letras.');
        return;
      }

      if (!isPhoneValid) {
        if (clientPhoneInput) clientPhoneInput.focus();
        showToast('El teléfono solo debe contener números.');
        return;
      }

      const clientName = clientNameInput.value.trim();
      const clientPhone = clientPhoneInput.value.trim();
      const bookingCode = `HWARMI-${Math.floor(10000 + Math.random() * 90000)}`;

      closeBookingConfirmationModal();

      const newReservation = {
        code: bookingCode,
        clientName,
        phone: clientPhone,
        personCount: bookingState.personCount,
        experience: {
          ...bookingState.experience,
          totalPrice: bookingState.experience.price * bookingState.personCount
        },
        specialist: bookingState.specialist,
        dateTime: `${bookingState.date.dateString} - ${bookingState.timeSlot} hrs`,
        dateKey: bookingState.date.dateKey,
        timeSlot: bookingState.timeSlot,
        status: 'Confirmada',
        cancellationReason: null,
        cancelledAt: null,
        createdAt: new Date().toISOString()
      };

      const stored = getStoredReservations();
      stored.unshift(newReservation);
      saveStoredReservations(stored);

      // Sincronizar en Supabase si está disponible
      if (window.WarmiDB && typeof window.WarmiDB.saveReservation === 'function') {
        window.WarmiDB.saveReservation(newReservation);
      }

      // Registrar en la Bitácora de Eventos
      logEvent('RESERVA_CONFIRMADA', `Cita ${bookingCode} confirmada para ${clientName} (${bookingState.personCount} personas) con ${bookingState.specialist.name} a las ${bookingState.timeSlot} hrs`);

      // Refrescar disponibilidad de horarios (bloqueará la hora si ya se llenó)
      updateSlotsAvailability();

      // Modal de éxito
      const successModal = document.getElementById('successModal');
      if (successModal) {
        document.getElementById('successClientName').textContent = clientName;
        document.getElementById('successBookingCode').textContent = bookingCode;
        document.getElementById('successDetails').textContent = 
          `${bookingState.experience.name} (${bookingState.personCount} pers.) con ${bookingState.specialist.name} para el ${bookingState.date.dateString} a las ${bookingState.timeSlot} hrs.`;
        successModal.classList.add('active');
      }

      // Limpiar inputs
      confirmBookingForm.reset();
      clientNameInput.classList.remove('is-valid');
      clientPhoneInput.classList.remove('is-valid');

      showToast(`¡Cita ${bookingCode} agendada con éxito!`);
    });
  }

  const successCloseBtn = document.getElementById('successCloseBtn');
  if (successCloseBtn) {
    successCloseBtn.addEventListener('click', () => {
      const successModal = document.getElementById('successModal');
      if (successModal) successModal.classList.remove('active');
    });
  }

  // ==========================================================================
  // 10. GESTIÓN DE CITAS Y CANCELACIÓN CON JUSTIFICACIÓN (REQUERIMIENTO OFICIAL)
  // ==========================================================================
  const myBookingsModal = document.getElementById('myBookingsModal');
  const openMyBookingsBtn = document.getElementById('openMyBookingsBtn');
  const myBookingsCloseBtn = document.getElementById('myBookingsCloseBtn');
  const myBookingsListContainer = document.getElementById('myBookingsListContainer');
  const myBookingCodeSearch = document.getElementById('myBookingCodeSearch');
  const btnSearchMyBooking = document.getElementById('btnSearchMyBooking');

  const cancelBookingModal = document.getElementById('cancelBookingModal');
  const cancelModalCloseBtn = document.getElementById('cancelModalCloseBtn');
  const btnDismissCancellation = document.getElementById('btnDismissCancellation');
  const cancelBookingForm = document.getElementById('cancelBookingForm');
  const cancellationReasonInput = document.getElementById('cancellationReasonInput');
  const cancelReasonError = document.getElementById('cancelReasonError');

  let pendingCancelCode = null;

  function renderMyBookings(filterCode = '') {
    if (!myBookingsListContainer) return;
    myBookingsListContainer.innerHTML = '';

    const list = getStoredReservations();
    const query = filterCode.trim().toLowerCase();

    const filtered = query ? list.filter(r => (r.code || '').toLowerCase().includes(query) || (r.clientName || '').toLowerCase().includes(query)) : list;

    if (filtered.length === 0) {
      myBookingsListContainer.innerHTML = `
        <div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.82rem;">
          No se encontraron citas registradas.
        </div>
      `;
      return;
    }

    filtered.forEach(r => {
      const card = document.createElement('div');
      const isCancelled = (r.status || 'Confirmada') === 'Cancelada';
      card.className = `my-booking-card ${isCancelled ? 'is-cancelled' : ''}`;

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-family:monospace; font-weight:700; color:var(--primary-purple);">${r.code}</span>
          <span style="font-size:0.72rem; padding:0.2rem 0.5rem; border-radius:12px; font-weight:700; ${isCancelled ? 'background:#FEE2E2; color:#DC2626;' : 'background:#DCFCE7; color:#15803D;'}">
            ${r.status || 'Confirmada'}
          </span>
        </div>
        <div style="font-size:0.82rem; font-weight:600; color:var(--text-primary); margin-top:0.2rem;">
          ${r.experience?.name || 'Tratamiento'} (${r.personCount || 1} persona${(r.personCount || 1) > 1 ? 's' : ''})
        </div>
        <div style="font-size:0.75rem; color:var(--text-secondary);">
          Terapeuta: <strong>${r.specialist?.name || 'Maya'}</strong> · Fecha: ${r.dateTime || 'S/F'}
        </div>
        ${isCancelled && r.cancellationReason ? `
          <div style="font-size:0.73rem; background:rgba(220,38,38,0.08); padding:0.4rem; border-radius:6px; color:#B91C1C; margin-top:0.3rem;">
            <strong>Motivo de cancelación:</strong> "${r.cancellationReason}"
          </div>
        ` : ''}
      `;

      // Si no está cancelada, ofrecer botón de cancelación justificada
      if (!isCancelled) {
        const btnCancel = document.createElement('button');
        btnCancel.type = 'button';
        btnCancel.className = 'btn-pill';
        btnCancel.style.cssText = 'background:#DC2626; color:#FFF; font-size:0.75rem; padding:0.35rem 0.75rem; margin-top:0.4rem; align-self:flex-start;';
        btnCancel.textContent = '✕ Cancelar esta Cita';
        btnCancel.addEventListener('click', () => {
          openCancellationModal(r);
        });
        card.appendChild(btnCancel);
      }

      myBookingsListContainer.appendChild(card);
    });
  }

  function openCancellationModal(reservation) {
    pendingCancelCode = reservation.code;
    document.getElementById('cancelSummaryCode').textContent = reservation.code;
    document.getElementById('cancelSummaryExp').textContent = reservation.experience?.name || 'Tratamiento';
    document.getElementById('cancelSummaryDateTime').textContent = reservation.dateTime || 'Fecha no definida';
    
    if (cancellationReasonInput) cancellationReasonInput.value = '';
    if (cancelReasonError) cancelReasonError.classList.remove('visible');

    if (myBookingsModal) myBookingsModal.classList.remove('active');
    if (cancelBookingModal) cancelBookingModal.classList.add('active');

    logEvent('INICIO_CANCELACION', `Usuario inició trámite para cancelar la cita ${reservation.code}`);
  }

  if (openMyBookingsBtn) {
    openMyBookingsBtn.addEventListener('click', () => {
      renderMyBookings();
      if (myBookingsModal) myBookingsModal.classList.add('active');
    });
  }

  if (myBookingsCloseBtn) {
    myBookingsCloseBtn.addEventListener('click', () => {
      if (myBookingsModal) myBookingsModal.classList.remove('active');
    });
  }

  if (btnSearchMyBooking && myBookingCodeSearch) {
    btnSearchMyBooking.addEventListener('click', () => {
      renderMyBookings(myBookingCodeSearch.value);
    });
    myBookingCodeSearch.addEventListener('input', () => {
      renderMyBookings(myBookingCodeSearch.value);
    });
  }

  const btnViewMyBookingNow = document.getElementById('btnViewMyBookingNow');
  if (btnViewMyBookingNow) {
    btnViewMyBookingNow.addEventListener('click', () => {
      const successModal = document.getElementById('successModal');
      if (successModal) successModal.classList.remove('active');
      renderMyBookings();
      if (myBookingsModal) myBookingsModal.classList.add('active');
    });
  }

  // Cancelar Cita con justificación obligatoria
  if (cancelBookingForm) {
    cancelBookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const reason = (cancellationReasonInput ? cancellationReasonInput.value : '').trim();

      if (reason.length < 5) {
        if (cancelReasonError) cancelReasonError.classList.add('visible');
        if (cancellationReasonInput) cancellationReasonInput.focus();
        showToast('Debes justificar el motivo de la cancelación.');
        return;
      }

      if (!pendingCancelCode) return;

      const list = getStoredReservations();
      const target = list.find(r => r.code === pendingCancelCode);

      if (target) {
        target.status = 'Cancelada';
        target.cancellationReason = reason;
        target.cancelledAt = new Date().toISOString();

        saveStoredReservations(list);

        // Actualizar en Supabase si está disponible
        if (window.WarmiDB && typeof window.WarmiDB.updateReservationStatus === 'function') {
          window.WarmiDB.updateReservationStatus(target.code, 'Cancelada', reason);
        }

        // Registrar en la Bitácora de Eventos
        logEvent('RESERVA_CANCELADA', `Cita ${target.code} (${target.clientName}) cancelada por el cliente. Motivo: "${reason}"`);

        // Liberar horario en el calendario de inmediato
        updateSlotsAvailability();

        if (cancelBookingModal) cancelBookingModal.classList.remove('active');
        showToast(`Cita ${pendingCancelCode} cancelada correctamente.`);

        // Reabrir lista de citas actualizada
        renderMyBookings();
        if (myBookingsModal) myBookingsModal.classList.add('active');
      }
    });
  }

  if (cancelModalCloseBtn) {
    cancelModalCloseBtn.addEventListener('click', () => {
      if (cancelBookingModal) cancelBookingModal.classList.remove('active');
    });
  }

  if (btnDismissCancellation) {
    btnDismissCancellation.addEventListener('click', () => {
      if (cancelBookingModal) cancelBookingModal.classList.remove('active');
      if (myBookingsModal) myBookingsModal.classList.add('active');
    });
  }

  // ==========================================================================
  // 11. BÚSQUEDA RÁPIDA
  // ==========================================================================
  const searchToggleBtn = document.getElementById('searchToggleBtn');
  const searchModal = document.getElementById('searchModal');
  const searchModalClose = document.getElementById('searchModalClose');
  const searchInput = document.getElementById('siteSearchInput');
  const searchResultsContainer = document.getElementById('searchResultsContainer');

  const searchableServices = [
    { title: 'Masaje Relajante', desc: 'Libera el estrés y conecta con tu tranquilidad.', price: 'Bs 40', targetId: 'masaje-relajante' },
    { title: 'Facial Asiático Glow', desc: 'Limpieza profunda y rejuvenecimiento natural con técnicas ancestrales.', price: 'Bs 45', targetId: 'facial-asiatico' },
    { title: 'Ritual Zen Warmi', desc: 'Armoniza cuerpo, mente y espíritu con cuencos e incienso sagrado.', price: 'Bs 60', targetId: 'ritual-zen' },
    { title: 'Aromaterapia & Esencias', desc: 'Equilibrio a través de aceites esenciales y orquídeas aromáticas.', price: 'Bs 40', targetId: 'aromaterapia' }
  ];

  if (searchToggleBtn && searchModal) {
    searchToggleBtn.addEventListener('click', () => {
      searchModal.classList.add('active');
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 150);
        renderSearchResults('');
      }
    });

    if (searchModalClose) {
      searchModalClose.addEventListener('click', () => searchModal.classList.remove('active'));
    }

    searchModal.addEventListener('click', (e) => {
      if (e.target === searchModal) searchModal.classList.remove('active');
    });

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        renderSearchResults(e.target.value.trim().toLowerCase());
      });
    }
  }

  function renderSearchResults(query) {
    if (!searchResultsContainer) return;
    searchResultsContainer.innerHTML = '';

    const filtered = searchableServices.filter(s =>
      s.title.toLowerCase().includes(query) || s.desc.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      const emptyP = document.createElement('p');
      emptyP.style.cssText = 'text-align:center; padding:1rem; color:var(--text-muted); font-size: 0.8rem;';
      emptyP.textContent = 'No se encontraron resultados.';
      searchResultsContainer.appendChild(emptyP);
      return;
    }

    filtered.forEach(item => {
      const row = document.createElement('div');
      row.className = 'summary-row';
      row.style.cssText = 'padding: 0.65rem; border-radius: 8px; background: var(--bg-card-subtle); margin-bottom: 0.4rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; min-height: 44px;';
      
      const textWrap = document.createElement('div');
      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-weight:700; color:var(--text-primary); font-size: 0.84rem;';
      titleEl.textContent = item.title;

      const descEl = document.createElement('div');
      descEl.style.cssText = 'font-size: 0.74rem; color:var(--text-muted);';
      descEl.textContent = item.desc;

      textWrap.appendChild(titleEl);
      textWrap.appendChild(descEl);

      const priceEl = document.createElement('div');
      priceEl.style.cssText = 'font-weight:700; color:var(--primary-purple); white-space:nowrap; margin-left: 0.6rem;';
      priceEl.textContent = item.price;

      row.appendChild(textWrap);
      row.appendChild(priceEl);

      row.addEventListener('click', () => {
        if (searchModal) searchModal.classList.remove('active');
        const matchingExp = document.querySelector(`.experience-select-item[data-id="${item.targetId}"]`);
        if (matchingExp) matchingExp.click();
        switchView('reserva');
      });

      searchResultsContainer.appendChild(row);
    });
  }

  // ==========================================================================
  // 12. TOAST NOTIFICACIONES
  // ==========================================================================
  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById('toastNotification');
    const toastMessage = document.getElementById('toastMessage');
    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;
    toast.classList.add('active');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('active');
    }, 2800);
  }

  // ==========================================================================
  // 13. GESTIÓN PWA
  // ==========================================================================
  let deferredInstallPrompt = null;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('[Happy Warmi PWA] Service Worker activo en:', reg.scope);
        })
        .catch((err) => {
          console.warn('[Happy Warmi PWA] Service Worker:', err);
        });
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  function triggerPWAInstall() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') {
          showToast('¡Gracias por instalar Happy Warmi Spa!');
          logEvent('PWA_INSTALADA', 'El usuario aceptó la instalación de la aplicación');
        }
        deferredInstallPrompt = null;
      });
    } else {
      const guideModal = document.getElementById('pwaGuideModal');
      if (guideModal) guideModal.classList.add('active');
    }
  }

  document.querySelectorAll('.trigger-pwa-install').forEach(btn => {
    btn.addEventListener('click', triggerPWAInstall);
  });

  const pwaGuideCloseBtn = document.getElementById('pwaGuideCloseBtn');
  if (pwaGuideCloseBtn) {
    pwaGuideCloseBtn.addEventListener('click', () => {
      const guideModal = document.getElementById('pwaGuideModal');
      if (guideModal) guideModal.classList.remove('active');
    });
  }

  // ==========================================================================
  // 14. MODAL DE ACCESO ADMINISTRATIVO (DIVISIÓN ADMIN / CLIENTE)
  // ==========================================================================
  const openAdminAuthModalBtn = document.getElementById('openAdminAuthModalBtn');
  const adminAuthModal = document.getElementById('adminAuthModal');
  const closeAdminAuthModalBtn = document.getElementById('closeAdminAuthModalBtn');
  const cancelAdminAuthBtn = document.getElementById('cancelAdminAuthBtn');
  const adminAuthForm = document.getElementById('adminAuthForm');
  const adminPinInput = document.getElementById('adminPinInput');
  const adminAuthError = document.getElementById('adminAuthError');

  const ADMIN_PIN_DEFAULT = 'admin123';

  function openAdminModal() {
    if (adminAuthModal) {
      if (adminPinInput) adminPinInput.value = '';
      if (adminAuthError) adminAuthError.style.display = 'none';
      adminAuthModal.classList.add('active');
      setTimeout(() => {
        if (adminPinInput) adminPinInput.focus();
      }, 150);
    }
  }

  function closeAdminModal() {
    if (adminAuthModal) adminAuthModal.classList.remove('active');
  }

  if (openAdminAuthModalBtn) {
    openAdminAuthModalBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (sessionStorage.getItem('happy_warmi_admin_auth') === 'true') {
        window.location.href = './admin.html';
      } else {
        openAdminModal();
      }
    });
  }

  if (closeAdminAuthModalBtn) closeAdminAuthModalBtn.addEventListener('click', closeAdminModal);
  if (cancelAdminAuthBtn) cancelAdminAuthBtn.addEventListener('click', closeAdminModal);

  if (adminAuthForm) {
    adminAuthForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredPin = (adminPinInput ? adminPinInput.value : '').trim();
      if (enteredPin === ADMIN_PIN_DEFAULT) {
        sessionStorage.setItem('happy_warmi_admin_auth', 'true');
        logEvent('ADMIN_LOGIN', 'Inicio de sesión administrativo exitoso');
        showToast('Acceso concedido al Panel de Administrador');
        closeAdminModal();
        setTimeout(() => {
          window.location.href = './admin.html';
        }, 250);
      } else {
        if (adminAuthError) adminAuthError.style.display = 'block';
        if (adminPinInput) {
          adminPinInput.value = '';
          adminPinInput.focus();
        }
      }
    });
  }

  const experiencePanel = document.getElementById('view-experiencias');
  const experienceLightbox = document.getElementById('experienceLightbox');
  const experienceLightboxImage = document.getElementById('experienceLightboxImage');
  const experienceLightboxCaption = document.getElementById('experienceLightboxCaption');
  const experienceLightboxClose = document.getElementById('experienceLightboxClose');

  function closeExperienceLightbox() {
    if (!experienceLightbox) return;
    experienceLightbox.classList.remove('active');
    experienceLightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
  }

  if (experiencePanel && experienceLightbox) {
    experiencePanel.addEventListener('click', (e) => {
      const image = e.target.closest('.experience-card .card-img-wrap img');
      if (!image) return;
      experienceLightboxImage.src = image.currentSrc || image.src;
      experienceLightboxImage.alt = image.alt || 'Experiencia de Happy Warmi Spa';
      experienceLightboxCaption.textContent = image.alt || 'Happy Warmi Spa';
      experienceLightbox.classList.add('active');
      experienceLightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-open');
    });
    experiencePanel.querySelectorAll('.experience-card .card-img-wrap img').forEach(img => {
      img.style.cursor = 'zoom-in';
      img.title = 'Haz clic para ampliar';
    });
  }

  if (experienceLightboxClose) experienceLightboxClose.addEventListener('click', closeExperienceLightbox);
  if (experienceLightbox) {
    experienceLightbox.addEventListener('click', (e) => {
      if (e.target === experienceLightbox) closeExperienceLightbox();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeExperienceLightbox();
  });
});