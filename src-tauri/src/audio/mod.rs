use crate::{
    equalizer::{EQ_FREQUENCIES, EQ_MAX_DB, EQ_MIN_DB, PREAMP_MAX_DB, PREAMP_MIN_DB},
    error::{AppError, AppResult},
};
use cpal::{
    traits::{DeviceTrait, HostTrait, StreamTrait},
    FromSample, Sample, SizedSample, Stream,
};
use crossbeam_queue::ArrayQueue;
use rubato::{FftFixedInOut, Resampler};
use rustfft::{num_complex::Complex32, FftPlanner};
use serde::Serialize;
use std::{
    fs::File,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU32, AtomicU64, AtomicU8, Ordering},
        Arc, RwLock,
    },
    thread,
    time::Duration,
};
use symphonia::core::{
    audio::SampleBuffer,
    codecs::DecoderOptions,
    formats::{FormatOptions, SeekMode, SeekTo},
    io::MediaSourceStream,
    meta::MetadataOptions,
    probe::Hint,
    units::Time,
};

const IDLE: u8 = 0;
const LOADING: u8 = 1;
const PLAYING: u8 = 2;
const PAUSED: u8 = 3;
const STOPPED: u8 = 4;
const ERROR: u8 = 5;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSnapshot {
    pub track_id: Option<String>,
    pub status: String,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub volume: f32,
    pub buffered_ms: u64,
    pub repeat: String,
    pub shuffle: bool,
    pub spectrum: Vec<f32>,
    pub error: Option<String>,
}

#[derive(Default)]
struct TrackState {
    id: Option<String>,
    path: Option<PathBuf>,
    duration_ms: u64,
    error: Option<String>,
}

struct QueuedSample {
    generation: u64,
    value: f32,
}

struct Shared {
    queue: ArrayQueue<QueuedSample>,
    analysis_queue: ArrayQueue<f32>,
    status: AtomicU8,
    volume: AtomicU32,
    position_samples: AtomicU64,
    generation: AtomicU64,
    decode_done: AtomicBool,
    natural_end_generation: AtomicU64,
    play_requested: AtomicBool,
    output_rate: u32,
    output_channels: u16,
    prebuffer_samples: usize,
    track: RwLock<TrackState>,
    spectrum: RwLock<Vec<f32>>,
    repeat: AtomicU8,
    shuffle: AtomicBool,
    equalizer_enabled: AtomicBool,
    equalizer_bands: [AtomicU32; 10],
    equalizer_preamp: AtomicU32,
    equalizer_revision: AtomicU64,
}

pub struct AudioEngine {
    shared: Arc<Shared>,
}

impl AudioEngine {
    pub fn new() -> AppResult<Self> {
        let device = cpal::default_host()
            .default_output_device()
            .ok_or_else(|| {
                AppError::new("AUDIO_DEVICE_ERROR", "Аудиоустройство вывода не найдено")
            })?;
        let config = device
            .default_output_config()
            .map_err(|error| AppError::new("AUDIO_DEVICE_ERROR", error.to_string()))?;
        let rate = config.sample_rate().0;
        let channels = config.channels();
        let shared = Arc::new(Shared {
            queue: ArrayQueue::new(rate as usize * channels as usize * 12),
            analysis_queue: ArrayQueue::new(rate as usize * 2),
            status: AtomicU8::new(IDLE),
            volume: AtomicU32::new(0.8f32.to_bits()),
            position_samples: AtomicU64::new(0),
            generation: AtomicU64::new(0),
            decode_done: AtomicBool::new(true),
            natural_end_generation: AtomicU64::new(0),
            play_requested: AtomicBool::new(false),
            output_rate: rate,
            output_channels: channels,
            prebuffer_samples: rate as usize * channels as usize / 5,
            track: RwLock::new(TrackState::default()),
            spectrum: RwLock::new(vec![0.0; 48]),
            repeat: AtomicU8::new(0),
            shuffle: AtomicBool::new(false),
            equalizer_enabled: AtomicBool::new(false),
            equalizer_bands: std::array::from_fn(|_| AtomicU32::new(0.0f32.to_bits())),
            equalizer_preamp: AtomicU32::new(0.0f32.to_bits()),
            equalizer_revision: AtomicU64::new(1),
        });
        let (ready_tx, ready_rx) = std::sync::mpsc::sync_channel(1);
        let output_shared = shared.clone();
        thread::Builder::new()
            .name("audio-output".into())
            .spawn(move || {
                let result = create_output_stream(device, config, output_shared);
                match result {
                    Ok(stream) => {
                        if let Err(error) = stream.play() {
                            let _ = ready_tx
                                .send(Err(AppError::new("AUDIO_DEVICE_ERROR", error.to_string())));
                            return;
                        }
                        let _ = ready_tx.send(Ok(()));
                        loop {
                            thread::park();
                        }
                    }
                    Err(error) => {
                        let _ = ready_tx.send(Err(error));
                    }
                }
            })
            .map_err(|error| AppError::new("AUDIO_DEVICE_ERROR", error.to_string()))?;
        ready_rx
            .recv()
            .map_err(|error| AppError::new("AUDIO_DEVICE_ERROR", error.to_string()))??;
        let spectrum_shared = shared.clone();
        thread::Builder::new()
            .name("audio-spectrum".into())
            .spawn(move || spectrum_worker(spectrum_shared))
            .map_err(|error| AppError::new("AUDIO_DEVICE_ERROR", error.to_string()))?;
        Ok(Self { shared })
    }

