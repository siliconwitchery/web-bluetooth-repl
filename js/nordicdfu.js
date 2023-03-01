import { gitReleaseLink } from "./update.js";

export const nordicDfuServiceUuid = 0xfe59;

export async function startNordicDFU() {

    console.log(gitReleaseLink);
    let response = await fetch(gitReleaseLink,
        {
            mode: 'no-cors'
        });
    console.log(response);
    // TODO return if we can update from the link

    let input = document.createElement('input');
    input.type = 'file';
    input.onchange = _ => {
        let file = Array.from(input.files)[0];

        if (!file.type.includes('zip')) {
            return Promise.reject('Must be a .zip file.');
        }

    };
    input.click();
}