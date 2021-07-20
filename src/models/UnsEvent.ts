import { ChildEntity } from 'typeorm';
import { env } from '../env';
import EthereumEvent, {
  UnsEventTypes,
  UnsDomainOperationTypes,
} from './EthereumEvent';

@ChildEntity()
export default class UnsEvent extends EthereumEvent {
  static EventTypes = UnsEventTypes;
  static DomainOperationTypes = UnsDomainOperationTypes;
  static InitialBlock =
    env.APPLICATION.ETHEREUM.UNS_REGISTRY_EVENTS_STARTING_BLOCK;
  static location = 'UNSL1';
  location = 'UNSL1';
}
