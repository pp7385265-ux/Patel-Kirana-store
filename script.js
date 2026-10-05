// Global Variables
let currentUser = null;
let cart = [];
let orders = [];
let products = [];
let offers = [];
let reviews = [];
let productViews = {};
let editingProductId = null;
let editingOfferId = null;
let offerExpiryTimer = null;
let db = null;
let selectedRating = 0;
let wishlist = [];
let addresses = [];
let notifications = [];
let selectedCategory = 'All';
let appliedCoupon = null;
let inventory = JSON.parse(localStorage.getItem('patelKirana_inventory') || '{}');
let adminCoupons = JSON.parse(localStorage.getItem('patelKirana_adminCoupons') || '[]');
let adminStores = JSON.parse(localStorage.getItem('patelKirana_stores') || '[]');
let supportTickets = JSON.parse(localStorage.getItem('patelKirana_tickets') || '[]');
let adminBanners = JSON.parse(localStorage.getItem('patelKirana_banners') || '[]');
let adminRoles = JSON.parse(localStorage.getItem('patelKirana_roles') || '[]');
let partnerToken = localStorage.getItem('partnerToken') || '';
let currentPartner = JSON.parse(localStorage.getItem('currentPartner') || 'null');
const PRODUCT_API = 'admin_api.php';
const USER_API = 'user_api.php';

// Database initialization
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('PatelKiranaDB', 1);
        
        request.onerror = () => {
            console.log('IndexedDB error, falling back to localStorage');
            resolve(null);
        };
        
        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database initialized successfully');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            
            // Create object stores
            if (!db.objectStoreNames.contains('users')) {
                db.createObjectStore('users', { keyPath: 'mobile' });
            }
            if (!db.objectStoreNames.contains('products')) {
                db.createObjectStore('products', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('orders')) {
                db.createObjectStore('orders', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('offers')) {
                db.createObjectStore('offers', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('cart')) {
                db.createObjectStore('cart', { keyPath: 'id' });
            }
        };
    });
}

