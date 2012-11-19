"use strict";

var currentLogLine = null;

var webglEnabled = false;

var $jsilbrowserstate = window.$jsilbrowserstate = {
  allFileNames: [],
  allAssetNames: [],
  readOnlyStorage: null,
  heldKeys: [],
  heldButtons: [],
  mousePosition: [0, 0],
  isLoading: false,
  isLoaded: false,
  isMainRunning: false,
  hasMainRun: false,
  mainRunAtTime: 0,
  blockKeyboardInput: false,
  blockGamepadInput: false
};
    
JSIL.Host.getCanvas = function (desiredWidth, desiredHeight) {
  var e = document.getElementById("canvas");
  if (typeof (desiredWidth) === "number")
    e.width = desiredWidth;
  if (typeof (desiredHeight) === "number")
    e.height = desiredHeight;
  
  return e;
};
JSIL.Host.createCanvas = function (desiredWidth, desiredHeight) {
  var e = document.createElement("canvas");
  e.width = desiredWidth;
  e.height = desiredHeight;
  
  return e;
};
JSIL.Host.logWrite = function (text) {
  var log = document.getElementById("log");
  if (log === null) {
    if (window.console && window.console.log)
      window.console.log(text);
    
    return;
  }

  if (currentLogLine === null) {
    currentLogLine = document.createTextNode(text);
    log.appendChild(currentLogLine);
  } else {
    currentLogLine.textContent += text;
  }
};
JSIL.Host.logWriteLine = function (text) {
  var log = document.getElementById("log");
  if (log === null) {
    if (window.console && window.console.log)
      window.console.log(text);
    
    return;
  }

  var lines = text.split("\n");
  for (var i = 0, l = lines.length; i < l; i++) {
    var line = lines[i];
    if (currentLogLine === null) {
      var logLine = document.createTextNode(line);
      log.appendChild(logLine);
    } else {
      currentLogLine.textContent += line;
      currentLogLine = null;
    }
    log.appendChild(document.createElement("br"));
  }
};
JSIL.Host.translateFilename = function (filename) {
  if (filename === null)
    return null;

  var slashRe = /\\/g;

  var root = JSIL.Host.getRootDirectory().toLowerCase().replace(slashRe, "/");
  var _fileRoot = jsilConfig.fileRoot.toLowerCase().replace(slashRe, "/");
  var _filename = filename.replace(slashRe, "/").toLowerCase();
  
  while (_filename[0] === "/")
    _filename = _filename.substr(1);

  if (_filename.indexOf(root) === 0)
    _filename = _filename.substr(root.length);
  
  while (_filename[0] === "/")
    _filename = _filename.substr(1);

  if (_filename.indexOf(_fileRoot) === 0)
    _filename = _filename.substr(_fileRoot.length);
  
  while (_filename[0] === "/")
    _filename = _filename.substr(1);
  
  return _filename;
}
JSIL.Host.doesFileExist = function (filename) {
  if (filename === null)
    return false;

  return allFiles.hasOwnProperty(JSIL.Host.translateFilename(filename));
}
JSIL.Host.getFile = function (filename) {
  if (filename === null)
    throw new System.Exception("Filename was null");

  var storageRoot = JSIL.Host.getStorageRoot();
  var errorMessage;

  if (storageRoot) {
    var node = storageRoot.resolvePath(filename, false);

    if (node && node.type === "file")
      return node.readAllBytes();

    errorMessage = "The file '" + filename + "' is not in the asset manifest, and could not be found in local storage.";
  } else {
    errorMessage = "The file '" + filename + "' is not in the asset manifest.";
  }

  if (!JSIL.Host.doesFileExist(filename))
    throw new System.IO.FileNotFoundException(errorMessage, filename);
  
  return allFiles[JSIL.Host.translateFilename(filename)];
};
JSIL.Host.getImage = function (filename) {
  var key = getAssetName(filename, false);
  if (!allAssets.hasOwnProperty(key))
    throw new System.IO.FileNotFoundException("The image '" + key + "' is not in the asset manifest.", filename);

  return allAssets[key].image;
};
JSIL.Host.doesAssetExist = function (filename, stripRoot) {
  if (filename === null)
    return false;

  if (stripRoot === true) {
    var backslashRe = /\\/g;

    filename = filename.replace(backslashRe, "/").toLowerCase();
    var croot = jsilConfig.contentRoot.replace(backslashRe, "/").toLowerCase();

    filename = filename.replace(croot, "").toLowerCase();
  }

  var key = getAssetName(filename, false);
  if (!allAssets.hasOwnProperty(key))
    return false;

  return true;
};
JSIL.Host.getAsset = function (filename, stripRoot) {
  if (filename === null)
    throw new System.Exception("Filename was null");
  
  if (stripRoot === true) {
    var backslashRe = /\\/g;

    filename = filename.replace(backslashRe, "/").toLowerCase();
    var croot = jsilConfig.contentRoot.replace(backslashRe, "/").toLowerCase();

    filename = filename.replace(croot, "").toLowerCase();
  }

  var key = getAssetName(filename, false);
  if (!allAssets.hasOwnProperty(key))
    throw new System.IO.FileNotFoundException("The asset '" + key + "' is not in the asset manifest.", filename);

  return allAssets[key];
};
JSIL.Host.getHeldKeys = function () {
  return Array.prototype.slice.call($jsilbrowserstate.heldKeys);
};
JSIL.Host.getMousePosition = function () {
  return Array.prototype.slice.call($jsilbrowserstate.mousePosition);
};
JSIL.Host.getHeldButtons = function () {
  return Array.prototype.slice.call($jsilbrowserstate.heldButtons);
};
JSIL.Host.getRootDirectory = function () {
  var url = window.location.href;
  var lastSlash = url.lastIndexOf("/");
  if (lastSlash === -1)
    return url;
  else
    return url.substr(0, lastSlash);
};
JSIL.Host.getStorageRoot = function () {
  return $jsilbrowserstate.storageRoot;
};
JSIL.Host.throwException = function (e) {
  var stack = "";
  try {
    stack = e.stack || "";
  } catch (ex) {
    stack = "";
  }
  JSIL.Host.logWriteLine("Unhandled exception: " + String(e));
  if (stack.length > 0)
    JSIL.Host.logWriteLine(stack);
};

