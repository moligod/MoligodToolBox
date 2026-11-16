use image::{ImageReader, RgbaImage};
use moligod_core::config::{Crosshair, CrosshairStyle};
use sha2::{Digest, Sha256};
use std::{
    io::{Cursor, Read, Write},
    path::Path,
};

pub const MAX_IMAGE_BYTES: usize = 8 * 1024 * 1024;
const MAX_ASSET_BYTES: usize = 80 * 1024 * 1024;
const MAX_RENDER_WORKING_BYTES: u64 = 256 * 1024 * 1024;

/// Small RGBA buffer used by both native rendering and image import validation.
pub fn raster(config: &Crosshair, directory: &Path) -> Result<RgbaImage, String> {
    config.validate()?;
    if config.style == CrosshairStyle::Image {
        let id = config.image_id.as_ref().ok_or("请先选择准星图片")?;
        let source = load_asset(id, directory)?;
        let w = (source.width() * u32::from(config.image_scale) / 100).max(1);
        let h = (source.height() * u32::from(config.image_scale) / 100).max(1);
        // Account for source/premultiplication, resize intermediate, result, BGRA and DIB.
        let estimate = u64::from(source.width()) * u64::from(source.height()) * 8
            + u64::from(w) * u64::from(source.height()) * 16
            + u64::from(w) * u64::from(h) * 12;
        if estimate > MAX_RENDER_WORKING_BYTES {
            return Err("图片缩放预计占用过多内存，请降低缩放比例".into());
        }
        let mut result = resize_alpha(&source, w, h);
        for pixel in result.pixels_mut() {
            pixel[3] = (u16::from(pixel[3]) * u16::from(config.opacity) / 100) as u8;
        }
        return Ok(result);
    }
    let side = u32::from(config.size + u16::from(config.gap) + 2 * u16::from(config.thickness))
        .max(u32::from(config.dot_size))
        + 4;
    let mut result = RgbaImage::new(side, side);
    let color = u32::from_str_radix(&config.color[1..], 16).map_err(|_| "无效颜色")?;
    let rgb = [(color >> 16) as u8, (color >> 8) as u8, color as u8];
    let center = side as f32 / 2.0;
    let half_width = f32::from(config.thickness) / 2.0;
    let radius = f32::from(config.size) / 2.0;
    let gap = f32::from(config.gap) / 2.0;
    for (x, y, pixel) in result.enumerate_pixels_mut() {
        // Four samples/pixel give circles anti-aliased edges, only on configuration changes.
        let mut hits = 0;
        for (sx, sy) in [(0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)] {
            let dx = (x as f32 + sx - center).abs();
            let dy = (y as f32 + sy - center).abs();
            let distance = (dx * dx + dy * dy).sqrt();
            let cross = (dx <= half_width && dy >= gap && dy <= gap + radius)
                || (dy <= half_width && dx >= gap && dx <= gap + radius);
            let dot = distance <= f32::from(config.dot_size) / 2.0;
            let hit = match config.style {
                CrosshairStyle::Cross => cross,
                CrosshairStyle::Dot => dot,
                CrosshairStyle::Circle => (distance - radius).abs() <= half_width,
                CrosshairStyle::Image => false,
            };
            if hit {
                hits += 1;
            }
        }
        *pixel = image::Rgba([
            rgb[0],
            rgb[1],
            rgb[2],
            (hits * 255 * u32::from(config.opacity) / 400) as u8,
        ]);
    }
    Ok(result)
}

fn decode(bytes: &[u8]) -> Result<RgbaImage, String> {
    let mut reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|e| e.to_string())?;
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(4096);
    limits.max_image_height = Some(4096);
    limits.max_alloc = Some(80 * 1024 * 1024);
    reader.limits(limits);
    reader
        .decode()
        .map(|image| image.into_rgba8())
        .map_err(|e| format!("无法读取图片：{e}"))
}

/// Validate, crop alpha margins, and persist an immutable, content-addressed PNG.
pub fn import_image(bytes: &[u8], directory: &Path) -> Result<String, String> {
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err("图片不能超过 8 MiB".into());
    }
    let source = decode(bytes)?;
    let mut bounds = (source.width(), source.height(), 0, 0);
    let mut found = false;
    for (x, y, pixel) in source.enumerate_pixels() {
        if pixel[3] > 0 {
            found = true;
            bounds = (
                bounds.0.min(x),
                bounds.1.min(y),
                bounds.2.max(x),
                bounds.3.max(y),
            );
        }
    }
    if !found {
        return Err("图片完全透明，请选择可见的准星图片".into());
    }
    let cropped = image::imageops::crop_imm(
        &source,
        bounds.0,
        bounds.1,
        bounds.2 - bounds.0 + 1,
        bounds.3 - bounds.1 + 1,
    )
    .to_image();
    let mut output = Cursor::new(Vec::new());
    cropped
        .write_to(&mut output, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    let output = output.into_inner();
    if output.len() > MAX_ASSET_BYTES {
        return Err("图片解码后的数据过大".into());
    }
    let id = format!("{:x}", Sha256::digest(&output));
    std::fs::create_dir_all(directory).map_err(|e| e.to_string())?;
    let path = directory.join(format!("{id}.png"));
    if !path.exists() {
        let mut file = tempfile::NamedTempFile::new_in(directory).map_err(|e| e.to_string())?;
        file.write_all(&output).map_err(|e| e.to_string())?;
        file.as_file().sync_all().map_err(|e| e.to_string())?;
        file.persist(&path).map_err(|e| e.to_string())?;
    }
    Ok(id)
}

