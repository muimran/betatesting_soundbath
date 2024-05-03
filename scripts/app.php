<?php
require_once 'vendor/autoload.php';
use GuzzleHttp\Client;

function safeFloatConvert($value, $default = null) {
    return is_numeric($value) ? floatval($value) : $default;
}

function fetchStationDataEng() {
    $client = new Client();
    $url = 'https://environment.data.gov.uk/flood-monitoring/id/stations?parameter=rainfall';
    $response = $client->request('GET', $url);
    $engStationData = [];

    if ($response->getStatusCode() == 200) {
        $data = json_decode($response->getBody()->getContents(), true);
        foreach ($data['items'] as $station) {
            if (isset($station['lat']) && isset($station['long'])) {
                $engStationData[$station['notation']] = [
                    'latitude' => $station['lat'],
                    'longitude' => $station['long']
                ];
            }
        }
    }
    return $engStationData;
}

function getRainfallDataEng() {
    $client = new Client();
    $url = "http://environment.data.gov.uk/flood-monitoring/id/measures?parameter=rainfall";
    $response = $client->request('GET', $url);
    $engData = [];

    if ($response->getStatusCode() == 200) {
        $data = json_decode($response->getBody()->getContents(), true);
        $engData = $data['items'];
    }
    return $engData;
}

function getScotlandRainfallData($baseUrl) {
    $client = new Client();
    $stationsUrl = $baseUrl . "/api/Stations";
    $stationsResponse = $client->request('GET', $stationsUrl);
    $scotlandRainfallData = [];

    if ($stationsResponse->getStatusCode() == 200) {
        $stations = json_decode($stationsResponse->getBody()->getContents(), true);

        foreach ($stations as $station) {
            $stationId = $station["station_no"];
            $stationDetailsUrl = $baseUrl . "/api/Stations/" . $stationId;
            $hourlyDataUrl = $baseUrl . "/api/Hourly/" . $stationId . "?all=true";

            $detailsResponse = $client->request('GET', $stationDetailsUrl);
            if ($detailsResponse->getStatusCode() == 200) {
                $detailsData = json_decode($detailsResponse->getBody()->getContents(), true);
                $latitude = safeFloatConvert($detailsData["station_latitude"], 0.0);
                $longitude = safeFloatConvert($detailsData["station_longitude"], 0.0);

                $hourlyResponse = $client->request('GET', $hourlyDataUrl);
                if ($hourlyResponse->getStatusCode() == 200) {
                    $hourlyData = json_decode($hourlyResponse->getBody()->getContents(), true);
                    if ($hourlyData) {
                        $lastRecord = end($hourlyData);
                        $timestamp = $lastRecord["Timestamp"];
                        $rainfall = safeFloatConvert($lastRecord["Value"], 0.0);
                        $adjustedRainfall = $rainfall / 4;

                        if ($latitude && $longitude && $rainfall) {
                            $scotlandRainfallData[] = [
                                'station_id' => $stationId,
                                'latitude' => $latitude,
                                'longitude' => $longitude,
                                'timestamp' => $timestamp,
                                'rainfall' => $adjustedRainfall
                            ];
                        }
                    }
                }
            }
        }
    }
    return $scotlandRainfallData;
}

function getWalesRainfallData($apiKey) {
    $client = new Client();
    $url = 'https://api.naturalresources.wales/rivers-and-seas/v1/api/StationData';
    $headers = ['Ocp-Apim-Subscription-Key' => $apiKey];
    $response = $client->request('GET', $url, ['headers' => $headers]);
    $walesRainfallData = [];

    if ($response->getStatusCode() == 200) {
        $walesData = json_decode($response->getBody()->getContents(), true);
        foreach ($walesData as $station) {
            $stationId = $station['location'];
            $latitude = $station['coordinates']['latitude'];
            $longitude = $station['coordinates']['longitude'];
            $rainfall = null;
            foreach ($station['parameters'] as $parameter) {
                if ($parameter['paramNameEN'] == 'Rainfall') {
                    $rainfall = $parameter['latestValue'];
                    break;
                }
            }

            if ($rainfall !== null) {
                $walesRainfallData[] = [
                    'station_id' => $stationId,
                    'rainfall' => $rainfall,
                    'latitude' => $latitude,
                    'longitude' => $longitude
                ];
            }
        }
    }
    return $walesRainfallData;
}