var $visibleKeys = [ "hidden", "mozHidden", "msHidden", "webkitHidden" ];

JSIL.Host.isPageVisible = function () {
  for (var i = 0, l = $visibleKeys.length; i < l; i++) {
    var key = $visibleKeys[i];
    var value = document[key];

    if (typeof (value) !== "undefined")
      return !value;
  }

  return true;
};

var $logFps = false;

var allFiles = {};
var allAssets = {};

// Handle mismatches between dom key codes and XNA key codes
var keyMappings = {
  16: [160, 161], // Left Shift, Right Shift
  17: [162, 163], // Left Control, Right Control
  18: [164, 165] // Left Alt, Right Alt
};

function pressKeys (keyCodes) {
  for (var i = 0; i < keyCodes.length; i++) {
    var code = keyCodes[i];
    if (Array.prototype.indexOf.call($jsilbrowserstate.heldKeys, code) === -1)
      $jsilbrowserstate.heldKeys.push(code);
  }
};

function releaseKeys (keyCodes) {
  $jsilbrowserstate.heldKeys = $jsilbrowserstate.heldKeys.filter(function (element, index, array) {
    return keyCodes.indexOf(element) === -1;
  });
};

function initBrowserHooks () {
  var canvas = document.getElementById("canvas");
  if (canvas) {
    $jsilbrowserstate.nativeWidth = canvas.width;
    $jsilbrowserstate.nativeHeight = canvas.height;

    canvas.draggable = false;
    canvas.unselectable = true;
  }

  // Be a good browser citizen!
  // Disabling commonly used hotkeys makes people rage.
  var shouldIgnoreEvent = function (evt) {
    if ($jsilbrowserstate.blockKeyboardInput)
      return true;

    if ((document.activeElement !== null)) {
      switch (document.activeElement.tagName.toLowerCase()) {
        case "form":
        case "select":
        case "input":
        case "datalist":
        case "option":
        case "textarea":
          return true;
        
        default:
          return false;
      }
    }

    switch (evt.keyCode) {
      case 116: // F5
      case 122: // F11
        return true;
    }

    if (evt.ctrlKey) {
      switch (evt.keyCode) {
        case 67: // C
        case 78: // N
        case 84: // T
        case 86: // V
        case 88: // X
          return true;
      }
    }

    return false;
  };

  window.addEventListener(
    "keydown", function (evt) {
      if (shouldIgnoreEvent(evt)) {
        return;
      }

      evt.preventDefault();
      var keyCode = evt.keyCode;
      var codes = keyMappings[keyCode] || [keyCode];        
      
      pressKeys(codes);
    }, true
  );

  window.addEventListener(
    "keyup", function (evt) {
      if (!shouldIgnoreEvent(evt))
        evt.preventDefault();

      var keyCode = evt.keyCode;
      var codes = keyMappings[keyCode] || [keyCode];        
      
      releaseKeys(codes);
    }, true
  );

  var mapMouseCoords = function (evt) {
    var localCanvas = canvas || document.getElementById("canvas");
    if (!localCanvas)
      return;

    var currentWidth = localCanvas.clientWidth;
    var currentHeight = localCanvas.clientHeight;

    var x = (evt.clientX - localCanvas.offsetLeft) | 0;
    var y = (evt.clientY - localCanvas.offsetTop) | 0;

    var xScale = $jsilbrowserstate.nativeWidth / currentWidth;
    var yScale = $jsilbrowserstate.nativeHeight / currentHeight;

    x = (x * xScale) | 0;
    y = (y * yScale) | 0;

    $jsilbrowserstate.mousePosition[0] = x;
    $jsilbrowserstate.mousePosition[1] = y;
  };

  if (canvas) {
    canvas.addEventListener(
      "contextmenu", function (evt) {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
      }, true
    );

    canvas.addEventListener(
      "mousedown", function (evt) {     
        mapMouseCoords(evt);

        var button = evt.button;
        if (Array.prototype.indexOf.call($jsilbrowserstate.heldButtons, button) === -1)
          $jsilbrowserstate.heldButtons.push(button);

        return false;
      }, true
    );

    canvas.addEventListener(
      "mouseup", function (evt) {
        mapMouseCoords(evt);
        
        var button = evt.button;
        $jsilbrowserstate.heldButtons = $jsilbrowserstate.heldButtons.filter(function (element, index, array) {
          (element !== button);
        });

        return false;
      }, true
    );

    canvas.addEventListener(
      "onselectstart", function (evt) {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
      }, true
    );

    canvas.addEventListener(
      "ondragstart", function (evt) {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
      }, true
    );
  };

  document.addEventListener(
    "mousemove", function (evt) {
      mapMouseCoords(evt);
    }, true
  );

  if (typeof(initTouchEvents) !== "undefined")
    initTouchEvents();
};

