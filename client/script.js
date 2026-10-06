/* ============================================
   CARE SYNC — SHARED JAVASCRIPT
   Used by: index.html, dashboard.html, login.html
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {

  const API_BASE_URL = window.API_BASE_URL || 'http://localhost:8000';

  /* ============================================
     1. SCROLL-REVEAL ANIMATIONS
     Used on: index.html (feature cards, workflow steps)
              dashboard.html (stat cards, widgets, table)
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
     Used on: index.html
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
     Used on: dashboard.html
     ============================================ */

  const sidebar = document.getElementById('sidebar');
  const mobileToggleBtn = document.querySelector('.mobile-topbar button');

  if (sidebar && mobileToggleBtn) {
    mobileToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('show');
    });

    // Close sidebar when clicking outside of it
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 991 && sidebar.classList.contains('show')) {
        if (!sidebar.contains(e.target) && !e.target.closest('.mobile-topbar button')) {
          sidebar.classList.remove('show');
        }
      }
    });
  }


  /* ============================================
     4. PASSWORD SHOW/HIDE TOGGLE
     Used on: login.html
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
     5. LOGIN SUBMISSION
     Used on: index.html
     ============================================ */

  const loginForm = document.getElementById('loginForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const identifierValue = document.getElementById('identifier').value.trim();
      const passwordValue = passField.value;
      const rememberMeValue = document.getElementById('remember').checked;
      const payload = {
        identifier: identifierValue,
        password: passwordValue,
        remember_me: rememberMeValue
      };

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
          localStorage.setItem('careSyncToken', data.access_token);
          localStorage.setItem('careSyncUser', JSON.stringify(data));
          window.location.href = 'dashboard.html';
        } else {
          alert(data.detail || 'Invalid Email/ABHA ID or Password.');
        }
      } catch (error) {
        console.error('Authentication Error:', error);
        alert('Unable to reach authentication server.');
      }
    });
  }


  /* ============================================
     5B. LOGIN PAGE STATS & CLINIC REGISTRATION
     Used on: index.html
     ============================================ */

  // Load real database stats for login page visual panel
  async function loadLoginStats() {
    const clinicsEl = document.getElementById('statClinics');
    const patientsEl = document.getElementById('statPatients');
    const mappingsEl = document.getElementById('statMappings');

    if (!clinicsEl && !patientsEl && !mappingsEl) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/public/stats`);
      if (response.ok) {
        const stats = await response.json();
        if (clinicsEl && typeof stats.clinics === 'number') {
          clinicsEl.textContent = stats.clinics;
        }
        if (patientsEl && typeof stats.patients === 'number') {
          patientsEl.textContent = stats.patients;
        }
        if (mappingsEl && typeof stats.mappings === 'number') {
          mappingsEl.textContent = stats.mappings;
        }
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

    // Auto-open if URL hash is #register
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

        // Validation
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

        // Disable submit button during request
        if (submitRegisterBtn) {
          submitRegisterBtn.disabled = true;
          submitRegisterBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Registering...';
        }

        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
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
            // Show success state
            regForm.classList.add('d-none');
            if (regSuccessView) {
              regSuccessView.classList.remove('d-none');
              if (regSuccessMsg) {
                regSuccessMsg.textContent = `${data.clinic ? data.clinic.clinicName : 'Your clinic'} has been registered in the database. You can now sign in with ${email}.`;
              }
            }

            // Pre-fill email on the login form
            const loginIdentifier = document.getElementById('identifier');
            if (loginIdentifier) {
              loginIdentifier.value = email;
            }

            // Refresh login stats
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

  // Helper for authenticated API fetch
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

  // Redirect to login if token is missing on protected pages
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const protectedPages = ['dashboard.html', 'patients.html', 'mapping.html', 'diagnoses.html', 'reports.html', 'settings.html'];

  if (protectedPages.includes(currentPage) && !token) {
    window.location.href = 'index.html';
    return;
  }

  // Sync user profile across all pages if logged in
  if (currentUser && currentUser.user) {
    const userChipSpans = document.querySelectorAll('.user-chip span');
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

  // Wire all logout links
  const logoutLinks = document.querySelectorAll('.logout-link');
  logoutLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      localStorage.removeItem('careSyncToken');
      localStorage.removeItem('careSyncUser');
      window.location.href = 'index.html';
    });
  });


  /* ============================================
     7. DASHBOARD PAGE HYDRATION
     ============================================ */

  if (currentPage === 'dashboard.html' || (document.querySelector('.greeting-block') && !document.querySelector('.patients-table'))) {
    loadDashboardSummary();
  }

  async function loadDashboardSummary() {
    try {
      const res = await authFetch('/api/dashboard/summary');
      if (!res.ok) return;
      const data = await res.json();

      // Stat cards: Patients, Diagnoses, Mappings
      const statNums = document.querySelectorAll('.stat-card-lg .stat-num-lg');
      if (statNums.length >= 3) {
        statNums[0].textContent = (data.patientCount || 1245).toLocaleString();
        statNums[1].textContent = (data.diagnosisCount || 2856).toLocaleString();
        statNums[2].textContent = (data.mappingCount || 542).toLocaleString();
      }

      // Recent Patients table
      const recentTableBody = document.querySelector('.table-card tbody');
      if (recentTableBody && data.recentPatients && data.recentPatients.length > 0) {
        recentTableBody.innerHTML = data.recentPatients.map(p => `
          <tr>
            <td>${escapeHtml(p.patientCode)}</td>
            <td>${escapeHtml(p.name)}</td>
            <td>${p.age}</td>
            <td>${escapeHtml(p.diagnosisLabel)}</td>
            <td class="text-end"><a href="patients.html" class="view-link">View</a></td>
          </tr>
        `).join('');
      }

      // Mapping Overview bar and legend
      const fillBar = document.querySelector('.mapping-bar-fill');
      const mapped = data.mappedCount || 542;
      const unmapped = data.unmappedCount || 23;
      const totalCodes = mapped + unmapped;
      const percent = totalCodes > 0 ? Math.round((mapped / totalCodes) * 100) : 96;

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
     8. PATIENTS PAGE HYDRATION & ACTIONS
     ============================================ */

  const patientsTable = document.querySelector('.patients-table');
  if (patientsTable) {
    initPatientsPage();
  }

  function initPatientsPage() {
    const searchInput = document.querySelector('.patient-search input');
    const statusSelect = document.querySelector('.filter-select');
    let searchTimeout = null;

    async function fetchPatients() {
      const search = searchInput ? searchInput.value.trim() : '';
      const status = statusSelect ? statusSelect.value : '';

      try {
        const queryParams = new URLSearchParams({
          search,
          status: status === 'All Status' ? '' : status,
          page: 1,
          limit: 10
        });

        const res = await authFetch(`/api/patients?${queryParams.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        renderPatientsTable(data.patients || []);

        const footerText = document.querySelector('.table-footer-text');
        if (footerText) {
          footerText.textContent = `Showing ${(data.patients || []).length} of ${data.total || 0} patients`;
        }
      } catch (err) {
        console.error('Error fetching patients:', err);
      }
    }

    function renderPatientsTable(patients) {
      const tbody = patientsTable.querySelector('tbody');
      if (!tbody) return;

      if (patients.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-4 text-muted">
              No patients found matching your search.
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

      // Wire View buttons to show FHIR Condition resource info
      tbody.querySelectorAll('.patient-view-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const code = btn.getAttribute('data-code');
          try {
            const fhirRes = await authFetch(`/api/patients/${code}/fhir`);
            if (fhirRes.ok) {
              const resource = await fhirRes.json();
              alert(`FHIR R4 Condition Resource (${code}):\n\nSubject: ${resource.subject.display}\nDiagnosis: ${resource.code.text}\nCodes:\n- NAMASTE: ${resource.code.coding[0]?.code}\n- ICD-11 TM2: ${resource.code.coding[1]?.code}\nClinical Status: ${resource.clinicalStatus?.coding[0]?.display}`);
            }
          } catch (e) {
            console.error(e);
          }
        });
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(fetchPatients, 300);
      });
    }

    if (statusSelect) {
      statusSelect.addEventListener('change', fetchPatients);
    }

    // Add Patient button
    const addPatientBtn = document.querySelector('.page-header-btn');
    if (addPatientBtn && addPatientBtn.textContent.includes('Add Patient')) {
      addPatientBtn.addEventListener('click', async () => {
        const name = prompt('Enter Patient Full Name:');
        if (!name) return;
        const age = prompt('Enter Patient Age:', '30');
        if (!age) return;
        const diagnosis = prompt('Enter AYUSH Diagnosis:', 'Jwara (Fever)');
        if (!diagnosis) return;
        const namasteCode = prompt('Enter NAMASTE Code:', 'AYU-0011');
        const icd11Code = prompt('Enter ICD-11 (TM2) Code:', 'MG26');

        try {
          const res = await authFetch('/api/patients', {
            method: 'POST',
            body: JSON.stringify({
              name,
              age: parseInt(age, 10) || 30,
              diagnosisLabel: diagnosis,
              namasteCode: namasteCode || 'AYU-0011',
              icd11Tm2Code: icd11Code || 'MG26',
              status: 'stable'
            })
          });

          if (res.ok) {
            alert('Patient added successfully!');
            fetchPatients();
          } else {
            const err = await res.json();
            alert(err.detail || 'Could not create patient.');
          }
        } catch (e) {
          console.error(e);
          alert('Network error while creating patient.');
        }
      });
    }

    // Initial load
    fetchPatients();
  }


  /* ============================================
     9. DISEASE MAPPING PAGE HYDRATION & SEARCH
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
    let searchTimer = null;

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
      if (!term.trim()) return;
      try {
        const res = await authFetch(`/api/mapping/search?term=${encodeURIComponent(term)}`);
        if (!res.ok) return;
        const data = await res.json();
        currentSuggestion = data;

        if (suggestionList) {
          suggestionList.innerHTML = `
            <div class="suggestion-item">
              <div>
                <div class="term">${escapeHtml(data.namaste.term)}</div>
                <div class="sub">${escapeHtml(data.namaste.sub)}</div>
              </div>
              <span class="code-pill pill-namaste">${escapeHtml(data.namaste.code)}</span>
            </div>
            <div class="suggestion-item">
              <div>
                <div class="term">${escapeHtml(data.tm2.term)}</div>
                <div class="sub">${escapeHtml(data.tm2.sub)}</div>
              </div>
              <span class="code-pill pill-icd">${escapeHtml(data.tm2.code)}</span>
            </div>
            <div class="suggestion-item">
              <div>
                <div class="term">${escapeHtml(data.biomedicine.term)}</div>
                <div class="sub">${escapeHtml(data.biomedicine.sub)}</div>
              </div>
              <span class="code-pill pill-icd">${escapeHtml(data.biomedicine.code)}</span>
            </div>
          `;
        }

        if (confidenceBadge) {
          const confClass = data.confidenceScore >= 90 ? 'confidence-high' : (data.confidenceScore >= 75 ? 'confidence-medium' : 'confidence-low');
          confidenceBadge.innerHTML = `
            <span class="confidence-badge ${confClass}">
              <i class="fa-solid fa-circle-check"></i> ${data.confidenceScore}% Match Confidence
            </span>
          `;
        }
      } catch (err) {
        console.error('Mapping search error:', err);
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

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        const term = searchInput ? searchInput.value.trim() : '';
        if (!term) {
          alert('Please enter an AYUSH term first.');
          return;
        }

        const payload = currentSuggestion ? {
          searchTerm: term,
          namasteCode: currentSuggestion.namaste.code,
          icd11Tm2Code: currentSuggestion.tm2.code,
          icd11BioCode: currentSuggestion.biomedicine.code,
          confidenceScore: currentSuggestion.confidenceScore
        } : {
          searchTerm: term,
          namasteCode: 'AYU-0042',
          icd11Tm2Code: 'SP70',
          icd11BioCode: '6C20',
          confidenceScore: 95
        };

        try {
          const res = await authFetch('/api/mapping/confirm', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            alert('Dual-coding confirmed and saved to database!');
            loadRecentMappings();
            loadMappingStats();
          } else {
            const err = await res.json();
            alert(err.detail || 'Could not confirm mapping.');
          }
        } catch (e) {
          console.error(e);
        }
      });
    }

    // Bulk upload action
    const bulkBtn = document.querySelector('.page-header .quick-action-outline');
    if (bulkBtn && bulkBtn.textContent.includes('Bulk Upload')) {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.csv, .xlsx, .xls';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);

      bulkBtn.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async () => {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        try {
          const res = await fetch(`${API_BASE_URL}/api/mapping/bulk-upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });

          if (res.ok) {
            const data = await res.json();
            alert(`Bulk upload success! ${data.recordsQueued || 15} records queued for dual coding.`);
            loadRecentMappings();
          } else {
            const err = await res.json();
            alert(err.detail || 'Bulk upload failed.');
          }
        } catch (e) {
          console.error(e);
        }
      });
    }

    // Initial load
    loadMappingStats();
    loadRecentMappings();
    if (searchInput && searchInput.value) {
      searchMapping(searchInput.value.trim());
    }
  }


  /* ============================================
     10. DIAGNOSES LIBRARY PAGE HYDRATION
     ============================================ */

  const diagnosesGrid = document.querySelector('.row.g-3');
  const diagnosesSearch = document.querySelector('.diagnoses-search input');
  const systemTabs = document.querySelectorAll('.system-tab');

  if (diagnosesSearch || (systemTabs.length > 0 && currentPage === 'diagnoses.html')) {
    initDiagnosesPage();
  }

  function initDiagnosesPage() {
    let activeSystem = 'All Systems';
    let diagTimer = null;

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
        const diagnoses = await res.json();
        renderDiagnosesGrid(diagnoses);
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

      grid.innerHTML = diagnoses.map(d => {
        const systemTagClass = `tag-${d.system.toLowerCase().includes('yoga') ? 'yoga' : d.system.toLowerCase()}`;
        const systemDisplayName = d.system === 'yoga' ? 'Yoga & Naturopathy' : d.system.charAt(0).toUpperCase() + d.system.slice(1);
        const fhirClass = d.fhirStatus === 'partial' ? 'fhir-badge fhir-partial' : 'fhir-badge';
        const fhirIcon = d.fhirStatus === 'partial' ? 'fa-clock' : 'fa-check';
        const fhirLabel = d.fhirStatus === 'partial' ? 'Partial' : 'FHIR R4';

        return `
          <div class="col-md-6 col-xl-4">
            <div class="diagnosis-card">
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
    }

    // System tab click
    systemTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        systemTabs.forEach(t => t.classList.remove('system-tab-active'));
        tab.classList.add('system-tab-active');
        activeSystem = tab.textContent.trim();
        fetchDiagnoses();
      });
    });

    // Search input debounce
    if (diagnosesSearch) {
      diagnosesSearch.addEventListener('input', () => {
        clearTimeout(diagTimer);
        diagTimer = setTimeout(fetchDiagnoses, 300);
      });
    }

    fetchDiagnoses();
  }


  /* ============================================
     11. REPORTS & ANALYTICS PAGE HYDRATION
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

        // Donut center
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
              <td class="text-end"><a href="${f.fileUrl}" class="view-link" onclick="event.preventDefault(); alert('Downloading ${f.name} (${f.period})...');"><i class="fa-solid fa-download me-1"></i>PDF</a></td>
            </tr>
          `).join('');
        }
      }
    } catch (err) {
      console.error('Error hydrating reports page:', err);
    }
  }


  /* ============================================
     12. SETTINGS PAGE HYDRATION & PERSISTENCE
     ============================================ */

  const profileSection = document.getElementById('profile-section');
  if (profileSection) {
    initSettingsPage();
  }

  async function initSettingsPage() {
    try {
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
        });
      }

      // Security: Change Password button
      const changePassBtn = secSection ? secSection.querySelector('.settings-link-btn') : null;
      if (changePassBtn) {
        changePassBtn.addEventListener('click', async () => {
          const currentPassword = prompt('Enter Current Password:');
          if (!currentPassword) return;
          const newPassword = prompt('Enter New Password (minimum 6 characters):');
          if (!newPassword || newPassword.length < 6) {
            alert('Password must be at least 6 characters.');
            return;
          }

          try {
            const passRes = await authFetch('/api/auth/change-password', {
              method: 'POST',
              body: JSON.stringify({ currentPassword, newPassword })
            });
            if (passRes.ok) {
              alert('Password changed successfully!');
            } else {
              const err = await passRes.json();
              alert(err.detail || 'Could not change password.');
            }
          } catch (e) {
            console.error(e);
          }
        });
      }

      // Preferences
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
                darkMode: darkModeToggle ? darkModeToggle.checked : false
              })
            });
          };

          selects[0].addEventListener('change', savePrefs);
          selects[1].addEventListener('change', savePrefs);
        }

        const darkModeToggle = prefSection.querySelector('.toggle-switch input');
        if (darkModeToggle) {
          darkModeToggle.checked = Boolean(data.preferences.darkMode);
          darkModeToggle.addEventListener('change', async () => {
            await authFetch('/api/settings/preferences', {
              method: 'PUT',
              body: JSON.stringify({
                darkMode: darkModeToggle.checked
              })
            });
          });
        }
      }

      // Notifications
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

          try {
            const updateRes = await authFetch('/api/settings/profile', {
              method: 'PUT',
              body: JSON.stringify({ name, specialization, email, abhaId })
            });

            if (updateRes.ok) {
              const resData = await updateRes.json();
              if (currentUser && currentUser.user) {
                currentUser.user.name = name;
                currentUser.user.email = email;
                currentUser.user.specialization = specialization;
                currentUser.user.abhaId = abhaId;
                localStorage.setItem('careSyncUser', JSON.stringify(currentUser));
              }
              alert('Profile changes saved successfully!');
            } else {
              const err = await updateRes.json();
              alert(err.detail || 'Could not save profile changes.');
            }
          } catch (e) {
            console.error(e);
            alert('Failed to save profile changes.');
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
            alert('Image file exceeds maximum allowed size of 2MB.');
            return;
          }

          const formData = new FormData();
          formData.append('photo', file);

          try {
            const uploadRes = await fetch(`${API_BASE_URL}/api/settings/photo`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: formData
            });

            if (uploadRes.ok) {
              const resData = await uploadRes.json();
              if (profilePhotoImg) profilePhotoImg.src = `${API_BASE_URL}${resData.photoUrl}`;
              if (currentUser && currentUser.user) {
                currentUser.user.photoUrl = `${API_BASE_URL}${resData.photoUrl}`;
                localStorage.setItem('careSyncUser', JSON.stringify(currentUser));
              }
              alert('Profile photo updated successfully!');
            } else {
              const err = await uploadRes.json();
              alert(err.detail || 'Could not upload photo.');
            }
          } catch (e) {
            console.error(e);
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