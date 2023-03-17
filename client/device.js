function serial_sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function serial_log(text) {
    console.log(text);
}

class Device {
    constructor(bluetoothDevice) {
        this.bluetoothDevice = bluetoothDevice;
        this.receiveBuffer = [];
        this.lineHandler = null;
        if (Device.devices[this.bluetoothDevice.id]) {
            throw ('ERROR: Device object already created for this device.');
        }
        Device.devices[this.bluetoothDevice.id] = this;
        this.connecting = null;
    }

    destroy() {
        serial_log('DEVICE: Destroy.');
        this.disconnect();
        delete Device.devices[this.bluetoothDevice.id];
    }

    deviceId() {
        // If we have an externally set identifier, use this
        if (this.id) {
            return this.id;
        }
        // If we have it (but we won't as it is blacklisted) Use the serial number from device information
        if (this.deviceInformation && this.deviceInformation.serialNumber) {
            return this.deviceInformation.serialNumber;
        }
        // Use the device's name and the temporary (session) unique device id
        return this.bluetoothDevice.name + '#' + this.bluetoothDevice.id;
    }

    async getDeviceInformation() {
        let deviceInformation = {};
        serial_log('DEVICEINFO: Getting service...');
        const serviceDeviceInformation = await this.server.getPrimaryService('device_information');
        serial_log('DEVICEINFO: Getting characteristics...');
        const characteristics = await serviceDeviceInformation.getCharacteristics();
        const decoder = new TextDecoder('utf-8');
        for (const characteristic of characteristics) {
            switch (characteristic.uuid) {
                case BluetoothUUID.getCharacteristic('serial_number_string'): // 0x2A25 -- Blacklisted in WebBluetooth?!?!
                    deviceInformation.serialNumber = decoder.decode(await characteristic.readValue());
                    break;
                case BluetoothUUID.getCharacteristic('firmware_revision_string'): // 0x2A26
                    deviceInformation.firmwareRevision = decoder.decode(await characteristic.readValue());
                    break;
                case BluetoothUUID.getCharacteristic('hardware_revision_string'): // 0x2A27
                    deviceInformation.hardwareRevision = decoder.decode(await characteristic.readValue());
                    break;
                // case BluetoothUUID.getCharacteristic('software_revision_string'): // 0x2A28
                //   deviceInformation.softwareRevision = decoder.decode(await characteristic.readValue());
                //   break;
                case BluetoothUUID.getCharacteristic('manufacturer_name_string'): // 0x2A29
                    deviceInformation.manufacturerName = decoder.decode(await characteristic.readValue());
                    break;
                default:
                    serial_log('DEVICEINFO: NOTE: Unknown Characteristic: ' + characteristic.uuid);
                    break;
            }
        }
        return deviceInformation;
    }

    async findUart() {
        let uart = {};
        serial_log('UART: Getting service...');
        const serviceUart = await this.server.getPrimaryService(Device.uuidServiceUart);
        serial_log('UART: Getting characteristics... ' + Device.uuidCharacteristicRx + ', ' + Device.uuidCharacteristicTx);
        const characteristics = await serviceUart.getCharacteristics();

        let rx = null, tx = null;

        for (const characteristic of characteristics) {
            if (characteristic.uuid == Device.uuidCharacteristicRx) {
                rx = characteristic;
            } else if (characteristic.uuid == Device.uuidCharacteristicTx) {
                tx = characteristic;
            } else {
                serial_log('UART: WARNING: Unknown characteristic: ' + characteristic.uuid);
            }
        }
        if (!rx || !tx) {
            throw new Error('UART: One or more required characteristics not found.');
        }

        serial_log('--- RX ---')
        serial_log('> Characteristic UUID:  ' + rx.uuid);
        serial_log('> Broadcast:            ' + rx.properties.broadcast);
        serial_log('> Read:                 ' + rx.properties.read);
        serial_log('> Write w/o response:   ' + rx.properties.writeWithoutResponse);
        serial_log('> Write:                ' + rx.properties.write);
        serial_log('> Notify:               ' + rx.properties.notify);
        serial_log('> Indicate:             ' + rx.properties.indicate);
        serial_log('> Signed Write:         ' + rx.properties.authenticatedSignedWrites);
        serial_log('> Queued Write:         ' + rx.properties.reliableWrite);
        serial_log('> Writable Auxiliaries: ' + rx.properties.writableAuxiliaries);

        serial_log('--- TX ---')
        serial_log('> Characteristic UUID:  ' + tx.uuid);
        serial_log('> Broadcast:            ' + tx.properties.broadcast);
        serial_log('> Read:                 ' + tx.properties.read);
        serial_log('> Write w/o response:   ' + tx.properties.writeWithoutResponse);
        serial_log('> Write:                ' + tx.properties.write);
        serial_log('> Notify:               ' + tx.properties.notify);
        serial_log('> Indicate:             ' + tx.properties.indicate);
        serial_log('> Signed Write:         ' + tx.properties.authenticatedSignedWrites);
        serial_log('> Queued Write:         ' + tx.properties.reliableWrite);
        serial_log('> Writable Auxiliaries: ' + tx.properties.writableAuxiliaries);

        if ((tx.properties.notify || tx.properties.indicate) && (rx.properties.writeWithoutResponse || rx.properties.write)) {
            serial_log('UART: Using inverted Tx/Rx characteristics')
            uart.characteristicRx = tx;
            uart.characteristicTx = rx;
        } else if ((rx.properties.notify || rx.properties.indicate) && (tx.properties.writeWithoutResponse || tx.properties.write)) {
            serial_log('UART: Using standard Tx/Rx characteristics')
            uart.characteristicRx = rx;
            uart.characteristicTx = tx;
        } else {
            throw new Error('UART: Tx/Rx characteristics do not have expected properties: notify/indicate or writeWithoutResponse/write.');
        }

        return uart;
    }

