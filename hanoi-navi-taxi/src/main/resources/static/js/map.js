/**
 * map.js - Google Maps Integration
 * Google Maps連携 - 地図表示・ルート検索
 */
let map, directionsService, directionsRenderer;
let pickupAutocomplete, destinationAutocomplete;
let pickupMarker, destinationMarker;
let currentRouteData = null;
let selectedVehicle = null;
const HANOI_CENTER = { lat: 21.0285, lng: 105.8542 };

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: HANOI_CENTER, zoom: 13,
        styles: [
            { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c6675" }] },
            { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
            { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#023e58" }] },
            { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] }
        ],
        disableDefaultUI: false, zoomControl: true,
        streetViewControl: false, mapTypeControl: false
    });
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map, suppressMarkers: false,
        polylineOptions: { strokeColor: '#6366f1', strokeWeight: 5, strokeOpacity: 0.8 }
    });
    const pickupInput = document.getElementById('pickupInput');
    if (pickupInput) {
        pickupAutocomplete = new google.maps.places.Autocomplete(pickupInput, {
            componentRestrictions: { country: 'vn' }, fields: ['formatted_address', 'geometry', 'name']
        });
        pickupAutocomplete.addListener('place_changed', () => {
            const place = pickupAutocomplete.getPlace();
            if (place.geometry) setMarker('pickup', place.geometry.location.lat(), place.geometry.location.lng());
        });
    }
    const destInput = document.getElementById('destinationInput');
    if (destInput) {
        destinationAutocomplete = new google.maps.places.Autocomplete(destInput, {
            componentRestrictions: { country: 'vn' }, fields: ['formatted_address', 'geometry', 'name']
        });
        destinationAutocomplete.addListener('place_changed', () => {
            const place = destinationAutocomplete.getPlace();
            if (place.geometry) setMarker('dest', place.geometry.location.lat(), place.geometry.location.lng());
        });
    }
    loadUserInfo();
}

function setMarker(type, lat, lng) {
    const color = type === 'pickup' ? '#22c55e' : '#ef4444';
    const marker = new google.maps.Marker({
        position: { lat, lng }, map: map,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
    });
    if (type === 'pickup') { if (pickupMarker) pickupMarker.setMap(null); pickupMarker = marker; }
    else { if (destinationMarker) destinationMarker.setMap(null); destinationMarker = marker; }
    map.panTo({ lat, lng });
}

function useCurrentLocation() {
    const btn = document.getElementById('currentLocBtn');
    if (!navigator.geolocation) { alert(t('ブラウザが位置情報をサポートしていません', 'Trình duyệt không hỗ trợ định vị')); return; }
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: { lat: pos.coords.latitude, lng: pos.coords.longitude } }, (results, status) => {
                const addr = (status === 'OK' && results[0]) ? results[0].formatted_address : `${pos.coords.latitude}, ${pos.coords.longitude}`;
                document.getElementById('pickupInput').value = addr;
                setMarker('pickup', pos.coords.latitude, pos.coords.longitude);
                map.setZoom(15);
                btn.disabled = false;
            });
        },
        () => { alert(t('位置情報の取得に失敗しました', 'Không thể lấy vị trí')); btn.disabled = false; },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function searchRoute() {
    const pickup = document.getElementById('pickupInput').value.trim();
    const dest = document.getElementById('destinationInput').value.trim();
    const btn = document.getElementById('searchRouteBtn');
    if (!pickup || !dest) { alert(t('乗車地と降車地を入力してください', 'Vui lòng nhập điểm đón và điểm đến')); return; }
    btn.classList.add('btn-loading'); btn.disabled = true;
    directionsService.route({ origin: pickup, destination: dest, travelMode: google.maps.TravelMode.DRIVING },
        (result, status) => {
            btn.classList.remove('btn-loading'); btn.disabled = false;
            if (status === 'OK') {
                directionsRenderer.setDirections(result);
                const leg = result.routes[0].legs[0];
                const distKm = leg.distance.value / 1000;
                document.getElementById('routeDistance').textContent = leg.distance.text;
                document.getElementById('routeDuration').textContent = leg.duration.text;
                const fares = calcFares(distKm);
                displayVehicles(fares);
                currentRouteData = {
                    pickupAddress: leg.start_address, pickupLat: leg.start_location.lat(), pickupLng: leg.start_location.lng(),
                    destinationAddress: leg.end_address, destinationLat: leg.end_location.lat(), destinationLng: leg.end_location.lng(),
                    distanceKm: distKm, durationMin: leg.duration.value / 60
                };
                document.getElementById('routeResults').classList.add('show');
            } else { alert(t('ルートが見つかりません', 'Không tìm thấy lộ trình')); }
        });
}

function calcFares(km) {
    const types = [
        { type: 'COMPACT', ja: 'コンパクト', vi: 'Xe nhỏ', icon: '🚗', seats: 4, base: 15000, s: 12000, l: 10000 },
        { type: 'SEDAN', ja: 'セダン', vi: 'Sedan', icon: '🚙', seats: 4, base: 20000, s: 15000, l: 12000 },
        { type: 'SUV', ja: 'SUV', vi: 'SUV 7 chỗ', icon: '🚐', seats: 7, base: 25000, s: 18000, l: 15000 },
        { type: 'PREMIUM', ja: 'プレミアム', vi: 'Premium', icon: '✨', seats: 4, base: 35000, s: 25000, l: 20000 }
    ];
    return types.map(t => {
        let fare = km <= 30 ? t.base + km * t.s : t.base + 30 * t.s + (km - 30) * t.l;
        fare = Math.ceil(fare / 1000) * 1000;
        return { ...t, fare, fareFormatted: new Intl.NumberFormat('vi-VN').format(fare) + '₫' };
    });
}

function displayVehicles(fares) {
    const list = document.getElementById('vehicleList');
    const lang = getCurrentLang();
    list.innerHTML = fares.map(f => `
        <div class="vehicle-card" onclick="selectVehicle(this,'${f.type}',${f.fare},'${f.fareFormatted}')" data-type="${f.type}">
            <div class="vehicle-icon">${f.icon}</div>
            <div class="vehicle-info">
                <div class="vehicle-name">${lang === 'ja' ? f.ja : f.vi}</div>
                <div class="vehicle-seats">${f.seats} ${lang === 'ja' ? '人乗り' : 'chỗ'}</div>
            </div>
            <div class="vehicle-price">${f.fareFormatted}</div>
        </div>`).join('');
}

function selectVehicle(el, type, fare, fareFormatted) {
    document.querySelectorAll('.vehicle-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedVehicle = { type, fare, fareFormatted };
    document.getElementById('bookBtn').disabled = false;
}

function loadUserInfo() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.token) { window.location.href = '/login'; return; }
    const n = document.getElementById('userName');
    const a = document.getElementById('userAvatar');
    if (n) n.textContent = user.fullName || '';
    if (a) a.textContent = (user.fullName || '?').charAt(0).toUpperCase();
}

function logout() {
    localStorage.removeItem('user');
    document.cookie = 'jwt_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    window.location.href = '/login';
}