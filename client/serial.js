
function serial_log(text) {
    console.log(text);
}

class Serial {

    constructor(port) {
        this.port = port;
        this.type = 'serial';
        serial_log('PORT: ' + JSON.stringify(this.port));
        serial_log('PORT properties: ' + JSON.stringify(Object.getOwnPropertyNames(this.port)));
        this.portInfo = {};
        if (this.port.getInfo) {
            this.portInfo = this.port.getInfo();
        } else {
            serial_log('WARNING: No .portInfo()');
        }
        serial_log('PORT INFO: ' + JSON.stringify(this.portInfo));
        // .locationId	
        this.productName = this.portInfo.product;   // .productId
        this.manufacturerName = this.portInfo.manufacturer; // .vendorId .vendor
        this.serialNumber = this.portInfo.serialNumber;

        this.openFlag = false;
        this.unopenable = false;
        this.buffer = [];
    }

    internalStartRead() {
        try {
            this.reader.read().then(this.internalRead.bind(this))
        } catch (e) {
            serial_log("ERROR: Problem in reader while starting read -- reader may be broken now: " + e);
        }
    }

    internalRead({ done, value }) {
        try {
serial_log('*** ' + JSON.stringify({value, done}))
            if (value !== null && typeof value !== 'undefined' && value.length > 0) {
serial_log('<<< [' + this.buffer.length + '] ' + value);
                this.buffer.push(value);
            }
            if (done) {
                serial_log("READER: Stream end");
                this.reader.releaseLock();
                this.reader = null;
                // End read loop
                return;
            }
        } catch (e) {
            serial_log("ERROR: Problem in reader while completing read -- reader may be broken now: " + e);
        }
        // Continue read loop (clean callstack)
        setTimeout(this.internalStartRead.bind(this), 0);
    }

    async open() {
        try {
            if (this.openFlag) { throw "Port already open"; }

            const options = {
                baudRate: 115200,
            }

            await this.port.open(options);

            this.encoder = new TextEncoderStream();
            this.outputDone = this.encoder.readable.pipeTo(this.port.writable);
            this.outputStream = this.encoder.writable;
            this.writer = null;

            this.decoder = new TextDecoderStream();
            this.inputDone = this.port.readable.pipeTo(this.decoder.writable);
            this.inputStream = this.decoder.readable;
            this.reader = this.inputStream.getReader();

            // Start read loop
            this.internalStartRead();

            this.openFlag = true;
            this.unopenable = false;
        } catch (e) {
            this.unopenable = true;
            serial_log('ERROR: Problem opening serial device: ' + e, e.name + ' -- ' + e.message);
            /*
            if (location.protocol == 'file:') {
                serial_log('NOTE: Hosting from a file: protocol may cause this. Try serving over HTTP.');
            }
            */
            throw e;
        }
        serial_log('...serial opened');
    }

    async close() {
        try {
            serial_log('CLOSE: reader=' + (this.reader ? JSON.stringify(this.reader) : 'n/a'));
            try { if (this.reader) await this.reader.cancel(); } catch (e) { serial_log('ERROR: Problem cancelling reader: ' + e); }
            try { await this.inputDone.catch(() => {}) } catch (e) { serial_log('ERROR: Problem waiting for inputDone: ' + e); }
            if (this.port.readable.locked) {
                serial_log('!!! UNEXPECTED: Port readable was still locked -- expected to be released when stream flagged done.');
                if (this.reader) this.reader.releaseLock();
            }
            this.reader = null;
            try {
                await this.outputStream.getWriter().close();
                this.outputStream = null;
            }
            catch (e) { serial_log('ERROR: Problem closing writer: ' + e); }
            try {
                await this.outputDone;
                this.outputDone = null;
            }
            catch (e) { serial_log('ERROR: Problem waiting for outputDone: ' + e); }
        } catch (e) {
            serial_log('WARNING: Problem cancelling/unlocking: ' + e);
        } finally {
            try {
                serial_log('...close...');
                if (this.port.writable.locked) {
                    console.error("WARNING: Port writable is still locked (will not close).");
                }
                await this.port.close();
                serial_log('...closed');
                this.openFlag = false;
                return true;
            } catch (e) {
                serial_log('WARNING: Problem closing port -- ' + e);
                return false;
            }
        }
    }

    async write(message) {
        serial_log('SEND: ' + message.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/ /g, '☐'));
        try {
            if (this.writer) {
                serial_log('UNEXPECTED: Writer already exists');
            }
            this.writer = this.outputStream.getWriter();
            await this.writer.write(message);
        } catch (e) {
            serial_log('WARNING: Problem writing data: ' + e);
            throw e;
        } finally { 
            if (this.writer) {
                try {
                    this.writer.releaseLock();
                } catch (e) {
                    // TypeError: This writable stream writer has been released and cannot be used to monitor the stream's state
                    serial_log('WARNING: ' + e);
                }
                this.writer = null;
            }
        }
    }

    async writeLine(line) {
        const encoder = new TextEncoder('utf-8');
        ble_log('WRITE-LINE: ' + line);
        const message = line + '\n';
        const data = encoder.encode(message);
        await this.write(data);
    }    

    async read() {
        serial_log('Read... ' + this.buffer.length);
        let reply = null;
        try {
            while (this.buffer.length > 0) {
                if (reply === null) reply = '';
                reply += this.buffer.shift();
            }
        } catch (e) {
            serial_log('WARNING: Problem reading serial data: ' + e);
            return null;
        }
        serial_log('RECV: ' + (reply === null ? '<null>' : reply.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/ /g, '☐')));
        return reply;
    }

}

//export default Serial;
