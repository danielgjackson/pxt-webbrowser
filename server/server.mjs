import Serial from 'serial.mjs'
import express from 'express'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'

const currentFolder = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const server = http.Server(app)

const wss = new WebSocketServer({ server: server, path: '/ws', clientTracking: true })

wss.on('connection', function(ws) {
  ws.on('message', function(message) {
    console.log('Received: ', message)
    ws.send('I heard: ' + message)
  })
})

function broadcast(message) {
  for (const ws of wss.clients) {
    ws.send(message)
  }
}
  
app.get('/', (req, res) => {
  res.sendFile(path.join(currentFolder, 'index.html'))
})

server.listen(3000, () => {
  console.log('Listening at http://localhost:3000/')
})



let counter = 0
setInterval(() => { broadcast(++counter) }, 1000)

/*
// Create a serial port object
// TODO: Change the device path to match found devices
let devicePath = '/dev/ttyACM0'
const serial = new Serial(devicePath)

// Handle any received lines from the serial port
serial.setLineHandler((line) => {
    console.log('RECV: ' + line)
})

// Every 5 seconds, send a random number over the serial port
setInterval(() => {
    const number = Math.floor(Math.random() * 10)
    serial.write('' + number)
}, 5000);
*/
