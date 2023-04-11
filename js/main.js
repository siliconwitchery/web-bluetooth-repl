import { connect, disconnect, isConnected } from "./bluetooth.js";
import { replHandleKeyPress, replResetConsole, replFocusCursor } from "./repl.js";
import { checkForUpdates, startFirmwareUpdate, startFpgaUpdate } from "./update.js"
import { startNordicDFU } from "./nordicdfu.js"

const replPlaceHolderText =
    "Welcome to the MicroPython Web Bluetooth REPL.\n\n" +
    "Make sure you're using either Chrome Desktop, Android Chrome, or iOS Bluefy.\n\n" +
    "Report bugs and check out the source code here: https://github.com/siliconwitchery/web-bluetooth-repl\n\n\n" +
    "Hit any key to connect!";

window.addEventListener("load", () => {
    replConsole.value = replPlaceHolderText;
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

        if (connectionResult === "dfu connected") {
            infoText.innerHTML = "Starting firmware update";
            await startNordicDFU()
                .catch(() => {
                    disconnect();
                    throw ("Bluetooth error. Reconnect or check console for details");
                });
            disconnect();
        }

        if (connectionResult === "repl connected") {
            infoText.innerHTML = await checkForUpdates();
            replResetConsole();
        }
    }

    catch (error) {
        // Ignore User cancelled errors
        if (error.message && error.message.includes("cancelled")) {
            return;
        }
        infoText.innerHTML = error;
        console.error(error);
    }
}

export function onDisconnect() {
    if (infoText.innerHTML.includes("Reconnect")) {
        return;
    }
    infoText.innerHTML = "Disconnected";
}

// Always keep the test area focused when pressing buttons
setInterval(function () {
    replFocusCursor();
}, 1000);

ctrlAButton.addEventListener('click', () => {
    replHandleKeyPress("a", true, false);
});

ctrlBButton.addEventListener('click', () => {
    replHandleKeyPress("b", true, false);
});

ctrlCButton.addEventListener('click', () => {
    replHandleKeyPress("c", true, false);
});

ctrlDButton.addEventListener('click', () => {
    replHandleKeyPress("d", true, false);
});

ctrlEButton.addEventListener('click', () => {
    replHandleKeyPress("e", true, false);
});

clearButton.addEventListener('click', () => {
    replHandleKeyPress("k", false, true);
});

window.updateFpgaFromFile = (input) => {

    if (input.files.length === 0) {
        return;
    }

    let file = input.files[0];
    if (!file.name.includes('.bin') || file.size != 444430) {
        infoText.innerHTML = "Invalid FPGA file. Expected a .bin file that should be 444kB";
        return;
    }

    let reader = new FileReader();

    reader.readAsArrayBuffer(file);

    reader.onload = function () {
        startFpgaUpdate(reader.result)
            .then(() => {
                infoText.innerHTML = "FPGA update completed. Reconnect";
            })
            .catch(error => {
                infoText.innerHTML = error;
            })
    };

    reader.onerror = function () {
        infoText.innerHTML = reader.error;
    };
}

window.updateFirmware = () => {
    startFirmwareUpdate()
        .then(() => {
            infoText.innerHTML = "Reconnect to <b>DFUTarg</b> to begin the update";
        })
        .catch(error => {
            infoText.innerHTML = error;
        })
}

window.updateFpga = () => {
    startFpgaUpdate()
        .then(() => {
            infoText.innerHTML = "FPGA update completed. Reconnect";
        })
        .catch(error => {
            infoText.innerHTML = error;
        })
}

export function reportUpdatePercentage(percentage) {
    infoText.innerHTML = "Updating " + percentage.toFixed(2) + "%";
}

// NEED Testing and validation by Raj /Joshua
//  -by uma

/** converting raw data to image */
// Image Variables
let image_final_buffer = null;
let image_file_name = null;
let image_file_size = null;

// Whenever raw data arrives over bluetooth
export function receiveRawData(event) {
    console.log(event.target.value);

    try{
        if(appendBuffer(event.target.value.buffer)){
            showImage()
            console.log(`finished transfer: ${image_file_name} -  ${image_final_buffer.byteLength} of ${image_file_size}`)
            
        }else{
            console.log(`progress: ${image_file_name} -  ${image_final_buffer.byteLength} of ${image_file_size}`)
        }
        image_final_buffer = null;
        image_file_size = null;
        image_file_name = null;
    }catch(error){
        console.log(error)
    }
    
}

//for displaying recieved imaged
 function showImage(){
    let file_ext = image_file_name.split('.').pop()
    let img_blob = new Blob([image_final_buffer], { type: "image/"+file_ext });
    let urlCreator = window.URL || window.webkitURL;
    let imageUrl = urlCreator.createObjectURL(img_blob);
    // let img = document.querySelector("#image");
    // img.src = imageUrl;
    let a = document.createElement('a');
    a.href = imageUrl;
    a.download = image_file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
   
 }

// concatinating data function
const appendBuffer = function (buffer) {
    let w_temp = new Uint8Array(buffer)

//FLAGS for data read
    const FILE_INDEX = w_temp[0]
    const FILE_SIZE_START = 1
    const FILE_SIZE_BITS = 4
    const FILE_NAME_LENGTH_SIZE = 5
    const FILE_NAME_LENGTH_BIT= 1

    const FILE_NAME_START = FILE_NAME_LENGTH_SIZE + FILE_NAME_LENGTH_BIT

    if (FILE_INDEX === 1 || FILE_INDEX === 0) {

        image_file_size = new Int32Array(w_temp.slice(FILE_SIZE_START, FILE_SIZE_START+FILE_SIZE_BITS).buffer).toString(10)
        image_file_name = new TextDecoder("utf-8").decode(w_temp.slice(FILE_NAME_START, w_temp[FILE_NAME_LENGTH_SIZE] + FILE_NAME_START))
        image_final_buffer = w_temp.slice(w_temp[FILE_NAME_LENGTH_SIZE] + FILE_NAME_START, w_temp.byteLength).buffer
    }
    if(FILE_INDEX === 2 || FILE_INDEX === 3){
        let tmp = new Uint8Array(image_final_buffer.byteLength + w_temp.byteLength-1);
        tmp.set(new Uint8Array(image_final_buffer), 0);
        tmp.set(new Uint8Array(w_temp.slice(1, w_temp.byteLength)), image_final_buffer.byteLength);
        image_final_buffer = tmp.buffer
    }

    if (FILE_INDEX === 0 || FILE_INDEX === 3) {
        return true;
        // payload finished
    }else{
        return false;
    }

};
