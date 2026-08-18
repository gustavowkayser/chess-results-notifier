/**
 * op-sqlite is a native JSI module: it ships untranspiled ESM and has no
 * JavaScript implementation, so it cannot load under Jest. Jest applies this
 * manual mock automatically to any suite that reaches the package — currently
 * App.test.tsx, which renders the app and pulls in src/api/index.ts.
 *
 * Opening is a no-op stub so module-scope wiring succeeds. Actually running a
 * query fails loudly: tests that need a real database use NodeSqliteDatabase
 * from test-support/ instead.
 */
const unavailable = () => {
    throw new Error(
        'op-sqlite is unavailable under Jest. Build the repository on ' +
            'NodeSqliteDatabase from test-support/ instead.',
    );
};

exports.open = () => ({
    execute: unavailable,
    transaction: unavailable,
    close: () => {},
});
