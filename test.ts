webbrowser.onReceived(function (message) {
    basic.showIcon(IconNames.Happy, 500)
    basic.showString(message)
})
let count = 0
webbrowser.startup()
basic.forever(function () {
    basic.pause(1000)
    count += 1
    if (count >= 10) {
        count = 0
    }
    webbrowser.send(convertToText(count))
})
