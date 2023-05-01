# Web Bluetooth based MicroPython REPL 

For use with Bluetooth enabled MicroPython devices such as the [S1 Module](https://www.siliconwitchery.com/module), and the [Brilliant Monocle](https://www.brilliant.xyz).

> Try it here: https://repl.siliconwitchery.com

Make sure you're using either **Chrome Desktop**, **Android Chrome**, or [**Bluefy**](https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055) on iOS.

![Demo of the Bluetooth REPL in action](images/demo.gif)

This REPL demonstrates how you can build your own Web Bluetooth based application. It works like a real terminal, sending individual keypresses to the MicroPython REPL, and printing back whatever is returned. This includes handling control keys such as Enter, Backspace, Home and End, but also returned escape sequences which control the cursor on screen.

## Key mapping:

- **Up** - Scrolls up history.
- **Down** - Scrolls down history.
- **Tab** - Indents the line, or auto-completes whatever you're typing.
- **Cmd-Left** - Moves the cursor to the start of the line.
- **Cmd-Right** - Moves the cursor to the end of the line.
- **Cmd-Backspace** - Clears the line.
- **Ctrl-K / Cmd-K** - Clears the screen
- **Ctrl-A** - Puts MicroPython into [raw mode](https://docs.micropython.org/en/latest/reference/repl.html#raw-mode-and-raw-paste-mode).
- **Ctrl-B** - Puts Micropython into normal mode. This is the mode you probably want to use.
- **Ctrl-C** - Sends a Keyboard Interrupt. Useful for breaking out of running scripts or loops.
- **Ctrl-D** - Executes a raw mode command, or resets the device.
- **Ctrl-E** - Paste mode which allows you to paste multiple lines.

## Mobile keyboard:

In mobile views, the buttons are replaced by an on-screen keyboard. This was originally a workaround based on how the Android keyboard (doesn't) work. Now you'll find some useful keys in the new keyboard.

## Device updates:

Upon connection, both the MicroPython firmware as well as FPGA image versions are checked against the latest release on GitHub. If they do not match the latest, a message will appear in the corner which prompts the user to update.

Users can also upload custom FPGA image files using the "Upload" button.

**Note** that firmware/FPGA update is currently only supported on Brilliant devices.