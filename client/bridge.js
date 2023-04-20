//import Device from './device.mjs';

// Browser Bridge Client
class Bridge {

    constructor() {
        this.device = null;
        this.handleConnectionChange = null;
        this.handlerReceivedString = null;
        this.handlerReceivedValue = null;
        this.handlerReceivedObject = null;
        this.throttledData = {};
        this.throttledHistory = {};
    }

    throttledSend(category, delay, onlyIfDifferent, line) {
        if (line !== null) {
            if (onlyIfDifferent && this.throttledHistory.hasOwnProperty(category) && this.throttledHistory[category] == line) {
                // Do not send identical data
                return;
            }
            this.throttledHistory[category] = line;
        }

        // If no data for this category
        if (!this.throttledData.hasOwnProperty(category)) {
            if (line !== null) { // Wait to send updated data
                this.send(line);
            }
            // Set timeout to send any updated data
            this.throttledData[category] = null;
            setTimeout(() => {
                const data = this.throttledData[category];
                delete this.throttledData[category];
                if (data) {
                    this.send(data);
                    this.throttledSend(category, delay, onlyIfDifferent, null);
                }
            }, delay);
            return;
        }
        // If waiting to send, update data
        this.throttledData[category] = line;
    }
    
    setConnectionChangeHandler(handler) {
        this.handleConnectionChange = handler;
    }

    setStringHandler(handler) {
        this.handlerReceivedString = handler;
    }

    setValueHandler(handler) {
        this.handlerReceivedValue = handler;
    }

    setObjectHandler(handler) {
        this.handlerReceivedObject = handler;
    }
    
    lineHandler(line) {
        // Differentiate string (or value) and objects
        if (line.length <= 0 || (line[0] != '{' && line[0] != '[')) {
            // Check whether it can be handled as name:value
            const parts = line.split(':')
            const name = parts[0]
            const valueString = parts.slice(1).join(':')
            const value = parseFloat(valueString)
            const hasNumericValue = valueString.length > 0 && !isNaN(valueString) && !isNaN(value)
            if (hasNumericValue) {
                // Value type
                console.log('RECV-VALUE: ' + name + ':' + value);
                if (this.handlerReceivedValue != null) {
                    this.handlerReceivedValue(name, value)
                }
            } else {
                // String type
                console.log('RECV-LINE: ' + line);
                if (this.handlerReceivedString != null) {
                    this.handlerReceivedString(line)
                }
            }
        } else {
            try {
                const data = JSON.parse(line)
                // TODO: Handle object data
                console.log('RECV-OBJ: ' + JSON.stringify(data));
                if (this.handlerReceivedObject != null) {
                    this.handlerReceivedObject(data)
                }
            } catch (e) {
                console.log('RECV-OBJ-ERROR: ' + line);
                console.dir(e);
            }
        }
    }

    disconnected() {
        if (this.handleConnectionChange) {
            this.handleConnectionChange('disconnected');
        }
        console.log('--- DISCONNECTED ---');
    }

    isConnected() {
        return this.device !== null && this.device.isConnected();
    }

    canConnect() {
        return this.device === null || !(this.device.isConnecting() || this.device.isConnected());
    }

    canDisconnect() {
        return this.device !== null && this.device.isConnected();
    }

    async connect(method) {
        if (this.device && this.device.isConnected()) {
            return;
        }
        if (this.handleConnectionChange) {
            this.handleConnectionChange('connecting');
        }
        try {
            if (!this.device) {
                if (method === 'bluetooth') {
                    this.device = await BleSerial.create();
                } else if (method === 'serial') {
                    this.device = await Serial.create();
                } else {
                    throw new Error('Invalid connection method');
                }
                this.device.setLineHandler((line) => {
                    this.lineHandler(line);
                });
                this.device.setDisconnectedHandler(() => {
                    this.disconnected();
                });
            }
            if (!this.device.isConnected()) {
                await this.device.connect();
                if (this.handleConnectionChange) {
                    this.handleConnectionChange('connected');
                }
            }
        } catch (e) {
            if (this.handleConnectionChange) {
                this.handleConnectionChange('disconnected');
            }
            throw e;
        }
    }

    async send(line) {
        if (!this.device || !this.device.isConnected()) {
            console.log('NOT SENDING: ' + line)
            return false;
        } else {
            console.log('SENDING: ' + line)
        }
        await this.device.writeLine(line);
        return true;
    }

    getAvailableConnectionMethods() {
        const methods = [];
        if (navigator.bluetooth) {
            methods.push('bluetooth');
        }
        if (navigator.serial) {
            methods.push('serial');
        }
        return methods;
    }

}

//export default Bridge;
