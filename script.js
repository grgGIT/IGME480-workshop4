// Configuration
const CONFIG = {
    mode: 'static', // 'static' or 'dynamic'
    dynamicRadius: 1000, // radius in meters for dynamic POIs
    staticPOIs: [
        { 
            name: "Rochester Abandoned Subway", 
            latitude: 43.154722, 
            longitude: -77.609722,
            description: "The Rochester Subway was a light rail rapid transit line in Rochester, New York, from 1927 to 1956."
        },
        { 
            name: "Washington Square Park", 
            latitude: 43.1534, 
            longitude: -77.6053,
            description: "A historic park in downtown Rochester, featuring monuments and green space."
        },
        { 
            name: "Rochester Contemporary Art Center", 
            latitude: 43.156619, 
            longitude: -77.600730,
            description: "A venue for the creation, experimentation and presentation of contemporary art."
        }
    ]
};

// DOM Elements
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');
const toggleModeButton = document.getElementById('toggle-mode');
const dynamicControlsElement = document.getElementById('dynamic-controls');
const poiTypeSelect = document.getElementById('poi-type');
const refreshPoisButton = document.getElementById('refresh-pois');
const infoPanelElement = document.getElementById('info-panel');
const infoTitleElement = document.getElementById('info-title');
const infoDescriptionElement = document.getElementById('info-description');
const closeInfoButton = document.getElementById('close-info');

// State
let currentPosition = null;
let currentPOIs = [];

// Initialize the application
window.onload = () => {
    // Set up event listeners
    toggleModeButton.addEventListener('click', toggleMode);
    refreshPoisButton.addEventListener('click', refreshPOIs);
    closeInfoButton.addEventListener('click', closeInfoPanel);
    
    // Get user's location and load POIs
    getUserLocation();
};

// Get the user's current location
function getUserLocation() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentPosition = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                
                loadPOIs();
                loadingElement.classList.add('hidden');
            },
            (error) => {
                console.error("Geolocation error:", error);
                loadingElement.classList.add('hidden');
                errorElement.classList.remove('hidden');
                errorElement.textContent = `Location error: ${error.message}. Please enable location services.`;
            },
            { enableHighAccuracy: true }
        );
    } else {
        loadingElement.classList.add('hidden');
        errorElement.classList.remove('hidden');
        errorElement.textContent = "Geolocation is not supported by your browser.";
    }
}

// Toggle between static and dynamic POI modes
function toggleMode() {
    if (CONFIG.mode === 'static') {
        CONFIG.mode = 'dynamic';
        toggleModeButton.textContent = 'Switch to Static POIs';
        dynamicControlsElement.classList.remove('hidden');
    } else {
        CONFIG.mode = 'static';
        toggleModeButton.textContent = 'Switch to Dynamic POIs';
        dynamicControlsElement.classList.add('hidden');
    }
    
    loadPOIs();
}

// Load POIs based on current mode
function loadPOIs() {
    clearPOIs();
    
    if (CONFIG.mode === 'static') {
        loadStaticPOIs();
    } else {
        loadDynamicPOIs();
    }
}

// Refresh POIs (for dynamic mode)
function refreshPOIs() {
    if (CONFIG.mode === 'dynamic') {
        loadDynamicPOIs();
    }
}

// Clear all existing POIs from the scene
function clearPOIs() {
    const scene = document.querySelector('a-scene');
    currentPOIs.forEach(poi => {
        if (poi.element && scene.contains(poi.element)) {
            scene.removeChild(poi.element);
        }
    });
    currentPOIs = [];
}

// Load static POIs from configuration
function loadStaticPOIs() {
    const scene = document.querySelector('a-scene');
    
    CONFIG.staticPOIs.forEach(place => {
        const entity = createPOIEntity(place);
        scene.appendChild(entity);
        
        currentPOIs.push({
            data: place,
            element: entity
        });
    });
}

