use crate::{
    expression::{self, Expr},
    model::*,
};
use moligod_core::task::Cancellation;
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

pub trait Driver {
    fn set_scale(&mut self, _scale: Option<u32>) {}
    fn resolve_window(&mut self, _title: &str) -> Result<BoundWindow, String> {
        Err("当前驱动不支持设置窗口".into())
    }
    fn perform(
        &mut self,
        action: &Action,
        bindings: &Bindings,
        cancel: &Cancellation,
    ) -> Result<Option<(String, Value)>, String>;
}
pub struct Plan {
    pub script: Script,
    expressions: HashMap<usize, Expr>,
    regex: HashMap<usize, regex::Regex>,
    inputs: HashMap<usize, std::collections::BTreeMap<String, crate::inputs::Compiled>>,
    next: Vec<usize>,
    end: Vec<usize>,
    loop_start: Vec<usize>,
    labels: HashMap<String, usize>,
}
fn flatten_steps(steps: &[Step], depth: u8, out: &mut Vec<Step>) -> Result<(), String> {
    if depth > 16 {
        return Err("动作组嵌套超过16层".into());
    }
    for step in steps {
        if out.len() >= 1000 {
            return Err("执行步骤超过1000步".into());
        }
        if let Action::Group {
            name,
            steps: children,
        } = &step.action
        {
            if name.trim().is_empty()
                || name.len() > 64
                || step.delay_ms > 0
                || step.random_delay_ms > 0
                || step.inputs.is_some()
            {
                return Err("动作组名称或延时无效".into());
            }
            flatten_steps(children, depth + 1, out)?;
        } else {
            out.push(step.clone());
        }
    }
    Ok(())
}
impl Plan {
    pub fn compile(mut script: Script) -> Result<Self, String> {
        if script
            .scale
            .is_some_and(|scale| !(50..=1000).contains(&scale))
        {
            return Err("脚本缩放必须为50–1000%".into());
        }
        let mut flattened = Vec::new();
        flatten_steps(&script.steps, 0, &mut flattened)?;
        script.steps = flattened;
        if ![1, 2, 3, 4].contains(&script.schema_version)
            || script.name.trim().is_empty()
            || script.name.len() > 100
            || script.steps.is_empty()
            || script.steps.len() > 1000
            || script.repeats > 100000
            || script.max_run_seconds == 0
            || script.max_run_seconds > 86400
            || script.start_delay_ms > 86400000
            || script.interval_ms > 3600000
        {
            return Err("脚本版本、规模或运行时长无效".into());
        }
        let n = script.steps.len();
        let mut plan = Self {
            script,
            expressions: HashMap::new(),
            regex: HashMap::new(),
            inputs: HashMap::new(),
            next: vec![n; n],
            end: vec![n; n],
            loop_start: vec![n; n],
            labels: HashMap::new(),
        };
        let mut stack: Vec<(usize, bool, Vec<usize>)> = Vec::new();
        let mut scopes = vec![Vec::new(); n];
        for (i, step) in plan.script.steps.iter().enumerate() {
            let mut queries = Vec::new();
            if let Some(inputs) = &step.inputs {
                for value in inputs.values.values() {
                    value.query_actions(&mut queries);
                }
            }
            if plan.script.schema_version < 4
                && (matches!(
                    step.action,
                    Action::Match {
                        template_point: Some(_),
                        ..
                    }
                ) || queries.iter().any(|action| {
                    matches!(
                        action,
                        Action::Match {
                            template_point: Some(_),
                            ..
                        }
                    )
                }))
            {
                return Err("图片选点需要脚本版本4".into());
            }
            if plan.script.schema_version < 3
                && (matches!(
                    step.action,
                    Action::Ocr {
                        numeric_result: true,
                        ..
                    }
                ) || queries.iter().any(|action| {
                    matches!(
                        action,
                        Action::Ocr {
                            numeric_result: true,
                            ..
                        }
                    )
                }))
            {
                return Err("数字识别结果需要脚本版本3".into());
            }
            if let Some(inputs) = &step.inputs {
                if plan.script.schema_version < 2 {
                    return Err("嵌套取值需要脚本版本2".into());
                }
                plan.inputs.insert(i, inputs.compile(&step.action)?);
            }
            if matches!(step.action, Action::HoldUntil { .. }) && plan.script.schema_version < 2 {
                return Err("条件等待需要脚本版本2".into());
            }
            if step.delay_ms > 60000 || step.random_delay_ms > 60000 {
                return Err(format!("第 {} 步延时超过限制", i + 1));
            }
            scopes[i] = stack.iter().map(|(start, _, _)| *start).collect();
            if stack.len() > 32 {
                return Err("控制流嵌套超过 32 层".into());
            }
            match &step.action {
                Action::Wait { ms } if *ms > 3600000 => return Err("单次等待超过 1 小时".into()),
                Action::Click {
                    x,
                    y,
                    hold_ms,
                    jitter,
                    position,
                    ..
                } if (position.is_none() && (*x < 0 || *y < 0))
                    || *hold_ms > 60000
                    || *jitter > 100 =>
                {
                    return Err("点击参数无效".into())
                }
                Action::Drag {
                    from_x,
                    from_y,
                    to_x,
                    to_y,
                    duration_ms,
                    ..
                } if [from_x, from_y, to_x, to_y].iter().any(|value| **value < 0)
                    || *duration_ms == 0
                    || *duration_ms > 60000 =>
                {
                    return Err("拖动坐标或时长无效".into())
                }
                Action::Scroll { x, y, delta, .. }
                    if *x < 0 || *y < 0 || *delta == 0 || delta.abs() > 1200 =>
                {
                    return Err("滚动参数无效".into())
                }
                Action::Key { keys, hold_ms, .. }
                    if keys.is_empty()
                        || keys.len() > 8
                        || keys.iter().any(|key| !(8..=254).contains(key))
                        || *hold_ms > 60000 =>
                {
                    return Err("按键参数无效".into())
                }
                Action::SetWindow { title, .. }
                    if title.trim().is_empty() || title.len() > 4096 =>
                {
                    return Err("请填写有效窗口标题".into());
                }
                Action::Text { text, .. } if text.len() > 4096 => return Err("文本过长".into()),
                Action::Click {
                    position: Some(name),
                    ..
                } => validate_variable(name)?,
                Action::KeyDown { keys } | Action::KeyUp { keys }
                    if keys.is_empty()
                        || keys.len() > 8
                        || keys.iter().any(|key| !(8..=254).contains(key)) =>
                {
                    return Err("按键参数无效".into())
                }
                Action::RunTask { task_id } if !crate::tasks::id_valid(task_id) => {
                    return Err("请选择要运行的任务".into())
                }
                Action::WaitUntil {
                    timeout_ms,
                    interval_ms,
                    ..
                }
                | Action::HoldUntil {
                    timeout_ms,
                    interval_ms,
                    ..
                } if !(100..=3600000).contains(timeout_ms)
                    || !(100..=60000).contains(interval_ms) =>
                {
                    return Err("等待条件的超时或检查间隔无效".into())
                }
                Action::Ocr {
                    numbers_only: false,
                    numeric_result: true,
                    ..
                } => {
                    return Err("数字结果需要勾选仅保留数字".into());
                }
                Action::Ocr {
                    region, variable, ..
                }
                | Action::Match {
                    region, variable, ..
                } => {
                    validate_region(region)?;
                    validate_variable(variable)?;
                }
                Action::Capture {
                    region,
                    name,
                    directory,
                    ..
                } => {
                    capture_directory(std::path::Path::new("."), directory.as_deref())?;
                    validate_region(region)?;
                    if !safe_name(name) {
                        return Err("截图名称无效".into());
                    }
                }
                Action::Set { variable, value } => {
                    validate_variable(variable)?;
                    if value.is_array() || value.is_object() || value.to_string().len() > 4096 {
                        return Err("变量值过大或类型无效".into());
                    }
                }
                Action::Calculate { variable, .. } => validate_variable(variable)?,
                Action::Regex {
                    variable,
                    pattern,
                    result,
                } => {
                    validate_variable(variable)?;
                    validate_variable(result)?;
                    if pattern.len() > 2048 {
                        return Err("正则表达式过长".into());
                    }
                    plan.regex
                        .insert(i, regex::Regex::new(pattern).map_err(|e| e.to_string())?);
                }
                Action::Comment { text } if text.len() > 4096 => return Err("注释过长".into()),
                Action::Notify { text }
                    if (text.trim().is_empty()
                        && !step
                            .inputs
                            .as_ref()
                            .is_some_and(|v| v.values.contains_key("text")))
                        || text.len() > 4096 =>
                {
                    return Err("请填写提示内容（不超过4096字节）".into())
                }
                _ => {}
            }
            if let Action::Match {
                template,
                threshold,
                template_point,
                ..
            } = &step.action
            {
                if template_point.is_some_and(|point| point.x >= 512 || point.y >= 512) {
                    return Err("模板选点坐标无效".into());
                }
                if template.len() != 64
                    || !template.bytes().all(|b| b.is_ascii_hexdigit())
                    || !threshold.is_finite()
                    || !(0.0..=1.0).contains(threshold)
                {
                    return Err("图像匹配参数无效".into());
                }
            }
            match &step.action {
                Action::If { expression }
                | Action::ElseIf { expression }
                | Action::Assert { expression, .. }
                | Action::Calculate { expression, .. }
                | Action::WaitUntil { expression, .. }
                | Action::HoldUntil { expression, .. }
                    if !step
                        .inputs
                        .as_ref()
                        .is_some_and(|v| v.values.contains_key("expression")) =>
                {
                    plan.expressions.insert(
                        i,
                        expression::compile(expression)
                            .map_err(|e| format!("第 {} 步：{e}", i + 1))?,
                    );
                }
                _ => {}
            }
            match &step.action {
                Action::If { .. } => stack.push((i, false, vec![i])),
                Action::Loop { count } => {
                    if *count > 1000000 {
                        return Err("循环次数过大".into());
                    }
                    stack.push((i, true, Vec::new()));
                }
                Action::WaitUntil { .. } => stack.push((i, true, Vec::new())),
                Action::ElseIf { .. } | Action::Else => {
                    let (_, is_loop, branches) = stack.last_mut().ok_or("分支缺少 If")?;
                    if *is_loop {
                        return Err("分支跨越循环".into());
                    }
                    if branches
                        .iter()
                        .any(|b| matches!(plan.script.steps[*b].action, Action::Else))
                    {
                        return Err("Else 之后不能再添加分支".into());
                    }
                    branches.push(i);
                }
                Action::EndIf | Action::EndLoop | Action::EndWaitUntil => {
                    let (start, is_loop, branches) = stack.pop().ok_or("多余的结束步骤")?;
                    if is_loop != matches!(step.action, Action::EndLoop | Action::EndWaitUntil)
                        || matches!(step.action, Action::EndWaitUntil)
                            != matches!(plan.script.steps[start].action, Action::WaitUntil { .. })
                    {
                        return Err("控制块结束类型不匹配".into());
                    }
                    if is_loop {
                        plan.end[start] = i;
                        plan.loop_start[i] = start;
                    } else {
                        for (j, branch) in branches.iter().enumerate() {
                            plan.end[*branch] = i;
                            plan.next[*branch] = branches.get(j + 1).copied().unwrap_or(i);
                        }
                    }
                }
                Action::Break | Action::Continue => {
                    if !stack.iter().any(|(_, is_loop, _)| *is_loop) {
                        return Err("Break/Continue 必须位于循环内".into());
                    }
                }
                Action::Label { name }
                    if !safe_name(name) || plan.labels.insert(name.clone(), i).is_some() =>
                {
                    return Err("标签无效或重复".into())
                }
                _ => {}
            }
        }
        if !stack.is_empty() {
            return Err("控制块未闭合".into());
        }
        for (i, step) in plan.script.steps.iter().enumerate() {
            if let Action::Goto { label } = &step.action {
                let target = *plan.labels.get(label).ok_or("跳转标签不存在")?;
                if scopes[i] != scopes[target] {
                    return Err("跳转不能跨越循环或条件块边界".into());
                }
            }
        }
        Ok(plan)
    }
    fn input(
        &self,
        pc: usize,
        key: &str,
        vars: &std::collections::BTreeMap<String, Value>,
        driver: &mut impl Driver,
        bindings: &Bindings,
        cancel: &Cancellation,
    ) -> Result<Option<Value>, String> {
        self.inputs
            .get(&pc)
            .and_then(|inputs| inputs.get(key))
            .map(|v| v.eval(vars, driver, bindings, cancel))
            .transpose()
    }
    fn condition(
        &self,
        pc: usize,
        vars: &std::collections::BTreeMap<String, Value>,
        driver: &mut impl Driver,
        bindings: &Bindings,
        cancel: &Cancellation,
    ) -> Result<bool, String> {
        match self.input(pc, "expression", vars, driver, bindings, cancel)? {
            Some(value) => value.as_bool().ok_or("条件必须返回布尔值".into()),
            None => self.expressions[&pc].test(vars),
        }
    }
    pub fn run(
        &self,
        driver: &mut impl Driver,
        bindings: &Bindings,
        cancel: &Cancellation,
        mut report: impl FnMut(Status),
    ) -> Result<Status, String> {
        driver.set_scale(self.script.scale);
        let mut status = Status {
            running: true,
            phase: "running".into(),
            total_steps: self
                .script
                .execution_map
                .iter()
                .max()
                .map_or(self.script.steps.len(), |i| i + 1),
            task_name: self.script.name.clone(),
            ..Status::default()
        };
        let mut emitted = Instant::now() - Duration::from_secs(1);
        let mut random = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos() as u64;
        if self.script.start_delay_ms > 0 {
            status.phase = "scheduled".into();
            report(status.clone());
            if cancel.wait(Duration::from_millis(u64::from(self.script.start_delay_ms))) {
                status.running = false;
                status.phase = "stopped".into();
                return Ok(status);
            }
            status.phase = "running".into();
        }
        let started = Instant::now();
        let mut iteration = 0;
        'outer: while self.script.repeats == 0 || iteration < self.script.repeats {
            iteration += 1;
            status.round = iteration;
            let mut active_bindings = bindings.clone();
            for step in &self.script.steps {
                if let Action::SetWindow { target, .. } = &step.action {
                    active_bindings.remove(target);
                }
            }
            let mut pc = 0;
            let mut loops: Vec<(usize, u32)> = Vec::new();
            let mut deadlines = HashMap::new();
            let mut branches = HashSet::new();
            while pc < self.script.steps.len() {
                if cancel.is_cancelled() {
                    break 'outer;
                }
                if started.elapsed() > Duration::from_secs(u64::from(self.script.max_run_seconds)) {
                    return Err("达到脚本最长运行时间".into());
                }
                if loops.iter().any(|(start, _)| {
                    deadlines
                        .get(start)
                        .is_some_and(|deadline| Instant::now() >= *deadline)
                }) {
                    return Err("等待条件超时".into());
                }
                let run_deadline =
                    started + Duration::from_secs(u64::from(self.script.max_run_seconds));
                let wait_deadline = loops
                    .iter()
                    .filter_map(|(start, _)| deadlines.get(start))
                    .copied()
                    .min();
                let deadline = wait_deadline.map_or(run_deadline, |d| d.min(run_deadline));
                let timeout = if wait_deadline.is_some_and(|d| d <= run_deadline) {
                    "等待条件超时"
                } else {
                    "达到脚本最长运行时间"
                };
                let action_cancel = cancel.with_deadline(deadline);
                let wait = |duration| -> Result<bool, String> {
                    let stopped = action_cancel.wait(duration);
                    if stopped && !cancel.is_cancelled() {
                        return Err(timeout.into());
                    }
                    Ok(stopped)
                };
                status.step = self.script.execution_map.get(pc).copied().unwrap_or(pc);
                status.executed += 1;
                // Publish before work so a long wait/capture shows the current step.
                if emitted.elapsed() >= Duration::from_millis(100)
                    || matches!(
                        self.script.steps[pc].action,
                        Action::Wait { ms: 100.. }
                            | Action::Ocr { .. }
                            | Action::Click { .. }
                            | Action::Drag { .. }
                            | Action::Key { .. }
                            | Action::Text { .. }
                            | Action::Focus { .. }
                            | Action::Capture { .. }
                            | Action::Match { .. }
                    )
                    || self.script.steps[pc].delay_ms >= 100
                {
                    report(status.clone());
                    emitted = Instant::now();
                }
                if status.executed > 1_000_000 {
                    return Err("达到步骤执行上限".into());
                }
                let step = &self.script.steps[pc];
                random ^= random << 13;
                random ^= random >> 7;
                random ^= random << 17;
                let delay = u64::from(step.delay_ms)
                    + if step.random_delay_ms > 0 {
                        random % (u64::from(step.random_delay_ms) + 1)
                    } else {
                        0
                    };
                if wait(Duration::from_millis(delay))? {
                    break 'outer;
                }
                let mut next = pc + 1;
                match &step.action {
                    Action::Wait { ms } => {
                        let duration = if let Some(value) = self.input(
                            pc,
                            "seconds",
                            &status.variables,
                            driver,
                            &active_bindings,
                            &action_cancel,
                        )? {
                            let seconds = value
                                .as_f64()
                                .filter(|v| v.is_finite() && (0.0..=3600.0).contains(v))
                                .ok_or("等待秒数必须为0–3600")?;
                            Duration::from_secs_f64(seconds)
                        } else {
                            Duration::from_millis(u64::from(*ms))
                        };
                        if wait(duration)? {
                            break 'outer;
                        }
                    }
                    Action::Set { variable, value } => {
                        let value = self
                            .input(
                                pc,
                                "value",
                                &status.variables,
                                driver,
                                &active_bindings,
                                &action_cancel,
                            )?
                            .unwrap_or_else(|| value.clone());
                        status.variables.insert(variable.clone(), value);
                    }
                    Action::Calculate { variable, .. } => {
                        let result = match self.input(
                            pc,
                            "expression",
                            &status.variables,
                            driver,
                            &active_bindings,
                            &action_cancel,
                        )? {
                            Some(value) => value,
                            None => self.expressions[&pc].eval(&status.variables)?,
                        };
                        status.variables.insert(variable.clone(), result);
                    }
                    Action::If { .. } => {
                        if self.condition(
                            pc,
                            &status.variables,
                            driver,
                            &active_bindings,
                            &action_cancel,
                        )? {
                            branches.insert(self.end[pc]);
                        } else {
                            next = self.next[pc];
                        }
                    }
                    Action::ElseIf { .. } => {
                        if branches.contains(&self.end[pc]) {
                            next = self.end[pc];
                        } else if self.condition(
                            pc,
                            &status.variables,
                            driver,
                            &active_bindings,
                            &action_cancel,
                        )? {
                            branches.insert(self.end[pc]);
                        } else {
                            next = self.next[pc];
                        }
                    }
                    Action::Else => {
                        if branches.contains(&self.end[pc]) {
                            next = self.end[pc];
                        } else {
                            branches.insert(self.end[pc]);
                        }
                    }
                    Action::EndIf => {
                        branches.remove(&pc);
                    }
                    Action::Loop { count } => {
                        let count = if let Some(value) = self.input(
                            pc,
                            "count",
                            &status.variables,
                            driver,
                            &active_bindings,
                            &action_cancel,
                        )? {
                            value
                                .as_f64()
                                .filter(|v| {
                                    v.is_finite()
                                        && v.fract() == 0.0
                                        && (0.0..=1_000_000.0).contains(v)
                                })
                                .ok_or("循环次数必须为0–1000000的整数")?
                                as u32
                        } else {
                            *count
                        };
                        loops.push((pc, count));
                    }
                    Action::HoldUntil {
                        timeout_ms,
                        interval_ms,
                        ..
                    } => {
                        let local_deadline =
                            Instant::now() + Duration::from_millis(u64::from(*timeout_ms));
                        let query_cancel = action_cancel.with_deadline(local_deadline);
                        loop {
                            let result = self.condition(
                                pc,
                                &status.variables,
                                driver,
                                &active_bindings,
                                &query_cancel,
                            );
                            if cancel.is_cancelled() {
                                break 'outer;
                            }
                            if query_cancel.is_cancelled() {
                                return Err(if local_deadline <= deadline {
                                    "等待条件超时"
                                } else {
                                    timeout
                                }
                                .into());
                            }
                            if result? {
                                break;
                            }
                            query_cancel.wait(Duration::from_millis(u64::from(*interval_ms)));
                        }
                    }
                    Action::WaitUntil { timeout_ms, .. } => {
                        deadlines.insert(
                            pc,
                            Instant::now() + Duration::from_millis(u64::from(*timeout_ms)),
                        );
                        loops.push((pc, 0));
                    }
                    Action::EndWaitUntil => {
                        let (start, _) = *loops.last().ok_or("等待条件缺少开始")?;
                        let result = self.condition(
                            start,
                            &status.variables,
                            driver,
                            &active_bindings,
                            &action_cancel,
                        );
                        if cancel.is_cancelled() {
                            break 'outer;
                        }
                        if action_cancel.is_cancelled() {
                            return Err(timeout.into());
                        }
                        if result? {
                            loops.pop();
                        } else {
                            let Action::WaitUntil { interval_ms, .. } =
                                self.script.steps[start].action
                            else {
                                return Err("等待条件结束不匹配".into());
                            };
                            let remaining =
                                deadlines[&start].saturating_duration_since(Instant::now());
                            if remaining.is_zero() {
                                return Err("等待条件超时".into());
                            }
                            if wait(remaining.min(Duration::from_millis(u64::from(interval_ms))))? {
                                break 'outer;
                            }
                            next = start + 1;
                        }
                    }
                    Action::RunTask { .. } => return Err("子任务尚未展开".into()),
                    Action::EndLoop => {
                        let (start, remaining) = loops.last_mut().ok_or("循环栈无效")?;
                        if *remaining == 0 {
                            next = *start + 1;
                        } else if *remaining > 1 {
                            *remaining -= 1;
                            next = *start + 1;
                        } else {
                            loops.pop();
                        }
                    }
                    Action::Break => {
                        let (start, _) = loops.pop().ok_or("没有可退出的循环")?;
                        next = self.end[start] + 1;
                        branches.retain(|end| *end >= next);
                    }
                    Action::Continue => {
                        let (start, _) = loops.last().ok_or("没有可继续的循环")?;
                        next = self.end[*start];
                        branches.retain(|end| *end >= next);
                    }
                    Action::SetWindow { target, title } => {
                        let window = driver
                            .resolve_window(title)
                            .map_err(|e| format!("第 {} 步：{e}", pc + 1))?;
                        active_bindings.insert(target.clone(), window);
                    }
                    Action::Goto { label } => next = self.labels[label],
                    Action::Label { .. } | Action::Comment { .. } => {}
                    Action::Notify { text } => {
                        let text = if let Some(value) = self.input(
                            pc,
                            "text",
                            &status.variables,
                            driver,
                            &active_bindings,
                            &action_cancel,
                        )? {
                            value.as_str().ok_or("提示内容需要文字")?.to_owned()
                        } else {
                            expand(text, &status.variables)?
                        };
                        if status.logs.len() >= 80 {
                            status.logs.remove(0);
                        }
                        status.logs.push(format!("提示：{text}"));
                        status.notice = Some(text);
                        report(status.clone());
                        emitted = Instant::now();
                    }
                    Action::Assert {
                        message,
                        stop_when_true,
                        ..
                    } => {
                        if self.condition(
                            pc,
                            &status.variables,
                            driver,
                            &active_bindings,
                            &action_cancel,
                        )? == *stop_when_true
                        {
                            report(status.clone());
                            let reason = if message.is_empty() {
                                "已停止任务".to_string()
                            } else {
                                format!("已停止任务：{message}")
                            };
                            if *stop_when_true {
                                status.running = false;
                                status.phase = "stopped".into();
                                status.error = Some(reason);
                                return Ok(status);
                            }
                            return Err(reason);
                        }
                    }
                    Action::Regex {
                        variable, result, ..
                    } => {
                        let value = status.variables.get(variable).ok_or("匹配变量不存在")?;
                        let text = value
                            .as_str()
                            .map(str::to_owned)
                            .unwrap_or_else(|| value.to_string());
                        status
                            .variables
                            .insert(result.clone(), json!(self.regex[&pc].is_match(&text)));
                    }
                    action => {
                        let mut position_scale = None;
                        let expanded = if let Action::Click {
                            position: Some(name),
                            target,
                            ..
                        } = action
                        {
                            let point = status
                                .variables
                                .get(name)
                                .ok_or("位置变量不存在，请先查找图片")?;
                            let mut resolved = action.clone();
                            let Action::Click { position, x, y, .. } = &mut resolved else {
                                unreachable!()
                            };
                            *x = point["x"]
                                .as_i64()
                                .and_then(|v| i32::try_from(v).ok())
                                .filter(|v| *v >= 0)
                                .ok_or("未找到图片或位置变量无效")?;
                            *y = point["y"]
                                .as_i64()
                                .and_then(|v| i32::try_from(v).ok())
                                .filter(|v| *v >= 0)
                                .ok_or("未找到图片或位置变量无效")?;
                            if point["target"]
                                != serde_json::to_value(target).map_err(|e| e.to_string())?
                            {
                                return Err("位置变量属于另一个窗口".into());
                            }
                            position_scale = point["scale"]
                                .as_u64()
                                .and_then(|v| u32::try_from(v).ok())
                                .filter(|v| (50..=1000).contains(v));
                            if position_scale.is_none() {
                                return Err("位置变量缺少有效缩放信息".into());
                            }
                            *position = None;
                            Some(resolved)
                        } else if let Action::Text { target, text } = action {
                            Some(Action::Text {
                                target: target.clone(),
                                text: if let Some(value) = self.input(
                                    pc,
                                    "text",
                                    &status.variables,
                                    driver,
                                    &active_bindings,
                                    &action_cancel,
                                )? {
                                    value.as_str().ok_or("输入内容需要文字")?.to_owned()
                                } else {
                                    expand(text, &status.variables)?
                                },
                            })
                        } else {
                            None
                        };
                        if let Some(scale) = position_scale {
                            driver.set_scale(Some(scale));
                        }
                        let performed = driver
                            .perform(
                                expanded.as_ref().unwrap_or(action),
                                &active_bindings,
                                &action_cancel,
                            )
                            .map_err(|e| format!("第 {} 步：{e}", status.step + 1));
                        if position_scale.is_some() {
                            driver.set_scale(self.script.scale);
                        }
                        if action_cancel.is_cancelled() && !cancel.is_cancelled() {
                            return Err(timeout.into());
                        }
                        if let Some((name, value)) = performed? {
                            status.variables.insert(name, value);
                        }
                    }
                }
                if status.variables.len() > 128 {
                    return Err("变量数量超过限制".into());
                }
                if status.logs.len() >= 80 {
                    status.logs.remove(0);
                }
                status.logs.push(format!("第 {} 步完成", status.step + 1));
                if matches!(step.action, Action::Ocr { .. })
                    || emitted.elapsed() >= Duration::from_millis(100)
                {
                    report(status.clone());
                    emitted = Instant::now();
                }
                if status.executed.is_multiple_of(64) && cancel.wait(Duration::from_millis(1)) {
                    break 'outer;
                }
                pc = next;
            }
            if (self.script.repeats == 0 || iteration < self.script.repeats)
                && self.script.interval_ms > 0
                && cancel.wait(Duration::from_millis(u64::from(self.script.interval_ms)))
            {
                break;
            }
        }
        status.running = false;
        status.phase = if cancel.is_cancelled() {
            "stopped"
        } else {
            "completed"
        }
        .into();
        Ok(status)
    }
}
fn expand(text: &str, vars: &std::collections::BTreeMap<String, Value>) -> Result<String, String> {
    let mut output = String::new();
    let mut rest = text;
    while let Some((prefix, tail)) = rest.split_once("${") {
        output.push_str(prefix);
        let (name, next) = tail.split_once('}').ok_or("文本变量未闭合")?;
        let value = vars
            .get(name)
            .ok_or_else(|| format!("文本变量 {name} 不存在"))?;
        output.push_str(
            &value
                .as_str()
                .map(str::to_owned)
                .unwrap_or_else(|| value.to_string()),
        );
        if output.len() > 4096 {
            return Err("展开后的文本超过限制".into());
        }
        rest = next;
    }
    output.push_str(rest);
    if output.len() > 4096 {
        return Err("展开后的文本超过限制".into());
    }
    Ok(output)
}
pub(crate) fn validate_variable(name: &str) -> Result<(), String> {
    if valid_variable(name) {
        Ok(())
    } else {
        Err("变量名无效".into())
    }
}
pub fn capture_directory(
    base: &std::path::Path,
    selected: Option<&str>,
) -> Result<std::path::PathBuf, String> {
    match selected {
        None => Ok(base.join("captures")),
        Some(path)
            if !path.contains('\0')
                && path.len() <= 32767
                && std::path::Path::new(path).is_absolute() =>
        {
            Ok(path.into())
        }
        _ => Err("截图保存位置必须是完整文件夹路径".into()),
    }
}
pub fn safe_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 64
        && name
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
}
pub(crate) fn validate_region(r: &Region) -> Result<(), String> {
    if r.x < 0
        || r.y < 0
        || r.width == 0
        || r.height == 0
        || u64::from(r.width) * u64::from(r.height) > 16_000_000
    {
        Err("识别区域无效或过大".into())
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;
    #[test]
    fn regex_if_selects_the_branch_without_an_intermediate_action() {
        let plan = Plan::compile(script(vec![
            Action::Set {
                variable: "result_A".into(),
                value: json!("123"),
            },
            Action::If {
                expression: r#"result_A =~ "^[0-9]+$""#.into(),
            },
            Action::Set {
                variable: "matched".into(),
                value: json!(true),
            },
            Action::Else,
            Action::Set {
                variable: "matched".into(),
                value: json!(false),
            },
            Action::EndIf,
        ]))
        .unwrap();
        let status = plan
            .run(
                &mut NoIo,
                &Bindings::new(),
                &Cancellation::default(),
                |_| {},
            )
            .unwrap();
        assert_eq!(status.variables["matched"], json!(true));
    }
    #[test]
    fn capture_paths_preserve_legacy_default_and_validate_selected_folder() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            capture_directory(dir.path(), None).unwrap(),
            dir.path().join("captures")
        );
        let selected = dir.path().join("selected");
        let selected_text = selected.to_str().unwrap();
        assert_eq!(
            capture_directory(dir.path(), Some(selected_text)).unwrap(),
            selected
        );
        for invalid in ["", "relative", "../escape", "bad\0path"] {
            assert!(capture_directory(dir.path(), Some(invalid)).is_err());
        }
        let legacy = json!({"type":"capture","target":"A","region":{"x":0,"y":0,"width":10,"height":10},"name":"capture"});
        let old: Action = serde_json::from_value(legacy.clone()).unwrap();
        assert!(serde_json::to_value(old)
            .unwrap()
            .get("directory")
            .is_none());
        let mut configured = legacy;
        configured["directory"] = json!(selected_text);
        let action: Action = serde_json::from_value(configured.clone()).unwrap();
        assert_eq!(serde_json::to_value(&action).unwrap(), configured);
        assert!(Plan::compile(script(vec![action])).is_ok());
        configured["directory"] = json!("relative");
        let action: Action = serde_json::from_value(configured).unwrap();
        assert!(Plan::compile(script(vec![action])).is_err());
    }
    struct NoIo;
    #[test]
    fn notification_reports_text_and_continues_without_native_input() {
        let mut source = script(vec![
            Action::Set {
                variable: "name".into(),
                value: json!("小明"),
            },
            Action::Notify {
                text: "你好，${name}".into(),
            },
            Action::Set {
                variable: "after".into(),
                value: json!(true),
            },
        ]);
        source.repeats = 30;
        let mut notices = 0;
        let status = Plan::compile(source)
            .unwrap()
            .run(
                &mut NoIo,
                &Bindings::new(),
                &Cancellation::default(),
                |status| {
                    if status.notice.as_deref() == Some("你好，小明") && status.step == 1 {
                        notices += 1;
                    }
                },
            )
            .unwrap();
        assert_eq!(notices, 30);
        assert_eq!(status.phase, "completed");
        assert_eq!(status.variables["after"], true);
        assert_eq!(status.notice.as_deref(), Some("你好，小明"));
        assert!(status.logs.iter().any(|line| line == "提示：你好，小明"));
        assert!(status.logs.len() <= 80);
        for text in [" ".to_string(), "x".repeat(4097)] {
            assert!(Plan::compile(script(vec![Action::Notify { text }])).is_err());
        }
        let stopped = Plan::compile(script(vec![Action::Assert {
            expression: "true".into(),
            message: "".into(),
            stop_when_true: true,
        }]))
        .unwrap()
        .run(
            &mut NoIo,
            &Bindings::new(),
            &Cancellation::default(),
            |_| {},
        )
        .unwrap();
        assert_eq!(stopped.error.as_deref(), Some("已停止任务"));
    }
    #[test]
    fn stop_condition_preserves_legacy_and_stops_new_true_conditions() {
        for (flag, expr, fails) in [
            (None, "1 == 1", false),
            (None, "1 == 2", true),
            (Some(true), "1 == 1", true),
            (Some(true), "1 == 2", false),
        ] {
            let mut raw = json!({"type":"assert","expression":expr,"message":"余额不足"});
            if let Some(value) = flag {
                raw["stopWhenTrue"] = value.into();
            }
            let action: Action = serde_json::from_value(raw.clone()).unwrap();
            assert_eq!(serde_json::to_value(&action).unwrap(), raw);
            let plan = Plan::compile(script(vec![
                action,
                Action::Set {
                    variable: "after".into(),
                    value: json!(1),
                },
            ]))
            .unwrap();
            let result = plan.run(
                &mut NoIo,
                &Bindings::new(),
                &Cancellation::default(),
                |_| {},
            );
            if fails && flag == Some(true) {
                let stopped = result.unwrap();
                assert_eq!(stopped.phase, "stopped");
                assert!(stopped.error.unwrap().contains("余额不足"));
                assert!(!stopped.variables.contains_key("after"));
            } else if fails {
                assert!(result.unwrap_err().contains("余额不足"));
            } else {
                assert_eq!(result.unwrap().variables["after"], 1);
            }
        }
    }
    impl Driver for NoIo {
        fn perform(
            &mut self,
            _: &Action,
            _: &Bindings,
            _: &Cancellation,
        ) -> Result<Option<(String, Value)>, String> {
            panic!("unexpected IO")
        }
    }
    fn script(actions: Vec<Action>) -> Script {
        Script {
            execution_map: Vec::new(),
            scale: None,
            schema_version: 1,
            name: "test".into(),
            repeats: 1,
            max_run_seconds: 10,
            start_delay_ms: 0,
            interval_ms: 0,
            steps: actions
                .into_iter()
                .map(|action| Step {
                    inputs: None,
                    annotation: None,
                    delay_ms: 0,
                    random_delay_ms: 0,
                    action,
                })
                .collect(),
        }
    }
    struct WindowIo {
        seen: Vec<String>,
    }
    #[test]
    fn wait_until_runs_probes_before_testing_and_times_out_native_work() {
        let actions = vec![
            Action::Set {
                variable: "count".into(),
                value: json!(0),
            },
            Action::WaitUntil {
                expression: "count >= 3".into(),
                timeout_ms: 1000,
                interval_ms: 100,
            },
            Action::Calculate {
                variable: "count".into(),
                expression: "count+1".into(),
            },
            Action::EndWaitUntil,
        ];
        let status = Plan::compile(script(actions))
            .unwrap()
            .run(
                &mut NoIo,
                &Bindings::new(),
                &Cancellation::default(),
                |_| {},
            )
            .unwrap();
        assert_eq!(status.variables["count"], 3.0);
        struct Blocking;
        impl Driver for Blocking {
            fn perform(
                &mut self,
                _: &Action,
                _: &Bindings,
                cancel: &Cancellation,
            ) -> Result<Option<(String, Value)>, String> {
                assert!(cancel.wait(Duration::from_secs(60)));
                Err("cancelled".into())
            }
        }
        let token = Cancellation::default();
        let start = Instant::now();
        let plan = Plan::compile(script(vec![
            Action::WaitUntil {
                expression: "false".into(),
                timeout_ms: 100,
                interval_ms: 100,
            },
            Action::WaitUntil {
                expression: "false".into(),
                timeout_ms: 1000,
                interval_ms: 100,
            },
            Action::Focus { target: Slot::A },
            Action::EndWaitUntil,
            Action::EndWaitUntil,
        ]))
        .unwrap();
        assert!(plan
            .run(&mut Blocking, &Bindings::new(), &token, |_| {})
            .unwrap_err()
            .contains("等待条件超时"));
        assert!(start.elapsed() < Duration::from_secs(1));
        assert!(!token.is_cancelled());
        let mut wrong = plan.script.clone();
        wrong.steps.last_mut().unwrap().action = Action::EndLoop;
        assert!(Plan::compile(wrong).is_err());
    }
    #[test]
    fn wait_until_delay_is_bounded_and_stop_interrupts_poll_interval() {
        let plan = Plan::compile(script(vec![
            Action::WaitUntil {
                expression: "false".into(),
                timeout_ms: 100,
                interval_ms: 100,
            },
            Action::Wait { ms: 60000 },
            Action::EndWaitUntil,
        ]))
        .unwrap();
        let start = Instant::now();
        assert!(plan
            .run(
                &mut NoIo,
                &Bindings::new(),
                &Cancellation::default(),
                |_| {}
            )
            .unwrap_err()
            .contains("超时"));
        assert!(start.elapsed() < Duration::from_secs(1));
        let plan = Plan::compile(script(vec![
            Action::WaitUntil {
                expression: "false".into(),
                timeout_ms: 60000,
                interval_ms: 60000,
            },
            Action::EndWaitUntil,
        ]))
        .unwrap();
        let token = Cancellation::default();
        let child = token.clone();
        let worker = std::thread::spawn(move || {
            plan.run(&mut NoIo, &Bindings::new(), &child, |_| {})
                .unwrap()
        });
        std::thread::sleep(Duration::from_millis(30));
        token.cancel();
        assert_eq!(worker.join().unwrap().phase, "stopped");
    }
    #[test]
    fn found_position_feeds_click_with_its_scale_and_rejects_missing_or_wrong_window() {
        struct Points {
            point: Value,
            scale: Option<u32>,
            clicks: Vec<(i32, i32, Option<u32>)>,
        }
        impl Driver for Points {
            fn set_scale(&mut self, scale: Option<u32>) {
                self.scale = scale;
            }
            fn perform(
                &mut self,
                action: &Action,
                _: &Bindings,
                _: &Cancellation,
            ) -> Result<Option<(String, Value)>, String> {
                match action {
                    Action::Match { variable, .. } => {
                        Ok(Some((variable.clone(), self.point.clone())))
                    }
                    Action::Click { x, y, position, .. } => {
                        assert!(position.is_none());
                        self.clicks.push((*x, *y, self.scale));
                        Ok(None)
                    }
                    _ => panic!("unexpected IO"),
                }
            }
        }
        let find:Action=serde_json::from_value(json!({"type":"match","target":"A","region":{"x":10,"y":20,"width":100,"height":100},"variable":"result","template":"a".repeat(64),"threshold":1,"savePosition":true})).unwrap();
        let click: Action = serde_json::from_value(
            json!({"type":"click","target":"A","position":"result","x":-1,"y":-1,"button":"left"}),
        )
        .unwrap();
        let mut source = script(vec![find, click]);
        source.scale = Some(100);
        let plan = Plan::compile(source).unwrap();
        let mut driver = Points {
            point: json!({"x":45,"y":80,"scale":150,"target":"A"}),
            scale: None,
            clicks: Vec::new(),
        };
        plan.run(
            &mut driver,
            &Bindings::new(),
            &Cancellation::default(),
            |_| {},
        )
        .unwrap();
        assert_eq!(driver.clicks, [(45, 80, Some(150))]);
        assert_eq!(driver.scale, Some(100));
        for point in [
            Value::Null,
            json!(true),
            json!({"x":1,"y":2,"scale":150,"target":"B"}),
            json!({"x":1,"y":2,"scale":0,"target":"A"}),
        ] {
            driver.point = point;
            driver.clicks.clear();
            assert!(plan
                .run(
                    &mut driver,
                    &Bindings::new(),
                    &Cancellation::default(),
                    |_| {}
                )
                .is_err());
            assert!(driver.clicks.is_empty());
        }
        assert!(expression::compile("result != null")
            .unwrap()
            .test(&std::collections::BTreeMap::from([(
                "result".into(),
                json!({"x":1})
            )]))
            .unwrap());
        assert!(!expression::compile("result != null")
            .unwrap()
            .test(&std::collections::BTreeMap::from([(
                "result".into(),
                Value::Null
            )]))
            .unwrap());
    }
    impl Driver for WindowIo {
        fn resolve_window(&mut self, title: &str) -> Result<BoundWindow, String> {
            if title == "missing" {
                return Err("not found".into());
            }
            Ok(BoundWindow {
                hwnd: 1,
                pid: 1,
                title: title.into(),
                width: 800,
                height: 600,
            })
        }
        fn perform(
            &mut self,
            action: &Action,
            bindings: &Bindings,
            _: &Cancellation,
        ) -> Result<Option<(String, Value)>, String> {
            if let Action::Focus { target } = action {
                self.seen
                    .push(bindings.get(target).ok_or("not bound")?.title.clone());
            }
            Ok(None)
        }
    }
    #[test]
    fn window_binding_changes_in_execution_order_and_stays_local() {
        let actions = vec![
            Action::SetWindow {
                target: Slot::A,
                title: "ChatGPT".into(),
            },
            Action::Focus { target: Slot::A },
            Action::SetWindow {
                target: Slot::A,
                title: "Editor".into(),
            },
            Action::Focus { target: Slot::A },
        ];
        let mut source = script(actions);
        source.repeats = 2;
        let serialized = serde_json::to_string(&source).unwrap();
        let plan = Plan::compile(serde_json::from_str(&serialized).unwrap()).unwrap();
        let initial = Bindings::new();
        let mut driver = WindowIo { seen: vec![] };
        plan.run(&mut driver, &initial, &Cancellation::default(), |_| {})
            .unwrap();
        assert_eq!(driver.seen, ["ChatGPT", "Editor", "ChatGPT", "Editor"]);
        assert!(initial.is_empty());
    }
    #[test]
    fn skipped_or_failed_window_binding_does_not_use_stale_binding() {
        let mut driver = WindowIo { seen: vec![] };
        let initial = Bindings::from([(Slot::A, driver.resolve_window("old").unwrap())]);
        for actions in [
            vec![
                Action::If {
                    expression: "false".into(),
                },
                Action::SetWindow {
                    target: Slot::A,
                    title: "skipped".into(),
                },
                Action::EndIf,
                Action::Focus { target: Slot::A },
            ],
            vec![
                Action::Focus { target: Slot::A },
                Action::SetWindow {
                    target: Slot::A,
                    title: "later".into(),
                },
            ],
            vec![
                Action::SetWindow {
                    target: Slot::A,
                    title: "missing".into(),
                },
                Action::Focus { target: Slot::A },
            ],
        ] {
            let plan = Plan::compile(script(actions)).unwrap();
            assert!(plan
                .run(&mut driver, &initial, &Cancellation::default(), |_| {})
                .is_err());
        }
        assert!(driver.seen.is_empty());
        assert!(Plan::compile(script(vec![Action::SetWindow {
            target: Slot::A,
            title: " ".into()
        }]))
        .is_err());
    }
    #[test]
    fn interval_wait_wakes_on_task_stop() {
        let mut recurring = script(vec![Action::Wait { ms: 0 }]);
        recurring.repeats = 0;
        recurring.interval_ms = 5000;
        let plan = Plan::compile(recurring).unwrap();
        let cancel = Cancellation::default();
        let stop = cancel.clone();
        let started = Instant::now();
        let worker =
            std::thread::spawn(move || plan.run(&mut NoIo, &Bindings::new(), &cancel, |_| {}));
        std::thread::sleep(Duration::from_millis(20));
        stop.cancel();
        let status = worker.join().unwrap().unwrap();
        assert_eq!(status.phase, "stopped");
        assert!(started.elapsed() < Duration::from_secs(1));
    }
    #[test]
    fn nested_branches_and_loop_control() {
        let plan = Plan::compile(script(vec![
            Action::Set {
                variable: "x".into(),
                value: json!(0),
            },
            Action::Loop { count: 4 },
            Action::Calculate {
                variable: "x".into(),
                expression: "x+1".into(),
            },
            Action::If {
                expression: "x == 2".into(),
            },
            Action::Continue,
            Action::ElseIf {
                expression: "x >= 3".into(),
            },
            Action::Break,
            Action::Else,
            Action::Comment {
                text: "first".into(),
            },
            Action::EndIf,
            Action::EndLoop,
        ]))
        .unwrap();
        let result = plan
            .run(
                &mut NoIo,
                &BTreeMap::new(),
                &Cancellation::default(),
                |_| {},
            )
            .unwrap();
        assert_eq!(result.variables["x"], json!(3.0));
    }
    #[test]
    fn rejects_bad_control_flow_before_input() {
        assert!(Plan::compile(script(vec![Action::Else])).is_err());
        assert!(Plan::compile(script(vec![Action::Loop { count: 1 }])).is_err());
        assert!(Plan::compile(script(vec![Action::Goto {
            label: "missing".into()
        }]))
        .is_err());
    }
    #[test]
    fn cancellation_interrupts_long_wait() {
        let plan = Plan::compile(script(vec![Action::Wait { ms: 60000 }])).unwrap();
        let token = Cancellation::default();
        let cancel = token.clone();
        let thread =
            std::thread::spawn(move || plan.run(&mut NoIo, &BTreeMap::new(), &token, |_| {}));
        std::thread::sleep(Duration::from_millis(20));
        cancel.cancel();
        assert_eq!(thread.join().unwrap().unwrap().phase, "stopped");
    }
}
