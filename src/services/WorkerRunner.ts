import {Worker} from 'worker_threads';
import {logger} from "../logger";

export function runWorker(workerPath: string) {
    const worker = new Worker(workerPath);
    worker.on('error', (err) => {logger.error(err)});
    process.on('SIGTERM', () => {
        void worker.terminate()
    });
    process.on('SIGINT', () => {
        void worker.terminate()
    });
}
