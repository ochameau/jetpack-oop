const IPC = require("ipc");
const Q = require("q");

exports.testOne = function (test) {
  
  test.waitUntilDone();
  // Launch a remote process
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
  
}
