use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex, OnceLock,
    },
};

type Registry = Arc<Mutex<BTreeMap<u16, u64>>>;
type Sender = fn(u16, bool) -> Result<(), String>;
static REGISTRY: OnceLock<Registry> = OnceLock::new();
static NEXT: AtomicU64 = AtomicU64::new(1);

/// A task may release only keys it pressed. Drop runs on every worker exit.
pub(crate) struct HeldKeys {
    owner: u64,
    keys: Vec<u16>,
    registry: Registry,
    send: Sender,
}
impl HeldKeys {
    pub fn new(send: Sender) -> Self {
        Self::with_registry(REGISTRY.get_or_init(Default::default).clone(), send)
    }
    fn with_registry(registry: Registry, send: Sender) -> Self {
        Self {
            owner: NEXT.fetch_add(1, Ordering::Relaxed),
            keys: Vec::new(),
            registry,
            send,
        }
    }
    pub fn contains(&self, key: u16) -> bool {
        self.keys.contains(&key)
    }
    pub fn press(&mut self, keys: &[u16]) -> Result<(), String> {
        let mut registry = self.registry.lock().unwrap_or_else(|e| e.into_inner());
        if keys
            .iter()
            .any(|key| registry.get(key).is_some_and(|owner| *owner != self.owner))
        {
            return Err("该按键正由其他任务按住".into());
        }
        for key in keys {
            if self.keys.contains(key) {
                continue;
            }
            (self.send)(*key, false)?;
            registry.insert(*key, self.owner);
            self.keys.push(*key);
        }
        Ok(())
    }
    pub fn release(&mut self, keys: &[u16]) -> Result<(), String> {
        let mut registry = self.registry.lock().unwrap_or_else(|e| e.into_inner());
        for key in keys.iter().rev() {
            if registry.get(key) != Some(&self.owner) {
                continue;
            }
            (self.send)(*key, true)?;
            registry.remove(key);
            self.keys.retain(|k| k != key);
        }
        Ok(())
    }
}
impl Drop for HeldKeys {
    fn drop(&mut self) {
        // Continue attempting every release even if Windows rejects one event.
        for key in self.keys.clone().into_iter().rev() {
            let _ = self.release(&[key]);
        }
        let mut registry = self.registry.lock().unwrap_or_else(|e| e.into_inner());
        registry.retain(|_, owner| *owner != self.owner);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    thread_local! {static EVENTS: std::cell::RefCell<Vec<(u16,bool)>> = const {std::cell::RefCell::new(Vec::new())};}
    fn send(key: u16, up: bool) -> Result<(), String> {
        if key == 254 && !up {
            return Err("injected error".into());
        }
        EVENTS.with(|events| events.borrow_mut().push((key, up)));
        Ok(())
    }
    #[test]
    fn owned_keys_release_on_exit_and_cannot_be_stolen() {
        EVENTS.with(|e| e.borrow_mut().clear());
        let registry = Registry::default();
        {
            let mut first = HeldKeys::with_registry(registry.clone(), send);
            let mut second = HeldKeys::with_registry(registry.clone(), send);
            first.press(&[17, 87]).unwrap();
            first.press(&[87]).unwrap();
            assert!(second.press(&[87]).is_err());
            second.release(&[87]).unwrap();
            assert!(first.contains(87));
            first.release(&[87]).unwrap();
            assert!(first.press(&[65, 254]).is_err());
        }
        assert!(registry.lock().unwrap().is_empty());
        EVENTS.with(|e| {
            assert_eq!(
                *e.borrow(),
                [
                    (17, false),
                    (87, false),
                    (87, true),
                    (65, false),
                    (65, true),
                    (17, true)
                ]
            )
        });
    }
}
