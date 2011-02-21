const { Ci, Cc, Cu } = require("chrome");

// Try to make another hidden window
// because remote browser crash when being added in hidden window
// We use popup=yes and we explicitely hide it with nsIBaseWindow interface
// in order to have a window that doesn't appear in taskbar/dock
let gHiddenWindow = null;
function getHiddenWindow(callback) {
  if (gHiddenWindow) 
    return callback(gHiddenWindow);
  let xulNs = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  let blankXul = ('<?xml version="1.0"?>' +
                  '<window xmlns="' + xulNs + '"></window>');
  let url = "data:application/vnd.mozilla.xul+xml," + escape(blankXul);
  let features = ["chrome", "width=400", "height=400", "popup=yes"];
  
  let ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
           .getService(Ci.nsIWindowWatcher);
  let win = ww.openWindow(null, url, null, features.join(","), null);
  
  var baseWin = win.QueryInterface(Ci.nsIInterfaceRequestor).
                getInterface(Ci.nsIWebNavigation).
                QueryInterface(Ci.nsIDocShell).
                QueryInterface(Ci.nsIDocShellTreeItem).
                treeOwner.
                QueryInterface(Ci.nsIBaseWindow);
  baseWin.visibility = false;
  baseWin.enabled = false;
  win.addEventListener("load",function onload() {
    win.removeEventListener("load", onload, false);
    gHiddenWindow = win;
    callback(gHiddenWindow);
  }, false);
}


function createRemoteBrowser(callback) {
  getHiddenWindow(function (win) {
    let doc = win.document; 
    let b = doc.createElement("browser"); 
    // Remote="true" enable everything here:
    // http://mxr.mozilla.org/mozilla-central/source/content/base/src/nsFrameLoader.cpp#1347
    b.setAttribute("remote","true"); 
    // Type="content" is mandatory to enable stuff here:
    // http://mxr.mozilla.org/mozilla-central/source/content/base/src/nsFrameLoader.cpp#1776
    b.setAttribute("type","content");
    // We remove XBL binding to avoid execution of code that is not going to work
    // because browser has no docShell attribute in remote mode (for example)
    b.setAttribute("style","-moz-binding: none;");
    // Flex it in order to be visible (optional, for debug purpose)
    b.setAttribute("flex","1");
    doc.documentElement.appendChild(b); 
    
    callback(win, b);
  });
}

function createRemoteProcessObject(browser, mm, peer) {
  let Q = require("q");
  return {
    require: function (moduleName) {
      mm.sendAsyncMessage("require", moduleName);
      // As we can't get synchronously a result, we return a Promise
      return Q.get(peer, moduleName);
    },
    kill: function () {
      mm = null; peer = null; 
      browser.parentNode.removeChild(browser);
      browser = null;
    }
  }
}

exports.newProcess = function (callback) {
  createRemoteBrowser(function (win, browser) {
    
    // Get the frameloader from this browser ...
    let fl = browser.QueryInterface(Ci.nsIFrameLoaderOwner).frameLoader; 
    // ... ir order to retrieve its message manager
    let mm = fl.messageManager;
    
    let { Queue } = require("q-queue");
    let queue = Queue();
    
    // Define the main message listener function, that will receive
    // all messages coming from the remote process.
    //   For some dark reason compartments/sandbox reason,
    //   we need to go thought a function coming from window context.
    function messageListener(msg) {
      //console.log("Message from content : "+msg.name+" = "+msg.json);
      if (msg.name=="log")
        console.log("log from remote process: "+msg.json);
      else if (msg.name=="exception")
        console.error("Exception in remote process: "+msg.json);
      else if (msg.name=="put")
        queue.put(msg.json);
      else if (msg.name=="inited") {
        // Remote process is now completely ready
        callback( createRemoteProcessObject(browser, mm, peer) );
      }
    }
    win.messageListener = messageListener;
    let f = win.eval("function (data) {messageListener(data)}");
    
    // Register a message listener in chrome process
    mm.addMessageListener("log", f);
    mm.addMessageListener("exception", f);
    mm.addMessageListener("inited", f);
    
    // Create chrome process q comm Peer
    // That will allow to easily call function and get data from remote process
    let Q = require("q");
    let qcomm = require("q-comm");
    
    let peer = qcomm.Peer({
      get: queue.get,
      put: function (data) {
        mm.sendAsyncMessage("put", data);
      }
    });
    mm.addMessageListener("put", f);
    
    
    // Load bootstrap code in addon process side
    //   Awfull hack in order to load cuddlefish
    //   This url is going to be bad when we execute another module than jetpack-oop
    mm.loadFrameScript("resource://jetpack-oop-api-utils-lib/cuddlefish.js", false);
    mm.loadFrameScript(require("self").data.url("remote-ipc-bootstrap.js"), false);
    
    let harness = Cc["@mozilla.org/harness-service;1?id="+require("self").id].
      getService().wrappedJSObject;
    
    
    // Finally give harness options to remote process
    // in order to finalize its instanciation
    // It will dispatch a inited event when it's ready
    mm.sendAsyncMessage("init", harness.options);
  });
}
