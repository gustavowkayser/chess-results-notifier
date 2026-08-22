/**
 * `assets` is the source of truth for the Inter files; `npx react-native-asset`
 * copies them into android/app/src/main/assets/fonts (already committed, so a
 * fresh clone builds without running the linker first).
 */
module.exports = {
    assets: ['./assets/fonts'],
};
