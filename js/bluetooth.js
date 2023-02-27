import { disconnectHandler, receiveRawData } from "./main.js"
import { replHandleResponse } from "./repl.js";

let device = null;
let replRxCharacteristic = null;
let replTxCharacteristic = null;
let rawDataRxCharacteristic = null;
let rawDataTxCharacteristic = null;

const replDataServiceUuid = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const replRxCharacteristicUuid = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const replTxCharacteristicUuid = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

const rawDataServiceUuid = "e5700001-7bac-429a-b4ce-57ff900f479d";
const rawDataRxCharacteristicUuid = "e5700002-7bac-429a-b4ce-57ff900f479d";
const rawDataTxCharacteristicUuid = "e5700003-7bac-429a-b4ce-57ff900f479d";

export const replDataTxQueue = [];
export const rawDataTxQueue = [];

let replTxTaskIntervalId = null
let replDataTxInProgress = false;
let rawDataTxInProgress = false;

// Web-Bluetooth doesn't have any MTU API, so we just set it to something reasonable
const max_mtu = 100;

function isWebBluetoothAvailable() {
    return new Promise((resolve, reject) => {
        navigator.bluetooth
            ? resolve()
            : reject("Bluetooth not available on this browser. Are you using Chrome?");
    });
}

export async function connectDisconnect() {
    try {

        await isWebBluetoothAvailable();

        // If already connected, disconnect
        if (device && device.gatt.connected) {

            await device.gatt.disconnect();

            // Stop transmitting data
            clearInterval(replTxTaskIntervalId);

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

        // Set up the REPL characteristics
        const replService = await server.getPrimaryService(replDataServiceUuid);

        replRxCharacteristic = await replService.getCharacteristic(replRxCharacteristicUuid);
        replTxCharacteristic = await replService.getCharacteristic(replTxCharacteristicUuid);
        await replTxCharacteristic.startNotifications();
        replTxCharacteristic.addEventListener('characteristicvaluechanged', receiveReplData);

        // Try to set up the raw data characteristics if the service is available
        const rawDataService = await server.getPrimaryService(rawDataServiceUuid)
            .catch(error => {
                console.log("Raw data service is not available on this device");
            });

        if (rawDataService) {
            rawDataRxCharacteristic = await rawDataService.getCharacteristic(rawDataRxCharacteristicUuid);
            rawDataTxCharacteristic = await rawDataService.getCharacteristic(rawDataTxCharacteristicUuid);
            await rawDataTxCharacteristic.startNotifications();
            rawDataTxCharacteristic.addEventListener('characteristicvaluechanged', receiveRawData);
        }

        // Start sending data
        replTxTaskIntervalId = setInterval(transmitReplData);

        return Promise.resolve("connected");

    } catch (error) {

        return Promise.reject(error);
    }
}

function receiveReplData(event) {

    // Decode the byte array into a UTF-8 string
    const decoder = new TextDecoder('utf-8');

    replHandleResponse(decoder.decode(event.target.value));
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
        .then(() => {
            replDataTxQueue.splice(0, payload.length);
            replDataTxInProgress = false;
            return;
        })

        .catch(error => {

            if (error == "NetworkError: GATT operation already in progress.") {
                // Ignore busy errors. Just wait and try again later
            }
            else {
                // Discard data on other types of error
                replDataTxQueue.splice(0, payload.length);
                replDataTxInProgress = false;
                return Promise.reject(error);
            }
        });

}

// TODO
export async function transmitRawData(bytes) {
    await rawDataRxCharacteristic.writeValueWithoutResponse(new Uint8Array(bytes))
        .then(() => {
            console.log("Sent: ", bytes);
        })
        .catch(error => {
            return Promise.reject(error);
        })
}

window.transmitRawData = transmitRawData;