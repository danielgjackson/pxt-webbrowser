// tests go here; this will not be compiled when this package is used as an extension.

basic.forever(() => {
    basic.pause(1000)
    webbrowser.helloWorld()
    basic.pause(1000)
    webbrowser.camlCaseTwo()
})
