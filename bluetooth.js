// Global device and characteristic objects
let device = null;
let uartRxCharacteristic = null;
let uartTxCharacteristic = null;
let rawDataRxCharacteristic = null;
let rawDataTxCharacteristic = null;

// UUIDs for UART service and characteristics
let nordicUartServiceUuid = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
let uartRxCharacteristicUuid = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
let uartTxCharacteristicUuid = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

// UUIDs for raw data service and characteristics
let rawDataServiceUuid = "e5700001-7bac-429a-b4ce-57ff900f479d";
let rawDataRxCharacteristicUuid = "e5700002-7bac-429a-b4ce-57ff900f479d";
let rawDataTxCharacteristicUuid = "e5700003-7bac-429a-b4ce-57ff900f479d";

// Web-Bluetooth doesn't have any MTU API, so we just set it to something reasonable
const mtu = 100;

// Promise function to check if bluetooth is available on the browser
function isWebBluetoothAvailable() {
    return new Promise((resolve, reject) => {
        navigator.bluetooth
            ? resolve()
            : reject("Bluetooth not available on this browser. Are you using Chrome?");
    });
}

// Function to connect and disconnect, returning status as promise
async function connectDisconnect() {
    try {
        // First ensure web bluetooth is available
        await isWebBluetoothAvailable();

        // Disconnect if connected
        if (device) {
            if (device.gatt.connected) {
                await device.gatt.disconnect();
                return Promise.resolve("disconnected");
            }
        }

        // Otherwise connect
        device = await navigator.bluetooth.requestDevice({
            filters: [{
                services: [nordicUartServiceUuid]
            }],
            optionalServices: [
                rawDataServiceUuid
            ]
        });

        // Handler to watch for device being disconnected due to loss of connection
        device.addEventListener('gattserverdisconnected', disconnectHandler);

        // Connect to the device and get the services and characteristics
        const server = await device.gatt.connect();

        const uartService = await server.getPrimaryService(nordicUartServiceUuid);
        uartRxCharacteristic = await uartService.getCharacteristic(uartRxCharacteristicUuid);
        uartTxCharacteristic = await uartService.getCharacteristic(uartTxCharacteristicUuid);

        const rawDataService = await server.getPrimaryService(rawDataServiceUuid);
        rawDataRxCharacteristic = await rawDataService.getCharacteristic(rawDataRxCharacteristicUuid);
        rawDataTxCharacteristic = await rawDataService.getCharacteristic(rawDataTxCharacteristicUuid);

        // Start notifications on the receiving characteristic and create handlers
        await uartTxCharacteristic.startNotifications();
        await rawDataTxCharacteristic.startNotifications();
        uartTxCharacteristic.addEventListener('characteristicvaluechanged', receiveUartData);
        rawDataTxCharacteristic.addEventListener('characteristicvaluechanged', receiveRawData);

        // Connected as unsecure method
        return Promise.resolve("connected");

    } catch (error) {

        // Return error if there is any
        return Promise.reject(error);
    }
}

// Function to transmit serial data to the device
async function sendUartData(string) {
    if(nativeFunc){
        window.ReactNativeWebView.postMessage(string)
        return;
    }
    // Encode the UTF-8 string into an array
    let encoder = new TextEncoder('utf-8');
    let data = encoder.encode(string);

    // Break the string up into mtu sized packets
    for (let chunk = 0; chunk < Math.ceil(data.length / mtu); chunk++) {

        // Calculate the start and end according to the chunk number
        let start = mtu * chunk;
        let end = mtu * (chunk + 1);

        // Send each slice of data (the partial last chunk is safely handled with slice)
        await uartRxCharacteristic.writeValueWithResponse(data.slice(start, end))
            .catch(error => {

                // If there was an operation already ongoing
                if (error == "NetworkError: GATT operation already in progress.") {

                    // Try to send the again
                    sendUartData(string);
                }
                else {

                    // Return any other error that may happen
                    return Promise.reject(error);
                }
            });
    }
}