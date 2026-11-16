//! Background key/button events without swallowing input or a polling loop.
use std::{mem::size_of, ptr::null_mut};
use windows_sys::Win32::{
    Foundation::HWND,
    UI::{Input::*, WindowsAndMessaging::IsWindow},
};

pub struct Keyboard {
    previous: Option<RAWINPUTDEVICE>,
    usage: u16,
}
impl Keyboard {
    pub fn new(hwnd: HWND, mouse: bool) -> Result<Self, String> {
        let usage = if mouse { 2 } else { 6 };
        let mut count = 0;
        let size = size_of::<RAWINPUTDEVICE>() as u32;
        if unsafe { GetRegisteredRawInputDevices(null_mut(), &mut count, size) } == u32::MAX {
            return Err(std::io::Error::last_os_error().to_string());
        }
        if count > 64 {
            return Err("输入设备注册数量异常".into());
        }
        let mut devices = vec![unsafe { std::mem::zeroed::<RAWINPUTDEVICE>() }; count as usize];
        if count > 0
            && unsafe { GetRegisteredRawInputDevices(devices.as_mut_ptr(), &mut count, size) }
                == u32::MAX
        {
            return Err(std::io::Error::last_os_error().to_string());
        }
        let previous = devices
            .into_iter()
            .find(|d| d.usUsagePage == 1 && d.usUsage == usage);
        let device = RAWINPUTDEVICE {
            usUsagePage: 1,
            usUsage: usage,
            dwFlags: RIDEV_INPUTSINK,
            hwndTarget: hwnd,
        };
        if unsafe { RegisterRawInputDevices(&device, 1, size) } == 0 {
            return Err(std::io::Error::last_os_error().to_string());
        }
        Ok(Self { previous, usage })
    }
}
impl Drop for Keyboard {
    fn drop(&mut self) {
        let remove = RAWINPUTDEVICE {
            usUsagePage: 1,
            usUsage: self.usage,
            dwFlags: RIDEV_REMOVE,
            hwndTarget: null_mut(),
        };
        let restore = self
            .previous
            .as_ref()
            .filter(|d| d.hwndTarget.is_null() || unsafe { IsWindow(d.hwndTarget) } != 0)
            .unwrap_or(&remove);
        unsafe {
            RegisterRawInputDevices(restore, 1, size_of::<RAWINPUTDEVICE>() as u32);
        }
    }
}

pub fn key_event(handle: isize, selected: Option<u8>) -> Option<(u8, bool)> {
    let mut data: RAWINPUT = unsafe { std::mem::zeroed() };
    let mut size = size_of::<RAWINPUT>() as u32;
    let result = unsafe {
        GetRawInputData(
            handle as HRAWINPUT,
            RID_INPUT,
            (&mut data as *mut RAWINPUT).cast(),
            &mut size,
            size_of::<RAWINPUTHEADER>() as u32,
        )
    };
    if result == u32::MAX {
        return None;
    }
    if data.header.dwType == RIM_TYPEMOUSE {
        let flags = unsafe { data.data.mouse.Anonymous.Anonymous.usButtonFlags };
        let key = selected?;
        return mouse_transition(key, flags).map(|down| (key, down));
    }
    if data.header.dwType != RIM_TYPEKEYBOARD {
        return None;
    }
    let key = unsafe { data.data.keyboard };
    let vk = match key.VKey {
        160 | 161 => 16,
        162 | 163 => 17,
        164 | 165 => 18,
        92 => 91,
        value => value,
    };
    if !(8..=254).contains(&vk) || vk == 229 {
        return None;
    }
    Some((vk as u8, key.Flags & 1 == 0))
}

fn mouse_transition(key: u8, flags: u16) -> Option<bool> {
    let (down, up) = match key {
        1 => (1, 2),
        2 => (4, 8),
        4 => (16, 32),
        5 => (64, 128),
        6 => (256, 512),
        _ => return None,
    };
    if flags & up != 0 {
        Some(false)
    } else if flags & down != 0 {
        Some(true)
    } else {
        None
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mouse_buttons_have_distinct_press_and_release_events() {
        for (key, down, up) in [
            (1, 1, 2),
            (2, 4, 8),
            (4, 16, 32),
            (5, 64, 128),
            (6, 256, 512),
        ] {
            assert_eq!(mouse_transition(key, down), Some(true));
            assert_eq!(mouse_transition(key, up), Some(false));
            assert_eq!(mouse_transition(key, 0), None);
        }
        assert_eq!(mouse_transition(1, 4), None);
    }
}
