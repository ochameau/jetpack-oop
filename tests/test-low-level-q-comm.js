
exports.testQComm = function (test) {
  let { Queue } = require("q-queue");
  let qcomm = require("q-comm");
  let Q = require("q");
  
  // Simulate a Q Peer that would be in a remote process
  // Only this Peer hold an object with some data
  function createRemote(onEvent) {
    let queue = Queue();
    let rootObject = Q.def({
      foo: 123,
      bar: function () {
        return 456;
      }
    });
    let peer = qcomm.Peer({
      get: queue.get,
      put: function (data) {
        onEvent(data);
      }
    }, rootObject);
    
    return {
      peer: peer,
      sendEvent: function (msg) {
        queue.put(msg);
      }
    }
  }
  
  // Simulate the Q Peer that is created in main process
  // He is going to seek for data from the other "remote peer"
  function createLocal(onEvent) {
    let queue = Queue();
    let peer = qcomm.Peer({
      get: queue.get,
      put: function (data) {
        onEvent(data);
      }
    });
    
    return {
      peer: peer,
      sendEvent: function (msg) {
        queue.put(msg);
      }
    }
  }
  
  // Create both Peer
  let remote = createRemote(function (msg) {
    local.sendEvent(msg);
  });
  let local = createLocal(function (msg) {
    remote.sendEvent(msg);
  });
  
  test.waitUntilDone();
  
  // 1) Fetch a remote attribute
  let foo = Q.get(local.peer, "foo");
  Q.when(foo, function (v) {
    test.assertEqual(v, 123);
    
    // 2) Retrieve result of a remote function
    let bar = Q.post(local.peer, "bar");
    Q.when(bar, function (v) {
      test.assertEqual(v, 456);
      
      test.pass("Q-comm seems ok!");
      test.done();
    },
    function (e) {
      console.log("when.bar error : "+e);
    });

  },
  function (e) {
    console.log("when.foo error : "+e);
  });
  
}
