// import { disconnectHandler, receiveReplData, receiveRawData } from "./main.js"

// var device = null;
// var replRxCharacteristic = null;
// var replTxCharacteristic = null;
// var rawDataRxCharacteristic = null;
// var rawDataTxCharacteristic = null;

// const replDataServiceUuid = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
// const replRxCharacteristicUuid = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
// const replTxCharacteristicUuid = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

// const rawDataServiceUuid = "e5700001-7bac-429a-b4ce-57ff900f479d";
// const rawDataRxCharacteristicUuid = "e5700002-7bac-429a-b4ce-57ff900f479d";
// const rawDataTxCharacteristicUuid = "e5700003-7bac-429a-b4ce-57ff900f479d";

// const replDataTxQueue = [];
// const rawDataTxQueue = [];
// let inetrvalId = null
// var replDataTxInProgress = false;
// var rawDataTxInProgress = false;

// // Web-Bluetooth doesn't have any MTU API, so we just set it to something reasonable


// function isWebBluetoothAvailable() {
//     return new Promise((resolve, reject) => {
//         navigator.bluetooth
//             ? resolve()
//             : reject("Bluetooth not available on this browser. Are you using Chrome?");
//     });
// }

// export async function connectDisconnect() {
//     try {

//         await isWebBluetoothAvailable();

//         // If already connected, disconnect
//         if (device && device.gatt.connected) {

//             await device.gatt.disconnect();

//             // Stop transmitting data
//             clearInterval(inetrvalId);

//             return Promise.resolve("disconnected");
//         }

//         // Otherwise bring up the device window
//         device = await navigator.bluetooth.requestDevice({

//             filters: [{
//                 services: [replDataServiceUuid]
//             }],
//             optionalServices: [rawDataServiceUuid]
//         });

//         // Handler to watch for device being disconnected due to loss of connection
//         device.addEventListener('gattserverdisconnected', disconnectHandler);

//         const server = await device.gatt.connect();

//         // Set up the REPL characteristics
//         const replService = await server.getPrimaryService(replDataServiceUuid);

//         replRxCharacteristic = await replService.getCharacteristic(replRxCharacteristicUuid);
//         replTxCharacteristic = await replService.getCharacteristic(replTxCharacteristicUuid);
//         await replTxCharacteristic.startNotifications();
//         replTxCharacteristic.addEventListener('characteristicvaluechanged', receiveReplData);

//         // Try to set up the raw data characteristics if the service is available
//         const rawDataService = await server.getPrimaryService(rawDataServiceUuid)
//             .catch(error => {
//                 console.log("Raw data service is not available on this device");
//             });

//         if (rawDataService) {
//             rawDataRxCharacteristic = await rawDataService.getCharacteristic(rawDataRxCharacteristicUuid);
//             rawDataTxCharacteristic = await rawDataService.getCharacteristic(rawDataTxCharacteristicUuid);
//             await rawDataTxCharacteristic.startNotifications();
//             rawDataTxCharacteristic.addEventListener('characteristicvaluechanged', receiveRawData);
//         }

//         // Start sending data
//         inetrvalId = setInterval(transmitReplData);

//         return Promise.resolve("connected");

//     } catch (error) {

//         return Promise.reject(error);
//     }
// }

// export function queueReplData(string) {

//     // Encode the UTF-8 string into an array and populate the buffer
//     const encoder = new TextEncoder('utf-8');
//     replDataTxQueue.push.apply(replDataTxQueue, encoder.encode(string));
// }

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

// export async function transmitRawData(bytes) {
//     await rawDataRxCharacteristic.writeValueWithoutResponse(new Uint8Array(bytes))
//         .then(() => {
//             console.log("Sent: ", bytes);
//         })
//         .catch(error => {
//             return Promise.reject(error);
//         })
// }

// window.transmitRawData = transmitRawData;


