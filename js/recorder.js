/* Records a canvas plus the app's audio into a video file with MediaRecorder.
   Shared by the match cut and the collage video export. */
(function () {
  const REC = (window.REC = { lastFile: null, cancelled: false });

  const overlay = () => U.$('#export-overlay');
  REC.showOverlay = (title) => {
    overlay().hidden = false;
    U.$('#export-title').textContent = title;
    REC.progress(0);
  };
  REC.progress = (p) => {
    U.$('#export-bar').style.width = Math.round(p * 100) + '%';
    U.$('#export-pct').textContent = Math.round(p * 100) + '%';
  };
  REC.hideOverlay = () => (overlay().hidden = true);

  REC.supported = () => typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;

  // play(): starts playback and returns a promise that resolves when playback ends.
  REC.record = async ({ canvas, fps, bitrate, format, play, stop, name }) => {
    if (!REC.supported()) {
      U.toast('This browser cannot record video. Try Chrome, Edge or a recent Safari.', 5000);
      return null;
    }
    await AE.resume();
    const mime = U.pickMime(format);
    if (!mime) {
      U.toast('No supported video format found in this browser.', 5000);
      return null;
    }
    if (format === 'mp4' && !mime.includes('mp4')) U.toast('MP4 recording is not supported here, exporting WebM instead.', 4000);
    const stream = canvas.captureStream(fps);
    const at = AE.streamDest && AE.streamDest.stream.getAudioTracks()[0];
    if (at) stream.addTrack(at);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: 192000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    const stopped = new Promise((res) => (rec.onstop = res));
    REC.cancelled = false;
    REC._stop = stop;
    rec.start(200);
    await new Promise((r) => setTimeout(r, 120));
    await play();
    await new Promise((r) => setTimeout(r, 250));
    rec.stop();
    await stopped;
    stream.getVideoTracks().forEach((t) => t.stop());
    if (REC.cancelled) return null;
    const type = mime.split(';')[0];
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    return REC.save(new Blob(chunks, { type }), `${name}.${ext}`);
  };

  // Saves a finished video: download, share button, and the on-device history.
  REC.save = (blob, filename) => {
    const file = new File([blob], filename, { type: blob.type });
    REC.lastFile = file;
    U.download(blob, file.name);
    REC.updateShare();
    if (REC.onSaved) REC.onSaved(file);
    return file;
  };

  REC.cancel = () => {
    REC.cancelled = true;
    if (REC._stop) REC._stop();
  };

  REC.canShare = () => {
    try {
      return !!(REC.lastFile && navigator.canShare && navigator.canShare({ files: [REC.lastFile] }));
    } catch (e) {
      return false;
    }
  };
  REC.updateShare = () => U.$$('.share-btn').forEach((b) => (b.hidden = !REC.canShare()));
  REC.share = async () => {
    if (!REC.canShare()) return U.toast('Sharing files is not supported in this browser. Use the downloaded file.');
    try {
      await navigator.share({ files: [REC.lastFile], title: 'My CutPress video' });
    } catch (e) {
      /* user closed the share sheet */
    }
  };
})();
