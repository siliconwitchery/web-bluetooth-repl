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
        onRecieveRawData  : receiveRawData,
        onDisconnect      : disconnectHandler,
        onConnect         :connectHandler,
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
    ...
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
#### Default Properties and callbacks
- if 
``` 
bluetooth.device

bluetooth.isConnected

bluetooth.server

bluetooth.max_mtu

bluetooth.replDataTxQueue = [];

bluetooth.rawDataTxQueue = [];

bluetooth.nordicDfuDevice = "DfuTarg";

bluetooth.dfuPackage = null;

bluetooth.firmWarePackage = null;

bluetooth.keyDataMapping = {
      ctrlA: "\x01",
      ctrlB: "\x02",
      ctrlC: "\x03",
      ctrlD: "\x04",
      ctrlE: "\x05",
      Backspace: "\x08",
      Tab: "\x09",
      Enter: "\x1B[F\r\n",
      ArrowUp: "\x1B[A",
      ArrowDown: "\x1B[B",
      ArrowRight: "\x1B[C",
      ArrowLeft: "\x1B[D",
}


bluetooth.DEFAULT_SERVICES = [
            {
                serviceUuid: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
                rxCharacteristicUuid: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
                txCharacteristicUuid: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
                txCharacteristicListner: bluetooth.replTxCharacteristicListner,
                name: "REPL",
                startNotifications: true,
                dataTxQueue: bluetooth.replDataTxQueue,
                uiEvents: {} # set to default uiEvents
            },
            {
                serviceUuid: "e5700001-7bac-429a-b4ce-57ff900f479d",
                rxCharacteristicUuid: "e5700002-7bac-429a-b4ce-57ff900f479d",
                txCharacteristicUuid: "e5700003-7bac-429a-b4ce-57ff900f479d",
                name: "RAW",
                txCharacteristicListner: bluetooth.rawDataTxCharacteristicListner,
                startNotifications: true,
                dataTxQueue: bluetooth.rawDataTxQueue,
            },
            ....
            ]


default ui classes for events of repl 
uiEvents = {
      commonClass: "replCtrlBtn",
      ctrlA: "ctrlA",
      ctrlB: "ctrlB",
      ctrlC: "ctrlC",
      ctrlD: "ctrlD",
      ctrlE: "ctrlE",
}

```
#### Methods
```
bluettooth.isWebBluetoothAvailable()
bluetooth.requestDevice()
bluetooth.connectDisconnect(obj={services:[]})
bluetooth.bindServicesAndCharacteristics(services=[]) # optional
bleObject.encode(string) # To encode strings to bytes array  before sending to repl
```

#### bluetooth.connectDisconnect(obj)
Following callback and options you can pass in obj
- DFU callback will only work if you using default nordic secure dfu
```
onConnect: function(device){},
onDisconnect:function(){},
onRecieveReplData :function(event){}
onDfuStarted : function(){}
onDfuSet : function(){}
onDfuPackageLoad : function(file){}
onDfuProgress :function(event){}
onDfuComplete :function(event){}
onDfuError :function(event){}
replDataTxQueue :[]
rawDataTxQueue :[]
onRecieveRawData : function(event){}
reuqestOptions: "options for requestDevice"
services: []
uiEvents : {} # set to default uiEvents

```

#### DFU update
just need to specify zip file or zipfile url to ```bluetooth.firmWarePackage``` and make your device in boot mode rest will be handled by ```bluetooth.connectDisconnect()``` add some callbacks if you wish to keep track of them

or you can do a manual setup with folowing methods

```
bluetooth.firmwarePackage = 'url or zip file'
bleObject.setDfuPackage(file,onDfuPackageLoad=false)  # (optional) if you you wish setup package by yourself
bluetooth.startDfu(obj)  # obj is object of same callback handlers
```
