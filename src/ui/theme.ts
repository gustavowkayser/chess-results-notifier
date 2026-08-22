/**
 * Inter, loaded from assets/fonts. Android resolves a face by file name rather
 * than by family + weight, so every style names the file it wants and leaves
 * fontWeight alone; setting both makes Android synthesise a fake bold over an
 * already-bold face.
 */
const fonts = {
    light: 'Inter-Light',
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
} as const;

export const theme = {
    background: '#000000',
    // Cards read by fill rather than outline: a solid step above black holds
    // its shape on an OLED panel where a hairline border disappears.
    card: '#131316',
    // One step above card again, for controls sitting on top of one.
    surface: '#1c1c21',
    border: '#26262c',
    text: '#f4f4f6',
    muted: '#8b8b96',
    // Placeholders and disabled copy, a step quieter than muted.
    faint: '#55555e',
    // The one saturated colour in the app. It marks live data and the primary
    // action and nothing else, so it keeps meaning something.
    accent: '#deff5c',
    // Lime is bright enough that only near-black sits readably on it.
    onAccent: '#0d0f06',
    // Lime at low opacity, for the track a progress ring runs over.
    accentTrack: '#33381c',
    switchTrackOff: '#2a2a31',
    danger: '#ff6b6b',

    fonts,

    radius: {
        card: 24,
        control: 16,
        pill: 999,
    },

    /**
     * Display sizes come from the references: a large, light, tightly-led
     * headline over quiet supporting copy. Light weight is what keeps 30px from
     * shouting, so it is part of the size rather than a separate choice.
     */
    type: {
        display: {
            fontFamily: fonts.light,
            fontSize: 30,
            lineHeight: 36,
            letterSpacing: -0.6,
        },
        title: {
            fontFamily: fonts.medium,
            fontSize: 17,
            letterSpacing: -0.2,
        },
        body: {
            fontFamily: fonts.regular,
            fontSize: 15,
        },
        meta: {
            fontFamily: fonts.regular,
            fontSize: 13,
        },
        label: {
            fontFamily: fonts.semibold,
            fontSize: 11,
            letterSpacing: 1.2,
        },
    },
} as const;
