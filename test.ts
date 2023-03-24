browserBridge.onConnected(function () {
    basic.showIcon(IconNames.Yes)
})
browserBridge.onDisconnected(function () {
    basic.showIcon(IconNames.No)
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
let count = 0
browserBridge.startupBluetooth()
basic.showIcon(IconNames.Square)
basic.forever(function () {
    basic.pause(1000)
    count += 1
    if (count >= 10) {
        count = 0
    }
    browserBridge.sendString(convertToText(count))
})
