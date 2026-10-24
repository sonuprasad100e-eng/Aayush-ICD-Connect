/* ============================================
   CARE SYNC — SHARED JAVASCRIPT
   Used by: index.html, dashboard.html, login.html
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {

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

});

  
  // Aayush-ICD Connect: backend integration
  const mappingPage = document.querySelector('.mapping-table');

  if (mappingPage) {
    const API_URL = 'http://127.0.0.1:5000/api/mappings';
    const tableBody = mappingPage.querySelector('tbody');
    const searchInput = document.querySelector('.code-input');
    const confirmButton = document.querySelector('.code-widget button');

    async function loadMappings() {
      try {
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        const response = await fetch(
          API_URL + '?search=' + encodeURIComponent(searchTerm)
        );

        if (!response.ok) {
          throw new Error('Could not load mappings');
        }

        const mappings = await response.json();
        tableBody.replaceChildren();

        mappings.forEach((item) => {
          const row = document.createElement('tr');

          const values = [
            item.ayush_term,
            item.ayush_code || '—',
            item.icd_code || '—',
            'Unverified demo'
          ];

          values.forEach((value, index) => {
            const cell = document.createElement('td');

            if (index === 1 || index === 2) {
              const pill = document.createElement('span');
              pill.className = 'code-pill ' +
                (index === 1 ? 'pill-namaste' : 'pill-icd');
              pill.textContent = value;
              cell.appendChild(pill);
            } else {
              cell.textContent = value;
            }

            row.appendChild(cell);
          });

          tableBody.appendChild(row);
        });
      } catch (error) {
        console.error('Mapping API error:', error);
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', loadMappings);
    }

    if (confirmButton && searchInput) {
      confirmButton.addEventListener('click', async (event) => {
        event.preventDefault();

        const ayushTerm = searchInput.value.trim();

        if (!ayushTerm) {
          alert('Please enter an AYUSH term first.');
          return;
        }

        const icdTerm = prompt('Enter the ICD-11 term for this demo:');
        if (!icdTerm || !icdTerm.trim()) return;

        const icdCode = prompt('Enter the ICD-11 code, or leave it blank:');
        if (icdCode === null) return;

        try {
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ayush_term: ayushTerm,
              ayush_code: '',
              icd_term: icdTerm.trim(),
              icd_code: icdCode.trim(),
              source: 'Unverified demo data - not clinically validated'
            })
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Could not save mapping');
          }

          alert('Demo mapping saved successfully!');
          if (searchInput) searchInput.value = '';
          await loadMappings();
        } catch (error) {
          console.error('Save error:', error);
          alert('Could not save. Check that the Flask server is running.');
        }
      });
    }

    loadMappings();
  }