    pub fn load(
        &self,
        track_id: String,
        path: PathBuf,
        start_ms: u64,
    ) -> AppResult<PlaybackSnapshot> {
        if !path.is_file() {
            return Err(AppError::new(
                "FILE_MISSING",
                "Исходный аудиофайл не найден",
            ));
        }
        let preserved_duration_ms = self
            .shared
            .track
            .read()
            .ok()
            .filter(|track| track.id.as_deref() == Some(track_id.as_str()))
            .map_or(0, |track| track.duration_ms);
        let generation = self.shared.generation.fetch_add(1, Ordering::SeqCst) + 1;
        self.shared.status.store(LOADING, Ordering::Release);
        self.shared.play_requested.store(false, Ordering::Release);
        while self.shared.queue.pop().is_some() {}
        while self.shared.analysis_queue.pop().is_some() {}
        if let Ok(mut spectrum) = self.shared.spectrum.write() {
            spectrum.fill(0.0);
        }
        self.shared.position_samples.store(
            start_ms * self.shared.output_rate as u64 * self.shared.output_channels as u64 / 1000,
            Ordering::Relaxed,
        );
        self.shared.decode_done.store(false, Ordering::Release);
        *self
            .shared
            .track
            .write()
            .map_err(|_| AppError::playback("Состояние аудиодвижка недоступно"))? = TrackState {
            id: Some(track_id),
            path: Some(path.clone()),
            duration_ms: preserved_duration_ms,
            error: None,
        };
        let shared = self.shared.clone();
        thread::Builder::new()
            .name("audio-decoder".into())
            .spawn(move || decode_worker(shared, path, start_ms, generation))
            .map_err(|error| AppError::playback(error.to_string()))?;
        Ok(self.snapshot())
    }
    pub fn play(&self) -> AppResult<PlaybackSnapshot> {
        if self
            .shared
            .track
            .read()
            .map_err(|_| AppError::playback("Состояние недоступно"))?
            .id
            .is_none()
        {
            return Err(AppError::playback("Сначала выберите трек"));
        }
        self.shared.play_requested.store(true, Ordering::Release);
        update_playback_readiness(&self.shared);
        Ok(self.snapshot())
    }
    pub fn pause(&self) -> PlaybackSnapshot {
        self.shared.play_requested.store(false, Ordering::Release);
        self.shared.status.store(PAUSED, Ordering::Release);
        self.snapshot()
    }
    pub fn stop(&self) -> PlaybackSnapshot {
        self.shared.generation.fetch_add(1, Ordering::SeqCst);
        self.shared.play_requested.store(false, Ordering::Release);
        while self.shared.queue.pop().is_some() {}
        self.shared.position_samples.store(0, Ordering::Relaxed);
        self.shared.status.store(STOPPED, Ordering::Release);
        self.snapshot()
    }
    pub fn seek(&self, position_ms: u64) -> AppResult<PlaybackSnapshot> {
        let (id, path, should_resume) = {
            let track = self
                .shared
                .track
                .read()
                .map_err(|_| AppError::playback("Состояние недоступно"))?;
            (
                track.id.clone(),
                track.path.clone(),
                self.shared.play_requested.load(Ordering::Acquire),
            )
        };
        self.load(
            id.ok_or_else(|| AppError::playback("Трек не выбран"))?,
            path.ok_or_else(|| AppError::playback("Путь не найден"))?,
            position_ms,
        )?;
        if should_resume {
            self.shared.play_requested.store(true, Ordering::Release);
            update_playback_readiness(&self.shared);
        } else {
            self.shared.status.store(PAUSED, Ordering::Release);
        }
        Ok(self.snapshot())
    }
    pub fn set_volume(&self, value: f32) -> PlaybackSnapshot {
        self.shared
            .volume
            .store(value.clamp(0.0, 1.0).to_bits(), Ordering::Relaxed);
        self.snapshot()
    }
    pub fn set_repeat(&self, value: &str) -> PlaybackSnapshot {
        self.shared.repeat.store(
            match value {
                "all" => 1,
                "one" => 2,
                _ => 0,
            },
            Ordering::Relaxed,
        );
        self.snapshot()
    }
    pub fn set_shuffle(&self, value: bool) -> PlaybackSnapshot {
        self.shared.shuffle.store(value, Ordering::Relaxed);
        self.snapshot()
    }
    pub fn repeat_mode(&self) -> &'static str {
        match self.shared.repeat.load(Ordering::Relaxed) {
            1 => "all",
            2 => "one",
            _ => "off",
        }
    }
    pub fn shuffle_enabled(&self) -> bool {
        self.shared.shuffle.load(Ordering::Relaxed)
    }
    pub fn natural_end_generation(&self) -> u64 {
        self.shared.natural_end_generation.load(Ordering::Acquire)
    }
    pub fn set_equalizer(&self, enabled: bool, bands: &[f32], preamp_db: f32) {
        for (target, value) in self.shared.equalizer_bands.iter().zip(bands.iter()) {
            target.store(
                value.clamp(EQ_MIN_DB, EQ_MAX_DB).to_bits(),
                Ordering::Relaxed,
            );
        }
        self.shared.equalizer_preamp.store(
            preamp_db.clamp(PREAMP_MIN_DB, PREAMP_MAX_DB).to_bits(),
            Ordering::Relaxed,
        );
        self.shared
            .equalizer_enabled
            .store(enabled, Ordering::Relaxed);
        self.shared
            .equalizer_revision
            .fetch_add(1, Ordering::Release);
    }
    pub fn snapshot(&self) -> PlaybackSnapshot {
        let track = self.shared.track.read().ok();
        let samples = self.shared.position_samples.load(Ordering::Relaxed);
        let divisor = self.shared.output_rate as u64 * self.shared.output_channels as u64;
        PlaybackSnapshot {
            track_id: track.as_ref().and_then(|t| t.id.clone()),
            status: match self.shared.status.load(Ordering::Acquire) {
                LOADING => "loading",
                PLAYING => "playing",
                PAUSED => "paused",
                STOPPED => "stopped",
                ERROR => "error",
                _ => "idle",
            }
            .into(),
            position_ms: if divisor > 0 {
                samples * 1000 / divisor
            } else {
                0
            },
            duration_ms: track.as_ref().map(|t| t.duration_ms).unwrap_or(0),
            volume: f32::from_bits(self.shared.volume.load(Ordering::Relaxed)),
            buffered_ms: self.shared.queue.len() as u64 * 1000 / divisor.max(1),
            repeat: self.repeat_mode().into(),
            shuffle: self.shuffle_enabled(),
            spectrum: self
                .shared
                .spectrum
                .read()
                .map(|spectrum| spectrum.clone())
                .unwrap_or_else(|_| vec![0.0; 48]),
            error: track.as_ref().and_then(|t| t.error.clone()),
        }
    }
}

