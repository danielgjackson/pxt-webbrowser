//import Bridge from './bridge.mjs';

// Detect if running within VS Code
const vsCode = (/(?:\s|^)Code\/(\d+(?:\.\d+)*)(?:\s|$)/.exec(navigator.userAgent) || [])[1];
const debug = vsCode != null;
const bridge = new Bridge();
const defaultOptions = {};
let currentMode = '';
let options = defaultOptions;
let streamingAccel = false;
let previousAccel = null;
const BROWSER_BRIDGE_VERSION = 1;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function importScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.onload = function(event) {
            resolve(script);
        }
        script.onerror = reject;
        script.src = src;
        document.head.appendChild(script);
    });
}

async function scrollToBottom() {
    await sleep(0);  // Allow for any reflow before scroll
    const main = document.querySelector("main#main-connected");
    if (main) {
        main.scrollTo(0, main.scrollHeight);
    }
}

function addBubble(direction, text, media = null, target = null) {
    if (direction == 'incoming') { console.log('<<< ' + text); }
    else if (direction == 'outgoing') { console.log('>>> ' + text); }
    else if (direction == 'state') { console.log('*** ' + text); }
    else { console.log('--- ' + text); }
    const template = document.querySelector("#bubble");
    const bubble = template.content.cloneNode(true).firstElementChild;
    bubble.classList.add(direction);
    const message = bubble.querySelector("[slot=text]");
    if (text) {
        const lines = text.split('|');
        for (const line of lines) {
            if (message.childNodes.length > 0) {
                message.appendChild(document.createElement('br'));
            }
            message.appendChild(document.createTextNode(line));
        }
    }
    if (media) {
        bubble.classList.add('media');
        const image = bubble.querySelector("img");
        image.src = `${media}`;
        image.alt = '[image]';
    }
    document.querySelector("#messages").appendChild(bubble);
    scrollToBottom();
    return bubble;
}

function clearState() {
    changeMode(bridge.isConnected() ? 'connected' : 'disconnected');
    document.querySelector('#output').innerHTML = '';
}

async function sendMessage(text) {
    await bridge.send(text);
    addBubble('outgoing', text);
}

let hackClearCount = 0;
function restart() {
    clearState();

    // Don't clear the first time to preserve any initial errors.
    if (hackClearCount++ > 1) {
        document.querySelector('#messages').innerHTML = '';
    }

    const reply = document.querySelector('#reply');
    reply.value = '';
    if (!debug) reply.focus();
}

async function reload() {
    // Pre-load data
    //sendServiceWorker({ resources: resources });
    restart();
}

function sendServiceWorker(message) {
    if (navigator && navigator.serviceWorker && navigator.serviceWorker.controller) {
        console.log('SERVICE-WORKER-MESSAGE-CLIENT-SEND: ' + JSON.stringify(message));
        navigator.serviceWorker.controller.postMessage(message);
    }
}

// Service Worker Registration (after page loaded)
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('SERVICE-WORKER: Not available.');
        return null;
    }
    if (location.protocol == 'file:') {
        //console.log('SERVICE-WORKER: Not available in file:// protocol.');
        return null;
    }
    try {
        // Load 'service-worker.js', must be in a top-level directory.
        const serviceWorkerFile = 'service-worker.js';
        const reg = await navigator.serviceWorker.register(serviceWorkerFile);
        // If service-worker.js changes...
        reg.onupdatefound = function() {
            const installing = reg.installing;
            installing.onstatechange = function() {
                switch (installing.state) {
                    case 'installed':
                        if (navigator.serviceWorker.controller) {
                            console.log('SERVICE-WORKER: New content available.');
                            if (confirm('Update available -- reload now?')) {
                                window.location.reload();
                            }
                        } else {
                            console.log('SERVICE-WORKER: Now available offline.');
                        }
                        break;
                    case 'redundant':
                        console.log('SERVICE-WORKER: Installing worker was redundant.');
                        break;
                }
            };
        };
        navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('SERVICE-WORKER-MESSAGE-CLIENT-RECV: ' + JSON.stringify(event.data));
        });
        return reg;
    } catch (e) {
        console.log('SERVICE-WORKER: Error during registration: ' + e);
        return null;
    }
}

