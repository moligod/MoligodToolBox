use crate::model::Region;
use image::RgbaImage;
use std::time::{SystemTime, UNIX_EPOCH};

/// One full-resolution manual preview, released with the module or replaced on refresh.
#[derive(Default)]
pub struct PreviewFrame {
    frame: Option<(String, RgbaImage)>,
    revision: u64,
}
impl PreviewFrame {
    pub fn replace(&mut self, image: RgbaImage) -> Result<String, String> {
        if image.width() == 0
            || image.height() == 0
            || u64::from(image.width()) * u64::from(image.height()) > 16_000_000
        {
            return Err("预览图片尺寸无效或过大".into());
        }
        self.revision += 1;
        let id = format!(
            "{}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos(),
            self.revision
        );
        self.frame = Some((id.clone(), image));
        Ok(id)
    }
    /// Drop the frame when the editor closes while tasks keep the module running.
    pub fn clear(&mut self) {
        self.frame = None;
    }
    pub fn crop(&self, snapshot: &str, region: Region) -> Result<RgbaImage, String> {
        let (_, image) = self
            .frame
            .as_ref()
            .filter(|(id, _)| id == snapshot)
            .ok_or("预览截图已失效，请刷新截图后重试")?;
        if region.x < 0
            || region.y < 0
            || region.width == 0
            || region.height == 0
            || region.x as u64 + u64::from(region.width) > u64::from(image.width())
            || region.y as u64 + u64::from(region.height) > u64::from(image.height())
        {
            return Err("识别区域超出预览截图".into());
        }
        Ok(image::imageops::crop_imm(
            image,
            region.x as u32,
            region.y as u32,
            region.width,
            region.height,
        )
        .to_image())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;
    #[test]
    fn ocr_region_uses_displayed_frame_until_explicit_refresh() {
        let mut old = RgbaImage::from_pixel(300, 200, Rgba([0, 0, 0, 255]));
        for x in 120..180 {
            for y in 60..90 {
                old.put_pixel(x, y, Rgba([10, 20, 30, 255]));
            }
        }
        let region = Region {
            x: 120,
            y: 60,
            width: 60,
            height: 30,
        };
        let mut preview = PreviewFrame::default();
        let first = preview.replace(old).unwrap();
        let live = RgbaImage::from_pixel(300, 200, Rgba([255, 255, 255, 255]));
        assert!(preview
            .crop(&first, region)
            .unwrap()
            .pixels()
            .all(|p| p.0 == [10, 20, 30, 255]));
        let second = preview.replace(live).unwrap();
        assert!(preview.crop(&first, region).unwrap_err().contains("失效"));
        assert!(preview
            .crop(&second, region)
            .unwrap()
            .pixels()
            .all(|p| p.0 == [255, 255, 255, 255]));
        for bad in [
            Region { x: -1, ..region },
            Region { x: 299, ..region },
            Region {
                height: 0,
                ..region
            },
        ] {
            assert!(preview.crop(&second, bad).is_err());
        }
    }
}
