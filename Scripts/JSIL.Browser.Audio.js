JSIL.Audio = {};

JSIL.Audio.InstancePrototype = {
  play: function () {
    this._isPlaying = true;

    if (this.$play)
      this.$play();
  },
  pause: function () {
    this._isPlaying = false;

    if (this.$pause)
      this.$pause();
  },
  dispose: function () {
    // TODO: Return to free instance pool

    if (this.$dispose)
      this.$dispose();
    else
      this.pause();
  },
  get_volume: function () {
    if (this.$get_volume)
      return this.$get_volume();
    else
      return 1;
  },
  set_volume: function (value) {
    if (this.$set_volume)
      this.$set_volume(value);
  },
  get_loop: function () {
    return this._loop;
  },
  set_loop: function (value) {
    this._loop = value;

    if (this.$set_loop)
      this.$set_loop(value);
  },
  get_isPlaying: function () {
    if (this.$get_isPlaying)
      return this.$get_isPlaying();
    else
      return this._isPlaying;
  }
};

Object.defineProperty(JSIL.Audio.InstancePrototype, "volume", {
  get: JSIL.Audio.InstancePrototype.get_volume,
  set: JSIL.Audio.InstancePrototype.set_volume,
  configurable: true,
  enumerable: true
});

Object.defineProperty(JSIL.Audio.InstancePrototype, "loop", {
  get: JSIL.Audio.InstancePrototype.get_loop,
  set: JSIL.Audio.InstancePrototype.set_loop,
  configurable: true,
  enumerable: true
});

Object.defineProperty(JSIL.Audio.InstancePrototype, "isPlaying", {
  get: JSIL.Audio.InstancePrototype.get_isPlaying,
  configurable: true,
  enumerable: true
});


JSIL.Audio.HTML5Instance = function (audioInfo, node, loop) {
  this._isPlaying = false;
  this.node = node;
  this.node.loop = loop;

  this.$bindEvents();
};
JSIL.Audio.HTML5Instance.prototype = Object.create(JSIL.Audio.InstancePrototype);

JSIL.Audio.HTML5Instance.prototype.$bindEvents = function () {
  this.$onEndedListener = JSIL.Browser.RegisterOneShotEventListener(this.node, "ended", true, this.on_ended.bind(this));
};

JSIL.Audio.HTML5Instance.prototype.$unbindEvents = function () {
  if (this.$onEndedListener)
    this.$onEndedListener.unregister();
  
  this.$onEndedListener = null;
};

JSIL.Audio.HTML5Instance.prototype.$play = function () {
  this.node.play();
}

JSIL.Audio.HTML5Instance.prototype.$pause = function () {
  this.node.pause();
}

JSIL.Audio.HTML5Instance.prototype.$get_volume = function () {
  return this.node.volume;
}

JSIL.Audio.HTML5Instance.prototype.$set_volume = function (value) {
  return this.node.volume = value;
}

JSIL.Audio.HTML5Instance.prototype.$set_loop = function (value) {
  return this.node.loop = value;
}

JSIL.Audio.HTML5Instance.prototype.on_ended = function () {
  this.isPlaying = false;
  this.dispose();
};

JSIL.Audio.HTML5Instance.prototype.$dispose = function () {
  this.node.pause();

  // Manually unregister the event listener because apparently it's 1996 and 
  //  browser GCs still can't actually collect cycles
  this.$unbindEvents();
  
  // HACK: This forces Gecko-based browsers to free the resources previously 
  //  used for audio playback.
  try {
    this.node.removeAttribute("src");
    this.node.load();
  } catch (exc) {
  }
};

JSIL.Audio.WebKitInstance = function (audioInfo, buffer, loop) {
  this.bufferSource = audioInfo.audioContext.createBufferSource();
  this.gainNode = audioInfo.audioContext.createGainNode();

  this.bufferSource.buffer = buffer;
  this.bufferSource.loop = loop;

  this.bufferSource.connect(this.gainNode);
  this.gainNode.connect(audioInfo.audioContext.destination);

  this.context = audioInfo.audioContext;
  this.started = 0;
};
JSIL.Audio.WebKitInstance.prototype = Object.create(JSIL.Audio.InstancePrototype);

JSIL.Audio.WebKitInstance.prototype.$play = function () {
  this.started = this.context.currentTime;
  this.bufferSource.noteOn(0);
}

JSIL.Audio.WebKitInstance.prototype.$pause = function () {
  this.started = 0;
  this.bufferSource.noteOff(0);
}

JSIL.Audio.WebKitInstance.prototype.$get_volume = function () {
  return this.gainNode.gain.value;
}

JSIL.Audio.WebKitInstance.prototype.$set_volume = function (value) {
  this.gainNode.gain.value = value;
}

JSIL.Audio.WebKitInstance.prototype.$set_loop = function (value) {
  this.bufferSource.loop = value;
}