function getAssetName (filename, preserveCase) {
  var backslashRe = /\\/g;
  filename = filename.replace(backslashRe, "/");
  
  var doubleSlashRe = /\/\//g;
  while (filename.indexOf("//") >= 0)
    filename = filename.replace(doubleSlashRe, "/");

  var lastIndex = filename.lastIndexOf(".");
  var result;
  if (lastIndex === -1)
    result = filename;
  else
    result = filename.substr(0, lastIndex);

  if (preserveCase === true)
    return result;
  else
    return result.toLowerCase();
};

var loadedFontCount = 0;
var loadingPollInterval = 1;
var maxAssetsLoading = 4;
var soundLoadTimeout = 30000;
var fontLoadTimeout = 10000;
var finishStepDuration = 25;

function updateProgressBar (prefix, suffix, bytesLoaded, bytesTotal) {
  if (jsilConfig.updateProgressBar)
    return jsilConfig.updateProgressBar(prefix, suffix, bytesLoaded, bytesTotal);

  var loadingProgress = document.getElementById("loadingProgress");
  var progressBar = document.getElementById("progressBar");
  var progressText = document.getElementById("progressText");
  
  var w = 0;
  if (loadingProgress) {
    w = (bytesLoaded * loadingProgress.clientWidth) / (bytesTotal);
    if (w < 0)
      w = 0;
    else if (w > loadingProgress.clientWidth)
      w = loadingProgress.clientWidth;
  }

  if (progressBar)
    progressBar.style.width = w.toString() + "px";

  if (progressText) {
    var progressString;
    if (suffix === null) {
      progressString = prefix;
    } else {
      progressString = prefix + Math.floor(bytesLoaded) + suffix + " / " + Math.floor(bytesTotal) + suffix;
    }

    if (jsilConfig.formatProgressText)
      progressString = jsilConfig.formatProgressText(prefix, suffix, bytesLoaded, bytesTotal, progressString);

    progressText.textContent = progressString;
    progressText.style.left = ((loadingProgress.clientWidth - progressText.clientWidth) / 2).toString() + "px";
    progressText.style.top = ((loadingProgress.clientHeight - progressText.clientHeight) / 2).toString() + "px";
  }
};

