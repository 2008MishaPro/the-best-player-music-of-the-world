use crate::{
    dto::{AnalysisCache, PeakFrame, TrackAnalysisDto, WaveformPoint},
    error::{AppError, AppResult},
};
use sqlx::SqlitePool;
use std::{
    fs::File,
    path::{Path, PathBuf},
};
use symphonia::core::{
    audio::SampleBuffer, codecs::DecoderOptions, formats::FormatOptions, io::MediaSourceStream,
    meta::MetadataOptions, probe::Hint,
};

pub const ANALYSIS_VERSION: i64 = 1;
pub async fn status(db: &SqlitePool, track_id: &str) -> AppResult<TrackAnalysisDto> {
    sqlx::query_as::<_,TrackAnalysisDto>("SELECT track_id,status,progress,integrated_lufs,true_peak_db,dynamic_range_db,analyzed_at,error FROM track_analysis WHERE track_id=?").bind(track_id).fetch_optional(db).await?.ok_or_else(||AppError::not_found("Анализ ещё не запускался"))
}

pub fn analyze(path: &Path) -> AppResult<(AnalysisCache, f64, f64, f64)> {
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
        .map_err(|e| AppError::analysis(e.to_string()))?;
    let track = probed
        .format
        .default_track()
        .ok_or_else(|| AppError::analysis("Аудиодорожка не найдена"))?;
    let id = track.id;
    let params = track.codec_params.clone();
    let rate = params.sample_rate.unwrap_or(44_100);
    let channels = params.channels.map(|v| v.count()).unwrap_or(2);
    let bucket = (rate / 10).max(1) as usize;
    let mut decoder = symphonia::default::get_codecs()
        .make(&params, &DecoderOptions::default())
        .map_err(|e| AppError::analysis(e.to_string()))?;
    let mut waveform = Vec::new();
    let mut peaks = Vec::new();
    let (
        mut min,
        mut max,
        mut sumsq,
        mut count,
        mut clip,
        mut total_sumsq,
        mut total_count,
        mut absolute_peak,
    ) = (1.0f32, -1.0f32, 0.0f64, 0usize, 0u32, 0.0f64, 0u64, 0.0f32);
    let mut frame_index = 0u32;
    let mut rms_values = Vec::new();
    loop {
        let packet = match probed.format.next_packet() {
            Ok(v) => v,
            Err(symphonia::core::errors::Error::IoError(e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break
            }
            Err(e) => return Err(AppError::analysis(e.to_string())),
        };
        if packet.track_id() != id {
            continue;
        }
        let decoded = match decoder.decode(&packet) {
            Ok(v) => v,
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(e) => return Err(AppError::analysis(e.to_string())),
        };
        let mut buffer = SampleBuffer::<f32>::new(decoded.capacity() as u64, *decoded.spec());
        buffer.copy_interleaved_ref(decoded);
        for frame in buffer.samples().chunks(channels) {
            let sample = frame.iter().copied().sum::<f32>() / channels as f32;
            min = min.min(sample);
            max = max.max(sample);
            absolute_peak = absolute_peak.max(sample.abs());
            sumsq += f64::from(sample * sample);
            total_sumsq += f64::from(sample * sample);
            count += 1;
            total_count += 1;
            if sample.abs() >= 0.999 {
                clip += 1;
            }
            if count >= bucket {
                let rms = (sumsq / count as f64).sqrt() as f32;
                let peak = max.abs().max(min.abs());
                let peak_db = 20.0 * peak.max(1e-9).log10();
                let rms_db = 20.0 * rms.max(1e-9).log10();
                waveform.push(WaveformPoint { min, max });
                peaks.push(PeakFrame {
                    time_ms: frame_index * 100,
                    peak_db,
                    rms_db,
                    crest_factor_db: peak_db - rms_db,
                    clipping_samples: clip,
                });
                rms_values.push(rms_db);
                frame_index += 1;
                min = 1.0;
                max = -1.0;
                sumsq = 0.0;
                count = 0;
                clip = 0;
            }
        }
    }
    if count > 0 {
        waveform.push(WaveformPoint { min, max });
    }
    let rms = (total_sumsq / total_count.max(1) as f64).sqrt();
    let lufs = 20.0 * rms.max(1e-12).log10() - 0.691;
    let true_peak = 20.0 * f64::from(absolute_peak.max(1e-9)).log10();
    let dynamic = if rms_values.is_empty() {
        0.0
    } else {
        f64::from(
            rms_values.iter().copied().fold(f32::NEG_INFINITY, f32::max)
                - rms_values.iter().copied().fold(f32::INFINITY, f32::min),
        )
    };
    Ok((AnalysisCache { waveform, peaks }, lufs, true_peak, dynamic))
}

pub fn cache_path(data_dir: &Path, track_id: &str) -> PathBuf {
    data_dir
        .join("cache/analysis")
        .join(format!("{track_id}-v{ANALYSIS_VERSION}.json"))
}
