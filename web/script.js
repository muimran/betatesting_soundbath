mapboxgl.accessToken = 'pk.eyJ1IjoiZG93ZWxsYWYiLCJhIjoiY2x0cjJjc2VqMGVtZzJrbnYwZjcxczdkcCJ9.ljRbHHEIuM4J40yUamM8zg';
const map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/dowellaf/cltr2h0h0007y01p7akad96el', // style URL
    center: [-1.634654, 53.546552], // starting position
    zoom: 4 // starting zoom
});

let device;
const context = new (window.AudioContext || window.webkitAudioContext)();


document.getElementById('buttonFile1').addEventListener('click', function() {
    loadGeoJSON('https://raw.githubusercontent.com/muimran/betatesting_soundbath/main/web/data/highrain.geojson');
});

document.getElementById('buttonFile2').addEventListener('click', function() {
    loadGeoJSON('https://raw.githubusercontent.com/muimran/betatesting_soundbath/main/web/data/myData.geojson');
});

async function main() {
    try {
        const outputNode = context.createGain();
        outputNode.connect(context.destination);
        //outputNode.gain.setValueAtTime(0, context.currentTime);

        const patcherUrl = "https://raw.githubusercontent.com/muimran/betatesting_soundbath/main/export/patch.export.json";
        const patcherResponse = await fetch(patcherUrl);

        if (!patcherResponse.ok) {
            throw new Error(`Failed to fetch ${patcherUrl} (${patcherResponse.status} ${patcherResponse.statusText})`);
        }

        const patcher = await patcherResponse.json();
        device = await RNBO.createDevice({ context, patcher });
        device.node.connect(outputNode);

        //context.resume();
    } catch (err) {
        console.error("Error fetching or processing patcher:", err);
        // Display error message to the user
        const errDisplay = document.createElement("div");
        errDisplay.style.color = "red";
        errDisplay.innerHTML = `Encountered Error: <pre><code>${err.message}</pre></code>Check your console for more details.`;
        document.body.appendChild(errDisplay);
    }


    // One-liner to resume playback when user interacts with the page.
    document.querySelector('#map').addEventListener('click', function() {
        context.resume().then(() => {
        console.log('Playback resumed successfully');
        });
    });
}
window.addEventListener("load", main);


let geojsonData;



function updateAverageRainfall() {
        if (!geojsonData || !device) return;
    
        let bounds = map.getBounds(); // Retrieve the current geographic boundaries of the visible map area.
        let visibleFeatures = geojsonData.features.filter(feature => {
            let [lng, lat] = feature.geometry.coordinates;
            return bounds.contains([lng, lat]);
        });
    
        let totalRainfall = 0;
        let stationsWithRainfall = 0;
        let rainfallAndCountryCodes = '';
    
        // Calculate total rainfall and count stations with rainfall.
        visibleFeatures.forEach(feature => {
            let rainfall = parseFloat(feature.properties.rainfall);
            let country_code = feature.properties.country_code;
    
            // Ensure rainfall and country code are defined and rainfall is greater than 0.
            if (!isNaN(rainfall) && rainfall >= 0 && country_code !== undefined) {
                stationsWithRainfall++;
                totalRainfall += rainfall;
                rainfallAndCountryCodes += `${rainfall} ${country_code} `;
            }
        });
    
        rainfallAndCountryCodes = rainfallAndCountryCodes.trim(); // Trim the final string.
    
        let averageRainfall = (visibleFeatures.length > 0) ? (totalRainfall / visibleFeatures.length).toFixed(2) : 'N/A';
    
        let rainfall = rainfallAndCountryCodes.split(/\s+/).map(s => parseFloat(s));
    
        // Send the message event to the RNBO device NOT WORKING
        let messageEvent = new RNBO.MessageEvent(RNBO.TimeNow, "Data", rainfall);
        device.scheduleEvent(messageEvent);

        // Update the HTML content.
        document.getElementById('info').innerHTML = 'Average Rainfall: ' + averageRainfall + ' mm<br>' +
                                                    'Total Rainfall: ' + totalRainfall.toFixed(2) + ' mm<br>' +
                                                    'Total Stations: ' + visibleFeatures.length + '<br>' +
                                                    'Stations with Rainfall > 0mm: ' + stationsWithRainfall + '<br>' +
                                                    'Visible Rainfall & Country Codes: ' + rainfallAndCountryCodes;
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

    // Bind an event handler to update average rainfall whenever the map stops moving.
    map.on('moveend', updateAverageRainfall);
});
