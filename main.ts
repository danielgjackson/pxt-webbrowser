/**
 * Web browser bridge
 */

//% color="#AA278D" weight=100 icon="\uf3cd" block="Browser Bridge"
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

    //% block="start Bluetooth browser bridge"
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
    export function startupSerial() {
        startup()
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
        // Differentiate string (or value) and objects
        if (line.length <= 0 || (line[0] != '{' && line[0] != '[')) {
            // Check whether it can be handled as name:value
            const parts = line.split(':')
            const name = parts[0]
            const valueString = parts.slice(1).join(':')
            const value = parseFloat(valueString)
            
            if (!isNaN(valueString as any) && !isNaN(parseFloat(valueString))) {
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
    function transmit(connection: Connection, data: object) {
        const line = JSON.stringify(data)
        if (connectedBluetooth && (connection == Connection.Bluetooth || connection == Connection.Broadcast)) {
            bluetooth.uartWriteLine(line)
        }
        if (enabledSerial && (connection == Connection.Serial || connection == Connection.Broadcast)) {
            serial.writeLine(line)
        }
    }
    
    //% block
    export function sendString(message: string) {
        const data = {
            type: 'string',
            value: message,
        }
        transmit(Connection.Broadcast, data)
    }

    /**
     * Run code when a Bluetooth connection is made
     */
    //% block="on Bluetooth browser bridge connection"
    export function onConnected(handler: () => void): void {
        handlerConnected = handler
    }

    /**
     * Run code when a Bluetooth connection is lost
     */
    //% block="on Bluetooth browser bridge disconnection"
    export function onDisconnected(handler: () => void): void {
        handlerDisconnected = handler
    }

    /**
     * Run code when a string message is received
     * @param message
     */
    //% draggableParameters="reporter"
    //% block="on received string $message"
    //% message.defl=string
    export function onReceivedString(handler: (message: string) => void): void {
        handlerReceivedString = handler
    }

    /**
     * Run code when a value is received
     * @param name
     * @param value
     */
    //% draggableParameters="reporter"
    //% block="on received value $value named $name"
    //% name.defl=string
    //% value.defl=number
    export function onReceivedValue(handler: (name: string, value: number) => void): void {
        handlerReceivedValue = handler
    }

}
