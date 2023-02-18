import { connectDisconnect, queueReplData } from "./bluetooth.js";
import { getLatestGitTag } from "./gitutils.js";

window.addEventListener("load", (event) => {
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
})


replConsole.onkeypress = (event) => {

    // Create a mutable copy of the event.key value
    let key = event.key;

    if (key === 'Enter') {

        key = "\r\n";

        queueReplData("\x1B[F"); // Send End key before sending \r\n
    }

    queueReplData(key)

    // Don't print characters to the REPL console because the response will print it for us
    event.preventDefault();
}

// Whenever keys such as Ctrl, Tab or Backspace are pressed/held
replConsole.onkeydown = (event) => {

    // If Ctrl is held
    if (event.ctrlKey) {
        switch (event.key) {

            case 'a':

                queueReplData("\x01"); // Send Ctrl-A
                event.preventDefault(); // Prevent select all
                return;

            case 'b':

                queueReplData("\x02"); // Send Ctrl-B
                event.preventDefault();
                return;

            case 'c':

                queueReplData("\x03"); // Send Ctrl-C
                event.preventDefault(); // Prevent copy
                return;

            case 'd':

                queueReplData("\x04"); // Send Ctrl-D
                event.preventDefault();
                return;

            case 'e':

                queueReplData("\x05"); // Send Ctrl-E
                event.preventDefault();
                return;
        }
    }

    // If the meta/command key is held
    if (event.metaKey) {
        switch (event.key) {

            case 'k':

                replConsole.value = "";
                cursorPosition = 0;
                queueReplData("\x03"); // Send Ctrl-C
                event.preventDefault();
                return;

            case 'Backspace':

                queueReplData(
                    "\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b" +
                    "\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b" +
                    "\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b");
                event.preventDefault();
                return;

            case 'ArrowRight':

                queueReplData("\x1B[F"); // Send End key
                event.preventDefault();
                return;

            case 'ArrowLeft':

                queueReplData("\x1B[H"); // Send Home key
                event.preventDefault();
                return;
        }
    }

    if (event.key === 'Backspace') {

        queueReplData("\x08"); // Send backspace
        event.preventDefault();
        return;
    }

    if (event.key === 'ArrowUp') {

        queueReplData("\x1B[A"); // Send up arrow key
        event.preventDefault();
        return;
    }

    if (event.key === 'ArrowDown') {

        queueReplData("\x1B[B"); // Send down arrow key
        event.preventDefault();
        return;
    }

    if (event.key === 'ArrowRight') {

        queueReplData("\x1B[C"); // Send right arrow key
        event.preventDefault();
        return;
    }

    if (event.key === 'ArrowLeft') {

        queueReplData("\x1B[D"); // Send left arrow key
        event.preventDefault();
        return;
    }

    if (event.key === 'Tab') {

        queueReplData("\x09"); // Send Tab key
        event.preventDefault();
        return;
    }
}

function pasteEvent() {

    navigator.clipboard.readText()
        .then(text => {

            // Micropython requires \r\n
            queueReplData(text.replace('\n', '\r\n'))
        })

        .catch(() => {

            alert("Could not paste. Did you allow clipboard permissions?");
        });
}

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

        // exitRawReplModeFlag = true;
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

window.queueReplData = queueReplData;