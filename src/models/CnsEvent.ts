import { ChildEntity } from 'typeorm';
import EthereumEvent from './EthereumEvent';

@ChildEntity()
export default class CnsEvent extends EthereumEvent {
  static location = 'CNS';
  location = 'CNS';
}
