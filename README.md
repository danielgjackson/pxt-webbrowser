
> Open this page at [danielgjackson.github.io/pxt-webbrowser](https://danielgjackson.github.io/pxt-webbrowser/)

> On the mobile device, in a web browser that supports *WebBluetooth* (such as *Chrome* on Android), open the client page at [danielgjackson.github.io/pxt-webbrowser/client](https://danielgjackson.github.io/pxt-webbrowser/client/)

<!--
"Browser Bridge"

* Add mode to title header
* Additional modes
* Generic comms and event handler
* Public release
* Links
  * Workshop submission: https://electrofab.prototyping.id/assets/papers/electrofab23-final14.pdf
  * Related work for UI: [RemoteXY](https://remotexy.com/en/)

Connection:

* Bluetooth LE connection
* Wired USB serial connection
* Via server proxy
* Via Web Extension?

Inputs:

* text entry
* device sensors
* barcode scanning
* face tracking

Outputs:

* show web content (such as text, images, sound and video)

Effects:

* arbitrary "fetch" web requests (CORS-limited)

-->


<!--
> The Beta version of *MakeCode* allows you to download a V2-only image (as memory is constrained after adding the Bluetooth extension): [makecode.microbit.org/beta](https://makecode.microbit.org/beta)

Problem with beta editor:

> unable to find mbcodal-binary.hex in outfiles yotta.json, codal.json, binary.asm, binary.hex, mbdal-binary.asm

Instead, added `disablesVariants: mbdal` to `pxt.json`, to disallow micro:bit V1.
-->


## Use as Extension

This repository can be added as an **extension** in MakeCode.

* open [https://makecode.microbit.org/](https://makecode.microbit.org/)
* click on **New Project**
* click on **Extensions** under the gearwheel menu
* search for **https://github.com/danielgjackson/pxt-webbrowser** and import

## Edit this project ![Build status badge](https://github.com/danielgjackson/pxt-webbrowser/workflows/MakeCode/badge.svg)

To edit this repository in MakeCode.

* open [https://makecode.microbit.org/](https://makecode.microbit.org/)
* click on **Import** then click on **Import URL**
* paste **https://github.com/danielgjackson/pxt-webbrowser** and click import

## Blocks preview

This image shows the blocks code from the last commit in master.
This image may take a few minutes to refresh.

![A rendered view of the blocks](https://github.com/danielgjackson/pxt-webbrowser/raw/master/.github/makecode/blocks.png)

#### Metadata (used for search, rendering)

* for PXT/microbit
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>

<!--
```bash
# Windows:  http://docs.yottabuild.org/#installing-on-windows
# Windows (move to C:\):   https://sourceforge.net/projects/srecord/files/srecord-win32/1.64/

# Install pxt command line tool
npm install -g pxt

# Downloads micro:bit editor tools
pxt target microbit

# Install extensions to pxt_modules
pxt install

# Run PXT interface locally
pxt serve
```
-->