function finishLoading () {
  var state = this;

  var started = Date.now();
  var endBy = started + finishStepDuration;

  var initFileStorage = function (volume) {
    for (var i = 0, l = $jsilbrowserstate.allFileNames.length; i < l; i++) {
      var filename = $jsilbrowserstate.allFileNames[i];
      var file = volume.createFile(filename, false, true);
      file.writeAllBytes(allFiles[filename.toLowerCase()]);
    }
  };

  var initIfNeeded = function () {
    if (!state.jsilInitialized) {
      state.jsilInitialized = true;
      JSIL.Initialize();
    }

    if (typeof ($jsilreadonlystorage) !== "undefined") {
      var prefixedFileRoot;

      if (jsilConfig.fileVirtualRoot[0] !== "/")
        prefixedFileRoot = "/" + jsilConfig.fileVirtualRoot;
      else
        prefixedFileRoot = jsilConfig.fileVirtualRoot;

      $jsilbrowserstate.readOnlyStorage = new ReadOnlyStorageVolume("files", prefixedFileRoot, initFileStorage);
    }

    JSIL.SetLazyValueProperty($jsilbrowserstate, "storageRoot", function InitStorageRoot () {
      if (JSIL.GetStorageVolumes) {
        var volumes = JSIL.GetStorageVolumes();

        if (volumes.length) {
          var root = volumes[0];

          if ($jsilbrowserstate.readOnlyStorage)
            root.createJunction(jsilConfig.fileVirtualRoot, $jsilbrowserstate.readOnlyStorage.rootDirectory, false);

          return root;

        } else if ($jsilbrowserstate.readOnlyStorage) {
          return $jsilbrowserstate.readOnlyStorage;
        }
      }

      return null;
    });
  };

  while (Date.now() <= endBy) {
    if (state.pendingScriptLoads > 0)
      return;

    if (state.finishIndex < state.finishQueue.length) {
      try {
        var item = state.finishQueue[state.finishIndex];
        var cb = item[2];

        // Ensure that we initialize the JSIL runtime before constructing asset objects.
        if ((item[0] != "Script") && (item[0] != "Library")) {
          initIfNeeded();
        }

        updateProgressBar("Loading " + item[3], null, state.assetsFinished, state.assetCount);

        if (typeof (cb) === "function") {
          cb(state);
        }
      } catch (exc) {
        state.assetLoadFailures.push(
          [item[3], exc]
        );

        if (jsilConfig.onLoadFailure) {
          try {
            jsilConfig.onLoadFailure(item[3], exc);
          } catch (exc2) {
          }
        }
      } finally {
        state.finishIndex += 1;
        state.assetsFinished += 1;
      }
    } else {
      initIfNeeded();

      updateProgressBar("Starting game", null, 1, 1);

      var allFailures = $jsilloaderstate.loadFailures.concat(state.assetLoadFailures);

      window.clearInterval(state.interval);
      state.interval = null;
      window.setTimeout(
        state.onDoneLoading.bind(window, allFailures), 10
      );
      return;
    }
  }
};

