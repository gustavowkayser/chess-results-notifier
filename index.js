/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { MonitoringTask } from './src/monitoring/MonitoringTask';

AppRegistry.registerComponent(appName, () => App);

// Registered at the top level so it is present when React Native boots
// headless, without any UI, for a monitoring tick.
AppRegistry.registerHeadlessTask('MonitoringTask', () => MonitoringTask);
