import { BaseRepository } from './BaseRepository';
import { OrganizationSetting } from '../entities/OrganizationSetting';

export class OrganizationSettingRepository extends BaseRepository<OrganizationSetting> {
  constructor() {
    super(OrganizationSetting, 'OrganizationSetting');
  }
}