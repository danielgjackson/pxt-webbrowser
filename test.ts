browserBridge.onReceivedString(function (message) {
    basic.showIcon(IconNames.Happy, 500)
    basic.showString(message)
})
browserBridge.onReceivedValue(function (name, value) {
    basic.showIcon(IconNames.Diamond, 500)
    basic.showString(name)
    basic.showIcon(IconNames.SmallDiamond, 500)
    basic.showNumber(value)
})
browserBridge.onConnected(function () {
    basic.showIcon(IconNames.Yes, 500)
})
browserBridge.onDisconnected(function () {
    basic.showIcon(IconNames.No, 500)
})
let count = 0
browserBridge.startupBluetooth()
basic.forever(function () {
    basic.pause(1000)
    count += 1
    if (count >= 10) {
        count = 0
    }
    browserBridge.sendString(convertToText(count))
})
