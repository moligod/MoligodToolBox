use crate::config::HotkeyMode;

#[derive(Default)]
pub struct KeyTransition {
    down: bool,
    restore: Option<bool>,
}
impl KeyTransition {
    pub fn input(&mut self, down: bool, mode: HotkeyMode, visible: bool) -> Option<bool> {
        if down == self.down {
            return None;
        }
        self.down = down;
        if down {
            match mode {
                HotkeyMode::Toggle => Some(!visible),
                HotkeyMode::Hold => {
                    self.restore = Some(true);
                    Some(false)
                }
                HotkeyMode::HoldShow => {
                    self.restore = Some(false);
                    Some(true)
                }
            }
        } else {
            self.restore.take()
        }
    }
    pub fn reset(&mut self, visible: bool) -> bool {
        self.down = false;
        self.restore.take().unwrap_or(visible)
    }
    /// A newly selected hold mode starts in its released state, regardless of the old mode.
    pub fn reconfigure(&mut self, mode: HotkeyMode, enabled: bool, visible: bool) -> bool {
        let visible = self.reset(visible);
        match mode {
            HotkeyMode::Toggle => visible,
            HotkeyMode::Hold => true,
            HotkeyMode::HoldShow => !enabled,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn toggle_ignores_keyboard_repeat() {
        let mut key = KeyTransition::default();
        assert_eq!(key.input(true, HotkeyMode::Toggle, true), Some(false));
        assert_eq!(key.input(true, HotkeyMode::Toggle, false), None);
        assert_eq!(key.input(false, HotkeyMode::Toggle, false), None);
        assert_eq!(key.input(true, HotkeyMode::Toggle, false), Some(true));
    }
    #[test]
    fn hold_hide_always_shows_on_release_and_can_be_cancelled() {
        let mut key = KeyTransition::default();
        assert_eq!(key.input(true, HotkeyMode::Hold, true), Some(false));
        assert_eq!(key.input(true, HotkeyMode::Hold, false), None);
        assert_eq!(key.input(false, HotkeyMode::Hold, false), Some(true));
        assert_eq!(key.input(true, HotkeyMode::Hold, false), Some(false));
        assert_eq!(key.input(false, HotkeyMode::Hold, false), Some(true));
        key.input(true, HotkeyMode::Hold, true);
        assert!(key.reset(false));
        assert_eq!(key.input(false, HotkeyMode::Hold, true), None);
    }
    #[test]
    fn hidden_toggle_switches_to_the_released_hold_state() {
        let mut key = KeyTransition::default();
        let hidden = key.input(true, HotkeyMode::Toggle, true).unwrap();
        assert!(!hidden);
        assert!(key.reconfigure(HotkeyMode::Hold, true, hidden));
        assert_eq!(key.input(false, HotkeyMode::Hold, true), None);
        assert_eq!(key.input(true, HotkeyMode::Hold, true), Some(false));
        assert_eq!(key.input(false, HotkeyMode::Hold, false), Some(true));
    }
    #[test]
    fn hold_show_ignores_repeat_hides_on_release_and_recovers_without_a_key() {
        let mut key = KeyTransition::default();
        assert!(!key.reconfigure(HotkeyMode::HoldShow, true, true));
        assert_eq!(key.input(true, HotkeyMode::HoldShow, false), Some(true));
        assert_eq!(key.input(true, HotkeyMode::HoldShow, true), None);
        assert_eq!(key.input(false, HotkeyMode::HoldShow, true), Some(false));
        key.input(true, HotkeyMode::HoldShow, false);
        assert!(key.reconfigure(HotkeyMode::Hold, true, true));
        assert_eq!(key.input(false, HotkeyMode::Hold, true), None);
        assert!(!key.reconfigure(HotkeyMode::HoldShow, true, true));
        assert!(key.reconfigure(HotkeyMode::HoldShow, false, false));
    }
}
