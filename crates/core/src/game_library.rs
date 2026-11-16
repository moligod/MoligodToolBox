//! Versioned, framework-independent game catalogue data.
//!
//! Image values deliberately remain bounded data URLs.  They never identify a
//! filesystem path or a remote resource, so displaying a library does not
//! create a network or arbitrary-file capability.
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

pub const GAME_LIBRARY_VERSION: u32 = 1;
pub const MAX_GAMES: usize = 100;
pub const MAX_SCREENSHOTS: usize = 6;
/// Maximum decoded size of a single cover, hero image, or screenshot.
pub const MAX_IMAGE_BYTES: usize = 1_572_864;
/// Maximum combined encoded image data in a library and on-disk JSON size.
pub const MAX_LIBRARY_ENCODED_BYTES: usize = 25_165_824;

const MAX_ID_CHARS: usize = 64;
const MAX_TITLE_CHARS: usize = 120;
const MAX_SUBTITLE_CHARS: usize = 200;
const MAX_DESCRIPTION_CHARS: usize = 10_000;
const MAX_CREDIT_CHARS: usize = 120;
const MAX_PLATFORMS: usize = 12;
const MAX_PLATFORM_CHARS: usize = 48;
const MAX_TAGS: usize = 24;
const MAX_TAG_CHARS: usize = 32;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GameStatus {
    Draft,
    Published,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Game {
    pub id: String,
    pub title: String,
    pub subtitle: String,
    pub description: String,
    pub developer: String,
    pub publisher: String,
    pub release_date: String,
    pub platforms: Vec<String>,
    pub tags: Vec<String>,
    pub cover: String,
    pub hero: String,
    pub screenshots: Vec<String>,
    pub status: GameStatus,
    pub featured: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GameLibrary {
    pub schema_version: u32,
    pub games: Vec<Game>,
}

impl Default for GameLibrary {
    fn default() -> Self {
        Self {
            schema_version: GAME_LIBRARY_VERSION,
            games: Vec::new(),
        }
    }
}

impl GameLibrary {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version != GAME_LIBRARY_VERSION {
            return Err("不支持的游戏资料库版本，原文件已保留".into());
        }
        if self.games.len() > MAX_GAMES {
            return Err(format!("游戏数量不能超过 {MAX_GAMES}"));
        }

        let mut ids = BTreeSet::new();
        let mut image_bytes = 0_usize;
        for game in &self.games {
            game.validate()?;
            if !ids.insert(&game.id) {
                return Err("游戏标识不能重复".into());
            }
            image_bytes = image_bytes
                .checked_add(game.encoded_image_bytes()?)
                .ok_or("游戏图片数据过大")?;
            if image_bytes > MAX_LIBRARY_ENCODED_BYTES {
                return Err("游戏图片总大小超过 24 MiB".into());
            }
        }
        Ok(())
    }
}

impl Game {
    pub fn validate(&self) -> Result<(), String> {
        validate_id(&self.id)?;
        validate_text(&self.title, "游戏标题", 1, MAX_TITLE_CHARS)?;
        validate_text(&self.subtitle, "副标题", 0, MAX_SUBTITLE_CHARS)?;
        validate_description(&self.description)?;
        validate_text(&self.developer, "开发商", 0, MAX_CREDIT_CHARS)?;
        validate_text(&self.publisher, "发行商", 0, MAX_CREDIT_CHARS)?;
        if !self.release_date.is_empty() && !valid_date(&self.release_date) {
            return Err("发行日期必须为空或 YYYY-MM-DD".into());
        }
        validate_words(&self.platforms, "平台", MAX_PLATFORMS, MAX_PLATFORM_CHARS)?;
        validate_words(&self.tags, "标签", MAX_TAGS, MAX_TAG_CHARS)?;
        if self.screenshots.len() > MAX_SCREENSHOTS {
            return Err(format!("游戏截图不能超过 {MAX_SCREENSHOTS} 张"));
        }
        self.encoded_image_bytes()?;
        if !valid_utc_timestamp(&self.created_at) || !valid_utc_timestamp(&self.updated_at) {
            return Err("创建和更新时间必须为 UTC ISO 8601 时间".into());
        }
        if self.status == GameStatus::Published
            && (self.subtitle.trim().is_empty()
                || self.platforms.is_empty()
                || self.cover.is_empty())
        {
            return Err("发布游戏需要副标题、平台和封面".into());
        }
        Ok(())
    }

    fn encoded_image_bytes(&self) -> Result<usize, String> {
        let mut total = validate_image_data_url(&self.cover)?;
        total = total
            .checked_add(validate_image_data_url(&self.hero)?)
            .ok_or("游戏图片数据过大")?;
        for image in &self.screenshots {
            total = total
                .checked_add(validate_image_data_url(image)?)
                .ok_or("游戏图片数据过大")?;
        }
        Ok(total)
    }
}

fn validate_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > MAX_ID_CHARS
        || !id.is_ascii()
        || !id.as_bytes()[0].is_ascii_alphanumeric()
        || !id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(
            "游戏标识必须为 1-64 位 ASCII 字母、数字、连字符或下划线，且以字母或数字开头".into(),
        );
    }
    Ok(())
}

