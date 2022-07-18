var wavesurfer;
var arrBuffer;
var audioBuffer;
var processedAudio
var croppedTrack;
var myRecorder = {
  objects: {
    context: null,
    stream: null,
    recorder: null,
  }
};

async function trimAudio() {
  let region = croppedTrack;
  //Create empty buffer and then put the slice of audioBuffer i.e wanted part
  var startPoint = Math.floor((region.start * audioBuffer.length) / totalAudioDuration);
  var endPoint = Math.ceil((region.end * audioBuffer.length) / totalAudioDuration);
  var audioLength = endPoint - startPoint;

  var trimmedAudio = new AudioContext().createBuffer(
    audioBuffer.numberOfChannels,
    audioLength,
    audioBuffer.sampleRate
  );

  for (var i = 0; i < audioBuffer.numberOfChannels; i++) {
    trimmedAudio.copyToChannel(audioBuffer.getChannelData(i).slice(startPoint, endPoint), i);
  }

  var audioData = {
    channels: Array.apply(null, { length: trimmedAudio.numberOfChannels })
      .map(function (_, index) {
        return trimmedAudio.getChannelData(index);
      }),
    sampleRate: trimmedAudio.sampleRate,
    length: trimmedAudio.length,
  }

  try {
    const res = await encodeAudioBufferLame(audioData)
    console.log(res);
    downloadAudio();
  } catch (err) {
    console.log(err);

  }
}

function encodeAudioBufferLame(audioData) {
  return new Promise((resolve, reject) => {
    var worker = new Worker('https://cdn.jsdelivr.net/gh/fahad-inaequo/fahad-inaequo.github.io/worker.js')

    worker.onmessage = (event) => {
      console.log(event.data);
      if (event.data != null) {
        resolve(event.data);
      }
      else {
        reject("Error");
      }
      var blob = new Blob(event.data.res, { type: 'audio/mp3' });
      processedAudio = new window.Audio();
      processedAudio.src = URL.createObjectURL(blob);
      console.log(blob);
    };

    worker.postMessage({ 'audioData': audioData });
  });
}

async function readAndDecodeAudio(audioFile) {
  arrBuffer = null;
  audioBuffer = null;

  //Read the original Audio
  await readAudio(audioFile)
    .then((results) => {
      arrBuffer = results.result;
    })
    .catch((err) => {
      window.alert("Some Error occured");
      console.log(err);
      return;
    });

  //Decode the original Audio into audioBuffer
  await new AudioContext().decodeAudioData(arrBuffer)
    .then((res) => {
      audioBuffer = res;
      console.log("audioBuffer  -- ", audioBuffer);
    })
    .catch((err) => {
      window.alert("Can't decode Audio");
      console.log(err);
      return;
    });
}

function readAudio(file) {
  return new Promise((resolve, reject) => {
    var reader = new FileReader();
    reader.readAsArrayBuffer(file);

    //Resolve if audio gets loaded
    reader.onload = function () {
      console.log("Audio Loaded");
      resolve(reader);
    }

    reader.onerror = function (error) {
      console.log("Error while reading audio");
      reject(error);
    }

    reader.onabort = function (abort) {
      console.log("Aborted");
      console.log(abort);
      reject(abort);
    }

  })
}

const loadAudio = (blobUrl) => {
  if (wavesurfer !== undefined)
    wavesurfer.destroy();

  wavesurfer = WaveSurfer.create({
    container: "#waveform",
    waveColor: '#dde5ec',
    progressColor: '#03cebf',
    barWidth: 1,
    height: 90,
    responsive: true,
    hideScrollbar: true,
    // barRadius: 10,
    // cursorWidth: 1,
    barGap: null
  });

  wavesurfer.on('ready', function () {
    readAndDecodeAudio(blobUrl);
    totalAudioDuration = wavesurfer.getDuration();
    document.getElementById('time-total').innerText = totalAudioDuration.toFixed(1);
    wavesurfer.enableDragSelection({});
  });
  wavesurfer.loadBlob(blobUrl);
  wavesurfer.on('audioprocess', function () {
    if (wavesurfer.isPlaying()) {
      var currentTime = wavesurfer.getCurrentTime();
      document.getElementById('time-current').innerText = currentTime.toFixed(1);
    }
  });
  wavesurfer.on('region-created', function (newRegion) {
    croppedTrack = newRegion
    console.log(croppedTrack);
  });
  wavesurfer.on('region-update-end', function (newRegion) {
    croppedTrack = newRegion
    console.log(croppedTrack);
  });
}

function downloadAudio() {
  var anchorAudio = document.createElement("a");
  anchorAudio.href = processedAudio.src;
  anchorAudio.download = "output.mp3";
  anchorAudio.click();
  console.log(anchorAudio);
}

function playAndPause() {
  var icon = document.getElementById("playAndPause");
  if (icon.className === "play") {
    icon.className = "pause";
    wavesurfer.play();
  } else {
    icon.className = "play";
    wavesurfer.pause();
  }
}

function playTrack(regionId) {
  wavesurfer.regions.list[regionId].play();
}

const startRecording = () => {
  if (null === myRecorder.objects.context) {
    myRecorder.objects.context = new (window.AudioContext ||
      window.webkitAudioContext)();
  }

  if (wavesurfer !== undefined) wavesurfer.destroy();

  var options = { audio: true, video: false };
  navigator.mediaDevices
    .getUserMedia(options)
    .then(function (stream) {
      myRecorder.objects.stream = stream;
      myRecorder.objects.recorder = new Recorder(
        myRecorder.objects.context.createMediaStreamSource(stream),
        { numChannels: 1 }
      );
      myRecorder.objects.recorder.record();
    })
    .catch(function (err) { console.log(err); });
}

const stopRecording = () => {
  if (null !== myRecorder.objects.stream) {
    myRecorder.objects.stream.getAudioTracks()[0].stop();
  }
  if (null !== myRecorder.objects.recorder) {
    myRecorder.objects.recorder.stop();

    myRecorder.objects.recorder.exportWAV(function (blob) {
      loadAudio(blob)
    });
  }
}
