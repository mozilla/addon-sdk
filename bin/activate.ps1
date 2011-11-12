# This is a translation of `activate` with the addition of putting 
# the latest 2.x Python version on the Path.

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
        if ($Env:_OLD_PYTHON_PATH -ne 'REMOVE') {
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

$Env:_OLD_PYTHONPATH = if (Test-Path Env:PYTHONPATH) { $Env:PYTHONPATH } else { 'REMOVE' };
$Env:_OLD_VIRTUAL_PATH = $Env:PATH;

$Env:VIRTUAL_ENV = (Get-Location);
$Env:CUDDLEFISH_ROOT = $Env:VIRTUAL_ENV;
$Env:PYTHONPATH = "$Env:VIRTUAL_ENV\python-lib;$Env:PYTHONPATH";
$Env:PATH = "$Env:VIRTUAL_ENV\bin;$Env:PATH";

$PyRegKey = (
    @('HKCU:SOFTWARE\Python\PythonCore',
    'HKLM:SOFTWARE\Python\PythonCore',
    'HKLM:SOFTWARE\Wow6432Node\Python\PythonCore',
    'HKCU:SOFTWARE\Wow6432Node\Python\PythonCore') |
    Where-Object { Test-Path $_ } |
    ForEach-Object {(
        Get-ChildItem $_ |
        Where-Object { $_.PSChildName -LIKE '2.*' } |
        Sort-Object -Property Name |
        Select-Object -Last 1 )} |
    Select-Object -First 1 )

$PyInstallPath = $PyRegKey.OpenSubKey('InstallPath', $False).GetValue('')
$Env:Path="$PyInstallPath;$Env:Path"

function global:_OLD_VIRTUAL_PROMPT {};
Set-Content Function:_OLD_VIRTUAL_PROMPT (Get-Content Function:Prompt);
Set-Content Function:prompt { "($Env:VIRTUAL_ENV) $(_OLD_VIRTUAL_PROMPT)"; };

"Note: this PowerShell SDK activation script is experimental."

python -c "from jetpack_sdk_env import welcome; welcome()"
