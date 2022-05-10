// Global device and characteristic objects
let device = null;
let rxCharacteristic = null;
let txCharacteristic = null;

// UUIDs for services and characteristics
let nordicUARTServiceUUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
let rxCharacteristicUUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
let txCharacteristicUUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

// Busy flag to avoid multiple transmits
let busy = false;

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
                services: [nordicUARTServiceUUID]
            }]
        });

        // Handler to watch for device being disconnected due to loss of connection
        device.addEventListener('gattserverdisconnected', disconnectHandler);

        // Connect to device and get primary service as well as characteristics
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(nordicUARTServiceUUID);
        rxCharacteristic = await service.getCharacteristic(rxCharacteristicUUID);
        txCharacteristic = await service.getCharacteristic(txCharacteristicUUID);

        // Start notifications on the receiving characteristic and create a handler
        await txCharacteristic.startNotifications();
        txCharacteristic.addEventListener('characteristicvaluechanged', incomingDataHandler);

        // Connected as unsecure method
        return Promise.resolve("connected");

    } catch (error) {
        // Return error if there is any
        return Promise.reject(error);
    }
}

// Function to transmit data to the device
async function sendData(string) {

    // Don't do anything if busy
    if (busy) { return }

    // Mark transmit as busy
    busy = true;

    // Encode the string into an array
    let encoder = new TextEncoder('utf-8');
    let data = encoder.encode(string);

    // The MTU size. TODO can we figure this out dynamically?
    let mtu = 128 - 3;

    // Break the string up into mtu sized packets
    for (let chunk = 0; chunk < Math.ceil(data.length / mtu); chunk++) {

        // Calculate the start and end according to the chunk number
        let start = mtu * chunk;
        let end = mtu * (chunk + 1);

        // Send each slice of data (the partial last chunk is safely handled with slice)
        await rxCharacteristic.writeValue(data.slice(start, end));
    }

    // Mark transmit as ready
    busy = false;
}