import { connectDisconnect } from "./bluetooth.js";
import { replResetConsole, replSend } from "./repl.js";
import { checkForUpdates, startFirmwareUpdate } from "./update.js"

window.addEventListener("load", () => {
    replConsole.innerHTML =
        "Welcome to the MicroPython Web Bluetooth REPL. \n\n" +
        "Make sure you're using either Chrome Desktop, Android Chrome, or iOS Bluefy.\n\n" +
        "Report bugs and check out the source code here: https://github.com/siliconwitchery/web-bluetooth-repl\n\n\n" +
        "Hit the connect button below to get started!"
});

const bluetoothIcon = document.getElementById('bluetoothIcon');
const infoText = document.getElementById('infoText');
const replConsole = document.getElementById('replConsole');
const connectButton = document.getElementById('connectButton');
const controlButtons = document.getElementsByName('controlButton');
const ctrlAButton = document.getElementById('ctrlAButton');
const ctrlBButton = document.getElementById('ctrlBButton');
const ctrlCButton = document.getElementById('ctrlCButton');
const ctrlDButton = document.getElementById('ctrlDButton');
const ctrlEButton = document.getElementById('ctrlEButton');
const clearButton = document.getElementById('clearButton');

connectButton.addEventListener('click', () => {

    connectDisconnect()
        .then(result => {

            if (result === "dfu connected") {

                connectButton.innerHTML = "Disconnect";
                infoText.innerHTML = "TODO: Starting firmware update...";
            }

            if (result === "repl connected") {

                connectButton.innerHTML = "Disconnect";

                controlButtons.forEach(element => {
                    element.disabled = false;
                })

                checkForUpdates()
                    .then(value => {
                        if (value != "") {
                            infoText.innerHTML = value + " Click <a href='#' " +
                                "onclick='update();return false;'>" +
                                "here</a> to update.";
                        }
                        replResetConsole();
                    })
                    .catch(error => {
                        infoText.innerHTML = error;
                    });
            }
        })

        .catch(error => {
            console.error(error);
        })

    replConsole.focus()
    infoText.innerHTML = "";
});

ctrlAButton.addEventListener('click', () => {
    replSend('\x01');
    replConsole.focus()
});

ctrlBButton.addEventListener('click', () => {
    replSend('\x02');
    replConsole.focus()
});

ctrlCButton.addEventListener('click', () => {
    replSend('\x03');
    replConsole.focus()
});

ctrlDButton.addEventListener('click', () => {
    replSend('\x04');
    replConsole.focus()
});

ctrlEButton.addEventListener('click', () => {
    replSend('\x05');
    replConsole.focus()
});

clearButton.addEventListener('click', () => {
    replResetConsole();
    replSend('\x03');
    replConsole.focus();
});

export function receiveRawData(event) {

    console.log(event.target.value);
}

export function disconnectHandler() {

    connectButton.innerHTML = "Connect";

    controlButtons.forEach(element => {
        element.disabled = true;
    })
}

window.update = () => {
    infoText.innerHTML = "Reconnect to the DFU device to begin the update.";
    startFirmwareUpdate();
}