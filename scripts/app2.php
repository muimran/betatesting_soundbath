<?php

// URL of the file to be downloaded
$fileUrl = 'https://raw.githubusercontent.com/annadowell/soundbath2/main/web/data/myData.geojson';

// Path where the file should be saved on your server
$saveTo = '/home/u710700717/public_html/web/myData.geojson';

// Initialize a cURL session
$ch = curl_init();

// Set cURL options
curl_setopt($ch, CURLOPT_URL, $fileUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);

// Execute the cURL session
$data = curl_exec($ch);

// Check for cURL errors
if(curl_errno($ch)) {
    echo "cURL Error: " . curl_error($ch);
    curl_close($ch);
    exit;
}

// Close cURL session
curl_close($ch);

// Check if data was received
if ($data) {
    // Write the data to a file
    if (file_exists($saveTo)) {
        echo "Notice: File already exists and will be overwritten.\n";
    }
    $file = fopen($saveTo, 'w+');
    if ($file) {
        fputs($file, $data);
        fclose($file);
        echo "File downloaded successfully!";
    } else {
        echo "Error: Unable to open file for writing.";
    }
} else {
    echo "Error: No data received from download.";
}

?>
