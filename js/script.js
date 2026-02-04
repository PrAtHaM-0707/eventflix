const API_URL = 'https://eventflix.onrender.com';

document.addEventListener('DOMContentLoaded', function () {
    initDatePicker();
    initSlider();
    initFAQ();
    initServicesSlider();
    initReviewSlider();
});

function initDatePicker() {
    const dateInput = document.getElementById('date');
    if (!dateInput) return;
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    dateInput.value = today;
}

function goToPackages() {
    const location = document.getElementById('location')?.value;
    const date = document.getElementById('date')?.value;

    if (!location) { alert('Please select a location'); return; }
    if (!date) { alert('Please select a date'); return; }

    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) { alert('Please select a future date'); return; }

    window.location.href = `package.html?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`;
}

function initSlider() {
    const slides = document.querySelector('.slides');
    const leftArrow = document.querySelector('.arrow-left');
    const rightArrow = document.querySelector('.arrow-right');
    if (!slides || !leftArrow || !rightArrow) return;

    const slideElements = slides.querySelectorAll('.slide');
    let currentSlide = 0;
    const totalSlides = slideElements.length;

    function updateSlider() { slides.style.transform = `translateX(-${currentSlide * 100}%)`; }

    leftArrow.addEventListener('click', () => {
        currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
        updateSlider();
    });

    rightArrow.addEventListener('click', () => {
        currentSlide = (currentSlide + 1) % totalSlides;
        updateSlider();
    });

    setInterval(() => {
        currentSlide = (currentSlide + 1) % totalSlides;
        updateSlider();
    }, 4000);
}

function initFAQ() {
    document.querySelectorAll('.faq-question').forEach(q => {
        q.addEventListener('click', function () {
            const wasActive = this.classList.contains('active');

            document.querySelectorAll('.faq-question').forEach(item => {
                item.classList.remove('active');
                const ans = item.nextElementSibling;
                if (ans && ans.classList.contains('faq-answer')) {
                    ans.style.maxHeight = null;
                    ans.style.padding = '0 15px';
                }
            });

            if (!wasActive) {
                this.classList.add('active');
                const answer = this.nextElementSibling;
                if (answer && answer.classList.contains('faq-answer')) {
                    answer.style.maxHeight = answer.scrollHeight + 'px';
                    answer.style.padding = '15px';
                }
            }
        });
    });
}

function initServicesSlider() {
    const slider = document.querySelector('.services-slidebar');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    if (!slider || !prevBtn || !nextBtn) return;

    prevBtn.addEventListener('click', () => slider.scrollBy({ left: -300, behavior: 'smooth' }));
    nextBtn.addEventListener('click', () => slider.scrollBy({ left: 300, behavior: 'smooth' }));
}

function initReviewSlider() {
    const track = document.querySelector('.review-track');
    if (!track) return;
    track.querySelectorAll('.review').forEach(r => track.appendChild(r.cloneNode(true)));
}