bridge.setConnectionChangeHandler((change) => {
    addBubble('state', 'CONNECTION: ' + change);
    if (change === 'connected') {
        changeMode('connected');
        bridge.send(JSON.stringify({ _: 'x', n: 'b', v: BROWSER_BRIDGE_VERSION }));
    } else {
        changeMode('disconnected');
    }
});

bridge.setStringHandler((line) => {
    addBubble('incoming', line);
});

bridge.setValueHandler((name, value) => {
    addBubble('incoming', name + ' = ' + value);
});

bridge.setObjectHandler((obj) => {
    //addBubble('incoming', JSON.stringify(obj));
    console.log('REMOTE-INCOMING: ' + JSON.stringify(obj));

    if (obj && obj._) {
        const type = obj._;

        if (type == 'x') {  // connected
            const name = obj.n;       // device type
            const value = obj.v;       // software version
            console.log('REMOTE-CONNECTED: ' + name + ' v' + value);

        } else if (type == 'm') {  // mode
            let name = obj.n;       // mode name
            if (name.length == 0) name = 'connected';

            if (name == 'web') {
                const value = obj.v;       // URL
                console.log('REMOTE-WEB: ' + value);
                changeMode(name);
                document.querySelector('#web').src = value;

            } else {
                console.log('REMOTE-MODE: ' + name);
                changeMode(name);
            }

        } else if (type == 's') {   // stream sensors
            const name = obj.n;     // type ("accel")
            if (name == 'accel') {
                console.log('REMOTE-STREAM: accel');
                if (!streamingAccel) {
                    try {
                        console.log('REMOTE-STREAM-ACCEL: Starting...');
                        const accel = new Accelerometer({ frequency: 10 });
                        accel.addEventListener("reading", () => {
                            const values = [parseFloat(accel.x.toFixed(2)), parseFloat(accel.y.toFixed(2)), parseFloat(accel.z.toFixed(2))];
                            let delta = 0.15;
                            let unchanged = (previousAccel && Math.abs(previousAccel[0] - values[0]) <= delta && Math.abs(previousAccel[1] - values[1]) <= delta && Math.abs(previousAccel[2] - values[2]) <= delta);
                            if (!unchanged) {
                                previousAccel = [...values];
                                console.log('! ' + values);
                                bridge.throttledSend('accel', 500, true, JSON.stringify(
                                    { _: "s", n: "accel", x: values[0], y: values[1], z: values[2] }
                                ));
                            }
                        });
                        accel.start();
                        streamingAccel = true;
                        console.log('REMOTE-STREAM-ACCEL: ...started -- may need to interact with page to enable sensor');
                    } catch (e) {
                        console.log('REMOTE-STREAM-ACCEL-ERROR: ' + e);
                        console.dir(e);
                    }
                }
                
            } else {
                console.log('REMOTE-STREAM-UNKNOWN: ' + name);
            }

        } else if (type == 'f') {   // action: fetch
            const name = obj.n;     // ID
            const value = obj.v;    // Value (address)
            console.log('REMOTE-FETCH: ' + name + ' -- ' + value);

            (async () => {
                try {
                    const response = await fetch(value);
                    if (response.ok) {
                        let data = await response.text();

                        // Remove any trailing \r\n
                        if (data.length > 0 && (data[data.length - 1] == '\n')) { data = data.substring(0, data.length - 1); }
                        if (data.length > 0 && (data[data.length - 1] == '\r')) { data = data.substring(0, data.length - 1); }

                        console.log('REMOTE-FETCH-RESPONSE-OK: ' + data);
                        bridge.send(JSON.stringify({ _: 'f', n: name, v: data }));
                    } else {
                        console.log('REMOTE-FETCH-RESPONSE-NOT-OK: ' + response.status);
                        bridge.send(JSON.stringify({ _: 'f', n: name, v: null }));
                    }
                } catch (e) {
                    console.log('REMOTE-FETCH-FAILED: ' + e);
                    bridge.send(JSON.stringify({ _: 'f', n: name, v: null }));
                }
            })();

        } else {
            console.log('REMOTE-UNKNOWN: ' + type);
        }
    } else {
        console.log('REMOTE-UNHANDLED-OBJ: ' + JSON.stringify(obj));
    }

});