fn create_output_stream(
    device: cpal::Device,
    config: cpal::SupportedStreamConfig,
    shared: Arc<Shared>,
) -> AppResult<Stream> {
    let sample_format = config.sample_format();
    let stream_config: cpal::StreamConfig = config.into();
    match sample_format {
        cpal::SampleFormat::F32 => build_stream::<f32>(&device, &stream_config, shared),
        cpal::SampleFormat::I16 => build_stream::<i16>(&device, &stream_config, shared),
        cpal::SampleFormat::U16 => build_stream::<u16>(&device, &stream_config, shared),
        other => Err(AppError::new(
            "AUDIO_DEVICE_ERROR",
            format!("Неподдерживаемый sample format: {other:?}"),
        )),
    }
}

#[derive(Clone, Copy)]
struct Biquad {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    z1: f32,
    z2: f32,
}

impl Default for Biquad {
    fn default() -> Self {
        Self {
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
            z1: 0.0,
            z2: 0.0,
        }
    }
}

impl Biquad {
    fn set_peaking(&mut self, sample_rate: f32, frequency: f32, gain_db: f32) {
        let nyquist_safe_frequency = frequency.min(sample_rate * 0.45);
        let amplitude = 10.0f32.powf(gain_db / 40.0);
        let omega = std::f32::consts::TAU * nyquist_safe_frequency / sample_rate;
        let alpha = omega.sin() / (2.0 * std::f32::consts::SQRT_2);
        let cosine = omega.cos();
        let a0 = 1.0 + alpha / amplitude;
        self.b0 = (1.0 + alpha * amplitude) / a0;
        self.b1 = (-2.0 * cosine) / a0;
        self.b2 = (1.0 - alpha * amplitude) / a0;
        self.a1 = (-2.0 * cosine) / a0;
        self.a2 = (1.0 - alpha / amplitude) / a0;
    }

