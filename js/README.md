# webREPL BLE
A simple js web bluetooth library
## usage
link ble.js in html
if you using monocle default services might work for you . just need to supply some callbacks for getting data from bluetooth.
push data to ```replDataTxQueue``` and it will be written to ble device
you will get all repsone of REPL in ```onRecieveReplData``` callback and Data  in ```onRecieveRawData```
```
var bluetooth = window.bluetooth
let replDataTxQueue = []
const receiveReplData = function(event) {console.log(event)}
const receiveRawData = function(event) {console.log(event)}
const connectHandler = function(device){console.log(device)}
const disconnectHandler = function(){console.log("disconnected")}
bluetooth.connectDisconnect({
        onRecieveReplData : receiveReplData,
        onRecieveRawData : receiveRawData,
        onDisconnect : disconnectHandler,
        onConnect:connectHandler,
        replDataTxQueue: replDataTxQueue,
    }).then(result => {
        console.log("connected")
    }).catch(error => {
        disconnectHandler()
        console.error(error);
    })
```
otherwise you can give complete services array within parameter object
```
var bluetooth = window.bluetooth
let anArrayQueue = []
const readData = function(event){console.log(event)}
let customServices = [
    { 
        serviceUuid: "xx",
        rxCharacteristicUuid: "xxx",
        txCharacteristicUuid: "xxxx",
        txCharacteristicListner: readData,
        name :'REPL',
        startNotifications : true,
        dataTxQueue: anArrayQueue,

    },
]
bluetooth.connectDisconnect({
        onDisconnect : disconnectHandler,
        onConnect:connectHandler,
        services: customServices
    }).then(result => {
        console.log("connected")
    }).catch(error => {
        disconnectHandler()
        console.error(error);
    })
```
#### Properties
``` 
bluetooth.device
bluetooth.isConnected
bluetooth.server
bluetooth.max_mtu
bluetooth.DEFAULT_SERVICES = [
            { 
                serviceUuid: "xx",
                rxCharacteristicUuid: "xxx",
                txCharacteristicUuid: "xxxx",
                txCharacteristicListner: function(event){},
                name :'REPL',
                startNotifications : true,
                dataTxQueue: arraybuffer,

            },
            ....
            ]
```
#### Methods
```
bluettooth.isWebBluetoothAvailable()
bluetooth.requestDevice()
bluetooth.connectDisconnect(obj={services:[]})
bluetooth.bindServicesAndCharacteristics(services=[])
```
