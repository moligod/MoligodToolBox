// PP-OCR DB/CTC pipeline ported from the PaddleX algorithm (Apache-2.0).
// Copyright (c) 2024 PaddlePaddle Authors. See ../LICENSE.
use crate::Result;
use image::{GrayImage, Luma, RgbImage};
use imageproc::{
    contours::find_contours,
    geometric_transformations::{warp_into, Border, Interpolation, Projection},
    geometry::convex_hull,
    point::Point,
};
use ort::{session::Session, value::Tensor};
use serde::Deserialize;
use std::ops::Range;

pub(crate) const DETECTOR_SIDE: u32 = 960;
const TWO_TILE_SIDE: u32 = 2 * (DETECTOR_SIDE - 32);

// Work in detector pixels. Each core owns its scores exactly once; neighbouring
// tiles see extra context on both sides of the seam. All extents align to stride 32.
struct TileAxis {
    input: Range<u32>,
    core: Range<u32>,
}

fn detection_tiles(length: u32) -> Vec<TileAxis> {
    if length <= DETECTOR_SIDE {
        return vec![TileAxis {
            input: 0..length,
            core: 0..length,
        }];
    }
    let middle = (length / 2).next_multiple_of(32);
    // Use spare input width for context around long lines, up to three strides.
    let margin = (DETECTOR_SIDE - middle).min(96);
    vec![
        TileAxis {
            input: 0..middle + margin,
            core: 0..middle,
        },
        TileAxis {
            input: middle - margin..length,
            core: middle..length,
        },
    ]
}

#[derive(Deserialize)]
pub struct Config {
    pub characters: Vec<String>,
    pub det: Detection,
}
#[derive(Deserialize)]
pub struct Detection {
    thresh: f32,
    box_thresh: f32,
    max_candidates: usize,
    unclip_ratio: f32,
}
type Quad = [Point<f32>; 4];
pub struct Engine {
    det: Session,
    rec: Session,
    config: Config,
    fixed_shapes: bool,
}

impl Engine {
    pub fn new(det: Session, rec: Session, mut config: Config, fixed_shapes: bool) -> Result<Self> {
        if config.characters.is_empty()
            || !config.det.thresh.is_finite()
            || config.det.unclip_ratio <= 0.0
        {
            return Err("无效 OCR 配置".into());
        }
        config.characters.insert(0, String::new());
        config.characters.push(" ".into());
        Ok(Self {
            det,
            rec,
            config,
            fixed_shapes,
        })
    }
    fn detect(&mut self, image: &RgbImage, dw: u32, dh: u32) -> Result<Vec<Quad>> {
        let single = dw.max(dh) <= DETECTOR_SIDE;
        let mut merged = if single {
            Vec::new()
        } else {
            vec![0.0; (dw * dh) as usize]
        };
        let columns = detection_tiles(dw);
        for row in detection_tiles(dh) {
            for col in &columns {
                let (tw, th) = (col.input.len() as u32, row.input.len() as u32);
                let (iw, ih) = if self.fixed_shapes {
                    (DETECTOR_SIDE, DETECTOR_SIDE)
                } else {
                    (tw, th)
                };
                let input = normalized_region(
                    image,
                    (dw, dh),
                    col.input.clone(),
                    row.input.clone(),
                    (iw, ih),
                    true,
                );
                let input = Tensor::from_array(([1, 3, ih as usize, iw as usize], input))?;
                let outputs = self.det.run(ort::inputs![input])?;
                let (shape, scores) = outputs[0].try_extract_tensor::<f32>()?;
                if **shape != [1, 1, i64::from(ih), i64::from(iw)] {
                    return Err("检测模型输出尺寸无效".into());
                }
                if scores.iter().any(|score| !score.is_finite()) {
                    return Err("检测模型输出包含非有限数值".into());
                }
                if single {
                    return Ok(boxes_from_map(scores, iw, ih, &self.config.det));
                }
                for y in row.core.clone() {
                    let src =
                        ((y - row.input.start) * iw + col.core.start - col.input.start) as usize;
                    let dst = (y * dw + col.core.start) as usize;
                    let count = col.core.len();
                    merged[dst..dst + count].copy_from_slice(&scores[src..src + count]);
                }
            }
        }
        Ok(boxes_from_map(&merged, dw, dh, &self.config.det))
    }