(function(window){
    'use strict';
    function Ble(){
        let bleObject = {};

        const BUTTON_UUID = "8ec90003-f315-4f60-9fb8-838830daea50";
        
        bleObject.device = null
        bleObject.server = null
        bleObject.isConnected = false
        let sendDataCallStacks = []
        let intervalId = null
        let runningWrites = {}
        bleObject.replDataTxQueue = []
        bleObject.replTxCharacteristicListner = function(event){console.log(event)}
        bleObject.max_mtu = 100;

        /**
         * Default services 
         * any services should contain following options
         * {
         *  serviceUuid <string> : "xxxx"
         *  rxCharacteristicUuid <string> : "xxxx"
         *  txCharacteristicUuid <string> : "xxxx"
         *  name <string> : "Test service"
         *  startNotifications <boolean>  : <true/false>
         * }
         */
        bleObject.DEFAULT_SERVICES = [
            { 
                serviceUuid: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
                rxCharacteristicUuid: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
                txCharacteristicUuid: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
                txCharacteristicListner: bleObject.replTxCharacteristicListner,
                name :'REPL',
                startNotifications : true,
                dataTxQueue: bleObject.replDataTxQueue

            },
            { 
                serviceUuid: "e5700001-7bac-429a-b4ce-57ff900f479d",
                rxCharacteristicUuid: "e5700002-7bac-429a-b4ce-57ff900f479d",
                txCharacteristicUuid:  "e5700003-7bac-429a-b4ce-57ff900f479d",
                name :'RAW',
                startNotifications : true,
                
            },
            { 
                serviceUuid: "8ec90001-f315-4f60-9fb8-838830daea50",
                name :'DFU_CONTROL',
                startNotifications : false,
                
            },
            { 
                serviceUuid: "8ec90002-f315-4f60-9fb8-838830daea50",
                name :'DFU_PACKET',
                startNotifications : false,
                
            }
        ]
        // utility methods
        bleObject.isWebBluetoothAvailable = function() {
            return new Promise((resolve, reject) => {
                navigator.bluetooth
                    ? resolve()
                    : reject("Bluetooth not available on this browser. Are you using Chrome?");
            });
        }

        // start scanning 
        /**
         *  Request for scanning with default service uuid if not supplied
         * @param {object} [obj={}]
         * the object is {filters:[{services:[]}],optionalServices:[],onComplete:function(device)}
         */
        bleObject.requestDevice = async function(obj={}){
            
            // check if web bluetooth available
            await this.isWebBluetoothAvailable()
            // Otherwise bring up the device window

            let options = {
                acceptAllDevices:false,
                optionalServices: this.DEFAULT_SERVICES.map(d=>d.serviceUuid)
            }
            // set options if recieved 
            if(obj.filters) options.filters = obj.filters;
            if(obj.optionalServices) options.optionalServices = obj.optionalServices;
            if(!obj.filters) options.acceptAllDevices = true;

            // start request window
            this.device = await navigator.bluetooth.requestDevice(options);

            // run callback if exists
            if(obj.onComplete)obj.onComplete(this.device);
        }
        
        /**
         * 
         * @param {object} [obj={}] 
         * this object is 
         * {
         *   onConnect:function(device){}, 
         *   onDisconnect:function(){},
         *   onRecieveReplData :function(event){}
         *   replDataTxQueue :[]
         *   rawDataTxQueue :[]
         *   onRecieveRawData : function(event){}
         *   reuqestOptions: "options for requestDevice"
         *   services: [ 
         *     { 
         *      serviceUuid: "xxxxx",
         *      rxCharacteristicUuid: "xxxxx",
         *      txCharacteristicUuid: "xxxxx",
         *      txCharacteristicListner: function(event){ console.log(event)},
         *      name :'REPL', startNotifications : true
         *      dataTxQueue: arraybuffer
         *     }
         *  ]
         * } 
         */
        bleObject.connectDisconnect = async function(obj={services:[]}){

            try {

                if (this.device && this.device.gatt.connected) {
                    await this.device.gatt.disconnect();
                    // Stop thread data
                    clearInterval(intervalId);
                    sendDataCallStacks = []
                    return Promise.resolve("disconnected");
                }
                // set default services
                let thisservices = this.DEFAULT_SERVICES

                
                //if services recieved  in args set them
                if(Array.isArray(obj.services) && obj.services.length!=0){
                    thisservices = obj.services
                }else{
                    if(obj.onRecieveReplData){
                        thisservices.forEach(service=>{
                            if(service.name=='REPL'){
                                service.txCharacteristicListner = obj.onRecieveReplData
                            }
                        })
                    }
                    if(obj.replDataTxQueue){
                        thisservices.forEach(service=>{
                            if(service.name=='REPL'){
                                service.dataTxQueue = obj.replDataTxQueue
                            }
                        })
                    }
                    if(obj.rawDataTxQueue){
                        thisservices.forEach(service=>{
                            if(service.name=='REPL'){
                                service.dataTxQueue = obj.rawDataTxQueue
                            }
                        })
                    }
                    if(obj.onRecieveRawData){
                        thisservices.forEach(service=>{
                            if(service.name=='RAW'){
                                service.txCharacteristicListner = obj.onRecieveRawData
                            }
                        })
                    }
                }

                let reuqestOptions = { 
                    acceptAllDevices:false,
                    optionalServices: thisservices.map(d=>d.serviceUuid)
                }
                if(obj.reuqestOptions) reuqestOptions = obj.reuqestOptions;
                
                await this.requestDevice(reuqestOptions)
                // Handler to watch for device being disconnected due to loss of connection
                this.device.addEventListener('gattserverdisconnected', ()=>{
                    this.isConnected = false
                    if(obj.onDisconnect)  obj.onDisconnect();
                    sendDataCallStacks = []
                    
                });
                
                // start binding services
                await this.bindServicesAndCharacteristics(thisservices)

                //call onConnect callback
                if(obj.onConnect) obj.onConnect(this.device);
               
                return Promise.resolve("connected");

            } catch(error){
                return Promise.reject(error);

            }
        }

        /**
         * 
         * @param {array} services
         * array of services to bind 
         * services: [ 
         *     { 
         *      serviceUuid: "xxxxx",
         *      rxCharacteristicUuid: "xxxxx",
         *      txCharacteristicUuid: "xxxxx",
         *      txCharacteristicListner: function(event){ console.log(event)}, 
         *      name :'REPL', startNotifications : true
         *     }
         *  ]
         */
        bleObject.bindServicesAndCharacteristics = async function(services=[]){

            // connect server if not connected
            if (!this.device.gatt.connected) this.server = await this.device.gatt.connect().catch(err=>{
                console.log("Connection Failed")
            });
            this.isConnected = this.device.gatt.connected

            if(!this.isConnected) return Promise.reject("connection Failed");

            // set array of services to bind
            let servicesToBind = bleObject.DEFAULT_SERVICES
            if(services.length!=0) servicesToBind = services;

            servicesToBind.forEach(async service=>{
                // Set up the REPL characteristics
                const thisService = await this.server.getPrimaryService(service.serviceUuid).catch(error => {
                    console.log(service.name + " service is not available on this device");
                });

                if(thisService){
                    let replRxCharacteristic = await thisService.getCharacteristic(service.rxCharacteristicUuid);
                    let replTxCharacteristic = await thisService.getCharacteristic(service.txCharacteristicUuid);

                    // start notifications if set true
                    if(service.startNotifications){
                        await replTxCharacteristic.startNotifications();
                    }

                    if(service.txCharacteristicListner){
                        replTxCharacteristic.addEventListener('characteristicvaluechanged', service.txCharacteristicListner);
                    }

                    if(service.dataTxQueue){
                        // send write thread to background
                        let externalCallBackToBind = {
                            rx: replRxCharacteristic,
                            id:service.rxCharacteristicUuid,
                            dataTxQueue: service.dataTxQueue
                        }
                        runningWrites[service.rxCharacteristicUuid] = false;
                        sendDataCallStacks.push(externalCallBackToBind)
                    }
                    console.log(service.name + '  service setup done')
                }
            })
            // start dummy thread to send data
            intervalId = setInterval(thread)

        }
        
        // ms setTimeout process to send data
        async function thread(){
            sendDataCallStacks.forEach(async d=>{
                transmitData(d.rx,d.dataTxQueue,d.id)
            })
        }

        let transmitData = async function (rxCharacteristic,dataTxQueue,id) {
            if (runningWrites[id] === true) {
                return;
            }
        
            if (dataTxQueue.length === 0) {
                return;
            }

            if(!bleObject.isConnected){
                return Promise.reject(error);
            }
        
            runningWrites[id] = true
            const payload = dataTxQueue.slice(0, bleObject.max_mtu);
        
            await rxCharacteristic.writeValueWithoutResponse(new Uint8Array(payload))
                .then(() => {
                    dataTxQueue.splice(0, payload.length);
                    runningWrites[id] = false
                    return;
                })
        
                .catch(error => {
        
                    if (error == "NetworkError: GATT operation already in progress.") {
                        // Ignore busy errors. Just wait and try again later
                    }
                    else {
                        // Discard data on other types of error
                        dataTxQueue.splice(0, payload.length);
                        runningWrites[id] = false
                        return Promise.reject(error);
                    }
                });
        
        }

        return bleObject;
    }
    if(typeof(window.bluetooth)==='undefined'){
        window.bluetooth = Ble()
    }
})(window);