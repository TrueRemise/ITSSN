/**
 * booking.js - Booking Logic
 * 配車ロジック - 配車リクエスト処理
 */
let bookingMap;
let bookingDirectionsService;
let bookingDirectionsRenderer;
let bookingRouteData = null;
let bookingVehicle = null;
let selectedCouponDiscount = 0;
let driverMarker = null;
let bookingPageInitialized = false;

const BOOKING_DRIVER = {
    name: { ja: 'プロフィール', vi: 'Hồ sơ' },
    phone: '0965187176'
};

const BOOKING_VEHICLE_NAMES = {
    COMPACT: { ja: 'コンパクトカー', vi: 'Xe compact' },
    SEDAN: { ja: 'セダン', vi: 'Sedan' },
    SUV: { ja: 'SUV', vi: 'SUV' },
    PREMIUM: { ja: 'プレミアム', vi: 'Premium' }
};

const BOOKING_VEHICLE_DESCRIPTIONS = {
    COMPACT: { ja: 'お手頃価格で気軽に移動', vi: 'Di chuyển tiết kiệm' },
    SEDAN: { ja: '快適でバランスの良い移動', vi: 'Thoải mái và cân bằng' },
    SUV: { ja: '快適でバランスの良い移動', vi: 'Rộng rãi và tiện nghi' },
    PREMIUM: { ja: '高級で快適な移動体験', vi: 'Trải nghiệm cao cấp' }
};

const STATIC_PREVIEW_BOOKING_DATA = {
    pickupAddress: 'Hoàn Kiếm, Hà Nội',
    pickupLat: 21.028511,
    pickupLng: 105.804817,
    destinationAddress: 'Hồ Tây, Hà Nội',
    destinationLat: 21.058273,
    destinationLng: 105.821362,
    distanceKm: 6.2,
    durationMin: 18,
    vehicleType: 'SEDAN',
    fare: 113000,
    fareFormatted: '113.000₫'
};

function isStaticFilePreview() {
    return window.location.protocol === 'file:';
}

function navigateToAppPage(appPath, staticPath) {
    window.location.href = isStaticFilePreview() ? staticPath : appPath;
}

/**
 * Confirm booking from customer home (ID 3 → ID 4)
 */
function confirmBooking() {
    if (!currentRouteData || !selectedVehicle) {
        alert(t('車種を選択してください', 'Vui lòng chọn loại xe'));
        return;
    }
    // Store booking data in sessionStorage for booking page
    const bookingData = {
        ...currentRouteData,
        vehicleType: selectedVehicle.type,
        fare: selectedVehicle.fare,
        fareFormatted: selectedVehicle.fareFormatted
    };
    sessionStorage.setItem('pendingBooking', JSON.stringify(bookingData));
    navigateToAppPage('/customer/booking', '../../templates/customer/booking.html');
}

/**
 * Initialize booking page data and side-panel state independently from Google Maps.
 */
function initBookingPage() {
    if (bookingPageInitialized) return Boolean(bookingRouteData);

    bookingRouteData = JSON.parse(sessionStorage.getItem('pendingBooking') || 'null');
    if (!bookingRouteData) {
        if (!isStaticFilePreview()) {
            navigateToAppPage('/customer/home', '../../templates/customer/home.html');
            return false;
        }

        bookingRouteData = { ...STATIC_PREVIEW_BOOKING_DATA };
        sessionStorage.setItem('pendingBooking', JSON.stringify(bookingRouteData));
    }

    bookingPageInitialized = true;
    loadUserInfo();
    hydrateBookingDetails();
    renderBookingVehicles();
    showBookingStep('request');
    return true;
}

/**
 * Initialize booking page with Google Maps route and side-panel state.
 */
function initBookingMap() {
    if (!initBookingPage()) return;

    if (!window.google?.maps) {
        handleBookingMapLoadError();
        return;
    }

    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    bookingMap = new google.maps.Map(mapElement, {
        center: { lat: bookingRouteData.pickupLat, lng: bookingRouteData.pickupLng },
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false
    });

    bookingDirectionsService = new google.maps.DirectionsService();
    bookingDirectionsRenderer = new google.maps.DirectionsRenderer({
        map: bookingMap,
        suppressMarkers: false,
        polylineOptions: {
            strokeColor: '#f4bd18',
            strokeOpacity: 0.95,
            strokeWeight: 6
        }
    });

    drawBookingRoute(false);
    updateBookingMapFallback(false);
}

