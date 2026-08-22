/* eslint-env jest */
/**
 * Lucide icons render through react-native-svg's native views, which do not
 * exist under the test renderer. They carry no behaviour worth exercising, so
 * each becomes a plain View tagged with its name.
 */
jest.mock('lucide-react-native', () => {
    const React = require('react');
    const { View } = require('react-native');

    const icon = name => props =>
        React.createElement(View, { testID: `icon-${name}`, ...props });

    return {
        ArrowLeft: icon('ArrowLeft'),
        ArrowUpRight: icon('ArrowUpRight'),
        Bell: icon('Bell'),
        Crown: icon('Crown'),
        Link: icon('Link'),
        Plus: icon('Plus'),
        Search: icon('Search'),
        Trash2: icon('Trash2'),
        X: icon('X'),
    };
});