    pub fn recognize(&mut self, image: &RgbImage) -> Result<String> {
        let (w, h) = image.dimensions();
        let long = w.max(h);
        // Fit widescreen captures in one row or column. Squarer captures need
        // four tiles to retain detail. 1696 is the stride-aligned 16:9 width at 960 high.
        let limit = if long > 1920 {
            (long * DETECTOR_SIDE / w.min(h)).clamp(1696, TWO_TILE_SIDE)
        } else {
            DETECTOR_SIDE
        };
        let ratio = (limit as f32 / long as f32).min(1.0);
        let dw = (((w as f32 * ratio).floor() / 32.0).round_ties_even() as u32 * 32).max(32);
        let dh = (((h as f32 * ratio).floor() / 32.0).round_ties_even() as u32 * 32).max(32);
        let mut boxes = self.detect(image, dw, dh)?;
        for points in &mut boxes {
            for p in points {
                p.x = (p.x * w as f32 / dw as f32)
                    .round()
                    .clamp(0.0, w.saturating_sub(1) as f32);
                p.y = (p.y * h as f32 / dh as f32)
                    .round()
                    .clamp(0.0, h.saturating_sub(1) as f32);
            }
        }
        boxes.sort_by(|a, b| a[0].y.total_cmp(&b[0].y).then(a[0].x.total_cmp(&b[0].x)));
        for i in 1..boxes.len() {
            let mut j = i;
            while j > 0
                && (boxes[j][0].y - boxes[j - 1][0].y).abs() < 10.0
                && boxes[j][0].x < boxes[j - 1][0].x
            {
                boxes.swap(j, j - 1);
                j -= 1;
            }
        }
        let mut lines = Vec::new();
        for points in boxes.into_iter().take(1000) {
            let Some(crop) = crop_quad(image, points) else {
                continue;
            };
            let ratio = crop.width() as f32 / crop.height() as f32;
            let width = if self.fixed_shapes {
                3200
            } else {
                ((48.0 * ratio).max(320.0) as u32).min(3200)
            };
            let content_width = ((48.0 * ratio).ceil() as u32).clamp(1, width);
            let input = normalized_region(
                &crop,
                (content_width, 48),
                0..content_width,
                0..48,
                (width, 48),
                false,
            );
            let outputs = self.rec.run(ort::inputs![Tensor::from_array((
                [1, 3, 48, width as usize],
                input
            ))?])?;
            let (shape, scores) = outputs[0].try_extract_tensor::<f32>()?;
            if shape.len() != 3
                || shape[0] != 1
                || shape[2] as usize != self.config.characters.len()
            {
                return Err("识别模型与字典不匹配".into());
            }
            let (text, confidence) = decode(scores, &self.config.characters)?;
            if confidence >= 0.5 && !text.is_empty() {
                lines.push(text);
            }
        }
        Ok(lines.join("\n").chars().take(4096).collect())
    }
}

// OpenCV-compatible half-pixel bilinear resize; BGR order is intentional and
// matches the official Paddle OCR input pipeline. Padding stays normalized zero.
fn normalized_region(
    image: &RgbImage,
    size: (u32, u32),
    cols: Range<u32>,
    rows: Range<u32>,
    padded: (u32, u32),
    det: bool,
) -> Vec<f32> {
    let stride = padded.0 as usize;
    let plane = stride * padded.1 as usize;
    let mut out = vec![0.0; 3 * plane];
    let means = [0.485, 0.456, 0.406];
    let stds = [0.229, 0.224, 0.225];
    for (y, sample_y) in rows.enumerate() {
        let fy = ((sample_y as f32 + 0.5) * image.height() as f32 / size.1 as f32 - 0.5).max(0.0);
        let y0 = fy.floor() as u32;
        let y1 = (y0 + 1).min(image.height() - 1);
        let ay = fy - y0 as f32;
        for (x, sample_x) in cols.clone().enumerate() {
            let fx =
                ((sample_x as f32 + 0.5) * image.width() as f32 / size.0 as f32 - 0.5).max(0.0);
            let x0 = fx.floor() as u32;
            let x1 = (x0 + 1).min(image.width() - 1);
            let ax = fx - x0 as f32;
            for c in 0..3 {
                let channel = 2 - c;
                let top = image.get_pixel(x0, y0)[channel] as f32 * (1.0 - ax)
                    + image.get_pixel(x1, y0)[channel] as f32 * ax;
                let bottom = image.get_pixel(x0, y1)[channel] as f32 * (1.0 - ax)
                    + image.get_pixel(x1, y1)[channel] as f32 * ax;
                let v = (top * (1.0 - ay) + bottom * ay).round() / 255.0;
                out[c * plane + y * stride + x] = if det {
                    (v - means[c]) / stds[c]
                } else {
                    (v - 0.5) * 2.0
                };
            }
        }
    }
    out
}

