const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('.nav-menu');

toggle?.addEventListener('click', () => {
  const isOpen = menu.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(isOpen));
  toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
});

menu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menu.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.setAttribute('aria-label', 'Open menu');
  });
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

const form = document.querySelector('.contact-form');
const status = document.querySelector('.form-status');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+\d][\d\s()-]{7,}$/;

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const required = ['name', 'company', 'email', 'phone', 'requirement', 'message'];
  const missing = required.filter((field) => !String(data.get(field) || '').trim());

  status.className = 'form-status';
  if (missing.length) {
    status.textContent = 'Please complete all fields before submitting.';
    status.classList.add('error');
    return;
  }
  if (!emailPattern.test(String(data.get('email')))) {
    status.textContent = 'Please enter a valid email address.';
    status.classList.add('error');
    return;
  }
  if (!phonePattern.test(String(data.get('phone')))) {
    status.textContent = 'Please enter a valid phone number.';
    status.classList.add('error');
    return;
  }

  status.textContent = 'Thank you. Your requirement has been captured. Talent Stock will contact you shortly.';
  status.classList.add('success');
  form.reset();
});
