(function (window) {
  "use strict";
  function Ble() {
    let bleObject = {};

    const BUTTON_UUID = "8ec90003-f315-4f60-9fb8-838830daea50";

    bleObject.device = null;
    bleObject.server = null;
    bleObject.isConnected = false;
    bleObject.max_mtu = 100;
    bleObject.replDataTxQueue = [];
    bleObject.rawDataTxQueue = [];
    bleObject.nordicDfuDevice = "DfuTarg";
    bleObject.dfuPackage = null;
    bleObject.firmWarePackage = null;
    bleObject.encoder = new TextEncoder('utf-8');
    bleObject.decoder = new TextDecoder('utf-8');
    bleObject.keyDataMapping = {
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
    bleObject.uiEvents = {
      commonClass: "replCtrlBtn",
      inputClass: 'replInput',
      ctrlA: "ctrlA",
      ctrlB: "ctrlB",
      ctrlC: "ctrlC",
      ctrlD: "ctrlD",
      ctrlE: "ctrlE",
    }
    let sendDataCallStacks = [];
    let intervalId = null;
    let runningWrites = {};

    // default listner for repl testing
    bleObject.replTxCharacteristicListner = function (event) {
      console.log(event);
    };

     // default listner for repl testing
     bleObject.rawDataTxCharacteristicListner = function (event) {
      console.log(event);
    };
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
        name: "REPL",
        startNotifications: true,
        dataTxQueue: bleObject.replDataTxQueue,
        uiEvents: bleObject.uiEvents
      },
      {
        serviceUuid: "e5700001-7bac-429a-b4ce-57ff900f479d",
        rxCharacteristicUuid: "e5700002-7bac-429a-b4ce-57ff900f479d",
        txCharacteristicUuid: "e5700003-7bac-429a-b4ce-57ff900f479d",
        name: "RAW",
        txCharacteristicListner: bleObject.rawDataTxCharacteristicListner,
        startNotifications: true,
        dataTxQueue: bleObject.rawDataTxQueue,
      },
      {
        serviceUuid: "8ec90001-f315-4f60-9fb8-838830daea50",
        name: "DFU_CONTROL",
        startNotifications: false,
      },
      {
        serviceUuid: "8ec90002-f315-4f60-9fb8-838830daea50",
        name: "DFU_PACKET",
        startNotifications: false,
      },
    ];
    // utility methods
    bleObject.isWebBluetoothAvailable = function () {
      return new Promise((resolve, reject) => {
        navigator.bluetooth
          ? resolve()
          : reject(
              "Bluetooth not available on this browser. Are you using Chrome?"
            );
      });
    };

    bleObject.encode = function(string){
      return bleObject.encoder.encode(string)
    }
    bleObject.decode = function(string){
      return bleObject.decoder.decode(string)
    }

    bleObject.recreateNode = function (el, withChildren) {
      if(!el)return;

      if (withChildren) {
        el.parentNode.replaceChild(el.cloneNode(true), el);
      }
      else {
        var newEl = el.cloneNode(false);
        while (el.hasChildNodes()) newEl.appendChild(el.firstChild);
        el.parentNode.replaceChild(newEl, el);
      }
    }

    // start scanning
    /**
     *  Request for scanning with default service uuid if not supplied
     * @param {object} [obj={}]
     * the object is {filters:[{services:[]}],optionalServices:[],onComplete:function(device)}
     */
    bleObject.requestDevice = async function (obj = {}) {
      // check if web bluetooth available
      await bleObject.isWebBluetoothAvailable();
      // Otherwise bring up the device window

      let options = {
        acceptAllDevices: false,
        optionalServices: bleObject.DEFAULT_SERVICES.map((d) => d.serviceUuid),
      };
      // set options if recieved
      if (obj.filters) options.filters = obj.filters;
      if (obj.optionalServices) options.optionalServices = obj.optionalServices;
      if (!obj.filters) options.acceptAllDevices = true;

      // start request window
      bleObject.device = await navigator.bluetooth.requestDevice(options);

      // run callback if exists
      if (obj.onComplete) obj.onComplete(bleObject.device);
    };

    /**
     *
     * @param {object} [obj={}]
     * this object is
     * {
     *   onConnect:function(device){},
     *   onDisconnect:function(){},
     *   replDataTxQueue :[]
     *   rawDataTxQueue :[]
     *   onRecieveRawData : function(event){}
     *   onRecieveReplData :function(event){}
     *   reuqestOptions: "options for requestDevice"
     *   onDfuStarted : function(){}
     *   onDfuSet : function(){}
     *   onDfuPackageLoad : function(file){}
     *   onDfuProgress :function(event){}
     *   onDfuComplete :function(event){}
     *   onDfuError :function(event){}
     *   replUiEvents: {}
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
    bleObject.connectDisconnect = async function (obj = { services: [] }) {
      try {
        if (bleObject.device && bleObject.device.gatt.connected) {
          await bleObject.device.gatt.disconnect();
          // Stop thread data
          clearInterval(intervalId);
          sendDataCallStacks = [];
          return Promise.resolve("disconnected");
        }
        // set default services
        let thisservices = bleObject.DEFAULT_SERVICES;

        //if services recieved  in args set them
        if (Array.isArray(obj.services) && obj.services.length != 0) {
          thisservices = obj.services;
        } else {
          // binding default Repl and data services

          // repl data array binding
          if (obj.replDataTxQueue) {
            thisservices.forEach((service) => {
              if (service.name == "REPL") {
                service.dataTxQueue = obj.replDataTxQueue;
              }
            });
          }

          if(obj.replUiEvents){
            thisservices.forEach((service) => {
              if (service.name == "REPL") {
                service.uiEvents = obj.replUiEvents;
              }
            });
          }
          // repl data recieve callback binding
          if (obj.onRecieveReplData) {
            thisservices.forEach((service) => {
              if (service.name == "REPL") {
                service.txCharacteristicListner = obj.onRecieveReplData;
              }
            });
          }
        // raw data array binding
          if (obj.rawDataTxQueue) {
            thisservices.forEach((service) => {
              if (service.name == "REPL") {
                service.dataTxQueue = obj.rawDataTxQueue;
              }
            });
          }
          // raw data recieve callback binding
          if (obj.onRecieveRawData) {
            thisservices.forEach((service) => {
              if (service.name == "RAW") {
                service.txCharacteristicListner = obj.onRecieveRawData;
              }
            });
          }
        }

        // setting request options for scan
        let reuqestOptions = {
          acceptAllDevices: false,
          optionalServices: thisservices.map((d) => d.serviceUuid),
        };
        if (obj.reuqestOptions) reuqestOptions = obj.reuqestOptions;

        await bleObject.requestDevice(reuqestOptions);

        /** for nordic Dfu transfer to secure Dfu process */

        if (bleObject.device.name === bleObject.nordicDfuDevice) {
          await bleObject.startDfu(obj);
          if (obj.onDfuSet) {
            obj.onDfuSet();
          }
          return Promise.resolve("Dfu mode");
        }
        // Handler to watch for device being disconnected due to loss of connection
        bleObject.device.addEventListener("gattserverdisconnected", () => {
          bleObject.isConnected = false;
          if (obj.onDisconnect) obj.onDisconnect();
          sendDataCallStacks = [];
        });

        // start binding services
        await bleObject.bindServicesAndCharacteristics(thisservices);

        //call onConnect callback
        if (obj.onConnect) obj.onConnect(bleObject.device);

        return Promise.resolve("connected");
      } catch (error) {
        return Promise.reject(error);
      }
    };

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
    bleObject.bindServicesAndCharacteristics = async function (services = []) {
      // connect server if not connected
      if (!bleObject.device.gatt.connected)
        bleObject.server = await bleObject.device.gatt
          .connect()
          .catch((err) => {
            console.log("Connection Failed");
          });
      bleObject.isConnected = bleObject.device.gatt.connected;

      if (!bleObject.isConnected) return Promise.reject("connection Failed");

      // set array of services to bind
      let servicesToBind = bleObject.DEFAULT_SERVICES;
      if (services.length != 0) servicesToBind = services;

      servicesToBind.forEach(async (service) => {
        // Set up the REPL characteristics
        const thisService = await bleObject.server
          .getPrimaryService(service.serviceUuid)
          .catch((error) => {
            console.log(
              service.name + " service is not available on this device"
            );
          });

        if (thisService) {
          let rxCharacteristic = await thisService.getCharacteristic(
            service.rxCharacteristicUuid
          );
          let txCharacteristic = await thisService.getCharacteristic(
            service.txCharacteristicUuid
          );

          // start notifications if set true
          if (service.startNotifications) {
            await txCharacteristic.startNotifications();
          }
          bleObject.bindUIeventListners(service.uiEvents,service.dataTxQueue)
          let inputNode  = null
          if(service.uiEvents?.commonClass && service.uiEvents?.inputClass){
             inputNode = document.querySelector('.'+service.uiEvents.commonClass+'.'+service.uiEvents.inputClass)
             if(inputNode) inputNode.value = "";
          }
          if (service.txCharacteristicListner) {
            txCharacteristic.addEventListener("characteristicvaluechanged",(event)=>{
              service.txCharacteristicListner(event)
              if(inputNode){
                bleObject.updateInput(event,inputNode)
              }
            });
          }

          if (service.dataTxQueue) {
            // send write thread to background
            let externalCallBackToBind = {
              rx: rxCharacteristic,
              id: service.rxCharacteristicUuid,
              dataTxQueue: service.dataTxQueue,
            };
            runningWrites[service.rxCharacteristicUuid] = false;
            sendDataCallStacks.push(externalCallBackToBind);
           
          }
          console.log(service.name + "  service setup done");
        }
      });
      // start dummy thread to send data
      intervalId = setInterval(thread);
    };

    bleObject.bindUIeventListners = function (uiEvents,dataTxQueue){
      if(uiEvents){
        if(uiEvents.commonClass){
          Object.keys(bleObject.keyDataMapping).forEach(key=>{
            if(uiEvents[key]){
              let thisNode = document.querySelector('.'+uiEvents.commonClass+'.'+uiEvents[key])
               bleObject.recreateNode(thisNode)
              thisNode =  document.querySelector('.'+uiEvents.commonClass+'.'+uiEvents[key])
              thisNode?.addEventListener('click',function(){
                dataTxQueue.push.apply(dataTxQueue, bleObject.encode(bleObject.keyDataMapping[key]))
              })
            }
            
          })
          // TODO bind keys events to input element
          if(uiEvents.inputClass){
            let thisNode = document.querySelector('.'+uiEvents.commonClass+'.'+uiEvents.inputClass)
            bleObject.recreateNode(thisNode)
            thisNode = document.querySelector('.'+uiEvents.commonClass+'.'+uiEvents.inputClass)

            thisNode?.addEventListener('keydown',function(event){
              Object.keys(bleObject.keyDataMapping).forEach(key=>{
                
                // if(event.ctrlKey){
                //   dataTxQueue.push.apply(dataTxQueue, bleObject.encode(bleObject.keyDataMapping[key]))
                // }
                if(key==event.key){
                  dataTxQueue.push.apply(dataTxQueue, bleObject.encode(bleObject.keyDataMapping[key]))
                }
              })
              if(!Object.keys(bleObject.keyDataMapping).includes(event.key) && event.key.length==1){
                dataTxQueue.push.apply(dataTxQueue, bleObject.encode(event.key))
              }
              event.preventDefault();
            })
            thisNode.addEventListener('beforeinput', (event) => {
              dataTxQueue.push.apply(dataTxQueue, bleObject.encode(event.data.replaceAll('\n', '\r\n')))
          
              event.preventDefault();
            });

            bleObject.cursorPosition = 0
          }
        }
      }
    }


    bleObject.updateInput = function(event,inputElement){
        let value = event.target.value;
        let string = bleObject.decode(value);
    
        // If catching raw REPL responses, handle separately
        // if (catchResponseFlag) {
    
        //     // Concat the string until '>' appears
        //     catchResponseString += string;
    
        //     if (catchResponseString.slice(-1) === '>') {
    
        //         processCaughtResponse(catchResponseString);
    
        //         catchResponseString = "";
        //     }
    
        //     return;
        // }
    
        // For every character in the string, i is incremented internally
        for (let i = 0; i < string.length;) {
    
            // Move cursor back one if there is a backspace
            if (string.indexOf('\b', i) == i) {
    
              bleObject.cursorPosition --;
                i += '\b'.length;
            }
    
            // Skip carriage returns. We only need newlines '\n'
            else if (string.indexOf('\r', i) == i) {
    
                i += '\r'.length;
            }
    
            // ESC-[K deletes to the end of the line
            else if (string.indexOf('\x1B[K', i) == i) {
    
              inputElement.value = inputElement.value.slice(0, bleObject.cursorPosition);
                i += '\x1B[K'.length;
            }
    
            // ESC-[nD moves backwards n characters
            else if (string.slice(i).search(/\x1B\[\d+D/) == 0) {
    
                // Extract the number of spaces to move
                let backspaces = parseInt(string.slice(i).match(/(\d+)(?!.*\1)/g));
                bleObject.cursorPosition -= backspaces;
                i += '\x1B[D'.length + String(backspaces).length;
            }
    
            // Append other characters as normal
            else {
    
              inputElement.value = inputElement.value.slice(0, bleObject.cursorPosition)
                    + string[i]
                    + inputElement.value.slice(bleObject.cursorPosition + 1);
    
                    bleObject.cursorPosition++;
                i++;
            }
        }
    
        // Reposition the cursor
        inputElement.selectionEnd = bleObject.cursorPosition;
        inputElement.selectionStart = bleObject.cursorPosition;
    
        inputElement.scrollTop = inputElement.scrollHeight;
    }
    /**
     * ms setInterval dummy thread process to send data
     */
    async function thread() {
      sendDataCallStacks.forEach(async (d) => {
        transmitData(d.rx, d.dataTxQueue, d.id);
      });
    }

    /**
     * 
     * @param {bleCharacteristics} rxCharacteristic the characteristics where data will be write
     * @param {Array} dataTxQueue the array from which data will be taken to write
     * @param {txCharacteristic} id charcteristics id where data will be write
     * @returns 
     */
    let transmitData = async function (rxCharacteristic, dataTxQueue, id) {
      if (runningWrites[id] === true) {
        return;
      }

      if (dataTxQueue.length === 0) {
        return;
      }

      if (!bleObject.isConnected) {
        return Promise.reject("Not Connected");
      }

      runningWrites[id] = true;
      const payload = dataTxQueue.slice(0, bleObject.max_mtu);

      await rxCharacteristic
        .writeValueWithoutResponse(new Uint8Array(payload))
        .then(() => {
          dataTxQueue.splice(0, payload.length);
          runningWrites[id] = false;
          return;
        })

        .catch((error) => {
          if (error == "NetworkError: GATT operation already in progress.") {
            // Ignore busy errors. Just wait and try again later
          } else {
            // Discard data on other types of error
            dataTxQueue.splice(0, payload.length);
            runningWrites[id] = false;
            return Promise.reject(error);
          }
        });
    };

    /** DFU update utilities */

    /**
     * 
     * @param {object} obj object containing all handlers
     */
    bleObject.startDfu = async function (obj) {
      if (!bleObject.dfuPackage) {
        await bleObject.setDfuPackage(
          bleObject.firmWarePackage,
          obj?.onDfuPackageLoad || false
        );
      }
      const dfu = new SecureDfu(CRC32.buf);
      dfu.addEventListener("log", (event) => {
        console.log(event.message);
      });
      dfu.addEventListener("progress", (event) => {
        console.log(event);
        if (obj.onDfuProgress) {
          obj.onDfuProgress(event);
        }
      });

      if (bleObject.device) {
        return bleObject.update(dfu, bleObject.device, obj);
      }
      dfu
        .requestDevice(true)
        .then((device) => {
          if (!device) {
            // setStatus("DFU mode set, select device again");
            console.log("DFU mode set, select device again");
            return;
          }
          return bleObject.update(dfu, device, obj);
        })
        .catch((error) => {
          console.log(error);
        });
    };

    /**
     * 
     * @param {string|file} file 
     * @param {function} [onDfuPackageLoad=false] on package load callback
     */
    bleObject.setDfuPackage = async function (file, onDfuPackageLoad = false) {
      // first download and parse zip
      if (typeof file == "string") {
        await fetch(file)
          .then(async (data) => {
            await data.blob().then((d) => loadDfuPackage(d, onDfuPackageLoad));
          })
          .catch(console.log);
      } else {
        await loadDfuPackage(file, onDfuPackageLoad);
      }
    };

    /**
     * Load and parse package from the file 
     */
    const loadDfuPackage = async function (file, onDfuPackageLoad) {
      if (!file) return;
      bleObject.dfuPackage = new SecureDfuPackage(file);
      return bleObject.dfuPackage
        .load()
        .then(() => {
          if (onDfuPackageLoad) {
            onDfuPackageLoad(file);
          }
          console.log(`Firmware package: ${file.name}`);
        })
        .catch((error) => {
          console.log(error);
        });
    };

    /**
     * 
     * @param {SecureDfu} dfu SecureDfu that will handle dfu
     * @param {device} device bluetooth device
     * @param {object} obj object with callback handlers
     * @returns 
     */
    bleObject.update = function (dfu, device, obj = {}) {
      if (!bleObject.dfuPackage) {
        console.log("Package not initialized");
        if (obj.onDfuPackageLoadFailed) {
          obj.onDfuPackageLoadFailed();
        }
        return;
      }
      if (obj.onDfuStarted) {
        obj.onDfuStarted();
      }
      Promise.resolve()
        .then(() => bleObject.dfuPackage.getBaseImage())
        .then((image) => {
          if (image) {
            return dfu.update(device, image.initData, image.imageData);
          }
        })
        .then(() => bleObject.dfuPackage.getAppImage())
        .then((image) => {
          if (image) {
            return dfu.update(device, image.initData, image.imageData);
          }
        })
        .then(() => {
          console.log("Update complete!");
          if (obj.onDfuComplete) {
            obj.onDfuComplete();
          }
          bleObject.dfuPackage = null;
        })
        .catch((error) => {
          console.log(error);
          if (obj.onDfuError) {
            obj.onDfuError();
          }
        });
    };

    return bleObject;
  }
  if (typeof window.bluetooth === "undefined") {
    window.bluetooth = Ble();
  }
})(window);
