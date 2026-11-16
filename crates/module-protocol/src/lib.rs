//! Versioned, bounded IPC used by bundled modules and future downloaded modules alike.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

pub const PROTOCOL: u32 = 1;
pub const MAX_FRAME: usize = 16 * 1024 * 1024;

#[derive(Serialize, Deserialize, Debug)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub protocol: u32,
    pub id: u64,
    pub method: String,
    pub payload: Value,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Packet {
    Hello {
        protocol: u32,
        module: String,
        version: String,
    },
    Reply {
        id: u64,
        result: Result<Value, String>,
    },
    Event {
        name: String,
        data: Value,
    },
}

pub fn read_frame<T: serde::de::DeserializeOwned>(
    reader: &mut impl Read,
) -> Result<Option<T>, String> {
    let mut prefix = [0u8; 4];
    match reader.read(&mut prefix[..1]) {
        Ok(0) => return Ok(None),
        Ok(_) => {}
        Err(e) => return Err(e.to_string()),
    }
    reader
        .read_exact(&mut prefix[1..])
        .map_err(|e| e.to_string())?;
    let length = u32::from_le_bytes(prefix) as usize;
    if length == 0 || length > MAX_FRAME {
        return Err("模块消息超出大小限制".into());
    }
    let mut data = vec![0; length];
    reader.read_exact(&mut data).map_err(|e| e.to_string())?;
    serde_json::from_slice(&data)
        .map(Some)
        .map_err(|e| e.to_string())
}
pub fn write_frame(writer: &mut impl Write, value: &impl Serialize) -> Result<(), String> {
    let data = serde_json::to_vec(value).map_err(|e| e.to_string())?;
    if data.len() > MAX_FRAME {
        return Err("模块消息超出大小限制".into());
    }
    writer
        .write_all(&(data.len() as u32).to_le_bytes())
        .and_then(|_| writer.write_all(&data))
        .and_then(|_| writer.flush())
        .map_err(|e| e.to_string())
}
pub type Output = Arc<Mutex<std::io::Stdout>>;
pub fn emit(output: &Output, name: &str, data: impl Serialize) {
    if let (Ok(mut out), Ok(data)) = (output.lock(), serde_json::to_value(data)) {
        let _ = write_frame(
            &mut *out,
            &Packet::Event {
                name: name.into(),
                data,
            },
        );
    }
}
pub fn serve(
    module: &str,
    output: Output,
    mut handler: impl FnMut(&str, Value) -> Result<Value, String>,
) -> Result<(), String> {
    write_frame(
        &mut *output.lock().map_err(|_| "输出锁异常")?,
        &Packet::Hello {
            protocol: PROTOCOL,
            module: module.into(),
            version: env!("CARGO_PKG_VERSION").into(),
        },
    )?;
    let mut input = std::io::stdin().lock();
    while let Some(request) = read_frame::<Request>(&mut input)? {
        let shutdown = request.method == "shutdown";
        let result = if request.protocol != PROTOCOL {
            Err("模块协议版本不兼容".into())
        } else {
            handler(&request.method, request.payload)
        };
        write_frame(
            &mut *output.lock().map_err(|_| "输出锁异常")?,
            &Packet::Reply {
                id: request.id,
                result,
            },
        )?;
        if shutdown {
            break;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn framing_round_trip_and_truncation_limits() {
        let mut bytes = Vec::new();
        write_frame(
            &mut bytes,
            &Request {
                protocol: 1,
                id: 7,
                method: "hello".into(),
                payload: Value::Null,
            },
        )
        .unwrap();
        let request = read_frame::<Request>(&mut bytes.as_slice())
            .unwrap()
            .unwrap();
        assert_eq!(request.id, 7);
        assert!(read_frame::<Request>(&mut &bytes[..bytes.len() - 1]).is_err());
        assert!(read_frame::<Request>(&mut &(u32::MAX.to_le_bytes())[..]).is_err());
        assert!(read_frame::<Request>(&mut &[][..]).unwrap().is_none());
    }
}
