/**
 * Nearby Optical Stores Map & Navigation Module
 * Initializes Leaflet map, renders branch markers, calculates distances, and provides turn-by-turn routing.
 */
document.addEventListener('DOMContentLoaded', () => {
    let map = null;
    const storeMarkers = {};
    let userMarker = null;
    let routePolyline = null;
    let currentUserCoords = null;

    const mapTilerKey = window.MAPTILER_KEY || '';
    const initialLat = 23.8103;
    const initialLng = 90.4125;
    const initialZoom = 12;

    const createStoreIcon = (isSelected = false) => {
        return L.divIcon({
            className: 'custom-store-pin' + (isSelected ? ' active' : ''),
            html: `<div class="pin-inner">👓</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 36],
            popupAnchor: [0, -32]
        });
    };

    const createUserIcon = () => {
        return L.divIcon({
            className: 'custom-user-pin',
            html: `<div class="user-pulse-ring"></div><div class="user-pin-inner">📍</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
    };

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function initMap() {
        const container = document.getElementById('store-map');
        if (!container || typeof L === 'undefined') return;

        map = L.map('store-map', {
            zoomControl: true,
            scrollWheelZoom: true
        }).setView([initialLat, initialLng], initialZoom);

        // The two tile providers do not serve the same tile geometry: MapTiler
        // returns 512px tiles (so Leaflet must request one zoom level out),
        // while the OpenStreetMap tile server returns 256px. Declaring 512 for
        // both upscales every OSM tile to double size and shows the map a zoom
        // level short, so each source carries its own dimensions.
        let tileLayerConfig = {
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            tileSize: 256,
            zoomOffset: 0
        };

        if (mapTilerKey && mapTilerKey.trim() !== '' && mapTilerKey !== 'your_maptiler_api_key_here') {
            tileLayerConfig = {
                url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerKey}`,
                attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
                tileSize: 512,
                zoomOffset: -1
            };
        }

        L.tileLayer(tileLayerConfig.url, {
            maxZoom: 19,
            tileSize: tileLayerConfig.tileSize,
            zoomOffset: tileLayerConfig.zoomOffset,
            attribution: tileLayerConfig.attribution
        }).addTo(map);

        if (Array.isArray(window.STORE_DATA)) {
            window.STORE_DATA.forEach(store => {
                const marker = L.marker([store.lat, store.lng], {
                    icon: createStoreIcon(false)
                }).addTo(map);

                const popupContent = `
                    <div class="map-popup-card">
                        <strong class="popup-title">${escapeHtml(store.name)}</strong>
                        <p class="popup-addr">📍 ${escapeHtml(store.address)}</p>
                        <p class="popup-hours">🕒 ${escapeHtml(store.hours)}</p>
                        <p class="popup-phone">📞 <a href="tel:${store.phone}">${escapeHtml(store.phone)}</a></p>
                        <button class="btn btn-primary btn-xs" style="width: 100%; margin-top: 0.5rem;" onclick="getDirectionsToStore(${store.id})">
                            🗺️ Get Directions
                        </button>
                    </div>
                `;

                marker.bindPopup(popupContent);
                marker.on('click', () => {
                    highlightStoreCard(store.id);
                });
                storeMarkers[store.id] = marker;
            });
        }
    }

    // Every branch card carries name, address, opening hours, contact number,
    // and — once an origin is known — distance. Both the distance-sorted list
    // and the reset-to-default list are drawn here so the two never drift.
    function renderStoreCards(stores) {
        const container = document.getElementById('stores-container');
        if (!container) return;

        container.innerHTML = '';
        stores.forEach(store => {
            const hasDistance = typeof store.distance === 'number' && isFinite(store.distance);
            const formattedDist = !hasDistance
                ? ''
                : store.distance < 1
                    ? `${Math.round(store.distance * 1000)} m`
                    : `${store.distance.toFixed(1)} km`;

            const card = document.createElement('div');
            card.className = 'store-card glass-panel';
            card.setAttribute('data-id', store.id);
            card.setAttribute('data-lat', store.lat);
            card.setAttribute('data-lng', store.lng);
            card.setAttribute('data-name', store.name);
            card.setAttribute('data-area', store.area);

            card.innerHTML = `
                <div class="store-card-header">
                    <h4 class="store-name">${escapeHtml(store.name)}</h4>
                    <span class="distance-badge"${hasDistance ? '' : ' style="display: none;"'}>📍 ${formattedDist}</span>
                </div>
                <p class="store-address">📍 ${escapeHtml(store.address)}</p>
                <div class="store-meta">
                    <span class="meta-item">🕒 ${escapeHtml(store.hours)} (${escapeHtml(store.openDays || '')})</span>
                    <span class="meta-item">📞 <a href="tel:${escapeHtml(store.phone)}">${escapeHtml(store.phone)}</a></span>
                </div>
                <div class="store-card-actions">
                    <button class="btn btn-secondary btn-sm btn-focus-store" onclick="focusStoreOnMap(${store.id})">
                        🔍 View on Map
                    </button>
                    <button class="btn btn-primary btn-sm btn-get-directions" onclick="getDirectionsToStore(${store.id})">
                        🗺️ Get Directions
                    </button>
                </div>
            `;
            container.appendChild(card);
        });

        const branchCount = document.getElementById('branch-count');
        if (branchCount) branchCount.textContent = stores.length;
    }

    function updateDistancesAndSort(originLat, originLng, originLabel) {
        currentUserCoords = { lat: originLat, lng: originLng };

        if (userMarker && map) {
            map.removeLayer(userMarker);
        }
        if (map) {
            userMarker = L.marker([originLat, originLng], {
                icon: createUserIcon(),
                zIndexOffset: 1000
            }).addTo(map);
        }

        const stores = window.STORE_DATA || [];
        const storesWithDist = stores.map(store => {
            const dist = calculateDistance(originLat, originLng, store.lat, store.lng);
            return { ...store, distance: dist };
        });

        storesWithDist.sort((a, b) => a.distance - b.distance);
        renderStoreCards(storesWithDist);

        const statusDiv = document.getElementById('location-status-bar');
        const statusText = document.getElementById('location-status-text');
        const sortBadge = document.getElementById('sort-badge');
        
        if (statusText) statusText.textContent = `Showing stores near: ${originLabel}`;
        if (statusDiv) statusDiv.style.display = 'flex';
        if (sortBadge) {
            sortBadge.textContent = 'Sorted by distance (nearest first)';
            sortBadge.classList.add('active');
        }

        if (storesWithDist.length > 0 && map) {
            const nearest = storesWithDist[0];
            const bounds = L.latLngBounds([
                [originLat, originLng],
                [nearest.lat, nearest.lng]
            ]);
            map.fitBounds(bounds.pad(0.3));
        }
    }

    window.focusStoreOnMap = function(storeId) {
        const store = (window.STORE_DATA || []).find(s => s.id === storeId);
        if (!store || !map) return;

        map.setView([store.lat, store.lng], 15, { animate: true });
        if (storeMarkers[storeId]) {
            storeMarkers[storeId].openPopup();
        }
        highlightStoreCard(storeId);
    };

    function highlightStoreCard(storeId) {
        document.querySelectorAll('.store-card').forEach(c => c.classList.remove('active-card'));
        const card = document.querySelector(`.store-card[data-id="${storeId}"]`);
        if (card) {
            card.classList.add('active-card');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // Directions are only meaningful from a place the customer actually chose.
    // Ask the device first; a refusal leaves the area picker as the answer.
    function requestDeviceLocation() {
        return new Promise(resolve => {
            if (!navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }

    function promptForStartingPoint(store) {
        const dirPanel = document.getElementById('directions-panel');
        document.getElementById('dir-destination-name').textContent = store.name;
        document.getElementById('dir-destination-address').textContent = store.address;
        document.getElementById('dir-total-distance').textContent = '--';
        document.getElementById('dir-total-time').textContent = '--';

        const gmapsLink = document.getElementById('dir-gmaps-link');
        // Without an origin, hand Google Maps the destination alone and let it
        // route from wherever the customer opens it.
        if (gmapsLink) {
            gmapsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}&travelmode=driving`;
        }

        document.getElementById('directions-steps-list').innerHTML = `
            <li class="step-item">
                <span class="step-num">!</span>
                <span class="step-icon">📍</span>
                <div class="step-details">
                    <p class="step-text">Choose a starting point first — tap <strong>Use My Location</strong> or pick your area from the dropdown, then ask for directions again.</p>
                </div>
            </li>
        `;

        if (dirPanel) {
            dirPanel.style.display = 'block';
            dirPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    window.getDirectionsToStore = async function(storeId) {
        const store = (window.STORE_DATA || []).find(s => s.id === storeId);
        if (!store) return;

        if (!currentUserCoords) {
            const located = await requestDeviceLocation();
            if (!located) {
                promptForStartingPoint(store);
                return;
            }
            // Reuse the normal location flow so the list re-sorts and the
            // status bar reflects where the route starts from.
            updateDistancesAndSort(located.lat, located.lng, 'Your Device Location');
        }

        const startLat = currentUserCoords.lat;
        const startLng = currentUserCoords.lng;
        const endLat = store.lat;
        const endLng = store.lng;

        const dirPanel = document.getElementById('directions-panel');
        document.getElementById('dir-destination-name').textContent = store.name;
        document.getElementById('dir-destination-address').textContent = store.address;
        document.getElementById('dir-total-distance').textContent = 'Calculating...';
        document.getElementById('dir-total-time').textContent = 'Calculating...';
        
        const stepsList = document.getElementById('directions-steps-list');
        stepsList.innerHTML = `<li class="step-item loading">⏳ Fetching route guidance...</li>`;
        
        if (dirPanel) {
            dirPanel.style.display = 'block';
            dirPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${endLat},${endLng}&travelmode=driving`;
        const gmapsLink = document.getElementById('dir-gmaps-link');
        if (gmapsLink) gmapsLink.href = gmapsUrl;

        if (routePolyline && map) {
            map.removeLayer(routePolyline);
            routePolyline = null;
        }

        try {
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
            const resp = await fetch(osrmUrl);
            if (!resp.ok) throw new Error('Routing service error');
            const data = await resp.json();

            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const distanceKm = (route.distance / 1000).toFixed(1);
                const durationMin = Math.round(route.duration / 60);

                document.getElementById('dir-total-distance').textContent = `${distanceKm} km`;
                document.getElementById('dir-total-time').textContent = `~${durationMin} min`;

                const routeCoords = route.geometry.coordinates.map(c => [c[1], c[0]]);
                if (map) {
                    routePolyline = L.polyline(routeCoords, {
                        color: '#6366f1',
                        weight: 6,
                        opacity: 0.85,
                        dashArray: '10, 10',
                        lineCap: 'round'
                    }).addTo(map);

                    map.fitBounds(routePolyline.getBounds().pad(0.2));
                }

                stepsList.innerHTML = '';
                if (route.legs && route.legs[0] && route.legs[0].steps) {
                    route.legs[0].steps.forEach((step, idx) => {
                        const stepDist = step.distance < 1000 ? `${Math.round(step.distance)} m` : `${(step.distance / 1000).toFixed(1)} km`;
                        const stepIcon = maneuverIcon(step.maneuver);

                        const li = document.createElement('li');
                        li.className = 'step-item';
                        li.innerHTML = `
                            <span class="step-num">${idx + 1}</span>
                            <span class="step-icon">${stepIcon}</span>
                            <div class="step-details">
                                <p class="step-text">${formatManeuverText(step)}</p>
                                <span class="step-dist">${stepDist}</span>
                            </div>
                        `;
                        stepsList.appendChild(li);
                    });
                }
            } else {
                throw new Error('No route found');
            }
        } catch (err) {
            console.warn('Routing API fallback:', err);
            const dist = calculateDistance(startLat, startLng, endLat, endLng);
            const formattedDist = dist.toFixed(1);
            const estTime = Math.round(dist * 3 + 5);

            document.getElementById('dir-total-distance').textContent = `${formattedDist} km`;
            document.getElementById('dir-total-time').textContent = `~${estTime} min`;

            if (map) {
                routePolyline = L.polyline([
                    [startLat, startLng],
                    [endLat, endLng]
                ], {
                    color: '#6366f1',
                    weight: 4,
                    dashArray: '8, 8'
                }).addTo(map);

                map.fitBounds(routePolyline.getBounds().pad(0.2));
            }

            stepsList.innerHTML = `
                <li class="step-item">
                    <span class="step-num">1</span>
                    <span class="step-icon">🛫</span>
                    <div class="step-details">
                        <p class="step-text">Start from your selected starting location.</p>
                        <span class="step-dist">0.0 km</span>
                    </div>
                </li>
                <li class="step-item">
                    <span class="step-num">2</span>
                    <span class="step-icon">🚗</span>
                    <div class="step-details">
                        <p class="step-text">Head towards <strong>${escapeHtml(store.area)}</strong> via main city roads.</p>
                        <span class="step-dist">~${formattedDist} km</span>
                    </div>
                </li>
                <li class="step-item">
                    <span class="step-num">3</span>
                    <span class="step-icon">🏁</span>
                    <div class="step-details">
                        <p class="step-text">Arrive at <strong>${escapeHtml(store.name)}</strong> (${escapeHtml(store.address)}).</p>
                    </div>
                </li>
            `;
        }
    };

    // OSRM reports the direction of travel in maneuver.modifier; maneuver.type
    // says what kind of manoeuvre it is. Reading the turn direction off `type`
    // never matches, which is how every turn ended up with the same arrow.
    function maneuverIcon(maneuver) {
        const type = maneuver.type || '';
        const modifier = maneuver.modifier || '';

        if (type === 'arrive') return '🏁';
        if (type === 'depart') return '🛫';
        if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return '🔄';
        if (type === 'merge') return '🔀';
        if (type === 'on ramp' || type === 'off ramp') return '🛣️';

        if (modifier === 'uturn') return '↩️';
        if (modifier.includes('left')) return '⬅️';
        if (modifier.includes('right')) return '➡️';
        if (modifier === 'straight') return '⬆️';
        return '⬆️';
    }

    function formatManeuverText(step) {
        const type = step.maneuver.type;
        const modifier = step.maneuver.modifier || '';
        const rawName = step.name || '';
        const name = rawName ? `<strong>${escapeHtml(rawName)}</strong>` : '';
        const onto = name ? ` onto ${name}` : '';
        const on = name ? ` on ${name}` : '';

        if (type === 'depart') return `Head ${modifier}${on}`.trim();
        if (type === 'arrive') return `Arrive at your destination on the ${modifier || 'right'}`;
        if (type === 'turn') {
            return modifier === 'uturn' ? `Make a U-turn${onto}` : `Turn ${modifier}${onto}`;
        }
        if (type === 'new name') return `Continue${modifier && modifier !== 'straight' ? ' ' + modifier : ''}${onto}`;
        if (type === 'continue') {
            return modifier === 'uturn' ? `Make a U-turn${onto}` : `Continue ${modifier}${on}`.trim();
        }
        if (type === 'end of road') return `At the end of the road, turn ${modifier}${onto}`;
        if (type === 'fork') return `Keep ${modifier} at the fork${onto}`;
        if (type === 'merge') return `Merge ${modifier}${onto}`.replace('  ', ' ');
        if (type === 'on ramp') return `Take the ramp${modifier ? ' on the ' + modifier : ''}${onto}`;
        if (type === 'off ramp') return `Take the exit${modifier ? ' on the ' + modifier : ''}${onto}`;
        if (type === 'roundabout' || type === 'rotary') {
            const exit = step.maneuver.exit ? ` and take exit ${step.maneuver.exit}` : '';
            return `Enter the roundabout${exit}${onto}`;
        }
        if (type === 'exit roundabout' || type === 'exit rotary') return `Exit the roundabout${onto}`;
        if (type === 'roundabout turn') return `At the roundabout, turn ${modifier}${onto}`;

        return `Continue ${modifier}${on}`.replace(/\s+/g, ' ').trim();
    }

    window.closeDirections = function() {
        const dirPanel = document.getElementById('directions-panel');
        if (dirPanel) dirPanel.style.display = 'none';
        if (routePolyline && map) {
            map.removeLayer(routePolyline);
            routePolyline = null;
        }
    };

    const btnLocation = document.getElementById('btn-use-location');
    if (btnLocation) {
        btnLocation.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert('Geolocation is not supported by your browser.');
                return;
            }

            btnLocation.disabled = true;
            btnLocation.innerHTML = `<span class="spinner-sm"></span> Locating...`;

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    btnLocation.disabled = false;
                    btnLocation.innerHTML = `<span class="icon">📍</span> Use My Location`;
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    updateDistancesAndSort(lat, lng, 'Your Device Location');
                },
                (err) => {
                    btnLocation.disabled = false;
                    btnLocation.innerHTML = `<span class="icon">📍</span> Use My Location`;
                    let msg = 'Unable to retrieve your location.';
                    if (err.code === err.PERMISSION_DENIED) {
                        msg = 'Location permission denied. Please allow location access or select an area manually from the dropdown.';
                    }
                    alert(msg);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }

    const areaSelect = document.getElementById('area-select');
    if (areaSelect) {
        areaSelect.addEventListener('change', (e) => {
            const selectedOpt = areaSelect.options[areaSelect.selectedIndex];
            if (!selectedOpt.value) return;

            const lat = parseFloat(selectedOpt.getAttribute('data-lat'));
            const lng = parseFloat(selectedOpt.getAttribute('data-lng'));
            const areaName = selectedOpt.value;

            updateDistancesAndSort(lat, lng, `${areaName} Area Center`);
        });
    }

    const searchInput = document.getElementById('store-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const cards = document.querySelectorAll('.store-card');
            let visibleCount = 0;

            cards.forEach(card => {
                const name = (card.getAttribute('data-name') || '').toLowerCase();
                const area = (card.getAttribute('data-area') || '').toLowerCase();
                const text = card.textContent.toLowerCase();

                if (name.includes(query) || area.includes(query) || text.includes(query)) {
                    card.style.display = 'block';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });

            const branchCount = document.getElementById('branch-count');
            if (branchCount) branchCount.textContent = visibleCount;
        });
    }

    const btnClearLocation = document.getElementById('btn-clear-location');
    if (btnClearLocation) {
        btnClearLocation.addEventListener('click', () => {
            const statusBar = document.getElementById('location-status-bar');
            if (statusBar) statusBar.style.display = 'none';
            
            const sortBadge = document.getElementById('sort-badge');
            if (sortBadge) {
                sortBadge.textContent = 'Default order';
                sortBadge.classList.remove('active');
            }

            if (areaSelect) areaSelect.value = '';
            currentUserCoords = null;

            if (userMarker && map) {
                map.removeLayer(userMarker);
                userMarker = null;
            }

            if (map) map.setView([initialLat, initialLng], initialZoom);

            // Redraw without distances so the list matches the "Default order"
            // the badge now claims, instead of staying sorted by a location the
            // customer just cleared.
            renderStoreCards(window.STORE_DATA || []);
            const searchBox = document.getElementById('store-search');
            if (searchBox) searchBox.value = '';
        });
    }

    initMap();
});
