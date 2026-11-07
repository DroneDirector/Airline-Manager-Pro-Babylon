; The PC installer (Inno Setup, free for commercial use). Its own app id, folder, shortcuts and uninstall entry:
; it installs beside the main game's PC app and never touches it. A newer version installs over the old one and
; keeps your settings.
#define MyVer GetEnv('AMPB_VERSION')
[Setup]
AppId={{8C2E5B4A-3F71-4D2B-9A6E-B4B1C0A7E513}
AppName=Airport Dynasty Pro
AppVersion={#MyVer}
AppVerName=Airport Dynasty Pro {#MyVer}
AppPublisher=DroneDirector
DefaultDirName={autopf}\Airport Dynasty Pro
DefaultGroupName=Airport Dynasty Pro
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=build
OutputBaseFilename=AirlineManagerProBabylon-PC-Setup-{#MyVer}
SetupIconFile=app.ico
UninstallDisplayIcon={app}\AirlineManagerProBabylon.exe
UninstallDisplayName=Airport Dynasty Pro
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes

[Tasks]
Name: "desktopicon"; Description: "Make a shortcut on the desktop"; GroupDescription: "Shortcuts:"

[Files]
Source: "build\Airport Dynasty Pro PC\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
; the shortcuts under the game's earlier name
Type: files; Name: "{autoprograms}\Airline Manager Pro Babylon.lnk"
Type: files; Name: "{autodesktop}\Airline Manager Pro Babylon.lnk"

[Icons]
Name: "{autoprograms}\Airport Dynasty Pro"; Filename: "{app}\AirlineManagerProBabylon.exe"; IconFilename: "{app}\app.ico"
Name: "{autodesktop}\Airport Dynasty Pro"; Filename: "{app}\AirlineManagerProBabylon.exe"; IconFilename: "{app}\app.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\AirlineManagerProBabylon.exe"; Description: "Start Airport Dynasty Pro"; Flags: nowait postinstall skipifsilent
