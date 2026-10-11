/* ============================================
   CARE SYNC — SHARED JAVASCRIPT
   Used by: index.html, dashboard.html, patients.html,
            mapping.html, diagnoses.html, reports.html, settings.html
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {

  const API_BASE_URL = window.API_BASE_URL || (window.location.origin.includes('http') ? window.location.origin : 'http://localhost:8000');

  /* ============================================
     TOAST NOTIFICATION COMPONENT
     ============================================ */
  function showToast(message, type = 'info', duration = 4000) {
    let container = document.querySelector('.caresync-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'caresync-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `caresync-toast toast-${type}`;

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    else if (type === 'error') icon = 'fa-triangle-exclamation';
    else if (type === 'warning') icon = 'fa-circle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon} toast-icon"></i>
      <span class="toast-msg">${escapeHtml(message)}</span>
      <button type="button" class="toast-close" aria-label="Close">&times;</button>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    const dismiss = () => {
      toast.classList.add('toast-hiding');
      setTimeout(() => toast.remove(), 300);
    };

    closeBtn.addEventListener('click', dismiss);
    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }

  window.showCareSyncToast = showToast;

  /* ============================================
     THEME MANAGER (DARK / LIGHT MODE)
     ============================================ */
  function getEffectiveTheme() {
    const saved = localStorage.getItem('careSyncTheme');
    if (saved === 'dark' || saved === 'light') return saved;
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return systemPrefersDark ? 'dark' : 'light';
  }

  function setTheme(theme, save = true) {
    document.documentElement.setAttribute('data-theme', theme);
    if (save) {
      localStorage.setItem('careSyncTheme', theme);
    }

    const isDark = theme === 'dark';
    const toggleBtns = document.querySelectorAll('.theme-toggle-btn, #themeToggleBtn');
    toggleBtns.forEach(btn => {
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      btn.innerHTML = isDark
        ? '<i class="fa-solid fa-sun" style="color:#FBBF24;"></i>'
        : '<i class="fa-solid fa-moon"></i>';
    });

    const settingsToggle = document.getElementById('darkModeSettingsToggle');
    if (settingsToggle) {
      settingsToggle.checked = isDark;
    }
  }

  function initTheme() {
    const initialTheme = getEffectiveTheme();
    setTheme(initialTheme, false);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.theme-toggle-btn, #themeToggleBtn');
      if (btn) {
        e.preventDefault();
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        setTheme(next, true);
      }
    });

    const settingsToggle = document.getElementById('darkModeSettingsToggle');
    if (settingsToggle) {
      settingsToggle.addEventListener('change', (e) => {
        const next = e.target.checked ? 'dark' : 'light';
        setTheme(next, true);
      });
    }

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('careSyncTheme')) {
          setTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'careSyncTheme' && (e.newValue === 'dark' || e.newValue === 'light')) {
        setTheme(e.newValue, false);
      }
    });
  }

  initTheme();

  /* ============================================
     1. SCROLL-REVEAL ANIMATIONS
     ============================================ */
  const revealEls = document.querySelectorAll(
    '.feature-card, .workflow-step, .stat-card, .code-widget, .table-card, .hero-banner'
  );

  if (revealEls.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('reveal'), i * 90);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    revealEls.forEach(el => observer.observe(el));
  }

  /* ============================================
     2. NAVBAR SHADOW ON SCROLL
     ============================================ */
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.style.boxShadow = window.scrollY > 20
        ? '0 6px 20px rgba(0,0,0,0.15)'
        : 'none';
    });
  }

  /* ============================================
     3. MOBILE SIDEBAR TOGGLE
     ============================================ */
  const sidebar = document.getElementById('sidebar');
  const mobileToggleBtn = document.querySelector('.mobile-topbar button');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  function setSidebarState(isOpen) {
    if (!sidebar) return;
    if (isOpen) {
      sidebar.classList.add('show');
      if (sidebarBackdrop) sidebarBackdrop.classList.add('show');
      if (mobileToggleBtn) mobileToggleBtn.setAttribute('aria-expanded', 'true');
    } else {
      sidebar.classList.remove('show');
      if (sidebarBackdrop) sidebarBackdrop.classList.remove('show');
      if (mobileToggleBtn) mobileToggleBtn.setAttribute('aria-expanded', 'false');
    }
  }

  if (sidebar && mobileToggleBtn) {
    mobileToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !sidebar.classList.contains('show');
      setSidebarState(willOpen);
    });

    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', () => {
        setSidebarState(false);
      });
    }

    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 991 && sidebar.classList.contains('show')) {
        if (!sidebar.contains(e.target) && !e.target.closest('.mobile-topbar button')) {
          setSidebarState(false);
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('show')) {
        setSidebarState(false);
      }
    });
  }

  /* ============================================
     4. PASSWORD SHOW/HIDE TOGGLES
     ============================================ */
  const passField = document.getElementById('passField');
  const eyeIcon = document.getElementById('eyeIcon');
  const toggleBtn = document.querySelector('.toggle-pass');

  if (passField && eyeIcon && toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (passField.type === 'password') {
        passField.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
      } else {
        passField.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
      }
    });
  }

  /* ============================================
     5. LOGIN & FORGOT PASSWORD & ABHA OAUTH
     ============================================ */
  const loginForm = document.getElementById('loginForm');
  const loginAlert = document.getElementById('loginAlert');
  const submitLoginBtn = document.getElementById('submitLoginBtn') || (loginForm ? loginForm.querySelector('.btn-login') : null);

  function showLoginAlert(msg, type = 'danger') {
    if (!loginAlert) {
      showToast(msg, type);
      return;
    }
    loginAlert.className = `alert alert-${type}`;
    loginAlert.textContent = msg;
    loginAlert.classList.remove('d-none');
    loginAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideLoginAlert() {
    if (loginAlert) {
      loginAlert.classList.add('d-none');
      loginAlert.textContent = '';
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideLoginAlert();

      const identifierValue = document.getElementById('identifier').value.trim();
      const passwordValue = passField.value;
      const rememberMeValue = document.getElementById('remember') ? document.getElementById('remember').checked : false;

      if (!identifierValue || !passwordValue) {
        showLoginAlert('Please enter your email/ABHA ID and password.');
        return;
      }

      if (submitLoginBtn) {
        submitLoginBtn.disabled = true;
        submitLoginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Signing in...';
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: identifierValue,
            password: passwordValue,
            remember_me: rememberMeValue
          })
        });

        const data = await response.json();

        if (response.ok) {
          localStorage.setItem('careSyncToken', data.access_token);
          localStorage.setItem('careSyncUser', JSON.stringify(data));
          window.location.href = 'dashboard.html';
        } else {
          showLoginAlert(data.detail || data.message || 'Invalid Email/ABHA ID or Password.');
        }
      } catch (error) {
        console.error('Authentication Error:', error);
        showLoginAlert('Unable to reach the CareSync authentication server. Please verify network connection.');
      } finally {
        if (submitLoginBtn) {
          submitLoginBtn.disabled = false;
          submitLoginBtn.innerHTML = 'Sign In <i class="fa-solid fa-arrow-right ms-1"></i>';
        }
      }
    });
  }

  // Forgot Password Modal
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const forgotPasswordModalEl = document.getElementById('forgotPasswordModal');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const forgotPasswordAlert = document.getElementById('forgotPasswordAlert');
  const submitForgotBtn = document.getElementById('submitForgotBtn');

  if (forgotPasswordModalEl && typeof bootstrap !== 'undefined') {
    const forgotModal = bootstrap.Modal.getOrCreateInstance(forgotPasswordModalEl);

    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (forgotPasswordAlert) forgotPasswordAlert.classList.add('d-none');
        if (forgotPasswordForm) forgotPasswordForm.reset();
        forgotModal.show();
      });
    }

    if (forgotPasswordForm) {
      forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ident = document.getElementById('forgotIdentifier').value.trim();
        if (!ident) return;

        if (submitForgotBtn) {
          submitForgotBtn.disabled = true;
          submitForgotBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Sending...';
        }

        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: ident })
          });
          const data = await res.json();
          if (forgotPasswordAlert) {
            forgotPasswordAlert.className = 'alert alert-success';
            forgotPasswordAlert.textContent = data.message || 'Password reset instructions dispatched.';
            forgotPasswordAlert.classList.remove('d-none');
          }
          setTimeout(() => {
            forgotModal.hide();
            showToast('Password recovery instructions sent to your registered email.', 'success');
          }, 2000);
        } catch (err) {
          if (forgotPasswordAlert) {
            forgotPasswordAlert.className = 'alert alert-danger';
            forgotPasswordAlert.textContent = 'Unable to send recovery instructions. Please try again.';
            forgotPasswordAlert.classList.remove('d-none');
          }
        } finally {
          if (submitForgotBtn) {
            submitForgotBtn.disabled = false;
            submitForgotBtn.innerHTML = 'Send Recovery Link';
          }
        }
      });
    }
  }

  // ABHA OAuth 2.0 Modal
  const btnAbhaAuth = document.getElementById('btnAbhaAuth');
  const abhaAuthModalEl = document.getElementById('abhaAuthModal');
  const abhaAuthForm = document.getElementById('abhaAuthForm');
  const abhaAlert = document.getElementById('abhaAlert');
  const submitAbhaBtn = document.getElementById('submitAbhaBtn');

  if (abhaAuthModalEl && typeof bootstrap !== 'undefined') {
    const abhaModal = bootstrap.Modal.getOrCreateInstance(abhaAuthModalEl);

    if (btnAbhaAuth) {
      btnAbhaAuth.addEventListener('click', (e) => {
        e.preventDefault();
        if (abhaAlert) abhaAlert.classList.add('d-none');
        abhaModal.show();
      });
    }

    if (abhaAuthForm) {
      abhaAuthForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const abhaId = document.getElementById('abhaIdInput').value.trim();
        if (!abhaId) return;

        if (submitAbhaBtn) {
          submitAbhaBtn.disabled = true;
          submitAbhaBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Verifying with ABDM Gateway...';
        }

        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/abha-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ abhaId })
          });
          const data = await res.json();

          if (res.ok) {
            localStorage.setItem('careSyncToken', data.access_token);
            localStorage.setItem('careSyncUser', JSON.stringify(data));
            abhaModal.hide();
            showToast(`ABHA OAuth verified! Welcome, ${data.user.name}`, 'success');
            setTimeout(() => {
              window.location.href = 'dashboard.html';
            }, 800);
          } else {
            if (abhaAlert) {
              abhaAlert.textContent = data.detail || data.message || 'Could not verify ABHA credentials.';
              abhaAlert.classList.remove('d-none');
            }
          }
        } catch (err) {
          if (abhaAlert) {
            abhaAlert.textContent = 'ABDM Gateway connection failed. Please check network.';
            abhaAlert.classList.remove('d-none');
          }
        } finally {
          if (submitAbhaBtn) {
            submitAbhaBtn.disabled = false;
            submitAbhaBtn.innerHTML = 'Authenticate & Sign In';
          }
        }
      });
    }
  }

  /* ============================================
     5B. LOGIN PAGE STATS & CLINIC REGISTRATION
     ============================================ */
  async function loadLoginStats() {
    const clinicsEl = document.getElementById('statClinics');
    const patientsEl = document.getElementById('statPatients');
    const mappingsEl = document.getElementById('statMappings');

    if (!clinicsEl && !patientsEl && !mappingsEl) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/public/stats`);
      if (response.ok) {
        const stats = await response.json();
        if (clinicsEl && typeof stats.clinics === 'number') clinicsEl.textContent = stats.clinics;
        if (patientsEl && typeof stats.patients === 'number') patientsEl.textContent = stats.patients;
        if (mappingsEl && typeof stats.mappings === 'number') mappingsEl.textContent = stats.mappings;
      }
    } catch (err) {
      console.warn('Could not load public CareSync stats:', err);
    }
  }

  loadLoginStats();

  // Setup Clinic Registration Modal
  const registerModalEl = document.getElementById('registerModal');
  const registerClinicLink = document.getElementById('registerClinicLink');

  if (registerModalEl) {
    let regModalInstance = null;
    function getModal() {
      if (!regModalInstance && typeof bootstrap !== 'undefined') {
        regModalInstance = bootstrap.Modal.getOrCreateInstance(registerModalEl);
      }
      return regModalInstance;
    }

    if (registerClinicLink) {
      registerClinicLink.addEventListener('click', (e) => {
        e.preventDefault();
        const m = getModal();
        if (m) m.show();
      });
    }

    if (window.location.hash === '#register') {
      const m = getModal();
      if (m) m.show();
    }

    // Password show/hide in registration modal
    const regPassField = document.getElementById('regPassword');
    const regEyeIcon = document.getElementById('regEyeIcon');
    const toggleRegPassBtn = document.querySelector('.toggle-reg-pass');
    if (regPassField && regEyeIcon && toggleRegPassBtn) {
      toggleRegPassBtn.addEventListener('click', () => {
        if (regPassField.type === 'password') {
          regPassField.type = 'text';
          regEyeIcon.classList.remove('fa-eye');
          regEyeIcon.classList.add('fa-eye-slash');
        } else {
          regPassField.type = 'password';
          regEyeIcon.classList.remove('fa-eye-slash');
          regEyeIcon.classList.add('fa-eye');
        }
      });
    }

    const regConfirmPassField = document.getElementById('regConfirmPassword');
    const regConfirmEyeIcon = document.getElementById('regConfirmEyeIcon');
    const toggleRegConfirmPassBtn = document.querySelector('.toggle-reg-confirm-pass');
    if (regConfirmPassField && regConfirmEyeIcon && toggleRegConfirmPassBtn) {
      toggleRegConfirmPassBtn.addEventListener('click', () => {
        if (regConfirmPassField.type === 'password') {
          regConfirmPassField.type = 'text';
          regConfirmEyeIcon.classList.remove('fa-eye');
          regConfirmEyeIcon.classList.add('fa-eye-slash');
        } else {
          regConfirmPassField.type = 'password';
          regConfirmEyeIcon.classList.remove('fa-eye-slash');
          regConfirmEyeIcon.classList.add('fa-eye');
        }
      });
    }

    // Registration Form Submission
    const regForm = document.getElementById('clinicRegisterForm');
    const regAlert = document.getElementById('registerAlert');
    const regSuccessView = document.getElementById('registerSuccessView');
    const regSuccessMsg = document.getElementById('registerSuccessMsg');
    const proceedToLoginBtn = document.getElementById('proceedToLoginBtn');
    const submitRegisterBtn = document.getElementById('submitRegisterBtn');

    function showAlert(msg, type = 'danger') {
      if (!regAlert) return;
      regAlert.className = `alert alert-${type}`;
      regAlert.textContent = msg;
      regAlert.classList.remove('d-none');
      regAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideAlert() {
      if (regAlert) {
        regAlert.classList.add('d-none');
        regAlert.textContent = '';
      }
    }

    if (proceedToLoginBtn) {
      proceedToLoginBtn.addEventListener('click', () => {
        const m = getModal();
        if (m) m.hide();
      });
    }

    registerModalEl.addEventListener('hidden.bs.modal', () => {
      hideAlert();
      if (regForm) {
        regForm.reset();
        regForm.classList.remove('d-none');
      }
      if (regSuccessView) {
        regSuccessView.classList.add('d-none');
      }
      if (submitRegisterBtn) {
        submitRegisterBtn.disabled = false;
        submitRegisterBtn.innerHTML = 'Register Clinic <i class="fa-solid fa-arrow-right ms-1"></i>';
      }
    });

    if (regForm) {
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        const clinicName = document.getElementById('regClinicName').value.trim();
        const doctorName = document.getElementById('regDoctorName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const abhaId = document.getElementById('regAbhaId') ? document.getElementById('regAbhaId').value.trim() : '';
        const specialization = document.getElementById('regSpecialization').value.trim();
        const address = document.getElementById('regAddress').value.trim();
        const city = document.getElementById('regCity').value.trim();
        const state = document.getElementById('regState').value.trim();
        const pincode = document.getElementById('regPincode').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;

        if (!clinicName) return showAlert('Please enter the clinic name.');
        if (!doctorName) return showAlert('Please enter the doctor or administrator name.');
        if (!email) return showAlert('Please enter an email address.');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return showAlert('Please enter a valid email address.');
        if (!phone) return showAlert('Please enter a phone number.');
        if (!address) return showAlert('Please enter the clinic address.');
        if (!city) return showAlert('Please enter the city.');
        if (!state) return showAlert('Please enter the state.');
        if (!pincode) return showAlert('Please enter the pincode.');
        if (!password) return showAlert('Please enter a password.');
        if (password.length < 6) return showAlert('Password must be at least 6 characters long.');
        if (password !== confirmPassword) return showAlert('Passwords do not match. Please re-enter.');

        if (submitRegisterBtn) {
          submitRegisterBtn.disabled = true;
          submitRegisterBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Registering...';
        }

        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clinicName,
              doctorName,
              email,
              phone,
              abhaId,
              specialization,
              address,
              city,
              state,
              pincode,
              password,
              confirmPassword
            })
          });

          const data = await res.json();

          if (res.ok) {
            regForm.classList.add('d-none');
            if (regSuccessView) {
              regSuccessView.classList.remove('d-none');
              if (regSuccessMsg) {
                regSuccessMsg.textContent = `${data.clinic ? data.clinic.clinicName : 'Your clinic'} has been registered in the database. You can now sign in with ${email}.`;
              }
            }

            const loginIdentifier = document.getElementById('identifier');
            if (loginIdentifier) loginIdentifier.value = email;

            loadLoginStats();
          } else {
            const errorMsg = data.detail || data.message || (data.errors && data.errors[0] ? data.errors[0].msg : 'Registration failed. Please check your details.');
            showAlert(errorMsg);
          }
        } catch (netErr) {
          console.error('Registration network error:', netErr);
          showAlert('Unable to reach the server. Please check your connection.');
        } finally {
          if (submitRegisterBtn) {
            submitRegisterBtn.disabled = false;
            submitRegisterBtn.innerHTML = 'Register Clinic <i class="fa-solid fa-arrow-right ms-1"></i>';
          }
        }
      });
    }
  }

  /* ============================================
     6. AUTHENTICATION & SESSION MANAGEMENT
     ============================================ */
  const token = localStorage.getItem('careSyncToken');
  const userJson = localStorage.getItem('careSyncUser');
  let currentUser = null;
  try {
    currentUser = userJson ? JSON.parse(userJson) : null;
  } catch (e) {
    currentUser = null;
  }

  async function authFetch(endpoint, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    });

    if (response.status === 401) {
      console.warn('Unauthorized request. Redirecting to login...');
      localStorage.removeItem('careSyncToken');
      localStorage.removeItem('careSyncUser');
      if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = 'index.html';
      }
    }

    return response;
  }

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const protectedPages = ['dashboard.html', 'patients.html', 'mapping.html', 'diagnoses.html', 'reports.html', 'settings.html'];

  if (protectedPages.includes(currentPage) && !token) {
    window.location.href = 'index.html';
    return;
  }

  // Profile synchronization
  if (currentUser && currentUser.user) {
    const userChipSpans = document.querySelectorAll('.user-chip span, .user-dropdown-name');
    userChipSpans.forEach(span => {
      span.textContent = currentUser.user.name || 'Dr. Sonu';
    });
    const userChipImgs = document.querySelectorAll('.user-chip img');
    userChipImgs.forEach(img => {
      if (currentUser.user.photoUrl) img.src = currentUser.user.photoUrl;
    });

    const greetingHeading = document.querySelector('.greeting-block h4');
    if (greetingHeading) {
      greetingHeading.textContent = `Good Morning, ${currentUser.user.name || 'Dr. Sonu'}`;
    }
  }

  // Logout Links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.logout-link');
    if (link) {
      e.preventDefault();
      localStorage.removeItem('careSyncToken');
      localStorage.removeItem('careSyncUser');
      showToast('You have been signed out.', 'info');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 400);
    }
  });

  /* ============================================
     GLOBAL TOPBAR DROPDOWNS (NOTIFICATIONS & USER)
     ============================================ */
  function initGlobalTopbar() {
    // 1. Notification Dropdown
    const notifBtn = document.getElementById('notifBellBtn') || document.querySelector('.notif-bell-btn');
    const notifMenu = document.getElementById('notifMenu') || document.querySelector('.notif-menu');
    const notifDot = document.getElementById('notifDot') || document.querySelector('.notif-dot');
    const notifList = document.querySelector('.notif-list');
    const markAllReadBtn = document.querySelector('.mark-all-read-btn');

    async function loadNotifications() {
      if (!token || !notifList) return;
      try {
        const res = await authFetch('/api/notifications');
        if (!res.ok) return;
        const data = await res.json();
        const notifications = data.notifications || [];
        const unreadCount = data.unreadCount || 0;

        if (notifDot) {
          if (unreadCount > 0) {
            notifDot.classList.remove('d-none');
          } else {
            notifDot.classList.add('d-none');
          }
        }

        if (notifications.length === 0) {
          notifList.innerHTML = '<li class="p-3 text-center text-muted small">No notifications found.</li>';
          return;
        }

        notifList.innerHTML = notifications.map(n => `
          <li class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id || n._id}">
            <div class="notif-item-icon ${n.type || 'info'}">
              <i class="fa-solid ${n.type === 'alert' ? 'fa-triangle-exclamation' : (n.type === 'system' ? 'fa-circle-check' : 'fa-info')}"></i>
            </div>
            <div class="notif-item-content">
              <div class="notif-item-title">${escapeHtml(n.title)}</div>
              <div class="notif-item-msg">${escapeHtml(n.message)}</div>
            </div>
          </li>
        `).join('');

        // Wire click to mark individual notification as read
        notifList.querySelectorAll('.notif-item').forEach(item => {
          item.addEventListener('click', async () => {
            const id = item.getAttribute('data-id');
            if (id && item.classList.contains('unread')) {
              item.classList.remove('unread');
              await authFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
              loadNotifications();
            }
          });
        });
      } catch (err) {
        console.warn('Could not load notifications:', err);
      }
    }

    if (notifBtn && notifMenu) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = notifMenu.classList.contains('show');
        document.querySelectorAll('.notif-menu, .user-dropdown-menu').forEach(m => m.classList.remove('show'));
        if (!isShown) {
          notifMenu.classList.add('show');
          loadNotifications();
        }
      });

      if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await authFetch('/api/notifications/read-all', { method: 'PUT' });
          showToast('All notifications marked as read.', 'info');
          loadNotifications();
        });
      }

      loadNotifications();
    }

    // 2. User Profile Dropdown
    const userChipBtn = document.getElementById('userChipBtn') || document.querySelector('.user-chip');
    const userDropdownMenu = document.getElementById('userDropdownMenu') || document.querySelector('.user-dropdown-menu');

    if (userChipBtn && userDropdownMenu) {
      userChipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = userDropdownMenu.classList.contains('show');
        document.querySelectorAll('.notif-menu, .user-dropdown-menu').forEach(m => m.classList.remove('show'));
        if (!isShown) {
          userDropdownMenu.classList.add('show');
        }
      });
    }

    // Close dropdowns on outside click or escape
    document.addEventListener('click', () => {
      document.querySelectorAll('.notif-menu, .user-dropdown-menu').forEach(m => m.classList.remove('show'));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.notif-menu, .user-dropdown-menu').forEach(m => m.classList.remove('show'));
      }
    });
  }

  initGlobalTopbar();

  /* ============================================
     7. DASHBOARD PAGE HYDRATION & QUICK ACTIONS
     ============================================ */
  if (currentPage === 'dashboard.html' || (document.querySelector('.greeting-block') && !document.querySelector('.patients-table'))) {
    loadDashboardSummary();
    initDashboardActions();
  }

  function initDashboardActions() {
    const addPatientBtn = document.getElementById('dashAddPatientBtn');
    const diseaseSearchBtn = document.getElementById('dashDiseaseSearchBtn');
    const statPatients = document.getElementById('dashStatPatients');
    const statDiagnoses = document.getElementById('dashStatDiagnoses');
    const statMappings = document.getElementById('dashStatMappings');

    if (addPatientBtn) {
      addPatientBtn.addEventListener('click', () => {
        window.location.href = 'patients.html#add';
      });
    }

    if (diseaseSearchBtn) {
      diseaseSearchBtn.addEventListener('click', () => {
        window.location.href = 'mapping.html';
      });
    }

    if (statPatients) {
      statPatients.addEventListener('click', () => { window.location.href = 'patients.html'; });
    }
    if (statDiagnoses) {
      statDiagnoses.addEventListener('click', () => { window.location.href = 'diagnoses.html'; });
    }
    if (statMappings) {
      statMappings.addEventListener('click', () => { window.location.href = 'mapping.html'; });
    }
  }

  async function loadDashboardSummary() {
    try {
      const res = await authFetch('/api/dashboard/summary');
      if (!res.ok) return;
      const rawData = await res.json();
      const data = rawData.data || rawData;

      const statNums = document.querySelectorAll('.stat-card-lg .stat-num-lg');
      if (statNums.length >= 3) {
        statNums[0].textContent = (typeof data.patientCount === 'number' ? data.patientCount : 0).toLocaleString();
        statNums[1].textContent = (typeof data.diagnosisCount === 'number' ? data.diagnosisCount : 0).toLocaleString();
        statNums[2].textContent = (typeof data.mappingCount === 'number' ? data.mappingCount : 0).toLocaleString();
      }

      const recentTableBody = document.querySelector('.table-card tbody');
      if (recentTableBody) {
        if (data.recentPatients && data.recentPatients.length > 0) {
          recentTableBody.innerHTML = data.recentPatients.map(p => `
            <tr>
              <td>${escapeHtml(p.patientCode)}</td>
              <td>${escapeHtml(p.name)}</td>
              <td>${p.age}</td>
              <td>${escapeHtml(p.diagnosisLabel)}</td>
              <td class="text-end"><a href="patients.html?view=${encodeURIComponent(p.patientCode)}" class="view-link">View</a></td>
            </tr>
          `).join('');
        } else {
          recentTableBody.innerHTML = `
            <tr>
              <td colspan="5" class="text-center py-4 text-muted">
                No recent patients recorded.
              </td>
            </tr>
          `;
        }
      }

      const fillBar = document.querySelector('.mapping-bar-fill');
      const mapped = typeof data.mappedCount === 'number' ? data.mappedCount : 0;
      const unmapped = typeof data.unmappedCount === 'number' ? data.unmappedCount : 0;
      const totalCodes = mapped + unmapped;
      const percent = totalCodes > 0 ? Math.round((mapped / totalCodes) * 100) : 0;

      if (fillBar) fillBar.style.width = `${percent}%`;

      const legend = document.querySelector('.mapping-legend');
      if (legend) {
        legend.innerHTML = `
          <span><span class="dot dot-mapped"></span> Mapped: ${mapped}</span>
          <span><span class="dot dot-unmapped"></span> Unmapped: ${unmapped}</span>
        `;
      }
    } catch (err) {
      console.error('Error hydrating dashboard summary:', err);
    }
  }

  /* ============================================
     8. PATIENTS PAGE HYDRATION, MODALS & PAGINATION
     ============================================ */
  const patientsTable = document.querySelector('.patients-table');
  if (patientsTable) {
    initPatientsPage();
  }

  function initPatientsPage() {
    const searchInput = document.querySelector('.patient-search input');
    const statusSelect = document.querySelector('.filter-select');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const paginationPages = document.getElementById('paginationPages');
    const footerText = document.getElementById('patientsFooterText') || document.querySelector('.table-footer-text');

    let searchTimeout = null;
    let currentPageNum = 1;
    let totalPatientsCount = 0;
    const pageSize = 10;
    let currentPatientsList = [];

    // Patient Details Modal
    const pdmEl = document.getElementById('patientDetailsModal');
    let pdmInstance = null;
    if (pdmEl && typeof bootstrap !== 'undefined') {
      pdmInstance = bootstrap.Modal.getOrCreateInstance(pdmEl);
    }

    async function fetchPatients() {
      const search = searchInput ? searchInput.value.trim() : '';
      const status = statusSelect ? statusSelect.value : '';

      try {
        const queryParams = new URLSearchParams({
          search,
          status: status === 'All Status' ? '' : status,
          page: currentPageNum,
          limit: pageSize
        });

        const res = await authFetch(`/api/patients?${queryParams.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        currentPatientsList = data.patients || [];
        totalPatientsCount = typeof data.total === 'number' ? data.total : currentPatientsList.length;

        renderPatientsTable(currentPatientsList);
        renderPagination();
      } catch (err) {
        console.error('Error fetching patients:', err);
      }
    }

    function renderPagination() {
      const totalPages = Math.max(1, Math.ceil(totalPatientsCount / pageSize));

      if (footerText) {
        const start = totalPatientsCount === 0 ? 0 : (currentPageNum - 1) * pageSize + 1;
        const end = Math.min(currentPageNum * pageSize, totalPatientsCount);
        footerText.textContent = `Showing ${start}–${end} of ${totalPatientsCount} patients`;
      }

      if (prevPageBtn) {
        prevPageBtn.disabled = currentPageNum <= 1;
        prevPageBtn.classList.toggle('disabled', currentPageNum <= 1);
      }
      if (nextPageBtn) {
        nextPageBtn.disabled = currentPageNum >= totalPages;
        nextPageBtn.classList.toggle('disabled', currentPageNum >= totalPages);
      }

      if (paginationPages) {
        let pagesHtml = '';
        for (let i = 1; i <= totalPages; i++) {
          pagesHtml += `<button class="page-btn ${i === currentPageNum ? 'page-btn-active' : ''}" data-page="${i}">${i}</button>`;
        }
        paginationPages.innerHTML = pagesHtml;

        paginationPages.querySelectorAll('.page-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const p = parseInt(btn.getAttribute('data-page'), 10);
            if (p && p !== currentPageNum) {
              currentPageNum = p;
              fetchPatients();
            }
          });
        });
      }
    }

    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', () => {
        if (currentPageNum > 1) {
          currentPageNum--;
          fetchPatients();
        }
      });
    }

    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(totalPatientsCount / pageSize));
        if (currentPageNum < totalPages) {
          currentPageNum++;
          fetchPatients();
        }
      });
    }

    function renderPatientsTable(patients) {
      const tbody = patientsTable.querySelector('tbody');
      if (!tbody) return;

      if (patients.length === 0) {
        const isFiltered = (searchInput && searchInput.value.trim()) || (statusSelect && statusSelect.value && statusSelect.value !== 'All Status');
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-4 text-muted">
              ${isFiltered ? 'No patients found matching your search.' : 'No patient records found in your clinic.'}
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = patients.map(p => {
        let statusBadge = '<span class="status-pill status-stable"><i class="fa-solid fa-circle-check"></i> Stable</span>';
        if (p.status === 'critical') {
          statusBadge = '<span class="status-pill status-alert"><i class="fa-solid fa-triangle-exclamation"></i> Critical</span>';
        } else if (p.status === 'review') {
          statusBadge = '<span class="status-pill status-review"><i class="fa-solid fa-hourglass-half"></i> Under Review</span>';
        }

        return `
          <tr>
            <td class="patient-cell">
              <img class="patient-avatar" src="${escapeHtml(p.avatarUrl || 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&q=80')}" alt="">
              <div>
                <div class="patient-name">${escapeHtml(p.name)}</div>
                <div class="patient-id">${escapeHtml(p.patientCode)}</div>
              </div>
            </td>
            <td>${p.age}</td>
            <td>${escapeHtml(p.diagnosisLabel)}</td>
            <td><span class="code-pill pill-namaste">${escapeHtml(p.namasteCode)}</span></td>
            <td><span class="code-pill pill-icd">${escapeHtml(p.icd11Tm2Code)}</span></td>
            <td>${statusBadge}</td>
            <td class="text-end">
              <a href="#" class="view-link patient-view-btn" data-code="${escapeHtml(p.patientCode)}">View</a>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.patient-view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const code = btn.getAttribute('data-code');
          openPatientDetails(code);
        });
      });
    }

    let activeViewingPatient = null;
    let activeViewingFhir = null;

    async function openPatientDetails(patientCode) {
      if (!pdmInstance) return;

      try {
        const [patRes, fhirRes] = await Promise.all([
          authFetch(`/api/patients/${patientCode}`),
          authFetch(`/api/patients/${patientCode}/fhir`)
        ]);

        if (!patRes.ok) {
          showToast('Patient record could not be found.', 'error');
          return;
        }

        const patient = await patRes.json();
        const fhir = fhirRes.ok ? await fhirRes.json() : null;

        activeViewingPatient = patient;
        activeViewingFhir = fhir;

        document.getElementById('pdmName').textContent = patient.name;
        document.getElementById('pdmCode').textContent = patient.patientCode;
        document.getElementById('pdmAge').textContent = patient.age;
        document.getElementById('pdmAvatar').src = patient.avatarUrl || 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&q=80';
        document.getElementById('pdmDiagnosis').textContent = patient.diagnosisLabel || 'Not specified';
        document.getElementById('pdmNamc').textContent = patient.namasteCode || 'N/A';
        document.getElementById('pdmIcd').textContent = patient.icd11Tm2Code || 'N/A';

        const badgeEl = document.getElementById('pdmStatusBadge');
        if (badgeEl) {
          if (patient.status === 'critical') {
            badgeEl.innerHTML = '<span class="status-pill status-alert"><i class="fa-solid fa-triangle-exclamation"></i> Critical</span>';
          } else if (patient.status === 'review') {
            badgeEl.innerHTML = '<span class="status-pill status-review"><i class="fa-solid fa-hourglass-half"></i> Under Review</span>';
          } else {
            badgeEl.innerHTML = '<span class="status-pill status-stable"><i class="fa-solid fa-circle-check"></i> Stable</span>';
          }
        }

        const statusSelectEl = document.getElementById('pdmStatusSelect');
        if (statusSelectEl) {
          statusSelectEl.value = patient.status || 'stable';
        }

        const fhirPre = document.getElementById('pdmFhirJson');
        if (fhirPre) {
          fhirPre.textContent = fhir ? JSON.stringify(fhir, null, 2) : 'No FHIR resource available.';
        }

        pdmInstance.show();
      } catch (e) {
        console.error(e);
        showToast('Error loading patient details.', 'error');
      }
    }

    // Copy FHIR JSON button
    const copyFhirBtn = document.getElementById('copyFhirBtn');
    if (copyFhirBtn) {
      copyFhirBtn.addEventListener('click', () => {
        if (!activeViewingFhir) return;
        navigator.clipboard.writeText(JSON.stringify(activeViewingFhir, null, 2))
          .then(() => showToast('FHIR R4 resource copied to clipboard!', 'success'))
          .catch(() => showToast('Could not copy to clipboard.', 'warning'));
      });
    }

    // Update Status inside Modal
    const pdmSaveStatusBtn = document.getElementById('pdmSaveStatusBtn');
    if (pdmSaveStatusBtn) {
      pdmSaveStatusBtn.addEventListener('click', async () => {
        if (!activeViewingPatient) return;
        const newStatus = document.getElementById('pdmStatusSelect').value;

        pdmSaveStatusBtn.disabled = true;
        pdmSaveStatusBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
          const res = await authFetch(`/api/patients/${activeViewingPatient.id || activeViewingPatient._id || activeViewingPatient.patientCode}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
          });

          if (res.ok) {
            showToast('Patient status updated successfully!', 'success');
            fetchPatients();
            pdmInstance.hide();
          } else {
            const err = await res.json();
            showToast(err.detail || err.message || 'Could not update patient.', 'error');
          }
        } catch (e) {
          showToast('Failed to update patient status.', 'error');
        } finally {
          pdmSaveStatusBtn.disabled = false;
          pdmSaveStatusBtn.innerHTML = 'Update Status';
        }
      });
    }

    // Delete Patient inside Modal
    const pdmDeleteBtn = document.getElementById('pdmDeleteBtn');
    if (pdmDeleteBtn) {
      pdmDeleteBtn.addEventListener('click', async () => {
        if (!activeViewingPatient) return;
        if (!confirm(`Are you sure you want to delete patient ${activeViewingPatient.name} (${activeViewingPatient.patientCode})? This action will archive the record.`)) {
          return;
        }

        try {
          const res = await authFetch(`/api/patients/${activeViewingPatient.id || activeViewingPatient._id || activeViewingPatient.patientCode}`, {
            method: 'DELETE'
          });

          if (res.ok) {
            showToast('Patient record deleted successfully.', 'success');
            pdmInstance.hide();
            fetchPatients();
            loadDashboardSummary();
          } else {
            const err = await res.json();
            showToast(err.detail || 'Could not delete patient record.', 'error');
          }
        } catch (e) {
          showToast('Failed to delete patient record.', 'error');
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          currentPageNum = 1;
          fetchPatients();
        }, 300);
      });
    }

    if (statusSelect) {
      statusSelect.addEventListener('change', () => {
        currentPageNum = 1;
        fetchPatients();
      });
    }

    // Add Patient button & modal
    const addPatientBtn = document.querySelector('.page-header-btn');
    const addPatientModalEl = document.getElementById('addPatientModal');
    let addPatientModal = null;

    if (addPatientModalEl) {
      addPatientModal = new bootstrap.Modal(addPatientModalEl);

      const namcInput = document.getElementById('patientNamcCode');
      const icdInput = document.getElementById('patientIcd11Code');
      const diagInput = document.getElementById('patientDiagnosis');
      const resultBox = document.getElementById('lookupResultBox');
      const resultContent = document.getElementById('lookupResultContent');
      const saveBtn = document.getElementById('savePatientBtn');
      const form = document.getElementById('addPatientForm');

      let isLookingUp = false;
      let verifiedDualCode = false;

      function openAddPatientModal() {
        if (!addPatientModal) return;
        form.reset();
        resultBox.classList.add('d-none');
        saveBtn.disabled = true;
        verifiedDualCode = false;
        namcInput.readOnly = false;
        icdInput.readOnly = false;
        addPatientModal.show();
      }

      if (addPatientBtn && addPatientBtn.textContent.includes('Add Patient')) {
        addPatientBtn.addEventListener('click', openAddPatientModal);
      }

      // Check URL hash or query params
      const urlParams = new URLSearchParams(window.location.search);
      if (window.location.hash === '#add' || urlParams.get('action') === 'add') {
        setTimeout(openAddPatientModal, 200);
      }
      if (urlParams.get('view')) {
        setTimeout(() => openPatientDetails(urlParams.get('view')), 300);
      }

      function handleCodeChange(type) {
        verifiedDualCode = false;
        saveBtn.disabled = true;
        resultBox.classList.add('d-none');

        if (type === 'NAMC') {
          icdInput.value = '';
          icdInput.readOnly = false;
          diagInput.value = '';
        } else if (type === 'ICD11') {
          namcInput.value = '';
          namcInput.readOnly = false;
          diagInput.value = '';
        }
      }

      async function performLookup(code, type) {
        if (!code || isLookingUp) return;
        isLookingUp = true;
        verifiedDualCode = false;

        try {
          resultBox.classList.remove('d-none', 'alert-success', 'alert-danger', 'alert-secondary');
          resultBox.classList.add('alert-info');
          resultContent.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Looking up verified crosswalk...';
          saveBtn.disabled = true;

          const res = await authFetch(`/api/mapping/lookup?code=${encodeURIComponent(code)}&type=${type}`);
          const data = await res.json();

          if (res.ok && data.found) {
            if (type === 'NAMC') {
              icdInput.value = data.icd11Tm2Code;
              icdInput.readOnly = true;
            } else {
              namcInput.value = data.namcCode;
              namcInput.readOnly = true;
            }
            diagInput.value = data.ayushTerm;
            verifiedDualCode = true;

            resultBox.classList.remove('alert-info');
            resultBox.classList.add('alert-success');
            resultContent.innerHTML = `
              <strong>Verified Crosswalk Found!</strong><br>
              Diagnosis: ${data.ayushTerm}<br>
              NAMC: ${data.namcCode}<br>
              ICD-11 TM2: ${data.icd11Tm2Code}<br>
              Relationship: ${data.relationshipType}<br>
              Verification: <i class="fa-solid fa-circle-check text-success"></i> Verified (${data.source})
            `;
            saveBtn.disabled = false;
          } else {
            resultBox.classList.remove('alert-info');
            resultBox.classList.add('alert-danger');
            resultContent.innerHTML = '<strong>Not Found:</strong> No verified crosswalk found for this code. You cannot use unverified codes.';
            if (type === 'NAMC') icdInput.value = '';
            if (type === 'ICD11') namcInput.value = '';
            diagInput.value = '';
            saveBtn.disabled = true;
          }
        } catch (e) {
          resultBox.classList.remove('alert-info');
          resultBox.classList.add('alert-danger');
          resultContent.innerHTML = 'Error communicating with lookup service.';
          saveBtn.disabled = true;
        } finally {
          setTimeout(() => { isLookingUp = false; }, 300);
        }
      }

      namcInput.addEventListener('input', () => { if (!namcInput.readOnly) handleCodeChange('NAMC'); });
      namcInput.addEventListener('blur', (e) => {
        if (!namcInput.readOnly && e.target.value.trim() && !isLookingUp) performLookup(e.target.value.trim(), 'NAMC');
      });

      icdInput.addEventListener('input', () => { if (!icdInput.readOnly) handleCodeChange('ICD11'); });
      icdInput.addEventListener('blur', (e) => {
        if (!icdInput.readOnly && e.target.value.trim() && !isLookingUp) performLookup(e.target.value.trim(), 'ICD11');
      });

      saveBtn.addEventListener('click', async () => {
        if (!form.checkValidity() || !verifiedDualCode) {
          form.reportValidity();
          return;
        }

        try {
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

          const res = await authFetch('/api/patients', {
            method: 'POST',
            body: JSON.stringify({
              name: document.getElementById('patientName').value.trim(),
              age: parseInt(document.getElementById('patientAge').value, 10),
              status: document.getElementById('patientStatus').value,
              namasteCode: namcInput.value.trim(),
              icd11Tm2Code: icdInput.value.trim(),
              diagnosisLabel: diagInput.value.trim()
            })
          });

          if (res.ok) {
            addPatientModal.hide();
            showToast('Patient record created with verified dual-coding!', 'success');
            fetchPatients();
            loadDashboardSummary();
          } else {
            const err = await res.json();
            showToast(err.detail || err.message || 'Could not create patient.', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Patient';
          }
        } catch (e) {
          console.error(e);
          showToast('Network error while creating patient.', 'error');
          saveBtn.disabled = false;
          saveBtn.innerHTML = 'Save Patient';
        }
      });
    }

    fetchPatients();
  }

  /* ============================================
     9. DISEASE MAPPING MODULE & RAG CANDIDATES
     ============================================ */
  const codeWidget = document.querySelector('.code-widget');
  if (codeWidget) {
    initMappingPage();
  }

  function initMappingPage() {
    const searchInput = codeWidget.querySelector('.code-input');
    const confirmBtn = codeWidget.querySelector('.quick-action-btn');
    const suggestionList = codeWidget.querySelector('.suggestion-list');
    const confidenceBadge = codeWidget.querySelector('.confidence-row');
    const mappingTableBody = document.querySelector('.mapping-table tbody');
    let currentSuggestion = null;
    let candidateList = [];
    let searchTimer = null;

    // Check query params for term
    const mappingParams = new URLSearchParams(window.location.search);
    const initialTerm = mappingParams.get('term');
    if (initialTerm && searchInput) {
      searchInput.value = initialTerm;
    }

    async function loadMappingStats() {
      try {
        const res = await authFetch('/api/mapping/stats');
        if (!res.ok) return;
        const stats = await res.json();

        const statNums = document.querySelectorAll('.mini-stat-num');
        if (statNums.length >= 4) {
          statNums[0].textContent = (stats.mappedCount || 542).toLocaleString();
          statNums[1].textContent = stats.unmappedCount || 23;
          statNums[2].textContent = `${stats.avgConfidence || 96}%`;
          statNums[3].textContent = stats.fhirCompliance || 'FHIR R4';
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function loadRecentMappings() {
      if (!mappingTableBody) return;
      try {
        const res = await authFetch('/api/mapping/recent?limit=10');
        if (!res.ok) return;
        const mappings = await res.json();

        if (mappings.length > 0) {
          mappingTableBody.innerHTML = mappings.map(m => {
            const confClass = m.confidenceScore >= 90 ? 'confidence-high' : (m.confidenceScore >= 75 ? 'confidence-medium' : 'confidence-low');
            return `
              <tr>
                <td>${escapeHtml(m.searchTerm)}</td>
                <td><span class="code-pill pill-namaste">${escapeHtml(m.namasteCode)}</span></td>
                <td><span class="code-pill pill-icd">${escapeHtml(m.icd11Tm2Code)}</span></td>
                <td><span class="confidence-badge ${confClass}">${m.confidenceScore}%</span></td>
              </tr>
            `;
          }).join('');
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function searchMapping(term) {
      if (!term.trim()) {
        if (suggestionList) suggestionList.innerHTML = '';
        if (confidenceBadge) confidenceBadge.innerHTML = '';
        return;
      }

      if (suggestionList) {
        suggestionList.innerHTML = `<div class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Searching terminology crosswalks...</div>`;
      }
      if (confidenceBadge) confidenceBadge.innerHTML = '';

      try {
        const res = await authFetch(`/api/mapping/candidates?term=${encodeURIComponent(term)}`);
        if (!res.ok) {
          if (suggestionList) {
            suggestionList.innerHTML = `<div class="text-danger">Unable to search mappings. Please try again.</div>`;
          }
          return;
        }

        const data = await res.json();
        candidateList = data.candidates || [];
        currentSuggestion = candidateList.length > 0 ? candidateList[0] : null;

        if (confirmBtn) {
          confirmBtn.style.display = currentSuggestion ? 'block' : 'none';
        }

        if (suggestionList) {
          if (candidateList.length === 0) {
            suggestionList.innerHTML = `<div class="text-muted p-3 text-center">No candidate mapping found for "${escapeHtml(term)}".</div>`;
            return;
          }

          suggestionList.innerHTML = candidateList.map((cand, idx) => {
            const icdDisplay = cand.icd11Tm2Code
              ? `<span class="code-pill pill-icd">${escapeHtml(cand.icd11Tm2Code)}</span>`
              : `<div class="text-muted small mt-1">WHO TM2 code requires verification</div>`;

            const isTop = idx === 0;
            const topBadge = isTop
              ? `<span class="badge bg-warning text-dark">RAG Candidate — Doctor Verification Required</span>`
              : `<span class="badge bg-secondary">Alternative Candidate #${idx + 1}</span>`;

            return `
              <div class="suggestion-item candidate-card border ${isTop ? 'border-warning' : 'border-secondary'} mb-3 p-3 position-relative" data-idx="${idx}" style="cursor:pointer;" title="Click to select this candidate">
                <div class="candidate-header mb-2 d-flex justify-content-between align-items-center">
                  ${topBadge}
                  <span class="badge ${isTop ? 'bg-primary' : 'bg-dark'} select-badge">${isTop ? 'Active Selection' : 'Click to Select'}</span>
                </div>
                <div class="candidate-grid mb-2">
                  <div class="candidate-col candidate-col-namc">
                    <div class="candidate-col-label">NAMC / AYUSH</div>
                    <div class="term">${escapeHtml(cand.namcTerm || 'N/A')}</div>
                    ${cand.namcEnglishTerm ? `<div class="sub">${escapeHtml(cand.namcEnglishTerm)}</div>` : ''}
                    <div class="code-pill-wrap"><span class="code-pill pill-namaste">${escapeHtml(cand.namcCode || 'N/A')}</span></div>
                  </div>
                  <div class="candidate-col candidate-col-who">
                    <div class="candidate-col-label">WHO ICD-11 TM2</div>
                    <div class="term">${escapeHtml(cand.icd11Term || 'N/A')}</div>
                    ${cand.matchedSynonyms && cand.matchedSynonyms.length > 0 ? `<div class="sub text-success"><i class="fa-solid fa-check"></i> Synonym match</div>` : ''}
                    <div class="code-pill-wrap">${icdDisplay}</div>
                  </div>
                </div>
                <div class="candidate-evidence small text-muted">
                  <strong>Evidence:</strong> ${escapeHtml((cand.matchReasons || []).join(', '))} (Score: ${Math.round(cand.retrievalScore)})
                </div>
              </div>
            `;
          }).join('');

          // Select candidate on card click
          suggestionList.querySelectorAll('.candidate-card').forEach(card => {
            card.addEventListener('click', () => {
              const idx = parseInt(card.getAttribute('data-idx'), 10);
              if (!isNaN(idx) && candidateList[idx]) {
                currentSuggestion = candidateList[idx];
                suggestionList.querySelectorAll('.candidate-card').forEach((c, i) => {
                  c.classList.remove('border-warning');
                  c.classList.add('border-secondary');
                  const b = c.querySelector('.select-badge');
                  if (b) {
                    b.className = 'badge bg-dark select-badge';
                    b.textContent = 'Click to Select';
                  }
                });
                card.classList.remove('border-secondary');
                card.classList.add('border-warning');
                const b = card.querySelector('.select-badge');
                if (b) {
                  b.className = 'badge bg-primary select-badge';
                  b.textContent = 'Active Selection';
                }
                showToast(`Selected: ${currentSuggestion.namcTerm} ↔ ${currentSuggestion.icd11Term}`, 'info', 2000);
              }
            });
          });
        }
      } catch (err) {
        console.error('Mapping search error:', err);
        if (suggestionList) {
          suggestionList.innerHTML = `<div class="text-danger">Unable to search mappings. Please try again.</div>`;
        }
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          searchMapping(searchInput.value.trim());
        }, 300);
      });
    }

    // Verification Modal
    let verifyModal = null;
    const verifyModalEl = document.getElementById('verificationModal');
    if (verifyModalEl && typeof bootstrap !== 'undefined') {
      verifyModal = new bootstrap.Modal(verifyModalEl);
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        const term = searchInput ? searchInput.value.trim() : '';
        if (!term) {
          showToast('Please enter an AYUSH term first.', 'warning');
          return;
        }

        if (!currentSuggestion) {
          showToast('No mapping candidate available to confirm.', 'warning');
          return;
        }

        if (verifyModal) {
          document.getElementById('vmNamcTerm').textContent = currentSuggestion.namcTerm || 'N/A';
          document.getElementById('vmNamcCode').textContent = currentSuggestion.namcCode || 'N/A';
          document.getElementById('vmWhoTerm').textContent = currentSuggestion.icd11Term || 'N/A';
          document.getElementById('vmWhoUri').textContent = currentSuggestion.whoEntityUri || 'N/A';
          document.getElementById('vmEvidence').textContent = (currentSuggestion.matchReasons || []).join(', ');
          document.getElementById('vmScore').textContent = Math.round(currentSuggestion.retrievalScore || 0);

          const icdCodeInput = document.getElementById('vmIcdCode');
          if (icdCodeInput) {
            icdCodeInput.value = currentSuggestion.icd11Tm2Code || '';
          }

          const form = document.getElementById('verificationForm');
          if (form) form.reset();
          if (icdCodeInput) icdCodeInput.value = currentSuggestion.icd11Tm2Code || '';

          document.getElementById('vmErrorAlert').classList.add('d-none');
          document.getElementById('vmSuccessAlert').classList.add('d-none');
          const submitBtn = document.getElementById('vmSubmitBtn');
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Verify & Save';

          verifyModal.show();
        }
      });
    }

    const verifyForm = document.getElementById('verificationForm');
    if (verifyForm) {
      verifyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const icdCodeInput = document.getElementById('vmIcdCode').value.trim();
        const relationshipSelect = document.getElementById('vmRelationship').value;
        const checkbox = document.getElementById('vmCheckbox');

        if (!icdCodeInput || !checkbox.checked) return;

        const submitBtn = document.getElementById('vmSubmitBtn');
        const errAlert = document.getElementById('vmErrorAlert');
        const successAlert = document.getElementById('vmSuccessAlert');

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
        errAlert.classList.add('d-none');
        successAlert.classList.add('d-none');

        try {
          const res = await fetch(`${API_BASE_URL}/api/mapping/verify-official-code`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              namcId: currentSuggestion.namcId,
              whoEntityUri: currentSuggestion.whoEntityUri,
              icd11Tm2Code: icdCodeInput,
              relationshipType: relationshipSelect
            })
          });

          if (res.status === 401) {
            errAlert.textContent = 'Your session has expired. Please log in again.';
            errAlert.classList.remove('d-none');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Verify & Save';
            return;
          }
          if (res.status === 403) {
            errAlert.textContent = 'Only an authorized doctor or administrator can verify mappings.';
            errAlert.classList.remove('d-none');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Verify & Save';
            return;
          }

          const data = await res.json();

          if (res.ok || res.status === 200) {
            successAlert.classList.remove('d-none');
            showToast(`Verified: ${currentSuggestion.namcTerm} ↔ ${icdCodeInput}`, 'success');

            setTimeout(() => {
              verifyModal.hide();
              loadRecentMappings();
              loadMappingStats();

              if (suggestionList) {
                suggestionList.innerHTML = `
                  <div class="suggestion-item candidate-card border border-success mb-3 p-3 position-relative verified-card">
                    <div class="candidate-header mb-2">
                      <span class="badge bg-success"><i class="fa-solid fa-circle-check"></i> VERIFIED</span>
                    </div>
                    <div class="candidate-grid mb-2">
                      <div class="candidate-col candidate-col-namc">
                        <div class="candidate-col-label">NAMC / AYUSH</div>
                        <div class="term">${escapeHtml(currentSuggestion.namcTerm || 'N/A')}</div>
                        ${currentSuggestion.namcEnglishTerm ? `<div class="sub">${escapeHtml(currentSuggestion.namcEnglishTerm)}</div>` : ''}
                        <div class="code-pill-wrap"><span class="code-pill pill-namaste">${escapeHtml(currentSuggestion.namcCode || 'N/A')}</span></div>
                      </div>
                      <div class="candidate-col candidate-col-who">
                        <div class="candidate-col-label">WHO ICD-11 TM2</div>
                        <div class="term">${escapeHtml(currentSuggestion.icd11Term || 'N/A')}</div>
                        <div class="code-pill-wrap"><span class="code-pill pill-icd">${escapeHtml(icdCodeInput)}</span></div>
                      </div>
                    </div>
                    <div class="candidate-evidence">
                      <strong>Relationship:</strong> ${escapeHtml(relationshipSelect)} &nbsp;|&nbsp; <strong>Source:</strong> WHO ICD-11 Coding Tool
                    </div>
                  </div>
                `;
              }
              if (confirmBtn) {
                confirmBtn.style.display = 'none';
              }
            }, 1000);
          } else {
            errAlert.textContent = data.message || 'An error occurred during verification.';
            errAlert.classList.remove('d-none');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Verify & Save';
          }
        } catch (e) {
          errAlert.textContent = 'A generic error occurred while connecting to the server.';
          errAlert.classList.remove('d-none');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Verify & Save';
        }
      });
    }

    // Bulk upload action
    const bulkBtn = document.getElementById('bulkUploadBtn') || document.querySelector('.page-header .quick-action-outline');
    if (bulkBtn) {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.csv, .xlsx, .xls';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);

      bulkBtn.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async () => {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);

        showToast(`Uploading and validating ${file.name}...`, 'info');

        try {
          const res = await fetch(`${API_BASE_URL}/api/mapping/bulk-upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });

          const data = await res.json();
          if (res.ok) {
            showToast(data.message || `Bulk upload success! ${data.recordsQueued} records queued.`, 'success', 5000);
            loadRecentMappings();
            loadMappingStats();
          } else {
            showToast(data.detail || data.message || 'Bulk upload failed.', 'error');
          }
        } catch (e) {
          console.error(e);
          showToast('Failed to upload file.', 'error');
        } finally {
          fileInput.value = '';
        }
      });
    }

    // View All Mappings Modal
    const viewAllBtn = document.getElementById('viewAllMappingsBtn');
    const allMappingsModalEl = document.getElementById('allMappingsModal');
    let allMappingsModal = null;
    if (allMappingsModalEl && typeof bootstrap !== 'undefined') {
      allMappingsModal = bootstrap.Modal.getOrCreateInstance(allMappingsModalEl);
    }

    if (viewAllBtn && allMappingsModal) {
      viewAllBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        allMappingsModal.show();
        await loadAllRegistryMappings();
      });

      const modalSearch = document.getElementById('modalMappingSearchInput');
      if (modalSearch) {
        modalSearch.addEventListener('input', () => {
          filterAllRegistryMappings(modalSearch.value.trim().toLowerCase());
        });
      }
    }

    let allRegistryMappingsCache = [];

    async function loadAllRegistryMappings() {
      const tableBody = document.querySelector('#modalAllMappingsTable tbody');
      if (!tableBody) return;

      try {
        const res = await authFetch('/api/mapping/recent?limit=100');
        if (!res.ok) return;
        allRegistryMappingsCache = await res.json();
        renderAllRegistryTable(allRegistryMappingsCache);
      } catch (e) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-danger text-center">Failed to load registry mappings.</td></tr>';
      }
    }

    function renderAllRegistryTable(mappings) {
      const tableBody = document.querySelector('#modalAllMappingsTable tbody');
      if (!tableBody) return;

      if (mappings.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-muted text-center py-4">No mapped terminology records found.</td></tr>';
        return;
      }

      tableBody.innerHTML = mappings.map(m => `
        <tr>
          <td class="fw-medium">${escapeHtml(m.searchTerm)}</td>
          <td><span class="code-pill pill-namaste">${escapeHtml(m.namasteCode)}</span></td>
          <td><span class="code-pill pill-icd">${escapeHtml(m.icd11Tm2Code)}</span></td>
          <td><span class="confidence-badge ${m.confidenceScore >= 90 ? 'confidence-high' : 'confidence-medium'}">${m.confidenceScore}%</span></td>
          <td><span class="badge bg-success"><i class="fa-solid fa-circle-check me-1"></i>Verified</span></td>
        </tr>
      `).join('');
    }

    function filterAllRegistryMappings(query) {
      if (!query) {
        renderAllRegistryTable(allRegistryMappingsCache);
        return;
      }
      const filtered = allRegistryMappingsCache.filter(m =>
        (m.searchTerm && m.searchTerm.toLowerCase().includes(query)) ||
        (m.namasteCode && m.namasteCode.toLowerCase().includes(query)) ||
        (m.icd11Tm2Code && m.icd11Tm2Code.toLowerCase().includes(query))
      );
      renderAllRegistryTable(filtered);
    }

    // Initial load
    loadMappingStats();
    loadRecentMappings();
    if (searchInput && searchInput.value) {
      searchMapping(searchInput.value.trim());
    }
  }

  /* ============================================
     10. DIAGNOSES LIBRARY & DETAILS MODAL
     ============================================ */
  const diagnosesSearch = document.querySelector('.diagnoses-search input');
  const systemTabs = document.querySelectorAll('.system-tab');

  if (diagnosesSearch || (systemTabs.length > 0 && currentPage === 'diagnoses.html')) {
    initDiagnosesPage();
  }

  function initDiagnosesPage() {
    let activeSystem = 'All Systems';
    let diagTimer = null;
    let diagnosesCache = [];

    const ddmEl = document.getElementById('diagnosisDetailsModal');
    let ddmModal = null;
    if (ddmEl && typeof bootstrap !== 'undefined') {
      ddmModal = bootstrap.Modal.getOrCreateInstance(ddmEl);
    }

    async function fetchDiagnoses() {
      const search = diagnosesSearch ? diagnosesSearch.value.trim() : '';
      const systemQuery = (activeSystem === 'All Systems' || activeSystem === 'All') ? '' : activeSystem;

      try {
        const queryParams = new URLSearchParams({
          system: systemQuery,
          search
        });

        const res = await authFetch(`/api/diagnoses?${queryParams.toString()}`);
        if (!res.ok) return;
        diagnosesCache = await res.json();
        renderDiagnosesGrid(diagnosesCache);
      } catch (err) {
        console.error('Error fetching diagnoses:', err);
      }
    }

    function renderDiagnosesGrid(diagnoses) {
      const grid = document.querySelector('.content .row.g-3');
      if (!grid) return;

      if (diagnoses.length === 0) {
        grid.innerHTML = `
          <div class="col-12 text-center py-5 text-muted">
            <i class="fa-solid fa-stethoscope mb-2" style="font-size:2rem; opacity:0.5;"></i>
            <p>No diagnoses found matching the filter.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = diagnoses.map((d, idx) => {
        const systemTagClass = `tag-${d.system.toLowerCase().includes('yoga') ? 'yoga' : d.system.toLowerCase()}`;
        const systemDisplayName = d.system === 'yoga' ? 'Yoga & Naturopathy' : d.system.charAt(0).toUpperCase() + d.system.slice(1);
        const fhirClass = d.fhirStatus === 'partial' ? 'fhir-badge fhir-partial' : 'fhir-badge';
        const fhirIcon = d.fhirStatus === 'partial' ? 'fa-clock' : 'fa-check';
        const fhirLabel = d.fhirStatus === 'partial' ? 'Partial' : 'FHIR R4';

        return `
          <div class="col-md-6 col-xl-4">
            <div class="diagnosis-card" data-idx="${idx}" title="Click to view clinical details">
              <div class="diagnosis-card-top">
                <span class="system-tag ${systemTagClass}">${systemDisplayName}</span>
                <span class="${fhirClass}"><i class="fa-solid ${fhirIcon}"></i> ${fhirLabel}</span>
              </div>
              <h6>${escapeHtml(d.name)} <span class="diagnosis-sub">${escapeHtml(d.subtitle || '')}</span></h6>
              <p>${escapeHtml(d.description)}</p>
              <div class="diagnosis-codes">
                <span class="code-pill pill-namaste">${escapeHtml(d.namasteCode)}</span>
                <i class="fa-solid fa-arrow-right-long code-arrow"></i>
                <span class="code-pill pill-icd">${escapeHtml(d.icd11Tm2Code)}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Wire card click to open Diagnosis Details modal
      grid.querySelectorAll('.diagnosis-card').forEach(card => {
        card.addEventListener('click', () => {
          const idx = parseInt(card.getAttribute('data-idx'), 10);
          if (!isNaN(idx) && diagnosesCache[idx] && ddmModal) {
            const d = diagnosesCache[idx];
            document.getElementById('ddmTitle').innerHTML = `${escapeHtml(d.name)} <small class="text-muted">${escapeHtml(d.subtitle || '')}</small>`;
            document.getElementById('ddmDesc').textContent = d.description;
            document.getElementById('ddmSystemTag').textContent = d.system ? d.system.toUpperCase() : 'AYUSH';
            document.getElementById('ddmNamc').textContent = d.namasteCode;
            document.getElementById('ddmIcd').textContent = d.icd11Tm2Code;

            const openMappingBtn = document.getElementById('ddmOpenMappingBtn');
            if (openMappingBtn) {
              openMappingBtn.onclick = () => {
                window.location.href = `mapping.html?term=${encodeURIComponent(d.name)}`;
              };
            }

            ddmModal.show();
          }
        });
      });
    }

    systemTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        systemTabs.forEach(t => t.classList.remove('system-tab-active'));
        tab.classList.add('system-tab-active');
        activeSystem = tab.textContent.trim();
        fetchDiagnoses();
      });
    });

    if (diagnosesSearch) {
      diagnosesSearch.addEventListener('input', () => {
        clearTimeout(diagTimer);
        diagTimer = setTimeout(fetchDiagnoses, 300);
      });
    }

    fetchDiagnoses();
  }

  /* ============================================
     11. REPORTS MODULE & EXPORTS
     ============================================ */
  if (currentPage === 'reports.html' || document.querySelector('.donut-chart')) {
    initReportsPage();
  }

  async function initReportsPage() {
    try {
      // 1. Overview stats
      const overRes = await authFetch('/api/reports/overview');
      if (overRes.ok) {
        const overview = await overRes.json();
        const statNums = document.querySelectorAll('.mini-stat-num');
        if (statNums.length >= 4) {
          statNums[0].textContent = (overview.totalDiagnoses || 2856).toLocaleString();
          statNums[1].textContent = `${overview.claimsApprovedRate || 96}%`;
          statNums[2].textContent = `${overview.claimsRejectedRate || 4.2}%`;
          statNums[3].textContent = (overview.codesMappedYtd || 1024).toLocaleString();
        }

        const donutNum = document.querySelector('.donut-num');
        if (donutNum) donutNum.textContent = `${overview.claimsApprovedRate || 96}%`;
      }

      // 2. System Breakdown bar chart
      const sysRes = await authFetch('/api/reports/system-breakdown');
      if (sysRes.ok) {
        const breakdown = await sysRes.json();
        const barChart = document.querySelector('.bar-chart');
        if (barChart && breakdown.length > 0) {
          barChart.innerHTML = breakdown.map(item => `
            <div class="bar-row">
              <span class="bar-label">${escapeHtml(item.system)}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${item.percentage}%; background:${item.color};"></div></div>
              <span class="bar-value">${item.percentage}%</span>
            </div>
          `).join('');
        }
      }

      // 3. Monthly Dual-Coding Volume Trend
      const trendRes = await authFetch('/api/reports/trend?months=6');
      if (trendRes.ok) {
        const trend = await trendRes.json();
        const trendChart = document.querySelector('.trend-chart');
        if (trendChart && trend.length > 0) {
          trendChart.innerHTML = trend.map(t => `
            <div class="trend-col"><div class="trend-bar" style="height:${t.volume}%;"></div><span>${escapeHtml(t.month)}</span></div>
          `).join('');
        }
      }

      // 4. Downloadable reports table
      const fileRes = await authFetch('/api/reports/files');
      if (fileRes.ok) {
        const files = await fileRes.json();
        const repTableBody = document.querySelector('.table-card:last-of-type tbody');
        if (repTableBody && files.length > 0) {
          repTableBody.innerHTML = files.map(f => `
            <tr>
              <td>${escapeHtml(f.name)}</td>
              <td>${escapeHtml(f.period)}</td>
              <td>${escapeHtml(f.generatedOn)}</td>
              <td class="text-end">
                <a href="${f.fileUrl}" class="view-link download-report-link" data-id="${f.id}" data-name="${escapeHtml(f.name)}">
                  <i class="fa-solid fa-download me-1"></i>Download CSV
                </a>
              </td>
            </tr>
          `).join('');

          // Wire download links
          repTableBody.querySelectorAll('.download-report-link').forEach(link => {
            link.addEventListener('click', async (e) => {
              e.preventDefault();
              const id = link.getAttribute('data-id');
              const name = link.getAttribute('data-name');
              showToast(`Preparing ${name}...`, 'info');

              try {
                const downloadRes = await authFetch(`/api/reports/download/${id}`);
                if (downloadRes.ok) {
                  const blob = await downloadRes.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${name.replace(/\s+/g, '_')}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                  showToast(`${name} downloaded successfully!`, 'success');
                } else {
                  showToast('Failed to download report file.', 'error');
                }
              } catch (err) {
                showToast('Network error during report download.', 'error');
              }
            });
          });
        }
      }

      // 5. Header Export Morbidity Data Button
      const exportReportBtn = document.getElementById('exportReportBtn') || document.querySelector('.page-header .page-header-btn');
      if (exportReportBtn) {
        exportReportBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          showToast('Generating clinic morbidity dataset...', 'info');

          try {
            const res = await authFetch('/api/reports/export');
            if (res.ok) {
              const blob = await res.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `CareSync_Morbidity_Report_${new Date().toISOString().split('T')[0]}.csv`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.URL.revokeObjectURL(url);
              showToast('Morbidity analytics export downloaded!', 'success');
            } else {
              showToast('Could not generate export.', 'error');
            }
          } catch (err) {
            showToast('Export network error.', 'error');
          }
        });
      }
    } catch (err) {
      console.error('Error hydrating reports page:', err);
    }
  }

  /* ============================================
     12. SETTINGS MODULE & MODALS
     ============================================ */
  const profileSection = document.getElementById('profile-section');
  if (profileSection) {
    initSettingsPage();
  }

  async function initSettingsPage() {
    try {
      // Setup Settings Nav smooth scrolling & tab highlights
      const navLinks = document.querySelectorAll('.settings-nav-link');
      navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          navLinks.forEach(l => l.classList.remove('settings-nav-active'));
          link.classList.add('settings-nav-active');

          const targetId = link.getAttribute('href');
          const targetEl = document.querySelector(targetId);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });

      const res = await authFetch('/api/settings');
      if (!res.ok) return;
      const data = await res.json();

      // Profile Fields
      const profileInputs = profileSection.querySelectorAll('.form-control-custom');
      if (profileInputs.length >= 4) {
        profileInputs[0].value = data.profile.name || '';
        profileInputs[1].value = data.profile.specialization || '';
        profileInputs[2].value = data.profile.email || '';
        profileInputs[3].value = data.profile.abhaId || '';
      }

      const profilePhotoImg = document.querySelector('.profile-photo');
      if (profilePhotoImg && data.profile.photoUrl) {
        profilePhotoImg.src = data.profile.photoUrl;
      }

      // Security 2FA toggle
      const secSection = document.getElementById('security-section');
      const twoFaToggle = secSection ? secSection.querySelector('.toggle-switch input') : null;
      if (twoFaToggle) {
        twoFaToggle.checked = Boolean(data.security.twoFactorEnabled);
        twoFaToggle.addEventListener('change', async () => {
          await authFetch('/api/settings/security', {
            method: 'PUT',
            body: JSON.stringify({ twoFactorEnabled: twoFaToggle.checked })
          });
          showToast(`Two-factor authentication ${twoFaToggle.checked ? 'enabled' : 'disabled'}.`, 'info');
        });
      }

      // Change Password Modal setup
      const changePassBtn = document.getElementById('changePasswordBtn') || (secSection ? secSection.querySelector('.settings-link-btn') : null);
      const changePassModalEl = document.getElementById('changePasswordModal');
      const changePassForm = document.getElementById('changePasswordForm');
      const changePassAlert = document.getElementById('changePasswordAlert');
      const submitChangePassBtn = document.getElementById('submitChangePassBtn');

      if (changePassModalEl && typeof bootstrap !== 'undefined') {
        const passModal = bootstrap.Modal.getOrCreateInstance(changePassModalEl);

        if (changePassBtn) {
          changePassBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (changePassAlert) changePassAlert.classList.add('d-none');
            if (changePassForm) changePassForm.reset();
            passModal.show();
          });
        }

        if (changePassForm) {
          changePassForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('currentPassInput').value;
            const newPassword = document.getElementById('newPassInput').value;
            const confirmNewPassword = document.getElementById('confirmNewPassInput').value;

            if (newPassword.length < 6) {
              changePassAlert.className = 'alert alert-danger';
              changePassAlert.textContent = 'New password must be at least 6 characters.';
              changePassAlert.classList.remove('d-none');
              return;
            }

            if (newPassword !== confirmNewPassword) {
              changePassAlert.className = 'alert alert-danger';
              changePassAlert.textContent = 'New password and confirmation do not match.';
              changePassAlert.classList.remove('d-none');
              return;
            }

            if (submitChangePassBtn) {
              submitChangePassBtn.disabled = true;
              submitChangePassBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Updating...';
            }

            try {
              const passRes = await authFetch('/api/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword })
              });

              if (passRes.ok) {
                changePassAlert.className = 'alert alert-success';
                changePassAlert.textContent = 'Password changed successfully!';
                changePassAlert.classList.remove('d-none');
                showToast('Password updated successfully.', 'success');
                setTimeout(() => passModal.hide(), 1200);
              } else {
                const err = await passRes.json();
                changePassAlert.className = 'alert alert-danger';
                changePassAlert.textContent = err.detail || 'Could not change password. Check current password.';
                changePassAlert.classList.remove('d-none');
              }
            } catch (err) {
              changePassAlert.className = 'alert alert-danger';
              changePassAlert.textContent = 'Server connection error.';
              changePassAlert.classList.remove('d-none');
            } finally {
              if (submitChangePassBtn) {
                submitChangePassBtn.disabled = false;
                submitChangePassBtn.innerHTML = 'Update Password';
              }
            }
          });
        }
      }

      // Preferences Section
      const prefSection = document.getElementById('preferences-section');
      if (prefSection) {
        const selects = prefSection.querySelectorAll('.filter-select');
        if (selects.length >= 2) {
          selects[0].value = data.preferences.language || 'English';
          selects[1].value = data.preferences.defaultAyushSystem || 'Ayurveda';

          const savePrefs = async () => {
            await authFetch('/api/settings/preferences', {
              method: 'PUT',
              body: JSON.stringify({
                language: selects[0].value,
                defaultAyushSystem: selects[1].value,
                darkMode: document.documentElement.getAttribute('data-theme') === 'dark'
              })
            });
            showToast('Preferences updated.', 'info', 2000);
          };

          selects[0].addEventListener('change', savePrefs);
          selects[1].addEventListener('change', savePrefs);
        }
      }

      // Notifications Section
      const notifSection = document.getElementById('notifications-section');
      if (notifSection) {
        const notifToggles = notifSection.querySelectorAll('.toggle-switch input');
        if (notifToggles.length >= 3) {
          notifToggles[0].checked = Boolean(data.notifications.criticalAlerts);
          notifToggles[1].checked = Boolean(data.notifications.claimUpdates);
          notifToggles[2].checked = Boolean(data.notifications.weeklySummary);

          const saveNotifs = async () => {
            await authFetch('/api/settings/notifications', {
              method: 'PUT',
              body: JSON.stringify({
                criticalAlerts: notifToggles[0].checked,
                claimUpdates: notifToggles[1].checked,
                weeklySummary: notifToggles[2].checked
              })
            });
            showToast('Notification settings saved.', 'info', 2000);
          };

          notifToggles.forEach(toggle => toggle.addEventListener('change', saveNotifs));
        }
      }

      // Profile Save Button
      const saveBtn = profileSection.querySelector('.settings-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          const name = profileInputs[0].value.trim();
          const specialization = profileInputs[1].value.trim();
          const email = profileInputs[2].value.trim();
          const abhaId = profileInputs[3].value.trim();

          if (!name || !email) {
            showToast('Name and email are required.', 'warning');
            return;
          }

          saveBtn.disabled = true;
          saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Saving...';

          try {
            const updateRes = await authFetch('/api/settings/profile', {
              method: 'PUT',
              body: JSON.stringify({ name, specialization, email, abhaId })
            });

            if (updateRes.ok) {
              if (currentUser && currentUser.user) {
                currentUser.user.name = name;
                currentUser.user.email = email;
                currentUser.user.specialization = specialization;
                currentUser.user.abhaId = abhaId;
                localStorage.setItem('careSyncUser', JSON.stringify(currentUser));
              }

              // Update topbar chip text
              document.querySelectorAll('.user-chip span, .user-dropdown-name').forEach(s => s.textContent = name);
              showToast('Profile information saved successfully!', 'success');
            } else {
              const err = await updateRes.json();
              showToast(err.detail || 'Could not save profile changes.', 'error');
            }
          } catch (e) {
            showToast('Failed to save profile changes.', 'error');
          } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
          }
        });
      }

      // Profile Photo Upload Button
      const photoUploadBtn = profileSection.querySelector('.profile-upload-btn');
      if (photoUploadBtn) {
        const photoFileInput = document.createElement('input');
        photoFileInput.type = 'file';
        photoFileInput.accept = 'image/jpeg, image/png';
        photoFileInput.style.display = 'none';
        document.body.appendChild(photoFileInput);

        photoUploadBtn.addEventListener('click', (e) => {
          e.preventDefault();
          photoFileInput.click();
        });

        photoFileInput.addEventListener('change', async () => {
          if (!photoFileInput.files || photoFileInput.files.length === 0) return;
          const file = photoFileInput.files[0];
          if (file.size > 2 * 1024 * 1024) {
            showToast('Image file exceeds maximum allowed size of 2MB.', 'warning');
            return;
          }

          const formData = new FormData();
          formData.append('photo', file);

          showToast('Uploading profile picture...', 'info');

          try {
            const uploadRes = await fetch(`${API_BASE_URL}/api/settings/photo`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData
            });

            if (uploadRes.ok) {
              const resData = await uploadRes.json();
              const photoUrl = `${API_BASE_URL}${resData.photoUrl}`;

              if (profilePhotoImg) profilePhotoImg.src = photoUrl;
              document.querySelectorAll('.user-chip img').forEach(img => img.src = photoUrl);

              if (currentUser && currentUser.user) {
                currentUser.user.photoUrl = photoUrl;
                localStorage.setItem('careSyncUser', JSON.stringify(currentUser));
              }
              showToast('Profile photo updated successfully!', 'success');
            } else {
              const err = await uploadRes.json();
              showToast(err.detail || 'Could not upload photo.', 'error');
            }
          } catch (e) {
            showToast('Failed to upload profile photo.', 'error');
          }
        });
      }
    } catch (err) {
      console.error('Error hydrating settings page:', err);
    }
  }

  /* ============================================
     13. UTILITY FUNCTIONS
     ============================================ */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

});