JSIL.Audio.WebKitInstance.prototype.$get_isPlaying = function () {
  if (!this._isPlaying)
    return false;

  var elapsed = this.context.currentTime - this.started;
  return (elapsed <= this.bufferSource.buffer.duration);
}

JSIL.Audio.NullInstance = function (audioInfo, loop) {  
};
JSIL.Audio.NullInstance.prototype = Object.create(JSIL.Audio.InstancePrototype);


function finishLoadingSound (filename, createInstance) {
  $jsilbrowserstate.allAssetNames.push(filename);
  allAssets[getAssetName(filename)] = null;

  //var asset = new CallbackSoundAsset(getAssetName(filename, true), createInstance);
  //allAssets[getAssetName(filename)] = asset;
};

function loadNullSound (audioInfo, filename, data, onError, onDoneLoading) {
  var finisher = finishLoadingSound.bind(
    null, filename, function createNullSoundInstance (loop) {
      return new JSIL.Audio.NullInstance(audioInfo, loop);
    }
  );

  onDoneLoading(finisher);
};

function loadWebkitSound (audioInfo, filename, data, onError, onDoneLoading) {
  var handleError = function (text) {
    JSIL.Host.warning("Error while loading '" + filename + "': " + text);
    return loadNullSound(audioInfo, filename, data, onError, onDoneLoading);
  };

  var uri = audioInfo.selectUri(filename, data);
  if (uri == null)
    return handleError("No supported formats for '" + filename + "'.");

  loadBinaryFileAsync(uri, function decodeWebkitSound (result, error) {
    if ((result !== null) && (!error)) {
      var decodeCompleteCallback = function (buffer) {        
        var finisher = finishLoadingSound.bind(
          null, filename, function createWebKitSoundInstance (loop) {
            return new JSIL.Audio.WebKitInstance(audioInfo, buffer, loop);
          }
        );
        
        onDoneLoading(finisher);
      };

      var decodeFailedCallback = function () {
        handleError("Unknown audio decoding error");
      };

      // Decode should really happen in the finisher stage, but that stage isn't parallel.
      try {
        audioInfo.audioContext.decodeAudioData(result.buffer, decodeCompleteCallback, decodeFailedCallback);
      } catch (exc) {
        handleError(exc);
      }
    } else {
      handleError(error);
    }
  });
};

function loadStreamingSound (audioInfo, filename, data, onError, onDoneLoading) {
  var handleError = function (text) {
    JSIL.Host.warning(text);
    return loadNullSound(audioInfo, filename, data, onError, onDoneLoading);
  };

  var uri = audioInfo.selectUri(filename, data);
  if (uri == null)
    return handleError("No supported formats for '" + filename + "'.");

  var createInstance = function createStreamingSoundInstance (loop) {
    var e = audioInfo.makeAudioInstance();
    e.setAttribute("preload", "auto");
    e.setAttribute("autobuffer", "true");
    e.src = uri;

    if (e.load)
      e.load();

    return new JSIL.Audio.HTML5Instance(audioInfo, e, loop);
  };

  var finisher = finishLoadingSound.bind(
    null, filename, createInstance
  );

  onDoneLoading(finisher);
};

function loadBufferedHTML5Sound (audioInfo, filename, data, onError, onDoneLoading) {
  var handleError = function (text) {
    JSIL.Host.warning(text);
    return loadNullSound(audioInfo, filename, data, onError, onDoneLoading);
  };

  var mimeType = [null];
  var uri = audioInfo.selectUri(filename, data, mimeType);
  if (uri == null)
    return handleError("No supported formats for '" + filename + "'.");

  loadBinaryFileAsync(uri, function finishBufferingSound (result, error) {
    if ((result !== null) && (!error)) {
      try {
        var objectUrl = JSIL.GetObjectURLForBytes(result, mimeType[0]);
      } catch (exc) {
        return handleError(exc);
      }

      var createInstance = function createBufferedSoundInstance (loop) {
        var e = audioInfo.makeAudioInstance();
        e.setAttribute("preload", "auto");
        e.setAttribute("autobuffer", "true");
        e.src = objectUrl;

        if (e.load)
          e.load();

        return new JSIL.Audio.HTML5Instance(audioInfo, e, loop);
      };

      var finisher = finishLoadingSound.bind(
        null, filename, createInstance
      );

      onDoneLoading(finisher);
    } else {
      return handleError(error);
    }
  });
}

function loadHTML5Sound (audioInfo, filename, data, onError, onDoneLoading) {
  var handleError = function (text) {
    JSIL.Host.warning(text);
    return loadNullSound(audioInfo, filename, data, onError, onDoneLoading);
  };

  var uri = audioInfo.selectUri(filename, data);
  if (uri == null)
    return handleError("No supported formats for '" + filename + "'.");

  var createInstance = function createStreamingSoundInstance (loop) {
    var e = audioInfo.makeAudioInstance();
    e.setAttribute("preload", "auto");
    e.setAttribute("autobuffer", "true");
    e.src = uri;

    if (e.load)
      e.load();

    return new JSIL.Audio.HTML5Instance(audioInfo, e, loop);
  };

  var finisher = finishLoadingSound.bind(
    null, filename, createInstance
  );

  onDoneLoading(finisher);
}

