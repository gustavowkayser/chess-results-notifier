import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../ui/screens/HomeScreen.tsx';
import { SearchScreen } from '../ui/screens/SearchScreen.tsx';
import { theme } from '../ui/theme.ts';

export type RootStackParamList = {
    Home: undefined;
    Search: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Both screens draw their own header, but the container's theme still decides
// the colour behind a transition, which is what stops a white flash.
const navigationTheme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        background: theme.background,
        card: theme.card,
        text: theme.text,
        border: theme.border,
        primary: theme.accent,
    },
};

export function RootNavigator() {
    return (
        <NavigationContainer theme={navigationTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Search" component={SearchScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
