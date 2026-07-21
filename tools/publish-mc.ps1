# publish-mc.ps1 — Minecraft 思考空间一键发布
# 用法：双击仓库根目录的 发布文章.cmd，或 powershell -File tools/publish-mc.ps1
$ErrorActionPreference = 'Stop'

Set-Location (Split-Path -Parent $PSScriptRoot)

function Invoke-Checked([string]$Exe, [string[]]$ArgList) {
  $resolvedExe = switch ($Exe) {
    'npm' { 'npm.cmd'; break }
    default { $Exe }
  }
  & $resolvedExe @ArgList
  if ($LASTEXITCODE -ne 0) {
    throw "$resolvedExe 运行失败（退出码 $LASTEXITCODE）"
  }
}

Write-Host ''
Write-Host '========================================='
Write-Host '   Minecraft 思考空间 · 一键发布'
Write-Host '========================================='
Write-Host ''

# 0. 分支检查
$branch = (git branch --show-current).Trim()
if ($branch -ne 'master') {
  throw "当前在分支 '$branch'，发布必须在 master 分支上进行。"
}

# 1. 检查是否有「文章内容之外」的未提交改动（避免误提交别的东西）
$changes = git -c core.quotepath=false status --porcelain
$nonContent = @()
foreach ($line in @($changes)) {
  if (-not $line) { continue }
  $file = $line.Substring(3)
  if ($file -match ' -> ') { $file = ($file -split ' -> ')[-1] }
  $file = $file.Trim('"')
  if ($file -notlike 'content/minecraft/*' -and $file -notlike 'mc/*') {
    $nonContent += $file
  }
}
if ($nonContent.Count -gt 0) {
  Write-Host '以下文件有未提交的改动，但它们不属于文章内容：' -ForegroundColor Yellow
  foreach ($f in $nonContent) { Write-Host "  - $f" -ForegroundColor Yellow }
  throw '为避免误发布，请先处理这些文件（可以打开 Claude Code 说一句「帮我处理未提交的改动」），再重新运行发布。'
}

# 2. 构建
Write-Host '[1/4] 正在构建页面……'
Invoke-Checked 'npm' @('run', 'build:mc')

# 3. 质量检查
Write-Host '[2/4] 正在做质量检查……'
Invoke-Checked 'npm' @('run', 'check')

# 4. 提交内容
Write-Host '[3/4] 正在提交内容……'
Invoke-Checked 'git' @('add', 'content/minecraft', 'mc')

$staged = git -c core.quotepath=false diff --cached --name-only
if (-not $staged) {
  # 没有新内容，但检查上次发布是否没走完（本地领先远程 = 有提交没推上去）
  $ahead = 0
  try { $ahead = [int](git rev-list origin/master..master --count 2>$null) } catch {}
  if ($ahead -gt 0) {
    Write-Host ''
    Write-Host "发现上次未完成的发布（$ahead 个提交还没上线），正在重试……" -ForegroundColor Yellow
  } else {
    Write-Host ''
    Write-Host '没有发现新内容，无需发布。' -ForegroundColor Green
    exit 0
  }
} else {
  $articleCount = @($staged | Where-Object { $_ -like 'content/minecraft/*.md' -and $_ -notlike '*_*.md' }).Count
  $msg = "content: update Minecraft world ($articleCount article(s))"
  Invoke-Checked 'git' @('commit', '-m', $msg)
}

# 5. 标准发布流程（verify + push + 部署，全自动，约 2-5 分钟）
Write-Host '[4/4] 正在发布上线（含全套兼容性测试，约 2-5 分钟，请耐心等待）……'
try {
  Invoke-Checked 'powershell' @('-NoProfile', '-File', 'tools/release.ps1')
} catch {
  Write-Host ''
  Write-Host '发布上线这一步失败了（多为网络波动）。' -ForegroundColor Red
  Write-Host '你的文章已经安全保存，不会丢。稍等片刻，重新双击「发布文章.cmd」即可重试。' -ForegroundColor Yellow
  throw
}

Write-Host ''
Write-Host '=========================================' -ForegroundColor Green
Write-Host '  ✅ 已上线！你的楼长高了。' -ForegroundColor Green
Write-Host '  世界入口：https://yijian6.pages.dev/minecraft.html' -ForegroundColor Green
Write-Host '=========================================' -ForegroundColor Green
