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
/// Serialize one length-prefixed frame without touching any pipe.
pub fn encode_frame(value: &impl Serialize) -> Result<Vec<u8>, String> {
    let data = serde_json::to_vec(value).map_err(|e| e.to_string())?;
    if data.len() > MAX_FRAME {
        return Err("模块消息超出大小限制".into());
    }
    let mut frame = Vec::with_capacity(4 + data.len());
    frame.extend_from_slice(&(data.len() as u32).to_le_bytes());
    frame.extend_from_slice(&data);
    Ok(frame)
}
pub fn write_frame(writer: &mut impl Write, value: &impl Serialize) -> Result<(), String> {
    let frame = encode_frame(value)?;
    writer
        .write_all(&frame)
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
    handler: impl FnMut(&str, Value) -> Result<Value, String>,
) -> Result<(), String> {
    write_frame(
        &mut *output.lock().map_err(|_| "输出锁异常")?,
        &Packet::Hello {
            protocol: PROTOCOL,
            module: module.into(),
            version: env!("CARGO_PKG_VERSION").into(),
        },
    )?;
    serve_requests(&mut std::io::stdin().lock(), &output, handler)
}
/// Answer requests until EOF or an accepted `shutdown`. A shutdown that was rejected
/// (wrong protocol or handler error) keeps the module serving, so a malformed request
/// cannot stop running tasks.
fn serve_requests<W: Write>(
    input: &mut impl Read,
    output: &Mutex<W>,
    mut handler: impl FnMut(&str, Value) -> Result<Value, String>,
) -> Result<(), String> {
    while let Some(request) = read_frame::<Request>(input)? {
        let result = if request.protocol != PROTOCOL {
            Err("模块协议版本不兼容".into())
        } else {
            handler(&request.method, request.payload)
        };
        let stop = request.protocol == PROTOCOL && request.method == "shutdown" && result.is_ok();
        write_frame(
            &mut *output.lock().map_err(|_| "输出锁异常")?,
            &Packet::Reply {
                id: request.id,
                result,
            },
        )?;
        if stop {
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

    #[test]
    fn only_an_accepted_shutdown_ends_the_serve_loop() {
        let request = |protocol, id, method: &str| Request {
            protocol,
            id,
            method: method.into(),
            payload: Value::Null,
        };
        let mut input = Vec::new();
        for r in [
            request(PROTOCOL + 1, 1, "shutdown"),
            request(PROTOCOL, 2, "shutdown"),
            request(PROTOCOL, 3, "shutdown"),
            request(PROTOCOL, 4, "after"),
        ] {
            write_frame(&mut input, &r).unwrap();
        }
        let output = Mutex::new(Vec::new());
        let mut calls = Vec::new();
        serve_requests(&mut input.as_slice(), &output, |method, _| {
            calls.push(method.to_string());
            if calls.len() == 1 {
                Err("still busy".into())
            } else {
                Ok(Value::Null)
            }
        })
        .unwrap();
        // The wrong-protocol shutdown never reaches the handler, the failed shutdown keeps
        // serving, and the accepted one stops before request 4 is read.
        assert_eq!(calls, ["shutdown", "shutdown"]);
        let bytes = output.into_inner().unwrap();
        let mut replies = bytes.as_slice();
        let mut ids = Vec::new();
        while let Some(Packet::Reply { id, result }) = read_frame::<Packet>(&mut replies).unwrap() {
            ids.push((id, result.is_ok()));
        }
        assert_eq!(ids, [(1, false), (2, false), (3, true)]);
    }
}