function startup() {
    window.addEventListener('hashchange', hashChange);

    window.addEventListener('error', (error) => {
        const message = `UNHANDLED-ERROR: ${error}`;
        console.log(message);
        console.dir(error);
    });

    window.addEventListener("unhandledrejection", function (event) {
        const message = `ERROR-UNHANDLED-REJECTION: ${event.reason}`;
        console.log(message);
        addBubble('state', message);
    });

    registerServiceWorker();

    const connectionMethods = bridge.getAvailableConnectionMethods();
    for (const method of connectionMethods) {
        const button = document.querySelector('#controls').classList.toggle(`${method}-available`, true);
        document.querySelector(`#connect-${method}`).addEventListener('click', (event) => {
            bridge.connect(method);
        });
    }
    if (connectionMethods.length > 0) {
        addBubble('state', 'Please connect over a supported method: ' + connectionMethods.join(', '));
    } else {
        addBubble('state', 'ERROR: No connection methods supported in your browser.');
    }


    const reply = document.querySelector('#reply');
    document.querySelector('#message-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const text = reply.value.trim();
        if (text.length > 0) {
            sendMessage(text);
        }
        reply.value = '';
        // External input on some devices may need blur and refocus
        if (!debug && false) {
            reply.blur()
            setTimeout(() => {
                setTimeout(() => reply.focus(), 250);
            }, data.refocus_time || 0);
        } else if (!debug) {
            reply.focus();
        }
    });

    // This is a workaround for the iOS on-screen keyboard not adjusting the viewport.
    // ...and the Firefox Mobile on Android being weird with its lower address bar.
    let pending = false;
    function viewportHandler() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            setTimeout(() => {
                // Only set this if they mismatch (e.g. in an affected browser)
                if (document.body.offsetHeight != window.visualViewport.height) {
                    document.body.style.height = window.visualViewport.height + 'px';
                }
                // Ensure body is scrolled to top
                window.scrollTo(0, 0);
                // Endure chat is scrolled to bottom
                scrollToBottom();
            }, 100);
        });
    }
    if (window.visualViewport) {
        window.visualViewport.addEventListener('scroll', viewportHandler);
        window.visualViewport.addEventListener('resize', viewportHandler);
        // Firefox mobile on-screen keyboard dismiss issue
        reply.addEventListener('blur', () => setTimeout(viewportHandler, 100));
    }

    document.querySelector('h1').addEventListener('click', (event) => {
        reload();
    });


    // MODE: Barcode Scan
    const doCancelScan = async () => {
        try {
            console.log('BARCODE: Cancel: Awaiting...')
            await Barcode.cancel();
            // console.log('BARCODE: Cancel: ...awaited')
        } catch (e) {
            console.error('BARCODE: Error during cancellation: ' + e);
        }
    }
    const cancelScan = () => {
        // console.log('BARCODE: Cancel: Trigger')
        doCancelScan();
        // console.log('BARCODE: Cancel: End of trigger')
    }
    document.querySelector('#start-scan').addEventListener('click', async () => {
        try {
            document.querySelector('#main-scan').classList.add('scanning');
            const scanResult = await Barcode.scan({
                //readers: 'code_128,ean',
            });
            if (scanResult != null) {
                console.log('SCAN: Result=' + scanResult);
                const evt = { _: "e", n: "scan", v: scanResult };
                if (currentMode == 'scan') {
                    sendMessage(JSON.stringify(evt));
                }
            } else {
                console.log('SCAN: No result.');
            }
        } catch (e) {
            console.log('SCAN: Error=' + JSON.stringify(e));
            console.dir(e);
        } finally {
            document.querySelector('#main-scan').classList.remove('scanning');
        }
    });
    document.querySelector('#stop-scan').addEventListener('click', cancelScan);


    // MODE: Face detection
    document.querySelector('#start-face').addEventListener('click', async () => {
        const baseUrl = './scripts/face-api.js/';
        const videoElement = document.querySelector('#inputVideo');

        if (!document.face_script) {
            try {
                console.log('FACE: Loading script...');
                await importScript(baseUrl + 'face-api.min.js');
                document.face_script = true;
            } catch (e) {
                console.log(`ERROR: Problem loading face detection script: ${e}`);
                return;
            }
        }
        if (!document.face_data) {
            try {
                console.log('FACE: Loading data...');

                // Load face models
                await faceapi.nets.tinyFaceDetector.load(baseUrl);
                await faceapi.loadFaceLandmarkModel(baseUrl);

                const onPlay = async () => {
                    if (!videoElement.paused && !videoElement.ended && !!faceapi.nets.tinyFaceDetector.params) {
                        // Detect faces
                        const options = new faceapi.TinyFaceDetectorOptions({
                            inputSize: 224, 
                            scoreThreshold: 0.5, 
                        });
                        const result = await faceapi.detectAllFaces(videoElement, options).withFaceLandmarks();
                    
                        if (result) {
                            // Show the detection results on the video overlay
                            const canvas = document.querySelector('#overlay');
                            const dims = faceapi.matchDimensions(canvas, videoElement, true);
                            const resizedResult = faceapi.resizeResults(result, dims);
                            faceapi.draw.drawDetections(canvas, resizedResult);
                            faceapi.draw.drawFaceLandmarks(canvas, resizedResult);

                            // Find the user with the closest distance (null if none)
                            let closestDistance = null;
                            for (let i = 0; i < result.length; i++) {
                                // Get the first landmark from each eye
                                const leftEye = result[0].landmarks.getLeftEye()[0];
                                const rightEye = result[0].landmarks.getRightEye()[0];

                                // Assuming facing camera: calculate the inter-pupillary distance in pixels using Pythagoras...
                                const ipdPixels = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
                                // ...normalized by the imaging width
                                const ipdNormalized = ipdPixels / result[0].detection._imageDims._width;

                                // Calculate a rough distance estimate based on the reciprocal
                                const distance = 1 / ipdNormalized;

                                // Track the closest face found
                                if (closestDistance === null || distance < closestDistance) closestDistance = distance;
                            }

                            const info = `distance: ${closestDistance == null ? '-' : closestDistance.toFixed(1)}`;
                            document.querySelector('#info').innerText = info;

                            if (currentMode == 'face') {
                                bridge.throttledSend('face', 500, true, JSON.stringify(
                                    { _: "e", n: "face", v: closestDistance == null ? null : parseFloat(closestDistance.toFixed(1)) }
                                ));
                            }
                        }
                    }
                    setTimeout(() => onPlay());
                }
                videoElement.addEventListener('loadedmetadata', onPlay);

                document.face_data = true;
            } catch (e) {
                console.log(`ERROR: Problem loading face detection data: ${e}`);
                console.dir(e);
                return;
            }
        }
        console.log('FACE: ...loaded');

        if (!document.face_running) {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.log(`ERROR: getUserMedia() not supported -- be sure the page is served over HTTPS`);
                return;
            }
            // Ask the user for camera permission and stream it to the video element
            try {
                videoElement.srcObject = await navigator.mediaDevices.getUserMedia({ video: {} });
                document.face_running = true;
                document.querySelector('.face-controls').classList.add('started');
            } catch (e) {
                console.log(`ERROR: Camera issue -- check permission was given: ${e}`);
                return;
            }
        }
        console.log('FACE: ...running');
    });


    changeMode('disconnected');

    hashChange();

    // Testing
    //bridge.lineHandler(JSON.stringify({_:"m",n:""}));
    //bridge.lineHandler(JSON.stringify({_:"m",n:"scan"}));
    //bridge.lineHandler(JSON.stringify({_:"m",n:"face"}));
    //bridge.lineHandler(JSON.stringify({_:"m",n:"web",v:"http://example.org"}));
    //bridge.lineHandler(JSON.stringify({_:"f",n:"ip",v:"//icanhazip.com"}));
    //bridge.lineHandler(JSON.stringify({_:"s",n:"accel"}));
    
}

function hashChange() {
    // Load hash parameters
    const hash = window.location.hash;
    const hashParts = hash.substring(1).split('&');
    options = hashParts.reduce((accumulated, part) => {
        const [key, ...values] = part.split('=');
        accumulated[decodeURIComponent(key)] = values.length == 0 ? null : decodeURIComponent(values.join('='));
        return accumulated;
    }, {
        defaultOptions
    });
}

function changeMode(mode) {
    currentMode = mode;
    if (document.querySelector('body')) {
        document.querySelector('body').className = 'mode-' + mode;
    }
    if (document.querySelector('#state')) {
        document.querySelector('#state').innerText = mode;
    }
}

window.addEventListener('load', startup);