fn validate_text(value: &str, name: &str, minimum: usize, maximum: usize) -> Result<(), String> {
    let length = value.chars().count();
    if length < minimum || length > maximum || value.chars().any(char::is_control) {
        return Err(format!("{name} 长度或字符无效"));
    }
    if minimum > 0 && value.trim().is_empty() {
        return Err(format!("{name} 不能为空"));
    }
    Ok(())
}

fn validate_description(value: &str) -> Result<(), String> {
    let length = value.chars().count();
    if length > MAX_DESCRIPTION_CHARS
        || value
            .chars()
            .any(|character| character.is_control() && !matches!(character, '\r' | '\n' | '\t'))
    {
        return Err("游戏简介长度或字符无效".into());
    }
    Ok(())
}

fn validate_words(
    words: &[String],
    name: &str,
    maximum_count: usize,
    maximum_length: usize,
) -> Result<(), String> {
    if words.len() > maximum_count {
        return Err(format!("{name}数量超过限制"));
    }
    let mut distinct = BTreeSet::new();
    for word in words {
        validate_text(word, name, 1, maximum_length)?;
        if !distinct.insert(word) {
            return Err(format!("{name}不能重复"));
        }
    }
    Ok(())
}

fn validate_image_data_url(data_url: &str) -> Result<usize, String> {
    if data_url.is_empty() {
        return Ok(0);
    }
    let (format, payload) = if let Some(payload) = data_url.strip_prefix("data:image/png;base64,") {
        (ImageFormat::Png, payload)
    } else if let Some(payload) = data_url.strip_prefix("data:image/jpeg;base64,") {
        (ImageFormat::Jpeg, payload)
    } else if let Some(payload) = data_url.strip_prefix("data:image/webp;base64,") {
        (ImageFormat::Webp, payload)
    } else {
        return Err("图片只能使用 PNG、JPEG 或 WebP data URL".into());
    };

    let decoded_size = base64_decoded_size(payload)?;
    if decoded_size > MAX_IMAGE_BYTES {
        return Err("单张游戏图片超过 1.5 MiB".into());
    }

    let mut prefix = [0_u8; 12];
    let prefix_len = decode_base64_prefix(payload, &mut prefix);
    let has_matching_header = match format {
        ImageFormat::Png => {
            prefix_len >= 8 && prefix[..8] == [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]
        }
        ImageFormat::Jpeg => prefix_len >= 3 && prefix[..3] == [0xff, 0xd8, 0xff],
        ImageFormat::Webp => {
            prefix_len >= 12 && prefix[..4] == *b"RIFF" && prefix[8..12] == *b"WEBP"
        }
    };
    if !has_matching_header {
        return Err("图片内容与声明格式不匹配".into());
    }
    Ok(data_url.len())
}