    fn process(&mut self, input: f32) -> f32 {
        let output = self.b0 * input + self.z1;
        self.z1 = self.b1 * input - self.a1 * output + self.z2;
        self.z2 = self.b2 * input - self.a2 * output;
        output
    }
}

struct EqualizerProcessor {
    sample_rate: f32,
    filters: Vec<Vec<Biquad>>,
    current_mix: f32,
    target_mix: f32,
    current_preamp: f32,
    target_preamp: f32,
}

impl EqualizerProcessor {
    fn new(sample_rate: u32, channels: usize) -> Self {
        Self {
            sample_rate: sample_rate as f32,
            filters: vec![vec![Biquad::default(); EQ_FREQUENCIES.len()]; channels],
            current_mix: 0.0,
            target_mix: 0.0,
            current_preamp: 1.0,
            target_preamp: 1.0,
        }
    }

    fn configure(&mut self, enabled: bool, bands: &[f32], preamp_db: f32) {
        self.target_mix = if enabled { 1.0 } else { 0.0 };
        self.target_preamp = 10.0f32.powf(preamp_db / 20.0);
        for channel in &mut self.filters {
            for ((filter, frequency), gain) in channel
                .iter_mut()
                .zip(EQ_FREQUENCIES)
                .zip(bands.iter().copied())
            {
                filter.set_peaking(self.sample_rate, frequency, gain);
            }
        }
    }

    fn process(&mut self, channel: usize, input: f32) -> f32 {
        self.current_mix += (self.target_mix - self.current_mix) * 0.002;
        self.current_preamp += (self.target_preamp - self.current_preamp) * 0.002;
        let mut filtered = input;
        for filter in &mut self.filters[channel] {
            filtered = filter.process(filtered);
        }
        let wet = filtered * self.current_preamp;
        input + (wet - input) * self.current_mix
    }
}