function pollAssetQueue () {      
  var state = this;

  var w = 0;
  updateProgressBar("Downloading: ", "kb", state.bytesLoaded / 1024, state.assetBytes / 1024);

  var makeStepCallback = function (state, type, sizeBytes, i, name) {
    return function (finish) {
      var lastDot = name.lastIndexOf(".");
      if (lastDot >= 0)
        name = name.substr(0, lastDot);

      var firstComma = name.indexOf(",");
      if (firstComma >= 0)
        name = name.substr(0, firstComma);

      if (typeof (finish) === "function")
        state.finishQueue.push([type, i, finish, name]);

      delete state.assetsLoadingNames[name];
      state.assetsLoading -= 1;
      state.assetsLoaded += 1;

      state.bytesLoaded += sizeBytes;
    };
  };

  var makeErrorCallback = function (assetPath, assetSpec) {
    return function (e) {
      delete state.assetsLoadingNames[getAssetName(assetPath)];
      state.assetsLoading -= 1;
      state.assetsLoaded += 1;

      allAssets[getAssetName(assetPath)] = null;

      var errorText;

      if (e && e.statusText)
        errorText = e.statusText;
      else
        errorText = String(e);

      state.assetLoadFailures.push(
        [assetPath, errorText]
      );

      if (jsilConfig.onLoadFailure) {
        try {
          jsilConfig.onLoadFailure(item[3], errorText);
        } catch (exc2) {
        }
      }

      JSIL.Host.logWriteLine("The asset '" + assetSpec + "' could not be loaded:" + errorText);
    };    
  };

  while ((state.assetsLoading < maxAssetsLoading) && (state.loadIndex < state.assetCount)) {
    try {
      var assetSpec = state.assets[state.loadIndex];
    
      var assetType = assetSpec[0];
      var assetPath = assetSpec[1];
      var assetData = assetSpec[2] || null;
      var assetLoader = assetLoaders[assetType];

      var sizeBytes = 1;
      if (assetData !== null)
        sizeBytes = assetData.sizeBytes || 1;

      var stepCallback = makeStepCallback(state, assetType, sizeBytes, state.loadIndex, assetPath); 
      var errorCallback = makeErrorCallback(assetPath, assetSpec);    
      
      if (typeof (assetLoader) !== "function") {
        errorCallback("No asset loader registered for type '" + assetType + "'.");
      } else {
        state.assetsLoading += 1;
        state.assetsLoadingNames[assetPath] = assetLoader;
        assetLoader(assetPath, assetData, errorCallback, stepCallback, state);
      }
    } finally {
      state.loadIndex += 1;
    }
  }
    
  if (state.assetsLoaded >= state.assetCount) {
    window.clearInterval(state.interval);
    state.interval = null;

    var cmp = function (lhs, rhs) {
      if (lhs > rhs)
        return 1;
      else if (rhs > lhs)
        return -1;
      else
        return 0;
    };

    state.assetsLoadingNames = {};

    state.finishQueue.sort(function (lhs, rhs) {
      var lhsTypeIndex = 2, rhsTypeIndex = 2;
      var lhsIndex = lhs[1];
      var rhsIndex = rhs[1];

      switch (lhs[0]) {
        case "Library":
          lhsTypeIndex = 0;
          break;
        case "Script":
          lhsTypeIndex = 1;
          break;        
      }

      switch (rhs[0]) {
        case "Library":
          rhsTypeIndex = 0;
          break;
        case "Script":
          rhsTypeIndex = 1;
          break;
      }

      var result = cmp(lhsTypeIndex, rhsTypeIndex);
      if (result === 0)
        result = cmp(lhsIndex, rhsIndex);

      return result;
    });

    state.interval = window.setInterval(finishLoading.bind(state), 1);

    return;
  }
};