#[derive(Clone, Copy)]
enum ImageFormat {
    Png,
    Jpeg,
    Webp,
}

fn base64_decoded_size(payload: &str) -> Result<usize, String> {
    let bytes = payload.as_bytes();
    if bytes.is_empty() || !bytes.len().is_multiple_of(4) {
        return Err("图片 data URL 的 Base64 编码无效".into());
    }
    let padding = bytes.iter().rev().take_while(|byte| **byte == b'=').count();
    if padding > 2
        || (padding == 1 && (bytes.len() - 1) % 4 != 3)
        || (padding == 2 && (bytes.len() - 2) % 4 != 2)
    {
        return Err("图片 data URL 的 Base64 编码无效".into());
    }
    let content_len = bytes.len() - padding;
    if bytes[..content_len]
        .iter()
        .any(|byte| base64_value(*byte).is_none())
        || bytes[content_len..].iter().any(|byte| *byte != b'=')
    {
        return Err("图片 data URL 的 Base64 编码无效".into());
    }
    bytes
        .len()
        .checked_div(4)
        .and_then(|groups| groups.checked_mul(3))
        .and_then(|size| size.checked_sub(padding))
        .ok_or_else(|| "图片 data URL 的 Base64 编码无效".into())
}

fn base64_value(byte: u8) -> Option<u8> {
    match byte {
        b'A'..=b'Z' => Some(byte - b'A'),
        b'a'..=b'z' => Some(byte - b'a' + 26),
        b'0'..=b'9' => Some(byte - b'0' + 52),
        b'+' => Some(62),
        b'/' => Some(63),
        _ => None,
    }
}

fn decode_base64_prefix(payload: &str, output: &mut [u8]) -> usize {
    let mut written = 0;
    for group in payload.as_bytes().chunks_exact(4) {
        let a = base64_value(group[0]).expect("validated Base64");
        let b = base64_value(group[1]).expect("validated Base64");
        let c = if group[2] == b'=' {
            0
        } else {
            base64_value(group[2]).expect("validated Base64")
        };
        let d = if group[3] == b'=' {
            0
        } else {
            base64_value(group[3]).expect("validated Base64")
        };
        for byte in [(a << 2) | (b >> 4), (b << 4) | (c >> 2), (c << 6) | d]
            .into_iter()
            .take(if group[2] == b'=' {
                1
            } else if group[3] == b'=' {
                2
            } else {
                3
            })
        {
            if written == output.len() {
                return written;
            }
            output[written] = byte;
            written += 1;
        }
    }
    written
}

fn valid_date(value: &str) -> bool {
    valid_date_bytes(value.as_bytes())
}

fn valid_date_bytes(bytes: &[u8]) -> bool {
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return false;
    }
    let Some(year) = decimal(&bytes[0..4]) else {
        return false;
    };
    let Some(month) = decimal(&bytes[5..7]) else {
        return false;
    };
    let Some(day) = decimal(&bytes[8..10]) else {
        return false;
    };
    valid_date_parts(year, month, day)
}

fn valid_utc_timestamp(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() < 20
        || bytes.len() > 30
        || bytes.get(10) != Some(&b'T')
        || bytes.get(13) != Some(&b':')
        || bytes.get(16) != Some(&b':')
        || !valid_date_bytes(&bytes[..10])
    {
        return false;
    }
    let (Some(hour), Some(minute), Some(second)) = (
        decimal(&bytes[11..13]),
        decimal(&bytes[14..16]),
        decimal(&bytes[17..19]),
    ) else {
        return false;
    };
    if hour > 23 || minute > 59 || second > 59 {
        return false;
    }
    match bytes.get(19) {
        Some(b'Z') => bytes.len() == 20,
        Some(b'.') => {
            let Some(last) = bytes.last() else {
                return false;
            };
            *last == b'Z'
                && (21..=29).contains(&bytes.len())
                && bytes[20..bytes.len() - 1].iter().all(u8::is_ascii_digit)
        }
        _ => false,
    }
}

