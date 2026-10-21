# Android navigation safe area

The tab bar previously used fixed Android padding, allowing system navigation to cover its labels and touch area. It now reserves the live device bottom inset in addition to a fixed 60 dp interactive area, with at least 12 dp bottom padding. Gesture/three-button navigation and orientation changes follow the provider. Initial window metrics avoid an initial zero-inset layout; the keyboard hides the tab bar. Floating notifications clear the adjusted bar too.

Merge order: CI/production migration → this safe-area fix → navigation motion → service suggestions. This PR targets the CI branch.

Validation: geometry tests cover zero, gesture and three-button insets and switching between them. Full application checks and exports are recorded in the final stack verification. Android device/emulator visual confirmation remains required; web rendering does not prove native insets.