fn distance(a: Point<f32>, b: Point<f32>) -> f32 {
    (a.x - b.x).hypot(a.y - b.y)
}
fn rectangle(points: &[Point<f32>]) -> Quad {
    let hull = convex_hull(points);
    let mut best = [points[0]; 4];
    let mut area = f32::INFINITY;
    for i in 0..hull.len() {
        let a = hull[i];
        let b = hull[(i + 1) % hull.len()];
        let angle = (b.y - a.y).atan2(b.x - a.x);
        let (s, c) = angle.sin_cos();
        let (mut x0, mut y0, mut x1, mut y1) = (
            f32::INFINITY,
            f32::INFINITY,
            f32::NEG_INFINITY,
            f32::NEG_INFINITY,
        );
        for p in &hull {
            let x = p.x * c + p.y * s;
            let y = -p.x * s + p.y * c;
            x0 = x0.min(x);
            x1 = x1.max(x);
            y0 = y0.min(y);
            y1 = y1.max(y);
        }
        if (x1 - x0) * (y1 - y0) < area {
            area = (x1 - x0) * (y1 - y0);
            best = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
                .map(|(x, y)| Point::new(x * c - y * s, x * s + y * c));
        }
    }
    best.sort_by(|a, b| a.x.total_cmp(&b.x));
    if best[0].y > best[1].y {
        best.swap(0, 1);
    }
    if best[2].y > best[3].y {
        best.swap(2, 3);
    }
    [best[0], best[2], best[3], best[1]]
}
fn inside(p: Point<f32>, q: &Quad) -> bool {
    let mut positive = false;
    let mut negative = false;
    for i in 0..4 {
        let a = q[i];
        let b = q[(i + 1) % 4];
        let cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        positive |= cross > 0.01;
        negative |= cross < -0.01;
    }
    !(positive && negative)
}
fn boxes_from_map(scores: &[f32], w: u32, h: u32, cfg: &Detection) -> Vec<Quad> {
    let mask = GrayImage::from_fn(w, h, |x, y| {
        Luma([u8::from(scores[(y * w + x) as usize] > cfg.thresh)])
    });
    let contours = find_contours::<i32>(&mask);
    let mut boxes = Vec::new();
    for contour in contours
        .into_iter()
        .rev()
        .take(cfg.max_candidates.min(3000))
    {
        if contour.points.len() < 4 {
            continue;
        }
        let points: Vec<_> = contour
            .points
            .iter()
            .map(|p| Point::new(p.x as f32, p.y as f32))
            .collect();
        let mut q = rectangle(&points);
        let bw = distance(q[0], q[1]);
        let bh = distance(q[0], q[3]);
        if bw.min(bh) < 3.0 {
            continue;
        }
        let xmin = q
            .iter()
            .map(|p| p.x.floor().max(0.0) as u32)
            .min()
            .unwrap()
            .min(w - 1);
        let xmax = q
            .iter()
            .map(|p| p.x.ceil().max(0.0) as u32)
            .max()
            .unwrap()
            .min(w - 1);
        let ymin = q
            .iter()
            .map(|p| p.y.floor().max(0.0) as u32)
            .min()
            .unwrap()
            .min(h - 1);
        let ymax = q
            .iter()
            .map(|p| p.y.ceil().max(0.0) as u32)
            .max()
            .unwrap()
            .min(h - 1);
        let mut sum = 0.0;
        let mut count = 0;
        for y in ymin..=ymax {
            for x in xmin..=xmax {
                if inside(Point::new(x as f32, y as f32), &q) {
                    sum += scores[(y * w + x) as usize];
                    count += 1;
                }
            }
        }
        if count == 0 || sum / (count as f32) < cfg.box_thresh {
            continue;
        }
        // DB unclip starts with a rectangle. The minimum rectangle of its round
        // offset expands each edge by area * ratio / perimeter; no Clipper DLL.
        let d = bw * bh * cfg.unclip_ratio / (2.0 * (bw + bh));
        let ux = (q[1].x - q[0].x) / bw;
        let uy = (q[1].y - q[0].y) / bw;
        let vx = (q[3].x - q[0].x) / bh;
        let vy = (q[3].y - q[0].y) / bh;
        for (p, (sx, sy)) in q
            .iter_mut()
            .zip([(-1.0, -1.0), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)])
        {
            p.x += d * (sx * ux + sy * vx);
            p.y += d * (sx * uy + sy * vy);
        }
        if (bw + 2.0 * d).min(bh + 2.0 * d) >= 5.0 {
            boxes.push(q);
        }
    }
    boxes
}
fn crop_quad(image: &RgbImage, q: Quad) -> Option<RgbImage> {
    let w = distance(q[0], q[1]).max(distance(q[2], q[3])) as u32;
    let h = distance(q[0], q[3]).max(distance(q[1], q[2])) as u32;
    if w == 0 || h == 0 {
        return None;
    }
    let transform = Projection::from_control_points(
        q.map(|p| (p.x, p.y)),
        [
            (0.0, 0.0),
            (w as f32, 0.0),
            (w as f32, h as f32),
            (0.0, h as f32),
        ],
    )?;
    let mut crop = RgbImage::new(w, h);
    warp_into(
        image,
        transform,
        Interpolation::Bicubic,
        Border::Replicate,
        &mut crop,
    );
    if h as f32 / w as f32 >= 1.5 {
        crop = image::imageops::rotate270(&crop);
    }
    Some(crop)
}
fn decode(scores: &[f32], chars: &[String]) -> Result<(String, f32)> {
    if chars.is_empty() || !scores.len().is_multiple_of(chars.len()) {
        return Err("CTC 输出尺寸无效".into());
    }
    let mut last = usize::MAX;
    let mut sum = 0.0;
    let mut count = 0;
    let mut text = String::new();
    for step in scores.chunks_exact(chars.len()) {
        let (index, &score) = step
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(b.1))
            .ok_or("空 CTC 输出")?;
        if !score.is_finite() {
            return Err("CTC 输出包含非有限数值".into());
        }
        if index != 0 && index != last {
            text.push_str(&chars[index]);
            sum += score;
            count += 1;
        }
        last = index;
    }
    Ok((text, if count == 0 { 0.0 } else { sum / count as f32 }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgb;

    #[test]
    fn tile_cores_cover_the_map_and_fit_the_detector_with_context() {
        for length in (32..=TWO_TILE_SIDE).step_by(32) {
            let tiles = detection_tiles(length);
            let mut next = 0;
            for tile in &tiles {
                assert_eq!(tile.core.start, next);
                assert!(tile.input.contains(&tile.core.start));
                assert!(tile.input.end >= tile.core.end && tile.input.end <= length);
                assert!(tile.input.len() <= DETECTOR_SIDE as usize);
                assert_eq!(tile.input.len() % 32, 0);
                next = tile.core.end;
            }
            assert_eq!(next, length);
            if let [left, right] = tiles.as_slice() {
                assert!((64..=192).contains(&(left.input.end - right.input.start)));
            }
        }
    }

    #[test]
    fn tiles_sample_the_same_pixels_as_the_full_map_and_zero_both_padding_axes() {
        let image = RgbImage::from_fn(11, 9, |x, y| Rgb([x as u8, y as u8, (x * y) as u8]));
        let full = normalized_region(&image, (8, 6), 0..8, 0..6, (8, 6), true);
        let tile = normalized_region(&image, (8, 6), 2..7, 3..5, (8, 4), true);
        for channel in 0..3 {
            for y in 0..4 {
                for x in 0..8 {
                    let expected = if y < 2 && x < 5 {
                        full[channel * 48 + (3 + y) * 8 + 2 + x]
                    } else {
                        0.0
                    };
                    assert_eq!(tile[channel * 32 + y * 8 + x], expected);
                }
            }
        }
    }
    #[test]
    fn ctc_blank_separates_repeated_characters() {
        let chars = vec!["".into(), "中".into(), "A".into()];
        let (text, score) = decode(
            &[0., 1., 0., 0., 1., 0., 1., 0., 0., 0., 1., 0., 0., 0., 1.],
            &chars,
        )
        .unwrap();
        assert_eq!(text, "中中A");
        assert_eq!(score, 1.0);
    }
    #[test]
    fn normalization_keeps_bgr_and_zero_padding() {
        let img = RgbImage::from_pixel(1, 1, Rgb([255, 128, 0]));
        let v = normalized_region(&img, (1, 1), 0..1, 0..1, (2, 1), false);
        assert_eq!(v[0], -1.0);
        assert_eq!(v[4], 1.0);
        assert_eq!(v[1], 0.0);
        assert_eq!(v[3], 0.0);
    }
    #[test]
    fn db_recovers_rectangle_and_rejects_blank() {
        let cfg = Detection {
            thresh: 0.2,
            box_thresh: 0.45,
            max_candidates: 1000,
            unclip_ratio: 1.4,
        };
        let mut scores = vec![0.0; 100 * 50];
        for y in 15..30 {
            for x in 20..80 {
                scores[y * 100 + x] = 0.9;
            }
        }
        let boxes = boxes_from_map(&scores, 100, 50, &cfg);
        assert_eq!(boxes.len(), 1);
        assert!(boxes[0][0].x < 20.0);
        assert!(boxes[0][2].y > 29.0);
        assert!(boxes_from_map(&vec![0.0; 5000], 100, 50, &cfg).is_empty());
    }
}
