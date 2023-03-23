//import Device from './device.mjs';

// Browser Bridge Client
class Bridge {

    constructor() {
        this.device = null;
        this.handleConnectionChange = null;
        this.handleLines = null;
    }

    setConnectionChangeHandler(handler) {
        this.handleConnectionChange = handler;
    }

    setLineHandler(handler) {
        this.handleLines = handler;
    }

    lineHandler(line) {
        console.log('RECV: ' + line);
        if (this.handleLines) {
            this.handleLines(line);
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

    async connect() {
        if (this.device && this.device.isConnected()) {
            return;
        }
        if (this.handleConnectionChange) {
            this.handleConnectionChange('connecting');
        }
        try {
            if (!this.device) {
                this.device = await BleSerial.create();
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
            return false;
        }
        await this.device.writeLine(line);
        return true;
    }

}

//export default Bridge;