fn load_asset(id: &str, directory: &Path) -> Result<RgbaImage, String> {
    if id.len() != 64 || !id.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("图片标识无效".into());
    }
    let file = std::fs::File::open(directory.join(format!("{id}.png")))
        .map_err(|_| "准星图片不存在，请重新选择")?;
    let mut bytes = Vec::new();
    file.take(MAX_ASSET_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > MAX_ASSET_BYTES {
        return Err("图片数据过大".into());
    }
    decode(&bytes)
}

/// Filter premultiplied colors, never the arbitrary RGB of transparent pixels.
/// Return straight RGBA; the native BGRA conversion will premultiply exactly once.
fn resize_alpha(source: &RgbaImage, width: u32, height: u32) -> RgbaImage {
    if source.dimensions() == (width, height) {
        return source.clone();
    }
    let mut premultiplied = source.clone();
    for pixel in premultiplied.pixels_mut() {
        for channel in 0..3 {
            pixel[channel] = (u16::from(pixel[channel]) * u16::from(pixel[3]) / 255) as u8;
        }
    }
    let mut result = image::imageops::resize(
        &premultiplied,
        width,
        height,
        image::imageops::FilterType::Lanczos3,
    );
    for pixel in result.pixels_mut() {
        if pixel[3] == 0 {
            *pixel = image::Rgba([0, 0, 0, 0]);
        } else {
            for channel in 0..3 {
                pixel[channel] = ((u16::from(pixel[channel]) * 255 + u16::from(pixel[3]) / 2)
                    / u16::from(pixel[3]))
                .min(255) as u8;
            }
        }
    }
    result
}

/// Send a bounded thumbnail to the editor, not a multi-megabyte JSON pixel payload.
pub fn preview_png(id: &str, directory: &Path) -> Result<Vec<u8>, String> {
    let source = load_asset(id, directory)?;
    let factor = (512.0 / source.width() as f64)
        .min(512.0 / source.height() as f64)
        .min(1.0);
    let preview = resize_alpha(
        &source,
        (source.width() as f64 * factor).round().max(1.0) as u32,
        (source.height() as f64 * factor).round().max(1.0) as u32,
    );
    let mut out = Cursor::new(Vec::new());
    preview
        .write_to(&mut out, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(out.into_inner())
}

/// Premultiplied BGRA for UpdateLayeredWindow, including translucent edges.
pub fn bgra(image: &RgbaImage) -> Vec<u8> {
    image
        .pixels()
        .flat_map(|p| {
            let multiply = |c: u8| (u16::from(c) * u16::from(p[3]) / 255) as u8;
            [multiply(p[2]), multiply(p[1]), multiply(p[0]), p[3]]
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn png(image: &RgbaImage) -> Vec<u8> {
        let mut out = Cursor::new(Vec::new());
        image.write_to(&mut out, image::ImageFormat::Png).unwrap();
        out.into_inner()
    }
    #[test]
    fn scaled_white_edges_do_not_pick_up_transparent_black() {
        let dir = tempfile::tempdir().unwrap();
        let mut image = RgbaImage::from_pixel(3, 1, image::Rgba([255, 255, 255, 255]));
        image.put_pixel(1, 0, image::Rgba([0, 0, 0, 0]));
        let id = import_image(&png(&image), dir.path()).unwrap();
        let config = Crosshair {
            style: CrosshairStyle::Image,
            image_id: Some(id),
            image_scale: 200,
            opacity: 50,
            ..Crosshair::default()
        };
        let result = raster(&config, dir.path()).unwrap();
        for pixel in result.pixels().filter(|pixel| pixel[3] > 0) {
            assert_eq!(
                &pixel.0[..3],
                &[255, 255, 255],
                "transparent black contaminated an edge"
            );
        }
        for pixel in bgra(&result).chunks_exact(4) {
            assert_eq!(pixel[0], pixel[3]);
        }
    }
    #[test]
    fn imports_and_scales_images_larger_than_512() {
        let dir = tempfile::tempdir().unwrap();
        let image = RgbaImage::from_pixel(700, 600, image::Rgba([255, 0, 0, 255]));
        let id = import_image(&png(&image), dir.path()).unwrap();
        let result = raster(
            &Crosshair {
                style: CrosshairStyle::Image,
                image_id: Some(id),
                image_scale: 200,
                ..Crosshair::default()
            },
            dir.path(),
        )
        .unwrap();
        assert_eq!(result.dimensions(), (1400, 1200));
    }
    #[test]
    fn gap_and_alpha_survive_native_conversion() {
        let c = Crosshair::default();
        let result = raster(&c, Path::new(".")).unwrap();
        assert_eq!(
            result.get_pixel(result.width() / 2, result.height() / 2)[3],
            0
        );
        assert!(result.pixels().any(|p| p[3] > 0));
        let image = RgbaImage::from_pixel(1, 1, image::Rgba([200, 100, 50, 128]));
        assert_eq!(bgra(&image), [25, 50, 100, 128]);
    }
    #[test]
    fn image_import_crops_and_rejects_invisible_content() {
        let dir = tempfile::tempdir().unwrap();
        let mut image = RgbaImage::new(80, 80);
        let encode = |img: &RgbaImage| {
            let mut out = Cursor::new(Vec::new());
            img.write_to(&mut out, image::ImageFormat::Png).unwrap();
            out.into_inner()
        };
        assert!(import_image(&encode(&image), dir.path()).is_err());
        image.put_pixel(40, 40, image::Rgba([255, 0, 0, 255]));
        let id = import_image(&encode(&image), dir.path()).unwrap();
        let config = Crosshair {
            style: CrosshairStyle::Image,
            image_id: Some(id),
            ..Crosshair::default()
        };
        let rendered = raster(&config, dir.path()).unwrap();
        assert_eq!(rendered.dimensions(), (1, 1));
        assert!(import_image(b"not an image", dir.path()).is_err());
    }
}
