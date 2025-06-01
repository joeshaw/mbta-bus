let map;
let routes = [];
let routeShapes = [];
let stops = [];
let vehicles = [];
let polylines = [];
let stopMarkers = [];
let vehicleMarkers = [];
let directions = [];
let markerIcons = [];
let currentRoute = null;
let infoWindow = null;

const refreshInterval = 10_000; // 10 seconds
let refreshTimer = null;

const MBTA_API_BASE = 'https://api-v3.mbta.com';
const MBTA_API_KEY = '5e5bb76ad00f4a608cf6cf70ccd8e12d';

const vehicleIconUrls = [
    '/mbta-bus/images/red-dot.png',
    '/mbta-bus/images/blue-dot.png',
    '/mbta-bus/images/green-dot.png',
    '/mbta-bus/images/orange-dot.png',
    '/mbta-bus/images/purple-dot.png',
    '/mbta-bus/images/yellow-dot.png',
];

async function fetchJSON(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Network error');
    return resp.json();
}

function buildApiUrl(endpoint) {
    const url = new URL(`${MBTA_API_BASE}${endpoint}`);
    url.searchParams.set('api_key', MBTA_API_KEY);
    return url.toString();
}

async function loadRoutes() {
    const data = await fetchJSON(buildApiUrl('/routes'));
    routes = data.data;
    const select = document.getElementById('route-select');
    routes.forEach(route => {
        const opt = document.createElement('option');
        opt.value = route.id;
        
        // Format as "route_number: long_name" for bus routes
        const shortName = route.attributes.short_name;
        const longName = route.attributes.long_name;
        
        if (shortName && longName) {
            opt.textContent = `${shortName}: ${longName}`;
        } else if (longName) {
            opt.textContent = longName;
        } else if (shortName) {
            opt.textContent = shortName;
        } else {
            opt.textContent = route.id;
        }
        
        select.appendChild(opt);
    });
}

async function loadRoute(routeId) {
    const data = await fetchJSON(buildApiUrl(`/routes/${routeId}`));
    currentRoute = data.data;
}

async function loadShapes(routeId) {
    const data = await fetchJSON(buildApiUrl(`/shapes?filter[route]=${routeId}`));
    routeShapes = data.data;
}

async function loadStops(routeId) {
    const data = await fetchJSON(buildApiUrl(`/stops?filter[route]=${routeId}`));
    stops = data.data;
}

async function loadVehicles(routeId) {
    const data = await fetchJSON(buildApiUrl(`/vehicles?filter[route]=${routeId}`));
    vehicles = data.data;
}

function drawShapes() {
    // Remove old polylines
    polylines.forEach(poly => poly.setMap(null));

    polylines = [];
    routeShapes.forEach(shape => {
        if (!shape.attributes.polyline) return;
        const path = google.maps.geometry.encoding.decodePath(shape.attributes.polyline);
        const polyline = new google.maps.Polyline({
            path,
            strokeColor: '#0000ff',
            strokeOpacity: 1,
            strokeWeight: 5,
            map: map
        });
        polylines.push(polyline);
    });
}

function drawStops() {
    // Remove old stop markers
    stopMarkers.forEach(marker => marker.map = null);

    stopMarkers = [];
    stops.forEach(stop => {
        const img = document.createElement('img');
        img.src = '/mbta-bus/images/stop-marker.gif';
        img.style.width = '8px';
        img.style.height = '8px';
        const marker = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: { lat: parseFloat(stop.attributes.latitude), lng: parseFloat(stop.attributes.longitude) },
            title: stop.attributes.name,
            content: img,
            zIndex: 50 // Lower z-index for stop markers
        });
        marker.addListener('gmp-click', () => openStopInfo(stop));
        stopMarkers.push(marker);
    });
}

function getDirectionDisplayName(directionId) {
    if (!currentRoute || !currentRoute.attributes.direction_names) {
        // Fallback to generic names
        return directionId === 0 ? 'Outbound' : 'Inbound';
    }
    
    const directionNames = currentRoute.attributes.direction_names || [];
    const directionDestinations = currentRoute.attributes.direction_destinations || [];
    const directionName = directionNames[directionId] || `Direction ${directionId}`;
    const destination = directionDestinations[directionId] || '';
    
    return destination ? `${directionName} to ${destination}` : directionName;
}

async function fetchPredictions(stopId, routeId) {
    const data = await fetchJSON(buildApiUrl(`/predictions?filter[stop]=${stopId}&filter[route]=${routeId}`));
    return data.data;
}

function getVehicleIcon(vehicle) {
    const direction = vehicle.attributes.direction_id;
    return {
        url: vehicleIconUrls[direction % vehicleIconUrls.length],
        scaledSize: new google.maps.Size(32, 32)
    };
}

function fitMapToBounds() {
    const bounds = new google.maps.LatLngBounds();
    routeShapes.forEach(shape => {
        if (!shape.attributes.polyline) return;
        const path = google.maps.geometry.encoding.decodePath(shape.attributes.polyline);
        path.forEach(latlng => bounds.extend(latlng));
    });
    if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
    }
}