// Load dynamic POIs from OpenStreetMap
async function loadDynamicPOIs() {
    if (!currentPosition) {
        console.error("User location not available");
        return;
    }
    
    loadingElement.classList.remove('hidden');
    loadingElement.textContent = "Fetching nearby points of interest...";
    
    try {
        const poiType = poiTypeSelect.value;
        const places = await fetchPlacesFromOSM(currentPosition.latitude, currentPosition.longitude, poiType);
        
        if (places.length === 0) {
            loadingElement.textContent = "No points of interest found nearby. Try a different category or location.";
            setTimeout(() => {
                loadingElement.classList.add('hidden');
            }, 3000);
            return;
        }
        
        const scene = document.querySelector('a-scene');
        
        places.forEach(place => {
            const entity = createPOIEntity(place);
            scene.appendChild(entity);
            
            currentPOIs.push({
                data: place,
                element: entity
            });
        });
        
        loadingElement.classList.add('hidden');
    } catch (error) {
        console.error("Error loading dynamic POIs:", error);
        loadingElement.classList.add('hidden');
        errorElement.classList.remove('hidden');
        errorElement.textContent = `Error loading POIs: ${error.message}`;
        
        setTimeout(() => {
            errorElement.classList.add('hidden');
        }, 5000);
    }
}

// Fetch places from OpenStreetMap's Overpass API
async function fetchPlacesFromOSM(latitude, longitude, poiType) {
    const radius = CONFIG.dynamicRadius;
    const query = `
        [out:json];
        node["${poiType}"](around:${radius},${latitude},${longitude});
        out;
    `;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch POIs from OpenStreetMap");

    const data = await response.json();

    return data.elements.map(el => ({
        name: el.tags.name || "Unnamed Location",
        latitude: el.lat,
        longitude: el.lon,
        description: el.tags.description || `A ${poiType.replace('=', ': ')} location`,
        tags: el.tags
    }));
}

// Create a POI entity for the A-Frame scene
function createPOIEntity(place) {
    const entity = document.createElement('a-entity');
    
    entity.setAttribute('gps-entity-place', `latitude: ${place.latitude}; longitude: ${place.longitude}`);
    entity.setAttribute('geometry', 'primitive: sphere; radius: 0.5');
    entity.setAttribute('material', 'color: #4285f4; opacity: 0.8');
    entity.setAttribute('class', 'clickable poi-marker');
    
    // Add text label
    const text = document.createElement('a-text');
    text.setAttribute('value', place.name);
    text.setAttribute('look-at', '[gps-camera]');
    text.setAttribute('scale', '1 1 1');
    text.setAttribute('align', 'center');
    text.setAttribute('width', '10');
    text.setAttribute('position', '0 1 0');
    text.setAttribute('color', 'white');
    text.setAttribute('background', 'black');
    entity.appendChild(text);
    
    // Add click event
    entity.addEventListener('click', () => {
        showInfoPanel(place);
    });
    
    return entity;
}

// Show info panel with POI details
function showInfoPanel(place) {
    infoTitleElement.textContent = place.name;
    
    let description = place.description || "No description available.";
    
    // If we have tags from OSM, display some of them
    if (place.tags) {
        description += '<br><br><strong>Details:</strong><br>';
        
        const relevantTags = ['description', 'website', 'phone', 'opening_hours', 'addr:street', 'addr:housenumber'];
        let tagCount = 0;
        
        for (const tag of relevantTags) {
            if (place.tags[tag]) {
                description += `<br><strong>${tag.replace('addr:', 'Address: ')}</strong>: ${place.tags[tag]}`;
                tagCount++;
            }
        }
        
        if (tagCount === 0) {
            description += '<br>No additional details available.';
        }
    }
    
    infoDescriptionElement.innerHTML = description;
    infoPanelElement.classList.remove('hidden');
}

// Close the info panel
function closeInfoPanel() {
    infoPanelElement.classList.add('hidden');
}