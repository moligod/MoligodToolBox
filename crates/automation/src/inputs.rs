//! Versioned, typed value blocks. Queries run only when their input is evaluated.
use crate::{
    engine::Driver,
    expression::{self, Expr},
    model::*,
};
use moligod_core::task::Cancellation;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Inputs {
    pub schema_version: u32,
    pub values: BTreeMap<String, ValueBlock>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ValueType {
    Number,
    String,
    Boolean,
    Any,
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SelectorMode {
    Number,
    String,
    Variable,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum ValueBlock {
    Literal {
        value: Value,
    },
    Variable {
        name: String,
        value_type: ValueType,
    },
    Selector {
        mode: SelectorMode,
        value: Value,
    },
    Expression {
        source: String,
        value_type: ValueType,
    },
    Binary {
        op: String,
        left: Box<ValueBlock>,
        right: Box<ValueBlock>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        strict_equality: Option<bool>,
    },
    Not {
        value: Box<ValueBlock>,
    },
    Query {
        action: Box<Action>,
    },
}
pub enum Compiled {
    Expr(Expr, ValueType),
    AutoVariable(String, ValueType),
    Binary(String, Box<Compiled>, Box<Compiled>, bool),
    Not(Box<Compiled>),
    Query(Box<Action>, ValueType),
}
fn compatible(actual: ValueType, expected: ValueType) -> bool {
    expected == ValueType::Any || actual == expected
}
impl ValueBlock {
    fn contains_selector(&self) -> bool {
        match self {
            Self::Selector { .. } => true,
            Self::Binary { left, right, .. } => {
                left.contains_selector() || right.contains_selector()
            }
            Self::Not { value } => value.contains_selector(),
            _ => false,
        }
    }
    fn contains_strict_equality(&self) -> bool {
        match self {
            Self::Binary {
                left,
                right,
                strict_equality,
                ..
            } => {
                strict_equality.is_some()
                    || left.contains_strict_equality()
                    || right.contains_strict_equality()
            }
            Self::Not { value } => value.contains_strict_equality(),
            _ => false,
        }
    }
    pub fn query_actions<'a>(&'a self, out: &mut Vec<&'a Action>) {
        match self {
            Self::Query { action } => out.push(action),
            Self::Binary { left, right, .. } => {
                left.query_actions(out);
                right.query_actions(out);
            }
            Self::Not { value } => value.query_actions(out),
            _ => {}
        }
    }
    fn compile(
        &self,
        depth: usize,
        count: &mut usize,
        expected: ValueType,
    ) -> Result<(Compiled, ValueType), String> {
        *count += 1;
        if depth > 16 || *count > 128 {
            return Err("取值积木超过16层或128个".into());
        }
        let expr = |expr, kind| Ok((Compiled::Expr(expr, kind), kind));
        match self {
            Self::Literal { value } => {
                let kind = if value.is_number() {
                    ValueType::Number
                } else if value.is_boolean() {
                    ValueType::Boolean
                } else if value.is_string() {
                    ValueType::String
                } else if value.is_null() {
                    ValueType::Any
                } else {
                    return Err("取值只支持数字、文字、布尔值和空值".into());
                };
                if value.to_string().len() > 4096 {
                    return Err("取值内容过长".into());
                }
                expr(Expr::Literal(value.clone()), kind)
            }
            Self::Variable { name, value_type } => {
                crate::engine::validate_variable(name)?;
                expr(Expr::Variable(name.clone()), *value_type)
            }
            Self::Selector { mode, value } => match mode {
                SelectorMode::Number if value.is_number() => {
                    expr(Expr::Literal(value.clone()), ValueType::Number)
                }
                SelectorMode::String if value.as_str().is_some_and(|text| text.len() <= 4096) => {
                    expr(Expr::Literal(value.clone()), ValueType::String)
                }
                SelectorMode::Variable => {
                    let name = value.as_str().ok_or("变量名无效")?;
                    crate::engine::validate_variable(name)?;
                    Ok((Compiled::AutoVariable(name.to_owned(), expected), expected))
                }
                _ => Err("取值积木内容无效".into()),
            },
            Self::Expression { source, value_type } => {
                expr(expression::compile(source)?, *value_type)
            }
            Self::Not { value } => {
                let (v, kind) = value.compile(depth + 1, count, ValueType::Boolean)?;
                if kind != ValueType::Boolean {
                    return Err("取反需要条件积木".into());
                }
                Ok((Compiled::Not(Box::new(v)), ValueType::Boolean))
            }
            Self::Binary {
                op,
                left,
                right,
                strict_equality,
            } => {
                let operand_type = match op.as_str() {
                    "&&" | "||" => ValueType::Boolean,
                    "<" | ">" | "<=" | ">=" | "+" | "-" | "*" | "/" | "%" => ValueType::Number,
                    _ => ValueType::Any,
                };
                let (a, ak) = left.compile(depth + 1, count, operand_type)?;
                let (b, bk) = right.compile(depth + 1, count, operand_type)?;
                let kind = match op.as_str() {
                    "&&" | "||" if ak == ValueType::Boolean && bk == ValueType::Boolean => {
                        ValueType::Boolean
                    }
                    "==" | "!=" => ValueType::Boolean,
                    "<" | ">" | "<=" | ">="
                        if ak == ValueType::Number && bk == ValueType::Number =>
                    {
                        ValueType::Boolean
                    }
                    "+" | "-" | "*" | "/" | "%"
                        if ak == ValueType::Number && bk == ValueType::Number =>
                    {
                        ValueType::Number
                    }
                    _ => return Err("运算符或取值类型不匹配".into()),
                };
                let strict_equality =
                    matches!(op.as_str(), "==" | "!=") && strict_equality.unwrap_or(false);
                Ok((
                    Compiled::Binary(op.clone(), Box::new(a), Box::new(b), strict_equality),
                    kind,
                ))
            }
            Self::Query { action } => {
                let kind = match action.as_ref() {
                    Action::Ocr {
                        region,
                        variable,
                        reuse: false,
                        numbers_only,
                        numeric_result,
                        ..
                    } => {
                        crate::engine::validate_region(region)?;
                        crate::engine::validate_variable(variable)?;
                        if *numeric_result && !*numbers_only {
                            return Err("数字结果需要勾选仅保留数字".into());
                        }
                        if *numeric_result {
                            expected
                        } else {
                            ValueType::String
                        }
                    }
                    Action::Match {
                        region,
                        variable,
                        template,
                        threshold,
                        save_position: false,
                        template_point,
                        ..
                    } => {
                        if template_point.is_some_and(|point| point.x >= 512 || point.y >= 512) {
                            return Err("模板选点坐标无效".into());
                        }
                        crate::engine::validate_region(region)?;
                        crate::engine::validate_variable(variable)?;
                        if template.len() != 64
                            || !template.bytes().all(|b| b.is_ascii_hexdigit())
                            || !threshold.is_finite()
                            || !(0.0..=1.0).contains(threshold)
                        {
                            return Err("图像匹配参数无效".into());
                        }
                        ValueType::Boolean
                    }
                    _ => return Err("嵌套查询只支持实时读取文字或查找图片".into()),
                };
                Ok((Compiled::Query(action.clone(), kind), kind))
            }
        }
    }
    pub fn adapt(&mut self, source: u32, current: u32) -> Result<(), String> {
        match self {
            Self::Query { action } => {
                **action = crate::coordinates::adapt(action, source, current)?
            }
            Self::Binary { left, right, .. } => {
                left.adapt(source, current)?;
                right.adapt(source, current)?;
            }
            Self::Not { value } => value.adapt(source, current)?,
            _ => {}
        }
        Ok(())
    }
}
impl Inputs {
    pub fn compile(&self, action: &Action) -> Result<BTreeMap<String, Compiled>, String> {
        if ![1, 2, 3].contains(&self.schema_version)
            || self.values.is_empty()
            || (self.schema_version == 1 && self.values.values().any(ValueBlock::contains_selector))
            || (self.schema_version < 3
                && self
                    .values
                    .values()
                    .any(ValueBlock::contains_strict_equality))
        {
            return Err("取值积木版本或内容无效".into());
        }
        let mut count = 0;
        self.values
            .iter()
            .map(|(key, value)| {
                let expected = match (action, key.as_str()) {
                    (Action::Wait { .. }, "seconds") | (Action::Loop { .. }, "count") => {
                        ValueType::Number
                    }
                    (
                        Action::If { .. }
                        | Action::ElseIf { .. }
                        | Action::Assert { .. }
                        | Action::WaitUntil { .. }
                        | Action::HoldUntil { .. },
                        "expression",
                    ) => ValueType::Boolean,
                    (Action::Set { .. }, "value") | (Action::Calculate { .. }, "expression") => {
                        ValueType::Any
                    }
                    (Action::Text { .. } | Action::Notify { .. }, "text") => ValueType::String,
                    _ => return Err("动作不支持此取值插槽".into()),
                };
                let (compiled, kind) = value.compile(0, &mut count, expected)?;
                if !compatible(kind, expected) {
                    return Err("取值与动作插槽类型不匹配".into());
                }
                Ok((key.clone(), compiled))
            })
            .collect()
    }
}
fn checked(value: Value, kind: ValueType) -> Result<Value, String> {
    if kind == ValueType::Number && value.is_null() {
        return Err("识别结果为空，无法用于数字运算，请先判断是否为空".into());
    }
    if kind == ValueType::Number && value.is_string() {
        return expression::number(&value)
            .map(|number| json!(number))
            .map_err(|_| {
                if value.as_str().is_some_and(|text| text.trim().is_empty()) {
                    "变量或查询结果与取值积木类型不匹配：数字文字为空，请检查识别结果".into()
                } else {
                    "变量或查询结果与取值积木类型不匹配：文字不是有效数字，请检查识别结果".into()
                }
            });
    }
    if kind == ValueType::String && value.is_number() {
        return Ok(json!(value.to_string()));
    }
    if kind == ValueType::Any
        || (kind == ValueType::Number && value.is_number())
        || (kind == ValueType::String && value.is_string())
        || (kind == ValueType::Boolean && value.is_boolean())
    {
        Ok(value)
    } else {
        Err("变量或查询结果与取值积木类型不匹配".into())
    }
}
fn checked_auto(value: Value, kind: ValueType) -> Result<Value, String> {
    if kind == ValueType::String && !value.is_string() {
        let text = value.to_string();
        if text.len() > 4096 {
            return Err("取值内容过长".into());
        }
        Ok(json!(text))
    } else {
        checked(value, kind)
    }
}
impl Compiled {
    pub fn eval(
        &self,
        vars: &BTreeMap<String, Value>,
        driver: &mut impl Driver,
        bindings: &Bindings,
        cancel: &Cancellation,
    ) -> Result<Value, String> {
        match self {
            Self::Expr(expr, kind) => checked(expr.eval(vars)?, *kind),
            Self::AutoVariable(name, kind) => {
                let value = vars
                    .get(name)
                    .cloned()
                    .ok_or_else(|| format!("变量 {name} 尚未赋值"))?;
                checked_auto(value, *kind)
            }
            Self::Query(action, kind) => {
                if cancel.is_cancelled() {
                    return Err("查询已取消".into());
                }
                let result = driver
                    .perform(action, bindings, cancel)?
                    .ok_or("查询未返回结果")?
                    .1;
                if cancel.is_cancelled() {
                    return Err("取值查询已取消或超时".into());
                }
                checked_auto(result, *kind)
            }
            Self::Not(value) => Ok(json!(!value
                .eval(vars, driver, bindings, cancel)?
                .as_bool()
                .ok_or("取反需要条件")?)),
            Self::Binary(op, left, right, strict_equality) => {
                let a = left.eval(vars, driver, bindings, cancel)?;
                if op == "&&" && a == json!(false) {
                    return Ok(json!(false));
                }
                if op == "||" && a == json!(true) {
                    return Ok(json!(true));
                }
                let b = right.eval(vars, driver, bindings, cancel)?;
                if *strict_equality {
                    let equal = a == b
                        || (a.is_number()
                            && b.is_number()
                            && expression::number(&a)? == expression::number(&b)?);
                    return Ok(json!(if op == "==" { equal } else { !equal }));
                }
                // Reuse the existing bounded operator implementation, including division checks.
                Expr::Binary(
                    op.clone(),
                    Box::new(Expr::Literal(a)),
                    Box::new(Expr::Literal(b)),
                )
                .eval(vars)
            }
        }
    }
}
