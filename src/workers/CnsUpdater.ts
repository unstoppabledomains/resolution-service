import {logger} from "../logger";
import {setIntervalAsync} from "set-interval-async/dynamic";

setIntervalAsync(async () => {
    // Cns polling logic is here
    logger.info('CnsUpdater is pulling updates from Ethereum');
}, 5000);