function updateDirections() {
    directions = [];
    markerIcons = [];
    
    if (!currentRoute || !currentRoute.attributes.direction_names) {
        // Fallback to vehicle destinations if route data is unavailable
        const seen = new Set();
        vehicles.forEach(vehicle => {
            const destination = vehicle.attributes.headsign || 'Unknown';
            const direction = vehicle.attributes.direction_id;
            if (!seen.has(destination)) {
                seen.add(destination);
                directions.push(destination);
                markerIcons.push(vehicleIconUrls[direction % vehicleIconUrls.length]);
            }
        });
    } else {
        // Use route direction names with destinations
        const directionNames = currentRoute.attributes.direction_names || [];
        
        directionNames.forEach((directionName, index) => {
            const displayName = getDirectionDisplayName(index);
            directions.push(displayName);
            markerIcons.push(vehicleIconUrls[index % vehicleIconUrls.length]);
        });
    }
    
    // Render legend
    const container = document.getElementById('directions-container');
    container.innerHTML = '';
    directions.forEach((direction, i) => {
        const img = document.createElement('img');
        img.src = markerIcons[i];
        img.style.display = 'inline';
        img.style.verticalAlign = 'middle';
        img.style.marginRight = '4px';
        const span = document.createElement('span');
        span.appendChild(img);
        span.appendChild(document.createTextNode(direction + ' '));
        span.style.marginRight = '10px';
        container.appendChild(span);
    });
}

function drawVehicles() {
    vehicleMarkers.forEach(marker => marker.map = null);
    vehicleMarkers = [];
    vehicles.forEach(vehicle => {
        const iconUrl = getVehicleIcon(vehicle).url;
        const img = document.createElement('img');
        img.src = iconUrl;
        img.style.width = '32px';
        img.style.height = '32px';
        
        // Determine direction and destination using helper function
        const directionId = vehicle.attributes.direction_id;
        const displayName = getDirectionDisplayName(directionId);
        const vehicleLabel = vehicle.attributes.label || vehicle.id;
        
        const marker = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: { lat: parseFloat(vehicle.attributes.latitude), lng: parseFloat(vehicle.attributes.longitude) },
            title: `Vehicle ${vehicleLabel} - ${displayName}`,
            content: img,
            zIndex: 100 // Lower z-index so info windows appear above
        });
        marker.addListener('gmp-click', () => openVehicleInfo(vehicle));
        vehicleMarkers.push(marker);
    });
    updateDirections(); // Update legend after drawing vehicles
}

async function openStopInfo(stop) {
    if (!infoWindow) {
        infoWindow = new google.maps.InfoWindow({
            zIndex: 1000 // Ensure info window appears above markers
        });
    }
    let content = `<strong>${stop.attributes.name}</strong>`;
    // Show predictions
    const select = document.getElementById('route-select');
    const routeId = select.value;
    try {
        const predictions = await fetchPredictions(stop.id, routeId);
        if (predictions.length > 0) {
            // Filter predictions with arrival times
            const validPredictions = predictions
                .filter(pred => pred.attributes.arrival_time || pred.attributes.departure_time);
            
            if (validPredictions.length > 0) {
                // Group predictions by direction
                const predictionsByDirection = {};
                validPredictions.forEach(pred => {
                    const direction = pred.attributes.direction_id;
                    if (!predictionsByDirection[direction]) {
                        predictionsByDirection[direction] = [];
                    }
                    predictionsByDirection[direction].push(pred);
                });
                
                // Sort and limit each direction to 3 arrivals
                Object.keys(predictionsByDirection).forEach(direction => {
                    predictionsByDirection[direction] = predictionsByDirection[direction]
                        .sort((a, b) => {
                            const timeA = new Date(a.attributes.arrival_time || a.attributes.departure_time);
                            const timeB = new Date(b.attributes.arrival_time || b.attributes.departure_time);
                            return timeA - timeB;
                        })
                        .slice(0, 3); // Limit to next 3 per direction
                });
                
                // Get direction names and destinations for display
                const directionNames = currentRoute?.attributes?.direction_names || ['Outbound', 'Inbound'];
                const directionDestinations = currentRoute?.attributes?.direction_destinations || [];
                
                // Display predictions by direction
                Object.keys(predictionsByDirection).sort().forEach(direction => {
                    const directionPreds = predictionsByDirection[direction];
                    if (directionPreds.length > 0) {
                        const displayName = getDirectionDisplayName(parseInt(direction));
                        
                        content += `<br><em>${displayName}:</em><ul style="margin:0;padding-left:18px;">`;
                        
                        directionPreds.forEach(pred => {
                            const arrival = pred.attributes.arrival_time || pred.attributes.departure_time;
                            const t = new Date(arrival);
                            const now = new Date();
                            const minutesUntil = Math.round((t - now) / 60000);
                            
                            if (minutesUntil <= 0) {
                                content += `<li>Now</li>`;
                            } else if (minutesUntil === 1) {
                                content += `<li>1 minute</li>`;
                            } else {
                                content += `<li>${minutesUntil} minutes</li>`;
                            }
                        });
                        content += '</ul>';
                    }
                });
            } else {
                content += '<br><em>No predictions available.</em>';
            }
        } else {
            content += '<br><em>No predictions available.</em>';
        }
    } catch (e) {
        content += '<br><em>Could not load predictions.</em>';
    }
    infoWindow.setContent(content);
    infoWindow.setPosition({ lat: parseFloat(stop.attributes.latitude), lng: parseFloat(stop.attributes.longitude) });
    infoWindow.open(map);
}