// Example usage of fetching data
$engStationData = fetchStationDataEng();
$engRainfallData = getRainfallDataEng();
$scotlandBaseUrl = "https://www2.sepa.org.uk/rainfall";
$scotlandRainfallData = getScotlandRainfallData($scotlandBaseUrl);
$apiKey = 'your_api_key_here';
$walesRainfallData = getWalesRainfallData($apiKey);

// Function calls to process and combine data for England, Scotland, and Wales
// Write results to CSV and update GeoJSON would follow the pattern shown in previous examples

function combineData($engRainfallData, $engStationCoordinates, $scotlandRainfallData, $walesRainfallData) {
    $combinedData = [];
    // Process and combine England data
    foreach ($engRainfallData as $measurement) {
        $stationId = $measurement['stationReference'];
        $rainfall = safeFloatConvert($measurement['latestReading']['value']);
        $coordinates = $engStationCoordinates[$stationId] ?? ['latitude' => null, 'longitude' => null];
        $latLongKey = $coordinates['latitude'] . ',' . $coordinates['longitude'];
        if ($coordinates['latitude'] !== null && $coordinates['longitude'] !== null) {
            $combinedData[] = [
                'lat_long' => $latLongKey,
                'rainfall' => $rainfall,
                'country' => 'England'
            ];
        }
    }

    // Process and combine Scotland data
    foreach ($scotlandRainfallData as $stationData) {
        $rainfall = safeFloatConvert($stationData['rainfall']);
        $latitude = $stationData['latitude'];
        $longitude = $stationData['longitude'];
        $latLongKey = $latitude . ',' . $longitude;
        if ($latitude !== null && $longitude !== null) {
            $combinedData[] = [
                'lat_long' => $latLongKey,
                'rainfall' => $rainfall,
                'country' => 'Scotland'
            ];
        }
    }

    // Process and combine Wales data
    foreach ($walesRainfallData as $stationData) {
        $rainfall = safeFloatConvert($stationData['rainfall']);
        $latitude = $stationData['latitude'];
        $longitude = $stationData['longitude'];
        $latLongKey = $latitude . ',' . $longitude;
        if ($latitude !== null && $longitude !== null) {
            $combinedData[] = [
                'lat_long' => $latLongKey,
                'rainfall' => $rainfall,
                'country' => 'Wales'
            ];
        }
    }

    return $combinedData;
}

function writeCSV($filename, $data) {
    $handle = fopen($filename, 'w');
    fputcsv($handle, ['lat_long', 'rainfall', 'country']);
    foreach ($data as $row) {
        fputcsv($handle, $row);
    }
    fclose($handle);
}

function updateGeoJSON($geojsonFilePath, $csvFilePath) {
    $csvData = array_map('str_getcsv', file($csvFilePath));
    array_walk($csvData, function(&$a) use ($csvData) {
        $a = array_combine($csvData[0], $a);
    });
    array_shift($csvData); // remove column header

    $geojson = json_decode(file_get_contents($geojsonFilePath), true);
    foreach ($geojson['features'] as &$feature) {
        foreach ($csvData as $row) {
            if ($feature['geometry']['coordinates'] == explode(',', $row['lat_long'])) {
                $feature['properties']['rainfall'] = $row['rainfall'];
                $feature['properties']['country_code'] = $row['country'];
            }
        }
    }
    file_put_contents($geojsonFilePath, json_encode($geojson, JSON_PRETTY_PRINT));
}

// Example usage of the data processing and file operations
$combinedData = combineData($engRainfallData, $engStationData, $scotlandRainfallData, $walesRainfallData);
$csvFilePath = '../web/data/coordinates_rainfall_data.csv';
$geojsonFilePath = '../web/data/myData.geojson';

writeCSV($csvFilePath, $combinedData);
updateGeoJSON($geojsonFilePath, $csvFilePath);

echo "Data has been updated in both CSV and GeoJSON. Current time is " . date('Y-m-d H:i:s');
