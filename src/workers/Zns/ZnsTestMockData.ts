import ZnsProvider from "./ZnsProvider";
import ZnsWorker from "./ZnsWorker";
import * as ZnsMockDataStorage from './znsMockDataStorage.json';

type ZnsClass = typeof ZnsProvider | typeof ZnsWorker;

export default class ZnsTestMockData {
  private testNames: string[] = [];
  private requests: any[] = [];
  private responses: any[] = [];

  constructor(klass: ZnsClass) {
    const klassName = klass.name as 'ZnsProvider' | 'ZnsWorker';
    const mockData = ZnsMockDataStorage[klassName];
    mockData.forEach((mock: {testname: string, request: any, response: any}) => {
      this.testNames.push(mock.testname);
      this.requests.push(mock.request);
      this.responses.push(mock.response);
    });
    return this;
  }

  public getResponse(request: any): any {
    const foundIndex = this.requests.findIndex((value) => value === request);
    if (foundIndex === -1 ) {
      throw new Error(`Request ${request} wasn't found in the storage`)
    }
    return this.responses[foundIndex];
  }

  public getMockForTest(testname: string): { request: any, response: any } {
    const mockIndex = this.testNames.findIndex((name) => testname === name);
    if (mockIndex === -1) {
      throw new Error(`Mock data for test ${testname} is not exist`);
    }
    return {request: this.requests[mockIndex], response: this.responses[mockIndex]};
  }
}