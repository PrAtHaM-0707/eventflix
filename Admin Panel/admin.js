// ====================================================
// EVENTFLIX ADMIN DASHBOARD - admin.js
// ====================================================

const API_URL = 'http://localhost:5000';
const ITEMS_PER_PAGE = 10;

// Global State
let allBookings = [];
let allCustomers = [];
let filteredBookings = [];
let filteredCustomers = [];
let currentPage = 1;
let confirmCallback = null;

// ====================================================
// INITIALIZATION
// ====================================================
document.addEventListener('DOMContentLoaded', function () {
  // Check authentication
  const admin = JSON.parse(localStorage.getItem('eventflix_admin') || 'null');
  if (!admin) {
    window.location.href = 'admin-login.html';
    return;
  }

  // Set admin info
  document.getElementById('adminName').textContent = admin.name || admin.username || 'Admin';
  document.getElementById('adminRole').textContent = formatRole(admin.role || 'admin');
  document.getElementById('adminAvatar').textContent = (admin.name || admin.username || 'A').charAt(0).toUpperCase();

  // Initialize
  initNavigation();
  setDefaultDates();
  loadAllData();

  console.log('✅ Admin Dashboard Initialized');
});

// ====================================================
// NAVIGATION
// ====================================================
function initNavigation() {
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      const page = this.dataset.page;
      if (page) showPage(page);
    });
  });
}

function showPage(pageName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Show selected page
  const page = document.getElementById(pageName + 'Page');
  if (page) page.classList.add('active');

  // Update menu
  document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
  const menuItem = document.querySelector(`[data-page="${pageName}"]`);
  if (menuItem) menuItem.classList.add('active');

  // Update title
  const title = pageName.charAt(0).toUpperCase() + pageName.slice(1);
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('breadcrumbPage').textContent = title;

  // Load page data
  switch (pageName) {
    case 'dashboard':
      updateDashboard();
      break;
    case 'bookings':
      renderBookings();
      break;
    case 'customers':
      loadCustomers();
      break;
    case 'payments':
      loadPayments();
      break;
    case 'slots':
      loadSlots();
      break;
  }

  // Close mobile menu
  document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');

  const icon = document.getElementById('toggleIcon');
  icon.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
}

function toggleMobileMenu() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ====================================================
// DATA LOADING
// ====================================================
async function loadAllData() {
  showToast('Loading data...', 'info');

  try {
    // Load from backend
    const response = await fetch(`${API_URL}/api/admin/orders`);
    const data = await response.json();

    if (data.success && data.orders) {
      allBookings = data.orders;
      console.log(`✅ Loaded ${allBookings.length} bookings from server`);
    }
  } catch (error) {
    console.error('Failed to load from server:', error);
    showToast('Using offline mode', 'warning');
  }

  // Sort by date (newest first)
  allBookings.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  // Update UI
  updateDashboard();
  updatePendingBadge();
  renderRecentBookings();

  showToast('Data loaded!', 'success');
}

async function refreshData() {
  await loadAllData();
}

// ====================================================
// DASHBOARD
// ====================================================
function updateDashboard() {
  const confirmed = allBookings.filter(b => b.status === 'confirmed');
  const pending = allBookings.filter(b => b.status === 'pending');

  const totalRevenue = confirmed.reduce((sum, b) => sum + (b.amount || 0), 0);

  // Get unique customers
  const uniquePhones = new Set();
  allBookings.forEach(b => {
    const phone = b.customer?.phone;
    if (phone) uniquePhones.add(phone);
  });

  // Update stats
  document.getElementById('statTotalBookings').textContent = allBookings.length;
  document.getElementById('statTotalRevenue').textContent = '₹' + formatNumber(totalRevenue);
  document.getElementById('statTotalCustomers').textContent = uniquePhones.size;
  document.getElementById('statPendingBookings').textContent = pending.length;

  // Update breakdowns
  updatePackageBreakdown();
  updateLocationStats();
}

function updatePackageBreakdown() {
  const packages = { Silver: 0, Gold: 0, Platinum: 0 };

  allBookings.forEach(b => {
    const pkg = b.booking?.package;
    if (pkg && packages.hasOwnProperty(pkg)) {
      packages[pkg]++;
    }
  });

  const total = allBookings.length || 1;

  ['Silver', 'Gold', 'Platinum'].forEach(pkg => {
    const percent = Math.round((packages[pkg] / total) * 100);
    const lower = pkg.toLowerCase();

    document.getElementById(lower + 'Percent').textContent = percent + '%';
    document.getElementById(lower + 'Bar').style.width = percent + '%';
    document.getElementById(lower + 'Count').textContent = packages[pkg] + ' bookings';
  });
}

