module.exports = {
    preset: '@react-native/jest-preset',
    // AsyncStorage ships untranspiled ESM, and the preset's default pattern
    // only exempts @react-native and @react-native-community.
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community|-async-storage)?)/)',
    ],
};
