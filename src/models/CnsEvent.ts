import { ChildEntity } from 'typeorm';
import { env } from '../env';
import EthereumEvent, {
  CnsDomainOperationTypes,
  CnsEventTypes,
} from './EthereumEvent';

@ChildEntity()
export default class CnsEvent extends EthereumEvent {
  static EventTypes = CnsEventTypes;
  static DomainOperationTypes = CnsDomainOperationTypes;
  static InitialBlock =
    env.APPLICATION.ETHEREUM.CNS_REGISTRY_EVENTS_STARTING_BLOCK;
  static location = 'CNS';

  location = 'CNS';
}
