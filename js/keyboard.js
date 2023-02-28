import { replHandleKeyPress } from "./repl.js";

let Keyboard = window.SimpleKeyboard.default;

let keyboard = new Keyboard({
    onKeyPress: button => onKeyPress(button),
    theme: "hg-theme-default hg-theme-ios",
    layout: {
        default: [
            "q w e r t y u i o p",
            "a s d f g h j k l",
            "{shift} z x c v b n m {bksp}",
            "{num} {space} {return}"
        ],
        shift: [
            "Q W E R T Y U I O P",
            "A S D F G H J K L",
            "{shift} Z X C V B N M {bksp}",
            "{num} {space} {return}"
        ],
        num: [
            "1 2 3 4 5 6 7 8 9 0",
            `- / : ; ( ) $ & $ "`,
            "{alt} . , ? ! ' {bksp}",
            "{default} {space} {return}"
        ],
        alt: [
            "[ ] { } # % ^ * + =",
            `_ \\ | ~ < > "`,
            "{num} . , ? ! ' {bksp}",
            "{default} {space} {return}"
        ]
    },
    display: {
        "{default}": "ABC",
        "{shift}": "⇧",
        "{num}": "123",
        "{alt}": "#+=",
        "{bksp}": "⇦",
        "{space}": " ",
        "{return}": "return",
    }
});

function onKeyPress(button) {

    const currentLayout = keyboard.options.layoutName;

    console.log("Button pressed", button);


    switch (button) {
        case "{shift}":
            if (currentLayout === "default")
                keyboard.setOptions({ layoutName: "shift" });
            else
                keyboard.setOptions({ layoutName: "default" });
            break;

        case "{num}":
            keyboard.setOptions({ layoutName: "num" });
            break;

        case "{default}":
            keyboard.setOptions({ layoutName: "default" });
            break;

        case "{alt}":
            keyboard.setOptions({ layoutName: "alt" });
            break;

        case "{bksp}":
            replHandleKeyPress("Backspace", false, false);
            break;

        case "{space}":
            replHandleKeyPress(" ", false, false);
            break;

        case "{return}":
            replHandleKeyPress("Enter", false, false);
            break;

        default:
            replHandleKeyPress(button, false, false);
            break;
    }
}
