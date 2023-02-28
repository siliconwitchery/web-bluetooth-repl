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
            "{num} {tab} {space} {return}"
        ],
        shift: [
            "Q W E R T Y U I O P",
            "A S D F G H J K L",
            "{shift} Z X C V B N M {bksp}",
            "{num} {tab} {space} {return}"
        ],
        num: [
            "1 2 3 4 5 6 7 8 9 0",
            `- / : ; ( ) $ & $ "`,
            "{alt} . , ? ! ' {bksp}",
            "{default} {ctrl} {space} {return}"
        ],
        alt: [
            "[ ] { } # % ^ * + =",
            `_ \\ | ~ < > "`,
            "{num} . , ? ! ' {bksp}",
            "{default} {ctrl} {space} {return}"
        ],
        ctrl: [
            "{ctrl-a} {ctrl-b} {ctrl-c} {ctrl-d} {ctrl-e}",
            `{upload} {clear}`,
            "{num} {up} {down} {left} {right} {bksp}",
            "{default} {space} {return}"
        ]
    },
    display: {
        "{default}": "ABC",
        "{shift}": "⇧",
        "{num}": "123",
        "{alt}": "#+=",
        "{ctrl}": "ctrl",

        "{tab}": "⇥",
        "{bksp}": "⌫",
        "{space}": " ",
        "{return}": "return",

        "{ctrl-a}": "ctrl-a",
        "{ctrl-b}": "ctrl-b",
        "{ctrl-c}": "ctrl-c",
        "{ctrl-d}": "ctrl-d",
        "{ctrl-e}": "ctrl-e",

        "{upload}": "upload fpga file",
        "{clear}": "clear repl",

        "{up}": "⇧",
        "{down}": "⇩",
        "{left}": "⇦",
        "{right}": "⇨",
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

        case "{ctrl}":
            keyboard.setOptions({ layoutName: "ctrl" });
            break;

        case "{bksp}":
            replHandleKeyPress("Backspace", false, false);
            break;

        case "{tab}":
            replHandleKeyPress("Tab", false, false);
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
