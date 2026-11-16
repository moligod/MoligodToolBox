//! No worker exists until start(). Cancellation wakes sleeping workers immediately.
//! Workers must use bounded I/O and observe cancellation; stop joins before restart.
use std::{
    sync::{Arc, Condvar, Mutex},
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

#[derive(Clone, Default)]
pub struct Cancellation(Arc<(Mutex<bool>, Condvar)>, Option<Instant>);
impl Cancellation {
    /// A bounded view shares explicit cancellation without cancelling its parent on timeout.
    pub fn with_deadline(&self, deadline: Instant) -> Self {
        Self(
            self.0.clone(),
            Some(self.1.map_or(deadline, |existing| existing.min(deadline))),
        )
    }
    pub fn cancel(&self) {
        let (lock, wake) = &*self.0;
        *lock.lock().unwrap_or_else(|e| e.into_inner()) = true;
        wake.notify_all();
    }
    pub fn is_cancelled(&self) -> bool {
        *self.0 .0.lock().unwrap_or_else(|e| e.into_inner())
            || self.1.is_some_and(|deadline| Instant::now() >= deadline)
    }
    /// Returns true when cancelled, false when the duration elapses.
    pub fn wait(&self, duration: Duration) -> bool {
        let duration = self.1.map_or(duration, |deadline| {
            duration.min(deadline.saturating_duration_since(Instant::now()))
        });
        let (lock, wake) = &*self.0;
        let guard = lock.lock().unwrap_or_else(|e| e.into_inner());
        let (guard, _) = wake
            .wait_timeout_while(guard, duration, |cancelled| !*cancelled)
            .unwrap_or_else(|e| e.into_inner());
        *guard || self.1.is_some_and(|deadline| Instant::now() >= deadline)
    }
}

#[derive(Default)]
pub struct TaskSlot {
    worker: Option<(Cancellation, JoinHandle<()>)>,
}

impl TaskSlot {
    pub fn is_running(&self) -> bool {
        self.worker
            .as_ref()
            .is_some_and(|(_, handle)| !handle.is_finished())
    }
    pub fn start(
        &mut self,
        name: &str,
        work: impl FnOnce(Cancellation) + Send + 'static,
    ) -> Result<(), String> {
        if self.is_running() {
            return Err("任务已在运行".into());
        }
        self.stop()?;
        let token = Cancellation::default();
        let child = token.clone();
        let handle = thread::Builder::new()
            .name(name.into())
            .spawn(move || work(child))
            .map_err(|e| e.to_string())?;
        self.worker = Some((token, handle));
        Ok(())
    }
    pub fn stop(&mut self) -> Result<(), String> {
        if let Some((token, handle)) = self.worker.take() {
            token.cancel();
            handle.join().map_err(|_| "工作线程异常退出".to_string())?;
        }
        Ok(())
    }
    pub fn cancel(&self) {
        if let Some((token, _)) = &self.worker {
            token.cancel();
        }
    }
}

impl Drop for TaskSlot {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    #[test]
    fn scoped_deadline_wakes_without_cancelling_parent() {
        let parent = Cancellation::default();
        let start = Instant::now();
        let bounded = parent.with_deadline(start + Duration::from_millis(30));
        assert!(bounded.wait(Duration::from_secs(60)));
        assert!(start.elapsed() < Duration::from_secs(1));
        assert!(bounded.is_cancelled());
        assert!(!parent.is_cancelled());
        let next = parent.with_deadline(Instant::now() + Duration::from_secs(60));
        parent.cancel();
        assert!(next.is_cancelled());
        assert!(next.wait(Duration::from_secs(60)));
    }
    #[test]
    fn cancellation_wakes_long_wait_and_allows_restart() {
        let mut slot = TaskSlot::default();
        for _ in 0..20 {
            let (tx, rx) = mpsc::channel();
            slot.start("test", move |token| {
                tx.send(()).unwrap();
                assert!(token.wait(Duration::from_secs(60)));
            })
            .unwrap();
            rx.recv_timeout(Duration::from_secs(2)).unwrap();
            assert!(slot.start("duplicate", |_| {}).is_err());
            slot.stop().unwrap();
            assert!(!slot.is_running());
        }
    }
    #[test]
    fn drop_joins_and_panic_is_reported() {
        let (tx, rx) = mpsc::channel();
        {
            let mut slot = TaskSlot::default();
            slot.start("drop", move |token| {
                token.wait(Duration::from_secs(60));
                tx.send(()).unwrap();
            })
            .unwrap();
        }
        rx.recv_timeout(Duration::from_secs(2)).unwrap();
        let mut slot = TaskSlot::default();
        slot.start("panic", |_| panic!("test failure")).unwrap();
        assert!(slot.stop().is_err());
        slot.start("restart", |_| {}).unwrap();
        slot.stop().unwrap();
    }
}
