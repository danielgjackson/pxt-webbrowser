# Server

The web server back-end is intended as an alternative way to communicate with the hardware (e.g. when using browsers that don't support Web Bluetooth or Web Serial).

A library will be made that emulates the Web Serial API.

A possible future route would be to make a Web Extension alternative that uses a Native Messaging back-end.

Communication:

```
Web Page <-> Library <-> Web Socket <-> Server <-> Serial Port <-> Device
```

**This code is not yet complete.**
