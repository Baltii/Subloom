; Wine/CrossOver can ship a PowerShell stub that returns success for every
; command. The default shell-based check then reports a running app forever.
; Query the native process table instead. The setup executable has its own name.
!macro customCheckAppRunning
  subloom_check_running:
    nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
    Pop $R0
    ${If} $R0 == 0
      ; Do not forcibly terminate a workspace. Silent updates fail with code 2;
      ; interactive installs let the user close the app and retry.
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY subloom_check_running
      nsProcess::_Unload
      SetErrorLevel 2
      Quit
    ${ElseIf} $R0 != 603
      ; 603 means no matching process. An inspection failure is a separate error.
      DetailPrint "Native process check failed: $R0"
      MessageBox MB_OK|MB_ICONSTOP "${PRODUCT_NAME} could not check running applications. Restart Windows and try again." /SD IDOK
      nsProcess::_Unload
      SetErrorLevel 3
      Quit
    ${EndIf}
    nsProcess::_Unload
!macroend
