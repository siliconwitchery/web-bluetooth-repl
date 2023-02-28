//taken from https://github.com/thegecko/web-bluetooth-dfu/issues/70
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    // AMD. Register as an anonymous module.
    define(["crc32"], factory);
  } else if (typeof exports === "object") {
    // Node. Does not work with strict CommonJS
    module.exports = factory(require("crc32"));
  } else {
    // Browser globals with support for web workers (root is window)
    root.SecureDfu = factory(root.CRC32);
  }
})(this, function (CRC32) {
  "use strict";

  /* Polyfill indexOf. */
  var indexOf;

  if (typeof Array.prototype.indexOf === "function") {
    indexOf = function (haystack, needle) {
      return haystack.indexOf(needle);
    };
  } else {
    indexOf = function (haystack, needle) {
      var i = 0,
        length = haystack.length,
        idx = -1,
        found = false;

      while (i < length && !found) {
        if (haystack[i] === needle) {
          idx = i;
          found = true;
        }
        i++;
      }
      return idx;
    };
  }

  var CONTROL_UUID = "8ec90001-f315-4f60-9fb8-838830daea50";
  var PACKET_UUID = "8ec90002-f315-4f60-9fb8-838830daea50";
  var BUTTON_UUID = "8ec90003-f315-4f60-9fb8-838830daea50";
  var LITTLE_ENDIAN = true;
  var PACKET_SIZE = 100;

  var OPERATIONS = {
    BUTTON_COMMAND: [0x01],
    CREATE_COMMAND: [0x01, 0x01],
    CREATE_DATA: [0x01, 0x02],
    RECEIPT_NOTIFICATIONS: [0x02],
    CACULATE_CHECKSUM: [0x03],
    EXECUTE: [0x04],
    SELECT_COMMAND: [0x06, 0x01],
    SELECT_DATA: [0x06, 0x02],
    RESPONSE: [0x60, 0x20],
  };
  
  var RESPONSE = {
    // Invalid code
    0x00: "Invalid opcode",
    // Success
    0x01: "Operation successful",
    // Opcode not supported
    0x02: "Opcode not supported",
    // Invalid parameter
    0x03: "Missing or invalid parameter value",
    // Insufficient resources
    0x04: "Not enough memory for the data object",
    // Invalid object
    0x05: "Data object does not match the firmware and hardware requirements, the signature is wrong, or parsing the command failed",
    // Unsupported type
    0x07: "Not a valid object type for a Create request",
    // Operation not permitted
    0x08: "The state of the DFU process does not allow this operation",
    // Operation failed
    0x0a: "Operation failed",
    // Extended error
    0x0b: "Extended error",
  };
  var EXTENDED_ERROR = {
    // No error
    0x00: "No extended error code has been set. This error indicates an implementation problem",
    // Invalid error code
    0x01: "Invalid error code. This error code should never be used outside of development",
    // Wrong command format
    0x02: "The format of the command was incorrect",
    // Unknown command
    0x03: "The command was successfully parsed, but it is not supported or unknown",
    // Init command invalid
    0x04: "The init command is invalid. The init packet either has an invalid update type or it is missing required fields for the update type",
    // Firmware version failure
    0x05: "The firmware version is too low. For an application, the version must be greater than the current application. For a bootloader, it must be greater than or equal to the current version",
    // Hardware version failure
    0x06: "The hardware version of the device does not match the required hardware version for the update",
    // Softdevice version failure
    0x07: "The array of supported SoftDevices for the update does not contain the FWID of the current SoftDevice",
    // Signature missing
    0x08: "The init packet does not contain a signature",
    // Wrong hash type
    0x09: "The hash type that is specified by the init packet is not supported by the DFU bootloader",
    // Hash failed
    0x0a: "The hash of the firmware image cannot be calculated",
    // Wrong signature type
    0x0b: "The type of the signature is unknown or not supported by the DFU bootloader",
    // Verification failed
    0x0c: "The hash of the received firmware image does not match the hash in the init packet",
    // Insufficient space
    0x0d: "The available space on the device is insufficient to hold the firmware",
  };

  var SecureDfu = (function (_super) {
    function SecureDfu(crc32, bluetooth, delay) {
      if (delay === void 0) {
        delay = 15;
      }
      var _this = this;
      _this.crc32 = crc32;
      _this.bluetooth = bluetooth;
      _this.delay = delay;
      _this.notifyFns = {};
      _this.controlChar = null;
      _this.packetChar = null;
      _this.events = {};
      if (
        !_this.bluetooth &&
        window &&
        window.navigator &&
        window.navigator.bluetooth
      ) {
        _this.bluetooth = navigator.bluetooth;
      }
      return _this;
    }
    SecureDfu.prototype.addEventListener = function (event, listener) {
      if (typeof this.events[event] !== "object") {
        this.events[event] = [];
      }

      this.events[event].push(listener);
    };

    SecureDfu.prototype.removeEventListener = function (event, listener) {
      var idx;

      if (typeof this.events[event] === "object") {
        idx = indexOf(this.events[event], listener);

        if (idx > -1) {
          this.events[event].splice(idx, 1);
        }
      }
    };

    SecureDfu.prototype.dispatchEvent = function (event) {
      var i,
        listeners,
        length,
        args = [].slice.call(arguments, 1);

      if (typeof this.events[event] === "object") {
        listeners = this.events[event].slice();
        length = listeners.length;

        for (i = 0; i < length; i++) {
          listeners[i].apply(this, args);
        }
      }
    };

    SecureDfu.prototype.once = function (event, listener) {
      this.on(event, function g() {
        this.removeEventListener(event, g);
        listener.apply(this, arguments);
      });
    };

    SecureDfu.prototype.log = function (message) {
      this.dispatchEvent(SecureDfu.EVENT_LOG, {
        message: message,
      });
    };
    SecureDfu.prototype.progress = function (bytes) {
      this.dispatchEvent(SecureDfu.EVENT_PROGRESS, {
        object: "unknown",
        totalBytes: 0,
        currentBytes: bytes,
      });
    };
    SecureDfu.prototype.connect = function (device) {
      var _this = this;
      device.addEventListener("gattserverdisconnected", function () {
        _this.notifyFns = {};
        _this.controlChar = null;
        _this.packetChar = null;
      });
      return this.gattConnect(device)
        .then(function (characteristics) {
          _this.log("found " + characteristics.length + " characteristic(s)");
          _this.packetChar = characteristics.find(function (characteristic) {
            return characteristic.uuid === PACKET_UUID;
          });
          if (!_this.packetChar)
            throw new Error("Unable to find packet characteristic");
          _this.log("found packet characteristic");
          _this.controlChar = characteristics.find(function (characteristic) {
            return characteristic.uuid === CONTROL_UUID;
          });
          if (!_this.controlChar)
            throw new Error("Unable to find control characteristic");
          _this.log("found control characteristic");
          if (
            !_this.controlChar.properties.notify &&
            !_this.controlChar.properties.indicate
          ) {
            throw new Error(
              "Control characteristic does not allow notifications"
            );
          }
          return _this.controlChar.startNotifications();
        })
        .then(function () {
          _this.controlChar.addEventListener(
            "characteristicvaluechanged",
            _this.handleNotification.bind(_this)
          );
          _this.log("enabled control notifications");
          return device;
        });
    };
    SecureDfu.prototype.gattConnect = function (device) {
      var _this = this;
      return Promise.resolve()
        .then(function () {
          if (device.gatt.connected) return device.gatt;
          return device.gatt.connect();
        })
        .then(function (server) {
          _this.log("connected to gatt server");
          return server
            .getPrimaryService(SecureDfu.SERVICE_UUID)
            .catch(function () {
              throw new Error("Unable to find DFU service");
            });
        })
        .then(function (service) {
          _this.log("found DFU service");
          return service.getCharacteristics();
        });
    };
    SecureDfu.prototype.handleNotification = function (event) {
      var view = event.target.value;
      if (OPERATIONS.RESPONSE.indexOf(view.getUint8(0)) < 0) {
        throw new Error(
          "Unrecognised control characteristic response notification"
        );
      }
      var operation = view.getUint8(1);
      if (this.notifyFns[operation]) {
        var result = view.getUint8(2);
        var error = null;
        if (result === 0x01) {
          var data = new DataView(view.buffer, 3);
          this.notifyFns[operation].resolve(data);
        } else if (result === 0x0b) {
          var code = view.getUint8(3);
          error = "Error: " + EXTENDED_ERROR[code];
        } else {
          error = "Error: " + RESPONSE[result];
        }
        if (error) {
          this.log("notify: " + error);
          this.notifyFns[operation].reject(error);
        }
        delete this.notifyFns[operation];
      }
    };
    SecureDfu.prototype.sendOperation = function (
      characteristic,
      operation,
      buffer
    ) {
      var _this = this;
      return new Promise(function (resolve, reject) {
        var size = operation.length;
        if (buffer) size += buffer.byteLength;
        var value = new Uint8Array(size);
        value.set(operation);
        if (buffer) {
          var data = new Uint8Array(buffer);
          value.set(data, operation.length);
        }
        _this.notifyFns[operation[0]] = {
          resolve: resolve,
          reject: reject,
        };
        characteristic.writeValue(value);
      });
    };
    SecureDfu.prototype.sendControl = function (operation, buffer) {
      return this.sendOperation(this.controlChar, operation, buffer);
    };
    SecureDfu.prototype.transferInit = function (buffer) {
      return this.transfer(
        buffer,
        "init",
        OPERATIONS.SELECT_COMMAND,
        OPERATIONS.CREATE_COMMAND
      );
    };
    SecureDfu.prototype.transferFirmware = function (buffer) {
      return this.transfer(
        buffer,
        "firmware",
        OPERATIONS.SELECT_DATA,
        OPERATIONS.CREATE_DATA
      );
    };
    SecureDfu.prototype.transfer = function (
      buffer,
      type,
      selectType,
      createType
    ) {
      var _this = this;
      return this.sendControl(selectType).then(function (response) {
        var maxSize = response.getUint32(0, LITTLE_ENDIAN);
        var offset = response.getUint32(4, LITTLE_ENDIAN);
        var crc = response.getInt32(8, LITTLE_ENDIAN);
        if (
          type === "init" &&
          offset === buffer.byteLength &&
          _this.checkCrc(buffer, crc)
        ) {
          _this.log("init packet already available, skipping transfer");
          return;
        }
        _this.progress = function (bytes) {
          _this.dispatchEvent(SecureDfu.EVENT_PROGRESS, {
            object: type,
            totalBytes: buffer.byteLength,
            currentBytes: bytes,
          });
        };
        _this.progress(0);
        return _this.transferObject(buffer, createType, maxSize, offset);
      });
    };
    SecureDfu.prototype.transferObject = function (
      buffer,
      createType,
      maxSize,
      offset
    ) {
      var _this = this;
      var start = offset - (offset % maxSize);
      var end = Math.min(start + maxSize, buffer.byteLength);
      var view = new DataView(new ArrayBuffer(4));
      view.setUint32(0, end - start, LITTLE_ENDIAN);
      return this.sendControl(createType, view.buffer)
        .then(function () {
          var data = buffer.slice(start, end);
          return _this.transferData(data, start);
        })
        .then(function () {
          return _this.sendControl(OPERATIONS.CACULATE_CHECKSUM);
        })
        .then(function (response) {
          var crc = response.getInt32(4, LITTLE_ENDIAN);
          var transferred = response.getUint32(0, LITTLE_ENDIAN);
          var data = buffer.slice(0, transferred);

          _this.log("written " + transferred + " bytes");
          offset = transferred;
          return _this.sendControl(OPERATIONS.EXECUTE);

          // if (_this.checkCrc(data, crc)) {
          //     _this.log("written " + transferred + " bytes");
          //     offset = transferred;
          //     return _this.sendControl(OPERATIONS.EXECUTE);
          // }
          // else {
          //     _this.log("object failed to validate");
          // }
        })
        .then(function () {
          if (end < buffer.byteLength) {
            return _this.transferObject(buffer, createType, maxSize, offset);
          } else {
            _this.log("transfer complete");
          }
        });
    };
    SecureDfu.prototype.transferData = function (data, offset, start) {
      var _this = this;
      start = start || 0;
      var end = Math.min(start + PACKET_SIZE, data.byteLength);
      var packet = data.slice(start, end);
      return this.packetChar
        .writeValue(packet)
        .then(function () {
          return _this.delayPromise(_this.delay);
        })
        .then(function () {
          _this.progress(offset + end);
          if (end < data.byteLength) {
            return _this.transferData(data, offset, end);
          }
        }).catch(function(errr){
          console.log(errr)
          if(String(errr).includes("GATT operation already in progress")){
            return _this.transferData(data, offset, start);
          }
        });
    };
    SecureDfu.prototype.checkCrc = function (buffer, crc) {
      if (!this.crc32) {
        this.log("crc32 not found, skipping CRC check");
        return true;
      }
      return crc === this.crc32(new Uint8Array(buffer));
    };
    SecureDfu.prototype.delayPromise = function (delay) {
      return new Promise(function (resolve) {
        setTimeout(resolve, delay);
      });
    };
    /**
     * Scans for a device to update
     * @param buttonLess Scans for all devices and will automatically call `setDfuMode`
     * @param filters Alternative filters to use when scanning
     * @returns Promise containing the device
     */
    SecureDfu.prototype.requestDevice = function (buttonLess, filters) {
      var _this = this;
      if (!buttonLess && !filters) {
        filters = [{ services: [SecureDfu.SERVICE_UUID] }];
      }
      var options = {
        optionalServices: [SecureDfu.SERVICE_UUID],
      };
      if (filters) options.filters = filters;
      else options.acceptAllDevices = true;
      return this.bluetooth.requestDevice(options).then(function (device) {
        if (buttonLess) {
          return _this.setDfuMode(device);
        }
        return device;
      });
    };
    /**
     * Sets the DFU mode of a device, preparing it for update
     * @param device The device to switch mode
     * @returns Promise containing the device if it is still on a valid state
     */
    SecureDfu.prototype.setDfuMode = function (device) {
      var _this = this;
      return this.gattConnect(device).then(function (characteristics) {
        _this.log("found " + characteristics.length + " characteristic(s)");
        var controlChar = characteristics.find(function (characteristic) {
          return characteristic.uuid === CONTROL_UUID;
        });
        var packetChar = characteristics.find(function (characteristic) {
          return characteristic.uuid === PACKET_UUID;
        });
        if (controlChar && packetChar) {
          return device;
        }
        var buttonChar = characteristics.find(function (characteristic) {
          return characteristic.uuid === BUTTON_UUID;
        });
        if (!buttonChar) {
          throw new Error("Unsupported device");
        }
        // Support buttonless devices
        _this.log("found buttonless characteristic");
        if (!buttonChar.properties.notify && !buttonChar.properties.indicate) {
          throw new Error(
            "Buttonless characteristic does not allow notifications"
          );
        }
        return new Promise(function (resolve, _reject) {
          function complete() {
            // this.notifyFns = {};
            // Resolve with null device as it needs reconnecting
            resolve(null);
          }
          buttonChar
            .startNotifications()
            .then(function () {
              _this.log("enabled buttonless notifications");
              device.addEventListener(
                "gattserverdisconnected",
                complete.bind(_this)
              );
              buttonChar.addEventListener(
                "characteristicvaluechanged",
                _this.handleNotification.bind(_this)
              );
              return _this.sendOperation(buttonChar, OPERATIONS.BUTTON_COMMAND);
            })
            .then(function () {
              _this.log("sent DFU mode");
              complete();
            });
        });
      });
    };
    /**
     * Updates a device
     * @param device The device to switch mode
     * @param init The initialisation packet to send
     * @param firmware The firmware to update
     * @returns Promise containing the device
     */
    SecureDfu.prototype.update = function (device, init, firmware) {
      var _this = this;
      return new Promise(function (resolve, reject) {
        if (!device) return reject("Device not specified");
        if (!init) return reject("Init not specified");
        if (!firmware) return reject("Firmware not specified");
        _this
          .connect(device)
          .then(function () {
            _this.log("transferring init");
            return _this.transferInit(init);
          })
          .then(function () {
            _this.log("transferring firmware");
            return _this.transferFirmware(firmware);
          })
          .then(function () {
            _this.log("complete, disconnecting...");
            device.addEventListener("gattserverdisconnected", function () {
              _this.log("disconnected");
              resolve(device);
            });
          })
          .catch(function (error) {
            return reject(error);
          });
      });
    };
    /**
     * DFU Service unique identifier
     */
    SecureDfu.SERVICE_UUID = 0xfe59;
    /**
     * Log event
     * @event
     */
    SecureDfu.EVENT_LOG = "log";
    /**
     * Progress event
     * @event
     */
    SecureDfu.EVENT_PROGRESS = "progress";
    return SecureDfu;
  })();
  return SecureDfu;
});//taken from https://github.com/thegecko/web-bluetooth-dfu/issues/70
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    // AMD. Register as an anonymous module.
    define(["crc32"], factory);
  } else if (typeof exports === "object") {
    // Node. Does not work with strict CommonJS
    module.exports = factory(require("crc32"));
  } else {
    // Browser globals with support for web workers (root is window)
    root.SecureDfu = factory(root.CRC32);
  }
})(this, function (CRC32) {
  "use strict";

  /* Polyfill indexOf. */
  var indexOf;

  if (typeof Array.prototype.indexOf === "function") {
    indexOf = function (haystack, needle) {
      return haystack.indexOf(needle);
    };
  } else {
    indexOf = function (haystack, needle) {
      var i = 0,
        length = haystack.length,
        idx = -1,
        found = false;

      while (i < length && !found) {
        if (haystack[i] === needle) {
          idx = i;
          found = true;
        }
        i++;
      }
      return idx;
    };
  }

  var CONTROL_UUID = "8ec90001-f315-4f60-9fb8-838830daea50";
  var PACKET_UUID = "8ec90002-f315-4f60-9fb8-838830daea50";
  var BUTTON_UUID = "8ec90003-f315-4f60-9fb8-838830daea50";
  var LITTLE_ENDIAN = true;
  var PACKET_SIZE = 100;

  var OPERATIONS = {
    BUTTON_COMMAND: [0x01],
    CREATE_COMMAND: [0x01, 0x01],
    CREATE_DATA: [0x01, 0x02],
    RECEIPT_NOTIFICATIONS: [0x02],
    CACULATE_CHECKSUM: [0x03],
    EXECUTE: [0x04],
    SELECT_COMMAND: [0x06, 0x01],
    SELECT_DATA: [0x06, 0x02],
    RESPONSE: [0x60, 0x20],
  };
  
  var RESPONSE = {
    // Invalid code
    0x00: "Invalid opcode",
    // Success
    0x01: "Operation successful",
    // Opcode not supported
    0x02: "Opcode not supported",
    // Invalid parameter
    0x03: "Missing or invalid parameter value",
    // Insufficient resources
    0x04: "Not enough memory for the data object",
    // Invalid object
    0x05: "Data object does not match the firmware and hardware requirements, the signature is wrong, or parsing the command failed",
    // Unsupported type
    0x07: "Not a valid object type for a Create request",
    // Operation not permitted
    0x08: "The state of the DFU process does not allow this operation",
    // Operation failed
    0x0a: "Operation failed",
    // Extended error
    0x0b: "Extended error",
  };
  var EXTENDED_ERROR = {
    // No error
    0x00: "No extended error code has been set. This error indicates an implementation problem",
    // Invalid error code
    0x01: "Invalid error code. This error code should never be used outside of development",
    // Wrong command format
    0x02: "The format of the command was incorrect",
    // Unknown command
    0x03: "The command was successfully parsed, but it is not supported or unknown",
    // Init command invalid
    0x04: "The init command is invalid. The init packet either has an invalid update type or it is missing required fields for the update type",
    // Firmware version failure
    0x05: "The firmware version is too low. For an application, the version must be greater than the current application. For a bootloader, it must be greater than or equal to the current version",
    // Hardware version failure
    0x06: "The hardware version of the device does not match the required hardware version for the update",
    // Softdevice version failure
    0x07: "The array of supported SoftDevices for the update does not contain the FWID of the current SoftDevice",
    // Signature missing
    0x08: "The init packet does not contain a signature",
    // Wrong hash type
    0x09: "The hash type that is specified by the init packet is not supported by the DFU bootloader",
    // Hash failed
    0x0a: "The hash of the firmware image cannot be calculated",
    // Wrong signature type
    0x0b: "The type of the signature is unknown or not supported by the DFU bootloader",
    // Verification failed
    0x0c: "The hash of the received firmware image does not match the hash in the init packet",
    // Insufficient space
    0x0d: "The available space on the device is insufficient to hold the firmware",
  };

  var SecureDfu = (function (_super) {
    function SecureDfu(crc32, bluetooth, delay) {
      if (delay === void 0) {
        delay = 15;
      }
      var _this = this;
      _this.crc32 = crc32;
      _this.bluetooth = bluetooth;
      _this.delay = delay;
      _this.notifyFns = {};
      _this.controlChar = null;
      _this.packetChar = null;
      _this.events = {};
      if (
        !_this.bluetooth &&
        window &&
        window.navigator &&
        window.navigator.bluetooth
      ) {
        _this.bluetooth = navigator.bluetooth;
      }
      return _this;
    }
    SecureDfu.prototype.addEventListener = function (event, listener) {
      if (typeof this.events[event] !== "object") {
        this.events[event] = [];
      }

      this.events[event].push(listener);
    };

    SecureDfu.prototype.removeEventListener = function (event, listener) {
      var idx;

      if (typeof this.events[event] === "object") {
        idx = indexOf(this.events[event], listener);

        if (idx > -1) {
          this.events[event].splice(idx, 1);
        }
      }
    };

    SecureDfu.prototype.dispatchEvent = function (event) {
      var i,
        listeners,
        length,
        args = [].slice.call(arguments, 1);

      if (typeof this.events[event] === "object") {
        listeners = this.events[event].slice();
        length = listeners.length;

        for (i = 0; i < length; i++) {
          listeners[i].apply(this, args);
        }
      }
    };

    SecureDfu.prototype.once = function (event, listener) {
      this.on(event, function g() {
        this.removeEventListener(event, g);
        listener.apply(this, arguments);
      });
    };

    SecureDfu.prototype.log = function (message) {
      this.dispatchEvent(SecureDfu.EVENT_LOG, {
        message: message,
      });
    };
    SecureDfu.prototype.progress = function (bytes) {
      this.dispatchEvent(SecureDfu.EVENT_PROGRESS, {
        object: "unknown",
        totalBytes: 0,
        currentBytes: bytes,
      });
    };
    SecureDfu.prototype.connect = function (device) {
      var _this = this;
      device.addEventListener("gattserverdisconnected", function () {
        _this.notifyFns = {};
        _this.controlChar = null;
        _this.packetChar = null;
      });
      return this.gattConnect(device)
        .then(function (characteristics) {
          _this.log("found " + characteristics.length + " characteristic(s)");
          _this.packetChar = characteristics.find(function (characteristic) {
            return characteristic.uuid === PACKET_UUID;
          });
          if (!_this.packetChar)
            throw new Error("Unable to find packet characteristic");
          _this.log("found packet characteristic");
          _this.controlChar = characteristics.find(function (characteristic) {
            return characteristic.uuid === CONTROL_UUID;
          });
          if (!_this.controlChar)
            throw new Error("Unable to find control characteristic");
          _this.log("found control characteristic");
          if (
            !_this.controlChar.properties.notify &&
            !_this.controlChar.properties.indicate
          ) {
            throw new Error(
              "Control characteristic does not allow notifications"
            );
          }
          return _this.controlChar.startNotifications();
        })
        .then(function () {
          _this.controlChar.addEventListener(
            "characteristicvaluechanged",
            _this.handleNotification.bind(_this)
          );
          _this.log("enabled control notifications");
          return device;
        });
    };
    SecureDfu.prototype.gattConnect = function (device) {
      var _this = this;
      return Promise.resolve()
        .then(function () {
          if (device.gatt.connected) return device.gatt;
          return device.gatt.connect();
        })
        .then(function (server) {
          _this.log("connected to gatt server");
          return server
            .getPrimaryService(SecureDfu.SERVICE_UUID)
            .catch(function () {
              throw new Error("Unable to find DFU service");
            });
        })
        .then(function (service) {
          _this.log("found DFU service");
          return service.getCharacteristics();
        });
    };
    SecureDfu.prototype.handleNotification = function (event) {
      var view = event.target.value;
      if (OPERATIONS.RESPONSE.indexOf(view.getUint8(0)) < 0) {
        throw new Error(
          "Unrecognised control characteristic response notification"
        );
      }
      var operation = view.getUint8(1);
      if (this.notifyFns[operation]) {
        var result = view.getUint8(2);
        var error = null;
        if (result === 0x01) {
          var data = new DataView(view.buffer, 3);
          this.notifyFns[operation].resolve(data);
        } else if (result === 0x0b) {
          var code = view.getUint8(3);
          error = "Error: " + EXTENDED_ERROR[code];
        } else {
          error = "Error: " + RESPONSE[result];
        }
        if (error) {
          this.log("notify: " + error);
          this.notifyFns[operation].reject(error);
        }
        delete this.notifyFns[operation];
      }
    };
    SecureDfu.prototype.sendOperation = function (
      characteristic,
      operation,
      buffer
    ) {
      var _this = this;
      return new Promise(function (resolve, reject) {
        var size = operation.length;
        if (buffer) size += buffer.byteLength;
        var value = new Uint8Array(size);
        value.set(operation);
        if (buffer) {
          var data = new Uint8Array(buffer);
          value.set(data, operation.length);
        }
        _this.notifyFns[operation[0]] = {
          resolve: resolve,
          reject: reject,
        };
        characteristic.writeValue(value);
      });
    };
    SecureDfu.prototype.sendControl = function (operation, buffer) {
      return this.sendOperation(this.controlChar, operation, buffer);
    };
    SecureDfu.prototype.transferInit = function (buffer) {
      return this.transfer(
        buffer,
        "init",
        OPERATIONS.SELECT_COMMAND,
        OPERATIONS.CREATE_COMMAND
      );
    };
    SecureDfu.prototype.transferFirmware = function (buffer) {
      return this.transfer(
        buffer,
        "firmware",
        OPERATIONS.SELECT_DATA,
        OPERATIONS.CREATE_DATA
      );
    };
    SecureDfu.prototype.transfer = function (
      buffer,
      type,
      selectType,
      createType
    ) {
      var _this = this;
      return this.sendControl(selectType).then(function (response) {
        var maxSize = response.getUint32(0, LITTLE_ENDIAN);
        var offset = response.getUint32(4, LITTLE_ENDIAN);
        var crc = response.getInt32(8, LITTLE_ENDIAN);
        if (
          type === "init" &&
          offset === buffer.byteLength &&
          _this.checkCrc(buffer, crc)
        ) {
          _this.log("init packet already available, skipping transfer");
          return;
        }
        _this.progress = function (bytes) {
          _this.dispatchEvent(SecureDfu.EVENT_PROGRESS, {
            object: type,
            totalBytes: buffer.byteLength,
            currentBytes: bytes,
          });
        };
        _this.progress(0);
        return _this.transferObject(buffer, createType, maxSize, offset);
      });
    };
    SecureDfu.prototype.transferObject = function (
      buffer,
      createType,
      maxSize,
      offset
    ) {
      var _this = this;
      var start = offset - (offset % maxSize);
      var end = Math.min(start + maxSize, buffer.byteLength);
      var view = new DataView(new ArrayBuffer(4));
      view.setUint32(0, end - start, LITTLE_ENDIAN);
      return this.sendControl(createType, view.buffer)
        .then(function () {
          var data = buffer.slice(start, end);
          return _this.transferData(data, start);
        })
        .then(function () {
          return _this.sendControl(OPERATIONS.CACULATE_CHECKSUM);
        })
        .then(function (response) {
          var crc = response.getInt32(4, LITTLE_ENDIAN);
          var transferred = response.getUint32(0, LITTLE_ENDIAN);
          var data = buffer.slice(0, transferred);

          _this.log("written " + transferred + " bytes");
          offset = transferred;
          return _this.sendControl(OPERATIONS.EXECUTE);

          // if (_this.checkCrc(data, crc)) {
          //     _this.log("written " + transferred + " bytes");
          //     offset = transferred;
          //     return _this.sendControl(OPERATIONS.EXECUTE);
          // }
          // else {
          //     _this.log("object failed to validate");
          // }
        })
        .then(function () {
          if (end < buffer.byteLength) {
            return _this.transferObject(buffer, createType, maxSize, offset);
          } else {
            _this.log("transfer complete");
          }
        });
    };
    SecureDfu.prototype.transferData = function (data, offset, start) {
      var _this = this;
      start = start || 0;
      var end = Math.min(start + PACKET_SIZE, data.byteLength);
      var packet = data.slice(start, end);
      return this.packetChar
        .writeValue(packet)
        .then(function () {
          return _this.delayPromise(_this.delay);
        })
        .then(function () {
          _this.progress(offset + end);
          if (end < data.byteLength) {
            return _this.transferData(data, offset, end);
          }
        }).catch(function(errr){
          console.log(errr)
          if(String(errr).includes("GATT operation already in progress")){
            return _this.transferData(data, offset, start);
          }
        });
    };
    SecureDfu.prototype.checkCrc = function (buffer, crc) {
      if (!this.crc32) {
        this.log("crc32 not found, skipping CRC check");
        return true;
      }
      return crc === this.crc32(new Uint8Array(buffer));
    };
    SecureDfu.prototype.delayPromise = function (delay) {
      return new Promise(function (resolve) {
        setTimeout(resolve, delay);
      });
    };
    /**
     * Scans for a device to update
     * @param buttonLess Scans for all devices and will automatically call `setDfuMode`
     * @param filters Alternative filters to use when scanning
     * @returns Promise containing the device
     */
    SecureDfu.prototype.requestDevice = function (buttonLess, filters) {
      var _this = this;
      if (!buttonLess && !filters) {
        filters = [{ services: [SecureDfu.SERVICE_UUID] }];
      }
      var options = {
        optionalServices: [SecureDfu.SERVICE_UUID],
      };
      if (filters) options.filters = filters;
      else options.acceptAllDevices = true;
      return this.bluetooth.requestDevice(options).then(function (device) {
        if (buttonLess) {
          return _this.setDfuMode(device);
        }
        return device;
      });
    };
    /**
     * Sets the DFU mode of a device, preparing it for update
     * @param device The device to switch mode
     * @returns Promise containing the device if it is still on a valid state
     */
    SecureDfu.prototype.setDfuMode = function (device) {
      var _this = this;
      return this.gattConnect(device).then(function (characteristics) {
        _this.log("found " + characteristics.length + " characteristic(s)");
        var controlChar = characteristics.find(function (characteristic) {
          return characteristic.uuid === CONTROL_UUID;
        });
        var packetChar = characteristics.find(function (characteristic) {
          return characteristic.uuid === PACKET_UUID;
        });
        if (controlChar && packetChar) {
          return device;
        }
        var buttonChar = characteristics.find(function (characteristic) {
          return characteristic.uuid === BUTTON_UUID;
        });
        if (!buttonChar) {
          throw new Error("Unsupported device");
        }
        // Support buttonless devices
        _this.log("found buttonless characteristic");
        if (!buttonChar.properties.notify && !buttonChar.properties.indicate) {
          throw new Error(
            "Buttonless characteristic does not allow notifications"
          );
        }
        return new Promise(function (resolve, _reject) {
          function complete() {
            // this.notifyFns = {};
            // Resolve with null device as it needs reconnecting
            resolve(null);
          }
          buttonChar
            .startNotifications()
            .then(function () {
              _this.log("enabled buttonless notifications");
              device.addEventListener(
                "gattserverdisconnected",
                complete.bind(_this)
              );
              buttonChar.addEventListener(
                "characteristicvaluechanged",
                _this.handleNotification.bind(_this)
              );
              return _this.sendOperation(buttonChar, OPERATIONS.BUTTON_COMMAND);
            })
            .then(function () {
              _this.log("sent DFU mode");
              complete();
            });
        });
      });
    };
    /**
     * Updates a device
     * @param device The device to switch mode
     * @param init The initialisation packet to send
     * @param firmware The firmware to update
     * @returns Promise containing the device
     */
    SecureDfu.prototype.update = function (device, init, firmware) {
      var _this = this;
      return new Promise(function (resolve, reject) {
        if (!device) return reject("Device not specified");
        if (!init) return reject("Init not specified");
        if (!firmware) return reject("Firmware not specified");
        _this
          .connect(device)
          .then(function () {
            _this.log("transferring init");
            return _this.transferInit(init);
          })
          .then(function () {
            _this.log("transferring firmware");
            return _this.transferFirmware(firmware);
          })
          .then(function () {
            _this.log("complete, disconnecting...");
            device.addEventListener("gattserverdisconnected", function () {
              _this.log("disconnected");
              resolve(device);
            });
          })
          .catch(function (error) {
            return reject(error);
          });
      });
    };
    /**
     * DFU Service unique identifier
     */
    SecureDfu.SERVICE_UUID = 0xfe59;
    /**
     * Log event
     * @event
     */
    SecureDfu.EVENT_LOG = "log";
    /**
     * Progress event
     * @event
     */
    SecureDfu.EVENT_PROGRESS = "progress";
    return SecureDfu;
  })();
  return SecureDfu;
});