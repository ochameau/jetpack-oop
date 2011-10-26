const { Ci, Cc, Cu } = require("chrome");

function getMainWindow(callback) {
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].
    getService(Ci.nsIWindowMediator); 
  require("timer").setTimeout(function () {
    callback( wm.getMostRecentWindow("navigator:browser") );
  }, 2000 );
}

function makeEmptyWindow(callback) {
  let xulNs = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  let blankXul = ('<?xml version="1.0"?>' +
                  '<?xml-stylesheet href="chrome://global/skin/" ' +
                  '                 type="text/css"?>' +
                  '<window xmlns="' + xulNs + '">' +
                  '</window>');
  let url = "data:application/vnd.mozilla.xul+xml," + escape(blankXul);
  let features = ["chrome", "width=400", "height=400"];
  
  let ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
           .getService(Ci.nsIWindowWatcher);
  let win = ww.openWindow(null, url, null, features.join(","), null);
  
  win.addEventListener("load", function load() { 
    win.removeEventListener("load", load, true);
    callback(win);
  }, true);
}

function getHiddenWindow(callback) {
  let appShellService = Cc["@mozilla.org/appshell/appShellService;1"].
                        getService(Ci.nsIAppShellService);
  let hiddenWindow = appShellService.hiddenDOMWindow;
  
  let frame = hiddenWindow.document.createElement("frame");
  frame.setAttribute("src", "chrome://browser/content/aboutDialog.xul");
  hiddenWindow.document.documentElement.appendChild(frame);
  
  frame.addEventListener("load", function load() {
    frame.removeEventListener("load", load, true);
    callback(frame.contentWindow.wrappedJSObject);
  }, true);
}


exports.testIPC = function (test) {
  test.waitUntilDone();
  
  makeEmptyWindow(function (win) {
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
    
    // Get the frameloader from this browser
    let fl = b.QueryInterface(Ci.nsIFrameLoaderOwner).frameLoader; 
    // And its message manager
    let mm = fl.messageManager;
    
    // For some dark reason compartments/sandbox reason,
    // we need to go thought a function coming from window context
    function messageListener(data) {
      test.pass("Got message");
      test.assertEqual(data.json, "my-data");
      test.done();
    }
    win.messageListener = messageListener;
    let f = win.eval("(function (data) {messageListener(data)})");
    
    /*
    // Sandbox equivalent doesn't work ...
    let sandbox = new Cu.Sandbox(win);
    sandbox.messageListener = messageListener;
    let scriptText = "function (data) {messageListener(data)}";
    sandbox.importFunction(messageListener);
    f = Cu.evalInSandbox(scriptText, sandbox);
    */
	
    // Register a message listener in chrome process
    mm.addMessageListener("my-message", f);
    
    // Dispatch a message from content process
    mm.loadFrameScript("data:,sendAsyncMessage('my-message', 'my-data')", false);
    //mm.loadFrameScript("data:,for(let i=0; i<1000000000; i++)dump('o\n');", false);
    
  });
  
}

/*
# No docshell when remote="true" and enable remote process!
  http://mxr.mozilla.org/mozilla-central/source/content/base/src/nsFrameLoader.cpp#1325
  http://mxr.mozilla.org/mozilla-central/source/content/base/src/nsFrameLoader.cpp#1362
# Message manager
  https://developer.mozilla.org/en/The_message_manager
# Interesting interfaces
  http://mxr.mozilla.org/mozilla-central/source/content/base/public/nsIFrameMessageManager.idl

#### current fennec scheme
1/ Chrome process load chrome://browser/content/bindings/browser.js script into content there:
  http://mxr.mozilla.org/mobile-browser/source/chrome/content/bindings/browser.xml#568
with messageManager.loadFrameScript(...);
2/ browser.js register a message handler on "WebNavigation:LoadURI" event there:
  http://mxr.mozilla.org/mobile-browser/source/chrome/content/bindings/browser.js#111
3/ Chrome process send a "WebNavigation:LoadURI" message to content
  http://mxr.mozilla.org/mobile-browser/source/chrome/content/bindings/browser.xml#661
4/ Content process receive this message and execute native loadURI on webNavigation
  http://mxr.mozilla.org/mobile-browser/source/chrome/content/bindings/browser.js#153

All of this because chrome process doesn't have access to browser.docShell 
(and so no access to browser.webNavigation, and so we can't define document url!)
but content process have access to docShell! 
So we send an event to it and load the wanted document.

Additionaly, content process has access to some "magic" globals, defined here:
http://mxr.mozilla.org/mozilla-central/source/dom/ipc/TabChild.cpp#955
like docShell and content
Seems related to theses IDLs:
http://mxr.mozilla.org/mozilla-central/source/content/base/public/nsIFrameMessageManager.idl

*/
