/**
 * Functions are mapped to blocks using various macros
 * in comments starting with %. The most important macro
 * is "block", and it specifies that a block should be
 * generated for an **exported** function.
 */

//% color="#AA278D" weight=100 icon="\uf3cd" block="Web Browser Bridge"
namespace webbrowser {

    let recvHandler: (message: string) => void = function (message: string) {
        // TODO: Remove default handler
        basic.showIcon(IconNames.Sad, 500)
        basic.showString(message)
    }

    //% block
    export function startup() {
        bluetooth.onBluetoothConnected(function () {
            // TODO: Remove
            basic.showIcon(IconNames.Yes)
        })

        bluetooth.onBluetoothDisconnected(function () {
            // TODO: Remove
            basic.showIcon(IconNames.No)
        })
        
        bluetooth.onUartDataReceived(bluetooth.NEW_LINE, function () {
            let recv = bluetooth.uartReadUntil(bluetooth.NEW_LINE)
            // TODO: Remove
            //basic.showString(recv)
            if (recvHandler != null) {
                recvHandler(recv)
            }
        })

        bluetooth.startUartService();

        // TODO: Remove
        basic.showString("-")
    }
    
    //% block
    export function send(message: string) {
        // TODO: Remove
        //basic.showString(message)
        bluetooth.uartWriteLine(message)
// TODO: Remove - only calling on send for debugging
if (recvHandler != null) {
recvHandler(message)
}
    }

    /**
     * Run code when a certain kind of sprite is created
     * @param kind
     * @param sprite
     */
    //% draggableParameters="reporter"
    //% blockId=webbrowseronreceived block="on received $message"
    //% message.defl=string
    export function onReceived(handler: (message: string) => void): void {
// TODO: This is not setting the handler properly?
        recvHandler = handler
// TODO: Remove
basic.showIcon(IconNames.Heart, 500)
    }

}
