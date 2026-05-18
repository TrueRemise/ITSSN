/**
 * booking.js - Booking Logic
 * 配車ロジック - 配車リクエスト処理
 */

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
    window.location.href = '/customer/booking';
}

/**
 * Initialize booking confirmation page (ID 4)
 */
function initBookingMap() {
    const data = JSON.parse(sessionStorage.getItem('pendingBooking') || 'null');
    if (!data) { window.location.href = '/customer/home'; return; }

    // Fill in booking details
    const el = (id) => document.getElementById(id);
    if (el('bookingPickup')) el('bookingPickup').textContent = data.pickupAddress || '--';
    if (el('bookingDestination')) el('bookingDestination').textContent = data.destinationAddress || '--';
    if (el('bookingDistance')) el('bookingDistance').textContent = (data.distanceKm || 0).toFixed(1) + ' km';
    if (el('bookingDuration')) el('bookingDuration').textContent = Math.round(data.durationMin || 0) + ' min';
    if (el('bookingFare')) el('bookingFare').textContent = data.fareFormatted || '--';
    
    const lang = getCurrentLang();
    const typeNames = {
        'COMPACT': { ja: '🚗 コンパクト（4人乗り）', vi: '🚗 Xe nhỏ (4 chỗ)' },
        'SEDAN': { ja: '🚙 セダン（4人乗り）', vi: '🚙 Sedan (4 chỗ)' },
        'SUV': { ja: '🚐 SUV（7人乗り）', vi: '🚐 SUV (7 chỗ)' },
        'PREMIUM': { ja: '✨ プレミアム（4人乗り）', vi: '✨ Premium (4 chỗ)' }
    };
    if (el('bookingVehicle')) {
        const vt = typeNames[data.vehicleType] || { ja: data.vehicleType, vi: data.vehicleType };
        el('bookingVehicle').textContent = lang === 'ja' ? vt.ja : vt.vi;
    }

    // Init map with route
    const map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: data.pickupLat, lng: data.pickupLng }, zoom: 13,
        styles: [
            { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] }
        ],
        disableDefaultUI: true, zoomControl: true
    });
    const ds = new google.maps.DirectionsService();
    const dr = new google.maps.DirectionsRenderer({
        map: map, polylineOptions: { strokeColor: '#6366f1', strokeWeight: 5 }
    });
    ds.route({
        origin: { lat: data.pickupLat, lng: data.pickupLng },
        destination: { lat: data.destinationLat, lng: data.destinationLng },
        travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => { if (status === 'OK') dr.setDirections(result); });
}

/**
 * Submit booking to server
 */
async function submitBooking() {
    const data = JSON.parse(sessionStorage.getItem('pendingBooking') || 'null');
    if (!data) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.token) { window.location.href = '/login'; return; }

    const btn = document.getElementById('confirmBookingBtn');
    btn.classList.add('btn-loading'); btn.disabled = true;

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
                vehicleType: data.vehicleType,
                estimatedDistanceKm: data.distanceKm,
                estimatedDurationMin: data.durationMin,
                estimatedFare: data.fare
            })
        });
        const result = await response.json();
        if (result.success) {
            sessionStorage.removeItem('pendingBooking');
            // Show success overlay on home page
            const overlay = document.getElementById('bookingOverlay');
            if (overlay) { overlay.classList.add('show'); }
            else { alert(t('配車リクエストが送信されました！', 'Đặt xe thành công!')); window.location.href = '/customer/home'; }
        } else {
            alert(result.message || t('配車リクエストに失敗しました', 'Đặt xe thất bại'));
        }
    } catch (err) {
        console.error('Booking error:', err);
        alert(t('ネットワークエラー', 'Lỗi kết nối'));
    } finally {
        btn.classList.remove('btn-loading'); btn.disabled = false;
    }
}

function closeBookingOverlay() {
    const overlay = document.getElementById('bookingOverlay');
    if (overlay) overlay.classList.remove('show');
    window.location.href = '/customer/home';
}