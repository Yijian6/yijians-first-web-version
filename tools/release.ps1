$ErrorActionPreference = 'Stop'

function Invoke-Checked([string]$Exe, [string[]]$ArgList) {
  $resolvedExe = switch ($Exe) {
    'npm' { 'npm.cmd'; break }
    'wrangler' { 'wrangler.cmd'; break }
    default { $Exe }
  }
  & $resolvedExe @ArgList
  if ($LASTEXITCODE -ne 0) {
    throw "$resolvedExe failed with exit code $LASTEXITCODE"
  }
}

$branch = (git branch --show-current).Trim()
if ($branch -ne 'master') {
  throw "Release must run on master; current branch is '$branch'."
}

$changes = git status --porcelain
if ($changes) {
  throw "Working tree is dirty. Commit or ignore every file before release."
}

Invoke-Checked 'npm' @('run', 'verify')
Invoke-Checked 'git' @('push', 'origin', 'master')

$sha = (git rev-parse HEAD).Trim()
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$archive = [System.IO.Path]::GetFullPath((Join-Path $tempRoot "yijian6-$sha.zip"))
$deployDir = [System.IO.Path]::GetFullPath((Join-Path $tempRoot "yijian6-$sha"))

if (-not $archive.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Archive path escaped the temporary directory."
}
if (-not $deployDir.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Deploy path escaped the temporary directory."
}

try {
  git archive --format=zip --output=$archive HEAD
  if ($LASTEXITCODE -ne 0) { throw "git archive failed with exit code $LASTEXITCODE" }

  Expand-Archive -LiteralPath $archive -DestinationPath $deployDir -Force
  Invoke-Checked 'wrangler' @('pages', 'deploy', $deployDir, '--project-name=yijian6', '--branch=master')
  $workerConfig = Join-Path $deployDir 'universe-worker/wrangler.toml'
  if (Test-Path -LiteralPath $workerConfig) {
    Invoke-Checked 'wrangler' @('deploy', '--config', $workerConfig)
  }
  Invoke-Checked 'node' @('tools/production-media-smoke.mjs', 'https://yijian6.pages.dev')
}
finally {
  if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
  }
  if (Test-Path -LiteralPath $deployDir) {
    Remove-Item -LiteralPath $deployDir -Recurse -Force
  }
}
