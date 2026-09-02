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

});