import { connectDisconnect, replSend, replSendRaw } from "./bluetooth.js";
import { getLatestGitTag } from "./gitutils.js";

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
const clearButton = document.getElementById('clearButton');

// Variable for keeping track of the current cursor position
var cursorPosition = 0;

// Variables for handling raw REPL responses
var catchResponseFlag = false;
var catchResponseString = "";

// Variables regarding current firmware version and repo link
var latestGitTag = "";
var gitRepoLink = "";

connectButton.addEventListener('click', () => {

    // Prepare for automated command handling
    catchResponseFlag = true;

    connectDisconnect()
        .then(result => {
            if (result === "connected") {

                replConsole.placeholder = "";

                connectButton.innerHTML = "Disconnect";

                controlButtons.forEach(ele => {
                    ele.disabled = false;
                })

                replConsole.focus()

                bluetoothIcon.src = "/images/bluetooth-icon.svg"

                replSendRaw("import device");
                replSendRaw("print(device.GIT_REPO)");
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

clearButton.addEventListener('click', () => {
    replConsole.value = '';
    cursorPosition = 0;
    replSend('\x03');
    replConsole.focus();
});

replConsole.addEventListener('keydown', (event) => {

    if (event.ctrlKey) {
        switch (event.key) {

            case 'a':
                replSend("\x01"); // Send Ctrl-A
                break;

            case 'b':
                replSend("\x02"); // Send Ctrl-B
                break;

            case 'c':
                // If text is selected, copy instead of sending Ctrl-C
                if (replConsole.selectionStart != replConsole.selectionEnd) {
                    return;
                }
                replSend("\x03"); // Send Ctrl-C
                break;

            case 'd':
                replSend("\x04"); // Send Ctrl-D
                break;

            case 'v':
                // Allow pasting
                return;
        }

        event.preventDefault();
        return;
    }

    if (event.metaKey) {
        switch (event.key) {

            case 'k':
                replConsole.value = "";
                cursorPosition = 0;
                replSend("\x03"); // Send Ctrl-C
                break;

            case 'c':
                // Allow copy
                return;

            case 'v':
                // Allow pasting
                return;

            case 'Backspace':
                replSend(
                    "\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b" +
                    "\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b" +
                    "\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b");
                break;

            case 'ArrowRight':
                replSend("\x1B[F"); // Send End key
                break;

            case 'ArrowLeft':
                replSend("\x1B[H"); // Send Home key
                break;
        }

        event.preventDefault();
        return;
    }

    switch (event.key) {

        case 'Backspace':
            replSend("\x08"); // Send backspace
            break;

        case 'ArrowUp':
            replSend("\x1B[A"); // Send up arrow key
            break;

        case 'ArrowDown':
            replSend("\x1B[B"); // Send down arrow key
            break;

        case 'ArrowRight':
            replSend("\x1B[C"); // Send right arrow key
            break;

        case 'ArrowLeft':
            replSend("\x1B[D"); // Send left arrow key
            break;

        case 'Tab':
            replSend("\x09"); // Send Tab key
            break;

        case 'Enter':
            replSend("\x1B[F\r\n"); // Send End key before sending \r\n
            break;

        default:
            // Only printable keys
            if (event.key.length == 1) {
                replSend(event.key)
            }
            break;
    }

    // Don't print characters to the REPL console because the response will print it for us
    event.preventDefault();
});

replConsole.addEventListener('beforeinput', (event) => {

    // replace new lines with `\r` and a bunch of backspaces to clear tabs
    replSend(event.data.replaceAll('\n',
        '\r\n\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b'));

    event.preventDefault();
});

export function receiveReplData(event) {

    // Decode the byte array into a UTF-8 string
    const decoder = new TextDecoder('utf-8');
    let value = event.target.value;
    let string = decoder.decode(value);

    // If catching raw REPL responses, handle separately
    if (catchResponseFlag) {

        // Concat the string until '>' appears
        catchResponseString += string;

        if (catchResponseString.slice(-1) === '>') {

            processCaughtResponse(catchResponseString);

            catchResponseString = "";
        }

        return;
    }

    // For every character in the string, i is incremented internally
    for (let i = 0; i < string.length;) {

        // Move cursor back one if there is a backspace
        if (string.indexOf('\b', i) == i) {

            cursorPosition--;
            i += '\b'.length;
        }

        // Skip carriage returns. We only need newlines '\n'
        else if (string.indexOf('\r', i) == i) {

            i += '\r'.length;
        }

        // ESC-[K deletes to the end of the line
        else if (string.indexOf('\x1B[K', i) == i) {

            replConsole.value = replConsole.value.slice(0, cursorPosition);
            i += '\x1B[K'.length;
        }

        // ESC-[nD moves backwards n characters
        else if (string.slice(i).search(/\x1B\[\d+D/) == 0) {

            // Extract the number of spaces to move
            let backspaces = parseInt(string.slice(i).match(/(\d+)(?!.*\1)/g));
            cursorPosition -= backspaces;
            i += '\x1B[D'.length + String(backspaces).length;
        }

        // Append other characters as normal
        else {

            replConsole.value = replConsole.value.slice(0, cursorPosition)
                + string[i]
                + replConsole.value.slice(cursorPosition + 1);

            cursorPosition++;
            i++;
        }
    }

    // Reposition the cursor
    replConsole.selectionEnd = cursorPosition;
    replConsole.selectionStart = cursorPosition;

    replConsole.scrollTop = replConsole.scrollHeight;
}

export function receiveRawData(event) {

    console.log(event.target.value);
}

async function processCaughtResponse(string) {

    console.log("Background REPL response");
    console.log(string);

    let exitRawReplModeFlag = false;

    if (string.includes("no module named 'device'") ||
        string.includes("no attribute 'GIT_REPO'")) {

        infoText.innerText = "Could not automatically detect the device. " +
            "Automation features may not be available. Be sure to update " +
            "your device to receive these latest improvements."

        exitRawReplModeFlag = true;
    }

    if (string.includes("https://github.com/")) {

        gitRepoLink = string.substring(string.indexOf("https"),
            string.lastIndexOf('\r\n'));

        let owner = gitRepoLink.split('/')[3];
        let repo = gitRepoLink.split('/')[4];

        latestGitTag = await getLatestGitTag(owner, repo);

        // Check the device version
        replSendRaw("print('VERSION='+device.VERSION)");
    }

    if (string.includes("VERSION=")) {

        let currentVersion =
            string.substring(string.indexOf("=v") + 1, string.lastIndexOf("\r\n"));

        if ((currentVersion != latestGitTag) &&
            gitRepoLink.includes("monocle")) {

            // Show update message on the display
            replSendRaw("import display");
            replSendRaw("display.text('New firmware available',100,180,0xffffff)");
            replSendRaw("display.show()");
            replSendRaw("print('NOTIFIED UPDATE')");

            infoText.innerHTML = "New firmware <a href='" + gitRepoLink +
                "/releases/latest' target='_blank'>(" + latestGitTag +
                ")</a> available. Click <a href='#' " +
                "onclick='startMonocleFirmwareUpdate();return false;'>" +
                "here</a> to update.";
        }

        else {
            infoText.innerHTML = "";
            exitRawReplModeFlag = true;
        }
    }

    if (string.includes("NOTIFIED UPDATE")) {
        // Wait until the previous commands are fully processed
        exitRawReplModeFlag = true;
    }

    if (string.includes("UPDATE STARTED")) {
        // Wait until the update commands are fully processed
        exitRawReplModeFlag = true;
    }

    if (exitRawReplModeFlag) {

        // Clear the screen
        replConsole.value = '';
        cursorPosition = 0;

        replSend("\x03"); // Send Ctrl-C to clear the prompt
        replSend("\x02"); // Send Ctrl-B to enter friendly mode

        catchResponseFlag = false;
    }
}

window.startMonocleFirmwareUpdate = () => {

    catchResponseFlag = true;

    replSendRaw("import display");
    replSendRaw("display.text('Updating firmware...',120,180,0xffffff)");
    replSendRaw("display.show()");
    replSendRaw("import update");
    replSendRaw("update.micropython()");
    replSendRaw("print('UPDATE STARTED')");
}

export function disconnectHandler() {

    bluetoothIcon.src = "/images/no-bluetooth-icon.svg"

    connectButton.innerHTML = "Connect";

    controlButtons.forEach(ele => {
        ele.disabled = true;
    })
}