function updateLocationStats() {
  const locations = { Surat: 0, Ahmedabad: 0, Rajkot: 0, Junagadh: 0 };

  allBookings.forEach(b => {
    const loc = b.booking?.location;
    if (loc && locations.hasOwnProperty(loc)) {
      locations[loc]++;
    }
  });

  document.getElementById('suratBookings').textContent = locations.Surat;
  document.getElementById('ahmedabadBookings').textContent = locations.Ahmedabad;
  document.getElementById('rajkotBookings').textContent = locations.Rajkot;
  document.getElementById('junagadhBookings').textContent = locations.Junagadh;
}

function updatePendingBadge() {
  const pending = allBookings.filter(b => b.status === 'pending').length;
  const badge = document.getElementById('pendingBadge');
  badge.textContent = pending;
  badge.style.display = pending > 0 ? 'inline' : 'none';
}

function renderRecentBookings() {
  const tbody = document.getElementById('recentBookingsTable');
  const recent = allBookings.slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #888;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">📅</div>
                    <h4>No Bookings Yet</h4>
                    <p>Bookings will appear here when customers make reservations</p>
                </td>
            </tr>
        `;
    return;
  }

  tbody.innerHTML = recent.map(b => {
    const customer = b.customer || {};
    const booking = b.booking || {};

    return `
            <tr>
                <td><strong style="color: #6C5CE7;">${b.orderId || '-'}</strong></td>
                <td>${customer.name || 'Guest'}</td>
                <td><span class="badge badge-info">${booking.package || '-'}</span></td>
                <td>${booking.location || '-'}</td>
                <td>${formatDate(booking.date)}</td>
                <td><strong>₹${formatNumber(b.amount || 0)}</strong></td>
                <td><span class="badge badge-${b.status || 'pending'}">${(b.status || 'pending').toUpperCase()}</span></td>
                <td><button class="action-btn view" onclick="viewBooking('${b.orderId}')">View</button></td>
            </tr>
        `;
  }).join('');
}

// ====================================================
// BOOKINGS PAGE
// ====================================================
function renderBookings() {
  filteredBookings = [...allBookings];
  applyBookingFilters();
}

function applyBookingFilters() {
  const search = (document.getElementById('searchBookings')?.value || '').toLowerCase();
  const status = document.getElementById('statusFilter')?.value || '';
  const location = document.getElementById('locationFilter')?.value || '';
  const pkg = document.getElementById('packageFilter')?.value || '';
  const date = document.getElementById('dateFilter')?.value || '';

  filteredBookings = allBookings.filter(b => {
    const booking = b.booking || {};
    const customer = b.customer || {};

    // Search
    if (search) {
      const searchStr = `${b.orderId} ${customer.name} ${customer.phone}`.toLowerCase();
      if (!searchStr.includes(search)) return false;
    }

    // Filters
    if (status && b.status !== status) return false;
    if (location && booking.location !== location) return false;
    if (pkg && booking.package !== pkg) return false;
    if (date && booking.date !== date) return false;

    return true;
  });

  renderBookingsTable();
}

function filterBookings() {
  currentPage = 1;
  applyBookingFilters();
}

function renderBookingsTable() {
  const tbody = document.getElementById('allBookingsTable');
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageData = filteredBookings.slice(start, end);

  document.getElementById('bookingsCount').textContent = `(${filteredBookings.length} bookings)`;
  document.getElementById('showingInfo').textContent =
    `Showing ${Math.min(start + 1, filteredBookings.length)}-${Math.min(end, filteredBookings.length)} of ${filteredBookings.length}`;

  if (pageData.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px; color: #888;">
                    No bookings found
                </td>
            </tr>
        `;
    renderPagination();
    return;
  }

  tbody.innerHTML = pageData.map(b => {
    const customer = b.customer || {};
    const booking = b.booking || {};

    return `
            <tr>
                <td><strong style="color: #6C5CE7;">${b.orderId || '-'}</strong></td>
                <td>${customer.name || 'Guest'}</td>
                <td>+91 ${customer.phone || '-'}</td>
                <td><span class="badge badge-info">${booking.package || '-'}</span></td>
                <td>${booking.location || '-'}</td>
                <td>${formatDate(booking.date)}</td>
                <td>${booking.slotLabel || '-'}</td>
                <td><strong>₹${formatNumber(b.amount || 0)}</strong></td>
                <td><span class="badge badge-${b.status || 'pending'}">${(b.status || 'pending').toUpperCase()}</span></td>
                <td>
                    <button class="action-btn view" onclick="viewBooking('${b.orderId}')">View</button>
                    ${b.status === 'pending' ? `<button class="action-btn edit" onclick="confirmBookingAction('${b.orderId}')">✓</button>` : ''}
                    ${b.status !== 'cancelled' ? `<button class="action-btn delete" onclick="cancelBookingAction('${b.orderId}')">✕</button>` : ''}
                </td>
            </tr>
        `;
  }).join('');

  renderPagination();
}

