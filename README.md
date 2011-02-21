Experimental use of Out-Of-Process capabilities in firefox 4 to provide 
multi-process capabilities in addon-sdk.

It use same platform capabilities than Fennec: <xul:browser remote="true" />

That is already working in Firefox4 by creating a remote browser component in
the shared process plugin-container that contains all tabs content, plugins
and now our new "remote browsers" too.

Then it use [q-comm](https://github.com/kriskowal/q-comm) library to interact
asynchronously between these two processes.


I suggest you to look at:

* IPC test, that show how to instanciate a "remote process", that is able to load
commonJS packages, and how to interact with these remote modules:
[test-ipc.js](https://github.com/ochameau/jetpack-oop/blob/master/tests/test-ipc.js)

* Low level IPC test demonstrate how to use firefox platform capabilities to
instanciate a remote process:
[test-low-level-ipc.js](https://github.com/ochameau/jetpack-oop/blob/master/tests/test-low-level-ipc.js)
