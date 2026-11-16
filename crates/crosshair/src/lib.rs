//! Small native overlay. No webview, timer, game access, or persistent worker at startup.
#[cfg(windows)]
mod keyboard;
pub mod render;
#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use windows::{monitors, Overlay};

pub use moligod_core::crosshair_state::{Monitor, Status};
