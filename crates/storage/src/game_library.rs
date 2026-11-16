//! Single-writer persistent storage for the local game library.
//!
//! Reads never repair or rewrite a library.  A save first verifies the current
//! file, then atomically replaces it only after a complete backup is durable.
use moligod_core::game_library::{GameLibrary, MAX_LIBRARY_ENCODED_BYTES};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

pub struct GameLibraryStore {
    path: PathBuf,
}

impl GameLibraryStore {
    pub fn new(directory: &Path) -> Self {
        Self {
            path: directory.join("game-library.json"),
        }
    }

    pub fn load(&self) -> Result<GameLibrary, String> {
        match fs::File::open(&self.path) {
            Ok(file) => decode_library(&read_limited(file)?),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                Ok(GameLibrary::default())
            }
            Err(error) => Err(error.to_string()),
        }
    }

    pub fn save(&self, library: &GameLibrary) -> Result<(), String> {
        library.validate()?;
        // Do not replace a corrupt or newer file with valid data supplied by the UI.
        self.load()?;
        let bytes = serde_json::to_vec(library).map_err(|error| error.to_string())?;
        if bytes.len() > MAX_LIBRARY_ENCODED_BYTES {
            return Err("游戏资料库文件超过 24 MiB".into());
        }

        let directory = self.path.parent().ok_or("游戏资料库目录无效")?;
        fs::create_dir_all(directory).map_err(|error| error.to_string())?;
        if self.path.exists() {
            let old = fs::read(&self.path).map_err(|error| error.to_string())?;
            atomic_write(&self.path.with_extension("json.bak"), &old)?;
        }
        atomic_write(&self.path, &bytes)
    }
}

fn read_limited(file: fs::File) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    file.take(MAX_LIBRARY_ENCODED_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    if bytes.len() > MAX_LIBRARY_ENCODED_BYTES {
        return Err("游戏资料库文件超过 24 MiB，原文件已保留".into());
    }
    Ok(bytes)
}

fn decode_library(bytes: &[u8]) -> Result<GameLibrary, String> {
    let library: GameLibrary = serde_json::from_slice(bytes)
        .map_err(|error| format!("游戏资料库格式无效，原文件已保留：{error}"))?;
    library.validate()?;
    Ok(library)
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let directory = path.parent().ok_or("游戏资料库目录无效")?;
    let mut temporary =
        tempfile::NamedTempFile::new_in(directory).map_err(|error| error.to_string())?;
    temporary
        .write_all(bytes)
        .map_err(|error| error.to_string())?;
    temporary
        .as_file()
        .sync_all()
        .map_err(|error| error.to_string())?;
    temporary.persist(path).map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use moligod_core::game_library::{Game, GameStatus, GAME_LIBRARY_VERSION};

    // Fixed schema-1 fixture.  It proves old valid data is loaded without a
    // write and is copied byte-for-byte before its first explicit replacement.
    const V1_FIXTURE: &[u8] = br#"{
  "schemaVersion": 1,
  "games": [
    {
      "id": "after-rain",
      "title": "After Rain",
      "subtitle": "A local co-op survival game",
      "description": "Build a home after the storm.",
      "developer": "moligod",
      "publisher": "",
      "releaseDate": "2026-10-23",
      "platforms": ["Windows"],
      "tags": ["Survival"],
      "cover": "data:image/png;base64,iVBORw0KGgo=",
      "hero": "",
      "screenshots": [],
      "status": "published",
      "featured": true,
      "createdAt": "2026-10-23T00:00:00.000Z",
      "updatedAt": "2026-10-23T00:00:00.000Z"
    }
  ]
}"#;

    fn valid_library() -> GameLibrary {
        decode_library(V1_FIXTURE).unwrap()
    }

    #[test]
    fn loads_missing_library_without_writing_and_backs_up_the_fixed_v1_fixture() {
        let directory = tempfile::tempdir().unwrap();
        let store = GameLibraryStore::new(directory.path());
        assert_eq!(store.load().unwrap(), GameLibrary::default());
        assert!(!store.path.exists());

        fs::write(&store.path, V1_FIXTURE).unwrap();
        let mut next = store.load().unwrap();
        next.games[0].featured = false;
        next.games[0].updated_at = "2026-10-23T00:01:00Z".into();
        store.save(&next).unwrap();

        assert_eq!(store.load().unwrap(), next);
        assert_eq!(
            fs::read(store.path.with_extension("json.bak")).unwrap(),
            V1_FIXTURE
        );
    }

    #[test]
    fn refuses_to_replace_corrupt_unknown_or_unsafe_data() {
        let directory = tempfile::tempdir().unwrap();
        let store = GameLibraryStore::new(directory.path());
        let mut future = valid_library();
        future.schema_version = GAME_LIBRARY_VERSION + 1;
        let unsafe_image = br#"{"schemaVersion":1,"games":[{"id":"unsafe","title":"Unsafe","subtitle":"","description":"","developer":"","publisher":"","releaseDate":"","platforms":[],"tags":[],"cover":"https://example.invalid/image.png","hero":"","screenshots":[],"status":"draft","featured":false,"createdAt":"2026-10-23T00:00:00Z","updatedAt":"2026-10-23T00:00:00Z"}]}"#;
        for bytes in [
            b"not json".to_vec(),
            serde_json::to_vec(&future).unwrap(),
            unsafe_image.to_vec(),
        ] {
            fs::write(&store.path, &bytes).unwrap();
            assert!(store.load().is_err());
            assert!(store.save(&valid_library()).is_err());
            assert_eq!(fs::read(&store.path).unwrap(), bytes);
        }
    }

    #[test]
    fn serde_rejects_unknown_fields_before_any_save() {
        let raw = br#"{"schemaVersion":1,"games":[],"unknown":true}"#;
        assert!(decode_library(raw).is_err());

        let game = Game {
            id: "new-game".into(),
            title: "New Game".into(),
            subtitle: String::new(),
            description: String::new(),
            developer: String::new(),
            publisher: String::new(),
            release_date: String::new(),
            platforms: Vec::new(),
            tags: Vec::new(),
            cover: String::new(),
            hero: String::new(),
            screenshots: Vec::new(),
            status: GameStatus::Draft,
            featured: false,
            created_at: "2026-10-23T00:00:00Z".into(),
            updated_at: "2026-10-23T00:00:00Z".into(),
        };
        assert!(GameLibrary {
            schema_version: GAME_LIBRARY_VERSION,
            games: vec![game],
        }
        .validate()
        .is_ok());
    }

    #[test]
    fn preserves_multiline_descriptions_through_compact_storage() {
        let directory = tempfile::tempdir().unwrap();
        let store = GameLibraryStore::new(directory.path());
        let mut library = valid_library();
        library.games[0].description = "第一行\r\n\t第二行\nThird line".into();
        store.save(&library).unwrap();

        assert_eq!(store.load().unwrap(), library);
        let stored = fs::read(&store.path).unwrap();
        assert!(!stored.contains(&b'\n'));
    }
}
