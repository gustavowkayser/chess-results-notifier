/**
 * @format
 */

import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator.tsx';
import { ToastProvider } from './src/ui/Toast.tsx';

function App() {
    return (
        <SafeAreaProvider>
            {/* No backgroundColor: RN 0.87 dropped it for edge-to-edge. Each
                screen paints behind the status bar via the safe-area inset. */}
            <StatusBar barStyle="light-content" />
            {/* Outside the navigator so a toast raised on the screen being left
                behind is still on screen after the transition. */}
            <ToastProvider>
                <RootNavigator />
            </ToastProvider>
        </SafeAreaProvider>
    );
}

export default App;