function renderPagination() {
  const container = document.getElementById('pagination');
  const totalPages = Math.ceil(filteredBookings.length / ITEMS_PER_PAGE);

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `<button class="btn btn-sm btn-secondary" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">← Prev</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      html += `<button class="btn btn-sm btn-primary">${i}</button>`;
    } else if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
      html += `<button class="btn btn-sm btn-secondary" onclick="goToPage(${i})">${i}</button>`;
    } else if (Math.abs(i - currentPage) === 3) {
      html += `<span style="padding: 5px;">...</span>`;
    }
  }

  html += `<button class="btn btn-sm btn-secondary" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">Next →</button>`;
  container.innerHTML = html;
}

function goToPage(page) {
  const totalPages = Math.ceil(filteredBookings.length / ITEMS_PER_PAGE);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderBookingsTable();
}

// ====================================================
// BOOKING ACTIONS
// ====================================================
function viewBooking(orderId) {
  const booking = allBookings.find(b => b.orderId === orderId);
  if (!booking) {
    showToast('Booking not found', 'error');
    return;
  }

  const customer = booking.customer || {};
  const info = booking.booking || {};

  const content = document.getElementById('bookingModalContent');
  content.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <label>Order ID</label>
                <div class="value" style="color: #6C5CE7;">${booking.orderId}</div>
            </div>
            <div class="detail-item">
                <label>Status</label>
                <div class="value">
                    <span class="badge badge-${booking.status || 'pending'}">${(booking.status || 'pending').toUpperCase()}</span>
                </div>
            </div>
            <div class="detail-item">
                <label>Customer Name</label>
                <div class="value">${customer.name || '-'}</div>
            </div>
            <div class="detail-item">
                <label>Phone</label>
                <div class="value">+91 ${customer.phone || '-'}</div>
            </div>
            <div class="detail-item">
                <label>Package</label>
                <div class="value">${info.package || '-'} Package</div>
            </div>
            <div class="detail-item">
                <label>Location</label>
                <div class="value">${info.location || '-'}</div>
            </div>
            <div class="detail-item">
                <label>Date</label>
                <div class="value">${formatDateFull(info.date)}</div>
            </div>
            <div class="detail-item">
                <label>Time Slot</label>
                <div class="value">${info.slotLabel || '-'}</div>
            </div>
            <div class="detail-item">
                <label>Amount</label>
                <div class="value" style="color: #27ae60; font-size: 1.3rem;">₹${formatNumber(booking.amount || 0)}</div>
            </div>
            <div class="detail-item">
                <label>Booked On</label>
                <div class="value">${formatDateFull(booking.createdAt)}</div>
            </div>
        </div>
    `;

  openModal('bookingModal');
}

async function confirmBookingAction(orderId) {
  showConfirm('Confirm Booking', 'Mark this booking as confirmed?', async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' })
      });

      const data = await response.json();

      if (data.success) {
        showToast('Booking confirmed!', 'success');
        await loadAllData();
      } else {
        showToast(data.message || 'Failed', 'error');
      }
    } catch (error) {
      // Update locally
      const booking = allBookings.find(b => b.orderId === orderId);
      if (booking) {
        booking.status = 'confirmed';
        updateDashboard();
        renderBookings();
        showToast('Booking confirmed!', 'success');
      }
    }
  });
}

async function cancelBookingAction(orderId) {
  showConfirm('Cancel Booking', 'Are you sure you want to cancel this booking?', async () => {
    try {
      const response = await fetch(`${API_URL}/api/orders/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });

      const data = await response.json();

      if (data.success) {
        showToast('Booking cancelled!', 'success');
        await loadAllData();
      } else {
        showToast(data.message || 'Failed', 'error');
      }
    } catch (error) {
      // Update locally
      const booking = allBookings.find(b => b.orderId === orderId);
      if (booking) {
        booking.status = 'cancelled';
        updateDashboard();
        renderBookings();
        showToast('Booking cancelled!', 'success');
      }
    }
  });
}

