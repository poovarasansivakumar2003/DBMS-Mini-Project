// Preloader
window.addEventListener('load', function() {
    const loader = document.getElementById('loading');
    loader.style.display = 'none';
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Mobile menu toggle
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-icon');
    
    mobileMenu.classList.toggle('hidden');
    
    // Toggle menu icon
    if (mobileMenu.classList.contains('hidden')) {
        menuIcon.classList.remove('fa-times');
        menuIcon.classList.add('fa-bars');
    } else {
        menuIcon.classList.remove('fa-bars');
        menuIcon.classList.add('fa-times');
    }
}

// Close mobile menu on window resize
window.addEventListener('resize', function() {
    if (window.innerWidth >= 768) { // md breakpoint
        const mobileMenu = document.getElementById('mobile-menu');
        const menuIcon = document.getElementById('menu-icon');
        
        mobileMenu.classList.add('hidden');
        menuIcon.classList.remove('fa-times');
        menuIcon.classList.add('fa-bars');
    }
});

function togglePassword() {
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.getElementById('password-toggle');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        passwordToggle.classList.remove('fa-eye');
        passwordToggle.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        passwordToggle.classList.remove('fa-eye-slash');
        passwordToggle.classList.add('fa-eye');
    }
}

// Add animation to form fields
document.querySelectorAll('.group').forEach(group => {
    const input = group.querySelector('input, select');
    input.addEventListener('focus', () => {
        group.classList.add('transform', 'scale-105');
        group.style.transition = 'all 0.2s ease';
    });
    input.addEventListener('blur', () => {
        group.classList.remove('transform', 'scale-105');
    });
});

function toggleFAQ(index) {
    const answer = document.getElementById(`faq-answer-${index}`);
    const icon = document.getElementById(`faq-icon-${index}`);
    
    // Toggle classes for animation
    answer.classList.toggle('hidden');
    answer.classList.toggle('active');
    
    // Rotate icon
    icon.style.transform = answer.classList.contains('active') 
        ? 'rotate(180deg)' 
        : 'rotate(0)';
}

// Add scroll reveal animation
window.addEventListener('scroll', function() {
    const elements = document.querySelectorAll('.transform');
    elements.forEach(elem => {
        const rect = elem.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.75) {
            elem.classList.add('opacity-100');
            elem.classList.remove('opacity-0');
        }
    });
});
