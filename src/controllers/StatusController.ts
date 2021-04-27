import {Get, JsonController} from "routing-controllers";
import 'reflect-metadata';

class StatusResponse {
    CNS: {
        latestNetworkBlock: number
        latestMirroredBlock: number
    } = {latestMirroredBlock: 0, latestNetworkBlock: 0};

    ZNS: {
        latestNetworkBlock: number
        latestMirroredBlock: number
    } = {latestMirroredBlock: 0, latestNetworkBlock: 0};
}

@JsonController()
export class StatusController {
    @Get('/status')
    async getStatus(): Promise<StatusResponse> {
        return new StatusResponse()
    }
}
