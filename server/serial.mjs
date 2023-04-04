import { SerialPort } from 'serialport'

class Serial {
    constructor(path = '/dev/ttyACM0') {
        this.port = null
        this.lineBuffer = ''
        this.lineHandler = null
        
        this.port = new SerialPort({
            path: path,
            baudRate: 115200,
        }, (err) => {
            if (err) {
                console.log('SERIAL-ERROR: Problem opening the port: ' + err.message)
            }
        });

        this.port.addListener('data', (chunk) => {
            //console.log('SERIAL-CHUNK: ' + JSON.stringify(chunk));
            this.lineBuffer = this.lineBuffer.concat(chunk)
            for (;;) {
                const lineEnd = this.lineBuffer.indexOf('\n')
                if (lineEnd < 0) break
                // Special case: also remove CRLF \r\n when splitting at LF \n
                const removeCr = (lineEnd > 0 && this.lineBuffer[lineEnd - 1] == '\r')
                const line = this.lineBuffer.slice(0, removeCr ? lineEnd - 1 : lineEnd)
                this.lineBuffer = this.lineBuffer.slice(lineEnd + 1)

                //console.log(`SERIAL-RECV: ${line}`)
                if (this.lineHandler) {
                    this.lineHandler(line)
                }
            }
        })
    }

    setLineHandler(handler) {
        this.lineHandler = handler;
    }

    write(message) {
        this.port.write('' + message + '\n', (err) => {
            if (err) {
                return console.log('SERIAL-ERROR: Problem writing: ' + err.message)
            }
            //console.log('SERIAL: Written: ' + message)
        })
    }
}