fn build_stream<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    shared: Arc<Shared>,
) -> AppResult<Stream>
where
    T: Sample + SizedSample + FromSample<f32>,
{
    let error_shared = shared.clone();
    let channels = shared.output_channels as usize;
    let mut current_gain = 0.0f32;
    let mut equalizer = EqualizerProcessor::new(config.sample_rate.0, channels);
    let mut equalizer_revision = 0;
    device
        .build_output_stream(
            config,
            move |output: &mut [T], _| {
                let active_equalizer_revision = shared.equalizer_revision.load(Ordering::Acquire);
                if active_equalizer_revision != equalizer_revision {
                    equalizer_revision = active_equalizer_revision;
                    let bands: [f32; 10] = std::array::from_fn(|index| {
                        f32::from_bits(shared.equalizer_bands[index].load(Ordering::Relaxed))
                    });
                    equalizer.configure(
                        shared.equalizer_enabled.load(Ordering::Relaxed),
                        &bands,
                        f32::from_bits(shared.equalizer_preamp.load(Ordering::Relaxed)),
                    );
                }
                let mut written_frames = 0u64;
                for frame in output.chunks_mut(channels) {
                    let playing = shared.status.load(Ordering::Acquire) == PLAYING;
                    let target_gain = if playing {
                        f32::from_bits(shared.volume.load(Ordering::Relaxed))
                    } else {
                        0.0
                    };
                    current_gain += (target_gain - current_gain) * 0.005;

                    if playing && shared.queue.len() >= frame.len() {
                        let active_generation = shared.generation.load(Ordering::Acquire);
                        let mut complete_frame = true;
                        let mut mono_sample = 0.0f32;
                        for (channel, sample) in frame.iter_mut().enumerate() {
                            let queued = loop {
                                match shared.queue.pop() {
                                    Some(queued) if queued.generation == active_generation => {
                                        break Some(queued)
                                    }
                                    Some(_) => continue,
                                    None => break None,
                                }
                            };
                            if let Some(queued) = queued {
                                let processed = equalizer.process(channel, queued.value);
                                let output_value = (processed * current_gain).clamp(-1.0, 1.0);
                                mono_sample += output_value;
                                *sample = T::from_sample(output_value);
                            } else {
                                *sample = T::from_sample(0.0);
                                complete_frame = false;
                            }
                        }
                        if complete_frame {
                            written_frames += 1;
                            let mono_sample = mono_sample / frame.len().max(1) as f32;
                            if shared.analysis_queue.push(mono_sample).is_err() {
                                let _ = shared.analysis_queue.pop();
                                let _ = shared.analysis_queue.push(mono_sample);
                            }
                        } else if shared.decode_done.load(Ordering::Acquire) {
                            shared.play_requested.store(false, Ordering::Release);
                            shared.status.store(STOPPED, Ordering::Release);
                            shared.natural_end_generation.store(
                                shared.generation.load(Ordering::Acquire),
                                Ordering::Release,
                            );
                        } else {
                            shared.status.store(LOADING, Ordering::Release);
                        }
                    } else {
                        frame.fill_with(|| T::from_sample(0.0));
                        if playing {
                            if shared.decode_done.load(Ordering::Acquire) {
                                shared.play_requested.store(false, Ordering::Release);
                                shared.status.store(STOPPED, Ordering::Release);
                                shared.natural_end_generation.store(
                                    shared.generation.load(Ordering::Acquire),
                                    Ordering::Release,
                                );
                            } else {
                                shared.status.store(LOADING, Ordering::Release);
                            }
                        }
                    }
                }
                shared.position_samples.fetch_add(
                    written_frames * shared.output_channels as u64,
                    Ordering::Relaxed,
                );
            },
            move |error| {
                error_shared.status.store(ERROR, Ordering::Release);
                if let Ok(mut track) = error_shared.track.write() {
                    track.error = Some(error.to_string());
                }
            },
            None,
        )
        .map_err(|error| AppError::new("AUDIO_DEVICE_ERROR", error.to_string()))
}

fn decode_worker(shared: Arc<Shared>, path: PathBuf, start_ms: u64, generation: u64) {
    if let Err(error) = decode_file(&shared, &path, start_ms, generation) {
        if generation == shared.generation.load(Ordering::Acquire) {
            shared.decode_done.store(true, Ordering::Release);
            shared.status.store(ERROR, Ordering::Release);
            if let Ok(mut track) = shared.track.write() {
                track.error = Some(error.to_string());
            }
        }
        return;
    }
    if generation == shared.generation.load(Ordering::Acquire) {
        shared.decode_done.store(true, Ordering::Release);
        update_playback_readiness(&shared);
    }
}