fn decimal(bytes: &[u8]) -> Option<u32> {
    bytes.iter().try_fold(0_u32, |value, byte| {
        byte.is_ascii_digit()
            .then(|| value * 10 + u32::from(byte - b'0'))
    })
}

fn valid_date_parts(year: u32, month: u32, day: u32) -> bool {
    if year == 0 || month == 0 || month > 12 {
        return false;
    }
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if year.is_multiple_of(400) || (year.is_multiple_of(4) && !year.is_multiple_of(100)) => {
            29
        }
        2 => 28,
        _ => return false,
    };
    (1..=days).contains(&day)
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG: &str = "data:image/png;base64,iVBORw0KGgo=";

    fn sample_game() -> Game {
        Game {
            id: "after-rain".into(),
            title: "After Rain".into(),
            subtitle: String::new(),
            description: String::new(),
            developer: String::new(),
            publisher: String::new(),
            release_date: "2026-10-23".into(),
            platforms: vec!["Windows".into()],
            tags: vec!["Action".into()],
            cover: PNG.into(),
            hero: String::new(),
            screenshots: Vec::new(),
            status: GameStatus::Draft,
            featured: false,
            created_at: "2026-10-23T00:00:00.000Z".into(),
            updated_at: "2026-10-23T00:00:00.000Z".into(),
        }
    }

    #[test]
    fn validates_the_v1_draft_contract() {
        let library = GameLibrary {
            schema_version: GAME_LIBRARY_VERSION,
            games: vec![sample_game()],
        };
        assert!(library.validate().is_ok());
    }

    #[test]
    fn rejects_unsafe_images_duplicate_ids_and_unknown_versions() {
        let mut first = sample_game();
        first.cover = "https://example.invalid/cover.png".into();
        assert!(first.validate().is_err());

        first.cover = "data:image/png;base64,/9j/".into();
        assert!(first.validate().is_err());

        let mut second = sample_game();
        second.title = "Another game".into();
        let duplicate = GameLibrary {
            schema_version: GAME_LIBRARY_VERSION,
            games: vec![sample_game(), second],
        };
        assert!(duplicate.validate().is_err());
        assert!(GameLibrary {
            schema_version: GAME_LIBRARY_VERSION + 1,
            games: Vec::new(),
        }
        .validate()
        .is_err());
    }

    #[test]
    fn published_games_require_the_presentation_basics() {
        let mut game = sample_game();
        game.status = GameStatus::Published;
        assert!(game.validate().is_err());
        game.subtitle = "A local co-op survival game".into();
        assert!(game.validate().is_ok());
        game.created_at = "2026-02-30T00:00:00Z".into();
        assert!(game.validate().is_err());
    }

    #[test]
    fn bounds_individual_images_and_screenshots() {
        let mut game = sample_game();
        game.screenshots = vec![PNG.into(); MAX_SCREENSHOTS + 1];
        assert!(game.validate().is_err());

        // A complete PNG signature plus zero bytes: valid Base64 and matching
        // file header, but one decoded byte beyond the per-image limit.
        game.screenshots.clear();
        game.cover = format!(
            "data:image/png;base64,iVBORw0KGgoA{}",
            "AAAA".repeat(MAX_IMAGE_BYTES / 3)
        );
        assert!(game.validate().is_err());
    }

    #[test]
    fn accepts_multiline_descriptions_but_not_controls_elsewhere() {
        let mut game = sample_game();
        game.description = "First line\r\n\tSecond line\nThird line".into();
        assert!(game.validate().is_ok());
        game.platforms.push("Windows".into());
        assert!(game.validate().is_err());
        game.platforms.pop();
        game.title = "Bad\nTitle".into();
        assert!(game.validate().is_err());
    }
}
