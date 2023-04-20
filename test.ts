input.onButtonPressed(Button.A, function () {
    browserBridge.sendString("A")
})
input.onButtonPressed(Button.B, function () {
    browserBridge.sendString("B")
})
browserBridge.onReceivedString(function (message) {
    basic.showIcon(IconNames.SmallSquare)
    basic.pause(500)
    basic.showString(message)
})
browserBridge.onReceivedValue(function (name, value) {
    basic.showIcon(IconNames.Diamond)
    basic.pause(500)
    basic.showString(name)
    basic.showIcon(IconNames.SmallDiamond)
    basic.pause(500)
    basic.showNumber(value)
})
browserBridge.startupBluetooth()
browserBridge.startupSerial()
basic.showIcon(IconNames.Square)