function printBooking() {
  window.print();
}

// ====================================================
// CUSTOMERS PAGE
// ====================================================
function loadCustomers() {
  const customerMap = new Map();

  allBookings.forEach(b => {
    const phone = b.customer?.phone;
    if (!phone) return;

    if (!customerMap.has(phone)) {
      customerMap.set(phone, {
        phone,
        name: b.customer?.name || 'Guest',
        email: b.customer?.email || '',
        bookings: [],
        totalSpent: 0,
        lastBooking: null
      });
    }

    const customer = customerMap.get(phone);
    customer.bookings.push(b);

    if (b.status === 'confirmed') {
      customer.totalSpent += (b.amount || 0);
    }

    if (!customer.lastBooking || new Date(b.createdAt) > new Date(customer.lastBooking)) {
      customer.lastBooking = b.createdAt;
    }
  });

  allCustomers = Array.from(customerMap.values());
  filteredCustomers = [...allCustomers];

  // Update stats
  document.getElementById('totalCustomersCount').textContent = allCustomers.length;
  document.getElementById('repeatCustomers').textContent = allCustomers.filter(c => c.bookings.length > 1).length;

  const totalSpent = allCustomers.reduce((sum, c) => sum + c.totalSpent, 0);
  const avgSpent = allCustomers.length ? Math.round(totalSpent / allCustomers.length) : 0;
  document.getElementById('avgSpending').textContent = '₹' + formatNumber(avgSpent);

  renderCustomersTable();
}

function filterCustomers() {
  const search = (document.getElementById('searchCustomers')?.value || '').toLowerCase();

  filteredCustomers = allCustomers.filter(c =>
    c.name.toLowerCase().includes(search) ||
    c.phone.includes(search) ||
    (c.email || '').toLowerCase().includes(search)
  );

  renderCustomersTable();
}

function sortCustomers() {
  const sortBy = document.getElementById('customerSort')?.value || 'recent';

  filteredCustomers.sort((a, b) => {
    switch (sortBy) {
      case 'recent': return new Date(b.lastBooking || 0) - new Date(a.lastBooking || 0);
      case 'bookings': return b.bookings.length - a.bookings.length;
      case 'spent': return b.totalSpent - a.totalSpent;
      case 'name': return (a.name || '').localeCompare(b.name || '');
      default: return 0;
    }
  });

  renderCustomersTable();
}

