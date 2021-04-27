import {logger} from "../logger";
import { setIntervalAsync} from "set-interval-async/dynamic";

setIntervalAsync(async () => {
    // Zns polling logic is here
    logger.info('ZnsUpdater is pulling updates from Zilliqa');
}, 5000);
