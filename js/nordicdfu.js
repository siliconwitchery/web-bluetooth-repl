import { transmitNordicDfuControlData, transmitNordicDfuPacketData } from "./bluetooth.js"
import { gitInfo } from "./update.js";
import { request } from "https://cdn.skypack.dev/@octokit/request";

let controlResponseCallback;

export async function startNordicDFU() {

    if (!gitInfo.owner || !gitInfo.repo) {
        // TODO
        gitInfo.owner = 'brilliantlabsAR';
        gitInfo.repo = 'monocle-micropython';
    }

    let response = await request("GET /repos/{owner}/{repo}/releases/latest", {
        owner: gitInfo.owner,
        repo: gitInfo.repo
    });

    let assetId;
    response.data.assets.forEach((item, index) => {
        if (item.content_type === 'application/zip') {
            assetId = item.id;
        }
    });

    response = await request("GET /repos/{owner}/{repo}/releases/assets/{assetId}", {
        owner: gitInfo.owner,
        repo: gitInfo.repo,
        assetId: assetId,
        headers: {
            'Accept': 'application/octet-stream'
        }
    });

    console.log(response.data);

    await nordicDfuSendControl([6, 1]);

    nordicDfuSendPacket([1, 2, 3]);
}

export async function nordicDfuSendControl(bytes) {

    console.log('DFU control ⬆️: ' + bytes);

    transmitNordicDfuControlData(bytes);

    // Return a promise which calls a function that'll eventually run when the
    // response handler calls the function associated with controlResponseCallback
    return new Promise(resolve => {
        controlResponseCallback = function (responseBytes) {
            console.log('DFU control ⬇️: ' + responseBytes);
            resolve(responseBytes);
        };
        setTimeout(() => {
            resolve("");
        }, 1000);
    });
}

export function nordicDfuHandleControlResponse(bytes) {
    controlResponseCallback(bytes);
}

export function nordicDfuSendPacket(bytes) {
    console.log('DFU packet ⬆️: ' + bytes);
    transmitNordicDfuPacketData(bytes);
}

window.nordicDfuSendControl = nordicDfuSendControl;
window.nordicDfuSendPacket = nordicDfuSendPacket;