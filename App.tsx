/**
 * @format
 */

import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator.tsx';

function App() {
    return (
        <SafeAreaProvider>
            {/* No backgroundColor: RN 0.87 dropped it for edge-to-edge. Each
                screen paints behind the status bar via the safe-area inset. */}
            <StatusBar barStyle="light-content" />
            <RootNavigator />
        </SafeAreaProvider>
    );
}

export default App;