// Database operations
async function dbGet(storeName, key) {
    if (!db) {
        const data = localStorage.getItem(`patelKirana_${storeName}`);
        const parsed = data ? JSON.parse(data) : [];
        return Array.isArray(parsed) ? parsed.find(item => item.id === key || item.mobile === key) : null;
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

async function dbGetAll(storeName) {
    if (!db) {
        const data = localStorage.getItem(`patelKirana_${storeName}`);
        return data ? JSON.parse(data) : [];
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

async function dbPut(storeName, data) {
    if (!db) {
        const all = await dbGetAll(storeName);
        const index = all.findIndex(item => item.id === data.id || item.mobile === data.mobile);
        if (index >= 0) {
            all[index] = data;
        } else {
            all.push(data);
        }
        localStorage.setItem(`patelKirana_${storeName}`, JSON.stringify(all));
        return true;
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
    });
}

async function dbDelete(storeName, key) {
    if (!db) {
        const all = await dbGetAll(storeName);
        const filtered = all.filter(item => item.id !== key && item.mobile !== key);
        localStorage.setItem(`patelKirana_${storeName}`, JSON.stringify(filtered));
        return true;
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', async function() {
    currentUser = localStorage.getItem('currentUser');
    await initDB();
    await loadData();
    setupEventListeners();
    checkCurrentUser();
});

async function fetchServerData() {
    try {
        const response = await fetch('data.php');
        if (!response.ok) throw new Error('Server response not OK');
        return await response.json();
    } catch (error) {
        console.warn('Unable to load server data:', error);
        return null;
    }
}

async function loadData() {
    await clearOffersForReset();
    const serverData = await fetchServerData();
    const localReviewCache = JSON.parse(localStorage.getItem('patelKirana_reviews') || '[]');
    reviews = (serverData && Array.isArray(serverData.reviews) && serverData.reviews.length > 0)
        ? serverData.reviews
        : Array.isArray(localReviewCache) ? localReviewCache : [];
    productViews = serverData && serverData.product_views ? serverData.product_views : {};

    if (serverData && Array.isArray(serverData.products) && serverData.products.length > 0) {
        products = serverData.products.map(p => ({
            id: parseInt(p.id, 10),
            name: p.name,
            price: parseFloat(p.price),
            category: p.category || 'General',
            image: p.image || '🛒'
        }));
    } else {
        products = await dbGetAll('products');
        if (products.length === 0) {
            products = [
                { id: 1, name: 'Aashirvaad Atta 5kg', price: 250, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80', category: 'Kirana' },
                { id: 2, name: 'India Gate Basmati Rice 5kg', price: 520, image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80', category: 'Kirana' },
                { id: 3, name: 'Tata Salt 1kg', price: 28, image: 'https://images.unsplash.com/photo-1518110925495-5fe2aabf2a7b?w=600&q=80', category: 'Kirana' },
                { id: 4, name: 'Toor Dal 1kg', price: 165, image: 'https://images.unsplash.com/photo-1585996740317-6f9e8a86c7c4?w=600&q=80', category: 'Pulses' },
                { id: 5, name: 'Fortune Sunflower Oil 1L', price: 180, image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&q=80', category: 'Oil' },
                { id: 6, name: 'Amul Milk 1L', price: 60, image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80', category: 'Dairy' },
                { id: 7, name: 'Coca Cola 1L', price: 45, image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=600&q=80', category: 'Cold Drink' },
                { id: 8, name: 'Lays Classic Chips', price: 20, image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&q=80', category: 'Snacks' },
                { id: 9, name: 'Parle-G Biscuits 800g', price: 75, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80', category: 'Snacks' },
                { id: 10, name: 'Maggi Noodles Pack of 4', price: 60, image: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&q=80', category: 'Instant Food' },
                { id: 11, name: 'Everest Garam Masala 100g', price: 65, image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80', category: 'Spices' },
                { id: 12, name: 'Tata Tea Gold 500g', price: 285, image: 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=600&q=80', category: 'Beverages' },
                { id: 13, name: 'Surf Excel Matic 2kg', price: 390, image: 'https://images.unsplash.com/photo-1585832770485-e68a5dbfad52?w=600&q=80', category: 'Cleaning' },
                { id: 14, name: 'Dove Bath Soap 100g', price: 65, image: 'https://images.unsplash.com/photo-1607006344380-b6775a0824a7?w=600&q=80', category: 'Personal Care' },
                { id: 15, name: 'Rajma 1kg', price: 145, image: 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=600&q=80', category: 'Pulses' },
                { id: 16, name: 'Mustard Oil 1L', price: 190, image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&q=80', category: 'Oil' },
                { id: 17, name: 'Curd 400g', price: 40, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80', category: 'Dairy' },
                { id: 18, name: 'Thums Up 750ml', price: 40, image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=600&q=80', category: 'Cold Drink' },
                { id: 19, name: 'Oreo Biscuits 120g', price: 35, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80', category: 'Snacks' },
                { id: 20, name: 'Poha 1kg', price: 75, image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80', category: 'Breakfast' },
                { id: 21, name: 'Turmeric Powder 200g', price: 55, image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80', category: 'Spices' },
                { id: 22, name: 'Bru Instant Coffee 100g', price: 180, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&q=80', category: 'Beverages' },
                { id: 23, name: 'Harpic Toilet Cleaner 500ml', price: 105, image: 'https://images.unsplash.com/photo-1585832770485-e68a5dbfad52?w=600&q=80', category: 'Cleaning' },
                { id: 24, name: 'Parle Monaco Salted Biscuits 200g', price: 40, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80', category: 'Snacks' },
                { id: 25, name: 'Cadbury Dairy Milk Chocolate 110g', price: 120, image: 'https://images.unsplash.com/photo-1575377427642-087cf684f04d?w=600&q=80', category: 'Chocolates' },
                { id: 26, name: 'Nestle KitKat 4 Finger', price: 50, image: 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=600&q=80', category: 'Chocolates' }
            ];
            for (const product of products) {
                await dbPut('products', product);
            }
        }
    }

    const removedProductNames = new Set(['Fresh Tomatoes 1kg', 'Fresh Potatoes 2kg', 'Banana 1 Dozen']);
    const replacementProducts = [
        { id: 24, name: 'Parle Monaco Salted Biscuits 200g', price: 40, image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80', category: 'Snacks' },
        { id: 25, name: 'Cadbury Dairy Milk Chocolate 110g', price: 120, image: 'https://images.unsplash.com/photo-1575377427642-087cf684f04d?w=600&q=80', category: 'Chocolates' },
        { id: 26, name: 'Nestle KitKat 4 Finger', price: 50, image: 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=600&q=80', category: 'Chocolates' }
    ];
    products = products.filter(product => !removedProductNames.has(product.name));
    for (const replacement of replacementProducts) {
        if (!products.some(product => product.name === replacement.name)) products.push(replacement);
    }

    const localOffers = await dbGetAll('offers');
    if (serverData && Array.isArray(serverData.offers) && serverData.offers.length > 0) {
        offers = serverData.offers.map(o => ({
            id: parseInt(o.id, 10),
            title: o.title,
            discount: parseInt(o.discount, 10),
            expiry: Number(o.expiry),
            category: o.category || 'All'
        }));
    } else {
        offers = localOffers;
    }

    await removeExpiredOffers();
    scheduleOfferExpiryCleanup();
    
    orders = await dbGetAll('orders');
    
    // Load cart for current user
    if (currentUser && currentUser !== 'admin') {
        cart = await dbGetAll('cart');
        cart = cart.filter(item => item.userId === currentUser);
    } else {
        cart = [];
    }
    renderLandingOffers();
    renderPublicReviews();
}

async function clearOffersForReset() {
    const resetKey = 'patelKiranaOffersResetV1';
    if (localStorage.getItem(resetKey)) return;

    const storedOffers = await dbGetAll('offers');
    for (const offer of storedOffers) {
        await dbDelete('offers', offer.id);
    }
    localStorage.setItem(resetKey, '1');
}

async function removeExpiredOffers() {
    const storedOffers = await dbGetAll('offers');
    const activeOffers = offers.filter(isActiveOffer);
    const expiredOffers = storedOffers.filter(offer => !isActiveOffer(offer));

    offers = activeOffers;
    for (const offer of expiredOffers) {
        await dbDelete('offers', offer.id);
    }
}

function scheduleOfferExpiryCleanup() {
    if (offerExpiryTimer) clearTimeout(offerExpiryTimer);

    const nextExpiry = offers
        .map(offer => Number(offer.expiry))
        .filter(expiry => Number.isFinite(expiry) && expiry > Date.now())
        .sort((first, second) => first - second)[0];

    if (!nextExpiry) return;

    offerExpiryTimer = setTimeout(async () => {
        await removeExpiredOffers();
        renderLandingOffers();
        renderUserOffers();
        renderShopOfferBanner();
        renderAdminOffers();
        updateAdminStats();
        scheduleOfferExpiryCleanup();
    }, Math.max(nextExpiry - Date.now(), 1000));
}

async function saveData() {
    // Save all data to local database as a fallback
    for (const product of products) {
        await dbPut('products', product);
    }
    for (const order of orders) {
        await dbPut('orders', order);
    }
    for (const offer of offers) {
        await dbPut('offers', offer);
    }
    
    // Save cart items with user ID
    if (currentUser && currentUser !== 'admin') {
        const allCartItems = await dbGetAll('cart');
        for (const item of allCartItems) {
            if (item.userId === currentUser) {
                await dbDelete('cart', item.id);
            }
        }
        for (const item of cart) {
            item.userId = currentUser;
            await dbPut('cart', item);
        }
    }
}

async function postProductToServer(productData) {
    try {
        const action = productData.id ? 'update_product' : 'add_product';
        const response = await fetch(PRODUCT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...productData })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Server error');
        }
        const data = await response.json();
        return data.product || null;
    } catch (error) {
        console.warn('Product save failed:', error);
        return null;
    }
}

async function parseJSONResponse(response) {
    const text = await response.text();
    if (!text) {
        return {};
    }
    try {
        return JSON.parse(text);
    } catch (error) {
        console.error('Invalid JSON response from server:', text);
        throw new Error(`Server returned invalid response: ${text}`);
    }
}

async function registerUser(userData) {
    try {
        const response = await fetch(USER_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'register', ...userData })
        });
        const data = await parseJSONResponse(response);
        if (!response.ok) {
            throw new Error(data.error || `${response.status} ${response.statusText}`);
        }
        return data.user;
    } catch (error) {
        console.warn('Registration error, falling back to local user storage:', error);

        const existing = await dbGet('users', userData.mobile);
        if (existing) {
            throw new Error('Mobile number already registered locally');
        }

        const user = {
            id: Date.now(),
            name: userData.name,
            mobile: userData.mobile,
            address: userData.address,
            password: userData.password
        };

        await dbPut('users', user);
        return user;
    }
}

async function loginUser(mobile, password) {
    try {
        const response = await fetch(USER_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', mobile, password })
        });
        const data = await parseJSONResponse(response);
        if (!response.ok) {
            throw new Error(data.error || `${response.status} ${response.statusText}`);
        }
        return data.user;
    } catch (error) {
        console.warn('Login error, falling back to local user storage:', error);

        if (mobile === '8115910227' && password === 'admin') {
            return {
                mobile: '8115910227',
                name: 'Admin',
                isAdmin: true
            };
        }

        const user = await dbGet('users', mobile);
        if (!user) {
            throw new Error('User not found locally');
        }
        if (user.password !== password) {
            throw new Error('Invalid password');
        }
        return user;
    }
}

async function getUserFromServer(mobile) {
    try {
        const response = await fetch(`${USER_API}?mobile=${encodeURIComponent(mobile)}`);
        const data = await parseJSONResponse(response);
        if (!response.ok) {
            throw new Error(data.error || `${response.status} ${response.statusText}`);
        }
        return data.user;
    } catch (error) {
        console.warn('Failed to load user from server, using local data:', error);
        return await dbGet('users', mobile);
    }
}

function renderLandingOffers() {
    const container = document.getElementById('landingOffers');
    if (!container) return;
    const activeOffers = offers.filter(isActiveOffer);
    if (activeOffers.length === 0) {
        container.innerHTML = '<div class="landing-offers-empty">No special offers available right now. Check back soon!</div>';
        return;
    }
    container.innerHTML = activeOffers.map(offer => `
        <div class="landing-offer-card">
            <h3>${offer.title}</h3>
            <p><strong>${offer.discount}% OFF</strong> until ${new Date(offer.expiry).toLocaleDateString('en-IN')}</p>
        </div>
    `).join('');
}

function renderPublicReviews() {
    const container = document.getElementById('publicReviewsRoot');
    if (!container || !window.React || !window.ReactDOM) return;

    const h = window.React.createElement;
    const average = reviews.length
        ? (reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length).toFixed(1)
        : '0.0';
    const stars = rating => '★'.repeat(Number(rating)) + '☆'.repeat(5 - Number(rating));
    const cards = reviews.length ? reviews.map(review => h('article', { className: 'public-review-card', key: review.id },
        h('div', { className: 'review-card-top' },
            h('div', { className: 'review-avatar' }, (review.name || 'C').charAt(0).toUpperCase()),
            h('div', null, h('strong', null, review.name || 'Customer'), h('div', { className: 'review-stars' }, stars(review.rating)), review.product_name ? h('small', { className: 'review-product-name' }, `Product: ${review.product_name}`) : h('small', { className: 'review-product-name' }, 'Store review'))
        ),
        review.review ? h('p', { className: 'review-copy' }, `“${review.review}”`) : null,
        review.review_image ? h('img', { className: 'public-review-image', src: review.review_image, alt: `Review by ${review.name || 'customer'}` }) : null
    )) : h('div', { className: 'public-reviews-empty' }, 'Abhi tak koi review nahi hai. Aapka review sabse pehla ho sakta hai!');

    const component = h('div', { className: 'public-reviews-shell' },
        h('div', { className: 'public-reviews-heading' },
            h('div', null, h('span', { className: 'eyebrow' }, 'Customer reviews'), h('h2', null, 'Customer Reviews'), h('p', null, 'Shop aur products ke asli customer reviews.')),
            h('div', { className: 'review-average' }, h('strong', null, average), h('span', null, '★'), h('small', null, `${reviews.length} reviews`))
        ),
        h('div', { className: 'public-reviews-grid' }, cards)
    );

    if (!container._reactRoot) container._reactRoot = window.ReactDOM.createRoot(container);
    container._reactRoot.render(component);
}

function setupEventListeners() {
    // Remove form submission listeners since we're using button clicks now
    const forgetPasswordForm = document.getElementById('forgetPasswordForm');
    if (forgetPasswordForm) {
        forgetPasswordForm.addEventListener('submit', handleForgetPassword);
    }
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            showUserSection(this.dataset.section, this);
        });
    });
    document.querySelectorAll('.payment-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            selectedPayment = this.dataset.method;
            document.getElementById('upiOptions').classList.toggle('hidden', selectedPayment !== 'upi');
        });
    });
    document.querySelectorAll('.upi-app').forEach(app => {
        app.addEventListener('click', function() {
            document.querySelectorAll('.upi-app').forEach(a => a.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
    document.querySelectorAll('.rating-stars .star').forEach(star => {
        star.addEventListener('click', function() {
            setUserRating(parseInt(this.dataset.value, 10));
        });
    });
    document.getElementById('productForm').addEventListener('submit', handleProductForm);
    document.getElementById('offerForm').addEventListener('submit', handleOfferForm);
    document.getElementById('profileUpload').addEventListener('change', handleProfileUpload);
    document.getElementById('productImageFile').addEventListener('change', handleProductImageUpload);
    document.getElementById('ratingImageFile').addEventListener('change', handleRatingImageUpload);
    const voiceButton = document.getElementById('voiceSearchButton');
    if (voiceButton) voiceButton.addEventListener('click', startVoiceSearch);
    const partnerLoginForm = document.getElementById('partnerLoginForm');
    if (partnerLoginForm) partnerLoginForm.addEventListener('submit', handlePartnerLogin);
    const partnerRegisterForm = document.getElementById('partnerRegisterForm');
    if (partnerRegisterForm) partnerRegisterForm.addEventListener('submit', handlePartnerRegister);
    const onlineToggle = document.getElementById('partnerOnlineToggle');
    if (onlineToggle) onlineToggle.addEventListener('change', updatePartnerOnlineStatus);
}

function checkCurrentUser() {
    currentUser = localStorage.getItem('currentUser');
    if (currentUser === 'admin') {
        showPage('adminPage');
        loadAdminDashboard();
    } else if (currentUser === 'partner' && partnerToken) {
        showPage('partnerPage');
        loadPartnerDashboard();
    } else if (currentUser) {
        showPage('userPage');
        loadUserDashboard();
    }
}

// Page Navigation
function showPage(pageId) {
    console.log('Showing page:', pageId);
    document.querySelectorAll('.page-container').forEach(page => page.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
}

function navigateToLogin() {
    if (typeof showPage === 'function') {
        showPage('loginPage');
    } else {
        console.error('showPage function not found');
    }
}

function startShopping() {
    if (localStorage.getItem('currentUser')) {
        if (typeof showPage === 'function') {
            showPage('userPage');
            if (typeof showUserSection === 'function') {
                showUserSection('shop');
            }
        }
        return;
    }
    navigateToLogin();
}

function viewProducts() {
    if (localStorage.getItem('currentUser')) {
        if (typeof showPage === 'function') {
            showPage('userPage');
            if (typeof showUserSection === 'function') {
                showUserSection('shop');
            }
        }
        return;
    }
    navigateToLogin();
}

// Auth Tab Switching
function showAuthTab(tab) {
    // Hide/Show tabs
    document.getElementById('loginFormTab').classList.toggle('hidden', tab !== 'login');
    document.getElementById('registerFormTab').classList.toggle('hidden', tab !== 'register');
    document.getElementById('forgetPasswordContainer').classList.add('hidden');
    
    // Update buttons styling - commented out as buttons don't have ids
    // document.getElementById('loginTabBtn').style.background = tab === 'login' ? '#667eea' : '#ddd';
    // document.getElementById('loginTabBtn').style.color = tab === 'login' ? 'white' : '#333';
    // document.getElementById('registerTabBtn').style.background = tab === 'register' ? '#667eea' : '#ddd';
    // document.getElementById('registerTabBtn').style.color = tab === 'register' ? 'white' : '#333';
}

// Handle Existing User Login
async function handleExistingUserLogin() {
    const mobile = document.getElementById('loginMobile').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!mobile || !password) {
        showToast('❌ Please fill in all fields!');
        return;
    }

    try {
        const user = await loginUser(mobile, password);

        if (user.isAdmin) {
            // Admin login
            currentUser = 'admin';
            localStorage.setItem('currentUser', 'admin');
            document.getElementById('loginForm').reset();
            showPage('adminPage');
            loadAdminDashboard();
            showToast('⬜ Admin login successful!');
            return;
        }

        // Regular user login
        currentUser = mobile;
        localStorage.setItem('currentUser', mobile);

        // Save user data locally for offline access
        await dbPut('users', user);

        // Load user's cart
        await loadCartForUser();

        document.getElementById('loginForm').reset();
        showPage('userPage');
        loadUserDashboard();
        showToast('✅ Login successful!');

    } catch (error) {
        showToast('❌ ' + error.message);
    }
}

// Handle New User Registration
async function handleNewUserRegister() {
    const name = document.getElementById('registerName').value.trim();
    const mobile = document.getElementById('registerMobile').value.trim();
    const address = document.getElementById('registerAddress').value.trim();
    const password = document.getElementById('registerPassword').value;

    if (!name || !mobile || !address || !password) {
        showToast('❌ Please fill in all fields!');
        return;
    }

    if (password.length < 4) {
        showToast('❌ Password must be at least 4 characters!');
        return;
    }

    try {
        const userData = { name, mobile, address, password };
        const user = await registerUser(userData);

        // Save user data locally for offline access
        await dbPut('users', user);

        // Auto-login after registration
        currentUser = mobile;
        localStorage.setItem('currentUser', mobile);

        // Clear form
        document.getElementById('registerForm').reset();

        showPage('userPage');
        loadUserDashboard();
        showToast('✅ Registration successful! Welcome!');

    } catch (error) {
        showToast('❌ ' + error.message);
    }
}

// Show Forget Password Form
function showForgetPasswordForm() {
    document.getElementById('loginFormTab').classList.add('hidden');
    document.getElementById('registerFormTab').classList.add('hidden');
    document.getElementById('forgetPasswordContainer').classList.remove('hidden');
}

// Back to Login Form
function backToLoginForm() {
    document.getElementById('forgetPasswordContainer').classList.add('hidden');
    document.getElementById('loginFormTab').classList.remove('hidden');
    document.getElementById('registerFormTab').classList.add('hidden');
}

// Login - Old handleLogin (kept for compatibility)
function handleLogin(e) {
    e.preventDefault();
    // This function now calls the appropriate handler
}

function handleForgetPassword(e) {
    e.preventDefault();
    const mobile = document.getElementById('resetMobile').value;
    const newPassword = document.getElementById('newPassword').value;
    
    (async () => {
        const user = await dbGet('users', mobile);
        
        if (!user) {
            showToast('❌ Mobile number not registered!');
            return;
        }
        
        // Reset password
        user.password = newPassword;
        await dbPut('users', user);
        showToast('✅ Password reset successful!');
        backToLoginForm();
    })();
}

// Load user's cart from database
async function loadCartForUser() {
    if (!currentUser || currentUser === 'admin') {
        cart = [];
        return;
    }
    const allCartItems = await dbGetAll('cart');
    cart = allCartItems.filter(item => item.userId === currentUser);
    updateCartCount();
}

// Logout
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    cart = [];
    showPage('landingPage');
    showToast('👋 Logged out successfully!');
}

// Show Admin Login
function showAdminLogin() {
    // Pre-fill admin credentials in login form
    
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
    showAuthTab('login');
    
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function setUserRating(value) {
    selectedRating = value;
    document.querySelectorAll('.rating-stars .star').forEach(star => {
        const starValue = parseInt(star.dataset.value, 10);
        star.classList.toggle('active', starValue <= value);
    });
}

function handleRatingImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        e.target.value = '';
        showToast('❌ Review image must be smaller than 2 MB.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const preview = document.getElementById('ratingImagePreview');
        preview.src = event.target.result;
        preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function getLocalReviewCache() {
    try {
        return JSON.parse(localStorage.getItem('patelKirana_reviews') || '[]');
    } catch (error) {
        return [];
    }
}

async function saveReviewLocally({ user, rating, review, reviewImage, productId = null }) {
    const existingReviews = getLocalReviewCache();
    const name = user && user.name ? user.name : 'Customer';
    const reviewEntry = {
        id: Date.now() + Math.random(),
        user_id: user && user.id ? user.id : (currentUser || 'guest'),
        product_id: productId ?? null,
        rating,
        review,
        review_image: reviewImage || '',
        name,
        created_at: new Date().toISOString()
    };

    const existingIndex = existingReviews.findIndex(entry => {
        const sameUser = String(entry.user_id ?? '') === String(reviewEntry.user_id);
        const sameProduct = Number(entry.product_id ?? 0) === Number(reviewEntry.product_id ?? 0);
        return sameUser && sameProduct;
    });

    if (existingIndex >= 0) {
        existingReviews[existingIndex] = { ...existingReviews[existingIndex], ...reviewEntry };
    } else {
        existingReviews.unshift(reviewEntry);
    }

    localStorage.setItem('patelKirana_reviews', JSON.stringify(existingReviews));
    reviews = existingReviews;
    return reviewEntry;
}

async function submitRating() {
    if (!currentUser || currentUser === 'admin') {
        showToast('❌ Please login as a customer first.');
        return;
    }
    if (selectedRating === 0) {
        showToast('❌ Please select a rating.');
        return;
    }
    const localUser = await dbGet('users', currentUser);
    const user = localUser || await getUserFromServer(currentUser) || {
        mobile: currentUser
    };
    const ratingValue = selectedRating;
    const reviewValue = document.getElementById('ratingReview').value.trim();
    const reviewImage = document.getElementById('ratingImagePreview');
    const reviewImageValue = reviewImage && !reviewImage.classList.contains('hidden') ? reviewImage.src : (user.reviewImage || '');

    try {
        const response = await fetch(USER_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'submit_rating',
                mobile: currentUser,
                rating: ratingValue,
                review: reviewValue,
                review_image: reviewImageValue
            })
        });
        const result = await parseJSONResponse(response);
        if (!response.ok) throw new Error(result.error || 'Rating save failed');

        user.rating = ratingValue;
        user.review = reviewValue;
        user.reviewImage = reviewImageValue;
        await dbPut('users', user);

        const serverData = await fetchServerData();
        reviews = serverData && Array.isArray(serverData.reviews) ? serverData.reviews : reviews;
        renderPublicReviews();
        showToast('⭐ Thank you! Your rating has been submitted.');
    } catch (error) {
        console.error('Review server save failed:', error);
        user.rating = ratingValue;
        user.review = reviewValue;
        user.reviewImage = reviewImageValue;
        await dbPut('users', user);
        await saveReviewLocally({ user, rating: ratingValue, review: reviewValue, reviewImage: reviewImageValue, productId: null });
        renderPublicReviews();
        showToast('⭐ Review locally saved. Server connection issue ke wajah se submission pending hai.');
        return;
    }
    loadUserRating();
}

async function loadUserRating() {
    if (!currentUser || currentUser === 'admin') return;
    const allUsers = await dbGetAll('users');
    const ratedUsers = allUsers.filter(u => u.rating && u.rating > 0);
    const average = ratedUsers.length > 0 ? (ratedUsers.reduce((sum, u) => sum + u.rating, 0) / ratedUsers.length).toFixed(1) : '0.0';
    const user = await dbGet('users', currentUser);
    selectedRating = user && user.rating ? user.rating : 0;
    setUserRating(selectedRating);
    document.getElementById('ratingReview').value = user && user.review ? user.review : '';
    const reviewImage = document.getElementById('ratingImagePreview');
    if (reviewImage) {
        if (user && user.reviewImage) {
            reviewImage.src = user.reviewImage;
            reviewImage.classList.remove('hidden');
        } else {
            reviewImage.removeAttribute('src');
            reviewImage.classList.add('hidden');
        }
    }
    document.getElementById('averageRating').textContent = average;
    document.getElementById('ratingCount').textContent = ratedUsers.length;
    if (user && user.rating) {
        document.getElementById('ratingSummary').textContent = `Your current rating: ${user.rating} ⭐ — Thank you!`;
    }
}

// User Dashboard
function loadUserDashboard() {
    loadProfile();
    initLocation();
    loadCartForUser();
    updateCartCount();
    setupProductSearch();
    loadCustomerState();
    renderProducts();
    renderCategories();
    renderWishlist();
    renderAddresses();
    renderNotifications();
    renderUserOffers();
    renderShopOfferBanner();
    showActiveOfferBadge();
    loadUserRating();
    renderUserOrders();
    renderCustomerHome();
    loadCustomerSettings();
}

function showUserSection(sectionId, navItem = null) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    if (navItem) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        navItem.classList.add('active');
    }
    
    if (sectionId === 'shop') renderProducts();
    if (sectionId === 'categories') renderCategoriesPage();
    if (sectionId === 'home') renderCustomerHome();
    if (sectionId === 'search') document.getElementById('customerSearchInput')?.focus();
    if (sectionId === 'settings') loadCustomerSettings();
    if (sectionId === 'cart') updateCartDisplay();
    if (sectionId === 'wishlist') renderWishlist();
    if (sectionId === 'offers') renderUserOffers();
    if (sectionId === 'orders') renderUserOrders();
    if (sectionId === 'notifications') renderNotifications();
    if (sectionId === 'profile') renderAddresses();
}

function loadProfile() {
    (async () => {
        if (currentUser && currentUser !== 'admin') {
            // Try to load from server first
            let user = await getUserFromServer(currentUser);

            // If server fails, load from local storage
            if (!user) {
                user = await dbGet('users', currentUser);
            }

            if (user) {
                document.getElementById('userName').value = user.name || '';
                document.getElementById('userPhone').value = user.mobile || '';
                document.getElementById('userAddress').value = user.address || '';
                document.getElementById('profileImg').src = user.image || 'https://via.placeholder.com/150?text=User';
                const homeWelcome = document.getElementById('homeWelcome');
                if (homeWelcome) homeWelcome.textContent = `Welcome, ${user.name || 'Customer'}`;
                updateHomeDeliveryAddress(user.address || 'Add your delivery address');
            }
        }
    })();
}

async function saveProfile() {
    if (currentUser && currentUser !== 'admin') {
        const name = document.getElementById('userName').value;
        const address = document.getElementById('userAddress').value;

        try {
            // Try to save to server
            const response = await fetch(USER_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_profile',
                    mobile: currentUser,
                    name,
                    address
                })
            });

            if (response.ok) {
                // Update local storage
                const user = await dbGet('users', currentUser);
                if (user) {
                    user.name = name;
                    user.address = address;
                    await dbPut('users', user);
                }
                showToast('✅ Profile saved to server!');
            } else {
                throw new Error('Server save failed');
            }
        } catch (error) {
            // Save locally if server fails
            const user = await dbGet('users', currentUser);
            if (user) {
                user.name = name;
                user.address = address;
                await dbPut('users', user);
            }
            showToast('⚠️ Saved locally. Server unavailable.');
        }
    }
}

function handleProfileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            document.getElementById('profileImg').src = e.target.result;
            if (currentUser && currentUser !== 'admin') {
                const user = await dbGet('users', currentUser);
                if (user) {
                    user.image = e.target.result;
                    await dbPut('users', user);
                }
            }
        };
        reader.readAsDataURL(file);
    }
}

function handleProductImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('productImage').value = e.target.result;
            document.getElementById('previewImg').src = e.target.result;
            document.getElementById('imagePreview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function renderProducts() {
    const container = document.getElementById('productsGrid');
    const activeOffer = getActiveOffer();
    renderShopOfferBanner();
    const searchInput = document.getElementById('productSearch');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const displayProducts = products.filter(product => {
        const searchableText = `${product.name} ${product.category}`.toLowerCase();
        const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
        return matchesCategory && (!searchTerm || searchableText.includes(searchTerm));
    });
    const resultCount = document.getElementById('productResultCount');
    const clearSearch = document.getElementById('clearProductSearch');
    if (resultCount) {
        resultCount.textContent = searchTerm ? `${displayProducts.length} item${displayProducts.length === 1 ? '' : 's'} found` : `${products.length} items`;
    }
    if (clearSearch) clearSearch.classList.toggle('hidden', !searchTerm);

    if (displayProducts.length === 0) {
        container.innerHTML = '<div class="empty-product-search"><i class="fas fa-search"></i><h3>Product nahi mila</h3><p>Naam ya category dobara search karke dekhiye.</p></div>';
        return;
    }
    
    container.innerHTML = displayProducts.map(product => {
        const offerApplies = activeOffer && (activeOffer.category === 'All' || activeOffer.category === product.category);
        const offerPrice = offerApplies
            ? product.price * (1 - activeOffer.discount / 100)
            : product.price;
        const productReviews = reviews.filter(review => Number(review.product_id) === Number(product.id));
        const productAverage = productReviews.length
            ? (productReviews.reduce((sum, review) => sum + Number(review.rating), 0) / productReviews.length).toFixed(1)
            : '0.0';
        const viewCount = Number(productViews[String(product.id)] || 0);
        return `
            <div class="product-card">
                <div class="product-image">
                    ${product.image.startsWith('data:') || product.image.startsWith('http') ? 
                        `<img src="${product.image}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;border-radius:15px;">` : 
                        product.image}
                </div>
                <div class="product-info">
                    <h3>${product.name}</h3>
                    ${offerApplies ? `
                        <div class="offer-price">
                            <span class="price">₹${offerPrice.toFixed(0)}</span>
                            <span class="original-price">₹${product.price}</span>
                            <span class="discount-badge">${activeOffer.discount}% OFF</span>
                        </div>
                    ` : `<div class="price">₹${product.price}</div>`}
                    <p><small>Wholesale Rate | ${product.category}</small></p>
                    <div class="product-actions">
                        <select id="variant-${product.id}" class="variant-select" aria-label="Choose size or quantity" onchange="updateProductVariantPrice(${product.id}, this.value)">
                            ${getProductVariants(product).map(variant => `<option value="${variant}">${variant}</option>`).join('')}
                        </select>
                        <button onclick="addToCart(${product.id}, document.getElementById('variant-${product.id}').value)" class="btn-primary">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                        </button>
                        <button onclick="toggleWishlist(${product.id})" class="icon-button wishlist-button ${wishlist.some(item => item.id === product.id) ? 'is-saved' : ''}" aria-label="Add to wishlist" title="Wishlist"><i class="fas fa-heart"></i></button>
                    </div>
                    <div class="product-review-box">
                        <div class="product-review-heading">
                            <strong>Product review</strong>
                            <span>${productAverage} ★ (${productReviews.length} ratings)</span>
                        </div>
                        <p class="product-view-count"><i class="fas fa-eye"></i> ${viewCount} people viewed this product</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    trackProductViews(displayProducts);
}

function getProductVariants(product) {
    const text = `${product.name} ${product.category}`.toLowerCase();
    if (text.includes('drink') || text.includes('cola') || text.includes('pepsi') || text.includes('juice') || text.includes('beverage') || text.includes('oil') || text.includes('milk') || text.includes('shampoo') || text.includes('liquid')) {
        return ['250ml', '500ml', '1L', '2L'];
    }
    return ['250g', '500g', '1kg', '2kg', '5kg'];
}

function getVariantPrice(product, variant) {
    const selected = String(variant).match(/([0-9.]+)\s*(kg|g|l|ml)/i);
    const base = String(product.name).match(/([0-9.]+)\s*(kg|g|l|ml)/i);
    if (!selected || !base || selected[2].toLowerCase() !== base[2].toLowerCase()) return Number(product.price);
    const toBaseUnits = match => ['kg', 'l'].includes(match[2].toLowerCase()) ? Number(match[1]) * 1000 : Number(match[1]);
    return Number((Number(product.price) * toBaseUnits(selected) / toBaseUnits(base)).toFixed(2));
}

function updateProductVariantPrice(productId, variant) {
    const product = products.find(item => item.id === productId);
    const select = document.getElementById(`variant-${productId}`);
    const price = select?.closest('.product-info')?.querySelector('.price');
    if (product && price) price.textContent = `₹${getVariantPrice(product, variant).toFixed(0)}`;
}

function renderCustomerHome() {
    const categoryContainer = document.getElementById('homeCategories');
    if (categoryContainer) {
        const categories = [...new Set(products.map(product => product.category).filter(Boolean))].slice(0, 8);
        categoryContainer.innerHTML = categories.map(category => `<button type="button" class="home-category-card" onclick="selectCategory('${category.replace(/'/g, "\\'")}'); showUserSection('shop')"><i class="fas fa-box"></i><span>${category}</span></button>`).join('');
    }
    const offersContainer = document.getElementById('homeOffers');
    if (offersContainer) {
        const activeOffers = offers.filter(isActiveOffer).slice(0, 2);
        offersContainer.innerHTML = activeOffers.length ? activeOffers.map(offer => `<button type="button" onclick="showUserSection('offers')"><i class="fas fa-gift"></i><span><strong>${offer.title}</strong><small>${offer.discount}% OFF today</small></span><i class="fas fa-chevron-right"></i></button>`).join('') : '<div class="home-offer-empty">Offers will appear here.</div>';
    }
    const viewedIds = JSON.parse(sessionStorage.getItem('patelKiranaViewedProducts') || '{}');
    const recentlyViewed = Object.keys(viewedIds).map(id => products.find(product => String(product.id) === String(id))).filter(Boolean).slice(-6).reverse();
    const orderedIds = new Set(orders.filter(order => order.userId === currentUser).flatMap(order => (order.items || []).map(item => item.id)));
    const buyAgain = products.filter(product => orderedIds.has(product.id)).slice(0, 6);
    const preferredCategory = products.find(product => wishlist.some(item => item.id === product.id))?.category;
    const recommended = products.filter(product => preferredCategory ? product.category === preferredCategory : product.category === 'Kirana').slice(0, 6);
    const newProducts = products.slice(-6).reverse();
    renderHomeShelf('recommendedShelf', recommended);
    renderHomeShelf('newProductShelf', newProducts);
    renderHomeShelf('buyAgainShelf', buyAgain);
    renderHomeShelf('recentlyViewedShelf', recentlyViewed);
}

function renderHomeShelf(containerId, shelfProducts) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const hasRenderableImage = (image) => typeof image === 'string' && image.trim() !== '' && (image.startsWith('http') || image.startsWith('https') || image.startsWith('data:') || image.startsWith('/'));
    container.innerHTML = shelfProducts.length ? shelfProducts.map(product => `<article class="home-product-card"><div class="home-product-image">${hasRenderableImage(product.image) ? `<img src="${product.image}" alt="${product.name}">` : product.image || '🛒'}</div><strong>${product.name}</strong><span>₹${Number(product.price).toFixed(0)}</span><button type="button" onclick="addToCart(${product.id}, 'Standard')" class="btn-primary"><i class="fas fa-cart-plus"></i></button></article>`).join('') : '<p class="muted-text shelf-empty">Nothing here yet.</p>';
}

function setupProductSearch() {
    const searchInput = document.getElementById('productSearch');
    const clearSearch = document.getElementById('clearProductSearch');
    if (!searchInput || searchInput.dataset.ready === 'true') return;

    searchInput.dataset.ready = 'true';
    searchInput.addEventListener('input', renderProducts);
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.focus();
        renderProducts();
    });
}

function getViewerKey() {
    let viewerKey = localStorage.getItem('patelKiranaViewerKey');
    if (!viewerKey) {
        viewerKey = `viewer-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
        localStorage.setItem('patelKiranaViewerKey', viewerKey);
    }
    return viewerKey;
}

async function trackProductViews(displayProducts) {
    const trackedViews = JSON.parse(sessionStorage.getItem('patelKiranaViewedProducts') || '{}');
    const viewerKey = getViewerKey();
    for (const product of displayProducts) {
        if (trackedViews[product.id]) continue;
        trackedViews[product.id] = true;
        try {
            await fetch(USER_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'view_product', product_id: product.id, viewer_key: viewerKey })
            });
        } catch (error) {
            console.warn('Product view tracking failed:', error);
        }
    }
    sessionStorage.setItem('patelKiranaViewedProducts', JSON.stringify(trackedViews));
    if (document.getElementById('home')) renderCustomerHome();
}

const productRatings = {};

function selectProductRating(productId, value, reviewKey = productId) {
    productRatings[reviewKey] = value;
    document.querySelectorAll(`#productStars-${reviewKey} .product-star`).forEach(star => {
        star.classList.toggle('active', Number(star.dataset.value) <= value);
    });
}

function handleProductReviewImageUpload(event, productId, reviewKey = productId) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        event.target.value = '';
        showToast('❌ Product review image 2 MB se chhoti honi chahiye.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(loadEvent) {
        const preview = document.getElementById(`productReviewPreview-${reviewKey}`);
        preview.src = loadEvent.target.result;
        preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

async function submitProductReview(productId, reviewKey = productId) {
    if (!currentUser || currentUser === 'admin') {
        showToast('❌ Product review dene ke liye customer login karein.');
        return;
    }
    const rating = productRatings[reviewKey] || 0;
    if (!rating) {
        showToast('❌ Product ke liye rating select karein.');
        return;
    }

    const reviewField = document.getElementById(`productReview-${reviewKey}`);
    const imagePreview = document.getElementById(`productReviewPreview-${reviewKey}`);
    const review = reviewField.value.trim();
    const reviewImage = imagePreview && !imagePreview.classList.contains('hidden') ? imagePreview.src : '';

    try {
        const response = await fetch(USER_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'submit_rating',
                mobile: currentUser,
                product_id: productId,
                rating,
                review,
                review_image: reviewImage
            })
        });
        const result = await parseJSONResponse(response);
        if (!response.ok) throw new Error(result.error || 'Review save failed');

        const serverData = await fetchServerData();
        reviews = serverData && Array.isArray(serverData.reviews) ? serverData.reviews : reviews;
        renderPublicReviews();
        renderProducts();
        renderUserOrders();
        showToast('⭐ Product review save ho gaya.');
    } catch (error) {
        const user = await dbGet('users', currentUser) || { mobile: currentUser, name: 'Customer' };
        await saveReviewLocally({ user, rating, review, reviewImage, productId });
        renderPublicReviews();
        renderProducts();
        renderUserOrders();
        showToast('⭐ Product review locally saved. Server problem ke wajah se sync pending hai.');
    }
}

function renderShopOfferBanner() {
    const banner = document.getElementById('shopOffersBanner');
    if (!banner) return;

    const activeOffer = getActiveOffer();
    if (!activeOffer) {
        banner.innerHTML = '';
        return;
    }

    const categoryText = activeOffer.category === 'All' ? 'all products' : `${activeOffer.category} items`;
    banner.innerHTML = `
        <div class="banner-card">
            <div class="banner-content">
                <h3>${activeOffer.title}</h3>
                <p>Get ${activeOffer.discount}% off on ${categoryText}. Valid until ${new Date(activeOffer.expiry).toLocaleString()}.</p>
            </div>
            <button onclick="showUserSection('shop')" class="btn-primary banner-action">Shop Now</button>
        </div>
    `;
}

function addToCart(productId, variant = 'Standard') {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const existing = cart.find(item => item.id === productId && item.variant === variant);
    const activeOffer = getActiveOffer();
    const selectedPrice = getVariantPrice(product, variant);
    
    if (existing) {
        existing.quantity += 1;
    } else {
        const cartItem = { ...product, price: selectedPrice, quantity: 1, variant };
        if (activeOffer && activeOffer.category === product.category) {
            cartItem.offerPrice = selectedPrice * (1 - activeOffer.discount / 100);
            cartItem.originalPrice = selectedPrice;
            cartItem.discount = activeOffer.discount;
        }
        cart.push(cartItem);
    }
    
    saveData();
    updateCartCount();
    updateCartDisplay();
    showToast(`✅ ${product.name} (${variant}) added to cart!`);
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = count;
}

function updateCartDisplay() {
    const container = document.getElementById('cartItems');
    if (cart.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:3rem;color:#666;"><i class="fas fa-shopping-cart" style="font-size:4rem;margin-bottom:1rem;"></i><h3>Your cart is empty</h3></div>';
        return;
    }
    
    const { subtotal, discount, deliveryCharge, total } = calculateCartTotals();
    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-product-main">
                <div class="cart-product-image">${item.image && item.image.startsWith('http') ? `<img src="${item.image}" alt="${item.name}">` : item.image || '🛒'}</div>
                <div>
                <h4>${item.name} <small>(${item.variant || 'Standard'})</small></h4>
                <div style="margin:0.5rem 0;">
                    ${item.discount ? `
                        <span style="text-decoration:line-through;color:#999;">₹${item.originalPrice}</span>
                        <span style="color:#28a745;font-weight:bold;margin-left:0.5rem;">₹${(item.offerPrice * item.quantity).toFixed(0)}</span>
                        <span style="background:#ff4757;color:white;padding:2px 8px;border-radius:12px;font-size:12px;margin-left:0.5rem;">${item.discount}% OFF</span>
                    ` : `<span style="font-weight:bold;">₹${(item.price * item.quantity).toFixed(0)}</span>`}
                </div>
                <small>MRP ₹${item.price || item.offerPrice} × ${item.quantity}</small>
                </div>
            </div>
            <div style="text-align:right;">
                <button onclick="updateCartQuantity(${item.id}, -1)" class="btn-edit" style="margin-bottom:0.5rem;">−</button>
                <div style="font-weight:bold;font-size:1.2rem;margin:0.5rem 0;">${item.quantity}</div>
                <button onclick="updateCartQuantity(${item.id}, 1)" class="btn-edit" style="margin-bottom:0.5rem;">+</button>
                <br>
                <button onclick="removeFromCart(${item.id})" style="background:#ff4757;width:100%;padding:0.8rem;">Remove</button>
            </div>
        </div>
    `).join('');
    
    document.getElementById('cartSubtotal').textContent = subtotal.toFixed(0);
    document.getElementById('cartDiscount').textContent = discount.toFixed(0);
    document.getElementById('cartTotal').textContent = total.toFixed(0);
    const summary = document.querySelector('.cart-total');
    if (summary) {
        let delivery = document.getElementById('cartDeliveryCharge');
        if (!delivery) { delivery = document.createElement('h3'); delivery.id = 'cartDeliveryCharge'; summary.insertBefore(delivery, summary.lastElementChild); }
        delivery.textContent = deliveryCharge ? `Delivery charge: ₹${deliveryCharge.toFixed(0)}` : 'Delivery charge: FREE';
    }
}

function calculateCartTotals() {
    let subtotal = 0;
    let discount = 0;
    
    cart.forEach(item => {
        if (item.discount) {
            subtotal += item.originalPrice * item.quantity;
            discount += (item.originalPrice - item.offerPrice) * item.quantity;
        } else {
            subtotal += item.price * item.quantity;
        }
    });
    
    const couponDiscount = appliedCoupon ? Math.min(100, subtotal * appliedCoupon.percent / 100) : 0;
    const deliveryCharge = subtotal - discount - couponDiscount >= 500 ? 0 : 40;
    return {
        subtotal,
        discount: discount + couponDiscount,
        couponDiscount,
        deliveryCharge,
        total: Math.max(0, subtotal - discount - couponDiscount) + deliveryCharge
    };
}

function applyCoupon() {
    const input = document.getElementById('couponCode');
    const message = document.getElementById('couponMessage');
    const code = input ? input.value.trim().toUpperCase() : '';
    const coupons = { SAVE10: 10, KIRANA20: 20, WELCOME5: 5 };
    if (!coupons[code]) {
        appliedCoupon = null;
        if (message) message.textContent = 'Invalid coupon. Try SAVE10, KIRANA20 or WELCOME5.';
        updateCartDisplay();
        return;
    }
    appliedCoupon = { code, percent: coupons[code] };
    if (message) message.textContent = `${code} applied: ${coupons[code]}% off.`;
    updateCartDisplay();
    showToast(`🎁 Coupon ${code} applied.`);
}

function updateCartQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveData();
            updateCartCount();
            updateCartDisplay();
        }
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveData();
    updateCartCount();
    updateCartDisplay();
}

function checkout() {
    if (cart.length === 0) {
        showToast('❌ Cart is empty!');
        return;
    }
    showUserSection('payment');
    renderCheckoutDetails();
    updateOrderPreview();
}

function backToCart() {
    showUserSection('cart');
}

let selectedPayment = 'cod';
function renderCheckoutDetails() {
    const addressContainer = document.getElementById('checkoutAddressList');
    const itemsContainer = document.getElementById('checkoutItems');
    if (addressContainer) {
        addressContainer.innerHTML = addresses.length ? addresses.map(address => `<label class="checkout-address-card ${address.selected ? 'selected' : ''}"><input type="radio" name="checkoutAddress" ${address.selected ? 'checked' : ''} onchange="selectAddress(${address.id}); renderCheckoutDetails(); updateOrderPreview()"><span><strong>${address.label}</strong><small>${address.address}</small></span></label>`).join('') : '<p class="muted-text">No saved address. Add one from Profile before placing the order.</p>';
    }
    if (itemsContainer) {
        itemsContainer.innerHTML = cart.map(item => `<div class="checkout-item"><div class="checkout-item-image">${item.image && item.image.startsWith('http') ? `<img src="${item.image}" alt="${item.name}">` : item.image || '🛒'}</div><div><strong>${item.name}</strong><small>${item.variant || 'Standard'} × ${item.quantity}</small></div><span>₹${((item.offerPrice || item.price) * item.quantity).toFixed(0)}</span></div>`).join('');
    }
}

function applyCheckoutCoupon() {
    const input = document.getElementById('checkoutCouponCode');
    const code = input ? input.value.trim().toUpperCase() : '';
    const coupons = { SAVE10: 10, KIRANA20: 20, WELCOME5: 5 };
    const message = document.getElementById('checkoutCouponMessage');
    if (!coupons[code]) {
        appliedCoupon = null;
        if (message) message.textContent = 'Invalid coupon code.';
    } else {
        appliedCoupon = { code, percent: coupons[code] };
        if (message) message.textContent = `${code} applied successfully.`;
    }
    updateOrderPreview();
}

async function updateOrderPreview() {
    const { subtotal, discount, deliveryCharge, total } = calculateCartTotals();
    
    // Update QR code with total amount
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=8115910227@ptyes&pn=Anuj%20Patel%20Kirana%20Store&am=${total.toFixed(0)}&cu=INR`;
    document.getElementById('paymentQR').src = qrUrl;
    
    let userName = 'Customer';
    let userPhone = '';
    let userAddress = 'Will call for address';
    
    if (currentUser && currentUser !== 'admin') {
        const user = await dbGet('users', currentUser);
        if (user) {
            userName = user.name || 'Customer';
            userPhone = user.mobile || '';
            userAddress = user.address || 'Will call for address';
        }
    }
    const selectedAddress = addresses.find(address => address.selected);
    if (selectedAddress) userAddress = `${selectedAddress.label}: ${selectedAddress.address}`;
    
    document.getElementById('orderPreview').innerHTML = `
        <div style="background:white;padding:2rem;border-radius:15px;margin-bottom:2rem;box-shadow:0 10px 30px rgba(0,0,0,0.1);">
            <h3>📋 Order Summary</h3>
            <div style="display:flex;justify-content:space-between;margin:1rem 0;">
                <span>Subtotal:</span>
                <span>₹${subtotal.toFixed(0)}</span>
            </div>
            ${discount > 0 ? `
                <div style="display:flex;justify-content:space-between;margin:1rem 0;color:#28a745;">
                    <span>Discount:</span>
                    <span>-₹${discount.toFixed(0)}</span>
                </div>
            ` : ''}
            <div style="display:flex;justify-content:space-between;margin:1rem 0;color:#64748b;"><span>Delivery charge:</span><span>${deliveryCharge ? `₹${deliveryCharge.toFixed(0)}` : 'FREE'}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:1.5rem;font-weight:bold;border-top:2px solid #eee;padding-top:1rem;margin-top:1rem;">
                <span>Total:</span>
                <span>₹${total.toFixed(0)}</span>
            </div>
            <div style="margin-top:1rem;padding:1rem;background:#e8f5e8;border-radius:10px;">
                <strong>Customer:</strong> ${userName}<br>
                <strong>Phone:</strong> ${userPhone}<br>
                <strong>Address:</strong> ${userAddress}
                <br><small>GST invoice will be included with your order.</small>
            </div>
        </div>
    `;
}

function initLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            document.getElementById('locationInfo').textContent = `📍 Lat:${latitude.toFixed(4)}, Lng:${longitude.toFixed(4)}`;
            document.getElementById('map').innerHTML = `
                <div style="height:100%;background:linear-gradient(45deg,#4CAF50,#45a049);color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem;border-radius:10px;">
                    <i class="fas fa-map-marker-alt" style="font-size:3rem;margin-bottom:0.5rem;"></i>
                    <div>Location Confirmed!</div>
                </div>
            `;
        }, () => {
            document.getElementById('locationInfo').textContent = '📍 Location access denied';
        });
    }
}