function loadAssets (assets, onDoneLoading) {
  var state = {
    assetBytes: 0,
    assetCount: assets.length,
    bytesLoaded: 0,
    assetsLoaded: 0,
    assetsFinished: 0,
    assetsLoading: 0,
    onDoneLoading: onDoneLoading,
    assets: assets,
    interval: null,
    finishQueue: [],
    loadIndex: 0,
    finishIndex: 0,
    pendingScriptLoads: 0,
    jsilInitialized: false,
    assetsLoadingNames: {},
    assetLoadFailures: [],
    failedFinishes: 0
  };

  for (var i = 0, l = assets.length; i < l; i++) {
    var properties = assets[i][2];

    if (typeof (properties) !== "object") {
      state.assetBytes += 1;
      continue;
    }

    var sizeBytes = properties.sizeBytes || 1;
    state.assetBytes += sizeBytes;
  }

  state.interval = window.setInterval(pollAssetQueue.bind(state), 1);
};

function beginLoading () {
  initAssetLoaders();

  $jsilbrowserstate.isLoading = true;

  var progressBar = document.getElementById("progressBar");
  var loadButton = document.getElementById("loadButton");
  var fullscreenButton = document.getElementById("fullscreenButton");
  var quitButton = document.getElementById("quitButton");
  var loadingProgress = document.getElementById("loadingProgress");
  var stats = document.getElementById("stats");
  
  if (progressBar)
    progressBar.style.width = "0px";
  if (loadButton)
    loadButton.style.display = "none";
  if (loadingProgress)
    loadingProgress.style.display = "";

  var seenFilenames = {};

  var pushAsset = function (assetSpec) {
    var filename = assetSpec[1];
    if (seenFilenames[filename])
      return;

    seenFilenames[filename] = true;
    allAssetsToLoad.push(assetSpec);
  }

  var allAssetsToLoad = [];
  if (typeof (window.assetsToLoad) !== "undefined") {
    for (var i = 0, l = assetsToLoad.length; i < l; i++)
      pushAsset(assetsToLoad[i]);
  }

  if (typeof (contentManifest) === "object") {
    for (var k in contentManifest) {
      var subManifest = contentManifest[k];

      for (var i = 0, l = subManifest.length; i < l; i++)
        pushAsset(subManifest[i]);

    }
  }
  
  JSIL.Host.logWrite("Loading data ... ");
  loadAssets(allAssetsToLoad, function (loadFailures) {
    $jsilbrowserstate.isLoading = false;
    $jsilbrowserstate.isLoaded = true;

    if (loadFailures && (loadFailures.length > 0)) {
      JSIL.Host.logWriteLine("failed.");
    } else {
      JSIL.Host.logWriteLine("done.");
    }
    try {     
      if (quitButton)
        quitButton.style.display = "";

      if (fullscreenButton && canGoFullscreen)
        fullscreenButton.style.display = "";

      if (stats)
        stats.style.display = "";

      if (jsilConfig.onLoadFailed && loadFailures && (loadFailures.length > 0)) {
        jsilConfig.onLoadFailed(loadFailures);
      } else {
        if (typeof (runMain) === "function") {
          $jsilbrowserstate.mainRunAtTime = Date.now();
          $jsilbrowserstate.isMainRunning = true;
          runMain();
          $jsilbrowserstate.isMainRunning = false;
          $jsilbrowserstate.hasMainRun = true;
        }
      }

      // Main doesn't block since we're using the browser's event loop          
    } finally {
      $jsilbrowserstate.isMainRunning = false;

      if (loadingProgress)
        loadingProgress.style.display = "none";
    }
  });
}

