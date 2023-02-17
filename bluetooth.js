var device = null;
var replRxCharacteristic = null;
var replTxCharacteristic = null;
var rawDataRxCharacteristic = null;
var rawDataTxCharacteristic = null;

const replDataServiceUuid = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const replRxCharacteristicUuid = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const replTxCharacteristicUuid = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

const rawDataServiceUuid = "e5700001-7bac-429a-b4ce-57ff900f479d";
const rawDataRxCharacteristicUuid = "e5700002-7bac-429a-b4ce-57ff900f479d";
const rawDataTxCharacteristicUuid = "e5700003-7bac-429a-b4ce-57ff900f479d";

const replDataTxQueue = [];
const rawDataTxQueue = [];

var replDataTxInProgress = false;
var rawDataTxInProgress = false;

// Web-Bluetooth doesn't have any MTU API, so we just set it to something reasonable
const max_mtu = 100;

function isWebBluetoothAvailable() {
    return new Promise((resolve, reject) => {
        navigator.bluetooth
            ? resolve()
            : reject("Bluetooth not available on this browser. Are you using Chrome?");
    });
}

async function connectDisconnect() {
    try {

        await isWebBluetoothAvailable();

        // If already connected, disconnect
        if (device && device.gatt.connected) {

            await device.gatt.disconnect();

            // Stop transmitting data
            clearInterval(transmitReplData);

            return Promise.resolve("disconnected");
        }

        // Otherwise bring up the device window
        device = await navigator.bluetooth.requestDevice({

            filters: [{
                services: [replDataServiceUuid]
            }],
            optionalServices: [rawDataServiceUuid]
        });

        // Handler to watch for device being disconnected due to loss of connection
        device.addEventListener('gattserverdisconnected', disconnectHandler);

        const server = await device.gatt.connect();

        const replService = await server.getPrimaryService(replDataServiceUuid);
        replRxCharacteristic = await replService.getCharacteristic(replRxCharacteristicUuid);
        replTxCharacteristic = await replService.getCharacteristic(replTxCharacteristicUuid);

        const rawDataService = await server.getPrimaryService(rawDataServiceUuid);
        rawDataRxCharacteristic = await rawDataService.getCharacteristic(rawDataRxCharacteristicUuid);
        rawDataTxCharacteristic = await rawDataService.getCharacteristic(rawDataTxCharacteristicUuid);

        // Start notifications on the receiving characteristic and create handlers
        await replTxCharacteristic.startNotifications();
        await rawDataTxCharacteristic.startNotifications();
        replTxCharacteristic.addEventListener('characteristicvaluechanged', receiveReplData);
        rawDataTxCharacteristic.addEventListener('characteristicvaluechanged', receiveRawData);

        // Start sending data
        setInterval(transmitReplData);

        return Promise.resolve("connected");

    } catch (error) {

        return Promise.reject(error);
    }
}

function queueReplData(string) {

    // Encode the UTF-8 string into an array and populate the buffer
    const encoder = new TextEncoder('utf-8');
    replDataTxQueue.push.apply(replDataTxQueue, encoder.encode(string));
}

async function transmitReplData() {

    if (replDataTxInProgress === true) {
        return;
    }

    if (replDataTxQueue.length === 0) {
        return;
    }

    replDataTxInProgress = true;

    const payload = replDataTxQueue.slice(0, max_mtu);

    await replRxCharacteristic.writeValueWithoutResponse(new Uint8Array(payload))
        .then(value => {
            replDataTxQueue.splice(0, payload.length);
            replDataTxInProgress = false;
            return;
        })

        .catch(error => {

            if (error == "NetworkError: GATT operation already in progress.") {
                // Ignore busy errors
            }
            else {
                replDataTxInProgress = false;
                return Promise.reject(error);
            }
        });

}