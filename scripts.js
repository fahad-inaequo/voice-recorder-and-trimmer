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

async function trimAudio() {
  let region = wavesurfer.regions.list[Object.keys(wavesurfer.regions.list)[0]]
  //Create empty buffer and then put the slice of audioBuffer i.e wanted part
  var startPoint = Math.floor((region.start * audioBuffer.length) / totalAudioDuration);
  var endPoint = Math.ceil((region.end * audioBuffer.length) / totalAudioDuration);
  var audioLength = endPoint - startPoint;

  var trimmedAudio = new AudioContext().createBuffer(
    audioBuffer.numberOfChannels,
    audioLength,
    audioBuffer.sampleRate
  );

  debugger
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

  await encodeAudioBufferLame(audioData)
    .then((res) => {
      console.log(res);
      downloadAudio();
    })
    .catch((c) => {
      console.log(c);
    });
  console.log(audioData);
}

function encodeAudioBufferLame(audioData) {
  return new Promise((resolve, reject) => {
    var worker = new Worker('./worker.js');

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
    barGap: null,
    backend: 'WebAudio'
  });

  wavesurfer.on('ready', function () {
    readAndDecodeAudio(blobUrl);
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




const myNewFun = () => {
  let region = wavesurfer.regions.list[Object.keys(wavesurfer.regions.list)[0]]
  //Create empty buffer and then put the slice of audioBuffer i.e wanted part
  var startPoint = Math.floor((region.start * audioBuffer.length) / totalAudioDuration);
  var endPoint = Math.ceil((region.end * audioBuffer.length) / totalAudioDuration);
  var duration = endPoint - startPoint;

  // create a new buffer to hold the new clip
  var buffer = createBuffer(wavesurfer.backend.buffer, duration)
  // copy
  copyBuffer(wavesurfer.backend.buffer, start, end, buffer, 0)

  // load the new buffer
  wavesurfer.empty()
  wavesurfer.loadDecodedBuffer(buffer)
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
  debugger
  let somoe = wavesurfer.regions.list[Object.keys(wavesurfer.regions.list)[0]]
  var segmentDuration = somoe.end - somoe.start;
  var originalBuffer = wavesurfer.backend.buffer;
  var emptySegment = wavesurfer.backend.ac.createBuffer(
    originalBuffer.numberOfChannels,
    segmentDuration * originalBuffer.sampleRate,
    originalBuffer.sampleRate
  );
  for (var i = 0; i < originalBuffer.channels; i++) {
    var chanData = originalBuffer.getChannelData(i);
    var segmentChanData = emptySegment.getChannelData(i);
    for (var j = 0, len = chanData.length; j < len; j++) {
      segmentChanData[j] = chanData[j];
    }
  }

  emptySegment;

  var MP3Blob = analyzeAudioBuffer(emptySegment);
  console.log('here is your mp3 url:');
  console.log(URL.createObjectURL(MP3Blob));
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
  setUint32(0x46464952); // "RIFF"
  setUint32(btwLength - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(aBuffer.sampleRate);
  setUint32(aBuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit
  setUint32(0x61746164); // "data" - chunk
  setUint32(btwLength - btwPos - 4); // chunk length

  for (btwIndex = 0; btwIndex < aBuffer.numberOfChannels; btwIndex++)
    btwChnls.push(aBuffer.getChannelData(btwIndex));

  while (btwPos < btwLength) {
    for (btwIndex = 0; btwIndex < numOfChan; btwIndex++) {
      // interleave btwChnls
      btwSample = Math.max(-1, Math.min(1, btwChnls[btwIndex][btwOffset])); // clamp
      btwSample = (0.5 + btwSample < 0 ? btwSample * 32768 : btwSample * 32767) | 0; // scale to 16-bit signed int
      btwView.setInt16(btwPos, btwSample, true); // write 16-bit sample
      btwPos += 2;
    }
    btwOffset++; // next source sample
  }

  let wavHdr = lamejs.WavHeader.readHeader(new DataView(btwArrBuff));

  //Stereo
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
      buffer.push(mp3buf);//new Int8Array(mp3buf));
    }
    remaining -= samplesPerFrame;
  }
  var d = mp3enc.flush();
  if (d.length > 0) {
    buffer.push(new Int8Array(d));
  }

  var mp3Blob = new Blob(buffer, { type: 'audio/mpeg' });
  //var bUrl = window.URL.createObjectURL(mp3Blob);

  // send the download link to the console
  //console.log('mp3 download:', bUrl);
  return mp3Blob;

}