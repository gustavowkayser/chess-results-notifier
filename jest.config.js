module.exports = {
    preset: '@react-native/jest-preset',
    // setupFilesAfterEnv, not setupFiles: the preset already populates
    // setupFiles, and setting it here would replace it rather than add to it.
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