fn decode_file(shared: &Shared, path: &Path, start_ms: u64, generation: u64) -> AppResult<()> {
    let file = File::open(path)?;
    let stream = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|v| v.to_str()) {
        hint.with_extension(ext);
    }
    let mut probed = symphonia::default::get_probe()
        .format(
            &hint,
            stream,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| AppError::playback(e.to_string()))?;
    let track = probed
        .format
        .default_track()
        .ok_or_else(|| AppError::playback("Аудиодорожка не найдена"))?;
    let track_id = track.id;
    let params = track.codec_params.clone();
    let source_rate = params
        .sample_rate
        .ok_or_else(|| AppError::playback("Sample rate не определён"))?;
    let source_channels = params.channels.map(|v| v.count()).unwrap_or(2);
    if let (Some(frames), Some(rate)) = (params.n_frames, params.sample_rate) {
        if generation == shared.generation.load(Ordering::Acquire) {
            if let Ok(mut state) = shared.track.write() {
                state.duration_ms = frames * 1000 / rate as u64;
            }
        }
    }
    let mut decoder = symphonia::default::get_codecs()
        .make(&params, &DecoderOptions::default())
        .map_err(|e| AppError::playback(e.to_string()))?;
    if start_ms > 0 {
        let _ = probed.format.seek(
            SeekMode::Accurate,
            SeekTo::Time {
                time: Time::from(start_ms as f64 / 1000.0),
                track_id: Some(track_id),
            },
        );
        decoder.reset();
    }
    let output_channels = shared.output_channels as usize;
    let mut resampler = if source_rate != shared.output_rate {
        Some(
            FftFixedInOut::<f32>::new(
                source_rate as usize,
                shared.output_rate as usize,
                1024,
                output_channels,
            )
            .map_err(|error| AppError::playback(error.to_string()))?,
        )
    } else {
        None
    };
    let mut pending = vec![Vec::<f32>::new(); output_channels];
    loop {
        if generation != shared.generation.load(Ordering::Acquire) {
            return Ok(());
        }
        let packet = match probed.format.next_packet() {
            Ok(packet) => packet,
            Err(symphonia::core::errors::Error::IoError(error))
                if error.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break
            }
            Err(error) => return Err(AppError::playback(error.to_string())),
        };
        if packet.track_id() != track_id {
            continue;
        }
        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(error) => return Err(AppError::playback(error.to_string())),
        };
        let mut samples = SampleBuffer::<f32>::new(decoded.capacity() as u64, *decoded.spec());
        samples.copy_interleaved_ref(decoded);
        let input = samples.samples();
        let frames = input.len() / source_channels;
        append_mapped_channels(
            input,
            frames,
            source_channels,
            output_channels,
            &mut pending,
        );

        if let Some(resampler) = resampler.as_mut() {
            while pending[0].len() >= resampler.input_frames_next() {
                let needed = resampler.input_frames_next();
                let chunk = pending
                    .iter_mut()
                    .map(|channel| channel.drain(..needed).collect::<Vec<_>>())
                    .collect::<Vec<_>>();
                let output = resampler
                    .process(&chunk, None)
                    .map_err(|error| AppError::playback(error.to_string()))?;
                if !enqueue_planar(shared, &output, generation) {
                    return Ok(());
                }
            }
        } else if !enqueue_planar(shared, &pending, generation) {
            return Ok(());
        } else {
            pending.iter_mut().for_each(Vec::clear);
        }
    }

    if let Some(resampler) = resampler.as_mut() {
        if !pending[0].is_empty() {
            let output = resampler
                .process_partial(Some(&pending), None)
                .map_err(|error| AppError::playback(error.to_string()))?;
            let _ = enqueue_planar(shared, &output, generation);
        }
    }
    Ok(())
}

fn append_mapped_channels(
    input: &[f32],
    frames: usize,
    source_channels: usize,
    output_channels: usize,
    output: &mut [Vec<f32>],
) {
    for frame in 0..frames {
        let source = &input[frame * source_channels..(frame + 1) * source_channels];
        if output_channels == 1 {
            output[0].push(source.iter().sum::<f32>() / source_channels.max(1) as f32);
        } else if source_channels == 1 {
            for channel in output.iter_mut() {
                channel.push(source[0]);
            }
        } else {
            for (channel_index, channel) in output.iter_mut().enumerate() {
                channel.push(source[channel_index.min(source_channels - 1)]);
            }
        }
    }
}

fn enqueue_planar(shared: &Shared, channels: &[Vec<f32>], generation: u64) -> bool {
    let frames = channels.first().map_or(0, Vec::len);
    for frame in 0..frames {
        for channel in channels {
            loop {
                if generation != shared.generation.load(Ordering::Acquire) {
                    return false;
                }
                if shared
                    .queue
                    .push(QueuedSample {
                        generation,
                        value: channel[frame],
                    })
                    .is_ok()
                {
                    break;
                }
                thread::sleep(Duration::from_millis(2));
            }
        }
        update_playback_readiness(shared);
    }
    true
}

