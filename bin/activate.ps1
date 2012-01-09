# This is a translation of `activate` with the addition of putting
# the latest 2.x Python version (>=PYTHON_MIN_VERSION) on the Path.

"Note: this PowerShell SDK activation script is experimental."

$script:PYTHON_MIN_VERSION = [decimal]2.5

function global:deactivate($nondestructive) {
    if (Test-Path Env:_OLD_VIRTUAL_PATH) {
        $Env:Path = $Env:_OLD_VIRTUAL_PATH;
        Remove-Item Env:_OLD_VIRTUAL_PATH;
    }

    if (Test-Path Function:_OLD_VIRTUAL_PROMPT) {
        Set-Content Function:Prompt (Get-Content Function:_OLD_VIRTUAL_PROMPT);
        Remove-Item Function:_OLD_VIRTUAL_PROMPT;
    }

    if (Test-Path Env:_OLD_PYTHONPATH) {
        if ($Env:_OLD_PYTHONPATH -ne 'NONE') {
            $Env:PYTHONPATH = $Env:_OLD_PYTHONPATH;
        }
        else {
            Remove-Item Env:PYTHONPATH;
        }
        Remove-Item Env:_OLD_PYTHONPATH;
    }

    if (Test-Path Env:CUDDLEFISH_ROOT) {
        Remove-Item Env:CUDDLEFISH_ROOT;
    }

    if (Test-Path Env:VIRTUAL_ENV) {
        Remove-Item Env:VIRTUAL_ENV;
    }

    if (-not $nondestructive) {
        Remove-Item Function:deactivate;
    }
}

deactivate $True;

$script:PyInstallPathKey = (
    @('HKCU:SOFTWARE\Python\PythonCore\*\InstallPath',
    'HKLM:SOFTWARE\Python\PythonCore\*\InstallPath',
    'HKLM:SOFTWARE\Wow6432Node\Python\PythonCore\*\InstallPath',
    'HKCU:SOFTWARE\Wow6432Node\Python\PythonCore\*\InstallPath') |
    Where-Object { Test-Path $_ } |
    ForEach-Object {
        Get-ChildItem $_ |
        Add-Member -MemberType ScriptProperty `
            -Name ParentName -Value {Split-Path -Leaf $this.PSParentPath} `
            -PassThru |
        Where-Object { $_.ParentName -match '2\.\d+$' } |
        Add-Member -MemberType ScriptProperty `
            -Name Version -Value {[decimal]$this.ParentName} -PassThru |
        Where-Object { $_.Version -ge $PYTHON_MIN_VERSION }
        Sort-Object Version |
        Select-Object -Last 1
        } |
    Sort-Object Version |
    Select-Object -Last 1 );

if (!$PyInstallPathKey) {
    "Error: A recent version of Python 2.x must be installed.";
    return
}

$script:PyInstallPath = $PyInstallPathKey.GetValue('');
ForEach($subdir in @('', 'PCBuild', 'PCBuild\amd64')) {
    $script:PossiblePyExePath = (
        Join-Path (Join-Path $PyInstallPath $subdir) python.exe);
    if (Test-Path $PossiblePyExePath) {
        $script:PyExeDir = Split-Path $PossiblePyExePath
        break;
    }
}

if (!$PyExeDir) {
    "Error: Unable to find python.exe in installation path " + $PyInstallPath
    return;
}

if (Test-Path Env:PYTHONPATH) {
    $Env:_OLD_PYTHONPATH = $Env:PYTHONPATH
} else {
    $Env:_OLD_PYTHONPATH = 'NONE'
};
$Env:_OLD_VIRTUAL_PATH = $Env:PATH;

$Env:VIRTUAL_ENV = (Get-Location);
$Env:CUDDLEFISH_ROOT = $Env:VIRTUAL_ENV;
$Env:PYTHONPATH = "$Env:VIRTUAL_ENV\python-lib;$Env:PYTHONPATH";
$Env:PATH = "$PyExeDir;$Env:VIRTUAL_ENV\bin;$Env:PATH";

function global:_OLD_VIRTUAL_PROMPT {};
Set-Content Function:_OLD_VIRTUAL_PROMPT (Get-Content Function:Prompt);
Set-Content Function:prompt { "($Env:VIRTUAL_ENV) $(_OLD_VIRTUAL_PROMPT)"; };

python -c "from jetpack_sdk_env import welcome; welcome()"
