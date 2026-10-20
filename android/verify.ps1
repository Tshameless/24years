param([switch]$SkipLint)
$ErrorActionPreference = 'Stop'
$previousLocation = Get-Location
$previousJavaHome = $env:JAVA_HOME
try {
    Set-Location $PSScriptRoot
    if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/java.exe'))) {
        $javaCommand = Get-Command java -ErrorAction Stop
        $env:JAVA_HOME = Split-Path (Split-Path $javaCommand.Source -Parent) -Parent
        if (-not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/javac.exe'))) { throw 'Please configure JAVA_HOME to an installed JDK (17 or 21).' }
    }
    $tasks = @(':app:assembleDebug', ':core:domain:test', ':core:database:testDebugUnitTest')
    if (-not $SkipLint) { $tasks += ':app:lintDebug' }
    & ./gradlew.bat @tasks --no-daemon --console=plain
    if ($LASTEXITCODE -ne 0) { throw "Gradle verification failed with exit code $LASTEXITCODE" }
} finally {
    $env:JAVA_HOME = $previousJavaHome
    Set-Location $previousLocation
}
