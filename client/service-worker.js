self.console.log('SERVICE-WORKER: Loading.');

const urls = [
    './',
    'manifest.webmanifest',
    'style.css',
    'favicon.svg',
    'index.js',
    'bridge.js',
    'bleserial.js',
    'serial.js',
];

// Stale-while-revalidate
self.addEventListener('fetch', (event) => {
  self.console.log('SERVICE-WORKER: Request: ' + event.request.url);
  event.respondWith(
    (async function () {
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(event.request);
      const networkResponsePromise = fetch(event.request);
      event.waitUntil(
        (async function () {
          const networkResponse = await networkResponsePromise;
          await cache.put(event.request, networkResponse.clone());
        })(),
      );
      return cachedResponse || networkResponsePromise;
    })(),
  );
});

// self.addEventListener('fetch', (event) => {
//   //self.console.log('SERVICE-WORKER: Request: ' + event.request.url);
//   if (event.request.url.startsWith(self.location.origin)) {
//     event.respondWith(
//       caches.match(event.request).then(async (response) => {
//         if (response) {
//           self.console.log('SERVICE-WORKER: Respond from cache: ' + event.request.url);
//           return response;
//         } else {
//           self.console.log('SERVICE-WORKER: Going to fetch and cache: ' + event.request.url);
//           // Cache runtime requests in the same cache as the versioning changes will apply to them too
//           return caches.open(cacheName).then(cache => {
//             return fetch(event.request).then(response => {
//               self.console.log('SERVICE-WORKER: Caching and responding with: ' + event.request.url);
//               return cache.put(event.request, response.clone()).then(() => {
//                 return response;
//               });
//             });
//           });
//         }
//       })
//     );
//   }
// });

self.addEventListener('install', function (event) {
  self.console.log('SERVICE-WORKER: Installing version: ' + cacheName);
  self.skipWaiting();
  event.waitUntil(
    caches.open(cacheName).then(function (cache) {
      //return cache.addAll(urls)
      return Promise.all(
        Array.from(urls.values()).map(function(url) {
          const actualUrl = url + '?' + cacheName;    // Prevent cache
          const request = new Request(actualUrl, {credentials: 'same-origin'});
          return fetch(request).then(function(response) {
            if (!response.ok) {
              throw new Error('Request for ' + url + ' had status ' + response.status);
            }
            return cache.put(url, response);
          });
        })
      );
    })
  );
});
  
self.addEventListener('activate', function (event) {
  self.console.log('SERVICE-WORKER: Activating version: ' + cacheName);
  event.waitUntil(
    caches.keys().then(function (keyList) {
      return Promise.all(keyList.map(function (key, i) {
        if (key !== cacheName) {
          return caches.delete(key);
        }
      }));
    })
  );
});

self.addEventListener('message', (event) => {
  self.console.log('SERVICE-WORKER-MESSAGE-SERVER-RECV: ' + JSON.stringify(event.data));
  if (event.data.resources) {
    event.waitUntil(
      caches.open(cacheName).then(function (cache) {
        return Promise.all(
          Array.from(event.data.resources.values()).map(function(url) {
            return cache.match(url).then(function (response) {
              if (response) {
                self.console.log('...sw-cache exists: ' + url);
              } else {
                const request = new Request(url + '?v=' + cacheName, {credentials: 'same-origin'});
                self.console.log('...sw-cache fetch: ' + url);
                return fetch(request).then(function(response) {
                  if (!response.ok) {
                    throw new Error('Request for ' + url + ' had status ' + response.status);
                  }
                  return cache.put(url, response);
                });
              }
            });
          })
        );
      })
    );
  }
});

async function sendClient(clientId, message) {  // event.clientId
  self.console.log('SERVICE-WORKER-MESSAGE-SERVER-SEND: ' + JSON.stringify(message));
  if (clientId) {
    const client = await clients.get(clientId);
    if (client) {
      client.postMessage(message);
    }
  }
}

/*
The `cacheName` is used to version the cache, and should be changed when there is new content.
To update the cache version, run this command:
  node -e "name='service-worker.js';fs=require('fs');fs.writeFileSync(name,fs.readFileSync(name,'utf8').split(/\r?\n/).filter(s=>/\!\!\!$/.test(s)==false).join('\n')+'\n+'+(new Date()).toISOString().replace(/[^0-9]/g,'').slice(0,14)+'//\!\!\!');"
Alternatively:
  sed -i'' '/\!\!\!$/d' service-worker.js && echo -n +`date '+%Y%m%d%H%M%S'`//\!\!\! >> service-worker.js
*/
const cacheName = 'v'
+20230317150549//!!!