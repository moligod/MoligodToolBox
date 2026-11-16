//! A bounded expression language. No code evaluation, assignment, file or process access.
use serde_json::{json, Value};
use std::collections::BTreeMap;

#[derive(Clone, Debug)]
pub enum Expr {
    Literal(Value),
    Variable(String),
    Unary(String, Box<Expr>),
    Binary(String, Box<Expr>, Box<Expr>),
    Regex(Box<Expr>, regex::Regex),
}
#[derive(Clone, Debug, PartialEq)]
enum Token {
    Value(Value),
    Name(String),
    Op(String),
    Left,
    Right,
}
pub fn compile(source: &str) -> Result<Expr, String> {
    if source.is_empty() || source.len() > 2048 {
        return Err("表达式长度应为 1–2048 字节".into());
    }
    let chars: Vec<char> = source.chars().collect();
    let mut i = 0;
    let mut tokens = Vec::new();
    while i < chars.len() {
        let ch = chars[i];
        if ch.is_whitespace() {
            i += 1;
            continue;
        }
        if ch == '(' {
            tokens.push(Token::Left);
            i += 1;
        } else if ch == ')' {
            tokens.push(Token::Right);
            i += 1;
        } else if ch == '"' || ch == '\'' {
            let quote = ch;
            i += 1;
            let mut text = String::new();
            while i < chars.len() && chars[i] != quote {
                if chars[i] == '\\' {
                    i += 1;
                    if i >= chars.len() {
                        return Err("字符串转义不完整".into());
                    }
                }
                text.push(chars[i]);
                i += 1;
            }
            if i >= chars.len() {
                return Err("字符串未闭合".into());
            }
            i += 1;
            tokens.push(Token::Value(Value::String(text)));
        } else if ch.is_ascii_digit() || ch == '.' {
            let start = i;
            i += 1;
            while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == '.') {
                i += 1;
            }
            let number: f64 = chars[start..i]
                .iter()
                .collect::<String>()
                .parse()
                .map_err(|_| "数字无效")?;
            if !number.is_finite() {
                return Err("数字超出范围".into());
            }
            tokens.push(Token::Value(json!(number)));
        } else if ch.is_ascii_alphabetic() || ch == '_' {
            let start = i;
            i += 1;
            while i < chars.len() && (chars[i].is_ascii_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            let name: String = chars[start..i].iter().collect();
            tokens.push(match name.as_str() {
                "true" => Token::Value(json!(true)),
                "false" => Token::Value(json!(false)),
                "null" => Token::Value(Value::Null),
                _ => Token::Name(name),
            });
        } else {
            let mut op = ch.to_string();
            if i + 1 < chars.len() {
                let pair = format!("{}{}", ch, chars[i + 1]);
                if ["&&", "||", "==", "!=", "<=", ">=", "=~"].contains(&pair.as_str()) {
                    op = pair;
                    i += 1;
                }
            }
            if ![
                "+", "-", "*", "/", "%", "!", "<", ">", "&&", "||", "==", "!=", "<=", ">=", "=~",
                "=~",
            ]
            .contains(&op.as_str())
            {
                return Err(format!("表达式不支持 {op}"));
            }
            tokens.push(Token::Op(op));
            i += 1;
        }
        if tokens.len() > 256 {
            return Err("表达式过于复杂".into());
        }
    }
    let mut parser = Parser { tokens, index: 0 };
    let expr = parser.parse(0, 0)?;
    if parser.index != parser.tokens.len() {
        return Err("表达式尾部无效".into());
    }
    Ok(expr)
}
struct Parser {
    tokens: Vec<Token>,
    index: usize,
}
impl Parser {
    fn parse(&mut self, min: u8, depth: u8) -> Result<Expr, String> {
        if depth > 32 {
            return Err("表达式嵌套过深".into());
        }
        let token = self.tokens.get(self.index).cloned().ok_or("表达式不完整")?;
        self.index += 1;
        let mut left = match token {
            Token::Value(value) => Expr::Literal(value),
            Token::Name(name) => Expr::Variable(name),
            Token::Op(op) if op == "!" || op == "-" || op == "+" => {
                Expr::Unary(op, Box::new(self.parse(7, depth + 1)?))
            }
            Token::Left => {
                let value = self.parse(0, depth + 1)?;
                if self.tokens.get(self.index) != Some(&Token::Right) {
                    return Err("括号未闭合".into());
                }
                self.index += 1;
                value
            }
            _ => return Err("表达式起始符号无效".into()),
        };
        while let Some(Token::Op(op)) = self.tokens.get(self.index) {
            let rank = match op.as_str() {
                "||" => 1,
                "&&" => 2,
                "==" | "!=" | "=~" => 3,
                "<" | ">" | "<=" | ">=" => 4,
                "+" | "-" => 5,
                "*" | "/" | "%" => 6,
                _ => break,
            };
            if rank < min {
                break;
            }
            let op = op.clone();
            self.index += 1;
            let right = self.parse(rank + 1, depth + 1)?;
            left = if op == "=~" {
                let Expr::Literal(Value::String(pattern)) = right else {
                    return Err("正则规则必须是字符串常量".into());
                };
                Expr::Regex(
                    Box::new(left),
                    regex::Regex::new(&pattern).map_err(|e| format!("正则规则无效：{e}"))?,
                )
            } else {
                Expr::Binary(op, Box::new(left), Box::new(right))
            };
        }
        Ok(left)
    }
}
pub(crate) fn number(value: &Value) -> Result<f64, String> {
    value
        .as_f64()
        .or_else(|| value.as_str().and_then(|v| v.trim().parse().ok()))
        .filter(|n| n.is_finite())
        .ok_or("表达式需要有效数字".into())
}
fn boolean(value: &Value) -> Result<bool, String> {
    value
        .as_bool()
        .ok_or("表达式需要布尔值")
        .map_err(Into::into)
}
impl Expr {
    pub fn eval(&self, vars: &BTreeMap<String, Value>) -> Result<Value, String> {
        match self {
            Self::Literal(value) => Ok(value.clone()),
            Self::Variable(name) => vars
                .get(name)
                .cloned()
                .ok_or_else(|| format!("变量 {name} 尚未赋值")),
            Self::Regex(expr, pattern) => {
                let value = expr.eval(vars)?;
                let text = value
                    .as_str()
                    .map(str::to_owned)
                    .unwrap_or_else(|| value.to_string());
                Ok(json!(pattern.is_match(&text)))
            }
            Self::Unary(op, expr) => {
                let v = expr.eval(vars)?;
                match op.as_str() {
                    "!" => Ok(json!(!boolean(&v)?)),
                    "-" => Ok(json!(-number(&v)?)),
                    _ => Ok(json!(number(&v)?)),
                }
            }
            Self::Binary(op, a, b) => {
                let a = a.eval(vars)?;
                if op == "&&" && !boolean(&a)? {
                    return Ok(json!(false));
                }
                if op == "||" && boolean(&a)? {
                    return Ok(json!(true));
                }
                let b = b.eval(vars)?;
                match op.as_str() {
                    "&&" | "||" => Ok(json!(boolean(&b)?)),
                    "==" => Ok(json!(
                        a == b
                            || number(&a)
                                .ok()
                                .zip(number(&b).ok())
                                .is_some_and(|(a, b)| a == b)
                    )),
                    "!=" => Ok(json!(
                        !(a == b
                            || number(&a)
                                .ok()
                                .zip(number(&b).ok())
                                .is_some_and(|(a, b)| a == b))
                    )),
                    "<" => Ok(json!(number(&a)? < number(&b)?)),
                    ">" => Ok(json!(number(&a)? > number(&b)?)),
                    "<=" => Ok(json!(number(&a)? <= number(&b)?)),
                    ">=" => Ok(json!(number(&a)? >= number(&b)?)),
                    _ => {
                        let a = number(&a)?;
                        let b = number(&b)?;
                        let n = match op.as_str() {
                            "+" => a + b,
                            "-" => a - b,
                            "*" => a * b,
                            "/" if b != 0.0 => a / b,
                            "%" if b != 0.0 => a % b,
                            _ => return Err("除数不能为零".into()),
                        };
                        if !n.is_finite() {
                            return Err("计算结果超出范围".into());
                        }
                        Ok(json!(n))
                    }
                }
            }
        }
    }
    pub fn test(&self, vars: &BTreeMap<String, Value>) -> Result<bool, String> {
        boolean(&self.eval(vars)?)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn regex_conditions_compile_once_and_compose() {
        let vars = BTreeMap::from([("text".into(), json!("abc123"))]);
        assert!(compile(r#"text =~ "^abc[0-9]+$" && true"#)
            .unwrap()
            .test(&vars)
            .unwrap());
        assert!(!compile(r#"text =~ "^xyz""#).unwrap().test(&vars).unwrap());
        assert!(compile(r#"false && missing =~ "a""#)
            .unwrap()
            .test(&vars)
            .is_ok());
        assert!(compile(r#"text =~ "[""#).is_err());
        assert!(compile("text =~ other").is_err());
        assert!(compile(r#"missing =~ "a""#).unwrap().test(&vars).is_err());
        assert!(compile(r#"text =~ "\\d+""#).unwrap().test(&vars).unwrap());
    }
    #[test]
    fn arithmetic_and_short_circuit() {
        let vars = BTreeMap::from([("price".into(), json!("120"))]);
        assert!(compile("price * 2 >= 240 && (true || missing > 1)")
            .unwrap()
            .test(&vars)
            .unwrap());
        assert!(compile("1/0 > 1").unwrap().test(&vars).is_err());
        assert!(compile("x = 3").is_err());
    }
}