// Bill Generation
async function generateBill() {
    let userData = { name: 'Customer', phone: '', address: 'Will call for address' };
    
    if (currentUser && currentUser !== 'admin') {
        const user = await dbGet('users', currentUser);
        if (user) {
            userData = {
                name: user.name || 'Customer',
                phone: user.mobile || '',
                address: user.address || 'Will call for address'
            };
        }
    }
    
    const { subtotal, discount, total } = calculateCartTotals();
    const orderId = Date.now();
    
    const billHTML = `
        <div style="max-width:400px;margin:0 auto;font-family:Arial,sans-serif;">
            <div style="text-align:center;padding:2rem 1rem;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border-radius:15px 15px 0 0;">
                <h1 style="margin:0;font-size:1.8rem;">Anuj Patel Kirana Store</h1>
                <p style="margin:0.5rem 0;font-size:1.1rem;">Wholesale Rates | 8115910227</p>
                <div style="background:white;color:#333;padding:0.5rem 1rem;border-radius:10px;display:inline-block;font-weight:bold;">
                    BILL #${orderId}
                </div>
            </div>
            <div style="padding:2rem 1.5rem;background:white;">
                <div style="display:flex;justify-content:space-between;margin-bottom:1rem;font-weight:bold;">
                    <span>Date:</span>
                    <span>${new Date().toLocaleString('en-IN')}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:1rem;">
                    <span>Customer:</span>
                    <span>${userData.name}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:2rem;">
                    <span>Phone:</span>
                    <span>${userData.phone}</span>
                </div>
                
                <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">
                    <thead>
                        <tr style="background:#f8f9fa;">
                            <th style="padding:1rem 0.5rem;text-align:left;border-bottom:2px solid #eee;">Item</th>
                            <th style="padding:1rem 0.5rem;text-align:right;border-bottom:2px solid #eee;">Qty</th>
                            <th style="padding:1rem 0.5rem;text-align:right;border-bottom:2px solid #eee;">Price</th>
                            <th style="padding:1rem 0.5rem;text-align:right;border-bottom:2px solid #eee;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cart.map(item => `
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:1rem 0.5rem;">${item.name}</td>
                                <td style="padding:1rem 0.5rem;text-align:right;font-weight:bold;">${item.quantity}</td>
                                <td style="padding:1rem 0.5rem;text-align:right;">₹${item.price || item.offerPrice}</td>
                                <td style="padding:1rem 0.5rem;text-align:right;font-weight:bold;">
                                    ₹${((item.price || item.offerPrice) * item.quantity).toFixed(0)}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div style="display:flex;justify-content:space-between;font-size:1.2rem;margin:1rem 0;color:#666;">
                    <span>Subtotal:</span>
                    <span>₹${subtotal.toFixed(0)}</span>
                </div>
                ${discount > 0 ? `
                    <div style="display:flex;justify-content:space-between;font-size:1.2rem;color:#28a745;margin:0.5rem 0;">
                        <span>Discount:</span>
                        <span>-₹${discount.toFixed(0)}</span>
                    </div>
                ` : ''}
                <div style="display:flex;justify-content:space-between;font-size:1rem;margin:0.5rem 0;color:#666;">
                    <span>GST (5%):</span>
                    <span>₹${(total * 0.05).toFixed(0)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:1.5rem;font-weight:bold;border-top:3px double #333;padding-top:1rem;margin-top:1rem;">
                    <span>Total Amount:</span>
                    <span>₹${(total * 1.05).toFixed(0)}</span>
                </div>
                
                <div style="margin-top:2rem;padding:1.5rem;background:#e8f5e8;border-radius:10px;border-left:5px solid #28a745;">
                    <p style="margin:0;font-size:0.9rem;color:#155724;">
                        ✅ Thanks for shopping with us!<br>
                        📞 Call 8115910227 for delivery
                    </p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('billContent').innerHTML = billHTML;
    document.getElementById('billModal').classList.remove('hidden');
    window.pendingOrderId = orderId;
}

function closeBillModal() {
    document.getElementById('billModal').classList.add('hidden');
}

function downloadBill() {
    const billContent = document.getElementById('billContent').innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
        <html>
            <head>
                <title>Bill #${window.pendingOrderId}</title>
                <style>
                    @media print {
                        body { margin: 0; font-family: Arial, sans-serif; }
                        @page { size: A4; margin: 1cm; }
                    }
                    body { margin: 0; padding: 20px; max-width: 400px; margin: 20px auto; }
                </style>
            </head>
            <body>${billContent}</body>
        </html>
    `);
    win.document.close();
    win.print();
}

async function placeFinalOrder() {
    let userData = { name: 'Customer', phone: '', address: 'Will call for address' };
    
    if (currentUser && currentUser !== 'admin') {
        const user = await dbGet('users', currentUser);
        if (user) {
            userData = {
                name: user.name || 'Customer',
                phone: user.mobile || '',
                address: user.address || 'Will call for address'
            };
        }
    }
    
    const { subtotal, discount, total } = calculateCartTotals();
    
    const paymentLabel = selectedPayment === 'cod' ? 'Cash on Delivery' : 'UPI Payment';
    const status = selectedPayment === 'cod' ? 'Confirmed' : 'Pending';
    const message = selectedPayment === 'cod'
        ? 'New cash on delivery order confirmed and sent to admin.'
        : 'New order placed; payment is pending via UPI.';

    const selectedAddress = addresses.find(address => address.selected);
    const order = {
        id: window.pendingOrderId,
        user: userData,
        userId: currentUser && currentUser !== 'admin' ? currentUser : null,
        items: [...cart],
        subtotal,
        discount,
        total: total * 1.05,
        gst: total * 0.05,
        coupon: appliedCoupon,
        payment: selectedPayment,
        paymentLabel,
        paymentStatus: selectedPayment === 'cod' ? 'Cash on Delivery' : 'Pending online payment',
        date: new Date().toLocaleDateString('en-IN'),
        dateTime: new Date().toLocaleString('en-IN'),
        location: selectedAddress ? `${selectedAddress.label}: ${selectedAddress.address}` : document.getElementById('locationInfo').textContent,
        status,
        message
    };
    
    orders.unshift(order);
    pushNotification('Order placed', `Order #${order.id} is ${status.toLowerCase()}.`);
    await saveData();
    
    cart = [];
    appliedCoupon = null;
    await saveData();
    updateCartCount();
    updateCartDisplay();
    
    showToast(`✅ Order #${order.id} placed successfully! ${paymentLabel} selected.`);
    closeBillModal();
    showUserSection('shop');
    if (currentUser === 'admin') {
        return;
    }
    if (status === 'Confirmed') {
        showToast('📩 Order confirmed. Admin has received the notification.');
    }
    if (document.getElementById('adminMessagesList')) {
        renderAdminMessages();
    }
}

// Admin Functions
function loadAdminDashboard() {
    updateAdminStats();
    renderAdminMessages();
    renderAdminProducts();
    renderAdminOrders();
    renderAdminOffers();
    renderReactAdminWidget();
    renderAdminUsers();
    renderInventory();
    renderAdminCoupons();
    renderStoresAndDelivery();
    renderRefundQueue();
    renderSupportTickets();
    renderAdminBanners();
    renderReports();
    renderRoles();
    setupAdminFeatureForms();
}

function renderReactAdminWidget() {
    const container = document.getElementById('reactAdminWidget');
    if (!container || !window.React || !window.ReactDOM) return;

    const activeOfferCount = offers.filter(isActiveOffer).length;
    const h = window.React.createElement;
    const widget = h('div', null,
        h('h2', null, 'Live Store Status'),
        h('div', { className: 'stats-grid' },
            h('div', { className: 'stat-card' }, h('h3', null, products.length), h('p', null, 'Products')),
            h('div', { className: 'stat-card' }, h('h3', null, orders.length), h('p', null, 'Orders')),
            h('div', { className: 'stat-card' }, h('h3', null, activeOfferCount), h('p', null, 'Active Offers'))
        ),
        h('p', { style: { marginBottom: 0, color: '#64748b' } }, 'React component connected successfully.')
    );

    window.ReactDOM.createRoot(container).render(widget);
}

function renderAdminMessages() {
    const list = document.getElementById('adminMessagesList');
    if (!list) return;
    const messages = orders.filter(o => o.message).slice(0, 5);
    if (messages.length === 0) {
        list.innerHTML = '<li>No new notifications yet.</li>';
        return;
    }
    list.innerHTML = messages.map(order => `
        <li>
            <strong>Order #${order.id}</strong>
            <span>${order.message}</span>
            <br><small>${order.date}</small>
        </li>
    `).join('');
}

function showAdminSection(section) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById('admin' + section.charAt(0).toUpperCase() + section.slice(1));
    if (!target) return;
    target.classList.remove('hidden');
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    event.target.classList.add('active');
}