    async connectUart() {
        // Find UART characteristics (must be repeated if reconnected)
        this.uart = await this.findUart();

        // Receive handler
        this.receiveHandler = (event) => { this.receive(event); }
        serial_log('UART: Adding value changed handler to RX: ' + Device.uuidCharacteristicRx);
        this.uart.characteristicRx.addEventListener('characteristicvaluechanged', this.receiveHandler);

        this.gattServerDisconnected = () => {
            serial_log('GATT-DISCONNECT: Remove receive listener');
            //this.uart.characteristicRx.stopNotifications(); // async -- can't do this if disconnected anyway!
            if (this.receiveHandler) {
                this.uart.characteristicRx.removeEventListener('characteristicvaluechanged', this.receiveHandler);
                this.receiveHandler = null;
            }
            this.receiveBuffer.splice(0);
            this.bluetoothDevice.removeEventListener('gattserverdisconnected', this.gattServerDisconnected);
            this.gattServerDisconnected = null;
            if (this.disconnectedHandler) {
                this.disconnectedHandler(this);
            }
        }
        serial_log('UART: Adding server disconnected handler...');
        this.bluetoothDevice.addEventListener('gattserverdisconnected', this.gattServerDisconnected);

        if (0) {
            const delay = 5 * 1000;
            serial_log('HACK: Waiting before uart.characteristicRx.startNotifications() for ' + delay + 'ms...');
            await serial_sleep(delay);
        }

        serial_log('UART: Start notifications...');
        try {
            //if (1) serial_log("WARNING: TEMPORARILY NOT CALLING startNotifications()."); else
            await this.uart.characteristicRx.startNotifications();

            if (0) {
                const delay = 5 * 1000;
                serial_log('HACK: Waiting after uart.characteristicRx.startNotifications() for ' + delay + 'ms...');
                await serial_sleep(delay);
            }

        } catch (e) {

            if (0) {
                const delay = 5 * 1000;
                serial_log('HACK: Waiting after ERROR uart.characteristicRx.startNotifications() for ' + delay + 'ms...');
                await serial_sleep(delay);
            }

            // NotSupportedError: GATT operation failed for unknown reason.
            // Bluetooth: chrome://bluetooth-internals
            // Log: chrome://device-log/?refresh=5
            // See: https://mynewt.incubator.apache.org/latest/network/ble_hs/ble_hs_return_codes.html#return-code-reference
            // - 0x02 BLE_HS_EALREADY Operation already in progress or completed.
            serial_log('UART: ERROR while calling startNotifications() -- ' + JSON.stringify(e));
            throw e;
        }
        serial_log('UART: ...started notifications.');
    }

    receive(event) {
        const value = event.target.value;
        //serial_log('UART: RECV: ' + hexDump(value));
        for (let i = 0; i < value.byteLength; i++) {
            this.receiveBuffer.push(value.getUint8(i))
        }
        let idx;
        while ((idx = this.receiveBuffer.indexOf(10)) >= 0) {
            const line = this.receiveBuffer.splice(0, idx + 1);
            line.pop(); // remove LF
            if (line.length > 0 && line[line.length - 1] == 13) line.pop(); // remove CR
            const decoder = new TextDecoder('utf-8');
            const lineString = decoder.decode(new Uint8Array(line))
            this.receiveLine(lineString);
        }
    }