async function openVehicleInfo(vehicle) {
    if (!infoWindow) {
        infoWindow = new google.maps.InfoWindow({
            zIndex: 1000 // Ensure info window appears above markers
        });
    }
    
    const vehicleLabel = vehicle.attributes.label || vehicle.id;
    const directionId = vehicle.attributes.direction_id;
    const displayName = getDirectionDisplayName(directionId);
    
    let content = `<strong>Vehicle ${vehicleLabel}</strong><br><em>${displayName}</em>`;
    
    // Try to get trip predictions for next stops
    const tripId = vehicle.relationships?.trip?.data?.id;
    if (tripId) {
        try {
            const tripPredictions = await fetchJSON(buildApiUrl(`/predictions?filter[trip]=${tripId}&include=stop&sort=departure_time`));
            const predictions = tripPredictions.data;
            const stops = tripPredictions.included || [];
            
            if (predictions.length > 0) {
                // Filter future predictions, sort by arrival time, and limit to next 3
                const now = new Date();
                const futurePredictions = predictions
                    .filter(pred => {
                        const departureTime = pred.attributes.departure_time || pred.attributes.arrival_time;
                        return departureTime && new Date(departureTime) > now;
                    })
                    .sort((a, b) => {
                        const timeA = new Date(a.attributes.departure_time || a.attributes.arrival_time);
                        const timeB = new Date(b.attributes.departure_time || b.attributes.arrival_time);
                        return timeA - timeB;
                    })
                    .slice(0, 3);
                
                if (futurePredictions.length > 0) {
                    content += '<br><br><em>Next stops:</em><ul style="margin:0;padding-left:18px;">';
                    
                    futurePredictions.forEach(pred => {
                        const stop = stops.find(s => s.id === pred.relationships?.stop?.data?.id);
                        const stopName = stop ? stop.attributes.name : 'Unknown Stop';
                        const departureTime = pred.attributes.departure_time || pred.attributes.arrival_time;
                        const t = new Date(departureTime);
                        const minutesUntil = Math.round((t - now) / 60000);
                        
                        let timeText;
                        if (minutesUntil <= 0) {
                            timeText = 'Now';
                        } else if (minutesUntil === 1) {
                            timeText = '1 minute';
                        } else {
                            timeText = `${minutesUntil} minutes`;
                        }
                        
                        content += `<li>${stopName} - ${timeText}</li>`;
                    });
                    content += '</ul>';
                }
            }
        } catch (e) {
            // Silently fail if trip predictions aren't available
            console.log('Could not load trip predictions:', e);
        }
    }
    
    infoWindow.setContent(content);
    infoWindow.setPosition({ lat: parseFloat(vehicle.attributes.latitude), lng: parseFloat(vehicle.attributes.longitude) });
    infoWindow.open(map);
}

async function loadNewRoute(routeId) {
    await Promise.all([
        loadRoute(routeId),
        loadShapes(routeId),
        loadStops(routeId),
        loadVehicles(routeId)
    ]);
    drawShapes();
    drawStops();
    drawVehicles();
    fitMapToBounds();
}

async function updateVehicles(routeId) {
    await loadVehicles(routeId);
    drawVehicles();
}

function onRouteChange() {
    const select = document.getElementById('route-select');
    const routeId = select.value;
    if (!routeId) return;
    loadNewRoute(routeId);
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => updateVehicles(routeId), refreshInterval);
}

function handleVisibilityChange() {
    const select = document.getElementById('route-select');
    const routeId = select.value;
    
    if (document.hidden && refreshTimer) {
        // Page is hidden, pause updates
        clearInterval(refreshTimer);
        refreshTimer = null;
    } else if (!document.hidden && !refreshTimer && routeId) {
        // Page is visible and we have a route selected, resume updates
        updateVehicles(routeId);
        refreshTimer = setInterval(() => updateVehicles(routeId), refreshInterval);
    }
}

// Google Maps async callback entrypoint
window.initMap = async function() {
    const isMobile = /iPhone|Android/i.test(navigator.userAgent);
    
    // Set map height based on device type
    const mapDiv = document.getElementById('map-canvas');
    mapDiv.style.height = isMobile ? '300px' : '500px';
    
    map = new google.maps.Map(document.getElementById('map-canvas'), {
        center: { lat: 42.3601, lng: -71.0589 },
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        clickableIcons: false,
        mapId: 'MBTA_BUS',
        gestureHandling: isMobile ? 'cooperative' : 'greedy'
    });
    await loadRoutes();
    document.getElementById('route-select').addEventListener('change', onRouteChange);
    
    // Add page visibility API event listener
    document.addEventListener('visibilitychange', handleVisibilityChange, false);
};