function hydrateBookingDetails() {
    const pickup = document.getElementById('bookingPickup');
    const destination = document.getElementById('bookingDestination');
    const trackingPickup = document.getElementById('trackingPickup');
    const trackingDestination = document.getElementById('trackingDestination');

    if (pickup) setElementValueOrText(pickup, bookingRouteData.pickupAddress || '');
    if (destination) setElementValueOrText(destination, bookingRouteData.destinationAddress || '');
    if (trackingPickup) trackingPickup.textContent = bookingRouteData.pickupAddress || '--';
    if (trackingDestination) trackingDestination.textContent = bookingRouteData.destinationAddress || '--';

    const distance = document.getElementById('bookingDistance');
    const duration = document.getElementById('bookingDuration');
    if (distance) distance.textContent = formatDistance(bookingRouteData.distanceKm);
    if (duration) duration.textContent = formatDuration(bookingRouteData.durationMin);

    bookingVehicle = {
        type: bookingRouteData.vehicleType,
        fare: Number(bookingRouteData.fare || 0),
        fareFormatted: bookingRouteData.fareFormatted || formatVnd(bookingRouteData.fare || 0)
    };

    updateVehicleInfoText();
    updateFareDisplay();
}

function renderBookingVehicles() {
    const list = document.getElementById('bookingVehicleList');
    if (!list) return;

    const lang = getCurrentLang();
    const types = ['COMPACT', 'SEDAN', 'SUV', 'PREMIUM'];
    const fares = buildBookingFares();

    list.innerHTML = types.map((type) => {
        const fare = fares[type];
        const selected = type === bookingVehicle.type ? ' is-selected' : '';
        return `
            <button class="booking-vehicle-option${selected}" type="button" data-type="${type}" onclick="selectBookingVehicle(this)">
                <span class="booking-vehicle-row">
                    <span>${BOOKING_VEHICLE_NAMES[type][lang]}</span>
                    <span class="booking-vehicle-price">${fare.fareFormatted}</span>
                </span>
                <span class="booking-vehicle-desc">${BOOKING_VEHICLE_DESCRIPTIONS[type][lang]}</span>
            </button>`;
    }).join('');
}

function buildBookingFares() {
    const km = Number(bookingRouteData.distanceKm || 0);
    const fareDefs = {
        COMPACT: { base: 15000, s: 12000, l: 10000 },
        SEDAN: { base: 20000, s: 15000, l: 12000 },
        SUV: { base: 25000, s: 18000, l: 15000 },
        PREMIUM: { base: 35000, s: 25000, l: 20000 }
    };

    return Object.fromEntries(Object.entries(fareDefs).map(([type, def]) => {
        let fare = km <= 30 ? def.base + km * def.s : def.base + 30 * def.s + (km - 30) * def.l;
        if (!km && type === bookingRouteData.vehicleType) fare = Number(bookingRouteData.fare || 0);
        fare = Math.ceil(fare / 1000) * 1000;
        return [type, { fare, fareFormatted: formatVnd(fare) }];
    }));
}

function selectBookingVehicle(button) {
    const type = button.dataset.type;
    const fare = buildBookingFares()[type];
    document.querySelectorAll('.booking-vehicle-option').forEach((option) => option.classList.remove('is-selected'));
    button.classList.add('is-selected');
    bookingVehicle = { type, ...fare };
    bookingRouteData.vehicleType = type;
    bookingRouteData.fare = fare.fare;
    bookingRouteData.fareFormatted = fare.fareFormatted;
    sessionStorage.setItem('pendingBooking', JSON.stringify(bookingRouteData));
    updateVehicleInfoText();
    updateFareDisplay();
}

function showDriverDetails() {
    updateVehicleInfoText();
    updateFareDisplay();
    showBookingStep('driver');
}

function selectCoupon(button) {
    selectedCouponDiscount = Number(button.dataset.discount || 0);
    document.querySelectorAll('.coupon-card').forEach((card) => card.classList.remove('is-selected'));
    button.classList.add('is-selected');
    updateFareDisplay();
}

function updateFareDisplay() {
    const original = Number(bookingVehicle?.fare || 0);
    const discounted = Math.round((original * (100 - selectedCouponDiscount)) / 100 / 1000) * 1000;
    const discountedText = formatVnd(discounted || original);
    const originalText = bookingVehicle?.fareFormatted || formatVnd(original);

    const discountedFare = document.getElementById('discountedFare');
    const originalFare = document.getElementById('originalFare');
    const finalFare = document.getElementById('finalFare');

    if (discountedFare) discountedFare.textContent = discountedText;
    if (originalFare) originalFare.textContent = originalText;
    if (finalFare) finalFare.textContent = discountedText;

    const trackingFare = document.getElementById('trackingFare');
    if (trackingFare) trackingFare.textContent = discountedText;
}

function updateVehicleInfoText() {
    const lang = getCurrentLang();
    const vehicleName = BOOKING_VEHICLE_NAMES[bookingVehicle?.type]?.[lang] || '--';
    const driverVehicleInfo = document.getElementById('driverVehicleInfo');
    const trackingVehicleInfo = document.getElementById('trackingVehicleInfo');
    const bookingVehicleInfo = document.getElementById('bookingVehicle');

    if (driverVehicleInfo) driverVehicleInfo.textContent = vehicleName;
    if (trackingVehicleInfo) trackingVehicleInfo.textContent = vehicleName;
    if (bookingVehicleInfo) bookingVehicleInfo.textContent = vehicleName;
}

