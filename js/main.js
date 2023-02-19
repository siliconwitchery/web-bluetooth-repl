import { connectDisconnect, queueReplData } from "./bluetooth.js";
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
const ctrlEButton = document.getElementById('ctrlEButton');
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

                // Enter raw REPL mode to get device info and suggest updates
                catchResponseFlag = true;
                queueReplData("\x03"); // Send Ctrl-C to clear the prompt
                queueReplData("\x01"); // Send Ctrl-A to enter RAW mode
                queueReplData("import device;print(device.GIT_REPO)\r\n")
                queueReplData("\x04"); // Send Ctrl-D to execute
            }
        })

        .catch(error => {

            bluetoothIcon.src = "/images/no-bluetooth-icon.svg"

            console.error(error);
        })
});

ctrlAButton.addEventListener('click', () => {
    queueReplData('\x01');
    replConsole.focus()
});

ctrlBButton.addEventListener('click', () => {
    queueReplData('\x02');
    replConsole.focus()
});

ctrlCButton.addEventListener('click', () => {
    queueReplData('\x03');
    replConsole.focus()
});

ctrlDButton.addEventListener('click', () => {
    queueReplData('\x04');
    replConsole.focus()
});

ctrlEButton.addEventListener('click', () => {
    queueReplData('\x05');
    replConsole.focus()
});

clearButton.addEventListener('click', () => {
    replConsole.value = '';
    cursorPosition = 0;
    queueReplData('\x03');
    replConsole.focus();
});

replConsole.onkeydown = (event) => {

    if (event.ctrlKey) {
        switch (event.key) {

            case 'a':
                queueReplData("\x01"); // Send Ctrl-A
                break;;

            case 'b':
                queueReplData("\x02"); // Send Ctrl-B
                break;;

            case 'c':
                queueReplData("\x03"); // Send Ctrl-C
                break;;

            case 'd':
                queueReplData("\x04"); // Send Ctrl-D
                break;;

            case 'e':
                queueReplData("\x05"); // Send Ctrl-E
                break;;

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
                queueReplData("\x03"); // Send Ctrl-C
                break;

            case 'c':
                // Allow copy
                return;

            case 'v':
                // Allow pasting
                return;

            case 'Backspace':
                queueReplData(
                    "\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b" +
                    "\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b" +
                    "\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b");
                break;

            case 'ArrowRight':
                queueReplData("\x1B[F"); // Send End key
                break;

            case 'ArrowLeft':
                queueReplData("\x1B[H"); // Send Home key
                break;
        }

        event.preventDefault();
        return;
    }

    switch (event.key) {

        case 'Backspace':
            queueReplData("\x08"); // Send backspace
            break;

        case 'ArrowUp':
            queueReplData("\x1B[A"); // Send up arrow key
            break;

        case 'ArrowDown':
            queueReplData("\x1B[B"); // Send down arrow key
            break;

        case 'ArrowRight':
            queueReplData("\x1B[C"); // Send right arrow key
            break;

        case 'ArrowLeft':
            queueReplData("\x1B[D"); // Send left arrow key
            break;

        case 'Tab':
            queueReplData("\x09"); // Send Tab key
            break;

        case 'Enter':
            queueReplData("\x1B[F\r\n"); // Send End key before sending \r\n
            break;

        default:
            // Only printable keys
            if (event.key.length == 1) {
                queueReplData(event.key)
            }
            break;
    }

    // Don't print characters to the REPL console because the response will print it for us
    event.preventDefault();
}


replConsole.addEventListener('beforeinput', (event) => {
    queueReplData(event.data.replaceAll('\n', '\r\n'))
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

function processCaughtResponse(string) {

    console.log("Received raw repl: " + string);

    let exitRawReplModeFlag = false;

    if (string.includes("no attribute 'GIT_REPO'")) {

        infoText.innerText = "Could not automatically detect the device. " +
            "Automation features may not be available. Be sure to update " +
            "your device to receive these latest improvements."

        exitRawReplModeFlag = true;
    }

    if (string.includes("OKhttps://github.com/")) {

        gitRepoLink = string.substring(string.indexOf("https"),
            string.lastIndexOf('\r\n'));

        console.log(gitRepoLink);

        // Use the repo link to get the latest git tag
        let gitOwnerAndRepo = string.substring(
            string.indexOf('github.com'),
            string.lastIndexOf('\r\n')).split('/');

        let owner = gitRepoLink.split('/')[3];
        let repo = gitRepoLink.split('/')[4];

        getLatestGitTag(owner, repo).then(value => {
            latestGitTag = value;
        });

        // Check the device version
        queueReplData("print(device.VERSION)\r\n");
        queueReplData("\x04");
    }

    if (string.includes("OKv")) {

        let currentVersion = string.substring(string.indexOf("OKv") + 2,
            string.lastIndexOf("\r\n"));

        console.log("Current Version is: " + currentVersion);
        console.log("New Version is: " + latestGitTag);

        if ((currentVersion != latestGitTag) &&
            gitRepoLink.includes("monocle")) {
            infoText.innerHTML = "New firmware <a href='" + gitRepoLink +
                "/releases/latest' target='_blank'>(" + latestGitTag +
                ")</a> available. Click <a href='#' onclick='queueReplData(\"import update;update.micropython();\x04\")'>here</a> to update.";
        }

        exitRawReplModeFlag = true;
    }

    if (exitRawReplModeFlag) {

        // Clear the screen
        replConsole.value = '';
        cursorPosition = 0;

        queueReplData("\x03"); // Send Ctrl-C to clear the prompt
        queueReplData("\x02"); // Send Ctrl-A to enter RAW mode

        catchResponseFlag = false;
    }
}

export function disconnectHandler() {

    bluetoothIcon.src = "/images/no-bluetooth-icon.svg"

    connectButton.innerHTML = "Connect";

    controlButtons.forEach(ele => {
        ele.disabled = true;
    })
}
