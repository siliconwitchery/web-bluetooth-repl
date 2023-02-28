import { connectDisconnect } from "./bluetooth.js";
import { replResetConsole, replSend } from "./repl.js";
import { checkForUpdates, startFirmwareUpdate } from "./update.js"

window.addEventListener("load", () => {
    replConsole.placeholder =
        "Welcome to the MicroPython Web REPL. Connect via Bluetooth using the button below.\n\n" +
        "Currently, only Chrome desktop supports Web Bluetooth which is used here.\n\n" +
        "You're welcome to fork, contribute, and suggest bugfixes for this code within the repository linked below.";
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

    infoText.innerHTML = "";

    connectDisconnect()
        .then(result => {

            if (result.status === "dfu connected") {

                connectButton.innerHTML = "Disconnect";
                infoText.innerHTML = "TODO: Starting firmware update...";
            }

            if (result.status === "repl connected") {

                replConsole.placeholder = "";
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
                    })
                    .catch(error => {
                        infoText.innerHTML = error;
                    });

                replResetConsole();
                replConsole.focus()

                bluetoothIcon.src = "/images/bluetooth-icon.svg"
            }
        })

        .catch(error => {

            bluetoothIcon.src = "/images/no-bluetooth-icon.svg"

            console.error(error);
        })
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

    bluetoothIcon.src = "/images/no-bluetooth-icon.svg"

    connectButton.innerHTML = "Connect";

    controlButtons.forEach(element => {
        element.disabled = true;
    })
}

window.update = () => {
    infoText.innerHTML = "Reconnect to the DFU device to begin the update.";
    startFirmwareUpdate();
}