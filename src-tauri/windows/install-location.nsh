; The elevated executable is allowed to run only from this machine install.
; Tauri includes this file before defining PRODUCTNAME.
!define MOLIGOD_INSTALL_DIR "$PROGRAMFILES64\MoligodToolBox"

Function .onVerifyInstDir
  StrCmp $INSTDIR "${MOLIGOD_INSTALL_DIR}" accepted
  Abort
  accepted:
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
  ; Passive and silent installs skip the directory page, so enforce it here too.
  ${If} $INSTDIR != "${MOLIGOD_INSTALL_DIR}"
    MessageBox MB_ICONSTOP "Install ${PRODUCTNAME} in ${MOLIGOD_INSTALL_DIR}." /SD IDOK
    SetErrorLevel 1
    Abort
  ${EndIf}

  ; A v2.0.0 per-user update is a first machine install. Create its shortcuts.
  ReadRegStr $0 HKLM "${UNINSTKEY}" "InstallLocation"
  ${If} $0 == ""
    StrCpy $UpdateMode 0
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  CreateDirectory "$INSTDIR\update-cache"
  Push $0
  System::Call 'kernel32::CopyFileW(w "$EXEPATH", w "$INSTDIR\update-cache\installed-base.exe", i 0)i.r0'
  Pop $0
  Delete "$INSTDIR\update-cache\download.part"
  Delete "$INSTDIR\update-cache\download.id"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$INSTDIR\update-cache\installed-base.exe"
  Delete "$INSTDIR\update-cache\download.part"
  Delete "$INSTDIR\update-cache\download.id"
  RMDir "$INSTDIR\update-cache"
!macroend
