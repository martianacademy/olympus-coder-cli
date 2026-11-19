import { TuiApp } from './app.js';
/**
 * Process wiring for the interactive TUI: whatever happens (exit, signals, crashes) the terminal is restored
 * (alt screen, mouse reporting, bracketed paste and keyboard protocol off, cursor shown).
 */
export async function runTui(opts) {
    const app = new TuiApp(opts);
    const onSignal = () => app.exit();
    const onCrash = (e) => {
        app.fail(e);
        process.exitCode = 1;
    };
    const signals = ['SIGTERM', 'SIGHUP', 'SIGINT'];
    // 'exit' is the last resort: never leave the user's terminal in the alt screen / mouse mode.
    process.on('exit', onSignal);
    for (const s of signals)
        process.on(s, onSignal);
    process.on('uncaughtException', onCrash);
    process.on('unhandledRejection', onCrash);
    try {
        await app.run();
    }
    catch (e) {
        app.fail(e);
        throw e;
    }
    finally {
        app.exit();
        process.off('exit', onSignal);
        for (const s of signals)
            process.off(s, onSignal);
        process.off('uncaughtException', onCrash);
        process.off('unhandledRejection', onCrash);
    }
}
//# sourceMappingURL=run.js.map