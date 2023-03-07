# Web Bluetooth based MicroPython REPL 

For use with Bluetooth enabled MicroPython devices such as the [S1 Module](https://www.siliconwitchery.com/module), and the [Brilliant Monocle](https://www.brilliantmonocle.com).

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
- **Ctrl-A** - Puts MicroPython into [raw mode](https://www.brilliantmonocle.com).
- **Ctrl-B** - Puts Micropython into normal mode. This is the mode you probably want to use.
- **Ctrl-C** - Sends a Keyboard Interrupt. Useful for breaking out of running scripts or loops.
- **Ctrl-D** - Executes a raw mode command, or resets the device.
- **Ctrl-E** - Paste mode which allows you to paste multiple lines.

## Mobile keyboard:

In mobile views, the buttons are replaced by an on-screen keyboard. This was originally a workaround based on how the Android keyboard (doesn't) work. Now you'll find some useful keys in the new keyboard.

## Automation:

For Brilliant's devices, there is some built in automation which is used to check the firmware and display upgrade prompts. This also includes the capability to automatically detect the firmware update mode, download the relevant files from GitHub, and start updating.

## Coming soon

- FPGA bitstream loading support for S1 devices.
- FPGA bitstream loading support for Brilliant devices.
- Python file upload for Brilliant devices.
- Firmware upgrading for S1 devices.