function renderCustomersTable() {
  const tbody = document.getElementById('allCustomersTable');
  document.getElementById('customersCount').textContent = `(${filteredCustomers.length} customers)`;

  if (filteredCustomers.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #888;">
                    No customers found
                </td>
            </tr>
        `;
    return;
  }

  tbody.innerHTML = filteredCustomers.map(c => `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 35px; height: 35px; background: #6C5CE7; color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                        ${(c.name || 'G').charAt(0).toUpperCase()}
                    </div>
                    <strong>${c.name}</strong>
                    ${c.bookings.length > 1 ? '<span class="badge badge-success">Repeat</span>' : ''}
                </div>
            </td>
            <td>+91 ${c.phone}</td>
            <td>${c.email || '-'}</td>
            <td><strong>${c.bookings.length}</strong></td>
            <td><strong style="color: #27ae60;">₹${formatNumber(c.totalSpent)}</strong></td>
            <td>${formatDate(c.lastBooking)}</td>
            <td><span class="badge badge-success">Active</span></td>
            <td><button class="action-btn view" onclick="viewCustomer('${c.phone}')">View</button></td>
        </tr>
    `).join('');
}

function viewCustomer(phone) {
  const customer = allCustomers.find(c => c.phone === phone);
  if (!customer) return;

  const content = document.getElementById('customerModalContent');
  content.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <label>Name</label>
                <div class="value">${customer.name}</div>
            </div>
            <div class="detail-item">
                <label>Phone</label>
                <div class="value">+91 ${customer.phone}</div>
            </div>
            <div class="detail-item">
                <label>Total Bookings</label>
                <div class="value">${customer.bookings.length}</div>
            </div>
            <div class="detail-item">
                <label>Total Spent</label>
                <div class="value" style="color: #27ae60;">₹${formatNumber(customer.totalSpent)}</div>
            </div>
        </div>
        <hr style="margin: 20px 0;">
        <h4>Booking History</h4>
        <div style="max-height: 200px; overflow-y: auto; margin-top: 10px;">
            ${customer.bookings.map(b => `
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
                    <strong>${b.orderId}</strong> - ${b.booking?.package || 'N/A'} - ₹${formatNumber(b.amount || 0)}
                    <span class="badge badge-${b.status || 'pending'}" style="margin-left: 10px;">${(b.status || 'pending').toUpperCase()}</span>
                </div>
            `).join('')}
        </div>
    `;

  openModal('customerModal');
}

// ====================================================
// SLOTS PAGE
// ====================================================
async function loadSlots() {
  const date = document.getElementById('slotDate')?.value;
  const location = document.getElementById('slotLocation')?.value || 'Surat';

  if (!date) {
    document.getElementById('slotsGrid').innerHTML = `
            <p style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px;">
                Select a date to view slots
            </p>
        `;
    return;
  }

  const formattedDate = new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  document.getElementById('slotDateDisplay').textContent = `${formattedDate} - ${location}`;

  // Default slots
  let slots = [
    { id: 'slot-1', label: '11 AM - 1 PM', available: true },
    { id: 'slot-2', label: '1 PM - 3 PM', available: true },
    { id: 'slot-3', label: '3 PM - 5 PM', available: true },
    { id: 'slot-4', label: '5 PM - 7 PM', available: true },
    { id: 'slot-5', label: '7 PM - 9 PM', available: true },
    { id: 'slot-6', label: '9 PM - 11 PM', available: true }
  ];

  // Check booked slots from server
  try {
    const response = await fetch(`${API_URL}/api/slots?date=${date}&location=${location}`);
    const data = await response.json();
    if (data.success && data.slots) {
      slots = data.slots;
    }
  } catch (error) {
    // Use local data
    allBookings.forEach(b => {
      const booking = b.booking || {};
      if (booking.date === date && booking.location === location && b.status !== 'cancelled') {
        const slot = slots.find(s => s.id === booking.slotId || s.label === booking.slotLabel);
        if (slot) slot.available = false;
      }
    });
  }

  renderSlots(slots);
}

function renderSlots(slots) {
  const container = document.getElementById('slotsGrid');

  container.innerHTML = slots.map(s => `
        <div class="slot-card ${s.available ? 'available' : 'booked'}">
            <div class="icon">${s.available ? '✅' : '❌'}</div>
            <div class="time">${s.label}</div>
            <div class="status">${s.available ? 'Available' : 'Booked'}</div>
        </div>
    `).join('');
}

function goToToday() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('slotDate').value = today;
  loadSlots();
}

function goToTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('slotDate').value = tomorrow.toISOString().split('T')[0];
  loadSlots();
}

// ====================================================
// PAYMENTS PAGE
// ====================================================
function loadPayments() {
  const confirmed = allBookings.filter(b => b.status === 'confirmed');
  const pending = allBookings.filter(b => b.status === 'pending');
  const cancelled = allBookings.filter(b => b.status === 'cancelled');

  const confirmedRev = confirmed.reduce((sum, b) => sum + (b.amount || 0), 0);
  const pendingRev = pending.reduce((sum, b) => sum + (b.amount || 0), 0);
  const refunded = cancelled.reduce((sum, b) => sum + (b.amount || 0), 0);
  const avgOrder = confirmed.length ? Math.round(confirmedRev / confirmed.length) : 0;

  document.getElementById('confirmedRevenue').textContent = '₹' + formatNumber(confirmedRev);
  document.getElementById('pendingRevenue').textContent = '₹' + formatNumber(pendingRev);
  document.getElementById('refundedAmount').textContent = '₹' + formatNumber(refunded);
  document.getElementById('avgOrderValue').textContent = '₹' + formatNumber(avgOrder);

  const tbody = document.getElementById('paymentsTable');

  if (allBookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #888;">No payments yet</td></tr>`;
    return;
  }

  tbody.innerHTML = allBookings.slice(0, 20).map(b => {
    const booking = b.booking || {};
    return `
            <tr>
                <td style="font-family: monospace;">TXN${(b.orderId || '').slice(-8)}</td>
                <td><strong style="color: #6C5CE7;">${b.orderId || '-'}</strong></td>
                <td>${b.customer?.name || 'Guest'}</td>
                <td>${booking.package || '-'}</td>
                <td><strong>₹${formatNumber(b.amount || 0)}</strong></td>
                <td>Cashfree</td>
                <td><span class="badge badge-${b.status || 'pending'}">${(b.status || 'pending').toUpperCase()}</span></td>
                <td>${formatDateFull(b.createdAt)}</td>
            </tr>
        `;
  }).join('');
}

