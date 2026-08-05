import { Mudakop } from '../../types';

export async function getConfigSections(): Promise<Mudakop.ConfigSection[]> {
  return uci.load('mudakop').then(() => uci.sections('mudakop'));
}
