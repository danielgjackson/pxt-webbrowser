/**
 * Web browser bridge
 */

//% color="#AA278D" weight=100 icon="\uf3cd" block="Browser Bridge"
//% groups=['Connection', 'Data']
namespace browserBridge {

    enum Connection {
        Broadcast,  // both Bluetooth and serial (if enabled)
        Bluetooth,
        Serial,
    }

    let started = false
    let enabledBluetooth = false
    let connectedBluetooth = false
    let enabledSerial = false

    let handlerReceivedString: (message: string) => void
    let handlerReceivedValue: (name: string, value: number) => void
    let handlerConnected: () => void
    let handlerDisconnected: () => void

    function startup() {
        if (started) return
        // TODO: Any global start-up logic

        started = true
    }

    //% block="start browser bridge"
    //% group="Connection"
    export function startupBluetooth() {
        startup()
        bluetooth.onBluetoothConnected(function () {
            connectedBluetooth = true
            if (handlerConnected) {
                handlerConnected()
            }
        })

        bluetooth.onBluetoothDisconnected(function () {
            connectedBluetooth = false
            if (handlerDisconnected) {
                handlerDisconnected()
            }
        })
        
        bluetooth.onUartDataReceived(bluetooth.NEW_LINE, function () {
            const line = bluetooth.uartReadUntil(bluetooth.NEW_LINE)
            receivedLine(Connection.Bluetooth, line)
        })

        bluetooth.startUartService();

        enabledBluetooth = true
    }

    //% block="start serial browser bridge"
    //% group="Connection"
    //% advanced=true
    export function startupSerial() {
        startup()
        serial.setWriteLinePadding(0)
        serial.setRxBufferSize(64)
        serial.setTxBufferSize(64)
        serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
            const line = serial.readUntil(serial.delimiters(Delimiters.NewLine))
            receivedLine(Connection.Serial, line)
        })
        enabledSerial = true
    }

    // Received packet from a connection
    function receivedLine(connection: Connection, line: string) {
        let response = null
        if (line.length > 0 && line[line.length - 1] == '\n') {
            line = line.substr(0, line.length - 1);
        }
        if (line.length > 0 && line[line.length - 1] == '\r') {
            line = line.substr(0, line.length - 1);
        }
        // Differentiate string (or value) and objects
        if (line.length <= 0 || (line[0] != '{' && line[0] != '[')) {
            // Check whether it can be handled as name:value
            const parts = line.split(':')
            const name = parts[0]
            const valueString = parts.slice(1).join(':')
            const value = parseFloat(valueString)
            const hasNumericValue = valueString.length > 0 && !isNaN(valueString as any) && !isNaN(value)
            if (hasNumericValue) {
                // Value type
                if (handlerReceivedValue != null) {
                    handlerReceivedValue(name, value)
                }
            } else {
                // String type
                if (handlerReceivedString != null) {
                    handlerReceivedString(line)
                }
            }
        } else {
            const data = JSON.parse(line)
            // TODO: Handle object data

        }
        if (response !== null) {
            transmit(connection, response)
        }
    }

    // Transmit packet to one or more connections
    function transmit(connection: Connection, data: object | string) {
        let line: string;
        if (typeof data === 'string') {
            line = data
        } else {
            line = JSON.stringify(data)
        }
        if (connectedBluetooth && (connection == Connection.Bluetooth || connection == Connection.Broadcast)) {
            bluetooth.uartWriteLine(line)
        }
        if (enabledSerial && (connection == Connection.Serial || connection == Connection.Broadcast)) {
            serial.writeLine(line)
        }
    }

    /**
     * Run code when a Bluetooth connection is made
     */
    //% block="on Bluetooth browser bridge connection"
    //% group="Connection"
    //% advanced=true
    //% weight=55
    export function onConnected(handler: () => void): void {
        handlerConnected = handler
    }

    /**
     * Run code when a Bluetooth connection is lost
     */
    //% block="on Bluetooth browser bridge disconnection"
    //% group="Connection"
    //% advanced=true
    export function onDisconnected(handler: () => void): void {
        handlerDisconnected = handler
    }

    //% block
    //% group="Data"
    //% weight=65
    export function sendString(message: string) {
        transmit(Connection.Broadcast, message)
    }

    //% block
    //% group="Data"
    //% weight=63
    //% name.defl="x"
    export function sendValue(name: string, value: number) {
        const data = `${name}:${value}`
        transmit(Connection.Broadcast, data)
    }

    /**
     * Run code when a string message is received
     * @param message
     */
    //% draggableParameters="reporter"
    //% block="on received string $message"
    //% group="Data"
    //% weight=55
    export function onReceivedString(handler: (message: string) => void): void {
        handlerReceivedString = handler
    }

    /**
     * Run code when a value is received
     * @param name
     * @param value
     */
    //% draggableParameters="reporter"
    //% block="on received $name named value $value"
    //% group="Data"
    //% weight=53
    export function onReceivedValue(handler: (name: string, value: number) => void): void {
        handlerReceivedValue = handler
    }

}
