// supabase-js reaches for web APIs React Native does not ship complete. Both
// polyfills have to be installed before createClient runs, which is why they are
// imported here rather than at the app entry point: the headless monitoring task
// boots without ever touching App.tsx.
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import {
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_URL,
} from '../../../config/supabase.ts';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        // Without durable storage every cold start would sign in as a brand new
        // anonymous user, quietly losing the tracked list.
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,

        // There is no OAuth redirect to read a session out of: this is a native
        // app, and the monitoring task has no URL bar at all.
        detectSessionInUrl: false,
    },
});
