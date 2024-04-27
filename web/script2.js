// Set the Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoiZG93ZWxsYWYiLCJhIjoiY2x0cjJjc2VqMGVtZzJrbnYwZjcxczdkcCJ9.ljRbHHEIuM4J40yUamM8zg';
const map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/dowellaf/cltr2h0h0007y01p7akad96el', // style URL
    center: [-2.034654, 55.546552], // starting position
    zoom: 0 // starting zoom
});

let device;
const context = new (window.AudioContext || window.webkitAudioContext)();
let geojsonData;

document.addEventListener('DOMContentLoaded', function () {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            } else {
                entry.target.classList.remove('active');
            }
        });
    }, {
        root: document.getElementById('popupBox'),
        rootMargin: '50px 50px 50px 50px',
        threshold: 0.9
    });

    document.querySelectorAll('#popupBox p').forEach(p => {
        observer.observe(p);
    });

    document.getElementById('helpIcon').addEventListener('click', function(event) {
        var popupBox = document.getElementById('popupBox');
        popupBox.style.display = (popupBox.style.display === 'block' ? 'none' : 'block');
        event.stopPropagation();
    });

    document.getElementById('popupBox').addEventListener('click', function(event) {
        event.stopPropagation();
    });

    document.addEventListener('click', function() {
        var popupBox = document.getElementById('popupBox');
        popupBox.style.display = 'none';
    });

    document.getElementById('buttonFile1').addEventListener('click', function() {
        loadGeoJSON('https://raw.githubusercontent.com/muimran/betatesting_soundbath/main/web/data/highrain.geojson');
        this.style.backgroundColor = '#077DAD';
        document.getElementById('buttonFile2').style.backgroundColor = '';
        document.getElementById('info').style.display = 'block';
    });

    document.getElementById('buttonFile2').addEventListener('click', function() {
        loadGeoJSON('https://raw.githubusercontent.com/muimran/betatesting_soundbath/main/web/data/myData.geojson');
        this.style.backgroundColor = '#077DAD';
        document.getElementById('buttonFile1').style.backgroundColor = '';
        document.getElementById('info').style.display = 'block';
    });
});

async function main() {
    try {
        const outputNode = context.createGain();
        outputNode.connect(context.destination);

        const patcherUrl = "https://raw.githubusercontent.com/muimran/betatesting_soundbath/main/export/patch.export.json";
        const patcherResponse = await fetch(patcherUrl);
        if (!patcherResponse.ok) {
            throw new Error(`Failed to fetch ${patcherUrl} (${patcherResponse.status} ${patcherResponse.statusText})`);
        }
        const patcher = await patcherResponse.json();
        device = await RNBO.createDevice({ context, patcher });
        device.node.connect(outputNode);
    } catch (err) {
        console.error("Error fetching or processing patcher:", err);
        const errDisplay = document.createElement("div");
        errDisplay.style.color = "red";
        errDisplay.innerHTML = `Encountered Error: <pre><code>${err.message}</pre></code>Check your console for more details.`;
        document.body.appendChild(errDisplay);
    }

    document.querySelector('#map').addEventListener('click', function() {
        context.resume().then(() => console.log('Playback resumed successfully'));
    });
}

window.addEventListener("load", main);

function loadGeoJSON(url) {
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            geojsonData = data;
            map.getSource('rainfall-data').setData(geojsonData);
            updateAverageRainfall();
        })
        .catch(error => console.error('Error loading the GeoJSON data: ', error));
}

function updateAverageRainfall() {
    if (!geojsonData || !device) return;
    let bounds = map.getBounds();
    let visibleFeatures = geojsonData.features.filter(feature => {
        let [lng, lat] = feature.geometry.coordinates;
        return bounds.contains([lng, lat]);
    });

    let totalRainfall = 0;
    let stationsWithRainfall = 0;
    let rainfallAndCountryCodes = '';

    visibleFeatures.forEach(feature => {
        let rainfall = parseFloat(feature.properties.rainfall);
        let country_code = feature.properties.country_code;
        if (!isNaN(rainfall) && rainfall > 0 && country_code !== undefined) {
            stationsWithRainfall++;
            totalRainfall += rainfall;
            rainfallAndCountryCodes += `${rainfall} ${country_code} `;
        }
    });

    rainfallAndCountryCodes = rainfallAndCountryCodes.trim();
    let averageRainfall = (stationsWithRainfall > 0) ? (totalRainfall / stationsWithRainfall).toFixed(2) : 'N/A'; // Calculate average rainfall
    let rainfall = rainfallAndCountryCodes.split(/\s+/).map(s => parseFloat(s));

    // Send the message event to the RNBO device
    let messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, "Data", rainfall);
    device.scheduleEvent(messageEvent);

    document.getElementById('info').innerHTML = `Average Rainfall: ${averageRainfall} mm<br>
    Total Rainfall: ${totalRainfall.toFixed(2)} mm<br>
    Total Stations: ${visibleFeatures.length}<br>
    Stations with Rainfall > 0mm: ${stationsWithRainfall}<br>
    Visible Rainfall & Country Codes: ${rainfallAndCountryCodes}`;
}

map.on('load', () => {
    map.addSource('rainfall-data', {
        'type': 'geojson',
        'data': {"type": "FeatureCollection", "features": []} // Start with an empty array
    });

    // Define a heatmap layer to visualize rainfall intensity
    map.addLayer({
        'id': 'rainfall-heat',
        'type': 'heatmap',
        'source': 'rainfall-data',
        'maxzoom': 9,
        'paint': {
            'heatmap-weight': [
                'interpolate',
                ['linear'],
                ['to-number', ['get', 'rainfall'], 0],
                0,
                0,
                1,
                1
            ],
            'heatmap-intensity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0,
                1,
                9,
                3
            ],
            'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0,
                'rgba(33,102,172,0)',
                0.2,
                'rgba(172, 159, 219, 0.8)',
                0.4,
                'rgba(142, 120, 217, 0.8)',
                0.6,
                'rgba(116, 86, 218, 0.8)',
                0.8,
                'rgba(92, 56, 214, 0.8)',
                1,
                'rgba(48, 0, 208, 0.8)'
            ],
            'heatmap-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0,
                2,
                10,
                30,
                14,
                800
            ],
            'heatmap-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                7,
                1,
                10,
                1,
                14,
                0
            ]
        }
    });

    // Define a circle layer to represent individual points of rainfall data visually
    map.addLayer({
        'id': 'rainfall-point',
        'type': 'circle',
        'source': 'rainfall-data',
        'minzoom': 7,
        'paint': {
            'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                7,
                ['interpolate', ['linear'], ['to-number', ['get', 'rainfall'], 0], 0, 1, 10, 10],
                16,
                ['interpolate', ['linear'], ['to-number', ['get', 'rainfall'], 0], 0, 5, 10, 50]
            ],
            'circle-color': [
                'interpolate',
                ['linear'],
                ['to-number', ['get', 'rainfall'], 0],
                0,
                'rgba(33,102,172,0)',
                .8,
                'rgb(103,169,207)',
                3,
                'rgb(178,24,43)'
            ],
            'circle-stroke-color': 'white',
            'circle-stroke-width': 1,
            'circle-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8,
                1,
                22,
                1
            ]
        }
    });

    // Initialize and update the average rainfall calculation.
    updateAverageRainfall();
});

map.on('moveend', updateAverageRainfall);