fn update_playback_readiness(shared: &Shared) {
    let wants_playback = shared.play_requested.load(Ordering::Acquire);
    let buffered_enough = shared.queue.len() >= shared.prebuffer_samples;
    let decoder_finished = shared.decode_done.load(Ordering::Acquire);

    if wants_playback && (buffered_enough || (decoder_finished && !shared.queue.is_empty())) {
        shared.status.store(PLAYING, Ordering::Release);
    } else if wants_playback && decoder_finished && shared.queue.is_empty() {
        shared.play_requested.store(false, Ordering::Release);
        shared.status.store(STOPPED, Ordering::Release);
        shared
            .natural_end_generation
            .store(shared.generation.load(Ordering::Acquire), Ordering::Release);
    } else if wants_playback {
        shared.status.store(LOADING, Ordering::Release);
    } else if shared.status.load(Ordering::Acquire) == LOADING && decoder_finished {
        shared.status.store(PAUSED, Ordering::Release);
    }
}

fn spectrum_worker(shared: Arc<Shared>) {
    const FFT_SIZE: usize = 2048;
    const HOP_SIZE: usize = FFT_SIZE / 2;
    const SPECTRUM_BINS: usize = 48;

    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(FFT_SIZE);
    let mut samples = Vec::<f32>::with_capacity(FFT_SIZE * 2);
    let mut fft_buffer = vec![Complex32::new(0.0, 0.0); FFT_SIZE];
    let mut smoothed = vec![0.0f32; SPECTRUM_BINS];
    let sample_rate = shared.output_rate as f32;
    let mut generation = shared.generation.load(Ordering::Acquire);

    loop {
        let active_generation = shared.generation.load(Ordering::Acquire);
        if active_generation != generation {
            generation = active_generation;
            samples.clear();
            smoothed.fill(0.0);
        }
        while samples.len() < FFT_SIZE {
            let Some(sample) = shared.analysis_queue.pop() else {
                break;
            };
            samples.push(sample);
        }

        if samples.len() < FFT_SIZE {
            if shared.status.load(Ordering::Acquire) != PLAYING {
                for value in &mut smoothed {
                    *value = if *value < 0.004 { 0.0 } else { *value * 0.86 };
                }
                if let Ok(mut spectrum) = shared.spectrum.write() {
                    spectrum.copy_from_slice(&smoothed);
                }
            }
            thread::sleep(Duration::from_millis(16));
            continue;
        }

        for (index, output) in fft_buffer.iter_mut().enumerate() {
            let phase = index as f32 / (FFT_SIZE - 1) as f32;
            let hann = 0.5 - 0.5 * (std::f32::consts::TAU * phase).cos();
            *output = Complex32::new(samples[index] * hann, 0.0);
        }
        fft.process(&mut fft_buffer);

        let min_hz = 35.0f32;
        let max_hz = (sample_rate * 0.5).min(18_000.0).max(min_hz + 1.0);
        for (band, smoothed_value) in smoothed.iter_mut().enumerate() {
            let low_ratio = band as f32 / SPECTRUM_BINS as f32;
            let high_ratio = (band + 1) as f32 / SPECTRUM_BINS as f32;
            let low_hz = min_hz * (max_hz / min_hz).powf(low_ratio);
            let high_hz = min_hz * (max_hz / min_hz).powf(high_ratio);
            let low_index =
                ((low_hz * FFT_SIZE as f32 / sample_rate) as usize).clamp(1, FFT_SIZE / 2 - 1);
            let high_index = ((high_hz * FFT_SIZE as f32 / sample_rate).ceil() as usize)
                .clamp(low_index + 1, FFT_SIZE / 2);
            let magnitude = fft_buffer[low_index..high_index]
                .iter()
                .map(|value| value.norm())
                .fold(0.0f32, f32::max)
                / (FFT_SIZE as f32 * 0.5);
            let decibels = 20.0 * magnitude.max(1e-7).log10();
            let normalized = ((decibels + 72.0) / 72.0).clamp(0.0, 1.0);
            let smoothing = if normalized > *smoothed_value {
                0.72
            } else {
                0.16
            };
            *smoothed_value += (normalized - *smoothed_value) * smoothing;
        }

        if let Ok(mut spectrum) = shared.spectrum.write() {
            spectrum.copy_from_slice(&smoothed);
        }
        samples.drain(..HOP_SIZE);
    }
}