// ====================================================
// EXPORT FUNCTIONS
// ====================================================
function exportBookings() {
  if (filteredBookings.length === 0) {
    showToast('No bookings to export', 'warning');
    return;
  }

  const headers = ['Order ID', 'Customer', 'Phone', 'Package', 'Location', 'Date', 'Time', 'Amount', 'Status', 'Created'];

  const rows = filteredBookings.map(b => {
    const booking = b.booking || {};
    const customer = b.customer || {};
    return [
      b.orderId || '',
      customer.name || '',
      customer.phone || '',
      booking.package || '',
      booking.location || '',
      booking.date || '',
      booking.slotLabel || '',
      b.amount || '',
      b.status || 'pending',
      b.createdAt || ''
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  downloadCSV(csv, `eventflix-bookings-${new Date().toISOString().split('T')[0]}.csv`);
  showToast('Bookings exported!', 'success');
}

function exportCustomers() {
  if (allCustomers.length === 0) {
    showToast('No customers to export', 'warning');
    return;
  }

  const headers = ['Name', 'Phone', 'Email', 'Total Bookings', 'Total Spent', 'Last Booking'];

  const rows = allCustomers.map(c => [
    c.name || '',
    c.phone || '',
    c.email || '',
    c.bookings.length,
    c.totalSpent,
    c.lastBooking || ''
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  downloadCSV(csv, `eventflix-customers-${new Date().toISOString().split('T')[0]}.csv`);
  showToast('Customers exported!', 'success');
}

function exportPayments() {
  exportBookings(); // Same data
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ====================================================
// UTILITIES
// ====================================================
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('en-IN').format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return '-';
  }
}

function formatDateFull(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (e) {
    return '-';
  }
}

function formatRole(role) {
  const roles = {
    super_admin: 'Super Admin',
    manager: 'Manager',
    staff: 'Staff',
    admin: 'Admin'
  };
  return roles[role] || 'Admin';
}

function setDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  const slotDate = document.getElementById('slotDate');
  if (slotDate) slotDate.value = today;
}

// ====================================================
// MODALS
// ====================================================
function openModal(id) {
  document.getElementById(id)?.classList.add('active');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

// ====================================================
// TOAST NOTIFICATIONS
// ====================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    console.log(`Toast: ${message}`);
    return;
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
        <span class="icon">${icons[type] || 'ℹ️'}</span>
        <span class="message">${message}</span>
        <button class="close-btn" onclick="this.parentElement.remove()">×</button>
    `;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ====================================================
// CONFIRM DIALOG
// ====================================================
function showConfirm(title, message, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  confirmCallback = callback;
  openModal('confirmModal');
}

function confirmAction() {
  closeModal('confirmModal');
  if (typeof confirmCallback === 'function') {
    confirmCallback();
  }
  confirmCallback = null;
}

// ====================================================
// AUTH & GLOBAL
// ====================================================
function logout() {
  showConfirm('Logout', 'Are you sure you want to logout?', () => {
    localStorage.removeItem('eventflix_admin');
    localStorage.removeItem('eventflix_admin_token');
    window.location.href = 'admin-login.html';
  });
}

function handleGlobalSearch(e) {
  if (e.key === 'Enter') {
    const term = e.target.value.trim();
    if (term) {
      showPage('bookings');
      setTimeout(() => {
        document.getElementById('searchBookings').value = term;
        filterBookings();
      }, 100);
    }
  }
}

console.log('✅ admin.js loaded');