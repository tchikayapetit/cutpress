/* Fast export: renders every frame as quickly as the device can, encodes with the browser's
   WebCodecs (H.264 video, AAC or Opus audio) and writes an MP4 with mp4-muxer.
   A 12-second video can finish in a few seconds instead of 12. If the browser cannot do it,
   the app falls back to real-time recording. */
(function () {
  const FX = (window.FX = {});
  FX.available = () => typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && !!window.Mp4Muxer;

  const tick = () => new Promise((r) => setTimeout(r, 0));

  async function pickVideo(W, H, fps, bitrate) {
    const big = W * H * fps > 1920 * 1080 * 30;
    for (const codec of big ? ['avc1.64002a', 'avc1.640034', 'avc1.4d002a'] : ['avc1.640028', 'avc1.4d0028', 'avc1.42001f']) {
      const cfg = { codec, width: W, height: H, bitrate, framerate: fps };
      try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch (e) {}
    }
    return null;
  }
  async function pickAudio(sr) {
    for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
      const cfg = { codec, sampleRate: sr, numberOfChannels: 2, bitrate: 160000 };
      try { if ((await AudioEncoder.isConfigSupported(cfg)).supported) return { cfg, mux }; } catch (e) {}
    }
    return null;
  }

  // canvas: preview canvas; drawAt(t) draws the frame for time t; audio: AudioBuffer (stereo)
  FX.encode = async ({ canvas, W, H, fps, bitrate, T, drawAt, audio, onProgress, cancelled }) => {
    if (!FX.available()) return null;
    const vcfg = await pickVideo(W, H, fps, bitrate);
    const acfg = await pickAudio(audio.sampleRate);
    if (!vcfg || !acfg) return null;
    const target = new Mp4Muxer.ArrayBufferTarget();
    const muxer = new Mp4Muxer.Muxer({
      target,
      video: { codec: 'avc', width: W, height: H },
      audio: { codec: acfg.mux, numberOfChannels: 2, sampleRate: audio.sampleRate },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });
    let failure = null;
    const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => (failure = e) });
    venc.configure(vcfg);
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => (failure = e) });
    aenc.configure(acfg.cfg);

    // audio first: it is already rendered, so it is quick
    const sr = audio.sampleRate, n = audio.length;
    const L = audio.getChannelData(0), R = audio.numberOfChannels > 1 ? audio.getChannelData(1) : L;
    const block = 4096;
    for (let off = 0; off < n; off += block) {
      const len = Math.min(block, n - off);
      const data = new Float32Array(len * 2);
      data.set(L.subarray(off, off + len), 0);
      data.set(R.subarray(off, off + len), len);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: len, numberOfChannels: 2, timestamp: Math.round((off / sr) * 1e6), data });
      aenc.encode(ad);
      ad.close();
      if (aenc.encodeQueueSize > 12) await tick();
      if (failure) throw failure;
    }

    const total = Math.max(1, Math.ceil(T * fps));
    const dur = Math.round(1e6 / fps);
    for (let i = 0; i < total; i++) {
      if (cancelled()) { venc.close(); aenc.close(); return null; }
      drawAt(i / fps);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: dur });
      venc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while (venc.encodeQueueSize > 6) await tick();
      if (failure) throw failure;
      if (i % 4 === 0) { onProgress(i / total); await tick(); }
    }
    await venc.flush();
    await aenc.flush();
    venc.close();
    aenc.close();
    muxer.finalize();
    onProgress(1);
    return new Blob([target.buffer], { type: 'video/mp4' });
  };
})();