function updateAdminStats() {
    const today = new Date().toDateString();
    const todayOrders = orders.filter(o => new Date(o.date).toDateString() === today);
    
    document.getElementById('totalOrders').textContent = orders.length;
    document.getElementById('todaySales').textContent = `₹${todayOrders.reduce((sum, o) => sum + o.total, 0).toFixed(0)}`;
    document.getElementById('totalProducts').textContent = products.length;
    document.getElementById('activeOffers').textContent = offers.filter(isActiveOffer).length;
    const revenue = orders.filter(order => !['Cancelled', 'Return Requested', 'Refunded'].includes(order.status)).reduce((sum, order) => sum + Number(order.total || 0), 0);
    document.getElementById('adminRevenue').textContent = `₹${revenue.toFixed(0)}`;
    document.getElementById('adminLowStock').textContent = products.filter(product => Number(inventory[product.id] ?? 10) < 5).length;
    document.getElementById('adminOpenTickets').textContent = supportTickets.filter(ticket => ticket.status === 'Open').length;
}

function saveAdminCollection(key, value) {
    localStorage.setItem(`patelKirana_${key}`, JSON.stringify(value));
}

async function renderAdminUsers() {
    const table = document.getElementById('usersTable');
    if (!table) return;
    const users = await dbGetAll('users');
    table.innerHTML = users.length ? users.map(user => `<tr><td>${user.name || '-'}</td><td>${user.mobile || '-'}</td><td>${user.address || '-'}</td><td><button class="btn-secondary" onclick="notifyUser('${user.mobile}')">Notify</button></td></tr>`).join('') : '<tr><td colspan="4">No local users found</td></tr>';
}

