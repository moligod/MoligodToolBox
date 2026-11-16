param(
    [Parameter(Mandatory)][int]$RootProcessId,
    [ValidateRange(5, 60)][int]$Seconds = 20,
    [string]$OutputFile = 'artifacts/process-baseline.json'
)
$ErrorActionPreference = 'Stop'
$root = Get-Process -Id $RootProcessId
$rootStart = $root.StartTime.ToUniversalTime().ToString('o')
$cpuCount = [Environment]::ProcessorCount
function Read-TreeSample {
    $rows = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
    $ids = [Collections.Generic.HashSet[int]]::new()
    [void]$ids.Add($RootProcessId)
    do {
        $added = $false
        foreach ($row in $rows) {
            if ($ids.Contains([int]$row.ParentProcessId) -and $ids.Add([int]$row.ProcessId)) { $added = $true }
        }
    } while ($added)
    $processes = @(& {
        foreach ($processId in $ids) {
            $p = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($null -ne $p) {
                [pscustomobject]@{
                    id = $p.Id; name = $p.ProcessName; startedAt = $p.StartTime.ToUniversalTime().ToString('o')
                    cpuSeconds = $p.TotalProcessorTime.TotalSeconds
                    workingSetBytes = $p.WorkingSet64; privateBytes = $p.PrivateMemorySize64
                    handles = $p.HandleCount; threads = $p.Threads.Count
                }
            }
        }
    })
    [pscustomobject]@{ at = [DateTime]::UtcNow; processes = $processes }
}
$before = Read-TreeSample
Start-Sleep -Seconds $Seconds
$after = Read-TreeSample
$elapsed = ($after.at - $before.at).TotalSeconds
$delta = 0.0
foreach ($p in $after.processes) {
    $old = $before.processes | Where-Object { $_.id -eq $p.id -and $_.startedAt -eq $p.startedAt }
    if ($null -ne $old) { $delta += [Math]::Max(0, $p.cpuSeconds - $old.cpuSeconds) }
}
$result = [pscustomobject]@{
    capturedAt = $after.at.ToString('o'); rootProcessId = $RootProcessId; rootStartedAt = $rootStart
    seconds = $elapsed; logicalProcessors = $cpuCount
    cpuPercentOneCore = [Math]::Round($delta / $elapsed * 100, 3)
    cpuPercentMachine = [Math]::Round($delta / $elapsed / $cpuCount * 100, 3)
    privateMiB = [Math]::Round(($after.processes | Measure-Object privateBytes -Sum).Sum / 1MB, 2)
    workingSetMiB = [Math]::Round(($after.processes | Measure-Object workingSetBytes -Sum).Sum / 1MB, 2)
    processCount = $after.processes.Count
    processSetStable = (($before.processes.id | Sort-Object) -join ',') -eq (($after.processes.id | Sort-Object) -join ',')
    note = 'CPU uses surviving same-start-time processes; reject CPU sample if processSetStable is false. Working set can double-count shared pages.'
    before = $before; after = $after
}
$folder = Split-Path -Parent $OutputFile
if ($folder) { New-Item -ItemType Directory -Force -Path $folder | Out-Null }
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputFile -Encoding utf8
$result | Select-Object seconds, processCount, processSetStable, cpuPercentOneCore, cpuPercentMachine, privateMiB, workingSetMiB
