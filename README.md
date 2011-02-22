Jetpack OOP
==========

Experimental use of Out-Of-Process capabilities in firefox 4 to provide 
multi-process capabilities in addon-sdk.

It use same platform capabilities than Fennec: <xul:browser remote="true" />

That is already working in Firefox4 by creating a remote browser component in
the shared process plugin-container that contains all tabs content, plugins
and now our new "remote browsers" too.

Then it use [q-comm](https://github.com/kriskowal/q-comm) library to interact
asynchronously between these two processes.


Example of use
===========

--- test.js : a module that is going to be loaded in the remote process
  exports.test = function () {
    return "test";
  }

--- Code snippet that instanciate a remote process and load the previous test module into it:
  IPC.newProcess(function (process) {
    
    // Load test module in it
    let testModule = process.require("test");
    
    // Call test function on this module
    let result = Q.post(testModule, "test");
    
    // Check that the result of this function is valid
    Q.when(result, function (v) {
      test.assertEqual(v, "test");
      
      test.done();
    });
    
  });


Interesting files
===========

* Low level IPC test demonstrate how to use firefox platform capabilities to
instanciate a remote process:
[test-low-level-ipc.js](https://github.com/ochameau/jetpack-oop/blob/master/tests/test-low-level-ipc.js)