function notifyUser(mobile) {
    const message = prompt('Notification message:');
    if (!message) return;
    const key = `patelKirana_notifications_${mobile}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.unshift({ id: Date.now(), title: 'Store update', message, date: new Date().toLocaleString('en-IN'), read: false });
    localStorage.setItem(key, JSON.stringify(list));
    showToast('Notification queued for customer.');
}

function renderInventory() {
    const select = document.getElementById('inventoryProduct');
    const table = document.getElementById('inventoryTable');
    if (!select || !table) return;
    select.innerHTML = products.map(product => `<option value="${product.id}">${product.name}</option>`).join('');
    table.innerHTML = products.map(product => {
        const stock = Number(inventory[product.id] ?? 10);
        return `<tr><td>${product.name}</td><td>${product.category}</td><td>${stock}</td><td><span class="stock-pill ${stock < 5 ? 'low' : 'ok'}">${stock < 5 ? 'Low stock' : 'In stock'}</span></td></tr>`;
    }).join('');
}

function renderAdminCoupons() {
    const container = document.getElementById('couponAdminList');
    if (!container) return;
    container.innerHTML = adminCoupons.length ? adminCoupons.map(coupon => `<div class="admin-list-row"><strong>${coupon.code}</strong><span>${coupon.discount}% off</span><button class="btn-secondary" onclick="deleteAdminCoupon('${coupon.code}')">Delete</button></div>`).join('') : '<p class="muted-text">No custom coupons yet.</p>';
}

function deleteAdminCoupon(code) {
    adminCoupons = adminCoupons.filter(coupon => coupon.code !== code);
    saveAdminCollection('adminCoupons', adminCoupons);
    renderAdminCoupons();
}

function renderStoresAndDelivery() {
    const stores = document.getElementById('storeList');
    const queue = document.getElementById('deliveryQueue');
    if (stores) stores.innerHTML = adminStores.length ? adminStores.map(store => `<div class="admin-list-row"><strong>${store.name}</strong><span>${store.area} | Capacity ${store.capacity}</span></div>`).join('') : '<p class="muted-text">No stores configured.</p>';
    if (queue) queue.innerHTML = orders.length ? orders.slice(0, 10).map(order => `<div class="admin-list-row"><strong>#${order.id}</strong><span>${order.status}</span><button class="btn-secondary" onclick="updateOrderStatus(${order.id}, 'Out for Delivery'); renderStoresAndDelivery();">Dispatch</button></div>`).join('') : '<p class="muted-text">No delivery orders.</p>';
}

