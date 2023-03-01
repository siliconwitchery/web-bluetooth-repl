import { connect, isConnected } from "./bluetooth.js";
import { replResetConsole, replSend } from "./repl.js";
import { checkForUpdates, startFirmwareUpdate, startFPGAUpdate } from "./update.js"

window.addEventListener("load", () => {
    replConsole.innerHTML =
        "Welcome to the MicroPython Web Bluetooth REPL. \n\n" +
        "Make sure you're using either Chrome Desktop, Android Chrome, or iOS Bluefy.\n\n" +
        "Report bugs and check out the source code here: https://github.com/siliconwitchery/web-bluetooth-repl\n\n\n" +
        "Hit any key to connect!"
});

const infoText = document.getElementById('infoText');
const replConsole = document.getElementById('replConsole');
const fpgaUpdateButton = document.getElementById('fpgaUpdateButton');
const ctrlAButton = document.getElementById('ctrlAButton');
const ctrlBButton = document.getElementById('ctrlBButton');
const ctrlCButton = document.getElementById('ctrlCButton');
const ctrlDButton = document.getElementById('ctrlDButton');
const ctrlEButton = document.getElementById('ctrlEButton');
const clearButton = document.getElementById('clearButton');

export async function ensureConnected() {

    if (isConnected() === true) {
        return;
    }

    try {
        let connectionResult = await connect();

        if (connectionResult === "repl connected") {
            showStatus("Connected");
        }

        if (connectionResult === "dfu connected") {
            showStatus("TODO: Starting firmware update...");
            return;
        }

        let updateInfo = await checkForUpdates();

        if (updateInfo != "") {
            showStatus(updateInfo + " Click <a href='#' " +
                "onclick='update();return false;'>" +
                "here</a> to update.");
        }

        replResetConsole();
    }

    catch (error) {
        console.error(error);
        showStatus(error);
    }
}

export function showStatus(string) {
    infoText.innerHTML = string;
}

// Keep the text area always focused
setInterval(function () {
    replConsole.focus();
}, 1000);

ctrlAButton.addEventListener('click', () => {
    replSend('\x01');
});

ctrlBButton.addEventListener('click', () => {
    replSend('\x02');
});

ctrlCButton.addEventListener('click', () => {
    replSend('\x03');
});

ctrlDButton.addEventListener('click', () => {
    replSend('\x04');
});

ctrlEButton.addEventListener('click', () => {
    replSend('\x05');
});

clearButton.addEventListener('click', () => {
    replResetConsole();
    replSend('\x03');
});

fpgaUpdateButton.addEventListener('click', () => {
    startFPGAUpdate();
});

export function receiveRawData(event) {
    console.log(event.target.value);
}

window.update = () => {
    infoText.innerHTML = "Reconnect to the DFU device to begin the update.";
    startFirmwareUpdate();
}