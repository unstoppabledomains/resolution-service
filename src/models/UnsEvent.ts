import { ChildEntity } from 'typeorm';
import EthereumEvent from './EthereumEvent';

@ChildEntity()
export default class UnsEvent extends EthereumEvent {
  static location = 'UNSL1';
  location = 'UNSL1';
}