function loadJSSoundComplete(evt, src, onDoneLoading, finisher) {
  if (evt.src == src) {
    onDoneLoading(finisher);
  }
}

function loadSoundJSSound (audioInfo, filename, data, onError, onDoneLoading) {
  var handleError = function (text) {
    JSIL.Host.warning(new Error(text));
	return handleError("Error while loading '" + filename + "'.");
  };

  var uri = audioInfo.selectUri(filename, data);
  if (uri == null)
    return handleError("No supported formats for '" + filename + "'.");
	
  var createInstance = null;
  
   var finisher = finishLoadingSound.bind(
    null, filename, createInstance
  );
  
  filename = filename.replace(/\.[^/.]+$/, "");
  $jsilbrowserstate.allAssetNames.push(filename);
  allAssets[filename] = uri;

  createjs.Sound.addEventListener("loadComplete", createjs.proxy(loadJSSoundComplete, this, uri, onDoneLoading, finisher));
  createjs.Sound.registerSound(uri);
}

function loadSoundGeneric (audioInfo, filename, data, onError, onDoneLoading) {
  if (audioInfo.disableSound) {
    return loadNullSound(audioInfo, filename, data, onError, onDoneLoading);
  } else {
    return loadSoundJSSound(audioInfo, filename, data, onError, onDoneLoading);
  }
};

function initSoundLoader () {
  var audioContextCtor = window.webkitAudioContext || window.mozAudioContext || window.AudioContext;

  var audioInfo = Object.create($blobBuilderInfo);

  audioInfo.hasAudioContext = typeof (audioContextCtor) === "function";
  audioInfo.audioContext = null;
  audioInfo.testAudioInstance = null;
  audioInfo.disableSound = jsilConfig.disableSound;

  try {
    audioInfo.testAudioInstance = document.createElement("audio");
    if (typeof (audioInfo.testAudioInstance.play) === "function") {
      audioInfo.makeAudioInstance = function () {
        return document.createElement("audio");
      };
    } else {
      audioInfo.disableSound = true;
    }
  } catch (exc) {
    audioInfo.disableSound = true;
  }

  audioInfo.getMimeType = function (extension, mimeType) {
    if (mimeType)
      return mimeType;

    switch (extension) {
      case ".mp3":
        return "audio/mpeg";
      case ".ogg":
        return "audio/ogg; codecs=vorbis"
      case ".wav":
        return "audio/wav"
    }

    return null;
  }

  audioInfo.canPlayType = function (mimeType) {
    var canPlay = "";

    if (this.testAudioInstance.canPlayType) {
      canPlay = this.testAudioInstance.canPlayType(mimeType);
    } else {
      // Goddamn Safari :|
      canPlay = (mimeType == "audio/mpeg") ? "maybe" : "";
    }

    return (canPlay !== "");
  };

  audioInfo.selectUri = function (filename, data, outMimeType) {
    var compl = "";

	if (data.formats === undefined)
	{
		return jsilConfig.contentRoot.replace(/^(?:\.\/)+/, "") + filename;
	} else {	
		for (var i = 0; i < data.formats.length; i++) {
			var format = data.formats[i];
			var extension, mimeType = null;

			if (typeof (format) === "string") {
				extension = format;
			} else {
				extension = format.extension;
				mimeType = format.mimetype;
			}

			if (i > 0)
				compl = compl + "|";

			compl = compl + jsilConfig.contentRoot.replace(/^(?:\.\/)+/, "") + filename + extension;

			//mimeType = this.getMimeType(extension, mimeType);

			//if (this.canPlayType(mimeType)) {
			//  if (outMimeType)
			//    outMimeType[0] = mimeType;

			//  return jsilConfig.contentRoot + filename + extension;
			//}
		}

		return compl;
	}
  };

  if (audioInfo.hasAudioContext) {
    audioInfo.audioContext = new audioContextCtor();  
    // Firefox exposes the AudioContext ctor without actually implementing the API
    audioInfo.hasAudioContext =
      audioInfo.audioContext.decodeAudioData && 
      audioInfo.audioContext.createBufferSource &&
      audioInfo.audioContext.createGainNode &&
      audioInfo.audioContext.destination;
  }

  assetLoaders["Sound"] = loadSoundGeneric.bind(null, audioInfo);

  if (audioInfo.disableSound) {
    JSIL.Host.logWriteLine("WARNING: Your browser has insufficient support for playing audio. Sound is disabled.");
  }
};