function quitGame () {
  Microsoft.Xna.Framework.Game.ForceQuit();
  document.getElementById("quitButton").style.display = "none";
}

var canGoFullscreen = false;
var integralFullscreenScaling = false;
var overrideFullscreenBaseSize = null;

function generateHTML () {
  var body = document.getElementsByTagName("body")[0];

  if (jsilConfig.showFullscreenButton) {
    if (document.getElementById("fullscreenButton") === null) {
      var button = document.createElement("button");
      button.id = "fullscreenButton";
      button.appendChild(document.createTextNode("Full Screen"));
      body.appendChild(button);
    }
  }

  if (jsilConfig.showStats) {
    if (document.getElementById("stats") === null) {
      var statsDiv = document.createElement("div");
      statsDiv.id = "stats";
      body.appendChild(statsDiv);
    }
  }

  if (jsilConfig.showProgressBar) {
    var progressDiv = document.getElementById("loadingProgress");
    if (progressDiv === null) {
      progressDiv = document.createElement("div");
      progressDiv.id = "loadingProgress";

      var progressContainer = body;
      if (jsilConfig.getProgressContainer)
        progressContainer = jsilConfig.getProgressContainer();

      progressContainer.appendChild(progressDiv);
    }

    progressDiv.innerHTML = (
      '  <div id="progressBar"></div>' +
      '  <span id="progressText"></span>'
    );        
  }  
};

function setupStats () {
  var statsElement = document.getElementById("stats");

  if (statsElement !== null) {
    if (jsilConfig.graphicalStats) {
      statsElement.innerHTML = '<label for="fpsIndicator">Performance: </label><div id="fpsIndicator"></div>';
    } else {
      statsElement.innerHTML = '<span title="Frames Per Second"><span id="drawsPerSecond">0</span> f/s</span><br>' +
        '<span title="Updates Per Second"><span id="updatesPerSecond">0</span> u/s</span><br>' +
        '<span title="Texture Cache Size" id="cacheSpan"><span id="cacheSize">0.0</span >mb <span id="usingWebGL" style="display: none">(WebGL)</span></span><br>' +
        '<input type="checkbox" checked="checked" id="balanceFramerate" name="balanceFramerate"> <label for="balanceFramerate">Balance FPS</label>';
    }

    JSIL.Host.reportFps = function (drawsPerSecond, updatesPerSecond, cacheSize, isWebGL) {
      if (jsilConfig.graphicalStats) {
        var e = document.getElementById("fpsIndicator");
        var color, legend;

        if (drawsPerSecond >= 50) {
          color = "green";
          legend = "Great";
        } else if (drawsPerSecond >= 25) {
          color = "yellow";
          legend = "Acceptable";
        } else {
          color = "red";
          legend = "Poor";
        }

        e.style.backgroundColor = color;
        e.title = "Performance: " + legend;
      } else {
        var e = document.getElementById("drawsPerSecond");
        e.innerHTML = drawsPerSecond.toString();
        
        e = document.getElementById("updatesPerSecond");
        e.innerHTML = updatesPerSecond.toString();

        var cacheSizeMb = (cacheSize / (1024 * 1024)).toFixed(1);
        
        if (isWebGL) {
          e = document.getElementById("usingWebGL");
          e.title = "Using WebGL for rendering";
          e.style.display = "inline-block";
        }

        e = document.getElementById("cacheSize");
        e.innerHTML = cacheSizeMb;
      }

      if (jsilConfig.reportFps) {
        jsilConfig.reportFps(drawsPerSecond, updatesPerSecond, cacheSize, isWebGL);
      }

      if ($logFps) {
        console.log(drawsPerSecond + " draws/s, " + updatesPerSecond + " updates/s");
      }
    };
  } else {
    JSIL.Host.reportFps = function () {
      if ($logFps) {
        console.log(drawsPerSecond + " draws/s, " + updatesPerSecond + " updates/s");
      }  
    };
  }
};

