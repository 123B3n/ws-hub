# PowerShell script to prepare the application for IIS deployment

Write-Output "Building WebSocket Server for IIS deployment"

# Ensure directory exists
$scriptsDir = Join-Path $PSScriptRoot "scripts"
if (-not (Test-Path $scriptsDir)) {
    New-Item -ItemType Directory -Path $scriptsDir -Force | Out-Null
}

# Install dependencies
Write-Output "Installing dependencies..."
npm ci

# Build the TypeScript code
Write-Output "Building TypeScript code..."
npm run build

# Copy web.config to root if it's not already there
$webConfigSrc = Join-Path $PSScriptRoot "src\web.config"
$webConfigDest = Join-Path $PSScriptRoot "web.config"

if (Test-Path $webConfigSrc) {
    Write-Output "Copying web.config to project root..."
    Copy-Item -Path $webConfigSrc -Destination $webConfigDest -Force
    Write-Output "web.config copied successfully."
} else {
    Write-Output "Warning: web.config not found in src directory."
    Write-Output "Creating default web.config..."
    
    $webConfigContent = @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path="dist/server-direct.js" verb="*" modules="iisnode" />
    </handlers>
    <rewrite>
      <rules>
        <rule name="NodeInspector" patternSyntax="ECMAScript" stopProcessing="true">
          <match url="^server-direct.js\/debug[\/]?" />
        </rule>
        <rule name="StaticContent">
          <action type="Rewrite" url="public{{REQUEST_URI}}" />
        </rule>
        <rule name="DynamicContent">
          <conditions>
            <add input="{{REQUEST_FILENAME}}" matchType="IsFile" negate="True" />
          </conditions>
          <action type="Rewrite" url="dist/server-direct.js" />
        </rule>
      </rules>
    </rewrite>
    <iisnode 
      nodeProcessCommandLine="%programfiles%\nodejs\node.exe"
      watchedFiles="dist\*.js;web.config"
      loggingEnabled="true"
      logDirectory="iisnode"
      debuggingEnabled="true"
    />
    <webSocket enabled="true" />
  </system.webServer>
</configuration>
"@

    $webConfigContent | Out-File -FilePath $webConfigDest -Encoding utf8
    Write-Output "Default web.config created."
}

# Create directories for IIS logs
$iisnodeDir = Join-Path $PSScriptRoot "iisnode"
$certsDir = Join-Path $PSScriptRoot "certs"
$logsDir = Join-Path $PSScriptRoot "logs"

if (-not (Test-Path $iisnodeDir)) {
    Write-Output "Creating iisnode logs directory..."
    New-Item -ItemType Directory -Path $iisnodeDir -Force | Out-Null
}

if (-not (Test-Path $certsDir)) {
    Write-Output "Creating certs directory..."
    New-Item -ItemType Directory -Path $certsDir -Force | Out-Null
}

if (-not (Test-Path $logsDir)) {
    Write-Output "Creating logs directory..."
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

Write-Output "Build completed successfully."
Write-Output ""
Write-Output "To deploy to IIS:"
Write-Output "1. Create a new IIS website or application"
Write-Output "2. Set the physical path to: $PSScriptRoot"
Write-Output "3. Make sure iisnode and URL Rewrite modules are installed"
Write-Output "4. Ensure the application pool has appropriate permissions"
Write-Output "5. Browse to your website to start the application"
Write-Output ""
Write-Output "For more details, see iis-deployment-guide.md"
