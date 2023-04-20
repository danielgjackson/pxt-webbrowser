//import Bridge from './bridge.mjs';

// Detect if running within VS Code
const vsCode = (/(?:\s|^)Code\/(\d+(?:\.\d+)*)(?:\s|$)/.exec(navigator.userAgent) || [])[1];
const debug = vsCode != null;
const bridge = new Bridge();
const defaultOptions = {};
let options = defaultOptions;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    if (document.querySelector('body')) {
        document.querySelector('body').className = 'mode-connected';
    }
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
        document.querySelector('body').className = 'mode-connected';
    } else {
        document.querySelector('body').className = 'mode-disconnected';
    }
});

bridge.setStringHandler((line) => {
    addBubble('incoming', line);
});

bridge.setValueHandler((name, value) => {
    addBubble('incoming', name + ' = ' + value);
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
    document.querySelector('body').className = 'mode-disconnected';

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

    hashChange();
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

window.addEventListener('load', startup);
