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