function renderSupportTickets() {
    const container = document.getElementById('ticketList');
    if (!container) return;
    container.innerHTML = supportTickets.length ? supportTickets.map(ticket => `<div class="admin-list-row"><span><strong>${ticket.customer}</strong>: ${ticket.issue}</span><button class="btn-secondary" onclick="resolveTicket(${ticket.id})">${ticket.status}</button></div>`).join('') : '<p class="muted-text">No support tickets.</p>';
}

function resolveTicket(ticketId) {
    const ticket = supportTickets.find(item => item.id === ticketId);
    if (!ticket) return;
    ticket.status = ticket.status === 'Open' ? 'Resolved' : 'Open';
    saveAdminCollection('tickets', supportTickets);
    renderSupportTickets();
    updateAdminStats();
}

function renderAdminBanners() {
    const container = document.getElementById('bannerList');
    if (!container) return;
    container.innerHTML = adminBanners.length ? adminBanners.map(banner => `<div class="admin-list-row"><span>${banner.message}</span><small>${banner.date}</small></div>`).join('') : '<p class="muted-text">No published banners.</p>';
}

function renderReports() {
    const container = document.getElementById('reportSummary');
    if (!container) return;
    const completed = orders.filter(order => !['Cancelled', 'Return Requested', 'Refunded'].includes(order.status));
    const revenue = completed.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const average = completed.length ? revenue / completed.length : 0;
    container.innerHTML = `<div class="stat-card"><h3>₹${revenue.toFixed(0)}</h3><p>Gross revenue</p></div><div class="stat-card"><h3>${completed.length}</h3><p>Completed orders</p></div><div class="stat-card"><h3>₹${average.toFixed(0)}</h3><p>Average order value</p></div>`;
}

function renderRoles() {
    const container = document.getElementById('roleList');
    if (!container) return;
    container.innerHTML = adminRoles.length ? adminRoles.map(role => `<div class="admin-list-row"><strong>${role.member}</strong><span>${role.role}</span></div>`).join('') : '<p class="muted-text">Only owner admin is configured.</p>';
}

function renderRefundQueue() {
    const queue = document.getElementById('deliveryQueue');
    if (!queue) return;
    const refunds = orders.filter(order => ['Return Requested', 'Refunded'].includes(order.status));
    if (!refunds.length) return;
    queue.innerHTML += refunds.map(order => `<div class="admin-list-row"><strong>Refund #${order.id}</strong><span>${order.status}</span><button class="btn-secondary" onclick="refundOrder(${order.id})">Mark refunded</button></div>`).join('');
}

function refundOrder(orderId) {
    const order = orders.find(item => item.id === orderId);
    if (!order) return;
    order.status = 'Refunded';
    order.message = 'Refund completed by admin.';
    saveData();
    renderStoresAndDelivery();
    renderRefundQueue();
    renderAdminOrders();
    renderReports();
    updateAdminStats();
}

function setupAdminFeatureForms() {
    const bind = (id, handler) => {
        const form = document.getElementById(id);
        if (form && form.dataset.ready !== 'true') { form.dataset.ready = 'true'; form.addEventListener('submit', handler); }
    };
    bind('inventoryForm', event => { event.preventDefault(); inventory[document.getElementById('inventoryProduct').value] = Number(document.getElementById('inventoryStock').value); saveAdminCollection('inventory', inventory); renderInventory(); updateAdminStats(); showToast('Inventory updated.'); });
    bind('couponForm', event => { event.preventDefault(); adminCoupons.push({ code: document.getElementById('adminCouponCode').value.trim().toUpperCase(), discount: Number(document.getElementById('adminCouponDiscount').value) }); saveAdminCollection('adminCoupons', adminCoupons); event.target.reset(); renderAdminCoupons(); showToast('Coupon saved.'); });
    bind('storeForm', event => { event.preventDefault(); adminStores.push({ id: Date.now(), name: document.getElementById('storeName').value, area: document.getElementById('storeArea').value, capacity: Number(document.getElementById('storeCapacity').value) }); saveAdminCollection('stores', adminStores); event.target.reset(); renderStoresAndDelivery(); showToast('Store added.'); });
    bind('ticketForm', event => { event.preventDefault(); supportTickets.unshift({ id: Date.now(), customer: document.getElementById('ticketCustomer').value, issue: document.getElementById('ticketIssue').value, status: 'Open' }); saveAdminCollection('tickets', supportTickets); event.target.reset(); renderSupportTickets(); updateAdminStats(); showToast('Support ticket created.'); });
    bind('bannerForm', event => { event.preventDefault(); adminBanners.unshift({ id: Date.now(), message: document.getElementById('bannerMessage').value, date: new Date().toLocaleString('en-IN') }); saveAdminCollection('banners', adminBanners); event.target.reset(); renderAdminBanners(); showToast('Banner published.'); });
    bind('roleForm', event => { event.preventDefault(); adminRoles.push({ id: Date.now(), member: document.getElementById('roleMember').value, role: document.getElementById('roleName').value }); saveAdminCollection('roles', adminRoles); event.target.reset(); renderRoles(); showToast('Role assigned.'); });
}

function renderAdminOrders() {
    const tbody = document.getElementById('ordersTable');
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:3rem;color:#666;">No orders yet</td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${order.user.name || 'Customer'}<br><small>${order.user.phone || ''}</small><br><small>${order.user.address || ''}</small></td>
            <td>${order.items.map(i => i.name).join('<br>')}</td>
            <td>₹${order.total.toFixed(0)}</td>
            <td>${new Date(order.date).toLocaleDateString('en-IN')}</td>
            <td>${order.location}</td>
            <td><span class="status ${order.status.toLowerCase()}">${order.status}</span></td>
            <td>
                <button onclick="viewOrder(${order.id})" class="btn-edit">View</button>
                <button onclick="updateOrderStatus(${order.id}, 'Delivered')" class="btn-success">Mark Delivered</button>
            </td>
        </tr>
    `).join('');
}

function renderAdminProducts() {
    const tbody = document.getElementById('productsTable');
    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.name}</td>
            <td>₹${parseFloat(product.price).toFixed(0)}</td>
            <td>${product.category}</td>
            <td>
                <button onclick="editProduct(${product.id})" class="btn-edit">Edit</button>
            </td>
        </tr>
    `).join('');
}

async function handleProductForm(e) {
    e.preventDefault();
    const id = document.getElementById('editProductId').value;
    const productData = {
        name: document.getElementById('productName').value.trim(),
        price: parseFloat(document.getElementById('productPrice').value),
        image: document.getElementById('productImage').value.trim() || '🛒',
        category: document.getElementById('productCategory').value
    };

    if (!productData.name || !productData.price) {
        showToast('❌ Product name and price are required.');
        return;
    }

    if (id) {
        productData.id = parseInt(id, 10);
    }

    const serverProduct = await postProductToServer(productData);
    if (serverProduct) {
        const normalized = {
            id: parseInt(serverProduct.id, 10),
            name: serverProduct.name,
            price: parseFloat(serverProduct.price),
            category: serverProduct.category || 'General',
            image: serverProduct.image || '🛒'
        };

        if (id) {
            const index = products.findIndex(p => p.id === normalized.id);
            if (index >= 0) products[index] = normalized;
            showToast('✅ Product updated in database!');
        } else {
            products.push(normalized);
            showToast('✅ Product added to database!');
        }
    } else {
        if (!id) {
            productData.id = Date.now();
            products.push(productData);
            showToast('⚠️ Added locally. Database unavailable.');
        } else {
            const index = products.findIndex(p => p.id === parseInt(id, 10));
            if (index >= 0) products[index] = productData;
            showToast('⚠️ Updated locally. Database unavailable.');
        }
    }

    await saveData();
    renderAdminProducts();
    document.getElementById('productForm').reset();
    document.getElementById('editProductId').value = '';
    editingProductId = null;
}

function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (product) {
        document.getElementById('editProductId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productImage').value = product.image;
        document.getElementById('productCategory').value = product.category;
        editingProductId = id;
    }
}

function cancelEdit() {
    document.getElementById('productForm').reset();
    document.getElementById('editProductId').value = '';
    editingProductId = null;
}

function deleteProduct(id) {
    showToast('⚠️ Product deletion is disabled. Products are kept permanently in the database.');
}

function handleOfferForm(e) {
    e.preventDefault();
    const offer = {
        id: editingOfferId || Date.now(),
        title: document.getElementById('offerTitle').value,
        discount: parseInt(document.getElementById('offerDiscount').value),
        category: 'Cold Drink', // Default or make selectable
        expiry: new Date(document.getElementById('offerExpiry').value).getTime()
    };

    if (!offer.title || !Number.isFinite(offer.discount) || !Number.isFinite(offer.expiry) || offer.expiry <= Date.now()) {
        showToast('❌ Please enter a valid offer and future expiry date.');
        return;
    }
    
    if (editingOfferId) {
        const index = offers.findIndex(existingOffer => existingOffer.id === editingOfferId);
        if (index >= 0) offers[index] = offer;
        showToast('✅ Offer updated!');
    } else {
        offers.push(offer);
        showToast('🎉 Offer created!');
    }
    editingOfferId = null;
    saveData();
    document.getElementById('offerForm').reset();
    document.querySelector('#offerForm button[type="submit"]').textContent = 'Add Offer';
    renderAdminOffers();
}

