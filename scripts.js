var wavesurfer;
var arrBuffer;
var audioBuffer;
var processedAudio
var croppedTrack;
var countDown = 0;
var timer;
var myRecorder = {
  objects: {
    context: null,
    stream: null,
    recorder: null,
  }
};

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
    barGap: null,
    backend: 'WebAudio'
  });

  wavesurfer.on('ready', function () {
    totalAudioDuration = wavesurfer.getDuration();
    document.getElementById('time-total').innerText = totalAudioDuration.toFixed(1);
    wavesurfer.enableDragSelection({});
  });
  wavesurfer.loadBlob(blobUrl);
  wavesurfer.on('audioprocess', () => {
    if (wavesurfer.isPlaying()) {
      var currentTime = wavesurfer.getCurrentTime();
      document.getElementById('time-current').innerText = currentTime.toFixed(1);
    }
  });
  wavesurfer.on('region-created', () => {
    wavesurfer.regions.clear();
  });
  wavesurfer.on('region-update-end', (newRegion) => {
    croppedTrack = newRegion
  });
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

const startRecording = () => {
  countDown = 0;
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
      timer = setInterval(() => {
        countDown += 1;

        document.getElementById('recording-timer').innerText = countDown

        if (countDown === 30) {
          countDown = 0;
          stopRecording()
        }
      }, 1000);
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
  clearInterval(timer);
}

const trimAudio = () => {
  let region = wavesurfer.regions.list[Object.keys(wavesurfer.regions.list)[0]]
  var start = region.start;
  var end = region.end;
  var duration = end - start;

  var buffer = createBuffer(wavesurfer.backend.buffer, duration)

  copyBuffer(wavesurfer.backend.buffer, start, end, buffer, 0)

  wavesurfer.empty()
  wavesurfer.loadDecodedBuffer(buffer)
  wavesurfer.regions.clear();

  downloadMp3()
}

function createBuffer(originalBuffer, duration) {
  var sampleRate = originalBuffer.sampleRate
  var frameCount = duration * sampleRate
  var channels = originalBuffer.numberOfChannels
  let buffer = new AudioContext().createBuffer(
    channels,
    frameCount,
    sampleRate
  );
  return buffer
}

function copyBuffer(fromBuffer, fromStart, fromEnd, toBuffer, toStart) {
  var sampleRate = fromBuffer.sampleRate
  var frameCount = (fromEnd - fromStart) * sampleRate
  for (var i = 0; i < fromBuffer.numberOfChannels; i++) {
    var fromChanData = fromBuffer.getChannelData(i)
    var toChanData = toBuffer.getChannelData(i)
    for (var j = 0, f = Math.round(fromStart * sampleRate), t = Math.round(toStart * sampleRate); j < frameCount; j++, f++, t++) {
      toChanData[t] = fromChanData[f]
    }
  }
}

function downloadMp3() {
  var MP3Blob = analyzeAudioBuffer(wavesurfer.backend.buffer);
  var anchorAudio = document.createElement("a");

  anchorAudio.href = URL.createObjectURL(MP3Blob);
  anchorAudio.download = "trimmed-output.mp3";
  anchorAudio.click();
}

function analyzeAudioBuffer(aBuffer) {
  let numOfChan = aBuffer.numberOfChannels,
    btwLength = aBuffer.length * numOfChan * 2 + 44,
    btwArrBuff = new ArrayBuffer(btwLength),
    btwView = new DataView(btwArrBuff),
    btwChnls = [],
    btwIndex,
    btwSample,
    btwOffset = 0,
    btwPos = 0;
  setUint32(0x46464952);
  setUint32(btwLength - 8);
  setUint32(0x45564157);
  setUint32(0x20746d66);
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(aBuffer.sampleRate);
  setUint32(aBuffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164);
  setUint32(btwLength - btwPos - 4);

  for (btwIndex = 0; btwIndex < aBuffer.numberOfChannels; btwIndex++)
    btwChnls.push(aBuffer.getChannelData(btwIndex));

  while (btwPos < btwLength) {
    for (btwIndex = 0; btwIndex < numOfChan; btwIndex++) {
      btwSample = Math.max(-1, Math.min(1, btwChnls[btwIndex][btwOffset]));
      btwSample = (0.5 + btwSample < 0 ? btwSample * 32768 : btwSample * 32767) | 0;
      btwView.setInt16(btwPos, btwSample, true);
      btwPos += 2;
    }
    btwOffset++;
  }

  let wavHdr = lamejs.WavHeader.readHeader(new DataView(btwArrBuff));

  let data = new Int16Array(btwArrBuff, wavHdr.dataOffset, wavHdr.dataLen / 2);
  let leftData = [];
  let rightData = [];
  for (let i = 0; i < data.length; i += 2) {
    leftData.push(data[i]);
    rightData.push(data[i + 1]);
  }
  var left = new Int16Array(leftData);
  var right = new Int16Array(rightData);

  //STEREO
  if (wavHdr.channels === 2)
    return bufferToMp3(wavHdr.channels, wavHdr.sampleRate, left, right);
  //MONO
  else if (wavHdr.channels === 1)
    return bufferToMp3(wavHdr.channels, wavHdr.sampleRate, data);


  function setUint16(data) {
    btwView.setUint16(btwPos, data, true);
    btwPos += 2;
  }

  function setUint32(data) {
    btwView.setUint32(btwPos, data, true);
    btwPos += 4;
  }
}

function bufferToMp3(channels, sampleRate, left, right = null) {
  var buffer = [];
  var mp3enc = new lamejs.Mp3Encoder(channels, sampleRate, 128);
  var remaining = left.length;
  var samplesPerFrame = 1152;

  for (var i = 0; remaining >= samplesPerFrame; i += samplesPerFrame) {
    if (!right) {
      var mono = left.subarray(i, i + samplesPerFrame);
      var mp3buf = mp3enc.encodeBuffer(mono);
    }

    else {
      var leftChunk = left.subarray(i, i + samplesPerFrame);
      var rightChunk = right.subarray(i, i + samplesPerFrame);
      var mp3buf = mp3enc.encodeBuffer(leftChunk, rightChunk);
    }

    if (mp3buf.length > 0) {
      buffer.push(mp3buf);
    }
    remaining -= samplesPerFrame;
  }

  var d = mp3enc.flush();

  if (d.length > 0) {
    buffer.push(new Int8Array(d));
  }

  var mp3Blob = new Blob(buffer, { type: 'audio/mpeg' });

  return mp3Blob;
}