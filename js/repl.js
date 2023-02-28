import { replDataTxQueue } from "./bluetooth.js";

let cursorPosition = 0;
let rawResponseFlag = false;
let rawResponseString = "";

export function replSend(string) {

    // Encode the UTF-8 string into an array and populate the buffer
    const encoder = new TextEncoder('utf-8');
    replDataTxQueue.push.apply(replDataTxQueue, encoder.encode(string));
}

export async function replSendRaw(string) {

    rawResponseFlag = true;

    replSend("\x03"); // Send Ctrl-C to clear the prompt
    replSend("\x01"); // Send Ctrl-A to enter RAW mode
    replSend(string);
    replSend("\x04"); // Send Ctrl-D to execute

    return new Promise(waitForResponse);

    function waitForResponse(resolve, reject) {

        if (rawResponseString.endsWith('>')) {

            console.log("Received raw repl response: " + rawResponseString)
            resolve(rawResponseString);
            rawResponseFlag = false;
            rawResponseString = "";
        }
        else {

            setTimeout(waitForResponse.bind(this, resolve, reject), 100);
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

export function replHandleKeyPress(key, ctrlKey, metaKey) {

    if (ctrlKey) {
        switch (key) {

            case 'a':
                replSend("\x01"); // Send Ctrl-A
                break;

            case 'b':
                replSend("\x02"); // Send Ctrl-B
                break;

            case 'c':
                // If text is selected, copy instead of sending Ctrl-C
                if (replConsole.selectionStart != replConsole.selectionEnd) {
                    return false;
                }
                replSend("\x03"); // Send Ctrl-C
                break;

            case 'd':
                replSend("\x04"); // Send Ctrl-D
                break;

            case 'e':
                replSend("\x05"); // Send Ctrl-D
                break;

            case 'k':
                replConsole.value = "";
                cursorPosition = 0;
                replSend("\x03"); // Send Ctrl-C
                break;

            case 'v':
                // Allow pasting
                return false;
        }

        return true;
    }

    if (metaKey) {
        switch (key) {

            case 'k':
                replConsole.value = "";
                cursorPosition = 0;
                replSend("\x03"); // Send Ctrl-C
                break;

            case 'c':
                // Allow copy
                return false;

            case 'v':
                // Allow pasting
                return false;

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

        return true;
    }

    switch (key) {

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
            if (key.length == 1) {
                replSend(key)
            }
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