function showBookingStep(step) {
    document.querySelectorAll('.booking-step').forEach((panel) => {
        panel.classList.toggle('is-active', panel.dataset.step === step);
    });

    if (step === 'tracking') drawBookingRoute(true);
    if (bookingMap) setTimeout(() => google.maps.event.trigger(bookingMap, 'resize'), 0);
}

function drawBookingRoute(includeDriver) {
    if (!bookingDirectionsService || !bookingDirectionsRenderer || !window.google?.maps) return;

    bookingDirectionsService.route({
        origin: { lat: bookingRouteData.pickupLat, lng: bookingRouteData.pickupLng },
        destination: { lat: bookingRouteData.destinationLat, lng: bookingRouteData.destinationLng },
        travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
        if (status !== 'OK') return;
        bookingDirectionsRenderer.setDirections(result);
        if (includeDriver) placeDriverMarker(result.routes[0].legs[0]);
    });
}

function placeDriverMarker(leg) {
    if (driverMarker) driverMarker.setMap(null);
    const start = leg.start_location;
    const end = leg.end_location;
    const position = {
        lat: (start.lat() + end.lat()) / 2,
        lng: (start.lng() + end.lng()) / 2
    };

    driverMarker = new google.maps.Marker({
        position,
        map: bookingMap,
        label: '🚕',
        zIndex: 10
    });
}

/**
 * Submit booking to server
 */
async function submitBooking() {
    const data = bookingRouteData || JSON.parse(sessionStorage.getItem('pendingBooking') || 'null');
    if (!data) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.token) {
        navigateToAppPage('/login', '../../templates/auth/login.html');
        return;
    }

    const btn = document.getElementById('confirmBookingBtn');
    btn.classList.add('btn-loading');
    btn.disabled = true;

    try {
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({
                pickupAddress: data.pickupAddress,
                pickupLat: data.pickupLat,
                pickupLng: data.pickupLng,
                destinationAddress: data.destinationAddress,
                destinationLat: data.destinationLat,
                destinationLng: data.destinationLng,
                vehicleType: bookingVehicle.type,
                estimatedDistanceKm: data.distanceKm,
                estimatedDurationMin: data.durationMin,
                estimatedFare: bookingVehicle.fare
            })
        });
        const result = await response.json();
        if (result.success) {
            showBookingStep('tracking');
        } else {
            alert(result.message || t('配車リクエストに失敗しました', 'Đặt xe thất bại'));
        }
    } catch (err) {
        console.error('Booking error:', err);
        alert(t('ネットワークエラー', 'Lỗi kết nối'));
    } finally {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
    }
}

function cancelTracking() {
    sessionStorage.removeItem('pendingBooking');
    navigateToAppPage('/customer/home', '../../templates/customer/home.html');
}

function closeBookingOverlay() {
    cancelTracking();
}

function updateBookingMapFallback(visible, message) {
    const fallback = document.getElementById('bookingMapFallback');
    if (!fallback) return;

    if (message) fallback.textContent = message;
    fallback.classList.toggle('is-hidden', !visible);
}

function handleBookingMapLoadError() {
    initBookingPage();
    updateBookingMapFallback(true, t(
        'Google Mapsを読み込めませんでした。APIキーとネットワーク設定を確認してください。',
        'Không thể tải Google Maps. Vui lòng kiểm tra API key và kết nối mạng.'
    ));
}

function setElementValueOrText(element, value) {
    if ('value' in element) element.value = value;
    else element.textContent = value;
}

function formatDistance(km) {
    const value = Number(km || 0);
    if (!value) return '--';
    return `${value.toFixed(value >= 10 ? 0 : 1)} km`;
}

function formatDuration(minutes) {
    const value = Math.round(Number(minutes || 0));
    if (!value) return '--';
    return `${value} min`;
}

function formatVnd(value) {
    return new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + '₫';
}

function loadUserInfo() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.token && !isStaticFilePreview()) {
        navigateToAppPage('/login', '../../templates/auth/login.html');
        return;
    }

    const displayName = user.fullName || t('ユーザー名', 'Tên người dùng');
    const name = document.getElementById('userName');
    const avatar = document.getElementById('userAvatar');
    if (name) name.textContent = displayName;
    if (avatar) avatar.textContent = displayName.charAt(0).toUpperCase();
}

function logout() {
    localStorage.removeItem('user');
    document.cookie = 'jwt_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    navigateToAppPage('/login', '../../templates/auth/login.html');
}

document.addEventListener('languageChanged', () => {
    if (!bookingRouteData) return;
    renderBookingVehicles();
    updateVehicleInfoText();
});


document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('bookingVehicleList')) initBookingPage();
});