function renderAdminOffers() {
    const container = document.getElementById('adminOffersList');
    container.innerHTML = offers.map(offer => `
        <div class="offer-card">
            <div class="offer-info">
                <h3>${offer.title}</h3>
                <div class="price">${offer.discount}% OFF</div>
                <p>Valid till: ${new Date(offer.expiry).toLocaleString()}</p>
                <div style="margin-top:1rem;">
                    <button onclick="editOffer(${offer.id})" class="btn-edit">Edit</button>
                    <button onclick="deleteOffer(${offer.id})" style="background:#dc3545;color:white;padding:0.5rem 1rem;border-radius:20px;">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function editOffer(id) {
    const offer = offers.find(existingOffer => existingOffer.id === id);
    if (!offer) return;
    editingOfferId = id;
    document.getElementById('offerTitle').value = offer.title;
    document.getElementById('offerDiscount').value = offer.discount;
    const expiry = new Date(offer.expiry);
    document.getElementById('offerExpiry').value = new Date(expiry.getTime() - expiry.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.querySelector('#offerForm button[type="submit"]').textContent = 'Update Offer';
}

function deleteOffer(id) {
    if (confirm('Delete this offer?')) {
        offers = offers.filter(o => o.id !== id);
        if (editingOfferId === id) {
            editingOfferId = null;
            document.getElementById('offerForm').reset();
            document.querySelector('#offerForm button[type="submit"]').textContent = 'Add Offer';
        }
        saveData();
        renderAdminOffers();
        renderUserOffers();
        showToast('🗑️ Offer deleted!');
    }
}

// Offers Functions
function getActiveOffer() {
    return offers
        .filter(isActiveOffer)
        .sort((first, second) => Number(second.id) - Number(first.id))[0] || null;
}

function renderUserOffers() {
    const container = document.getElementById('userOffersList');
    const activeOffers = offers.filter(isActiveOffer);
    
    if (activeOffers.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:3rem;color:#666;">No active offers right now 😢</p>';
        return;
    }
    
    container.innerHTML = activeOffers.map(offer => `
        <div class="offer-card">
            <div class="offer-info">
                <h2 style="color:#ff4757;">🎉 ${offer.title}</h2>
                <div class="price" style="font-size:2.5rem;">${offer.discount}% OFF</div>
                <p>Hurry! Offer valid till ${new Date(offer.expiry).toLocaleString()}</p>
                <button onclick="showUserSection('shop')" class="btn-primary" style="margin-top:1rem;">Shop Now</button>
            </div>
        </div>
    `).join('');
}

function renderUserOrders() {
    const container = document.getElementById('orderHistoryList');
    if (!container) return;
    const userOrders = currentUser && currentUser !== 'admin'
        ? orders.filter(order => order.userId === currentUser)
        : [];

    if (userOrders.length === 0) {
        container.innerHTML = `
            <div class="order-history-card">
                <p style="margin:0;color:#666;">No orders yet. Add products to your cart and place an order to see your purchase history here.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = userOrders.map(order => `
        <div class="order-history-card">
            <div class="order-meta">
                <div><strong>Order ID: #${order.id}</strong></div>
                <div>Date: ${order.dateTime || order.date || ''}</div>
            </div>
            <div class="order-meta">
                <span>Order status: <strong>${order.status}</strong></span>
                <span>Amount: <strong>₹${Number(order.total || 0).toFixed(0)}</strong></span>
            </div>
            <div class="order-items">
                <strong>Items:</strong>
                <ul>
                    ${order.items.map(item => `
                        <li>
                            ${item.name} × ${item.quantity}
                            ${order.status === 'Delivered' ? (isReviewWindowOpen(order) ? renderDeliveredReviewForm(item, order.id) : '<p class="review-locked"><i class="fas fa-clock"></i> Review window 4 din baad band ho gaya.</p>') : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
            <div class="order-payment-status"><i class="fas fa-credit-card"></i> Payment status: <strong>${order.paymentStatus || (order.payment === 'cod' ? 'Cash on Delivery' : 'Pending')}</strong></div>
            <div class="order-tracking"><span class="tracking-step done">Placed</span><span class="tracking-step ${['Confirmed', 'Packed', 'Out for Delivery', 'Delivered'].includes(order.status) ? 'done' : ''}">Packed</span><span class="tracking-step ${['Out for Delivery', 'Delivered'].includes(order.status) ? 'done' : ''}">On the way</span><span class="tracking-step ${order.status === 'Delivered' ? 'done' : ''}">Delivered</span></div>
            <div class="order-actions">
                <button type="button" class="btn-secondary" onclick="trackOrder(${order.id})"><i class="fas fa-map-marker-alt"></i> Track Order</button>
                <button type="button" class="btn-secondary" onclick="reorder(${order.id})"><i class="fas fa-redo"></i> Reorder</button>
                ${['Pending', 'Confirmed'].includes(order.status) ? `<button type="button" class="btn-secondary" onclick="cancelOrder(${order.id})"><i class="fas fa-ban"></i> Cancel Order</button>` : ''}
                <button type="button" class="btn-secondary" onclick="downloadOrderInvoice(${order.id})"><i class="fas fa-file-invoice"></i> Invoice</button>
                ${order.status === 'Delivered' ? `<button type="button" class="btn-secondary" onclick="requestReturn(${order.id})"><i class="fas fa-undo"></i> Return / Refund</button>` : ''}
            </div>
            <div class="order-meta" style="margin-top:1rem;">
                <span>${order.location || ''}</span>
                <span>${order.paymentLabel || order.payment || ''}</span>
            </div>
        </div>
    `).join('');
}

function trackOrder(orderId) {
    const order = orders.find(item => item.id === orderId);
    if (!order) return;
    showToast(`Order #${orderId}: ${order.status}. ${order.location || 'Delivery location is on file.'}`);
}

function downloadOrderInvoice(orderId) {
    const order = orders.find(item => item.id === orderId);
    if (!order) return;
    const rows = (order.items || []).map(item => `<tr><td>${item.name}</td><td>${item.quantity}</td><td>₹${Number(item.price || item.offerPrice || 0).toFixed(0)}</td></tr>`).join('');
    const win = window.open('', '_blank');
    if (!win) return showToast('Please allow pop-ups to download the invoice.');
    win.document.write(`<html><head><title>Invoice #${order.id}</title><style>body{font-family:Arial;padding:30px;color:#17324d}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left}</style></head><body><h1>Patel Kirana Store</h1><p>GST Invoice | Order #${order.id}</p><p>Date: ${order.dateTime || order.date || ''}<br>Payment: ${order.paymentStatus || order.payment || ''}<br>Status: ${order.status}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${rows}</tbody></table><h2>Total: ₹${Number(order.total || 0).toFixed(0)}</h2><p>Thank you for shopping with us.</p></body></html>`);
    win.document.close();
    win.print();
}

function isReviewWindowOpen(order) {
    if (order.status !== 'Delivered' || !order.deliveredAt) return false;
    const fourDays = 4 * 24 * 60 * 60 * 1000;
    return Date.now() - Number(order.deliveredAt) <= fourDays;
}

function renderDeliveredReviewForm(item, orderId) {
    const reviewKey = `${orderId}-${item.id}`;
    return `
        <div class="delivered-review-box">
            <div class="delivered-review-title"><i class="fas fa-check-circle"></i> Delivered: apna review dein</div>
            <div class="product-rating-stars" id="productStars-${reviewKey}">
                ${[1, 2, 3, 4, 5].map(value => `<button type="button" class="product-star" data-value="${value}" onclick="selectProductRating(${item.id}, ${value}, '${reviewKey}')">★</button>`).join('')}
            </div>
            <textarea id="productReview-${reviewKey}" rows="2" placeholder="Comment likhein (optional)"></textarea>
            <small class="review-optional-note">Comment aur photo optional hain. Sirf rating bhi submit kar sakte hain.</small>
            <div class="product-review-upload">
                <label for="productReviewImage-${reviewKey}" class="review-upload-label"><i class="fas fa-camera"></i> Photo upload</label>
                <input type="file" id="productReviewImage-${reviewKey}" accept="image/*" hidden onchange="handleProductReviewImageUpload(event, ${item.id}, '${reviewKey}')">
                <img id="productReviewPreview-${reviewKey}" class="product-review-preview hidden" alt="Product review preview">
            </div>
            <button type="button" class="btn-secondary review-submit-button" onclick="submitProductReview(${item.id}, '${reviewKey}')">Review submit karein</button>
        </div>
    `;
}

function isActiveOffer(offer) {
    return Date.now() < offer.expiry;
}

function showActiveOfferBadge() {
    const activeOffer = getActiveOffer();
    const badge = document.getElementById('offerBadge');
    if (activeOffer) {
        badge.textContent = `${activeOffer.discount}% OFF`;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// Admin Order Functions
function viewOrder(id) {
    const order = orders.find(o => o.id === id);
    if (order) {
        const details = `
Order #${order.id}
Customer: ${order.user.name}
Phone: ${order.user.phone}
Total: ₹${order.total.toFixed(0)}
Date: ${order.date}
Status: ${order.status}
        `;
        alert(details);
    }
}

function updateOrderStatus(id, status) {
    const order = orders.find(o => o.id === id);
    if (order) {
        order.status = status;
        if (status === 'Delivered' && !order.deliveredAt) {
            order.deliveredAt = Date.now();
        } else if (status !== 'Delivered') {
            delete order.deliveredAt;
        }
        saveData();
        renderAdminOrders();
        updateAdminStats();
        showToast(`✅ Order #${id} marked as ${status}`);
    }
}

function exportOrders() {
    const csv = [
        ['ID', 'Customer', 'Phone', 'Total', 'Date', 'Status'],
        ...orders.map(o => [
            o.id,
            o.user.name || '',
            o.user.phone || '',
            o.total.toFixed(0),
            o.date,
            o.status
        ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// Utility Functions
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position:fixed;top:50%;left:50%;transform:translate(-50%, -50%) scale(0.8);
        background:#28a745;color:white;padding:2rem 3rem;border-radius:15px;
        font-weight:600;font-size:1.2rem;text-align:center;
        box-shadow:0 20px 40px rgba(40,167,69,0.6);z-index:10000;
        transition:all 0.3s;opacity:0;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transform = 'translate(-50%, -50%) scale(1)';
        toast.style.opacity = '1';
    }, 100);
    setTimeout(() => {
        toast.style.transform = 'translate(-50%, -50%) scale(0.8)';
        toast.style.opacity = '0';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
}

function renderCategories() {
    const container = document.getElementById('categoryChips');
    if (!container) return;
    const categories = ['All', ...new Set(products.map(product => product.category).filter(Boolean))];
    container.innerHTML = categories.map(category => `<button type="button" class="category-chip ${selectedCategory === category ? 'active' : ''}" onclick="selectCategory('${category.replace(/'/g, "\\'")}')">${category}</button>`).join('');
}

function selectCategory(category) {
    selectedCategory = category;
    renderCategories();
    renderProducts();
}

function startVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('🎙️ Voice search is not supported in this browser.');
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.interimResults = false;
    recognition.onresult = event => {
        const input = document.getElementById('productSearch');
        input.value = event.results[0][0].transcript;
        selectedCategory = 'All';
        renderCategories();
        renderProducts();
    };
    recognition.onerror = () => showToast('🎙️ Voice search could not hear that.');
    recognition.start();
}

function customerStorageKey(name) {
    return `patelKirana_${name}_${currentUser || 'guest'}`;
}

function loadCustomerState() {
    wishlist = JSON.parse(localStorage.getItem(customerStorageKey('wishlist')) || '[]');
    addresses = JSON.parse(localStorage.getItem(customerStorageKey('addresses')) || '[]');
    notifications = JSON.parse(localStorage.getItem(customerStorageKey('notifications')) || '[]');
    appliedCoupon = null;
    updateNotificationCount();
    updateWishlistCount();
}

function saveCustomerState(name, value) {
    localStorage.setItem(customerStorageKey(name), JSON.stringify(value));
}

function toggleWishlist(productId) {
    const product = products.find(item => item.id === productId);
    if (!product) return;
    const existingIndex = wishlist.findIndex(item => item.id === productId);
    if (existingIndex >= 0) wishlist.splice(existingIndex, 1);
    else wishlist.push(product);
    saveCustomerState('wishlist', wishlist);
    updateWishlistCount();
    renderProducts();
    renderWishlist();
    showToast(existingIndex >= 0 ? 'Removed from wishlist.' : 'Added to wishlist.');
}

function updateWishlistCount() {
    const count = document.getElementById('wishlistCount');
    if (count) count.textContent = wishlist.length;
}

function renderWishlist() {
    const container = document.getElementById('wishlistGrid');
    if (!container) return;
    if (!wishlist.length) {
        container.innerHTML = '<div class="empty-product-search"><i class="fas fa-heart"></i><h3>Wishlist is empty</h3><p>Save products here for quick reordering.</p></div>';
        return;
    }
    container.innerHTML = wishlist.map(product => `
        <div class="product-card">
            <div class="product-image">${product.image && product.image.startsWith('http') ? `<img src="${product.image}" alt="${product.name}">` : product.image || '🛒'}</div>
            <div class="product-info"><h3>${product.name}</h3><div class="price">₹${Number(product.price).toFixed(0)}</div><p><small>${product.category}</small></p><button onclick="addToCart(${product.id}, 'Standard')" class="btn-primary"><i class="fas fa-cart-plus"></i> Add to Cart</button></div>
        </div>
    `).join('');
}

function addAddress() {
    const label = prompt('Address label (Home, Shop, Office):');
    const address = prompt('Full delivery address:');
    if (!label || !address) return;
    addresses.push({ id: Date.now(), label, address, selected: addresses.length === 0 });
    saveCustomerState('addresses', addresses);
    renderAddresses();
    showToast('Address saved.');
}

function renderAddresses() {
    const container = document.getElementById('addressList');
    if (!container) return;
    if (!addresses.length) {
        container.innerHTML = '<p class="muted-text">No saved address. Add one for faster checkout.</p>';
        return;
    }
    container.innerHTML = addresses.map(address => `<label class="address-card ${address.selected ? 'selected' : ''}"><input type="radio" name="deliveryAddress" ${address.selected ? 'checked' : ''} onchange="selectAddress(${address.id})"><span><strong>${address.label}</strong><br>${address.address}</span></label>`).join('');
}

function selectAddress(addressId) {
    addresses = addresses.map(address => ({ ...address, selected: address.id === addressId }));
    saveCustomerState('addresses', addresses);
    renderAddresses();
    const selected = addresses.find(address => address.selected);
    if (selected) updateHomeDeliveryAddress(`${selected.label}: ${selected.address}`);
}

function pushNotification(title, message) {
    notifications.unshift({ id: Date.now(), title, message, date: new Date().toLocaleString('en-IN'), read: false });
    notifications = notifications.slice(0, 30);
    saveCustomerState('notifications', notifications);
    updateNotificationCount();
}

function updateNotificationCount() {
    const count = document.getElementById('notificationCount');
    if (count) count.textContent = notifications.filter(item => !item.read).length;
}

function renderNotifications() {
    const container = document.getElementById('notificationList');
    if (!container) return;
    container.innerHTML = notifications.length ? notifications.map(item => `<article class="notification-card ${item.read ? '' : 'unread'}"><strong>${item.title}</strong><p>${item.message}</p><small>${item.date}</small></article>`).join('') : '<p class="muted-text">No notifications yet.</p>';
}

function markNotificationsRead() {
    notifications = notifications.map(item => ({ ...item, read: true }));
    saveCustomerState('notifications', notifications);
    updateNotificationCount();
    renderNotifications();
}

function reorder(orderId) {
    const order = orders.find(item => item.id === orderId);
    if (!order) return;
    order.items.forEach(item => addToCart(item.id, item.variant || 'Standard'));
    showUserSection('cart');
}

function cancelOrder(orderId) {
    const order = orders.find(item => item.id === orderId);
    if (!order || !['Pending', 'Confirmed'].includes(order.status)) return;
    order.status = 'Cancelled';
    order.message = 'Cancellation requested by customer.';
    pushNotification('Order cancelled', `Order #${order.id} cancellation is recorded.`);
    saveData();
    renderUserOrders();
}

function requestReturn(orderId) {
    const order = orders.find(item => item.id === orderId);
    if (!order || order.status !== 'Delivered') return;
    order.status = 'Return Requested';
    order.message = 'Return/refund request sent to customer support.';
    pushNotification('Return request received', `Support will contact you about order #${order.id}.`);
    saveData();
    renderUserOrders();
}

function showPartnerLogin() {
    document.getElementById('partnerAuthPanel').classList.remove('hidden');
    document.getElementById('loginFormTab').classList.add('hidden');
    document.getElementById('registerFormTab').classList.add('hidden');
    document.getElementById('forgetPasswordContainer').classList.add('hidden');
}

function showPartnerRegister() {
    document.getElementById('partnerRegisterForm').classList.remove('hidden');
}

async function partnerApi(action, options = {}) {
    const response = await fetch(`api.php?action=${encodeURIComponent(action)}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${partnerToken}`, ...(options.headers || {}) }
    });
    const result = await parseJSONResponse(response);
    if (!response.ok) throw new Error(result.error || 'Partner API request failed');
    return result;
}

async function handlePartnerRegister(event) {
    event.preventDefault();
    const payload = {
        name: document.getElementById('partnerRegisterName').value.trim(),
        phone: document.getElementById('partnerRegisterPhone').value.trim(),
        email: document.getElementById('partnerRegisterEmail').value.trim(),
        password: document.getElementById('partnerRegisterPassword').value,
        kyc_document: document.getElementById('partnerRegisterKyc').value.trim()
    };
    try {
        const response = await fetch('api.php?action=partner_register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await parseJSONResponse(response);
        if (!response.ok) throw new Error(result.error || 'Registration failed');
        showToast('✅ Application submitted. Admin KYC approval is pending.');
        document.getElementById('partnerRegisterForm').reset();
    } catch (error) { showToast('❌ ' + error.message); }
}

async function handlePartnerLogin(event) {
    event.preventDefault();
    try {
        const response = await fetch('api.php?action=partner_login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: document.getElementById('partnerLoginPhone').value.trim(), password: document.getElementById('partnerLoginPassword').value }) });
        const result = await parseJSONResponse(response);
        if (!response.ok) throw new Error(result.error || 'Partner login failed');
        partnerToken = result.auth.token;
        currentPartner = result.partner;
        localStorage.setItem('partnerToken', partnerToken);
        localStorage.setItem('currentPartner', JSON.stringify(currentPartner));
        localStorage.setItem('currentUser', 'partner');
        showPage('partnerPage');
        loadPartnerDashboard();
    } catch (error) { showToast('❌ ' + error.message); }
}

async function loadPartnerDashboard() {
    try {
        const profile = await partnerApi('partner_profile');
        currentPartner = profile.partner;
        localStorage.setItem('currentPartner', JSON.stringify(currentPartner));
        document.getElementById('partnerNameLabel').textContent = currentPartner.name || '';
        document.getElementById('partnerKycStatus').textContent = `KYC: ${currentPartner.kyc_status}`;
        document.getElementById('partnerOnlineToggle').checked = Boolean(Number(currentPartner.is_online));
        await Promise.all([loadPartnerOrders(), loadPartnerEarnings(), loadPartnerPayouts(), loadPartnerHistory()]);
    } catch (error) { showToast('❌ ' + error.message); }
}

async function updatePartnerOnlineStatus(event) {
    try { await partnerApi('partner_status', { method: 'POST', body: JSON.stringify({ online: event.target.checked }) }); showToast(event.target.checked ? 'You are online.' : 'You are offline.'); } catch (error) { event.target.checked = !event.target.checked; showToast('❌ ' + error.message); }
}

async function loadPartnerOrders() {
    const container = document.getElementById('partnerOrdersList');
    try {
        const result = await partnerApi('available_orders');
        container.innerHTML = result.orders.length ? result.orders.map(order => `<article class="partner-order-card"><div><strong>Order #${order.id}</strong><p>${order.customer_name} · ${order.location || 'Address on order'}</p><small>₹${Number(order.final_amount).toFixed(0)} · ${order.status}</small></div><div class="partner-order-actions"><a class="icon-button" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.location || '')}" target="_blank" title="Navigate"><i class="fas fa-location-arrow"></i></a><button class="btn-primary" onclick="partnerAcceptOrder(${order.id})">Accept</button><button class="btn-secondary" onclick="partnerRejectOrder(${order.id})">Reject</button></div></article>`).join('') : '<p class="muted-text">No available orders right now.</p>';
    } catch (error) { container.innerHTML = `<p class="muted-text">${error.message}</p>`; }
}

async function partnerAcceptOrder(orderId) { try { await partnerApi('partner_accept', { method: 'POST', body: JSON.stringify({ order_id: orderId }) }); showToast('Order accepted.'); loadPartnerOrders(); loadPartnerHistory(); } catch (error) { showToast('❌ ' + error.message); } }
async function partnerRejectOrder(orderId) { try { await partnerApi('partner_reject', { method: 'POST', body: JSON.stringify({ order_id: orderId }) }); showToast('Order rejected.'); loadPartnerOrders(); } catch (error) { showToast('❌ ' + error.message); } }
async function partnerMarkPickup(orderId) { try { await partnerApi('partner_pickup', { method: 'POST', body: JSON.stringify({ order_id: orderId }) }); loadPartnerHistory(); } catch (error) { showToast('❌ ' + error.message); } }
async function partnerMarkDelivered(orderId) { try { await partnerApi('partner_update_status', { method: 'POST', body: JSON.stringify({ order_id: orderId, status: 'Delivered' }) }); showToast('Delivery completed.'); loadPartnerDashboard(); } catch (error) { showToast('❌ ' + error.message); } }

async function loadPartnerEarnings() { const result = await partnerApi('partner_earnings'); document.getElementById('partnerTodayEarnings').textContent = `₹${Number(result.summary.total_earnings || 0).toFixed(0)}`; document.getElementById('partnerDeliveries').textContent = result.summary.deliveries || 0; document.getElementById('partnerIncentives').textContent = `₹${Number(result.summary.incentive_total || 0).toFixed(0)}`; }
async function loadPartnerPayouts() { const result = await partnerApi('partner_payouts'); document.getElementById('partnerPayoutList').innerHTML = result.payouts.length ? result.payouts.map(item => `<div class="partner-order-card"><span>${item.week_start} to ${item.week_end}</span><strong>₹${Number(item.amount).toFixed(0)} · ${item.status}</strong></div>`).join('') : '<p class="muted-text">No weekly payout yet.</p>'; }
async function loadPartnerHistory() { const result = await partnerApi('partner_history'); document.getElementById('partnerHistoryList').innerHTML = result.history.length ? result.history.map(item => `<article class="partner-order-card"><div><strong>Order #${item.order_id}</strong><p>${item.location || ''}</p></div><div><span>${item.status}</span>${item.status === 'Accepted' ? `<button class="btn-primary" onclick="partnerMarkPickup(${item.order_id})">Pickup</button>` : ''}${item.status === 'Picked Up' || item.status === 'Out for Delivery' ? `<button class="btn-primary" onclick="partnerMarkDelivered(${item.order_id})">Delivered</button>` : ''}</div></article>`).join('') : '<p class="muted-text">No delivery history yet.</p>'; }

function partnerLogout() {
    partnerToken = '';
    currentPartner = null;
    localStorage.removeItem('partnerToken');
    localStorage.removeItem('currentPartner');
    localStorage.removeItem('currentUser');
    showPage('landingPage');
}

function openCustomerSearch() {
    showUserSection('search');
}

function runCustomerSearch() {
    const input = document.getElementById('customerSearchInput');
    const term = input ? input.value.trim().toLowerCase() : '';
    if (!term) return showToast('Search for a product or category.');
    const shopInput = document.getElementById('productSearch');
    if (shopInput) shopInput.value = term;
    selectedCategory = 'All';
    renderCategories();
    showUserSection('shop');
    renderProducts();
}

function updateHomeDeliveryAddress(address) {
    const target = document.getElementById('homeDeliveryAddress');
    if (target) target.textContent = address;
}

function loadCustomerSettings() {
    const get = name => localStorage.getItem(`patelKirana_setting_${currentUser}_${name}`);
    const delivery = document.getElementById('deliveryNotificationSetting');
    const offersSetting = document.getElementById('offerNotificationSetting');
    const language = document.getElementById('languageSetting');
    const darkMode = document.getElementById('darkModeSetting');
    const dataSaver = document.getElementById('dataSaverSetting');
    const offerAlerts = document.getElementById('offerAlertSetting');
    if (delivery && get('deliveryNotifications') !== null) delivery.checked = get('deliveryNotifications') === 'true';
    if (offersSetting && get('offerNotifications') !== null) offersSetting.checked = get('offerNotifications') === 'true';
    if (language && get('language')) language.value = get('language');
    if (darkMode) darkMode.checked = get('darkMode') === 'true';
    if (dataSaver) dataSaver.checked = get('dataSaver') === 'true';
    if (offerAlerts && get('offerAlerts') !== null) offerAlerts.checked = get('offerAlerts') === 'true';
    document.body.classList.toggle('dark-mode', darkMode?.checked === true);
}

function saveCustomerSetting(name, value) {
    localStorage.setItem(`patelKirana_setting_${currentUser}_${name}`, String(value));
}

async function changeMobile() {
    const nextMobile = prompt('Enter your new 10-digit mobile number:');
    if (!nextMobile || !/^[0-9]{10}$/.test(nextMobile)) return showToast('Enter a valid 10-digit mobile number.');
    const user = await dbGet('users', currentUser);
    if (user) { user.mobile = nextMobile; await dbPut('users', user); }
    currentUser = nextMobile;
    localStorage.setItem('currentUser', nextMobile);
    showToast('Mobile number updated locally.');
}

function changeEmail() {
    const email = prompt('Enter your email address:');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return showToast('Enter a valid email address.');
    saveCustomerSetting('email', email);
    showToast('Email address saved.');
}

async function changePassword() {
    const password = prompt('Enter your new password (minimum 4 characters):');
    if (!password || password.length < 4) return showToast('Password must be at least 4 characters.');
    const user = await dbGet('users', currentUser);
    if (user) { user.password = password; await dbPut('users', user); }
    showToast('Password updated locally.');
}

function toggleDarkMode(enabled) {
    document.body.classList.toggle('dark-mode', enabled);
    saveCustomerSetting('darkMode', enabled);
}

function requestLocationPermission() {
    if (!navigator.geolocation) return showToast('Location is not supported by this browser.');
    navigator.geolocation.getCurrentPosition(() => showToast('Location permission granted.'), () => showToast('Location permission was not granted.'));
}

function clearSearchHistory() {
    sessionStorage.removeItem('patelKiranaViewedProducts');
    const search = document.getElementById('productSearch');
    if (search) search.value = '';
    renderCustomerHome();
    showToast('Search history cleared.');
}

async function deleteCustomerAccount() {
    if (!confirm('Delete your account and local data? This cannot be undone.')) return;
    await dbDelete('users', currentUser);
    Object.keys(localStorage).filter(key => key.includes(`_${currentUser}`)).forEach(key => localStorage.removeItem(key));
    logout();
}

function showInfoNotice(title) {
    alert(`${title}\n\nPatel Kirana Store uses your account details only to manage shopping, delivery, payments, and support.`);
}

function showPrivacySettings() {
    alert('Privacy settings\n\nYou can control location permission, notifications, search history, and account deletion from this screen. Your local preferences stay on this device.');
}

function renderCategoriesPage() {
    const container = document.getElementById('categoriesPageGrid');
    if (!container) return;
    const categories = [...new Set(products.map(product => product.category).filter(Boolean))];
    container.innerHTML = categories.map(category => {
        const count = products.filter(product => product.category === category).length;
        return `<button type="button" class="category-page-card" onclick="selectCategory('${category.replace(/'/g, "\\'")}'); showUserSection('shop')"><i class="fas fa-box-open"></i><strong>${category}</strong><small>${count} products</small></button>`;
    }).join('');
}

function managePaymentMethods() {
    showUserSection('payment');
    showToast('Payment methods are available during checkout.');
}

function rateApp() {
    const rating = prompt('Rate Patel Kirana Store from 1 to 5:');
    if (!rating || Number(rating) < 1 || Number(rating) > 5) return;
    showToast(`Thank you for rating us ${Number(rating)} stars.`);
}