    receiveLine(line) {
        //serial_log('UART: RECV-LINE: ' + line);
        if (this.lineHandler) {
            this.lineHandler(line);
        }
    }

    setLineHandler(lineHandler) {
        const oldLineHandler = this.lineHandler;
        this.lineHandler = lineHandler;
        return oldLineHandler;
    }

    setDisconnectedHandler(disconnectedHandler) {
        this.disconnectedHandler = disconnectedHandler;
    }

    async write(data) {
        if (!this.uart || !this.uart.characteristicTx) {
            throw ('ERROR: Cannot write, no UART.');
        }
        // const writeWithoutResponse = this.uart.characteristicTx.properties.hasOwnProperty('writeWithoutResponse')
        const max = 20;
        for (let offset = 0; offset < data.length; offset += max) {
            const chunk = data.slice(offset, offset + max);
            serial_log('UART: WRITE [' + offset + '/' + data.length + ']'); // hexDump(chunk)
            if (this.uart.characteristicTx.properties.writeWithoutResponse) {
                await this.uart.characteristicTx.writeValueWithoutResponse(chunk);
            } else if (this.uart.characteristicTx.properties.write) {
                await this.uart.characteristicTx.writeValueWithResponse(chunk);
            } else {
                throw ('ERROR: Cannot write, not writable.');
            }
        }
    }

    async writeLine(line) {
        const encoder = new TextEncoder('utf-8');
        serial_log('UART: WRITE-LINE: ' + line);
        const message = line + '\n';
        const data = encoder.encode(message);
        try {
            await this.write(data);
        } catch (e) {
            // NotSupportedError: GATT operation failed for unknown reason.
            // Bluetooth: chrome://bluetooth-internals
            // Log: chrome://device-log/?refresh=5
            // bluetooth_remote_gatt_characteristic_winrt.cc:568 Unexpected GattCommunicationStatus: 2
            // -- ProtocolError	2	- There was a GATT communication protocol error.
            serial_log('UART: ERROR while calling write() -- ' + JSON.stringify(e));
            throw e;
        }
    }

    isConnected() {
        return this.bluetoothDevice.gatt.connected;
    }

    isConnecting() {
        return this.connecting !== null; // && (Date.now - this.connecting) < 5000;
    }

    async connect() {
        serial_log('CONNECT: Connecting to GATT server...');
        if (this.bluetoothDevice.gatt.connected) {
            serial_log('CONNECT: Device is already connected');
            return;
        }
        try {
            this.connecting = Date.now;
            this.server = await this.bluetoothDevice.gatt.connect();
            serial_log('CONNECT: Connecting to UART...');
            await this.connectUart();
            serial_log('UART: ' + JSON.stringify(this.uart));
            if (!this.deviceInformation) {
                //this.deviceInformation = await this.getDeviceInformation();
            }
        } catch (error) {
            serial_log('CONNECT: ERROR: Disconnecting before re-throwing...');
            await this.disconnect();
            serial_log('CONNECT: ERROR: ...disconnected -- now re-throwing...');
            throw (error);
        } finally {
            this.connecting = null;
        }
    }

    async disconnect() {
        serial_log('DISCONNECT: Disconnecting from GATT server...');
        if (!this.bluetoothDevice.gatt.connected) {
            serial_log('DISCONNECT: Device is already disconnected');
            return;
        }
        await this.bluetoothDevice.gatt.disconnect();
    }

    static async create() {
        if (location.protocol === 'http:') {
            serial_log('WARNING: WebBluetooth typically not supported for HTTP protocol -- you may need to use file:, https:, or content:');
        }
        if (!navigator.bluetooth) {
            serial_log('ERROR: No navigator.bluetooth support');
            throw ('navigator.bluetooth not supported')
        }
        if (navigator.bluetooth.getAvailability && !await navigator.bluetooth.getAvailability()) {
            serial_log('WARNING: It appears as if Bluetooth is not available -- the device request will fail.');
        }
        serial_log('CONNECT: Requesting devices... (this location protocol: ' + location.protocol + ')');

        let bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [
                { namePrefix: 'BBC micro:bit' },
            ],
            optionalServices: ['device_information', this.uuidServiceUart],
            //acceptAllDevices: true,
        });

        return new Device(bluetoothDevice);
    }

}
Device.devices = {};
Device.uuidServiceUart = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
Device.uuidCharacteristicTx = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
Device.uuidCharacteristicRx = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

//export default Device;
