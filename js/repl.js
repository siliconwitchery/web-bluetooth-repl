import { isConnected, replDataTxQueue } from "./bluetooth.js";
import { ensureConnected } from "./main.js";

let cursorPosition = 0;
let rawResponseFlag = false;
let rawResponseString = "";

export async function replSend(string) {

    ensureConnected();

    // Strings will be thrown away if not connected
    if (isConnected()) {
        // Encode the UTF-8 string into an array and populate the buffer
        const encoder = new TextEncoder('utf-8');
        replDataTxQueue.push.apply(replDataTxQueue, encoder.encode(string));
    }
}

export async function replSendRaw(string) {

    rawResponseFlag = true;

    // Ctrl-C Ctrl-A to enter Raw mode, and Ctrl to run the string
    await replSend("\x03\x01" + string + "\x04");

    return new Promise(waitForResponse);

    function waitForResponse(resolve, reject) {

        if (rawResponseString.endsWith('>')) {
            console.log("Received raw repl response: " + rawResponseString)
            resolve(rawResponseString);
            rawResponseFlag = false;
            rawResponseString = "";
        }
        else {
            setTimeout(waitForResponse.bind(this, resolve, reject));
        }
    }
}

export function replHandleResponse(string) {

    if (rawResponseFlag) {

        // Raw responses are handled in another function
        rawResponseString += string;

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

// Forwards keys to the repl. Returns true to prevent default behavior in the input box
export function replHandleKeyPress(key, ctrlKey, metaKey) {

    if (ctrlKey) {
        switch (key) {

            case 'a':
                replSend("\x01");
                break;

            case 'b':
                replSend("\x02");
                break;

            case 'c':
                // If text is selected, allow copy instead of sending Ctrl-C
                if (replConsole.selectionStart != replConsole.selectionEnd) {
                    return false;
                }
                replSend("\x03");
                break;

            case 'd':
                replSend("\x04");
                break;

            case 'e':
                replSend("\x05");
                break;

            case 'k':
                replResetConsole();
                replSend("\x03");
                break;

            // Allow all other key combinations
            default:
                return false;
        }

        // Don't process the key singly
        return true;
    }

    if (metaKey) {
        switch (key) {

            case 'k':
                replResetConsole();
                replSend("\x03");
                break;

            case 'Backspace':
                replSend(
                    "\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b" +
                    "\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b" +
                    "\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b\b");
                break;

            case 'ArrowRight':
                // Send End key
                replSend("\x1B[F");
                break;

            case 'ArrowLeft':
                // Send Home key
                replSend("\x1B[H");
                break;

            // Allow all other key combinations
            default:
                return false;
        }

        // Don't process the key singly
        return true;
    }

    switch (key) {

        case 'Backspace':
            replSend("\x08");
            break;

        case 'ArrowUp':
            replSend("\x1B[A");
            break;

        case 'ArrowDown':
            replSend("\x1B[B");
            break;

        case 'ArrowRight':
            replSend("\x1B[C");
            break;

        case 'ArrowLeft':
            replSend("\x1B[D");
            break;

        case 'Tab':
            replSend("\x09");
            break;

        case 'Enter':
            // Send End key before sending \r
            replSend("\x1B[F\r");
            break;

        default:
            // Ignore special keys like F1, F2 etc 
            if (key.length > 1) {
                return false;
            }

            // Send all other single keys to the repl
            replSend(key)
            break;
    }

    // Don't print characters to the REPL console because the response will print it for us
    return true;
}

// This handles keypress events, but only on desktop Chrome and iOS
replConsole.addEventListener('keydown', (event) => {

    if (replHandleKeyPress(event.key, event.ctrlKey, event.metaKey)) {
        event.preventDefault();
    }
});

// This handles paste events
replConsole.addEventListener('beforeinput', (event) => {

    replSend(event.data.replaceAll('\n', '\r'));
    event.preventDefault();
});

export function replResetConsole() {

    replConsole.value = '';
    cursorPosition = 0;
}

export function replFocusCursor() {
    // Don't refocus when selecting
    if (replConsole.selectionStart != replConsole.selectionEnd) {
        return;
    }
    replConsole.focus();
    replConsole.selectionStart = cursorPosition;
    replConsole.selectionEnd = cursorPosition;
}