import chai from 'chai';
import chaiAsPromised from "chai-as-promised";
import chaiSubset from "chai-subset";
import 'chai/register-expect';

chai.use(chaiSubset);
chai.use(chaiAsPromised);

export const mochaHooks = {}