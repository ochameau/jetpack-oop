/*
 *  This file is loaded in a remote browser
 *  This is the second file loaded, right after cuddlefish.js
 *  Its targets are:
 *    1/ Bootstrap cuddlefish in order to be able ro require modules 
 *       directly from this remote process.
 *       In order to do so, we wait for the "init" message that
 *       comes with options needed for cuddlefish instanciation
 *    2/ Bootstrap a Q-comm Peer that would allow to query all modules
 *       from others processes. Q-comm is listening to "put" events
 *       in order to receive data, and is sending data back to the chrome
 *       process by using "put" events in the other way
 *    3/ Finally, we listen to "require" event in order to allow to 
 *       load a new module in this remote process and store it in Q-comm 
 *       objects datastore (ie rootObject variable)
 */
try {

function log(msg) {
  sendAsyncMessage('log', msg);
}


function createLoader(options) {
  // Taken from harness.js
  // We can't pass it from chrome process because there is some cyclic references
  // So it can't be JSON stringified :x
  let packaging = {
    __packages: options.manifest,
    get options() {
      return options;
    },
    getModuleInfo: function getModuleInfo(path) {
      var i = this.__packages[path];
      var info = { dependencies: i.requires,
                   needsChrome: i.chrome,
                   'e10s-adapter': i['e10s-adapter'],
                   name: i.name,
                   packageName: i.packageName,
                   hash: i.hash
                   };
      if (info.packageName in options.packageData)
        info.packageData = options.packageData[info.packageName];
      return info;
    }
  };
  
  let rootPaths = options.rootPaths;
  
  // Loader comes from cuddlefish.js loaded by chrome ipc.js file 
  // (lib/ipc.js:loadFrameScript(...cuddlefish.js))
  return Loader({rootPaths: rootPaths,
                      print: function (msg) {
                        log(msg);
                      },
                      packaging: packaging,
                      globals: { packaging: packaging }
                    });
}


addMessageListener("init", function (msg) {
  try {
    let options = msg.json;
    
    // Create a commonjs loader with cuddlefish
    let loader = createLoader(options);
    
    // Load Q stuff
    let { Queue } = loader.require("q-queue");
    let queue = Queue();
    let qcomm = loader.require("q-comm");
    let Q = loader.require("q");

    // main object shared with chrome process
    // contains all required modules in remote process
    // (add cuddlefish module at startup)
    let modules = { cuddlefish: Q.def(loader) };

    // Instanciate remote Q-comm Peer
    var rootObject = Q.def(modules);
    let peer = qcomm.Peer({
      get: queue.get,
      put: function (data) {
        sendAsyncMessage("put", data);
      }
    }, rootObject);
    addMessageListener("put", function (msg) {
      queue.put(msg.json);
    });
    
    // Add require message handler
    // that allow chrome process to load a module in remote process
    addMessageListener("require", function (msg) {
      try {
        modules[msg.json] = Q.def(loader.require(msg.json));
      } catch(e) {
        sendAsyncMessage('exception', e.message)
      }
      return "toto";
    });

    sendAsyncMessage('inited');
  } catch(e) {
    sendAsyncMessage('exception', e.message);
  }
});

} catch(e) {
  sendAsyncMessage('exception', e.message);
}

// Code to load a specific document
//docShell.QueryInterface(Ci.nsIWebNavigation).loadURI("http://google.fr", 
//  Ci.nsIWebNavigation.LOAD_FLAGS_NONE, null, null, null);