function onLoad () {
  registerErrorHandler();

  initBrowserHooks();  

  generateHTML();
  setupStats();

  var log = document.getElementById("log");
  var loadButton = document.getElementById("loadButton");
  var quitButton = document.getElementById("quitButton");
  var loadingProgress = document.getElementById("loadingProgress");
  var fullscreenButton = document.getElementById("fullscreenButton");
  var statsElement = document.getElementById("stats");

  if (log)
    log.value = "";
  
  if (quitButton) {
    quitButton.style.display = "none";
    quitButton.addEventListener(
      "click", quitGame, true
    );
  }

  if (statsElement)
    statsElement.style.display = "none";

  if (fullscreenButton) {
    fullscreenButton.style.display = "none";

    var canvas = document.getElementById("canvas");
    var originalWidth = canvas.width;
    var originalHeight = canvas.height;

    var fullscreenElement = canvas;
    if (jsilConfig.getFullscreenElement)
      fullscreenElement = jsilConfig.getFullscreenElement();

    var reqFullscreen = fullscreenElement.requestFullScreenWithKeys || 
      fullscreenElement.mozRequestFullScreenWithKeys ||
      fullscreenElement.webkitRequestFullScreenWithKeys ||
      fullscreenElement.requestFullscreen || 
      fullscreenElement.mozRequestFullScreen || 
      fullscreenElement.webkitRequestFullScreen ||
      null;

    if (reqFullscreen) {
      canGoFullscreen = true;

      var goFullscreen = function () {
        reqFullscreen.call(fullscreenElement, Element.ALLOW_KEYBOARD_INPUT);
      };

      var onFullscreenChange = function () {
        var isFullscreen = document.fullscreen || 
          document.fullScreen ||
          document.mozFullScreen || 
          document.webkitIsFullScreen ||
          fullscreenElement.fullscreen || 
          fullscreenElement.fullScreen ||
          fullscreenElement.mozFullScreen || 
          fullscreenElement.webkitIsFullScreen ||
          false;

        $jsilbrowserstate.isFullscreen = isFullscreen;

        if (isFullscreen) {
          var ow = originalWidth, oh = originalHeight;
          if (overrideFullscreenBaseSize) {
            ow = overrideFullscreenBaseSize[0];
            oh = overrideFullscreenBaseSize[1];
          }

          var scaleRatio = Math.min(screen.width / ow, screen.height / oh);
          if (integralFullscreenScaling)
            scaleRatio = Math.floor(scaleRatio);

          canvas.width = ow * scaleRatio;
          canvas.height = oh * scaleRatio;
        } else {
          canvas.width = originalWidth;
          canvas.height = originalHeight;
        }

        if (jsilConfig.onFullscreenChange)
          jsilConfig.onFullscreenChange(isFullscreen);
      };

      document.addEventListener("fullscreenchange", onFullscreenChange, false);
      document.addEventListener("mozfullscreenchange", onFullscreenChange, false);
      document.addEventListener("webkitfullscreenchange", onFullscreenChange, false);

      fullscreenButton.addEventListener(
        "click", goFullscreen, true
      );
    }
  };

  var autoPlay = window.location.search.indexOf("autoPlay") >= 0;
  
  if (loadButton && !autoPlay) {
    loadButton.addEventListener(
      "click", beginLoading, true
    );
  
    if (loadingProgress)
      loadingProgress.style.display = "none";
  } else {
    beginLoading();
  }
}

function registerErrorHandler () {
  var oldErrorHandler = window.onerror;
  
  window.onerror = function JSIL_OnUnhandledException (errorMsg, url, lineNumber) {
    JSIL.Host.logWriteLine("Unhandled exception at " + url + " line " + lineNumber + ":");
    JSIL.Host.logWriteLine(errorMsg);

    if (typeof (oldErrorHandler) === "function")
      return oldErrorHandler(errorMsg, url, lineNumber);
    else
      return false;
  };
};